"use strict";
const P = require("../public/assets/fz-expedition52-policy");
// A separate, ephemeral opt-in game. Never writes to the RP player/account.
class Arena52 {
  constructor({
    now = () => Date.now(),
    emit = () => {},
    eligible = () => null,
  } = {}) {
    this.now = now;
    this.emit = emit;
    this.eligible = eligible;
    this.rooms = new Map();
    this.members = new Map();
    this.gates = new Map();
    this.next = 0;
  }
  join(id, request) {
    const now = this.now(),
      gate = this.gates.get(id) || { join: -Infinity, inputAt: now, count: 0 };
    this.gates.set(id, gate);
    if (now - gate.join < 1000)
      return { ok: false, error: "Подожди секунду перед новым входом." };
    gate.join = now;
    const owner = this.eligible(id),
      m = P.map(request?.map),
      mode = request?.mode;
    if (!owner || !m || !["duel", "control"].includes(mode))
      return { ok: false, error: "Нужен вход в игру и существующий режим." };
    this.leave(id);
    const capacity = mode === "duel" ? 2 : 6;
    let room = [...this.rooms.values()].find(
      (r) =>
        r.map === m.id &&
        r.mode === mode &&
        r.phase !== "ended" &&
        r.players.size < capacity &&
        (mode !== "duel" || r.phase === "waiting"),
    );
    if (!room) {
      if (this.rooms.size >= 32)
        return { ok: false, error: "Все арены заняты. Попробуй позже." };
      room = {
        id: String(++this.next),
        map: m.id,
        mode,
        phase: "waiting",
        time: 0,
        created: now,
        endedAt: 0,
        players: new Map(),
        tick: 0,
      };
      this.rooms.set(room.id, room);
    }
    const slot = [0, 1, 2, 3, 4, 5].find(
      (n) => ![...room.players.values()].some((p) => p.slot === n),
    );
    const p = {
      id,
      name: String(owner.name || "Игрок").slice(0, 32),
      slot,
      x: 0,
      z: 0,
      yaw: 0,
      hp: 100,
      score: 0,
      kills: 0,
      deaths: 0,
      shot: 0,
      invUntil: room.time + 2,
      respawn: 0,
      nextFire: 0,
      seq: -1,
      input: { forward: 0, side: 0, yaw: 0 },
      lastInput: now,
    };
    this.spawn(p);
    room.players.set(id, p);
    this.members.set(id, room.id);
    this.send(room);
    return { ok: true, room: room.id, map: room.map, mode: room.mode };
  }
  spawn(p) {
    const points = [
      [0, 32],
      [0, -32],
      [-32, 0],
      [32, 0],
      [-31, 31],
      [31, -31],
    ];
    [p.x, p.z] = points[p.slot];
    p.yaw = p.z > 0 ? Math.PI : 0;
    p.hp = 100;
    p.input = { forward: 0, side: 0, yaw: p.yaw };
    p.fire = false;
  }
  input(id, raw) {
    const now = this.now(),
      gate = this.gates.get(id),
      r = this.rooms.get(this.members.get(id)),
      p = r?.players.get(id);
    if (!p || !gate || r.phase === "ended") return false;
    if (now - gate.inputAt >= 1000) {
      gate.inputAt = now;
      gate.count = 0;
    }
    if (++gate.count > 40) return false;
    if (
      !raw ||
      !Number.isSafeInteger(raw.seq) ||
      raw.seq <= p.seq ||
      raw.seq > 1e12 ||
      !["forward", "side", "yaw"].every(
        (k) => typeof raw[k] === "number" && Number.isFinite(raw[k]),
      ) ||
      Math.abs(raw.forward) > 1 ||
      Math.abs(raw.side) > 1 ||
      Math.abs(raw.yaw) > Math.PI * 4
    )
      return false;
    p.seq = raw.seq;
    p.input = P.input(raw);
    p.lastInput = now;
    if (raw.fire === true) p.fire = true;
    return true;
  }
  leave(id) {
    const r = this.rooms.get(this.members.get(id));
    this.members.delete(id);
    if (!r) return;
    r.players.delete(id);
    if (!r.players.size) {
      this.rooms.delete(r.id);
      return;
    }
    if (r.phase === "active" && r.players.size < 2) {
      r.phase = "ended";
      r.endedAt = this.now();
      r.reason = "Соперник вышел";
    }
    this.send(r);
  }
  disconnect(id) {
    this.leave(id);
    this.gates.delete(id);
  }
  snapshot(r) {
    return {
      room: r.id,
      map: r.map,
      mode: r.mode,
      phase: r.phase,
      time: r.time,
      left: Math.max(0, 120 - r.time),
      tick: r.tick,
      reason: r.reason || "",
      players: [...r.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        x: p.x,
        z: p.z,
        yaw: p.yaw,
        hp: p.hp,
        score: Math.floor(p.score),
        kills: p.kills,
        deaths: p.deaths,
        shot: p.shot,
        protected: r.time < p.invUntil,
        respawn: Math.max(0, p.respawn - r.time),
      })),
    };
  }
  send(r) {
    const data = this.snapshot(r);
    for (const p of r.players.values()) this.emit(p.id, "exp52:state", data);
  }
  step(dt = 0.05) {
    const d = P.clamp(dt, 0, 0.1),
      now = this.now();
    for (const r of [...this.rooms.values()]) {
      if (r.phase === "ended") {
        if (now - r.endedAt > 60000) {
          for (const p of r.players.values()) {
            this.emit(p.id, "exp52:closed", {});
            this.members.delete(p.id);
          }
          this.rooms.delete(r.id);
        }
        continue;
      }
      if (r.phase === "waiting" && now - r.created > 180000) {
        for (const p of r.players.values()) {
          this.emit(p.id, "exp52:closed", {});
          this.members.delete(p.id);
        }
        this.rooms.delete(r.id);
        continue;
      }
      if (r.phase === "waiting" && r.players.size >= 2) r.phase = "active";
      if (r.phase === "active") r.time += d;
      r.tick++;
      const m = P.map(r.map);
      for (const p of r.players.values()) {
        if (!this.eligible(p.id)) {
          this.disconnect(p.id);
          continue;
        }
        if (p.hp <= 0) {
          if (r.time >= p.respawn) {
            this.spawn(p);
            p.invUntil = r.time + 2;
          }
          continue;
        }
        const input =
          now - p.lastInput > 250
            ? { forward: 0, side: 0, yaw: p.yaw }
            : p.input;
        if (r.phase === "active") P.walk(m, p, input, d, 5);
        if (
          p.fire &&
          r.phase === "active" &&
          r.time >= p.nextFire &&
          r.time >= p.invUntil
        ) {
          p.nextFire = r.time + 0.45;
          p.shot++;
          const target = P.rayHit(
            m,
            p,
            [...r.players.values()].filter((q) => q.id !== p.id),
          );
          if (target && r.time >= target.invUntil) {
            target.hp = Math.max(0, target.hp - 25);
            if (!target.hp) {
              p.kills++;
              p.score += r.mode === "duel" ? 1 : 3;
              target.deaths++;
              target.respawn = r.time + 3;
              target.fire = false;
            }
          }
        }
        p.fire = false;
      }
      if (r.mode === "control" && r.phase === "active") {
        const holders = [...r.players.values()].filter(
          (p) => p.hp > 0 && Math.hypot(p.x, p.z) < 4.5 && r.time >= p.invUntil,
        );
        if (holders.length === 1) holders[0].score += d;
      }
      if (
        r.phase === "active" &&
        (r.time >= 120 ||
          [...r.players.values()].some(
            (p) => p.score >= (r.mode === "duel" ? 5 : 45),
          ))
      ) {
        r.phase = "ended";
        r.endedAt = now;
        r.reason = "Раунд завершён";
        this.send(r);
      }
      if (r.tick % 2 === 0) this.send(r);
    }
  }
}
function installExpedition52({ io, players, server }) {
  const arena = new Arena52({
    eligible: (id) => players[id] || null,
    emit: (id, event, data) => io.to(id).emit(event, data),
  });
  io.on("connection", (socket) => {
    socket.on("exp52:join", (data, ack) => {
      const result = arena.join(socket.id, data);
      if (typeof ack === "function") ack(result);
    });
    socket.on("exp52:input", (data) => arena.input(socket.id, data));
    socket.on("exp52:leave", () => arena.leave(socket.id));
    socket.on("disconnect", () => arena.disconnect(socket.id));
  });
  const timer = setInterval(() => arena.step(0.05), 50);
  timer.unref();
  server.once("close", () => clearInterval(timer));
  return arena;
}
module.exports = { Arena52, installExpedition52 };
