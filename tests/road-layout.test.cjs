const assert = require("node:assert/strict");
const L = require("../public/assets/fz-road-layout.js");
const THREE = require("three");
L.begin();
const initial = JSON.stringify(L.plots);
assert.deepEqual(L.spawn, { x: 131, z: -30 });
assert.equal(L.quarter.length, 16);
assert(L.hit(L.rect(260, 100, 2, 2)), "quarter avenue is protected");
assert(L.hit(L.rect(180, 156, 2, 2)), "quarter connects to the original city");
assert(
  !L.hit(L.rect(260, -100, 2, 2)),
  "finite avenue is not extended through mall and lake",
);
const fs = require("node:fs"),
  path = require("node:path");
const html = fs.readFileSync(
  path.join(__dirname, "../public/index.html"),
  "utf8",
);
const server = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
assert.match(html, /const SPAWN_POINT = \{ x: 131, z: -30 \}/);
assert.match(server, /position: \{ \.\.\.SkyPolicy.spawn \}/);
assert(
  !html.includes("function buildDesert("),
  "desert generator is no longer part of the city",
);
assert(!html.includes("_mergeDecor(buildDesert"), "desert never built");

assert(L.hit(L.rect(85, -85, 120, 100)), "original mall crossed streets");
assert(L.hit(L.rect(-430, 0, 34, 26)), "old laboratory straddled central road");
assert(L.hit(L.rect(60, 30, 1, 1)), "perpendicular road, not only origin axes");
assert(L.hit(L.rect(9.5, 100, 0.8, 0.8)), "full 3.4m sidewalk is protected");
assert(
  !L.hit(L.rect(9.5, 100, 0.8, 0.8), false),
  "sidewalk is not carriageway",
);
assert(
  !L.hit(L.rect(260, -180, 30, 30)),
  "bypass does not cut through the lake",
);
assert(L.hit(L.rect(370, 150, 2, 2)), "perimeter road is protected");
for (const p of L.plots) assert(!L.hit(p.bounds), p.id);
for (const road of L.roads.filter((r) => r.walk)) {
  const segments = L.segments(
    road.axis === "z",
    road.center,
    road.length,
    road.along || 0,
  );
  for (const [a, b] of segments)
    for (const r of L.roads.filter(
      (r) =>
        r.axis !== road.axis &&
        Math.abs(road.center - (r.along || 0)) <= r.length / 2,
    ))
      assert(
        !(a < r.center + r.half && b > r.center - r.half),
        "kerb must stop at crossing",
      );
}
assert.equal(
  L.find(0, 0, 8000, 8000, { limit: 4 }),
  null,
  "never return unsafe fallback",
);
assert.throws(
  () => L.reserve("impossible", 0, 0, 8000, 8000, { limit: 4 }),
  /No safe parcel/,
);
const space = L.businesses[3];
const body = L.withOwner(space.id, () =>
  L.building(space.x, space.z, 20, 16, "space"),
);
assert.equal(body.x, space.x);
assert.equal(body.z, space.z);
assert(
  L.free(space.x + 25, space.z, 18, 22, space.id),
  "launchpad and tank apron",
);
assert.throws(() =>
  L.withOwner(space.id, () => {
    throw Error("test");
  }),
);
assert(!L.free(space.x, space.z, 2, 2), "context restored after exception");
for (let i = 0; i < 70; i++) {
  const p = L.building(
    Math.sin(i * 23) * 180,
    Math.cos(i * 17) * 180,
    12,
    10,
    "fixture-" + i,
  );
  assert(!L.hit(p.bounds));
}
for (let i = 0; i < L.plots.length; i++)
  for (let j = 0; j < i; j++)
    assert(
      !L.overlaps(L.plots[i].bounds, L.plots[j].bounds),
      "parcels are disjoint",
    );
L.begin();
assert.equal(
  JSON.stringify(L.plots),
  initial,
  "rebuild is deterministic and clears reservations",
);
// Regression: InstancedMesh uses instance transforms, not a bogus box at world origin.
globalThis.THREE = THREE;
globalThis.FZ_LAYOUT_AUDIT = true;
const m = new THREE.InstancedMesh(
  new THREE.BoxGeometry(2, 2, 2),
  new THREE.MeshBasicMaterial(),
  1,
);
m.setMatrixAt(0, new THREE.Matrix4().makeTranslation(100, 1, 100));
L.observe([m], "fixture");
assert.equal(L.observations.length, 0);
m.setMatrixAt(0, new THREE.Matrix4().makeTranslation(60, 1, 100));
L.observe([m], "fixture");
assert.equal(L.observations.length, 1);
assert.equal(L.observations[0].bounds.minX, 59);
console.log(
  "road-layout unit PASS: corridors, parcels, bypass, failed placement, instances",
);
