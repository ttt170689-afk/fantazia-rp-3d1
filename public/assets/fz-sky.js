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
    restoreFog = null,
    visual = null,
    clouds = null,
    garden = null;
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
      garden?.dispose();
      visual?.dispose();
      root.parent?.remove(root);
      resources.forEach((r) => r.dispose?.());
      resources.clear();
    }
    owner = scene;
    root = new THREE.Group();
    root.name = "Fantazia cloud arrival";
    root.position.set(D.x, D.y, D.z);
    scene.add(root);
    visual = FZSkyVisual.create(root, resources);
    const M = visual.materials;
    const shape = new THREE.Shape();
    shape.moveTo(-0.475, -0.475);
    shape.lineTo(0.475, -0.475);
    shape.lineTo(0.475, 0.475);
    shape.lineTo(-0.475, 0.475);
    shape.closePath();
    const boxGeo = geometry(
      new THREE.ExtrudeBufferGeometry(shape, {
        depth: 0.95,
        bevelEnabled: true,
        bevelThickness: 0.025,
        bevelSize: 0.025,
        bevelSegments: 2,
        steps: 1,
      }),
    );
    boxGeo.translate(0, 0, -0.475);
    const cylinder = geometry(new THREE.CylinderGeometry(0.5, 0.5, 1, 12));
    const box = (x, y, z, w, h, d, m) => {
      const o = add(boxGeo, m, x, y, z);
      o.scale.set(w, h, d);
      o.castShadow = true;
      o.receiveShadow = true;
      return o;
    };
    const rod = (a, b, r, m) => {
      const va = new THREE.Vector3(...a),
        vb = new THREE.Vector3(...b),
        dir = vb.clone().sub(va);
      const o = add(
        cylinder,
        m,
        ...va.clone().add(vb).multiplyScalar(0.5).toArray(),
      );
      o.scale.set(r * 2, dir.length(), r * 2);
      o.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        dir.normalize(),
      );
      o.castShadow = true;
      o.receiveShadow = true;
      return o;
    };
    const ring = (r, t, y, m) => {
      const o = add(
        geometry(new THREE.TorusGeometry(r, t, 8, 128)),
        m,
        0,
        y,
        0,
      );
      o.rotation.x = Math.PI / 2;
      o.castShadow = true;
      return o;
    };
    // Exact deck and stair aperture; the physics/server policy remains in world coordinates.
    const deck = new THREE.Shape();
    deck.absarc(0, 0, D.r, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.moveTo(15.25, -8);
    hole.lineTo(15.25, -18);
    hole.lineTo(20.75, -18);
    hole.lineTo(20.75, -8);
    hole.closePath();
    deck.holes.push(hole);
    const floor = add(
      geometry(
        new THREE.ExtrudeGeometry(deck, {
          depth: 2.2,
          bevelEnabled: false,
          curveSegments: 96,
        }),
      ),
      M.stone,
      0,
      -2.2,
      0,
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.name = "sky_travertine_deck";
    const foundation = add(
      geometry(new THREE.CylinderGeometry(28, 30, 1.2, 96)),
      M.dark,
      0,
      -2.8,
      0,
    );
    foundation.receiveShadow = true;
    ring(30.7, 0.12, 0.08, M.brass);
    ring(29.4, 0.035, 0.04, M.light);

    // Brushed posts, base plates, narrow caps and pale glass: not a solid fence.
    for (let i = 0; i < 48; i++) {
      const a = (i * Math.PI) / 24,
        x = Math.sin(a) * 30,
        z = Math.cos(a) * 30;
      rod([x, 0.08, z], [x, 1.55, z], 0.045, M.steel);
      box(x, 0.06, z, 0.28, 0.08, 0.28, M.steel);
      const g = box(
        Math.sin(a + Math.PI / 48) * 30,
        0.81,
        Math.cos(a + Math.PI / 48) * 30,
        3.78,
        1.24,
        0.035,
        M.glass,
      );
      g.rotation.y = a + Math.PI / 48;
      g.castShadow = false;
    }
    ring(30, 0.047, 1.55, M.brass);
    // Pavilion keeps the same protected footprint. Layered base, teak floor and roof soffit.
    box(0, 0.6, -17, 14, 1.2, 10, M.dark);
    box(0, 1.23, -17, 14, 0.06, 10, M.wood);
    for (let i = 0; i < 27; i++)
      box(-6.75 + i * 0.5, 1.269, -17, 0.018, 0.008, 9.7, M.dark);
    box(0, 0.14, -11.95, 13.5, 0.1, 0.035, M.light);
    box(0, 1.18, -11.98, 13.8, 0.035, 0.025, M.neonPink);
    box(0, 4.5, -22, 15, 7, 0.5, M.dark);
    for (let i = 0; i < 24; i++)
      box(
        -7.2 + i * 0.625,
        4.65,
        -21.73,
        i % 3 === 0 ? 0.075 : 0.05,
        6.45,
        0.035,
        i % 6 === 0 ? M.neonPink : i % 3 === 0 ? M.light : M.steel,
      );

    for (const x of [-7.1, 7.1]) {
      rod([x, 1.2, -22], [x, 7.9, -22], 0.09, M.steel);
      rod([x, 1.2, -12], [x, 7.9, -12], 0.09, M.steel);
      for (const z of [-22, -12]) box(x, 1.3, z, 0.36, 0.2, 0.36, M.steel);
    }
    // Speaker grilles, inset woofers and a correctly proportioned microphone.
    for (const x of [-5.5, 5.5]) {
      box(x, 2.2, -15.8, 1.25, 2, 1.05, M.dark);
      box(x, 2.2, -15.245, 1.12, 1.84, 0.035, M.grille);
      for (const y of [1.8, 2.5]) {
        const woofer = add(
          geometry(new THREE.TorusGeometry(0.32, 0.026, 8, 24)),
          M.steel,
          x,
          y,
          -15.214,
        );
      }
    }
    rod([0, 1.3, -15], [0, 3.45, -15], 0.025, M.steel);
    rod([0, 3.45, -15], [0.32, 3.53, -15], 0.06, M.dark);
    for (let i = 0; i < 4; i++) {
      const h = (i + 1) * 0.3;
      box(0, h / 2, -11.5 - i * 0.6, 4, h, 0.6, M.trim);
      box(0, h + 0.012, -11.28 - i * 0.6, 3.9, 0.022, 0.08, M.brass);
    }
    box(0, 5.5, -21.65, 12.3, 2.55, 0.16, M.steel);
    sign("FANTAZIA LIVE", 0, 5.5, -21.55, 11.9, 2.2, "#0c1024", "#e3dcff");
    sign("СЦЕНА • АДМИНИСТРАТОР", -4.8, 1.6, -11.65, 3, 0.38);
    // News retains the same interaction/position, with a framed freestanding screen.
    for (const x of [12.2, 15.8]) {
      rod([x, 0, -13], [x, 3.5, -13], 0.055, M.steel);
      box(x, 0.07, -13, 0.5, 0.12, 0.7, M.dark);
    }
    box(14, 3.2, -13, 6, 3, 0.3, M.steel);
    box(11.08, 3.2, -12.8, 0.045, 2.9, 0.04, M.light);
    box(16.92, 3.2, -12.8, 0.045, 2.9, 0.04, M.neonPink);
    box(14, 3.2, -12.82, 5.8, 2.8, 0.04, M.dark);
    sign("НОВОСТИ ГОРОДА", 14, 3.8, -12.78, 5.5, 0.8);
    sign("ПОДОЙДИ И НАЖМИ ДЕЙСТВИЕ", 14, 2.8, -12.77, 5.5, 0.65);
    // Small wayfinding totem instead of the ten-metre billboard blocking the garden.
    box(-14, 1.8, 2, 2.25, 3.6, 0.25, M.dark);
    box(-14, 0.08, 2, 2.5, 0.16, 0.8, M.steel);
    box(-15.13, 1.8, 2, 0.03, 3.3, 0.28, M.light);
    sign("НЕБЕСНЫЙ САД", -14, 2.8, 2.14, 2.1, 0.48);
    sign("FANTAZIA", -14, 2.05, 2.14, 2.05, 0.45);
    sign("СЦЕНА ↑   ГОРОД →", -14, 1.25, 2.14, 2.05, 0.3);
    // The same real stair treads; replace the old tall solid side boxes with sloped rails.
    box(18, -2.16, 13, 5.5, 0.04, 10, M.dark);
    for (let i = 0; i < 8; i++) {
      const y = -0.25 * (i + 1),
        z = 8.55 + i * 1.1;
      box(18, y - 0.1, z, 5, 0.2, 1.08, M.trim);
      box(18, y + 0.015, z - 0.43, 4.9, 0.022, 0.07, M.brass);
    }
    for (const x of [15.3, 20.7]) {
      for (const i of [0, 2, 4, 6, 8]) {
        const z = 8 + i * 1.1,
          y = -Math.min(8, i) * 0.25;
        rod([x, y, z], [x, y + 1.02, z], 0.035, M.steel);
      }
      rod([x, 1.02, 8], [x, -0.98, 16.8], 0.05, M.brass);
      rod([x, -2, 18], [x, 3.2, 18], 0.1, M.brass);
    }
    add(
      geometry(new THREE.TorusGeometry(2.7, 0.12, 12, 64, Math.PI)),
      M.brass,
      18,
      3.2,
      18,
    );
    const portal = ownMaterial(
      new THREE.MeshBasicMaterial({
        color: 0xf7fbff,
        transparent: true,
        opacity: 0.68,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    add(geometry(new THREE.PlaneGeometry(4.8, 5)), portal, 18, 0.5, 17.9);
    sign("В ГОРОД ↓", 18, 5.8, 18, 6, 1);
    for (const z of [-5, 8]) {
      for (let i = 0; i < 7; i++)
        box(-20, 0.55, z - 0.42 + i * 0.14, 5, 0.13, 0.105, M.wood);
      for (let i = 0; i < 4; i++)
        box(-20, 0.86 + i * 0.18, z - 0.55, 5, 0.125, 0.13, M.wood);
      for (const x of [-22, -18]) {
        box(x, 0.26, z, 0.12, 0.52, 0.85, M.steel);
        rod([x, 0.5, z - 0.5], [x, 1.48, z - 0.5], 0.04, M.steel);
      }
    }
    garden = FZSkyGarden.create(root, resources, M, {
      box,
      rod,
      maps: visual.maps,
    });
    // Texture-baked density/cloud shading; a single instanced horizon draw.
    const cloudGeo = geometry(new THREE.PlaneGeometry(1, 1));
    clouds = new THREE.InstancedMesh(cloudGeo, M.cloud, 24);
    resources.add(clouds);
    root.add(clouds);
    clouds.name = "sky_cloud_bank";
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 24; i++) {
      const a = i * 2.39996,
        r = 82 + (i % 4) * 17;
      dummy.position.set(Math.sin(a) * r, 1 + (i % 3) * 2, Math.cos(a) * r);
      dummy.scale.set(43 + (i % 3) * 9, 24 + (i % 4) * 3, 1);
      dummy.rotation.set(0, a, 0);
      dummy.updateMatrix();
      clouds.setMatrixAt(i, dummy.matrix);
    }
    clouds.instanceMatrix.needsUpdate = true;
    const sky = add(
      geometry(new THREE.SphereGeometry(260, 48, 24)),
      ownMaterial(
        new THREE.MeshBasicMaterial({
          map: visual.maps.sky,
          side: THREE.BackSide,
          depthWrite: false,
          fog: false,
          toneMapped: false,
        }),
      ),
      0,
      0,
      0,
    );
    sky.name = "sky_atmosphere";
    sky.renderOrder = -9;
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
    visual.setLayers();
    root.visible = false;
  }
  function ownMaterial(m) {
    resources.add(m);
    return m;
  }
  function sign(text, x, y, z, w, h, bg = "#101326", fg = "#d8edff") {
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
    t.encoding = THREE.sRGBEncoding;
    resources.add(t);
    const m = new THREE.MeshBasicMaterial({
      map: t,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    resources.add(m);
    add(geometry(new THREE.PlaneGeometry(w, h)), m, x, y, z);
  }
  function spawn(mesh) {
    build();
    mesh.position.set(P.spawn.x, P.spawn.y, P.spawn.z);
    window._introDone = true;
    window._spawnFixed = true;
    window.cameraMode = "third";
    CONFIG.CAMERA_DISTANCE = Math.max(
      8.5,
      Math.min(14, CONFIG.CAMERA_DISTANCE),
    );
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
    flight = {
      previousMode,
      landed: false,
      onArrival: typeof onArrival === "function" ? onArrival : null,
    };
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
    const previous = flight.previousMode,
      onArrival = flight.onArrival;
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
    leaveVisual();
    FZPlay.apply(false);
    if (onArrival && window.FZUI?.playing()) onArrival();
  }
  function cancel() {
    leaveVisual();
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
        scene.fog = new THREE.Fog(0x30345b, 100, 380);
      } else if (restoreFog) {
        scene.fog = restoreFog;
        restoreFog = null;
        FZPlay.apply(false);
      }
      priorWorld = on;
    }
    if (on) {
      if (scene.fog) {
        scene.fog.color.setHex(0x30345b);
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
  function leaveVisual() {
    visual?.release();
    if (root) root.visible = false;
    document.body.classList.remove("fz-in-sky");
    if (restoreFog) {
      scene.fog = restoreFog;
      restoreFog = null;
    }
    priorWorld = false;
  }
  function beforeRender() {
    if (!visual) return;
    const on = active() && !!window.FZUI?.playing();
    const extras = [
      window._flash,
      window._flashSpill,
      typeof ITEMS !== "undefined" ? ITEMS.vm : null,
    ];
    const q = visual.update(
      on,
      renderer,
      camera,
      localPlayer,
      remotePlayers,
      extras,
    );
    if (on && clouds && q) {
      garden?.update(performance.now() * 0.001, FZPlay.reducedMotion());
      clouds.count = q.clouds;
      clouds.visible = SETTINGS.sky !== false;
      clouds.rotation.y = FZPlay.reducedMotion()
        ? 0
        : Math.sin(performance.now() * 0.000025) * 0.012;
    }
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
    beforeRender,
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
      look: visual?.info() || null,
      cloudInstances: clouds?.count || 0,
      garden: garden?.info() || null,
    }),
  };
})();
