// v8.9 optional neighbourhood leisure. No hunger, quests, forced popups or money.
(function () {
  "use strict";
  const SHOTS = 5,
    FLIGHT = 1.15,
    GRAVITY = 9.81,
    MARGIN = 0.34;
  let modal = null,
    game = null,
    route = null,
    routeBar = null,
    focusBefore = null;
  let ball = null,
    ballScene = null,
    lastGauge = -1;
  const $ = (id) => document.getElementById(id);
  function outdoor() {
    return (
      typeof localPlayer !== "undefined" &&
      localPlayer &&
      localPlayer.mesh &&
      window.FZUI &&
      FZUI.playing() &&
      !window.cine &&
      !window._loadingGate &&
      !(typeof isInsideBuilding !== "undefined" && isInsideBuilding) &&
      !(typeof isInFactory !== "undefined" && isInFactory) &&
      !(typeof isInBasement !== "undefined" && isInBasement) &&
      !(typeof localCar !== "undefined" && localCar) &&
      !(window.FZ8SEA && (FZ8SEA.active() || FZ8SEA.aboard())) &&
      !(window.FZ8M && FZ8M.ride && FZ8M.ride()) &&
      !(window.FZ8L && FZ8L.drive && FZ8L.drive())
    );
  }
  function modalOpen() {
    return !!modal && !modal.hidden;
  }
  function clearKeys() {
    if (typeof keys !== "undefined")
      for (const k of Object.keys(keys)) keys[k] = false;
    if (typeof velocity !== "undefined")
      velocity.x = velocity.y = velocity.z = 0;
  }
  function recordKey() {
    return (
      "fz.basket.v1:" +
      (typeof currentUser !== "undefined" && currentUser
        ? currentUser.username
        : "guest")
    );
  }
  function readBest() {
    try {
      const n = Number(localStorage.getItem(recordKey()));
      return Number.isInteger(n) && n >= 0 && n <= SHOTS ? n : 0;
    } catch (e) {
      return 0;
    }
  }
  function saveBest(score) {
    const best = Math.max(readBest(), score);
    try {
      localStorage.setItem(recordKey(), String(best));
    } catch (e) {}
    return best;
  }
  // Pure, frame-rate independent math, also exercised by the regression suite.
  function meter(time) {
    const v = (Math.max(0, time) * 0.65) % 2;
    return v <= 1 ? v : 2 - v;
  }
  function release(value) {
    const error = (Math.max(0, Math.min(1, value)) - 0.5) * 5;
    return { error, hit: Math.abs(error) <= MARGIN };
  }
  function trajectory(start, hoop, error, time) {
    const t = Math.max(0, Math.min(FLIGHT, time)),
      f = t / FLIGHT;
    const vy = (hoop.y - start.y + 0.5 * GRAVITY * FLIGHT * FLIGHT) / FLIGHT;
    return {
      x: start.x + (hoop.x + error - start.x) * f,
      y: start.y + vy * t - 0.5 * GRAVITY * t * t,
      z: start.z + (hoop.z - start.z) * f,
    };
  }
  function destroyBall() {
    if (!ball) return;
    if (ball.parent) ball.parent.remove(ball);
    ball.geometry.dispose();
    if (ball.material.map) ball.material.map.dispose();
    ball.material.dispose();
    ball = null;
    ballScene = null;
  }
  function close() {
    const wasOpen = modalOpen();
    if (modal) modal.hidden = true;
    if (game) {
      if (typeof cameraAngleH !== "undefined") cameraAngleH = game.view.h;
      if (typeof cameraAngleV !== "undefined") cameraAngleV = game.view.v;
      game = null;
      destroyBall();
      window._camPrev = null;
      window._camLook = null;
    }
    document.body.classList.remove("fz-leisure-open");
    clearKeys();
    if (wasOpen && focusBefore && focusBefore.isConnected) focusBefore.focus();
    focusBefore = null;
    if (window.FZUI && !FZUI.playing()) route = null;
    updateRoute();
  }
  function init() {
    if (modal) return;
    modal = document.createElement("div");
    modal.id = "fzLeisure";
    modal.hidden = true;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "fzLeisureTitle");
    modal.innerHTML =
      '<section class="leisure-card"><header><div><small>СВОБОДНОЕ ВРЕМЯ</small><h2 id="fzLeisureTitle"></h2></div><button id="fzLeisureClose" aria-label="Закрыть занятие">Закрыть</button></header><div id="fzLeisureContent"></div></section>';
    document.body.appendChild(modal);
    $("fzLeisureClose").onclick = close;
    for (const type of ["pointerdown", "mousedown", "touchstart", "click"])
      modal.addEventListener(type, (e) => e.stopPropagation());
    routeBar = document.createElement("div");
    routeBar.id = "fzCityRoute";
    routeBar.hidden = true;
    routeBar.innerHTML =
      '<span></span><button aria-label="Убрать указатель">×</button>';
    routeBar.querySelector("button").onclick = () => setRoute(null);
    document.body.appendChild(routeBar);
    for (const type of ["pointerdown", "mousedown", "touchstart"])
      routeBar.addEventListener(type, (e) => e.stopPropagation());
  }
  function show(title, sport = false) {
    init();
    close();
    focusBefore = document.activeElement;
    $("fzLeisureTitle").textContent = title;
    modal.classList.toggle("leisure-sport", sport);
    modal.hidden = false;
    document.body.classList.add("fz-leisure-open");
    clearKeys();
    if (document.pointerLockElement && document.exitPointerLock)
      document.exitPointerLock();
    $("fzLeisureClose").focus();
  }
  function directory() {
    if (!outdoor()) return false;
    show("Дворы рядом");
    const host = $("fzLeisureContent");
    host.replaceChildren();
    const intro = document.createElement("p");
    intro.textContent =
      "Выбери место — указатель покажет направление по прямой. Это не маршрут вокруг зданий. Занятия добровольные, без заданий и обязательных наград.";
    host.appendChild(intro);
    const p = localPlayer.mesh.position;
    const list = (window.FZCITY ? FZCITY.places() : [])
      .map((s) => ({ ...s, distance: Math.hypot(s.x - p.x, s.z - p.z) }))
      .sort((a, b) => a.distance - b.distance);
    const picks = [],
      counts = {};
    for (const item of list) {
      if ((counts[item.kind] || 0) >= 2) continue;
      counts[item.kind] = (counts[item.kind] || 0) + 1;
      picks.push(item);
      if (picks.length === 8) break;
    }
    if (!picks.length) {
      const empty = document.createElement("p");
      empty.textContent =
        "Здесь нет загруженных дворов. Перейди в один из новых районов города.";
      host.appendChild(empty);
    }
    for (const item of picks) {
      const button = document.createElement("button");
      button.className = "leisure-place";
      const title = document.createElement("strong"),
        desc = document.createElement("span");
      title.textContent = item.name + " · " + Math.round(item.distance) + " м";
      desc.textContent =
        item.kind === "court"
          ? "Пять бросков, личный рекорд"
          : "Прогулка и скамейки · " +
            (item.kind === "market"
              ? "прилавки декоративные"
              : "открытое пространство");
      button.append(title, desc);
      button.onclick = () => {
        setRoute(item);
        close();
      };
      host.appendChild(button);
    }
    return true;
  }
  function setRoute(target) {
    init();
    route = target ? { ...target } : null;
    routeBar.hidden = !route;
    updateRoute();
  }
  function updateRoute() {
    if (!routeBar) return;
    routeBar.hidden = !route || !outdoor() || modalOpen();
    if (routeBar.hidden) return;
    const p = localPlayer.mesh.position,
      dx = route.x - p.x,
      dz = route.z - p.z,
      dist = Math.hypot(dx, dz);
    let yaw = 0;
    if (typeof camera !== "undefined") {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      yaw = Math.atan2(dir.x, dir.z);
    }
    const angle = Math.atan2(dx, dz) - yaw;
    const directions = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];
    const index = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
    routeBar.querySelector("span").textContent =
      (dist < 5
        ? "✓ На месте"
        : directions[index] + " " + Math.round(dist) + " м") +
      " · " +
      route.name;
  }
  function drawMap(c, mx, mz) {
    if (!route || !outdoor()) return;
    c.strokeStyle = "#ffe1a1";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(mx(route.x), mz(route.z), 5, 0, Math.PI * 2);
    c.stroke();
  }
  function start(entry) {
    if (!outdoor() || !entry || entry.type !== "city_basketball") return false;
    if (typeof interactables === "undefined" || !interactables.includes(entry))
      return false;
    const p = localPlayer.mesh.position;
    if (
      Math.hypot(p.x - entry.position.x, p.z - entry.position.z) >
      entry.range + 0.5
    )
      return false;
    if (
      typeof sittingOn !== "undefined" &&
      sittingOn &&
      typeof standUpFromSeat === "function"
    )
      standUpFromSeat();
    show("Дворовый баскетбол", true);
    game = {
      entry,
      elapsed: 0,
      flight: 0,
      attempts: 0,
      score: 0,
      results: [],
      best: readBest(),
      shot: null,
      state: "ready",
      scene,
      view: {
        h: typeof cameraAngleH !== "undefined" ? cameraAngleH : 0,
        v: typeof cameraAngleV !== "undefined" ? cameraAngleV : 0.3,
      },
    };
    // Keep the avatar on the approach. Only the view moves to frame the basket.
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = 128;
    textureCanvas.height = 64;
    const tc = textureCanvas.getContext("2d");
    tc.fillStyle = "#c7793b";
    tc.fillRect(0, 0, 128, 64);
    tc.strokeStyle = "#4b3024";
    tc.lineWidth = 2;
    tc.beginPath();
    tc.moveTo(0, 32);
    tc.lineTo(128, 32);
    tc.stroke();
    for (const x of [0, 32, 64, 96, 128]) {
      tc.beginPath();
      tc.moveTo(x, 0);
      tc.lineTo(x, 64);
      tc.stroke();
    }
    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.encoding = THREE.sRGBEncoding;
    ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 10),
      new THREE.MeshLambertMaterial({ map: texture }),
    );
    ball.name = "FZ_BASKETBALL";
    ball.visible = false;
    scene.add(ball);
    ballScene = scene;
    $("fzLeisureContent").innerHTML =
      '<p class="leisure-help">Останови бегунок в центральной зоне. Пробел или кнопка «Бросить». Всего пять попыток.</p><div id="fzBasketScore" role="status" aria-live="polite"></div><div id="fzBasketResults" aria-label="Результаты бросков"></div><div class="leisure-meter" role="meter" aria-label="Точность броска" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i class="leisure-target"></i><i id="fzBasketNeedle"></i></div><p id="fzBasketHint">Поймай центр</p><div class="leisure-actions"><button id="fzBasketShoot">Бросить · Пробел</button><button id="fzBasketAgain" hidden>Ещё пять бросков</button></div>';
    $("fzBasketShoot").onclick = shoot;
    $("fzBasketAgain").onclick = () => {
      const e = game.entry;
      close();
      start(e);
    };
    $("fzBasketShoot").focus();
    lastGauge = -1;
    paintScore();
    return true;
  }
  function paintScore(message = "") {
    if (!game) return;
    $("fzBasketScore").textContent =
      "Попадания " +
      game.score +
      " / " +
      SHOTS +
      " · " +
      (game.state === "done"
        ? "Итог серии"
        : "Бросок " + (game.attempts + 1) + " / " + SHOTS) +
      " · Рекорд " +
      game.best +
      (message ? " · " + message : "");
    const results = $("fzBasketResults");
    results.replaceChildren();
    for (let i = 0; i < SHOTS; i++) {
      const el = document.createElement("span"),
        hit = game.results[i];
      el.textContent = hit === undefined ? String(i + 1) : hit ? "✓" : "—";
      el.className = hit === undefined ? "" : hit ? "made" : "missed";
      el.setAttribute(
        "aria-label",
        "Бросок " +
          (i + 1) +
          ": " +
          (hit === undefined ? "впереди" : hit ? "попадание" : "мимо"),
      );
      results.appendChild(el);
    }
  }
  function shoot() {
    if (!game || game.state !== "ready" || !outdoor() || document.hidden)
      return false;
    game.shot = release(meter(game.elapsed));
    game.flight = 0;
    game.state = "flight";
    ball.visible = true;
    ball.position.copy(game.entry.launch);
    $("fzBasketShoot").disabled = true;
    $("fzBasketHint").textContent = "Мяч в полёте";
    return true;
  }
  function finishShot() {
    if (!game || game.state !== "flight") return;
    game.attempts++;
    game.results.push(game.shot.hit);
    if (game.shot.hit) game.score++;
    const message = game.shot.hit
      ? "Попадание!"
      : game.shot.error < 0
        ? "Левее кольца"
        : "Правее кольца";
    ball.visible = false;
    if (game.attempts === SHOTS) {
      game.state = "done";
      game.best = saveBest(game.score);
      $("fzBasketShoot").hidden = true;
      $("fzBasketAgain").hidden = false;
      $("fzBasketAgain").focus();
      $("fzBasketHint").textContent =
        "Серия завершена. Рекорд хранится только в этом браузере.";
    } else {
      game.state = "ready";
      game.elapsed = game.attempts * 0.23;
      $("fzBasketShoot").disabled = false;
      $("fzBasketHint").textContent = "Поймай центр";
    }
    paintScore(message);
  }
  function update(delta = 0) {
    if (!outdoor()) {
      if (modalOpen()) close();
      if (route && window.FZUI && !FZUI.playing()) setRoute(null);
      updateRoute();
      return;
    }
    if (modalOpen()) clearKeys();
    updateRoute();
    if (!game) return;
    if (
      game.scene !== scene ||
      ballScene !== scene ||
      !interactables.includes(game.entry) ||
      localPlayer.mesh.position.distanceTo(
        new THREE.Vector3(game.entry.position.x, 0, game.entry.position.z),
      ) > 10
    ) {
      close();
      return;
    }
    if (document.hidden) return;
    const dt = Number.isFinite(delta) ? Math.max(0, Math.min(0.1, delta)) : 0;
    clearKeys();
    if (game.state === "ready") {
      game.elapsed += dt;
      const value = meter(game.elapsed);
      $("fzBasketNeedle").style.left = value * 100 + "%";
      const n = Math.round(value * 100);
      if (n !== lastGauge) {
        lastGauge = n;
        modal.querySelector('[role="meter"]').setAttribute("aria-valuenow", n);
      }
      $("fzBasketHint").textContent = release(value).hit
        ? "Сейчас — центр!"
        : "Поймай центр";
    } else if (game.state === "flight") {
      game.flight += dt;
      const point = trajectory(
        game.entry.launch,
        game.entry.hoop,
        game.shot.error,
        game.flight,
      );
      ball.position.set(point.x, point.y, point.z);
      ball.rotation.x += dt * 5;
      if (game.flight >= FLIGHT) finishShot();
    }
  }
  function frameCamera() {
    if (!game || !outdoor() || typeof camera === "undefined") return;
    const h = game.entry.hoop,
      s = game.entry.launch;
    camera.position.set(s.x + 4.2, 4.3, s.z + 6.8);
    camera.lookAt(h.x, 2.5, (h.z + s.z) * 0.5);
  }
  function interact(entry) {
    if (entry.type !== "city_basketball") return false;
    start(entry);
    return true;
  }
  function forget(key) {
    if (game && game.entry.cityLeisure === key) close();
    if (route && route.key === key) setRoute(null);
  }
  window.addEventListener(
    "keydown",
    (e) => {
      if (!modalOpen()) return;
      e.stopImmediatePropagation();
      if (e.key === "Tab") {
        e.preventDefault();
        const buttons = [...modal.querySelectorAll("button")].filter(
          (b) => !b.hidden && !b.disabled,
        );
        const i = buttons.indexOf(document.activeElement);
        buttons[
          (i + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length
        ].focus();
        return;
      }
      if (e.code === "Escape" || e.code === "KeyM") {
        e.preventDefault();
        close();
        return;
      }
      if (e.code === "Space" && game) {
        e.preventDefault();
        if (!e.repeat) shoot();
        return;
      }
      // Enter remains a native button activation, never a chat send.
      if (e.code !== "Enter") e.preventDefault();
    },
    true,
  );
  window.addEventListener("blur", clearKeys);
  window.FZLeisure = {
    directory,
    start,
    interact,
    update,
    frameCamera,
    close,
    modalOpen,
    forget,
    drawMap,
    math: { meter, release, trajectory, flight: FLIGHT },
    state: () =>
      game
        ? {
            state: game.state,
            attempts: game.attempts,
            score: game.score,
            best: game.best,
          }
        : null,
  };
})();
