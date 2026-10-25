/* v24 sound direction: local original loops, recorded voice, bounded WebAudio SFX.
   Uses the native AudioContext; never replaces the microphone/voice-chat path. */
(function () {
  "use strict";
  const KEY = "fz_sound24";
  const defaults = {
    enabled: true,
    footsteps: false,
    master: 0.8,
    music: 0.38,
    sfx: 0.65,
    ambience: 0.45,
    voice: 0.9,
  };
  function sanitize(raw) {
    const p = { ...defaults };
    if (raw && typeof raw === "object") {
      if (typeof raw.enabled === "boolean") p.enabled = raw.enabled;
      if (typeof raw.footsteps === "boolean") p.footsteps = raw.footsteps;
      for (const k of ["master", "music", "sfx", "ambience", "voice"])
        if (typeof raw[k] === "number" && Number.isFinite(raw[k]))
          p[k] = Math.max(0, Math.min(1, raw[k]));
    }
    return p;
  }
  let prefs = { ...defaults };
  try {
    prefs = sanitize(JSON.parse(localStorage.getItem(KEY)));
  } catch {}
  let ctx,
    master,
    buses,
    limiter,
    noiseBuffer,
    unlocked = false,
    blocked = false;
  let zone = "",
    track = "",
    generation = 0,
    current = null,
    fading = null,
    bed = null;
  let voice = null,
    voiceToken = 0,
    voiceID = "",
    captionTimer,
    caption;
  let panel,
    focusBefore,
    lastMetro = "",
    lastRattle = 0,
    preview = "",
    musicError = "";
  const buffers = new Map(),
    sources = new Set(),
    cooldown = new Map(),
    seen = new Set(),
    media = new WeakMap(),
    speakers = new Set();
  const tracks = {
    "neon-route": "Неоновый маршрут",
    "above-clouds": "Над облаками",
    "last-train": "Последний поезд",
  };
  const lines = {
    welcome: "Добро пожаловать в Фантазию. Твой город. Твой маршрут.",
    sky: "Небесная площадь. Новости — у сцены. Белый свет у лестницы укажет дорогу вниз.",
    city: "Открой меню, чтобы выбрать место для прогулки. Павильоны M ведут в метро.",
    credit:
      "Создано при помощи TEMKA_PLAY_OFFICIAL. Фантазия. Твой город оживает.",
  };
  function graph() {
    if (ctx) return ctx;
    if (typeof getAudioCtx !== "function") return null;
    ctx = getAudioCtx();
    if (!ctx) return null;
    master = ctx.createGain();
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -9;
    limiter.knee.value = 12;
    limiter.ratio.value = 4;
    limiter.attack.value = 0.008;
    limiter.release.value = 0.18;
    buses = {};
    for (const name of ["music", "sfx", "ambience", "voice"]) {
      buses[name] = ctx.createGain();
      buses[name].connect(master);
    }
    master.connect(limiter);
    limiter.connect(ctx.destination);
    apply();
    return ctx;
  }
  function bus(name) {
    graph();
    return buses?.[name] || ctx?.destination;
  }
  function ramp(node, value, seconds = 0.16) {
    if (!ctx || !node) return;
    node.gain.cancelScheduledValues(ctx.currentTime);
    node.gain.setTargetAtTime(value, ctx.currentTime, seconds);
  }
  function allowed() {
    return (
      !!ctx &&
      ctx.state !== "closed" &&
      unlocked &&
      prefs.enabled &&
      prefs.master > 0 &&
      !document.hidden
    );
  }
  function apply() {
    if (!master) return;
    // Hard mute/hidden immediately; gentle transitions only while audible.
    const value = allowed() ? prefs.master : 0;
    master.gain.cancelScheduledValues(0);
    master.gain.value = value;
    const duck = speakers.size ? 0.24 : 1;
    const musicOn =
      typeof SETTINGS === "undefined" || SETTINGS.bgMusic !== false;
    ramp(buses.music, prefs.music * duck * (musicOn ? 1 : 0));
    ramp(buses.sfx, prefs.sfx);
    ramp(buses.ambience, prefs.ambience * (speakers.size ? 0.45 : 1));
    ramp(buses.voice, prefs.voice);
  }
  function set(raw) {
    prefs = sanitize({ ...prefs, ...raw });
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {}
    if (!prefs.enabled || prefs.master === 0) silence();
    if (prefs.voice === 0) {
      stopVoice();
      window.FZMetroAudio?.stop();
    }
    apply();
    tick();
    syncPanel();
    return { ...prefs };
  }
  function unlock() {
    if (document.hidden) return;
    unlocked = true;
    try {
      graph();
      if (ctx?.state !== "running")
        ctx
          .resume()
          .then(() => {
            blocked = false;
            apply();
            tick();
          })
          .catch(() => {
            blocked = true;
            syncPanel();
          });
      apply();
      tick();
    } catch {
      blocked = true;
    }
  }
  // Events must really come from a user; public unlock remains callable by UI handlers.
  for (const type of ["pointerdown", "keydown"])
    document.addEventListener(
      type,
      (e) => {
        if (e.isTrusted) {
          if (e.target?.closest?.("#fzIntroSkip") && window.FZFront?.active()) {
            seen.add("intro");
            zone = "intro";
          }
          unlock();
        }
      },
      { capture: true, passive: true },
    );
  function noise() {
    if (!noiseBuffer) {
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
      const d = noiseBuffer.getChannelData(0);
      let n = 2401;
      for (let i = 0; i < d.length; i++) {
        n = (Math.imul(n, 1664525) + 1013904223) | 0;
        d[i] = (n / 2147483648) * 0.65;
      }
      // Crossfade the ends of the looping texture.
      const edge = Math.floor(ctx.sampleRate * 0.04);
      for (let i = 0; i < edge; i++)
        d[d.length - edge + i] =
          d[d.length - edge + i] * (1 - i / edge) + (d[i] * i) / edge;
    }
    return noiseBuffer;
  }
  function own(source, nodes) {
    const item = {
      source,
      nodes,
      stop() {
        try {
          source.stop();
        } catch {}
        source.disconnect();
        nodes.forEach((n) => n.disconnect());
        sources.delete(item);
      },
    };
    sources.add(item);
    source.onended = () => item.stop();
    return item;
  }
  function tone(
    freq,
    duration,
    volume = 0.07,
    end = freq,
    delay = 0,
    type = "sine",
  ) {
    if (!allowed() || !prefs.sfx || sources.size >= 40) return;
    graph();
    const source = ctx.createOscillator(),
      gain = ctx.createGain(),
      at = ctx.currentTime + delay;
    source.type = type;
    source.frequency.setValueAtTime(freq, at);
    source.frequency.exponentialRampToValueAtTime(
      Math.max(20, end),
      at + duration,
    );
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(gain);
    gain.connect(buses.sfx);
    own(source, [gain]);
    source.start(at);
    source.stop(at + duration + 0.02);
  }
  function air(duration, volume, frequency, end = frequency) {
    if (!allowed() || !prefs.sfx || sources.size >= 40) return;
    graph();
    const source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    source.buffer = noise();
    source.loop = true;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(frequency, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(40, end),
      ctx.currentTime + duration,
    );
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(buses.sfx);
    own(source, [gain, filter]);
    source.start();
    source.stop(ctx.currentTime + duration + 0.02);
  }
  function effect(name, options = {}) {
    if (!allowed()) return false;
    const now = performance.now();
    if (now - (cooldown.get(name) ?? -Infinity) < (name === "step" ? 110 : 70))
      return false;
    cooldown.set(name, now);
    if (name === "click") {
      if (typeof SETTINGS !== "undefined" && SETTINGS.uiSounds === false)
        return false;
      tone(680, 0.065, 0.045, 460);
    } else if (name === "flash") {
      air(0.055, 0.15, 4200, 1400);
      tone(280, 0.07, 0.04, 190);
    } else if (name === "step") {
      const hard = !!options.hard,
        v = Math.max(0.02, Math.min(0.18, Number(options.volume) || 0.1));
      air(hard ? 0.075 : 0.13, v, hard ? 1700 : 650, 250);
      tone(hard ? 120 : 74, 0.09, v * 0.45, 45);
    } else if (name === "doors") {
      air(1.2, 0.13, 950, 190);
      tone(110, 0.8, 0.045, 65);
    } else if (name === "chime") {
      tone(659, 0.55, 0.1);
      tone(880, 0.7, 0.08, 880, 0.2);
      tone(988, 0.8, 0.055, 988, 0.4);
    } else if (name === "close") {
      tone(880, 0.19, 0.09);
      tone(660, 0.24, 0.08, 660, 0.24);
      air(1.3, 0.09, 1000, 180);
    } else if (name === "whoosh") {
      air(1.8, 0.18, 140, 2400);
      tone(130, 1.5, 0.045, 65);
    } else if (name === "brake") {
      air(1.8, 0.12, 1800, 250);
      tone(410, 1.3, 0.03, 90);
    } else if (name === "rail") {
      air(0.1, 0.08, 600);
      tone(65, 0.12, 0.06, 35);
    } else return false;
    return true;
  }
  async function load(name) {
    if (!buffers.has(name))
      buffers.set(
        name,
        fetch("audio/music/" + name + ".wav")
          .then((r) => {
            if (!r.ok) throw Error("HTTP " + r.status);
            return r.arrayBuffer();
          })
          .then((b) => ctx.decodeAudioData(b))
          .catch(() => {
            musicError = "Не удалось загрузить музыку. Нажми «Повторить звук».";
            syncPanel();
            return null;
          }),
      );
    return buffers.get(name);
  }
  function stopTrack(item, fade = 0) {
    if (!item) return;
    if (fade) {
      item.gain.gain.cancelScheduledValues(ctx.currentTime);
      item.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.18);
      try {
        item.source.stop(ctx.currentTime + fade);
      } catch {}
    } else {
      try {
        item.source.stop();
      } catch {}
      item.source.disconnect();
      item.gain.disconnect();
    }
  }
  async function selectTrack(name) {
    if (!allowed()) name = "";
    if (track === name) return;
    track = name;
    const token = ++generation;
    stopTrack(fading);
    fading = current;
    current = null;
    stopTrack(fading, 0.8);
    if (!name || !allowed()) return;
    graph();
    const buffer = await load(name);
    if (!buffer || token !== generation || !allowed()) return;
    const source = ctx.createBufferSource(),
      gain = ctx.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    gain.connect(buses.music);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 1);
    const item = { source, gain };
    current = item;
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      if (current === item) current = null;
      if (fading === item) fading = null;
    };
    source.start();
  }
  function stopBed() {
    if (bed) {
      bed.items.forEach((i) => i.stop());
      bed = null;
    }
  }
  function ambience(next) {
    const key = ["city", "sky", "metro"].includes(next) ? next : "";
    if (bed?.key === key || (!bed && !key)) return;
    stopBed();
    if (!key || !allowed()) return;
    graph();
    const source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    source.buffer = noise();
    source.loop = true;
    filter.type = "lowpass";
    filter.frequency.value = key === "sky" ? 750 : key === "city" ? 320 : 180;
    gain.gain.value = key === "sky" ? 0.035 : 0.025;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(buses.ambience);
    const item = own(source, [filter, gain]);
    source.start();
    bed = { key, items: [item], gain };
    if (key === "metro") {
      const motor = ctx.createOscillator(),
        mg = ctx.createGain();
      motor.frequency.value = 53;
      mg.gain.value = 0.035;
      motor.connect(mg);
      mg.connect(gain);
      bed.items.push(own(motor, [mg]));
      motor.start();
    }
  }
  function speaking(audio, on) {
    if (on) speakers.add(audio);
    else speakers.delete(audio);
    apply();
  }
  function pipeVoice(audio) {
    graph();
    if (!ctx || media.has(audio)) return;
    const source = ctx.createMediaElementSource(audio);
    source.connect(buses.voice);
    media.set(audio, source);
    audio.addEventListener("playing", () => {
      if (!allowed()) {
        audio.pause();
        return;
      }
      speaking(audio, true);
    });
    for (const event of ["pause", "ended", "error", "emptied", "waiting"])
      audio.addEventListener(event, () => speaking(audio, false));
  }
  function stopVoice() {
    ++voiceToken;
    clearTimeout(captionTimer);
    voiceID = "";
    if (voice) {
      voice.pause();
      voice.currentTime = 0;
      speaking(voice, false);
    }
    if (caption) caption.hidden = true;
  }
  function say(id) {
    if (!lines[id] || !allowed() || !prefs.master || !prefs.voice) return false;
    stopVoice();
    window.FZMetroAudio?.stop();
    if (!voice) {
      voice = new Audio();
      voice.preload = "none";
      pipeVoice(voice);
      voice.addEventListener("ended", stopVoice);
      voice.addEventListener("error", () => {
        blocked = true;
        stopVoice();
        syncPanel();
      });
    }
    const token = ++voiceToken;
    voiceID = id;
    if (!caption) {
      caption = document.createElement("div");
      caption.id = "fzSoundCaption";
      caption.setAttribute("role", "status");
      document.body.append(caption);
    }
    caption.textContent = lines[id];
    caption.hidden = false;
    captionTimer = setTimeout(() => {
      if (caption) caption.hidden = true;
    }, 16000);
    voice.src = "audio/city/" + id + ".mp3";
    voice
      .play()
      .then(() => {
        if (token === voiceToken) blocked = false;
      })
      .catch(() => {
        if (token === voiceToken) {
          blocked = true;
          speaking(voice, false);
          syncPanel();
        }
      });
    return true;
  }
  function visible(id) {
    const e = document.getElementById(id);
    return (
      !!e &&
      !e.hidden &&
      getComputedStyle(e).display !== "none" &&
      getComputedStyle(e).visibility !== "hidden"
    );
  }
  function detectZone() {
    if (window.FZFront?.active()) return "intro";
    if (visible("authScreen") || visible("createScreen")) return "auth";
    if (visible("serverScreen")) return "lobby";
    if (!document.body.classList.contains("game-active") || window._loadingGate)
      return "loading";
    if (window.FZMetro?.active()) return "metro";
    if (window.FZSky?.busy()) return "descent";
    if (window.FZSky?.active()) return "sky";
    if (
      typeof isInsideBuilding !== "undefined" &&
      (isInsideBuilding || isInFactory || isInBasement)
    )
      return "interior";
    return "city";
  }
  function tick() {
    const next = detectZone();
    if (!allowed()) {
      zone = next;
      apply();
      return;
    }
    if (next !== zone) {
      stopVoice();
      preview = "";
      zone = next;
      if (next === "intro") seen.delete("intro");
      if (next === "descent") effect("whoosh");
    }
    if (!seen.has(next)) {
      if (["lobby", "sky", "city"].includes(next)) {
        say(next === "lobby" ? "welcome" : next);
        seen.add(next);
      } else if (next === "intro" && window.FZFront?.info().elapsed < 4) {
        say("credit");
        seen.add(next);
      }
    }
    const legacy =
      typeof MUSIC !== "undefined" &&
      !!MUSIC.def &&
      (typeof SETTINGS === "undefined" || SETTINGS.bgMusic !== false);
    let wanted =
      next === "lobby" || next === "city"
        ? "neon-route"
        : ["intro", "sky", "descent"].includes(next)
          ? "above-clouds"
          : next === "metro"
            ? "last-train"
            : next === "interior"
              ? "above-clouds"
              : "";
    if (legacy) wanted = "";
    if (typeof SETTINGS !== "undefined" && SETTINGS.bgMusic === false)
      wanted = "";
    if (!prefs.music || !prefs.master) wanted = "";
    if (preview && panel && !panel.hidden) wanted = preview;
    selectTrack(wanted);
    ambience(next);
    apply();
    if (next === "metro") {
      const m = FZMetro.info(),
        tag = m.index + ":" + m.state;
      if (tag !== lastMetro) {
        if (m.state === "open") {
          effect("chime");
          effect("doors");
        }
        if (m.state === "closing") effect("close");
        if (m.state === "arriving") effect("brake");
        lastMetro = tag;
      }
      if (bed)
        ramp(
          bed.gain,
          m.state === "travel" ? 0.18 : m.state === "arriving" ? 0.07 : 0.025,
          0.4,
        );
      if (m.state === "travel" && performance.now() - lastRattle > 750) {
        effect("rail");
        lastRattle = performance.now();
      }
    } else lastMetro = "";
  }
  function silence() {
    generation++;
    track = "";
    stopTrack(current);
    stopTrack(fading);
    current = fading = null;
    stopBed();
    [...sources].forEach((i) => i.stop());
    stopVoice();
    window.FZMetroAudio?.stop();
    speakers.clear();
    apply();
  }
  function syncPanel() {
    if (!panel || panel.hidden) return;
    panel.querySelector("[data-enabled]").checked = prefs.enabled;
    panel.querySelector("[data-steps]").checked = prefs.footsteps;
    panel.querySelector("[data-bg]").checked =
      typeof SETTINGS === "undefined" || SETTINGS.bgMusic !== false;
    for (const k of ["master", "music", "sfx", "ambience", "voice"]) {
      panel.querySelector('[data-level="' + k + '"]').value = prefs[k];
      panel.querySelector('[data-out="' + k + '"]').value =
        Math.round(prefs[k] * 100) + "%";
    }
    panel.querySelector("[data-status]").textContent =
      musicError ||
      (blocked
        ? "Браузер остановил звук. Нажми «Повторить звук»."
        : "Звук включается после касания. Голос приглушает фон.");
  }
  function close() {
    if (panel) panel.hidden = true;
    preview = "";
    stopVoice();
    tick();
    if (focusBefore?.isConnected) focusBefore.focus();
  }
  function open() {
    unlock();
    window.FZUI?.close();
    if (document.pointerLockElement) document.exitPointerLock();
    if (typeof keys !== "undefined")
      Object.keys(keys).forEach((k) => (keys[k] = false));
    focusBefore = document.activeElement;
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "fzSoundPanel";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      panel.setAttribute("aria-labelledby", "fzSoundTitle");
      panel.innerHTML =
        '<article><header><div><small>FANTAZIA / SOUND 24</small><h2 id="fzSoundTitle">Звук города</h2></div><button data-close>Закрыть</button></header><label class="sound-enable"><input type="checkbox" data-enabled> Включить звук игры</label><label class="sound-enable"><input type="checkbox" data-bg> Фоновая музыка</label><label class="sound-enable"><input type="checkbox" data-steps> Шаги персонажа</label><div data-levels></div><p data-status role="status"></p><button data-retry>Повторить звук</button><h3>Послушать музыку</h3><div data-tracks></div><h3>Голос и эффекты</h3><div data-demos><button data-voice="welcome">Приветствие</button><button data-voice="sky">Небесная площадь</button><button data-voice="city">Город</button><button data-voice="credit">Заставка</button><button data-effect="doors">Двери</button><button data-effect="chime">Сигнал станции</button><button data-effect="whoosh">Пролёт</button><button data-stop>Стоп-прослушивание</button></div><p class="sound-note">Оригинальная синтезированная музыка и SFX. Записанный AI-голос. Настройки хранятся на этом устройстве. Голосовой чат регулируется отдельно.</p></article>';
      for (const [key, title] of Object.entries({
        master: "Общая громкость",
        music: "Музыка",
        sfx: "Эффекты",
        ambience: "Атмосфера",
        voice: "Озвучка",
      })) {
        const label = document.createElement("label");
        label.className = "sound-level";
        label.innerHTML =
          "<span>" +
          title +
          '</span><output data-out="' +
          key +
          '"></output><input aria-label="' +
          title +
          '" type="range" min="0" max="1" step="0.05" data-level="' +
          key +
          '">';
        label.querySelector("input").oninput = (e) =>
          set({ [key]: Number(e.target.value) });
        panel.querySelector("[data-levels]").append(label);
      }
      for (const [key, title] of Object.entries(tracks)) {
        const b = document.createElement("button");
        b.textContent = title;
        b.dataset.track = key;
        b.onclick = () => {
          unlock();
          preview = key;
          selectTrack(key);
        };
        panel.querySelector("[data-tracks]").append(b);
      }
      panel.querySelector("[data-enabled]").onchange = (e) =>
        set({ enabled: e.target.checked });
      panel.querySelector("[data-steps]").onchange = (e) =>
        set({ footsteps: e.target.checked });
      panel.querySelector("[data-bg]").onchange = (e) => {
        if (
          typeof SETTINGS !== "undefined" &&
          SETTINGS.bgMusic !== e.target.checked
        )
          toggleSetting("bgMusic");
        preview = "";
        tick();
        syncPanel();
      };
      panel.querySelector("[data-close]").onclick = close;
      panel.querySelector("[data-retry]").onclick = () => {
        buffers.clear();
        musicError = "";
        track = "";
        unlock();
        syncPanel();
      };
      panel
        .querySelectorAll("[data-voice]")
        .forEach((b) => (b.onclick = () => say(b.dataset.voice)));
      panel
        .querySelectorAll("[data-effect]")
        .forEach((b) => (b.onclick = () => effect(b.dataset.effect)));
      panel.querySelector("[data-stop]").onclick = () => {
        preview = "";
        stopVoice();
        window.FZMetroAudio?.stop();
        tick();
      };
      panel.onkeydown = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          close();
        }
        if (e.key === "Tab") {
          const f = [...panel.querySelectorAll("button,input")],
            i = f.indexOf(document.activeElement);
          e.preventDefault();
          f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
        }
        e.stopPropagation();
      };
      document.body.append(panel);
    }
    panel.hidden = false;
    syncPanel();
    panel.querySelector("[data-close]").focus();
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      silence();
      ctx?.suspend().catch(() => {});
    } else {
      apply();
      if (unlocked) unlock();
    }
  });
  window.addEventListener("pagehide", () => {
    silence();
    ctx?.suspend().catch(() => {});
  });
  window.addEventListener("pageshow", () => {
    if (unlocked && !document.hidden) unlock();
  });
  window.FZSound = {
    set,
    open,
    close,
    say,
    effect,
    bus,
    pipeVoice,
    stopVoice,
    unlock,
    sanitize,
    unlocked: () => unlocked,
    audible: allowed,
    stepsEnabled: () => prefs.footsteps && allowed(),
    tick,
    silence,
    info: () => ({
      prefs: { ...prefs },
      unlocked,
      blocked,
      zone,
      track,
      playing: !!current,
      voice: voiceID,
      ducked: !!speakers.size,
      context: ctx?.state || "uninitialized",
      sources: sources.size,
      loops: Number(!!current) + Number(!!fading),
      buffers: buffers.size,
      musicError,
      gains: buses
        ? Object.fromEntries(
            Object.entries(buses).map(([k, v]) => [k, v.gain.value]),
          )
        : {},
      masterGain: master?.gain.value || 0,
    }),
  };
  setInterval(tick, 250);
})();
