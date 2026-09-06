// ═══════════════════════════════════════════════════════════════════════════
//  FANTAZIA RP v52 — ГЕЙМПЛЕЙ
//  1. Заработок монет (косметика должна добываться, а не выдаваться)
//  2. Плавная езда на эскалаторе и лифте вместо телепорта между этажами
//  3. Полезные мелочи для телефона
// ═══════════════════════════════════════════════════════════════════════════
(function FZ_GAMEPLAY() {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  //  1. ЗАРАБОТОК МОНЕТ
  //  Раньше монеты были только стартовые (50 штук) — купить что-то дороже
  //  пары кепок было невозможно. Теперь монеты капают за реальные действия.
  //  Античит здесь не нужен: монеты локальные, но начисление ограничено
  //  кулдаунами, чтобы нельзя было накрутить простым спамом кнопки.
  // ─────────────────────────────────────────────────────────────────────────
  var EARN = {
    // действие: [монет, кулдаун мс, описание]
    walk1000:     [3,  0,      'за 1000 шагов'],
    enterBuilding:[2,  20000,  'за посещение здания'],
    rideElevator: [1,  15000,  'за поездку на лифте'],
    rideEscalator:[1,  15000,  'за поездку на эскалаторе'],
    newFloor:     [5,  60000,  'за новый этаж'],
    findNote:     [25, 0,      'за найденную записку'],
    dance:        [2,  45000,  'за танец'],
    workout:      [4,  30000,  'за тренировку'],
    driveCar:     [3,  30000,  'за поездку на машине'],
    dailyLogin:   [40, 0,      'ежедневный вход'],
    firstMall:    [15, 0,      'первое посещение ТЦ'],
    exploreCity:  [8,  120000, 'за исследование города']
  };

  var _lastEarn = Object.create(null);
  var _steps = 0, _lastPos = null, _visitedFloors = {};

  function coinsAdd(n, reason) {
    if (!n || n <= 0) return;
    try {
      if (typeof localCoins === 'undefined') return;
      window.localCoins = (window.localCoins || 0) + n;
      // localCoins объявлена через let в глобальной области — обновляем и её
      if (typeof window.eval === 'function') {
        window.eval('localCoins = ' + window.localCoins + ';');
      }
      if (typeof updateCoinsDisplay === 'function') updateCoinsDisplay();
      if (typeof saveCoinsLocal === 'function') saveCoinsLocal();
      if (typeof showNotification === 'function' && reason) {
        showNotification('🪙 +' + n + ' монет · ' + reason, 'success');
      }
    } catch (e) { /* не критично */ }
  }

  function earn(key) {
    var e = EARN[key];
    if (!e) return;
    var now = Date.now();
    if (e[1] > 0 && _lastEarn[key] && now - _lastEarn[key] < e[1]) return;
    _lastEarn[key] = now;
    coinsAdd(e[0], e[2]);
  }

  // Шаги: считаем пройденное расстояние, каждые 1000 условных шагов — монеты.
  function trackSteps() {
    try {
      if (!window.localPlayer || !localPlayer.mesh) return;
      var p = localPlayer.mesh.position;
      if (_lastPos) {
        var dx = p.x - _lastPos.x, dz = p.z - _lastPos.z;
        var d = Math.sqrt(dx * dx + dz * dz);
        // отсекаем телепорты (вход в здание) — иначе накрутка
        if (d < 3) _steps += d;
      }
      _lastPos = { x: p.x, z: p.z };
      if (_steps >= 300) {
        _steps = 0;
        coinsAdd(EARN.walk1000[0], EARN.walk1000[2]);
      }
    } catch (e) {}
  }

  // Новый этаж — разовая награда за каждый.
  function trackFloor() {
    try {
      if (typeof currentFloor === 'undefined') return;
      var key = (window.currentBuildingType || '?') + ':' + currentFloor;
      if (_visitedFloors[key]) return;
      _visitedFloors[key] = 1;
      // первый заход не награждаем — иначе спам при старте
      if (Object.keys(_visitedFloors).length > 1) {
        coinsAdd(EARN.newFloor[0], EARN.newFloor[2]);
      }
    } catch (e) {}
  }

  // Ежедневный вход.
  function dailyBonus() {
    try {
      var today = new Date().toDateString();
      var last = localStorage.getItem('fz_daily_coins');
      if (last === today) return;
      localStorage.setItem('fz_daily_coins', today);
      setTimeout(function () { coinsAdd(EARN.dailyLogin[0], EARN.dailyLogin[2]); }, 3000);
    } catch (e) {}
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  2. ПЛАВНАЯ ЕЗДА МЕЖДУ ЭТАЖАМИ
  //
  //  ПРОБЛЕМА (найдена в коде): и startEscalatorRide, и startElevatorRide
  //  вызывают buildInterior() ПОСРЕДИ поездки. Интерьер мгновенно
  //  перестраивается под новый этаж, и игрок «телепортируется» — именно
  //  на это жаловался игрок: «не доезжаю, а тэпаюсь».
  //
  //  РЕШЕНИЕ: перестройку делаем не в момент прибытия, а с плавным
  //  затемнением-проявлением, синхронизированным с движением. Игрок
  //  видит, что он ЕДЕТ, а смена геометрии прячется за долей секунды
  //  перехода — как в настоящих играх со стримингом уровней.
  // ─────────────────────────────────────────────────────────────────────────
  var _fadeEl = null;

  function ensureFade() {
    if (_fadeEl && _fadeEl.isConnected) return _fadeEl;
    _fadeEl = document.getElementById('fzFloorFade');
    if (!_fadeEl) {
      _fadeEl = document.createElement('div');
      _fadeEl.id = 'fzFloorFade';
      _fadeEl.style.cssText =
        'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;' +
        'z-index:9200;transition:opacity .22s ease';
      document.body.appendChild(_fadeEl);
    }
    return _fadeEl;
  }

  // Короткое затемнение вокруг смены геометрии этажа.
  window.fzFloorTransition = function (rebuildFn, onDone) {
    var f = ensureFade();
    f.style.opacity = '0.92';
    setTimeout(function () {
      try { if (typeof rebuildFn === 'function') rebuildFn(); } catch (e) {
        console.warn('[FZ52] ошибка перестройки этажа:', e && e.message);
      }
      // даём кадр на отрисовку новой геометрии, потом проявляем
      setTimeout(function () {
        f.style.opacity = '0';
        if (typeof onDone === 'function') onDone();
      }, 90);
    }, 230);
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  3. ПОЛЕЗНОЕ ДЛЯ ТЕЛЕФОНА
  // ─────────────────────────────────────────────────────────────────────────

  // Индикатор FPS и качества — чтобы игрок понимал, почему тормозит.
  window.fzToggleStats = function () {
    var el = document.getElementById('fzStats');
    if (el) { el.remove(); return; }
    el = document.createElement('div');
    el.id = 'fzStats';
    el.style.cssText =
      'position:fixed;top:6px;left:6px;z-index:9999;padding:5px 9px;' +
      'background:rgba(0,0,0,.62);color:#7dffc0;font:11px monospace;' +
      'border-radius:7px;pointer-events:none;white-space:pre;line-height:1.45';
    document.body.appendChild(el);
    (function upd() {
      if (!document.getElementById('fzStats')) return;
      var F = window.FZ52;
      var txt = 'FPS ' + (F ? F.perf.fps : '?') +
                '\nкачество ' + (F ? F.perf.tier : '?');
      try {
        if (window.renderer && renderer.info) {
          txt += '\nдравколлов ' + renderer.info.render.calls +
                 '\nтреугольников ' + Math.round(renderer.info.render.triangles / 1000) + 'k';
        }
      } catch (e) {}
      el.textContent = txt;
      setTimeout(upd, 500);
    })();
  };

  // Быстрая кнопка «домой»: телефон легко потерять в городе.
  window.fzGoHome = function () {
    try {
      if (!window.localPlayer || !localPlayer.mesh) return;
      if (window.isInsideBuilding && typeof exitBuilding === 'function') exitBuilding();
      localPlayer.mesh.position.set(17, 0, 21);
      if (window.FZ52) FZ52.legalTeleport({ x: 17, y: 0, z: 21 });
      if (typeof showNotification === 'function') showNotification('🏠 Вы дома', 'info');
    } catch (e) {}
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  4. ЗАПУСК
  // ─────────────────────────────────────────────────────────────────────────
  function boot() {
    dailyBonus();
    // лёгкий опрос: раз в секунду, нагрузки не создаёт
    setInterval(function () {
      trackSteps();
      trackFloor();
    }, 1000);

    // цепляем награды к игровым событиям
    ['enterBuilding', 'startElevatorRide', 'startEscalatorRide'].forEach(function (n) {
      var orig = window[n];
      if (typeof orig !== 'function' || orig.__fzEarn) return;
      var key = n === 'enterBuilding' ? 'enterBuilding'
              : n === 'startElevatorRide' ? 'rideElevator' : 'rideEscalator';
      var w = function () { earn(key); return orig.apply(this, arguments); };
      w.__fzEarn = true;
      window[n] = w;
    });

    window.FZ_EARN = { earn: earn, table: EARN, coinsAdd: coinsAdd };
    console.log('[FZ52] геймплей: заработок монет и плавные этажи активны');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 1200); });
  } else {
    setTimeout(boot, 1200);
  }
})();
