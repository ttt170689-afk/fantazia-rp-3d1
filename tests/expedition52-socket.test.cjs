"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  path = require("node:path"),
  { fork } = require("node:child_process"),
  { io } = require("socket.io-client");
test("real guest server: two opt-in clients share a round; inputs authoritative; disconnect ends duel", async () => {
  const root = path.resolve(__dirname, ".."),
    child = fork(path.join(root, "server.js"), {
      cwd: root,
      env: {
        ...process.env,
        PORT: "0",
        FANTAZIA_RUNTIME_SECRET: "S".repeat(43),
      },
      execArgv: ["--require", path.join(__dirname, "closed-fixture-hook.cjs")],
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
  let logs = "";
  child.stdout.on("data", (b) => (logs += b));
  child.stderr.on("data", (b) => (logs += b));
  const sockets = [];
  const wait = (s, event, predicate = () => true) =>
    new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        s.off(event, fn);
        reject(Error("timeout " + event));
      }, 5000);
      function fn(v) {
        if (predicate(v)) {
          clearTimeout(timeout);
          s.off(event, fn);
          resolve(v);
        }
      }
      s.on(event, fn);
    });
  try {
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error(logs)), 12000);
      child.once("message", (m) => {
        clearTimeout(timer);
        resolve(m.port);
      });
    });
    const url = "http://127.0.0.1:" + port;
    async function connect(register = true) {
      const s = io(url, { transports: ["websocket"], reconnection: false });
      sockets.push(s);
      await wait(s, "connect");
      if (register) {
        const p = wait(s, "registered");
        s.emit("registerPlayer", { name: "spoofed" });
        s.registered = await p;
      }
      return s;
    }
    const a = await connect(),
      b = await connect(),
      unregistered = await connect(false);
    const join = (s) =>
      new Promise((resolve) =>
        s.emit("exp52:join", { map: "depot", mode: "duel" }, resolve),
      );
    assert.equal((await join(unregistered)).ok, false);
    const one = await join(a);
    assert(one.ok);
    const active = wait(a, "exp52:state", (s) => s.phase === "active");
    const two = await join(b);
    assert.equal(two.room, one.room);
    const state = await active;
    assert.equal(state.players.length, 2);
    assert.equal(
      state.players.find((p) => p.id === a.id).name,
      a.registered.player.name,
    );
    const changed = wait(
      a,
      "exp52:state",
      (s) => s.players.find((p) => p.id === a.id)?.z < 32,
    );
    a.emit("exp52:input", {
      seq: 1,
      forward: 1,
      side: 0,
      yaw: Math.PI,
      x: 10000,
      z: -10000,
      damage: 10000,
    });
    const moved = await changed,
      p = moved.players.find((p) => p.id === a.id);
    assert(p.z > 30 && p.z < 32);
    assert.equal(p.hp, 100);
    const ended = wait(a, "exp52:state", (s) => s.phase === "ended");
    b.disconnect();
    assert.equal((await ended).reason, "Соперник вышел");
    a.emit("exp52:leave");
    const city = await (await fetch(url + "/api/players")).json();
    assert(city);
  } finally {
    sockets.forEach((s) => s.close());
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once("exit", resolve);
    });
  }
});
