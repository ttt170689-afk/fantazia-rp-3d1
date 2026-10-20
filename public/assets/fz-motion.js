/* Frame-rate independent native gravity + short-tap buffer. One input owner. */
(function (root) {
  "use strict";
  function integrate(y, v, dt, gravity) {
    const step = Math.max(0, Math.min(0.05, Number.isFinite(dt) ? dt : 0)) * 60;
    return {
      y: y + v * step - 0.5 * gravity * step * step,
      v: v - gravity * step,
    };
  }
  class JumpBuffer {
    constructor() {
      this.until = -Infinity;
    }
    press(now) {
      this.until = now + 160;
    }
    clear() {
      this.until = -Infinity;
    }
    take(now, grounded, held = false) {
      if (!grounded) return false;
      const fire = held || now <= this.until;
      if (fire) this.clear();
      return fire;
    }
  }
  const buffer = new JumpBuffer();
  const api = {
    integrate,
    JumpBuffer,
    press: () => buffer.press(performance.now()),
    clear: () => buffer.clear(),
    take: (grounded, held) => buffer.take(performance.now(), grounded, held),
  };
  root.FZMotion = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
