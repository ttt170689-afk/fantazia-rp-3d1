const assert = require("node:assert/strict");
const T = require("../public/assets/fz-residence-tasks.js");
for (const raw of [
  null,
  {},
  [],
  {
    active: { id: "hack", floor: 999, day: "x" },
    done: ["bad"],
    badges: ["bad"],
  },
  { active: { id: "parcel", floor: -1, day: "2026-10-23" } },
]) {
  const s = T.clean(raw);
  assert.equal(s.active, null);
  assert.equal(s.done.length, 0);
  assert.equal(s.badges.length, 0);
}
let saved = 0,
  notifications = [],
  receipts = [],
  choices = [];
const light = {
  id: "3:-1",
  on: true,
  lamp: { intensity: 0.8 },
  bulb: { material: { color: { setHex() {} } } },
};
const ctx = {
  k: { floors: 4, switches: [light] },
  store: {
    data: { tasks: T.fresh(), lights: {} },
    save() {
      saved++;
      return true;
    },
  },
  notify: (t) => notifications.push(t),
  receipt: (t) => receipts.push(t),
  close() {},
  modal(title, text, list = []) {
    choices = list;
  },
};
assert(T.start(ctx, "parcel"));
assert.equal(ctx.store.data.tasks.active.floor, 3);
assert(!T.start(ctx, "lamp"), "one active errand");
assert(!T.event(ctx, "doorbell", { number: 101 }));
assert(T.event(ctx, "doorbell", { number: 401 }));
assert.equal(ctx.store.data.tasks.active, null);
assert.equal(receipts.length, 1);
assert(
  !T.event(ctx, "doorbell", { number: 401 }),
  "repeated input does not award twice",
);
assert(!T.start(ctx, "parcel"), "completed job is not repeatable same day");
assert(T.start(ctx, "lamp"));
assert.equal(light.on, false);
assert.equal(light.lamp.intensity, 0);
assert.equal(ctx.store.data.lights["3:-1"], false);
assert(!T.event(ctx, "roomLight", { light }));
light.on = true;
assert(T.event(ctx, "roomLight", { light }));
assert(T.start(ctx, "recycle"));
assert(!T.event(ctx, "trash", { amount: 3, recycle: false }));
assert.equal(ctx.store.data.tasks.active.progress, 0);
assert(!T.event(ctx, "trash", { amount: 1, recycle: true }));
assert.equal(ctx.store.data.tasks.active.progress, 1);
assert(T.event(ctx, "trash", { amount: 2, recycle: true }));
assert.equal(ctx.store.data.tasks.badges.length, 3);
assert.equal(receipts.length, 3);
assert(saved >= 6);
T.menu(ctx);
assert(choices.every((c) => c.disabled));
const recovered = T.clean(JSON.parse(JSON.stringify(ctx.store.data.tasks)));
assert.deepEqual(recovered, ctx.store.data.tasks);
ctx.store.data.tasks = T.fresh();
assert(T.start(ctx, "parcel"));
T.menu(ctx);
choices.find((c) => c.label.includes("Отменить")).run();
assert.equal(ctx.store.data.tasks.active, null);
assert(T.start(ctx, "parcel"), "cancelled unfinished task may restart");
assert.equal(
  typeof ctx.store.data.money,
  "undefined",
  "errands never invent a second wallet",
);
T.release();
T.release();
console.log(
  "PASS residence28: malformed saves, daily limits, one active task, physical destination rules, light repair, recycling progress, cancellation, persistence and no cash farming",
);
