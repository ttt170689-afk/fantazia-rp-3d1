/* A walking directory over live entries, including reserved construction sites.
 * The directory only sets navigation; it never creates or teleports to a city. */
(function () {
  "use strict";
  let panel = null,
    returnFocus = null,
    query = "",
    category = "all";
  const categories = [
    ["all", "Все"],
    ["home", "Жильё"],
    ["cinema", "Кино"],
    ["bank", "Банки"],
    ["court", "Суд"],
    ["service", "Кабинеты"],
    ["crane", "Краны"],
  ];
  const descriptions = {
    home: "Подъезд, лестницы, лифт, квартиры и предметы быта.",
    cinema: "Кинобар, билеты, два зала и локальные 3D-фильмы.",
    bank: "Электронная очередь, операционисты и обычный игровой счёт.",
    court: "Канцелярия, два зала и учебные игровые слушания.",
    service: "Приёмная, кабинеты и физический подъём на этажи.",
    crane: "Лестница в защитной клетке, площадка и управление крюком.",
  };
  function classify(e) {
    if (e.crane28) return e.kind === "ladder" ? "crane" : null;
    if (e.interior || e.sky || e.metroInside) return null;
    const type = e.destination || e.type;
    if (["house", "apartment"].includes(type)) return "home";
    if (type === "cinema") return "cinema";
    if (type === "bank" || type === "biz_bank") return "bank";
    if (type === "court" || (type === "office" && /суд/i.test(e.name)))
      return "court";
    if (["office", "hospital"].includes(type)) return "service";
    return null;
  }
  function catalog() {
    if (typeof interactables === "undefined" || !localPlayer?.mesh) return [];
    const p = localPlayer.mesh.position,
      seen = new Set(),
      rows = [];
    for (const entry of interactables) {
      const kind = classify(entry);
      if (
        !kind ||
        !entry.position ||
        !Number.isFinite(entry.position.x) ||
        !Number.isFinite(entry.position.z)
      )
        continue;
      const key =
        kind +
        ":" +
        Math.round(entry.position.x) +
        ":" +
        Math.round(entry.position.z);
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        entry,
        kind,
        key,
        title: entry.name || kind,
        x: entry.position.x,
        z: entry.position.z,
        distance: Math.round(
          Math.hypot(p.x - entry.position.x, p.z - entry.position.z),
        ),
      });
    }
    return rows.sort(
      (a, b) => a.distance - b.distance || a.key.localeCompare(b.key),
    );
  }
  function close() {
    panel?.remove();
    panel = null;
    if (returnFocus?.isConnected) returnFocus.focus();
    returnFocus = null;
  }
  function message(text) {
    showNotification(text, "info");
  }
  function mark(row) {
    if (!window.FZUI?.playing() || window._loadingGate || window.cine)
      return false;
    if (
      isInsideBuilding ||
      isInFactory ||
      isInBasement ||
      window.FZMetro?.active() ||
      window.FZCranes?.active()
    ) {
      message("Сначала выйдите на улицу или спуститесь с крана.");
      return false;
    }
    if (window.FZSky?.active()) {
      message("Сначала спуститесь с небесной площади в город.");
      return false;
    }
    if (!interactables.includes(row.entry)) {
      message("Этот вход больше не загружен. Обновите список.");
      render();
      return false;
    }
    window.FZGuide?.pause();
    setNavTarget(row.x, row.z, row.title, true);
    close();
    message("Маршрут установлен. Координаты игрока не изменены.");
    return true;
  }
  function element(tag, text, parent, className) {
    const e = document.createElement(tag);
    if (text) e.textContent = text;
    if (className) e.className = className;
    parent?.append(e);
    return e;
  }
  function render() {
    if (!panel) return;
    const results = panel.querySelector(".fz28-results"),
      counter = panel.querySelector("[data-count]");
    results.replaceChildren();
    const all = catalog(),
      rows = all.filter(
        (r) =>
          (category === "all" || r.kind === category) &&
          (!query ||
            (r.title + " " + descriptions[r.kind])
              .toLocaleLowerCase("ru")
              .includes(query.toLocaleLowerCase("ru"))),
      );
    counter.textContent =
      "Найдено: " + rows.length + ". Показаны ближайшие 40 входов.";
    for (const row of rows.slice(0, 40)) {
      const card = element("article", null, results, "fz28-place");
      element("h3", row.title, card);
      element("p", row.distance + " м · " + descriptions[row.kind], card);
      const button = element("button", "Проложить пеший маршрут", card);
      button.type = "button";
      button.onclick = () => mark(row);
    }
    if (!rows.length)
      element(
        "p",
        "Нет подходящих входов в загруженной части города. Попробуйте другую категорию.",
        results,
      );
    panel
      .querySelectorAll("[data-category]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.category === category)),
      );
  }
  function open() {
    if (!window.FZUI?.playing()) return false;
    close();
    returnFocus = document.activeElement;
    window.FZPlay?.release();
    if (document.pointerLockElement) document.exitPointerLock();
    panel = element("section", null, document.body, "fz28-modal");
    panel.id = "fzBuildingDirectory";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Здания и строительные краны");
    const card = element("div", null, panel, "fz28-card");
    element("h2", "Город изнутри", card);
    element(
      "p",
      "Выберите настоящий вход на карте. Кнопка показывает маршрут, а не переносит персонажа.",
      card,
    );
    const label = element("label", "Поиск здания", card);
    label.htmlFor = "fz28PlaceQuery";
    const input = element("input", null, card);
    input.id = "fz28PlaceQuery";
    input.placeholder = "Дом, кинотеатр, банк, суд…";
    input.value = query;
    input.addEventListener("input", () => {
      query = input.value.trim().slice(0, 100);
      render();
    });
    const filters = element("nav", null, card, "fz28-categories");
    filters.setAttribute("aria-label", "Категории зданий");
    for (const [id, name] of categories) {
      const b = element("button", name, filters);
      b.dataset.category = id;
      b.type = "button";
      b.onclick = () => {
        category = id;
        render();
      };
    }
    element("p", "", card).dataset.count = "";
    element("div", null, card, "fz28-results");
    const reload = element("button", "Обновить ближайшие входы", card);
    reload.onclick = render;
    const exit = element("button", "Закрыть", card, "fz28-close");
    exit.onclick = close;
    panel.addEventListener("click", (e) => {
      if (e.target === panel) close();
    });
    panel.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      } else if (e.key === "Tab") {
        const list = [...card.querySelectorAll("input,button")],
          i = list.indexOf(document.activeElement);
        e.preventDefault();
        list[(i + (e.shiftKey ? -1 : 1) + list.length) % list.length].focus();
      }
    });
    render();
    input.focus();
    return true;
  }
  window.FZBuildingDirectory = {
    open,
    close,
    catalog: () =>
      catalog().map(({ key, kind, title, x, z, distance }) => ({
        key,
        kind,
        title,
        x,
        z,
        distance,
      })),
  };
})();
