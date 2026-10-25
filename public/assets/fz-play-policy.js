/* Pure, testable phone preferences and adaptive-resolution policy. */
(function (root) {
  "use strict";
  const defaults = {
    quality: "auto",
    leftHand: false,
    size: 1,
    opacity: 0.9,
    haptics: false,
    reduceMotion: false,
    keepAwake: false,
    neonBrightness: 1,
    neonMotion: true,
  };
  const profiles = {
    battery: {
      ratio: 0.75,
      cap: 30,
      distance: 200,
      grass: 0,
      lights: 4,
      fx: "off",
    },
    balanced: {
      ratio: 1,
      cap: 30,
      distance: 280,
      grass: 1,
      lights: 4,
      fx: "low",
    },
    quality: {
      ratio: 1.5,
      cap: 60,
      distance: 420,
      grass: 2,
      lights: 8,
      fx: "medium",
    },
  };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function clean(raw) {
    const v = raw && typeof raw === "object" ? raw : {};
    const out = { ...defaults };
    if (
      ["auto", "battery", "balanced", "quality", "custom"].includes(v.quality)
    )
      out.quality = v.quality;
    for (const k of [
      "leftHand",
      "haptics",
      "reduceMotion",
      "keepAwake",
      "neonMotion",
    ])
      if (typeof v[k] === "boolean") out[k] = v[k];
    if (Number.isFinite(v.size)) out.size = clamp(v.size, 0.85, 1.2);
    if (Number.isFinite(v.opacity)) out.opacity = clamp(v.opacity, 0.5, 1);
    if (Number.isFinite(v.neonBrightness))
      out.neonBrightness = clamp(v.neonBrightness, 0.35, 1.3);
    return out;
  }
  function choose(p, mobile, cores = 8, memory = 8) {
    if (p.quality === "custom" || (p.quality === "auto" && !mobile))
      return null;
    const id =
      p.quality === "auto"
        ? cores <= 4 || memory <= 3
          ? "battery"
          : "balanced"
        : p.quality;
    return {
      ...profiles[id],
      id,
      adaptive: id === "balanced" || (p.quality === "auto" && id !== "battery"),
    };
  }
  class Resolution {
    constructor(max = 1, target = 30) {
      this.reset(max, target);
    }
    reset(max, target) {
      this.max = clamp(max, 0.65, 2);
      this.ratio = this.max;
      this.target = target || 60;
      this.last = null;
      this.ms = 0;
      this.frames = 0;
      this.good = 0;
      this.bad = 0;
      this.fps = null;
    }
    pause() {
      this.last = null;
      this.ms = 0;
      this.frames = 0;
      this.good = 0;
      this.bad = 0;
    }
    sample(now, active = true) {
      if (!active || !Number.isFinite(now)) {
        this.pause();
        return null;
      }
      if (this.last === null) {
        this.last = now;
        return null;
      }
      const dt = now - this.last;
      this.last = now;
      if (dt <= 0 || dt > 1000) {
        this.pause();
        return null;
      }
      this.ms += dt;
      this.frames++;
      if (this.ms < 3000) return null;
      this.fps = (this.frames * 1000) / this.ms;
      this.ms = 0;
      this.frames = 0;
      this.bad = this.fps < this.target * 0.78 ? this.bad + 1 : 0;
      this.good = this.fps > this.target * 0.96 ? this.good + 1 : 0;
      let next = this.ratio;
      if (this.bad >= 2) {
        next = Math.max(0.65, this.ratio - 0.1);
        this.bad = 0;
        this.good = 0;
      } else if (this.good >= 4) {
        next = Math.min(this.max, this.ratio + 0.05);
        this.good = 0;
      }
      next = Math.round(next * 100) / 100;
      if (next === this.ratio) return null;
      this.ratio = next;
      return next;
    }
  }
  const api = {
    defaults,
    profiles,
    clean,
    choose,
    Resolution,
    delta: (value) => (Number.isFinite(value) ? clamp(value, 0, 0.05) : 0),
  };
  root.FZPlayPolicy = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
