/* v29: explicit pick-up / drop-off at live city entrances. Uses the existing
 * frame loop; no forced popups, teleport, timers, renderer or economy writes. */
(function () {
  "use strict";
  const P = window.FZDeliveryPolicy;
  let state = P.fresh(), userKey = "", panel = null, focusBefore = null, hud = null;
  let ownedNav = null, last = -Infinity, storageFailed = false, confirmCancel = false;
  const playing = () => !!window.FZUI?.playing() && !window._loadingGate && !window.cine;
  function street() {
    return playing() && typeof localPlayer !== "undefined" && !!localPlayer?.mesh &&
      !(typeof isInsideBuilding !== "undefined" && isInsideBuilding) &&
      !(typeof isInFactory !== "undefined" && isInFactory) &&
      !(typeof isInBasement !== "undefined" && isInBasement) &&
      !window.FZSky?.active() && !window.FZMetro?.active() && !window.FZ8M?.ride?.() &&
      !window.FZ8SEA?.active() && !window.FZCranes?.active();
  }
  function position() { return typeof localPlayer !== "undefined" ? localPlayer?.mesh?.position : null; }
  function rows() { return P.catalog(typeof interactables === "undefined" ? [] : interactables); }
  function notify(text) { if (playing() && typeof showNotification === "function") showNotification(text,"info"); }
  function clearOwnNav() {
    if (ownedNav && window.navTarget === ownedNav && typeof clearNavTarget === "function") clearNavTarget();
    ownedNav = null;
  }
  function load() {
    const who = (typeof currentUser !== "undefined" && currentUser?.username) ||
      (typeof localPlayer !== "undefined" && localPlayer?.name) || "guest";
    const key = "fz_deliveries_v29:" + encodeURIComponent(String(who).slice(0,80));
    if (key === userKey) return;
    clearOwnNav(); close(); if (hud) hud.hidden = true;
    userKey = key; state = P.fresh(); storageFailed = false;
    try { state = P.clean(JSON.parse(localStorage.getItem(key))); } catch (_) { /* malformed/unavailable storage: fresh local session */ }
  }
  function save(next) {
    state = P.clean(next);
    try { localStorage.setItem(userKey,JSON.stringify(state)); storageFailed = false; }
    catch (_) { storageFailed = true; }
  }
  function navigate(closeAfter = true) {
    if (!playing()) return false;
    load();
    const r = P.resolve(state.active,rows());
    if (!street() || !r) { notify("Для маршрута выйдите на улицу; оба входа должны быть загружены."); return false; }
    window.FZGuide?.pause(); clearOwnNav();
    if (typeof setNavTarget !== "function") return false;
    setNavTarget(r.target.x,r.target.z,(state.active.phase === "pickup" ? "Забрать: " : "Доставить: ")+r.target.title,true);
    ownedNav = window.navTarget;
    if (closeAfter) close();
    return true;
  }
  function accept(offer) {
    if (!street()) return false;
    load(); const list = rows();
    // Resolve against live entries at click time; never use stored coordinates.
    const next = P.start(state,offer,list);
    if (!next) return false;
    save(next); navigate(); notify("Заказ принят. Сначала заберите посылку у входа магазина.");
    return true;
  }
  function handover() {
    if (!street() || (typeof localCar !== "undefined" && localCar)) return false;
    load(); const list = rows(), r = P.resolve(state.active,list);
    const next = P.step(state,list,position(),Date.now());
    if (!next) { notify("Подойдите к отмеченному входу пешком: не дальше 4,5 м."); return false; }
    const delivered = !next.active;
    save(next); confirmCancel = false;
    if (delivered) {
      clearOwnNav();
      window.FZUI?.record("Доставка завершена",r.job.title);
      notify("Посылка передана. Доставка записана в ваш журнал.");
    } else { navigate(false); notify("Посылка у вас. Следующая точка — получатель."); }
    if (panel) render();
    return true;
  }
  function cancel() {
    if (!playing()) return false;
    load(); if (!state.active) return false;
    if (!confirmCancel) { confirmCancel = true; if (panel) render(); return false; }
    save({ ...state, active: null }); clearOwnNav(); confirmCancel = false;
    if (panel) render(); notify("Заказ отменён, без штрафа."); return true;
  }
  function el(tag, text, parent, cls) {
    const node = document.createElement(tag); if (text) node.textContent = text;
    if (cls) node.className = cls; parent?.append(node); return node;
  }
  function button(text, parent, fn, id) {
    const b = el("button",text,parent); b.type = "button"; b.onclick = fn;
    if (id) b.dataset.action = id; return b;
  }
  function render() {
    if (!panel) return;
    const content = panel.querySelector("[data-content]"), previous = document.activeElement?.dataset.action;
    content.replaceChildren();
    const list = rows(), r = P.resolve(state.active,list);
    el("p", "Выполнено: " + state.completed + (state.completed >= 10 ? " · Курьер района" : state.completed >= 3 ? " · Надёжный курьер" : state.completed ? " · Первая доставка" : " · Первый заказ впереди"),content,"fz-delivery-summary");
    el("p","Добровольные RP-заказы без денежных наград. Прогресс хранится только в этом браузере для текущего персонажа.",content,"fz-delivery-note");
    if (storageFailed) el("p","Браузер не разрешил сохранение. Прогресс доступен только до закрытия страницы.",content,"fz-delivery-warning");
    if (state.active) {
      const box = el("article",null,content,"fz-delivery-order");
      el("h3",P.jobs.find(j=>j.id===state.active.job).title,box);
      const steps = el("ol",null,box,"fz-delivery-steps");
      el("li","1 · Забрать у магазина",steps).dataset.current = String(state.active.phase === "pickup");
      el("li","2 · Передать у входа получателя",steps).dataset.current = String(state.active.phase === "dropoff");
      if (!r) {
        el("p","Точки заказа пока не загружены. Прогресс сохранён: выйдите в город и обновите список либо отмените заказ.",box);
      } else {
        el("p",r.job.item + " · " + (state.active.phase === "pickup" ? "ещё в магазине" : "у вас"),box);
        el("p","Откуда: " + r.from.title,box);
        el("p","Куда: " + r.to.title,box);
        el("p","",box,"fz-delivery-distance").dataset.distance = "";
        const actions = el("div",null,box,"fz-delivery-actions");
        button("Показать маршрут",actions,()=>navigate(),"route");
        button(state.active.phase === "pickup" ? "Забрать посылку" : "Передать посылку",actions,handover,"handover");
      }
      button(confirmCancel ? "Подтвердить отмену — без штрафа" : "Отменить заказ",box,cancel,"cancel");
    } else {
      if (!street()) el("p","Для новых заказов спуститесь в город и выйдите на улицу.",content,"fz-delivery-warning");
      const offers = street() ? P.offers(list,position()) : [];
      if (street() && !offers.length) el("p","Подходящих пар входов пока нет. Дождитесь загрузки города и обновите список.",content);
      for (const offer of offers) {
        const r = P.resolve({...offer,phase:"pickup"},list), card = el("article",null,content,"fz-delivery-order");
        el("h3",r.job.title,card); el("p",r.job.item,card,"fz-delivery-note");
        el("p",r.from.title + " → " + r.to.title,card);
        el("p","До магазина: " + Math.round(P.distance(position(),r.from)) + " м · между входами: " + Math.round(P.distance(r.from,r.to)) + " м по прямой",card,"fz-delivery-note");
        button("Взять заказ",card,()=>accept(offer),"accept-"+offer.job);
      }
    }
    if (state.history.length) {
      const details = el("details",null,content); el("summary","Последние доставки",details);
      const list = el("ul",null,details);
      for (const h of [...state.history].reverse()) el("li",P.jobs.find(j=>j.id===h.job).title + " · " + new Date(h.at).toLocaleDateString("ru-RU"),list);
    }
    refreshAction();
    if (previous) ([...panel.querySelectorAll("[data-action]")].find(b=>b.dataset.action===previous) || panel.querySelector('[data-action="close"]')).focus();
  }
  function refreshAction() {
    if (!panel) return;
    const r = P.resolve(state.active,rows()), p = position(), b = panel.querySelector('[data-action="handover"]'), distance = panel.querySelector("[data-distance]");
    if (!r || !b) return;
    const meters = P.distance(p,r.target), onStreet = street(), walking = !(typeof localCar !== "undefined" && localCar);
    b.disabled = !onStreet || !walking || meters > 4.5 || !Number.isFinite(p?.y) || Math.abs(p.y-r.target.y)>3;
    distance.textContent = !onStreet ? "Выйдите на улицу: передача происходит у входа." : !walking ? "Выйдите из машины для передачи посылки." :
      !b.disabled ? "Вы на месте. Нажмите кнопку передачи." : "До точки: " + Math.round(meters) + " м · подойдите к входу на уровне земли.";
  }
  function close() {
    if (!panel) return;
    panel.remove(); panel = null; confirmCancel = false;
    if (focusBefore?.isConnected) focusBefore.focus(); focusBefore = null;
  }
  function open() {
    if (!playing()) return false;
    load(); if (panel) { panel.querySelector('[data-action="close"]').focus(); return true; }
    window.FZUI?.close(); focusBefore = document.activeElement;
    window.FZPlay?.release(); if (document.pointerLockElement) document.exitPointerLock?.();
    panel = el("section",null,document.body,"fz-delivery-modal"); panel.id = "fzDeliveries";
    panel.setAttribute("role","dialog"); panel.setAttribute("aria-modal","true"); panel.setAttribute("aria-labelledby","fzDeliveryTitle");
    const card = el("div",null,panel,"fz-delivery-card"), header = el("header",null,card);
    el("h2","Заказы района",header).id = "fzDeliveryTitle";
    button("Закрыть",header,close,"close");
    el("p","Заберите. Дойдите. Передайте.",card,"fz-delivery-subtitle");
    el("div",null,card).dataset.content = "";
    button("Обновить входы и заказы",card,render,"refresh");
    panel.onclick = e => { if (e.target === panel) close(); };
    panel.addEventListener("pointerdown",e=>e.stopPropagation());
    panel.addEventListener("keydown",e=>{
      e.stopPropagation();
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
      if (e.key === "Tab") {
        const list = [...panel.querySelectorAll("button:not(:disabled),summary")], i = list.indexOf(document.activeElement);
        e.preventDefault(); list[(i+(e.shiftKey?-1:1)+list.length)%list.length]?.focus();
      }
    });
    render(); panel.querySelector('[data-action="close"]').focus(); return true;
  }
  function update(now) {
    if (!playing()) { close(); if (hud) hud.hidden = true; clearOwnNav(); return; }
    load();
    if (now-last < 250) return; last = now;
    if (panel) refreshAction();
    if (!hud && state.active) {
      hud = button("",document.body,open); hud.id = "fzDeliveryHUD";
      hud.setAttribute("aria-label","Открыть текущий заказ доставки");
    }
    if (!hud) return;
    hud.hidden = !state.active || !street() || [...document.querySelectorAll('[role="dialog"]:not([hidden])')].some(e => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden") || document.hidden;
    if (hud.hidden) return;
    const r = P.resolve(state.active,rows());
    const text = !r ? "📦 Заказ сохранён · проверить точки" :
      "📦 " + (state.active.phase === "pickup" ? "Забрать" : "Доставить") + " · " + Math.round(P.distance(position(),r.target)) + " м · открыть";
    if (hud.textContent !== text) hud.textContent = text;
  }
  window.FZDeliveries = { open, close, update, navigate, accept, handover, cancel,
    info: () => { if (!playing()) return null; load(); return P.clean(state); } };
})();
