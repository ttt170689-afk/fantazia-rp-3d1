// ═══════════════════════════════════════════════════════════════════
//  🌆 FANTAZIA — НОВЫЙ ГОРОД (v29)
//  Реалистичный современный город с сеточной планировкой.
//  Приоритет: производительность на телефоне.
//
//  ОПТИМИЗАЦИЯ:
//   • InstancedMesh для всего массового (окна, фонари, деревья, разметка)
//   • общие геометрии и материалы (кэш) — минимум draw calls
//   • детализация зависит от FZ_CITY.lod (на мобиле меньше)
//   • дальние кварталы — простые коробки без окон
//
//  КОНТРАКТ С ИГРОЙ (не менять):
//   buildings[]        — { mesh, x, z, w, h, d, name, type, bounds }
//   interactables[]    — { position:{x,y,z}, type, name, range }
//   streetColliders[]  — { x, z, r }
//   sitSpots[]         — { x, z, y, rot, type }
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const NC = window.FZ_NEWCITY = {
    root: null,
    stats: { buildings: 0, draws: 0, instanced: 0 },
    lod: 1
  };

  // ─── кэш геометрий и материалов: один объект на весь город ──────
  const G = {}, M = {};
  function geoBox(w, h, d) {
    const k = 'b' + w + '_' + h + '_' + d;
    return G[k] || (G[k] = new THREE.BoxGeometry(w, h, d));
  }
  function geoPlane(w, h) {
    const k = 'p' + w + '_' + h;
    return G[k] || (G[k] = new THREE.PlaneGeometry(w, h));
  }
  function mat(color, opts) {
    const o = opts || {};
    const k = 'm' + color + (o.basic ? 'B' : 'L') + (o.opacity || 1) + (o.side || 0);
    if (M[k]) return M[k];
    const P = { color: color };
    if (o.opacity && o.opacity < 1) { P.transparent = true; P.opacity = o.opacity; }
    if (o.side) P.side = THREE.DoubleSide;
    M[k] = o.basic ? new THREE.MeshBasicMaterial(P) : new THREE.MeshLambertMaterial(P);
    return M[k];
  }

  // ─── ПАЛИТРА: реалистичный современный город ────────────────────
  const C = {
    asphalt:   0x33373d,
    asphalt2:  0x3b4046,
    sidewalk:  0x8d9299,
    curb:      0xa8adb4,
    line:      0xf2f2f0,
    lineY:     0xf3c341,
    grass:     0x5c8a4a,
    grassDark: 0x4a7340,
    water:     0x3f7fa6,
    concrete:  0xb9bcc0,
    concrete2: 0xa2a6ab,
    brickRed:  0x9c5c4a,
    brickTan:  0xc0a382,
    glass:     0x8fb8d8,
    glassDark: 0x5b7f9e,
    roofTar:   0x4a4d52,
    steel:     0x7d848c,
    woodDark:  0x5b4433
  };

  // фасады жилых/офисных зданий — приглушённые, как в реальном городе
  const FACADES = [0xc9c3b8, 0xb8bcc2, 0xd2c9bb, 0xa8b0b8, 0xc4b8a8,
                   0xb0a89c, 0xcbd0d4, 0xbfae9c, 0x9fa8b0, 0xd6d2c8];

  // ═══════════════════════════════════════════════════════════════
  //  ИНСТАНС-БАТЧЕР: копит трансформы, в конце делает один InstancedMesh
  // ═══════════════════════════════════════════════════════════════
  function Batch(geo, material) {
    this.geo = geo; this.mat = material; this.items = [];
  }
  Batch.prototype.add = function (x, y, z, rx, ry, rz, sx, sy, sz) {
    this.items.push([x, y, z, rx || 0, ry || 0, rz || 0,
                     sx === undefined ? 1 : sx,
                     sy === undefined ? 1 : sy,
                     sz === undefined ? 1 : sz]);
  };
  Batch.prototype.flush = function (parent) {
    const n = this.items.length;
    if (!n) return null;
    const im = new THREE.InstancedMesh(this.geo, this.mat, n);
    const d = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const it = this.items[i];
      d.position.set(it[0], it[1], it[2]);
      d.rotation.set(it[3], it[4], it[5]);
      d.scale.set(it[6], it[7], it[8]);
      d.updateMatrix();
      im.setMatrixAt(i, d.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = false; im.receiveShadow = false;
    im.frustumCulled = true;
    (parent || NC.root).add(im);
    NC.stats.instanced += n;
    NC.stats.draws++;
    return im;
  };

  // ═══════════════════════════════════════════════════════════════
  //  ПЛАНИРОВКА ГОРОДА
  //  Сетка кварталов: проспекты каждые BLOCK единиц.
  // ═══════════════════════════════════════════════════════════════
  const BLOCK = 80;        // шаг сетки кварталов
  const ROAD_W = 14;       // ширина проезжей части
  const SIDEWALK_W = 4;    // тротуар с каждой стороны
  const GRID = 5;          // кварталов от центра в каждую сторону (5 → 11x11)
  const EXTENT = GRID * BLOCK;

  // занятые прямоугольники — чтобы ничего не ставить на дорогу/на молл
  const occupied = [];
  function occupy(x, z, w, d) { occupied.push({ x: x, z: z, w: w, d: d }); }
  function isFree(x, z, w, d) {
    for (let i = 0; i < occupied.length; i++) {
      const o = occupied[i];
      if (Math.abs(x - o.x) < (w + o.w) / 2 + 2 &&
          Math.abs(z - o.z) < (d + o.d) / 2 + 2) return false;
    }
    return true;
  }
  // дорога проходит по линиям, кратным BLOCK
  function onRoad(x, z, w, d) {
    const halfRoad = ROAD_W / 2 + SIDEWALK_W;
    const nx = Math.round(x / BLOCK) * BLOCK;
    const nz = Math.round(z / BLOCK) * BLOCK;
    if (Math.abs(x - nx) < halfRoad + w / 2) return true;
    if (Math.abs(z - nz) < halfRoad + d / 2) return true;
    return false;
  }

  // детерминированный ГПСЧ — город одинаковый при каждом запуске
  let _seed = 20260906;
  function rnd() {
    _seed = (_seed * 1664525 + 1013904223) & 0x7fffffff;
    return _seed / 0x7fffffff;
  }
  function rint(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }

  NC.rnd = rnd;
  NC.occupy = occupy;
  NC.isFree = isFree;
  NC.onRoad = onRoad;
  NC.geoBox = geoBox;
  NC.geoPlane = geoPlane;
  NC.mat = mat;
  NC.Batch = Batch;
  NC.C = C;
  NC.FACADES = FACADES;
  NC.BLOCK = BLOCK;
  NC.ROAD_W = ROAD_W;
  NC.SIDEWALK_W = SIDEWALK_W;
  NC.GRID = GRID;
  NC.EXTENT = EXTENT;
  NC.rint = rint;
  NC.pick = pick;
})();

