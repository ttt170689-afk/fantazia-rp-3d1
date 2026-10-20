// v9: one pointer-based input owner. The camera listens to the canvas, never
// to an invisible layer above menus. Move and look pointers are independent.
(function () {
  "use strict";
  let root = null,
    panel = null,
    joy = null,
    look = new Map(),
    holds = new Map(),
    axes = { x: 0, y: 0 };
  let lastPointer = "mouse",
    sprint = false,
    crouch = false,
    initialized = false,
    wasBlocked = true;
  let sensitivity = 1,
    previousFocus = null;
  try {
    const n = Number(localStorage.getItem("fz_touch_sensitivity"));
    if (n >= 0.4 && n <= 2) sensitivity = n;
  } catch (e) {}
  const $ = (id) => document.getElementById(id);
  function enabled() {
    return (
      navigator.maxTouchPoints > 0 ||
      matchMedia("(pointer:coarse)").matches ||
      innerWidth <= 900
    );
  }
  function visible(el) {
    return (
      !!el &&
      !el.hidden &&
      el.getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== "hidden"
    );
  }
  function blocked() {
    if (
      !window.FZUI ||
      !FZUI.playing() ||
      window.cine ||
      window._loadingGate ||
      document.hidden
    )
      return true;
    const ae = document.activeElement;
    if (ae && (ae.matches("input,textarea,select") || ae.isContentEditable))
      return true;
    for (const el of document.querySelectorAll(
      '.modal-overlay.show,.fz8Modal,[role="dialog"]:not([hidden]),#pauseMenu.show,#phoneUI,#fz8PanelLife,#fz8Cont,#fz8City,#fz8WpnModal,#fz8MetroModal,#fz7Panel,#fz8Modal,#fz8Modal2,#fz8Dialog,#fz8Mg,#fz8Panel,#fz8CityModal,#danceBar',
    ))
      if (visible(el)) return true;
    return false;
  }
  function setKey(code, down) {
    if (typeof keys !== "undefined") keys[code] = down;
  }
  function emit(code, down) {
    const key =
      {
        Space: " ",
        KeyE: "e",
        KeyX: "x",
        KeyH: "h",
        KeyR: "r",
        Escape: "Escape",
      }[code] || code;
    document.dispatchEvent(
      new KeyboardEvent(down ? "keydown" : "keyup", {
        code,
        key,
        bubbles: true,
        cancelable: true,
      }),
    );
    if (!down) setKey(code, false);
  }
  function release() {
    window.FZMotion?.clear();
    joy = null;
    look.clear();
    axes = { x: 0, y: 0 };
    sprint = false;
    crouch = false;
    for (const code of holds.values()) emit(code, false);
    holds.clear();
    for (const k of [
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "Space",
      "ShiftLeft",
      "KeyC",
      "KeyE",
    ])
      setKey(k, false);
    if (typeof mobileSprintOn !== "undefined") mobileSprintOn = false;
    if (typeof isCrouching !== "undefined") isCrouching = false;
    if ($("fzTouchKnob"))
      $("fzTouchKnob").style.transform = "translate(-50%,-50%)";
    for (const id of ["fzTouchRun", "fzTouchCrouch"])
      $(id)?.setAttribute("aria-pressed", "false");
  }
  function use() {
    if (blocked()) return;
    if (typeof DLC !== "undefined" && DLC.repair) {
      stopGenRepair(false);
      return;
    }
    if (typeof checkInteractables === "function") checkInteractables();
    window.FZPlay?.buzz();
    emit("KeyE", true);
    emit("KeyE", false);
    update();
  }
  function attack() {
    if (blocked()) return;
    window.FZPlay?.buzz();
    if (typeof DLC !== "undefined" && DLC.demonFightStarted) {
      emit("KeyX", true);
      emit("KeyX", false);
    } else if (window.FZ8K) FZ8K.shoot();
  }
  function close() {
    if (panel) panel.hidden = true;
    release();
    if (previousFocus?.isConnected) previousFocus.focus();
    previousFocus = null;
    update();
  }
  function open() {
    if (!window.FZUI || !FZUI.playing()) return;
    init();
    release();
    previousFocus = document.activeElement;
    panel.hidden = false;
    if (document.pointerLockElement && document.exitPointerLock)
      document.exitPointerLock();
    $("fzTouchClose").focus();
    update();
  }
  function init() {
    if (initialized) return;
    initialized = true;
    root = document.createElement("div");
    root.id = "fzTouch";
    root.hidden = true;
    root.innerHTML =
      '<div id="fzTouchStick" role="group" aria-label="Джойстик движения"><span>ДВИЖЕНИЕ</span><i id="fzTouchKnob"></i></div><button id="fzTouchMore" aria-label="Дополнительное управление">•••</button><div id="fzTouchActions"><button id="fzTouchUse">Действие</button><button id="fzTouchJump">Прыжок</button><button id="fzTouchAttack">Удар</button><button id="fzTouchRun" aria-pressed="false">Бег</button><button id="fzTouchCrouch" aria-pressed="false">Присесть</button></div>';
    document.body.appendChild(root);
    panel = document.createElement("section");
    panel.id = "fzTouchPanel";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "fzTouchTitle");
    panel.innerHTML =
      '<div class="touch-card"><header><div><small>FANTAZIA / УПРАВЛЕНИЕ</small><h2 id="fzTouchTitle">Всё под рукой</h2></div><button id="fzTouchClose">Закрыть</button></header><p>Джойстик — идти; его сторону можно поменять в настройках. Веди пальцем по свободному экрану — смотреть. Два пальца по миру — приблизить камеру. Движение и обзор работают одновременно.</p><div class="touch-tools"><button data-tool="view">Вид от 1-го / 3-го лица</button><button data-tool="car">Сесть / выйти из авто</button><button data-tool="reload">Перезарядить</button><button data-tool="leave">Выйти из здания</button><button data-tool="inventory">Инвентарь</button><button data-tool="phone">Телефон / задания</button><button data-tool="dance">Эмоции и танцы</button><button data-tool="guide">Куда пойти в городе</button><button data-tool="comfort">Размер кнопок и качество</button><button data-tool="menu">Все разделы меню</button></div><label for="fzTouchSensitivity">Чувствительность обзора <output id="fzTouchSensitivityValue"></output></label><input id="fzTouchSensitivity" type="range" min="0.4" max="2" step="0.1"><p>«Действие» выполняет то же, что E: двери, предметы, разговоры, задания. Во время ремонта кнопка прыжка становится «Проверка». Ответы и «Завершить» нажимаются прямо в окне задания.</p></div>';
    document.body.appendChild(panel);
    $("fzTouchClose").onclick = close;
    $("fzTouchMore").onclick = open;
    $("fzTouchUse").onclick = use;
    $("fzTouchAttack").onclick = attack;
    $("fzTouchRun").onclick = () => {
      if (blocked()) return;
      sprint = !sprint;
      crouch = false;
      setKey("KeyC", false);
      setKey("ShiftLeft", sprint);
      $("fzTouchRun").setAttribute("aria-pressed", sprint);
      $("fzTouchCrouch").setAttribute("aria-pressed", "false");
    };
    $("fzTouchCrouch").onclick = () => {
      if (blocked()) return;
      crouch = !crouch;
      sprint = false;
      setKey("ShiftLeft", false);
      setKey("KeyC", crouch);
      $("fzTouchCrouch").setAttribute("aria-pressed", crouch);
      $("fzTouchRun").setAttribute("aria-pressed", "false");
    };
    const slider = $("fzTouchSensitivity");
    slider.value = sensitivity;
    const setSensitivity = () => {
      sensitivity = Number(slider.value);
      $("fzTouchSensitivityValue").value = sensitivity.toFixed(1) + "×";
      try {
        localStorage.setItem("fz_touch_sensitivity", String(sensitivity));
      } catch (e) {}
    };
    slider.oninput = setSensitivity;
    setSensitivity();
    panel.querySelectorAll("[data-tool]").forEach(
      (button) =>
        (button.onclick = () => {
          const tool = button.dataset.tool;
          close();
          if (tool === "view" && typeof toggleCameraMode === "function")
            toggleCameraMode();
          if (tool === "car" && typeof handleCarInteraction === "function")
            handleCarInteraction();
          if (tool === "reload" && window.FZ8K) FZ8K.reload();
          if (tool === "leave") {
            if (typeof isInsideBuilding !== "undefined" && isInsideBuilding)
              exitBuilding();
            else if (typeof isInFactory !== "undefined" && isInFactory)
              exitFactory();
            else if (typeof isInBasement !== "undefined" && isInBasement)
              exitBasement();
          }
          if (tool === "inventory") togglePanel("inventory");
          if (tool === "phone") togglePhone();
          if (tool === "dance") toggleDanceBar();
          if (tool === "guide") window.FZGuide?.open();
          if (tool === "comfort") window.FZPlay?.open();
          if (tool === "menu") FZUI.open();
        }),
    );
    for (const el of [root, panel])
      for (const ev of ["pointerdown", "mousedown", "touchstart"])
        el.addEventListener(ev, (e) => e.stopPropagation());
    panel.addEventListener("click", (e) => {
      if (e.target === panel) close();
    });
    const stick = $("fzTouchStick");
    stick.addEventListener("pointerdown", (e) => {
      if (blocked() || joy !== null) return;
      e.preventDefault();
      if (
        typeof currentDance !== "undefined" &&
        currentDance &&
        typeof stopDance === "function"
      )
        stopDance();
      joy = e.pointerId;
      stick.setPointerCapture(e.pointerId);
      moveStick(e);
    });
    stick.addEventListener("pointermove", (e) => {
      if (joy === e.pointerId) {
        e.preventDefault();
        if (blocked()) {
          release();
          return;
        }
        moveStick(e);
      }
    });
    for (const ev of ["pointerup", "pointercancel", "lostpointercapture"])
      stick.addEventListener(ev, (e) => {
        if (joy !== e.pointerId) return;
        joy = null;
        axes = { x: 0, y: 0 };
        for (const k of ["KeyW", "KeyA", "KeyS", "KeyD"]) setKey(k, false);
        $("fzTouchKnob").style.transform = "translate(-50%,-50%)";
      });
    const jump = $("fzTouchJump");
    jump.addEventListener("pointerdown", (e) => {
      if (blocked()) return;
      e.preventDefault();
      jump.setPointerCapture(e.pointerId);
      holds.set(e.pointerId, "Space");
      emit("Space", true);
    });
    for (const ev of ["pointerup", "pointercancel", "lostpointercapture"])
      jump.addEventListener(ev, (e) => {
        if (holds.has(e.pointerId)) {
          emit(holds.get(e.pointerId), false);
          holds.delete(e.pointerId);
        }
      });
    jump.onclick = (e) => {
      if (e.detail === 0 && !blocked()) {
        emit("Space", true);
        emit("Space", false);
      }
    };
  }
  function moveStick(e) {
    const rect = $("fzTouchStick").getBoundingClientRect(),
      radius = rect.width * 0.32;
    let x = (e.clientX - rect.left - rect.width / 2) / radius,
      y = (e.clientY - rect.top - rect.height / 2) / radius;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    axes = Math.hypot(x, y) < 0.12 ? { x: 0, y: 0 } : { x, y };
    for (const [k, on] of [
      ["KeyW", axes.y < -0.12],
      ["KeyS", axes.y > 0.12],
      ["KeyA", axes.x < -0.12],
      ["KeyD", axes.x > 0.12],
    ])
      setKey(k, on);
    $("fzTouchKnob").style.transform =
      `translate(calc(-50% + ${x * radius}px),calc(-50% + ${y * radius}px))`;
  }
  function pinchDistance() {
    const pts = [...look.values()];
    return pts.length === 2
      ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      : 0;
  }
  document.addEventListener(
    "pointerdown",
    (e) => {
      lastPointer = e.pointerType || "mouse";
      if (e.pointerType === "mouse" || !enabled()) return;
      if (e.target.id !== "gameCanvas") {
        if (!e.target.closest("#fzTouch")) release();
        return;
      }
      if (blocked()) return;
      e.preventDefault();
      look.set(e.pointerId, { x: e.clientX, y: e.clientY });
      e.target.setPointerCapture(e.pointerId);
    },
    { capture: true, passive: false },
  );
  document.addEventListener(
    "pointermove",
    (e) => {
      const old = look.get(e.pointerId);
      if (!old) return;
      if (blocked()) {
        release();
        return;
      }
      e.preventDefault();
      const before = pinchDistance(),
        dx = e.clientX - old.x,
        dy = e.clientY - old.y;
      look.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (look.size === 2) {
        const after = pinchDistance();
        if (typeof CONFIG !== "undefined")
          CONFIG.CAMERA_DISTANCE = Math.max(
            3,
            Math.min(20, CONFIG.CAMERA_DISTANCE + (before - after) * 0.025),
          );
      } else if (look.size === 1) {
        if (typeof cameraAngleH !== "undefined")
          cameraAngleH -= dx * 0.005 * sensitivity;
        if (typeof cameraAngleV !== "undefined") {
          const invert =
            typeof SETTINGS !== "undefined" && SETTINGS.invertY ? -1 : 1;
          cameraAngleV = clampPitch(
            cameraAngleV + dy * 0.004 * sensitivity * invert,
          );
        }
      }
    },
    { capture: true, passive: false },
  );
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"])
    document.addEventListener(ev, (e) => look.delete(e.pointerId), true);
  document.addEventListener(
    "click",
    (e) => {
      if (e.target.id === "gameCanvas" && lastPointer !== "mouse") {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );
  document.addEventListener("click", (e) => {
    if (enabled()) {
      if (e.target.closest("#danceBar .dance-btn"))
        $("danceBar").style.display = "none";
      update();
    }
  });
  document.addEventListener("focusin", () => {
    if (enabled()) update();
  });
  window.addEventListener("blur", release);
  document.addEventListener("touchcancel", release, {capture:true, passive:true});
  window.addEventListener("pointercancel", e => { if(e.pointerType === "touch") release(); }, true);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) release();
  });
  window.addEventListener("resize", () => {
    release();
    update();
  });
  window.addEventListener(
    "keydown",
    (e) => {
      if (!panel || panel.hidden) return;
      e.stopImmediatePropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const items = [...panel.querySelectorAll("button,input")],
          i = items.indexOf(document.activeElement);
        items[
          (i + (e.shiftKey ? -1 : 1) + items.length) % items.length
        ].focus();
      }
    },
    true,
  );
  function text(id,value) { const el=$(id); if(el.textContent!==value) el.textContent=value; }
  function update() {
    init();
    const touch = enabled(),
      stop = blocked();
    document.body.classList.toggle("fz-touch-device", touch);
    document.body.classList.toggle("fz-touch-blocked", stop);
    if (!window.FZUI || !FZUI.playing()) {
      if (!panel.hidden) {
        panel.hidden = true;
        previousFocus = null;
      }
    }
    if (stop && !wasBlocked) release();
    wasBlocked = stop;
    root.hidden = !touch || stop;
    if (touch && window.FZUI && FZUI.playing()) window.mobileReady = true;
    if (root.hidden) return;
    const repair = typeof DLC !== "undefined" && DLC.repair;
    text("fzTouchJump", repair ? "Проверка" : "Прыжок");
    const name =
      typeof nearestInteractable !== "undefined" && nearestInteractable
        ? nearestInteractable.name
        : "";
    const seated = typeof sittingOn !== "undefined" && sittingOn;
    text("fzTouchUse", repair
      ? "Прервать ремонт"
      : seated
        ? "Встать"
        : name
          ? name.replace(/\[E\]/g, "").slice(0, 55)
          : "Действие");
    $("fzTouchUse").setAttribute(
      "aria-label",
      repair ? "Прервать ремонт" : seated ? "Встать" : name || "Действие рядом",
    );
    text("fzTouchAttack", window.FZ8K && FZ8K.state().cur !== "fists" ? "Атака" : "Удар");
  }
  const nativeControls = window._origInitControls || window.initControls;
  let bound = false;
  window.initControls = function () {
    if (bound) return;
    bound = true;
    if (nativeControls) nativeControls();
  };
  window.initMobileControls = update;
  window.FZTouch = {
    enabled,
    blocked,
    release,
    update,
    open,
    close,
    pointerMouse: () => lastPointer === "mouse",
    vector: () => ({ ...axes }),
    info: () => ({
      lookPointers: look.size,
      moving: joy !== null,
      sensitivity,
    }),
  };
  update();
})();
