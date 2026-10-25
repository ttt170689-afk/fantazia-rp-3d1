"use strict";
const P = require("../public/assets/fz-sky-policy");
// Access follows a server-verified account session; never a client nick/email,
// local isAdmin flag, or a second stage password. Default is fail-closed.
function attachSkyAccess(io, players, { isAdmin = () => false } = {}) {
  function allowed(socket) {
    const ok = !!players[socket.id] && isAdmin(socket) === true;
    socket.data.skyAdmin = ok;
    return ok;
  }
  io.on("connection", (socket) => {
    socket.data.skyAdmin = false;
    socket.on("sky:status", (_data, reply) => {
      if (typeof reply === "function")
        reply({ ok: true, allowed: allowed(socket) });
    });
    socket.on("sky:stage", (_data, reply) => {
      if (typeof reply !== "function") return;
      const player = players[socket.id];
      if (!allowed(socket) || !P.region(player?.position))
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
  return { allowed };
}
module.exports = { attachSkyAccess };
