// Travel to the actual original scene's entrances, not copied landmark models.
(function () {
  "use strict";
  let panel = null,
    focus = null;
  function close() {
    if (panel) panel.hidden = true;
    if (focus?.isConnected) focus.focus();
    focus = null;
  }
  function travel(id) {
    if (
      !window.FZ_CLASSIC_WORLD ||
      !window.FZUI?.playing() ||
      !localPlayer?.mesh ||
      window._loadingGate ||
      window.cine ||
      window.FZSky?.active() ||
      isInsideBuilding ||
      isInFactory ||
      isInBasement ||
      (typeof localCar !== "undefined" && localCar) ||
      window.FZ8SEA?.active() ||
      window.FZ8SEA?.aboard() ||
      window.FZ8M?.ride?.() ||
      window.FZ8L?.drive?.()
    )
      return false;
    const entry =
      id === "square"
        ? null
        : interactables.find(
            (e) => e.type === (id === "mall" ? "mall" : "factory"),
          );
    if (id !== "square" && !entry) return false;
    const origin = entry
      ? { x: entry.position.x, z: entry.position.z + 3 }
      : SPAWN_POINT;
    // Keep a small collision-checked landing area in front of the native entrance.
    let target = null;
    for (const dz of [0, 2, 4, 6, 8])
      for (const dx of [0, -2, 2, -4, 4]) {
        if (!target && !checkCollision(origin.x + dx, origin.z + dz))
          target = { x: origin.x + dx, z: origin.z + dz };
      }
    if (!target) return false;
    if (
      typeof standUpFromSeat === "function" &&
      typeof sittingOn !== "undefined" &&
      sittingOn
    )
      standUpFromSeat();
    window.FZLeisure?.close();
    localPlayer.mesh.position.set(target.x, 0, target.z);
    if (typeof velocity !== "undefined")
      velocity.x = velocity.y = velocity.z = 0;
    if (typeof keys !== "undefined")
      Object.keys(keys).forEach((k) => (keys[k] = false));
    cameraAngleH = window.cameraMode === "first" ? Math.PI : 0;
    cameraAngleV = window.cameraMode === "first" ? -0.08 : -0.23;
    localPlayer.mesh.rotation.y = Math.PI;
    close();
    return true;
  }
  function open() { close(); } // Removed obsolete quick-travel dialog; city itself is retained.
  window.FZClassic = { open, close, travel };
})();
