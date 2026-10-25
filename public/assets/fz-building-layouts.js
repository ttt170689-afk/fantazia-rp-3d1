/* Complete visit layouts. All doors, floors and actions use the same kit. */
(function () {
  "use strict";
  const { Kit, C } = FZBuildingKit;
  function perimeter(k) {
    k.box(0.3, k.FH, 50, -26, k.FH / 2, 0, k.wallColor, true);
    k.box(0.3, k.FH, 50, 26, k.FH / 2, 0, k.wallColor, true);
    k.wallZ(0, -25, 52);
    k.wallZ(0, 25, 52, [0, 3.2]);
    k.sign("ВЫХОД НА УЛИЦУ", 0, 3.7, 24.8, 5, 0.65, Math.PI);
    if (k.current === 0) k.action("Выйти на улицу", 0, 23, "exit");
    for (const x of [-22, -10, 10, 22]) k.ceilingLamp(x, 19);
  }
  function fullSlab(k) {
    k.box(52, 0.18, 50, 0, -0.09, 0, k.floorColor);
  }
  function circulationSlab(k) {
    k.box(52, 0.18, 34, 0, -0.09, -8, C.floor);
    k.box(29, 0.18, 16, 0.5, -0.09, 17, C.floor);
    k.box(12, 0.18, 1, -20, -0.09, 9.5, C.floor);
    k.box(12, 0.18, 3, -20, -0.09, 23.5, C.floor);
    k.box(11, 0.18, 4, 20.5, -0.09, 11, C.floor);
    k.box(11, 0.18, 2, 20.5, -0.09, 24, C.floor);
    k.box(3, 0.18, 10, 24.5, -0.09, 18, C.floor);
  }
  function stairs(k) {
    const f = k.current;
    if (f < k.floors - 1) {
      k.ramps.push({ floor: f, minX: -22, maxX: -16, minZ: 10, maxZ: 22 });
      for (let i = 0; i < 26; i++) {
        const h = ((i + 1) * k.FH) / 26,
          z = 22 - ((i + 0.5) * 12) / 26;
        k.box(6, 0.22, 12 / 26, -19, h - 0.11, z, 0xb5b8bc);
        k.box(5.8, 0.025, 0.045, -19, h + 0.015, z - 0.2, 0xe0cb8d);
        for (const x of [-22.4, -15.6]) {
          k.box(0.08, 1, 0.08, x, h + 0.5, z, C.metal);
          k.box(0.09, 0.09, 0.55, x, h + 1, z, C.metal);
        }
      }
    }
    for (const x of [-22.6, -15.4]) k.collider(x, 16, 0.35, 12, 0, k.FH);
    k.sign("ЛЕСТНИЦА · ЭТАЖ " + (f + 1), -19, 3.6, 23.8, 5, 0.55, Math.PI);
    k.box(0.12, 1.1, 12, -24, 0.55, 16, C.metal, true);
  }
  function lift(k) {
    const f = k.current,
      y = f * k.FH;
    k.box(0.3, k.FH, 10, 15.2, k.FH / 2, 18, C.metal, true);
    k.box(0.3, k.FH, 10, 22.8, k.FH / 2, 18, C.metal, true);
    k.box(7.6, k.FH, 0.3, 19, k.FH / 2, 23, C.metal, true);
    k.wallZ(19, 14, 7.6, [19, 2.8]);
    const a = k.moving(1.4, 3.7, 0.12, 18.3, 1.85, 14, 0x83919f),
      b = k.moving(1.4, 3.7, 0.12, 19.7, 1.85, 14, 0x83919f);
    const blocker = k.collider(19, 14, 2.8, 0.25, 0, 3.8, {
      lift: true,
      floor: f,
    });
    k.lift.gates.push({ a, b, floor: f, amount: f === 0 ? 1 : 0, blocker });
    k.sign("ЛИФТ · " + (f + 1), 19, 4.1, 13.8, 3, 0.5, Math.PI);
    k.box(0.4, 0.8, 0.12, 21, 1.6, 13.7, C.dark);
    k.action("Вызвать лифт", 20, 11.9, "liftCall", { destination: f });
    if (f === 0) {
      const cab = new THREE.Group();
      cab.position.set(19, 0, 18.5);
      k.root.add(cab);
      k.lift.cab = cab;
      k.moving(6.8, 0.2, 8, 0, -0.1, 0, C.dark, cab);
      for (const x of [-3.35, 3.35])
        k.moving(0.12, 4.4, 8, x, 2.2, 0, 0x9babb8, cab);
      k.moving(6.8, 4.4, 0.12, 0, 2.2, 3.9, 0x9babb8, cab);
      k.moving(6.8, 0.15, 8, 0, 4.4, 0, C.dark, cab);
      k.moving(3, 0.04, 2, 0, 4.3, 0, 0xffe4a5, cab);
      k.moving(4, 1.9, 0.04, 0, 2.2, 3.8, C.glass, cab);
      k.moving(5, 0.08, 0.08, 0, 1.25, 3.65, C.metal, cab);
      k.moving(0.1, 1.1, 0.6, 3.2, 1.8, -1, C.dark, cab);
      k.lift.panel = k.action("Лифт — выбрать этаж", 20.7, 17.5, "liftPanel", {
        liftPanel: true,
        range: 2.7,
      });
    }
  }
  function residential(type) {
    const k = new Kit(type, type === "house" ? 2 : 4);
    k.lift = {
      y: 0,
      from: 0,
      to: 0,
      phase: "open",
      elapsed: 0,
      gates: [],
      carry: false,
    };
    for (let f = 0; f < k.floors; f++) {
      k.floor(f);
      perimeter(k);
      circulationSlab(k);
      stairs(k);
      lift(k);
      k.wallZ(-15, 8, 22);
      k.wallZ(15, 8, 22);
      for (const side of [-1, 1])
        k.apartment(side, (f + 1) * 100 + (side < 0 ? 1 : 2));
      k.sign(
        "ЭТАЖ " +
          (f + 1) +
          " · КВАРТИРЫ " +
          ((f + 1) * 100 + 1) +
          "–" +
          ((f + 1) * 100 + 2),
        0,
        4,
        -24.8,
        7,
        0.65,
      );
      k.bin(10, 21);
      k.bin(12, 21, true);
      k.plant(7, 10);
      if (f === 0) {
        k.desk(-8, 18, 5);
        k.staffMember("Консьержка", -8, 16, "concierge");
        k.action("Консьержка — справочная", -8, 20, "concierge");
        k.sign("ПОДЪЕЗД №1 · FANTAZIA RESIDENCE", 0, 4.3, 8.2, 10, 0.7);
        for (let row = 0; row < 2; row++)
          for (let i = 0; i < 4; i++) {
            k.box(0.8, 0.5, 0.35, 5 + i * 0.9, 1.2 + row * 0.6, 8.4, C.metal);
            k.sign(
              String((i + 1) * 100 + row + 1),
              5 + i * 0.9,
              1.2 + row * 0.6,
              8.6,
              0.7,
              0.25,
            );
          }
        k.action("Почтовые ящики", 6, 10, "mail");
        k.sign(
          "ТИШИНА ПОСЛЕ 22:00 · МУСОР В КОНТЕЙНЕР",
          -8,
          3.9,
          8.2,
          10,
          0.55,
        );
        k.action("Домофон — справочник квартир", 0, 20, "directory");
      } else {
        k.bench(-7, 19, Math.PI, 3);
        k.sign("ЛИФТ →", 6, 3.2, 8.2, 3, 0.55);
      }
    }
    k.floor(k.floors - 1);
    k.box(52, 0.18, 50, 0, k.FH, 0, C.wall);
    FZBuildingDetails.decorate(k);
    return k.finish();
  }
  function hall(k, side, title, film) {
    const x = side * 13;
    k.wallZ(x, 6, 22, [x, 2.8]);
    k.door(x, 6, "z", title, true);
    k.wallX(side * 2, -9.5, 31);
    for (let row = 0; row < 5; row++)
      for (const dx of [-7, -5.5, -4, 4, 5.5, 7])
        k.seat(
          x + dx,
          -12 + row * 3.1,
          Math.PI,
          title +
            " · ряд " +
            (row + 1) +
            " · место " +
            (dx < 0
              ? Math.round((dx + 7) / 1.5) + 1
              : Math.round((dx - 4) / 1.5) + 4),
          C.red,
        );
    for (const dx of [-1.5, 1.5])
      for (let z = -15; z < 4; z += 1.4)
        k.box(0.08, 0.025, 0.4, x + dx, 0.03, z, 0x8ccbd8);
    k.box(14.8, 8.4, 0.25, x, 4.5, -23.5, C.dark);
    const screen = k.sign(title + " · " + film, x, 4.5, -23.3, 14.222222, 8);
    k.screens.push({ screen, film, side, time: 0, paused: false });
    k.action(title + " — программа и пауза", x + 9, 4, "film", {
      screen: k.screens.length - 1,
    });
    k.sign("ПРОХОД НЕ ЗАНИМАТЬ", x, 4.5, 5.8, 6, 0.5, Math.PI);
  }
  function cinema() {
    const k = new Kit("cinema", 1);
    k.FH = 9;
    perimeter(k);
    fullSlab(k);
    k.box(52, 0.2, 50, 0, k.FH, 0, C.dark);
    hall(k, -1, "ЗАЛ 1", "Орбита");
    hall(k, 1, "ЗАЛ 2", "Ночной экспресс");
    k.sign("FANTAZIA CINEMA · ФОЙЕ", 0, 4.5, 6.3, 14, 0.7);
    k.desk(-17, 16, 9);
    k.staffMember("Продавец снеков", -17, 14, "snacks");
    k.action("Попкорн, напитки и снеки", -17, 18, "snacks");
    for (let i = 0; i < 4; i++) {
      k.cyl(0.25, 0.65, -20 + i * 0.75, 1.62, 16, 0xb94a47);
      k.cyl(0.27, 0.05, -20 + i * 0.75, 1.98, 16, 0xead3a3);
      k.box(0.08, 0.7, 0.08, -20 + i * 0.75, 2.2, 16, 0xe7dfbc);
    }
    k.box(2.6, 2.8, 1.1, -23, 1.4, 15, C.red, true);
    k.sign("ПОПКОРН", -23, 2.7, 15.6, 2.3, 0.4);
    k.box(2.2, 1.5, 0.05, -23, 1.7, 15.58, 0xdec190);
    k.desk(8, 16, 6);
    k.staffMember("Билетный кассир", 8, 14, "tickets");
    k.action("Касса — билеты и сеансы", 8, 18, "tickets");
    k.sign("СЕАНСЫ: ОРБИТА / НОЧНОЙ ЭКСПРЕСС", 8, 3.7, 14.5, 11, 0.7);
    k.bench(-7, 21, Math.PI, 3);
    k.bench(16, 21, Math.PI, 3);
    k.bin(-11, 22);
    k.bin(23, 22);
    k.plant(-2, 9);
    k.plant(2, 9);
    k.action("Мои снеки и билеты", 0, 22, "bag");
    FZBuildingDetails.decorate(k);
    return k.finish();
  }
  function bank(type) {
    const k = new Kit(type, 1);
    perimeter(k);
    fullSlab(k);
    k.box(52, 0.2, 50, 0, k.FH, 0, C.wall);
    k.sign("FANTAZIA BANK · ОБСЛУЖИВАНИЕ", 0, 4.3, -24.7, 15, 0.8);
    k.wallZ(0, -9, 52, [-18, 3]);
    k.door(-18, -9, "z", "Консультационные кабинеты", true);
    for (let i = 0; i < 3; i++) {
      const x = -9 + i * 9;
      k.desk(x, -4, 6.2);
      k.staffMember("Операционист " + (i + 1), x, -6, "bank");
      k.action("Окно " + (i + 1) + " — обслуживание", x, -2, "bank", {
        window: i + 1,
      });
      k.sign("ОКНО " + (i + 1), x, 3.8, -4, 4, 0.55);
      if (i < 2) k.box(0.12, 2.6, 3.5, x + 4.3, 1.3, -4, C.glass, true);
    }
    k.desk(-16, -18, 5);
    k.staffMember("Кредитный консультант", -16, -20, "bank");
    k.action("Консультация по кредиту", -16, -16, "bank");
    k.wallX(-5, -17, 16, [-17, 2.8]);
    k.door(-5, -17, "x", "Переговорная", true);
    k.desk(2, -18, 5);
    k.seat(2, -15, Math.PI);
    k.seat(5, -15, Math.PI);
    k.box(5, 4, 0.3, 19, 2, -23.8, C.metal, true);
    k.sign("ХРАНИЛИЩЕ · ДОСТУП СОТРУДНИКОВ", 19, 4.4, -23.5, 10, 0.5);
    k.action("Служебная зона", 19, -21, "talk", {
      text: "Хранилище закрыто. Клиентские операции выполняются у операционистов.",
    });
    for (const x of [-18, 18])
      for (const z of [7, 10, 13])
        k.seat(x, z, x < 0 ? Math.PI / 2 : -Math.PI / 2, "Место ожидания");
    for (const x of [-23, 23]) {
      k.box(2, 3.2, 1, x, 1.6, 19, C.dark, true);
      k.sign("БАНКОМАТ", x, 2.65, 19.55, 1.8, 0.4);
      k.sign("СЧЁТ · ВКЛАД", x, 1.8, 19.56, 1.8, 0.6);
      k.action("Банкомат — мой счёт", x, 21, "bank");
    }
    k.box(0.9, 1.3, 0.7, 5, 0.65, 17, C.blue, true);
    k.sign("ВЗЯТЬ ТАЛОН", 5, 1.9, 17.4, 3, 0.45);
    k.action("Электронная очередь", 5, 19, "queue");
    k.queueDisplay = k.sign("ОЖИДАНИЕ · ТАЛОНЫ У ВХОДА", 0, 4, 1, 12, 0.75);
    k.desk(-7, 18, 4);
    k.staffMember("Администратор банка", -7, 16, "queue");
    k.action("Помощь с талоном", -7, 20, "queue");
    k.bin(12, 22);
    k.plant(-3, 10);
    FZBuildingDetails.decorate(k);
    return k.finish();
  }
  function courtroom(k, x, title, judge) {
    k.wallZ(x, 6, 22, [x, 2.8]);
    k.door(x, 6, "z", title, true);
    k.desk(x, -18, 8);
    k.staffMember(judge, x, -20, "hearing");
    k.sign("СУД FANTAZIA", x, 4.2, -24.7, 10, 0.6);
    k.desk(x - 5, -11, 3);
    k.desk(x + 5, -11, 3);
    for (let row = 0; row < 3; row++)
      for (const dx of [-6, -4.6, -3.2, 3.2, 4.6, 6])
        k.seat(x + dx, -3 + row * 2.8, Math.PI, "Место слушателя", C.wood);
    k.action(title + " — начать слушание", x, -8, "hearing");
    k.box(18, 0.12, 0.12, x, 1.1, -7, C.wood, true);
    k.action("Судебный секретарь — материалы", x - 8, 3, "cases");
  }
  function court(type) {
    const k = new Kit(type, 1);
    perimeter(k);
    fullSlab(k);
    k.box(52, 0.2, 50, 0, k.FH, 0, C.wall);
    k.wallX(0, -9.5, 31);
    courtroom(k, -13, "ЗАЛ СУДА №1", "Судья");
    courtroom(k, 13, "ЗАЛ СУДА №2", "Мировой судья");
    k.sign("СУД · КАНЦЕЛЯРИЯ · ЗАЛЫ 1 И 2", 0, 4.4, 6.2, 14, 0.7);
    k.desk(-9, 16, 6);
    k.staffMember("Секретарь канцелярии", -9, 14, "cases");
    k.action("Канцелярия — дела и заявления", -9, 18, "cases");
    k.desk(10, 16, 6);
    k.staffMember(
      "Судебный пристав",
      10,
      14,
      "talk",
      "Проход свободный. Слушания здесь игровые, решения не имеют юридической силы.",
    );
    k.bench(0, 19, Math.PI, 4);
    k.bin(21, 22);
    k.plant(-23, 10);
    k.plant(23, 10);
    FZBuildingDetails.decorate(k);
    return k.finish();
  }
  function service(type) {
    const clinic = type === "hospital",
      k = new Kit(type, 2);
    k.lift = {
      y: 0,
      from: 0,
      to: 0,
      phase: "open",
      elapsed: 0,
      gates: [],
      carry: false,
    };
    for (let f = 0; f < 2; f++) {
      k.floor(f);
      perimeter(k);
      circulationSlab(k);
      stairs(k);
      lift(k);
      for (const x of [-13, 13]) {
        k.wallX(x < 0 ? -4 : 4, -8, 30, [-4, 2.8]);
        k.door(
          x < 0 ? -4 : 4,
          -4,
          "x",
          (clinic ? "КАБИНЕТ " : "ОФИС ") + ((f + 1) * 100 + (x < 0 ? 1 : 2)),
          true,
        );
        k.desk(x, -15, 5);
        k.staffMember(
          clinic ? "Врач" : "Менеджер",
          x,
          -17,
          clinic ? "clinic" : "office",
        );
        k.action(
          clinic ? "Приём врача" : "Рабочее место",
          x,
          -13,
          clinic ? "clinic" : "office",
        );
        k.seat(x, -11, Math.PI);
        k.bookcase(x - 7, -22);
        k.plant(x + 7, 4);
        if (clinic) {
          k.bed(x + 6, -17);
          k.sign("ПРИЁМ · ОСМОТР", x, 4, -24.7, 8, 0.6);
        } else {
          k.desk(x + 6, -3);
          k.seat(x + 6, -0.5, Math.PI);
          k.wardrobe(x - 7, -5);
        }
      }
      k.wallZ(-15, 8, 22);
      k.wallZ(15, 8, 22);
      if (f === 0) {
        k.desk(-7, 18, 5);
        k.staffMember(
          clinic ? "Регистратор" : "Секретарь",
          -7,
          16,
          "directory",
        );
        k.action("Стойка информации", -7, 20, "directory");
      }
      k.bench(6, 18, Math.PI, 4);
      k.bin(11, 22);
    }
    k.floor(1);
    k.box(52, 0.18, 50, 0, k.FH, 0, C.wall);
    FZBuildingDetails.decorate(k);
    return k.finish();
  }
  window.FZBuildingLayouts = {
    create(type, name) {
      if (type === "apartment" || type === "house") return residential(type);
      if (type === "cinema") return cinema();
      if (type === "bank" || type === "biz_bank") return bank(type);
      if (type === "court" || (type === "office" && /суд/i.test(name)))
        return court(type);
      if (type === "hospital" || type === "office") return service(type);
      return null;
    },
    supports: (type) =>
      [
        "house",
        "apartment",
        "cinema",
        "bank",
        "biz_bank",
        "court",
        "office",
        "hospital",
      ].includes(type),
  };
})();
