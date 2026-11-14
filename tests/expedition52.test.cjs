"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  P = require("../public/assets/fz-expedition52-policy"),
  { Arena52 } = require("../server/expedition52.cjs");
for (const m of P.maps) {
  test(m.id + ": connected walkable objectives and driveable perimeter", () => {
    function flood(radius) {
      const todo = [[0, 34]],
        seen = new Set(["0,34"]);
      for (let i = 0; i < todo.length; i++) {
        const [x, z] = todo[i];
        for (const [dx, dz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const a = x + dx,
            b = z + dz,
            key = a + "," + b;
          if (!seen.has(key) && !P.blocked(m, a, b, radius)) {
            seen.add(key);
            todo.push([a, b]);
          }
        }
      }
      assert(seen.size < 6500);
      return seen;
    }
    const walk = flood(0.45),
      car = flood(2.25);
    for (const p of [...m.relays, ...m.notes]) assert(walk.has(p.join(",")), p);
    for (const p of m.checkpoints) assert(car.has(p.join(",")), p);
    for (const [x, z] of m.mobs) assert(!P.blocked(m, x, z, 0.55));
  });
  test(m.id + ": no teleport through thin walls at large deltas", () => {
    const [x, z, w, d] = m.blocks[0],
      p = { x: x - w / 2 - 2, z };
    P.move(m, p, w + 4, 0, 0.45);
    assert(p.x < x - w / 2);
    assert(!P.blocked(m, p.x, p.z));
    const before = { ...p };
    P.move(m, p, 1e9, 0);
    assert.deepEqual(p, before);
  });
  test(
    m.id +
      ": collection has proximity, LOS, idempotency and ordered extraction",
    () => {
      const s = P.createMission(m.id);
      assert.equal(P.interact(s, { x: 0, z: 34 }).type, "locked");
      assert.equal(P.interact(s, { x: 999, z: 999 }), null);
      for (const [i, [x, z]] of m.relays.entries()) {
        let event = P.interact(s, { x, z });
        assert.equal(event.type, "relay");
        assert.equal(event.id, i);
      }
      assert.equal(P.interact(s, { x: 0, z: 34 }).type, "complete");
      assert(s.done);
      assert.equal(P.interact(s, { x: 0, z: 34 }), null);
    },
  );
}
for (const c of P.cars)
  test(
    c.id +
      ": throttle/brake, reverse, bounded speed and zero-delta animation physics",
    () => {
      const m = P.map("depot"),
        p = { x: 32, z: 10, yaw: Math.PI, speed: 0 };
      for (let i = 0; i < 40; i++)
        P.drive(m, p, { forward: 1, side: 0 }, 0.05, c.id);
      assert(p.speed > 0 && p.speed <= c.max);
      assert(!P.blocked(m, p.x, p.z, 1.25));
      const before = { ...p };
      P.drive(m, p, { forward: 1 }, 0, c.id);
      assert.deepEqual(p, before);
      for (let i = 0; i < 50; i++) P.drive(m, p, { forward: -1 }, 0.05, c.id);
      assert(p.speed < 0 && p.speed >= -c.max * 0.35);
      assert(P.exitPoint(m, p));
    },
  );
test("walking clamps malformed input and normalizes diagonal speed", () => {
  const m = P.map("depot"),
    a = { x: 0, z: 32, yaw: 0 },
    b = { ...a };
  P.walk(m, a, { forward: 1, side: 1, yaw: 0 }, 0.1);
  P.walk(m, b, { forward: 1, side: 0, yaw: 0 }, 0.1);
  assert(
    Math.abs(P.dist(a, { x: 0, z: 32 }) - P.dist(b, { x: 0, z: 32 })) < 1e-9,
  );
  assert.deepEqual(P.input({ forward: NaN, side: Infinity, yaw: NaN }), {
    forward: 0,
    side: 0,
    yaw: 0,
  });
});
test("hits require aim/range/LOS and select nearest living target", () => {
  const m = P.map("depot"),
    p = { x: 0, z: 0, yaw: 0 },
    a = { x: 0, z: 3, hp: 50 },
    b = { x: 0, z: 8, hp: 50 };
  assert.equal(P.rayHit(m, p, [b, a]), a);
  assert.equal(P.rayHit(m, { ...p, yaw: Math.PI }, [a]), null);
  assert.equal(
    P.rayHit(m, { x: -20, z: -24, yaw: 0 }, [{ x: -20, z: -8, hp: 100 }]),
    null,
  );
});
for (const type of Object.keys(P.monsters))
  test(
    type + ": telegraphed attack, recover window, stun and no instant damage",
    () => {
      const s = P.createMission("depot"),
        e = s.mobs[0];
      Object.assign(e, { type, x: 0, z: 2, hp: 120, state: "patrol" });
      s.mobs = [e];
      const p = { x: 0, z: 2.5, yaw: Math.PI };
      P.missionStep(s, p, 0.05);
      assert.equal(s.hp, 100);
      assert.equal(e.state, "windup");
      for (let i = 0; i < 40; i++) P.missionStep(s, p, 0.05);
      assert(s.hp < 100 && s.hp > 0);
      assert(P.pulse(s, p));
      assert.equal(e.state, "stunned");
      assert.equal(P.pulse(s, p), false);
    },
  );
test("clean local lore state cannot inject IDs, inherited keys or fake race times", () => {
  assert.deepEqual(
    P.clean({
      notes: ["depot-0", "depot-0", "bad"],
      completed: ["quarry", "bad"],
      best: { depot: -1, quarry: 0, observatory: 42 },
    }),
    { notes: ["depot-0"], completed: ["quarry"], best: { observatory: 42 } },
  );
  assert.equal(P.notes.length, 12);
  assert.equal(new Set(P.notes.map((n) => n.id)).size, 12);
});
function arena() {
  let time = 0;
  const players = {
      a: { name: "А", money: 1000, health: 100 },
      b: { name: "Б", money: 2000, health: 100 },
      c: { name: "В" },
    },
    events = [];
  const a = new Arena52({
    now: () => time,
    eligible: (id) => players[id],
    emit: (id, event, data) => events.push({ id, event, data }),
  });
  return {
    a,
    players,
    events,
    advance(seconds) {
      for (let i = 0; i < seconds * 20; i++) {
        time += 50;
        a.step(0.05);
      }
    },
    now(n) {
      time = n;
    },
  };
}
function duel() {
  const f = arena();
  assert(f.a.join("a", { map: "depot", mode: "duel" }).ok);
  assert(f.a.join("b", { map: "depot", mode: "duel" }).ok);
  f.advance(0.1);
  const r = [...f.a.rooms.values()][0];
  return { ...f, r };
}
test("PvP requires registered identity and explicit valid opt-in; solo waits", () => {
  const f = arena();
  assert.equal(f.a.join("bad", { map: "depot", mode: "duel" }).ok, false);
  assert.equal(f.a.join("a", { map: "bad", mode: "duel" }).ok, false);
  f.now(2000);
  assert(f.a.join("a", { map: "depot", mode: "duel" }).ok);
  f.advance(3);
  assert.equal([...f.a.rooms.values()][0].phase, "waiting");
  assert.deepEqual(f.players.a, { name: "А", money: 1000, health: 100 });
});
test("authoritative movement rejects teleports, malformed/stale sequence and input flood", () => {
  const f = duel(),
    p = f.r.players.get("a");
  assert.equal(
    f.a.input("a", { seq: 0, forward: Infinity, side: 0, yaw: 0 }),
    false,
  );
  assert(
    f.a.input("a", {
      seq: 1,
      forward: 1,
      side: 0,
      yaw: Math.PI,
      x: 99999,
      z: 99999,
      damage: 9999,
    }),
  );
  f.advance(0.1);
  assert(Math.abs(p.z - 31.5) < 0.001);
  assert.equal(f.a.input("a", { seq: 1, forward: 1, side: 0, yaw: 0 }), false);
  const z = p.z;
  f.advance(2);
  assert(z - p.z < 1.3, "stale held input stops");
  let count = 0;
  for (let i = 2; i < 200; i++)
    count += Number(f.a.input("a", { seq: i, forward: 0, side: 0, yaw: 0 }));
  assert(count <= 40);
});
test("server calculates hits, spawn protection, cooldown, respawn and no RP damage/rewards", () => {
  const f = duel(),
    a = f.r.players.get("a"),
    b = f.r.players.get("b");
  Object.assign(a, { x: 0, z: 0, yaw: 0 });
  Object.assign(b, { x: 0, z: 5 });
  let seq = 0;
  const fire = () =>
    f.a.input("a", {
      seq: seq++,
      forward: 0,
      side: 0,
      yaw: 0,
      fire: true,
      damage: 1e9,
      target: "b",
    });
  fire();
  f.advance(0.05);
  assert.equal(b.hp, 100);
  f.advance(2.1);
  fire();
  f.advance(0.05);
  assert.equal(b.hp, 75);
  fire();
  f.advance(0.05);
  assert.equal(b.hp, 75);
  for (let i = 0; i < 3; i++) {
    f.advance(0.5);
    fire();
    f.advance(0.05);
  }
  assert.equal(b.hp, 0);
  assert.equal(a.kills, 1);
  assert.equal(a.score, 1);
  f.advance(3.1);
  assert.equal(b.hp, 100);
  assert.equal(b.z, -32);
  assert.deepEqual(f.players.a, { name: "А", money: 1000, health: 100 });
  assert.equal(f.players.b.health, 100);
});
test("PvP wall blocking and separated rooms cannot be bypassed with target IDs", () => {
  const f = duel(),
    a = f.r.players.get("a"),
    b = f.r.players.get("b");
  f.advance(2.1);
  Object.assign(a, { x: -20, z: -24 });
  Object.assign(b, { x: -20, z: -8 });
  f.a.input("a", { seq: 1, forward: 0, side: 0, yaw: 0, fire: true });
  f.advance(0.05);
  assert.equal(b.hp, 100);
  const c = f.a.join("c", { map: "quarry", mode: "control" });
  assert(c.ok);
  assert.notEqual(c.room, f.r.id);
});
test("control is contested with two players, scored with one, finished at threshold", () => {
  const f = arena();
  f.a.join("a", { map: "depot", mode: "control" });
  f.a.join("b", { map: "depot", mode: "control" });
  f.advance(2.2);
  const r = [...f.a.rooms.values()][0],
    a = r.players.get("a"),
    b = r.players.get("b");
  Object.assign(a, { x: 0, z: 0 });
  Object.assign(b, { x: 1, z: 0 });
  f.advance(1);
  assert.equal(a.score, 0);
  b.z = -32;
  f.advance(2);
  assert(a.score > 1.9);
  a.score = 44.98;
  f.advance(0.1);
  assert.equal(r.phase, "ended");
});
test("leave/disconnect/TTL release rooms, members and rate-limit storage", () => {
  const f = duel();
  f.a.disconnect("b");
  assert.equal(f.r.phase, "ended");
  assert(!f.a.gates.has("b"));
  f.advance(61);
  assert.equal(f.a.rooms.size, 0);
  assert.equal(f.a.members.size, 0);
  f.a.disconnect("a");
  assert.equal(f.a.gates.size, 0);
});
test("native lifecycle integration precedes world physics and cleans up on menu/logout", () => {
  const html = fs.readFileSync("public/index.html", "utf8");
  assert(
    html.indexOf("FZExpedition52?.frame(delta)") <
      html.indexOf("FZSurvival45?.frame(delta)"),
  );
  assert.equal((html.match(/FZExpedition52\?\.finish\(\)/g) || []).length, 2);
  for (const name of [
    "fz-expedition52-policy",
    "fz-expedition52-world",
    "fz-expedition52",
  ]) {
    const src = fs.readFileSync("public/assets/" + name + ".js", "utf8");
    assert(!/requestAnimationFrame|setInterval\s*\(/.test(src));
  }
});
test("camera-relative right strafe and right steering are not mirrored", () => {
  const m = P.map("depot"),
    p = { x: 0, z: 32, yaw: Math.PI };
  P.walk(m, p, { forward: 0, side: 1, yaw: Math.PI }, 0.05);
  assert(p.x > 0);
  const v = { x: 0, z: 32, yaw: 0, speed: 5 };
  P.drive(m, v, { forward: 1, side: 1 }, 0.05, "rally");
  assert(v.yaw < 0);
});
test("six race segments stay on the clear perimeter with full vehicle clearance", () => {
  for (const m of P.maps) {
    const route = [[-9, 32], ...m.checkpoints];
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1],
        b = route[i];
      for (let t = 0; t <= 1; t += 0.01)
        assert(
          !P.blocked(
            m,
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
            2.25,
          ),
          m.id + " segment " + i,
        );
    }
  }
});
test("waiting rooms expire; late control arrivals receive fresh spawn protection", () => {
  const f = arena();
  f.a.join("a", { map: "depot", mode: "duel" });
  f.advance(181);
  assert.equal(f.a.rooms.size, 0);
  assert.equal(f.a.members.size, 0);
  assert(f.events.some((e) => e.event === "exp52:closed"));
  f.a.join("a", { map: "quarry", mode: "control" });
  f.a.join("b", { map: "quarry", mode: "control" });
  f.advance(10);
  f.a.join("c", { map: "quarry", mode: "control" });
  const r = [...f.a.rooms.values()][0];
  assert(r.players.get("c").invUntil > r.time + 1.9);
});
test("round-end snapshot is sent even when the decisive tick is odd", () => {
  const f = duel();
  f.r.tick = 2;
  f.r.time = 119.99;
  f.events.length = 0;
  f.advance(0.05);
  assert.equal(f.r.phase, "ended");
  assert(f.events.some((e) => e.data.phase === "ended"));
});
