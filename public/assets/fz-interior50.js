/* Interior 50 visit controller. Extends the existing collision/lift owner, never replaces money or saves. */
(function () {
  "use strict";
  const P = FZInterior50Policy;
  const C = FZInterior50Catalog;
  const UI = FZInterior50UI;
  let visit = null;
  let revision = 0;
  function position() {
    const p = localPlayer.mesh.position;
    return { x: p.x - INTERIOR_BASE.x, y: p.y, z: p.z - INTERIOR_BASE.z };
  }
  function notify(text) {
    showNotification(text, "info");
  }
  function save() {
    if (!visit) return;
    if (!visit.store.save() && !visit.storageWarning) {
      visit.storageWarning = true;
      notify(
        "Памятки этого здания пока сохраняются только в памяти: браузер запретил запись.",
      );
    }
  }
  function remember(field, id) {
    if (!visit || visit.store.data[field].includes(id)) return;
    visit.store.data[field].push(id);
    save();
  }
  function guarded(run) {
    const token = visit?.revision;
    return (...args) => {
      if (!visit || visit.revision !== token || !isInsideBuilding) return;
      return run(...args);
    };
  }
  function show(title, description, choices = [], paragraphs = []) {
    if (!visit) return;
    visit.queueStatus = null;
    return UI.show(
      title,
      description,
      choices.map((choice) => ({ ...choice, run: guarded(choice.run) })),
      paragraphs,
    );
  }
  function select(id) {
    if (!visit) return false;
    const target = P.goal(visit.k.rooms50, id);
    if (!target) return false;
    visit.target = target;
    visit.marker.visible = true;
    visit.marker.position.set(
      target.entry[0],
      target.floor * visit.k.FH + 0.06,
      target.entry[1],
    );
    refresh();
    return true;
  }
  function clearTarget() {
    if (!visit) return;
    visit.target = null;
    visit.marker.visible = false;
    refresh();
  }
  function openMap() {
    if (!visit) return;
    window.FZBuildings?.close();
    UI.map(visit, guarded(select), guarded(clearTarget));
  }
  function documentPanel(id) {
    const doc = C.documents[id];
    if (!doc) return;
    remember("read", id);
    show(
      doc.title,
      "Памятка здания · сохраняется локально для этого профиля",
      [{ id: "map", label: "План здания", run: openMap }],
      doc.paragraphs,
    );
  }
  function queueText() {
    const ticket = visit?.queue.ticket;
    if (!ticket)
      return "У вас нет активного талона. Выберите услугу у терминала.";
    const service = P.services.find((item) => item.id === ticket.service);
    if (ticket.status === "waiting")
      return (
        ticket.code + " · " + service.title + ". Ожидайте приглашения на табло."
      );
    if (ticket.status === "serving")
      return ticket.code + " · обслуживание у окна " + ticket.window + ".";
    return (
      ticket.code +
      " → окно " +
      ticket.window +
      ". Вас приглашают к операционисту."
    );
  }
  function queueMenu() {
    if (!visit) return;
    const ticket = visit.queue.ticket;
    const choices = ticket
      ? [
          {
            id: "ticket-route",
            label: "Показать моё окно на плане",
            run() {
              select(ticket.service);
              openMap();
            },
          },
          {
            id: "ticket-cancel",
            label: "Отменить талон",
            run() {
              P.cancel(visit.queue);
              updateDisplay();
              queueMenu();
            },
          },
        ]
      : P.services.map((service) => ({
          id: "ticket-" + service.id,
          label: service.title + " · окно " + service.window,
          run() {
            const result = P.issue(visit.queue, service.id);
            if (result.ok) {
              notify(
                "Получен талон " +
                  result.ticket.code +
                  ". Дождитесь приглашения.",
              );
              window.FZSound?.effect?.("uiConfirm");
            }
            updateDisplay();
            queueMenu();
          },
        }));
    choices.push({
      id: "bank-services",
      label: "Чем отличаются услуги",
      run: () => documentPanel("bank-services"),
    });
    const content = show(
      "Электронная очередь",
      "Бесплатный локальный талон для этого визита. Банкоматы работают без очереди.",
      choices,
    );
    if (content) {
      visit.queueStatus = UI.status(queueText());
      content.prepend(visit.queueStatus);
    }
  }
  function bankAccount() {
    if (!visit) return;
    if (typeof window.FZ7_open !== "function") {
      notify(
        "Банковский интерфейс ещё не готов. Попробуйте снова; деньги не изменены.",
      );
      return;
    }
    UI.close();
    // This is the existing account UI, not an alternate wallet or a new transaction API.
    window.FZ7_open("bank");
    visit.bankPanel = document.getElementById("fz7m_bank");
  }
  function accountMenu() {
    show(
      "Банкомат",
      "Открывается существующий игровой счёт. Нажатие этой кнопки само по себе не проводит денежную операцию.",
      [
        {
          id: "open-account",
          label: "Открыть игровой банковский интерфейс",
          run: bankAccount,
        },
        {
          id: "bank-safety",
          label: "Правила безопасности",
          run: () => documentPanel("bank-safety"),
        },
        {
          id: "bank-services",
          label: "Услуги отделения",
          run: () => documentPanel("bank-services"),
        },
      ],
    );
  }
  function consultation() {
    show(
      "Консультация в банке",
      "Никаких настоящих документов. Просмотр справки не оформляет кредит.",
      [
        {
          id: "consult-deposit",
          label: "Как устроен игровой вклад",
          run() {
            show(
              "Игровой вклад",
              "Условия и текущая сумма показаны в существующем банковском интерфейсе.",
              [
                {
                  id: "open-account",
                  label: "Посмотреть условия в банке",
                  run: bankAccount,
                },
                {
                  id: "consult-back",
                  label: "Вернуться к вопросам",
                  run: consultation,
                },
              ],
              [
                "Новый интерьер не меняет ставку, баланс или правила начисления. Перевод денег выполняется только отдельным действием в банковском интерфейсе.",
              ],
            );
          },
        },
        {
          id: "consult-loan",
          label: "Чем кредит отличается от вклада",
          run() {
            show(
              "Игровой кредит",
              "Кредит создаёт игровой долг; это не подарок.",
              [
                {
                  id: "consult-back",
                  label: "Вернуться к вопросам",
                  run: consultation,
                },
                {
                  id: "open-account",
                  label: "Посмотреть существующие условия",
                  run: bankAccount,
                },
              ],
              [
                "Перед оформлением проверьте сумму, условия и кнопку погашения. Эта консультация ничего не оформляет.",
              ],
            );
          },
        },
        {
          id: "consult-finish",
          label: "Завершить консультацию без операций",
          run() {
            remember("completed", "consultation");
            show(
              "Консультация завершена",
              "Запись добавлена в локальный журнал здания. Денежных операций не было.",
              [{ id: "history", label: "Открыть журнал", run: history }],
            );
          },
        },
      ],
    );
  }
  function teller(windowNumber) {
    const result = P.serve(visit.queue, windowNumber);
    if (!result.ok) {
      const text =
        result.reason === "missing"
          ? "Сначала получите талон у терминала возле входа. Банкомат доступен без талона."
          : result.reason === "waiting"
            ? "Талон ещё не вызван. Подождите приглашения на табло."
            : "Ваш талон относится к окну " +
              visit.queue.ticket.window +
              ". Подойдите к указанному окну.";
      show("Окно " + windowNumber, text, [
        { id: "queue-info", label: "Посмотреть мой талон", run: queueMenu },
        { id: "map", label: "План отделения", run: openMap },
      ]);
      return;
    }
    updateDisplay();
    const ticket = result.ticket;
    const choices = [
      {
        id: "open-account",
        label: "Открыть существующий игровой счёт",
        run: bankAccount,
      },
    ];
    if (ticket.service === "account")
      choices.push({
        id: "statement",
        label: "Получить памятку по счёту",
        run() {
          remember("completed", "statement");
          show(
            "Памятка по счёту",
            "Это справка о механике, а не выдуманный баланс или подтверждение перевода.",
            [
              {
                id: "open-account",
                label: "Посмотреть действующие суммы",
                run: bankAccount,
              },
              {
                id: "return-teller",
                label: "Вернуться к операционисту",
                run: () => teller(windowNumber),
              },
            ],
            [
              "Текущие суммы и операции отображаются в существующем игровом банковском интерфейсе. Новый журнал фиксирует только посещение и памятки.",
            ],
          );
        },
      });
    if (ticket.service === "consult")
      choices.push({
        id: "consultation",
        label: "Задать вопрос об услугах",
        run: consultation,
      });
    choices.push({
      id: "finish-ticket",
      label: "Завершить обслуживание",
      run() {
        if (P.finish(visit.queue)) {
          updateDisplay();
          show(
            "Обслуживание завершено",
            "Талон закрыт. Следующее посещение окна можно начать с нового талона.",
            [{ id: "history", label: "Журнал визита", run: history }],
          );
        }
      },
    });
    show(
      "Окно " + windowNumber + " · " + ticket.code,
      P.services.find((service) => service.id === ticket.service).description,
      choices,
    );
  }
  function history() {
    const data = visit.store.data;
    const lines = [
      "Посещений этого здания в данном браузере: " + data.visits + ".",
      "Прочитано памяток: " + data.read.length + ".",
      "Бытовых действий и справок отмечено: " + data.completed.length + ".",
      visit.queue.history.length
        ? "Закрытые талоны текущего визита: " +
          visit.queue.history.map((item) => item.code).join(", ") +
          "."
        : "Закрытых талонов в этом визите нет.",
      "Это локальная памятка, не банковская выписка и не серверное хранилище предметов.",
    ];
    show(
      "Журнал здания",
      visit.store.ok
        ? "Сохранение в браузере доступно."
        : "Хранилище недоступно: данные текущего визита остаются в памяти.",
      [{ id: "map", label: "План здания", run: openMap }],
      lines,
    );
  }
  function homeMenu() {
    const done = visit.store.data.completed;
    show(
      "Дом · план и бытовые действия",
      "Осмотрите квартиры, не меняя деньги, предметы или прогресс истории.",
      [
        { id: "map", label: "План этажей и квартир", run: openMap },
        {
          id: "home-guide",
          label: "Что работает в квартире",
          run: () => documentPanel("home-guide"),
        },
        {
          id: "lift-rules",
          label: "Как вызвать лифт",
          run: () => documentPanel("lift-rules"),
        },
        {
          id: "house-rules",
          label: "Правила дома",
          run: () => documentPanel("house-rules"),
        },
        { id: "history", label: "Журнал здания", run: history },
      ],
      [
        (done.includes("water") ? "✓ " : "○ ") +
          "Проверить кухонный кран: включить и дождаться остановки воды.",
        (done.includes("ventilation") ? "✓ " : "○ ") +
          "Проверить вытяжку на кухне: короткий цикл без расхода ресурсов.",
        (done.includes("shower") ? "✓ " : "○ ") +
          "Проверить душ в ванной: вода выключается автоматически.",
        "Это необязательные отметки осмотра, без наград и штрафов. Поручения консьержки из прежней версии также сохранены.",
      ],
    );
  }
  function useDevice(item) {
    if (!visit.k.devices50.includes(item)) return;
    P.toggleDevice(item.state);
    const config = P.devices[item.state.type];
    notify(
      config.title +
        ": " +
        (item.state.on ? config.on : config.off) +
        (item.state.remaining
          ? ". Автоотключение через " + config.duration + " с."
          : "."),
    );
    window.FZSound?.effect?.("click");
  }
  function nearby() {
    if (!visit) return;
    const p = localPlayer.mesh.position;
    const actions = visit.k.actions
      .filter(
        (e) =>
          Math.abs(e.position.y - p.y) < 2.5 &&
          Math.hypot(e.position.x - p.x, e.position.z - p.z) < e.range,
      )
      .sort((a, b) => p.distanceTo(a.position) - p.distanceTo(b.position))
      .slice(0, 12);
    const unique = [...new Map(actions.map((e) => [e.name, e])).values()];
    show(
      "Объекты рядом",
      unique.length
        ? "Те же действия, что доступны через E или сенсорную кнопку. Выберите нужный предмет."
        : "Подойдите к двери, прибору, стойке или панели лифта. Действий через всё здание здесь нет.",
      unique.map((e) => ({
        id: "nearby-" + visit.k.actions.indexOf(e),
        label: e.name,
        run() {
          UI.close();
          // The native owner rechecks distance, floor and membership at activation time.
          FZBuildings.interact(e);
        },
      })),
    );
  }
  function printerMenu(printer) {
    if (!visit.k.printers50?.includes(printer)) return;
    const content = show(
      "Офисный принтер",
      "Печатает только игровую памятку. Файлы и персональные данные не читаются.",
      [
        {
          id: "print-start",
          label:
            printer.phase === "ready"
              ? "Напечатать ещё раз"
              : "Напечатать памятку",
          disabled: printer.phase === "printing",
          run() {
            if (P.printerStart(printer)) {
              printer.output.visible = false;
              printerMenu(printer);
            }
          },
        },
        {
          id: "print-read",
          label: "Прочитать готовую памятку",
          disabled: printer.phase !== "ready",
          run() {
            if (printer.phase !== "ready") return;
            remember("completed", "printed");
            documentPanel("office-printer");
          },
        },
      ],
    );
    visit.printView = {
      printer,
      status: UI.status(
        printer.phase === "printing"
          ? "Печать…"
          : printer.phase === "ready"
            ? "Лист готов."
            : "Принтер готов к работе.",
      ),
    };
    content.prepend(visit.printView.status);
  }
  function interact(e) {
    if (e.kind !== "interior50") return false;
    if (!visit || !visit.k.actions.includes(e)) return true;
    switch (e.command50) {
      case "printer":
        printerMenu(e.printer50);
        break;
      case "map":
        openMap();
        break;
      case "document":
        documentPanel(e.document50);
        break;
      case "device":
        useDevice(e.device50);
        break;
      case "queue":
        queueMenu();
        break;
      case "teller":
        teller(e.window50);
        break;
      case "atm":
        accountMenu();
        break;
      case "consultation":
        consultation();
        break;
      case "restricted":
        show(
          "Служебная зона закрыта",
          "Клиентские операции выполняются у операционистов и в банкомате. Прав сотрудника этот интерьер не выдаёт.",
          [{ id: "map", label: "Найти клиентскую зону", run: openMap }],
        );
        break;
      case "water":
        notify(
          "Вы взяли стакан воды. Это бесплатное RP-действие, здоровье и деньги не изменены.",
        );
        break;
      case "history":
        history();
        break;
      case "home":
        homeMenu();
        break;
      case "profile":
        show(e.profile50.title, e.profile50.detail, [
          {
            id: "home-guide",
            label: "Бытовые взаимодействия",
            run: () => documentPanel("home-guide"),
          },
          { id: "map", label: "План квартиры", run: openMap },
        ]);
        break;
    }
    return true;
  }
  function writeSign(sign, text) {
    if (!sign || sign.last === text) return;
    sign.last = text;
    const c = sign.canvas.getContext("2d");
    if (!c) return;
    c.fillStyle = "#182a38";
    c.fillRect(0, 0, sign.canvas.width, sign.canvas.height);
    c.fillStyle = "#e3e7cf";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = "600 42px Arial";
    c.fillText(
      text,
      sign.canvas.width / 2,
      sign.canvas.height / 2,
      sign.canvas.width - 30,
    );
    sign.texture.needsUpdate = true;
  }
  function updateDisplay() {
    if (!visit) return;
    const ticket = visit.queue.ticket;
    writeSign(
      visit.k.queueDisplay50,
      !ticket
        ? "ТАЛОНЫ У ВХОДА · 3 УСЛУГИ"
        : ticket.status === "waiting"
          ? ticket.code + " · ОЖИДАЙТЕ ПРИГЛАШЕНИЯ"
          : ticket.code + " → ОКНО " + ticket.window,
    );
    if (visit.queueStatus?.isConnected)
      visit.queueStatus.textContent = queueText();
    refresh();
  }
  function refresh() {
    if (!visit) return;
    const p = position();
    const room = P.locate(visit.k.rooms50, p);
    const help = P.guidance(visit.target, p, visit.k.floors);
    const ticket = visit.queue.ticket;
    const text = help.text || (ticket ? queueText() : room?.title || "Коридор");
    if (visit.location.textContent !== text) visit.location.textContent = text;
    visit.routeButton.hidden = !visit.target;
    UI.update();
  }
  function update(k, dt) {
    if (!visit || visit.k !== k || document.hidden) return;
    const d = P.delta(dt);
    if (P.queueStep(visit.queue, d)) {
      notify(queueText());
      window.FZSound?.effect?.("uiConfirm");
      updateDisplay();
    }
    for (const item of k.devices50) {
      const completed = P.deviceStep(item.state, d);
      const { visual, state } = item;
      if (visual.mesh) visual.mesh.visible = state.on;
      if (visual.pivot)
        visual.pivot.rotation.y = -state.amount * Math.PI * 0.47;
      if (visual.rotor && state.on)
        visual.rotor.rotation.y =
          (visual.rotor.rotation.y + d * 12) % (Math.PI * 2);
      if (completed) {
        const id = { tap: "water", cooker: "ventilation", shower: "shower" }[
          state.type
        ];
        if (id) remember("completed", id);
        if (Math.abs(position().y - item.floor * k.FH) < 1)
          notify(
            P.devices[state.type].title + ": цикл завершён, прибор выключен.",
          );
      }
    }
    for (const printer of k.printers50 || []) {
      if (P.printerStep(printer, d)) {
        printer.output.visible = true;
        if (
          visit.printView?.printer === printer &&
          visit.printView.status.isConnected
        ) {
          visit.printView.status.textContent =
            "Лист готов. Можно прочитать памятку.";
          document.querySelector('[data-fz50="print-read"]').disabled = false;
          document.querySelector('[data-fz50="print-start"]').disabled = false;
        }
        if (Math.abs(position().y - printer.floor * k.FH) < 1)
          notify("Принтер: памятка готова.");
      }
    }
    if (k.lift) {
      const floor = Math.round(k.lift.y / k.FH) + 1;
      const text =
        k.lift.phase === "open"
          ? "ЭТАЖ " + floor + " · ОТКРЫТО"
          : k.lift.phase === "closing"
            ? "ДВЕРИ ЗАКРЫВАЮТСЯ"
            : (k.lift.to * k.FH > k.lift.y ? "ВВЕРХ · " : "ВНИЗ · ") + floor;
      for (const display of k.liftDisplays50) writeSign(display, text);
    }
    visit.uiTime += d;
    if (visit.uiTime >= 0.2) {
      visit.uiTime = 0;
      refresh();
    }
  }
  function start(k, identity, building, storage) {
    release();
    if (!k.interior50) return;
    const store = new P.Store(storage, identity, building);
    store.data.visits = Math.min(999, store.data.visits + 1);
    const hud = UI.node("div", undefined, "fz50-tools");
    hud.id = "fzInterior50Tools";
    const location = UI.node("span", "", "fz50-location");
    const mapButton = UI.button("План здания", openMap, { id: "open-map" });
    const routeButton = UI.button("Убрать ориентир", clearTarget, {
      id: "cancel-route",
    });
    routeButton.hidden = true;
    const nearbyButton = UI.button("Рядом", nearby, { id: "nearby" });
    hud.append(mapButton, nearbyButton, routeButton, location);
    document.body.append(hud);
    const geometry = k.own(new THREE.RingGeometry(0.65, 0.8, 24));
    const material = k.own(
      new THREE.MeshBasicMaterial({
        color: 0xf0d18c,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    const marker = new THREE.Mesh(geometry, material);
    marker.rotation.x = -Math.PI / 2;
    marker.visible = false;
    marker.name = "interior50_destination";
    k.root.add(marker);
    visit = {
      revision: ++revision,
      k,
      store,
      hud,
      location,
      routeButton,
      marker,
      queue: P.createQueue(),
      target: null,
      position,
      uiTime: 0,
      queueStatus: null,
      storageWarning: false,
    };
    save();
    updateDisplay();
    refresh();
  }
  function release() {
    UI.close();
    if (!visit) return;
    for (const item of visit.k.devices50) {
      item.state.on = false;
      item.state.remaining = 0;
    }
    for (const printer of visit.k.printers50 || []) {
      printer.phase = "idle";
      printer.elapsed = 0;
    }
    visit.bankPanel?.remove();
    visit.hud.remove();
    visit.marker.removeFromParent?.();
    visit = null;
    revision++;
  }
  window.FZInterior50 = {
    start,
    update,
    interact,
    release,
    openMap,
    close: UI.close,
    info: () =>
      visit
        ? {
            type: visit.k.type,
            rooms: visit.k.rooms50.map((room) => ({
              id: room.id,
              title: room.title,
              floor: room.floor,
              public: room.public !== false,
            })),
            target: visit.target?.id || null,
            location: P.locate(visit.k.rooms50, position())?.id || null,
            queue: JSON.parse(JSON.stringify(visit.queue)),
            devices: visit.k.devices50.map((item) => ({
              id: item.id,
              floor: item.floor,
              ...item.state,
            })),
            printers: (visit.k.printers50 || []).map((item) => ({
              id: item.id,
              floor: item.floor,
              phase: item.phase,
              elapsed: item.elapsed,
            })),
            data: P.clean(visit.store.data),
            storage: visit.store.ok,
            panel: UI.active(),
          }
        : null,
  };
})();
