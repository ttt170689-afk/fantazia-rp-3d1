/* ============================================================
   FANTAZIA RP 3D — ПАТЧ-ЗАПЛАТКА (двe правки, работает в ЛЮБОЙ версии игры)
   1) Убирает с экрана входа любого маскота (череп, существо, баннер-картинку).
   2) Держит брови персонажа на лице — они больше не сползают ко рту.

   Как подключить в своей сборке: положить файл рядом с index.html
   и добавить ПЕРЕД закрывающим </body>:
       <script src="assets/fz-fix-patch.js"></script>
   Ничего больше менять не нужно, патч работает поверх существующего кода.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 1. ЧИСТКА ЭКРАНА ВХОДА ---------- */
  var BAD = /skull|cherep|череп|mascot|маскот|demonhead|demon-head|authdemon|authtv|authpet|authcreature|authmascot|authskull|monsterhead/i;
  // что на экране входа оставляем (всё остальное декоративное — удаляем)
  var KEEP_ID = /^(authStars|authNoise|authLoadingOverlay|loginForm|registerForm)$/;
  var KEEP_CLS = /auth-card|auth-stars|auth-overlay|auth-bg|auth-grid/;

  function cleanAuth() {
    var scr = document.getElementById('authScreen');
    if (!scr) return;
    // а) по имени/классу — где угодно внутри экрана
    var all = scr.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var key = (el.id || '') + ' ' + (el.className && el.className.toString ? el.className.toString() : '') +
                ' ' + (el.getAttribute('data-role') || '') + ' ' + (el.getAttribute('alt') || '') +
                ' ' + (el.getAttribute('src') || '');
      if (BAD.test(key)) { el.remove(); continue; }
    }
    // б) любые декоративные прямые дети экрана, которых не должно быть
    var kids = scr.children;
    for (var j = kids.length - 1; j >= 0; j--) {
      var k = kids[j], tag = k.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK') continue;
      var id = k.id || '', cls = (k.className && k.className.toString) ? k.className.toString() : '';
      if (KEEP_ID.test(id) || KEEP_CLS.test(cls)) continue;
      // svg/img/canvas/div-картинка без формы входа внутри — это декор, сносим
      if (tag === 'SVG' || tag === 'svg' || tag === 'IMG' || tag === 'CANVAS' ||
          (!k.querySelector('input,button,form') && !/auth/i.test(id + ' ' + cls))) {
        k.remove();
      }
    }
  }
  cleanAuth();
  document.addEventListener('DOMContentLoaded', cleanAuth);
  try { new MutationObserver(cleanAuth).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
  var n = 0, iv = setInterval(function () { cleanAuth(); if (++n > 120) clearInterval(iv); }, 500);

  /* ---------- 2. БРОВИ НА МЕСТЕ ---------- */
  // Игра каждый кадр пишет в кости лица АБСОЛЮТНЫЕ координаты (brow.position.y = 0.19),
  // которые верны только для старой модели. На новом риге бровь уезжает ко рту.
  // Патч запоминает «родную» точку брови и возвращает её туда, оставляя наклон (мимику).
  var chars = [];
  var MAXD = 0.03; // допустимое отклонение от родной точки

  function watch(ch) { if (ch && ch.userData && chars.indexOf(ch) < 0) chars.push(ch); }

  if (typeof window.createCharacter === 'function') {
    var origCreate = window.createCharacter;
    window.createCharacter = function () {
      var ch = origCreate.apply(this, arguments);
      try { watch(ch); } catch (e) {}
      return ch;
    };
  }

  function fixOne(ch) {
    var ud = ch.userData, f = ud && ud.face;
    if (!f || !f.browL || !f.browR) return;
    // кости могли быть заменены (например, после загрузки нового рига) — перезапомнить
    if (ch.__fzBrowRef !== f.browL) {
      ch.__fzBrowRef = f.browL;
      ch.__fzRest = {
        L: { x: f.browL.position.x, y: f.browL.position.y, z: f.browL.position.z },
        R: { x: f.browR.position.x, y: f.browR.position.y, z: f.browR.position.z }
      };
      return;
    }
    var R = ch.__fzRest; if (!R) return;
    [['browL', R.L], ['browR', R.R]].forEach(function (p) {
      var o = f[p[0]], r = p[1], po = o.position;
      if (!isFinite(po.x) || !isFinite(po.y) || !isFinite(po.z) ||
          Math.abs(po.x - r.x) > MAXD || Math.abs(po.y - r.y) > MAXD || Math.abs(po.z - r.z) > MAXD) {
        po.set(r.x, r.y, r.z);          // мгновенный возврат, без «полёта» брови
      }
    });
  }

  function loop() {
    for (var i = 0; i < chars.length; i++) { try { fixOne(chars[i]); } catch (e) {} }
    // персонаж с новым ригом, если модуль SuperRig есть
    try { if (window.SuperRig && window.SuperRig.last) { watch(window.SuperRig.last); } } catch (e) {}
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  window.fzFixPatch = { chars: chars, clean: cleanAuth };
  console.log('[fz-fix-patch] активен: маскот входа удаляется, брови зафиксированы');
})();
