const assert = require("node:assert/strict"),
  crypto = require("node:crypto"),
  http = require("node:http");
const { Server } = require("../node_modules/socket.io"),
  { io } = require("socket.io-client");
const P = require("../public/assets/fz-sky-policy"),
  { attachSkyAccess } = require("../server/sky-access");
assert(P.blocked(0, -1417, false));
assert(!P.blocked(0, -1417, true));
assert(P.blocked(35, -1400, true));
assert.equal(P.ground(18, -1383, false), 358);
assert.equal(P.ground(0, -1417, true), 361.2);
assert.equal(P.ground(0, -1390, false), 360);
assert.deepEqual(
  P.position({ x: 0, y: 361, z: -1417 }, P.spawn, false),
  P.spawn,
);
assert.deepEqual(P.position({ x: NaN, y: 0, z: 1 }, P.spawn, true), P.spawn);
assert.deepEqual(P.position({ x: 131, y: 0, z: -30 }, P.spawn, false), {
  x: 131,
  y: 0,
  z: -30,
});
(async () => {
  const server = http.createServer(),
    ws = new Server(server),
    players = {};
  const sessions = new Set(),
    role = { admin: true },
    token = crypto.randomBytes(32).toString("hex");
  const access = attachSkyAccess(ws, players, {
    isAdmin: (s) => sessions.has(s.id) && role.admin,
  });
  ws.on("connection", (s) => {
    players[s.id] = {
      position: { ...P.spawn },
      rotation: { y: 0 },
      isAdmin: true,
    }; // Forged/legacy flag is deliberately true.
    s.on("test:login", (value, reply) => {
      if (value === token) sessions.add(s.id);
      reply({ ok: sessions.has(s.id) });
    });
    s.on("disconnect", () => {
      sessions.delete(s.id);
      delete players[s.id];
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const client = io("http://127.0.0.1:" + server.address().port, {
    transports: ["websocket"],
  });
  const connected = () =>
    new Promise((r) => (client.connected ? r() : client.once("connect", r)));
  const ack = (event, data) =>
    new Promise((resolve, reject) =>
      client
        .timeout(3000)
        .emit(event, data, (error, result) =>
          error ? reject(error) : resolve(result),
        ),
    );
  try {
    await connected();
    assert.equal((await ack("sky:status", {})).allowed, false);
    assert.equal(
      (await ack("sky:stage", { isAdmin: true, key: token, email: "admin" }))
        .ok,
      false,
      "client flags/key never grant access",
    );
    assert.equal((await ack("test:login", token)).ok, true);
    assert.equal(
      (await ack("sky:status", {})).allowed,
      true,
      "normal verified account session, no stage password",
    );
    assert.equal((await ack("sky:stage", {})).ok, true);
    assert.equal(players[client.id].position.y, 361.2);
    role.admin = false;
    assert.equal(
      access.allowed(ws.sockets.sockets.get(client.id)),
      false,
      "role revocation applies to movement too",
    );
    assert.equal((await ack("sky:stage", {})).ok, false);
    role.admin = true;
    players[client.id].position = { x: 131, y: 0, z: -30 };
    assert.equal(
      (await ack("sky:stage", {})).ok,
      false,
      "cannot teleport from city by calling stage event",
    );
    client.disconnect();
    client.connect();
    await connected();
    assert.equal(
      (await ack("sky:status", {})).allowed,
      false,
      "new connection must authenticate again",
    );
    await ack("test:login", token);
    assert.equal((await ack("sky:stage", {})).ok, true);
    console.log(
      "PASS sky: public stairs, server-account stage access without a second key, spoof denial, revocation, reconnect and region guard",
    );
  } finally {
    client.disconnect();
    await new Promise((r) => ws.close(r));
    server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
