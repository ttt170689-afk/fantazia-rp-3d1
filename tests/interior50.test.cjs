"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const P = require("../public/assets/fz-interior50-policy");
const C = require("../public/assets/fz-interior50-catalog");
const { create, files } = require("./interior50.fixture.cjs");

test("queue: all service types, repeated issue, early/wrong-window rejection and explicit finish", () => {
  const state = P.createQueue();
  for (const service of P.services) {
    assert.equal(P.issue(state, "invented").reason, "unknown");
    assert.equal(P.serve(state, 1).reason, "missing");
    const result = P.issue(state, service.id);
    assert(result.ok);
    assert.equal(result.ticket.window, service.window);
    assert(result.ticket.code.startsWith(service.prefix));
    assert.equal(P.issue(state, service.id).reason, "active");
    assert.equal(P.serve(state, service.window).reason, "waiting");
    assert.equal(P.finish(state), false);
    for (let i = 0; i < 60; i++) P.queueStep(state, 0.05);
    assert.equal(state.ticket.status, "called");
    assert.equal(P.serve(state, (service.window % 3) + 1).reason, "window");
    assert(P.serve(state, service.window).ok);
    assert(
      P.serve(state, service.window).ok,
      "service can be resumed after account UI closes",
    );
    assert(P.finish(state));
    assert.equal(state.ticket, null);
    assert.equal(P.finish(state), false);
  }
  assert.equal(state.history.length, 3);
});

test("queue is bounded, cancelling never records a completed service, timing is frame-rate independent", () => {
  for (const hz of [4, 10, 15, 30, 60, 144]) {
    const q = P.createQueue();
    P.issue(q, "cash");
    let calls = 0;
    for (let i = 0; i < hz * 4; i++) calls += Number(P.queueStep(q, 1 / hz));
    assert.equal(calls, 1, "only one call at " + hz + " Hz");
    assert.equal(q.ticket.status, "called");
    assert(P.cancel(q));
    assert.equal(q.history.length, 0);
    assert.equal(P.cancel(q), false);
  }
  const q = P.createQueue();
  q.sequence = 999;
  assert.equal(P.issue(q, "cash").ticket.code, "К001");
  for (const value of [NaN, Infinity, -1, undefined, "5"])
    P.queueStep(q, value);
  assert.equal(q.ticket.wait, 3);
  P.queueStep(q, 999999);
  assert.equal(
    q.ticket.wait,
    2.75,
    "background gaps cannot consume the whole queue",
  );
  for (let i = 0; i < 12; i++) {
    if (!q.ticket) P.issue(q, "account");
    for (let n = 0; n < 16; n++) P.queueStep(q, 0.25);
    P.serve(q, q.ticket.window);
    P.finish(q);
  }
  assert.equal(q.history.length, 8);
});

test("devices: auto-stop, smooth hinges, bounded cycles and repeat toggle", () => {
  assert.equal(P.device("unregistered"), null);
  assert.equal(P.toggleDevice({ type: "unregistered" }), false);
  for (const type of Object.keys(P.devices)) {
    for (const hz of [4, 10, 15, 30, 60, 144]) {
      const state = P.device(type);
      assert.equal(state.on, false);
      assert(P.toggleDevice(state));
      let completed = 0;
      for (let i = 0; i < hz * 17; i++) {
        completed += Number(P.deviceStep(state, 1 / hz));
        assert(state.amount >= 0 && state.amount <= 1);
        assert(Number.isFinite(state.remaining));
      }
      if (P.devices[type].duration) {
        assert.equal(state.on, false, type + " stops at " + hz);
        assert.equal(completed, 1);
        assert.equal(state.cycles, 1);
      } else {
        assert.equal(state.on, true);
        assert.equal(completed, 0);
        assert(P.toggleDevice(state));
        assert.equal(state.on, false);
      }
    }
  }
  const state = P.device("tap");
  P.toggleDevice(state);
  for (const value of [NaN, Infinity, -Infinity, -1, "1"])
    P.deviceStep(state, value);
  assert.equal(state.remaining, 8);
  P.toggleDevice(state);
  assert.equal(state.remaining, 0);
  assert.equal(state.cycles, 0, "cancelling is not a completed cycle");
});

test("local notes use a bounded whitelist and isolate profile/building, never store money", () => {
  for (const raw of [
    null,
    [],
    "bad",
    1,
    { visits: Infinity },
    {
      visits: -100,
      read: ["__proto__", "bank-safety", "bank-safety", "fake"],
      completed: ["water", "water", "owner"],
      money: 999999,
      admin: true,
      preferences: { hints: false },
    },
  ]) {
    const result = P.clean(raw);
    assert(result.visits >= 0 && result.visits <= 999);
    assert.equal(result.version, 50);
    assert(!("money" in result));
    assert(!("admin" in result));
    assert(!result.read.includes("fake"));
  }
  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key),
    setItem: (key, value) => memory.set(key, value),
  };
  const a = new P.Store(storage, "alice", "bank:100:100");
  a.data.completed.push("water");
  assert(a.save());
  assert.deepEqual(
    new P.Store(storage, "alice", "bank:100:100").data.completed,
    ["water"],
  );
  assert.deepEqual(
    new P.Store(storage, "bob", "bank:100:100").data.completed,
    [],
  );
  assert.deepEqual(
    new P.Store(storage, "alice", "bank:200:100").data.completed,
    [],
  );
  const blocked = new P.Store(
    {
      getItem() {
        throw Error();
      },
      setItem() {
        throw Error();
      },
    },
    "a",
    "b",
  );
  assert.equal(blocked.ok, false);
  assert.equal(blocked.save(), false);
  const oversized = new P.Store(
    { getItem: () => " ".repeat(20000), setItem() {} },
    "a",
    "b",
  );
  assert.equal(oversized.data.visits, 0);
});

