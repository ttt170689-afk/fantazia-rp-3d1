/* v13: actual-renderer phone profiles, lifecycle recovery and player utilities.
 * No new animation loop and no automatic dialogs. Preferences never touch accounts. */
(function () {
  "use strict";
  const P = FZPlayPolicy,
    KEY = "fz_play_v13";
  let prefs = P.clean(null),
    panel = null,
    focus = null,
    notice = null,
    lost = false,
    current = null,
    model = null,
    lastWorld = null;
  let sampler = new P.Resolution(),
    lastUI = -Infinity,
    lastStatus = -Infinity,
    offlineAt = 0,
    activeBefore = false;
  let wake = null,
    wakePending = false,
    wakeError = false,
    lastRescue = -Infinity;
  const bound = new WeakSet();
  try {
    prefs = P.clean(JSON.parse(localStorage.getItem(KEY)));
  } catch (e) {}
  const mobile = () =>
    navigator.maxTouchPoints > 0 || matchMedia("(pointer:coarse)").matches;
  const active = () => !!window.FZUI?.playing();
  function outdoor() {
    return (
      active() &&
      typeof localPlayer !== "undefined" &&
      !!localPlayer?.mesh &&
      !window.cine &&
      !window._loadingGate &&
      !isInsideBuilding &&
      !isInFactory &&
      !isInBasement &&
      !localCar &&
      !window.FZ8SEA?.active() &&
      !window.FZ8SEA?.aboard() &&
      !window.FZ8M?.ride?.() &&
      !window.FZ8L?.drive?.() &&
      !DLC.demonFightStarted
    );
  }
  function release() {
    window.FZTouch?.release();
    if (typeof keys !== "undefined")
      Object.keys(keys).forEach((k) => (keys[k] = false));
    if (typeof mouseDown !== "undefined") mouseDown = false;
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
      return true;
    } catch (e) {
      message(
        "Браузер не разрешил сохранение. Настройки действуют до закрытия вкладки.",
      );
      return false;
    }
  }
  function controls() {
    const b = document.body;
    b.classList.toggle("fz-left-handed", prefs.leftHand);
    b.classList.toggle("fz-reduced-motion", prefs.reduceMotion);
    b.style.setProperty("--fz-control-scale", String(prefs.size));
    b.style.setProperty("--fz-control-opacity", String(prefs.opacity));
  }
  function prepare() {
    model = P.choose(
      prefs,
      mobile(),
      navigator.hardwareConcurrency || 8,
      navigator.deviceMemory || 8,
    );
    if (!model) {
      window._perfMaxLights = SETTINGS.perf ? 6 : null;
      return;
    }
    Object.assign(SETTINGS, {
      renderScale: model.ratio,
      fpsCap: model.cap,
      drawDist: model.distance,
      grassDensity: model.grass,
      maxLights: model.lights,
      shadowQuality: "off",
      aa: false,
      aniso: 1,
      shaderQuality: model.lights > 4 ? "medium" : "low",
      dynRes: false,
      perf: false,
    });
    sampler.reset(model.ratio, model.cap);
  }
  function inSpecialWorld() {
    return (
      window.FZSky?.active() ||
      isInsideBuilding ||
      isInFactory ||
      isInBasement ||
      window.FZ8SEA?.active()
    );
  }
  function bind(r) {
    if (bound.has(r.domElement)) return;
    bound.add(r.domElement);
    r.domElement.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      lost = true;
      release();
      sampler.pause();
      if (active()) gpuOverlay(true);
    });
    r.domElement.addEventListener("webglcontextrestored", () => {
      lost = false;
      current = null;
      sampler.pause();
      gpuOverlay(false);
      apply(false);
    });
  }
  function gpuOverlay(show) {
    let el = document.getElementById("fzGpuRecovery");
    if (!el) {
      el = document.createElement("section");
      el.id = "fzGpuRecovery";
      el.className = "fz-play-dialog";
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "true");
      el.setAttribute("aria-label", "Восстановление графики");
      el.innerHTML =
        '<div class="fz-play-card"><h2>Восстанавливаем графику</h2><p>Браузер временно отключил 3D. Если изображение не вернётся, перезагрузи игру. Несохранённые действия могут быть потеряны.</p><button type="button">Перезагрузить игру</button></div>';
      el.querySelector("button").onclick = () => location.reload();
      document.body.appendChild(el);
    }
    el.hidden = !show;
    if (show) el.querySelector("button").focus();
  }
  function apply(rebuild = false) {
    controls();
    if (typeof renderer === "undefined" || !renderer) return;
    bind(renderer);
    current = renderer;
    if (!model) return;
    renderer.setPixelRatio(Math.min(sampler.ratio, devicePixelRatio || 1));
    renderer.shadowMap.enabled = false;
    window._perfMaxLights = model.lights;
    if (!inSpecialWorld()) {
      camera.far = model.distance + 60;
      camera.updateProjectionMatrix();
      if (scene.fog) {
        scene.fog.near = model.distance * 0.48;
        scene.fog.far = model.distance;
      }
      window.FOG_FAR_SET = model.distance;
    }
    window.FZFX?.sessionQuality?.(model.fx);
    if (rebuild && typeof buildGrassField === "function") buildGrassField();
  }
  function set(key, value) {
    const before = prefs;
    prefs = P.clean({ ...prefs, [key]: value });
    save();
    controls();
    if (before.quality !== prefs.quality) {
      prepare();
      apply(true);
    }
    if (key === "keepAwake") {
      wakeError = false;
      syncWake();
      if (value && !navigator.wakeLock)
        message("Этот браузер не поддерживает удержание экрана включённым.");
    }
    return { ...prefs };
  }
  function buzz() {
    if (prefs.haptics && mobile() && navigator.vibrate)
      try {
        navigator.vibrate(12);
      } catch (e) {}
  }
  async function syncWake() {
    const wanted = prefs.keepAwake && active() && !document.hidden && !lost;
    if (!wanted) {
      const old = wake;
      wake = null;
      if (old)
        try {
          await old.release();
        } catch (e) {}
      return;
    }
    if (wake || wakePending || wakeError || !navigator.wakeLock) return;
    wakePending = true;
    try {
      const lock = await navigator.wakeLock.request("screen");
      if (!prefs.keepAwake || document.hidden || !active())
        await lock.release();
      else {
        wake = lock;
        lock.addEventListener("release", () => {
          if (wake === lock) wake = null;
        });
      }
    } catch (e) {
      wakeError = true;
      message("Браузер не разрешил удерживать экран включённым.");
    } finally {
      wakePending = false;
    }
  }
  function message(text) {
    const el = panel?.querySelector("[data-message]");
    if (el) el.textContent = text;
  }
  function status() {
    if (!notice) {
      notice = document.createElement("div");
      notice.id = "fzConnection";
      notice.setAttribute("role", "status");
      notice.hidden = true;
      document.body.appendChild(notice);
    }
    if (!active()) {
      notice.hidden = true;
      offlineAt = 0;
      return;
    }
    const connected = typeof socket !== "undefined" && socket?.connected;
    if (connected) {
      notice.hidden = true;
      offlineAt = 0;
      return;
    }
    if (!offlineAt) offlineAt = performance.now();
    notice.hidden = performance.now() - offlineAt < 3000;
    const text = localPlayer?.isOffline
      ? "Локальная игра · сетевые функции недоступны"
      : "Связь потеряна · ожидаем переподключения";
    if (notice.textContent !== text) notice.textContent = text;
  }
  function frame(now) {
    if (!Number.isFinite(now)) now = performance.now();
    window.FZJourney?.frame(now);
    const special = inSpecialWorld();
    if (current !== renderer || special !== lastWorld) {
      lastWorld = special;
      apply(false);
    }
    const playing = active();
    if (playing !== activeBefore) {
      activeBefore = playing;
      release();
      sampler.pause();
      syncWake();
      if (!playing) {
        close();
        window.FZGuide?.close();
        window.FZJourney?.close();
        window.FZPhoto?.close();
        window.FZSky?.cancel();
      }
    }
    const ratio = model?.adaptive
      ? sampler.sample(
          now,
          playing &&
            !document.hidden &&
            !lost &&
            !window._loadingGate &&
            !window.cine,
        )
      : null;
    if (ratio !== null && ratio !== undefined && renderer)
      renderer.setPixelRatio(Math.min(ratio, devicePixelRatio || 1));
    if (now - lastStatus > 1000) {
      lastStatus = now;
      status();
      syncWake();
      if (panel && !panel.hidden) {
        const e = panel.querySelector("[data-runtime]");
        e.textContent =
          "Профиль: " +
          ({ battery: "экономия", balanced: "баланс", quality: "чёткость" }[
            model?.id
          ] || "свои настройки") +
          " · масштаб " +
          Math.round((renderer?.getPixelRatio() || 1) * 100) +
          "%" +
          (sampler.fps ? " · " + Math.round(sampler.fps) + " кадров/с" : "");
      }
    }
    window.FZGuide?.update(now);
  }
  function uiDue(now) {
    if (now - lastUI < 100) return false;
    lastUI = now;
    return true;
  }
  function rescue() {
    if (window.FZSky?.active() && !window.cine) {
      FZSky.spawn(localPlayer.mesh);
      close();
      return true;
    }
    if (!outdoor()) {
      message(
        "Сначала выйди из помещения или транспорта. Помощь не обходит сюжетные условия.",
      );
      return false;
    }
    if (performance.now() - lastRescue < 15000) {
      message("Повторная помощь будет доступна через 15 секунд.");
      return false;
    }
    if (!window.FZClassic?.travel("square")) {
      message("Не удалось найти свободное место.");
      return false;
    }
    lastRescue = performance.now();
    release();
    close();
    return true;
  }
  function close() {
    if (panel) panel.hidden = true;
    if (focus?.isConnected) focus.focus();
    focus = null;
    release();
  }
  function open() {
    if (!active()) return;
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "fzPlayPanel";
      panel.className = "fz-play-dialog";
      panel.hidden = true;
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      panel.setAttribute("aria-labelledby", "fzPlayTitle");
      panel.innerHTML =
        '<div class="fz-play-card"><header><div><small>FANTAZIA / КОМФОРТ</small><h2 id="fzPlayTitle">Игра на телефоне</h2></div><button data-close>Закрыть</button></header><p>Настройки применяются сразу и сохраняются в этом браузере.</p><label>Качество<select data-pref="quality"><option value="auto">Авто — по устройству</option><option value="battery">Экономия — 30 кадров/с</option><option value="balanced">Баланс — цель 30 кадров/с</option><option value="quality">Чёткость — цель 60 кадров/с</option><option value="custom">Свои настройки графики</option></select></label><p class="fz-muted" data-runtime></p><label>Размер управления <output data-value="size"></output><input data-pref="size" type="range" min="0.85" max="1.2" step="0.05"></label><label>Непрозрачность кнопок <output data-value="opacity"></output><input data-pref="opacity" type="range" min="0.5" max="1" step="0.05"></label><label class="fz-check"><input data-pref="leftHand" type="checkbox"> Джойстик справа (для левши)</label><label class="fz-check"><input data-pref="haptics" type="checkbox"> Короткая вибрация кнопок, если доступна</label><label class="fz-check"><input data-pref="reduceMotion" type="checkbox"> Меньше тряски и анимаций интерфейса</label><label class="fz-check"><input data-pref="keepAwake" type="checkbox"> Не гасить экран во время игры, если браузер позволяет</label><div class="fz-play-tools"><button data-fullscreen>На весь экран</button><button data-controls>Чувствительность и кнопки</button><button data-advanced>Расширенная графика</button><button data-rescue>Я застрял — на площадь</button></div><details><summary>Как открыть на телефоне</summary><p>Открой ссылку игры в отдельной вкладке. Android: меню браузера → «Добавить на главный экран». iPhone: Safari → «Поделиться» → «На экран Домой».</p><p>Можно играть вертикально и горизонтально. Для сетевых функций нужен интернет; это не офлайн-копия игры.</p></details><p role="status" data-message></p></div>';
      document.body.appendChild(panel);
      panel.querySelector("[data-close]").onclick = close;
      panel.querySelectorAll("[data-pref]").forEach((el) => {
        el.oninput = () => {
          const k = el.dataset.pref,
            v =
              el.type === "checkbox"
                ? el.checked
                : el.type === "range"
                  ? Number(el.value)
                  : el.value;
          set(k, v);
          const out = panel.querySelector('[data-value="' + k + '"]');
          if (out) out.textContent = Math.round(v * 100) + "%";
        };
      });
      panel.querySelector("[data-controls]").onclick = () => {
        close();
        FZTouch.open();
      };
      panel.querySelector("[data-advanced]").onclick = () => {
        set("quality", "custom");
        close();
        openSettingsFromPause();
      };
      panel.querySelector("[data-rescue]").onclick = rescue;
      panel.querySelector("[data-fullscreen]").onclick = async () => {
        try {
          if (!document.fullscreenEnabled) throw Error();
          await document.documentElement.requestFullscreen();
        } catch (e) {
          message(
            "Полный экран недоступен здесь. Открой игру отдельной вкладкой или добавь на главный экран.",
          );
        }
      };
      panel.onclick = (e) => {
        if (e.target === panel) close();
      };
      panel.addEventListener("pointerdown", (e) => e.stopPropagation());
      panel.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          close();
        }
        if (e.key === "Tab") {
          const els = [
            ...panel.querySelectorAll("button,input,select,summary"),
          ].filter((e) => e.getClientRects().length && !e.disabled);
          e.preventDefault();
          els[
            (els.indexOf(document.activeElement) +
              (e.shiftKey ? -1 : 1) +
              els.length) %
              els.length
          ].focus();
        }
        e.stopPropagation();
      });
    }
    focus = document.activeElement;
    release();
    if (document.pointerLockElement) document.exitPointerLock();
    panel.hidden = false;
    message("");
    panel.querySelectorAll("[data-pref]").forEach((el) => {
      const v = prefs[el.dataset.pref];
      if (el.type === "checkbox") el.checked = v;
      else el.value = v;
      const out = panel.querySelector('[data-value="' + el.dataset.pref + '"]');
      if (out) out.textContent = Math.round(v * 100) + "%";
    });
    panel.querySelector("[data-close]").focus();
  }
  document.addEventListener("visibilitychange", () => {
    release();
    sampler.pause();
    wakeError = false;
    syncWake();
  });
  window.addEventListener("blur", release);
  window.addEventListener("pagehide", () => {
    release();
    sampler.pause();
    if (wake) wake.release().catch(() => {});
  });
  const viewport = () => {
    const style = document.documentElement.style;
    style.setProperty("--fz-viewport-height", Math.round(window.visualViewport?.height || innerHeight) + "px");
    style.setProperty("--fz-viewport-top", Math.round(window.visualViewport?.offsetTop || 0) + "px");
  };
  window.visualViewport?.addEventListener("scroll", viewport);
  window.visualViewport?.addEventListener("resize", viewport);
  window.addEventListener("resize", viewport);
  viewport();
  controls();
  window.FZPlay = {
    reducedMotion: () => prefs.reduceMotion,
    prepare,
    apply,
    frame,
    uiDue,
    open,
    close,
    set,
    buzz,
    rescue,
    outdoor,
    release,
    managed: () => !!model,
    paused: () => lost || document.hidden,
    info: () => ({
      prefs: { ...prefs },
      profile: model?.id || "custom",
      ratio: renderer?.getPixelRatio?.() || null,
      lost,
      wake: !!wake,
      wakeSupported: !!navigator.wakeLock,
      fps: sampler.fps,
    }),
  };
})();
