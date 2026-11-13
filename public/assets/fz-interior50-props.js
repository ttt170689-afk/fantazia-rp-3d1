/* Batched furniture plus a small set of animated parts owned by the current visit. */
(function () {
  "use strict";
  const { C } = FZBuildingKit;
  function action(k, title, x, z, command, data = {}) {
    return k.action(title, x, z, "interior50", { command50: command, ...data });
  }
  function device(k, type, id, x, z, visual) {
    const item = {
      id,
      state: FZInterior50Policy.device(type),
      floor: k.current,
      visual,
    };
    k.devices50.push(item);
    action(k, FZInterior50Policy.devices[type].title, x, z, "device", {
      device50: item,
      range: 1.8,
    });
    return item;
  }
  function booklet(k, title, id, x, z, color = C.blue) {
    k.box(0.6, 0.045, 0.8, x, 1.33, z, color);
    k.box(0.5, 0.02, 0.7, x, 1.36, z, 0xe7e1d4);
    for (let i = 0; i < 4; i++)
      k.box(0.34, 0.008, 0.018, x, 1.375, z - 0.2 + i * 0.12, C.metal);
    action(k, title, x, z + 1.6, "document", { document50: id });
  }
  function floorTiles(k, rect, color, spacing = 2) {
    const [left, top, right, bottom] = rect;
    for (let x = left; x <= right; x += spacing)
      k.box(0.018, 0.008, bottom - top, x, 0.012, (top + bottom) / 2, color);
    for (let z = top; z <= bottom; z += spacing)
      k.box(right - left, 0.008, 0.018, (left + right) / 2, 0.012, z, color);
  }
  function skirting(k, rect, color = 0x66727b) {
    const [left, top, right, bottom] = rect;
    for (const x of [left, right])
      k.box(0.08, 0.2, bottom - top, x, 0.1, (top + bottom) / 2, color);
    k.box(right - left, 0.2, 0.08, (left + right) / 2, 0.1, top, color);
  }
  function queuePost(k, x, z) {
    k.cyl(0.23, 0.08, x, 0.04, z, C.metal);
    k.cyl(0.05, 1.1, x, 0.6, z, C.metal);
    k.cyl(0.12, 0.15, x, 1.2, z, C.blue);
  }
  function counter(k, x, number, title) {
    k.box(6.2, 1.2, 1.5, x, 0.6, -4, 0x516579, true);
    k.box(6.5, 0.14, 1.7, x, 1.27, -4, 0xc1b5a1);
    k.box(5.8, 0.06, 0.05, x, 0.25, -3.22, 0xb2a681);
    k.box(5.8, 0.06, 0.05, x, 1.03, -3.22, 0xb2a681);
    // A transaction slot remains visually open below the protective partition.
    for (const dx of [-2.8, 2.8])
      k.box(0.07, 1.55, 0.07, x + dx, 2.1, -3.8, C.metal);
    k.box(5.6, 0.08, 0.08, x, 2.85, -3.8, C.metal);
    k.box(2.1, 1.1, 0.04, x - 1.65, 2.2, -3.8, 0x7c9ba5);
    k.box(2.1, 1.1, 0.04, x + 1.65, 2.2, -3.8, 0x7c9ba5);
    k.box(1.15, 0.035, 0.6, x, 1.37, -3.75, C.metal);
    k.box(0.8, 0.025, 0.4, x, 1.4, -3.7, 0x293b4d);
    k.box(0.95, 0.6, 0.08, x + 1.7, 1.78, -4.2, C.dark);
    k.box(0.78, 0.4, 0.02, x + 1.7, 1.8, -4.26, 0x5c858a);
    k.box(0.12, 0.3, 0.12, x + 1.7, 1.45, -4.2, C.metal);
    k.box(0.7, 0.045, 0.3, x + 1.7, 1.38, -4.55, C.metal);
    k.cyl(0.08, 0.1, x - 1, 1.39, -3.55, C.dark);
    k.box(0.025, 0.33, 0.025, x - 1, 1.58, -3.55, C.metal);
    k.sign("ОКНО " + number + " · " + title, x, 3.8, -4, 6, 0.55);
    k.staffMember(
      "Операционист · окно " + number,
      x,
      -6.7,
      "talk",
      "Получите талон у входа и дождитесь приглашения на табло.",
    );
    action(k, "Окно " + number + " — " + title, x, -1.8, "teller", {
      window50: number,
    });
    // Avoid duplicate actions behind a counter that could bypass the queue.
    k.actions = k.actions.filter(
      (a) => !(a.kind === "talk" && a.name === "Операционист · окно " + number),
    );
    for (const dx of [-2.6, 2.6]) {
      queuePost(k, x + dx, -0.1);
      queuePost(k, x + dx, 3.3);
      k.box(0.04, 0.13, 3.4, x + dx, 1.15, 1.6, 0x596d80);
    }
    k.sign("ОЖИДАЙТЕ ЗА ЛИНИЕЙ", x, 0.04, 3.5, 4, 0.4).mesh.rotation.x =
      -Math.PI / 2;
  }
  function atm(k, x) {
    const z = 17.2;
    k.box(2.5, 3.5, 1.5, x, 1.75, z, 0x304960, true);
    k.box(2.25, 1.35, 0.06, x, 2.35, z + 0.79, 0x172d3c);
    k.box(1.55, 0.85, 0.04, x, 2.42, z + 0.84, 0x75a9ac);
    k.box(1.6, 0.1, 0.55, x, 1.55, z + 0.9, C.metal);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++)
        k.box(
          0.18,
          0.035,
          0.08,
          x - 0.3 + col * 0.3,
          1.62,
          z + 0.7 + row * 0.13,
          C.dark,
        );
    }
    k.box(1.3, 0.18, 0.08, x, 0.9, z + 0.8, C.dark);
    k.box(0.8, 0.07, 0.08, x, 1.86, z + 0.8, C.dark);
    k.sign("БАНКОМАТ", x, 3.15, z + 0.8, 2.1, 0.32);
    action(k, "Банкомат — игровой счёт", x, 19.8, "atm");
  }
  function terminal(k, x, z) {
    k.box(0.9, 1.15, 0.7, x, 0.575, z, C.blue, true);
    k.box(1.15, 0.8, 0.1, x, 1.65, z + 0.1, C.dark);
    k.box(0.95, 0.6, 0.04, x, 1.65, z + 0.17, 0x81aeb2);
    k.box(0.55, 0.08, 0.05, x, 1.06, z + 0.38, C.dark);
    k.box(0.35, 0.025, 0.3, x, 1.03, z + 0.5, 0xebe4d8);
    k.sign("ТАЛОН · ВЫБОР УСЛУГИ", x, 2.7, z, 5, 0.48);
    action(k, "Терминал электронной очереди", x, z + 1.9, "queue");
  }
  function cooler(k, x, z) {
    k.box(0.9, 1.5, 0.8, x, 0.75, z, 0xd4d9d7, true);
    k.cyl(0.34, 0.8, x, 1.88, z, 0x7c9fac);
    k.cyl(0.14, 0.15, x, 1.45, z, C.blue);
    k.box(0.6, 0.5, 0.06, x, 1.1, z + 0.43, C.dark);
    for (const dx of [-0.15, 0.15])
      k.box(0.09, 0.1, 0.13, x + dx, 1.28, z + 0.5, dx < 0 ? C.blue : C.red);
    k.box(0.68, 0.04, 0.27, x, 0.8, z + 0.51, C.metal);
    action(k, "Кулер — стакан воды", x, z + 1.6, "water");
  }
  function printer(k, x, z) {
    k.box(1.1, 0.5, 0.8, x, 1.55, z, 0xc4cccd);
    k.box(0.7, 0.07, 0.5, x, 1.84, z - 0.05, C.dark);
    k.box(0.55, 0.04, 0.45, x, 1.9, z - 0.1, 0xf0eadd);
    k.box(0.7, 0.06, 0.3, x, 1.4, z + 0.43, C.dark);
    k.box(0.5, 0.02, 0.35, x, 1.44, z + 0.4, 0xf0eadd);
  }
  function filingCabinet(k, x, z) {
    k.box(2, 3, 0.8, x, 1.5, z, 0x7c8991, true);
    for (let row = 0; row < 5; row++) {
      k.box(1.85, 0.48, 0.04, x, 0.3 + row * 0.57, z + 0.43, 0xa0adb1);
      k.box(0.5, 0.05, 0.09, x, 0.34 + row * 0.57, z + 0.48, C.dark);
      k.box(0.37, 0.1, 0.015, x - 0.55, 0.28 + row * 0.57, z + 0.46, 0xe2d9bf);
    }
  }
  function secureDoor(k, x, title, command) {
    k.box(3.2, 4, 0.3, x, 2, -10, 0x34414c, true);
    k.box(2.8, 3.5, 0.14, x, 1.9, -9.78, 0x849098);
    k.box(2.5, 3.1, 0.06, x, 1.9, -9.68, 0x657580);
    k.box(0.18, 0.65, 0.2, x + 0.85, 1.8, -9.55, 0xc2b68e);
    for (const dx of [-1.1, 1.1])
      for (const y of [0.65, 3.2])
        k.box(0.12, 0.12, 0.1, x + dx, y, -9.58, C.metal);
    k.sign(title, x, 4.3, -9.7, 9, 0.55);
    action(k, title, x, -8, command);
  }
  function noticeBoard(k, x, z, title, documentId) {
    k.box(3.4, 2.1, 0.12, x, 2.4, z, C.wood);
    k.box(3.15, 1.86, 0.04, x, 2.4, z + 0.09, 0x798b85);
    for (const dx of [-0.95, 0, 0.95]) {
      k.box(0.7, 1.2, 0.02, x + dx, 2.35, z + 0.12, 0xe8e1cf);
      for (let row = 0; row < 4; row++)
        k.box(0.5, 0.035, 0.015, x + dx, 2.7 - row * 0.22, z + 0.14, 0x77858a);
    }
    k.sign(title, x, 3.8, z + 0.1, 5, 0.4);
    action(k, title, x, z + 1.8, "document", { document50: documentId });
  }
  function shoeCabinet(k, x, z, id, color) {
    k.box(1.8, 1.4, 0.7, x, 0.7, z, color, true);
    k.box(1.65, 1.2, 0.06, x, 0.7, z + 0.38, C.dark);
    const pivot = new THREE.Group();
    pivot.position.set(x - 0.84, 0, z + 0.43);
    k.groups[k.current].add(pivot);
    k.moving(1.68, 1.2, 0.06, 0.84, 0.7, 0, color, pivot);
    k.moving(0.09, 0.25, 0.1, 1.5, 0.8, 0.07, C.metal, pivot);
    device(k, "cabinet", id, x, z + 1.8, { pivot });
  }
  function fridgeBody(k, x, z) {
    // A hollow cabinet rather than a solid block behind the opening door.
    k.collider(x, z, 1.25, 1.25, 0, 2.8);
    for (const dx of [-0.59, 0.59])
      k.box(0.08, 2.8, 1.25, x + dx, 1.4, z, 0xdbe0e1);
    k.box(1.25, 2.8, 0.08, x, 1.4, z - 0.59, 0xdbe0e1);
    for (const y of [0.06, 0.72, 1.4, 2.1, 2.75])
      k.box(1.15, 0.06, 1.15, x, y, z, 0xe6e9e1);
    for (const dx of [-0.3, 0.2]) {
      k.cyl(0.12, 0.35, x + dx, 0.93, z + 0.12, 0x81a4af);
      k.box(0.25, 0.35, 0.25, x + dx, 1.6, z, 0xa6ab76);
    }
  }
  function homeDevices(k, x, id, profile) {
    // The original appliance bodies remain; moving faces and water are separate.
    const tv = k.moving(3.2, 1.55, 0.025, x - 3, 2, -10.59, 0x405e68);
    tv.material = k.mat(0x405e68, true);
    tv.visible = false;
    device(k, "television", id + ":tv", x - 4.5, -8.8, { mesh: tv });
    const flow = k.moving(0.045, 0.42, 0.045, x - 6, 1.33, 5.02, 0x89b7c4);
    flow.visible = false;
    device(k, "tap", id + ":tap", x - 6, 3.4, { mesh: flow });
    const droplets = new THREE.Group();
    for (const dx of [-0.17, 0, 0.17])
      for (const dz of [-0.14, 0.14]) {
        k.moving(
          0.025,
          1.6,
          0.025,
          x + 3.3 + dx,
          1.7,
          -20.7 + dz,
          0x8dbac8,
          droplets,
        );
      }
    k.groups[k.current].add(droplets);
    droplets.visible = false;
    device(k, "shower", id + ":shower", x + 5.5, -18.2, { mesh: droplets });
    k.box(1.8, 0.35, 1.4, x - 4.65, 3.4, 5, 0x8d9c9f);
    k.box(0.6, 1.3, 0.65, x - 4.65, 4.1, 4.7, 0x9fa9a9);
    const fan = new THREE.Group();
    fan.position.set(x - 4.65, 3.19, 5);
    k.groups[k.current].add(fan);
    for (const rotation of [0, Math.PI / 2]) {
      const blade = k.moving(0.95, 0.025, 0.14, 0, 0, 0, C.dark, fan);
      blade.rotation.y = rotation;
    }
    device(k, "cooker", id + ":fan", x - 4.65, 3.4, { rotor: fan });
    const fridgeDoor = new THREE.Group();
    fridgeDoor.position.set(x - 2.2, 0, 5.7);
    k.groups[k.current].add(fridgeDoor);
    k.moving(1.2, 2.65, 0.06, 0.6, 1.4, 0, 0xd8dfdf, fridgeDoor);
    k.moving(0.06, 0.7, 0.08, 1.08, 1.8, 0.07, C.metal, fridgeDoor);
    device(k, "refrigerator", id + ":fridge", x - 2.8, 6.8, {
      pivot: fridgeDoor,
    });
    // Compact writing shelf avoids the bed, bathroom doorway and central corridor.
    k.box(2.6, 0.13, 1, x - 7.2, 1.25, -14, profile.accent, true);
    for (const dx of [-1.1, 1.1])
      k.box(0.08, 1.2, 0.8, x - 7.2 + dx, 0.6, -14, C.metal);
    k.cyl(0.18, 0.05, x - 7.8, 1.35, -14, C.dark);
    k.box(0.05, 0.55, 0.05, x - 7.8, 1.65, -14, C.metal);
    k.box(0.6, 0.12, 0.4, x - 7.8, 1.95, -14, profile.accent);
    const bulb = k.moving(0.45, 0.025, 0.28, x - 7.8, 1.88, -14, 0xffdfa2);
    bulb.material = k.mat(0xffdfa2, true);
    bulb.visible = false;
    device(k, "desk", id + ":desk", x - 7.2, -12.5, { mesh: bulb });
    k.box(0.7, 0.04, 0.6, x - 6.7, 1.35, -14, 0xe7dfca);
    k.sign(profile.book, x - 7.2, 2.5, -14.5, 3, 0.32);
    action(k, profile.book, x - 7.2, -12.5, "profile", { profile50: profile });
  }
  function towelRack(k, x, z, color) {
    k.box(1.4, 0.06, 0.1, x, 1.9, z, C.metal);
    k.box(0.85, 0.8, 0.05, x, 1.52, z + 0.08, color);
    k.box(0.85, 0.06, 0.015, x, 1.18, z + 0.12, 0xe2dbce);
  }
  function wallVent(k, x, z) {
    k.box(0.8, 0.6, 0.06, x, 3.7, z, 0xd0d7d6);
    for (let i = 0; i < 5; i++)
      k.box(0.65, 0.03, 0.02, x, 3.5 + i * 0.1, z + 0.04, C.dark);
  }
  function coatStand(k, x, z, color) {
    k.cyl(0.35, 0.07, x, 0.035, z, C.dark);
    k.cyl(0.045, 2.5, x, 1.3, z, C.metal);
    k.box(0.9, 0.07, 0.07, x, 2.2, z, C.metal);
    k.box(0.55, 0.95, 0.1, x + 0.18, 1.7, z, color);
  }
  function liftIndicator(k, floor) {
    const sign = k.sign("ЛИФТ · 1", 19, 3.8, 13.75, 2.5, 0.55, Math.PI);
    k.liftDisplays50.push({ ...sign, floor, last: "" });
    action(k, "Лифт — инструкция", 23.8, 11.9, "document", {
      document50: "lift-rules",
    });
  }
  window.FZInterior50Props = {
    fridgeBody,
    action,
    device,
    booklet,
    floorTiles,
    skirting,
    queuePost,
    counter,
    atm,
    terminal,
    cooler,
    printer,
    filingCabinet,
    secureDoor,
    noticeBoard,
    shoeCabinet,
    homeDevices,
    towelRack,
    wallVent,
    coatStand,
    liftIndicator,
  };
})();
