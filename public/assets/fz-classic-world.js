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
  function open() {
    if (!window.FZUI?.playing()) return;
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "fzClassicMap";
      panel.className = "fz8Modal";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      panel.setAttribute("aria-labelledby", "fzClassicTitle");
      panel.innerHTML =
        '<section><button data-close>Закрыть</button><h2 id="fzClassicTitle">Старый город</h2><p>Знакомые улицы, оригинальный GRAND MALL и лаборатория №13 в лесу.</p><button data-place="square">Городская площадь</button><button data-place="mall">GRAND MALL</button><button data-place="lab">Лаборатория №13</button><p>Поездка приводит ко входу. E или кнопка действия на телефоне — войти.</p><p data-error hidden>Сначала спустись с облаков, выйди из помещения или транспорта.</p></section>';
      const style = document.createElement("style");
      style.textContent =
        "#fzClassicMap[hidden]{display:none!important}#fzClassicMap{position:fixed;inset:0;z-index:12040;display:grid;place-items:center;padding:16px;background:#060912c9;color:#eee;font:14px/1.5 Arial}#fzClassicMap section{width:min(520px,100%);box-sizing:border-box;padding:24px;background:#172435;border:1px solid #596b80;border-radius:16px;max-height:85dvh;overflow:auto}#fzClassicMap button{padding:12px;min-height:44px;margin:5px;border:1px solid #66778b;border-radius:8px;background:#293c50;color:#fff;cursor:pointer}#fzClassicMap [data-close]{float:right}#fzClassicMap [data-place]{display:block;width:100%;margin:10px 0}#fzClassicMap button:focus-visible{outline:3px solid #d6b77e}body:not(.fz-playing) #fzClassicMap{display:none!important}";
      document.head.appendChild(style);
      document.body.appendChild(panel);
      panel.querySelector("[data-close]").onclick = close;
      panel.querySelectorAll("[data-place]").forEach(
        (b) =>
          (b.onclick = () => {
            panel.querySelector("[data-error]").hidden = travel(
              b.dataset.place,
            );
          }),
      );
      panel.addEventListener("pointerdown", (e) => e.stopPropagation());
      panel.onclick = (e) => {
        if (e.target === panel) close();
      };
      panel.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          close();
        }
        if (e.key === "Tab") {
          const b = [...panel.querySelectorAll("button")],
            i = b.indexOf(document.activeElement);
          e.preventDefault();
          b[(i + (e.shiftKey ? -1 : 1) + b.length) % b.length].focus();
        }
      });
    }
    focus = document.activeElement;
    panel.hidden = false;
    panel.querySelector("[data-error]").hidden = true;
    panel.querySelector("[data-close]").focus();
    if (document.pointerLockElement) document.exitPointerLock();
    if (typeof keys !== "undefined")
      Object.keys(keys).forEach((k) => (keys[k] = false));
  }
  window.FZClassic = { open, close, travel };
})();