test("catalog: semantic rooms and doors, valid geometry, no navigation into restricted areas", () => {
  for (const [type, floors, count] of [
    ["bank", 1, 13],
    ["biz_bank", 1, 13],
    ["house", 2, 26],
    ["apartment", 4, 52],
  ]) {
    const rooms = C.rooms(type, floors);
    assert.equal(rooms.length, count);
    assert.equal(new Set(rooms.map((room) => room.id)).size, rooms.length);
    for (const room of rooms) {
      assert(room.floor >= 0 && room.floor < floors);
      assert(room.rect.every(Number.isFinite));
      assert(room.entry.every(Number.isFinite));
      assert(room.rect[0] < room.rect[2]);
      assert(room.rect[1] < room.rect[3]);
      assert(room.description.length > 10);
      assert(room.title.length > 3);
      assert.equal(!!P.goal(rooms, room.id), room.public !== false);
    }
  }
  assert.deepEqual(C.rooms("cinema", 1), []);
  const rooms = C.rooms("apartment", 4);
  assert.equal(
    P.locate(rooms, { x: -18, y: 0, z: -18 }).id,
    "flat-101-bedroom",
  );
  assert.equal(
    P.locate(rooms, { x: -18, y: 5.2, z: -18 }).id,
    "flat-201-bedroom",
  );
  assert.equal(P.locate(rooms, { x: NaN, y: 0, z: 0 }), null);
  const goal = P.goal(rooms, "flat-401");
  assert.equal(P.guidance(goal, { x: 0, y: 0, z: 21 }, 4).stage, "floor");
  assert.equal(P.guidance(goal, { x: 0, y: 15.6, z: 21 }, 4).stage, "walk");
  assert.equal(
    P.guidance(goal, { x: goal.entry[0], y: 15.6, z: goal.entry[1] }, 4).stage,
    "arrived",
  );
  assert.equal(P.goal(C.rooms("bank", 1), "vault"), null);
});

function flood(f, floor) {
  f.at(0, floor * 5.2, 21);
  f.tick(1);
  const points = [[0, 42]];
  const seen = new Set(["0,42"]);
  for (let i = 0; i < points.length; i++) {
    const [x, z] = points[i];
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const nz = z + dz;
      const key = nx + "," + nz;
      if (seen.has(key) || nx < -51 || nx > 51 || nz < -49 || nz > 49) continue;
      if (f.w.FZBuildings.collision(2000 + nx * 0.5, 2000 + nz * 0.5)) continue;
      seen.add(key);
      points.push([nx, nz]);
    }
  }
  return points.map(([x, z]) => [x * 0.5, z * 0.5]);
}

for (const [type, floors] of [
  ["bank", 1],
  ["biz_bank", 1],
  ["house", 2],
  ["apartment", 4],
]) {
  test(
    type +
      ": all public actions and room entrances physically reachable on every floor",
    () => {
      const f = create();
      try {
        f.enter(type);
        assert.equal(f.w.FZBuildings.info().floors, floors);
        assert.equal(f.run("interiorObjects.length"), 1);
        assert.equal(
          f.w.document.querySelectorAll("#fzInterior50Tools").length,
          1,
        );
        assert.equal(f.w.FZBuildings.collision(2000, 2021), false);
        const root = f.run("interiorObjects[0]");
        root.traverse((object) => {
          assert(
            [...object.position.toArray(), ...object.scale.toArray()].every(
              Number.isFinite,
            ),
          );
          if (object.isInstancedMesh)
            assert([...object.instanceMatrix.array].every(Number.isFinite));
        });
        for (const e of f.actions().filter((e) => e.kind === "door"))
          e.door.open = true;
        f.tick();
        for (let floor = 0; floor < floors; floor++) {
          const points = flood(f, floor);
          assert(points.length > 1000);
          const unreachable = f
            .actions()
            .filter((e) => e.floor === floor && !e.liftPanel)
            .filter(
              (e) =>
                !points.some(
                  ([x, z]) =>
                    Math.hypot(
                      x - (e.position.x - 2000),
                      z - (e.position.z - 2000),
                    ) < Math.min(e.range, 1.8),
                ),
            );
          assert.deepEqual(
            Array.from(unreachable, (e) => e.name),
            [],
            type + " floor " + floor,
          );
          const plan = C.rooms(type, floors).filter(
            (room) => room.floor === floor && room.public !== false,
          );
          for (const room of plan)
            assert(
              points.some(
                ([x, z]) =>
                  Math.hypot(x - room.entry[0], z - room.entry[1]) < 1.8,
              ),
              room.id + " plan entrance",
            );
          if (type.includes("bank")) {
            assert(
              !points.some(([x, z]) => x > 0.3 && z < -10.5),
              "archive and vault remain closed",
            );
          }
        }
        const info = f.info();
        if (type.includes("bank")) {
          assert.equal(info.devices.length, 0);
          assert.equal(
            f.actions().filter((e) => e.command50 === "teller").length,
            3,
          );
          assert.equal(
            f.actions().filter((e) => e.command50 === "atm").length,
            2,
          );
          assert.equal(
            f.actions().filter((e) => e.command50 === "restricted").length,
            2,
          );
          assert.equal(
            f.actions().filter((e) => e.kind === "bed" || e.kind === "tea")
              .length,
            0,
          );
        } else {
          assert.equal(info.devices.length, floors * 2 * 7);
          assert.equal(
            f.actions().filter((e) => e.kind === "liftCall").length,
            floors,
          );
          assert.equal(
            f.actions().filter((e) => e.kind === "doorbell").length,
            floors * 2,
          );
        }
      } finally {
        f.shutdown();
      }
    },
  );
}

