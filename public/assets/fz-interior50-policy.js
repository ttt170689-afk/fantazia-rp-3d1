/* Interior 50 rules. No account balances, privileges, network or wall-clock timers. */
(function (root) {
  "use strict";
  const services = [
    {
      id: "cash",
      prefix: "К",
      title: "Кассовое обслуживание",
      window: 1,
      description:
        "Вклад и снятие игровых денег. Операция подтверждается в существующем банковском интерфейсе.",
    },
    {
      id: "account",
      prefix: "С",
      title: "Счёт и выписка",
      window: 2,
      description:
        "Просмотр игрового счёта и справка о доступных операциях. Настоящие документы не нужны.",
    },
    {
      id: "consult",
      prefix: "И",
      title: "Консультация",
      window: 3,
      description:
        "Условия игровых вкладов и кредитов. Консультация не оформляет кредит и не списывает деньги.",
    },
  ];
  const devices = {
    television: {
      title: "Телевизор",
      duration: 0,
      on: "Экран включён",
      off: "Экран выключен",
    },
    tap: {
      title: "Кухонный кран",
      duration: 8,
      on: "Вода течёт",
      off: "Кран закрыт",
    },
    shower: {
      title: "Душ",
      duration: 12,
      on: "Душ включён",
      off: "Душ выключен",
    },
    cooker: {
      title: "Вытяжка",
      duration: 15,
      on: "Вытяжка работает",
      off: "Вытяжка выключена",
    },
    refrigerator: {
      title: "Холодильник",
      duration: 0,
      on: "Дверца открыта",
      off: "Дверца закрыта",
    },
    cabinet: {
      title: "Прихожая — шкафчик",
      duration: 0,
      on: "Дверца открыта",
      off: "Дверца закрыта",
    },
    desk: {
      title: "Рабочая лампа",
      duration: 0,
      on: "Лампа включена",
      off: "Лампа выключена",
    },
  };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const finite = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);
  function delta(value) {
    return clamp(finite(value), 0, 0.25);
  }
  function createQueue() {
    return { sequence: 0, ticket: null, history: [], elapsed: 0 };
  }
  function issue(state, id) {
    const service = services.find((item) => item.id === id);
    if (!service) return { ok: false, reason: "unknown" };
    if (state.ticket)
      return { ok: false, reason: "active", ticket: state.ticket };
    state.sequence = (state.sequence % 999) + 1;
    state.ticket = {
      code: service.prefix + String(state.sequence).padStart(3, "0"),
      service: id,
      window: service.window,
      status: "waiting",
      wait: 3,
    };
    return { ok: true, ticket: state.ticket };
  }
  function queueStep(state, dt) {
    const d = delta(dt);
    state.elapsed += d;
    const ticket = state.ticket;
    if (!ticket || ticket.status !== "waiting") return false;
    ticket.wait = Math.max(0, ticket.wait - d);
    if (ticket.wait > 1e-6) return false;
    ticket.wait = 0;
    ticket.status = "called";
    return true;
  }
  function serve(state, windowNumber) {
    const ticket = state.ticket;
    if (!ticket) return { ok: false, reason: "missing" };
    if (ticket.status === "waiting") return { ok: false, reason: "waiting" };
    if (ticket.window !== windowNumber) return { ok: false, reason: "window" };
    ticket.status = "serving";
    return { ok: true, ticket };
  }
  function finish(state) {
    if (state.ticket?.status !== "serving") return false;
    state.history.push({
      code: state.ticket.code,
      service: state.ticket.service,
    });
    state.history = state.history.slice(-8);
    state.ticket = null;
    return true;
  }
  function cancel(state) {
    if (!state.ticket) return false;
    state.ticket = null;
    return true;
  }
  function device(type) {
    if (!Object.hasOwn(devices, type)) return null;
    return { type, on: false, remaining: 0, amount: 0, cycles: 0 };
  }
  function toggleDevice(state) {
    const config = devices[state?.type];
    if (!config) return false;
    state.on = !state.on;
    state.remaining = state.on ? config.duration : 0;
    return true;
  }
  function deviceStep(state, dt) {
    const config = devices[state?.type];
    if (!config) return false;
    const d = delta(dt);
    let completed = false;
    if (state.on && config.duration > 0) {
      state.remaining = Math.max(0, state.remaining - d);
      if (state.remaining <= 1e-6) {
        state.on = false;
        state.remaining = 0;
        state.cycles = Math.min(999, state.cycles + 1);
        completed = true;
      }
    }
    state.amount += (Number(state.on) - state.amount) * (1 - Math.exp(-10 * d));
    return completed;
  }
  function contains(room, p) {
    return (
      p.x >= room.rect[0] &&
      p.x <= room.rect[2] &&
      p.z >= room.rect[1] &&
      p.z <= room.rect[3] &&
      Math.abs(p.y - room.floor * 5.2) < 2.55
    );
  }
  function locate(rooms, position) {
    if (
      !position ||
      !["x", "y", "z"].every((key) => Number.isFinite(position[key]))
    )
      return null;
    // Specific rooms win over a containing lobby/landing.
    return (
      rooms
        .filter((room) => contains(room, position))
        .sort(
          (a, b) =>
            (a.rect[2] - a.rect[0]) * (a.rect[3] - a.rect[1]) -
            (b.rect[2] - b.rect[0]) * (b.rect[3] - b.rect[1]),
        )[0] || null
    );
  }
  function goal(rooms, id) {
    return (
      rooms.find((room) => room.id === id && room.public !== false) || null
    );
  }
  function guidance(room, p, floors) {
    if (!room) return { stage: "none", text: "", point: null };
    const floor = clamp(Math.round(p.y / 5.2), 0, floors - 1);
    if (Math.abs(p.y - room.floor * 5.2) > 0.55) {
      return {
        stage: "floor",
        text:
          "Нужен этаж " +
          (room.floor + 1) +
          ". Лестница слева, лифт справа. Сейчас этаж " +
          (floor + 1) +
          ".",
        point: { x: 19, z: 11, y: floor * 5.2 },
      };
    }
    const point = { x: room.entry[0], z: room.entry[1], y: room.floor * 5.2 };
    const distance = Math.hypot(p.x - point.x, p.z - point.z);
    return {
      stage: distance <= 2 ? "arrived" : "walk",
      text:
        distance <= 2
          ? "Вы у входа: " + room.title + ". Дверь открывается действием рядом."
          : room.title +
            " · до входа " +
            Math.ceil(distance) +
            " м по прямой. Следуйте проходам на плане.",
      point,
    };
  }
  function fresh() {
    return {
      version: 50,
      visits: 0,
      read: [],
      completed: [],
      preferences: { hints: true },
    };
  }
  const readings = [
    "house-rules",
    "bank-safety",
    "bank-services",
    "lift-rules",
    "home-guide",
    "accessibility",
    "clinic-visit",
    "office-visit",
    "court-visit",
    "office-printer",
  ];
  const accomplishments = [
    "water",
    "ventilation",
    "shower",
    "consultation",
    "statement",
    "printed",
  ];
  function clean(raw) {
    const result = fresh();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return result;
    result.visits = Number.isSafeInteger(raw.visits)
      ? clamp(raw.visits, 0, 999)
      : 0;
    for (const [key, allowed] of [
      ["read", readings],
      ["completed", accomplishments],
    ]) {
      if (Array.isArray(raw[key]))
        result[key] = [
          ...new Set(raw[key].filter((value) => allowed.includes(value))),
        ];
    }
    result.preferences.hints = raw.preferences?.hints !== false;
    return result;
  }
  class Store {
    constructor(storage, identity, building) {
      this.storage = storage;
      this.key =
        "fz_interior50:" +
        encodeURIComponent(String(identity || "guest").slice(0, 160)) +
        ":" +
        encodeURIComponent(String(building).slice(0, 240));
      this.ok = true;
      try {
        const text = storage.getItem(this.key);
        this.data = clean(
          text && text.length <= 16384 ? JSON.parse(text) : null,
        );
      } catch (_) {
        this.data = fresh();
        this.ok = false;
      }
    }
    save() {
      this.data = clean(this.data);
      try {
        this.storage.setItem(this.key, JSON.stringify(this.data));
        this.ok = true;
      } catch (_) {
        this.ok = false;
      }
      return this.ok;
    }
  }
  function printerStart(printer) {
    if (!printer || printer.phase === "printing") return false;
    printer.phase = "printing";
    printer.elapsed = 0;
    return true;
  }
  function printerStep(printer, dt) {
    if (!printer || printer.phase !== "printing") return false;
    printer.elapsed = Math.min(4, printer.elapsed + delta(dt));
    if (printer.elapsed < 4 - 1e-6) return false;
    printer.elapsed = 4;
    printer.phase = "ready";
    return true;
  }
  const api = {
    printerStart,
    printerStep,
    services,
    devices,
    delta,
    createQueue,
    issue,
    queueStep,
    serve,
    finish,
    cancel,
    device,
    toggleDevice,
    deviceStep,
    contains,
    locate,
    goal,
    guidance,
    fresh,
    clean,
    Store,
  };
  root.FZInterior50Policy = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