// ═══════════════════════════════════════════════════════════════════
//  ДОРОГИ, РАЗМЕТКА, ТРОТУАРЫ
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  const NC = window.FZ_NEWCITY;
  const C = NC.C, BLOCK = NC.BLOCK, ROAD_W = NC.ROAD_W,
        SW = NC.SIDEWALK_W, GRID = NC.GRID, EXTENT = NC.EXTENT;

  NC.buildRoads = function () {
    const R = NC.root;
    const span = EXTENT * 2 + ROAD_W;

    // ── асфальт: по одной длинной полосе на каждую улицу ──
    const roadGeo = NC.geoPlane(1, 1);
    const roadMat = NC.mat(C.asphalt);
    const bRoad = new NC.Batch(roadGeo, roadMat);
    // тротуары чуть выше асфальта
    const bWalk = new NC.Batch(NC.geoPlane(1, 1), NC.mat(C.sidewalk));
    // бордюр — тонкая коробка, читается как ступенька
    const bCurb = new NC.Batch(NC.geoBox(1, 0.18, 1), NC.mat(C.curb));

    for (let i = -GRID; i <= GRID; i++) {
      const p = i * BLOCK;
      // проспект вдоль Z (вертикальный)
      bRoad.add(p, 0.02, 0, -Math.PI / 2, 0, 0, ROAD_W, span, 1);
      // проспект вдоль X (горизонтальный)
      bRoad.add(0, 0.02, p, -Math.PI / 2, 0, Math.PI / 2, ROAD_W, span, 1);

      // тротуары по обе стороны каждой улицы
      [-1, 1].forEach(function (s) {
        const off = s * (ROAD_W / 2 + SW / 2);
        bWalk.add(p + off, 0.05, 0, -Math.PI / 2, 0, 0, SW, span, 1);
        bWalk.add(0, 0.05, p + off, -Math.PI / 2, 0, Math.PI / 2, SW, span, 1);
        // бордюрный камень на кромке проезжей части
        const ce = s * (ROAD_W / 2);
        bCurb.add(p + ce, 0.09, 0, 0, 0, 0, 0.4, 1, span);
        bCurb.add(0, 0.09, p + ce, 0, 0, 0, span, 1, 0.4);
      });
    }
    bRoad.flush(R); bWalk.flush(R); bCurb.flush(R);

    // ── разметка: прерывистая осевая ──
    const bLine = new NC.Batch(NC.geoPlane(0.35, 4), NC.mat(C.line, { basic: true }));
    const step = 10;
    const lodStep = NC.lod < 1 ? step * 2 : step; // на слабых — реже
    for (let i = -GRID; i <= GRID; i++) {
      const p = i * BLOCK;
      for (let t = -EXTENT; t <= EXTENT; t += lodStep) {
        // не рисуем разметку внутри перекрёстка
        const nearCrossZ = Math.abs(t - Math.round(t / BLOCK) * BLOCK) < ROAD_W;
        if (!nearCrossZ) {
          bLine.add(p, 0.06, t, -Math.PI / 2, 0, 0);
          bLine.add(t, 0.06, p, -Math.PI / 2, 0, Math.PI / 2);
        }
      }
    }
    bLine.flush(R);

    // ── «зебры» на подходах к перекрёсткам ──
    const bZebra = new NC.Batch(NC.geoPlane(0.7, 4.5), NC.mat(C.line, { basic: true }));
    for (let i = -GRID; i <= GRID; i++) {
      for (let j = -GRID; j <= GRID; j++) {
        const cx = i * BLOCK, cz = j * BLOCK;
        const d = ROAD_W / 2 + 3;
        for (let k = -5; k <= 5; k++) {
          const o = k * 1.25;
          bZebra.add(cx + o, 0.07, cz - d, -Math.PI / 2, 0, 0);
          bZebra.add(cx + o, 0.07, cz + d, -Math.PI / 2, 0, 0);
          bZebra.add(cx - d, 0.07, cz + o, -Math.PI / 2, 0, Math.PI / 2);
          bZebra.add(cx + d, 0.07, cz + o, -Math.PI / 2, 0, Math.PI / 2);
        }
      }
    }
    bZebra.flush(R);

    // Дороги НЕ регистрируем в occupied: полоса во всю карту отвергала бы
    // любую застройку. От попадания на проезжую часть защищает onRoad().
  };

  // ═══ СВЕТОФОРЫ И ФОНАРИ ═══════════════════════════════════════
  NC.buildStreetFurniture = function () {
    const R = NC.root;
    // фонарь: столб + консоль + плафон, всё инстансами
    const bPole = new NC.Batch(NC.geoBox(0.22, 7, 0.22), NC.mat(C.steel));
    const bArm  = new NC.Batch(NC.geoBox(1.6, 0.16, 0.16), NC.mat(C.steel));
    const bLamp = new NC.Batch(NC.geoBox(1.1, 0.22, 0.5), NC.mat(0xffe9a8, { basic: true }));

    const lampStep = NC.lod < 1 ? BLOCK / 2 : BLOCK / 4;
    for (let i = -GRID; i <= GRID; i++) {
      const p = i * BLOCK;
      for (let t = -EXTENT; t < EXTENT; t += lampStep) {
        if (Math.abs(t - Math.round(t / BLOCK) * BLOCK) < ROAD_W) continue;
        const off = ROAD_W / 2 + SW - 1;
        // вдоль вертикальной улицы
        bPole.add(p + off, 3.5, t);
        bArm.add(p + off - 0.8, 6.9, t);
        bLamp.add(p + off - 1.5, 6.8, t);
        window.streetColliders.push({ x: p + off, z: t, r: 0.35 });
        // вдоль горизонтальной
        bPole.add(t, 3.5, p + off);
        bArm.add(t, 6.9, p + off - 0.8, 0, Math.PI / 2, 0);
        bLamp.add(t, 6.8, p + off - 1.5, 0, Math.PI / 2, 0);
        window.streetColliders.push({ x: t, z: p + off, r: 0.35 });
      }
    }
    bPole.flush(R); bArm.flush(R); bLamp.flush(R);

    // светофоры на перекрёстках
    const bTl = new NC.Batch(NC.geoBox(0.18, 4.2, 0.18), NC.mat(0x2f3338));
    const bBox = new NC.Batch(NC.geoBox(0.5, 1.3, 0.35), NC.mat(0x1e2226));
    const bRed = new NC.Batch(NC.geoBox(0.26, 0.26, 0.06), NC.mat(0xff3b30, { basic: true }));
    const bYel = new NC.Batch(NC.geoBox(0.26, 0.26, 0.06), NC.mat(0x6b5a1a, { basic: true }));
    const bGrn = new NC.Batch(NC.geoBox(0.26, 0.26, 0.06), NC.mat(0x1a5c2a, { basic: true }));
    for (let i = -GRID; i <= GRID; i++) {
      for (let j = -GRID; j <= GRID; j++) {
        const cx = i * BLOCK, cz = j * BLOCK, d = ROAD_W / 2 + SW - 1.2;
        [[cx - d, cz - d], [cx + d, cz + d]].forEach(function (pt) {
          bTl.add(pt[0], 2.1, pt[1]);
          bBox.add(pt[0], 4.4, pt[1]);
          bRed.add(pt[0], 4.82, pt[1] + 0.2);
          bYel.add(pt[0], 4.44, pt[1] + 0.2);
          bGrn.add(pt[0], 4.06, pt[1] + 0.2);
          window.streetColliders.push({ x: pt[0], z: pt[1], r: 0.3 });
        });
      }
    }
    bTl.flush(R); bBox.flush(R); bRed.flush(R); bYel.flush(R); bGrn.flush(R);
  };
})();

