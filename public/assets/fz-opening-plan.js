/* Opening shot data uses LIVE world-space anchors. No city geometry lives here. */
(function (root) {
  "use strict";
  const duration = 33;
  const smooth = (value) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * t * (t * (t * 6 - 15) + 10);
  };
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * smooth(t));
  const phases = [
    { id: "credit", start: 0, end: 2.8, label: "", caption: "" },
    {
      id: "gateway",
      start: 2.8,
      end: 5.4,
      label: "FANTAZIA / ОДИН ГОРОД",
      caption: "",
    },
    {
      id: "life",
      start: 5.4,
      end: 11.4,
      label: "01 / УТРО НА ПЛОЩАДИ",
      caption: "Кто-то спешит с доставкой. Кто-то никуда не торопится.",
    },
    {
      id: "neighbors",
      start: 11.4,
      end: 16,
      label: "02 / МАЛЕНЬКИЕ ИСТОРИИ",
      caption: "Книга на скамейке. Разговор со знакомым. Обычный день.",
    },
    {
      id: "mall",
      start: 16,
      end: 23,
      label: "03 / GRAND MALL",
      caption: "Знакомые входы. Знакомые улицы. Твой город.",
    },
    {
      id: "flight",
      start: 23,
      end: 28,
      label: "FANTAZIA / МЕСТО ДЛЯ ТВОЕЙ ИСТОРИИ",
      caption: "",
    },
    { id: "title", start: 28, end: 33, label: "", caption: "" },
  ];
  function at(time, reduced = false) {
    const t = Number.isFinite(time) ? Math.max(0, time) : 0;
    if (reduced) return t < 2.8 ? phases[0] : t < 6 ? phases[2] : phases[6];
    return phases.find((p) => t < p.end) || phases[6];
  }
  function shots(a) {
    const { square: s, bench: b, mall: m, entrance: e } = a;
    const wide = [s.x + 10, 4.5, s.z + 13],
      near = [s.x + 6, 3.5, s.z + 10],
      life = [s.x, 1.5, s.z + 1];
    const benchCam = [
        b.x + Math.sin(b.rot) * 7 + 3,
        2.6,
        b.z + Math.cos(b.rot) * 7 + 3,
      ],
      benchLook = [b.x, 1.3, b.z];
    const high = [s.x + 65, 82, s.z + 95],
      skyLook = [m.x, 13, m.z + 25];
    return {
      credit: { from: wide, to: wide, lookA: life, lookB: life },
      gateway: { from: wide, to: near, lookA: life, lookB: life },
      life: {
        from: near,
        to: [s.x + 4, 3.1, s.z + 9],
        lookA: life,
        lookB: [s.x + 1, 1.4, s.z + 2],
      },
      neighbors: {
        from: benchCam,
        to: [benchCam[0] - 1, benchCam[1] + 0.3, benchCam[2] + 1],
        lookA: benchLook,
        lookB: benchLook,
      },
      mall: {
        from: [e.x + 24, 12, e.z + 17],
        to: [e.x - 22, 20, e.z + 19],
        lookA: [m.x, 14, m.z + 25],
        lookB: [m.x, 17, m.z + 15],
      },
      flight: {
        from: [s.x + 12, 30, s.z + 30],
        to: high,
        lookA: skyLook,
        lookB: skyLook,
      },
      title: {
        from: high,
        to: [high[0] + 5, high[1] + 3, high[2] + 5],
        lookA: skyLook,
        lookB: skyLook,
      },
    };
  }
  function sample(time, anchors, reduced = false) {
    time = Number.isFinite(time) ? Math.max(0, time) : 0;
    const p = at(time, reduced),
      shot = shots(anchors)[reduced && p.id !== "credit" ? "life" : p.id];
    const t = reduced ? 0 : (time - p.start) / (p.end - p.start);
    return {
      phase: p.id,
      position: mix(shot.from, shot.to, t),
      look: mix(shot.lookA, shot.lookB, t),
      progress: Math.min(1, Math.max(0, time / (reduced ? 9 : duration))),
    };
  }
  const api = { duration, phases, smooth, mix, at, sample };
  root.FZOpeningPlan = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
