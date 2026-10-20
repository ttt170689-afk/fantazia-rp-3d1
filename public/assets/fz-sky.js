/* Cloud arrival plaza. Shares the native render loop, input owner and cinematic lifecycle. */
(function () {
  "use strict";
  const P = FZSkyPolicy,
    D = P.deck,
    S = P.stage;
  let root = null,
    owner = null,
    allowed = false,
    connection = null,
    flight = null,
    ui = null,
    priorWorld = false,
    restoreFog = null;
  const resources = new Set();
  function active() {
    return (
      typeof localPlayer !== "undefined" &&
      !!localPlayer?.mesh &&
      P.region(localPlayer.mesh.position)
    );
  }
  const busy = () => !!flight;
  function notice(s) {
    showNotification(s, "info");
  }
  function material(color, extra = {}) {
    const m = new THREE.MeshLambertMaterial({ color, ...extra });
    resources.add(m);
    return m;
  }
  function geometry(g) {
    resources.add(g);
    return g;
  }
  function add(g, m, x, y, z) {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    root.add(o);
    return o;
  }
  function build() {
    if (root && owner === scene) return;
    if (root) {
      root.parent?.remove(root);
      resources.forEach((r) => r.dispose());
      resources.clear();
    }
    owner = scene;
    root = new THREE.Group();
    root.name = "Fantazia cloud arrival";
    root.position.set(D.x, D.y, D.z);
    scene.add(root);
    const skyCanvas = document.createElement("canvas");
    skyCanvas.width = 4;
    skyCanvas.height = 256;
    const skyContext = skyCanvas.getContext("2d"),
      gradient = skyContext.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, "#426f9c");
    gradient.addColorStop(0.45, "#a6cde5");
    gradient.addColorStop(0.65, "#e7edf1");
    gradient.addColorStop(1, "#f4f2e9");
    skyContext.fillStyle = gradient;
    skyContext.fillRect(0, 0, 4, 256);
    const skyTexture = new THREE.CanvasTexture(skyCanvas);
    resources.add(skyTexture);
    const skyMaterial = new THREE.MeshBasicMaterial({
      map: skyTexture,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    resources.add(skyMaterial);
    const sky = add(
      geometry(new THREE.SphereGeometry(260, 32, 16)),
      skyMaterial,
      0,
      0,
      0,
    );
    sky.renderOrder = -9;

    const stone = material(0xb9bec4),
      white = material(0xd9dfe3),
      gold = material(0xb8955b),
      dark = material(0x223449),
      blue = material(0x7eafc3),
      glow = material(0xfff5de, {
        emissive: 0xffecc6,
        emissiveIntensity: 0.65,
      });
    const boxGeo = geometry(new THREE.BoxGeometry(1, 1, 1)),
      sphere = geometry(new THREE.SphereGeometry(1, 12, 8));
    const box = (x, y, z, w, h, d, m) => {
      const o = add(boxGeo, m, x, y, z);
      o.scale.set(w, h, d);
      return o;
    };
    const ring = (r, t, y, m) => {
      const o = add(geometry(new THREE.TorusGeometry(r, t, 8, 96)), m, 0, y, 0);
      o.rotation.x = Math.PI / 2;
      return o;
    };
    const deckShape = new THREE.Shape();
    deckShape.absarc(0, 0, 31, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.moveTo(15.25, -8);
    hole.lineTo(15.25, -18);
    hole.lineTo(20.75, -18);
    hole.lineTo(20.75, -8);
    hole.closePath();
    deckShape.holes.push(hole);
    const disk = add(
      geometry(
        new THREE.ExtrudeGeometry(deckShape, {
          depth: 2.2,
          bevelEnabled: false,
          curveSegments: 64,
        }),
      ),
      stone,
      0,
      -2.2,
      0,
    );
    disk.rotation.x = -Math.PI / 2;
    add(
      geometry(new THREE.CylinderGeometry(28, 30, 1.2, 96)),
      dark,
      0,
      -2.8,
      0,
    );
    ring(30.7, 0.22, 0.1, gold);
    ring(29.4, 0.09, 0.06, glow);
    ring(10, 0.055, 0.04, gold);
    ring(6, 0.06, 0.04, gold);
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8;
      const strip = box(
        Math.sin(a) * 20,
        0.025,
        Math.cos(a) * 20,
        0.06,
        0.035,
        18,
        gold,
      );
      strip.rotation.y = a;
    }
    // Open sightlines, real edge collision and a continuous guardrail.
    const glass = material(0xb9deea, {
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 48; i++) {
      const a = (i * Math.PI) / 24;
      box(Math.sin(a) * 30, 0.8, Math.cos(a) * 30, 0.12, 1.6, 0.12, gold);
      const pane = box(
        Math.sin(a + Math.PI / 48) * 30,
        0.8,
        Math.cos(a + Math.PI / 48) * 30,
        3.8,
        1.3,
        0.045,
        glass,
      );
      pane.rotation.y = a + Math.PI / 48;
    }
    ring(30, 0.065, 1.55, gold);
    // Raised stage: all access is also checked by the server, not by nickname.
    box(0, 0.6, -17, 14, 1.2, 10, dark);
    box(0, 1.23, -17, 14, 0.06, 10, white);
    box(0, 4.5, -22, 15, 7, 0.5, dark);
    box(0, 8, -18, 15, 0.25, 9, gold);
    for (const x of [-7.1, 7.1]) {
      box(x, 4.4, -22, 0.25, 7, 0.25, gold);
      box(x, 4.4, -12, 0.25, 7, 0.25, gold);
      box(x, 7.8, -17, 0.18, 0.18, 10, gold);
    }
    for (const x of [-5.5, 5.5]) {
      box(x, 2.2, -15.8, 1.3, 2, 1.1, dark);
      for (const y of [1.8, 2.5]) {
        const o = add(
          geometry(new THREE.CylinderGeometry(0.38, 0.38, 0.06, 16)),
          blue,
          x,
          y,
          -15.2,
        );
        o.rotation.x = Math.PI / 2;
      }
    }
    box(0, 2.4, -15, 0.1, 2.3, 0.1, gold);
    box(0, 3.5, -15, 0.5, 0.18, 0.18, dark);
    for (let i = 0; i < 4; i++)
      box(0, (i + 1) * 0.15, -11.5 - i * 0.6, 4, (i + 1) * 0.3, 0.6, stone);
    sign("FANTAZIA LIVE", 0, 5.5, -21.68, 12, 2.2, "#152639", "#ffe5b2");
    sign("СЦЕНА • ДОСТУП АДМИНИСТРАТОРА", 0, 2, -11.65, 8, 0.65);
    // News stand beside the stage; the existing News button remains untouched.
    box(14, 1.2, -13, 0.15, 2.4, 0.15, gold);
    box(14, 3.2, -13, 6, 3, 0.3, dark);
    sign("НОВОСТИ ГОРОДА", 14, 3.8, -12.82, 5.5, 0.8);
    sign("ПОДОЙДИ И НАЖМИ ДЕЙСТВИЕ", 14, 2.8, -12.81, 5.5, 0.65);
    // Short descending stairway cut into the deck, with a smooth white portal.
    // A narrow cover hides the flat deck beneath the steps; local floor heights follow the stair treads.
    box(18, -2.16, 13, 5.5, 0.04, 10, dark);
    for (let i = 0; i < 8; i++)
      box(
        18,
        -0.25 * (i + 1) - 0.1,
        8.55 + i * 1.1,
        5,
        0.2,
        1.08,
        i % 2 ? white : stone,
      );
    for (const x of [15.3, 20.7]) {
      box(x, 0.7, 13, 0.1, 1.4, 10, gold);
      box(x, 0.6, 18, 0.4, 5.2, 0.4, gold);
    }
    const arch = add(
      geometry(new THREE.TorusGeometry(2.7, 0.18, 10, 40, Math.PI)),
      gold,
      18,
      3.2,
      18,
    );
    arch.rotation.z = 0;
    const lightMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    resources.add(lightMat);
    add(geometry(new THREE.PlaneGeometry(4.8, 5)), lightMat, 18, 0.5, 17.9);
    sign("В ГОРОД ↓", 18, 5.8, 18, 6, 1);
    sign("НЕБЕСНАЯ ПЛОЩАДЬ", -14, 3.5, 2, 10, 1.4);
    sign("FANTAZIA RP 3D", -14, 2.3, 2, 9, 0.9);
    for (const z of [-5, 8]) {
      box(-20, 0.55, z, 5, 0.2, 1, stone);
      box(-20, 1.05, z - 0.55, 5, 0.8, 0.16, stone);
      for (const x of [-22, -18]) box(x, 0.25, z, 0.2, 0.5, 1, gold);
    }
    // Cheap opaque cloud clusters below the deck: no large transparent-particle overdraw.
    const cloud = material(0xf3f6fa);
    for (let i = 0; i < 44; i++) {
      const a = i * 2.39996,
        r = 36 + (i % 7) * 11;
      for (let k = 0; k < 3; k++) {
        const o = add(
          sphere,
          cloud,
          Math.cos(a) * r + k * 5,
          -6 - (i % 4) * 2,
          Math.sin(a) * r,
        );
        o.scale.set(10 + k * 2, 3 + k, 7 + k);
      }
    }
    const hemi = new THREE.HemisphereLight(0xddefff, 0x7e8c9a, 0.35);
    root.add(hemi);
    interactables.push(
      {
        type: "sky_descent",
        name: "Белый свет — спуститься в город",
        position: { x: 18, y: D.y, z: D.z + 12 },
        range: 6.5,
        sky: true,
      },
      {
        type: "sky_news",
        name: "Новости Fantazia",
        position: { x: 14, y: D.y, z: D.z - 11 },
        range: 3.8,
        sky: true,
      },
      {
        type: "sky_stage",
        name: "Вход на сцену • администратор",
        position: { x: 0, y: D.y, z: D.z - 10 },
        range: 3,
        sky: true,
      },
    );
    root.visible = false;
  }
  function sign(text, x, y, z, w, h, bg = "#223449", fg = "#fff2d3") {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 160;
    const ctx = c.getContext("2d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1024, 160);
    ctx.fillStyle = fg;
    ctx.font = "600 62px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 512, 80, 970);
    const t = new THREE.CanvasTexture(c);
    resources.add(t);
    const m = new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide });
    resources.add(m);
    add(geometry(new THREE.PlaneGeometry(w, h)), m, x, y, z);
  }
  function spawn(mesh) {
    build();
    mesh.position.set(P.spawn.x, P.spawn.y, P.spawn.z);
    window._introDone = true;
    window._spawnFixed = true;
    window.cameraMode = "third";
    CONFIG.CAMERA_DISTANCE = Math.max(10, CONFIG.CAMERA_DISTANCE);
    mesh.rotation.y = Math.PI;
    cameraAngleH = 0;
    cameraAngleV = -0.15;
    if (typeof velocity !== "undefined")
      Object.assign(velocity, { x: 0, y: 0, z: 0 });
  }
  function arrive() {
    if (
      !window.FZUI?.playing() ||
      window.cine ||
      isInsideBuilding ||
      isInFactory ||
      isInBasement ||
      localCar ||
      window.FZ8SEA?.active() ||
      window.FZ8M?.ride?.()
    )
      return false;
    spawn(localPlayer.mesh);
    FZPlay.release();
    return true;
  }
  function descend(onArrival) {
    if (!active() || window.cine || window._loadingGate) return false;
    FZPlay.release();
    FZGuide.close();
    FZPlay.close();
    FZTouch.close();
    const previousMode = window.cameraMode;
    window.cameraMode = "first";
    localPlayer.currentAnimation = "walk";
    localPlayer.mesh.position.set(18, D.y, D.z + 7.5);
    localPlayer.mesh.rotation.y = 0;
    flight = { previousMode, landed: false, onArrival: typeof onArrival === "function" ? onArrival : null };
    let white = document.getElementById("fzSkyWhite");
    if (!white) {
      white = document.createElement("div");
      white.id = "fzSkyWhite";
      white.innerHTML =
        "<strong>FANTAZIA RP 3D</strong><span>Добро пожаловать в город</span>";
      document.body.appendChild(white);
    }
    white.hidden = false;
    document.body.classList.add("fz-sky-cine");
    playCine(
      [
        {
          fp: true,
          look: () => {
            const p = localPlayer.mesh.position;
            return [p.x, p.y + 1.45, p.z + (flight?.landed ? -8 : 8)];
          },
          dur: 8.2,
          cut: true,
          shake: 0,
        },
      ],
      () => finish(),
    );
    flight.cine = window.cine;
    const skip = document.createElement("button");
    skip.id = "cityIntroSkip";
    skip.textContent = "Перейти в город";
    skip.onclick = () => {
      if (flight && window.cine === flight.cine) {
        const c = window.cine;
        c.t = c.steps[0].dur;
        updateCine();
      }
    };
    document.body.appendChild(skip);
    return true;
  }
  function finish() {
    if (!flight) return;
    const previous = flight.previousMode, onArrival = flight.onArrival;
    flight = null;
    window.cameraMode = previous;
    localPlayer.mesh.position.set(SPAWN_POINT.x, 0, SPAWN_POINT.z);
    localPlayer.mesh.visible = true;
    localPlayer.currentAnimation = "idle";
    Object.assign(velocity, { x: 0, y: 0, z: 0 });
    isGrounded = true;
    cameraAngleH = window.cameraMode === "first" ? Math.PI : 0;
    cameraAngleV = -0.12;
    document.body.classList.remove("fz-sky-cine");
    const w = document.getElementById("fzSkyWhite");
    if (w) {
      w.hidden = true;
      w.style.opacity = "0";
    }
    document.getElementById("cityIntroSkip")?.remove();
    FZPlay.release();
    FZPlay.apply(false);
    if (onArrival && window.FZUI?.playing()) onArrival();
  }
  function cancel() {
    if (flight) flight.onArrival = null;
    if (ui) {
      ui.hidden = true;
      ui.querySelector("input").value = "";
    }
    allowed = false;
    if (flight && localPlayer?.mesh && window.cine === flight.cine) {
      window.cine.t = window.cine.steps[0].dur;
      updateCine();
    }
  }
  function update() {
    if (!root) return;
    const on = active();
    root.visible = on;
    if (on !== priorWorld) {
      document.body.classList.toggle("fz-in-sky", on);
      if (on) {
        restoreFog = scene.fog;
        scene.fog = new THREE.Fog(0xc9deee, 100, 380);
      } else if (restoreFog) {
        scene.fog = restoreFog;
        restoreFog = null;
        FZPlay.apply(false);
      }
      priorWorld = on;
    }
    if (on) {
      if (camera.far < 450) {
        camera.far = 450;
        camera.updateProjectionMatrix();
      }
      if (scene.fog) {
        scene.fog.color.setHex(0xc9deee);
        scene.fog.near = 100;
        scene.fog.far = 380;
      }
      if (
        !flight &&
        (P.blocked(
          localPlayer.mesh.position.x,
          localPlayer.mesh.position.z,
          allowed,
        ) ||
          localPlayer.mesh.position.y < D.y - 5)
      ) {
        spawn(localPlayer.mesh);
      }
    }
    if (connection !== socket) {
      connection = socket;
      allowed = false;
      if (socket?.on) {
        socket.on("disconnect", () => {
          allowed = false;
        });
        socket.on("sky:correction", (p) => {
          if (localPlayer?.mesh) {
            localPlayer.mesh.position.set(p.x, p.y, p.z);
            Object.assign(velocity, { x: 0, y: 0, z: 0 });
          }
        });
      }
    }
    if (!flight) return;
    if (window.cine !== flight.cine) {
      finish();
      return;
    }
    const t = window.cine.t,
      p = localPlayer.mesh.position;
    if (t < 4.2) {
      const k = Math.min(1, t / 3.6);
      p.set(18, D.y - 2 * k, D.z + 7.5 + 9 * k);
    } else {
      flight.landed = true;
      p.set(SPAWN_POINT.x, 0, SPAWN_POINT.z + Math.max(0, 8.2 - t) * 1.2);
    }
    Object.assign(velocity, { x: 0, y: 0, z: 0 });
    const w = document.getElementById("fzSkyWhite"),
      reduced = FZPlay.reducedMotion();
    const opacity =
      t < 2.8
        ? 0
        : t < 4.2
          ? (t - 2.8) / 1.4
          : t < 4.6
            ? 1
            : Math.max(0, 1 - (t - 4.6) / 2.4);
    w.style.background = reduced ? "#dce4ea" : "#fff";
    w.style.opacity = String(opacity);
    w.querySelector("strong").style.opacity = t > 4.2 ? "1" : "0";
    w.querySelector("span").style.opacity = t > 4.2 ? "1" : "0";
  }
  function openStage() {
    if (!active() || window.cine) return;
    if (allowed) {
      socket.emit("sky:stage", {}, (r) => {
        if (r?.ok) {
          localPlayer.mesh.position.set(S.x, D.y + S.h, S.z + 2);
          FZPlay.release();
        } else {
          allowed = false;
          notice("Сервер не разрешил вход на сцену.");
        }
      });
      return;
    }
    if (!ui) {
      ui = document.createElement("section");
      ui.id = "fzStageAccess";
      ui.className = "fz-play-dialog";
      ui.hidden = true;
      ui.setAttribute("role", "dialog");
      ui.setAttribute("aria-modal", "true");
      ui.setAttribute("aria-label", "Доступ администратора на сцену");
      ui.innerHTML =
        '<form class="fz-play-card"><header><h2>Сцена администратора</h2><button type="button" data-close>Закрыть</button></header><p>Площадь и город открыты всем. Сцена требует отдельного подтверждения сервера.</p><label>Ключ доступа к сцене<input type="password" autocomplete="off" maxlength="200" required></label><button type="submit">Подтвердить доступ</button><p role="status"></p></form>';
      document.body.appendChild(ui);
      ui.querySelector("[data-close]").onclick = () => {
        ui.hidden = true;
        ui.querySelector("input").value = "";
        FZPlay.release();
      };
      ui.querySelector("form").onsubmit = (e) => {
        e.preventDefault();
        if (!socket?.connected) {
          ui.querySelector("[role=status]").textContent =
            "Нужна связь с сервером.";
          return;
        }
        const field = ui.querySelector("input"),
          key = field.value;
        field.value = "";
        socket.timeout(6000).emit("sky:authorize", { key }, (err, r) => {
          if (err || !r?.ok) {
            ui.querySelector("[role=status]").textContent =
              r?.error || "Нет ответа сервера. Повтори позже.";
            return;
          }
          allowed = true;
          ui.hidden = true;
          openStage();
        });
      };
      ui.addEventListener("keydown", (e) => {
        if (e.key === "Escape") ui.querySelector("[data-close]").click();
        if (e.key === "Tab") {
          e.preventDefault();
          const els = [...ui.querySelectorAll("input,button")],
            i = els.indexOf(document.activeElement);
          els[(i + (e.shiftKey ? -1 : 1) + els.length) % els.length].focus();
        }
        e.stopPropagation();
      });
    }
    ui.hidden = false;
    FZPlay.release();
    document.exitPointerLock?.();
    ui.querySelector("[data-close]").focus();
  }
  function interact(e) {
    if (!e.sky) return false;
    if (e.type === "sky_descent") descend();
    if (e.type === "sky_news") openNewsModal();
    if (e.type === "sky_stage") openStage();
    return true;
  }
  window.FZSky = {
    cancel,
    build,
    spawn,
    arrive,
    descend,
    active,
    busy,
    update,
    interact,
    openStage,
    collision: (x, z) => (active() ? P.blocked(x, z, allowed) : null),
    ground: () =>
      active()
        ? P.ground(
            localPlayer.mesh.position.x,
            localPlayer.mesh.position.z,
            allowed,
          )
        : null,
    info: () => ({
      active: active(),
      stageAllowed: allowed,
      flight: !!flight,
      spawn: { ...P.spawn },
      objects: root?.children.length || 0,
    }),
  };
})();