// ═══════════════════════════════════════════════════════════════════
//  ЗДАНИЯ
//  Окна и детали копятся в общие батчи → весь квартал = ~5 draw calls.
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  const NC = window.FZ_NEWCITY;
  const C = NC.C;

  // общие батчи для всей застройки
  let B = null;
  NC.initBuildingBatches = function () {
    B = {
      bodies: {},
      win:    new NC.Batch(NC.geoPlane(1.15, 1.45), NC.mat(C.glass, { basic: true })),
      winLit: new NC.Batch(NC.geoPlane(1.15, 1.45), NC.mat(0xffe3a0, { basic: true })),
      ledge:  new NC.Batch(NC.geoBox(1, 0.18, 0.3), NC.mat(C.concrete2)),
      door:   new NC.Batch(NC.geoBox(2.2, 3, 0.16), NC.mat(0x4a3b2e)),
      glassD: new NC.Batch(NC.geoBox(2.6, 3.2, 0.12), NC.mat(C.glass, { basic: true, opacity: 0.55 })),
      roof:   new NC.Batch(NC.geoBox(1, 0.6, 1), NC.mat(C.roofTar)),
      ac:     new NC.Batch(NC.geoBox(1.2, 0.7, 1.2), NC.mat(C.steel)),
      step:   new NC.Batch(NC.geoBox(1, 0.16, 1), NC.mat(C.concrete))
    };
  };
  NC.flushBuildingBatches = function () {
    if (!B) return;
    Object.keys(B.bodies).forEach(function (c) { B.bodies[c].flush(NC.root); });
    Object.keys(B).forEach(function (k) {
      if (k !== 'bodies') B[k].flush(NC.root);
    });
    B = null;
  };

  // Одно здание. detail: 2 = ближнее (окна+детали), 1 = среднее, 0 = дальняя коробка
  NC.makeBuilding = function (o) {
    const x = o.x, z = o.z, w = o.w, h = o.h, d = o.d;
    // защита от застройки дорог и наложения на молл/площадь
    if (!o.force) {
      if (NC.onRoad(x, z, w, d)) return null;
      if (!NC.isFree(x, z, w, d)) return null;
    }
    const detail = o.detail === undefined ? 2 : o.detail;
    const color = o.color || NC.pick(NC.FACADES);

    // ОПТИМИЗАЦИЯ: корпус идёт в инстанс-батч по цвету — единичный куб
    // масштабируется под размер дома. 231 здание → единицы draw calls.
    if (!B.bodies[color]) {
      B.bodies[color] = new NC.Batch(NC.geoBox(1, 1, 1), NC.mat(color));
    }
    B.bodies[color].add(x, h / 2, z, 0, 0, 0, w, h, d);
    // лёгкий прокси вместо меша: коду игры нужны только координаты
    const body = { isProxy: true, position: { x: x, y: h / 2, z: z } };
    NC.stats.buildings++;

    if (detail >= 1) {
      // парапет крыши
      B.roof.add(x, h + 0.3, z, 0, 0, 0, w + 0.6, 1, d + 0.6);
    }

    if (detail >= 2) {
      // ── ОКНА: сетка по фасаду, часть светится ──
      const floors = Math.max(1, Math.floor((h - 1.5) / 3.4));
      const perRow = Math.max(1, Math.floor((w - 2) / 2.6));
      const perSide = Math.max(1, Math.floor((d - 2) / 2.6));
      const fz = d / 2 + 0.06, fx = w / 2 + 0.06;

      for (let f = 0; f < floors; f++) {
        const y = 2.6 + f * 3.4;
        if (y > h - 1) break;
        // фасады вдоль X (перед/зад)
        for (let i = 0; i < perRow; i++) {
          const wx = -w / 2 + 1.3 + i * ((w - 2.6) / Math.max(1, perRow - 1 || 1));
          const lit = NC.rnd() < 0.28;
          (lit ? B.winLit : B.win).add(x + wx, y, z + fz);
          (NC.rnd() < 0.28 ? B.winLit : B.win).add(x + wx, y, z - fz, 0, Math.PI, 0);
        }
        // торцы вдоль Z (лево/право)
        for (let i = 0; i < perSide; i++) {
          const wz = -d / 2 + 1.3 + i * ((d - 2.6) / Math.max(1, perSide - 1 || 1));
          (NC.rnd() < 0.28 ? B.winLit : B.win).add(x + fx, y, z + wz, 0, Math.PI / 2, 0);
          (NC.rnd() < 0.28 ? B.winLit : B.win).add(x - fx, y, z + wz, 0, -Math.PI / 2, 0);
        }
      }
      // кондиционеры на крыше — оживляют силуэт
      if (h > 12) {
        const n = NC.rint(1, 3);
        for (let i = 0; i < n; i++) {
          B.ac.add(x + (NC.rnd() - 0.5) * (w - 3), h + 0.9, z + (NC.rnd() - 0.5) * (d - 3));
        }
      }
    }

    // ── ВХОД со стороны улицы ──
    const face = o.face || 1; // +1: вход в сторону +z
    const ez = z + face * (d / 2 + 0.1);
    if (detail >= 1) {
      if (o.glassEntrance) B.glassD.add(x, 1.6, ez);
      else B.door.add(x, 1.5, ez);
      B.step.add(x, 0.08, ez + face * 0.9, 0, 0, 0, 4, 1, 1.6);
    }

    // ── ВЫВЕСКА (только у заведений — canvas дорогой) ──
    if (o.name && o.sign !== false && detail >= 1) {
      const cv = document.createElement('canvas');
      cv.width = 256; cv.height = 64;
      const g = cv.getContext('2d');
      g.fillStyle = o.signBg || 'rgba(18,20,26,0.92)';
      g.fillRect(0, 0, 256, 64);
      g.fillStyle = o.signFg || '#ffffff';
      g.font = 'bold 30px Arial';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(o.name, 128, 34);
      const tex = new THREE.CanvasTexture(cv);
      const sw = Math.min(w * 0.85, 11);
      const sign = new THREE.Mesh(NC.geoPlane(1, 1),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      sign.scale.set(sw, sw * 0.25, 1);
      sign.position.set(x, Math.min(h - 1, 4.6), ez + face * 0.08);
      if (face < 0) sign.rotation.y = Math.PI;
      NC.root.add(sign);
      NC.stats.draws++;
    }

    // ── РЕГИСТРАЦИЯ В ИГРЕ ──
    window.buildings.push({
      mesh: body, x: x, z: z, w: w, h: h, d: d,
      name: o.name || '', type: o.type || null,
      bounds: { minX: x - w / 2 - 0.5, maxX: x + w / 2 + 0.5,
                minZ: z - d / 2 - 0.5, maxZ: z + d / 2 + 0.5 }
    });
    if (o.type) {
      window.interactables.push({
        position: { x: x, y: 0, z: ez + face * 2 },
        type: o.type, name: o.name || '', range: 5
      });
    }
    NC.occupy(x, z, w, d);
    return body;
  };
})();

