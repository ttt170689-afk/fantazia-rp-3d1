/* Opening shot data uses LIVE world-space anchors. No city geometry lives here. */
(function (root) {
  "use strict";
  const duration = 7;
  const smooth = (value) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * t * (t * (t * 6 - 15) + 10);
  };
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * smooth(t));
  const phases = [
    { id: "credit", start: 0, end: 1.2, label: "", caption: "" },
    { id: "gateway", start: 1.2, end: 2.1, label: "FANTAZIA", caption: "" },
    {
      id: "life",
      start: 2.1,
      end: 5.5,
      label: "ТВОЙ ГОРОД",
      caption: "Встречаемся в Fantazia.",
    },
    { id: "title", start: 5.5, end: 7, label: "", caption: "" },
  ];
  function at(time, reduced = false) {
    const t = Number.isFinite(time) ? Math.max(0, time) : 0;
    return reduced && t >= 1.2 && t < 5.5
      ? phases[2]
      : phases.find((p) => t < p.end) || phases[3];
  }
  function virtualTime(time) {
    const p = at(time),
      t = Math.max(0, Math.min(1, (time - p.start) / (p.end - p.start)));
    const ranges = {
      credit: [0, 3],
      gateway: [3, 9],
      life: [13, 18],
      title: [36, 41],
    };
    const [a, b] = ranges[p.id];
    return a + (b - a) * t;
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
        to: [s.x + 3.8, 2.5, s.z + 7.5],
        lookA: life,
        lookB: [s.x + 4.1, 1.55, s.z + 2],
      },
      neighbors: {
        from: benchCam,
        to: [benchCam[0] + 1, 2.25, benchCam[2] - 1],
        lookA: benchLook,
        lookB: benchLook,
      },
      mall: {
        from: [e.x + 8, 3, e.z + 12],
        to: [e.x - 22, 20, e.z + 19],
        lookA: [e.x + 3, 1.7, e.z + 6],
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
      progress: Math.min(1, Math.max(0, time / duration)),
    };
  }
  function framedSample(time, anchors, reduced = false, portrait = false) {
    const frame = sample(time, anchors, reduced);
    if (portrait) {
      const distance =
        frame.phase === "life" && !reduced
          ? 11 - 6.5 * smooth((time - 2.1) / 3.4)
          : frame.phase === "mall" && !reduced
            ? 3 + 15 * smooth((time - 24) / 7)
            : ["credit", "gateway", "life"].includes(frame.phase)
              ? 11
              : frame.phase === "neighbors"
                ? 2
                : 18;
      const d = frame.position.map((v, i) => v - frame.look[i]);
      const length = Math.hypot(...d) || 1;
      frame.position = frame.position.map(
        (v, i) => v + (d[i] / length) * distance,
      );
    }
    return frame;
  }
  const api = {
    virtualTime,
    duration,
    phases,
    smooth,
    mix,
    at,
    sample,
    framedSample,
  };
  root.FZOpeningPlan = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
