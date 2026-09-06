// ═══════════════════════════════════════════════════════════════════════════
//  FANTAZIA RP v53 — АНИМАЦИИ И ФИКСЫ
//
//  1. Управление яркостью (в v52 картинку пересветило — теперь и починено,
//     и вынесено в настройки, чтобы каждый подстроил под свой экран).
//  2. Живые анимации: приседание, поворот головы за камерой, моргание,
//     реакция на скорость, плавные переходы между состояниями.
//  3. Анимации интерфейса: всплытие панелей, счётчики, тряска при уроне.
//  4. Мелкие фиксы, найденные при проверке.
//
//  ПРИНЦИП: всё считается на CPU по нескольким числам за кадр и работает
//  на телефоне. Никаких скелетных клипов и постпроцесса.
// ═══════════════════════════════════════════════════════════════════════════
(function FZ_ANIM_V53() {
  'use strict';

  var A = window.FZ_ANIM = { enabled: true, quality: 1 };

  // ─────────────────────────────────────────────────────────────────────────
  //  1. ЯРКОСТЬ
  // ─────────────────────────────────────────────────────────────────────────
  var BRIGHT_KEY = 'fz_brightness_v53';

  window.fzSetBrightness = function (v) {
    var val = parseFloat(v);
    if (!isFinite(val)) return;
    val = Math.max(0.45, Math.min(1.15, val));
    try {
      if (window.renderer) renderer.toneMappingExposure = val;
      localStorage.setItem(BRIGHT_KEY, String(val));
      var lbl = document.getElementById('brightVal');
      if (lbl) lbl.textContent = val.toFixed(2);
      var sl = document.getElementById('set_brightness');
      if (sl && parseFloat(sl.value) !== val) sl.value = val;
    } catch (e) {}
  };

  window.fzLoadBrightness = function () {
    try {
      var v = parseFloat(localStorage.getItem(BRIGHT_KEY));
      if (isFinite(v)) { fzSetBrightness(v); return v; }
    } catch (e) {}
    return null;
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  2. АНИМАЦИИ ПЕРСОНАЖА
  //  Состояние храним в WeakMap: не мешает сборщику мусора, когда модель
  //  удаляется (обычный объект-словарь давал бы утечку).
  // ─────────────────────────────────────────────────────────────────────────
  var st = new WeakMap();

  function state(mesh) {
    var s = st.get(mesh);
    if (!s) {
      s = {
        blink: 0, blinkNext: 2 + Math.random() * 4,
        headYaw: 0, headPitch: 0,
        crouch: 0, speed: 0, prevX: 0, prevZ: 0,
        lean: 0, prevRot: 0, land: 0, prevY: 0,
        armSwing: 0, idleT: Math.random() * 10,
        fidget: 0, fidgetNext: 6 + Math.random() * 8
      };
      st.set(mesh, s);
    }
    return s;
  }

  // Кадронезависимое сглаживание: одинаково на 30 и 144 FPS.
  function damp(cur, target, lambda, dt) {
    return target + (cur - target) * Math.exp(-lambda * dt);
  }

  A.updateCharacter = function (mesh, anim, t, dt, isLocal) {
    if (!A.enabled || !mesh) return;
    var model = mesh.userData && mesh.userData.model;
    if (!model) return;
    var s = state(mesh);
    dt = Math.min(dt || 0.016, 0.1);

    // ── реальная скорость (не доверяем строке анимации) ──
    var dx = mesh.position.x - s.prevX;
    var dz = mesh.position.z - s.prevZ;
    s.prevX = mesh.position.x; s.prevZ = mesh.position.z;
    var inst = Math.sqrt(dx * dx + dz * dz) / dt;
    if (inst < 40) s.speed = damp(s.speed, inst, 9, dt);   // отсекаем телепорты
    var moving = s.speed > 0.35;
    var running = s.speed > 6.5;

    // ── МОРГАНИЕ ──
    s.blinkNext -= dt;
    if (s.blinkNext <= 0) { s.blink = 0.14; s.blinkNext = 2.4 + Math.random() * 5; }
    if (s.blink > 0) {
      s.blink -= dt;
      var k = Math.max(0, s.blink / 0.14);
      var sq = 1 - Math.sin(k * Math.PI) * 0.92;
      if (model.eyeL) model.eyeL.scale.y = sq;
      if (model.eyeR) model.eyeR.scale.y = sq;
    } else {
      if (model.eyeL) model.eyeL.scale.y = 1;
      if (model.eyeR) model.eyeR.scale.y = 1;
    }

    // ── НАКЛОН В ПОВОРОТЕ ──
    var dR = mesh.rotation.y - s.prevRot;
    while (dR > Math.PI) dR -= Math.PI * 2;
    while (dR < -Math.PI) dR += Math.PI * 2;
    s.prevRot = mesh.rotation.y;
    var leanTarget = moving ? Math.max(-0.20, Math.min(0.20, -dR * 4.5)) : 0;
    s.lean = damp(s.lean, leanTarget, 7, dt);

    // ── ПРИЗЕМЛЕНИЕ ──
    var dy = mesh.position.y - s.prevY;
    s.prevY = mesh.position.y;
    if (dy < -0.2) s.land = 1;
    if (s.land > 0) s.land = Math.max(0, s.land - dt * 3.6);

    // ── ПРИСЕДАНИЕ (Ctrl / кнопка на телефоне) ──
    var wantCrouch = !!(window.fzCrouching);
    s.crouch = damp(s.crouch, wantCrouch ? 1 : 0, 10, dt);

    // ── КОРПУС ──
    if (model.torso) {
      if (model.torso.userData.baseY === undefined)
        model.torso.userData.baseY = model.torso.position.y;
      var breath = moving ? 0 : Math.sin(t * 1.5) * 0.013;
      model.torso.rotation.z = s.lean;
      model.torso.rotation.x = running ? 0.15 : (moving ? 0.07 : 0);
      model.torso.position.y = model.torso.userData.baseY
        - s.land * 0.1 - s.crouch * 0.26 + breath;
    }

    // ── БЁДРА при приседании ──
    if (model.hips) {
      if (model.hips.userData.baseY === undefined)
        model.hips.userData.baseY = model.hips.position.y;
      model.hips.position.y = model.hips.userData.baseY - s.crouch * 0.3;
    }

    // ── ГОЛОВА: у своего игрока смотрит по камере ──
    if (model.head) {
      var yawT = 0, pitchT = 0;
      if (isLocal && window.camera && window.cameraMode !== 'first') {
        // лёгкий доворот в сторону взгляда камеры
        var d = (window.cameraAngleH || 0) - mesh.rotation.y;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        yawT = Math.max(-0.5, Math.min(0.5, d * 0.35));
        pitchT = Math.max(-0.3, Math.min(0.3, -(window.cameraAngleV || 0) * 0.4));
      } else if (!moving) {
        // в покое осматривается
        yawT = Math.sin(t * 0.35) * 0.22;
        pitchT = Math.sin(t * 0.27) * 0.06;
      }
      s.headYaw = damp(s.headYaw, yawT, 6, dt);
      s.headPitch = damp(s.headPitch, pitchT, 6, dt);
      model.head.rotation.y = s.headYaw;
      model.head.rotation.x = s.headPitch + (moving ? -0.05 : 0);
      model.head.rotation.z = -s.lean * 0.45;
    }

    // ── РУКИ: амплитуда зависит от скорости, а не от строки состояния ──
    var swing = Math.min(1, s.speed / 8);
    s.armSwing = damp(s.armSwing, swing, 8, dt);
    var freq = running ? 10 : 6.5;
    var ph = t * freq;
    if (model.armL && model.armR) {
      var amp = 0.55 * s.armSwing;
      model.armL.rotation.x = Math.sin(ph) * amp - s.crouch * 0.2;
      model.armR.rotation.x = -Math.sin(ph) * amp - s.crouch * 0.2;
      // локти сгибаются на бегу
      if (model.elbowL) model.elbowL.rotation.x = running ? -0.5 * s.armSwing : -0.12 * s.armSwing;
      if (model.elbowR) model.elbowR.rotation.x = running ? -0.5 * s.armSwing : -0.12 * s.armSwing;
    }

    // ── НОГИ ──
    if (model.legL && model.legR) {
      var lamp = 0.6 * s.armSwing;
      model.legL.rotation.x = -Math.sin(ph) * lamp;
      model.legR.rotation.x = Math.sin(ph) * lamp;
      if (model.kneeL) model.kneeL.rotation.x = Math.max(0, Math.sin(ph + 0.6)) * 0.5 * s.armSwing + s.crouch * 0.8;
      if (model.kneeR) model.kneeR.rotation.x = Math.max(0, Math.sin(ph - 2.5)) * 0.5 * s.armSwing + s.crouch * 0.8;
    }

    // ── МЕЛКИЕ ДВИЖЕНИЯ В ПОКОЕ ──
    // Без них персонаж выглядит замороженным столбом.
    if (!moving) {
      s.idleT += dt;
      s.fidgetNext -= dt;
      if (s.fidgetNext <= 0) { s.fidget = 1.2; s.fidgetNext = 7 + Math.random() * 9; }
      if (s.fidget > 0) {
        s.fidget -= dt;
        var f = Math.sin((1.2 - s.fidget) / 1.2 * Math.PI);
        if (model.armR) model.armR.rotation.z = -f * 0.16;
        if (model.head) model.head.rotation.z += f * 0.07;
      } else if (model.armR) {
        model.armR.rotation.z = damp(model.armR.rotation.z, 0, 5, dt);
      }
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  3. АНИМАЦИИ ИНТЕРФЕЙСА
  // ─────────────────────────────────────────────────────────────────────────

  // Плавное всплытие панелей вместо мгновенного появления.
  A.installUIAnims = function () {
    if (A._uiDone) return;
    A._uiDone = true;
    var css = document.createElement('style');
    css.textContent = [
      '@keyframes fzPop{from{opacity:0;transform:translateY(18px) scale(.96)}',
      'to{opacity:1;transform:none}}',
      '.modal-overlay.show .modal,.modal-overlay[style*="flex"] .modal{',
      'animation:fzPop .26s cubic-bezier(.22,1,.36,1)}',
      '@keyframes fzShake{0%,100%{transform:translateX(0)}',
      '20%{transform:translateX(-7px)}40%{transform:translateX(6px)}',
      '60%{transform:translateX(-4px)}80%{transform:translateX(3px)}}',
      '.fz-shake{animation:fzShake .38s ease}',
      '@keyframes fzCoinPop{0%{opacity:0;transform:translateY(0) scale(.6)}',
      '25%{opacity:1;transform:translateY(-14px) scale(1.15)}',
      '100%{opacity:0;transform:translateY(-52px) scale(.9)}}',
      '.fz-coin-fly{position:fixed;pointer-events:none;z-index:9999;',
      'font:700 17px Arial;color:#ffd479;text-shadow:0 2px 10px rgba(0,0,0,.7);',
      'animation:fzCoinPop 1.05s ease-out forwards}',
      '@keyframes fzPulseGlow{0%,100%{box-shadow:0 0 0 rgba(108,92,231,0)}',
      '50%{box-shadow:0 0 22px rgba(108,92,231,.65)}}',
      '.fz-pulse{animation:fzPulseGlow 1.6s ease-in-out infinite}'
    ].join('');
    document.head.appendChild(css);
  };

  // Вылетающие монетки при начислении — понятная обратная связь.
  A.coinFly = function (amount) {
    try {
      var el = document.createElement('div');
      el.className = 'fz-coin-fly';
      el.textContent = '🪙 +' + amount;
      var host = document.getElementById('coinsDisplay');
      var r = host ? host.getBoundingClientRect() : { left: window.innerWidth / 2, top: 90 };
      el.style.left = (r.left) + 'px';
      el.style.top = (r.top + 4) + 'px';
      document.body.appendChild(el);
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1100);
    } catch (e) {}
  };

  // Тряска экрана — удар, падение, взрыв.
  A.shake = function (ms) {
    try {
      var c = document.querySelector('canvas');
      if (!c) return;
      c.classList.add('fz-shake');
      setTimeout(function () { c.classList.remove('fz-shake'); }, ms || 380);
    } catch (e) {}
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  4. ПРИСЕДАНИЕ — новая механика
  // ─────────────────────────────────────────────────────────────────────────
  window.fzCrouching = false;
  A.installCrouch = function () {
    document.addEventListener('keydown', function (e) {
      if (e.code === 'ControlLeft' || e.code === 'KeyC') window.fzCrouching = true;
    });
    document.addEventListener('keyup', function (e) {
      if (e.code === 'ControlLeft' || e.code === 'KeyC') window.fzCrouching = false;
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  5. ЗАПУСК
  // ─────────────────────────────────────────────────────────────────────────
  function boot() {
    A.installUIAnims();
    A.installCrouch();
    // яркость применяем после того, как renderer создан
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (window.renderer) {
        fzLoadBrightness();
        var sl = document.getElementById('set_brightness');
        if (sl) {
          var cur = renderer.toneMappingExposure || 0.84;
          sl.value = cur;
          var lbl = document.getElementById('brightVal');
          if (lbl) lbl.textContent = Number(cur).toFixed(2);
        }
        clearInterval(iv);
      }
      if (tries > 40) clearInterval(iv);
    }, 400);
    console.log('[FZ53] анимации и управление яркостью загружены');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    setTimeout(boot, 0);
  }
})();