// ═══════════════════════════════════════════════════════════════════
//  РАЙОНЫ
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  const NC = window.FZ_NEWCITY;
  const C = NC.C, BLOCK = NC.BLOCK;

  // центр квартала со смещением к его середине
  function blockCenter(i, j) { return { x: i * BLOCK + BLOCK / 2, z: j * BLOCK + BLOCK / 2 }; }

  // ═══ ДЕЛОВОЙ ЦЕНТР: работы + офисы (топор будет здесь) ═══
  NC.buildDowntown = function () {
    // Главный офисный центр — сюда переехал квест-топор
    NC.makeBuilding({
      x: 48, z: 48, w: 26, h: 46, d: 22, color: 0x6b8cae,
      name: '🏢 ОФИСНЫЙ ЦЕНТР', type: 'office', glassEntrance: true, face: -1,
      signBg: 'rgba(20,40,70,0.95)', signFg: '#8fd0ff'
    });

    // Банк — работа + баланс
    NC.makeBuilding({
      x: -48, z: 48, w: 22, h: 20, d: 18, color: 0x1c2e40,
      name: '🏦 БАНК ФАНТАЗИЯ', type: 'bank', glassEntrance: true, face: -1,
      signBg: 'rgba(10,25,45,0.95)', signFg: '#ffd479'
    });

    // Больница — работа врача
    NC.makeBuilding({
      x: -48, z: -48, w: 26, h: 18, d: 20, color: 0xeef1f3,
      name: '🏥 ГОРБОЛЬНИЦА', type: 'hospital', glassEntrance: true, face: 1,
      signBg: 'rgba(240,245,250,0.95)', signFg: '#e0362f'
    });

    // Полиция — работа полицейского
    NC.makeBuilding({
      x: -108, z: 26, w: 22, h: 14, d: 18, color: 0x2a3f5f,
      name: '👮 ПОЛИЦИЯ', type: 'job_police', face: 1,
      signBg: 'rgba(15,30,60,0.95)', signFg: '#5aa9ff'
    });

    // высотки делового центра — фон, без интерьеров
    const towers = [
      [96, 30, 20, 62, 20], [96, -30, 22, 54, 20],
      [-96, 30, 20, 58, 22], [-96, -30, 20, 50, 20],
      [30, 96, 22, 66, 20], [-30, 96, 20, 56, 22],
      [30, -96, 20, 52, 20], [-30, -96, 22, 60, 20]
    ];
    towers.forEach(function (t) {
      NC.makeBuilding({ x: t[0], z: t[1], w: t[2], h: t[3], d: t[4],
        color: NC.pick([0x7d8ea0, 0x8a95a3, 0x6f8296, 0x94a0ac]), detail: 2 });
    });
  };

  // ═══ ТОРГОВАЯ УЛИЦА: магазины и работы ═══
  NC.buildShops = function () {
    const shops = [
      { n: '👕 ОДЕЖДА',     t: 'shop_clothing',    c: 0xd88fa8 },
      { n: '🍎 ПРОДУКТЫ',   t: 'shop_food',        c: 0x7fb069 },
      { n: '📱 ЭЛЕКТРОНИКА',t: 'shop_electronics', c: 0x5b8fc7 },
      { n: '🛋 МЕБЕЛЬ',     t: 'shop_furniture',   c: 0xb98a5e },
      { n: '🐾 ЗООТОВАРЫ',  t: 'shop_petfood',     c: 0xd9a441 },
      { n: '☕ КАФЕ',       t: 'restaurant',       c: 0x8c5a3c },
      { n: '🍽 РЕСТОРАН',   t: 'restaurant',       c: 0x7a4a2a },
      { n: '🏋️ СПОРТЗАЛ',  t: 'gym',              c: 0x3f6b4a },
      { n: '🎬 КИНОТЕАТР',  t: 'cinema',           c: 0x2c3e50 },
      { n: '🎵 НОЧНОЙ КЛУБ',t: 'club',             c: 0x3a2050 },
      { n: '🎤 КАРАОКЕ',    t: 'karaoke',          c: 0x4a1a5c },
      { n: '🚕 ТАКСОПАРК',  t: 'job_taxi',         c: 0xd6b23d },
      { n: '🔧 АВТОСЕРВИС', t: 'job_mechanic',     c: 0x6b6b6b }
    ];

    // ставим вдоль торговой улицы z ≈ -BLOCK/2, лицом на юг и север
    // позиции внутри кварталов, гарантированно в стороне от проезжей части
    const slots = [];
    [[-BLOCK, -1], [BLOCK, 1], [BLOCK * 2, 1]].forEach(function (row) {
      const zBase = row[0], face = row[1];
      [-26, 0, 26].forEach(function (ox) {
        // два ряда витрин внутри квартала
        slots.push({ x: zBase + ox, z: -BLOCK + 26 * face, face: face });
        slots.push({ x: -zBase + ox, z: BLOCK + 26 * face, face: face });
      });
    });

    let idx = 0;
    for (let si = 0; si < slots.length && idx < shops.length; si++) {
      const sl = slots[si];
      const s = shops[idx];
      const built = NC.makeBuilding({
        x: sl.x, z: sl.z, w: 18, h: NC.rint(8, 13), d: 14, color: s.c,
        name: s.n, type: s.t, face: sl.face, glassEntrance: true
      });
      if (built) idx++;
    }
    // остаток — вдоль восточного проспекта
    let ez = -BLOCK * 2;
    while (idx < shops.length && ez < BLOCK * 3) {
      const s = shops[idx];
      const built = NC.makeBuilding({
        x: BLOCK * 2 + 26, z: ez, w: 18, h: NC.rint(8, 12), d: 14,
        color: s.c, name: s.n, type: s.t, face: -1, glassEntrance: true
      });
      if (built) idx++;
      ez += 26;
    }
    NC.stats.shops = idx;
  };

  // ═══ ЖИЛЫЕ КВАРТАЛЫ: многоэтажки (квартиры) + коттеджи ═══
  NC.buildResidential = function () {
    const GRID = NC.GRID;
    let apt = 0, hs = 0;

    for (let i = -GRID; i < GRID; i++) {
      for (let j = -GRID; j < GRID; j++) {
        const c = blockCenter(i, j);
        const dist = Math.max(Math.abs(c.x), Math.abs(c.z));
        if (dist < BLOCK) continue;               // центр занят деловым районом
        if (dist > BLOCK * 4) continue;           // дальше — окраина
        // поквартальный гейт не ставим: занятость проверяет makeBuilding

        const ring = Math.floor(dist / BLOCK);
        if (ring <= 2) {
          // ── многоэтажки: 4 дома в квартале, в них квартиры ──
          for (let k = 0; k < 4; k++) {
            const ox = (k % 2 ? 1 : -1) * 16, oz = (k < 2 ? -1 : 1) * 16;
            const x = c.x + ox, z = c.z + oz;
            const built = NC.makeBuilding({
              x: x, z: z, w: 19, h: NC.rint(24, 34), d: 15,
              color: NC.pick(NC.FACADES),
              name: '🏢 ЖИЛОЙ ДОМ',
              type: 'apartment', face: oz > 0 ? 1 : -1, sign: false
            });
            if (built) apt++;
          }
        } else {
          // ── частный сектор: коттеджи ──
          for (let k = 0; k < 4; k++) {
            const ox = (k % 2 ? 1 : -1) * 17, oz = (k < 2 ? -1 : 1) * 17;
            const x = c.x + ox, z = c.z + oz;
            const builtH = NC.makeBuilding({
              x: x, z: z, w: 14, h: NC.rint(5, 8), d: 12,
              color: NC.pick([0xc9a87c, 0xd6c3a5, 0xbfa88c, 0xc4b49a, 0xd0b894]),
              name: '🏡 КОТТЕДЖ',
              type: 'house', face: oz > 0 ? 1 : -1, sign: false, detail: 1
            });
            if (builtH) hs++;
          }
        }
      }
    }
    NC.stats.apartments = apt;
    NC.stats.houses = hs;
  };

  // ═══ ПАРК: газон, пруд, деревья, лавочки ═══
  NC.buildPark = function () {
    const PX = -BLOCK * 2 - BLOCK / 2, PZ = BLOCK * 2 + BLOCK / 2;
    const R = NC.root;

    const lawn = new THREE.Mesh(NC.geoPlane(1, 1), NC.mat(C.grass));
    lawn.rotation.x = -Math.PI / 2;
    lawn.scale.set(BLOCK - 20, BLOCK - 20, 1);
    lawn.position.set(PX, 0.04, PZ);
    R.add(lawn); NC.stats.draws++;

    // пруд
    const pond = new THREE.Mesh(new THREE.CircleGeometry(11, 20), NC.mat(C.water, { opacity: 0.85 }));
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(PX, 0.07, PZ);
    R.add(pond); NC.stats.draws++;

    // дорожки крест-накрест
    const bPath = new NC.Batch(NC.geoPlane(1, 1), NC.mat(0xa89880));
    bPath.add(PX, 0.06, PZ, -Math.PI / 2, 0, 0, 4, BLOCK - 20, 1);
    bPath.add(PX, 0.06, PZ, -Math.PI / 2, 0, Math.PI / 2, 4, BLOCK - 20, 1);
    bPath.flush(R);

    NC.occupy(PX, PZ, BLOCK - 20, BLOCK - 20);
    window.interactables.push({ position: { x: PX, y: 0, z: PZ - 14 },
      type: 'park', name: '🌳 ЦЕНТРАЛЬНЫЙ ПАРК', range: 6 });

    // лавочки вокруг пруда — на них можно сесть
    const bSeat = new NC.Batch(NC.geoBox(1.8, 0.12, 0.55), NC.mat(C.woodDark));
    const bBack = new NC.Batch(NC.geoBox(1.8, 0.5, 0.1), NC.mat(C.woodDark));
    const bLeg  = new NC.Batch(NC.geoBox(0.12, 0.5, 0.5), NC.mat(0x4a4a4a));
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      const bx = PX + Math.cos(ang) * 15, bz = PZ + Math.sin(ang) * 15;
      const rot = -ang + Math.PI / 2;
      bSeat.add(bx, 0.6, bz, 0, rot, 0);
      bBack.add(bx - Math.sin(rot) * 0.25, 0.9, bz - Math.cos(rot) * 0.25, 0, rot, 0);
      bLeg.add(bx + Math.cos(rot) * 0.7, 0.3, bz - Math.sin(rot) * 0.7, 0, rot, 0);
      bLeg.add(bx - Math.cos(rot) * 0.7, 0.3, bz + Math.sin(rot) * 0.7, 0, rot, 0);
      window.sitSpots.push({ x: bx, z: bz, y: 0.72, rot: rot, type: 'bench' });
      window.streetColliders.push({ x: bx, z: bz, r: 1.1 });
    }
    bSeat.flush(R); bBack.flush(R); bLeg.flush(R);
  };

  // ═══ ОЗЕЛЕНЕНИЕ: деревья вдоль улиц ═══
  NC.buildGreenery = function () {
    const R = NC.root, GRID = NC.GRID, EXTENT = NC.EXTENT, ROAD_W = NC.ROAD_W, SW = NC.SIDEWALK_W;
    const bTrunk = new NC.Batch(NC.geoBox(0.32, 3, 0.32), NC.mat(0x5b4433));
    const crownGeo = new THREE.IcosahedronGeometry(1, 0); // дёшево и похоже на крону
    const bCrown = new NC.Batch(crownGeo, NC.mat(C.grassDark));
    const bCrown2 = new NC.Batch(crownGeo, NC.mat(0x6b9c52));

    const step = NC.lod < 1 ? 24 : 14;
    for (let i = -GRID; i <= GRID; i++) {
      const p = i * BLOCK;
      for (let t = -EXTENT; t < EXTENT; t += step) {
        if (Math.abs(t - Math.round(t / BLOCK) * BLOCK) < ROAD_W + 4) continue;
        const off = ROAD_W / 2 + SW + 1.6;
        [-1, 1].forEach(function (s) {
          const sc = 1.6 + NC.rnd() * 0.9;
          // дерево у вертикальной улицы
          bTrunk.add(p + s * off, 1.5, t);
          (NC.rnd() < 0.5 ? bCrown : bCrown2).add(p + s * off, 3.6, t, 0, NC.rnd() * 3, 0, sc, sc * 1.15, sc);
          window.streetColliders.push({ x: p + s * off, z: t, r: 0.6 });
          // дерево у горизонтальной
          bTrunk.add(t, 1.5, p + s * off);
          (NC.rnd() < 0.5 ? bCrown : bCrown2).add(t, 3.6, p + s * off, 0, NC.rnd() * 3, 0, sc, sc * 1.15, sc);
          window.streetColliders.push({ x: t, z: p + s * off, r: 0.6 });
        });
      }
    }
    bTrunk.flush(R); bCrown.flush(R); bCrown2.flush(R);
  };
})();

