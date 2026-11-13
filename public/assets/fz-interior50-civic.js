/* Offices, clinic and courthouse keep their own existing gameplay and receive semantic plans.
 * This module does not turn a public institution into a residential apartment or a bank. */
(function () {
  "use strict";
  const { C } = FZBuildingKit;
  const P = FZInterior50Props;
  const documents = {
    "clinic-visit": {
      title: "Клиника · порядок посещения",
      paragraphs: [
        "У входа находится регистратура. Врачебные кабинеты расположены по обеим сторонам коридора на двух этажах.",
        "На второй этаж можно подняться по лестнице слева или на лифте справа. План здания показывает входы в кабинеты.",
        "Осмотр запускается только рядом с врачом через существующее действие. Его игровая цена видна до подтверждения.",
        "Здесь нет настоящей диагностики, медицинских назначений или сбора медицинских данных. Оборудование — часть игровой обстановки.",
        "Кровати и места ожидания не перекрывают центральный проход. Выход находится на первом этаже.",
      ],
    },
    "office-visit": {
      title: "Деловой центр · посетителям",
      paragraphs: [
        "Секретарь находится у входа. Кабинеты пронумерованы по этажам: 101–102 и 201–202.",
        "Рабочие столы, места посетителей, книжные шкафы и принтеры находятся внутри кабинетов, а не в общем жилом помещении.",
        "Рабочее поручение доступно у менеджера. Новый план и офисная памятка не начисляют зарплату и не меняют прежние награды.",
        "Принтер печатает только локальную памятку посещения. Он не читает файлы компьютера, не запрашивает почту и не отправляет данные.",
        "Лестница и лифт доступны на обоих этажах. Выбор кабинета на плане ставит отметку у двери, но не перемещает игрока.",
      ],
    },
    "court-visit": {
      title: "Суд · игровые слушания",
      paragraphs: [
        "В этом здании два зала суда, канцелярия, места для слушателей и стойка пристава.",
        "Материалы дел и начало слушания доступны через прежние действия у секретаря и в зале.",
        "Дела вымышленные, решения не имеют юридической силы. Новая навигация не меняет результаты завершённых дел.",
        "В зале есть места судьи, сторон и слушателей. Центральные проходы нужно оставлять свободными.",
        "План здания помогает найти зал и канцелярию. Выход через фойе, без перехода в чужую квартиру или банковское помещение.",
      ],
    },
    "office-printer": {
      title: "Памятка с офисного принтера",
      paragraphs: [
        "Проверьте номер кабинета на заявке перед передачей документа менеджеру.",
        "Памятка не содержит персональных данных и не является банковским чеком.",
        "Печать доступна только у офисного принтера. Повторное нажатие во время печати не создаёт новый заказ.",
        "Готовый лист можно прочитать после завершения короткого игрового цикла. При выходе из здания незавершённая печать отменяется.",
      ],
    },
  };
  Object.assign(FZInterior50Catalog.documents, documents);
  function setup(k, rooms) {
    k.interior50 = true;
    k.rooms50 = rooms;
    k.devices50 = [];
    k.liftDisplays50 = [];
    k.printers50 = [];
  }
  function landing(floor, clinic) {
    return {
      id: "landing-" + floor,
      title:
        (floor === 0
          ? clinic
            ? "Регистратура и ожидание"
            : "Приёмная и ожидание"
          : "Холл") +
        " · этаж " +
        (floor + 1),
      floor,
      rect: [-25, 8, 25, 24],
      entry: [0, 16],
      color: "#7c9197",
      description:
        "Центральный проход, лестница слева и лифт справа. " +
        (floor === 0
          ? "Выход напротив коридора."
          : "Для выхода спуститесь на первый этаж."),
    };
  }
  function cabinet(floor, side, clinic) {
    const number = (floor + 1) * 100 + (side < 0 ? 1 : 2);
    const x = side * 13;
    return {
      id: "cabinet-" + number,
      title: (clinic ? "Врачебный кабинет " : "Офис ") + number,
      floor,
      rect: [side < 0 ? -25 : 4.2, -24.5, side < 0 ? -4.2 : 25, 7.8],
      entry: [side * 2.4, -4],
      color: clinic ? "#829fa3" : "#8f929b",
      description: clinic
        ? "Рабочее место врача, место пациента, кровать и медицинская мебель. Игровой осмотр — рядом с врачом."
        : "Рабочее место менеджера, кресло посетителя, шкаф с документами и принтер. Поручение — у стола менеджера.",
      desk: [x, -13],
    };
  }
  function medicalCabinet(k, x, z) {
    k.box(2, 3.1, 0.75, x, 1.55, z, 0xd1dcda, true);
    k.box(1.8, 2.2, 0.045, x, 1.9, z + 0.4, 0x8eafb4);
    k.box(0.06, 2.3, 0.07, x, 1.9, z + 0.44, 0xe0e5dc);
    for (const dx of [-0.1, 0.1])
      k.box(0.045, 0.3, 0.1, x + dx, 1.6, z + 0.47, C.metal);
    for (let row = 0; row < 3; row++) {
      k.box(1.75, 0.04, 0.7, x, 0.9 + row * 0.7, z, 0xe5e8de);
      for (let col = 0; col < 4; col++) {
        k.box(
          0.22,
          0.35,
          0.16,
          x - 0.65 + col * 0.42,
          1.1 + row * 0.7,
          z + 0.45,
          col % 2 ? 0x88a1b2 : 0xd9dccc,
        );
      }
    }
    k.sign("ИНВЕНТАРЬ · ДЕКОРАЦИЯ", x, 3.5, z + 0.4, 3, 0.3);
  }
  function examScreen(k, x, z) {
    k.box(0.08, 2.4, 0.08, x - 1.6, 1.2, z, C.metal);
    k.box(0.08, 2.4, 0.08, x + 1.6, 1.2, z, C.metal);
    k.box(3.2, 0.08, 0.08, x, 2.4, z, C.metal);
    k.box(3.05, 1.8, 0.04, x, 1.45, z, 0x89a5a1);
    for (const dx of [-1.6, 1.6])
      k.box(0.55, 0.06, 0.55, x + dx, 0.04, z, C.dark);
    // Deliberately not a collider: the low visual screen cannot trap the bed action.
  }
  function medicineCart(k, x, z) {
    for (const y of [0.4, 1.1]) k.box(1.15, 0.07, 0.8, x, y, z, 0xb5c5c8);
    for (const dx of [-0.5, 0.5])
      for (const dz of [-0.32, 0.32]) {
        k.box(0.04, 1, 0.04, x + dx, 0.6, z + dz, C.metal);
        k.cyl(0.07, 0.13, x + dx, 0.08, z + dz, C.dark);
      }
    k.box(0.5, 0.15, 0.35, x, 1.22, z, 0xe3e4da);
    k.box(0.1, 0.015, 0.27, x, 1.31, z, 0x6e9695);
  }
  function printer(k, x, z, id) {
    k.box(1.6, 1.25, 1.25, x, 0.625, z, 0x637789, true);
    P.printer(k, x, z);
    const output = k.moving(0.55, 0.025, 0.3, x, 1.43, z + 0.7, 0xe9e4d2);
    output.visible = false;
    const item = { id, floor: k.current, elapsed: 0, phase: "idle", output };
    k.printers50.push(item);
    P.action(k, "Принтер — памятка", x, z + 1.9, "printer", {
      printer50: item,
    });
  }
  function service(k) {
    const clinic = k.type === "hospital";
    const rooms = [];
    for (let floor = 0; floor < k.floors; floor++) {
      rooms.push(landing(floor, clinic));
      for (const side of [-1, 1]) rooms.push(cabinet(floor, side, clinic));
    }
    setup(k, rooms);
    for (let floor = 0; floor < k.floors; floor++) {
      k.floor(floor);
      P.liftIndicator(k, floor);
      P.action(k, "План кабинетов · этаж " + (floor + 1), 2, 12, "map");
      for (const side of [-1, 1]) {
        const x = side * 13;
        const number = (floor + 1) * 100 + (side < 0 ? 1 : 2);
        if (clinic) {
          medicalCabinet(k, x + 8, -23.6);
          medicineCart(k, x + 2, -20);
          examScreen(k, x + 5, -20);
          k.box(0.8, 0.55, 0.05, x - 2, 1.7, -15, C.dark);
          k.box(0.65, 0.4, 0.02, x - 2, 1.7, -14.96, 0x6a8e91);
          k.sign(
            "КАБИНЕТ " + number + " · ИГРОВОЙ ОСМОТР",
            x,
            4.5,
            -24.7,
            10,
            0.45,
          );
          P.action(
            k,
            "Кабинет " + number + " — памятка пациенту",
            x + 4,
            -10,
            "document",
            { document50: "clinic-visit" },
          );
        } else {
          printer(k, x + 8, -20, "printer-" + number);
          P.filingCabinet(k, x - 7, -15);
          P.coatStand(k, x + 8, 5, 0x6b8391);
          k.sign("ОФИС " + number + " · РАБОЧИЕ МЕСТА", x, 4.3, -24.7, 10, 0.5);
          P.action(
            k,
            "Офис " + number + " — памятка посетителю",
            x + 4,
            -10,
            "document",
            { document50: "office-visit" },
          );
          for (const dx of [-0.4, 0.4]) {
            k.box(
              0.55,
              0.05,
              0.7,
              x + dx,
              1.33,
              -15,
              dx < 0 ? 0x739a92 : 0xb8a579,
            );
          }
        }
        P.floorTiles(
          k,
          [side < 0 ? -24.6 : 4.5, -24.5, side < 0 ? -4.5 : 24.6, 7.7],
          clinic ? 0xa4b6b4 : 0x858e97,
          2.4,
        );
      }
      if (floor === 0) {
        P.noticeBoard(
          k,
          -12,
          8.4,
          clinic ? "ПОСЕТИТЕЛЯМ КЛИНИКИ" : "ПОСЕТИТЕЛЯМ ОФИСОВ",
          clinic ? "clinic-visit" : "office-visit",
        );
      }
    }
  }
  function court(k) {
    setup(k, [
      {
        id: "court-foyer",
        title: "Фойе суда",
        floor: 0,
        rect: [-25, 6.2, 25, 24.5],
        entry: [0, 20],
        color: "#8c9096",
        description: "Канцелярия слева, пристав справа, два зала за дверями.",
      },
      {
        id: "court-office",
        title: "Канцелярия",
        floor: 0,
        rect: [-15, 12, -4, 20],
        entry: [-9, 18],
        color: "#8e9e9b",
        description:
          "Материалы дел и заявления доступны у секретаря канцелярии.",
      },
      {
        id: "court-bailiff",
        title: "Судебный пристав",
        floor: 0,
        rect: [5, 12, 15, 20],
        entry: [10, 18],
        color: "#8e9e9b",
        description: "Информация о правилах посещения игровых слушаний.",
      },
      {
        id: "court-room-1",
        title: "Зал суда 1",
        floor: 0,
        rect: [-24.8, -24.5, -0.3, 5.8],
        entry: [-13, 7.8],
        color: "#a18c79",
        description:
          "Судья, столы сторон и места слушателей. Начало слушания — внутри зала.",
      },
      {
        id: "court-room-2",
        title: "Зал суда 2",
        floor: 0,
        rect: [0.3, -24.5, 24.8, 5.8],
        entry: [13, 7.8],
        color: "#a18c79",
        description:
          "Второй зал с самостоятельными местами слушателей и секретарём.",
      },
    ]);
    k.floor(0);
    P.action(k, "План суда", 2, 21, "map");
    P.noticeBoard(k, 0, 6.3, "ПОРЯДОК СЛУШАНИЙ", "court-visit");
    for (const x of [-13, 13]) {
      k.box(0.55, 0.06, 0.65, x - 1, 1.33, -18, 0xa99773);
      k.cyl(0.11, 0.12, x + 1, 1.36, -18, C.wood);
      k.box(0.5, 0.06, 0.06, x + 1, 1.45, -18, C.wood);
      k.sign("ИГРОВОЙ СУД · НЕ ЮРИДИЧЕСКОЕ РЕШЕНИЕ", x, 4.7, -24.7, 12, 0.4);
      for (const dx of [-8, 8]) P.coatStand(k, x + dx, 3, 0x687888);
    }
  }
  function decorate(k) {
    if (
      k.type === "court" ||
      k.actions.some((action) => action.kind === "hearing")
    )
      court(k);
    else if (k.type === "office" || k.type === "hospital") service(k);
  }
  window.FZInterior50Civic = { decorate };
})();
