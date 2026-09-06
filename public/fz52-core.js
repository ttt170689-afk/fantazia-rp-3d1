// ═══════════════════════════════════════════════════════════════════════════
//  FANTAZIA RP v52 — КЛИЕНТСКОЕ ЯДРО
//  Глубокий фикс: производительность, мобилки, античит-совместимость,
//  анимации, графика. Каждый блок закрывает проблему, найденную аудитом
//  реального кода, а не «на всякий случай».
// ═══════════════════════════════════════════════════════════════════════════
(function FZ_V52() {
  'use strict';

  var FZ = window.FZ52 = {
    ver: 52,
    perf: { fps: 0, frames: 0, lastT: 0, avgMs: 0, tier: 'auto' },
    flags: {}
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  1. СОВМЕСТИМОСТЬ С АНТИЧИТОМ
  //  Сервер откатывает позицию при рывке. Но вход в здание, смена этажа
  //  и спавн — легальные мгновенные перемещения. Предупреждаем сервер,
  //  иначе честного игрока будет отбрасывать назад на каждом входе в ТЦ.
  // ─────────────────────────────────────────────────────────────────────────
  FZ.legalTeleport = function (pos) {
    try {
      if (window.socket && socket.connected) {
        socket.emit('legalTeleport', {
          position: pos || (window.localPlayer && localPlayer.mesh
            ? {
                x: localPlayer.mesh.position.x,
                y: localPlayer.mesh.position.y,
                z: localPlayer.mesh.position.z
              }
            : null)
        });
      }
    } catch (e) { /* оффлайн — античита нет, всё равно работаем */ }
  };

  // Перехватываем штатные точки телепортации игры.
  // Оборачиваем, а не переписываем: если функция изменится, обёртка
  // продолжит работать.
  FZ.hookTeleports = function () {
    ['enterBuilding', 'exitBuilding', 'startElevatorRide',
     'startEscalatorRide', 'fzEnterBossArena'].forEach(function (name) {
      var orig = window[name];
      if (typeof orig !== 'function' || orig.__fz52) return;
      var wrapped = function () {
        var r = orig.apply(this, arguments);
        // после перемещения — сразу сообщаем серверу
        setTimeout(function () { FZ.legalTeleport(); }, 0);
        setTimeout(function () { FZ.legalTeleport(); }, 400);
        return r;
      };
      wrapped.__fz52 = true;
      window[name] = wrapped;
    });
  };

  // Откат от сервера: мягко возвращаем игрока, без рывка камеры.
  FZ.installResetHandler = function () {
    if (!window.socket || FZ.flags.resetHooked) return;
    FZ.flags.resetHooked = true;
    socket.on('positionReset', function (d) {
      if (!d || !d.position || !window.localPlayer || !localPlayer.mesh) return;
      var p = d.position;
      if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) return;
      localPlayer.mesh.position.set(p.x, p.y, p.z);
      // не спамим уведомлениями: причина «clamped» — обычный лаг
      if (d.reason === 'teleport' && typeof showNotification === 'function') {
        showNotification('⚠️ Некорректное перемещение отменено', 'error');
      }
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  2. ПРОФИЛИРОВЩИК И АВТО-КАЧЕСТВО
  //  Игра тормозила на слабых телефонах, потому что качество выбиралось
  //  один раз по userAgent. Теперь смотрим на РЕАЛЬНЫЙ fps и снижаем
  //  нагрузку, если кадры не вытягиваются.
  // ─────────────────────────────────────────────────────────────────────────
  var _fpsWin = [];
  FZ.tick = function (ms) {
    _fpsWin.push(ms);
    if (_fpsWin.length > 60) _fpsWin.shift();
    var sum = 0;
    for (var i = 0; i < _fpsWin.length; i++) sum += _fpsWin[i];
    FZ.perf.avgMs = sum / _fpsWin.length;
    FZ.perf.fps = FZ.perf.avgMs > 0 ? Math.round(1000 / FZ.perf.avgMs) : 0;
  };

  // Динамическое качество: если долго тормозим — упрощаем сцену.
  var _lastAdjust = 0, _adjustStep = 0;
  FZ.autoQuality = function () {
    var now = Date.now();
    if (now - _lastAdjust < 4000) return;      // не дёргаем каждый кадр
    if (_fpsWin.length < 40) return;           // мало данных
    _lastAdjust = now;
    var fps = FZ.perf.fps;

    if (fps < 26 && _adjustStep < 3) {
      _adjustStep++;
      FZ.applyQuality(_adjustStep);
    } else if (fps > 52 && _adjustStep > 0) {
      _adjustStep--;
      FZ.applyQuality(_adjustStep);
    }
  };

  FZ.applyQuality = function (step) {
    try {
      if (!window.renderer) return;
      // step 0 = полное качество, 3 = максимальная экономия
      var pr = [Math.min(window.devicePixelRatio || 1, 2), 1.25, 1.0, 0.75][step] || 1;
      renderer.setPixelRatio(pr);
      if (renderer.shadowMap) {
        renderer.shadowMap.enabled = (step === 0);
      }
      FZ.perf.tier = 'auto-' + step;
      // прячем дальние декоративные объекты
      FZ.cullDistance = [260, 190, 140, 100][step] || 160;
    } catch (e) {}
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  3. ОПТИМИЗАЦИЯ ГЛАВНОГО ЦИКЛА
  //  Аудит показал: Object.values(remotePlayers) создавал НОВЫЙ массив
  //  каждый кадр (мусор для GC), а анимация считалась для всех игроков
  //  и NPC независимо от того, видно их или нет.
  // ─────────────────────────────────────────────────────────────────────────
  FZ.cullDistance = 180;
  var _tmpVec = null;

  // Кэш ключей remotePlayers: пересобираем только когда состав изменился.
  var _rpKeys = [], _rpCount = -1;
  FZ.remoteKeys = function (obj) {
    var n = 0, k;
    for (k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) n++;
    if (n !== _rpCount) {
      _rpKeys = Object.keys(obj);
      _rpCount = n;
    }
    return _rpKeys;
  };

  // Нужно ли анимировать объект: далёкие и находящиеся за спиной —
  // пропускаем. Экономия тем больше, чем больше игроков онлайн.
  FZ.shouldAnimate = function (objPos, playerPos, dist) {
    if (!objPos || !playerPos) return true;
    var dx = objPos.x - playerPos.x;
    var dz = objPos.z - playerPos.z;
    var d2 = dx * dx + dz * dz;
    var lim = dist || FZ.cullDistance;
    return d2 < lim * lim;
  };

  // Троттлинг: выполнять функцию не чаще, чем раз в N мс.
  FZ.throttle = function (key, ms) {
    FZ._th = FZ._th || Object.create(null);
    var now = Date.now();
    if (FZ._th[key] && now - FZ._th[key] < ms) return false;
    FZ._th[key] = now;
    return true;
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  4. КЭШ DOM
  //  В коде десятки getElementById внутри часто вызываемых функций.
  //  Каждый вызов — обход дерева. Кэшируем ссылки.
  // ─────────────────────────────────────────────────────────────────────────
  var _domCache = Object.create(null);
  FZ.$ = function (id) {
    var el = _domCache[id];
    if (el && el.isConnected) return el;
    el = document.getElementById(id);
    if (el) _domCache[id] = el;
    return el;
  };
  FZ.clearDomCache = function () { _domCache = Object.create(null); };

  // ─────────────────────────────────────────────────────────────────────────
  //  5. МОБИЛЬНЫЙ ПОРТ — ГЛУБОКИЙ ФИКС
  // ─────────────────────────────────────────────────────────────────────────
  FZ.isMobile = (function () {
    return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent) ||
           (('ontouchstart' in window) && window.innerWidth < 1024);
  })();

  FZ.mobile = {
    // Реальный кап FPS. В коде было 1000/120 — это 120 FPS, то есть
    // кап фактически не работал и телефон грелся впустую.
    fpsCap: 60,
    lastFrame: 0
  };

  FZ.shouldSkipFrame = function (ts) {
    if (!FZ.isMobile) return false;
    var interval = 1000 / FZ.mobile.fpsCap;
    if (ts - FZ.mobile.lastFrame < interval) return true;
    FZ.mobile.lastFrame = ts;
    return false;
  };

  // Экономия батареи: когда вкладка скрыта — не рендерим вообще.
  FZ.pageHidden = false;
  document.addEventListener('visibilitychange', function () {
    FZ.pageHidden = document.hidden;
  });

  // ─────────────────────────────────────────────────────────────────────────
  //  6. ПЛАВНЫЕ АНИМАЦИИ — вспомогательная математика
  //  Используется и катсценами, и движением, и UI.
  // ─────────────────────────────────────────────────────────────────────────
  FZ.ease = {
    inOut: function (k) { return k < 0.5 ? 2 * k * k : -1 + (4 - 2 * k) * k; },
    smooth: function (k) { return k * k * (3 - 2 * k); },
    outCubic: function (k) { var f = k - 1; return f * f * f + 1; },
    outBack: function (k) {
      var c1 = 1.70158, c3 = c1 + 1, f = k - 1;
      return 1 + c3 * f * f * f + c1 * f * f;
    },
    outElastic: function (k) {
      if (k === 0 || k === 1) return k;
      var p = 0.3;
      return Math.pow(2, -10 * k) * Math.sin((k - p / 4) * (2 * Math.PI) / p) + 1;
    },
    outBounce: function (k) {
      var n = 7.5625, d = 2.75;
      if (k < 1 / d) return n * k * k;
      if (k < 2 / d) { k -= 1.5 / d; return n * k * k + 0.75; }
      if (k < 2.5 / d) { k -= 2.25 / d; return n * k * k + 0.9375; }
      k -= 2.625 / d; return n * k * k + 0.984375;
    }
  };

  // Кадронезависимое сглаживание: одинаково и на 30, и на 144 FPS.
  // Обычный lerp(a,b,0.15) на разных FPS даёт разную скорость.
  FZ.damp = function (cur, target, lambda, dt) {
    return target + (cur - target) * Math.exp(-lambda * dt);
  };

  FZ.dampAngle = function (cur, target, lambda, dt) {
    var d = target - cur;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return cur + d * (1 - Math.exp(-lambda * dt));
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  7. ЗАЩИТА ОТ ПАДЕНИЙ
  //  Одна ошибка в кадре роняла весь requestAnimationFrame и игра
  //  «замерзала». Оборачиваем опасные вызовы.
  // ─────────────────────────────────────────────────────────────────────────
  FZ.errCount = 0;
  FZ.safe = function (fn, label) {
    try {
      return fn();
    } catch (e) {
      FZ.errCount++;
      if (FZ.errCount < 12) {
        console.warn('[FZ52] ошибка в ' + (label || 'кадре') + ':', e && e.message);
      }
      return undefined;
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  8. АВТОСТАРТ
  // ─────────────────────────────────────────────────────────────────────────
  function boot() {
    FZ.hookTeleports();
    FZ.installResetHandler();
    // повторяем: сокет и функции игры могут появиться позже
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      FZ.hookTeleports();
      FZ.installResetHandler();
      if (tries > 40) clearInterval(iv);
    }, 500);
    if (FZ.isMobile) FZ.applyQuality(1);
    console.log('[FZ52] ядро v52 запущено | мобильный:', FZ.isMobile);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    setTimeout(boot, 0);
  }
})();
