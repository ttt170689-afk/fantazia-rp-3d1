/* Visit-scoped accessible panels and a floor plan. Uses the game's existing update loop. */
(function () {
  "use strict";
  let panel = null;
  let previousFocus = null;
  let removeKeys = null;
  let mapState = null;
  let sequence = 0;
  function node(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function close(restore = true) {
    removeKeys?.();
    removeKeys = null;
    panel?.remove();
    panel = null;
    mapState = null;
    window.FZPlay?.release();
    if (restore && previousFocus?.isConnected && !previousFocus.disabled)
      previousFocus.focus();
    previousFocus = null;
  }
  function open(title, description) {
    const retained = previousFocus;
    close(false);
    previousFocus = retained?.isConnected ? retained : document.activeElement;
    window.FZPlay?.release();
    if (document.pointerLockElement) document.exitPointerLock();
    const backdrop = node("section", undefined, "fz50-overlay");
    backdrop.id = "fzInterior50Panel";
    const card = node("article", undefined, "fz50-card");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    const titleId = "fz50-title-" + ++sequence;
    const heading = node("h2", title);
    heading.id = titleId;
    card.setAttribute("aria-labelledby", titleId);
    card.append(heading);
    if (description) card.append(node("p", description, "fz50-description"));
    const content = node("div", undefined, "fz50-content");
    card.append(content);
    const footer = node("footer");
    const dismiss = button("Закрыть", () => close(), { id: "close" });
    dismiss.classList.add("fz50-close");
    footer.append(dismiss);
    card.append(footer);
    backdrop.append(card);
    document.body.append(backdrop);
    panel = backdrop;
    for (const event of [
      "pointerdown",
      "pointerup",
      "mousedown",
      "touchstart",
      "touchend",
      "click",
    ]) {
      backdrop.addEventListener(event, (e) => e.stopPropagation());
    }
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close();
    });
    function keydown(event) {
      event.stopImmediatePropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "Tab") {
        const controls = [
          ...card.querySelectorAll('button,input,select,[tabindex="0"]'),
        ].filter(
          (el) => !el.disabled && !el.hidden && el.getClientRects().length,
        );
        if (!controls.length) return;
        const index = controls.indexOf(document.activeElement);
        const next = event.shiftKey
          ? index <= 0
            ? controls.length - 1
            : index - 1
          : (index + 1) % controls.length;
        event.preventDefault();
        controls[next].focus();
      }
    }
    const keyup = (event) => event.stopImmediatePropagation();
    window.addEventListener("keydown", keydown, true);
    window.addEventListener("keyup", keyup, true);
    removeKeys = () => {
      window.removeEventListener("keydown", keydown, true);
      window.removeEventListener("keyup", keyup, true);
    };
    dismiss.focus();
    return content;
  }
  function button(label, run, options = {}) {
    const result = node("button", label);
    result.type = "button";
    result.dataset.fz50 = options.id || "";
    result.disabled = !!options.disabled;
    result.onclick = () => {
      if (!result.disabled) run();
    };
    return result;
  }
  function show(title, description, choices = [], paragraphs = []) {
    const content = open(title, description);
    for (const text of paragraphs) content.append(node("p", text));
    const actions = node("div", undefined, "fz50-choices");
    for (const choice of choices)
      actions.append(button(choice.label, choice.run, choice));
    content.append(actions);
    actions.querySelector("button:not(:disabled)")?.focus();
    return content;
  }
  function status(text) {
    const result = node("p", text, "fz50-status");
    result.setAttribute("role", "status");
    return result;
  }
  function map(visit, onSelect, onCancel) {
    const content = open(
      "План здания",
      "Выберите этаж и помещение. Ориентир не телепортирует игрока и не проводит сквозь стены.",
    );
    content.parentElement.classList.add("fz50-map-card");
    const toolbar = node("div", undefined, "fz50-toolbar");
    const floorLabel = node("label", "Этаж");
    const floors = node("select");
    floors.setAttribute("aria-label", "Этаж на плане");
    for (let floor = 0; floor < visit.k.floors; floor++) {
      const option = node("option", "Этаж " + (floor + 1));
      option.value = String(floor);
      floors.append(option);
    }
    floors.value = String(
      Math.max(
        0,
        Math.min(
          visit.k.floors - 1,
          Math.round(visit.position().y / visit.k.FH),
        ),
      ),
    );
    floorLabel.append(floors);
    const searchLabel = node("label", "Найти помещение");
    const search = node("input");
    search.type = "search";
    search.maxLength = 80;
    search.placeholder = "Касса, спальня, 201…";
    search.setAttribute("aria-label", "Поиск помещения");
    searchLabel.append(search);
    toolbar.append(floorLabel, searchLabel);
    content.append(toolbar);
    const layout = node("div", undefined, "fz50-map-layout");
    const figure = node("figure");
    const canvas = node("canvas");
    canvas.width = 624;
    canvas.height = 600;
    canvas.setAttribute("role", "img");
    canvas.setAttribute(
      "aria-label",
      "Схема этажа. Белая точка — игрок, золотое кольцо — выбранный вход. Тот же список помещений доступен справа.",
    );
    figure.append(
      canvas,
      node(
        "figcaption",
        "Белая точка — вы · кольцо — цель · пунктир — проход через коридоры и открываемые двери. Серые комнаты закрыты.",
      ),
    );
    const list = node("div", undefined, "fz50-room-list");
    list.setAttribute("aria-label", "Помещения этажа");
    layout.append(figure, list);
    content.append(layout);
    const count = status("");
    const details = node("div", undefined, "fz50-map-details");
    content.append(count, details);
    content.append(
      button(
        "Убрать ориентир",
        () => {
          onCancel();
          details.replaceChildren(node("p", "Ориентир убран."));
          drawMap();
        },
        { id: "clear-route" },
      ),
    );
    mapState = {
      visit,
      canvas,
      floors,
      list,
      search,
      count,
      details,
      selected: visit.target?.id || null,
    };
    function populate() {
      if (!mapState) return;
      const floor = Number(floors.value);
      const query = search.value.trim().toLocaleLowerCase("ru");
      const rooms = visit.k.rooms50.filter(
        (room) =>
          room.floor === floor &&
          (room.title + " " + room.description)
            .toLocaleLowerCase("ru")
            .includes(query),
      );
      list.replaceChildren();
      for (const room of rooms) {
        const entry = node("div", undefined, "fz50-room-row");
        entry.append(node("h3", room.title));
        entry.append(
          node(
            "p",
            room.public === false
              ? "Служебное помещение · проход закрыт"
              : room.description,
          ),
        );
        entry.append(
          button(
            room.public === false ? "Закрыто" : "Показать вход",
            () => {
              if (!mapState) return;
              mapState.selected = room.id;
              onSelect(room.id);
              details.replaceChildren(
                node("h3", room.title),
                node("p", room.description),
                node(
                  "p",
                  "Ориентир установлен. Закройте план и идите по коридору к отмеченному входу.",
                ),
              );
              drawMap();
            },
            { id: "room-" + room.id, disabled: room.public === false },
          ),
        );
        list.append(entry);
      }
      count.textContent = rooms.length
        ? "Помещений на плане: " + rooms.length
        : "На этом этаже ничего не найдено.";
      drawMap();
    }
    floors.onchange = populate;
    search.oninput = populate;
    populate();
    search.focus();
  }
  function drawMap() {
    const state = mapState;
    if (!state) return;
    const { canvas, visit } = state;
    const c = canvas.getContext("2d");
    if (!c) return;
    const scale = 11;
    const x = (n) => 26 + (n + 26) * scale;
    const z = (n) => 25 + (n + 25) * scale;
    c.fillStyle = "#0d1823";
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = "#253746";
    c.fillRect(x(-26), z(-25), 52 * scale, 50 * scale);
    const floor = Number(state.floors.value);
    const rooms = visit.k.rooms50.filter((room) => room.floor === floor);
    // Paint containing areas first so apartments do not cover individual rooms.
    rooms.sort(
      (a, b) =>
        (b.rect[2] - b.rect[0]) * (b.rect[3] - b.rect[1]) -
        (a.rect[2] - a.rect[0]) * (a.rect[3] - a.rect[1]),
    );
    for (const room of rooms) {
      const [left, top, right, bottom] = room.rect;
      c.fillStyle = room.color;
      c.globalAlpha = room.public === false ? 0.4 : 0.7;
      c.fillRect(
        x(left),
        z(top),
        (right - left) * scale,
        (bottom - top) * scale,
      );
      c.globalAlpha = 1;
      c.strokeStyle = "#1b2e3e";
      c.lineWidth = 2;
      c.strokeRect(
        x(left),
        z(top),
        (right - left) * scale,
        (bottom - top) * scale,
      );
      if (!room.id.startsWith("flat-") || room.id.split("-").length > 2) {
        c.fillStyle = "#f2eee4";
        c.font = "12px system-ui";
        c.textAlign = "center";
        const words = room.title.split(" · ");
        words.forEach((word, i) =>
          c.fillText(
            word,
            x((left + right) / 2),
            z((top + bottom) / 2) + i * 15,
            Math.max(20, (right - left) * scale - 8),
          ),
        );
      }
      if (room.public !== false) {
        c.fillStyle = "#e1e4d2";
        c.fillRect(x(room.entry[0]) - 4, z(room.entry[1]) - 3, 8, 6);
      }
    }
    // Actual partition colliders make the plan reflect traversable circulation.
    c.fillStyle = "#101c27";
    for (const wall of visit.k.colliders) {
      if (
        wall.minY > floor * visit.k.FH + 0.5 ||
        wall.maxY < floor * visit.k.FH + 3 ||
        wall.door ||
        wall.lift
      )
        continue;
      c.fillRect(
        x(wall.minX),
        z(wall.minZ),
        Math.max(2, (wall.maxX - wall.minX) * scale),
        Math.max(2, (wall.maxZ - wall.minZ) * scale),
      );
    }
    const selected = visit.k.rooms50.find(
      (room) => room.id === visit.target?.id,
    );
    const p = visit.position();
    if (selected?.floor === floor && Math.round(p.y / visit.k.FH) === floor) {
      visit.paths50 = visit.paths50 || new Map();
      if (!visit.paths50.has(floor))
        visit.paths50.set(floor, FZInterior50Route.build(visit.k, floor));
      const path = FZInterior50Route.find(visit.paths50.get(floor), p, {
        x: selected.entry[0],
        z: selected.entry[1],
      });
      if (path) {
        c.strokeStyle = "#f1d699";
        c.lineWidth = 2.5;
        c.setLineDash([6, 4]);
        c.beginPath();
        path.points.forEach((point, index) => {
          if (index === 0) c.moveTo(x(point.x), z(point.z));
          else c.lineTo(x(point.x), z(point.z));
        });
        c.stroke();
        c.setLineDash([]);
      }
    }
    if (selected?.floor === floor) {
      c.strokeStyle = "#f0d18c";
      c.lineWidth = 3;
      c.beginPath();
      c.arc(x(selected.entry[0]), z(selected.entry[1]), 9, 0, Math.PI * 2);
      c.stroke();
    }
    if (Math.round(p.y / visit.k.FH) === floor) {
      c.fillStyle = "#fff";
      c.strokeStyle = "#192b3b";
      c.lineWidth = 2;
      c.beginPath();
      c.arc(x(p.x), z(p.z), 6, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
    c.fillStyle = "#edf1dc";
    c.font = "14px system-ui";
    c.textAlign = "center";
    c.fillText(
      floor === 0 ? "ВХОД / ВЫХОД" : "ЛЕСТНИЦА СЛЕВА · ЛИФТ СПРАВА",
      canvas.width / 2,
      594,
    );
  }
  window.FZInterior50UI = {
    node,
    button,
    show,
    close,
    status,
    map,
    update: drawMap,
    active: () => !!panel,
  };
})();