test("real bank action flow: no bypass, wrong window, completion, old account UI and no automatic debit", () => {
  const f = create();
  try {
    f.enter("bank");
    const before = f.run("[localPlayer.money, localPlayer.health]");
    f.use(f.command("teller", (e) => e.window50 === 1));
    assert.match(f.w.document.body.textContent, /Сначала получите талон/);
    assert.equal(f.run("bankOpened"), 0);
    f.use(f.command("queue"));
    f.click("ticket-cash");
    assert.equal(f.info().queue.ticket.code, "К001");
    f.use(f.command("teller", (e) => e.window50 === 1));
    assert.match(f.w.document.body.textContent, /ещё не вызван/);
    f.tick(62);
    assert.equal(f.info().queue.ticket.status, "called");
    f.use(f.command("teller", (e) => e.window50 === 2));
    assert.match(f.w.document.body.textContent, /к окну 1/);
    f.use(f.command("teller", (e) => e.window50 === 1));
    f.click("open-account");
    assert.equal(f.run("bankOpened"), 1);
    assert.equal(f.w.document.querySelector("#fzInterior50Panel"), null);
    assert.equal(f.info().queue.ticket.status, "serving");
    f.use(f.command("teller", (e) => e.window50 === 1));
    f.click("finish-ticket");
    assert.equal(f.info().queue.ticket, null);
    assert.equal(f.info().queue.history.length, 1);
    f.use(f.command("atm"));
    f.click("open-account");
    assert.equal(f.run("bankOpened"), 2);
    assert.deepEqual(f.run("[localPlayer.money, localPlayer.health]"), before);
    delete f.w.FZ7_open;
    f.use(f.command("atm"));
    f.click("open-account");
    assert.match(f.run("notifications.at(-1)"), /не готов/);
    assert.deepEqual(f.run("[localPlayer.money, localPlayer.health]"), before);
  } finally {
    f.shutdown();
  }
});

test("statement and consultation record only whitelisted notes; account and old task storage survive", () => {
  const f = create();
  try {
    f.enter("bank");
    f.use(f.command("queue"));
    f.click("ticket-account");
    f.tick(65);
    f.use(f.command("teller", (e) => e.window50 === 2));
    f.click("statement");
    assert(f.info().data.completed.includes("statement"));
    f.use(f.command("consultation"));
    f.click("consult-finish");
    assert(f.info().data.completed.includes("consultation"));
    f.enter("bank");
    assert(f.info().data.completed.includes("statement"));
    assert.equal(f.info().queue.ticket, null);
    assert.equal(f.info().queue.history.length, 0);
    f.run("currentUser.username = 'other'");
    f.enter("bank");
    assert.deepEqual(f.info().data.completed, []);
    f.enter("house");
    f.use(f.command("document", (e) => e.document50 === "house-rules"));
    assert(f.info().data.read.includes("house-rules"));
    assert.equal(f.w.FZBuildings.info().data.version, 28);
    assert.equal(f.run("localPlayer.money"), 500);
  } finally {
    f.shutdown();
  }
});

test("appliance cycles, visible parts, per-flat isolation, floor range guards and release", () => {
  const f = create();
  try {
    f.enter("apartment");
    const tap = f.command(
      "device",
      (e) => e.device50.state.type === "tap" && e.floor === 0,
    );
    const another = f
      .actions()
      .find(
        (e) =>
          e.command50 === "device" &&
          e.device50.state.type === "tap" &&
          e !== tap,
      );
    f.use(tap);
    f.tick(1);
    assert(tap.device50.visual.mesh.visible);
    assert.equal(another.device50.state.on, false);
    f.tick(165);
    assert.equal(tap.device50.state.on, false);
    assert.equal(tap.device50.visual.mesh.visible, false);
    assert(f.info().data.completed.includes("water"));
    const remote = f.command("device", (e) => e.floor === 3);
    f.at(remote.position.x - 2000, 0, remote.position.z - 2000);
    f.w.FZBuildings.interact(remote);
    assert.equal(remote.device50.state.on, false, "cannot act across floors");
    const fridge = f.command(
      "device",
      (e) => e.device50.state.type === "refrigerator",
    );
    f.use(fridge);
    f.tick(30);
    assert(fridge.device50.visual.pivot.rotation.y < -1);
    f.use(fridge);
    f.tick(30);
    assert(Math.abs(fridge.device50.visual.pivot.rotation.y) < 0.01);
    f.use(tap);
    const stale = tap;
    f.w.FZBuildings.release();
    assert.equal(stale.device50.state.on, false);
    assert.equal(f.w.FZInterior50.info(), null);
    assert.equal(f.w.document.querySelector("#fzInterior50Tools"), null);
    f.enter("bank");
    f.w.FZBuildings.interact(stale);
    assert.equal(stale.device50.state.on, false);
  } finally {
    f.shutdown();
  }
});

