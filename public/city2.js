// ═══════════════════════════════════════════════════════════
//  FANTAZIA RP — ГОРОД v2: НОВЫЙ РАЙОН «ОБЛАЧНЫЙ»
//  дороги · магазины · кафешки · дома · NEO MALL · парк · фонтан
//  строится один раз, когда сцена готова
// ═══════════════════════════════════════════════════════════
(function () {
  var DX = -100, DZ = 100;   // центр района
  var built = false;

  function tex(w, h, fn) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    fn(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c);
    return t;
  }

  // ── текстуры района ──
  function makeTextures() {
    // асфальт
    var asphalt = tex(128, 128, function (q, w, h) {
      q.fillStyle = '#33363c'; q.fillRect(0, 0, w, h);
      for (var i = 0; i < 900; i++) {
        var g = 40 + Math.random() * 30;
        q.fillStyle = 'rgba(' + g + ',' + g + ',' + (g + 4) + ',.5)';
        q.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    });
    // плитка тротуара
    var pavement = tex(128, 128, function (q, w, h) {
      q.fillStyle = '#6f7278'; q.fillRect(0, 0, w, h);
      q.strokeStyle = '#585b60'; q.lineWidth = 2;
      for (var x = 0; x <= w; x += 32) { q.beginPath(); q.moveTo(x, 0); q.lineTo(x, h); q.stroke(); }
      for (var y = 0; y <= h; y += 32) { q.beginPath(); q.moveTo(0, y); q.lineTo(w, y); q.stroke(); }
    });
    // газон
    var grass = tex(128, 128, function (q, w, h) {
      q.fillStyle = '#3d5a35'; q.fillRect(0, 0, w, h);
      for (var i = 0; i < 700; i++) {
        q.fillStyle = Math.random() > 0.5 ? 'rgba(72,105,60,.6)' : 'rgba(50,80,44,.6)';
        q.fillRect(Math.random() * w, Math.random() * h, 3, 3);
      }
    });
    return { asphalt: asphalt, pavement: pavement, grass: grass };
  }

  // ── материалы ──
  function makeMaterials(TX) {
    var L = function (o) { return new THREE.MeshLambertMaterial(o); };
    return {
      road:   new THREE.MeshLambertMaterial({ map: TX.asphalt }),
      pave:   new THREE.MeshLambertMaterial({ map: TX.pavement }),
      grass:  new THREE.MeshLambertMaterial({ map: TX.grass }),
      line:   new THREE.MeshBasicMaterial({ color: 0xd8d8cc }),
      glass:  new THREE.MeshLambertMaterial({ color: 0x9fd8e8, transparent: true, opacity: 0.55, emissive: 0x1a3844, emissiveIntensity: 0.25 }),
      wallA:  L({ color: 0xb8a288 }),
      wallB:  L({ color: 0x8f9aa8 }),
      wallC:  L({ color: 0xa8876f }),
      wallD:  L({ color: 0x7f8fa0 }),
      wallE:  L({ color: 0xc7b9a2 }),
      roof:   L({ color: 0x5a3f35 }),
      roof2:  L({ color: 0x43506b }),
      wood:   L({ color: 0x7a5233 }),
      wood2:  L({ color: 0x8f6a42 }),
      white:  L({ color: 0xe8e4da }),
      metal:  L({ color: 0x6a7078 }),
      dark:   L({ color: 0x2c2f34 }),
      leaf:   L({ color: 0x3f6b38 }),
      leaf2:  L({ color: 0x4d7a40 }),
      trunk:  L({ color: 0x5b4229 }),
      water:  new THREE.MeshLambertMaterial({ color: 0x4fa8d8, transparent: true, opacity: 0.8, emissive: 0x0a2438, emissiveIntensity: 0.4 }),
      stone:  L({ color: 0x8b8f96 }),
      neonR:  new THREE.MeshBasicMaterial({ color: 0xff4060 }),
      neonB:  new THREE.MeshBasicMaterial({ color: 0x40b0ff }),
      neonG:  new THREE.MeshBasicMaterial({ color: 0x50ff90 }),
      neonY:  new THREE.MeshBasicMaterial({ color: 0xffd040 }),
      neonP:  new THREE.MeshBasicMaterial({ color: 0xc060ff }),
      awnR:   L({ color: 0xc04858 }),
      awnG:   L({ color: 0x3f8f5f }),
      awnB:   L({ color: 0x4f6fc0 })
    };
  }

  function box(w, h, d, mat, x, y, z, ry) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (ry) m.rotation.y = ry;
    return m;
  }

  // ── неоновая вывеска (canvas -> plane) ──
  function sign(text, color, w) {
    var c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    var q = c.getContext('2d');
    q.fillStyle = 'rgba(10,10,18,0.92)';
    q.fillRect(0, 0, 512, 128);
    q.strokeStyle = color; q.lineWidth = 6;
    q.strokeRect(8, 8, 496, 112);
    q.font = '900 64px Arial';
    q.textAlign = 'center'; q.textBaseline = 'middle';
    q.shadowColor = color; q.shadowBlur = 26;
    q.fillStyle = color;
    q.fillText(text, 256, 68);
    var t = new THREE.CanvasTexture(c);
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4),
      new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide }));
    return m;
  }

  // ── ДОРОГИ: сетка 2х2 + разметка + тротуары + зебры ──
  function buildRoads(G, M) {
    var RW = 10; // ширина дороги
    var roadZ = [-18, 18];      // горизонтальные улицы (абсолютный z)
    var roadX = [-148, -52];    // вертикальные проспекты (абсолютный x)
    // покрытие
    roadZ.forEach(function (z) {
      var r = new THREE.Mesh(new THREE.PlaneGeometry(120, RW), M.road);
      r.rotation.x = -Math.PI / 2;
      r.position.set(DX, 0.03, z);
      G.add(r);
    });
    roadX.forEach(function (x) {
      var r = new THREE.Mesh(new THREE.PlaneGeometry(RW, 120), M.road);
      r.rotation.x = -Math.PI / 2;
      r.position.set(x, 0.03, DZ);
      G.add(r);
    });
    // центральная площадь-пешеходка между улицами
    var sq = new THREE.Mesh(new THREE.PlaneGeometry(76, 76), M.pave);
    sq.rotation.x = -Math.PI / 2;
    sq.position.set(-100, 0.035, 100);
    G.add(sq);
    // разметка: пунктир по серединам
    roadZ.forEach(function (z) {
      for (var i = 0; i < 15; i++) {
        var d = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.35), M.line);
        d.rotation.x = -Math.PI / 2;
        d.position.set(DX - 55 + i * 8, 0.04, z);
        G.add(d);
      }
    });
    roadX.forEach(function (x) {
      for (var i = 0; i < 15; i++) {
        var d = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 3), M.line);
        d.rotation.x = -Math.PI / 2;
        d.position.set(x, 0.04, DZ - 55 + i * 8);
        G.add(d);
      }
    });
    // зебры на перекрёстках
    roadZ.forEach(function (z) {
      roadX.forEach(function (x) {
        for (var s = 0; s < 6; s++) {
          var st = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.6), M.line);
          st.rotation.x = -Math.PI / 2;
          st.position.set(x - 3 + s * 1.2, 0.045, z + (z > 0 ? 6.4 : -6.4));
          G.add(st);
        }
      });
    });
    // тротуары вдоль дорог
    roadZ.forEach(function (z) {
      [-1, 1].forEach(function (s) {
        var p = new THREE.Mesh(new THREE.PlaneGeometry(120, 3), M.pave);
        p.rotation.x = -Math.PI / 2;
        p.position.set(DX, 0.05, z + s * 6.5);
        G.add(p);
      });
    });
    roadX.forEach(function (x) {
      [-1, 1].forEach(function (s) {
        var p = new THREE.Mesh(new THREE.PlaneGeometry(3, 120), M.pave);
        p.rotation.x = -Math.PI / 2;
        p.position.set(x + s * 6.5, 0.05, DZ);
        G.add(p);
      });
    });
    // газоны кварталов
    [[-125, 65], [-75, 65], [-125, 135], [-75, 135]].forEach(function (g) {
      var l = new THREE.Mesh(new THREE.PlaneGeometry(40, 38), M.grass);
      l.rotation.x = -Math.PI / 2;
      l.position.set(g[0], 0.02, g[1]);
      G.add(l);
    });
    return { roadZ: roadZ, roadX: roadX };
  }

  // ── МАГАЗИНЫ: главная улица (верхняя, вдоль z=-18) ──
  var SHOPS = [
    { n: 'ПИЦЦЕРИЯ',     c: '#ff5060', x: -128, w: 11, h: 6,  awn: 'awnR' },
    { n: '24 ЧАСА',      c: '#40ff90', x: -114, w: 9,  h: 5,  awn: 'awnG' },
    { n: 'ЭЛЕКТРОНИКА',  c: '#40b0ff', x: -102, w: 12, h: 7,  awn: 'awnB' },
    { n: 'STYLE ОДЕЖДА', c: '#c060ff', x: -88,  w: 11, h: 6,  awn: 'awnR' },
    { n: 'ЦВЕТЫ',        c: '#50ff90', x: -76,  w: 8,  h: 5,  awn: 'awnG' },
    { n: 'КНИГИ',        c: '#ffd040', x: -65,  w: 9,  h: 6,  awn: 'awnB' },
    { n: 'СПОРТ',        c: '#ff8040', x: -124, w: 10, h: 6,  awn: 'awnR' },
    { n: 'ЗОЛОТО',       c: '#ffe060', x: -110, w: 9,  h: 5,  awn: 'awnG' }
  ];
  function buildShops(G, M, addI) {
    SHOPS.forEach(function (s, i) {
      var topRow = i < 6;              // первые 6 — на северной улице
      var z = topRow ? -25 : -48;
      var body = box(s.w, s.h, 9, i % 2 ? M.wallB : M.wallA, s.x, s.h / 2, z);
      G.add(body);
      // витрина
      var gl = box(s.w - 2, 2.6, 0.3, M.glass, s.x, 1.7, z + 4.6);
      G.add(gl);
      // рама витрины
      G.add(box(s.w - 1.6, 0.3, 0.5, M.dark, s.x, 3.1, z + 4.6));
      // дверь
      G.add(box(1.6, 2.6, 0.25, M.glass, s.x + s.w / 2 - 1.4, 1.35, z + 4.55));
      // навес в полоску
      var aw = box(s.w, 0.25, 2.2, M[s.awn], s.x, 3.45, z + 5.5);
      aw.rotation.x = 0.22;
      G.add(aw);
      // вывеска
      var sg = sign(s.n, s.c, s.w - 1);
      sg.position.set(s.x, 4.6, z + 4.65);
      G.add(sg);
      // кондиционеры на крыше
      if (i % 2) G.add(box(1.4, 0.8, 1.2, M.metal, s.x - 2, s.h + 0.4, z));
      // фонарь у входа
      addLamp(G, M, s.x + s.w / 2 + 1, z + 6.5);
      if (typeof interactables !== 'undefined' && interactables.push) {
        interactables.push({
          position: { x: s.x, y: 0, z: z + 6.5 },
          type: 'city2_shop', name: '🏪 ' + s.n, range: 4
        });
      }
    });
  }

  // ── КАФЕШКИ: столики, зонты, лавочки (южная сторона площади) ──
  var CAFES = [
    { n: 'КАФЕ ОБЛАКО',   x: -70, z: 40, c: '#ffd040' },
    { n: 'КОФЕ ТРУПЕР',   x: -100, z: 132, c: '#ff8040' },
    { n: 'БАЛКАН ГРИЛЬ',  x: -132, z: 40, c: '#ff5060' }
  ];
  function buildCafes(G, M, addI) {
    CAFES.forEach(function (cf, ci) {
      // остеклённый павильон
      var body = box(9, 3.6, 7, M.wallE, cf.x, 1.8, cf.z);
      G.add(body);
      var gl = box(8.2, 2.2, 0.25, M.glass, cf.x, 1.5, cf.z + 3.55);
      G.add(gl);
      // крыша-гриб
      var roof = new THREE.Mesh(new THREE.ConeGeometry(6.4, 1.6, 8), M.roof);
      roof.position.set(cf.x, 4.2, cf.z);
      G.add(roof);
      var sg = sign(cf.n, cf.c, 8);
      sg.position.set(cf.x, 3.4, cf.z + 3.75);
      G.add(sg);
      // столики вокруг (2 ряда)
      for (var t = 0; t < 4; t++) {
        var tx = cf.x - 5.5 + (t % 2) * 11;
        var tz = cf.z + 6 + Math.floor(t / 2) * 4.5;
        var tbl = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.1, 10), M.white);
        tbl.position.set(tx, 0.95, tz);
        G.add(tbl);
        var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 0.95, 7), M.metal);
        leg.position.set(tx, 0.48, tz);
        G.add(leg);
        // зонтик
        var um = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.75, 9), ci % 2 ? M.awnR : M.awnG);
        um.position.set(tx, 2.25, tz);
        G.add(um);
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.2, 6), M.metal);
        pole.position.set(tx, 1.1, tz);
        G.add(pole);
        // два стула
        [-1, 1].forEach(function (s) {
          G.add(box(0.5, 0.08, 0.5, M.wood2, tx + s * 1.25, 0.62, tz));
          G.add(box(0.5, 0.6, 0.08, M.wood2, tx + s * 1.25, 0.92, tz + s * 0.22));
          G.add(box(0.08, 0.62, 0.5, M.wood2, tx + s * 1.25, 0.31, tz));
        });
      }
      addLamp(G, M, cf.x + 6, cf.z + 5);
      if (typeof interactables !== 'undefined' && interactables.push) {
        interactables.push({
          position: { x: cf.x, y: 0, z: cf.z + 5.5 },
          type: 'city2_cafe', name: '☕ ' + cf.n, range: 4
        });
      }
    });
  }

  // ── ДОМА: жилой квартал (юго-запад и северо-восток) ──
  // (x, z, w, d, этажи, материал стен, крыша, тип)
  var HOUSES = [
    [-132, 62, 10, 9, 3, 'wallA', 'roof',  0],
    [-118, 62, 9, 9,  2, 'wallC', 'roof2', 0],
    [-104, 62, 11, 9, 4, 'wallB', 'roof',  0],
    [-88,  62, 9, 8,  2, 'wallE', 'roof2', 0],
    [-70,  62, 10, 9, 3, 'wallD', 'roof',  0],
    [-132, 80, 9, 8,  2, 'wallE', 'roof2', 0],
    [-116, 80, 10, 9, 3, 'wallA', 'roof',  0],
    [-99,  80, 9, 9,  2, 'wallB', 'roof2', 0],
    [-83,  80, 11, 9, 4, 'wallC', 'roof',  0],
    [-68,  80, 9, 8,  2, 'wallD', 'roof2', 0],
    [-130, 160, 10, 9, 3, 'wallB', 'roof',  0],
    [-114, 160, 9, 9,  2, 'wallA', 'roof2', 0],
    [-98,  160, 11, 9, 3, 'wallE', 'roof',  0],
    [-80,  160, 9, 8,  2, 'wallC', 'roof2', 0],
    [-64,  160, 10, 9, 4, 'wallD', 'roof',  0],
    [-130, 145, 9, 8,  2, 'wallC', 'roof',  0],
    [-112, 145, 10, 9, 3, 'wallD', 'roof2', 0],
    [-94,  145, 9, 9,  2, 'wallB', 'roof',  0],
    [-76,  145, 11, 9, 3, 'wallA', 'roof2', 0]
  ];
  function buildHouses(G, M) {
    HOUSES.forEach(function (hh, hi) {
      var fh = 3.1;
      var H2 = hh[4] * fh;
      var body = box(hh[2], H2, hh[3], M[hh[5]], hh[0], H2 / 2, hh[1]);
      G.add(body);
      // цоколь
      G.add(box(hh[2] + 0.4, 0.7, hh[3] + 0.4, M.stone, hh[0], 0.35, hh[1]));
      // крыша: двускатная призма из двух наклонных плит
      var r1 = box(hh[2] + 0.8, 0.25, hh[3] / 2 + 1, M[hh[6]], hh[0], H2 + 0.9, hh[1] - hh[3] / 4 - 0.3);
      r1.rotation.x = 0.5;
      G.add(r1);
      var r2 = box(hh[2] + 0.8, 0.25, hh[3] / 2 + 1, M[hh[6]], hh[0], H2 + 0.9, hh[1] + hh[3] / 4 + 0.3);
      r2.rotation.x = -0.5;
      G.add(r2);
      // фронтоны
      [-1, 1].forEach(function (s) {
        var fr = box(hh[2], 1.4, 0.3, M[hh[5]], hh[0], H2 + 0.55, hh[1] + s * (hh[3] / 2));
        G.add(fr);
      });
      // окна: сетка (светящиеся и тёмные вперемешку)
      var cols = Math.max(2, Math.floor(hh[2] / 3.4));
      for (var fl = 0; fl < hh[4]; fl++) {
        for (var wI = 0; wI < cols; wI++) {
          var lit = ((hi + fl * 3 + wI * 7) % 5) < 2;
          [-1, 1].forEach(function (s) {
            var win = box(1.1, 1.4, 0.15,
              lit ? new THREE.MeshBasicMaterial({ color: 0xffdf9a }) : M.dark,
              hh[0] - hh[2] / 2 + (wI + 0.5) * (hh[2] / cols), 0.9 + fl * fh, hh[1] + s * (hh[3] / 2 + 0.05));
            G.add(win);
          });
        }
      }
      // дверь + крылечко
      G.add(box(1.3, 2.3, 0.2, M.wood, hh[0], 1.15, hh[1] + hh[3] / 2 + 0.08));
      G.add(box(2.2, 0.25, 1.4, M.stone, hh[0], 0.12, hh[1] + hh[3] / 2 + 0.8));
      // куст у угла
      var bush = new THREE.Mesh(new THREE.SphereGeometry(0.8, 7, 6), M.leaf2);
      bush.position.set(hh[0] + hh[2] / 2 + 0.8, 0.6, hh[1] + hh[3] / 2 + 0.6);
      bush.scale.y = 0.75;
      G.add(bush);
    });
  }

  // ── NEO MALL: новый ТЦ на северо-востоке района ──
  function buildNeoMall(G, M, addI) {
    var MX2 = -62, MZ2 = 108;
    // основной корпус
    var body = box(42, 16, 34, M.wallD, MX2, 8, MZ2);
    G.add(body);
    // стеклянный фронт
    var gl = box(38, 11, 0.4, M.glass, MX2, 6, MZ2 - 17.2);
    G.add(gl);
    // перекрытия стекла
    for (var f = 1; f <= 3; f++) G.add(box(39, 0.5, 0.6, M.metal, MX2, f * 4, MZ2 - 17.1));
    // вход-купол
    var ent = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 7, 12, 1, true, 0, Math.PI), M.glass);
    ent.position.set(MX2, 3.5, MZ2 - 17);
    ent.rotation.y = Math.PI;
    G.add(ent);
    G.add(box(9, 0.6, 6, M.stone, MX2, 0.3, MZ2 - 19));
    // крыша с лестницей-выходом
    G.add(box(6, 2.4, 5, M.wallB, MX2 + 12, 17.2, MZ2 + 6));
    // большая вывеска
    var sg = sign('NEO MALL', '#40ffdd', 30);
    sg.position.set(MX2, 13.5, MZ2 - 17.4);
    G.add(sg);
    var sg2 = sign('SALE -70%', '#ff4080', 14);
    sg2.position.set(MX2 - 22, 8, MZ2 - 17.4);
    sg2.rotation.z = 0.06;
    G.add(sg2);
    // неоновая кромка крыши
    G.add(box(43, 0.35, 0.35, M.neonB, MX2, 16.2, MZ2 - 17.2));
    G.add(box(43, 0.35, 0.35, M.neonB, MX2, 16.2, MZ2 + 17.2));
    [-1, 1].forEach(function (s) {
      G.add(box(0.35, 0.35, 35, M.neonB, MX2 + s * 21.2, 16.2, MZ2));
    });
    // парковка перед входом
    var pk = new THREE.Mesh(new THREE.PlaneGeometry(34, 14), M.road);
    pk.rotation.x = -Math.PI / 2;
    pk.position.set(MX2, 0.03, MZ2 - 27);
    G.add(pk);
    for (var s2 = 0; s2 < 10; s2++) {
      var ln = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 5.5), M.line);
      ln.rotation.x = -Math.PI / 2;
      ln.position.set(MX2 - 15 + s2 * 3.3, 0.04, MZ2 - 27);
      G.add(ln);
    }
    // фонари парковки
    addLamp(G, M, MX2 - 16, MZ2 - 22);
    addLamp(G, M, MX2 + 16, MZ2 - 22);
    addLamp(G, M, MX2 - 16, MZ2 - 32);
    addLamp(G, M, MX2 + 16, MZ2 - 32);
    if (typeof interactables !== 'undefined' && interactables.push) {
      interactables.push({
        position: { x: MX2, y: 0, z: MZ2 - 20 },
        type: 'city2_mall', name: '🏬 NEO MALL — SOON', range: 5
      });
    }
  }

  // ── ФОНТАН на центральной площади ──
  var fountSprays = [];
  function buildFountain(G, M) {
    var FX = -100, FZ = 100;
    // чаша
    var pool = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.8, 1, 18), M.stone);
    pool.position.set(FX, 0.5, FZ);
    G.add(pool);
    var water = new THREE.Mesh(new THREE.CylinderGeometry(5.1, 5.1, 0.7, 18), M.water);
    water.position.set(FX, 0.95, FZ);
    G.add(water);
    // бортик-скамья
    var rim = new THREE.Mesh(new THREE.TorusGeometry(5.6, 0.35, 8, 20), M.stone);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(FX, 1.1, FZ);
    G.add(rim);
    // центральная колонна
    var col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 3.2, 10), M.stone);
    col.position.set(FX, 2.4, FZ);
    G.add(col);
    var top = new THREE.Mesh(new THREE.SphereGeometry(0.7, 9, 8), M.white);
    top.position.set(FX, 4.2, FZ);
    G.add(top);
    // яруды-чаши
    var b1 = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.1, 0.4, 12), M.stone);
    b1.position.set(FX, 3.4, FZ);
    G.add(b1);
    var b2 = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.8, 0.35, 12), M.stone);
    b2.position.set(FX, 4, FZ);
    G.add(b2);
    // брызги-спрайты
    var dotC = document.createElement('canvas');
    dotC.width = dotC.height = 32;
    var qd = dotC.getContext('2d');
    var gd = qd.createRadialGradient(16, 16, 1, 16, 16, 15);
    gd.addColorStop(0, 'rgba(210,235,255,1)');
    gd.addColorStop(1, 'rgba(160,210,255,0)');
    qd.fillStyle = gd; qd.fillRect(0, 0, 32, 32);
    var dotT = new THREE.CanvasTexture(dotC);
    for (var i = 0; i < 26; i++) {
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: dotT, transparent: true, opacity: 0.75, depthWrite: false
      }));
      sp.scale.setScalar(0.4 + Math.random() * 0.5);
      sp.userData = {
        a: Math.random() * 6.28, v: 1.5 + Math.random() * 2.2,
        t: Math.random(), life: 0.9 + Math.random() * 0.5
      };
      sp.position.set(FX, 4.4, FZ);
      G.add(sp);
      fountSprays.push(sp);
    }
  }

  // ── МЕЛКИЕ ОБЪЕКТЫ: фонари, лавки, деревья, урны ──
  function addLamp(G, M, x, z) {
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 4.6, 7), M.metal);
    pole.position.set(x, 2.3, z);
    G.add(pole);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 7),
      new THREE.MeshBasicMaterial({ color: 0xfff2c0 }));
    head.position.set(x, 4.75, z);
    G.add(head);
    var arm = box(0.7, 0.12, 0.12, M.metal, x, 4.5, z);
    G.add(arm);
  }
  function addBench(G, M, x, z, ry) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    if (ry) g.rotation.y = ry;
    g.add(box(1.9, 0.12, 0.55, M.wood, 0, 0.62, 0));
    g.add(box(1.9, 0.5, 0.1, M.wood, 0, 0.95, -0.26));
    [-0.75, 0.75].forEach(function (s) {
      g.add(box(0.12, 0.62, 0.5, M.metal, s, 0.31, 0));
    });
    G.add(g);
  }
  function addTree(G, M, x, z, big) {
    var sc = big ? 1.25 : 1;
    var tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * sc, 0.24 * sc, 2.2 * sc, 7), M.trunk);
    tr.position.set(x, 1.1 * sc, z);
    G.add(tr);
    var cr = new THREE.Mesh(new THREE.SphereGeometry(1.5 * sc, 8, 7), M.leaf);
    cr.position.set(x, 2.9 * sc, z);
    G.add(cr);
    var cr2 = new THREE.Mesh(new THREE.SphereGeometry(1.05 * sc, 7, 6), M.leaf2);
    cr2.position.set(x + 0.55 * sc, 3.5 * sc, z - 0.3 * sc);
    G.add(cr2);
  }
  function addBin(G, M, x, z) {
    var b = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.85, 8), M.dark);
    b.position.set(x, 0.43, z);
    G.add(b);
    var r = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.08, 8), M.metal);
    r.position.set(x, 0.89, z);
    G.add(r);
  }
  function buildProps(G, M) {
    // фонари по площади
    var lampPts = [
      [-112, 88], [-88, 88], [-112, 112], [-88, 112],
      [-124, 26], [-76, 26], [-124, 174], [-76, 174]
    ];
    lampPts.forEach(function (p) { addLamp(G, M, p[0], p[1]); });
    // лавки вокруг фонтана
    [[-100, 90.5, 0], [-100, 109.5, Math.PI], [-112.5, 100, Math.PI / 2], [-87.5, 100, -Math.PI / 2]].forEach(function (b) {
      addBench(G, M, b[0], b[1], b[2]);
    });
    // деревья вдоль улиц
    var treePts = [
      [-138, 30], [-126, 30], [-96, 30], [-84, 30], [-60, 30],
      [-138, 128], [-126, 128], [-96, 128], [-84, 128],
      [-140, 55], [-140, 95], [-140, 118], [-58, 55], [-58, 95], [-58, 118],
      [-120, 168], [-104, 168], [-88, 168], [-70, 168]
    ];
    treePts.forEach(function (p, i) { addTree(G, M, p[0], p[1], i % 3 === 0); });
    // урны у лавок и входов
    [[-110, 91], [-90, 91], [-110, 109], [-90, 109], [-100, -18], [-70, 34]].forEach(function (p) {
      addBin(G, M, p[0], p[1]);
    });
    // клумбы на площади
    [[-114, 100], [-86, 100]].forEach(function (f) {
      var bed = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.5, 12), M.stone);
      bed.position.set(f[0], 0.25, f[1]);
      G.add(bed);
      var soil = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.3, 12), M.grass);
      soil.position.set(f[0], 0.55, f[1]);
      G.add(soil);
      for (var fl = 0; fl < 7; fl++) {
        var a = fl / 7 * Math.PI * 2;
        var flower = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5),
          new THREE.MeshBasicMaterial({ color: [0xff5080, 0xffd040, 0xff8040][fl % 3] }));
        flower.position.set(f[0] + Math.cos(a) * 1.4, 0.85, f[1] + Math.sin(a) * 1.4);
        G.add(flower);
      }
    });
  }

  // ── ждём сцену и строим район ──
  function boot() {
    if (built) return;
    if (!window.scene || !window.THREE) return;
    built = true;
    var G = new THREE.Group();
    var TX = makeTextures();
    var M = makeMaterials(TX);
    buildRoads(G, M);
    buildShops(G, M);
    buildCafes(G, M);
    buildHouses(G, M);
    buildNeoMall(G, M);
    buildFountain(G, M);
    buildProps(G, M);
    scene.add(G);
    window._fzCity2 = { root: G, sprays: fountSprays };
    // интеракции района — просто сообщения
    var oldHandle = window.handleInteraction;
    if (typeof handleInteraction === 'function') {
      window.handleInteraction = function () {
        var ni = window.nearestInteractable;
        if (ni && String(ni.type).indexOf('city2_') === 0) {
          if (typeof showNotification === 'function') {
            var msg = {
              city2_shop: '🏪 Открытие скоро!',
              city2_cafe: '☕ Столик забронирован (в разработке)',
              city2_mall: '🏬 NEO MALL откроется SOON'
            }[ni.type] || 'Скоро!';
            showNotification(msg, 'info');
          }
          return;
        }
        return oldHandle.apply(this, arguments);
      };
    }
    // анимация фонтана своим тиком
    var lastT = performance.now();
    function fountainLoop(now) {
      var dt = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;
      var arr = window._fzCity2.sprays;
      for (var i = 0; i < arr.length; i++) {
        var sp = arr[i], u = sp.userData;
        u.t += dt / u.life;
        if (u.t > 1) u.t -= 1;
        var up = 4.3 + Math.sin(u.t * Math.PI) * 2.1;
        var rr = u.t * u.v * 1.6;
        sp.position.set(-100 + Math.cos(u.a) * rr, up - u.t * 2.2, 100 + Math.sin(u.a) * rr);
        sp.material.opacity = Math.sin(u.t * Math.PI) * 0.8;
      }
      requestAnimationFrame(fountainLoop);
    }
    requestAnimationFrame(fountainLoop);
  }

  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    if (window.scene && window.THREE && document.body.classList.contains('game-active')) {
      clearInterval(iv);
      try { boot(); } catch (e) { console.warn('[CITY2]', e); }
    } else if (tries > 500) {
      clearInterval(iv);
    }
  }, 400);
})();
