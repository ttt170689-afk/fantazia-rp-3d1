const assert = require("node:assert/strict"),
  THREE = require("three");
global.THREE = THREE;
const D = require("../public/assets/fz-sky-descent");
const resources = new Set(),
  root = new THREE.Group(),
  maps = { cloud: new THREE.Texture(), glow: new THREE.Texture() };
let borrowedDisposed = 0;
Object.values(maps).forEach((t) =>
  t.addEventListener("dispose", () => borrowedDisposed++),
);
const descent = D.create(root, resources, maps),
  group = root.getObjectByName("sky_stair_clouds");
assert(group);
assert.equal(descent.info().wall, false);
assert.equal(group.getObjectByName("stair_light_spill").castShadow, false);
assert.equal(
  group.getObjectByName("stair_white_light").material.toneMapped,
  false,
);
const before = group.children.map((o) => o.position.toArray());
descent.update(20, true);
assert.deepEqual(
  group.children.map((o) => o.position.toArray()),
  before,
  "reduced motion stays static",
);
for (let t = 0; t < 300; t += 0.17) {
  descent.update(t);
  assert.equal(descent.info().light, 3.2, "constant light, no flashing");
  group.traverse((o) => assert(o.position.toArray().every(Number.isFinite)));
}
descent.update(NaN, true, true);
assert.equal(descent.info().clouds, 9, "bounded mobile/battery cloud count");
assert.equal(
  resources.size,
  2,
  "shares existing textures, only two own materials",
);
let disposed = 0;
resources.forEach((r) => r.addEventListener("dispose", () => disposed++));
descent.dispose();
descent.dispose();
assert.equal(disposed, 2);
assert.equal(resources.size, 0);
assert.equal(root.children.length, 0);
assert.equal(borrowedDisposed, 0);
console.log(
  "PASS stair clouds: visible local light, no wall, static reduced motion, bounded puffs and owned-only disposal",
);