// ═══════════════════════════════════════════════════════════════════
//  СБОРКА ГОРОДА
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  const NC = window.FZ_NEWCITY;

  // GRAND MALL остаётся на своём месте — квест на него завязан
  NC.MALL = { x: 85, z: -85, w: 120, h: 55, d: 100 };

  NC.build = function () {
    if (!window.THREE || !window.scene) {
      console.warn('[NEWCITY] нет scene/THREE');
      return false;
    }
    const t0 = (performance && performance.now) ? performance.now() : Date.now();

    // ── LOD по устройству: на телефоне режем детализацию ──
    const mob = (typeof window.IS_MOBILE === 'boolean')
      ? window.IS_MOBILE
      : /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
    const cores = navigator.hardwareConcurrency || 4;
    NC.lod = mob ? (cores <= 4 ? 0.5 : 0.75) : 1;

    NC.root = new THREE.Group();
    NC.root.name = 'FZ_NEWCITY';
    window.scene.add(NC.root);

    // молл резервируем ДО застройки, чтобы дома в него не влезли
    NC.occupy(NC.MALL.x, NC.MALL.z, NC.MALL.w + 30, NC.MALL.d + 30);
    // площадь спавна в центре тоже держим свободной
    NC.occupy(0, 0, 46, 46);

    NC.buildRoads();
    NC.initBuildingBatches();
    NC.buildDowntown();
    NC.buildShops();
    NC.buildResidential();
    NC.flushBuildingBatches();
    NC.buildPark();
    NC.buildGreenery();
    NC.buildStreetFurniture();
    NC.buildCentralSquare();

    const t1 = (performance && performance.now) ? performance.now() : Date.now();
    NC.stats.ms = Math.round(t1 - t0);
    console.log('[NEWCITY] 🌆 город построен за ' + NC.stats.ms + 'мс | ' +
      'зданий: ' + NC.stats.buildings +
      ' | draw-вызовов: ~' + NC.stats.draws +
      ' | инстансов: ' + NC.stats.instanced +
      ' | LOD: ' + NC.lod);
    return true;
  };

  // ═══ ЦЕНТРАЛЬНАЯ ПЛОЩАДЬ (точка спавна) ═══
  NC.buildCentralSquare = function () {
    const R = NC.root, C = NC.C;
    // мощение
    const plaza = new THREE.Mesh(NC.geoPlane(1, 1), NC.mat(0x9a9186));
    plaza.rotation.x = -Math.PI / 2;
    plaza.scale.set(44, 44, 1);
    plaza.position.set(0, 0.05, 0);
    R.add(plaza); NC.stats.draws++;

    // узор плитки
    const bTile = new NC.Batch(NC.geoPlane(9.4, 9.4), NC.mat(0xa89f93));
    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        if ((i + j) % 2) bTile.add(i * 10, 0.06, j * 10, -Math.PI / 2, 0, 0);
      }
    }
    bTile.flush(R);

    // стела в центре — ориентир на спавне
    const base = new THREE.Mesh(NC.geoBox(6, 0.8, 6), NC.mat(0x8d8378));
    base.position.set(0, 0.4, 0); R.add(base);
    const ob = new THREE.Mesh(NC.geoBox(1.6, 14, 1.6), NC.mat(0xd8d2c6));
    ob.position.set(0, 7.6, 0); R.add(ob);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.2, 4), NC.mat(0xffd479));
    tip.position.set(0, 15.7, 0); tip.rotation.y = Math.PI / 4; R.add(tip);
    NC.stats.draws += 3;
    window.streetColliders.push({ x: 0, z: 0, r: 3.4 });

    // лавочки по периметру площади
    const bSeat = new NC.Batch(NC.geoBox(1.8, 0.12, 0.55), NC.mat(C.woodDark));
    const bLeg = new NC.Batch(NC.geoBox(0.12, 0.5, 0.5), NC.mat(0x4a4a4a));
    for (let a = 0; a < 6; a++) {
      const ang = (a / 6) * Math.PI * 2;
      const bx = Math.cos(ang) * 17, bz = Math.sin(ang) * 17;
      const rot = -ang + Math.PI / 2;
      bSeat.add(bx, 0.6, bz, 0, rot, 0);
      bLeg.add(bx + Math.cos(rot) * 0.7, 0.3, bz - Math.sin(rot) * 0.7, 0, rot, 0);
      bLeg.add(bx - Math.cos(rot) * 0.7, 0.3, bz + Math.sin(rot) * 0.7, 0, rot, 0);
      window.sitSpots.push({ x: bx, z: bz, y: 0.72, rot: rot, type: 'bench' });
      window.streetColliders.push({ x: bx, z: bz, r: 1.1 });
    }
    bSeat.flush(R); bLeg.flush(R);
  };
})();
