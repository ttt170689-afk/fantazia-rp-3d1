/* Live native-city directory and optional walking itineraries. No teleport,
 * currency rewards, forced onboarding, or resurrection of the retired story. */
(function () {
  "use strict";
  const TYPES = new Set([
    "mall",
    "factory",
    "biz_space",
    "biz_bank",
    "biz_office",
    "biz_server",
    "shop_food",
    "shop_clothing",
    "shop_electronics",
    "shop_furniture",
    "shop_petfood",
    "office",
    "bank",
    "cinema",
    "club",
    "job_mechanic",
    "hospital",
    "police",
  ]);
  const walks = [
    {
      id: "first",
      name: "Знакомство с городом",
      stops: ["mall", "park", "biz_space"],
    },
    {
      id: "business",
      name: "Деловой квартал",
      stops: ["biz_office", "biz_bank", "biz_server"],
    },
    {
      id: "avenue",
      name: "Новый проспект",
      stops: ["park", "quarter", "mall"],
    },
  ];
  let catalog = [],
    panel = null,
    focus = null,
    filter = "all",
    query = "",
    favOnly = false,
    last = 0,
    scanAt = 0,
    userKey = "",
    data = { favorites: [], visited: [], completed: [], pending: null },
    route = null,
    tab = "places",
    limit = 30;
  const active = () => !!window.FZUI?.playing();
  function safeWorld() {
    return (
      active() &&
      !window.FZSky?.active() &&
      !isInsideBuilding &&
      !isInFactory &&
      !isInBasement &&
      !window.FZ8SEA?.active() &&
      !window.FZ8M?.ride?.()
    );
  }
  function load() {
    const who =
      (typeof currentUser !== "undefined" && currentUser?.username) ||
      (typeof localPlayer !== "undefined" && localPlayer?.name) ||
      "guest";
    const next =
      "fz_city_journal_v13:" + encodeURIComponent(String(who).slice(0, 80));
    if (next === userKey) return;
    userKey = next;
    data = FZJourneyPolicy.guide(null);
    route = null;
    try { data = FZJourneyPolicy.guide(JSON.parse(localStorage.getItem(userKey))); } catch (e) {}
  }
  function save() {
    try {
      localStorage.setItem(userKey, JSON.stringify(data));
      return true;
    } catch (e) { message("Не удалось сохранить журнал в браузере."); return false; }
  }
  function category(e) {
    if (e.type === "shop_food") return "food";
    if (e.type.startsWith("shop_")) return "shops";
    if (["mall", "factory", "biz_space", "park", "quarter"].includes(e.type))
      return "places";
    return "services";
  }
  function refresh() {
    if (!safeWorld()) return;
    load();
    const out = [],
      seen = new Set();
    for (const e of interactables) {
      if (
        !TYPES.has(e.type) ||
        !e.position ||
        !Number.isFinite(e.position.x) ||
        !Number.isFinite(e.position.z) ||
        Math.abs(e.position.x) > 600 ||
        Math.abs(e.position.z) > 600
      )
        continue;
      const id = e.type + ":" + String(e.name).slice(0, 100);
      if (seen.has(id)) continue;
      seen.add(id);
      const item = {
        id,
        type: e.type,
        name: String(e.name).replace(/\[E\]/g, ""),
        x: e.position.x,
        z: e.position.z,
      };
      item.category = category(item);
      out.push(item);
    }
    out.push({
      id: "park",
      type: "park",
      name: "Городской парк · северный вход",
      x: 30,
      z: 12,
      category: "places",
    });
    out.push({
      id: "quarter",
      type: "quarter",
      name: "Восточный проспект · пешеходный угол",
      x: 249,
      z: 146,
      category: "places",
    });
    catalog = out;
  }
  function distance(e) {
    const p = localPlayer?.mesh?.position;
    return p ? Math.hypot(p.x - e.x, p.z - e.z) : Infinity;
  }
  function list() {
    return catalog
      .filter(
        (e) =>
          (filter === "all" || e.category === filter) &&
          (!favOnly || data.favorites.includes(e.id)) &&
          e.name
            .toLocaleLowerCase("ru")
            .includes(query.toLocaleLowerCase("ru")),
      )
      .sort((a, b) => distance(a) - distance(b));
  }
  function mark(id) {
    if (!safeWorld()) {
      message(
        "Отметить городскую цель можно после выхода из помещения или морского района.",
      );
      return false;
    }
    const e = catalog.find((e) => e.id === id);
    if (!e) return false;
    setNavTarget(e.x, e.z, e.name, true);
    SETTINGS.nav = true;
    close();
    return true;
  }
  function favorite(id) {
    if (!catalog.some((e) => e.id === id)) return false;
    const i = data.favorites.indexOf(id);
    if (i < 0) data.favorites.push(id);
    else data.favorites.splice(i, 1);
    save();
    return true;
  }
  function pause() { route = null; clearNavTarget(); }
  function stop() {
    data.pending = null;
    save();
    route = null;
    clearNavTarget();
    if (panel && !panel.hidden) render();
  }
  function start(id, resume = false) {
    load();
    refresh();
    if (!safeWorld() || window.cine || localCar) return false;
    const def = walks.find((w) => w.id === id);
    if (!def) return false;
    const points = def.stops.map((type) =>
      catalog.find((e) => e.type === type),
    );
    if (points.some((e) => !e)) return false;
    const index = resume && data.pending?.id === id ? data.pending.index : 0;
    route = { id, index, ids: points.map((e) => e.id), name: def.name };
    data.pending = { id, index };
    save();
    mark(route.ids[index]);
    return true;
  }
  function message(text) {
    const e = panel?.querySelector("[data-message]");
    if (e) e.textContent = text;
  }
  function close() {
    if (panel) panel.hidden = true;
    if (focus?.isConnected) focus.focus();
    focus = null;
    window.FZTouch?.release();
  }
  function add(parent, tag, text, cls) {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    if (cls) el.className = cls;
    parent.appendChild(el);
    return el;
  }
  function map(canvas, entries) {
    const c = canvas.getContext("2d");
    canvas.width = 760;
    canvas.height = 360;
    c.fillStyle = "#172435";
    c.fillRect(0, 0, 760, 360);
    const tx = (x) => (x + 460) * 0.82,
      tz = (z) => 180 - z * 0.55;
    c.strokeStyle = "#72818d";
    c.lineWidth = 4;
    for (const r of FZRoads.roads) {
      c.beginPath();
      const a = (r.along || 0) - r.length / 2,
        b = (r.along || 0) + r.length / 2;
      if (r.axis === "x") {
        c.moveTo(tx(r.center), tz(a));
        c.lineTo(tx(r.center), tz(b));
      } else {
        c.moveTo(tx(a), tz(r.center));
        c.lineTo(tx(b), tz(r.center));
      }
      c.stroke();
    }
    for (const e of entries) {
      c.fillStyle = data.favorites.includes(e.id) ? "#e0c28b" : "#96b4c4";
      c.beginPath();
      c.arc(tx(e.x), tz(e.z), e.type === "mall" ? 5 : 3, 0, Math.PI * 2);
      c.fill();
    }
    const p = localPlayer?.mesh?.position;
    if (p) {
      c.fillStyle = "#7de1b7";
      c.beginPath();
      c.arc(tx(p.x), tz(p.z), 6, 0, Math.PI * 2);
      c.fill();
    }
  }
  function render() {
    const listEl = panel.querySelector("[data-list]");
    listEl.replaceChildren();
    panel.querySelector("[data-summary]").textContent =
      "Открыто мест: " +
      data.visited.length +
      " · прогулок пройдено: " +
      data.completed.length +
      " / " +
      walks.length +
      (route
        ? " · сейчас: " +
          route.name +
          " (" +
          (route.index + 1) +
          "/" +
          route.ids.length +
          ")"
        : "");
    panel
      .querySelectorAll("[data-tab]")
      .forEach((b) => b.setAttribute("aria-pressed", b.dataset.tab === tab));
    panel.querySelector("[data-filters]").hidden = tab !== "places";
    map(panel.querySelector("canvas"), catalog);
    if (tab === "walks") {
      add(
        listEl,
        "p",
        "Необязательные прогулки пешком. Можно отменить в любой момент. Наград валютой и сюжетных блокировок нет.",
      );
      for (const w of walks) {
        const row = add(listEl, "article", null, "fz-guide-row");
        add(
          row,
          "strong",
          w.name + (data.completed.includes(w.id) ? " · пройдено" : ""),
        );
        add(
          row,
          "p",
          w.stops
            .map(
              (t) =>
                catalog.find((e) => e.type === t)?.name || "Место загружается",
            )
            .join(" → "),
        );
        const resumable = data.pending?.id === w.id;
        const btn = add(row, "button", resumable ? "Продолжить · точка " + (data.pending.index + 1) + "/3" : "Начать прогулку");
        btn.onclick = () => {
          if (!start(w.id, resumable))
            message("Для прогулки выйди в город и из транспорта.");
        };
      }
      if (route || data.pending) {
        const btn = add(listEl, "button", "Отменить текущую прогулку");
        btn.onclick = stop;
      }
      return;
    }
    const results = list();
    if (!results.length)
      add(listEl, "p", "Ничего не найдено. Измени запрос или фильтр.");
    for (const e of results.slice(0, limit)) {
      const row = add(listEl, "article", null, "fz-guide-row"),
        title = add(row, "strong", e.name);
      title.id = "place-" + listEl.children.length;
      add(
        row,
        "small",
        Math.round(distance(e)) +
          " м по прямой" +
          (data.visited.includes(e.id) ? " · посещено" : ""),
      );
      const buttons = add(row, "div", null, "fz-play-tools"),
        pin = add(buttons, "button", "Отметить вход"),
        star = add(
          buttons,
          "button",
          data.favorites.includes(e.id) ? "★ В избранном" : "☆ В избранное",
        );
      pin.onclick = () => mark(e.id);
      star.setAttribute("aria-pressed", data.favorites.includes(e.id));
      star.onclick = () => {
        favorite(e.id);
        render();
      };
    }
    if (results.length > limit) {
      const more = add(listEl, "button", "Показать ещё 30 мест");
      more.onclick = () => {
        limit += 30;
        render();
      };
    }
  }
  function open() {
    if(window.FZSky?.active()){showNotification("Справочник города доступен после спуска через белый свет.","info");return;}
    if (!active()) return;
    refresh();
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "fzCityGuide";
      panel.className = "fz-play-dialog";
      panel.hidden = true;
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      panel.setAttribute("aria-labelledby", "fzGuideTitle");
      panel.innerHTML =
        '<div class="fz-play-card"><header><div><small>FANTAZIA / ГОРОД</small><h2 id="fzGuideTitle">Куда пойти</h2></div><button data-close>Закрыть</button></header><p data-summary></p><canvas aria-label="Схема улиц. Зелёная точка — ты; золотые — избранные места." role="img"></canvas><div class="fz-play-tools"><button data-tab="places">Места рядом</button><button data-tab="walks">Прогулки</button><button data-clear>Снять отметку</button></div><div data-filters><input data-search type="search" placeholder="Молл, кафе, лаборатория…" aria-label="Поиск места"><select data-filter aria-label="Категория"><option value="all">Все места</option><option value="places">Достопримечательности</option><option value="food">Еда и кафе</option><option value="shops">Магазины</option><option value="services">Сервисы и занятия</option></select><label class="fz-check"><input data-favorites type="checkbox"> Только избранное</label></div><p class="fz-muted">Расстояние — по прямой. Отметка показывает цель, а не путь сквозь здания. Вход: E / «Действие».</p><p role="status" data-message></p><div data-list></div></div>';
      document.body.appendChild(panel);
      panel.querySelector("[data-close]").onclick = close;
      panel.querySelector("[data-search]").oninput = (e) => {
        query = e.target.value;
        limit = 30;
        render();
      };
      panel.querySelector("[data-filter]").onchange = (e) => {
        filter = e.target.value;
        limit = 30;
        render();
      };
      panel.querySelector("[data-favorites]").onchange = (e) => {
        favOnly = e.target.checked;
        limit = 30;
        render();
      };
      panel.querySelectorAll("[data-tab]").forEach(
        (b) =>
          (b.onclick = () => {
            tab = b.dataset.tab;
            render();
          }),
      );
      panel.querySelector("[data-clear]").onclick = stop;
      panel.onclick = (e) => {
        if (e.target === panel) close();
      };
      panel.addEventListener("pointerdown", (e) => e.stopPropagation());
      panel.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          close();
        }
        if (e.key === "Tab") {
          e.preventDefault();
          const els = [...panel.querySelectorAll("button,input,select")].filter(
            (e) => e.getClientRects().length,
          );
          els[
            (els.indexOf(document.activeElement) +
              (e.shiftKey ? -1 : 1) +
              els.length) %
              els.length
          ].focus();
        }
        e.stopPropagation();
      });
    }
    focus = document.activeElement;
    window.FZPlay?.release();
    if (document.pointerLockElement) document.exitPointerLock();
    panel.hidden = false;
    message("");
    render();
    panel.querySelector("[data-close]").focus();
  }
  function update(now) {
    if (now - last < 250) return;
    last = now;
    if (!active()) {
      close();
      return;
    }
    load();
    if (!safeWorld() || window.cine || window._loadingGate) return;
    if (now - scanAt > 2000 || !catalog.length) {
      refresh();
      scanAt = now;
    }
    let changed = false;
    for (const e of catalog)
      if (distance(e) < 5 && !data.visited.includes(e.id)) {
        data.visited.push(e.id);
        changed = true;
      }
    if (route && !localCar) {
      const target = catalog.find((e) => e.id === route.ids[route.index]);
      if (target && distance(target) < 5) {
        route.index++;
        if (route.index >= route.ids.length) {
          if (!data.completed.includes(route.id)) data.completed.push(route.id);
          window.FZUI?.record("Прогулка завершена", route.name);
          route = null;
          data.pending = null;
          clearNavTarget();
        } else {
          data.pending = { id: route.id, index: route.index };
          const next = catalog.find((e) => e.id === route.ids[route.index]);
          if (next) setNavTarget(next.x, next.z, next.name, true);
        }
        changed = true;
      }
    }
    if (changed) {
      save();
      if (panel && !panel.hidden) render();
    }
  }
  window.FZGuide = {
    open,
    close,
    refresh,
    mark,
    favorite,
    start,
    stop,
    pause,
    exportState: () => { load(); return FZJourneyPolicy.guide(data); },
    importState: (raw) => { load(); pause(); data = FZJourneyPolicy.guide(raw); return save(); },
    update,
    info: () => ({
      places: catalog.map((e) => ({ ...e })),
      favorites: [...data.favorites],
      visited: [...data.visited],
      completed: [...data.completed],
      pending: data.pending ? { ...data.pending } : null,
      route: route ? { ...route, ids: [...route.ids] } : null,
    }),
  };
})();
