/* v23 playable metro: reserved street entrances + scoped underground station.
 * All movement uses the native loop/collision/input. No road-crossing surface rails. */
(function () {
  "use strict";
  const P = FZMetroPolicy,
    O = { ...P.origin, y: -8 };
  let owner = null,
    entrances = [],
    root = null,
    resources = new Set(),
    inside = false,
    riding = false,
    trip = null,
    index = 0,
    state = "arriving",
    elapsed = 0,
    train = null,
    tunnel = null,
    tunnelLights = [],
    doors = [],
    board = null,
    boardContext = null,
    boardTexture = null,
    saved = null,
    masks = new Map(),
    cameraMask = 1,
    panel = null,
    lastBoard = -1;
  const own = (r) => (resources.add(r), r),
    makeMat = (color, emissive = 0) =>
      own(
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.67,
          metalness: 0.15,
          emissive,
          emissiveIntensity: 0.45,
        }),
      );
  function box(parent, w, h, d, x, y, z, mat) {
    const m = new THREE.Mesh(own(new THREE.BoxGeometry(w, h, d)), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  function label(parent, text, w, h, x, y, z, color = "#cceaff") {
    const cv = document.createElement("canvas");
    cv.width = 1024;
    cv.height = 256;
    const c = cv.getContext("2d");
    c.fillStyle = "#0c1425";
    c.fillRect(0, 0, 1024, 256);
    c.fillStyle = color;
    c.font = "700 62px Arial";
    while (c.measureText(text).width > 940)
      c.font = "700 " + (parseInt(c.font.slice(4)) - 2) + "px Arial";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(text, 512, 128);
    const tex = own(new THREE.CanvasTexture(cv)),
      m = new THREE.Mesh(
        own(new THREE.PlaneGeometry(w, h)),
        own(
          new THREE.MeshBasicMaterial({
            map: tex,
            toneMapped: false,
            side: THREE.DoubleSide,
          }),
        ),
      );
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  function action(type, name, x, z, range = 2.8, extra = {}) {
    const e = {
      type: "metro_" + type,
      name,
      position: { x, y: 0, z },
      range,
      fzMetro: true,
      ...extra,
    };
    interactables.push(e);
    return e;
  }
  function allowed() {
    return (
      !!localPlayer?.mesh &&
      document.body.classList.contains("game-active") &&
      !window.cine &&
      !window._loadingGate
    );
  }
  function buildEntrances() {
    if (!scene || !cityWorldReady()) return;
    if (owner === scene) return;
    dispose();
    owner = scene;
    entrances = [];
    const stone = makeMat(0x18243c),
      metal = makeMat(0x536b8d);
    for (const [i, s] of P.stations.entries()) {
      const p = FZRoads.find(s.x, s.z, 10, 12, { props: true, limit: 200 });
      if (!p) continue;
      FZRoads.props.push({
        label: "metro:" + s.id,
        bounds: FZRoads.rect(p.x, p.z, 10, 12),
        ...p,
      });
      const g = new THREE.Group();
      g.name = "metro_entrance_" + s.id;
      g.position.set(p.x, 0, p.z);
      scene.add(g);
      const light = makeMat(s.color, s.color);
      box(g, 6, 0.12, 6, 0, 0.06, 0, stone);
      for (const x of [-3, 3]) {
        box(g, 0.3, 3.9, 6, x, 1.95, 0, metal);
        box(g, 0.08, 3.5, 0.1, x - 0.17, 1.9, 3.02, light);
      }
      box(g, 6.7, 0.3, 6.7, 0, 4, 0, stone);
      box(g, 6.7, 0.08, 0.09, 0, 3.8, 3.37, light);
      box(g, 6, 3.8, 0.3, 0, 1.9, -3, stone);
      for (let k = 0; k < 7; k++)
        box(g, 4.8, 0.08, 0.6, 0, 0.1 + k * 0.018, 2.4 - k * 0.65, metal);
      label(
        g,
        "M  /  " + s.name,
        6.2,
        1.1,
        0,
        4.65,
        3.38,
        "#" + s.color.toString(16),
      );
      label(g, "КОЛЬЦЕВАЯ  •  СПУСК", 4, 0.55, 0, 2.2, -2.82);
      const entry = { ...s, x: p.x, z: p.z, group: g, index: i };
      entrances.push(entry);
      action(
        "enter",
        "Метро «" + s.name + "» — спуститься",
        p.x,
        p.z + 4,
        3.4,
        { station: i },
      );
    }
  }
  function clearInterior() {
    if (root) {
      root.parent?.remove(root);
      const owned = new Set();
      root.traverse((o) => {
        if (o.geometry) owned.add(o.geometry);
        for (const m of o.material
          ? Array.isArray(o.material)
            ? o.material
            : [o.material]
          : []) {
          owned.add(m);
          for (const v of Object.values(m)) if (v?.isTexture) owned.add(v);
        }
      });
      for (const r of owned) {
        r.dispose?.();
        resources.delete(r);
      }
    }
    root = null;
    train = null;
    doors = [];
    interactables = interactables.filter((e) => !e.metroInside);
  }
  function buildInterior() {
    clearInterior();
    root = new THREE.Group();
    root.name = "metro_station";
    root.position.set(O.x, O.y, O.z);
    scene.add(root);
    const s = P.stations[index],
      wall = makeMat(0x17243b),
      floor = makeMat(0x47536a),
      stone = makeMat(0xb8c2d3),
      dark = makeMat(0x09101d),
      accent = makeMat(s.color, s.color),
      white = makeMat(0xdcecff, 0x8aaacb);
    box(root, 48, 0.4, 23, 0, -0.22, 2, wall);
    box(root, 46, 0.12, 15, 0, -0.06, 5.5, floor);
    // Real opening into the same-coordinate staircase, not a teleport wall.
    box(root, 21, 8, 0.5, -13.5, 4, 13, wall);
    box(root, 21, 8, 0.5, 13.5, 4, 13, wall);
    box(root, 6, 4, 0.5, 0, 6, 13, wall);
    for (let k = 0; k < 32; k++) {
      const z = 13 + ((k + 0.5) * 12) / 32,
        y = ((k + 1) * 8) / 32;
      box(root, 4.8, 0.25, 12 / 32, 0, y - 0.125, z, stone);
      box(root, 4.6, 0.018, 0.04, 0, y + 0.01, z - 0.17, white);
    }
    for (const x of [-2.65, 2.65]) {
      box(root, 0.25, 12, 13, x, 6, 19.5, wall);
      box(root, 0.12, 0.12, 13, x, 9.2, 19.5, accent);
    }
    box(root, 5.6, 0.25, 13, 0, 12.1, 19.5, dark);
    label(root, "ВЫХОД В ГОРОД ↑", 4, 0.6, 0, 3.3, 12.6);

    box(root, 0.5, 8, 23, -23.5, 4, 2, wall);
    box(root, 0.5, 8, 23, 23.5, 4, 2, wall);
    box(root, 48, 0.35, 23, 0, 8, 2, dark);
    for (let x = -22; x <= 22; x += 2) {
      box(root, 0.025, 0.015, 15, x, 0.01, 5.5, stone);
    }
    for (let z = 0; z <= 12; z += 2)
      box(root, 46, 0.015, 0.025, 0, 0.012, z, stone);
    box(root, 45, 0.025, 0.5, 0, 0.025, -1.15, accent);
    for (let x = -22; x < 22; x += 0.5)
      box(root, 0.07, 0.025, 0.34, x, 0.035, -1.15, stone);
    for (const x of [-16, -8, 8, 16]) {
      box(root, 0.85, 7.7, 0.85, x, 3.85, 6, stone);
      box(root, 1.0, 0.2, 1.0, x, 6.5, 6, accent);
      box(root, 0.035, 5, 0.9, x + 0.44, 3.2, 6, accent);
    }
    for (const x of [-18, -9, 0, 9, 18]) {
      box(root, 6, 0.05, 0.24, x, 7.65, 1, white);
      box(root, 6, 0.05, 0.24, x, 7.65, 10, white);
    }
    for (const x of [-15, 15]) {
      box(root, 4.2, 0.15, 1, x, 0.8, 10, stone);
      box(root, 4.2, 0.85, 0.12, x, 1.2, 10.45, wall);
      for (const d of [-1.6, 1.6])
        box(root, 0.15, 0.8, 0.7, x + d, 0.4, 10, wall);
    }
    label(root, s.name.toUpperCase(), 12, 1.5, 0, 5.1, 12.7);
    label(root, s.exit, 10, 0.7, 0, 3.95, 12.69);
    label(root, "ВЫХОД В ГОРОД  ↑", 5, 0.7, 0, 2.7, 12.68);
    label(
      root,
      P.stations
        .map((v, i) => (i === index ? "● " : "○ ") + v.name)
        .join("  —  "),
      21,
      1.4,
      -0.0,
      6.9,
      12.65,
      "#" + s.color.toString(16),
    );
    box(root, 48, 7.5, 0.4, 0, 3.75, -10, wall);
    box(root, 48, 0.18, 0.06, 0, 2, -9.77, accent);
    label(root, s.name.toUpperCase(), 10, 1.2, -12, 3.7, -9.76);
    label(root, s.name.toUpperCase(), 10, 1.2, 12, 3.7, -9.76);
    for (const x of [-20, -10, 0, 10, 20]) {
      const pts = [];
      for (let j = 0; j <= 16; j++)
        pts.push(
          new THREE.Vector3(
            x,
            5.5 + 2 * Math.sin((j / 16) * Math.PI),
            -10 + (j / 16) * 23,
          ),
        );
      const arch = new THREE.Mesh(
        own(
          new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3(pts),
            24,
            0.12,
            6,
            false,
          ),
        ),
        stone,
      );
      root.add(arch);
    }
    // Rails stay in the dedicated underground space, behind a collision boundary.
    for (const z of [-5, -3]) box(root, 80, 0.1, 0.12, 0, -0.3, z, stone);
    for (let x = -40; x < 40; x += 1)
      box(root, 0.18, 0.15, 3.4, x, -0.42, -4, wall);
    train = new THREE.Group();
    train.name = "metro_train";
    train.position.z = 2;
    root.add(train);
    const shell = makeMat(0x7187a6),
      seat = makeMat(0x376b8c);
    box(train, 27, 0.25, 4.4, 0, -0.12, -6, shell);
    box(train, 27, 0.22, 4.4, 0, 3.8, -6, shell);
    box(train, 27, 3.6, 0.16, 0, 1.8, -8.1, shell);
    for (const x of [-13.4, 13.4])
      box(train, 0.18, 3.6, 4.1, x, 1.8, -6, shell);
    const glass = own(
      new THREE.MeshStandardMaterial({
        color: 0x5494b2,
        transparent: true,
        opacity: 0.23,
        roughness: 0.18,
        metalness: 0.1,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    const pane = (parent, w, h, x, y, z) => {
      const m = new THREE.Mesh(own(new THREE.PlaneGeometry(w, h)), glass);
      m.position.set(x, y, z);
      parent.add(m);
    };
    for (let x = -12; x <= 12; x += 4) {
      if (x === 0 || Math.abs(x) === 8) continue;
      box(train, 2.6, 1.1, 0.12, x, 0.55, -3.9, shell);
      box(train, 2.6, 0.5, 0.12, x, 3.4, -3.9, shell);
      box(train, 2.6, 0.18, 0.03, x, 0.4, -3.82, accent);
      pane(train, 2.4, 1.85, x, 2.13, -3.87);
      box(train, 0.1, 2.1, 0.12, x - 1.3, 2.1, -3.9, shell);
    }
    for (let x = -11; x < 12; x += 2) {
      box(train, 1.6, 0.17, 0.65, x, 0.8, -7.5, seat);
      box(train, 1.6, 0.8, 0.15, x, 1.15, -7.84, seat);
    }
    for (const x of [-10, 0, 10])
      box(train, 0.055, 3.6, 0.055, x, 1.8, -6.8, white);
    for (const x of [-8, 0, 8])
      for (const sign of [-1, 1]) {
        const d = new THREE.Group();
        d.position.set(x + sign * 0.58, 1.7, -3.88);
        train.add(d);
        box(d, 1.15, 1.1, 0.1, 0, -1.15, 0, shell);
        box(d, 1.15, 0.3, 0.1, 0, 1.55, 0, shell);
        for (const edge of [-0.535, 0.535])
          box(d, 0.08, 2, 0.1, edge, 0.4, 0, shell);
        box(d, 1.15, 0.18, 0.03, 0, -1.3, 0.07, accent);
        pane(d, 1, 2, 0, 0.4, 0.01);
        box(d, 0.035, 0.6, 0.04, sign * 0.39, -0.25, 0.09, white);
        doors.push({ mesh: d, base: x + sign * 0.58, sign });
      }
    label(train, "КОЛЬЦЕВАЯ / FANTAZIA", 9, 0.55, 0, 3.3, -3.8);
    label(train, "ДЕРЖИТЕСЬ ЗА ПОРУЧНИ", 8, 0.5, 0, 2.5, -7.99);
    // Single reusable texture for the live departure board.
    const cv = document.createElement("canvas");
    cv.width = 1024;
    cv.height = 256;
    boardContext = cv.getContext("2d");
    boardTexture = own(new THREE.CanvasTexture(cv));
    board = new THREE.Mesh(
      own(new THREE.PlaneGeometry(5.3, 1.3)),
      own(
        new THREE.MeshBasicMaterial({
          map: boardTexture,
          toneMapped: false,
          side: THREE.DoubleSide,
        }),
      ),
    );
    board.position.set(0, 5.2, -2);
    root.add(board);
    lastBoard = -1;
    const hemi = new THREE.HemisphereLight(0xc7dfff, 0x344155, 1.25);
    root.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(3, 7, 3);
    root.add(sun);
    root.add(sun.target);
    tunnel = new THREE.Group();
    tunnel.name = "metro_travel_tunnel";
    tunnel.position.z = 2;
    root.add(tunnel);
    tunnelLights = [];
    for (const z of [-9, -3.3]) box(tunnel, 100, 6, 0.3, 0, 2, z, dark);
    for (let i = 0; i < 16; i++) {
      const strip = box(
        tunnel,
        0.15,
        3.5,
        0.06,
        i * 6 - 48,
        1.8,
        -3.47,
        accent,
      );
      tunnelLights.push(strip);
    }
    const screen = new THREE.Mesh(
      own(new THREE.PlaneGeometry(1.6, 0.6)),
      board.material,
    );
    screen.position.set(0, 2.6, -7.99);
    train.add(screen);
    root.traverse((o) => o.layers.set(3));
    action("exit", "Выход — вверх по лестнице", O.x, O.z + 11, 2.6, {
      metroInside: true,
      interior: true,
    });
    action("board", "Войти пешком через двери", O.x, O.z - 1, 2.8, {
      metroInside: true,
      interior: true,
    });
    action("alight", "Выйти из поезда", O.x, O.z - 3.8, 3.1, {
      metroInside: true,
      interior: true,
    });
    for (const x of [-11, -9, -7, -5, -3, -1, 1, 3, 5, 7, 9, 11]) {
      const seat = {
        x: O.x + x,
        y: O.y + 0.15,
        z: O.z - 5.45,
        rot: 0,
        groundY: O.y,
        metro: true,
        train: true,
      };
      action("seat", "Сесть в кресло", seat.x, seat.z + 1, 1.35, {
        metroInside: true,
        interior: true,
        seat,
      });
    }
    for (const x of [-16, -14, 14, 16]) {
      const seat = {
        x: O.x + x,
        y: O.y + 0.15,
        z: O.z + 10,
        rot: Math.PI,
        groundY: O.y,
        metro: true,
        train: false,
      };
      action("seat", "Сесть на скамью", seat.x, seat.z - 1.25, 1.3, {
        metroInside: true,
        interior: true,
        seat,
      });
    }
    action("map", "Схема метро и звук", O.x - 5, O.z + 11, 3, {
      metroInside: true,
      interior: true,
    });
  }
  function enter(i) {
    if (
      !allowed() ||
      inside ||
      localCar ||
      isInsideBuilding ||
      isInFactory ||
      isInBasement ||
      FZSky.active()
    )
      return false;
    const e = entrances.find((e) => e.index === i);
    if (
      !e ||
      Math.hypot(
        localPlayer.mesh.position.x - e.x,
        localPlayer.mesh.position.z - e.z - 4,
      ) > 4
    )
      return false;
    saved = {
      fog: scene.fog,
      background: scene.background,
      position: localPlayer.mesh.position.clone(),
      cameraMode: window.cameraMode,
      h: cameraAngleH,
      v: cameraAngleV,
    };
    cameraMask = camera.layers.mask;
    FZGuide.pause();
    inside = true;
    // Keep player and camera transforms: entry is a continuous walk.
    index = i;
    riding = false;
    state = "arriving";
    elapsed = 0;
    isInsideBuilding = true;
    currentBuildingType = "metro";
    currentFloor = 0;
    O.x = e.x;
    O.z = e.z - 23;
    O.y = -8;
    buildInterior();
    document.body.classList.add("fz-in-metro");
    FZMetroAudio.activate(true);
    FZMetroAudio.say("arrival");
    return true;
  }
  function restore() {
    camera.layers.mask = cameraMask;
    for (const [obj, mask] of masks) obj.layers.mask = mask;
    masks.clear();
    if (saved) {
      scene.fog = saved.fog;
      scene.background = saved.background;
      // Entry never changes the view: walking out must keep the current heading.
    }
  }
  function exit(walking = false) {
    if (!inside) {
      FZMetroAudio.activate(false);
      close();
      return false;
    }
    if (sittingOn?.spot.metro) standUpFromSeat();
    FZMetroAudio.activate(false);
    restore();
    inside = false;
    document.body.classList.remove("fz-in-metro");
    riding = false;
    isInsideBuilding = false;
    currentBuildingType = null;
    saved = null;
    clearInterior();
    close();
    if (!walking) FZPlay.release();
    return true;
  }
  function boardTrain() {
    if (
      !inside ||
      state !== "open" ||
      riding ||
      !P.door(localPlayer.mesh.position.x - O.x) ||
      Math.abs(localPlayer.mesh.position.z - O.z + 1) > 2.6
    )
      return false;
    showNotification("Пройдите через открытые двери вагона.", "info");
    return true;
  }
  function alight() {
    if (!inside || !riding || state !== "open") return false;
    showNotification("Выходите пешком через открытые двери.", "info");
    return true;
  }
  function requestExit() {
    if (!inside) return false;
    showNotification(
      riding
        ? "Сначала выйдите из вагона на остановке."
        : "Поднимитесь по лестнице к выходу.",
      "info",
    );
    return false;
  }
  const doorsOpen = () => state === "open" && elapsed > 0.65;
  function collision(x, z) {
    if (inside) return P.blocked(x - O.x, z - O.z, riding, doorsOpen());
    for (const e of entrances) {
      const dx = x - e.x,
        dz = z - e.z;
      if (
        (Math.abs(dx) > 2.5 && Math.abs(dx) < 3.5 && Math.abs(dz) < 3.5) ||
        (Math.abs(dx) < 3.5 && Math.abs(dz + 3) < 0.6)
      )
        return true;
    }
    return null;
  }
  function textBoard() {
    const remaining = Math.ceil(P.duration[state] - elapsed);
    if (remaining === lastBoard) return;
    lastBoard = remaining;
    const c = boardContext;
    c.fillStyle = "#080f1c";
    c.fillRect(0, 0, 1024, 256);
    c.textAlign = "left";
    c.fillStyle = "#a2dcff";
    c.font = "600 40px Arial";
    c.fillText("01  КОЛЬЦЕВАЯ · " + P.stations[index].name, 40, 65);
    c.fillStyle = "#fff";
    c.font = "700 47px Arial";
    c.fillText(
      {
        arriving: "Поезд прибывает",
        open: "Посадка открыта",
        closing: "Двери закрываются",
        travel: riding
          ? "Следующая: " + P.stations[P.next(index)].name
          : "Поезд отправился",
        away: "Прибытие поезда",
      }[state],
      40,
      140,
    );
    c.fillStyle = "#c2b2ff";
    c.font = "32px Arial";
    c.fillText(
      remaining +
        " с   •   " +
        (riding ? "E — выход только на остановке" : "Проезд бесплатный"),
      40,
      213,
    );
    boardTexture.needsUpdate = true;
  }
  function carry(x, z) {
    const dx = x - O.x,
      dz = z - O.z;
    O.x = x;
    O.z = z;
    root.position.set(x, O.y, z);
    localPlayer.mesh.position.x += dx;
    localPlayer.mesh.position.z += dz;
    camera.position.x += dx;
    camera.position.z += dz;
    if (window._camPrev) {
      window._camPrev.x += dx;
      window._camPrev.z += dz;
    }
    if (window._camLook) {
      window._camLook.x += dx;
      window._camLook.z += dz;
    }
    for (const e of interactables.filter((e) => e.metroInside)) {
      e.position.x += dx;
      e.position.z += dz;
      if (e.seat) {
        e.seat.x += dx;
        e.seat.z += dz;
      }
    }
    if (
      sittingOn?.spot.metro &&
      !interactables.some((e) => e.seat === sittingOn.spot)
    ) {
      sittingOn.spot.x += dx;
      sittingOn.spot.z += dz;
    }
  }
  function update(dt) {
    if (!allowed()) {
      if (inside && !document.body.classList.contains("game-active")) exit();
      return;
    }
    buildEntrances();
    if (!inside) {
      const p = localPlayer.mesh.position;
      const entry = entrances.find(
        (e) => Math.abs(p.x - e.x) < 2.3 && p.z - e.z < 3.1 && p.z - e.z > 1.5,
      );
      if (entry) enter(entry.index);
      return;
    }
    const player = localPlayer.mesh.position,
      rz = player.z - O.z;
    if (rz > 27.5 && !riding) {
      exit(true);
      return;
    }
    // Keep doors open while someone is crossing the threshold.
    if (
      state === "open" &&
      elapsed > P.duration.open - 1.5 &&
      P.door(player.x - O.x) &&
      rz > -2.85 &&
      rz < -1.0
    )
      elapsed = P.duration.open - 1.5;
    if (doorsOpen() && !sittingOn) riding = rz < -2.35;
    const step = P.advance(state, elapsed, dt);
    state = step.state;
    elapsed = step.elapsed;
    if (step.changed) {
      lastBoard = -1;
      if (state === "open") FZMetroAudio.say(P.stations[index].id);
      if (state === "closing") FZMetroAudio.say("close");
      if (state === "arriving") {
        if (riding) {
          if (trip) carry(trip.to.x, trip.to.z);
          index = P.next(index);
          buildInterior();
          trip = null;
        }
        FZMetroAudio.say("arrival");
      }
      if (state === "travel" && riding) {
        const next = entrances.find((e) => e.index === P.next(index));
        trip = next
          ? { from: { ...O }, to: { x: next.x, y: -8, z: next.z - 23 } }
          : null;
      }
      if (state === "travel" && !riding) {
        state = "away";
        elapsed = 0;
      }
    }
    if (state === "travel" && riding && trip) {
      const t = Math.min(1, elapsed / P.duration.travel),
        k = t * t * (3 - 2 * t);
      carry(
        trip.from.x + (trip.to.x - trip.from.x) * k,
        trip.from.z + (trip.to.z - trip.from.z) * k,
      );
    }
    const open =
      state === "open"
        ? Math.min(1, elapsed * 1.7)
        : state === "closing"
          ? Math.max(0, 1 - elapsed / 2)
          : 0;
    for (const d of doors) d.mesh.position.x = d.base + d.sign * 1.12 * open;
    train.visible = riding || state !== "away";
    train.position.x = riding
      ? 0
      : state === "arriving"
        ? Math.pow(1 - elapsed / P.duration.arriving, 2) * 65
        : 0;
    const travelling = riding && state === "travel";
    for (const child of root.children) {
      if (child === train || child.isLight || child === tunnel) continue;
      child.visible = !travelling;
    }
    tunnel.visible = travelling;
    for (let i = 0; i < tunnelLights.length; i++)
      tunnelLights[i].position.x = ((i * 6 + elapsed * 18) % 96) - 48;
    textBoard();
    const p = localPlayer.mesh.position;
    // Collision prevents leaving the station; never teleport a valid pedestrian.
  }
  const underground = new THREE.Color(0x080d18);
  function beforeRender() {
    if (!inside) return;
    scene.background = underground;
    scene.fog = null;
    camera.layers.set(3);
    if (window.cameraMode !== "first") {
      camera.position.x = Math.max(
        O.x -
          (riding ? 12 : localPlayer.mesh.position.z - O.z > 13 ? 2.15 : 22.5),
        Math.min(
          O.x +
            (riding
              ? 12
              : localPlayer.mesh.position.z - O.z > 13
                ? 2.15
                : 22.5),
          camera.position.x,
        ),
      );
      camera.position.z = Math.max(
        O.z + (riding ? -5.7 : -9.4),
        Math.min(O.z + (riding ? -2.1 : 28), camera.position.z),
      );
      camera.position.y = Math.max(
        O.y + 0.4,
        Math.min(
          O.y +
            (riding
              ? 3.4
              : localPlayer.mesh.position.z - O.z > 13
                ? 11.6
                : 7.5),
          camera.position.y,
        ),
      );
      camera.lookAt(
        localPlayer.mesh.position.x,
        localPlayer.mesh.position.y + 1.5,
        localPlayer.mesh.position.z,
      );
    }

    localPlayer.mesh.traverse((o) => {
      if (!masks.has(o)) masks.set(o, o.layers.mask);
      o.layers.enable(3);
    });
    if (ITEMS.vm)
      ITEMS.vm.traverse((o) => {
        if (!masks.has(o)) masks.set(o, o.layers.mask);
        o.layers.enable(3);
      });
    for (const o of [window._flash, window._flashSpill])
      if (o) {
        if (!masks.has(o)) masks.set(o, o.layers.mask);
        o.layers.enable(3);
      }
  }
  function close() {
    panel?.remove();
    panel = null;
  }
  function open() {
    if (!allowed()) return;
    close();
    FZPlay.release();
    document.exitPointerLock?.();
    panel = document.createElement("section");
    panel.id = "fzMetroPanel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.innerHTML =
      '<article><header><div><small>FANTAZIA / METRO 23</small><h2>Кольцевая линия</h2></div><button data-close>Закрыть</button></header><p>Пять станций. Бесплатный проезд. Вход — через уличные павильоны с буквой M.</p><div class="metro-stations"></div><fieldset><legend>Объявления</legend><label><input type="checkbox" data-voice> Голос в метро</label><label>Громкость <input type="range" min="0" max="1" step="0.05" data-volume></label><button data-test>Послушать голос</button><p>Записанный голос, не системный синтез. Субтитры доступны и без звука.</p></fieldset></article>';
    document.body.append(panel);
    const list = panel.querySelector(".metro-stations");
    for (const [i, s] of P.stations.entries()) {
      const row = document.createElement("div");
      row.style.setProperty("--station", "#" + s.color.toString(16));
      const e = entrances.find((e) => e.index === i);
      row.innerHTML =
        "<b>" +
        s.name +
        "</b><span>" +
        s.exit +
        "</span><small>" +
        (inside && i === index
          ? "Вы здесь"
          : e
            ? "Вход: " + Math.round(e.x) + ", " + Math.round(e.z)
            : "Вход готовится") +
        "</small>";
      if (e && !inside) {
        const go = document.createElement("button");
        go.textContent = "Маршрут ко входу";
        go.disabled = !!window.FZSky?.active() || isInsideBuilding;
        go.onclick = () => {
          FZGuide.pause();
          setNavTarget(e.x, e.z + 4, "Метро «" + s.name + "»", true);
          close();
          FZMetroAudio.activate(false);
        };
        row.append(go);
      }
      list.append(row);
    }
    const info = FZMetroAudio.info(),
      cb = panel.querySelector("[data-voice]"),
      range = panel.querySelector("[data-volume]");
    cb.checked = info.enabled;
    range.value = info.volume;
    cb.onchange = range.oninput = () =>
      FZMetroAudio.set(Number(range.value), cb.checked);
    panel.querySelector("[data-test]").onclick = () => {
      FZMetroAudio.activate(true);
      FZMetroAudio.say("arrival");
    };
    panel.querySelector("[data-close]").onclick = () => {
      if (!inside) FZMetroAudio.activate(false);
      close();
    };
    panel.onkeydown = (e) => {
      if (e.key === "Tab") {
        const f = [...panel.querySelectorAll("button:not(:disabled),input")];
        if (e.shiftKey && document.activeElement === f[0]) {
          e.preventDefault();
          f[f.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
          e.preventDefault();
          f[0].focus();
        }
      }
      e.stopPropagation();
      if (e.key === "Escape") {
        if (!inside) FZMetroAudio.activate(false);
        close();
      }
    };
    panel.querySelector("[data-close]").focus();
  }
  function interact(e) {
    if (!e?.fzMetro) return false;
    if (e.type === "metro_enter") enter(e.station);
    else if (e.type === "metro_seat") {
      if (inside && riding === e.seat.train) {
        sitOnBench(e);
        cameraAngleH = e.seat.rot;
        cameraAngleV = 0.08;
      }
    } else if (e.type === "metro_exit" && !riding) requestExit();
    else if (e.type === "metro_board") {
      if (!boardTrain())
        showNotification("Дождитесь остановки и открытых дверей.", "info");
    } else if (e.type === "metro_alight") {
      if (!alight()) showNotification("Выход откроется на станции.", "info");
    } else if (e.type === "metro_map") open();
    return true;
  }
  function dispose() {
    if (inside) exit();
    clearInterior();
    for (const e of entrances) e.group.parent?.remove(e.group);
    interactables = interactables.filter((e) => !e.fzMetro || e.sky);
    resources.forEach((r) => r.dispose?.());
    resources.clear();
    entrances = [];
    owner = null;
  }
  document.addEventListener("keydown", (e) => {
    if (
      e.code === "KeyT" &&
      !e.repeat &&
      allowed() &&
      !window.FZTouch?.blocked()
    ) {
      e.preventDefault();
      open();
    }
  });
  const api = {
    update,
    beforeRender,
    enter,
    exit,
    board: boardTrain,
    alight,
    collision,
    ground: () => (inside ? P.ground(localPlayer.mesh.position.z - O.z) : null),
    requestExit,
    interact,
    open,
    dispose,
    active: () => inside,
    ride: () => riding,
    info: () => ({
      inside,
      origin: { ...O },
      riding,
      index,
      state,
      elapsed,
      stations: entrances.map(({ group, ...e }) => e),
      resources: resources.size,
    }),
  };
  window.FZMetro = api;
  window.FZ8M_update = update;
  window.FZ8M = {
    metro: open,
    stations: () => api.info().stations,
    ride: () => riding,
    board: boardTrain,
    exit: alight,
  };
})();
