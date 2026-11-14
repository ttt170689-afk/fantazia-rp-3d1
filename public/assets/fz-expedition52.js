/* Expedition session owner. Drawn by the native animate loop; never owns RAF.
 * City player, camera, health, money and inventory stay untouched. */
(function () {
  "use strict";
  const P = FZExpedition52Policy,
    W = FZExpedition52World,
    held = new Set();
  let run = null,
    panel = null,
    focus = null,
    epoch = 0,
    error = "";
  const modes = {
    story: "Экспедиция",
    race: "Заезд",
    duel: "Дуэль · онлайн",
    control: "Контроль · онлайн",
  };
  let selected = "depot",
    selectedCar = "rally",
    progress = P.clean(),
    owner = "",
    storageOK = true;
  function load() {
    const name =
      typeof currentUser !== "undefined"
        ? currentUser?.username || "guest"
        : "guest";
    if (owner === name) return;
    owner = name;
    try {
      progress = P.clean(
        JSON.parse(
          localStorage.getItem("fz_expedition52:" + encodeURIComponent(name)) ||
            "{}",
        ),
      );
      storageOK = true;
    } catch {
      progress = P.clean();
      storageOK = false;
    }
  }
  function save() {
    progress = P.clean(progress);
    try {
      localStorage.setItem(
        "fz_expedition52:" + encodeURIComponent(owner),
        JSON.stringify(progress),
      );
    } catch {
      storageOK = false;
    }
  }
  function el(tag, text, parent, cls) {
    const n = document.createElement(tag);
    if (text) n.textContent = text;
    if (cls) n.className = cls;
    parent?.append(n);
    return n;
  }
  function button(text, parent, fn, key) {
    const b = el("button", text, parent);
    b.type = "button";
    b.onclick = fn;
    if (key) b.dataset.action = key;
    return b;
  }
  function clear() {
    held.clear();
    window.FZPlay?.release();
    if (typeof keys !== "undefined")
      Object.keys(keys).forEach((k) => (keys[k] = false));
    if (run?.network && run.sock?.connected) send(false);
  }
  function closePanel() {
    document.body.classList.remove("fz-expedition52-menu");
    panel?.remove();
    panel = null;
    clear();
    focus?.isConnected && focus.focus();
    focus = null;
  }
  function allowed() {
    return (
      !!localPlayer?.mesh &&
      FZUI.playing() &&
      !window.cine &&
      !window._loadingGate &&
      !(typeof localCar !== "undefined" && localCar) &&
      !window.FZSurvival45?.busy() &&
      !window.FZStory30?.info().pending
    );
  }
  function open() {
    if (run || !allowed()) return false;
    closePanel();
    load();
    FZUI.close();
    clear();
    document.exitPointerLock?.();
    focus = document.activeElement;
    panel = el("section", "", document.body, "fz-exp52-panel");
    panel.id = "fzExpedition52Menu";
    document.body.classList.add("fz-expedition52-menu");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "exp52Title");
    const head = el("header", "", panel);
    el("small", "FANTAZIA / ЗА ПРЕДЕЛАМИ ГОРОДА", head);
    el("h2", "Экспедиции", head).id = "exp52Title";
    button("Закрыть", head, closePanel, "close");
    el(
      "p",
      "Три карты, три машины и одна история о незаконченной смене. PvP — только по желанию. Деньги и вещи RP-персонажа не теряются.",
      panel,
      "exp52-lead",
    );
    const cards = el("div", "", panel, "exp52-cards");
    for (const m of P.maps) {
      const b = button(
        "",
        cards,
        () => {
          selected = m.id;
          openAgain();
        },
        m.id,
      );
      b.setAttribute("aria-pressed", String(selected === m.id));
      el("small", m.tag, b);
      el("strong", m.name, b);
      el("span", m.intro, b);
      el(
        "em",
        progress.completed.includes(m.id)
          ? "Сигнал восстановлен"
          : "3 реле · 4 записи · 3 существа",
        b,
      );
    }
    const row = el("div", "", panel, "exp52-options"),
      label = el("label", "Машина для заезда", row),
      select = el("select", "", label);
    select.dataset.car = "true";
    for (const c of P.cars) {
      const option = el(
        "option",
        c.name + " · " + Math.round(c.max * 3.6) + " км/ч",
        select,
      );
      option.value = c.id;
    }
    select.value = selectedCar;
    select.onchange = () => (selectedCar = select.value);
    el(
      "p",
      progress.best[selected]
        ? "Личный рекорд: " + progress.best[selected].toFixed(1) + " с"
        : "Маршрут: 6 контрольных точек по периметру. Машины доступны и в экспедиции.",
      row,
    );
    const actions = el("div", "", panel, "exp52-modes");
    for (const [id, name] of Object.entries(modes))
      button(name, actions, () => start(selected, id, selectedCar), id);
    el(
      "p",
      "Дуэль: 2 игрока, до 5 очков. Контроль: 2–6 игроков, удерживайте центр до 45 очков. Раунд — до 2 минут. Без второго игрока арена ждёт, а не подменяет его ботом.",
      panel,
    );
    const journal = el("details", "", panel);
    el(
      "summary",
      "Дневник: " + progress.notes.length + " / 12 · только этот браузер",
      journal,
    );
    for (const n of P.notes.filter((n) => progress.notes.includes(n.id))) {
      el("h3", n.title, journal);
      el("p", n.text, journal);
    }
    if (!storageOK)
      el(
        "p",
        "Память браузера недоступна: записи сохранятся только до закрытия страницы.",
        panel,
      );
    panel.querySelector("button").focus();
    return true;
  }
  function openAgain() {
    closePanel();
    open();
  }
  function toast(text) {
    if (run) {
      run.message = text;
      run.messageT = 4;
    } else if (panel) {
      let status = panel.querySelector("[role=status]");
      if (!status) {
        status = el("p", "", panel);
        status.setAttribute("role", "status");
      }
      status.textContent = text;
    }
  }
  function start(mapId, mode, carId = "rally") {
    if (!allowed() || !P.map(mapId) || !modes[mode]) return false;
    const network = ["duel", "control"].includes(mode);
    if (network && (typeof socket === "undefined" || !socket?.connected)) {
      toast(
        "Для PvP нужен сервер. Исследование и заезд доступны без соперника.",
      );
      return false;
    }
    load();
    closePanel();
    window.FZSave41?.capture?.();
    clear();
    document.exitPointerLock?.();
    FZUI.close();
    const ticket = ++epoch;
    try {
      const set = W.build(mapId),
        hero = W.actor(),
        camera = new THREE.PerspectiveCamera(
          62,
          innerWidth / innerHeight,
          0.06,
          160,
        ),
        token = { expedition52: true };
      set.world.add(hero.root);
      run = {
        ticket,
        map: P.map(mapId),
        mode,
        network,
        set,
        hero,
        camera,
        token,
        p: { x: 0, z: 34, yaw: Math.PI },
        yaw: Math.PI,
        pitch: 0.24,
        t: 0,
        phase: network ? "play" : "intro",
        intro: 0,
        paused: false,
        vehicle: null,
        mission: P.createMission(mapId),
        race: { index: 0, time: 0, done: false },
        actors: new Map(),
        message: "",
        messageT: 0,
        shotT: 0,
        uiT: 0,
        netT: 0,
        seq: 0,
        state: null,
        room: null,
        joined: false,
        reader: null,
        focus: document.activeElement,
        reduced: !!window.FZPlay?.reducedMotion(),
      };
      window.cine = token;
      document.body.classList.add("fz-expedition52");
      for (const v of set.vehicles) v.g.visible = !network;
      for (const m of set.monsters.values()) m.g.visible = mode === "story";
      for (const n of set.notes) n.g.visible = mode === "story";
      for (const r of set.relays) r.g.visible = mode === "story";
      set.control.visible = mode === "control";
      if (mode === "race") {
        run.vehicle =
          set.vehicles.find((v) => v.id === carId) || set.vehicles[0];
        run.p = { x: run.vehicle.x, z: run.vehicle.z, yaw: run.vehicle.yaw };
        run.yaw = run.p.yaw;
      }
      ui();
      if (network) connect(run);
      return true;
    } catch (e) {
      error = String(e.stack || e);
      finish();
      console.error("Expedition52", e);
      return false;
    }
  }
  function finish() {
    ++epoch;
    closePanel();
    const r = run;
    run = null;
    if (!r) return;
    if (r.sock) {
      r.sock.off("exp52:state", r.onState);
      r.sock.off("disconnect", r.onDisconnect);
      r.sock.off("exp52:closed", r.onClosed);
      if (r.sock.connected) r.sock.emit("exp52:leave");
    }
    if (window.cine === r.token) window.cine = null;
    r.ui?.remove();
    r.hero.dispose();
    r.actors.forEach((a) => a.dispose());
    r.set.dispose();
    document.body.classList.remove("fz-expedition52");
    clear();
    r.focus?.isConnected && r.focus.focus();
  }
  function connect(r) {
    r.sock = socket;
    r.onState = (s) => {
      if (
        run !== r ||
        s.map !== r.map.id ||
        s.mode !== r.mode ||
        (r.room && s.room !== r.room)
      )
        return;
      r.state = s;
      r.lastState = performance.now();
    };
    r.onDisconnect = () => {
      if (run === r) {
        finish();
        showNotification(
          "Связь с ареной потеряна. Ты вернулся без потери вещей.",
          "info",
        );
      }
    };
    r.onClosed = () => {
      if (run === r) {
        finish();
        showNotification("Арена закрыта. Можно войти в новый раунд.", "info");
      }
    };
    r.sock.on("exp52:state", r.onState);
    r.sock.on("disconnect", r.onDisconnect);
    r.sock.on("exp52:closed", r.onClosed);
    r.sock
      .timeout(7000)
      .emit("exp52:join", { map: r.map.id, mode: r.mode }, (err, result) => {
        if (run !== r) return;
        if (err || !result?.ok) {
          const msg = result?.error || "Сервер арены не ответил.";
          finish();
          showNotification(msg, "info");
          return;
        }
        r.joined = true;
        r.room = result.room;
        r.lastState = r.lastState || performance.now();
      });
  }
  function send(fire) {
    if (!run?.sock?.connected) return;
    const r = run;
    r.sock.emit("exp52:input", {
      seq: ++r.seq,
      forward: r.reader
        ? 0
        : (held.has("KeyW") ? 1 : 0) - (held.has("KeyS") ? 1 : 0),
      side: r.reader
        ? 0
        : (held.has("KeyD") ? 1 : 0) - (held.has("KeyA") ? 1 : 0),
      yaw: r.yaw,
      fire: !!fire,
    });
  }
  function showNote(n) {
    if (!run || !n) return;
    clear();
    const r = run;
    r.reader = el("div", "", r.ui, "exp52-reader");
    r.reader.setAttribute("role", "dialog");
    r.reader.setAttribute("aria-modal", "true");
    el("h2", n.title, r.reader);
    el("p", n.text, r.reader);
    button(
      "Продолжить",
      r.reader,
      () => {
        r.reader.remove();
        r.reader = null;
        clear();
      },
      "reader-close",
    ).focus();
  }
  function act() {
    const r = run;
    if (
      !r ||
      r.phase !== "play" ||
      r.paused ||
      r.reader ||
      r.network ||
      r.mission.failed ||
      r.mission.done ||
      r.race.done
    )
      return;
    if (r.vehicle) {
      if (Math.abs(r.vehicle.speed) > 1.5) {
        toast("Сначала останови машину.");
        return;
      }
      const q = P.exitPoint(r.map, r.vehicle);
      if (!q) {
        toast("Дверь заблокирована. Отъедь от стены.");
        return;
      }
      r.p = q;
      r.yaw = q.yaw;
      r.vehicle.door = 1;
      r.vehicle = null;
      r.hero.root.visible = true;
      return;
    }
    if (r.mode === "story") {
      const event = P.interact(r.mission, r.p);
      if (event) {
        if (event.type === "note") {
          if (!progress.notes.includes(event.id)) progress.notes.push(event.id);
          save();
          showNote(P.notes.find((n) => n.id === event.id));
        } else if (event.type === "relay") {
          toast(
            "Реле " +
              (event.id + 1) +
              " включено. " +
              r.mission.relays.length +
              " / 3",
          );
          window.FZSound?.effect("flash");
        } else if (event.type === "complete") {
          progress.completed.push(r.map.id);
          save();
          r.phase = "outro";
          r.intro = 0;
          clear();
        } else toast("Нужны все три реле. Они отмечены на карте.");
        return;
      }
    }
    const v = r.set.vehicles.find(
      (v) => P.dist(v, r.p) < 3 && P.clear(r.map, r.p, v),
    );
    if (v) {
      r.vehicle = v;
      r.p = { x: v.x, z: v.z, yaw: v.yaw };
      r.yaw = v.yaw;
      v.door = 1;
      toast(
        v.id === "coupe"
          ? "Купе: разгоняйся только на прямой."
          : "W/S — газ и тормоз, A/D — руль. E — выйти после остановки.",
      );
    } else toast("Подойди к записи, реле или двери машины.");
  }
  function fire() {
    const r = run;
    if (!r || r.phase !== "play" || r.paused || r.reader || r.vehicle) return;
    if (r.network) {
      if (r.state?.phase === "active") send(true);
    } else if (r.mode === "story" && P.pulse(r.mission, r.p)) {
      r.shotT = 0.25;
      window.FZSound?.effect("flash");
    }
  }
  function ui() {
    const r = run,
      u = (r.ui = el("section", "", document.body, "exp52-hud"));
    u.id = "fzExpedition52";
    const top = el("header", "", u, "exp52-top");
    el("strong", r.map.name, top);
    r.status = el("p", "", top);
    const opts = el("div", "", top);
    button("В город", opts, finish, "exit");
    button(
      r.network ? "Таблица" : "Пауза",
      opts,
      () => {
        if (r.network) {
          r.scoreOpen = !r.scoreOpen;
          return;
        }
        r.paused = !r.paused;
        clear();
      },
      "pause",
    );
    r.mapCanvas = el("canvas", "", u, "exp52-minimap");
    r.mapCanvas.width = r.mapCanvas.height = 192;
    r.mapCanvas.setAttribute(
      "aria-label",
      "Схема карты: ты, реле, записи и цель",
    );
    r.mapCanvas.setAttribute("role", "img");
    r.cross = el("div", "+", u, "exp52-cross");
    r.caption = el("p", "", u, "exp52-caption");
    r.board = el("div", "", u, "exp52-score");
    r.board.hidden = true;
    const look = el("div", "", u, "exp52-look");
    look.setAttribute("aria-label", "Потяни для поворота камеры");
    let drag = null;
    look.onpointerdown = (e) => {
      if (e.button !== 0) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      look.setPointerCapture(e.pointerId);
    };
    look.onpointermove = (e) => {
      if (!drag || drag.id !== e.pointerId || r.reader || r.paused) return;
      r.yaw -= Math.max(-0.22, Math.min(0.22, (e.clientX - drag.x) * 0.006));
      r.yaw = Math.atan2(Math.sin(r.yaw), Math.cos(r.yaw));
      r.pitch = P.clamp(r.pitch + (e.clientY - drag.y) * 0.003, -0.1, 0.7);
      drag.x = e.clientX;
      drag.y = e.clientY;
    };
    look.onpointerup =
      look.onpointercancel =
      look.onlostpointercapture =
        () => (drag = null);
    const pad = el("div", "", u, "exp52-pad");
    for (const [key, title] of [
      ["KeyW", "W"],
      ["KeyA", "A"],
      ["KeyS", "S"],
      ["KeyD", "D"],
    ]) {
      const b = button(title, pad, () => {}, key);
      b.setAttribute(
        "aria-label",
        { KeyW: "Вперёд", KeyA: "Влево", KeyS: "Назад", KeyD: "Вправо" }[key],
      );
      b.onpointerdown = (e) => {
        e.preventDefault();
        b.setPointerCapture(e.pointerId);
        held.add(key);
      };
      for (const ev of ["pointerup", "pointercancel", "lostpointercapture"])
        b.addEventListener(ev, () => held.delete(key));
    }
    const acts = el("div", "", u, "exp52-actions");
    button("E · Действие", acts, act, "interact");
    button("Импульс · Space", acts, fire, "fire");
    button(
      "Пропустить обзор",
      acts,
      () => {
        if (r.phase === "intro") {
          r.phase = "play";
          r.intro = 0;
          clear();
        }
      },
      "skip",
    );
    button(
      "Заново",
      acts,
      () => {
        const { map, mode, vehicle } = r;
        finish();
        start(map.id, mode, vehicle?.id || selectedCar);
      },
      "retry",
    );
    for (const node of [top, pad, acts, r.board])
      for (const ev of ["pointerdown", "mousedown", "touchstart"])
        node.addEventListener(ev, (e) => e.stopPropagation());
  }
  function minimap(r) {
    const c = r.mapCanvas.getContext("2d"),
      s = 192 / 80,
      pt = (x, z) => [96 + x * s, 96 - z * s];
    c.fillStyle = "#101a25";
    c.fillRect(0, 0, 192, 192);
    c.fillStyle = "#4a5965";
    for (const [x, z, w, d] of r.map.blocks) {
      const [px, py] = pt(x - w / 2, z + d / 2);
      c.fillRect(px, py, w * s, d * s);
    }
    function dot(x, z, color, size = 3) {
      const [a, b] = pt(x, z);
      c.fillStyle = color;
      c.beginPath();
      c.arc(a, b, size, 0, Math.PI * 2);
      c.fill();
    }
    if (r.mode === "story") {
      r.map.relays.forEach(([x, z], i) =>
        dot(x, z, r.mission.relays.includes(i) ? "#69dfbc" : "#eab473"),
      );
      for (const n of P.notes.filter(
        (n) => n.map === r.map.id && !r.mission.notes.includes(n.id),
      ))
        dot(n.x, n.z, "#cbbafa", 2);
      dot(0, 32, "#8ae5d4", 5);
    }
    if (r.mode === "race") {
      const q = r.map.checkpoints[r.race.index];
      if (q) dot(q[0], q[1], "#e3c76d", 5);
    }
    for (const p of r.state?.players || [])
      if (p.id !== r.sock.id && p.hp > 0) dot(p.x, p.z, "#ec8991");
    dot(r.p.x, r.p.z, "#ffffff", 4);
  }
  function hud(r) {
    const state = r.state,
      self = state?.players.find((p) => p.id === r.sock.id);
    let text;
    if (r.network) {
      text = state
        ? (state.phase === "waiting"
            ? "Ожидание второго игрока"
            : state.phase === "ended"
              ? state.reason
              : Math.ceil(state.left) + " с") +
          " · HP " +
          (self?.hp ?? 100) +
          " · Очки " +
          (self?.score ?? 0)
        : "Подключение к арене…";
      r.board.hidden = !(r.scoreOpen || state?.phase === "ended");
      r.board.replaceChildren();
      if (!r.board.hidden) {
        el("strong", "Результаты · " + modes[r.mode], r.board);
        for (const p of [...(state?.players || [])].sort(
          (a, b) => b.score - a.score,
        ))
          el(
            "p",
            p.name + " — " + p.score + " · " + p.kills + " / " + p.deaths,
            r.board,
          );
      }
    } else if (r.mode === "race")
      text =
        (r.race.done ? "Финиш! " : "Заезд · ") +
        r.race.time.toFixed(1) +
        " с · Точки " +
        r.race.index +
        " / 6";
    else
      text =
        "HP " +
        r.mission.hp +
        " · Реле " +
        r.mission.relays.length +
        " / 3 · Записи " +
        r.mission.notes.length +
        " / 4";
    if (r.vehicle)
      text += " · " + Math.round(Math.abs(r.vehicle.speed) * 3.6) + " км/ч";
    r.status.textContent = text;
    r.caption.textContent =
      r.phase === "intro"
        ? r.map.intro
        : r.phase === "outro"
          ? r.map.outro
          : r.mission.failed
            ? "Эвакуация. RP-здоровье, деньги и вещи не изменены. Можно повторить вылазку."
            : r.paused
              ? "Пауза · Esc — продолжить"
              : r.messageT > 0
                ? r.message
                : r.vehicle
                  ? "W/S — газ / тормоз · A/D — руль · E — выйти"
                  : r.network
                    ? "WASD — движение · потяни экран — прицел · Space — импульс"
                    : r.mode === "race"
                      ? "Следуй жёлтым кольцам по порядку."
                      : "WASD — ходить · потяни экран — осмотреться · E — действие · Space — импульс";
    r.ui.querySelector("[data-action=skip]").hidden = r.phase !== "intro";
    r.ui.querySelector("[data-action=retry]").hidden = !(
      r.mission.failed ||
      r.mission.done ||
      r.race.done ||
      state?.phase === "ended"
    );
    r.ui.querySelector("[data-action=interact]").hidden = r.network;
    r.ui.querySelector("[data-action=fire]").hidden =
      r.mode === "race" || !!r.vehicle;
    r.cross.hidden = !!r.vehicle || r.phase !== "play";
    minimap(r);
  }
  function frame(dt) {
    if (!run) return false;
    const r = run,
      d = P.clamp(dt, 0, 0.05);
    try {
      if (window.cine !== r.token || !FZUI.playing()) {
        finish();
        return false;
      }
      const previous = { x: r.p.x, z: r.p.z };
      const frozen = r.paused || document.hidden || !!r.reader;
      r.uiT += d;
      r.t += frozen ? 0 : d;
      r.messageT = Math.max(0, r.messageT - (frozen ? 0 : d));
      r.shotT = Math.max(0, r.shotT - (frozen ? 0 : d));
      if (r.network) {
        if (r.joined && performance.now() - r.lastState > 8000) {
          r.onDisconnect();
          return true;
        }
        r.netT += d;
        if (r.netT >= 0.05) {
          r.netT = 0;
          send(false);
        }
        const s = r.state;
        if (s) {
          const self = s.players.find((p) => p.id === r.sock.id);
          if (self) {
            if (self.shot > (r.lastShot || 0)) {
              r.shotT = 0.25;
              r.lastShot = self.shot;
            }
            r.p.x = self.x;
            r.p.z = self.z;
            r.p.yaw = self.yaw;
            r.hero.root.visible = self.hp > 0;
          }
          const live = new Set();
          for (const p of s.players) {
            if (p.id === r.sock.id) continue;
            live.add(p.id);
            let a = r.actors.get(p.id);
            if (!a) {
              a = W.actor();
              r.actors.set(p.id, a);
              r.set.world.add(a.root);
              a.root.position.set(p.x, 0, p.z);
            }
            const moving =
              Math.hypot(p.x - a.root.position.x, p.z - a.root.position.z) >
              0.04;
            a.root.position.lerp(
              new THREE.Vector3(p.x, 0, p.z),
              1 - Math.exp(-d * 18),
            );
            a.root.rotation.y = p.yaw;
            a.root.visible = p.hp > 0;
            a.update(d, p.hp <= 0 ? "down" : moving ? "run" : "idle");
            a.last = { x: p.x, z: p.z };
          }
          for (const [id, a] of r.actors)
            if (!live.has(id)) {
              a.dispose();
              r.actors.delete(id);
            }
        }
      } else if (!frozen) {
        if (r.phase === "intro") {
          r.intro += d;
          if (r.intro >= (r.reduced ? 0.6 : 3.5)) r.phase = "play";
        } else if (r.phase === "outro") {
          r.intro += d;
        } else if (!r.mission.failed && !r.mission.done && !r.race.done) {
          const input = {
            forward: (held.has("KeyW") ? 1 : 0) - (held.has("KeyS") ? 1 : 0),
            side: (held.has("KeyD") ? 1 : 0) - (held.has("KeyA") ? 1 : 0),
            yaw: r.yaw,
          };
          if (r.vehicle) {
            P.drive(r.map, r.vehicle, input, d, r.vehicle.id);
            r.p = { x: r.vehicle.x, z: r.vehicle.z, yaw: r.vehicle.yaw };
            r.yaw = r.vehicle.yaw;
          } else {
            P.walk(r.map, r.p, input, d);
          }
          if (r.mode === "story")
            P.missionStep(
              r.mission,
              r.p,
              d,
              !!r.vehicle && Math.abs(r.vehicle.speed) > 2,
            );
          if (r.mode === "race") {
            r.race.time += d;
            const q = r.map.checkpoints[r.race.index];
            if (r.vehicle && q && Math.hypot(r.p.x - q[0], r.p.z - q[1]) < 4) {
              r.race.index++;
              window.FZSound?.effect("click");
              if (r.race.index === 6) {
                r.race.done = true;
                r.vehicle.speed = 0;
                progress.best[r.map.id] = Math.min(
                  progress.best[r.map.id] || Infinity,
                  r.race.time,
                );
                save();
              }
            }
          }
        }
      }
      if (!frozen && !r.vehicle) {
        r.yaw +=
          ((held.has("ArrowLeft") ? 1 : 0) - (held.has("ArrowRight") ? 1 : 0)) *
          d *
          1.8;
        r.yaw = Math.atan2(Math.sin(r.yaw), Math.cos(r.yaw));
      }
      for (const v of r.set.vehicles)
        v.door = Math.max(0, v.door - (frozen ? 0 : d) * 1.5);
      if (r.mission.failed) for (const v of r.set.vehicles) v.speed = 0;
      W.animate(r.set, r.mission, r.t, frozen ? 0 : d, r.reduced);
      r.hero.root.visible =
        !r.vehicle &&
        (!r.network ||
          r.state?.players.find((p) => p.id === r.sock.id)?.hp > 0);
      r.hero.root.position.set(r.p.x, 0, r.p.z);
      r.hero.root.rotation.y = r.p.yaw;
      const moving = P.dist(previous, r.p) > 0.001;
      if (moving) r.moveT = 0.15;
      else r.moveT = Math.max(0, (r.moveT || 0) - d);
      r.hero.update(
        frozen ? 0 : d,
        r.mission.failed
          ? "down"
          : r.mission.done || r.race.done
            ? "win"
            : r.shotT > 0
              ? "attack"
              : r.moveT > 0
                ? "run"
                : "idle",
      );
      r.set.beam.visible = r.shotT > 0.12 && !r.reduced;
      if (r.set.beam.visible) {
        let length = 30;
        for (let n = 0.5; n < 30; n += 0.5)
          if (
            P.blocked(
              r.map,
              r.p.x + Math.sin(r.p.yaw) * n,
              r.p.z + Math.cos(r.p.yaw) * n,
              0.05,
            )
          ) {
            length = n;
            break;
          }
        const points = r.set.beam.geometry.attributes.position;
        points.setXYZ(0, r.p.x, 1.25, r.p.z);
        points.setXYZ(
          1,
          r.p.x + Math.sin(r.p.yaw) * length,
          1.25,
          r.p.z + Math.cos(r.p.yaw) * length,
        );
        points.needsUpdate = true;
      }
      r.set.checkpoints.forEach(
        (g, i) =>
          (g.visible = r.mode === "race" && i === r.race.index && !r.race.done),
      );
      const cam = r.camera;
      cam.aspect = innerWidth / innerHeight;
      cam.updateProjectionMatrix();
      if (r.phase === "intro" && !r.reduced) {
        const t = Math.min(1, r.intro / 3.5),
          a = 0.7 + t * 0.35;
        cam.position.set(Math.sin(a) * 35, 17 - t * 7, Math.cos(a) * 35);
        cam.lookAt(0, 1, 0);
      } else if (r.phase === "outro" && !r.reduced) {
        const t = Math.min(1, r.intro / 4),
          a = r.yaw - 0.65 - t * 0.35;
        cam.position.set(
          r.p.x - Math.sin(a) * 6,
          2.2 + t * 1.6,
          r.p.z - Math.cos(a) * 6,
        );
        cam.lookAt(r.p.x, 1.2, r.p.z);
      } else {
        const distance = r.vehicle ? 7 : 4.7,
          height = (r.vehicle ? 3.7 : 2.8) + r.pitch * 3;
        const desired = new THREE.Vector3(
          r.p.x - Math.sin(r.yaw) * distance,
          height,
          r.p.z - Math.cos(r.yaw) * distance,
        );
        const target = new THREE.Vector3(r.p.x, 1.3, r.p.z);
        for (let i = 1; i <= 12; i++) {
          const a = i / 12,
            x = target.x + (desired.x - target.x) * a,
            z = target.z + (desired.z - target.z) * a;
          if (P.blocked(r.map, x, z, 0.2)) {
            desired.set(
              target.x + (desired.x - target.x) * Math.max(0.15, a - 0.1),
              height,
              target.z + (desired.z - target.z) * Math.max(0.15, a - 0.1),
            );
            break;
          }
        }
        cam.position.copy(desired);
        cam.lookAt(
          r.p.x + Math.sin(r.yaw) * 4,
          1.25,
          r.p.z + Math.cos(r.yaw) * 4,
        );
      }
      if (r.uiT > 0.1) {
        r.uiT = 0;
        hud(r);
      }
      const encoding = renderer.outputEncoding;
      try {
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.render(r.set.world, cam);
      } finally {
        renderer.outputEncoding = encoding;
      }
      return true;
    } catch (e) {
      error = String(e.stack || e);
      console.error("Expedition52 frame", e);
      finish();
      return false;
    }
  }
  function trap(e) {
    if (!run && !panel) return;
    const root = run?.reader || panel || run.ui;
    if (e.code === "Tab") {
      const list = [...root.querySelectorAll("button,select,summary")].filter(
        (n) => !n.hidden && n.getClientRects().length,
      );
      if (list.length) {
        e.preventDefault();
        const i = list.indexOf(document.activeElement);
        list[(i + (e.shiftKey ? -1 : 1) + list.length) % list.length].focus();
      }
      e.stopImmediatePropagation();
      return;
    }
    if (e.target.matches?.("select") && e.code !== "Escape") {
      e.stopImmediatePropagation();
      return;
    }
    if (e.code === "Escape" && !e.repeat) {
      if (panel) closePanel();
      else if (run.reader) {
        run.reader.remove();
        run.reader = null;
        clear();
      } else if (!run.network) {
        run.paused = !run.paused;
        clear();
      } else {
        run.scoreOpen = !run.scoreOpen;
        clear();
      }
    } else if (run && !run.reader && !e.repeat) {
      if (e.code === "KeyE") act();
      else if (e.code === "Space") fire();
    }
    if (
      run &&
      ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowLeft", "ArrowRight"].includes(
        e.code,
      )
    )
      held.add(e.code);
    if (
      [
        "Space",
        "KeyE",
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "ArrowLeft",
        "ArrowRight",
        "Escape",
      ].includes(e.code)
    )
      e.preventDefault();
    e.stopImmediatePropagation();
  }
  window.addEventListener("keydown", trap, true);
  window.addEventListener(
    "keyup",
    (e) => {
      if (run || panel) {
        held.delete(e.code);
        e.stopImmediatePropagation();
      }
    },
    true,
  );
  window.addEventListener("blur", clear);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clear();
      if (run && !run.network) run.paused = true;
    }
  });
  window.addEventListener("pagehide", finish);
  window.FZExpedition52 = {
    open,
    start,
    finish,
    frame,
    act,
    fire,
    active: () => !!run,
    modalOpen: () => !!panel,
    info: () => ({
      active: !!run,
      mode: run?.mode,
      map: run?.map.id,
      phase: run?.phase,
      position: run ? { ...run.p } : null,
      vehicle: run?.vehicle?.id || null,
      health: run?.mission.hp,
      relays: run?.mission.relays.slice() || [],
      notes: progress.notes.slice(),
      race: run ? { ...run.race } : null,
      network: run?.state || null,
      remoteActors: run?.actors.size || 0,
      animation: run?.hero.info() || null,
      paused: run?.paused || false,
      reader: !!run?.reader,
      resources: run?.set.owned.size || 0,
      error,
    }),
  };
})();