test("physical stairs and lift still carry continuously, block doorway and preserve belongings", () => {
  const f = create();
  try {
    f.enter("apartment");
    const money = f.run("localPlayer.money");
    for (let floor = 0; floor < 3; floor++) {
      for (let z = 21.9; z >= 10; z -= 0.2) {
        const y = floor * 5.2 + ((22 - z) * 5.2) / 12;
        f.at(-19, y, z);
        assert(Math.abs(f.w.FZBuildings.ground() - y) < 1e-7);
        assert.equal(f.w.FZBuildings.collision(1981, 2000 + z), false);
      }
    }
    f.at(19, 0, 18);
    assert(f.w.FZBuildings.requestLift(3));
    f.tick(70);
    assert(
      f.run(
        "localPlayer.mesh.position.y > 0 && localPlayer.mesh.position.y < 15.6",
      ),
    );
    f.tick(230);
    assert(Math.abs(f.run("localPlayer.mesh.position.y") - 15.6) < 1e-7);
    f.at(19, 15.6, 14);
    assert(f.w.FZBuildings.requestLift(0));
    f.tick(80);
    assert.equal(f.w.FZBuildings.info().lift.phase, "closing");
    assert.equal(f.w.FZBuildings.info().lift.y, 15.600000000000001);
    f.at(19, 15.6, 18);
    f.tick(260);
    assert(Math.abs(f.run("localPlayer.mesh.position.y")) < 1e-7);
    assert.equal(f.run("localPlayer.money"), money);
  } finally {
    f.shutdown();
  }
});

