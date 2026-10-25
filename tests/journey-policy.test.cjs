const assert = require("node:assert/strict");
const P = require("../public/assets/fz-journey-policy.js");
const M = require("../public/assets/fz-motion.js");
for (const fps of [20, 30, 60, 120]) {
  let y = 0,
    v = 0.24;
  for (let i = 0; i < fps / 2; i++)
    ({ y, v } = M.integrate(y, v, 1 / fps, 0.016));
  assert(Math.abs(y) < 1e-12, `same flight length at ${fps}fps`);
  assert(Math.abs(v + 0.24) < 1e-12);
}
const a = M.integrate(0, 0.24, 1 / 30, 0.016),
  b = M.integrate(0, 0.24, 1 / 60, 0.016),
  c = M.integrate(b.y, b.v, 1 / 60, 0.016);
assert(Math.abs(a.y - c.y) < 1e-12 && Math.abs(a.v - c.v) < 1e-12);
const jump = new M.JumpBuffer();
jump.press(10);
assert(!jump.take(20, false));
assert(jump.take(25, true), "quick down/up stays queued");
assert(!jump.take(26, true));
jump.press(30);
assert(!jump.take(191, true));
jump.press(200);
jump.clear();
assert(!jump.take(201, true));
assert(jump.take(202, true, true), "hold retains classic repeat");
assert.deepEqual(P.clean(null), { lastCity: null, places: [], updatedAt: 0 });
assert.equal(P.point({ x: 0, z: Infinity }), null);
assert.equal(P.point({ x: 0, z: -1390 }), null);
assert.equal(P.point({ x: 551, z: 0 }), null);
const malformed = {
  lastCity: { x: 4, z: 5, admin: true },
  places: Array.from({ length: 40 }, (_, i) => ({
    id: String(i),
    x: 2,
    z: 3,
    label: "a".repeat(100),
  })),
  money: 999999,
  stageAllowed: true,
  password: "secret",
};
const clean = P.clean(malformed);
assert.equal(clean.places.length, 8);
assert.equal(clean.places[0].label.length, 40);
assert(!("money" in clean));
assert.deepEqual(clean.lastCity, { x: 4, z: 5 });
assert.deepEqual(
  P.guide({
    pending: { id: "first", index: 2 },
    completed: ["first", "lab"],
    favorites: ["mall", "mall", null],
  }),
  {
    favorites: ["mall"],
    visited: [],
    completed: ["first"],
    pending: { id: "first", index: 2 },
  },
);
for (const pending of [
  { id: "first", index: 3 },
  { id: "first", index: -1 },
  { id: "lab", index: 0 },
])
  assert.equal(P.guide({ pending }).pending, null);
const copy = JSON.stringify(
  P.pack("alice", malformed, { pending: { id: "business", index: 1 } }),
);
assert(!copy.includes("password"));
assert.equal(P.unpack(copy, "alice").journal.pending.index, 1);
assert.throws(() => P.unpack(copy, "bob"), /другому нику/);
assert.throws(() => P.unpack("{", "alice"), /JSON/);
assert.throws(() => P.unpack("{}", "alice"), /версии/);
assert.throws(() => P.unpack("a".repeat(65537), "alice"), /большой/);
const map = new Map(),
  storage = {
    getItem: (k) => map.get(k) || null,
    setItem: (k, v) => map.set(k, v),
  };
const store = new P.Store(storage, "alice");
assert.equal(store.read().lastCity, null);
assert(store.write({ lastCity: { x: 1, z: 1 } }));
assert(store.write({ lastCity: { x: 2, z: 2 } }));
assert.deepEqual(new P.Store(storage, "alice").read().lastCity, { x: 2, z: 2 });
map.set("alice:b", "{corrupt");
const recovered = new P.Store(storage, "alice");
assert.deepEqual(recovered.read().lastCity, { x: 1, z: 1 });
assert(recovered.recovered);
assert(recovered.write({ lastCity: { x: 3, z: 3 } }));
assert.deepEqual(new P.Store(storage, "alice").read().lastCity, { x: 3, z: 3 });
assert.equal(new P.Store(storage, "bob").read().lastCity, null);
const quota = new P.Store(
  {
    getItem: () => null,
    setItem: () => {
      throw Error("quota");
    },
  },
  "quota",
);
assert.equal(quota.write(clean), false);
assert(quota.failed);
console.log(
  "PASS v15: exact 20/30/60/120fps gravity, buffered/expired/cancelled jumps; bounded travel data, profile isolation, JSON validation, quota failure and previous-slot recovery.",
);
