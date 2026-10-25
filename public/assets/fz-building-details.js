/* Furnishing pass: lived-in entrances, usable switches/curtains, sanitation,
 * room labels and actual objects rather than a flat interior texture. */
(function () {
  "use strict";
  const { C } = FZBuildingKit;
  function entrance(k) {
    k.floor(0);
    for (const side of [-1, 1]) {
      k.box(1.45, 3.65, 0.12, side * 0.78, 1.825, 24.7, 0x446172);
      k.box(1.12, 2.4, 0.04, side * 0.78, 2.1, 24.6, 0x91b6c4);
      k.box(0.07, 0.8, 0.09, side * 0.2, 1.65, 24.5, 0xe2d1a4);
    }
    k.box(0.55, 0.85, 0.12, 2.3, 1.7, 24.7, C.dark);
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 3; col++)
        k.box(
          0.08,
          0.06,
          0.04,
          2.12 + col * 0.16,
          1.45 + row * 0.14,
          24.62,
          0xb4cad3,
        );
    k.sign("ДОМОФОН", 2.3, 2.4, 24.6, 1.6, 0.3, Math.PI);
    k.box(4, 0.025, 1.8, 0, 0.02, 22.7, 0x394350);
    // A patterned stone entry strip leaves every interaction path unobstructed.
    for (let i = 0; i < 20; i++)
      k.box(0.025, 0.009, 12, -12 + i * 1.2, 0.015, 16, 0x64717b);
    for (let z = 10; z < 23; z += 1.2)
      k.box(24, 0.009, 0.025, 0, 0.015, z, 0x64717b);
  }
  function clock(k, x, z) {
    k.cyl(0.6, 0.08, x, 3.8, z, C.dark);
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#e7e1d1";
    ctx.beginPath();
    ctx.arc(128, 128, 120, 0, 7);
    ctx.fill();
    ctx.strokeStyle = "#273448";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(128, 128);
    ctx.lineTo(128, 60);
    ctx.moveTo(128, 128);
    ctx.lineTo(183, 145);
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      ctx.fillStyle = "#273448";
      ctx.beginPath();
      ctx.arc(128 + 98 * Math.sin(a), 128 - 98 * Math.cos(a), 4, 0, 7);
      ctx.fill();
    }
    const tex = k.own(new THREE.CanvasTexture(c)),
      mat = k.own(new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    const mesh = new THREE.Mesh(k.own(new THREE.PlaneGeometry(1.2, 1.2)), mat);
    mesh.position.set(x, 3.8, z + 0.07);
    k.groups[k.current].add(mesh);
  }
  function radiator(k, x, z) {
    k.box(3, 0.08, 0.55, x, 0.2, z, C.metal);
    for (let i = 0; i < 11; i++)
      k.box(0.18, 1, 0.4, x - 1.3 + i * 0.26, 0.7, z, 0xd5d6ce);
    k.box(0.07, 1.25, 0.07, x + 1.65, 0.7, z, C.metal);
    k.box(0.3, 0.07, 0.07, x + 1.55, 1.3, z, C.metal);
  }
  function painting(k, x, z, title, color) {
    k.box(3.6, 2.1, 0.08, x, 2.9, z, C.wood);
    k.box(3.3, 1.8, 0.04, x, 2.9, z + 0.06, color);
    k.box(3.3, 0.6, 0.02, x, 2.3, z + 0.09, 0x516f59);
    k.box(0.55, 0.55, 0.02, x + 0.8, 3.25, z + 0.1, 0xebcd8d);
    k.sign(title, x, 1.6, z + 0.1, 3.2, 0.32);
  }
  function windowAndCurtain(k, x, z, id) {
    k.box(7.8, 2.65, 0.09, x, 3.25, z, 0xe1dfd6);
    k.box(7.4, 2.3, 0.045, x, 3.25, z + 0.07, 0x708eab);
    k.box(0.12, 2.5, 0.08, x, 3.25, z + 0.13, 0xdeddd6);
    k.box(7.6, 0.12, 0.08, x, 3.25, z + 0.13, 0xdeddd6);
    k.box(8, 0.15, 0.65, x, 1.86, z + 0.2, 0xdeddd6);
    k.box(8.4, 0.08, 0.08, x, 4.65, z + 0.3, C.metal);
    const left = k.moving(3.7, 2.6, 0.1, x - 2, 3.2, z + 0.4, 0x667d86),
      right = k.moving(3.7, 2.6, 0.1, x + 2, 3.2, z + 0.4, 0x667d86);
    const curtain = { id, left, right, x, open: true, amount: 1 };
    k.curtains.push(curtain);
    k.action("Шторы — открыть / закрыть", x, z + 3.8, "curtain", {
      curtain,
      range: 3,
    });
    radiator(k, x, z + 0.5);
  }
  function roomSwitch(k, x, z, id) {
    k.box(0.2, 0.35, 0.08, x, 1.65, z, 0xe8e3d7);
    k.box(0.13, 0.18, 0.04, x, 1.65, z + 0.06, C.dark);
    const lamp = new THREE.PointLight(0xffe3ad, 0.8, 17, 2);
    lamp.position.set(x, 4, z - 4);
    k.groups[k.current].add(lamp);
    const material = k.own(new THREE.MeshBasicMaterial({ color: 0xffdca0 }));
    const bulb = new THREE.Mesh(
      k.own(new THREE.SphereGeometry(0.18, 8, 6)),
      material,
    );
    bulb.position.copy(lamp.position);
    k.groups[k.current].add(bulb);
    const light = { id, lamp, bulb, on: true };
    k.switches.push(light);
    k.action("Свет — выключатель", x - 2, z - 1.5, "roomLight", { light });
  }
  function hallway(k, f) {
    // Skirting, number plates, service notices, mailbox slots and fire cabinet.
    for (const x of [-3.84, 3.84]) k.box(0.06, 0.18, 30, x, 0.09, -8, 0x5b666c);
    for (let z = -20; z < 5; z += 5)
      k.box(7.5, 0.014, 0.05, 0, 0.018, z, 0xb5b6af);
    k.box(1.6, 2, 0.28, 11, 1.8, 8.35, 0xa84440);
    k.sign("ПОЖАРНЫЙ ЩИТ", 11, 2.5, 8.52, 1.45, 0.25);
    k.box(1.1, 1.2, 0.04, 11, 1.55, 8.53, 0x5e747e);
    k.sign("ПЛАН ЭВАКУАЦИИ", -7, 3.4, 8.3, 5, 0.4);
    k.sign("ЛЕСТНИЦА ←   ВЫХОД: ЭТАЖ 1", -7, 2.8, 8.31, 7, 0.4);
    k.box(1.1, 0.3, 0.35, 24, 2.9, 22.8, C.dark);
    k.action("План эвакуации", -7, 10, "evacuation");
    if (f > 0)
      k.sign(
        "КВАРТИРЫ " + ((f + 1) * 100 + 1) + " / " + ((f + 1) * 100 + 2),
        0,
        3.9,
        -1,
        6,
        0.5,
      );
  }
  function home(k) {
    for (let f = 0; f < k.floors; f++) {
      k.floor(f);
      hallway(k, f);
      for (const side of [-1, 1]) {
        const x = side * 14,
          id = f + ":" + side;
        windowAndCurtain(k, x - 4, -24.55, id);
        roomSwitch(k, x + 6, 6.8, id);
        k.box(2.4, 0.5, 0.8, x + 6, 0.25, 5.6, C.wood, true);
        for (let i = 0; i < 3; i++) {
          k.box(0.3, 0.13, 0.5, x + 5.3 + i * 0.6, 0.58, 5.5, 0x343b46);
          k.box(0.3, 0.13, 0.5, x + 5.3 + i * 0.6, 0.58, 5.9, 0x343b46);
        }
        k.box(2.6, 0.12, 0.08, x + 6, 2.4, 7.55, C.wood);
        for (let i = 0; i < 4; i++)
          k.box(0.07, 0.2, 0.16, x + 5 + i * 0.65, 2.3, 7.45, C.metal);
        k.sign("ПРИХОЖАЯ", x + 6, 3.6, 7.6, 3, 0.4, Math.PI);
        k.sign("КУХНЯ", x - 4, 3.8, 6.9, 3, 0.4, Math.PI);
        k.sign("ГОСТИНАЯ", x, 4, -10.6, 5, 0.45);
        k.sign("СПАЛЬНЯ", x - 4, 4, -24.3, 4, 0.4);
        k.sign("ВАННАЯ", x + 7, 4, -24.3, 4, 0.4);
        k.box(1.3, 1.15, 1.1, x + 7.8, 0.575, -13, 0xd5d7d3, true);
        k.cyl(0.37, 0.1, x + 7.8, 0.6, -12.4, C.dark);
        k.sign("СТИРАЛЬНАЯ МАШИНА", x + 7.8, 1.6, -12.4, 2.6, 0.3);
        k.action("Стирка — запустить цикл", x + 7.8, -11.6, "laundry", {
          room: id,
          range: 1.8,
        });
        k.bin(x + 8, 2);
        painting(k, x - 7, -10.45, "ВЕЧЕР У РЕКИ", 0x7893aa);
        k.box(2.5, 0.015, 1.5, x, 0.02, -5.5, 0x9a7764);
        k.action(
          "Дверной звонок · " + ((f + 1) * 100 + (side < 0 ? 1 : 2)),
          side * 2.4,
          -6,
          "doorbell",
          { number: (f + 1) * 100 + (side < 0 ? 1 : 2) },
        );
      }
    }
    k.floor(0);
    clock(k, -7, 8.4);
  }
  function cinema(k) {
    k.floor(0);
    // Menu board above the snack bar; actual products have distinct shapes.
    k.sign("КИНОБАР · ПОПКОРН 35 · СОК 20 · ВОДА 10", -17, 4.2, 14.5, 15, 0.65);
    for (let row = 0; row < 2; row++)
      for (let i = 0; i < 4; i++) {
        k.box(0.5, 0.65, 0.5, -17 + i * 0.8, 1.6 + row * 0.7, 15.8, 0xb59b5a);
        k.box(
          0.44,
          0.08,
          0.44,
          -17 + i * 0.8,
          1.97 + row * 0.7,
          15.8,
          0xe9cc9a,
        );
      }
    k.box(2.2, 3.2, 1.1, -11, 1.6, 15.5, 0x34465c, true);
    k.box(1.9, 2.5, 0.05, -11, 1.85, 16.08, 0x7da2b5);
    for (let row = 0; row < 3; row++)
      for (let i = 0; i < 4; i++)
        k.cyl(
          0.12,
          0.5,
          -11.65 + i * 0.43,
          0.8 + row * 0.8,
          16.13,
          i % 2 ? 0xb37a47 : 0x79adb9,
        );
    k.sign("НАПИТКИ", -11, 3.6, 16, 3, 0.45);
    for (const x of [-13, 13]) {
      for (let row = 0; row < 5; row++)
        k.sign(
          "РЯД " + (row + 1),
          x - 9.5,
          1.4,
          -12 + row * 3.1,
          1.3,
          0.3,
          Math.PI / 2,
        );
      k.sign("ВЫХОД →", x - 9.2, 3, 4, 3, 0.5);
      k.box(1.1, 0.6, 0.7, x, 4.7, 3, C.dark);
      k.cyl(0.2, 0.15, x, 4.5, 2.6, 0x9cb5c2);
    }
    k.action("Расписание и правила", 0, 9, "cinemaInfo");
    painting(k, -6, 6.3, "ОРБИТА · ЗАЛ 1", 0x243c69);
    painting(k, 6, 6.3, "НОЧНОЙ ЭКСПРЕСС · ЗАЛ 2", 0x344a57);
    clock(k, 0, 6.5);
  }
  function civic(k) {
    for (let f = 0; f < k.floors; f++) {
      k.floor(f);
      k.sign("ИНФОРМАЦИЯ · ВЫХОД НА ПЕРВОМ ЭТАЖЕ", 0, 4.3, 8.3, 12, 0.55);
      for (const x of [-23, 23]) k.plant(x, 9);
      if (k.lift) hallway(k, f);
    }
    k.floor(0);
    k.action("Журнал посещения и чеки", 0, 20, "receipts");
    if (k.queueDisplay) {
      for (const x of [-9, 0, 9]) {
        k.box(0.6, 0.07, 0.4, x - 0.5, 1.35, -3.7, 0xe4d8bc);
        k.cyl(0.08, 0.18, x - 1.3, 1.4, -3.7, 0x293b4f);
        k.box(0.03, 0.32, 0.03, x - 1.3, 1.62, -3.7, C.metal);
      }
      k.sign("ПЕРСОНАЛЬНЫЕ ДАННЫЕ НЕ ЗАПРАШИВАЮТСЯ", 0, 4.1, 8.4, 14, 0.5);
    }
  }
  function decorate(k) {
    k.curtains = [];
    k.switches = [];
    entrance(k);
    if (["house", "apartment"].includes(k.type)) home(k);
    else if (k.type === "cinema") cinema(k);
    else civic(k);
    return k;
  }
  window.FZBuildingDetails = { decorate };
})();
