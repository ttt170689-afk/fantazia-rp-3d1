// ═══════════════════════════════════════════════════════════════════════════
//  FANTAZIA RP v52 — ГРАФИКА И АНИМАЦИИ
//  Всё сделано так, чтобы РАБОТАЛО НА ТЕЛЕФОНЕ: никаких постпроцесс-пассов
//  и лишних рендер-таргетов. Эффекты — на геометрии и материалах, которые
//  дёшевы для мобильного GPU, плюс автоотключение при низком FPS.
// ═══════════════════════════════════════════════════════════════════════════
(function FZ_GRAPHICS() {
  'use strict';

  var T = window.THREE;
  if (!T) return;

  var GFX = window.FZ_GFX = {
    enabled: true,
    quality: 1,          // 0 = экономия, 1 = норма, 2 = красиво
    items: []
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  1. КАЧЕСТВЕННОЕ ОСВЕЩЕНИЕ БЕЗ ПОСТПРОЦЕССА
  //  Мягкий заполняющий свет + полусферический ambient дают объём
  //  почти бесплатно, в отличие от SSAO/bloom, которые убивают телефон.
  // ─────────────────────────────────────────────────────────────────────────
  GFX.improveLighting = function () {
    try {
      if (!window.scene) return false;
      if (GFX._litDone) return true;

      // Полусферический свет: небо сверху, отражение земли снизу.
      // Один такой источник заменяет 3-4 точечных и стоит дешевле.
      var hemi = new T.HemisphereLight(0xbfd4ff, 0x2a2418, 0.55);
      hemi.position.set(0, 60, 0);
      hemi.name = 'FZ52_HEMI';
      scene.add(hemi);

      // Мягкая подсветка спереди, чтобы лица не проваливались в тень.
      var fill = new T.DirectionalLight(0xffeedd, 0.28);
      fill.position.set(-40, 35, 40);
      fill.name = 'FZ52_FILL';
      scene.add(fill);

      GFX._litDone = true;
      return true;
    } catch (e) { return false; }
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  2. ТОНМАППИНГ И ЦВЕТ
  //  Картинка была плоской: без тонмаппинга яркие места пересвечены,
  //  тёмные — в кашу. ACES даёт кинематографичный контраст.
  // ─────────────────────────────────────────────────────────────────────────
  GFX.tune = function (mobile) {
    try {
      if (!window.renderer) return false;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = mobile ? 0.95 : 1.05;
      if (T.sRGBEncoding !== undefined && 'outputEncoding' in renderer) {
        renderer.outputEncoding = T.sRGBEncoding;
      }
      return true;
    } catch (e) { return false; }
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  3. ПРОЦЕДУРНЫЕ ЭФФЕКТЫ
  // ─────────────────────────────────────────────────────────────────────────

  // Пылинки в свете — дёшево (один Points), сильно оживляет интерьер.
  GFX.addDust = function (x, y, z, count) {
    try {
      if (!window.scene) return null;
      count = count || (GFX.quality > 0 ? 60 : 24);
      var g = new T.BufferGeometry();
      var pos = new Float32Array(count * 3);
      var spd = [];
      for (var i = 0; i < count; i++) {
        pos[i * 3]     = x + (Math.random() - 0.5) * 14;
        pos[i * 3 + 1] = y + Math.random() * 4;
        pos[i * 3 + 2] = z + (Math.random() - 0.5) * 14;
        spd.push(0.06 + Math.random() * 0.16);
      }
      g.setAttribute('position', new T.BufferAttribute(pos, 3));
      var m = new T.PointsMaterial({
        color: 0xfff0d0, size: 0.045, transparent: true,
        opacity: 0.42, depthWrite: false
      });
      var p = new T.Points(g, m);
      p.userData.fzDust = { spd: spd, baseY: y, count: count };
      p.name = 'FZ52_DUST';
      scene.add(p);
      GFX.items.push(p);
      return p;
    } catch (e) { return null; }
  };

  // Мягкая тень-пятно под персонажем. Настоящие тени на мобиле выключены,
  // а без тени модель «висит в воздухе» — это очень заметно.
  GFX.addBlobShadow = function (target) {
    try {
      if (!target || target.userData.fzBlob) return null;
      var cv = document.createElement('canvas');
      cv.width = cv.height = 64;
      var c = cv.getContext('2d');
      if (!c) return null;
      var grd = c.createRadialGradient(32, 32, 2, 32, 32, 30);
      grd.addColorStop(0, 'rgba(0,0,0,0.55)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = grd;
      c.fillRect(0, 0, 64, 64);
      var tex = new T.CanvasTexture(cv);
      var m = new T.MeshBasicMaterial({
        map: tex, transparent: true, depthWrite: false, opacity: 0.75
      });
      var mesh = new T.Mesh(new T.PlaneGeometry(1.5, 1.5), m);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.02;
      mesh.name = 'FZ52_BLOB';
      target.add(mesh);
      target.userData.fzBlob = mesh;
      return mesh;
    } catch (e) { return null; }
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  4. ПРОДВИНУТЫЕ АНИМАЦИИ ПЕРСОНАЖА
  //  Базовая анимация — простые синусы по конечностям. Добавляем то,
  //  что делает движение живым: инерцию корпуса, дыхание в покое,
  //  наклон в поворотах, приземление после прыжка.
  // ─────────────────────────────────────────────────────────────────────────
  var animState = new WeakMap();

  GFX.animateAdvanced = function (mesh, state, t, dt) {
    if (!mesh) return;
    var st = animState.get(mesh);
    if (!st) {
      st = { lean: 0, bob: 0, breath: 0, lastY: mesh.position.y, land: 0, prevRot: mesh.rotation.y };
      animState.set(mesh, st);
    }

    var moving = (state === 'walk' || state === 'run');
    var running = (state === 'run');

    // ── наклон корпуса в повороте (как у мотоцикла) ──
    var dRot = mesh.rotation.y - st.prevRot;
    while (dRot > Math.PI) dRot -= Math.PI * 2;
    while (dRot < -Math.PI) dRot += Math.PI * 2;
    st.prevRot = mesh.rotation.y;
    var targetLean = moving ? Math.max(-0.22, Math.min(0.22, -dRot * 5)) : 0;
    st.lean += (targetLean - st.lean) * Math.min(1, dt * 8);

    // ── дыхание в покое ──
    st.breath = moving ? 0 : Math.sin(t * 1.6) * 0.012;

    // ── приземление ──
    var dy = mesh.position.y - st.lastY;
    st.lastY = mesh.position.y;
    if (dy < -0.22) st.land = 1;              // резко пошли вниз
    if (st.land > 0) st.land = Math.max(0, st.land - dt * 4);

    var model = mesh.userData && mesh.userData.model;
    if (!model) return;

    // корпус: наклон + просадка при приземлении + дыхание
    if (model.torso) {
      model.torso.rotation.z = st.lean;
      model.torso.position.y = (model.torso.userData.baseY !== undefined
        ? model.torso.userData.baseY
        : (model.torso.userData.baseY = model.torso.position.y))
        - st.land * 0.09 + st.breath;
      // лёгкий наклон вперёд при беге
      model.torso.rotation.x = running ? 0.14 : (moving ? 0.06 : 0);
    }

    // голова: смотрит чуть по ходу движения, покачивается в покое
    if (model.head) {
      if (model.head.userData.baseY === undefined) model.head.userData.baseY = model.head.position.y;
      model.head.rotation.z = -st.lean * 0.5;
      model.head.rotation.x = moving ? -0.05 : Math.sin(t * 1.2) * 0.03;
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  5. ОБНОВЛЕНИЕ ЭФФЕКТОВ (вызывается из главного цикла)
  // ─────────────────────────────────────────────────────────────────────────
  GFX.update = function (t, dt) {
    if (!GFX.enabled) return;
    for (var i = 0; i < GFX.items.length; i++) {
      var o = GFX.items[i];
      if (!o || !o.userData || !o.userData.fzDust) continue;
      var d = o.userData.fzDust;
      var arr = o.geometry.attributes.position.array;
      for (var k = 0; k < d.count; k++) {
        arr[k * 3 + 1] += d.spd[k] * dt;
        if (arr[k * 3 + 1] > d.baseY + 4) arr[k * 3 + 1] = d.baseY;
        arr[k * 3] += Math.sin(t * 0.5 + k) * dt * 0.05;
      }
      o.geometry.attributes.position.needsUpdate = true;
    }
  };

  // Полная очистка — вызывать при выгрузке интерьера, иначе утечка.
  GFX.dispose = function () {
    for (var i = 0; i < GFX.items.length; i++) {
      var o = GFX.items[i];
      try {
        if (o.parent) o.parent.remove(o);
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (o.material.map) o.material.map.dispose();
          o.material.dispose();
        }
      } catch (e) {}
    }
    GFX.items.length = 0;
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  6. АВТОСТАРТ
  // ─────────────────────────────────────────────────────────────────────────
  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    var mobile = window.FZ52 ? FZ52.isMobile : false;
    var ok = GFX.improveLighting() && GFX.tune(mobile);
    if (ok || tries > 30) {
      clearInterval(iv);
      if (ok) console.log('[FZ52] графика: освещение и тонмаппинг применены');
    }
  }, 600);
})();
