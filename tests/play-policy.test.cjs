const assert = require("node:assert/strict");
const P = require("../public/assets/fz-play-policy");
assert.deepEqual(P.clean(null), P.defaults);
const dirty = P.clean({
  quality: "ultra-hacked",
  size: 9,
  opacity: -4,
  leftHand: "yes",
  haptics: true,
  account: { money: 1e9 },
});
assert.equal(dirty.quality, "auto");
assert.equal(dirty.size, 1.2);
assert.equal(dirty.opacity, 0.5);
assert.equal(dirty.leftHand, false);
assert(!("account" in dirty));
assert.equal(P.clean({ size: NaN, opacity: Infinity }).size, 1);
assert.equal(P.clean({ neonBrightness: -8 }).neonBrightness, 0.35);
assert.equal(P.clean({ neonBrightness: 8 }).neonBrightness, 1.3);
assert.equal(P.clean({ neonBrightness: Infinity }).neonBrightness, 1);
assert.equal(
  P.clean({ neonBrightness: ".5", neonMotion: "false" }).neonBrightness,
  1,
);
assert.equal(P.clean({ neonMotion: "false" }).neonMotion, true);
assert.equal(P.clean({ neonMotion: false }).neonMotion, false);
assert.equal(P.choose(P.defaults, false), null);
assert.equal(P.choose(P.defaults, true, 4, 8).id, "battery");
assert.equal(P.choose(P.defaults, true, 8, 8).id, "balanced");
assert.equal(P.choose(P.clean({ quality: "quality" }), true).cap, 60);
assert.equal(P.choose(P.clean({ quality: "custom" }), true), null);
assert.equal(P.delta(120), 0.05);
assert.equal(P.delta(-2), 0);
assert.equal(P.delta(NaN), 0);
const a = new P.Resolution(1, 30);
let t = 0;
for (let i = 0; i < 180; i++) {
  t += 50;
  a.sample(t);
}
assert(
  a.ratio < 1 && a.ratio >= 0.65,
  "sustained slow rendering reduces resolution",
);
const low = a.ratio;
for (let i = 0; i < 1000; i++) {
  t += 1000 / 30;
  a.sample(t);
}
assert(
  a.ratio > low && a.ratio <= 1,
  "30fps profile recovers at 30, not impossible 56fps",
);
const stable = a.ratio;
a.sample(t + 100000);
assert.equal(a.ratio, stable, "background gap is not a bad-FPS vote");
a.sample(t + 100100, false);
assert.equal(a.last, null);
for (let i = 0; i < 10000; i++) {
  t += 100;
  a.sample(t);
}
assert(a.ratio >= 0.65);
console.log(
  "PASS play policy: validated preferences, mobile profiles, hysteresis, 30fps recovery, pause and delta",
);
