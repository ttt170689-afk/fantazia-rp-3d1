// ═══════════════════════════════════════════════════════════════════════════
//  FANTAZIA RP v52 — ГЛУБОКАЯ ОПТИМИЗАЦИЯ ПОД ТЕЛЕФОНЫ
//
//  Проблемы, найденные аудитом (не выдуманные):
//   • Кап FPS был 1000/120 — то есть 120 кадров, кап фактически не работал,
//     телефон грелся и садил батарею впустую.
//   • Анимация считалась для ВСЕХ удалённых игроков и NPC, включая тех,
//     кто за спиной, за стеной или в километре.
//   • Object.values(remotePlayers) создавал новый массив каждый кадр — мусор,
//     который GC собирает микрофризами.
//   • Игра продолжала рендерить в фоне (свёрнутая вкладка) — жрала батарею.
//   • Нет реакции на реальный FPS: слабый телефон тормозил до конца сессии.
// ═══════════════════════════════════════════════════════════════════════════
(function FZ_MOBILE_OPT() {
  'use strict';

  var M = window.FZ_MOB = {
    active: false,
    tier: 'unknown',
    stats: { culled: 0, animated: 0, skipped: 0 }
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  1. ОПРЕДЕЛЕНИЕ КЛАССА УСТРОЙСТВА
  //  Не по названию модели (их тысячи), а по доступным характеристикам.
  // ─────────────────────────────────────────────────────────────────────────
  M.detect = function () {
    var ua = navigator.userAgent;
    var isPhone = /Android|iPhone|iPod/i.test(ua);
    var isTablet = /iPad|Tablet/i.test(ua) || (isPhone && window.innerWidth > 820);
    var cores = navigator.hardwareConcurrency || 4;
    var mem = navigator.deviceMemory || 4;          // ГБ, есть не везде
    var px = window.innerWidth * window.innerHeight * (window.devicePixelRatio || 1);

    M.active = isPhone || isTablet ||
               (('ontouchstart' in window) && window.innerWidth < 1024);

    if (!M.active) { M.tier = 'desktop'; return M.tier; }

    // Слабый: мало ядер/памяти или очень много пикселей для такого железа
    if (cores <= 4 || mem <= 3 || px > 3500000) M.tier = 'low';
    else if (cores <= 6 || mem <= 6) M.tier = 'mid';
    else M.tier = 'high';
    return M.tier;
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  2. ПРОФИЛИ КАЧЕСТВА
  // ─────────────────────────────────────────────────────────────────────────
  var PROFILES = {
    low:  { fps: 30, pixelRatio: 0.75, shadows: false, cull: 90,  npcAnim: 6,  dust: false, remoteAnim: 4 },
    mid:  { fps: 45, pixelRatio: 1.0,  shadows: false, cull: 140, npcAnim: 12, dust: false, remoteAnim: 8 },
    high: { fps: 60, pixelRatio: 1.25, shadows: false, cull: 190, npcAnim: 20, dust: true,  remoteAnim: 14 },
    desktop: { fps: 0, pixelRatio: 2.0, shadows: true, cull: 300, npcAnim: 40, dust: true, remoteAnim: 32 }
  };

  M.profile = PROFILES.mid;

  M.apply = function (tier) {
    var p = PROFILES[tier] || PROFILES.mid;
    M.profile = p;
    try {
      if (window.renderer) {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, p.pixelRatio));
        if (renderer.shadowMap) renderer.shadowMap.enabled = p.shadows;
      }
      if (window.FZ52) {
        FZ52.mobile.fpsCap = p.fps || 60;
        FZ52.cullDistance = p.cull;
      }
    } catch (e) {}
    console.log('[FZ52] профиль устройства:', tier, '| FPS-кап:', p.fps || 'без кап');
    return p;
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  3. АДАПТИВНОЕ КАЧЕСТВО ПО РЕАЛЬНОМУ FPS
  //  Если телефон не тянет — снижаем нагрузку автоматически. Если наоборот
  //  запас есть — возвращаем качество. Гистерезис не даёт «моргать».
  // ─────────────────────────────────────────────────────────────────────────
  var _samples = [], _lastCheck = 0, _level = 0;
  var LEVELS = [1.0, 0.85, 0.7, 0.55];   // множители к pixelRatio

  M.sample = function (frameMs) {
    _samples.push(frameMs);
    if (_samples.length > 90) _samples.shift();
  };

  M.adapt = function () {
    var now = Date.now();
    if (now - _lastCheck < 3500) return;
    if (_samples.length < 60) return;
    _lastCheck = now;

    var sum = 0;
    for (var i = 0; i < _samples.length; i++) sum += _samples[i];
    var avg = sum / _samples.length;
    var fps = avg > 0 ? 1000 / avg : 60;

    var changed = false;
    if (fps < 24 && _level < LEVELS.length - 1) { _level++; changed = true; }
    else if (fps > 50 && _level > 0) { _level--; changed = true; }

    if (changed) {
      try {
        var base = M.profile.pixelRatio;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, base * LEVELS[_level]));
        // на самом низком уровне убираем и дальние объекты
        if (window.FZ52) {
          FZ52.cullDistance = M.profile.cull * (1 - _level * 0.18);
        }
      } catch (e) {}
      console.log('[FZ52] авто-качество →', _level, '| FPS', Math.round(fps));
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  4. КУЛЛИНГ: не анимируем то, что не видно
  //  Главная экономия. Раньше все NPC и игроки анимировались всегда.
  // ─────────────────────────────────────────────────────────────────────────
  M.inRange = function (objPos, playerPos, maxDist) {
    if (!objPos || !playerPos) return true;
    var dx = objPos.x - playerPos.x;
    var dz = objPos.z - playerPos.z;
    var lim = maxDist || M.profile.cull;
    return (dx * dx + dz * dz) < lim * lim;
  };

  // Ближайшие N объектов — остальные замораживаем.
  // Сортировка дорогая, поэтому делаем её не каждый кадр.
  var _nearCache = { t: 0, list: [] };
  M.nearest = function (list, playerPos, limit) {
    var now = Date.now();
    if (now - _nearCache.t < 400 && _nearCache.list.length) return _nearCache.list;
    var scored = [];
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      var p = o && (o.position || (o.mesh && o.mesh.position));
      if (!p) continue;
      var dx = p.x - playerPos.x, dz = p.z - playerPos.z;
      scored.push({ o: o, d: dx * dx + dz * dz });
    }
    scored.sort(function (a, b) { return a.d - b.d; });
    var out = [];
    for (var k = 0; k < Math.min(limit, scored.length); k++) out.push(scored[k].o);
    _nearCache = { t: now, list: out };
    return out;
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  5. ЭКОНОМИЯ БАТАРЕИ
  // ─────────────────────────────────────────────────────────────────────────
  M.hidden = false;
  document.addEventListener('visibilitychange', function () {
    M.hidden = document.hidden;
    if (M.hidden) console.log('[FZ52] вкладка скрыта — рендер приостановлен');
  });

  // Экономия при низком заряде: если батарея <15% и не заряжается,
  // принудительно роняем качество.
  if (navigator.getBattery) {
    navigator.getBattery().then(function (b) {
      function check() {
        if (b.level < 0.15 && !b.charging) {
          M.apply('low');
          if (typeof showNotification === 'function') {
            showNotification('🔋 Низкий заряд — качество снижено', 'info');
          }
        }
      }
      b.addEventListener('levelchange', check);
      b.addEventListener('chargingchange', check);
      check();
    }).catch(function () {});
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  6. ПОЛЕЗНЫЕ МЕЛОЧИ ДЛЯ ТЕЛЕФОНА
  // ─────────────────────────────────────────────────────────────────────────

  // Не даём экрану гаснуть во время игры.
  M.keepAwake = function () {
    if (!('wakeLock' in navigator)) return;
    var lock = null;
    function req() {
      navigator.wakeLock.request('screen').then(function (l) {
        lock = l;
        l.addEventListener('release', function () { lock = null; });
      }).catch(function () {});
    }
    req();
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && !lock) req();
    });
  };

  // Подсказка при первом запуске на телефоне.
  M.firstRunHint = function () {
    try {
      if (localStorage.getItem('fz_mob_hint_v52')) return;
      localStorage.setItem('fz_mob_hint_v52', '1');
      setTimeout(function () {
        if (typeof showNotification === 'function') {
          showNotification('📱 Джойстик слева · камера — свайп справа', 'info');
        }
      }, 4000);
    } catch (e) {}
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  7. ЗАПУСК
  // ─────────────────────────────────────────────────────────────────────────
  function boot() {
    var tier = M.detect();
    M.apply(tier);
    if (M.active) {
      M.keepAwake();
      M.firstRunHint();
    }
    console.log('[FZ52] мобильная оптимизация:', M.active ? 'включена (' + tier + ')' : 'ПК-режим');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 800); });
  } else {
    setTimeout(boot, 800);
  }
})();
