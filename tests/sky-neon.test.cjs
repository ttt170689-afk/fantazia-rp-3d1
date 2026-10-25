const assert = require("node:assert/strict"),
  THREE = require("three"),
  P = require("../public/assets/fz-sky-policy.js");
global.THREE = THREE;
global.document = {
  createElement: () => ({
    getContext: () => ({ fillRect() {}, fillText() {} }),
  }),
};
const N = require("../public/assets/fz-sky-neon.js");
assert.deepEqual(N.settings(null), { strength: 1, motion: true });
assert.equal(N.settings({ neonBrightness: NaN }).strength, 1);
assert.equal(N.settings({ neonBrightness: 9 }).strength, 1.3);
assert.equal(N.settings({ neonBrightness: -2 }).strength, 0.35);
for (const args of [
  [{ neonMotion: false }, false, false],
  [{}, true, false],
  [{}, false, true],
])
  assert.equal(N.settings(...args).motion, false);
for (let i = 0; i < 24; i++)
  for (let t = 0; t < 20; t += 0.01) {
    const h = N.height(t, i);
    assert(h >= 0.3 - 1e-12 && h <= 1.3 + 1e-12);
    assert(
      Math.abs(N.height(t + 0.01, i) - h) < 0.01,
      "slow geometric wave, no strobing",
    );
  }
assert(Number.isFinite(N.height(NaN, Infinity)));
for (const route of N.routes) {
  const points = [...route.points, route.end];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i],
      b = points[i + 1];
    for (let k = 0; k <= 100; k++) {
      const x = a[0] + ((b[0] - a[0]) * k) / 100,
        z = a[1] + ((b[1] - a[1]) * k) / 100;
      assert(
        !P.blocked(x, P.deck.z + z, false),
        route.id + " leads into a collider at " + [x, z],
      );
    }
  }
}
const root = new THREE.Group(),
  scope = new Set(),
  a = new THREE.MeshBasicMaterial({ color: 0x4080ff }),
  e = new THREE.MeshStandardMaterial({
    emissive: 0x4080ff,
    emissiveIntensity: 2,
  }),
  label = new THREE.MeshBasicMaterial({ color: 0xffffff });
a.userData.fzNeon = e.userData.fzNeon = true;
scope.add(a);
scope.add(e);
scope.add(label);
const initial = a.color.clone(),
  neon = N.create(root, scope, P);
assert.equal(neon.info().routeArrows, 13);
assert.equal(neon.info().stageBars, 24);
neon.root.traverse((o) => assert.equal(o.layers.mask, 4));
for (const r of N.routes) {
  const arrows = neon.root.children.filter(
    (o) => o.name === "sky_route_" + r.id,
  );
  assert.equal(arrows.length, r.points.length);
  arrows.forEach((o, i) => {
    const [x, z] = r.points[i],
      next = r.points[i + 1] || r.end;
    assert.equal(
      o.position.y,
      P.ground(x, P.deck.z + z, false) - P.deck.y + 0.045,
    );
    const forward = new THREE.Vector3(0, 1, 0).applyQuaternion(o.quaternion),
      wanted = new THREE.Vector3(next[0] - x, 0, next[1] - z).normalize();
    assert(
      forward.distanceTo(wanted) < 1e-8,
      "arrow points toward next safe segment",
    );
  });
}
for (let i = 0; i < 10; i++) neon.update(i, { neonBrightness: 0.35 });
assert(
  a.color
    .toArray()
    .every((v, i) => Math.abs(v - initial.toArray()[i] * 0.35) < 1e-10),
);
assert.equal(e.emissiveIntensity, 0.7);
assert.equal(label.color.getHex(), 0xffffff, "readable text must not dim");
neon.update(11, { neonBrightness: 1.3 }, false, false, {
  x: 14,
  y: 360,
  z: -1411,
});
assert.equal(neon.info().selected, "news");
for (const r of scope)
  if (r.isMaterial) assert(r.opacity <= 1 && r.opacity >= 0);
const bars = neon.root.getObjectByName("sky_stage_light_wave");
neon.update(12, {}, true);
const still = Array.from(bars.instanceMatrix.array);
neon.update(50, {}, true);
assert.deepEqual(Array.from(bars.instanceMatrix.array), still);
assert(!neon.info().motion);
neon.update(51, {}, false);
assert.notDeepEqual(Array.from(bars.instanceMatrix.array), still);
neon.update(52, {}, false, true);
const battery = Array.from(bars.instanceMatrix.array);
neon.update(65, {}, false, true);
assert.deepEqual(Array.from(bars.instanceMatrix.array), battery);
const late = new THREE.MeshBasicMaterial({ color: 0x123456 });
late.userData.fzNeon = true;
scope.add(late);
neon.update(66, { neonBrightness: 0.5 });
assert(
  Math.abs(late.color.r - (0x12 / 255) * 0.5) < 1e-12,
  "late owned material discovered",
);
neon.dispose();
neon.dispose();
assert.equal(root.children.length, 0);
assert(a.color.equals(initial));
assert.equal(e.emissiveIntensity, 2);
assert.equal(late.color.getHex(), 0x123456);
assert.equal(neon.info().trackedMaterials, 0);
neon.update(90, { neonBrightness: 0.35 });
assert(a.color.equals(initial));
scope.forEach((r) => r.dispose?.());
console.log(
  "PASS sky neon: safe public routes and arrow directions/tread heights, bounded brightness, unchanged text, slow instanced wave, motion/reduced/battery guards, late materials, restoration and idempotent disposal.",
);
