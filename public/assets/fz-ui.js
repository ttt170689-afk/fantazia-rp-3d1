// UI lifecycle: auth -> loading -> playing, without pre-login overlays.
(function () {
  "use strict";
  let active = false,
    drawer = null,
    bar = null,
    focusBefore = null;
  const journal = [];
  let section = "city";
  function screenVisible(id) {
    const el = document.getElementById(id);
    return (
      !!el &&
      getComputedStyle(el).display !== "none" &&
      getComputedStyle(el).visibility !== "hidden"
    );
  }
  function playing() {
    return active;
  }
  function ready() {
    return (
      document.body.classList.contains("game-active") &&
      typeof localPlayer !== "undefined" &&
      localPlayer &&
      localPlayer.mesh &&
      !window._loadingGate &&
      !screenVisible("authScreen") &&
      !screenVisible("serverScreen") &&
      !screenVisible("createScreen") &&
      !screenVisible("welcomeOverlay") &&
      !screenVisible("playLoadOv") &&
      !screenVisible("cityLoadOv")
    );
  }
  function text(node, tag, value) {
    const e = document.createElement(tag);
    e.textContent = value;
    node.appendChild(e);
    return e;
  }
  function record(title, description) {
    if (!active) return;
    const d = document.createElement("div");
    d.innerHTML = String(description || "");
    journal.unshift({ title: String(title), description: d.textContent || "" });
    journal.splice(40);
  }
  function close() {
    if (!drawer) return;
    drawer.hidden = true;
    document.getElementById("fzUIOpen")?.setAttribute("aria-expanded", "false");
    if (focusBefore && focusBefore.isConnected) focusBefore.focus();
    focusBefore = null;
  }
  function action(label, fn) {
    label = label.replace(/\s*v[78](?:\.\d+)?/gi, "").trim();
    const category =
      /город|район|школ|квартир|море|метро|фото|транспорт|небес|площад/i.test(
        label,
      )
        ? "city"
        : /настрой|график|пауза|журнал/i.test(label)
          ? "settings"
          : /инвентарь|крафт|персонаж|одеж|скин|друз|игрок|телефон|чат|магазин|pass|навык|питом|танц|автомоб/i.test(
                label,
              )
            ? "player"
            : "activities";
    return { label, fn, category };
  }
  function openChat() {
    const p = document.getElementById("chatPanel");
    if (!p) return;
    if (document.pointerLockElement && document.exitPointerLock)
      document.exitPointerLock();
    if (typeof keys !== "undefined")
      Object.keys(keys).forEach((k) => (keys[k] = false));
    if (p.classList.contains("chat-hidden")) toggleChatPanel();
    document.getElementById("chatInput")?.focus();
  }
  function summary() {
    const pairs = [
      ["moneyDisplay", "$"],
      ["coinsDisplay", "монет"],
      ["gemsDisplay", "кристаллов"],
      ["levelDisplay", "уровень"],
      ["jobDisplay", ""],
      ["onlineDisplay", "онлайн"],
    ];
    const el = document.getElementById("fzUISummary");
    if (el)
      el.textContent = pairs
        .map(([id, label]) => {
          const e = document.getElementById(id);
          return e ? e.textContent.trim() + " " + label : "";
        })
        .filter(Boolean)
        .join("  ·  ");
  }
  function actions() {
    const items = [
      action("🏢 Здания и краны — пешие маршруты", () =>
        window.FZBuildingDirectory?.open(),
      ),
      action("Настройки звука — музыка, озвучка и SFX", () =>
        window.FZSound?.open(),
      ),
      action("🚇 Метро — станции и голос", () => window.FZMetro?.open()),
      action("☁ Небесная площадь", () => window.FZSky?.arrive()),
      action("↓ Спуститься с облаков в город", () => window.FZSky?.descend()),
      action("🧭 Город — места, избранное и прогулки", () =>
        window.FZGuide?.open(),
      ),
      action("📌 Мой город — сохранённые места и копия журнала", () =>
        window.FZJourney?.open(),
      ),
      action("📱 Настройки игры на телефоне", () => window.FZPlay?.open()),
      action("🏫 Школа и квартиры", () => FZ8B.directory()),
      action("⚓ Море, мосты и корабли", () => FZ8SEA.map()),
      action(
        "🏀 Дворы рядом — спорт и отдых",
        () => window.FZLeisure && FZLeisure.directory(),
      ),
      action("📰 Новости города", () => openNewsModal()),
      action("📷 Сделать фото", () => takePhoto()),
      action("📒 Журнал уведомлений", showJournal),
      action("💼 Работа", () => togglePanel("jobs")),
      action("🚗 Автомобили", () => togglePanel("cars")),
    ];
    const names = new Set(items.map((i) => i.label));
    document
      .querySelectorAll(
        "#fz8Dock button,#fz7Dock button,#sideMenuPanel .side-btn",
      )
      .forEach((b) => {
        if (
          ["events", "interiors", "sea"].includes(b.dataset.id) ||
          b.id === "cityGoBtn" ||
          /Экспорт|Сделать фото/.test(b.title)
        )
          return;
        if (b.style.display === "none") return;
        const label = b.title || b.textContent.trim();
        if (!label || names.has(label) || /новости/i.test(label)) return;
        names.add(label);
        items.push(action(label, () => b.click()));
      });
    items.push(
      action("💬 Чат", openChat),
      action("📱 Телефон", () => togglePhone()),
      action("🎟 Fantazia Pass", () => openFPassPanel()),
      action("Настройки управления", () => window.FZTouch && FZTouch.open()),
      action("⚙ Графика и производительность · Неон", () =>
        window.FZPlay?.open(),
      ),
    );
    return items;
  }
  function drawList(query = "") {
    const list = document.getElementById("fzUIList");
    list.replaceChildren();
    const matches = actions().filter(
      (a) =>
        a.label
          .toLocaleLowerCase("ru")
          .includes(query.toLocaleLowerCase("ru")) &&
        (query.trim() || a.category === section),
    );
    for (const a of matches) {
      const b = text(list, "button", "");
      b.className = "ui-action";
      const icon = text(b, "span", "");
      icon.className = "ui-action-icon";
      icon.setAttribute("aria-hidden", "true");
      const paths = /фото/i.test(a.label)
        ? "M3 7h5l2-3h4l2 3h5v13H3z M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0"
        : /новости/i.test(a.label)
          ? "M4 3h16v18H4z M8 7h8 M8 11h8 M8 15h5"
          : /настрой|график|управлен/i.test(a.label)
            ? "M5 4v16 M12 4v16 M19 4v16 M2 8h6 M9 15h6 M16 10h6"
            : /спуститься/i.test(a.label)
              ? "M12 3v13 M6 10l6 6 6-6 M4 18v3h16v-3"
              : /сохран|избран/i.test(a.label)
                ? "M6 3h12v18l-6-4-6 4z"
                : /мор|небес|корабл/i.test(a.label)
                  ? "M5 16a5 5 0 0 1-1-10 6 6 0 0 1 11-1 5 5 0 1 1 4 11z"
                  : /транспорт|метро|авто/i.test(a.label)
                    ? "M5 4h14v14H5z M5 12h14 M8 4v8 M16 4v8 M7 18v3 M17 18v3"
                    : /школ|город|квартир/i.test(a.label)
                      ? "M3 21V9h7V3h11v18z M6 13h1 M6 17h1 M14 7h3 M14 11h3 M14 15h3"
                      : a.category === "player"
                        ? "M17 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0 M3 22v-3a9 7 0 0 1 18 0v3"
                        : "M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z";
      icon.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="' +
        paths +
        '"/></svg>';
      text(b, "span", a.label.replace(/^[^\p{L}\p{N}]+/u, "")).className =
        "ui-action-label";
      const arrow = text(b, "span", "↗");
      arrow.className = "ui-action-arrow";
      arrow.setAttribute("aria-hidden", "true");
      b.type = "button";
      b.onclick = () => {
        close();
        a.fn();
      };
    }
    if (!matches.length) text(list, "p", "Ничего не найдено.");
    document
      .querySelectorAll("#fzUICategories button")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(b.dataset.section === section && !query.trim()),
        ),
      );
  }
  function showJournal() {
    open();
    document.getElementById("fzUISearch").hidden = true;
    document.getElementById("fzUICategories").hidden = true;
    const list = document.getElementById("fzUIList");
    list.replaceChildren();
    list.style.gridTemplateColumns = "1fr";
    text(list, "h3", "Подсказки без всплывающих окон");
    if (!journal.length) text(list, "p", "Журнал пока пуст.");
    for (const id of ["questHUD", "fzStory"]) {
      const el = document.getElementById(id);
      if (el && el.textContent.trim()) text(list, "p", el.textContent.trim());
    }
    for (const entry of journal) {
      const p = text(list, "section", "");
      text(p, "strong", entry.title);
      text(p, "p", entry.description);
    }
    const back = text(list, "button", "Все разделы");
    back.onclick = open;
  }
  function open() {
    if (!active) return;
    init();
    focusBefore = document.activeElement;
    drawer.hidden = false;
    document.getElementById("fzUIOpen").setAttribute("aria-expanded", "true");
    window.FZPlay?.release();
    const search = document.getElementById("fzUISearch");
    search.hidden = false;
    document.getElementById("fzUICategories").hidden = false;
    summary();
    search.value = "";
    document.getElementById("fzUIList").style.gridTemplateColumns = "";
    drawList();
    if (typeof keys !== "undefined")
      Object.keys(keys).forEach((k) => (keys[k] = false));
    if (document.pointerLockElement && document.exitPointerLock)
      document.exitPointerLock();
    if (window.FZTouch?.enabled()) document.getElementById("fzUIClose").focus();
    else search.focus();
  }
  function toggleLight() {
    if (!active) return;
    grantLight();
    toggleFlashlight();
    updateFlashlight();
    syncLight();
  }
  function grantLight() {
    if (typeof DLC === "undefined" || typeof scene === "undefined" || !scene)
      return;
    if (window._flashSpill && window._flashSpill.parent !== scene)
      scene.add(window._flashSpill);
    DLC.hasFlashlight = true;
    if (DLC.flashOn === undefined) DLC.flashOn = false;
    if (DLC.flashBat === undefined) DLC.flashBat = 100;
    if (!window._flash || window._flash.parent !== scene) {
      const f = new THREE.SpotLight(0xfff4d6, 5.5, 60, 0.48, 0.45, 0.7);
      f.visible = false;
      f.castShadow = false;
      scene.add(f, f.target);
      window._flash = f;
    }
  }
  function syncLight() {
    if (!bar) return;
    const b = document.getElementById("fzUIFlash");
    const on = typeof DLC !== "undefined" && !!DLC.flashOn;
    b.setAttribute("aria-pressed", String(on));
    const touch = window.FZTouch && FZTouch.enabled();
    b.textContent = (on ? "Фонарь вкл" : "Фонарик") + (touch ? "" : " · F");
    document.getElementById("fzUIOpen").textContent = touch
      ? "Меню"
      : "Меню · M";
  }
  function init() {
    if (drawer) return;
    bar = document.createElement("nav");
    bar.id = "fzUIBar";
    bar.hidden = true;
    bar.setAttribute("aria-label", "Быстрые действия");
    bar.innerHTML =
      '<button id="fzUIOpen" aria-expanded="false">☰ Меню · M</button><button id="fzUIFlash" aria-pressed="false">🔦 Фонарик · F</button><button id="fzUINews" type="button" aria-haspopup="dialog">Новости</button>';
    document.body.appendChild(bar);
    document.getElementById("fzUIOpen").onclick = open;
    document.getElementById("fzUIFlash").onclick = toggleLight;
    document.getElementById("fzUINews").onclick = () => {
      if (active) {
        FZPlay.release();
        openNewsModal();
      }
    };
    drawer = document.createElement("div");
    drawer.id = "fzUIMenu";
    drawer.hidden = true;
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-modal", "true");
    drawer.setAttribute("aria-labelledby", "fzUITitle");
    drawer.innerHTML =
      '<section class="ui-card"><header><div><small>FANTAZIA RP</small><h2 id="fzUITitle">Твой город</h2></div><button id="fzUIClose">Закрыть</button></header><p id="fzUISummary"></p><nav id="fzUICategories" aria-label="Разделы меню"><button data-section="city">Город</button><button data-section="player">Персонаж</button><button data-section="activities">Занятия</button><button data-section="settings">Настройки</button></nav><input id="fzUISearch" type="search" placeholder="Найти: метро, школа, настройки…" aria-label="Поиск раздела"><div id="fzUIList"></div></section>';
    document.body.appendChild(drawer);
    document.getElementById("fzUIClose").onclick = close;
    document.querySelectorAll("#fzUICategories button").forEach(
      (b) =>
        (b.onclick = () => {
          section = b.dataset.section;
          document.getElementById("fzUISearch").value = "";
          drawList();
        }),
    );
    document.getElementById("fzUISearch").oninput = (e) =>
      drawList(e.target.value);
    drawer.onclick = (e) => {
      if (e.target === drawer) close();
    };
    for (const el of [bar, drawer])
      for (const ev of ["mousedown", "pointerdown", "touchstart"])
        el.addEventListener(ev, (e) => e.stopPropagation());
    window.addEventListener(
      "keydown",
      (e) => {
        if (
          !active ||
          !!document.querySelector(".fz-play-dialog:not([hidden])") ||
          (window.FZLeisure && FZLeisure.modalOpen()) ||
          (document.getElementById("fzTouchPanel") &&
            !document.getElementById("fzTouchPanel").hidden)
        )
          return;
        if (!drawer.hidden) {
          if (e.key === "Escape") {
            e.preventDefault();
            close();
          } else if (e.key === "Tab") {
            const items = [...drawer.querySelectorAll("button,input")].filter(
              (e) => !e.hidden && !e.disabled && e.getClientRects().length > 0,
            );
            const i = items.indexOf(document.activeElement);
            e.preventDefault();
            items[
              (i + (e.shiftKey ? -1 : 1) + items.length) % items.length
            ].focus();
          }
          e.stopImmediatePropagation();
          return;
        }
        const el = document.activeElement;
        if (
          (el &&
            (el.matches("input,textarea,select") || el.isContentEditable)) ||
          window.cine
        )
          return;
        if (e.code === "Enter") {
          e.preventDefault();
          e.stopImmediatePropagation();
          openChat();
          return;
        }
        if (e.repeat) return;
        if (e.code === "KeyM" || e.code === "KeyF") {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (e.code === "KeyM") open();
          else toggleLight();
        }
      },
      true,
    );
  }
  function update() {
    const next = !!ready();
    if (next !== active) {
      active = next;
      document.body.classList.toggle("fz-playing", active);
      init();
      bar.hidden = !active;
      if (!active) {
        close();
        if (window.FZCITY) FZCITY.close();
        if (window.FZLeisure) FZLeisure.close();
        if (window.FZ8L && FZ8L.close) FZ8L.close();
        for (const id of ["fz8bPanel", "fzSeaModal"]) {
          const e = document.getElementById(id);
          if (e) e.hidden = true;
        }
        journal.length = 0;
        const n = document.getElementById("notifications");
        if (n) n.replaceChildren();
      } else grantLight();
    }
    if (active) {
      // Own name is redundant; other players' names keep their normal behaviour.
      const tag = localPlayer.mesh.userData.nameTag;
      if (tag) tag.visible = false;
      document.body.classList.toggle(
        "fz-hurt",
        Number(localPlayer.health) < 100,
      );
      grantLight();
      syncLight();
    }
    document.body.classList.toggle(
      "fz-armed",
      active && !!window.FZ8K && FZ8K.state().cur !== "fists",
    );
    document.body.classList.toggle(
      "fz-menu-open",
      active &&
        ((!!drawer && !drawer.hidden) ||
          (!!window.FZLeisure && FZLeisure.modalOpen())),
    );
    if (bar)
      document
        .getElementById("fzUIOpen")
        .setAttribute("aria-expanded", String(!drawer.hidden));
  }
  window.FZUI = { playing, update, open, close, record, grantLight };
  init();
  update();
  setInterval(update, 200);
})();
