// ═══════════════════════════════════════════════════════════════
//  FANTAZIA RP — МИР v2: «FANTAZIA CITY»
//  полностью новый город: спавн-площадь, GRAND PLAZA MALL с
//  кинотеатром, старый город с домами (интерьеры), улица
//  магазинов, кафешки, парк с прудом, жилые башни
//  все здания — с коллизиями, интерьеры — вход свободный
// ═══════════════════════════════════════════════════════════════
(function () {
  var G = null;          // корень города
  var MT = {};           // материалы
  var TX = {};           // текстуры

  // ── точка спавна — центр вселенной ──
  var SPAWN = { x: 17, z: 21 };

  // ═══════════════ ТЕКСТУРЫ ═══════════════
  function makeTex(w, h, fn, rx, ry) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    fn(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c);
    if (rx) t.wrapS = THREE.RepeatWrapping;
    if (ry) t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  function buildTextures() {
    TX.asphalt = makeTex(128, 128, function (q, w, h) {
      q.fillStyle = '#34373d';
      q.fillRect(0, 0, w, h);
      for (var i = 0; i < 1100; i++) {
        var g = 38 + Math.random() * 34;
        q.fillStyle = 'rgba(' + g + ',' + g + ',' + (g + 5) + ',.55)';
        q.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    }, true, true);
    TX.pave = makeTex(128, 128, function (q, w, h) {
      q.fillStyle = '#71747a';
      q.fillRect(0, 0, w, h);
      q.strokeStyle = '#5b5e63';
      q.lineWidth = 2;
      for (var x = 0; x <= w; x += 32) { q.beginPath(); q.moveTo(x, 0); q.lineTo(x, h); q.stroke(); }
      for (var y = 0; y <= h; y += 32) { q.beginPath(); q.moveTo(0, y); q.lineTo(w, y); q.stroke(); }
      for (var i = 0; i < 200; i++) {
        q.fillStyle = 'rgba(90,92,98,.4)';
        q.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    }, true, true);
    TX.grass = makeTex(128, 128, function (q, w, h) {
      q.fillStyle = '#3e5c36';
      q.fillRect(0, 0, w, h);
      for (var i = 0; i < 800; i++) {
        q.fillStyle = Math.random() > 0.5 ? 'rgba(74,110,62,.6)' : 'rgba(52,84,46,.6)';
        q.fillRect(Math.random() * w, Math.random() * h, 3, 3);
      }
    }, true, true);
    TX.wallA = makeTex(64, 64, function (q, w, h) {
      q.fillStyle = '#b39a7d';
      q.fillRect(0, 0, w, h);
      q.strokeStyle = 'rgba(120,98,74,.5)';
      q.lineWidth = 1;
      for (var y = 0; y < h; y += 8) { q.beginPath(); q.moveTo(0, y); q.lineTo(w, y); q.stroke(); }
    }, true, true);
    TX.wallB = makeTex(64, 64, function (q, w, h) {
      q.fillStyle = '#8d99a8';
      q.fillRect(0, 0, w, h);
      q.strokeStyle = 'rgba(90,102,116,.6)';
      q.lineWidth = 1;
      for (var y = 0; y < h; y += 16) { q.beginPath(); q.moveTo(0, y); q.lineTo(w, y); q.stroke(); }
      for (var x = 0; x < w; x += 32) { q.beginPath(); q.moveTo(x, 0); q.lineTo(x, h); q.stroke(); }
    }, true, true);
    TX.brick = makeTex(64, 64, function (q, w, h) {
      q.fillStyle = '#9c6b52';
      q.fillRect(0, 0, w, h);
      q.fillStyle = '#8a5c46';
      for (var y = 0; y < h; y += 8) {
        for (var x = (y / 8) % 2 * 8; x < w; x += 16) q.fillRect(x + 1, y + 1, 14, 6);
      }
    }, true, true);
    TX.plank = makeTex(64, 64, function (q, w, h) {
      q.fillStyle = '#8a6238';
      q.fillRect(0, 0, w, h);
      q.strokeStyle = 'rgba(90,60,32,.6)';
      for (var y = 0; y < h; y += 10) { q.beginPath(); q.moveTo(0, y); q.lineTo(w, y); q.stroke(); }
    }, true, true);
    TX.tile = makeTex(64, 64, function (q, w, h) {
      q.fillStyle = '#d8d4c8';
      q.fillRect(0, 0, w, h);
      q.strokeStyle = '#b8b4a6';
      q.lineWidth = 2;
      for (var x = 0; x <= w; x += 16) { q.beginPath(); q.moveTo(x, 0); q.lineTo(x, h); q.stroke(); }
      for (var y = 0; y <= h; y += 16) { q.beginPath(); q.moveTo(0, y); q.lineTo(w, y); q.stroke(); }
    }, true, true);
    TX.carpet = makeTex(64, 64, function (q, w, h) {
      q.fillStyle = '#8a2432';
      q.fillRect(0, 0, w, h);
      for (var i = 0; i < 240; i++) {
        q.fillStyle = 'rgba(255,190,190,.06)';
        q.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    }, true, true);
    TX.roofTile = makeTex(64, 64, function (q, w, h) {
      q.fillStyle = '#6b4a3a';
      q.fillRect(0, 0, w, h);
      q.fillStyle = '#5d3f31';
      for (var y = 0; y < h; y += 6) q.fillRect(0, y, w, 3);
    }, true, true);
  }

  // ═══════════════ МАТЕРИАЛЫ ═══════════════
  function L(o) { return new THREE.MeshLambertMaterial(o); }
  function buildMaterials() {
    MT.road   = L({ map: TX.asphalt });
    MT.pave   = L({ map: TX.pave });
    MT.grass  = L({ map: TX.grass });
    MT.wallA  = L({ map: TX.wallA });
    MT.wallB  = L({ map: TX.wallB });
    MT.brick  = L({ map: TX.brick });
    MT.plank  = L({ map: TX.plank });
    MT.tile   = L({ map: TX.tile });
    MT.carpet = L({ map: TX.carpet });
    MT.roofT  = L({ map: TX.roofTile });
    MT.glass  = new THREE.MeshLambertMaterial({ color: 0xaadcee, transparent: true, opacity: 0.5, emissive: 0x123240, emissiveIntensity: 0.3 });
    MT.white  = L({ color: 0xece7db });
    MT.cream  = L({ color: 0xd9c9a8 });
    MT.wood   = L({ color: 0x7a5233 });
    MT.wood2  = L({ color: 0x93684a });
    MT.metal  = L({ color: 0x707680 });
    MT.dark   = L({ color: 0x2e3138 });
    MT.stone  = L({ color: 0x8d9198 });
    MT.leaf   = L({ color: 0x3e6b36 });
    MT.leaf2  = L({ color: 0x4e7c40 });
    MT.trunk  = L({ color: 0x5c432a });
    MT.water  = new THREE.MeshLambertMaterial({ color: 0x3f9fd8, transparent: true, opacity: 0.82, emissive: 0x08283c, emissiveIntensity: 0.5 });
    MT.red    = L({ color: 0xa8323e });
    MT.blue   = L({ color: 0x39549c });
    MT.green  = L({ color: 0x3d7a4c });
    MT.yellow = L({ color: 0xd8a83a });
    MT.line   = new THREE.MeshBasicMaterial({ color: 0xd8d8cc });
    MT.neonW  = new THREE.MeshBasicMaterial({ color: 0xfff6d8 });
    MT.neonR  = new THREE.MeshBasicMaterial({ color: 0xff4060 });
    MT.neonB  = new THREE.MeshBasicMaterial({ color: 0x40b0ff });
    MT.neonG  = new THREE.MeshBasicMaterial({ color: 0x50ff90 });
    MT.neonY  = new THREE.MeshBasicMaterial({ color: 0xffd040 });
    MT.neonP  = new THREE.MeshBasicMaterial({ color: 0xc060ff });
    MT.screen = new THREE.MeshBasicMaterial({ color: 0x181c26 });
    MT.awnR   = L({ color: 0xb84a58 });
    MT.awnG   = L({ color: 0x3f8f5f });
    MT.awnB   = L({ color: 0x4f6fc0 });
    MT.awnY   = L({ color: 0xc8a84f });
  }

  // ═══════════════ ХЕЛПЕРЫ ГЕОМЕТРИИ ═══════════════
  // простой меш без коллизии
  function box(w, h, d, mat, x, y, z, ry) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (ry) m.rotation.y = ry;
    G.add(m);
    return m;
  }
  // меш + прямоугольная коллизия
  function solid(w, h, d, mat, x, y, z, ry) {
    var m = box(w, h, d, mat, x, y, z, ry);
    buildings.push({
      mesh: m, x: x, z: z, w: w, d: d, h: h, name: 'wall', type: 'city3',
      bounds: { minX: x - w / 2 - 0.4, maxX: x + w / 2 + 0.4, minZ: z - d / 2 - 0.4, maxZ: z + d / 2 + 0.4 }
    });
    return m;
  }
  // круглая коллизия (фонари, деревья...)
  function circ(x, z, r) {
    streetColliders.push({ x: x, z: z, r: r });
  }
  // стена с проёмом: сегмент вдоль X (дверь шириной dw в центре)
  function wallX(z, x1, x2, h, mat, dw, y0) {
    y0 = y0 || 0;
    var len = x2 - x1;
    var cx = (x1 + x2) / 2;
    if (!dw) { solid(len, h, 0.5, mat, cx, y0 + h / 2, z); return; }
    var side = (len - dw) / 2;
    solid(side, h, 0.5, mat, x1 + side / 2, y0 + h / 2, z);
    solid(side, h, 0.5, mat, x2 - side / 2, y0 + h / 2, z);
    // перемычка над дверью
    box(dw, h - 2.6, 0.5, mat, cx, y0 + 2.6 + (h - 2.6) / 2, z);
  }
  // стена с проёмом вдоль Z
  function wallZ(x, z1, z2, h, mat, dw, y0) {
    y0 = y0 || 0;
    var len = z2 - z1;
    var cz = (z1 + z2) / 2;
    if (!dw) { solid(0.5, h, len, mat, x, y0 + h / 2, cz); return; }
    var side = (len - dw) / 2;
    solid(0.5, h, side, mat, x, y0 + h / 2, z1 + side / 2);
    solid(0.5, h, side, mat, x, y0 + h / 2, z2 - side / 2);
    box(0.5, h - 2.6, dw, mat, x, y0 + 2.6 + (h - 2.6) / 2, cz);
  }
  // окно светящееся/тёмное
  function win(x, y, z, ry, lit, w, h) {
    var m = new THREE.Mesh(
      new THREE.PlaneGeometry(w || 1.2, h || 1.5),
      lit ? MT.neonW : MT.dark);
    m.position.set(x, y, z);
    if (ry) m.rotation.y = ry;
    G.add(m);
  }
  // неоновая вывеска
  function sign(text, color, w, x, y, z, ry) {
    var c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    var q = c.getContext('2d');
    q.fillStyle = 'rgba(8,8,16,.92)';
    q.fillRect(0, 0, 512, 128);
    q.strokeStyle = color; q.lineWidth = 6;
    q.strokeRect(8, 8, 496, 112);
    q.font = '900 62px Arial';
    q.textAlign = 'center'; q.textBaseline = 'middle';
    q.shadowColor = color; q.shadowBlur = 28;
    q.fillStyle = color;
    q.fillText(text, 256, 68);
    var t = new THREE.CanvasTexture(c);
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4),
      new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    if (ry) m.rotation.y = ry;
    G.add(m);
    return m;
  }
  // дерево
  function tree(x, z, sc) {
    sc = sc || 1;
    var tr = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * sc, 0.24 * sc, 2.3 * sc, 7), MT.trunk);
    tr.position.set(x, 1.15 * sc, z);
    G.add(tr);
    var c1 = new THREE.Mesh(new THREE.SphereGeometry(1.5 * sc, 8, 7), MT.leaf);
    c1.position.set(x, 3 * sc, z);
    G.add(c1);
    var c2 = new THREE.Mesh(new THREE.SphereGeometry(1.05 * sc, 7, 6), MT.leaf2);
    c2.position.set(x + 0.5 * sc, 3.6 * sc, z - 0.35 * sc);
    G.add(c2);
    var c3 = new THREE.Mesh(new THREE.SphereGeometry(0.85 * sc, 7, 6), MT.leaf2);
    c3.position.set(x - 0.55 * sc, 3.3 * sc, z + 0.4 * sc);
    G.add(c3);
    circ(x, z, 0.55 * sc);
  }
  // фонарь
  function lamp(x, z) {
    var p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 4.8, 7), MT.metal);
    p.position.set(x, 2.4, z);
    G.add(p);
    var a = box(0.75, 0.12, 0.12, MT.metal, x, 4.62, z);
    var hd = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 7), MT.neonW);
    hd.position.set(x, 4.75, z);
    G.add(hd);
    circ(x, z, 0.45);
  }
  // лавочка
  function bench(x, z, ry) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    if (ry) g.rotation.y = ry;
    var s1 = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.55), MT.wood);
    s1.position.y = 0.62;
    g.add(s1);
    var s2 = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 0.1), MT.wood);
    s2.position.set(0, 0.95, -0.26);
    g.add(s2);
    [-0.75, 0.75].forEach(function (s) {
      var l = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.62, 0.5), MT.metal);
      l.position.set(s, 0.31, 0);
      g.add(l);
    });
    G.add(g);
    circ(x, z, 0.9);
    if (typeof sitSpots !== 'undefined' && sitSpots.push) {
      sitSpots.push({ x: x, z: z, mesh: g });
    }
  }
  // урна
  function bin(x, z) {
    var b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.85, 8), MT.dark);
    b.position.set(x, 0.43, z);
    G.add(b);
    var r = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 8), MT.metal);
    r.position.set(x, 0.89, z);
    G.add(r);
    circ(x, z, 0.4);
  }
  // куст
  function bush(x, z, sc) {
    sc = sc || 1;
    var b = new THREE.Mesh(new THREE.SphereGeometry(0.8 * sc, 7, 6), MT.leaf2);
    b.position.set(x, 0.55 * sc, z);
    b.scale.y = 0.72;
    G.add(b);
  }
  // клумба с цветами
  function flowerbed(x, z) {
    var bed = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.1, 0.5, 12), MT.stone);
    bed.position.set(x, 0.25, z);
    G.add(bed);
    var soil = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.28, 12), MT.grass);
    soil.position.set(x, 0.54, z);
    G.add(soil);
    var cols = [0xff5080, 0xffd040, 0xff8040, 0xff6ac0, 0xfff0f0];
    for (var i = 0; i < 8; i++) {
      var a = i / 8 * Math.PI * 2;
      var f = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 5),
        new THREE.MeshBasicMaterial({ color: cols[i % 5] }));
      f.position.set(x + Math.cos(a) * 1.15, 0.85, z + Math.sin(a) * 1.15);
      G.add(f);
    }
    circ(x, z, 2.1);
  }

  // ═══════════════ ЗЕМЛЯ И ДОРОГИ ═══════════════
  // сетка города: главные проспекты и улицы
  var ROADS = {
    h: [ 21, 118 ],          // горизонтальные (по x), z
    v: [ -66, 100 ]          // вертикальные (по z), x
  };
  var WORLD = 290;           // размер застройки (от -145 до 145)

  function buildGround() {
    // земля-газон
    var gr = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, WORLD), MT.grass);
    gr.rotation.x = -Math.PI / 2;
    gr.position.y = 0;
    G.add(gr);
    // внешнее кольцо дороги
    var RW = 12;
    [-1, 1].forEach(function (s) {
      var r = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, RW), MT.road);
      r.rotation.x = -Math.PI / 2;
      r.position.set(0, 0.02, s * (WORLD / 2 - RW / 2));
      G.add(r);
      var r2 = new THREE.Mesh(new THREE.PlaneGeometry(RW, WORLD), MT.road);
      r2.rotation.x = -Math.PI / 2;
      r2.position.set(s * (WORLD / 2 - RW / 2), 0.02, 0);
      G.add(r2);
    });
    // главная площадь — плита
    var sq = new THREE.Mesh(new THREE.CircleGeometry(12, 28), MT.pave);
    sq.rotation.x = -Math.PI / 2;
    sq.position.set(17, 0.028, 2);
    G.add(sq);
    // лучи-дорожки от площади
    [[1, 0], [-1, 0], [0, -1]].forEach(function (d) {
      var p = new THREE.Mesh(new THREE.PlaneGeometry(d[0] ? 54 : 5, d[1] ? 54 : 5), MT.pave);
      p.rotation.x = -Math.PI / 2;
      p.position.set(17 + d[0] * 34, 0.024, 2 + d[1] * 34);
      G.add(p);
    });
  }

  function buildRoads() {
    var RW = 10;
    ROADS.h.forEach(function (z) {
      var r = new THREE.Mesh(new THREE.PlaneGeometry(WORLD - 24, RW), MT.road);
      r.rotation.x = -Math.PI / 2;
      r.position.set(0, 0.03, z);
      G.add(r);
      // пунктир
      for (var i = 0; i < 30; i++) {
        var d = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.32), MT.line);
        d.rotation.x = -Math.PI / 2;
        d.position.set(-130 + i * 9, 0.04, z);
        G.add(d);
      }
      // тротуары
      [-1, 1].forEach(function (s) {
        var p = new THREE.Mesh(new THREE.PlaneGeometry(WORLD - 24, 3), MT.pave);
        p.rotation.x = -Math.PI / 2;
        p.position.set(0, 0.05, z + s * 6.5);
        G.add(p);
      });
    });
    ROADS.v.forEach(function (x) {
      var r = new THREE.Mesh(new THREE.PlaneGeometry(RW, WORLD - 24), MT.road);
      r.rotation.x = -Math.PI / 2;
      r.position.set(x, 0.03, 0);
      G.add(r);
      for (var i = 0; i < 30; i++) {
        var d = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 3), MT.line);
        d.rotation.x = -Math.PI / 2;
        d.position.set(x, 0.04, -130 + i * 9);
        G.add(d);
      }
      [-1, 1].forEach(function (s) {
        var p = new THREE.Mesh(new THREE.PlaneGeometry(3, WORLD - 24), MT.pave);
        p.rotation.x = -Math.PI / 2;
        p.position.set(x + s * 6.5, 0.05, 0);
        G.add(p);
      });
    });
    // зебры на всех перекрёстках
    ROADS.h.forEach(function (z) {
      ROADS.v.forEach(function (x) {
        for (var s = 0; s < 6; s++) {
          var st = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.7), MT.line);
          st.rotation.x = -Math.PI / 2;
          st.position.set(x - 3 + s * 1.2, 0.045, z + 6.6);
          G.add(st);
          var st2 = st.clone();
          st2.position.z = z - 6.6;
          G.add(st2);
        }
      });
    });
    // светофоры на главных перекрёстках
    [[100, 21], [100, 118], [-66, 21], [-66, 118]].forEach(function (c) {
      trafficLight(c[0] + 6, c[1] + 6, 0);
      trafficLight(c[0] - 6, c[1] - 6, Math.PI);
    });
  }

  function trafficLight(x, z, ry) {
    var p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 3.6, 6), MT.metal);
    p.position.set(x, 1.8, z);
    G.add(p);
    var bx = box(0.36, 0.95, 0.3, MT.dark, x, 3.4, z);
    // огни
    var cols = [0xff4040, 0xffd040, 0x40ff60];
    for (var i = 0; i < 3; i++) {
      var l = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5),
        new THREE.MeshBasicMaterial({ color: cols[i] }));
      l.position.set(x, 3.72 - i * 0.3, z + 0.16);
      if (ry) { l.position.z = z - 0.16; }
      G.add(l);
    }
    circ(x, z, 0.4);
  }

  // ═══════════════ ПЛОЩАДЬ СПАВНА ═══════════════
  var fountainSprays = [];
  function buildSpawnPlaza() {
    var FX = 17, FZ = 2;   // центр площади севернее спавна
    // фонтан: 3 яруса
    var pool = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.9, 0.9, 18), MT.stone);
    pool.position.set(FX, 0.45, FZ);
    G.add(pool);
    var water = new THREE.Mesh(new THREE.CylinderGeometry(4.25, 4.25, 0.6, 18), MT.water);
    water.position.set(FX, 0.85, FZ);
    G.add(water);
    var rim = new THREE.Mesh(new THREE.TorusGeometry(4.7, 0.32, 8, 22), MT.stone);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(FX, 1, FZ);
    G.add(rim);
    var col = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.7, 2.8, 10), MT.stone);
    col.position.set(FX, 2.2, FZ);
    G.add(col);
    var b1 = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.05, 0.4, 12), MT.stone);
    b1.position.set(FX, 3.1, FZ);
    G.add(b1);
    var b2 = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.75, 0.34, 12), MT.stone);
    b2.position.set(FX, 3.7, FZ);
    G.add(b2);
    var top = new THREE.Mesh(new THREE.SphereGeometry(0.55, 9, 8), MT.white);
    top.position.set(FX, 4.35, FZ);
    G.add(top);
    circ(FX, FZ, 5);
    // брызги
    var dotC = document.createElement('canvas');
    dotC.width = dotC.height = 32;
    var qd = dotC.getContext('2d');
    var gd = qd.createRadialGradient(16, 16, 1, 16, 16, 15);
    gd.addColorStop(0, 'rgba(215,238,255,1)');
    gd.addColorStop(1, 'rgba(160,210,255,0)');
    qd.fillStyle = gd;
    qd.fillRect(0, 0, 32, 32);
    var dotT = new THREE.CanvasTexture(dotC);
    for (var i = 0; i < 30; i++) {
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotT, transparent: true, opacity: 0.8, depthWrite: false }));
      sp.scale.setScalar(0.4 + Math.random() * 0.5);
      sp.userData = { a: Math.random() * 6.28, v: 1.4 + Math.random() * 2, t: Math.random(), life: 0.9 + Math.random() * 0.5 };
      sp.position.set(FX, 4.5, FZ);
      G.add(sp);
      fountainSprays.push(sp);
    }
    // стела FANTAZIA CITY
    var stel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 5.4, 0.7), MT.stone);
    stel.position.set(4, 2.7, 12);
    stel.rotation.y = 0.6;
    G.add(stel);
    sign('FANTAZIA CITY', '#ffd040', 4.4, 4 + Math.sin(0.6) * 0.45, 4.4, 12 + Math.cos(0.6) * 0.45, 0.6);
    circ(4, 12, 1.4);
    // флаги вокруг площади
    [[-13, -10], [13, -10], [-13, 12], [13, 12]].forEach(function (f) {
      var p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 6, 6), MT.metal);
      p.position.set(17 + f[0], 3, 2 + f[1]);
      G.add(p);
      var fl = box(1.5, 0.9, 0.04, MT.neonB, 17 + f[0] + 0.8, 5.4, 2 + f[1]);
      circ(17 + f[0], 2 + f[1], 0.35);
    });
    // лавки, урны, клумбы, фонари по кругу
    bench(11, 8, 0);
    bench(23, 8, 0);
    bench(11, -6, Math.PI);
    bench(23, -6, Math.PI);
    bin(8, 5);
    bin(26, 5);
    flowerbed(5, 8);
    flowerbed(29, 8);
    lamp(3, -10);
    lamp(31, -10);
    lamp(3, 13);
    lamp(31, 13);
    tree(5, -4, 1.2);
    tree(29, -4, 1.2);
    tree(17, 16, 1);
    bush(13, 13);
    bush(21, 13);
  }

  // ═══════════════ GRAND PLAZA MALL (север от площади) ═══════════════
  // гигантский ТЦ с реальным интерьером: атриум, магазины, фудкорт, кино
  var MALL = { x: 17, z: -52, w: 72, d: 48, h: 14 };

  function buildMall() {
    var x = MALL.x, z = MALL.z, W = MALL.w, D = MALL.d, H = MALL.h;
    var x1 = x - W / 2, x2 = x + W / 2, z1 = z - D / 2, z2 = z + D / 2;

    // ── стены (южная — фасад с 3 входами) ──
    wallX(z2, x1, x2, H, MT.wallB, 0);
    // три проёма на фасаде: центральный 6 и два по 4
    solid(20.5, H, 0.6, MT.wallB, x1 + 10.25, H / 2, z2);
    solid(20.5, H, 0.6, MT.wallB, x2 - 10.25, H / 2, z2);
    solid(9, H, 0.6, MT.wallB, x - 12.5 + 4.5, H / 2, z2);   // простенок левый среднего
    solid(9, H, 0.6, MT.wallB, x + 12.5 - 4.5, H / 2, z2);   // правый
    solid(6.5, H, 0.6, MT.wallB, x - 21.25 + 3.25, H / 2, z2);
    solid(6.5, H, 0.6, MT.wallB, x + 21.25 - 3.25, H / 2, z2);
    // перемычки над входами
    box(6, H - 4.2, 0.6, MT.wallB, x, 4.2 + (H - 4.2) / 2, z2);
    box(4, H - 4, 0.6, MT.wallB, x - 12.5, 4 + (H - 4) / 2, z2);
    box(4, H - 4, 0.6, MT.wallB, x + 12.5, 4 + (H - 4) / 2, z2);
    // северная и боковые
    wallX(z1, x1, x2, H, MT.wallB, 4);
    wallZ(x1, z1, z2, H, MT.wallB, 4);
    wallZ(x2, z1, z2, H, MT.wallB, 4);

    // ── витражи фасада (над входами, во всю высоту) ──
    [-21.25, -12.5, 0, 12.5, 21.25].forEach(function (dx) {
      var gl = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 9), MT.glass);
      gl.position.set(x + dx, 7.6, z2 + 0.32);
      gl.rotation.y = Math.PI;
      G.add(gl);
    });
    // дверь-вертушка (визуал) в центральном входе
    box(5.6, 0.14, 2.2, MT.stone, x, 0.07, z2 + 1.4);

    // ── крыша ──
    var roof = new THREE.Mesh(new THREE.BoxGeometry(W + 2, 0.7, D + 2), MT.wallB);
    roof.position.set(x, H + 0.35, z);
    G.add(roof);
    // стеклянный купол-атриум
    var dome = new THREE.Mesh(new THREE.SphereGeometry(9, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0xbfe8f8, transparent: true, opacity: 0.45, emissive: 0x1c3a4a, emissiveIntensity: 0.4 }));
    dome.position.set(x, H, z + 4);
    G.add(dome);
    var drum = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 1.2, 14, 1, true), MT.metal);
    drum.position.set(x, H - 0.6, z + 4);
    G.add(drum);
    // вывески
    sign('GRAND PLAZA MALL', '#40ffdd', 34, x, 11.4, z2 + 0.4);
    sign('КИНОТЕАТР «ЛУНА»', '#ff4080', 18, x - 24, 9.4, z2 + 0.4);
    sign('FOOD COURT', '#ffd040', 14, x + 26, 9.4, z2 + 0.4);
    // неоновая кромка крыши
    box(W + 2.2, 0.34, 0.34, MT.neonB, x, H + 0.8, z2 + 1);
    box(W + 2.2, 0.34, 0.34, MT.neonB, x, H + 0.8, z1 - 1);
    box(0.34, 0.34, D + 2.2, MT.neonB, x1 - 1, H + 0.8, z);
    box(0.34, 0.34, D + 2.2, MT.neonB, x2 + 1, H + 0.8, z);

    // ── пол ── плитка + центральная звезда ──
    var fl = new THREE.Mesh(new THREE.PlaneGeometry(W - 2, D - 2), MT.tile);
    fl.rotation.x = -Math.PI / 2;
    fl.position.set(x, 0.06, z);
    G.add(fl);
    var star = new THREE.Mesh(new THREE.CircleGeometry(7.5, 8), MT.carpet);
    star.rotation.x = -Math.PI / 2;
    star.position.set(x, 0.08, z + 4);
    G.add(star);

    // ── атриум: фонтан + пальмы + свет ──
    var ap = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, 0.7, 14), MT.stone);
    ap.position.set(x, 0.4, z + 4);
    G.add(ap);
    var aw = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.35, 0.5, 14), MT.water);
    aw.position.set(x, 0.72, z + 4);
    G.add(aw);
    var ac = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 2, 8), MT.stone);
    ac.position.set(x, 1.6, z + 4);
    G.add(ac);
    var ab = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 7), MT.white);
    ab.position.set(x, 3, z + 4);
    G.add(ab);
    circ(x, z + 4, 3);
    // пальмы в кадках
    [[-12, 12], [12, 12], [-12, -6], [12, -6]].forEach(function (p) {
      var pot = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.6, 0.8, 9), MT.red);
      pot.position.set(x + p[0], 0.4, z + p[1]);
      G.add(pot);
      var tr = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 2.6, 7), MT.trunk);
      tr.position.set(x + p[0], 2, z + p[1]);
      G.add(tr);
      for (var f = 0; f < 6; f++) {
        var a = f / 6 * Math.PI * 2;
        var leaf = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 0.5), MT.leaf);
        leaf.position.set(x + p[0] + Math.cos(a) * 0.95, 3.3, z + p[1] + Math.sin(a) * 0.95);
        leaf.rotation.y = -a;
        leaf.rotation.z = 0.45;
        G.add(leaf);
      }
      circ(x + p[0], z + p[1], 0.8);
    });
    var al = new THREE.PointLight(0xfff2d8, 0.85, 30, 1.6);
    al.position.set(x, 10, z + 4);
    G.add(al);

    // ── торговый ряд (западное крыло): 5 бутиков ──
    var shops = [
      { n: 'STYLE',     c: '#c060ff', z: z + 14 },
      { n: 'TECH WORLD', c: '#40b0ff', z: z + 8 },
      { n: 'SNEAKERS',  c: '#50ff90', z: z + 2 },
      { n: 'TOYS',      c: '#ffd040', z: z - 4 },
      { n: 'JEWEL',     c: '#ffe060', z: z - 10 }
    ];
    shops.forEach(function (s, i) {
      var sx = x - 22;
      // задняя стенка бутика + боковые
      wallX(s.z - 2.6, sx - 5, sx + 5, 4.2, MT.wallA, 0);
      wallZ(sx - 5, s.z - 2.6, s.z + 2.6, 4.2, MT.wallA, 0);
      wallZ(sx + 5, s.z - 2.6, s.z + 2.6, 4.2, MT.wallA, 3);
      // вывеска
      sign(s.n, s.c, 8, sx, 4.4, s.z + 2.7);
      // полоска-вход
      var carpet = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.2), MT.carpet);
      carpet.rotation.x = -Math.PI / 2;
      carpet.position.set(sx, 0.09, s.z + 3.8);
      G.add(carpet);
      // содержимое: стойки и полки
      var cnt = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.05, 0.9), MT.white);
      cnt.position.set(sx - 3, 0.55, s.z - 1.2);
      G.add(cnt);
      circ(sx - 3, s.z - 1.2, 1.4);
      var shelf = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.4, 4.4), MT.wood);
      shelf.position.set(sx - 4.4, 1.7, s.z + 0.4);
      G.add(shelf);
      circ(sx - 4.4, s.z + 0.4, 0.9);
      // товары-кубики на полке
      for (var it = 0; it < 5; it++) {
        var cObj = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24),
          new THREE.MeshLambertMaterial({ color: [0xff6080, 0x60c0ff, 0xffd040, 0x70ff90, 0xc060ff][it] }));
        cObj.position.set(sx - 4.05, 0.9 + it * 0.62, s.z - 1.4 + it * 0.75);
        G.add(cObj);
      }
      // манекен
      var mq = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 1.5, 8), MT.white);
      mq.position.set(sx + 3.4, 0.75, s.z - 0.6);
      G.add(mq);
      var mh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 7, 6), MT.white);
      mh.position.set(sx + 3.4, 1.7, s.z - 0.6);
      G.add(mh);
      circ(sx + 3.4, s.z - 0.6, 0.5);
      if (typeof interactables !== 'undefined' && interactables.push) {
        interactables.push({ position: { x: sx, y: 0, z: s.z + 3 }, type: 'city3_shop', name: '🛍 ' + s.n, range: 3.5 });
      }
    });

    // ── фудкорт (восточное крыло): 4 точки + столики ──
    var foods = [
      { n: 'BURGER KING++', c: '#ff6040', z: z + 13 },
      { n: 'SUSHI',         c: '#ff4080', z: z + 6 },
      { n: 'PIZZA',         c: '#ffd040', z: z - 1 },
      { n: 'COFFEE',        c: '#c09060', z: z - 8 }
    ];
    foods.forEach(function (s) {
      var fx2 = x + 22;
      wallX(s.z - 2.8, fx2 - 5, fx2 + 5, 4, MT.cream, 0);
      wallZ(fx2 - 5, s.z - 2.8, s.z + 2.8, 4, MT.cream, 0);
      wallZ(fx2 + 5, s.z - 2.8, s.z + 2.8, 4, MT.cream, 3);
      sign(s.n, s.c, 8, fx2, 4.2, s.z + 2.9);
      // стойка раздачи
      var bar = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.1, 1.1), MT.red);
      bar.position.set(fx2 - 1, 0.55, s.z - 1.4);
      G.add(bar);
      circ(fx2 - 1, s.z - 1.4, 2.2);
      // меню-доска
      var mb = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 0.12), MT.dark);
      mb.position.set(fx2 - 4.7, 2.4, s.z - 1.9);
      mb.rotation.y = Math.PI / 2;
      G.add(mb);
      if (typeof interactables !== 'undefined' && interactables.push) {
        interactables.push({ position: { x: fx2, y: 0, z: s.z + 3.2 }, type: 'city3_food', name: '🍔 ' + s.n, range: 3.5 });
      }
    });
    // столики фудкорта
    for (var t = 0; t < 6; t++) {
      var tx = x + 10 + (t % 3) * 6.5;
      var tz = z + 4 + Math.floor(t / 3) * 7 - 3;
      var tbl = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.1, 10), MT.white);
      tbl.position.set(tx, 0.95, tz);
      G.add(tbl);
      var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 0.95, 7), MT.metal);
      leg.position.set(tx, 0.48, tz);
      G.add(leg);
      circ(tx, tz, 1.1);
      // стулья
      [[0, 1.35], [0, -1.35], [1.35, 0], [-1.35, 0]].forEach(function (st) {
        var ch = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.55, 8), MT.blue);
        ch.position.set(tx + st[0], 0.28, tz + st[1]);
        G.add(ch);
      });
      // поднос
      var tray = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.36), MT.red);
      tray.position.set(tx + 0.2, 1.02, tz + 0.1);
      tray.rotation.y = 0.4;
      G.add(tray);
    }

    // ── эскалаторы-декорация (по бокам атриума, закрыты) ──
    [-14, 14].forEach(function (dx) {
      var es = new THREE.Group();
      es.position.set(x + dx, 0, z + 10);
      var frame = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1, 12), MT.metal);
      frame.position.y = 0.5;
      es.add(frame);
      for (var st = 0; st < 12; st++) {
        var step = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.18, 0.8), MT.dark);
        step.position.set(0, 1.05 + st * 0.42, -5.2 + st * 0.95);
        es.add(step);
      }
      var hb = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 12), MT.glass);
      hb.position.set(-1, 1.9, 0);
      es.add(hb);
      var hb2 = hb.clone();
      hb2.position.x = 1;
      es.add(hb2);
      G.add(es);
      sign('2 ЭТАЖ — СКОРО', '#8888aa', 4, x + dx, 5.2, z + 16.2);
      circ(x + dx, z + 10, 1.6);
    });

    // интеракция входа
    if (typeof interactables !== 'undefined' && interactables.push) {
      interactables.push({ position: { x: x, y: 0, z: z2 + 2.5 }, type: 'city3_mall', name: '🏬 GRAND PLAZA MALL', range: 5 });
    }
    // свет внутри
    var fl1 = new THREE.PointLight(0xfff0d0, 0.7, 34, 1.7);
    fl1.position.set(x - 18, 8, z);
    G.add(fl1);
    var fl2 = new THREE.PointLight(0xfff0d0, 0.7, 34, 1.7);
    fl2.position.set(x + 18, 8, z);
    G.add(fl2);
  }

  // ═══════════════ КИНОТЕАТР «ЛУНА» (западное крыло ТЦ, отдельно) ═══════════════
  var CIN = { x: -38, z: -36, w: 40, d: 30, h: 9 };

  function buildCinema() {
    var x = CIN.x, z = CIN.z, W = CIN.w, D = CIN.d, H = CIN.h;
    var x1 = x - W / 2, x2 = x + W / 2, z1 = z - D / 2, z2 = z + D / 2;
    // корпус
    wallX(z2, x1, x2, H, MT.brick, 5);
    wallX(z1, x1, x2, H, MT.brick, 0);
    wallZ(x1, z1, z2, H, MT.brick, 0);
    wallZ(x2, z1, z2, H, MT.brick, 0);
    // крыша-башня
    var roof = new THREE.Mesh(new THREE.BoxGeometry(W + 2, 0.6, D + 2), MT.dark);
    roof.position.set(x, H + 0.3, z);
    G.add(roof);
    var tower = new THREE.Mesh(new THREE.BoxGeometry(6, 3.4, 4), MT.brick);
    tower.position.set(x, H + 2, z2 - 2);
    G.add(tower);
    sign('КИНО «ЛУНА»', '#ff4080', 12, x, H + 2, z2 + 0.1);
    sign('СЕАНСЫ 10:00 — 24:00', '#ffd040', 10, x, 4.9, z2 + 0.35);
    // фасад-витраж
    var gl = new THREE.Mesh(new THREE.PlaneGeometry(W - 8, 5), MT.glass);
    gl.position.set(x, 3.4, z2 + 0.3);
    gl.rotation.y = Math.PI;
    G.add(gl);
    // козырёк с лампами
    var aw = box(14, 0.3, 3.4, MT.red, x, 4.6, z2 + 1.6);
    aw.rotation.x = 0.12;
    for (var l = 0; l < 7; l++) {
      var lb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), MT.neonY);
      lb.position.set(x - 6 + l * 2, 4.85, z2 + 2.9);
      G.add(lb);
    }
    // красная дорожка входа
    var carp = new THREE.Mesh(new THREE.PlaneGeometry(5, 6), MT.carpet);
    carp.rotation.x = -Math.PI / 2;
    carp.position.set(x, 0.07, z2 + 3.5);
    G.add(carp);
    // фонари у входа
    lamp(x - 5, z2 + 4);
    lamp(x + 5, z2 + 4);

    // ── вестибюль ──
    var fl = new THREE.Mesh(new THREE.PlaneGeometry(W - 2, D - 2), MT.carpet);
    fl.rotation.x = -Math.PI / 2;
    fl.position.set(x, 0.06, z);
    G.add(fl);
    // касса
    var kassa = new THREE.Mesh(new THREE.BoxGeometry(5, 1.1, 1.4), MT.wood);
    kassa.position.set(x - 8, 0.55, z2 - 5);
    G.add(kassa);
    circ(x - 8, z2 - 5, 2.6);
    var kglass = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.7, 0.08), MT.glass);
    kglass.position.set(x - 8, 1.6, z2 - 4.5);
    G.add(kglass);
    sign('КАССА', '#ffd040', 3.6, x - 8, 2.3, z2 - 4.4);
    // попкорн- стойка
    var pm = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1, 1.1), MT.red);
    pm.position.set(x + 7, 0.5, z2 - 5);
    G.add(pm);
    circ(x + 7, z2 - 5, 1.9);
    // машина попкорна (стеклянный куб + красно-белый тент)
    var pc = new THREE.Mesh(new THREE.BoxGeometry(1, 1.2, 1), MT.glass);
    pc.position.set(x + 7, 1.65, z2 - 5);
    G.add(pc);
    var pp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 7), new THREE.MeshBasicMaterial({ color: 0xfff2c8 }));
    pp.position.set(x + 7, 2.4, z2 - 5);
    G.add(pp);
    // стаканы на стойке
    [[-1, 0], [0, 0.2], [1, -0.1]].forEach(function (c) {
      var cup = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.4, 8), MT.red);
      cup.position.set(x + 6.2 + c[0], 1.2, z2 - 5 + c[1]);
      G.add(cup);
    });
    sign('ПОПКОРН', '#ff6040', 3.2, x + 7, 3.1, z2 - 4.3);

    // афиши на стенах вестибюля
    var posters = [
      ['КОСМОС 3000', '#40b0ff'], ['ЛЮБОВЬ И НЕОН', '#ff60a0'],
      ['ДРАКОН ГОРОДА', '#50ff90'], ['УЖАС ПОДЗЕМЕЛЬЯ', '#ff4040'],
      ['СМЕШНЫЕ КОТЫ', '#ffd040']
    ];
    posters.forEach(function (p, i) {
      var px = x1 + 4 + i * 7.5;
      // рама
      var fr = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3.8, 0.14), MT.dark);
      fr.position.set(px, 2.6, z2 - 0.5);
      G.add(fr);
      // полотно афиши
      var pc2 = document.createElement('canvas');
      pc2.width = 128; pc2.height = 176;
      var q2 = pc2.getContext('2d');
      var gr2 = q2.createLinearGradient(0, 0, 0, 176);
      gr2.addColorStop(0, p[1]);
      gr2.addColorStop(1, '#101018');
      q2.fillStyle = gr2;
      q2.fillRect(0, 0, 128, 176);
      q2.fillStyle = 'rgba(255,255,255,.85)';
      q2.font = '900 17px Arial';
      q2.textAlign = 'center';
      q2.fillText(p[0].split(' ')[0], 64, 84);
      if (p[0].split(' ')[1]) q2.fillText(p[0].split(' ')[1], 64, 106);
      q2.font = '700 11px Arial';
      q2.fillStyle = p[1];
      q2.fillText('БИЛЕТЫ В КАССЕ', 64, 158);
      var pt = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.3),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(pc2) }));
      pt.position.set(px, 2.6, z2 - 0.42);
      pt.rotation.y = Math.PI;
      G.add(pt);
    });

    // ── два зала (перегородка по центру, входы с вестибюля) ──
    // внутренняя стена-разделитель с проходами
    wallZ(x, z1 + 1, z2 - 8, H, MT.dark, 3);
    [-1, 1].forEach(function (s, hi) {
      var hx = x + s * 10;
      // экран
      var scr = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), MT.screen);
      scr.position.set(hx, 3.6, z1 + 1.2);
      scr.rotation.y = 0;
      G.add(scr);
      // «кадр фильма» на экране
      var fc = document.createElement('canvas');
      fc.width = 256; fc.height = 112;
      var fq = fc.getContext('2d');
      fq.fillStyle = '#0a0e18';
      fq.fillRect(0, 0, 256, 112);
      // силуэт города и луна
      fq.fillStyle = '#ffd870';
      fq.beginPath(); fq.arc(190, 30, 14, 0, 6.3); fq.fill();
      fq.fillStyle = '#1c2438';
      for (var b = 0; b < 9; b++) {
        var bw = 18 + (b * 37) % 22;
        fq.fillRect(b * 29, 112 - (30 + (b * 53) % 55), bw, 90);
      }
      fq.fillStyle = '#7aa0ff';
      fq.font = '900 20px Arial';
      fq.fillText(s < 0 ? 'КОСМОС 3000' : 'ДРАКОН ГОРОДА', 30, 40);
      var ftex = new THREE.CanvasTexture(fc);
      var frame = new THREE.Mesh(new THREE.PlaneGeometry(13.2, 5.6),
        new THREE.MeshBasicMaterial({ map: ftex }));
      frame.position.set(hx, 3.6, z1 + 1.35);
      G.add(frame);
      // свет экрана
      var sl = new THREE.PointLight(0x8090c0, 0.55, 20, 1.6);
      sl.position.set(hx, 4, z1 + 4);
      G.add(sl);
      // ряды кресел (6 рядов по 7)
      for (var row = 0; row < 6; row++) {
        for (var seat = 0; seat < 7; seat++) {
          var sx2 = hx - 6 + seat * 2;
          var sz2 = z1 + 5 + row * 2.6;
          // подставка-ступень
          var pod = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.24 + row * 0.14, 1.9), MT.dark);
          pod.position.set(sx2, (0.24 + row * 0.14) / 2, sz2);
          G.add(pod);
          // сидушка + спинка
          var st = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.5, 0.65), MT.red);
          st.position.set(sx2, 0.5 + row * 0.14, sz2);
          G.add(st);
          var bk = new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.1, 0.28), MT.red);
          bk.position.set(sx2, 1.2 + row * 0.14, sz2 + 0.75);
          G.add(bk);
          // подстаканник
          if ((row + seat) % 3 === 0) {
            var cp = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.24, 7), MT.blue);
            cp.position.set(sx2 + 0.5, 0.85 + row * 0.14, sz2 + 0.2);
            G.add(cp);
          }
        }
      }
      // проход между рядами — ковер
      var aisle = new THREE.Mesh(new THREE.PlaneGeometry(1.6, D - 10), MT.carpet);
      aisle.rotation.x = -Math.PI / 2;
      aisle.position.set(hx, 0.07, z1 + D / 2 - 3);
      G.add(aisle);
      sign(s < 0 ? 'ЗАЛ 1' : 'ЗАЛ 2', '#ff4080', 3.4, hx, 5.6, z2 - 8.3);
    });
    // интеракции
    if (typeof interactables !== 'undefined' && interactables.push) {
      interactables.push({ position: { x: x, y: 0, z: z2 + 2 }, type: 'city3_cinema', name: '🎬 Кино «ЛУНА»', range: 4 });
      interactables.push({ position: { x: x + 7, y: 0, z: z2 - 4 }, type: 'city3_popcorn', name: '🍿 Попкорн', range: 2.5 });
      interactables.push({ position: { x: x - 8, y: 0, z: z2 - 4 }, type: 'city3_tickets', name: '🎟 Касса', range: 2.5 });
    }
    var cl = new THREE.PointLight(0xffd8b0, 0.6, 26, 1.7);
    cl.position.set(x, 6, z2 - 6);
    G.add(cl);
  }

  // ═══════════════ СТАРЫЙ ГОРОД (юго-запад): дома с интерьерами ═══════════════
  // формат: x, z, поворот(0/1), этажность, enterable
  var HOUSES = [
    { x: -124, z: 55,  f: 2, in: true },
    { x: -109, z: 55,  f: 2, in: false },
    { x: -94,  z: 55,  f: 3, in: true },
    { x: -80,  z: 55,  f: 2, in: false },
    { x: -124, z: 75,  f: 2, in: false },
    { x: -109, z: 75,  f: 2, in: true },
    { x: -94,  z: 75,  f: 2, in: false },
    { x: -80,  z: 75,  f: 3, in: true },
    { x: -124, z: 95,  f: 3, in: false },
    { x: -109, z: 95,  f: 2, in: true },
    { x: -94,  z: 95,  f: 2, in: false },
    { x: -80,  z: 95,  f: 2, in: false }
  ];
  var HW = 11, HD = 9;   // габариты дома

  function houseWalls(hx, hz, floors, enterable, wallMat) {
    var fh = 3.1;
    var H = floors * fh;
    var x1 = hx - HW / 2, x2 = hx + HW / 2;
    var z1 = hz - HD / 2, z2 = hz + HD / 2;
    if (enterable) {
      // стены с дверью на юге и окнами
      wallX(z2, x1, x2, H, wallMat, 1.6);          // фасад с дверью
      wallX(z1, x1, x2, H, wallMat, 0);            // задняя
      wallZ(x1, z1, z2, H, wallMat, 0);            // левая
      wallZ(x2, z1, z2, H, wallMat, 0);            // правая
      // окна-проёмы не делаем — просто светящиеся плоскости снаружи 2 этажа
      for (var f = 1; f < floors; f++) {
        win(x1 - 0.3, 0.9 + f * fh, hz - 2, Math.PI / 2, f % 2 === 0, 1.4, 1.2);
        win(x1 - 0.3, 0.9 + f * fh, hz + 2, Math.PI / 2, f % 2 === 1, 1.4, 1.2);
        win(x2 + 0.3, 0.9 + f * fh, hz - 2, -Math.PI / 2, f % 2 === 1, 1.4, 1.2);
        win(x2 + 0.3, 0.9 + f * fh, hz + 2, -Math.PI / 2, f % 2 === 0, 1.4, 1.2);
      }
    } else {
      // глухой дом — один коллайдер
      var body = new THREE.Mesh(new THREE.BoxGeometry(HW, H, HD), wallMat);
      body.position.set(hx, H / 2, hz);
      G.add(body);
      buildings.push({ mesh: body, x: hx, z: hz, w: HW, d: HD, h: H, name: 'дом', type: 'city3',
        bounds: { minX: x1 - 0.4, maxX: x2 + 0.4, minZ: z1 - 0.4, maxZ: z2 + 0.4 } });
      // окна
      for (var f2 = 0; f2 < floors; f2++) {
        win(hx - 2.2, 1 + f2 * fh, z2 + 0.28, Math.PI, (f2 + 1) % 3 === 0);
        win(hx + 2.2, 1 + f2 * fh, z2 + 0.28, Math.PI, f2 % 2 === 0);
        win(hx - 2.2, 1 + f2 * fh, z1 - 0.28, 0, f2 % 2 === 1);
        win(hx + 2.2, 1 + f2 * fh, z1 - 0.28, 0, (f2 + 2) % 3 === 0);
      }
    }
    // цоколь
    var base = new THREE.Mesh(new THREE.BoxGeometry(HW + 0.5, 0.6, HD + 0.5), MT.stone);
    base.position.set(hx, 0.3, hz);
    G.add(base);
    // двускатная крыша
    var r1 = new THREE.Mesh(new THREE.BoxGeometry(HW + 1, 0.24, HD / 2 + 0.9), MT.roofT);
    r1.position.set(hx, H + 0.8, hz - HD / 4 - 0.4);
    r1.rotation.x = 0.52;
    G.add(r1);
    var r2 = new THREE.Mesh(new THREE.BoxGeometry(HW + 1, 0.24, HD / 2 + 0.9), MT.roofT);
    r2.position.set(hx, H + 0.8, hz + HD / 4 + 0.4);
    r2.rotation.x = -0.52;
    G.add(r2);
    // фронтоны
    [-1, 1].forEach(function (s) {
      var fr = new THREE.Mesh(new THREE.BoxGeometry(HW, 1.3, 0.3), wallMat);
      fr.position.set(hx, H + 0.5, hz + s * (HD / 2));
      G.add(fr);
    });
    // труба
    var chim = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.8), MT.brick);
    chim.position.set(hx + 2.5, H + 1.6, hz - 1);
    G.add(chim);
    // крыльцо
    var por = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.24, 1.5), MT.stone);
    por.position.set(hx, 0.12, hz + HD / 2 + 0.75);
    G.add(por);
    return { x1: x1, x2: x2, z1: z1, z2: z2, H: H };
  }

  // мебель: кровать
  function bed(x, z, ry) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    if (ry) g.rotation.y = ry;
    var fr = new THREE.Mesh(new THREE.BoxGeometry(2, 0.35, 1.15), MT.wood);
    fr.position.y = 0.35;
    g.add(fr);
    var mat2 = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.22, 1), MT.white);
    mat2.position.y = 0.55;
    g.add(mat2);
    var pil = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.9), MT.white);
    pil.position.set(-0.65, 0.58, 0);
    g.add(pil);
    var bl = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 1.02), MT.blue);
    bl.position.set(0.25, 0.58, 0);
    g.add(bl);
    var hd2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1, 1.2), MT.wood);
    hd2.position.set(-1, 0.65, 0);
    g.add(hd2);
    G.add(g);
    circ(x, z, 1.2);
  }
  // мебель: диван + ТВ
  function sofa(x, z, ry) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    if (ry) g.rotation.y = ry;
    var seat = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.5, 0.95), MT.green);
    seat.position.y = 0.42;
    g.add(seat);
    var back = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.9, 0.25), MT.green);
    back.position.set(0, 0.85, -0.4);
    g.add(back);
    [-1, 1].forEach(function (s) {
      var arm = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.75, 0.95), MT.green);
      arm.position.set(s * 1.15, 0.55, 0);
      g.add(arm);
    });
    var cush = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.7), MT.leaf2);
    cush.position.set(-0.4, 0.74, 0.05);
    g.add(cush);
    var cush2 = cush.clone();
    cush2.position.x = 0.45;
    g.add(cush2);
    G.add(g);
    circ(x, z, 1.3);
  }
  function tvSet(x, z, ry) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    if (ry) g.rotation.y = ry;
    var st = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.5), MT.wood);
    st.position.y = 0.25;
    g.add(st);
    var body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.05, 0.14), MT.dark);
    body.position.y = 1.05;
    g.add(body);
    var scr2 = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.85),
      new THREE.MeshBasicMaterial({ color: 0x24405c }));
    scr2.position.set(0, 1.05, 0.09);
    g.add(scr2);
    G.add(g);
    circ(x, z, 0.9);
  }
  // кухня: столешница, плита, холодильник
  function kitchen(x, z, ry) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    if (ry) g.rotation.y = ry;
    // столешница вдоль стены
    var counter = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, 0.7), MT.cream);
    counter.position.set(0, 0.45, 0);
    g.add(counter);
    var top = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.08, 0.78), MT.stone);
    top.position.set(0, 0.93, 0);
    g.add(top);
    // плита
    var stove = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.06, 0.66), MT.dark);
    stove.position.set(-1, 0.97, 0);
    g.add(stove);
    [[-1.2, -0.15], [-0.85, 0.18]].forEach(function (b2) {
      var burner = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 8), MT.metal);
      burner.position.set(b2[0], 1.01, b2[1]);
      g.add(burner);
    });
    // мойка
    var sink = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.5), MT.metal);
    sink.position.set(0.9, 0.93, 0);
    g.add(sink);
    // холодильник
    var fridge = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.9, 0.75), MT.white);
    fridge.position.set(2.4, 0.95, 0);
    g.add(fridge);
    var handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.06), MT.metal);
    handle.position.set(2.05, 1.2, 0.4);
    g.add(handle);
    // полки с банками
    var sh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.4), MT.wood);
    sh.position.set(0, 1.6, -0.1);
    g.add(sh);
    for (var j = 0; j < 4; j++) {
      var jar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.22, 7),
        new THREE.MeshLambertMaterial({ color: [0xc06040, 0x60a050, 0xd8b040, 0x8060a0][j] }));
      jar.position.set(-0.55 + j * 0.38, 1.74, -0.05);
      g.add(jar);
    }
    G.add(g);
    circ(x + 1, z, 2);
  }
  // стол со стульями
  function dinnerTable(x, z) {
    var t = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.09, 1.1), MT.wood2);
    t.position.set(x, 0.85, z);
    G.add(t);
    [[-0.7, -0.45], [0.7, -0.45], [-0.7, 0.45], [0.7, 0.45]].forEach(function (l) {
      var leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.85, 0.09), MT.wood);
      leg.position.set(x + l[0], 0.42, z + l[1]);
      G.add(leg);
    });
    // ваза
    var v = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.24, 8), MT.blue);
    v.position.set(x, 1.02, z);
    G.add(v);
    circ(x, z, 1.1);
    [[0, 1], [0, -1]].forEach(function (s) {
      var ch = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 0.45), MT.wood2);
      ch.position.set(x, 0.6, z + s[0] * 0.9);
      G.add(ch);
      var bl2 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.6, 0.07), MT.wood2);
      bl2.position.set(x, 0.95, z + s[0] * 1.1);
      G.add(bl2);
    });
  }
  // шкаф + ковёр + торшер
  function wardrobe(x, z, ry) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    if (ry) g.rotation.y = ry;
    var w2 = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.2, 0.65), MT.wood);
    w2.position.y = 1.1;
    g.add(w2);
    [-0.42, 0.42].forEach(function (d) {
      var door = new THREE.Mesh(new THREE.BoxGeometry(0.78, 2, 0.06), MT.wood2);
      door.position.set(d, 1.1, 0.34);
      g.add(door);
      var knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), MT.metal);
      knob.position.set(d + (d > 0 ? -0.3 : 0.3), 1.1, 0.4);
      g.add(knob);
    });
    G.add(g);
    circ(x, z, 1.1);
  }
  function rug(x, z, w, d, color) {
    var r = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
      new THREE.MeshLambertMaterial({ color: color || 0x8a4a3a }));
    r.rotation.x = -Math.PI / 2;
    r.position.set(x, 0.1, z);
    G.add(r);
  }
  function floorLamp(x, z) {
    var p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.16, 1.7, 7), MT.metal);
    p.position.set(x, 0.85, z);
    G.add(p);
    var sh2 = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.4, 9, 1, true), MT.cream);
    sh2.position.set(x, 1.8, z);
    G.add(sh2);
    circ(x, z, 0.35);
  }

  function buildHouses() {
    HOUSES.forEach(function (h, hi) {
      var wallMat = hi % 3 === 0 ? MT.wallA : (hi % 3 === 1 ? MT.brick : MT.cream);
      var r = houseWalls(h.x, h.z, h.f, h.in, wallMat);
      // интерьер первого этажа
      if (h.in) {
        // пол
        var fl = new THREE.Mesh(new THREE.PlaneGeometry(HW - 1.2, HD - 1.2), MT.plank);
        fl.rotation.x = -Math.PI / 2;
        fl.position.set(h.x, 0.09, h.z);
        G.add(fl);
        // потолок (низкий)
        var ceil = new THREE.Mesh(new THREE.PlaneGeometry(HW - 1.2, HD - 1.2), MT.cream);
        ceil.rotation.x = Math.PI / 2;
        ceil.position.set(h.x, 2.9, h.z);
        G.add(ceil);
        // дверь
        var door = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.4, 0.1), MT.wood);
        door.position.set(h.x, 1.2, r.z2 - 0.3);
        G.add(door);
        // обстановка по вариантам
        if (hi % 4 === 0) {
          // спальня
          rug(h.x, h.z - 1, 3.4, 2.4, 0x6a3a5a);
          bed(h.x - 2.6, h.z - 1.5, Math.PI / 2);
          wardrobe(h.x + 3.2, h.z - 2.6, Math.PI);
          floorLamp(h.x + 3.4, h.z + 2.4);
          dinnerTable(h.x + 1.2, h.z + 2);
        } else if (hi % 4 === 1) {
          // гостиная
          rug(h.x, h.z, 4, 3, 0x3a5a4a);
          sofa(h.x, h.z - 1.8, 0);
          tvSet(h.x, h.z + 2.8, Math.PI);
          dinnerTable(h.x - 2.8, h.z + 2);
          floorLamp(h.x + 3.6, h.z - 2.6);
        } else if (hi % 4 === 2) {
          // квартира-студия
          kitchen(h.x - 2, r.z1 + 1.1, 0);
          dinnerTable(h.x + 2, h.z + 1.5);
          sofa(h.x + 2.4, r.z1 + 1.6, Math.PI);
          bed(h.x - 3, h.z + 2.6, Math.PI / 2);
        } else {
          // мансарда-мастерская
          rug(h.x, h.z, 3.6, 2.6, 0x5a4a3a);
          dinnerTable(h.x, h.z);
          wardrobe(h.x - 3.4, h.z - 2.4, 0);
          floorLamp(h.x + 3.5, h.z - 2.5);
          bed(h.x + 2.6, h.z + 2.6, -Math.PI / 2);
        }
        // внутренняя лампа
        var il = new THREE.PointLight(0xffd9a0, 0.6, 12, 1.7);
        il.position.set(h.x, 2.4, h.z);
        G.add(il);
        if (typeof interactables !== 'undefined' && interactables.push) {
          interactables.push({ position: { x: h.x, y: 0, z: r.z2 + 1.2 }, type: 'city3_house', name: '🏠 Дом ' + (hi + 1) + ' (открыт)', range: 3 });
        }
      } else {
        if (typeof interactables !== 'undefined' && interactables.push) {
          interactables.push({ position: { x: h.x, y: 0, z: r.z2 + 1.2 }, type: 'city3_house', name: '🏠 Дом ' + (hi + 1), range: 3 });
        }
      }
      // куст у крыльца
      bush(h.x - HW / 2 - 0.7, r.z2 + 0.8, 0.9);
      bush(h.x + HW / 2 + 0.7, r.z2 + 0.8, 0.8);
      // фонарь у каждых вторых
      if (hi % 2 === 0) lamp(h.x + HW / 2 + 2.4, r.z2 + 1.8);
    });
    // деревья между домами
    [[-116, 65], [-101, 65], [-87, 65], [-116, 85], [-101, 85], [-87, 85], [-116, 105], [-101, 105]].forEach(function (p) {
      tree(p[0], p[1], 0.95);
    });
  }

  // ═══════════════ УЛИЦА МАГАЗИНОВ (восток) ═══════════════
  var STREET = [
    { n: 'ПИЦЦЕРИЯ',   c: '#ff5060', x: 45, in: true },
    { n: '24 ЧАСА',    c: '#50ff90', x: 58, in: true },
    { n: 'ЭЛЕКТРОНИКА',c: '#40b0ff', x: 71, in: false },
    { n: 'ЦВЕТЫ',      c: '#ff8ac0', x: 84, in: true },
    { n: 'КНИГИ',      c: '#ffd040', x: 45, in: false },
    { n: 'СПОРТ',      c: '#ff8040', x: 58, in: false },
    { n: 'ЗОЛОТО',     c: '#ffe060', x: 71, in: false },
    { n: 'АПТЕКА',     c: '#40ffa0', x: 84, in: false }
  ];
  function buildShoppingStreet() {
    STREET.forEach(function (s, i) {
      var north = i < 4;                  // первый ряд у z=8
      var z = north ? 8 : 34;
      var w = 11, d = 9, h = i % 2 ? 5 : 6.5;
      var mat = i % 3 === 0 ? MT.wallA : (i % 3 === 1 ? MT.wallB : MT.brick);
      if (s.in) {
        var x1 = s.x - w / 2, x2 = s.x + w / 2, z1 = z - d / 2, z2 = z + d / 2;
        wallX(z2, x1, x2, h, mat, 2.2);   // витрина-вход
        wallX(z1, x1, x2, h, mat, 0);
        wallZ(x1, z1, z2, h, mat, 0);
        wallZ(x2, z1, z2, h, mat, 0);
        // пол
        var fl = new THREE.Mesh(new THREE.PlaneGeometry(w - 1, d - 1), MT.tile);
        fl.rotation.x = -Math.PI / 2;
        fl.position.set(s.x, 0.09, z);
        G.add(fl);
        // потолок
        var cl = new THREE.Mesh(new THREE.PlaneGeometry(w - 1, d - 1), MT.white);
        cl.rotation.x = Math.PI / 2;
        cl.position.set(s.x, h - 0.5, z);
        G.add(cl);
        // касса
        var cnt = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1, 0.9), MT.wood2);
        cnt.position.set(s.x - 2.6, 0.5, z2 - 2);
        G.add(cnt);
        circ(s.x - 2.6, z2 - 2, 1.3);
        var reg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.4), MT.dark);
        reg.position.set(s.x - 2.2, 1.16, z2 - 2);
        G.add(reg);
        // стеллажи
        for (var sh = 0; sh < 2; sh++) {
          var shelf = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.6, 5), MT.wood);
          shelf.position.set(x1 + 1.6 + sh * 2.2, 1.3, z - 0.5);
          G.add(shelf);
          circ(x1 + 1.6 + sh * 2.2, z - 0.5, 0.9);
          for (var it = 0; it < 6; it++) {
            var obj = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3),
              new THREE.MeshLambertMaterial({ color: [0xff6080, 0x60c0ff, 0xffd040, 0x70ff90, 0xc060ff, 0xff9060][it] }));
            obj.position.set(x1 + 1.6 + sh * 2.2, 0.7 + Math.floor(it / 2) * 0.75, z - 2.6 + (it % 2) * 1.6);
            G.add(obj);
          }
        }
        // холодильник-витрина у стены
        var cooler = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.9, 2.6), MT.glass);
        cooler.position.set(x2 - 1, 0.95, z - 1);
        G.add(cooler);
        circ(x2 - 1, z - 1, 1);
        // свет
        var il = new THREE.PointLight(0xfff0d0, 0.55, 13, 1.7);
        il.position.set(s.x, h - 1.2, z);
        G.add(il);
      } else {
        var body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        body.position.set(s.x, h / 2, z);
        G.add(body);
        buildings.push({ mesh: body, x: s.x, z: z, w: w, d: d, h: h, name: s.n, type: 'city3',
          bounds: { minX: s.x - w / 2 - 0.4, maxX: s.x + w / 2 + 0.4, minZ: z - d / 2 - 0.4, maxZ: z + d / 2 + 0.4 } });
        win(s.x - 2.5, 1.6, z + d / 2 + 0.28, Math.PI, true, 2, 1.6);
        win(s.x + 2.5, 1.6, z + d / 2 + 0.28, Math.PI, false, 2, 1.6);
      }
      // вывеска + навес
      sign(s.n, s.c, 9, s.x, h - 1, z + d / 2 + 0.35);
      var awn = new THREE.Mesh(new THREE.BoxGeometry(w - 1, 0.2, 2), [MT.awnR, MT.awnG, MT.awnB, MT.awnY][i % 4]);
      awn.position.set(s.x, 3.2, z + d / 2 + 1);
      awn.rotation.x = 0.2;
      G.add(awn);
      lamp(s.x + w / 2 + 1.6, z + d / 2 + 2);
      bin(s.x - w / 2 - 1, z + d / 2 + 1.6);
      if (typeof interactables !== 'undefined' && interactables.push) {
        interactables.push({ position: { x: s.x, y: 0, z: z + d / 2 + 2 }, type: 'city3_shop', name: '🏪 ' + s.n, range: 3.5 });
      }
    });
    // деревья по улице
    for (var t2 = 0; t2 < 5; t2++) tree(39 + 0, 8 + t2 * 6.5 - 12, 0.9);
  }

  // ═══════════════ КАФЕШКИ (юго-восток) ═══════════════
  var CAFES = [
    { n: 'КАФЕ «ОБЛАКО»', x: 50, z: 75, c: '#ffd040', in: true },
    { n: 'КОФЕ «ТРУПЕР»', x: 68, z: 75, c: '#ff8040', in: true },
    { n: 'ГРИЛЬ «БАЛКАН»', x: 86, z: 75, c: '#ff5060', in: false }
  ];
  function buildCafes() {
    CAFES.forEach(function (cf, ci) {
      var w = 12, d = 10, h = 4.4;
      if (cf.in) {
        var x1 = cf.x - w / 2, x2 = cf.x + w / 2, z1 = cf.z - d / 2, z2 = cf.z + d / 2;
        wallX(z2, x1, x2, h, MT.cream, 2.4);
        wallX(z1, x1, x2, h, MT.cream, 0);
        wallZ(x1, z1, z2, h, MT.cream, 0);
        wallZ(x2, z1, z2, h, MT.cream, 0);
        // пол-шахматка
        var fl = new THREE.Mesh(new THREE.PlaneGeometry(w - 1, d - 1), MT.tile);
        fl.rotation.x = -Math.PI / 2;
        fl.position.set(cf.x, 0.09, cf.z);
        G.add(fl);
        // барная стойка
        var bar = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.1, 0.8), MT.wood);
        bar.position.set(cf.x - 2, 0.55, z2 - 2.4);
        G.add(bar);
        circ(cf.x - 2, z2 - 2.4, 2.4);
        var barTop = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.09, 0.95), MT.dark);
        barTop.position.set(cf.x - 2, 1.13, z2 - 2.4);
        G.add(barTop);
        // кофемашина
        var cm = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.75, 0.6), MT.dark);
        cm.position.set(cf.x - 3.4, 1.55, z2 - 2.4);
        G.add(cm);
        // витрина с тортами
        var vtr = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 0.8), MT.glass);
        vtr.position.set(cf.x + 0.6, 0.55, z2 - 2.4);
        G.add(vtr);
        circ(cf.x + 0.6, z2 - 2.4, 1.2);
        [[-0.5, 0], [0, 0.1], [0.5, -0.1]].forEach(function (ck, k) {
          var cake = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.16, 9),
            new THREE.MeshLambertMaterial({ color: [0xd89058, 0xc06080, 0xe0c080][k] }));
          cake.position.set(cf.x + 0.1 + ck[0], 1.2, z2 - 2.4 + ck[1]);
          G.add(cake);
        });
        // барные стулья
        [-2.8, -1.2, 0.4].forEach(function (sx3) {
          var st = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.75, 8), MT.red);
          st.position.set(cf.x + sx3 + 1, 0.38, z2 - 3.6);
          G.add(st);
          circ(cf.x + sx3 + 1, z2 - 3.6, 0.4);
        });
        // столики внутри
        for (var t3 = 0; t3 < 3; t3++) {
          var tx = x1 + 2.6;
          var tz = z1 + 2 + t3 * 2.6;
          var tb = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.09, 9), MT.white);
          tb.position.set(tx, 0.92, tz);
          G.add(tb);
          var lg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.92, 7), MT.metal);
          lg.position.set(tx, 0.46, tz);
          G.add(lg);
          circ(tx, tz, 0.9);
          [[1.1, 0], [-1.1, 0]].forEach(function (st2) {
            var ch = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.85, 0.45), ci ? MT.blue : MT.green);
            ch.position.set(tx + st2[0], 0.42, tz + st2[1]);
            G.add(ch);
          });
          // чашка
          var cup = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.12, 7), MT.white);
          cup.position.set(tx + 0.15, 1.03, tz);
          G.add(cup);
        }
        var il = new THREE.PointLight(0xffe8c0, 0.6, 14, 1.7);
        il.position.set(cf.x, h - 1, cf.z);
        G.add(il);
      } else {
        var body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), MT.brick);
        body.position.set(cf.x, h / 2, cf.z);
        G.add(body);
        buildings.push({ mesh: body, x: cf.x, z: cf.z, w: w, d: d, h: h, name: cf.n, type: 'city3',
          bounds: { minX: cf.x - w / 2 - 0.4, maxX: cf.x + w / 2 + 0.4, minZ: cf.z - d / 2 - 0.4, maxZ: cf.z + d / 2 + 0.4 } });
        win(cf.x, 1.7, cf.z + d / 2 + 0.28, Math.PI, true, 3.4, 1.7);
      }
      // крыша-гриб и вывеска
      var roof2 = new THREE.Mesh(new THREE.ConeGeometry(w / 2 + 0.8, 1.5, 8), MT.roofT);
      roof2.position.set(cf.x, h + 0.75, cf.z);
      G.add(roof2);
      sign(cf.n, cf.c, 9.5, cf.x, 3.4, cf.z + d / 2 + 0.32);
      // уличные столики с зонтами
      for (var u2 = 0; u2 < 3; u2++) {
        var ux = cf.x - 4 + u2 * 4;
        var uz = cf.z + d / 2 + 3.4;
        var tb2 = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.08, 9), MT.white);
        tb2.position.set(ux, 0.9, uz);
        G.add(tb2);
        var lg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.9, 7), MT.metal);
        lg2.position.set(ux, 0.45, uz);
        G.add(lg2);
        var pole2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), MT.metal);
        pole2.position.set(ux, 1.1, uz);
        G.add(pole2);
        var umb = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.7, 9), ci % 2 ? MT.awnR : MT.awnG);
        umb.position.set(ux, 2.3, uz);
        G.add(umb);
        circ(ux, uz, 1);
      }
      if (typeof interactables !== 'undefined' && interactables.push) {
        interactables.push({ position: { x: cf.x, y: 0, z: cf.z + d / 2 + 2 }, type: 'city3_cafe', name: '☕ ' + cf.n, range: 3.5 });
      }
    });
  }

  // ═══════════════ ПАРК С ПРУДОМ (юг) ═══════════════
  function buildPark() {
    var px = 10, pz = 95;
    // пруд
    var pond = new THREE.Mesh(new THREE.CircleGeometry(15, 24), MT.water);
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(px, 0.04, pz);
    G.add(pond);
    var shore = new THREE.Mesh(new THREE.RingGeometry(15, 16.4, 24), MT.pave);
    shore.rotation.x = -Math.PI / 2;
    shore.position.set(px, 0.05, pz);
    G.add(shore);
    // островок
    var isl = new THREE.Mesh(new THREE.CircleGeometry(3.4, 12), MT.grass);
    isl.rotation.x = -Math.PI / 2;
    isl.position.set(px, 0.07, pz);
    G.add(isl);
    tree(px, pz, 1.3);
    // мостик к острову
    for (var b3 = 0; b3 < 6; b3++) {
      var bd = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.85), MT.plank);
      bd.position.set(px - 8 + b3 * 1.35, 0.5, pz - 1);
      G.add(bd);
    }
    [-1.6, 1.6].forEach(function (s) {
      for (var r3 = 0; r3 < 6; r3++) {
        var post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.75, 0.12), MT.wood);
        post.position.set(px - 8 + r3 * 1.35, 0.85, pz - 1 + s);
        G.add(post);
      }
      var rail = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.09, 0.09), MT.wood);
      rail.position.set(px - 4.4, 1.2, pz - 1 + s);
      G.add(rail);
    });
    // дорожки парка (крест)
    var p1 = new THREE.Mesh(new THREE.PlaneGeometry(70, 3.4), MT.pave);
    p1.rotation.x = -Math.PI / 2;
    p1.position.set(px, 0.03, pz - 24);
    G.add(p1);
    var p2 = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 60), MT.pave);
    p2.rotation.x = -Math.PI / 2;
    p2.position.set(px - 26, 0.03, pz - 6);
    G.add(p2);
    // деревья кольцом
    for (var t4 = 0; t4 < 14; t4++) {
      var a4 = t4 / 14 * Math.PI * 2;
      tree(px + Math.cos(a4) * 22, pz + Math.sin(a4) * 20 - 2, 1 + (t4 % 3) * 0.15);
    }
    // кусты и клумбы
    bush(px - 12, pz - 14, 1.1);
    bush(px + 12, pz - 14, 1);
    bush(px - 14, pz + 8, 0.9);
    bush(px + 14, pz + 8, 1.05);
    flowerbed(px - 8, pz - 24);
    flowerbed(px + 8, pz - 24);
    // лавки и фонари у пруда
    bench(px - 5, pz - 18.5, 0);
    bench(px + 5, pz - 18.5, 0);
    bench(px, pz + 19.5, Math.PI);
    lamp(px - 18, pz - 12);
    lamp(px + 18, pz - 12);
    lamp(px, pz + 14);
    bin(px - 3, pz - 20.5);
    // детская площадка
    var pgx = px + 26, pgz = pz - 16;
    // горка
    var slide = new THREE.Mesh(new THREE.BoxGeometry(1, 3.2, 0.16), MT.yellow);
    slide.position.set(pgx, 1.6, pgz + 2);
    slide.rotation.x = 0.7;
    G.add(slide);
    var platform = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.16, 1.6), MT.blue);
    platform.position.set(pgx, 2.7, pgz + 3.4);
    G.add(platform);
    for (var l3 = 0; l3 < 4; l3++) {
      var lg3 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.7, 0.14), MT.metal);
      lg3.position.set(pgx + (l3 % 2 ? 0.6 : -0.6), 1.35, pgz + 3.4 + (l3 < 2 ? 0.6 : -0.6));
      G.add(lg3);
    }
    circ(pgx, pgz + 3.4, 1.2);
    // песочница
    var sand = new THREE.Mesh(new THREE.CircleGeometry(2.4, 12), new THREE.MeshLambertMaterial({ color: 0xd8c090 }));
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(pgx - 3.4, 0.06, pgz - 2);
    G.add(sand);
    var sr = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.22, 7, 14), MT.wood);
    sr.rotation.x = Math.PI / 2;
    sr.position.set(pgx - 3.4, 0.18, pgz - 2);
    G.add(sr);
    circ(pgx - 3.4, pgz - 2, 2.6);
    // качели
    [[-1, 0], [1, 0]].forEach(function (s) {
      var pp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 0.12), MT.metal);
      pp.position.set(pgx + 3 + s[0] * 0.9, 1.3, pgz - 3.4 + s[1]);
      pp.rotation.z = s[0] * 0.35;
      G.add(pp);
    });
    var beam = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 0.12), MT.metal);
    beam.position.set(pgx + 3, 2.55, pgz - 3.4);
    G.add(beam);
    var seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.3), MT.wood);
    seat.position.set(pgx + 3, 0.7, pgz - 3.4);
    G.add(seat);
    [[-0.25, 0], [0.25, 0]].forEach(function (c4) {
      var ch4 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.7, 0.04), MT.metal);
      ch4.position.set(pgx + 3 + c4[0], 1.5, pgz - 3.4 + c4[1]);
      G.add(ch4);
    });
    if (typeof interactables !== 'undefined' && interactables.push) {
      interactables.push({ position: { x: px, y: 0, z: pz - 20 }, type: 'city3_park', name: '🌳 Парк Фантазии', range: 4 });
    }
  }

  // ═══════════════ ЖИЛЫЕ БАШНИ (северо-восток) ═══════════════
  var TOWERS = [
    { x: 70, z: -40, fl: 14, c: 0x8f9aa8 },
    { x: 90, z: -40, fl: 18, c: 0x7f8fa0 },
    { x: 110, z: -40, fl: 12, c: 0x9aa8b8 },
    { x: 70, z: -66, fl: 16, c: 0x8898a8 },
    { x: 90, z: -66, fl: 10, c: 0xa0aebc },
    { x: 110, z: -66, fl: 20, c: 0x78889a }
  ];
  function buildTowers() {
    TOWERS.forEach(function (t5, i) {
      var w = 12, d = 12, fh = 3;
      var H = t5.fl * fh * 0.82;
      var body = new THREE.Mesh(new THREE.BoxGeometry(w, H, d),
        new THREE.MeshLambertMaterial({ color: t5.c }));
      body.position.set(t5.x, H / 2, t5.z);
      G.add(body);
      buildings.push({ mesh: body, x: t5.x, z: t5.z, w: w, d: d, h: H, name: 'Башня ' + (i + 1), type: 'city3',
        bounds: { minX: t5.x - w / 2 - 0.4, maxX: t5.x + w / 2 + 0.4, minZ: t5.z - d / 2 - 0.4, maxZ: t5.z + d / 2 + 0.4 } });
      // крыша-обсерватория на самой высокой
      if (t5.fl >= 18) {
        var boxT = box(4, 2.4, 4, MT.dark, t5.x, H + 1.2, t5.z);
        var ant = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 5, 6), MT.metal);
        ant.position.set(t5.x, H + 4.4, t5.z);
        G.add(ant);
        var beacon = new THREE.Mesh(new THREE.SphereGeometry(0.24, 7, 6), MT.neonR);
        beacon.position.set(t5.x, H + 7, t5.z);
        G.add(beacon);
      }
      // окна сеткой
      for (var f5 = 0; f5 < t5.fl; f5++) {
        for (var c5 = 0; c5 < 3; c5++) {
          var lit = ((i * 7 + f5 * 3 + c5 * 5) % 4) < 2;
          win(t5.x - 3.6 + c5 * 3.6, 1.2 + f5 * fh * 0.82, t5.z + d / 2 + 0.06, 0, lit, 1.8, 1.5);
          win(t5.x - 3.6 + c5 * 3.6, 1.2 + f5 * fh * 0.82, t5.z - d / 2 - 0.06, Math.PI, lit, 1.8, 1.5);
          win(t5.x + w / 2 + 0.06, 1.2 + f5 * fh * 0.82, t5.z - 3.6 + c5 * 3.6, Math.PI / 2, !lit, 1.8, 1.5);
          win(t5.x - w / 2 - 0.06, 1.2 + f5 * fh * 0.82, t5.z - 3.6 + c5 * 3.6, -Math.PI / 2, !lit, 1.8, 1.5);
        }
      }
      // вход-навес
      var ent = box(3.4, 0.2, 2.2, MT.dark, t5.x, 2.9, t5.z + d / 2 + 1);
      lamp(t5.x - 3, t5.z + d / 2 + 2.4);
      bush(t5.x + 4, t5.z + d / 2 + 1.4, 1);
    });
  }

  // ═══════════════ УЛИЧНЫЕ МЕЛОЧИ ═══════════════
  function buildStreetProps() {
    // автобусные остановки вдоль главного проспекта
    [[10, -33, 0], [24, 62, Math.PI], [-56, 6, Math.PI / 2], [88, 6, Math.PI / 2]].forEach(function (s6) {
      var g = new THREE.Group();
      g.position.set(s6[0], 0, s6[1]);
      g.rotation.y = s6[2];
      var roofS = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.16, 2), MT.dark);
      roofS.position.y = 2.7;
      g.add(roofS);
      [-2.5, 2.5].forEach(function (o) {
        var p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.7, 0.12), MT.metal);
        p.position.set(o, 1.35, -0.85);
        g.add(p);
      });
      var backS = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.6, 0.1), MT.glass);
      backS.position.set(0, 1.5, -0.9);
      g.add(backS);
      var benchS = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.1, 0.5), MT.wood);
      benchS.position.set(0, 0.55, -0.55);
      g.add(benchS);
      var sb = sign('АВТОБУС', '#40b0ff', 3.4, 0, 2.95, -0.6);
      sb.position.set(s6[0], 2.95, s6[1] - 0.6);
      G.add(g);
      circ(s6[0], s6[1], 1.6);
    });
    // билборды
    [[-40, -18, 0.4], [64, 40, -0.6], [-104, 108, 2.6]].forEach(function (b6) {
      var p1 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 5, 0.24), MT.metal);
      p1.position.set(b6[0], 2.5, b6[1]);
      G.add(p1);
      var bb = new THREE.Mesh(new THREE.BoxGeometry(7, 3.4, 0.3), MT.dark);
      bb.position.set(b6[0], 6.4, b6[1]);
      bb.rotation.y = b6[2];
      G.add(bb);
      var face = sign('FANTAZIA RP', '#a060ff', 6.6, b6[0], 6.4, b6[1]);
      face.rotation.y = b6[2];
      face.position.y = 6.4;
      circ(b6[0], b6[1], 0.6);
    });
    // киоски
    [[4, -30], [30, -30], [-52, 38]].forEach(function (k6, i) {
      var body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 2.2), [MT.yellow, MT.green, MT.red][i]);
      body.position.set(k6[0], 1.3, k6[1]);
      G.add(body);
      buildings.push({ mesh: body, x: k6[0], z: k6[1], w: 2.6, d: 2.2, h: 2.6, name: 'киоск', type: 'city3',
        bounds: { minX: k6[0] - 1.7, maxX: k6[0] + 1.7, minZ: k6[1] - 1.5, maxZ: k6[1] + 1.5 } });
      var roofK = new THREE.Mesh(new THREE.ConeGeometry(2.2, 0.9, 4), MT.dark);
      roofK.position.set(k6[0], 3, k6[1]);
      roofK.rotation.y = Math.PI / 4;
      G.add(roofK);
      win(k6[0], 1.7, k6[1] + 1.15, 0, true, 1.8, 1);
      if (typeof interactables !== 'undefined' && interactables.push) {
        interactables.push({ position: { x: k6[0], y: 0, z: k6[1] + 1.6 }, type: 'city3_kiosk', name: '🥤 Киоск', range: 2.5 });
      }
    });
  }

  // ═══════════════ ЗАПУСК ═══════════════
  function buildAll() {
    G = new THREE.Group();
    buildTextures();
    buildMaterials();
    buildGround();
    buildRoads();
    buildSpawnPlaza();
    buildMall();
    buildCinema();
    buildHouses();
    buildShoppingStreet();
    buildCafes();
    buildPark();
    buildTowers();
    buildStreetProps();
    scene.add(G);
    window._fzCity3 = { root: G, sprays: fountainSprays };
    console.log('[CITY v2] FANTAZIA CITY построен: зданий в коллизии:', buildings.length,
      '| круговых коллайдеров:', streetColliders.length);
  }

  var iv2 = setInterval(function () {
    if (window.scene && window.THREE && typeof buildings !== 'undefined') {
      clearInterval(iv2);
      try { buildAll(); } catch (e) { console.warn('[CITY3]', e); }
    }
  }, 300);

  // брызги фонтанов — свой тик
  var lastT2 = performance.now();
  function sprayLoop(now) {
    var dt = Math.min((now - lastT2) / 1000, 0.05);
    lastT2 = now;
    if (window._fzCity3) {
      var arr = window._fzCity3.sprays;
      for (var i = 0; i < arr.length; i++) {
        var sp = arr[i], u = sp.userData;
        u.t += dt / u.life;
        if (u.t > 1) u.t -= 1;
        var rr = u.t * u.v * 1.5;
        sp.position.set(17 + Math.cos(u.a) * rr, 4.5 + Math.sin(u.t * Math.PI) * 1.8 - u.t * 1.4, 2 + Math.sin(u.a) * rr);
        sp.material.opacity = Math.sin(u.t * Math.PI) * 0.8;
      }
    }
    requestAnimationFrame(sprayLoop);
  }
  requestAnimationFrame(sprayLoop);
})();
