/* v27: furnished bank/cinema, actual game-model staff, usable seats.
 * Existing homes/school/shops retain their own layouts and activities. */
(function () {
  "use strict";
  let active = null,
    ticket = 0;
  const services = {
    office: ["Секретарь", "Здесь рабочие кабинеты и переговорная."],
    hospital: [
      "Регистратор",
      "Приёмная здесь. Кабинеты врачей — дальше по коридору.",
    ],
    restaurant: ["Официант", "Добро пожаловать! Выбирайте свободный столик."],
    cafe: ["Бариста", "Добро пожаловать в кофейню."],
    gym: ["Тренер", "Сначала разминка, затем тренировка."],
    club: ["Администратор", "Танцпол открыт. Танцы выбираются в меню."],
    karaoke: ["Администратор", "Выбирайте песню в меню караоке."],
    shop_grocery: ["Продавец", "Продукты и касса — в торговом зале."],
    shop_clothes: ["Консультант", "Одежда и примерочная — в торговом зале."],
    shop_bakery: ["Пекарь", "Свежая выпечка на витрине."],
    shop_sushi: ["Кассир", "Добро пожаловать в суши-бар."],
  };
  function collect() {
    if (!active) return;
    active.root.traverse((o) => {
      if (o.geometry) active.resources.add(o.geometry);
      if (o.skeleton?.boneTexture) active.resources.add(o.skeleton.boneTexture);
      for (const m of o.material
        ? Array.isArray(o.material)
          ? o.material
          : [o.material]
        : []) {
        active.resources.add(m);
        for (const v of Object.values(m))
          if (v?.isTexture) active.resources.add(v);
      }
    });
  }
  function release() {
    if (!active) return;
    if (sittingOn?.spot.venue27) standUpFromSeat();
    collect();
    active.root.parent?.remove(active.root);
    active.resources.forEach((r) => r.dispose?.());
    interiorObjects = interiorObjects.filter((o) => o !== active.root);
    interactables = interactables.filter((e) => !e.venue27);
    active = null;
  }
  function setup(type) {
    const root = new THREE.Group();
    root.name = "venue_" + type;
    root.position.set(INTERIOR_BASE.x, currentFloor * 3.5, INTERIOR_BASE.z);
    scene.add(root);
    interiorObjects.push(root);
    active = {
      root,
      type,
      resources: new Set(),
      staff: [],
      time: 0,
      film: true,
      frame: -1,
    };
    return root;
  }
  function box(w, h, d, x, y, z, color, solid = false) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.7 }),
    );
    m.position.set(x, y, z);
    active.root.add(m);
    if (solid)
      interiorColliders.push({
        minX: INTERIOR_BASE.x + x - w / 2,
        maxX: INTERIOR_BASE.x + x + w / 2,
        minZ: INTERIOR_BASE.z + z - d / 2,
        maxZ: INTERIOR_BASE.z + z + d / 2,
      });
    return m;
  }
  function sign(text, x, y, z, w = 4, h = 0.6) {
    const c = document.createElement("canvas");
    c.width = 768;
    c.height = 128;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#112637";
    ctx.fillRect(0, 0, 768, 128);
    ctx.fillStyle = "#e6f5ff";
    ctx.textAlign = "center";
    ctx.font = "600 36px Arial";
    ctx.fillText(text, 384, 78, 740);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(c),
        side: THREE.DoubleSide,
      }),
    );
    m.position.set(x, y, z);
    active.root.add(m);
    return m;
  }
  function action(name, x, z, kind, extra = {}) {
    const p = active.root.position;
    const e = {
      type: "venue_action",
      name,
      position: { x: p.x + x, y: p.y, z: p.z + z },
      range: 2,
      interior: true,
      venue27: true,
      kind,
      ...extra,
    };
    interactables.push(e);
    return e;
  }
  function seat(x, z, rot = 0, color = 0x315565) {
    const y = active.root.position.y;
    box(0.96, 0.18, 0.85, x, 0.77, z, color, true);
    box(
      0.96,
      1,
      0.15,
      x - Math.sin(rot) * 0.38,
      1.25,
      z - Math.cos(rot) * 0.38,
      color,
    ).rotation.y = rot;
    for (const dx of [-0.38, 0.38])
      box(0.08, 0.7, 0.08, x + dx, 0.35, z, 0x26323f);
    action(
      "Сесть",
      x + Math.sin(rot) * 1.05,
      z + Math.cos(rot) * 1.05,
      "seat",
      {
        range: 1.45,
        seat: {
          x: INTERIOR_BASE.x + x,
          y: y + 0.15,
          z: INTERIOR_BASE.z + z,
          rot,
          groundY: y,
          standOffset: 1.1,
          venue27: true,
        },
      },
    );
  }
  function employee(name, x, z, kind = "talk", text = "Добро пожаловать.") {
    const appearance = {
      skinColor: 0xffd1a4,
      shirtColor: 0x315976,
      pantsColor: 0x283341,
      hairColor: 0x503726,
      hairStyle: 0,
    };
    const g = FZNativeCharacter(appearance, false);
    FZOpeningAvatar.refine(g, active.staff.length, appearance);
    g.position.set(x, 0, z);
    g.name = "staff_" + name;
    active.root.add(g);
    active.staff.push(g);
    sign(name, x, 3.25, z, 3, 0.45);
    action(name + " — поговорить", x, z + 1.6, kind, { text });
  }
  function shell(type) {
    currentFloor = 0;
    maxFloors = 1;
    interiorBounds = { W: 14, D: 12 };
    const cinema = type === "cinema";
    box(30, 0.2, 26, 0, -0.1, 0, cinema ? 0x202839 : 0xc7ced2);
    box(30, 0.2, 26, 0, 7.5, 0, 0x222d3f);
    for (const x of [-15, 15])
      box(0.3, 7.5, 26, x, 3.75, 0, cinema ? 0x252c42 : 0xe1e5e7);
    for (const z of [-13, 13])
      box(30, 7.5, 0.3, 0, 3.75, z, cinema ? 0x252c42 : 0xe1e5e7);
    const hemi = new THREE.HemisphereLight(
      0xe7f2ff,
      0x526075,
      cinema ? 0.65 : 1.15,
    );
    active.root.add(hemi);
    const light = new THREE.PointLight(0xffffff, cinema ? 0.7 : 1.6, 40, 1);
    light.position.set(0, 6, 2);
    active.root.add(light);
    for (const x of [-10, 0, 10])
      for (const z of [-6, 5]) {
        const m = box(3, 0.05, 1, x, 7.35, z, 0xe8f7ff);
        m.material.emissive.setHex(0xb9dfff);
        m.material.emissiveIntensity = 0.7;
      }
    sign("ВЫХОД", 0, 2.8, 12.75, 2.8);
    action("Выйти из здания", 0, 11, "exit");
  }
  function bank() {
    shell("bank");
    sign("FANTAZIA BANK", 0, 5.5, -12.75, 12, 1.3);
    sign("ОБСЛУЖИВАНИЕ · ВКЛАДЫ · ОБМЕН", 0, 4.3, -12.74, 10, 0.7);
    for (const [i, x] of [-7, 0, 7].entries()) {
      box(5.4, 1.15, 1.5, x, 0.575, -5.7, 0x28485b, true);
      box(5.6, 0.12, 1.65, x, 1.2, -5.7, 0xe3d6b7);
      box(0.9, 0.55, 0.08, x + 0.8, 1.6, -5.8, 0x122230);
      box(0.8, 0.04, 0.32, x + 0.8, 1.29, -5.2, 0x445965);
      sign("ОКНО " + (i + 1), x, 2.3, -6.5, 2, 0.5);
      employee("Операционист " + (i + 1), x, -7.4, "bank");
      action("Операционист " + (i + 1) + " — обслуживание", x, -3.7, "bank");
    }
    for (const x of [-10, 10])
      for (const z of [2, 4.2, 6.4])
        seat(x, z, (Math.PI / 2) * (x < 0 ? 1 : -1));
    box(2.1, 2.9, 0.7, -12, 1.45, 9, 0x263d53, true);
    sign("БАНКОМАТ", -12, 2.3, 9.38, 1.8, 0.4);
    sign("СЧЁТ / ВКЛАД", -12, 1.6, 9.39, 1.6, 0.6);
    action("Банкомат — операции", -12, 10.4, "bank");
    box(0.8, 1.25, 0.7, 5, 0.625, 7, 0x45657a, true);
    sign("ВЗЯТЬ ТАЛОН", 5, 1.6, 7.4, 2, 0.4);
    action("Взять талон очереди", 5, 8.4, "ticket");
    box(3.7, 3.5, 0.25, 11, 1.75, -12.6, 0x637384, true);
    sign("ХРАНИЛИЩЕ · СЛУЖЕБНЫЙ ВХОД", 11, 4, -12.4, 5, 0.5);
    box(0.12, 1.1, 0.12, 11.8, 1.8, -12.35, 0xd0d7da);
    employee(
      "Консультант",
      -6,
      8,
      "talk",
      "Возьмите талон у стойки. Операционисты и банкомат используют обычные игровые счета.",
    );
  }
  function cinema() {
    shell("cinema");
    sign("FANTAZIA CINEMA", 0, 6.65, -12.75, 11, 0.85);
    box(12.7, 5.3, 0.25, 0, 3.65, -11.9, 0x10141b);
    const cv = document.createElement("canvas");
    cv.width = 640;
    cv.height = 320;
    const tex = new THREE.CanvasTexture(cv);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 4.8),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
    );
    screen.position.set(0, 3.65, -11.72);
    active.root.add(screen);
    active.screen = { cv, tex };
    for (let row = 0; row < 5; row++)
      for (const x of [-6.5, -5, -3.5, -2, 2, 3.5, 5, 6.5])
        seat(x, -5 + row * 2.2, Math.PI, 0x763951);
    for (const x of [-1, 1])
      for (let z = -7; z < 7; z += 1.4) {
        const m = box(0.08, 0.04, 0.35, x, 0.04, z, 0x79d2e8);
        m.material.emissive.setHex(0x54b3db);
      }
    box(4, 1.1, 1.2, -10, 0.55, 9, 0x33435f, true);
    employee(
      "Кассир кинотеатра",
      -10,
      7.5,
      "talk",
      "Показ бесплатный. Выберите кресло и нажмите действие, чтобы сесть.",
    );
    sign("БИЛЕТЫ / ИНФОРМАЦИЯ", -10, 3.8, 8.9, 6, 0.6);
    action("Показ: включить / пауза", 10, 9, "film");
    sign("ПРОЕКТОР", 10, 1.8, 9.5, 3, 0.5);
  }
  function drawFilm() {
    const { cv, tex } = active.screen,
      c = cv.getContext("2d"),
      t = active.time;
    c.fillStyle = "#111c3b";
    c.fillRect(0, 0, 640, 320);
    c.fillStyle = "#b8d3ff";
    c.beginPath();
    c.arc(520, 65, 25, 0, 7);
    c.fill();
    for (let i = 0; i < 16; i++) {
      const h = 65 + ((i * 47) % 120);
      c.fillStyle = i % 2 ? "#253d61" : "#304b72";
      c.fillRect(i * 44 - 20, 280 - h, 40, h);
      c.fillStyle = "#e8c893";
      for (let yy = 290 - h; yy < 267; yy += 20)
        for (let xx = i * 44 - 12; xx < i * 44 + 15; xx += 12)
          c.fillRect(xx, yy, 5, 7);
    }
    c.fillStyle = "#101723";
    c.fillRect(0, 280, 640, 40);
    c.fillStyle = "#81d8e8";
    c.fillRect(((t * 45) % 720) - 60, 285, 55, 14);
    c.fillStyle = "#eef7ff";
    c.font = "20px Arial";
    c.fillText("FANTAZIA · НОЧНОЙ ГОРОД", 20, 30);
    tex.needsUpdate = true;
  }
  function update(dt) {
    if (!active) return;
    if (!isInsideBuilding || currentBuildingType !== active.type) {
      release();
      return;
    }
    if (!Number.isFinite(dt)) return;
    if (active.film && !window.FZPlay?.reducedMotion())
      active.time += Math.min(0.1, Math.max(0, dt));
    for (const [i, g] of active.staff.entries()) {
      g.userData.head.rotation.y = Math.sin(active.time * 0.6 + i) * 0.13;
      FZOpeningAvatar.pose(g.userData);
    }
    if (active.screen) {
      const frame = Math.floor(active.time * 10);
      if (frame !== active.frame) {
        drawFilm();
        active.frame = frame;
      }
    }
  }
  function interact(e) {
    if (!e.venue27) return false;
    if (!active || !isInsideBuilding) return true;
    switch (e.kind) {
      case "seat":
        sitOnBench(e);
        cameraAngleH = e.seat.rot;
        cameraAngleV = 0.08;
        break;
      case "bank":
        window.FZ7_open?.("bank");
        break;
      case "exit":
        exitBuilding();
        break;
      case "ticket":
        ticket = (ticket % 999) + 1;
        showNotification(
          "Ваш талон A" +
            String(ticket).padStart(3, "0") +
            ". Подойдите к свободному окну.",
          "info",
        );
        break;
      case "film":
        active.film = !active.film;
        showNotification(
          active.film ? "Показ продолжается." : "Показ на паузе.",
          "info",
        );
        break;
      default:
        showNotification(e.text, "info");
    }
    return true;
  }
  const original = window.buildInterior;
  window.buildInterior = function (type) {
    release();
    if (["bank", "biz_bank", "cinema"].includes(type)) {
      window.FZ8B?.release();
      interiorObjects.forEach((o) => scene.remove(o));
      interiorObjects = [];
      interiorColliders = [];
      interactables = interactables.filter((e) => !e.interior);
      npcs = npcs.filter((n) => !n.isInterior);
      setup(type);
      if (type === "cinema") cinema();
      else bank();
      if (window.cameraMode === "first") cameraAngleH = Math.PI;
      collect();
      return;
    }
    original(type);
    if (services[type]) {
      setup(type);
      const [name, text] = services[type];
      for (const [x, z] of [
        [8, -5],
        [-8, 5],
        [6, 6],
        [-6, -6],
      ]) {
        const wx = INTERIOR_BASE.x + x,
          wz = INTERIOR_BASE.z + z;
        if (
          !interiorColliders.some(
            (c) =>
              wx > c.minX - 1 &&
              wx < c.maxX + 1 &&
              wz > c.minZ - 1 &&
              wz < c.maxZ + 1,
          )
        ) {
          employee(name, x, z, "talk", text);
          break;
        }
      }
      collect();
    }
  };
  window.FZVenues = {
    release,
    update,
    interact,
    info: () =>
      active
        ? {
            type: active.type,
            staff: active.staff.length,
            seats: interactables.filter((e) => e.venue27 && e.kind === "seat")
              .length,
            film: !!active.screen,
          }
        : null,
  };
})();
