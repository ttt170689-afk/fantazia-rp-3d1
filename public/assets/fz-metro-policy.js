(function (root) {
  "use strict";
  const stations = [
    {
      id: "center",
      name: "Центральная",
      color: 0x79cfff,
      x: 177,
      z: -25,
      exit: "Городская площадь · GRAND MALL",
    },
    {
      id: "factory",
      name: "Заводская",
      color: 0xffae78,
      x: 330,
      z: 35,
      exit: "Промышленный район",
    },
    {
      id: "park",
      name: "Парковая",
      color: 0x8eddb9,
      x: 230,
      z: 210,
      exit: "Городской парк",
    },
    {
      id: "port",
      name: "Портовая",
      color: 0x78bbff,
      x: -225,
      z: 225,
      exit: "Набережная",
    },
    {
      id: "business",
      name: "Деловая",
      color: 0xccabff,
      x: 245,
      z: -220,
      exit: "Деловой район",
    },
  ];
  const origin = { x: -2400, z: -2400 },
    duration = { arriving: 12, open: 14, closing: 4, travel: 12, away: 18 };
  function next(i) {
    return (i + 1) % stations.length;
  }
  function advance(state, elapsed, dt) {
    const e =
      elapsed + Math.min(0.1, Math.max(0, Number.isFinite(dt) ? dt : 0));
    return e >= duration[state]
      ? {
          state: {
            arriving: "open",
            open: "closing",
            closing: "travel",
            travel: "arriving",
            away: "arriving",
          }[state],
          elapsed: e - duration[state],
          changed: true,
        }
      : { state, elapsed: e, changed: false };
  }
  function door(x) {
    return [-8, 0, 8].some((d) => Math.abs(x - d) < 0.88);
  }
  function blocked(x, z, riding = false, open = false) {
    const platform =
      Math.abs(x) <= 22.3 &&
      z >= -1.6 &&
      z <= 12.2 &&
      ![-16, -8, 8, 16].some((cx) => Math.hypot(x - cx, z - 6) < 0.72) &&
      !(
        [-15, 15].some((cx) => Math.abs(x - cx) < 2.5) && Math.abs(z - 10) < 0.9
      );
    const stairs = Math.abs(x) < 2.35 && z >= 12 && z <= 28.5;
    const carriage = Math.abs(x) < 12.5 && z >= -5.85 && z <= -2.35;
    const doorway = door(x) && z >= -2.85 && z <= -1.0;
    return !(open
      ? platform || stairs || carriage || doorway
      : riding
        ? carriage
        : platform || stairs);
  }
  function ground(z) {
    return -8 + Math.min(8, Math.max(0, ((z - 13) * 8) / 12));
  }
  const api = {
    stations,
    origin,
    duration,
    next,
    advance,
    blocked,
    door,
    ground,
  };
  root.FZMetroPolicy = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
