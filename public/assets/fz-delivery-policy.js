/* Optional local RP deliveries. No money, account or multiplayer authority. */
(function (root) {
  "use strict";
  const jobs = Object.freeze([
    { id: "groceries", title: "Продукты к подъезду", item: "Пакет продуктов", from: ["shop_food"], to: ["house", "apartment"] },
    { id: "equipment", title: "Посылка в офис", item: "Коробка техники", from: ["shop_electronics"], to: ["office", "biz_office", "biz_server"] },
    { id: "cinema", title: "Заказ для кинобара", item: "Коробка продуктов", from: ["shop_food"], to: ["cinema"] },
  ]);
  const kinds = new Set(jobs.flatMap(j => [...j.from, ...j.to]));
  const keyPattern = /^[a-z_]+:-?\d+:-?\d+$/;
  const fresh = () => ({ version: 1, active: null, completed: 0, history: [] });
  function clean(raw) {
    const s = fresh();
    if (!raw || typeof raw !== "object" || raw.version !== 1) return s;
    s.completed = Number.isSafeInteger(raw.completed) ? Math.max(0, Math.min(9999, raw.completed)) : 0;
    const a = raw.active;
    if (a && jobs.some(j => j.id === a.job) && ["pickup", "dropoff"].includes(a.phase) &&
        typeof a.from === "string" && typeof a.to === "string" && a.from.length < 100 && a.to.length < 100 &&
        keyPattern.test(a.from) && keyPattern.test(a.to) && a.from !== a.to) {
      s.active = { job: a.job, phase: a.phase, from: a.from, to: a.to };
    }
    if (Array.isArray(raw.history)) s.history = raw.history.filter(h => h && jobs.some(j => j.id === h.job) &&
      Number.isSafeInteger(h.at) && h.at > 0 && h.at <= 8640000000000000).slice(-12).map(h => ({ job: h.job, at: h.at }));
    return s;
  }
  function catalog(entries) {
    const rows = new Map();
    for (const e of Array.isArray(entries) ? entries : []) {
      if (!e || e.interior || e.sky || e.metroInside || e.crane28) continue;
      const type = e.destination || e.type, p = e.position, title = String(e.name || type);
      // Legacy map uses house/cinema as generic interior templates for churches,
      // caves, stadiums and arcades. Those are not residential/cinema deliveries.
      if (["house", "apartment"].includes(type) && e.deliveryKind !== "home" &&
          !/дом|квартир|коттедж|вилл|особняк|жил|жк|house|home|residen|apartment/i.test(title)) continue;
      if (type === "cinema" && !/кино|cinema|kino/i.test(title)) continue;
      if (!kinds.has(type) || !p || ![p.x, p.y ?? 0, p.z].every(Number.isFinite) ||
          Math.abs(p.x) > 600 || Math.abs(p.z) > 600 || Math.abs(p.y || 0) > 20) continue;
      const key = type + ":" + Math.round(p.x * 10) + ":" + Math.round(p.z * 10);
      if (!rows.has(key)) rows.set(key, { key, type, x: p.x, y: p.y || 0, z: p.z,
        title: String(e.name || type).replace(/\[E\]/g, "").slice(0, 100) });
    }
    return [...rows.values()];
  }
  function distance(a, b) {
    return a && b && [a.x, a.z, b.x, b.z].every(Number.isFinite) ? Math.hypot(a.x - b.x, a.z - b.z) : Infinity;
  }
  function offers(rows, player) {
    return jobs.flatMap(job => {
      const sources = rows.filter(r => job.from.includes(r.type)).sort((a,b) => distance(player,a)-distance(player,b) || a.key.localeCompare(b.key));
      for (const from of sources) {
        const to = rows.filter(r => job.to.includes(r.type) && distance(from,r) >= 20)
          .sort((a,b) => distance(from,a)-distance(from,b) || a.key.localeCompare(b.key))[0];
        if (to) return [{ job: job.id, from: from.key, to: to.key }];
      }
      return [];
    });
  }
  function resolve(active, rows) {
    if (!active) return null;
    const job = jobs.find(j => j.id === active.job), from = rows.find(r => r.key === active.from), to = rows.find(r => r.key === active.to);
    if (!job || !from || !to || !job.from.includes(from.type) || !job.to.includes(to.type) || distance(from,to) < 20) return null;
    return { job, from, to, target: active.phase === "pickup" ? from : to };
  }
  function start(raw, offer, rows) {
    const s = clean(raw);
    if (s.active || !offer) return null;
    const next = clean({ ...s, active: { job: offer.job, from: offer.from, to: offer.to, phase: "pickup" } });
    return resolve(next.active,rows) ? next : null;
  }
  function step(raw, rows, position, now) {
    const s = clean(raw), r = resolve(s.active,rows);
    if (!r || distance(position,r.target) > 4.5 || !Number.isFinite(position.y) || Math.abs(position.y-r.target.y) > 3) return null;
    if (s.active.phase === "pickup") s.active.phase = "dropoff";
    else {
      if (!Number.isSafeInteger(now) || now <= 0 || now > 8640000000000000) return null;
      s.completed = Math.min(9999,s.completed+1);
      s.history.push({job:s.active.job,at:now}); s.history=s.history.slice(-12); s.active=null;
    }
    return s;
  }
  const api = { jobs, fresh, clean, catalog, distance, offers, resolve, start, step };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.FZDeliveryPolicy = api;
})(typeof window === "undefined" ? globalThis : window);
