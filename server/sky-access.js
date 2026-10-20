"use strict";
const crypto = require("node:crypto");
const P = require("../public/assets/fz-sky-policy");
// Independent capability: legacy nick/email/isAdmin flags never unlock this stage.
function attachSkyAccess(
  io,
  players,
  { key = process.env.FANTAZIA_STAGE_KEY || "", now = Date.now } = {},
) {
  const attempts = new Map();
  const digest = (s) => crypto.createHash("sha256").update(s).digest();
  io.on("connection", (socket) => {
    socket.data.skyAdmin = false;
    socket.on("sky:authorize", (data = {}, reply = () => {}) => {
      if (typeof reply !== "function") return;
      const ip = socket.handshake.address || "unknown",
        t = now();
      for (const [k, v] of attempts)
        if (t - v.since > 60000) attempts.delete(k);
      const a = attempts.get(ip) || { since: t, count: 0 };
      a.count++;
      attempts.set(ip, a);
      if (a.count > 6)
        return reply({
          ok: false,
          error: "Слишком много попыток. Подожди минуту.",
        });
      if (!players[socket.id])
        return reply({ ok: false, error: "Сначала войди в игру." });
      if (key.length < 24)
        return reply({
          ok: false,
          error: "Владелец ещё не настроил доступ к сцене на сервере.",
        });
      if (
        typeof data?.key !== "string" ||
        data.key.length > 200 ||
        !crypto.timingSafeEqual(digest(data.key), digest(key))
      )
        return reply({ ok: false, error: "Доступ не подтверждён." });
      socket.data.skyAdmin = true;
      reply({ ok: true });
    });
    socket.on("sky:stage", (data, reply = () => {}) => {
      if (typeof reply !== "function") return;
      const player = players[socket.id];
      if (!player || !socket.data.skyAdmin || !P.region(player.position))
        return reply({ ok: false });
      player.position = {
        x: P.stage.x,
        y: P.deck.y + P.stage.h,
        z: P.stage.z + 2,
      };
      reply({ ok: true });
      socket.broadcast.emit("playerMoved", {
        id: socket.id,
        position: player.position,
        rotation: player.rotation,
        animation: "idle",
      });
    });
  });
}
module.exports = { attachSkyAccess };
