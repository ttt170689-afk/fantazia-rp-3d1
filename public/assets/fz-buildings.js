/* v28 native interior owner: continuous circulation, ordinary E/touch actions,
 * bounded local RP inventory, animated doors and real passenger-carrying lift. */
(function () {
  "use strict";
  const P = FZBuildingPolicy;
  let active = null,
    store = null,
    panel = null,
    focus = null,
    lastFloor = -1,
    queueNumber = 0;
  function notify(text) {
    showNotification(text, "info");
  }
  function position() {
    const p = localPlayer.mesh.position;
    return { x: p.x - INTERIOR_BASE.x, y: p.y, z: p.z - INTERIOR_BASE.z };
  }
  function close() {
    if (panel) {
      panel.remove();
      panel = null;
    }
    if (focus?.isConnected) focus.focus();
    focus = null;
  }
  function modal(title, description, choices = []) {
    close();
    focus = document.activeElement;
    window.FZPlay?.release();
    if (document.pointerLockElement) document.exitPointerLock();
    panel = document.createElement("section");
    panel.className = "fz28-modal";
    panel.id = "fzBuildingPanel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", title);
    const card = document.createElement("div");
    card.className = "fz28-card";
    panel.append(card);
    const heading = document.createElement("h2");
    heading.textContent = title;
    card.append(heading);
    const p = document.createElement("p");
    p.textContent = description;
    card.append(p);
    for (const choice of choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = choice.label;
      b.disabled = !!choice.disabled;
      b.dataset.action = choice.id || "";
      b.onclick = () => {
        if (active) choice.run();
      };
      card.append(b);
    }
    const cancel = document.createElement("button");
    cancel.textContent = "Закрыть";
    cancel.className = "fz28-close";
    cancel.onclick = close;
    card.append(cancel);
    panel.addEventListener("click", (e) => {
      if (e.target === panel) close();
    });
    panel.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
      if (e.key === "Tab") {
        const list = [...card.querySelectorAll("button:not(:disabled)")],
          i = list.indexOf(document.activeElement);
        e.preventDefault();
        list[(i + (e.shiftKey ? -1 : 1) + list.length) % list.length].focus();
      }
    });
    document.body.append(panel);
    card.querySelector("button")?.focus();
  }
  function persist() {
    if (!store.save())
      notify(
        "Браузер не разрешил сохранить данные. До закрытия вкладки они останутся в памяти.",
      );
  }
  function receipt(text) {
    store.data.receipts.push(text);
    store.data.receipts = store.data.receipts.slice(-20);
    persist();
  }
  function balance() {
    const n = Number(localPlayer.money);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  function pay(amount) {
    if (!Number.isFinite(amount) || amount < 0 || balance() < amount) {
      notify("Недостаточно игровых денег.");
      return false;
    }
    localPlayer.money = balance() - amount;
    const el = document.getElementById("moneyDisplay");
    if (el) el.textContent = localPlayer.money;
    return true;
  }
  function bag() {
    const d = store.data;
    modal(
      "Мои покупки",
      P.snacks.map((s) => s.name + ": " + (d.bag[s.id] || 0)).join("\n") +
        "\nУпаковки: " +
        d.wrappers +
        "\nБилеты: " +
        d.tickets.map((i) => "зал " + (i + 1)).join(", "),
      P.snacks.map((s) => ({
        label: "Использовать: " + s.name,
        disabled: !d.bag[s.id],
        run() {
          d.bag[s.id]--;
          d.wrappers = Math.min(999, d.wrappers + 1);
          persist();
          notify(
            "Вы использовали: " + s.name + ". Упаковку можно выбросить в урну.",
          );
          bag();
        },
      })),
    );
  }
  function snacks() {
    modal(
      "Кинобар",
      "Только игровые деньги. Баланс: " +
        balance() +
        " $. Покупки сохраняются в инвентаре этого здания.",
      P.snacks
        .map((s) => ({
          id: s.id,
          label: s.name + " · " + s.price + " $",
          run() {
            if ((store.data.bag[s.id] || 0) >= 99) {
              notify("В сумке уже 99 штук этого товара.");
              return;
            }
            if (pay(s.price)) {
              store.data.bag[s.id] = (store.data.bag[s.id] || 0) + 1;
              receipt(s.name + " — " + s.price + " $");
              snacks();
            }
          },
        }))
        .concat([{ label: "Открыть сумку", run: bag }]),
    );
  }
  function tickets() {
    modal(
      "Касса кинотеатра",
      "Два зала, два коротких локальных 3D-фильма. Билет — игровой сувенир; свободный вход в зал не блокируется.",
      active.screens.map((s, i) => ({
        label: "Зал " + (i + 1) + " · " + s.film + " · 25 $",
        run() {
          if (pay(25)) {
            store.data.tickets.push(i);
            store.data.tickets = store.data.tickets.slice(-8);
            receipt("Билет: " + s.film);
            notify(
              "Билет получен. Зал " +
                (i + 1) +
                " находится " +
                (i ? "справа" : "слева") +
                " от фойе.",
            );
            close();
          }
        },
      })),
    );
  }
  function storage() {
    const d = store.data;
    modal(
      "Домашний шкаф",
      "Хранение покупок: сумка ↔ шкаф. Предметы не дублируются.",
      P.snacks.flatMap((s) => [
        {
          label: "Положить " + s.name + " (" + (d.bag[s.id] || 0) + ")",
          disabled: !d.bag[s.id] || (d.stored[s.id] || 0) >= 999,
          run() {
            d.bag[s.id]--;
            d.stored[s.id] = (d.stored[s.id] || 0) + 1;
            persist();
            storage();
          },
        },
        {
          label: "Взять " + s.name + " (" + (d.stored[s.id] || 0) + ")",
          disabled: !d.stored[s.id] || (d.bag[s.id] || 0) >= 999,
          run() {
            d.stored[s.id]--;
            d.bag[s.id] = (d.bag[s.id] || 0) + 1;
            persist();
            storage();
          },
        },
      ]),
    );
  }
  function taskContext() {
    return { k: active, store, modal, notify, close, receipt };
  }
  function directory() {
    const residential = ["house", "apartment"].includes(active.type);
    modal(
      residential ? "Подъезд №1" : "Указатель этажей",
      Array.from(
        { length: active.floors },
        (_, i) =>
          "Этаж " +
          (i + 1) +
          " — " +
          (residential ? "квартиры " : "кабинеты ") +
          ((i + 1) * 100 + 1) +
          " и " +
          ((i + 1) * 100 + 2),
      ).join("\n") +
        "\nЛестница слева в холле. Лифт справа. Выход на улицу — на первом этаже.",
    );
  }
  function liftMenu() {
    const l = active.lift;
    if (!l) return;
    modal(
      "Лифт",
      "Зайдите в кабину и выберите этаж. Вызов с площадки перемещает пустую кабину; пассажир едет, только если стоит внутри.",
      Array.from({ length: active.floors }, (_, f) => ({
        label: "Этаж " + (f + 1),
        disabled: l.phase !== "open",
        run() {
          requestLift(f);
          close();
        },
      })),
    );
  }
  function requestLift(f) {
    if (!active?.lift || !Number.isInteger(f) || f < 0 || f >= active.floors)
      return false;
    const l = active.lift;
    if (l.phase !== "open") {
      notify("Лифт уже движется. Дождитесь остановки.");
      return false;
    }
    if (Math.abs(l.y - f * active.FH) < 0.01) {
      notify("Кабина на этом этаже, двери открыты.");
      return true;
    }
    l.to = f;
    l.phase = "closing";
    l.elapsed = 0;
    l.carry = false;
    notify("Двери закрываются. Этаж " + (f + 1) + ".");
    return true;
  }
  function cases() {
    modal(
      "Канцелярия суда",
      "Игровые учебные слушания. Реальные персональные данные не нужны. Завершено: " +
        store.data.cases.length,
      P.cases.map((c) => ({ label: c.title, run: () => casePanel(c, 0) })),
    );
  }
  function casePanel(c, stage) {
    if (stage === 0)
      modal(c.title, c.claim, [
        {
          label: "Принять дело и изучить материалы",
          run: () => casePanel(c, 1),
        },
      ]);
    else if (stage === 1)
      modal(
        "Материалы: " + c.title,
        c.facts.map((t, i) => i + 1 + ". " + t).join("\n"),
        [{ label: "Перейти к решению", run: () => casePanel(c, 2) }],
      );
    else
      modal(
        "Решение по делу",
        c.claim,
        c.choices.map((text, i) => ({
          label: text,
          run() {
            if (i !== c.correct) {
              notify(
                "Это решение не подтверждается материалами. Проверьте факты.",
              );
              casePanel(c, 1);
              return;
            }
            store.data.cases.push(c.id);
            store.data.cases = store.data.cases.slice(-20);
            receipt("Завершено дело: " + c.title);
            modal(
              "Слушание завершено",
              c.result + "\nРезультат записан в локальный журнал.",
            );
          },
        })),
      );
  }
  function queue() {
    if (active.ticket) {
      notify(
        "Ваш талон " +
          active.ticket +
          ". Подойдите к окну " +
          active.ticketWindow +
          ".",
      );
      return;
    }
    queueNumber = (queueNumber % 999) + 1;
    active.ticket = "A" + String(queueNumber).padStart(3, "0");
    active.ticketWindow = ((queueNumber - 1) % 3) + 1;
    active.queueAt = active.time + 3;
    notify("Талон " + active.ticket + " получен. Следите за табло.");
  }
  function updateQueue() {
    if (
      !active.queueDisplay ||
      !active.ticket ||
      active.time < active.queueAt ||
      active.called === active.ticket
    )
      return;
    active.called = active.ticket;
    const { canvas, texture } = active.queueDisplay,
      c = canvas.getContext("2d");
    c.fillStyle = "#132338";
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = "#dbf4d3";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = "600 48px Arial";
    c.fillText(
      active.ticket + " → ОКНО " + active.ticketWindow,
      canvas.width / 2,
      canvas.height / 2,
      730,
    );
    texture.needsUpdate = true;
    notify("Талон " + active.ticket + ", окно " + active.ticketWindow + ".");
  }
  function interact(e) {
    if (!e?.building28) return false;
    if (!active || !active.actions.includes(e) || !isInsideBuilding)
      return true;
    const p = localPlayer.mesh.position;
    if (
      Math.hypot(p.x - e.position.x, p.z - e.position.z) > e.range + 0.6 ||
      Math.abs(p.y - e.position.y) > 2.5
    )
      return true;
    const d = store.data;
    switch (e.kind) {
      case "curtain":
        e.curtain.open = !e.curtain.open;
        d.curtains[e.curtain.id] = e.curtain.open;
        persist();
        break;
      case "roomLight":
        e.light.on = !e.light.on;
        e.light.lamp.intensity = e.light.on ? 0.8 : 0;
        e.light.bulb.material.color.setHex(e.light.on ? 0xffdca0 : 0x444444);
        d.lights[e.light.id] = e.light.on;
        FZResidenceTasks.event(taskContext(), "roomLight", e);
        persist();
        notify(e.light.on ? "Свет включён." : "Свет выключен.");
        break;
      case "laundry":
        active.jobs = active.jobs || [];
        if (active.jobs.some((j) => j.room === e.room)) {
          notify("Стирка уже идёт.");
          break;
        }
        active.jobs.push({ room: e.room, until: active.time + 10 });
        notify("Стирка началась. Цикл длится 10 игровых секунд.");
        break;
      case "doorbell":
        FZResidenceTasks.event(taskContext(), "doorbell", e);
        notify(
          "Динь-дон! Квартира " +
            e.number +
            ". Дверь можно открыть действием рядом с ручкой.",
        );
        window.FZSound?.effect?.("uiConfirm");
        break;
      case "evacuation":
        modal(
          "План эвакуации",
          "Из комнаты выйдите в центральный коридор. Лестничная клетка — слева в холле. На первом этаже выход находится напротив коридора. Это игровой указатель, не инструкция для реального здания.",
        );
        break;
      case "cinemaInfo":
        modal(
          "Два зала · два фильма",
          "Зал 1: «Орбита», короткий 3D-полёт. Зал 2: «Ночной экспресс», поезд в ночном городе. Оба сеанса идут по кругу, примерно по 32 игровых секунды. Кинобар и касса расположены в фойе. Управление показом — у входа внутри каждого зала.",
        );
        break;
      case "receipts":
        modal(
          "Журнал визита",
          d.receipts.length
            ? d.receipts.join("\n")
            : "Пока нет записей. Чеки и завершённые игровые действия сохраняются здесь.",
        );
        break;
      case "door": {
        const door = e.door;
        door.open = !door.open;
        break;
      }
      case "exit":
        requestExit();
        break;
      case "seat":
        sitOnBench(e);
        cameraAngleH = e.seat.rot;
        cameraAngleV = 0.08;
        break;
      case "liftCall":
        requestLift(e.destination);
        break;
      case "liftPanel":
        liftMenu();
        break;
      case "directory":
        directory();
        break;
      case "concierge":
        modal(
          "Консьержка",
          "Здравствуйте! Квартиры пронумерованы по этажам. Лестница слева, лифт справа. Упаковки — в урны у лифта.",
          [
            { label: "Справочник квартир", run: directory },
            {
              label: "Поручения консьержки",
              run: () => FZResidenceTasks.menu(taskContext()),
            },
            {
              label: "Почта",
              run() {
                d.mail = true;
                persist();
                modal(
                  "Почта",
                  "Квитанция и памятка жильца получены. Долги и реальные платежи здесь не начисляются.",
                );
              },
            },
          ],
        );
        break;
      case "mail":
        d.mail = true;
        persist();
        notify("Получены памятка жильца и квитанция.");
        break;
      case "tea":
        d.tea = Math.min(999, d.tea + 1);
        persist();
        notify("Чай готов. Чашек приготовлено: " + d.tea);
        break;
      case "rest":
        d.rest = Math.min(999, d.rest + 1);
        persist();
        notify("Вы отдохнули.");
        break;
      case "wash":
        d.washed = Math.min(999, d.washed + 1);
        persist();
        notify("Вы умылись.");
        break;
      case "cupboard":
        modal(
          "Продукты для дома",
          "Покупки за игровые деньги сохраняются в сумке.",
          P.snacks.map((s) => ({
            label: s.name + " · " + s.price + " $",
            run() {
              if ((d.bag[s.id] || 0) >= 99) return;
              if (pay(s.price)) {
                d.bag[s.id] = (d.bag[s.id] || 0) + 1;
                receipt("Продукты: " + s.name);
                close();
              }
            },
          })),
        );
        break;
      case "storage":
        storage();
        break;
      case "books":
        modal(
          "Книжная полка",
          "«История Fantazia»: город вырос вокруг площади и GRAND MALL. Сегодня его районы связывает кольцевая линия метро.\n\n«Соседи»: сначала поговорите, затем сверяйте факты. Хороший дом начинается с уважения.",
        );
        break;
      case "news":
        modal(
          "Городской канал",
          "В городе открыты подъезды, два кинозала и игровые судебные слушания. Подняться на строительный кран можно по лестнице в страховочной клетке.",
        );
        break;
      case "trash": {
        const n = d.wrappers;
        FZResidenceTasks.event(taskContext(), "trash", {
          amount: n,
          recycle: e.recycle,
        });
        d.wrappers = 0;
        persist();
        notify(
          n ? "Вы выбросили упаковки: " + n : "В сумке нет пустых упаковок.",
        );
        break;
      }
      case "bag":
        bag();
        break;
      case "snacks":
        snacks();
        break;
      case "tickets":
        tickets();
        break;
      case "film": {
        const s = active.screens[e.screen];
        modal(
          s.film,
          "Короткий 3D-фильм воспроизводится локально, без внешнего видеосервиса.",
          [
            {
              label: s.paused ? "Продолжить" : "Пауза",
              run() {
                s.paused = !s.paused;
                close();
              },
            },
            {
              label: "С начала",
              run() {
                s.time = 0;
                s.paused = false;
                close();
              },
            },
          ],
        );
        break;
      }
      case "queue":
        queue();
        break;
      case "bank":
        if (e.window && active.ticket && e.window !== active.ticketWindow) {
          notify("Ваш талон обслуживается у окна " + active.ticketWindow + ".");
          break;
        }
        window.FZ7_open?.("bank");
        if (e.window) active.ticket = null;
        break;
      case "cases":
      case "hearing":
        cases();
        break;
      case "clinic":
        modal(
          "Приём врача",
          "Игровой осмотр за 30 $. Это игровая механика, не медицинская консультация.",
          [
            {
              label: "Пройти осмотр · 30 $",
              run() {
                if (pay(30)) {
                  localPlayer.health = Math.max(
                    Number(localPlayer.health) || 0,
                    100,
                  );
                  receipt("Осмотр в клинике");
                  notify("Игровое здоровье восстановлено.");
                  close();
                }
              },
            },
          ],
        );
        break;
      case "office":
        modal(
          "Рабочее место",
          "Проверьте документ: в заголовке указан кабинет 201, в заявке — 202.",
          [
            {
              label: "Отправить без проверки",
              run() {
                notify("Номера различаются. Исправьте документ.");
              },
            },
            {
              label: "Уточнить номер и исправить",
              run() {
                d.office = Math.min(999, d.office + 1);
                receipt("Документ проверен");
                modal(
                  "Документ принят",
                  "Проверено документов: " +
                    d.office +
                    ". Эта RP-задача не выдаёт бесконечную денежную награду.",
                );
              },
            },
          ],
        );
        break;
      default:
        notify(e.text || "Добро пожаловать.");
    }
    return true;
  }
  function ground() {
    if (!active) return null;
    const p = position(),
      k = active;
    if (k.lift && P.liftInside(p.x, p.z) && Math.abs(p.y - k.lift.y) < 3)
      return k.lift.y;
    let closest = null,
      dist = Infinity;
    for (const r of k.ramps) {
      const h = P.rampHeight(r, p.x, p.z, p.y, k.FH);
      if (h !== null && Math.abs(h - p.y) < dist) {
        closest = h;
        dist = Math.abs(h - p.y);
      }
    }
    if (closest !== null) return closest;
    return Math.max(0, Math.min(k.floors - 1, Math.round(p.y / k.FH))) * k.FH;
  }
  function collision(wx, wz) {
    if (!active) return null;
    const k = active,
      p = position(),
      x = wx - INTERIOR_BASE.x,
      z = wz - INTERIOR_BASE.z;
    if (Math.abs(x) > 25.35 || Math.abs(z) > 24.4) return true;
    if (k.lift?.carry && k.lift.phase === "moving" && !P.liftInside(x, z))
      return true;
    for (const c of k.colliders) {
      if (p.y >= c.maxY - 0.1 || p.y + 2.7 <= c.minY) continue;
      if (c.door && k.doors.find((d) => d.collider === c)?.amount > 0.92)
        continue;
      if (c.lift && k.lift.gates.find((g) => g.blocker === c)?.amount > 0.92)
        continue;
      if (
        x + 0.43 > c.minX &&
        x - 0.43 < c.maxX &&
        z + 0.43 > c.minZ &&
        z - 0.43 < c.maxZ
      )
        return true;
    }
    return false;
  }
  function update(dt) {
    if (!active) return;
    if (!isInsideBuilding || currentBuildingType !== active.type) {
      release();
      return;
    }
    const k = active,
      d = Math.min(0.05, Math.max(0, Number.isFinite(dt) ? dt : 0));
    k.time += d;
    const p = position();
    for (const c of k.curtains || []) {
      c.amount += Math.max(-d, Math.min(d, (c.open ? 1 : 0) - c.amount));
      c.left.position.x = c.x - 2 - c.amount * 2.2;
      c.right.position.x = c.x + 2 + c.amount * 2.2;
    }
    for (const job of k.jobs || [])
      if (!job.done && k.time >= job.until) {
        job.done = true;
        store.data.laundry = Math.min(999, store.data.laundry + 1);
        persist();
        notify("Стирка завершена.");
      }
    k.jobs = (k.jobs || []).filter((j) => !j.done);
    for (const door of k.doors) {
      if (
        !door.open &&
        Math.abs(p.y - door.floor * k.FH) < 2.5 &&
        Math.abs(p.x - door.x) < (door.axis === "z" ? 1.8 : 0.8) &&
        Math.abs(p.z - door.z) < (door.axis === "x" ? 1.8 : 0.8)
      )
        door.open = true;
      door.amount += Math.max(
        -d * 2,
        Math.min(d * 2, (door.open ? 1 : 0) - door.amount),
      );
      door.pivot.rotation.y = door.base - (door.amount * Math.PI) / 2;
    }
    if (k.lift) {
      const l = k.lift,
        old = l.y;
      l.blocked =
        l.phase === "closing" &&
        P.liftDoorway(p.x, p.z) &&
        Math.abs(p.y - l.y) < 2.5;
      if (
        l.phase === "closing" &&
        P.liftDoorway(p.x, p.z) &&
        Math.abs(p.y - l.y) < 2.5
      ) {
        l.elapsed = 0;
        notifyOnce("doorway", "Освободите дверной проём лифта.");
      } else {
        const before = l.phase;
        P.liftStep(l, d, k.FH);
        if (before === "closing" && l.phase === "moving")
          l.carry = P.liftInside(p.x, p.z) && Math.abs(p.y - l.y) < 1;
      }
      l.cab.position.y = l.y;
      l.panel.position.y = l.y;
      l.panel.floor = Math.round(l.y / k.FH);
      if (l.carry) {
        const dy = l.y - old;
        localPlayer.mesh.position.y += dy;
        if (window._camPrev) window._camPrev.y += dy;
        if (window._camLook) window._camLook.y += dy;
        velocity.y = 0;
        if (l.phase === "open") l.carry = false;
      }
      for (const gate of l.gates) {
        const target =
          (l.phase === "open" || l.blocked) &&
          Math.abs(gate.floor * k.FH - l.y) < 0.02
            ? 1
            : 0;
        gate.amount += Math.max(-d * 2, Math.min(d * 2, target - gate.amount));
        gate.a.position.x = 18.3 - gate.amount * 1.35;
        gate.b.position.x = 19.7 + gate.amount * 1.35;
      }
    }
    const f = Math.max(
      0,
      Math.min(k.floors - 1, Math.round(localPlayer.mesh.position.y / k.FH)),
    );
    currentFloor = f;
    if (lastFloor !== f) {
      lastFloor = f;
      const el = document.getElementById("floorIndicator");
      if (el) el.textContent = "Этаж " + (f + 1) + " / " + k.floors;
    }
    for (let i = 0; i < k.groups.length; i++)
      k.groups[i].visible = Math.abs(i - f) <= 1;
    for (const [i, g] of k.staff.entries()) {
      g.userData.head.rotation.y = Math.sin(k.time * 0.5 + i) * 0.1;
      FZOpeningAvatar.pose(g.userData);
    }
    for (const s of k.screens) if (!s.paused) s.time += d;
    updateQueue();
    FZResidenceTasks.updateUI(taskContext());
  }
  function notifyOnce(key, text) {
    if (active[key]) return;
    active[key] = true;
    notify(text);
  }
  function beforeRender() {
    if (!active) return;
    window.FZCinemaFilm?.render(active);
    if (window.cameraMode === "first") return;
    camera.position.x = Math.max(
      INTERIOR_BASE.x - 25,
      Math.min(INTERIOR_BASE.x + 25, camera.position.x),
    );
    camera.position.z = Math.max(
      INTERIOR_BASE.z - 24,
      Math.min(INTERIOR_BASE.z + 24, camera.position.z),
    );
    const y = ground();
    const inCab =
      active.lift &&
      P.liftInside(position().x, position().z) &&
      Math.abs(y - active.lift.y) < 0.1;
    if (inCab) camera.position.y = Math.min(camera.position.y, y + 4.1);
    camera.position.y = Math.max(
      y + 0.5,
      Math.min(y + active.FH - 0.35, camera.position.y),
    );
    // Clip the camera ray against tall partitions, not just the outer shell.
    const player = localPlayer.mesh.position,
      origin = new THREE.Vector3(
        player.x - INTERIOR_BASE.x,
        player.y + 1.6,
        player.z - INTERIOR_BASE.z,
      );
    const end = new THREE.Vector3(
        camera.position.x - INTERIOR_BASE.x,
        camera.position.y,
        camera.position.z - INTERIOR_BASE.z,
      ),
      direction = end.clone().sub(origin);
    let fraction = 1;
    for (const c of active.colliders) {
      if (c.maxY - c.minY < 3) continue;
      if (c.door && active.doors.find((d) => d.collider === c)?.amount > 0.92)
        continue;
      if (
        c.lift &&
        active.lift.gates.find((g) => g.blocker === c)?.amount > 0.92
      )
        continue;
      let lo = 0,
        hi = 1;
      for (const [start, delta, min, max] of [
        [origin.x, direction.x, c.minX - 0.15, c.maxX + 0.15],
        [origin.y, direction.y, c.minY - 0.15, c.maxY + 0.15],
        [origin.z, direction.z, c.minZ - 0.15, c.maxZ + 0.15],
      ]) {
        if (Math.abs(delta) < 1e-8) {
          if (start < min || start > max) {
            hi = -1;
            break;
          }
        } else {
          const first = (min - start) / delta,
            last = (max - start) / delta;
          lo = Math.max(lo, Math.min(first, last));
          hi = Math.min(hi, Math.max(first, last));
        }
      }
      if (lo <= hi && lo > 0 && lo < 1)
        fraction = Math.min(fraction, Math.max(0.04, lo - 0.025));
    }
    if (fraction < 1) {
      end.copy(origin).addScaledVector(direction, fraction);
      camera.position.set(
        INTERIOR_BASE.x + end.x,
        end.y,
        INTERIOR_BASE.z + end.z,
      );
    }
    camera.lookAt(
      localPlayer.mesh.position.x,
      localPlayer.mesh.position.y + 1.6,
      localPlayer.mesh.position.z,
    );
  }
  function requestExit() {
    if (!active) return false;
    const p = position();
    if (p.y > 0.5 || Math.hypot(p.x, p.z - 23) > 4) {
      notify(
        "Выход — у двери на первом этаже. Спуститесь по лестнице или на лифте.",
      );
      return true;
    }
    close();
    doorCine(() => _exitBuildingNow());
    return true;
  }
  function release() {
    FZResidenceTasks.release();
    close();
    if (!active) return;
    if (sittingOn?.spot.building28) standUpFromSeat();
    window.FZCinemaFilm?.release();
    active.dispose();
    interiorObjects = interiorObjects.filter((o) => o !== active.root);
    interactables = interactables.filter((e) => !e.building28);
    active = null;
    store = null;
    lastFloor = -1;
  }
  const previous = window.buildInterior;
  window.buildInterior = function (type) {
    release();
    if (!FZBuildingLayouts.supports(type)) return previous(type);
    window.FZGuide?.pause();
    window.FZVenues?.release();
    window.FZ8B?.release();
    interiorObjects.forEach((o) => scene.remove(o));
    interiorObjects = [];
    interiorColliders = [];
    interactables = interactables.filter((e) => !e.interior);
    npcs = npcs.filter((n) => !n.isInterior);
    active = FZBuildingLayouts.create(type, currentBuildingName);
    if (!active) return previous(type);
    scene.add(active.root);
    interiorObjects.push(active.root);
    interactables.push(...active.actions);
    maxFloors = active.floors;
    currentFloor = 0;
    interiorBounds = { W: 26, D: 25 };
    const identity =
      typeof currentUser !== "undefined" ? currentUser?.username : "guest";
    let storage;
    try {
      storage = localStorage;
    } catch (_) {
      storage = {
        getItem() {
          return null;
        },
        setItem() {
          throw Error("storage unavailable");
        },
      };
    }
    const entrances = interactables
      .filter(
        (e) => !e.interior && (e.destination || e.type) === type && e.position,
      )
      .map((e) => ({
        e,
        d: Math.hypot(e.position.x - outsidePos.x, e.position.z - outsidePos.z),
      }))
      .filter((v) => v.d < 15)
      .sort((a, b) => a.d - b.d);
    const entry = entrances[0]?.e;
    const buildingKey = entry
      ? type +
        ":" +
        Math.round(entry.position.x) +
        ":" +
        Math.round(entry.position.z)
      : type + ":directory:" + String(currentBuildingName).slice(0, 100);
    store = new P.Store(storage, identity, buildingKey);
    localPlayer.mesh.position.set(INTERIOR_BASE.x, 0.01, INTERIOR_BASE.z + 21);
    cameraAngleH = window.cameraMode === "first" ? Math.PI : 0;
    for (const c of active.curtains || []) {
      c.open = store.data.curtains[c.id] !== false;
      c.amount = c.open ? 1 : 0;
    }
    for (const light of active.switches || []) {
      light.on = store.data.lights[light.id] !== false;
      light.lamp.intensity = light.on ? 0.8 : 0;
      light.bulb.material.color.setHex(light.on ? 0xffdca0 : 0x444444);
    }
    update(0);
    window.FZCinemaFilm?.prepare(active);
  };
  window.FZBuildings = {
    active: () => !!active,
    interact,
    update,
    ground,
    collision,
    beforeRender,
    release,
    close,
    requestExit,
    requestLift,
    accept: (e) =>
      !active
        ? !e?.building28
        : !!e?.building28 &&
          Math.abs(localPlayer.mesh.position.y - e.position.y) < 2.5,
    changeFloor(delta) {
      if (!active) return false;
      if (active.lift) {
        notify("Смена этажа — физически, через лифт или лестницу.");
        if (P.liftInside(position().x, position().z)) liftMenu();
      }
      return true;
    },
    info: () =>
      active
        ? {
            type: active.type,
            floors: active.floors,
            doors: active.doors.length,
            seats: active.actions.filter((e) => e.kind === "seat").length,
            staff: active.staff.length,
            actions: active.actions.length,
            lift: active.lift
              ? {
                  y: active.lift.y,
                  to: active.lift.to,
                  phase: active.lift.phase,
                }
              : null,
            films: active.screens.map((s) => ({
              name: s.film,
              time: s.time,
              paused: s.paused,
            })),
            data: P.clean(store.data),
          }
        : null,
  };
})();
