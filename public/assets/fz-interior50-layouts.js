/* Purpose-built bank and residential finishing. Other venue layouts remain untouched. */
(function () {
  "use strict";
  const { Kit, C } = FZBuildingKit;
  const P = FZInterior50Props;
  function prepare(k) {
    k.devices50 = [];
    k.liftDisplays50 = [];
    k.rooms50 = FZInterior50Catalog.rooms(k.type, k.floors);
    k.interior50 = true;
    k.curtains = k.curtains || [];
    k.switches = k.switches || [];
  }
  function shell(k) {
    k.box(52, 0.18, 50, 0, -0.09, 0, 0x8c9290);
    k.box(52, 0.18, 50, 0, k.FH, 0, 0xd4d9d5);
    for (const x of [-26, 26])
      k.box(0.3, k.FH, 50, x, k.FH / 2, 0, C.wall, true);
    k.wallZ(0, -25, 52);
    k.wallZ(0, 25, 52, [0, 3.2]);
    for (const x of [-18, -6, 6, 18]) {
      for (const z of [-18, -2, 12, 21]) k.ceilingLamp(x, z);
    }
    P.skirting(k, [-25.7, -24.7, 25.7, 24.7]);
    P.floorTiles(k, [-25.6, -24.6, 25.6, 24.6], 0xa9aeaa);
    for (const x of [-1.65, 1.65]) k.box(0.12, 4, 0.25, x, 2, 24.8, C.metal);
    k.box(3.3, 0.12, 0.25, 0, 4, 24.8, C.metal);
    k.box(4.2, 0.025, 2, 0, 0.025, 22.7, 0x3d515c);
    k.sign("ВЫХОД НА УЛИЦУ", 0, 4.3, 24.7, 5, 0.5, Math.PI);
    k.action("Выйти на улицу", 0, 23, "exit");
    P.action(k, "План отделения", 2.8, 21, "map");
  }
  function officeRoom(k, x, meeting) {
    k.wallZ(x, -10, 12, [x, 2.8]);
    k.door(x, -10, "z", meeting ? "ПЕРЕГОВОРНАЯ" : "КОНСУЛЬТАНТ", true);
    k.desk(x, -18, meeting ? 6 : 4.5);
    if (meeting) {
      for (const dx of [-1.8, 1.8]) {
        k.seat(x + dx, -15.8, Math.PI, "Переговорная — сесть");
        k.seat(x + dx, -20.2, 0, "Переговорная — сесть");
      }
      P.noticeBoard(k, x, -24.6, "УСЛУГИ ОТДЕЛЕНИЯ", "bank-services");
      P.action(k, "Обсудить услуги банка", x, -13, "consultation");
    } else {
      k.staffMember(
        "Консультант",
        x,
        -20,
        "talk",
        "Здесь можно узнать об услугах без оформления кредита.",
      );
      k.actions = k.actions.filter(
        (a) => !(a.kind === "talk" && a.name === "Консультант"),
      );
      P.action(k, "Консультант — задать вопрос", x, -15.5, "consultation");
      k.seat(x - 2, -15, Math.PI, "Кресло посетителя");
      P.printer(k, x + 1.2, -18);
      P.filingCabinet(k, x - 4, -23.5);
      P.coatStand(k, x + 4.5, -22, C.blue);
    }
    k.plant(x + 4, -12.4);
    k.sign(
      meeting ? "ОБСУЖДЕНИЕ БЕЗ СПИСАНИЙ" : "КОНСУЛЬТАЦИЯ БЕСПЛАТНА",
      x,
      4.1,
      -24.6,
      9,
      0.5,
    );
  }
  function staffRooms(k) {
    for (const x of [6, 18]) {
      k.wallZ(x, -10, 12, [x, 3.2]);
      P.secureDoor(
        k,
        x,
        x === 6 ? "АРХИВ · СЛУЖЕБНОЕ" : "ХРАНИЛИЩЕ · ЗАКРЫТО",
        "restricted",
      );
    }
    // Full geometry exists behind the doors but no client interaction or privilege grant.
    for (const x of [2, 6, 10]) P.filingCabinet(k, x, -23.5);
    k.desk(6, -17, 4);
    P.printer(k, 6, -17);
    k.box(10, 0.04, 10, 18, 0.04, -18, 0x5b686d);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 6; col++) {
        const x = 14.2 + col * 1.5;
        const y = 0.6 + row * 0.8;
        k.box(1.35, 0.7, 1.1, x, y, -23.6, 0x8f989b);
        k.box(0.5, 0.06, 0.08, x, y, -22.98, C.dark);
      }
    }
    k.box(5, 0.16, 2, 18, 1.2, -17, C.metal, true);
    for (const x of [16, 20]) k.box(0.12, 1.2, 1.8, x, 0.6, -17, C.metal);
  }
  function bank(type) {
    const k = new Kit(type, 1);
    prepare(k);
    shell(k);
    for (const x of [-12, 0, 12]) k.wallX(x, -17.5, 15);
    officeRoom(k, -18, false);
    officeRoom(k, -6, true);
    staffRooms(k);
    // Seal the final two metres to the perimeter: no bypass around staff rooms.
    k.wallZ(-25, -10, 2);
    k.wallZ(25, -10, 2);
    P.counter(k, -9, 1, "КАССА");
    P.counter(k, 0, 2, "СЧЁТ");
    P.counter(k, 9, 3, "КОНСУЛЬТАЦИЯ");
    for (const x of [-19, 19]) {
      for (const z of [5, 8, 11])
        k.seat(
          x,
          z,
          x < 0 ? Math.PI / 2 : -Math.PI / 2,
          "Зал ожидания — сесть",
          0x617b85,
        );
    }
    P.atm(k, -21);
    P.atm(k, 21);
    P.terminal(k, 5, 17);
    k.desk(-7, 18, 4.5);
    k.staffMember(
      "Администратор отделения",
      -7,
      16,
      "talk",
      "Выберите услугу у терминала справа.",
    );
    k.actions = k.actions.filter(
      (a) => !(a.kind === "talk" && a.name === "Администратор отделения"),
    );
    P.action(k, "Администратор — услуги и очередь", -7, 20, "queue");
    P.booklet(k, "Памятка посетителю", "bank-services", -8.3, 18);
    P.cooler(k, -22, -3);
    P.noticeBoard(k, 21, -8.8, "БЕЗОПАСНОСТЬ", "bank-safety");
    k.sign("FANTAZIA BANK", 0, 4.65, -9.7, 14, 0.65);
    k.queueDisplay50 = k.sign("ВЫБЕРИТЕ УСЛУГУ У ВХОДА", 0, 4.1, 1, 12, 0.65);
    k.sign(
      "БАНКОМАТЫ ПО ОБЕИМ СТОРОНАМ ОТ ВХОДА",
      0,
      4.3,
      24.6,
      16,
      0.5,
      Math.PI,
    );
    k.sign("КОНСУЛЬТАНТ ←   ПЕРЕГОВОРНАЯ ←", -16, 4.4, -7, 14, 0.5);
    k.bin(-13, 21.5);
    k.bin(13, 21.5, true);
    for (const x of [-24, 24]) k.plant(x, 13);
    P.action(k, "Журнал обслуживания", 0, 18, "history");
    return k.finish();
  }
  function residential(k) {
    if (!["house", "apartment"].includes(k.type)) return;
    prepare(k);
    for (let f = 0; f < k.floors; f++) {
      k.floor(f);
      P.liftIndicator(k, f);
      k.sign("ЭТАЖ " + (f + 1), -12.8, 3.9, 12, 3, 0.65);
      P.action(k, "План этажа " + (f + 1), 2, 12, "map");
      for (const side of [-1, 1]) {
        const x = side * 14;
        const index = f * 2 + (side < 0 ? 0 : 1);
        const number = (f + 1) * 100 + (side < 0 ? 1 : 2);
        const profile = FZInterior50Catalog.apartmentProfiles[index];
        const id = f + ":" + side;
        P.homeDevices(k, x, id, profile);
        P.floorTiles(k, [x + 3.3, -24.5, x + 9.7, -11.3], 0xb0c0bf, 1.3);
        P.floorTiles(k, [x - 9.5, 0, x + 9.5, 7.7], 0xa2a39a, 1.5);
        P.skirting(k, [x - 9.6, -24.5, x + 9.6, 7.7]);
        P.towelRack(k, x + 7, -24.5, profile.accent);
        P.wallVent(k, x + 8, -24.5);
        P.shoeCabinet(k, x + 7.8, 4.2, id + ":cabinet", profile.accent);
        k.box(5.8, 0.018, 3.4, x - 3, 0.025, -5, profile.rug);
        for (const z of [-6.5, -3.5])
          k.box(5.6, 0.008, 0.1, x - 3, 0.04, z, 0xbbb39a);
        // A framed print distinguishes flats without extra textures or unbounded meshes.
        k.box(2.2, 1.4, 0.08, x + 6, 2.7, 7.7, C.wood);
        k.box(1.95, 1.15, 0.03, x + 6, 2.7, 7.64, profile.accent);
        k.box(1.95, 0.25, 0.015, x + 6, 2.3, 7.61, profile.rug);
        k.sign(profile.title, x, 4, 7.7, 8, 0.45, Math.PI);
        k.sign(
          String(number),
          side * 3.8,
          3.2,
          -6.8,
          1.4,
          0.45,
          side < 0 ? Math.PI / 2 : -Math.PI / 2,
        );
        P.action(
          k,
          "Квартира " + number + " — что внутри",
          side * 2.3,
          -7.8,
          "profile",
          { profile50: profile },
        );
        k.box(0.5, 0.045, 0.7, x + 2, 1.31, 1, profile.accent);
        P.action(k, "Домашняя памятка", x + 2, -0.3, "document", {
          document50: "home-guide",
        });
      }
      if (f === 0) {
        P.noticeBoard(k, -12, 8.4, "ПРАВИЛА ДОМА", "house-rules");
        P.action(k, "Консьержка — план и бытовые задачи", -5, 20, "home");
        P.action(k, "Навигация и управление", 3, 19, "document", {
          document50: "accessibility",
        });
        k.sign(
          "В КВАРТИРАХ: КУХНЯ · ГОСТИНАЯ · СПАЛЬНЯ · ВАННАЯ",
          0,
          4.7,
          8.3,
          16,
          0.4,
        );
      } else {
        k.sign("ВЫХОД ↓ ЭТАЖ 1", -7, 4.1, 8.4, 5, 0.4);
      }
    }
  }
  window.FZInterior50Layouts = { bank, residential };
})();