test("map, search, native keyboard isolation, route selection without teleport and focus restoration", () => {
  const f = create();
  try {
    f.enter("apartment");
    const original = f.w.document.querySelector("#originalFocus");
    original.focus();
    const before = f.run("localPlayer.mesh.position.toArray()");
    f.w.FZInterior50.openMap();
    assert.equal(f.w.document.querySelectorAll('[role="dialog"]').length, 1);
    const search = f.w.document.querySelector('input[type="search"]');
    assert.equal(f.w.document.activeElement, search);
    search.value = "спальня";
    search.dispatchEvent(new f.w.Event("input"));
    assert.equal(f.w.document.querySelectorAll(".fz50-room-row").length, 2);
    let leaked = 0;
    f.w.document.addEventListener("keydown", () => leaked++);
    search.dispatchEvent(
      new f.w.KeyboardEvent("keydown", {
        key: "w",
        code: "KeyW",
        bubbles: true,
      }),
    );
    assert.equal(leaked, 0);
    const floors = f.w.document.querySelector("select");
    floors.value = "3";
    floors.dispatchEvent(new f.w.Event("change"));
    f.click("room-flat-401-bedroom");
    assert.equal(f.info().target, "flat-401-bedroom");
    assert.deepEqual(f.run("localPlayer.mesh.position.toArray()"), before);
    f.click("clear-route");
    assert.equal(f.info().target, null);
    search.value = "<img src=x onerror=alert(1)>";
    search.dispatchEvent(new f.w.Event("input"));
    assert.equal(f.w.document.querySelectorAll(".fz50-room-row").length, 0);
    assert.equal(
      f.w.document.querySelectorAll("#fzInterior50Panel img").length,
      0,
    );
    f.w.dispatchEvent(
      new f.w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    assert.equal(f.w.document.querySelector("#fzInterior50Panel"), null);
    assert.equal(f.w.document.activeElement, original);
    f.enter("bank");
    f.w.FZInterior50.openMap();
    assert(f.w.document.querySelector('[data-fz50="room-vault"]').disabled);
    assert(f.w.document.querySelector('[data-fz50="room-archive"]').disabled);
  } finally {
    f.shutdown();
  }
});

test("lifecycle: panels and stale callbacks removed, GPU resources disposed once, hidden timers freeze", () => {
  const f = create();
  try {
    f.enter("bank");
    f.use(f.command("queue"));
    const staleButton = f.w.document.querySelector('[data-fz50="ticket-cash"]');
    const root = f.run("interiorObjects[0]");
    const disposed = new Map();
    root.traverse((object) => {
      const resources = [
        object.geometry,
        ...(Array.isArray(object.material)
          ? object.material
          : [object.material]),
      ].filter(Boolean);
      for (const resource of [...resources]) {
        if (resource.map) resources.push(resource.map);
      }
      for (const resource of resources)
        if (!disposed.has(resource)) {
          disposed.set(resource, 0);
          resource.addEventListener("dispose", () =>
            disposed.set(resource, disposed.get(resource) + 1),
          );
        }
    });
    f.enter("house");
    assert.equal(f.w.document.querySelector("#fzInterior50Panel"), null);
    staleButton.click();
    assert.equal(f.info().queue.ticket, null);
    assert([...disposed.values()].every((count) => count === 1));
    const tap = f.command("device", (e) => e.device50.state.type === "tap");
    f.use(tap);
    Object.defineProperty(f.w.document, "hidden", {
      value: true,
      configurable: true,
    });
    const remaining = tap.device50.state.remaining;
    f.tick(500);
    assert.equal(tap.device50.state.remaining, remaining);
    Object.defineProperty(f.w.document, "hidden", {
      value: false,
      configurable: true,
    });
    f.tick(5);
    assert(tap.device50.state.remaining < remaining);
    for (let i = 0; i < 5; i++) {
      f.enter(i % 2 ? "house" : "bank");
      f.w.FZInterior50.openMap();
      assert.equal(
        f.w.document.querySelectorAll("#fzInterior50Tools").length,
        1,
      );
      assert.equal(
        f.w.document.querySelectorAll("#fzInterior50Panel").length,
        1,
      );
    }
    f.w.FZBuildings.release();
    f.w.FZBuildings.release();
    assert.equal(f.run("interactables.filter(e => e.building28).length"), 0);
    assert.equal(f.w.document.querySelector("#fzInterior50Tools"), null);
    assert.equal(f.w.document.querySelector("#fzInterior50Panel"), null);
  } finally {
    f.shutdown();
  }
});

test("production loads the extension in dependency order; no new RAF, transaction or privilege API", () => {
  const html = fs.readFileSync(
    path.resolve(__dirname, "../public/index.html"),
    "utf8",
  );
  let last = -1;
  for (const file of files) {
    const index = html.indexOf("assets/" + file + ".js");
    assert(index > last, file + " dependency order");
    last = index;
  }
  const source = files
    .filter((file) => file.startsWith("fz-interior50"))
    .map((file) =>
      fs.readFileSync(
        path.resolve(__dirname, "../public/assets/" + file + ".js"),
        "utf8",
      ),
    )
    .join("\n");
  assert(!/requestAnimationFrame|setInterval|setTimeout/.test(source));
  assert(!/localPlayer\.(money|health)\s*=/.test(source));
  assert(!/fetch\(|XMLHttpRequest|\.emit\(/.test(source));
});

for (const [type, name, floors, roomCount] of [
  ["office", "Деловой центр", 2, 6],
  ["hospital", "Клиника", 2, 6],
  ["court", "Суд", 1, 5],
  ["office", "Городской суд", 1, 5],
]) {
  test(
    name +
      ": own-purpose plan, reachable desks, no accidental bank or residential controls",
    () => {
      const f = create();
      try {
        f.enter(type, name);
        assert.equal(f.info().rooms.length, roomCount);
        assert.equal(f.w.FZBuildings.info().floors, floors);
        assert.equal(
          f.actions().filter((e) => e.command50 === "teller").length,
          0,
        );
        assert.equal(
          f.actions().filter((e) => e.command50 === "atm").length,
          0,
        );
        assert.equal(f.info().devices.length, 0);
        for (const e of f.actions().filter((e) => e.kind === "door"))
          e.door.open = true;
        f.tick();
        for (let floor = 0; floor < floors; floor++) {
          const points = flood(f, floor);
          assert(points.length > 1000);
          const unreachable = f
            .actions()
            .filter((e) => e.floor === floor && !e.liftPanel)
            .filter(
              (e) =>
                !points.some(
                  ([x, z]) =>
                    Math.hypot(
                      x - (e.position.x - 2000),
                      z - (e.position.z - 2000),
                    ) < Math.min(e.range, 1.8),
                ),
            );
          assert.deepEqual(
            Array.from(unreachable, (e) => e.name),
            [],
          );
        }
        if (name.includes("суд") || name === "Суд") {
          assert(f.actions().some((e) => e.kind === "hearing"));
          assert.equal(f.info().printers.length, 0);
          f.use(f.command("document", (e) => e.document50 === "court-visit"));
          assert(f.info().data.read.includes("court-visit"));
        } else if (type === "hospital") {
          assert(f.actions().some((e) => e.kind === "clinic"));
          assert.equal(f.info().printers.length, 0);
          f.use(f.command("document", (e) => e.document50 === "clinic-visit"));
          assert(f.info().data.read.includes("clinic-visit"));
        } else {
          assert(f.actions().some((e) => e.kind === "office"));
          assert.equal(f.info().printers.length, 4);
          f.use(f.command("document", (e) => e.document50 === "office-visit"));
          assert(f.info().data.read.includes("office-visit"));
        }
      } finally {
        f.shutdown();
      }
    },
  );
}

test("printer state machine is bounded and consistent at low and high frame rates", () => {
  for (const hz of [4, 10, 15, 30, 60, 144]) {
    const printer = { phase: "idle", elapsed: 0 };
    assert.equal(P.printerStep(printer, 0.1), false);
    assert(P.printerStart(printer));
    assert.equal(P.printerStart(printer), false);
    for (const bad of [NaN, Infinity, -1, "2", undefined])
      P.printerStep(printer, bad);
    assert.equal(printer.elapsed, 0);
    let completed = 0;
    for (let frame = 0; frame < hz * 5; frame++)
      completed += Number(P.printerStep(printer, 1 / hz));
    assert.equal(completed, 1);
    assert.equal(printer.phase, "ready");
    assert.equal(printer.elapsed, 4);
    assert(P.printerStart(printer));
    assert.equal(printer.phase, "printing");
    assert.equal(printer.elapsed, 0);
  }
});

test("office printer: physical output, duplicate prevention, ready button and no filesystem/account operations", () => {
  const f = create();
  try {
    f.enter("office", "Деловой центр");
    const action = f.command("printer");
    f.use(action);
    assert(f.w.document.querySelector('[data-fz50="print-read"]').disabled);
    f.click("print-start");
    assert.equal(action.printer50.phase, "printing");
    assert(f.w.document.querySelector('[data-fz50="print-start"]').disabled);
    assert.equal(action.printer50.output.visible, false);
    f.tick(81);
    assert.equal(action.printer50.phase, "ready");
    assert.equal(action.printer50.output.visible, true);
    assert.equal(
      f.w.document.querySelector('[data-fz50="print-read"]').disabled,
      false,
    );
    assert.match(
      f.w.document.querySelector(".fz50-status").textContent,
      /Лист готов/,
    );
    f.click("print-read");
    assert(f.info().data.read.includes("office-printer"));
    assert(f.info().data.completed.includes("printed"));
    assert.equal(f.run("localPlayer.money"), 500);
    assert.equal(f.run("localPlayer.health"), 73);
    f.use(action);
    f.click("print-start");
    f.w.FZBuildings.release();
    assert.equal(action.printer50.phase, "idle");
    f.enter("office", "Деловой центр");
    assert(f.info().data.completed.includes("printed"));
    assert.equal(
      f.info().printers.every((item) => item.phase === "idle"),
      true,
    );
  } finally {
    f.shutdown();
  }
});

test("nearby actions do not execute from afar or after moving to another floor", () => {
  const f = create();
  try {
    f.enter("house");
    const tap = f.command("device", (e) => e.device50.state.type === "tap");
    f.at(tap.position.x - 2000, tap.position.y, tap.position.z - 2000);
    const before = f.run("localPlayer.mesh.position.toArray()");
    f.click("nearby");
    const button = [
      ...f.w.document.querySelectorAll("#fzInterior50Panel button"),
    ].find((el) => el.textContent === tap.name);
    assert(button, "the actual nearby tap appears in the accessible list");
    button.click();
    assert.equal(tap.device50.state.on, true);
    assert.deepEqual(f.run("localPlayer.mesh.position.toArray()"), before);
    f.click("nearby");
    const stale = [
      ...f.w.document.querySelectorAll("#fzInterior50Panel button"),
    ].find((el) => el.textContent === tap.name);
    f.at(0, 5.2, 21);
    stale.click();
    assert.equal(
      tap.device50.state.on,
      true,
      "range guard rejects stale floor callback",
    );
    f.at(0, 0, -20);
    f.click("nearby");
    assert.match(
      f.w.document.querySelector(".fz50-description").textContent,
      /Подойдите/,
    );
    assert.equal(
      f.w.document.querySelectorAll("#fzInterior50Panel .fz50-choices button")
        .length,
      0,
    );
  } finally {
    f.shutdown();
  }
});

test("blocked browser storage does not stop home/office/bank entry or timed interactions", () => {
  const f = create();
  try {
    Object.defineProperty(f.w, "localStorage", {
      get() {
        throw Error("blocked");
      },
      configurable: true,
    });
    for (const type of ["house", "office", "bank"]) {
      f.enter(type);
      assert(f.info());
      assert.equal(f.info().storage, false);
      f.w.FZInterior50.openMap();
      assert(f.w.document.querySelector("#fzInterior50Panel"));
      if (type === "bank") {
        f.use(f.command("queue"));
        f.click("ticket-cash");
        f.tick(65);
        assert.equal(f.info().queue.ticket.status, "called");
      }
    }
    assert.equal(f.run("localPlayer.money"), 500);
  } finally {
    f.shutdown();
  }
});

test("legacy cinema stays independent and new bank panel is torn down when leaving", () => {
  const f = create();
  try {
    f.enter("cinema");
    assert.equal(f.info(), null);
    assert.equal(f.w.FZBuildings.info().films.length, 2);
    assert.equal(f.w.document.querySelector("#fzInterior50Tools"), null);
    f.enter("bank");
    f.w.FZ7_open = () => {
      const modal = f.w.document.createElement("div");
      modal.id = "fz7m_bank";
      f.w.document.body.append(modal);
    };
    f.use(f.command("atm"));
    f.click("open-account");
    assert(f.w.document.querySelector("#fz7m_bank"));
    f.enter("house");
    assert.equal(f.w.document.querySelector("#fz7m_bank"), null);
  } finally {
    f.shutdown();
  }
});

test("old room lights, curtain, laundry and purchased inventory remain separate from new notes", () => {
  const f = create();
  try {
    f.enter("house");
    const light = f.actions().find((e) => e.kind === "roomLight");
    f.use(light);
    assert.equal(light.light.on, false);
    const curtain = f.actions().find((e) => e.kind === "curtain");
    f.use(curtain);
    assert.equal(curtain.curtain.open, false);
    const laundry = f.actions().find((e) => e.kind === "laundry");
    f.use(laundry);
    f.tick(205);
    assert.equal(f.w.FZBuildings.info().data.laundry, 1);
    f.enter("house");
    assert.equal(
      f.actions().find((e) => e.kind === "roomLight").light.on,
      false,
    );
    assert.equal(
      f.actions().find((e) => e.kind === "curtain").curtain.open,
      false,
    );
    assert.equal(f.w.FZBuildings.info().data.laundry, 1);
    assert.equal(f.info().data.visits, 2);
    assert.equal(f.w.FZBuildings.info().data.version, 28);
    assert.equal(f.info().data.version, 50);
    assert.equal(f.run("localPlayer.money"), 500);
  } finally {
    f.shutdown();
  }
});

const Route = require("../public/assets/fz-interior50-route");
test("floor-plan routes bend around partitions, ignore operable doors but not locked walls", () => {
  const fake = {
    FH: 5.2,
    floors: 1,
    ramps: [],
    lift: null,
    colliders: [
      { minX: -0.2, maxX: 0.2, minZ: -24, maxZ: 5, minY: 0, maxY: 5.2 },
      {
        minX: -0.2,
        maxX: 0.2,
        minZ: 5,
        maxZ: 8,
        minY: 0,
        maxY: 3.6,
        door: true,
      },
      { minX: -0.2, maxX: 0.2, minZ: 8, maxZ: 24, minY: 0, maxY: 5.2 },
    ],
  };
  const grid = Route.build(fake, 0);
  const result = Route.find(grid, { x: -10, z: -10 }, { x: 10, z: -10 });
  assert(result);
  assert(result.points.length > 2);
  assert(result.steps > 20);
  assert(result.visited <= Route.size);
  assert(result.points.some((p) => p.z >= 6 && p.z <= 7));
  delete fake.colliders[1].door;
  const sealed = Route.build(fake, 0);
  assert.equal(Route.find(sealed, { x: -10, z: -10 }, { x: 10, z: -10 }), null);
  assert.equal(Route.build(fake, -1), null);
  assert.equal(Route.build(fake, 1), null);
  assert.equal(Route.find(grid, { x: NaN, z: 0 }, { x: 1, z: 1 }), null);
  assert.equal(Route.find(grid, { x: 1e9, z: 0 }, { x: 1, z: 1 }), null);
  assert.equal(Route.find(null, { x: 0, z: 0 }, { x: 1, z: 1 }), null);
});

test("generated routes respect floor slabs, furniture and every public room in homes and bank", () => {
  const f = create();
  try {
    for (const [type, name] of [
      ["bank", "Банк"],
      ["apartment", "Дом"],
      ["office", "Офисы"],
      ["hospital", "Клиника"],
      ["court", "Суд"],
    ]) {
      f.enter(type, name);
      // Build a separate visit layout: resources are disposed after checking route geometry.
      const k = f.w.FZBuildingLayouts.create(type, name);
      try {
        for (let floor = 0; floor < k.floors; floor++) {
          const grid = Route.build(k, floor);
          for (const room of k.rooms50.filter(
            (room) => room.floor === floor && room.public !== false,
          )) {
            const result = Route.find(
              grid,
              { x: 0, z: 21 },
              { x: room.entry[0], z: room.entry[1] },
            );
            assert(result, type + "/" + room.id + " must have a plan route");
            assert(result.visited <= Route.size);
            for (let i = 1; i < result.points.length; i++) {
              const a = result.points[i - 1];
              const b = result.points[i];
              const length = Math.hypot(b.x - a.x, b.z - a.z);
              for (let distance = 0; distance <= length; distance += 0.2) {
                const t = length ? distance / length : 0;
                assert.equal(
                  Route.blocked(
                    k,
                    floor,
                    a.x + (b.x - a.x) * t,
                    a.z + (b.z - a.z) * t,
                  ),
                  false,
                  type + "/" + room.id + " route cannot cross a wall",
                );
              }
            }
          }
          if (type === "bank")
            assert.equal(
              Route.find(grid, { x: 0, z: 21 }, { x: 18, z: -18 }),
              null,
            );
        }
      } finally {
        k.dispose();
      }
    }
  } finally {
    f.shutdown();
  }
});

test("opening a plan repeatedly keeps one input trap and only lazily builds the requested floor grid", () => {
  const f = create();
  try {
    f.enter("apartment");
    let inputAfterClose = 0;
    f.w.document.addEventListener("keydown", () => inputAfterClose++);
    for (let i = 0; i < 12; i++) {
      f.w.FZInterior50.openMap();
      const floors = f.w.document.querySelector("select");
      floors.value = String(i % 4);
      floors.dispatchEvent(new f.w.Event("change"));
      const target = "flat-" + (((i % 4) + 1) * 100 + 1);
      f.click("room-" + target);
      assert.equal(f.info().target, target);
      f.w.FZInterior50.close();
      f.w.document.dispatchEvent(
        new f.w.KeyboardEvent("keydown", {
          key: "w",
          code: "KeyW",
          bubbles: true,
        }),
      );
      assert.equal(
        inputAfterClose,
        i + 1,
        "no input capture remains after close",
      );
    }
    assert.equal(f.w.document.querySelectorAll("#fzInterior50Panel").length, 0);
    assert.equal(f.w.document.querySelectorAll("#fzInterior50Tools").length, 1);
  } finally {
    f.shutdown();
  }
});

test("floor indicators reflect real cabin motion rather than selected destination", () => {
  const f = create();
  try {
    f.enter("apartment");
    f.at(19, 0, 18);
    f.w.FZBuildings.requestLift(3);
    f.tick(21);
    assert.equal(f.w.FZBuildings.info().lift.phase, "moving");
    assert(f.run("currentFloor < 3"));
    f.tick(40);
    const y = f.w.FZBuildings.info().lift.y;
    assert(y > 0 && y < 15.6);
    assert.equal(f.run("currentFloor"), Math.round(y / 5.2));
    const lastReadings = f
      .run("interiorObjects[0]")
      .children.filter((o) => o.name.startsWith("floor_"));
    assert.equal(lastReadings.length, 4);
    f.tick(300);
    assert.equal(f.run("currentFloor"), 3);
    assert.match(
      f.w.document.querySelector("#floorIndicator").textContent,
      /4 \/ 4/,
    );
    assert.equal(f.w.FZBuildings.requestLift(4), false);
    assert.equal(f.w.FZBuildings.requestLift(-1), false);
    assert.equal(f.w.FZBuildings.requestLift(Infinity), false);
    assert.equal(f.w.FZBuildings.requestLift("1"), false);
  } finally {
    f.shutdown();
  }
});

test("door collision opens continuously and refuses to crush a player in the doorway", () => {
  const f = create();
  try {
    for (const type of ["bank", "house"]) {
      f.enter(type);
      const e = f
        .actions()
        .find((item) => item.kind === "door" && item.floor === 0);
      const door = e.door;
      door.open = false;
      f.at(0, 0, 21);
      f.tick(20);
      assert.equal(door.amount, 0);
      assert.equal(
        f.w.FZBuildings.collision(2000 + door.x, 2000 + door.z),
        true,
      );
      f.use(e);
      f.tick(10);
      assert(door.amount > 0.92);
      assert.equal(
        f.w.FZBuildings.collision(2000 + door.x, 2000 + door.z),
        false,
      );
      f.at(door.x, 0, door.z);
      door.open = false;
      f.tick(1);
      assert.equal(door.open, true);
      f.at(0, 0, 21);
      door.open = false;
      f.tick(20);
      assert.equal(door.amount, 0);
    }
  } finally {
    f.shutdown();
  }
});

test("all extension actions are finite, owned by a single visit and uniquely identified where stateful", () => {
  const f = create();
  try {
    for (const type of [
      "house",
      "apartment",
      "bank",
      "biz_bank",
      "office",
      "hospital",
      "court",
    ]) {
      f.enter(type);
      const info = f.info();
      assert.equal(
        new Set(info.devices.map((d) => d.id)).size,
        info.devices.length,
      );
      assert.equal(
        new Set(info.printers.map((d) => d.id)).size,
        info.printers.length,
      );
      assert.equal(
        new Set(info.rooms.map((d) => d.id)).size,
        info.rooms.length,
      );
      for (const e of f.actions().filter((e) => e.kind === "interior50")) {
        assert(e.position.toArray().every(Number.isFinite));
        assert(Number.isFinite(e.range) && e.range > 0 && e.range <= 3);
        assert.equal(e.interior, true);
        assert.equal(e.building28, true);
        assert(e.floor >= 0 && e.floor < f.w.FZBuildings.info().floors);
      }
    }
  } finally {
    f.shutdown();
  }
});

test("returning to the same building preserves notes but never running water, queue tickets or printer jobs", () => {
  const f = create();
  try {
    f.enter("house", "Дом 1");
    const tap = f.command("device", (e) => e.device50.state.type === "tap");
    f.use(tap);
    f.tick(170);
    f.use(tap);
    f.use(f.command("document", (e) => e.document50 === "house-rules"));
    f.enter("house", "Дом 1");
    assert(f.info().data.completed.includes("water"));
    assert(f.info().data.read.includes("house-rules"));
    assert.equal(
      f.info().devices.some((item) => item.on),
      false,
    );
    f.enter("house", "Дом 2");
    assert.deepEqual(f.info().data.completed, []);
    assert.deepEqual(f.info().data.read, []);
    f.enter("bank", "Банк 1");
    f.use(f.command("queue"));
    f.click("ticket-consult");
    f.enter("bank", "Банк 1");
    assert.equal(f.info().queue.ticket, null);
    f.enter("office", "Офис 1");
    f.use(f.command("printer"));
    f.click("print-start");
    f.enter("office", "Офис 1");
    assert(f.info().printers.every((item) => item.phase === "idle"));
    assert.equal(f.run("localPlayer.money"), 500);
  } finally {
    f.shutdown();
  }
});
