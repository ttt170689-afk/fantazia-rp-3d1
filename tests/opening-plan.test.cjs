const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  acorn = require("acorn");
const P = require("../public/assets/fz-opening-plan.js");
const anchors = {
  square: { x: 131, z: -30 },
  bench: { x: 117, z: -24, rot: -Math.PI / 2 },
  mall: { x: 131, z: -129 },
  entrance: { x: 131, z: -76 },
};
assert.equal(P.duration, 7);
assert.equal(P.at(0).id, "credit");
assert.equal(P.at(1.2).id, "gateway");
assert.equal(P.at(2.1).id, "life");
assert.equal(P.at(7).id, "title");
for (const reduced of [true, false])
  for (const t of [NaN, -3, 0, 2.8, 5.4, 11.4, 16, 23, 28, 33, 99]) {
    const s = P.sample(t, anchors, reduced);
    assert(s.position.every(Number.isFinite));
    assert(s.look.every(Number.isFinite));
    assert(s.progress >= 0 && s.progress <= 1);
  }
for (let i = 1; i < P.phases.length; i++)
  assert.equal(P.phases[i - 1].end, P.phases[i].start);
assert.deepEqual(
  P.sample(6, anchors, true).position,
  P.sample(8, anchors, true).position,
  "reduced motion has no camera flight",
);
const shift = JSON.parse(JSON.stringify(anchors));
for (const p of Object.values(shift)) {
  p.x += 20;
  p.z -= 10;
}
for (let t = 0; t < P.duration; t += 0.25) {
  const a = P.sample(t, anchors),
    b = P.sample(t, shift);
  assert(Math.abs(b.position[0] - a.position[0] - 20) < 1e-8);
  assert(Math.abs(b.position[2] - a.position[2] + 10) < 1e-8);
}
const front = fs.readFileSync("../public/assets/fz-front.js", "utf8");
assert(!front.includes("new THREE.Scene("));
assert(!front.includes("new THREE.WebGLRenderer("));
assert(!front.includes("FZLandmarks.mall("));
assert(!front.includes("initSocket("));
for (const f of [
  "fz-front.js",
  "fz-opening-plan.js",
  "fz-opening-cast.js",
  "fz-letter-portal.js",
])
  acorn.parse(fs.readFileSync("../public/assets/" + f, "utf8"), {
    ecmaVersion: "latest",
  });
const html = fs.readFileSync("../public/index.html", "utf8");
for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))
  if (match[1].trim())
    acorn.parse(match[1], {
      ecmaVersion: "latest",
      allowReturnOutsideFunction: true,
    });
console.log(
  "PASS opening: finite/continuous timeline, live-anchor camera offsets, reduced motion, native scene/renderer ownership, no cloned skyline/network; all inline scripts parse.",
);
