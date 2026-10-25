const assert = require("node:assert/strict"),
  THREE = require("three"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  P = require("../public/assets/fz-sky-policy.js");
const root = new THREE.Group(),
  resources = new Set(),
  geometry = new THREE.BoxGeometry(1, 1, 1),
  base = new THREE.MeshStandardMaterial();
base.map = new THREE.Texture();
base.map.repeat.set(0.25, 0.25);
const M = Object.fromEntries(
  ["brass", "dark", "steel", "wood", "stone", "light"].map((k) => [k, base]),
);
const helpers = {
  box: (x, y, z) => {
    const o = new THREE.Mesh(geometry, base);
    o.position.set(x, y, z);
    root.add(o);
    return o;
  },
  rod: () => helpers.box(0, 0, 0),
};
let loadResolve;
const ctx = {
  THREE,
  FZSkyPolicy: P,
  FZLetterPortal: { load: () => new Promise((r) => (loadResolve = r)) },
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync("../public/assets/fz-sky-garden.js", "utf8"),
  ctx,
);
const garden = ctx.FZSkyGarden.create(root, resources, M, helpers);
assert.equal(garden.info().trees, 4);
assert.equal(garden.info().theme, "neon-cyan-magenta");
assert.equal(garden.info().pools, 2);
assert.equal(garden.info().leafInstances, 1120);
assert.equal(root.getObjectByName("sky_garden_leaves").count, 1120);
for (let t = 0; t < 100; t += 0.37) {
  garden.update(t, false);
  root.traverse((o) =>
    assert(
      o.position
        .toArray()
        .concat(o.quaternion.toArray())
        .every(Number.isFinite),
    ),
  );
}
garden.update(3, true);
const fixed = root.getObjectByName("sky_orbit_sculpture").quaternion.toArray();
garden.update(78, true);
assert.deepEqual(
  root.getObjectByName("sky_orbit_sculpture").quaternion.toArray(),
  fixed,
);
for (const p of [...P.gardenPools, ...P.gardenTrees, ...P.gardenSupports]) {
  assert(P.blocked(p.x, P.deck.z + p.z, false));
  assert(
    P.blocked(p.x, P.deck.z + p.z, true),
    "admin cannot walk through physical planters",
  );
}
// Reachability on a half-metre grid. Routes to the news, stage action and stair entry
// must remain public, around the visible planters rather than through them.
const seen = new Set(),
  queue = [[0, 10]],
  key = (x, z) => `${x},${z}`;
seen.add(key(0, 10));
for (let i = 0; i < queue.length; i++) {
  const [x, z] = queue[i];
  for (const [dx, dz] of [
    [0.5, 0],
    [-0.5, 0],
    [0, 0.5],
    [0, -0.5],
  ]) {
    const nx = x + dx,
      nz = z + dz,
      k = key(nx, nz);
    if (!seen.has(k) && !P.blocked(nx, P.deck.z + nz, false)) {
      seen.add(k);
      queue.push([nx, nz]);
    }
  }
}
for (const target of [
  [14, -10.5],
  [0, -10],
  [18, 7.5],
  [-17, 8],
])
  assert(seen.has(key(...target)), "public route " + target);
const before = resources.size;
garden.dispose();
const font = new THREE.FontLoader().parse(
  require("../public/fonts/helvetiker_bold.typeface.json"),
);
loadResolve(font);
Promise.resolve()
  .then(() => {
    assert.equal(
      resources.size,
      before,
      "late font load cannot append to a disposed garden",
    );
    resources.forEach((r) => r.dispose?.());
    geometry.dispose();
    base.dispose();
    console.log(
      "PASS sky garden: finite animation, 1120 instanced leaves, reduced motion, matching shared collisions, public route connectivity, cancelled async font lifetime.",
    );
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
