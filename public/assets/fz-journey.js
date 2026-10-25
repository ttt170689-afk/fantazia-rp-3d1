/* v15: local, per-profile travel notebook, explicit resume and portable journal.
 * This deliberately does NOT serialize the game's economy or lab state. */
(function () {
  "use strict";
  const P = FZJourneyPolicy;
  let who = "",
    data = P.clean(null),
    store = null,
    panel = null,
    focus = null,
    lastSample = 0,
    lastRetry = -Infinity,
    pending = null,
    importSerial = 0,
    messageText = "";
  const identity = () =>
    String(currentUser?.username || localPlayer?.name || "guest").slice(0, 80);
  function bind() {
    const next = identity();
    if (next === who && store) return;
    who = next;
    importSerial++;
    let storage;
    try {
      storage = localStorage;
    } catch {
      storage = {
        getItem: () => null,
        setItem: () => {
          throw Error();
        },
      };
    }
    store = new P.Store(storage, "fz_journey_v15:" + encodeURIComponent(who));
    data = store.read();
    pending = null;
    messageText = store.recovered
      ? "Основная запись повреждена: восстановлена предыдущая копия."
      : "";
  }
  function active() {
    return !!window.FZUI?.playing();
  }
  function safe() {
    return (
      active() &&
      FZPlay.outdoor() &&
      !FZSky.active() &&
      !DLC.hidden &&
      !DLC.repair &&
      localPlayer.health > 0 &&
      !window.isAdminFly &&
      Math.abs(localPlayer.mesh.position.y) < 0.15 &&
      isGrounded
    );
  }
  function free(p) {
    return (
      !!P.point(p) &&
      !checkCollision(p.x, p.z) &&
      !(
        typeof cars !== "undefined" &&
        cars.some(
          (c) =>
            c.mesh &&
            Math.hypot(c.mesh.position.x - p.x, c.mesh.position.z - p.z) < 3,
        )
      )
    );
  }
  function write() {
    data.updatedAt = Date.now();
    const ok = store.write(data);
    if (!ok)
      message(
        "Браузер не разрешил запись. Экспортируй копию: после закрытия вкладки изменения могут пропасть.",
      );
    return ok;
  }
  function capture() {
    bind();
    if (!safe()) return false;
    const p = P.point(localPlayer.mesh.position);
    if (!free(p)) return false;
    if (
      data.lastCity &&
      Math.hypot(data.lastCity.x - p.x, data.lastCity.z - p.z) < 2
    )
      return false;
    data.lastCity = p;
    write();
    return true;
  }
  function frame(now) {
    if (now - lastSample < 15000) return;
    lastSample = now;
    if (active()) capture();
  }
  function savePlace(label) {
    bind();
    if (!safe()) {
      message(
        "Запоминать место можно стоя на земле в городе, вне сцен и транспорта.",
      );
      return false;
    }
    const p = P.point(localPlayer.mesh.position);
    if (!free(p)) {
      message("Здесь нет безопасной точки для возвращения.");
      return false;
    }
    if (data.places.length >= 8) {
      message("Можно сохранить 8 мест. Сначала удали ненужное.");
      return false;
    }
    data.places.push({
      ...p,
      id:
        Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
      label: String(label || "Моё место")
        .trim()
        .slice(0, 40),
    });
    data.lastCity = p;
    write();
    render();
    return true;
  }
  function remove(id) {
    bind();
    data.places = data.places.filter((p) => p.id !== id);
    write();
    render();
  }
  function landing(target) {
    if (!safe()) return false;
    for (const r of [0, 1, 2, 3])
      for (let i = 0; i < 8; i++) {
        const p = {
          x: target.x + Math.cos((i * Math.PI) / 4) * r,
          z: target.z + Math.sin((i * Math.PI) / 4) * r,
        };
        if (!free(p)) continue;
        if (sittingOn) standUpFromSeat();
        localPlayer.mesh.position.set(p.x, 0, p.z);
        Object.assign(velocity, { x: 0, y: 0, z: 0 });
        isGrounded = true;
        FZPlay.release();
        data.lastCity = P.point(p);
        write();
        return true;
      }
    return false;
  }
  function resume(id) {
    bind();
    const p =
      id === "last" ? data.lastCity : data.places.find((p) => p.id === id);
    if (!p) {
      message("Сначала прогуляйся по городу или запомни место.");
      return false;
    }
    const target = { x: p.x, z: p.z },
      account = who;
    if (!active() || window.cine || window._loadingGate) return false;
    if (FZSky.active()) {
      close();
      return FZSky.descend(() => {
        if (identity() === account && !landing(target))
          showNotification(
            "Сохранённое место занято. Ты остался на городской площади.",
            "info",
          );
      });
    }
    if (!landing(target)) {
      message(
        "Сначала выйди из помещения/транспорта. Если точка занята, выбери другую.",
      );
      return false;
    }
    close();
    return true;
  }
  function message(text) {
    messageText = text;
    const el = panel?.querySelector("[data-status]");
    if (el) el.textContent = text;
  }
  function snapshot() {
    bind();
    return P.pack(who, data, FZGuide.exportState());
  }
  function exportCopy() {
    capture();
    const blob = new Blob([JSON.stringify(snapshot(), null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download =
      "Fantazia-my-city-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    message(
      "Запрос на скачивание отправлен. Это копия мест и прогулок, не аккаунта, валюты или сюжета.",
    );
  }
  async function importFile(file) {
    bind();
    const request = ++importSerial;
    pending = null;
    if (!file) return false;
    if (file.size > 65536) {
      message("Файл слишком большой: максимум 64 КБ.");
      return false;
    }
    const account = who;
    try {
      const parsed = P.unpack(await file.text(), account);
      if (
        identity() !== account ||
        request !== importSerial ||
        !panel ||
        panel.hidden
      )
        return false;
      pending = parsed;
      message(
        "Проверено: " +
          pending.data.places.length +
          " мест. Подтверди замену текущего журнала. Старые данные будут заменены.",
      );
      panel.querySelector("[data-confirm]").hidden = false;
      return true;
    } catch (e) {
      if (request !== importSerial) return false;
      message(e.message);
      return false;
    }
  }
  function confirmImport() {
    bind();
    if (!pending) return false;
    if (pending.player !== who) return false;
    data = P.clean(pending.data);
    const copied = FZGuide.importState(pending.journal);
    pending = null;
    const ok = write();
    message(
      ok && copied
        ? "Места и журнал восстановлены. Аккаунт, валюта и лаборатория не менялись."
        : "Копия применена в памяти, но не всё удалось сохранить в браузере.",
    );
    render();
    return true;
  }
  function retry() {
    if (!active() || performance.now() - lastRetry < 5000) return false;
    lastRetry = performance.now();
    if (socket?.connected) {
      message("Связь уже установлена.");
      return true;
    }
    try {
      if (typeof socket?.connect === "function") socket.connect();
      else initSocket(getDefaultPlayerName());
      message(
        "Запрошено переподключение. Позиция и модель игрока не пересоздаются.",
      );
      return true;
    } catch {
      message("Не удалось начать подключение. Проверь интернет.");
      return false;
    }
  }
  function close() {
    importSerial++;
    if (panel) panel.hidden = true;
    pending = null;
    if (focus?.isConnected) focus.focus();
    focus = null;
    FZPlay.release();
  }
  function button(parent, text, fn) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.onclick = fn;
    parent.appendChild(b);
    return b;
  }
  function render() {
    if (!panel || panel.hidden) return;
    panel.querySelector("[data-status]").textContent = messageText;
    panel.querySelector("[data-confirm]").hidden = !pending;
    panel.querySelector("[data-profile]").textContent =
      "Профиль: " +
      (currentUser?.displayName || who) +
      " · сохраняется в этом браузере";
    panel.querySelector("[data-last]").disabled = !data.lastCity;
    panel.querySelector("[data-last]").textContent = FZSky.active()
      ? "Спуститься к последнему месту"
      : "Продолжить с последнего места";
    panel.querySelector("[data-saved]").textContent = data.updatedAt
      ? "Последняя запись: " + new Date(data.updatedAt).toLocaleString("ru-RU")
      : "Сохранённого городского места пока нет. Небесный спавн остаётся началом каждого входа.";
    const list = panel.querySelector("[data-places]");
    list.replaceChildren();
    for (const p of data.places) {
      const row = document.createElement("div");
      row.className = "fz-journey-place";
      const name = document.createElement("strong");
      name.textContent = p.label;
      row.appendChild(name);
      button(row, "Вернуться", () => resume(p.id));
      const del = button(row, "Удалить", () => remove(p.id));
      del.setAttribute("aria-label", "Удалить место " + p.label);
      list.appendChild(row);
    }
    const f = FZPlay.info();
    panel.querySelector("[data-network]").textContent =
      (socket?.connected
        ? "Сервер подключён"
        : "Нет связи с игровым сервером") +
      " · графика " +
      f.profile +
      " · масштаб " +
      Math.round((f.ratio || 1) * 100) +
      "%";
  }
  function open() {
    if (!active()) return;
    bind();
    capture();
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "fzJourney";
      panel.className = "fz-play-dialog";
      panel.hidden = true;
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      panel.setAttribute("aria-labelledby", "fzJourneyTitle");
      panel.innerHTML =
        '<div class="fz-play-card"><header><h2 id="fzJourneyTitle">Мой город</h2><button data-close>Закрыть</button></header><p data-profile></p><p data-saved class="fz-muted"></p><button data-last>Продолжить с последнего места</button><p>Автозапись места — раз в 15 секунд на земле в городе. Сцены, транспорт, лаборатория и небесная площадка не переносятся в эту запись.</p><form data-add><label>Название места<input data-name maxlength="40" placeholder="Например: у парка" autocomplete="off"></label><button type="submit">Запомнить это место</button></form><div data-places></div><details><summary>Копия мест и прогулок</summary><p>Без паролей, аккаунтов, админских ключей, денег и сюжетных флагов. Для переноса войди под тем же ником в другом браузере.</p><div class="fz-play-tools"><button data-export>Скачать копию JSON</button><label class="fz-import">Выбрать копию<input data-import type="file" accept="application/json,.json"></label></div><button data-confirm hidden>Подтвердить замену журнала</button></details><details><summary>Управление и связь</summary><p>Джойстик — идти; свободная область экрана — камера; два пальца — масштаб. «Действие» — входы, предметы, новости. Короткий тап по прыжку теперь запоминается на 160 мс. Размер кнопок и сторону джойстика можно изменить в настройках телефона.</p><p data-network></p><button data-retry>Переподключиться к серверу</button><p>Эта копия не переносит весь игровой прогресс. Серверные аккаунты и сохранение лабораторного сюжета требуют отдельного обновления.</p></details><p data-status role="status" aria-live="polite"></p></div>';
      document.body.appendChild(panel);
      panel.querySelector("[data-close]").onclick = close;
      panel.querySelector("[data-last]").onclick = () => resume("last");
      panel.querySelector("[data-add]").onsubmit = (e) => {
        e.preventDefault();
        if (savePlace(panel.querySelector("[data-name]").value))
          panel.querySelector("[data-name]").value = "";
      };
      panel.querySelector("[data-export]").onclick = exportCopy;
      panel.querySelector("[data-import]").onchange = (e) => {
        panel.querySelector("[data-confirm]").hidden = true;
        importFile(e.target.files[0]);
        e.target.value = "";
      };
      panel.querySelector("[data-confirm]").onclick = confirmImport;
      panel.querySelector("[data-retry]").onclick = retry;
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
          const els = [
            ...panel.querySelectorAll("button,input,summary"),
          ].filter((el) => !el.disabled && el.getClientRects().length);
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
    FZPlay.release();
    document.exitPointerLock?.();
    panel.hidden = false;
    render();
    panel.querySelector("[data-close]").focus();
    FZTouch.update();
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && active()) capture();
  });
  window.addEventListener("pagehide", () => {
    if (active()) capture();
  });
  window.FZJourney = {
    frame,
    open,
    close,
    capture,
    savePlace,
    remove,
    resume,
    exportCopy,
    importFile,
    confirmImport,
    retry,
    snapshot,
    info: () => {
      bind();
      return {
        user: who,
        data: P.clean(data),
        recovered: store.recovered,
        saveFailed: store.failed,
      };
    },
  };
})();
