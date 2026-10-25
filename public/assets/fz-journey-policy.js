/* Personal travel data only. Never accounts, passwords, currency, inventory, or admin access. */
(function (root) {
  "use strict";
  const ids = ["first", "business", "avenue"];
  const words = (s, n = 40) =>
    typeof s === "string"
      ? s
          .replace(/[\u0000-\u001f\u007f]/g, "")
          .trim()
          .slice(0, n)
      : "";
  function point(p) {
    if (
      !p ||
      !Number.isFinite(p.x) ||
      !Number.isFinite(p.z) ||
      Math.abs(p.x) > 550 ||
      Math.abs(p.z) > 550
    )
      return null;
    return { x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100 };
  }
  function guide(raw) {
    const out = { favorites: [], visited: [], completed: [], pending: null };
    for (const k of ["favorites", "visited", "completed"])
      if (Array.isArray(raw?.[k]))
        out[k] = [
          ...new Set(
            raw[k]
              .filter((v) => typeof v === "string")
              .map((v) => words(v, 160))
              .filter(Boolean),
          ),
        ].slice(0, 150);
    out.completed = out.completed.filter((v) => ids.includes(v));
    if (
      ids.includes(raw?.pending?.id) &&
      Number.isInteger(raw.pending.index) &&
      raw.pending.index >= 0 &&
      raw.pending.index < 3
    )
      out.pending = { id: raw.pending.id, index: raw.pending.index };
    return out;
  }
  function clean(raw) {
    const out = {
      lastCity: point(raw?.lastCity),
      places: [],
      updatedAt: Number.isFinite(raw?.updatedAt)
        ? Math.max(0, Math.min(Date.now() + 60000, raw.updatedAt))
        : 0,
    };
    if (Array.isArray(raw?.places)) {
      const seen = new Set();
      for (const p of raw.places) {
        const loc = point(p),
          id = words(p?.id, 50);
        if (!loc || !id || seen.has(id)) continue;
        seen.add(id);
        out.places.push({ ...loc, id, label: words(p.label) || "Моё место" });
        if (out.places.length === 8) break;
      }
    }
    return out;
  }
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++)
      h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return (h >>> 0).toString(16);
  }
  class Store {
    constructor(storage, key) {
      this.storage = storage;
      this.key = key;
      this.rev = 0;
      this.recovered = false;
      this.failed = false;
    }
    read() {
      let rows = [],
        bad = false;
      for (const suffix of ["a", "b"]) {
        try {
          const text = this.storage.getItem(this.key + ":" + suffix);
          if (!text) continue;
          if (text.length > 65536) throw Error("size");
          const row = JSON.parse(text);
          if (
            row.v !== 1 ||
            !Number.isInteger(row.rev) ||
            row.rev < 1 ||
            row.rev > 1e9 ||
            typeof row.body !== "string" ||
            row.hash !== hash(row.body)
          )
            throw Error("checksum");
          rows.push({ rev: row.rev, data: clean(JSON.parse(row.body)) });
        } catch (e) {
          bad = true;
        }
      }
      rows.sort((a, b) => b.rev - a.rev);
      this.rev = rows[0]?.rev || 0;
      this.recovered = bad && !!rows.length;
      return rows[0]?.data || clean(null);
    }
    write(data) {
      const rev = this.rev + 1,
        body = JSON.stringify(clean(data));
      try {
        this.storage.setItem(
          this.key + ":" + (rev % 2 ? "a" : "b"),
          JSON.stringify({ v: 1, rev, body, hash: hash(body) }),
        );
        this.rev = rev;
        this.failed = false;
        return true;
      } catch (e) {
        this.failed = true;
        return false;
      }
    }
  }
  function pack(player, data, journal) {
    return {
      format: "fantazia-travel-backup",
      version: 1,
      player: words(player, 80),
      createdAt: Date.now(),
      data: clean(data),
      journal: guide(journal),
    };
  }
  function unpack(text, player) {
    if (typeof text !== "string" || text.length > 65536)
      throw Error("Файл слишком большой: максимум 64 КБ.");
    let r;
    try {
      r = JSON.parse(text);
    } catch {
      throw Error("Это не файл JSON.");
    }
    if (r?.format !== "fantazia-travel-backup" || r.version !== 1)
      throw Error("Нужна копия «Моего города» версии 1.");
    if (r.player !== words(player, 80))
      throw Error("Копия принадлежит другому нику. Войди под тем же ником.");
    return pack(player, r.data, r.journal);
  }
  const api = { point, clean, guide, Store, pack, unpack, hash };
  root.FZJourneyPolicy = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
