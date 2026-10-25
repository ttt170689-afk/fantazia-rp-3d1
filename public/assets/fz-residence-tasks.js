/* Optional concierge errands. No automatic quests, popup events or cash farming.
 * A visit context owns the UI; validated progress lives in the existing RP store. */
(function (root) {
  "use strict";
  const jobs = [
    {
      id: "parcel",
      name: "Доставка почты",
      description:
        "Заберите конверт у консьержки и позвоните в указанную квартиру. Используйте лестницу или лифт.",
      badge: "Надёжный сосед",
    },
    {
      id: "lamp",
      name: "Проверка освещения",
      description:
        "В указанной квартире не включён свет. Подойдите к выключателю и включите его.",
      badge: "Дом под присмотром",
    },
    {
      id: "recycle",
      name: "Чистый подъезд",
      description:
        "Соберите три пустые упаковки после использования продуктов и сдайте их в контейнер для бумаги.",
      badge: "Чистый подъезд",
    },
  ];
  let hud = null,
    lastText = "";
  function day() {
    return new Date().toISOString().slice(0, 10);
  }
  function fresh() {
    return { active: null, done: [], badges: [] };
  }
  function clean(value) {
    const out = fresh();
    if (!value || typeof value !== "object") return out;
    if (Array.isArray(value.done))
      out.done = value.done
        .filter(
          (x) =>
            typeof x === "string" &&
            /^\d{4}-\d{2}-\d{2}:(parcel|lamp|recycle)$/.test(x),
        )
        .slice(-60);
    if (Array.isArray(value.badges))
      out.badges = value.badges
        .filter((x) => jobs.some((j) => j.badge === x))
        .slice(0, 3);
    const a = value.active;
    if (
      a &&
      jobs.some((j) => j.id === a.id) &&
      typeof a.day === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(a.day) &&
      Number.isInteger(a.floor) &&
      a.floor >= 0 &&
      a.floor < 4
    ) {
      out.active = {
        id: a.id,
        day: a.day,
        floor: a.floor,
        progress: Number.isInteger(a.progress)
          ? Math.max(0, Math.min(3, a.progress))
          : 0,
      };
    }
    return out;
  }
  function state(ctx) {
    ctx.store.data.tasks = clean(ctx.store.data.tasks);
    return ctx.store.data.tasks;
  }
  function label(active) {
    const apartment = (active.floor + 1) * 100 + 1;
    if (active.id === "parcel") return "Доставьте почту: квартира " + apartment;
    if (active.id === "lamp") return "Включите свет: квартира " + apartment;
    return "Макулатура: " + active.progress + " / 3 упаковки";
  }
  function save(ctx) {
    ctx.store.save();
  }
  function start(ctx, id) {
    const s = state(ctx),
      job = jobs.find((j) => j.id === id);
    if (!job || s.active) return false;
    if (s.done.includes(day() + ":" + id)) return false;
    s.active = { id, day: day(), floor: ctx.k.floors - 1, progress: 0 };
    if (id === "lamp") {
      const key = ctx.k.floors - 1 + ":-1",
        light = ctx.k.switches.find((l) => l.id === key);
      if (light) {
        light.on = false;
        light.lamp.intensity = 0;
        light.bulb.material.color.setHex(0x444444);
        ctx.store.data.lights[key] = false;
      }
    }
    save(ctx);
    ctx.notify("Поручение принято. " + label(s.active));
    ctx.close();
    return true;
  }
  function complete(ctx) {
    const s = state(ctx),
      a = s.active;
    if (!a) return false;
    const job = jobs.find((j) => j.id === a.id),
      key = a.day + ":" + a.id;
    if (s.done.includes(key)) return false;
    s.done.push(key);
    s.done = s.done.slice(-60);
    if (!s.badges.includes(job.badge)) s.badges.push(job.badge);
    s.active = null;
    save(ctx);
    ctx.receipt("Поручение: " + job.name);
    ctx.notify("Поручение выполнено. Отметка: «" + job.badge + "».");
    release();
    return true;
  }
  function event(ctx, kind, data) {
    const s = state(ctx),
      a = s.active;
    if (!a) return false;
    if (
      a.id === "parcel" &&
      kind === "doorbell" &&
      data.number === (a.floor + 1) * 100 + 1
    )
      return complete(ctx);
    if (
      a.id === "lamp" &&
      kind === "roomLight" &&
      data.light.id === a.floor + ":-1" &&
      data.light.on
    )
      return complete(ctx);
    if (
      a.id === "recycle" &&
      kind === "trash" &&
      data.recycle &&
      data.amount > 0
    ) {
      a.progress = Math.min(3, a.progress + data.amount);
      save(ctx);
      if (a.progress >= 3) return complete(ctx);
      ctx.notify(label(a));
    }
    return false;
  }
  function menu(ctx) {
    const s = state(ctx);
    if (s.active) {
      const job = jobs.find((j) => j.id === s.active.id);
      ctx.modal(job.name, job.description + "\n\n" + label(s.active), [
        {
          label: "Как пройти",
          run() {
            ctx.modal(
              "Маршрут по подъезду",
              "Лестница слева в холле, лифт справа. Номер квартиры состоит из номера этажа и 01 или 02. Свет и предметы находятся внутри, дверной звонок — со стороны общего коридора.",
            );
          },
        },
        {
          label: "Отменить поручение",
          run() {
            s.active = null;
            save(ctx);
            release();
            ctx.close();
          },
        },
      ]);
      return;
    }
    ctx.modal(
      "Поручения консьержки",
      "Задания добровольные. Каждое доступно один раз в день UTC. Награда — отметка в журнале, без начисления денег.\n\nМои отметки: " +
        (s.badges.join(", ") || "пока нет"),
      jobs.map((job) => ({
        label: job.name,
        disabled: s.done.includes(day() + ":" + job.id),
        run: () => start(ctx, job.id),
      })),
    );
  }
  function updateUI(ctx) {
    const a = ctx.store.data.tasks?.active;
    if (!a) {
      release();
      return;
    }
    if (typeof document === "undefined") return;
    if (!hud) {
      hud = document.createElement("button");
      hud.id = "fz28Task";
      hud.className = "fz28-task";
      hud.type = "button";
      hud.onclick = () => menu(ctx);
      document.body.append(hud);
    }
    const text = label(a) + " · Подробнее";
    if (lastText !== text) {
      hud.textContent = text;
      lastText = text;
    }
  }
  function release() {
    hud?.remove();
    hud = null;
    lastText = "";
  }
  const api = { jobs, fresh, clean, start, event, menu, updateUI, release };
  root.FZResidenceTasks = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
