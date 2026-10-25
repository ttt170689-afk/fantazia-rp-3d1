/* Pure rules: bounded, profile-scoped local RP data; no server banking replacement. */
(function (root) {
  "use strict";
  const snacks = [
    {
      id: "popcorn",
      name: "Попкорн",
      price: 35,
      description: "Большой стакан солёного попкорна.",
    },
    {
      id: "juice",
      name: "Сок",
      price: 20,
      description: "Охлаждённый фруктовый напиток.",
    },
    {
      id: "nachos",
      name: "Начос",
      price: 40,
      description: "Хрустящие кукурузные чипсы.",
    },
    {
      id: "water",
      name: "Вода",
      price: 10,
      description: "Бутылка питьевой воды.",
    },
  ];
  const cases = [
    {
      id: "parcel",
      title: "Посылка у соседней двери",
      claim: "Житель квартиры 201 заявил об исчезновении посылки.",
      facts: [
        "Курьер сфотографировал доставку у двери 202.",
        "Сосед 202 сохранил коробку закрытой.",
        "Заявитель подтвердил номер на упаковке.",
      ],
      choices: [
        "Обвинить соседа без проверки",
        "Передать посылку владельцу, закрыть спор",
        "Потребовать удалить фотографию",
      ],
      correct: 1,
      result: "Посылку передали адресату. Стороны примирились.",
    },
    {
      id: "noise",
      title: "Шумный ремонт",
      claim: "Соседи спорят о времени проведения ремонта.",
      facts: [
        "Запись домофона показывает начало работ в 14:10.",
        "В правилах дома ремонт разрешён с 10:00 до 18:00.",
        "Ночных работ журнал не зафиксировал.",
      ],
      choices: [
        "Разъяснить правила и согласовать график",
        "Назначить наказание без оснований",
        "Запретить любой ремонт навсегда",
      ],
      correct: 0,
      result: "Жильцы согласовали расписание и обменялись контактами.",
    },
    {
      id: "bike",
      title: "Велосипед у подъезда",
      claim: "Два жителя называют велосипед своим.",
      facts: [
        "На раме читается номер FZ-204.",
        "Первый житель предъявил чек с номером FZ-204.",
        "Второй житель описал другой цвет и номер FZ-240.",
      ],
      choices: [
        "Выбрать владельца случайно",
        "Оставить велосипед в суде",
        "Сверить номер и вернуть по документу",
      ],
      correct: 2,
      result: "Велосипед возвращён владельцу по совпавшему номеру рамы.",
    },
  ];
  function fresh() {
    return {
      version: 28,
      laundry: 0,
      tasks: { active: null, done: [], badges: [] },
      lights: {},
      curtains: {},
      bag: {},
      stored: {},
      wrappers: 0,
      tea: 0,
      rest: 0,
      washed: 0,
      mail: false,
      office: 0,
      tickets: [],
      cases: [],
      receipts: [],
    };
  }
  const count = (n) =>
    Number.isSafeInteger(n) && n >= 0 ? Math.min(n, 999) : 0;
  function clean(raw) {
    const out = fresh();
    if (!raw || typeof raw !== "object") return out;
    for (const id of snacks.map((s) => s.id)) {
      out.bag[id] = count(raw.bag?.[id]);
      out.stored[id] = count(raw.stored?.[id]);
    }
    for (const id of ["wrappers", "tea", "rest", "washed", "office", "laundry"])
      out[id] = count(raw[id]);
    for (const field of ["lights", "curtains"])
      for (let floor = 0; floor < 4; floor++)
        for (const side of [-1, 1]) {
          const id = floor + ":" + side;
          if (typeof raw[field]?.[id] === "boolean")
            out[field][id] = raw[field][id];
        }
    out.tasks = root.FZResidenceTasks?.clean(raw.tasks) || out.tasks;
    out.mail = raw.mail === true;
    out.tickets = Array.isArray(raw.tickets)
      ? raw.tickets.filter((x) => x === 0 || x === 1).slice(-8)
      : [];
    out.cases = Array.isArray(raw.cases)
      ? raw.cases.filter((x) => cases.some((c) => c.id === x)).slice(-20)
      : [];
    out.receipts = Array.isArray(raw.receipts)
      ? raw.receipts
          .filter((x) => typeof x === "string")
          .map((x) => x.slice(0, 100))
          .slice(-20)
      : [];
    return out;
  }
  class Store {
    constructor(storage, profile, building) {
      this.storage = storage;
      this.key =
        "fz_buildings28:" +
        encodeURIComponent(profile || "guest") +
        ":" +
        encodeURIComponent(building);
      this.ok = true;
      try {
        this.data = clean(JSON.parse(storage.getItem(this.key) || "null"));
      } catch (_) {
        this.data = fresh();
      }
    }
    save() {
      try {
        this.storage.setItem(this.key, JSON.stringify(clean(this.data)));
        this.ok = true;
      } catch (_) {
        this.ok = false;
      }
      return this.ok;
    }
  }
  function rampHeight(r, x, z, y, FH = 5.2) {
    if (x < r.minX || x > r.maxX || z < r.minZ || z > r.maxZ) return null;
    const h = r.floor * FH + ((r.maxZ - z) / (r.maxZ - r.minZ)) * FH;
    return Math.abs(h - y) < 1.2 ? h : null;
  }
  function liftInside(x, z) {
    return x > 15.8 && x < 22.2 && z > 14.55 && z < 22.3;
  }
  function liftDoorway(x, z) {
    return Math.abs(x - 19) < 1.85 && Math.abs(z - 14) < 1.1;
  }
  function liftStep(l, dt, FH) {
    const delta = Math.min(0.05, Math.max(0, Number.isFinite(dt) ? dt : 0));
    if (l.phase === "closing") {
      l.elapsed += delta;
      if (l.elapsed >= 1) {
        l.phase = "moving";
        l.elapsed = 0;
        l.from = l.y;
      }
    } else if (l.phase === "moving") {
      l.elapsed += delta;
      const duration = Math.max(1.4, Math.abs(l.to * FH - l.from) / 2),
        t = Math.min(1, l.elapsed / duration),
        s = t * t * (3 - 2 * t);
      l.y = l.from + (l.to * FH - l.from) * s;
      if (t === 1) {
        l.phase = "open";
        l.elapsed = 0;
      }
    }
    return l.y;
  }
  const api = {
    snacks,
    cases,
    fresh,
    clean,
    Store,
    rampHeight,
    liftInside,
    liftDoorway,
    liftStep,
  };
  root.FZBuildingPolicy = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
