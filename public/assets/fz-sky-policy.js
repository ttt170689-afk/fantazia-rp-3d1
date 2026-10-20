/* Shared geometry/security boundaries: used by browser AND Socket.IO server. */
(function (root) {
  "use strict";
  const deck = { x: 0, y: 360, z: -1400, r: 31 },
    spawn = { x: 0, y: 360, z: -1390 },
    stage = { x: 0, z: -1417, w: 14, d: 10, h: 1.2 };
  const finite = (p) =>
    p && ["x", "y", "z"].every((k) => Number.isFinite(p[k]));
  function region(p) {
    return (
      finite(p) &&
      p.y > deck.y - 12 &&
      Math.hypot(p.x - deck.x, p.z - deck.z) < 120
    );
  }
  function onStage(p, pad = 0) {
    return (
      finite(p) &&
      p.y >= deck.y - 5 &&
      Math.abs(p.x - stage.x) < stage.w / 2 + pad &&
      Math.abs(p.z - stage.z) < stage.d / 2 + pad
    );
  }
  function blocked(x, z, allowed) {
    const dz = z - deck.z;
    if(dz>8 && dz<18 && [15.3,20.7].some(px=>Math.abs(x-px)<.6)) return true;
    const furniture =
      (Math.abs(x + 20) < 3 &&
        (Math.abs(dz + 5) < 0.95 || Math.abs(dz - 8) < 0.95)) ||
      (Math.abs(x) < 8 && Math.abs(dz + 22) < 0.85) ||
      [15.3, 20.7].some((px) => Math.hypot(x - px, dz - 18) < 0.85);
    return (
      furniture ||
      Math.hypot(x - deck.x, z - deck.z) > deck.r - 1.6 ||
      (!allowed && onStage({ x, y: deck.y, z }, 0.6)) ||
      (Math.abs(x - 14) < 3 && Math.abs(z - (deck.z - 13)) < 0.8)
    );
  }
  function ground(x, z, allowed) {
    if (allowed && onStage({ x, y: deck.y, z }, 0.3)) return deck.y + stage.h;
    if (Math.abs(x - 18) < 2.6 && z > deck.z + 8 && z < deck.z + 18)
      return (
        deck.y - Math.min(8, Math.floor((z - deck.z - 8) / 1.1) + 1) * 0.25
      );
    return deck.y;
  }
  function position(p, previous, allowed) {
    if (!finite(p)) return finite(previous) ? { ...previous } : { ...spawn };
    if (onStage(p, 0.6) && !allowed) return { ...spawn };
    if (region(p) && Math.hypot(p.x - deck.x, p.z - deck.z) > deck.r - 1.6)
      return { ...spawn };
    return { x: p.x, y: p.y, z: p.z };
  }
  const api = {
    deck,
    spawn,
    stage,
    region,
    onStage,
    blocked,
    ground,
    position,
  };
  root.FZSkyPolicy = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
