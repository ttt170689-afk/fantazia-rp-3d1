// ═══════════════════════════════════════════════════════════════════════════
//  GRAND MALL v40 — полностью переписанный торговый центр
//  ---------------------------------------------------------------------------
//  Заменяет и старый buildMallInterior, и перенос из тизера (mall-teaser.js).
//
//  Что внутри:
//    • 8 уровней: B5..B1 (подвалы) + 1, 2, 3 (торговые этажи)
//    • настоящий лифт на все 8 уровней (кабина, табло, катсцена)
//    • эскалаторы между торговыми этажами
//    • 1 этаж — мода и парфюмерия, 2 этаж — электроника и игры,
//      3 этаж — фудкорт и КИНОТЕАТР с 4 залами
//    • служебные входы, техкоридоры, паркинг, склад, венткамера
//
//  КОНТРАКТЫ ИГРЫ (менять нельзя, на них завязан остальной код index.html):
//    liftX = 16, liftZ = -8          — позиция лифта, её ждёт LIFT_CAM
//    DOORW = 1.52, DOORH = 3.08      — размер створок
//    userData.isElevDoorL / isElevDoorR — по ним ищутся створки (стр. 16078)
//    window.mallLiftInd = {ctx,tex}  — живое табло, рисует drawMallLiftInd
//    MALL_ESC = {xUp:[-14,-12], zBottom:10, zTop:0} — геометрия эскалаторов
//    interactables: escalator_up / escalator_down / quest_boards
//    fzLiftCabin / fzServiceDoor / fzBossDoorway — внешние построители
//    Все меши обязаны идти через add() → interiorObjects (иначе утечка памяти)
// ═══════════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  const MW = 44, MD = 36;          // габариты зала (совпадают с buildInterior)
  const HALF_W = MW / 2, HALF_D = MD / 2;

  // ── позиция лифта: КОНТРАКТ, LIFT_CAM считает doorZ = bz - 8 - 2.4 ──
  const LIFT_X = 16, LIFT_Z = -8;
  const DOORW = 1.52, DOORH = 3.08;

  // ── атриум: сквозной проём над эскалаторами ──
  const ATRIUM = { x0: -20, x1: -8, z0: -2, z1: 12 };

  // ═════════════════════════════════════════════════════════════════════════
  //  ТЕКСТУРЫ — рисуются на canvas один раз за сборку и кешируются
  // ═════════════════════════════════════════════════════════════════════════
  function makeTextures(THREE, nzCanvas) {
    const T = {};
    const rep = (t, x, y) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(x, y);
      return t;
    };

    // мрамор торговых этажей: крупная плитка с прожилками
    T.marble = rep(nzCanvas(256, 256, (g) => {
      g.fillStyle = '#f4f1ea';
      g.fillRect(0, 0, 256, 256);
      // прожилки
      g.strokeStyle = 'rgba(150,145,135,0.30)';
      for (let i = 0; i < 26; i++) {
        g.lineWidth = 0.5 + Math.random() * 1.4;
        g.beginPath();
        let x = Math.random() * 256, y = Math.random() * 256;
        g.moveTo(x, y);
        for (let s = 0; s < 5; s++) {
          x += (Math.random() - 0.5) * 90;
          y += (Math.random() - 0.5) * 90;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      // швы плитки 2x2
      g.strokeStyle = 'rgba(120,115,105,0.55)';
      g.lineWidth = 2;
      g.strokeRect(0, 0, 128, 128);
      g.strokeRect(128, 0, 128, 128);
      g.strokeRect(0, 128, 128, 128);
      g.strokeRect(128, 128, 128, 128);
    }), 7, 6);

    // тёмный гранит — фудкорт и кинотеатр
    T.granite = rep(nzCanvas(256, 256, (g) => {
      g.fillStyle = '#2f3540';
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 2600; i++) {
        const v = 40 + Math.random() * 70;
        g.fillStyle = 'rgba(' + v + ',' + (v + 6) + ',' + (v + 14) + ',0.55)';
        g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
      }
      g.strokeStyle = 'rgba(20,24,30,0.8)';
      g.lineWidth = 2;
      g.strokeRect(0, 0, 128, 128);
      g.strokeRect(128, 128, 128, 128);
    }), 8, 7);

    // бетон подвалов
    T.concrete = rep(nzCanvas(256, 256, (g) => {
      g.fillStyle = '#4b4f55';
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 1800; i++) {
        const v = 55 + Math.random() * 40;
        g.fillStyle = 'rgba(' + v + ',' + v + ',' + (v + 4) + ',0.5)';
        g.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
      }
      // разводы и потёки
      g.fillStyle = 'rgba(35,38,42,0.22)';
      for (let i = 0; i < 14; i++) {
        g.beginPath();
        g.arc(Math.random() * 256, Math.random() * 256, 8 + Math.random() * 26, 0, 6.3);
        g.fill();
      }
      // деформационные швы
      g.strokeStyle = 'rgba(30,33,38,0.75)';
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(128, 0); g.lineTo(128, 256); g.stroke();
      g.beginPath(); g.moveTo(0, 128); g.lineTo(256, 128); g.stroke();
    }), 9, 8);

    // асфальт паркинга
    T.asphalt = rep(nzCanvas(256, 256, (g) => {
      g.fillStyle = '#26292e';
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 3400; i++) {
        const v = 26 + Math.random() * 42;
        g.fillStyle = 'rgba(' + v + ',' + v + ',' + (v + 3) + ',0.6)';
        g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
      }
    }), 10, 9);

    // ковролин кинотеатра
    T.carpet = rep(nzCanvas(128, 128, (g) => {
      g.fillStyle = '#5a1626';
      g.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 1500; i++) {
        const v = Math.random();
        g.fillStyle = v > 0.5 ? 'rgba(120,30,50,0.5)' : 'rgba(50,10,22,0.5)';
        g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
      }
      // ромбовидный узор
      g.strokeStyle = 'rgba(200,160,80,0.20)';
      g.lineWidth = 1.5;
      for (let d = -128; d < 256; d += 32) {
        g.beginPath(); g.moveTo(d, 0); g.lineTo(d + 128, 128); g.stroke();
        g.beginPath(); g.moveTo(d, 128); g.lineTo(d + 128, 0); g.stroke();
      }
    }), 5, 4);

    // потолочная плита «армстронг» с перфорацией
    T.ceilTile = rep(nzCanvas(128, 128, (g) => {
      g.fillStyle = '#ece7dc';
      g.fillRect(0, 0, 128, 128);
      g.fillStyle = 'rgba(190,185,175,0.5)';
      for (let x = 6; x < 128; x += 9) {
        for (let y = 6; y < 128; y += 9) g.fillRect(x, y, 2, 2);
      }
      g.strokeStyle = 'rgba(150,146,138,0.85)';
      g.lineWidth = 2.5;
      g.strokeRect(0, 0, 128, 128);
    }), 12, 10);

    return T;
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  ВЫВЕСКИ магазинов — canvas с названием и подсветкой
  // ═════════════════════════════════════════════════════════════════════════
  function shopSign(THREE, DOC, text, color, wide) {
    const cv = DOC.createElement('canvas');
    cv.width = wide ? 1024 : 512;
    cv.height = 160;
    const g = cv.getContext('2d');
    if (!g) return null;
    g.clearRect(0, 0, cv.width, cv.height);
    // подложка
    g.fillStyle = 'rgba(10,12,18,0.92)';
    g.fillRect(0, 0, cv.width, cv.height);
    // неоновая рамка
    g.strokeStyle = color;
    g.lineWidth = 7;
    g.shadowColor = color;
    g.shadowBlur = 26;
    g.strokeRect(9, 9, cv.width - 18, cv.height - 18);
    // текст
    g.shadowBlur = 22;
    g.fillStyle = '#ffffff';
    g.font = '800 ' + (wide ? 82 : 78) + 'px Arial';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, cv.width / 2, cv.height / 2 + 4);
    const tex = new THREE.CanvasTexture(cv);
    return tex;
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  ГЛАВНЫЙ ПОСТРОИТЕЛЬ
  //  Вызывается из buildMallInterior с теми же аргументами.
  //    bx, bz  — центр зала (INTERIOR_BASE)
  //    floor   — 0..7 (B5..3)
  //    FH      — высота этажа (MALL_FH = 5.5)
  //    add     — регистрирует меш в сцене И в interiorObjects (для выгрузки)
  //    mat     — (color, emissive, intensity) => MeshLambertMaterial
  // ═════════════════════════════════════════════════════════════════════════
  function buildGrandMall(ctx) {
    const THREE = ctx.THREE, DOC = ctx.document;
    const bx = ctx.bx, bz = ctx.bz, F = ctx.F, FH = ctx.FH;
    const add = ctx.add, mat = ctx.mat;
    const sf = ctx.sf;              // торговый этаж: 0,1,2 (или <0 — подвал)
    const bsm = ctx.bsm;            // подвал?
    const floor = ctx.floor;        // абсолютный индекс 0..7
    const colliders = ctx.colliders;
    const interactables = ctx.interactables;
    const nzCanvas = ctx.nzCanvas;
    const addInteriorSign = ctx.addInteriorSign;
    const spawnInteriorNPC = ctx.spawnInteriorNPC;

    const T = makeTextures(THREE, nzCanvas);

    // ── B(w,h,d,color,x,y,z,ry,emissive,em) — короткий бокс в координатах зала ──
    const B = (w, h, d, color, x, y, z, ry, emissive, em) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, emissive || 0, em || 0));
      m.position.set(bx + x, F + y, bz + z);
      if (ry) m.rotation.y = ry;
      add(m);
      return m;
    };
    // меш с готовым материалом
    const M = (geo, material, x, y, z, ry) => {
      const m = new THREE.Mesh(geo, material);
      m.position.set(bx + x, F + y, bz + z);
      if (ry) m.rotation.y = ry;
      add(m);
      return m;
    };
    // коллайдер в координатах зала
    // ── коллайдер в координатах зала ──
    // ЗАЩИТА ОТ ЗАСТРЕВАНИЯ: игрок появляется РОВНО в центре зала (0,0) —
    // enterBuilding ставит его в INTERIOR_BASE. Если коллайдер накрывает
    // эту точку, игрок оказывается замурован и не может двинуться
    // (так и случилось со стойкой информации: она стояла в (2,2)
    // с коллайдером 5.2x5.2, то есть занимала -0.6..4.6).
    // Радиус игрока 0.5, берём с запасом 1.2.
    const SPAWN_R = 1.2;
    const colp = (x, z, w, d) => {
      const minX = x - w / 2, maxX = x + w / 2;
      const minZ = z - d / 2, maxZ = z + d / 2;
      if (minX - SPAWN_R < 0 && maxX + SPAWN_R > 0 &&
          minZ - SPAWN_R < 0 && maxZ + SPAWN_R > 0) {
        console.warn('[MALL] коллайдер накрывает точку спавна — пропущен:',
                     x, z, w, d);
        return;
      }
      colliders.push({
        minX: bx + minX, maxX: bx + maxX,
        minZ: bz + minZ, maxZ: bz + maxZ
      });
    };
    // точечный свет
    const light = (color, intensity, dist, x, y, z) => {
      const l = new THREE.PointLight(color, intensity, dist);
      l.position.set(bx + x, F + y, bz + z);
      add(l);
      return l;
    };
    // плоская вывеска на стене
    const signBoard = (text, color, x, y, z, ry, w, h) => {
      const tex = shopSign(THREE, DOC, text, color, w > 4);
      if (!tex) return null;
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true })
      );
      m.position.set(bx + x, F + y, bz + z);
      if (ry) m.rotation.y = ry;
      add(m);
      return m;
    };

    const api = { escalators: [], screens: [], flicker: [], neon: [] };

    // ═══════════════════════════════════════════════════════════════════════
    //  1. ПОЛ
    //     На торговых этажах 2 и 3 в полу — проём атриума, поэтому плита
    //     собирается из 4 полос вокруг дыры, а не одним куском.
    // ═══════════════════════════════════════════════════════════════════════
    const floorTex = bsm
      ? (floor === 0 ? T.concrete : (floor === 4 ? T.asphalt : T.concrete))
      : (sf === 2 ? T.granite : T.marble);
    const floorMat = new THREE.MeshLambertMaterial({ map: floorTex });

    const slabAround = (y, material, isFloor) => {
      // 4 полосы вокруг проёма ATRIUM
      const parts = [
        { w: MW, d: HALF_D + ATRIUM.z0, x: 0, z: (-HALF_D + ATRIUM.z0) / 2 },
        { w: MW, d: HALF_D - ATRIUM.z1, x: 0, z: (ATRIUM.z1 + HALF_D) / 2 },
        { w: HALF_W + ATRIUM.x0, d: ATRIUM.z1 - ATRIUM.z0,
          x: (-HALF_W + ATRIUM.x0) / 2, z: (ATRIUM.z0 + ATRIUM.z1) / 2 },
        { w: HALF_W - ATRIUM.x1, d: ATRIUM.z1 - ATRIUM.z0,
          x: (ATRIUM.x1 + HALF_W) / 2, z: (ATRIUM.z0 + ATRIUM.z1) / 2 }
      ];
      parts.forEach(p => {
        if (p.w <= 0.01 || p.d <= 0.01) return;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.d), material);
        m.rotation.x = isFloor ? -Math.PI / 2 : Math.PI / 2;
        m.position.set(bx + p.x, y, bz + p.z);
        add(m);
      });
    };

    if (sf > 0) {
      slabAround(F + 0.02, floorMat, true);   // этажи 2 и 3 — с дырой атриума
    } else {
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(MW, MD), floorMat);
      fl.rotation.x = -Math.PI / 2;
      fl.position.set(bx, F + 0.02, bz);
      add(fl);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  2. ПОТОЛОК
    // ═══════════════════════════════════════════════════════════════════════
    if (bsm) {
      // подвал: голая плита + балки + трубы
      const cl = new THREE.Mesh(new THREE.PlaneGeometry(MW, MD), mat(0x30343a));
      cl.rotation.x = Math.PI / 2;
      cl.position.set(bx, F + FH, bz);
      add(cl);
      for (let i = -3; i <= 3; i++) {
        B(MW, 0.45, 0.55, 0x3c4149, 0, FH - 0.3, i * 5, 0);
      }
      // трубы вдоль потолка
      [[-14, 0x7a4a2a], [-9, 0x2a5a7a], [10, 0x6a6a3a]].forEach(([px, pc]) => {
        const pipe = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.16, MD - 1, 8), mat(pc));
        pipe.rotation.x = Math.PI / 2;
        pipe.position.set(bx + px, F + FH - 0.72, bz);
        add(pipe);
        // хомуты
        for (let k = -2; k <= 2; k++) {
          B(0.34, 0.1, 0.1, 0x22262c, px, FH - 0.54, k * 7, 0);
        }
      });
    } else if (sf < 2) {
      // 1 и 2 этажи: подвесной потолок с проёмом атриума
      slabAround(F + FH, new THREE.MeshLambertMaterial({ map: T.ceilTile }), false);
    } else {
      // 3 этаж: сплошной потолок + световой фонарь над атриумом
      const cl = new THREE.Mesh(new THREE.PlaneGeometry(MW, MD),
        new THREE.MeshLambertMaterial({ map: T.ceilTile }));
      cl.rotation.x = Math.PI / 2;
      cl.position.set(bx, F + FH, bz);
      add(cl);
      // стеклянный фонарь над атриумом — свет с улицы
      const sky = new THREE.Mesh(
        new THREE.PlaneGeometry(ATRIUM.x1 - ATRIUM.x0, ATRIUM.z1 - ATRIUM.z0),
        new THREE.MeshBasicMaterial({ color: 0xdfefff, transparent: true, opacity: 0.85 }));
      sky.rotation.x = Math.PI / 2;
      sky.position.set(bx + (ATRIUM.x0 + ATRIUM.x1) / 2, F + FH - 0.05,
                       bz + (ATRIUM.z0 + ATRIUM.z1) / 2);
      add(sky);
      // переплёт фонаря
      for (let i = 0; i <= 4; i++) {
        const t = ATRIUM.x0 + (ATRIUM.x1 - ATRIUM.x0) * i / 4;
        B(0.14, 0.16, ATRIUM.z1 - ATRIUM.z0, 0x8a9098, t,
          FH - 0.12, (ATRIUM.z0 + ATRIUM.z1) / 2, 0);
      }
      light(0xdfefff, 1.15, 30, (ATRIUM.x0 + ATRIUM.x1) / 2, FH - 1.2,
            (ATRIUM.z0 + ATRIUM.z1) / 2);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  3. СТЕНЫ ПЕРИМЕТРА
    //     Южная стена 1-го этажа — стеклянный фасад со входом.
    // ═══════════════════════════════════════════════════════════════════════
    const wallC = bsm ? 0x5b6068 : 0xd8d3c6;

    // северная (за ней лифт и служебка)
    B(MW, FH, 0.5, wallC, 0, FH / 2, -HALF_D, 0);
    // западная
    B(0.5, FH, MD, wallC, -HALF_W, FH / 2, 0, 0);
    // восточная
    B(0.5, FH, MD, wallC, HALF_W, FH / 2, 0, 0);

    if (sf === 0) {
      // ── ЮЖНЫЙ ФАСАД: витражное стекло + вход ──
      const glass = new THREE.MeshPhongMaterial({
        color: 0xbfe4ff, transparent: true, opacity: 0.30,
        shininess: 130, specular: 0x9fd6ff
      });
      // простенки по краям
      B(8, FH, 0.5, wallC, -HALF_W + 4, FH / 2, HALF_D, 0);
      B(8, FH, 0.5, wallC, HALF_W - 4, FH / 2, HALF_D, 0);
      // стеклянные секции между ними
      for (let x = -14; x <= 14; x += 4) {
        const gl = new THREE.Mesh(new THREE.BoxGeometry(3.8, FH - 0.6, 0.14), glass);
        gl.position.set(bx + x, F + (FH - 0.6) / 2, bz + HALF_D);
        add(gl);
        // стойка витража
        B(0.22, FH, 0.34, 0x6f7681, x + 2, FH / 2, HALF_D, 0);
      }
      B(0.22, FH, 0.34, 0x6f7681, -16, FH / 2, HALF_D, 0);
      // верхняя балка фасада
      B(32, 0.6, 0.5, 0x6f7681, 0, FH - 0.3, HALF_D, 0);
      // вход: раздвижные двери по центру
      [-1, 1].forEach(s => {
        const d = new THREE.Mesh(new THREE.BoxGeometry(1.9, 3.0, 0.1), glass);
        d.position.set(bx + s * 1.0, F + 1.5, bz + HALF_D - 0.1);
        add(d);
        B(0.1, 3.0, 0.14, 0x9aa2ad, s * 1.95, 1.5, HALF_D - 0.1, 0);
      });
      signBoard('GRAND MALL', '#ffd24a', 0, 4.4, HALF_D - 0.35, Math.PI, 9, 1.15);
      light(0xfff0cc, 0.75, 20, 0, 4.0, HALF_D - 2);
    } else if (!bsm) {
      // верхние этажи: сплошное остекление южной стены
      const glass2 = new THREE.MeshPhongMaterial({
        color: 0xbfe4ff, transparent: true, opacity: 0.24, shininess: 120
      });
      for (let x = -18; x <= 18; x += 4) {
        const gl = new THREE.Mesh(new THREE.BoxGeometry(3.8, FH - 1.0, 0.14), glass2);
        gl.position.set(bx + x, F + FH / 2, bz + HALF_D);
        add(gl);
      }
      B(MW, 0.5, 0.5, wallC, 0, FH - 0.25, HALF_D, 0);
      B(MW, 0.5, 0.5, wallC, 0, 0.25, HALF_D, 0);
    } else {
      B(MW, FH, 0.5, wallC, 0, FH / 2, HALF_D, 0);
    }

    // коллайдеры стен
    colp(0, -HALF_D, MW, 0.9);
    colp(0, HALF_D, MW, 0.9);
    colp(-HALF_W, 0, 0.9, MD);
    colp(HALF_W, 0, 0.9, MD);

    // ═══════════════════════════════════════════════════════════════════════
    //  4. ЛИФТ — ЕДИНСТВЕННЫЙ на все 8 уровней
    //     КОНТРАКТ: liftX=16, liftZ=-8. LIFT_CAM.doorZ = bz-8-2.4 = LWALLZ,
    //     поэтому плоскость шахты обязана остаться на LWALLZ.
    //     Створки помечаются userData.isElevDoorL / isElevDoorR — их ищет
    //     код на стр. 16078 и двигает при открытии.
    // ═══════════════════════════════════════════════════════════════════════
    const liftX = LIFT_X, liftZ = LIFT_Z;
    const LWALLZ = liftZ - 2.4;        // плоскость шахты (КОНТРАКТ)
    const WALLF = LWALLZ + 0.25;       // лицевая плоскость стены
    const DOORZ = WALLF - 0.30;        // створки утоплены на 30 см внутрь
    const JAMBZ = WALLF + 0.03;        // наличник заподлицо

    // ── стена шахты: пилоны по бокам + перемычка (проём остаётся пустым) ──
    const SIDEW = (4.8 - (DOORW * 2 + 0.36)) / 2;
    [-1, 1].forEach(sx => {
      B(SIDEW, FH, 0.5, 0xc9c3b4,
        liftX + sx * (DOORW + 0.18 + SIDEW / 2), FH / 2, LWALLZ, 0);
    });
    B(DOORW * 2 + 0.36, FH - (DOORH + 0.42), 0.5, 0xc9c3b4,
      liftX, DOORH + 0.42 + (FH - (DOORH + 0.42)) / 2, LWALLZ, 0);

    // тёмные щёки ниши
    [-1, 1].forEach(sx => {
      B(0.1, DOORH + 0.42, 0.62, 0x14181f,
        liftX + sx * (DOORW + 0.13), (DOORH + 0.42) / 2, LWALLZ + 0.02, 0);
    });
    B(DOORW * 2 + 0.36, 0.1, 0.62, 0x14181f, liftX, DOORH + 0.38, LWALLZ + 0.02, 0);

    // ── ОБЪЁМНАЯ КАБИНА за проёмом (внешняя функция, уже отлажена) ──
    ctx.fzLiftCabin(bx, bz, F, FH, add, mat, B, liftX, LWALLZ, DOORW, DOORH);

    // ── СТВОРКИ (КОНТРАКТ: isElevDoorL / isElevDoorR + homeX) ──
    const doorMat = () => new THREE.MeshLambertMaterial({
      color: 0xaeb6c0, emissive: 0x1a2028, emissiveIntensity: 0.18
    });
    const dl = new THREE.Mesh(new THREE.BoxGeometry(DOORW, DOORH, 0.1), doorMat());
    dl.position.set(bx + liftX - DOORW / 2, F + DOORH / 2, bz + DOORZ);
    dl.userData.isElevDoorL = true;
    dl.userData.homeX = bx + liftX - DOORW / 2;
    add(dl);
    const dr = new THREE.Mesh(new THREE.BoxGeometry(DOORW, DOORH, 0.1), doorMat());
    dr.position.set(bx + liftX + DOORW / 2, F + DOORH / 2, bz + DOORZ);
    dr.userData.isElevDoorR = true;
    dr.userData.homeX = bx + liftX + DOORW / 2;
    add(dr);
    [-1, 1].forEach(sx => {
      B(0.05, DOORH - 0.2, 0.03, 0x8892a0, liftX + sx * DOORW * 0.55,
        DOORH / 2, DOORZ + 0.06, 0);
    });

    // ── стальной наличник ──
    const steelC = 0x39424e, steelLite = 0x59636f;
    [-1, 1].forEach(sx => {
      B(0.16, DOORH + 0.5, 0.1, steelC, liftX + sx * (DOORW + 0.1),
        (DOORH + 0.5) / 2, JAMBZ, 0);
      for (let rr = 0; rr < 7; rr++) {
        B(0.2, 0.04, 0.12, steelLite, liftX + sx * (DOORW + 0.1),
          0.4 + rr * 0.42, JAMBZ, 0);
      }
    });
    B(DOORW * 2 + 0.52, 0.18, 0.1, steelC, liftX, DOORH + 0.34, JAMBZ, 0);
    B(DOORW * 2 + 0.52, 0.05, 0.12, steelLite, liftX, DOORH + 0.46, JAMBZ, 0);
    B(DOORW * 2 + 0.3, 0.05, 0.5, 0x7c8794, liftX, 0.025, LWALLZ + 0.05, 0);

    // ── свет из щели над дверьми ──
    const slit = new THREE.Mesh(new THREE.PlaneGeometry(DOORW * 2, 0.09),
      mat(0xffe3ae, 0xffd48a, 0.9));
    slit.position.set(bx + liftX, F + DOORH + 0.16, bz + DOORZ + 0.06);
    add(slit);
    light(0xffd9a0, 0.5, 7, liftX, DOORH + 0.1, WALLF + 0.5);

    // ── ЖИВОЕ ТАБЛО (КОНТРАКТ: window.mallLiftInd = {ctx, tex}) ──
    const indCv = DOC.createElement('canvas');
    indCv.width = 256; indCv.height = 96;
    const indCtx = indCv.getContext('2d');
    const indTex = new THREE.CanvasTexture(indCv);
    ctx.setLiftInd({ ctx: indCtx, tex: indTex });
    const indPanel = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.62, 0.1), mat(0x14181f));
    indPanel.position.set(bx + liftX, F + DOORH + 0.78, bz + JAMBZ + 0.02);
    add(indPanel);
    const indScr = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 0.5),
      new THREE.MeshBasicMaterial({ map: indTex, transparent: true }));
    indScr.position.set(bx + liftX, F + DOORH + 0.78, bz + JAMBZ + 0.08);
    add(indScr);

    // ── панель вызова ──
    const cpX = liftX + DOORW + 0.75;
    B(0.42, 1.15, 0.12, 0x1b2028, cpX, 1.45, JAMBZ + 0.02, 0);
    [[0.28, 0x66ff99], [-0.16, 0xff9966]].forEach(([oy, cc]) => {
      const btn = new THREE.Mesh(new THREE.CircleGeometry(0.1, 14),
        new THREE.MeshBasicMaterial({ color: cc }));
      btn.position.set(bx + cpX, F + 1.45 + oy, bz + JAMBZ + 0.09);
      add(btn);
    });

    // холл лифта: подсветка и коврик
    light(0xfff2d8, 0.55, 12, liftX, FH - 1.0, LWALLZ + 2.2);
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.0), mat(0x2f3a4c));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(bx + liftX, F + 0.03, bz + LWALLZ + 2.0);
    add(rug);

    colp(liftX, LWALLZ, 5.2, 0.7);

    // ═══════════════════════════════════════════════════════════════════════
    //  5. ЭСКАЛАТОРЫ (только между торговыми этажами 1↔2↔3)
    //     КОНТРАКТ: MALL_ESC.xUp = [-14,-12], zBottom=10, zTop=0.
    //     На 3 этаже (sf===2) вверх ехать некуда — там только спуск.
    // ═══════════════════════════════════════════════════════════════════════
    const ESC = ctx.MALL_ESC;
    const escZ0 = ESC.zBottom, escZ1 = ESC.zTop;
    const run = escZ0 - escZ1;
    const riseS = FH - 0.55;
    const escAng = Math.atan2(riseS, run);
    const slopeLen = Math.sqrt(run * run + riseS * riseS);

    // ── ЭСКАЛАТОР: настоящая конструкция, а не наклонная доска ──
    //    Собирается из: бетонного основания, несущей фермы с раскосами,
    //    гребёнок на входе и выходе, ступеней с рифлением и подступёнками,
    //    стеклянных балюстрад, движущегося поручня, плинтусов-щёток,
    //    подсветки по кромке и таблички направления.
    const buildEscalator = (ex, dirUp) => {
      const g = new THREE.Group();
      const midZ = (escZ0 + escZ1) / 2;
      const midY = riseS / 2 + 0.35;

      g.userData = {
        isEscalator: true, dir: dirUp ? 1 : -1, steps: [], speed: 0.09,
        rise: riseS, baseX: bx + ex, baseY: F, baseZ: bz
      };

      // локальный помощник: меш внутри группы (координаты — мировые)
      const gm = (geo, material, x, y, z, rx, ry) => {
        const m = new THREE.Mesh(geo, material);
        m.position.set(bx + x, F + y, bz + z);
        if (rx) m.rotation.x = rx;
        if (ry) m.rotation.y = ry;
        g.add(m);
        return m;
      };
      const gb = (w, h, d, color, x, y, z, rx) =>
        gm(new THREE.BoxGeometry(w, h, d), mat(color), x, y, z, rx);

      // ══ 1. БЕТОННЫЕ ОСНОВАНИЯ (приямки внизу и вверху) ══
      gb(2.3, 0.35, 2.0, 0x8f959d, ex, 0.17, escZ0 + 1.0);
      gb(2.3, 0.35, 2.0, 0x8f959d, ex, riseS + 0.17, escZ1 - 1.0);

      // ══ 2. НЕСУЩАЯ ФЕРМА с раскосами ══
      const truss = gb(1.86, 0.62, slopeLen, 0x767c85, ex, midY, midZ, -escAng);
      truss.castShadow = true;
      // нижний пояс фермы
      gb(1.9, 0.16, slopeLen, 0x5c626b, ex, midY - 0.42, midZ, -escAng);
      // раскосы по бокам (зигзаг)
      const nDiag = 9;
      for (let i = 0; i < nDiag; i++) {
        const t = (i + 0.5) / nDiag;
        const zz = escZ0 - run * t;
        const yy = 0.62 + riseS * t - 0.1;
        [-1, 1].forEach(s => {
          const dg = gb(0.09, 0.5, 0.09, 0x4e545c, ex + s * 0.94, yy, zz);
          dg.rotation.x = -escAng + (i % 2 ? 0.7 : -0.7);
        });
      }

      // ══ 3. ПОЛОТНО И СТУПЕНИ ══
      // тёмная «шахта» под ступенями, чтобы не просвечивало насквозь
      gb(1.56, 0.12, slopeLen, 0x23272e, ex, riseS / 2 + 0.55, midZ, -escAng);

      const stepMat = () => new THREE.MeshLambertMaterial({
        color: 0xc2c7cf, emissive: 0x4a525e, emissiveIntensity: 0.07
      });
      const NSTEP = 18;
      for (let st = 0; st < NSTEP; st++) {
        const s01 = st / NSTEP;
        // проступь
        const step = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.09, 0.60), stepMat());
        step.userData.s = s01;
        step.position.set(bx + ex, F + 0.62 + riseS * s01, bz + escZ0 - run * s01);
        g.add(step);
        g.userData.steps.push(step);
        // рифление проступи — 5 продольных рёбер
        for (let r = 0; r < 5; r++) {
          const rib = new THREE.Mesh(
            new THREE.BoxGeometry(1.4, 0.022, 0.05),
            mat(0x9aa1ab));
          rib.userData.s = s01;
          rib.userData.rib = -0.22 + r * 0.11;
          rib.position.set(bx + ex, F + 0.675 + riseS * s01,
                           bz + escZ0 - run * s01 + rib.userData.rib);
          g.add(rib);
          g.userData.steps.push(rib);   // едут вместе со ступенью
        }
        // подступёнок (вертикальная стенка ступени)
        const ris = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.30, 0.05),
          mat(0x878e98));
        ris.userData.s = s01;
        ris.userData.riser = true;
        ris.position.set(bx + ex, F + 0.47 + riseS * s01,
                         bz + escZ0 - run * s01 - 0.30);
        g.add(ris);
        g.userData.steps.push(ris);
      }

      // ══ 4. ГРЕБЁНКИ на входе и выходе ══
      [[escZ0 + 0.42, 0.62], [escZ1 - 0.42, riseS + 0.62]].forEach(([cz, cy]) => {
        gb(1.5, 0.06, 0.42, 0xd9a520, ex, cy, cz);
        // зубцы гребёнки
        for (let k = 0; k < 15; k++) {
          gb(0.055, 0.035, 0.30, 0xf0c040, ex - 0.66 + k * 0.095, cy + 0.045, cz);
        }
      });

      // ══ 5. БАЛЮСТРАДЫ: стекло + поручень + плинтус-щётка ══
      const glassM = new THREE.MeshPhongMaterial({
        color: 0xcfe9ff, transparent: true, opacity: 0.28,
        shininess: 140, specular: 0xffffff
      });
      [-1, 1].forEach(s => {
        const sx = ex + s * 0.86;
        // стекло
        gm(new THREE.BoxGeometry(0.07, 1.02, slopeLen), glassM, sx, midY + 0.92, midZ, -escAng);
        // поручень (движется — анимируется по userData.handrail)
        const hand = gb(0.16, 0.13, slopeLen, 0x1b1f26, sx, midY + 1.48, midZ, -escAng);
        hand.userData.handrail = true;
        // направляющая под поручнем
        gb(0.11, 0.06, slopeLen, 0x646b74, sx, midY + 1.38, midZ, -escAng);
        // плинтус-щётка вдоль ступеней (жёлтая полоса безопасности)
        gb(0.05, 0.16, slopeLen, 0xd9a520, ex + s * 0.73, riseS / 2 + 0.74, midZ, -escAng);
        // подсветка кромки
        gm(new THREE.BoxGeometry(0.04, 0.035, slopeLen),
           mat(0x66ccff, 0x66ccff, 0.85), sx - s * 0.05, midY + 0.42, midZ, -escAng);
        // закруглённые окончания балюстрады
        [[escZ0 + 0.9, 0.95], [escZ1 - 0.9, riseS + 0.95]].forEach(([cz, cy]) => {
          const cap = new THREE.Mesh(
            new THREE.CylinderGeometry(0.52, 0.52, 0.07, 14, 1, false, 0, Math.PI),
            mat(0x1b1f26));
          cap.rotation.z = Math.PI / 2;
          cap.position.set(bx + sx, F + cy, bz + cz);
          g.add(cap);
        });
      });

      // ══ 6. ПОДСВЕТКА ══
      const und = new THREE.PointLight(0x66ccff, 0.5, 11);
      und.position.set(bx + ex, F + riseS / 2 + 0.25, bz + midZ);
      g.add(und);
      const topL = new THREE.PointLight(0xfff0d0, 0.35, 7);
      topL.position.set(bx + ex, F + riseS + 1.4, bz + escZ1 - 0.6);
      g.add(topL);

      // ══ 7. ТАБЛИЧКА НАПРАВЛЕНИЯ ══
      const arrowTex = shopSign(THREE, DOC, dirUp ? '▲ ВВЕРХ' : '▼ ВНИЗ',
                                dirUp ? '#66ff9a' : '#ffb066', false);
      if (arrowTex) {
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.46),
          new THREE.MeshBasicMaterial({ map: arrowTex, transparent: true }));
        const sz = dirUp ? escZ0 + 1.6 : escZ1 - 1.6;
        const sy = (dirUp ? 0 : riseS) + 2.5;
        pl.position.set(bx + ex, F + sy, bz + sz);
        if (!dirUp) pl.rotation.y = Math.PI;
        g.add(pl);
        // стойка таблички
        gb(0.08, 2.5, 0.08, 0x39424e, ex, sy - 1.25, sz);
      }

      // ══ 8. КОЛЛАЙДЕРЫ: борта непроходимы, вход/выход — открыты ══
      // (сам жёлоб оставляем свободным, поездка идёт по interactable)
      [-1, 1].forEach(s => {
        for (let k = 0; k < 6; k++) {
          const t = (k + 0.5) / 6;
          colp(ex + s * 0.9, escZ0 - run * t, 0.34, run / 6);
        }
      });

      add(g);
      api.escalators.push(g);
      return g;
    };

    if (sf >= 0 && sf < 2) {
      // на 1 и 2 этаже — оба эскалатора (наверх и обратно вниз)
      buildEscalator(ESC.xUp[0], true);
      buildEscalator(ESC.xUp[1], false);
      interactables.push({
        position: { x: bx + ESC.xUp[0], y: F, z: bz + escZ0 + 0.9 },
        type: 'escalator_up', name: '🛗⬆ На эскалаторе вверх',
        range: 2.6, interior: true
      });
    }
    if (sf > 0) {
      // спуск есть на всех этажах выше первого
      if (sf === 2) buildEscalator(ESC.xUp[1], false);
      interactables.push({
        position: { x: bx + ESC.xUp[1], y: F, z: bz + escZ1 - 0.9 },
        type: 'escalator_down', name: '🛗⬇ На эскалаторе вниз',
        range: 2.6, interior: true
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  6. ПЕРИЛА АТРИУМА — на этажах 2 и 3, чтобы не упасть в проём
    //     Проходы к эскалаторам остаются открытыми.
    // ═══════════════════════════════════════════════════════════════════════
    if (sf > 0) {
      const railGlass = new THREE.MeshPhongMaterial({
        color: 0xbfe4ff, transparent: true, opacity: 0.32, shininess: 110
      });
      const rail = (x, z, w2, d2) => {
        const gl = new THREE.Mesh(new THREE.BoxGeometry(w2, 1.1, d2), railGlass);
        gl.position.set(bx + x, F + 0.55, bz + z);
        add(gl);
        // поручень сверху
        const hr = new THREE.Mesh(new THREE.BoxGeometry(w2 + 0.1, 0.09, d2 + 0.1), mat(0x2a3038));
        hr.position.set(bx + x, F + 1.14, bz + z);
        add(hr);
        colp(x, z, Math.max(w2, 0.3), Math.max(d2, 0.3));
      };
      // северная и южная стороны проёма
      rail((ATRIUM.x0 + ATRIUM.x1) / 2, ATRIUM.z0, ATRIUM.x1 - ATRIUM.x0, 0.14);
      rail((ATRIUM.x0 + ATRIUM.x1) / 2, ATRIUM.z1, ATRIUM.x1 - ATRIUM.x0, 0.14);
      // восточная сторона (западная — там эскалаторы)
      rail(ATRIUM.x1, (ATRIUM.z0 + ATRIUM.z1) / 2, 0.14, ATRIUM.z1 - ATRIUM.z0);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  7. ОБЩИЕ ЭЛЕМЕНТЫ ТОРГОВЫХ ЭТАЖЕЙ
    // ═══════════════════════════════════════════════════════════════════════

    // ── магазин-бокс: витрина со стеклом, вывеска, товар внутри ──
    const makeShop = (o) => {
      // o: {x, z, w, d, name, color, ry, goods}
      const w2 = o.w, d2 = o.d, ry = o.ry || 0;
      const glassM = new THREE.MeshPhongMaterial({
        color: 0xcfe9ff, transparent: true, opacity: 0.22, shininess: 140
      });

      // задняя стена и боковины
      const back = new THREE.Mesh(new THREE.BoxGeometry(w2, FH - 0.4, 0.3), mat(0xe8e4da));
      back.position.set(bx + o.x, F + (FH - 0.4) / 2, bz + o.z - d2 / 2);
      if (ry) { back.rotation.y = ry; }
      add(back);
      [-1, 1].forEach(sx => {
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.3, FH - 0.4, d2), mat(0xe0dbd0));
        side.position.set(bx + o.x + sx * w2 / 2, F + (FH - 0.4) / 2, bz + o.z);
        if (ry) side.rotation.y = ry;
        add(side);
      });
      // акцентная панель фирменного цвета на задней стене
      const acc = new THREE.Mesh(new THREE.BoxGeometry(w2 - 0.6, 2.2, 0.08), mat(o.color, o.color, 0.22));
      acc.position.set(bx + o.x, F + 2.4, bz + o.z - d2 / 2 + 0.2);
      add(acc);

      // витрина: стекло по фронту с проходом посередине
      const openW = 2.2;
      const sideGlass = (w2 - openW) / 2;
      [-1, 1].forEach(sx => {
        if (sideGlass <= 0.2) return;
        const gl = new THREE.Mesh(new THREE.BoxGeometry(sideGlass, FH - 1.0, 0.1), glassM);
        gl.position.set(bx + o.x + sx * (openW / 2 + sideGlass / 2),
                        F + (FH - 1.0) / 2, bz + o.z + d2 / 2);
        add(gl);
      });
      // перемычка над входом в магазин
      const lint = new THREE.Mesh(new THREE.BoxGeometry(w2, 0.9, 0.34), mat(0xf2efe8));
      lint.position.set(bx + o.x, F + FH - 0.85, bz + o.z + d2 / 2);
      add(lint);

      // вывеска
      signBoard(o.name, o.signColor || '#ffffff', o.x, FH - 0.85, o.z + d2 / 2 + 0.2,
                Math.PI, Math.min(w2 - 0.4, 7), 0.78);
      // подсветка магазина
      light(0xfff4e0, 0.5, 11, o.x, FH - 1.4, o.z);

      // ── наполнение по типу ──
      const g = o.goods;
      if (g === 'clothes') {
        // вешала с одеждой
        [-1, 1].forEach(sx => {
          const barX = o.x + sx * (w2 / 2 - 1.1);
          const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, d2 - 1.4, 8), mat(0xb0b6be));
          bar.rotation.x = Math.PI / 2;
          bar.position.set(bx + barX, F + 1.65, bz + o.z - 0.2);
          add(bar);
          // стойки
          [-1, 1].forEach(sz => {
            B(0.07, 1.65, 0.07, 0x9aa0a8, barX, 0.82, o.z - 0.2 + sz * (d2 / 2 - 0.8), 0);
          });
          // одежда
          const cols = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0xecf0f1, 0x1abc9c];
          for (let k = 0; k < 7; k++) {
            const zz = o.z - d2 / 2 + 1.0 + k * (d2 - 2.0) / 6;
            B(0.42, 1.0, 0.12, cols[k % cols.length], barX, 1.1, zz, 0);
          }
        });
        // манекены у витрины
        [-0.7, 0.7].forEach(sx => {
          const mx = o.x + sx * 1.5;
          const tor = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.15, 0.75, 10), mat(0xe6e1d8));
          tor.position.set(bx + mx, F + 1.35, bz + o.z + d2 / 2 - 1.1);
          add(tor);
          B(0.1, 0.85, 0.1, 0xb8b3ab, mx, 0.45, o.z + d2 / 2 - 1.1, 0);
          const bs = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 12), mat(0x8a8f98));
          bs.position.set(bx + mx, F + 0.05, bz + o.z + d2 / 2 - 1.1);
          add(bs);
        });
        colp(o.x, o.z - d2 / 2, w2, 0.6);
      } else if (g === 'electronics') {
        // столы с ноутбуками и стена телевизоров
        for (let k = 0; k < 3; k++) {
          const tx = o.x - w2 / 2 + 1.6 + k * (w2 - 3.2) / 2;
          B(1.5, 0.1, 0.85, 0xf0ece4, tx, 0.9, o.z + 0.3, 0);
          B(0.12, 0.9, 0.12, 0xa8aeb6, tx, 0.45, o.z + 0.3, 0);
          // ноутбук
          B(0.5, 0.03, 0.36, 0xb9c0c8, tx, 0.97, o.z + 0.3, 0);
          const scr = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.02),
            mat(0x0d1520, 0x3fa9ff, 0.55));
          scr.position.set(bx + tx, F + 1.15, bz + o.z + 0.12);
          scr.rotation.x = -0.28;
          add(scr);
          api.screens.push(scr);
        }
        // телевизоры на задней стене
        for (let k = 0; k < 4; k++) {
          const tx = o.x - w2 / 2 + 1.2 + k * (w2 - 2.4) / 3;
          const tv = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.68, 0.09),
            mat(0x0a0d12, [0x3fa9ff, 0xff5a7a, 0x64ffa0, 0xffc84a][k], 0.5));
          tv.position.set(bx + tx, F + 2.5, bz + o.z - d2 / 2 + 0.3);
          add(tv);
          api.screens.push(tv);
        }
        colp(o.x, o.z + 0.3, w2 - 1, 1.2);
      } else if (g === 'food') {
        // прилавок и меню
        B(w2 - 1.2, 1.1, 0.9, o.color, o.x, 0.55, o.z + d2 / 2 - 1.2, 0);
        B(w2 - 1.0, 0.1, 1.1, 0xf4f1ea, o.x, 1.16, o.z + d2 / 2 - 1.2, 0);
        // меню-борд
        const menu = new THREE.Mesh(new THREE.BoxGeometry(w2 - 1.6, 1.3, 0.08),
          mat(0x14181f, 0xffb347, 0.22));
        menu.position.set(bx + o.x, F + 3.0, bz + o.z - d2 / 2 + 0.3);
        add(menu);
        // витрина с едой
        for (let k = 0; k < 5; k++) {
          const fx = o.x - w2 / 2 + 1.2 + k * (w2 - 2.4) / 4;
          B(0.34, 0.2, 0.34, [0xe8b04b, 0xd94f3d, 0xf2d06b, 0xb5651d, 0xe0e0d0][k],
            fx, 1.28, o.z + d2 / 2 - 1.2, 0);
        }
        colp(o.x, o.z + d2 / 2 - 1.2, w2 - 1, 1.1);
      } else if (g === 'cosmetics') {
        // круглые островки с флаконами
        for (let k = 0; k < 2; k++) {
          const cxx = o.x - 1.6 + k * 3.2;
          const isl = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.05, 0.95, 14), mat(0xf6eef2));
          isl.position.set(bx + cxx, F + 0.48, bz + o.z);
          add(isl);
          const top = new THREE.Mesh(new THREE.CylinderGeometry(1.06, 1.06, 0.06, 14),
            mat(0xffffff, 0xffd9e8, 0.16));
          top.position.set(bx + cxx, F + 0.98, bz + o.z);
          add(top);
          for (let b2 = 0; b2 < 7; b2++) {
            const a = b2 / 7 * Math.PI * 2;
            B(0.13, 0.26, 0.13, [0xffd700, 0xff8fb0, 0x9fd8ff, 0xd9b3ff][b2 % 4],
              cxx + Math.cos(a) * 0.62, 1.14, o.z + Math.sin(a) * 0.62, 0);
          }
          colp(cxx, o.z, 2.2, 2.2);
        }
      } else if (g === 'books') {
        // стеллажи
        for (let k = 0; k < 3; k++) {
          const sx2 = o.x - w2 / 2 + 1.4 + k * (w2 - 2.8) / 2;
          B(1.5, 2.6, 0.45, 0x8a5a35, sx2, 1.3, o.z - d2 / 2 + 0.9, 0);
          for (let sh = 0; sh < 4; sh++) {
            for (let bk = 0; bk < 9; bk++) {
              B(0.13, 0.42, 0.3,
                [0xc0392b, 0x27ae60, 0x2980b9, 0xf39c12, 0x8e44ad][bk % 5],
                sx2 - 0.62 + bk * 0.155, 0.42 + sh * 0.62, o.z - d2 / 2 + 1.0, 0);
            }
          }
          colp(sx2, o.z - d2 / 2 + 0.9, 1.6, 0.6);
        }
      } else if (g === 'toys') {
        // ящики с игрушками и большой мишка
        for (let k = 0; k < 4; k++) {
          const tx = o.x - w2 / 2 + 1.3 + k * (w2 - 2.6) / 3;
          B(1.0, 0.8, 1.0, [0xff6b9d, 0x00b4d8, 0x2ecc71, 0xffc300][k], tx, 0.4, o.z + 0.4, 0);
          colp(tx, o.z + 0.4, 1.1, 1.1);
        }
        const bear = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), mat(0xa9744f));
        bear.position.set(bx + o.x, F + 1.5, bz + o.z - d2 / 2 + 1.2);
        add(bear);
        const bh = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 10), mat(0xbb845c));
        bh.position.set(bx + o.x, F + 2.3, bz + o.z - d2 / 2 + 1.2);
        add(bh);
      } else if (g === 'sport') {
        // стойки с мячами и тренажёр
        for (let k = 0; k < 6; k++) {
          const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8),
            mat([0xe67e22, 0xecf0f1, 0x2c3e50][k % 3]));
          ball.position.set(bx + o.x - 2.2 + k * 0.9, F + 1.35, bz + o.z - d2 / 2 + 0.8);
          add(ball);
        }
        B(w2 - 1.5, 0.12, 0.5, 0xb0b6be, o.x, 1.2, o.z - d2 / 2 + 0.8, 0);
        B(1.2, 1.4, 0.7, 0x2c3e50, o.x + w2 / 2 - 1.4, 0.7, o.z + 0.6, 0);
        colp(o.x + w2 / 2 - 1.4, o.z + 0.6, 1.3, 0.8);
      } else if (g === 'jewelry') {
        // низкие стеклянные витрины с подсветкой
        for (let k = 0; k < 2; k++) {
          const jx = o.x - 1.5 + k * 3.0;
          B(2.4, 0.9, 0.9, 0x2b2f36, jx, 0.45, o.z, 0);
          const gl = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.9),
            new THREE.MeshPhongMaterial({
              color: 0xdff2ff, transparent: true, opacity: 0.3, shininess: 150
            }));
          gl.position.set(bx + jx, F + 1.16, bz + o.z);
          add(gl);
          for (let r = 0; r < 5; r++) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.022, 6, 12), mat(0xffd700, 0xffd700, 0.4));
            ring.rotation.x = Math.PI / 2;
            ring.position.set(bx + jx - 0.8 + r * 0.4, F + 1.0, bz + o.z);
            add(ring);
          }
          light(0xfff0b0, 0.35, 5, jx, 1.7, o.z);
          colp(jx, o.z, 2.5, 1.0);
        }
      }
    };

    // ── скамейка ──
    const bench = (x, z, ry) => {
      const g = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 0.62), mat(0x9c6b42));
      seat.position.y = 0.46; g.add(seat);
      [-0.85, 0.85].forEach(sx => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.46, 0.5), mat(0x4a4f57));
        leg.position.set(sx, 0.23, 0); g.add(leg);
      });
      const bk = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.1), mat(0x9c6b42));
      bk.position.set(0, 0.78, -0.26); g.add(bk);
      g.position.set(bx + x, F, bz + z);
      if (ry) g.rotation.y = ry;
      add(g);
      colp(x, z, 2.4, 0.8);
    };

    // ── растение в кадке ──
    const plant = (x, z) => {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.32, 0.55, 12), mat(0x8d6e56));
      pot.position.set(bx + x, F + 0.27, bz + z);
      add(pot);
      for (let k = 0; k < 6; k++) {
        const a = k / 6 * Math.PI * 2;
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), mat(0x2f7d3f));
        leaf.position.set(bx + x + Math.cos(a) * 0.3, F + 1.0 + (k % 2) * 0.3,
                          bz + z + Math.sin(a) * 0.3);
        leaf.scale.set(1, 1.5, 1);
        add(leaf);
      }
      colp(x, z, 0.9, 0.9);
    };

    // ── урна ──
    const bin = (x, z) => {
      const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.72, 10), mat(0x3f4650));
      b2.position.set(bx + x, F + 0.36, bz + z);
      add(b2);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.07, 10), mat(0x2a3038));
      lid.position.set(bx + x, F + 0.75, bz + z);
      add(lid);
    };

    // ── указатель этажа ──
    const floorSign = (label, x, z) => {
      B(0.14, 2.6, 0.14, 0x39424e, x, 1.3, z, 0);
      signBoard(label, '#9fd8ff', x, 2.85, z, 0, 3.2, 0.62);
      signBoard(label, '#9fd8ff', x, 2.85, z, Math.PI, 3.2, 0.62);
    };

    // ═══════════════════════════════════════════════════════════════════════
    //  ДЕКОР И ДЕТАЛИ — то, что превращает коробку в настоящий торговый центр
    // ═══════════════════════════════════════════════════════════════════════

    // ── КАРНИЗ ПО ПЕРИМЕТРУ с подсветкой (потолочная линия) ──
    const buildCornice = () => {
      const cy = FH - 0.55;
      [[0, -HALF_D + 0.4, MW, 0.5], [0, HALF_D - 0.4, MW, 0.5],
       [-HALF_W + 0.4, 0, 0.5, MD], [HALF_W - 0.4, 0, 0.5, MD]].forEach(([x, z, w, d]) => {
        // короб карниза
        B(w, 0.42, d, 0xe4e0d6, x, cy, z, 0);
        // светящаяся кромка
        const gl = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, 0.07, d * 0.98),
          mat(0xfff3d8, 0xfff0cc, 0.75));
        gl.position.set(bx + x, F + cy - 0.24, bz + z);
        add(gl);
      });
    };

    // ── ПЛИНТУС по низу стен ──
    const buildSkirting = () => {
      const col = bsm ? 0x3f444b : 0x9aa0a8;
      [[0, -HALF_D + 0.3, MW, 0.2], [0, HALF_D - 0.3, MW, 0.2],
       [-HALF_W + 0.3, 0, 0.2, MD], [HALF_W - 0.3, 0, 0.2, MD]].forEach(([x, z, w, d]) => {
        B(w, 0.16, d, col, x, 0.08, z, 0);
      });
    };

    // ── ПОДВЕСНЫЕ УКАЗАТЕЛИ-НАВИГАЦИЯ (как в настоящих ТЦ) ──
    const hangSign = (text, color, x, z, ry) => {
      // тросы
      [-1, 1].forEach(s => {
        const wire = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012, 0.012, 1.1, 5), mat(0x8a9098));
        wire.position.set(bx + x + s * 1.5, F + FH - 0.55, bz + z);
        add(wire);
      });
      // панель
      B(3.4, 0.72, 0.09, 0x161b24, x, FH - 1.4, z, ry);
      const tex = shopSign(THREE, DOC, text, color, false);
      if (tex) {
        [0, Math.PI].forEach(extra => {
          const pl = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.6),
            new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
          pl.position.set(bx + x, F + FH - 1.4, bz + z + (extra ? -0.06 : 0.06));
          pl.rotation.y = (ry || 0) + extra;
          add(pl);
        });
      }
    };

    // ── ЭСКАЛАТОРНАЯ ПЛОЩАДКА: плитка другого цвета вокруг входа ──
    const escApron = (ex, ez) => {
      const ap = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2),
        mat(0xd8cfc0, 0xd8cfc0, 0.05));
      ap.rotation.x = -Math.PI / 2;
      ap.position.set(bx + ex, F + 0.045, bz + ez);
      add(ap);
      // жёлтая предупредительная кромка
      [-1, 1].forEach(s => {
        const ln = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.14),
          mat(0xe8c23a, 0xe8c23a, 0.2));
        ln.rotation.x = -Math.PI / 2;
        ln.position.set(bx + ex, F + 0.05, bz + ez + s * 1.6);
        add(ln);
      });
    };

    // ── ВИТРИННЫЙ МАНЕКЕН (детальнее, чем цилиндр) ──
    const mannequin = (x, z, col, ry) => {
      const g = new THREE.Group();
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.72, 10), mat(col));
      torso.position.y = 1.32; g.add(torso);
      const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.26, 10), mat(0xe6e1d8));
      hips.position.y = 0.86; g.add(hips);
      [-0.08, 0.08].forEach(s => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.78, 8), mat(0xe6e1d8));
        leg.position.set(s, 0.4, 0); g.add(leg);
      });
      [-0.26, 0.26].forEach(s => {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.62, 8), mat(col));
        arm.position.set(s, 1.34, 0);
        arm.rotation.z = s > 0 ? -0.22 : 0.22;
        g.add(arm);
      });
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8), mat(0xe6e1d8));
      neck.position.y = 1.73; g.add(neck);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), mat(0xe6e1d8));
      head.position.y = 1.88; g.add(head);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.05, 14), mat(0x8a8f98));
      base.position.y = 0.025; g.add(base);
      g.position.set(bx + x, F, bz + z);
      if (ry) g.rotation.y = ry;
      add(g);
    };

    // ── ТЕЛЕЖКА покупателя ──
    const cart = (x, z, ry) => {
      const g = new THREE.Group();
      const basket = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.4, 0.92), mat(0xb8bfc8));
      basket.position.y = 0.62; g.add(basket);
      const inner = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.34, 0.85), mat(0x8f959d));
      inner.position.y = 0.65; g.add(inner);
      [[-0.26, 0.36], [0.26, 0.36], [-0.26, -0.36], [0.26, -0.36]].forEach(([wx, wz]) => {
        const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 8), mat(0x2a2f36));
        wh.rotation.z = Math.PI / 2;
        wh.position.set(wx, 0.07, wz); g.add(wh);
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.36, 6), mat(0x8f959d));
        post.position.set(wx, 0.25, wz); g.add(post);
      });
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 6), mat(0xd94f3d));
      handle.rotation.z = Math.PI / 2;
      handle.position.set(0, 0.92, -0.48); g.add(handle);
      g.position.set(bx + x, F, bz + z);
      if (ry) g.rotation.y = ry;
      add(g);
    };

    // ── ФОТОЗОНА / рекламный ролл-ап ──
    const rollup = (x, z, color, ry) => {
      B(0.06, 2.0, 1.0, 0x14181f, x, 1.15, z, ry);
      const pan = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.9),
        mat(0x1a1f28, color, 0.42));
      pan.position.set(bx + x + 0.04, F + 1.15, bz + z);
      pan.rotation.y = (ry || 0) + Math.PI / 2;
      add(pan);
      api.screens.push(pan);
      B(0.5, 0.06, 1.1, 0x39424e, x, 0.06, z, ry);
    };

    // ── ЛЕСТНИЦА-ЭВАКУАЦИЯ (видимая деталь у стены) ──
    const fireExit = (x, z, ry) => {
      B(1.6, 2.5, 0.22, 0x1f6b3a, x, 1.25, z, ry);
      B(1.4, 2.25, 0.06, 0x2a7d46, x, 1.25, z + 0.1, ry);
      const tex = shopSign(THREE, DOC, 'ВЫХОД', '#7dffa8', false);
      if (tex) {
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.4),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
        pl.position.set(bx + x, F + 2.75, bz + z + 0.12);
        if (ry) pl.rotation.y = ry;
        add(pl);
      }
      light(0x66ff99, 0.28, 5, x, 2.8, z + 0.4);
    };

    // ── ОГНЕТУШИТЕЛЬ И ПОЖАРНЫЙ ЩИТ ──
    const fireBox = (x, z) => {
      B(0.5, 0.9, 0.3, 0xc0392b, x, 0.75, z, 0);
      const ext = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.42, 8), mat(0xe74c3c));
      ext.position.set(bx + x, F + 0.75, bz + z + 0.2);
      add(ext);
    };

    // ── КАМЕРА НАБЛЮДЕНИЯ ──
    const cctv = (x, z, ry) => {
      const g = new THREE.Group();
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6), mat(0x8a9098));
      arm.rotation.z = Math.PI / 2; arm.position.set(0.15, 0, 0); g.add(arm);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.14), mat(0x2f353d));
      g.add(body);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.08, 10), mat(0x0a0d12));
      lens.rotation.z = Math.PI / 2; lens.position.set(-0.18, 0, 0); g.add(lens);
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0xff3344 }));
      led.position.set(-0.1, 0.05, 0.06); g.add(led);
      g.position.set(bx + x, F + FH - 0.75, bz + z);
      if (ry) g.rotation.y = ry;
      add(g);
    };

    // ── ВЕНТРЕШЁТКА на стене ──
    const grille = (x, z, ry) => {
      B(0.9, 0.55, 0.06, 0x6a7078, x, FH - 1.1, z, ry);
      for (let k = 0; k < 6; k++) {
        B(0.84, 0.035, 0.09, 0x4e545c, x, FH - 1.32 + k * 0.09, z, ry);
      }
    };

    // ── БАННЕР-РАСТЯЖКА через атриум ──
    const atriumBanner = (text, color, y) => {
      const cxm = (ATRIUM.x0 + ATRIUM.x1) / 2;
      const czm = (ATRIUM.z0 + ATRIUM.z1) / 2;
      const tex = shopSign(THREE, DOC, text, color, true);
      if (!tex) return;
      [0, Math.PI].forEach(extra => {
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.5),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
        pl.position.set(bx + cxm, F + y, bz + czm + (extra ? -0.05 : 0.05));
        pl.rotation.y = extra;
        add(pl);
      });
      // тросы к потолку
      [-4.8, 4.8].forEach(s => {
        const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.4, 5), mat(0x8a9098));
        wire.position.set(bx + cxm + s, F + y + 1.45, bz + czm);
        add(wire);
      });
    };

    // ═══════════════════════════════════════════════════════════════════════
    //  8. ЭТАЖ 1 — МОДА, ПАРФЮМЕРИЯ, ЮВЕЛИРКА
    // ═══════════════════════════════════════════════════════════════════════
    if (sf === 0) {
      floorSign('1 ЭТАЖ · МОДА И КРАСОТА', -2, HALF_D - 6);
      // ── общий декор торгового этажа ──
      buildCornice();
      buildSkirting();
      escApron(ESC.xUp[0], escZ0 + 1.2);
      escApron(ESC.xUp[1], escZ1 - 1.2);
      cctv(-HALF_W + 1.2, -HALF_D + 1.2, -0.8);
      cctv(HALF_W - 1.2, -HALF_D + 1.2, 0.8);
      cctv(HALF_W - 1.2, HALF_D - 1.2, 2.4);
      grille(-6, -HALF_D + 0.3, 0);
      grille(10, -HALF_D + 0.3, 0);
      fireExit(-HALF_W + 0.45, -13, Math.PI / 2);
      fireBox(HALF_W - 0.9, -15);
      fireBox(-HALF_W + 0.9, 15);
      hangSign('МОДА  ·  КРАСОТА  ·  ЮВЕЛИРНЫЕ', '#ffd24a', -2, 12, 0);
      hangSign('К ЛИФТУ  ▶', '#9fd8ff', 9, -4, 0);
      atriumBanner('SEASON SALE  -50%', '#ff6b9d', FH - 2.2);
      rollup(-10.5, 14, 0xff6b9d, 0);
      rollup(14.5, -2, 0x3fa9ff, Math.PI);
      mannequin(-6.5, 13.6, 0xe74c3c, 0.4);
      mannequin(-5.2, 14.2, 0x2980b9, -0.3);
      cart(4, 15, 0.6);
      cart(-16, 3, -1.1);

      // ── магазины вдоль северной стены (слева от лифта) ──
      makeShop({ x: -14, z: -HALF_D + 4.2, w: 9, d: 7.4,
                 name: 'LUXE', color: 0xffd700, signColor: '#ffd700', goods: 'clothes' });
      makeShop({ x: -4.2, z: -HALF_D + 4.2, w: 9, d: 7.4,
                 name: 'STREET', color: 0x00b4d8, signColor: '#00b4d8', goods: 'clothes' });
      makeShop({ x: 5.6, z: -HALF_D + 4.2, w: 8.4, d: 7.4,
                 name: 'CHIC', color: 0xff6b9d, signColor: '#ff6b9d', goods: 'cosmetics' });

      // ── магазины вдоль западной стены ──
      makeShop({ x: -HALF_W + 4.6, z: 6, w: 8.2, d: 8.4,
                 name: 'URBAN', color: 0x2ecc71, signColor: '#2ecc71', goods: 'clothes' });
      makeShop({ x: -HALF_W + 4.6, z: 15.4, w: 8.2, d: 8.0,
                 name: 'GOLD & CO', color: 0xf7c948, signColor: '#f7c948', goods: 'jewelry' });

      // ── магазины вдоль восточной стены ──
      makeShop({ x: HALF_W - 4.6, z: 2, w: 8.2, d: 9.0,
                 name: 'SPORT ZONE', color: 0xe74c3c, signColor: '#ff6b5a', goods: 'sport' });
      makeShop({ x: HALF_W - 4.6, z: 13, w: 8.2, d: 8.4,
                 name: 'BOOK HOUSE', color: 0x8e5a2f, signColor: '#e0a86a', goods: 'books' });

      // ── стойка информации ──
      // ВАЖНО: сдвинута к востоку (x=11). Раньше стояла в (2,2) и её
      // коллайдер 5.2x5.2 накрывал точку спавна (0,0) — игрок появлялся
      // внутри стойки и не мог сдвинуться с места.
      const INFO_X = 8, INFO_Z = 7;
      const infoBase = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.5, 1.05, 18), mat(0x2f3a4c));
      infoBase.position.set(bx + INFO_X, F + 0.52, bz + INFO_Z);
      add(infoBase);
      const infoTop = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.45, 0.1, 18),
        mat(0xf0ece4, 0xdfe8f5, 0.12));
      infoTop.position.set(bx + INFO_X, F + 1.1, bz + INFO_Z);
      add(infoTop);
      // экраны по кругу
      for (let k = 0; k < 3; k++) {
        const a = k / 3 * Math.PI * 2;
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.75),
          mat(0x0d1520, 0x3fa9ff, 0.55));
        scr.position.set(bx + INFO_X + Math.cos(a) * 2.5, F + 1.75,
                         bz + INFO_Z + Math.sin(a) * 2.5);
        scr.rotation.y = -a + Math.PI / 2;
        add(scr);
        api.screens.push(scr);
      }
      signBoard('ИНФОРМАЦИЯ', '#9fd8ff', INFO_X, 2.8, INFO_Z, 0, 3.4, 0.6);
      light(0xcfe4ff, 0.6, 12, INFO_X, 3.4, INFO_Z);
      colp(INFO_X, INFO_Z, 5.2, 5.2);

      // мебель
      bench(-2, 12, 0);
      bench(6, 12, 0);
      bench(-2, 17, Math.PI);
      bench(6, 17, Math.PI);
      plant(-8, 10); plant(11, 10); plant(-8, 18); plant(11, 18);
      plant(-19, -2); plant(19, -13);
      bin(-6, 14); bin(9, 14);

      // банкоматы у восточной стены
      for (let k = 0; k < 2; k++) {
        B(0.9, 2.0, 0.6, 0x2a3a4a, HALF_W - 1.2, 1.0, -8 + k * 1.3, 0);
        const s2 = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.45), mat(0x0d1520, 0x44ddaa, 0.5));
        s2.position.set(bx + HALF_W - 1.55, F + 1.5, bz - 8 + k * 1.3);
        s2.rotation.y = -Math.PI / 2;
        add(s2);
        api.screens.push(s2);
      }

      // NPC
      spawnInteriorNPC(bx + 18, F, bz + 12, 'guard', add);
      spawnInteriorNPC(bx - 8, F, bz + 6, 'shopper', add);
      spawnInteriorNPC(bx + 3, F, bz - 1, 'shopper', add);
      spawnInteriorNPC(bx - 16, F, bz + 14, 'shopper', add);
      spawnInteriorNPC(bx + 2, F, bz + 5, 'clerk', add);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  9. ЭТАЖ 2 — ЭЛЕКТРОНИКА, ИГРЫ, ИГРУШКИ
    // ═══════════════════════════════════════════════════════════════════════
    if (sf === 1) {
      floorSign('2 ЭТАЖ · ЭЛЕКТРОНИКА И ИГРЫ', -2, HALF_D - 6);
      // ── общий декор торгового этажа ──
      buildCornice();
      buildSkirting();
      escApron(ESC.xUp[0], escZ0 + 1.2);
      escApron(ESC.xUp[1], escZ1 - 1.2);
      cctv(-HALF_W + 1.2, -HALF_D + 1.2, -0.8);
      cctv(HALF_W - 1.2, -HALF_D + 1.2, 0.8);
      cctv(HALF_W - 1.2, HALF_D - 1.2, 2.4);
      grille(-6, -HALF_D + 0.3, 0);
      grille(10, -HALF_D + 0.3, 0);
      fireExit(-HALF_W + 0.45, -13, Math.PI / 2);
      fireBox(HALF_W - 0.9, -15);
      fireBox(-HALF_W + 0.9, 15);
      hangSign('ЭЛЕКТРОНИКА  ·  ИГРЫ', '#3fa9ff', -2, 12, 0);
      hangSign('◀ ЭСКАЛАТОР', '#66ff9a', -8, 6, 0);
      atriumBanner('NEW CONSOLE  ·  PLAY NOW', '#9b59b6', FH - 2.2);
      rollup(-10.5, 14, 0x3fa9ff, 0);
      rollup(16.5, -12, 0xffc300, Math.PI);
      cart(6, 16, 0.2);

      makeShop({ x: -14, z: -HALF_D + 4.2, w: 9.4, d: 7.4,
                 name: 'TECHNO', color: 0x3fa9ff, signColor: '#3fa9ff', goods: 'electronics' });
      makeShop({ x: -4, z: -HALF_D + 4.2, w: 9.4, d: 7.4,
                 name: 'GAME WORLD', color: 0x9b59b6, signColor: '#c39bd3', goods: 'electronics' });
      makeShop({ x: 6, z: -HALF_D + 4.2, w: 8.4, d: 7.4,
                 name: 'PHONE HUB', color: 0x1abc9c, signColor: '#5fe0c4', goods: 'electronics' });

      makeShop({ x: -HALF_W + 4.6, z: 6, w: 8.2, d: 8.4,
                 name: 'TOY LAND', color: 0xff6b9d, signColor: '#ff9ec4', goods: 'toys' });
      makeShop({ x: -HALF_W + 4.6, z: 15.4, w: 8.2, d: 8.0,
                 name: 'HOME TECH', color: 0xe67e22, signColor: '#ffab5e', goods: 'electronics' });

      makeShop({ x: HALF_W - 4.6, z: 2, w: 8.2, d: 9.0,
                 name: 'PC MASTER', color: 0x2c3e50, signColor: '#8fb8d8', goods: 'electronics' });
      makeShop({ x: HALF_W - 4.6, z: 13, w: 8.2, d: 8.4,
                 name: 'AUDIO PRO', color: 0xc0392b, signColor: '#ff8a7a', goods: 'electronics' });

      // ── ИГРОВЫЕ АВТОМАТЫ в центре ──
      const arcadeZ = 4;
      for (let k = 0; k < 6; k++) {
        const ax = 0 + (k % 3) * 2.6 - 2.6;
        const az = arcadeZ + Math.floor(k / 3) * 3.2;
        // корпус
        B(1.1, 1.9, 0.9, [0x8e44ad, 0x2980b9, 0xc0392b, 0x27ae60, 0xd35400, 0x16a085][k],
          ax, 0.95, az, 0);
        // экран
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6),
          mat(0x0a0d12, [0xff4d6d, 0x4dd2ff, 0xffe14d][k % 3], 0.7));
        scr.position.set(bx + ax, F + 1.5, bz + az + 0.47);
        add(scr);
        api.screens.push(scr);
        // пульт
        B(1.0, 0.1, 0.42, 0x1b1f26, ax, 1.02, az + 0.62, 0);
        // джойстик
        const js = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(0xe74c3c));
        js.position.set(bx + ax - 0.2, F + 1.12, bz + az + 0.62);
        add(js);
        light([0xff4d6d, 0x4dd2ff, 0xffe14d][k % 3], 0.28, 4.5, ax, 2.1, az);
        colp(ax, az, 1.3, 1.1);
      }
      signBoard('ИГРОВАЯ ЗОНА', '#ff4d6d', 0, 3.4, arcadeZ + 1.6, 0, 4.6, 0.72);

      // зона отдыха с диванами
      [-1, 1].forEach(s => {
        B(4.0, 0.5, 1.2, 0x2f3b52, 12, 0.3, 13 + s * 1.8, 0);
        B(4.0, 0.85, 0.25, 0x27324a, 12, 0.85, 13 + s * 2.28, 0);
        colp(12, 13 + s * 1.8, 4.2, 1.4);
      });
      B(1.8, 0.1, 1.0, 0x9ad4ff, 12, 0.55, 13, 0, 0x66c6ff, 0.1);

      plant(-8, 10); plant(11, 10); plant(-8, 18); plant(18, 18);
      bench(-2, 17, Math.PI);
      bin(-6, 14); bin(9, 16);

      spawnInteriorNPC(bx - 12, F, bz + 8, 'shopper', add);
      spawnInteriorNPC(bx + 8, F, bz + 4, 'shopper', add);
      spawnInteriorNPC(bx + 16, F, bz - 4, 'guard', add);
      spawnInteriorNPC(bx - 2, F, bz + 8, 'clerk', add);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  10. ЭТАЖ 3 — ФУДКОРТ + КИНОТЕАТР (4 зала)
    // ═══════════════════════════════════════════════════════════════════════
    if (sf === 2) {
      floorSign('3 ЭТАЖ · ФУДКОРТ И КИНО', -2, HALF_D - 6);
      // ── общий декор торгового этажа ──
      buildCornice();
      buildSkirting();
      escApron(ESC.xUp[0], escZ0 + 1.2);
      escApron(ESC.xUp[1], escZ1 - 1.2);
      cctv(-HALF_W + 1.2, -HALF_D + 1.2, -0.8);
      cctv(HALF_W - 1.2, -HALF_D + 1.2, 0.8);
      cctv(HALF_W - 1.2, HALF_D - 1.2, 2.4);
      grille(-6, -HALF_D + 0.3, 0);
      grille(10, -HALF_D + 0.3, 0);
      fireExit(-HALF_W + 0.45, -13, Math.PI / 2);
      fireBox(HALF_W - 0.9, -15);
      fireBox(-HALF_W + 0.9, 15);
      hangSign('ФУДКОРТ  ·  КИНОТЕАТР', '#ffb347', -6, 14, 0);
      hangSign('КИНО  ▶', '#ff4d6d', 4, 2, 0);
      atriumBanner('FANTAZIA CINEMA  ·  4 ЗАЛА', '#ff4d6d', FH - 2.2);
      rollup(-19.2, 2, 0xffb347, -Math.PI / 2);
      rollup(1, 17, 0xff4d6d, 0);

      // ── ФУДКОРТ вдоль северной стены ──
      const foods = [
        { n: 'ПИЦЦА', c: 0xe74c3c, s: '#ff7a68' },
        { n: 'БУРГЕРЫ', c: 0xf39c12, s: '#ffc061' },
        { n: 'СУШИ', c: 0x16a085, s: '#5fe0c4' },
        { n: 'КОФЕ', c: 0x8e5a2f, s: '#d8a26a' }
      ];
      foods.forEach((f, i) => {
        makeShop({
          x: -16.5 + i * 7.2, z: -HALF_D + 3.8, w: 6.8, d: 6.6,
          name: f.n, color: f.c, signColor: f.s, goods: 'food'
        });
      });

      // ── СТОЛИКИ фудкорта ──
      for (let t = 0; t < 10; t++) {
        const tx = -15 + (t % 5) * 4.0;
        const tz = -6 + Math.floor(t / 5) * 4.4;
        const tbl = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.09, 14),
          mat(0xf0ece4));
        tbl.position.set(bx + tx, F + 0.78, bz + tz);
        add(tbl);
        B(0.16, 0.78, 0.16, 0x8a9098, tx, 0.39, tz, 0);
        const bs = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 12), mat(0x6a7078));
        bs.position.set(bx + tx, F + 0.03, bz + tz);
        add(bs);
        // стулья
        for (let ch = 0; ch < 4; ch++) {
          const a = ch * Math.PI / 2 + 0.4;
          const st2 = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.48, 10),
            mat([0x6c5ce7, 0x00b894, 0xe17055, 0x0984e3][ch]));
          st2.position.set(bx + tx + Math.cos(a) * 1.45, F + 0.24, bz + tz + Math.sin(a) * 1.45);
          add(st2);
        }
        colp(tx, tz, 1.9, 1.9);
      }
      light(0xffe8c0, 0.7, 22, -6, FH - 1.2, -4);

      // ═══════════════════════════════════════════════════════════════════
      //  КИНОТЕАТР — восточная часть этажа
      // ═══════════════════════════════════════════════════════════════════
      const cinX = 12;                 // центр кинозоны
      const cinZ = 8;

      // ковролин
      const carp = new THREE.Mesh(new THREE.PlaneGeometry(19, 19),
        new THREE.MeshLambertMaterial({ map: T.carpet }));
      carp.rotation.x = -Math.PI / 2;
      carp.position.set(bx + cinX, F + 0.04, bz + cinZ);
      add(carp);

      // фасад кинотеатра — стена с 4 входами в залы
      B(19, FH, 0.4, 0x1c2230, cinX, FH / 2, cinZ - 8.6, 0);
      signBoard('FANTAZIA CINEMA', '#ff4d6d', cinX, FH - 0.9, cinZ - 8.35, 0, 8.5, 1.0);
      light(0xff4d6d, 0.55, 14, cinX, FH - 1.4, cinZ - 7.6);

      // ── 4 ЗАЛА: проёмы с номерами и афишами ──
      for (let h = 0; h < 4; h++) {
        const hx = cinX - 7.2 + h * 4.8;
        // проём
        B(2.4, 3.2, 0.24, 0x0a0d12, hx, 1.6, cinZ - 8.45, 0);
        // портал
        [-1, 1].forEach(s => {
          B(0.22, 3.4, 0.34, 0x39424e, hx + s * 1.3, 1.7, cinZ - 8.45, 0);
        });
        B(2.9, 0.24, 0.34, 0x39424e, hx, 3.42, cinZ - 8.45, 0);
        // номер зала
        signBoard('ЗАЛ ' + (h + 1), '#ffd24a', hx, 3.75, cinZ - 8.3, 0, 2.0, 0.5);
        // афиша сбоку
        const post = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.1),
          mat(0x14181f, [0xff4d6d, 0x4dd2ff, 0xffe14d, 0x9b59b6][h], 0.35));
        post.position.set(bx + hx + 2.35, F + 2.0, bz + cinZ - 8.3);
        add(post);
        api.screens.push(post);
        // мягкий свет из проёма
        light(0x6688ff, 0.22, 5, hx, 1.6, cinZ - 7.9);
      }

      // ── КАССЫ кинотеатра ──
      B(7.0, 1.15, 1.0, 0x2b3346, cinX + 4.5, 0.58, cinZ + 3.0, 0);
      B(7.2, 0.1, 1.2, 0xf0ece4, cinX + 4.5, 1.19, cinZ + 3.0, 0);
      for (let k = 0; k < 3; k++) {
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.55),
          mat(0x0d1520, 0x44ddaa, 0.5));
        scr.position.set(bx + cinX + 2.4 + k * 2.1, F + 1.9, bz + cinZ + 2.6);
        add(scr);
        api.screens.push(scr);
        B(0.1, 1.4, 0.1, 0x39424e, cinX + 2.4 + k * 2.1, 1.4, cinZ + 2.6, 0);
      }
      signBoard('КАССЫ', '#44ddaa', cinX + 4.5, 2.75, cinZ + 3.6, Math.PI, 3.0, 0.6);
      colp(cinX + 4.5, cinZ + 3.0, 7.2, 1.2);

      // ── ПОПКОРН-БАР ──
      B(4.2, 1.15, 1.0, 0xe74c3c, cinX - 5.5, 0.58, cinZ + 3.0, 0);
      B(4.4, 0.1, 1.2, 0xffe8c0, cinX - 5.5, 1.19, cinZ + 3.0, 0);
      // машина попкорна
      B(1.1, 1.3, 0.9, 0xf1c40f, cinX - 5.5, 1.85, cinZ + 3.0, 0);
      const pcGlass = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.8, 0.78),
        new THREE.MeshPhongMaterial({ color: 0xfff4c0, transparent: true, opacity: 0.5 }));
      pcGlass.position.set(bx + cinX - 5.5, F + 1.95, bz + cinZ + 3.0);
      add(pcGlass);
      for (let k = 0; k < 12; k++) {
        const pp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), mat(0xfffbe8));
        pp.position.set(bx + cinX - 5.5 + (Math.random() - 0.5) * 0.7,
                        F + 1.7 + Math.random() * 0.5,
                        bz + cinZ + 3.0 + (Math.random() - 0.5) * 0.55);
        add(pp);
      }
      signBoard('POPCORN', '#ffd24a', cinX - 5.5, 2.85, cinZ + 3.6, Math.PI, 3.0, 0.6);
      light(0xffd88a, 0.4, 8, cinX - 5.5, 2.4, cinZ + 3.4);
      colp(cinX - 5.5, cinZ + 3.0, 4.4, 1.2);

      // ── диваны ожидания в фойе ──
      [-1, 1].forEach(s => {
        B(5.0, 0.5, 1.3, 0x3a2233, cinX, 0.3, cinZ + 7.5 + s * 1.9, 0);
        B(5.0, 0.9, 0.26, 0x2c1a27, cinX, 0.9, cinZ + 7.5 + s * 2.48, 0);
        colp(cinX, cinZ + 7.5 + s * 1.9, 5.2, 1.5);
      });

      // бархатные канаты-ограждения
      for (let k = 0; k < 4; k++) {
        const px = cinX - 6 + k * 4;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.0, 8), mat(0xc9a227));
        pole.position.set(bx + px, F + 0.5, bz + cinZ - 4.5);
        add(pole);
        if (k < 3) {
          const rope = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.07, 0.07), mat(0x8b1a2b));
          rope.position.set(bx + px + 2, F + 0.88, bz + cinZ - 4.5);
          add(rope);
        }
      }

      plant(-19, 8); plant(-19, 16); plant(1, 14);
      bin(-10, 2); bin(4, 14);

      spawnInteriorNPC(bx + 12, F, bz + 12, 'shopper', add);
      spawnInteriorNPC(bx - 10, F, bz - 2, 'shopper', add);
      spawnInteriorNPC(bx + 17, F, bz + 3, 'clerk', add);
      spawnInteriorNPC(bx - 4, F, bz + 6, 'guard', add);
      spawnInteriorNPC(bx - 14, F, bz - 8, 'chef', add);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  11. ПОДВАЛЫ B1..B5
    //      B1 — служебный коридор и склад (тут квестовый вход к боссу)
    //      B2 — паркинг
    //      B3 — техэтаж, венткамера
    //      B4 — насосная и электрощитовая
    //      B5 — самый низ, логово босса
    //      Освещение тусклое: игрок просил, чтобы служебка была ТЁМНОЙ.
    // ═══════════════════════════════════════════════════════════════════════
    if (bsm) {
      const lvl = 4 - floor;   // B1 -> 0, B2 -> 1, ... B5 -> 4
      const label = ctx.floorLabelOf(floor);

      addInteriorSign('⚠️ ПОДВАЛ ' + label + ' · СЛУЖЕБНАЯ ЗОНА',
                      bx, F + 3.4, bz + HALF_D - 2, add);

      // ── общий тусклый свет: редкие лампы, между ними темнота ──
      const lampRow = (z) => {
        for (let k = -1; k <= 1; k++) {
          const lx = k * 13;
          // корпус лампы
          B(1.5, 0.12, 0.26, 0x2a2f36, lx, FH - 0.35, z, 0);
          const tube = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.07, 0.16),
            mat(0xdfe8f0, 0xbfd4e8, 0.55));
          tube.position.set(bx + lx, F + FH - 0.45, bz + z);
          add(tube);
          const pl = new THREE.PointLight(0xbfd4e8, 0.34, 13);
          pl.position.set(bx + lx, F + FH - 0.8, bz + z);
          add(pl);
          // часть ламп мигает
          if ((k + lvl) % 3 === 0) api.flicker.push({ light: pl, mesh: tube, ph: Math.random() * 6 });
        }
      };
      lampRow(-11); lampRow(0); lampRow(11);

      // ── несущие колонны ──
      for (let cx = -14; cx <= 14; cx += 14) {
        for (let cz = -12; cz <= 12; cz += 12) {
          if (Math.abs(cx - liftX) < 4 && Math.abs(cz - liftZ) < 4) continue;
          B(1.0, FH, 1.0, 0x5a6068, cx, FH / 2, cz, 0);
          // отбойник у основания
          B(1.15, 0.5, 1.15, 0xd8a020, cx, 0.25, cz, 0);
          colp(cx, cz, 1.3, 1.3);
        }
      }

      if (lvl === 0) {
        // ══ B1: СЛУЖЕБНЫЙ КОРИДОР + СКЛАД ══
        // перегородка с коридором вдоль западной части
        B(0.4, FH, 20, 0x555b63, -6, FH / 2, 4, 0);
        colp(-6, 4, 0.5, 20);
        // проём в перегородке
        B(0.5, 1.0, 3.0, 0x555b63, -6, FH - 0.5, -2, 0);

        // стеллажи склада
        for (let r = 0; r < 4; r++) {
          const rz = -10 + r * 6.5;
          for (let c = 0; c < 2; c++) {
            const rx = 4 + c * 9;
            // рама
            B(6.5, 0.16, 1.4, 0x8a5a2a, rx, 0.55, rz, 0);
            B(6.5, 0.16, 1.4, 0x8a5a2a, rx, 1.75, rz, 0);
            B(6.5, 0.16, 1.4, 0x8a5a2a, rx, 2.95, rz, 0);
            [-1, 1].forEach(s => {
              B(0.16, 3.4, 1.4, 0x6a4a22, rx + s * 3.2, 1.7, rz, 0);
            });
            // коробки
            for (let b3 = 0; b3 < 5; b3++) {
              const bxx = rx - 2.6 + b3 * 1.3;
              const lvl2 = b3 % 3;
              B(1.0, 0.85, 1.0, [0xa8763f, 0x9c6b42, 0xb8834a][b3 % 3],
                bxx, 1.0 + lvl2 * 1.2, rz, 0);
            }
            colp(rx, rz, 6.8, 1.6);
          }
        }
        // паллеты
        for (let k = 0; k < 4; k++) {
          B(1.2, 0.14, 1.0, 0x7a5a35, -12 + k * 2.4, 0.07, 14, 0);
        }

        // ── СЛУЖЕБНЫЙ ВХОД, ЗАКОЛОЧЕННЫЙ ДОСКАМИ (квест) ──
        ctx.fzServiceDoor(bx, bz, F, FH, add, mat, B, colp, liftX, LWALLZ);

        // ── ДВЕРЬ К БОССУ (появляется после того, как доски сбиты) ──
        ctx.fzBossDoorway(bx, bz, F, add, mat);

        spawnInteriorNPC(bx + 10, F, bz + 14, 'guard', add);

      } else if (lvl === 1) {
        // ══ B2: ПАРКИНГ ══
        // разметка мест
        for (let s = 0; s < 12; s++) {
          const sx2 = -18 + (s % 6) * 6.6;
          const sz2 = s < 6 ? -13 : 13;
          const lineM = mat(0xd8d8c0, 0xd8d8c0, 0.1);
          [-1, 1].forEach(e => {
            const ln = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 5.0), lineM);
            ln.rotation.x = -Math.PI / 2;
            ln.position.set(bx + sx2 + e * 2.6, F + 0.05, bz + sz2);
            add(ln);
          });
          const stop = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.16, 0.2), mat(0xc0392b));
          stop.position.set(bx + sx2, F + 0.08, bz + sz2 + (s < 6 ? -2.4 : 2.4));
          add(stop);
        }
        // припаркованные машины
        const carCols = [0x2980b9, 0xc0392b, 0x27ae60, 0xf39c12, 0x8e44ad];
        for (let k = 0; k < 5; k++) {
          const cx2 = -18 + k * 6.6;
          const cz2 = k < 3 ? -13 : 13;
          const cg = new THREE.Group();
          const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 4.2),
            mat(carCols[k]));
          body.position.y = 0.72; cg.add(body);
          const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.52, 2.0), mat(0x25313e));
          cab.position.set(0, 1.26, -0.3); cg.add(cab);
          [[-0.95, 1.3], [0.95, 1.3], [-0.95, -1.3], [0.95, -1.3]].forEach(([wx, wz]) => {
            const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10),
              mat(0x14171c));
            wh.rotation.z = Math.PI / 2;
            wh.position.set(wx, 0.34, wz); cg.add(wh);
          });
          cg.position.set(bx + cx2, F, bz + cz2);
          add(cg);
          colp(cx2, cz2, 2.2, 4.4);
        }
        // разметка проезда
        for (let k = -20; k <= 20; k += 4) {
          const dash = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.16),
            mat(0xd8d8c0, 0xd8d8c0, 0.08));
          dash.rotation.x = -Math.PI / 2;
          dash.position.set(bx + k, F + 0.05, bz);
          add(dash);
        }
        addInteriorSign('🅿️ ПАРКИНГ B2', bx, F + 3.0, bz - 6, add);

      } else if (lvl === 2) {
        // ══ B3: ТЕХЭТАЖ, ВЕНТКАМЕРА ══
        for (let k = 0; k < 3; k++) {
          const vx = -14 + k * 13;
          // короб вентустановки
          B(4.4, 2.6, 2.6, 0x6a7078, vx, 1.3, -8, 0);
          B(4.6, 0.2, 2.8, 0x4a5058, vx, 2.68, -8, 0);
          // вентилятор (крутится)
          const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.16, 14),
            mat(0x3a4048));
          fan.rotation.x = Math.PI / 2;
          fan.position.set(bx + vx, F + 1.4, bz - 6.65);
          add(fan);
          api.neon.push({ mesh: fan, spin: 2.4 });
          for (let b4 = 0; b4 < 4; b4++) {
            const bl = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.4, 0.06), mat(0x8a9098));
            bl.position.set(bx + vx, F + 1.4, bz - 6.6);
            bl.rotation.z = b4 * Math.PI / 4;
            add(bl);
            api.neon.push({ mesh: bl, spin: 2.4 });
          }
          // воздуховод наверх
          B(1.6, FH - 2.6, 1.6, 0x7a8088, vx, 2.6 + (FH - 2.6) / 2, -8, 0);
          colp(vx, -8, 4.6, 2.8);
        }
        // трубы вдоль пола
        for (let k = 0; k < 3; k++) {
          const pipe = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 0.22, MW - 3, 10),
            mat([0x7a4a2a, 0x2a5a7a, 0x5a5a3a][k]));
          pipe.rotation.z = Math.PI / 2;
          pipe.position.set(bx, F + 0.5 + k * 0.55, bz + 9);
          add(pipe);
        }
        colp(0, 9, MW - 3, 0.8);
        addInteriorSign('⚙️ ТЕХЭТАЖ B3', bx, F + 3.0, bz + 4, add);

      } else if (lvl === 3) {
        // ══ B4: НАСОСНАЯ + ЭЛЕКТРОЩИТОВАЯ ══
        for (let k = 0; k < 5; k++) {
          const px = -16 + k * 8;
          // шкаф
          B(1.9, 2.5, 0.85, 0x4a5560, px, 1.25, -12, 0);
          // дверца с ручкой
          B(1.7, 2.2, 0.06, 0x5a6570, px, 1.25, -11.55, 0);
          B(0.1, 0.3, 0.08, 0x2a3038, px + 0.65, 1.25, -11.5, 0);
          // индикаторы
          for (let i2 = 0; i2 < 3; i2++) {
            const led = new THREE.Mesh(new THREE.CircleGeometry(0.055, 8),
              new THREE.MeshBasicMaterial({ color: [0x33ff66, 0xffcc33, 0xff3344][i2] }));
            led.position.set(bx + px - 0.5 + i2 * 0.28, F + 2.15, bz - 11.51);
            add(led);
          }
          // знак «высокое напряжение»
          const warn = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4),
            mat(0xffe14d, 0xffe14d, 0.3));
          warn.position.set(bx + px, F + 1.5, bz - 11.51);
          add(warn);
          colp(px, -12, 2.0, 1.0);
        }
        // насосы
        for (let k = 0; k < 3; k++) {
          const px = -10 + k * 10;
          const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.3, 12),
            mat(0x2a6a8a));
          pump.position.set(bx + px, F + 0.65, bz + 10);
          add(pump);
          B(1.9, 0.3, 1.9, 0x4a5058, px, 0.15, 10, 0);
          const mtr = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.9, 10),
            mat(0x3a4048));
          mtr.rotation.z = Math.PI / 2;
          mtr.position.set(bx + px, F + 1.6, bz + 10);
          add(mtr);
          colp(px, 10, 2.0, 2.0);
        }
        addInteriorSign('⚡ ЩИТОВАЯ B4', bx, F + 3.0, bz - 4, add);

      } else {
        // ══ B5: САМЫЙ НИЗ — логово босса ══
        // почти полная темнота, только аварийные лампы
        for (let k = -1; k <= 1; k++) {
          const el = new THREE.PointLight(0xff4433, 0.42, 15);
          el.position.set(bx + k * 14, F + FH - 1.0, bz);
          add(el);
          const eb = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.24),
            mat(0x3a1a18, 0xff4433, 0.7));
          eb.position.set(bx + k * 14, F + FH - 0.7, bz);
          add(eb);
          api.flicker.push({ light: el, mesh: eb, ph: Math.random() * 6, red: true });
        }
        // лужи и мусор
        for (let k = 0; k < 8; k++) {
          const px = -18 + Math.random() * 36;
          const pz = -14 + Math.random() * 28;
          const pud = new THREE.Mesh(new THREE.CircleGeometry(0.8 + Math.random() * 1.2, 12),
            new THREE.MeshPhongMaterial({
              color: 0x1a2028, shininess: 160, specular: 0x66aaff,
              transparent: true, opacity: 0.75
            }));
          pud.rotation.x = -Math.PI / 2;
          pud.position.set(bx + px, F + 0.05, bz + pz);
          add(pud);
        }
        // ржавые бочки
        for (let k = 0; k < 6; k++) {
          const px = -16 + k * 6.5;
          const pz = k % 2 ? -12 : 12;
          const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.5, 12),
            mat([0x6a3a20, 0x5a4a2a, 0x4a3a30][k % 3]));
          bar.position.set(bx + px, F + 0.75, bz + pz);
          add(bar);
          colp(px, pz, 1.2, 1.2);
        }
        addInteriorSign('☠️ B5 · НЕ ВХОДИТЬ', bx, F + 3.0, bz + 6, add);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  12. ОБЩЕЕ ОСВЕЩЕНИЕ ТОРГОВЫХ ЭТАЖЕЙ
    // ═══════════════════════════════════════════════════════════════════════
    if (!bsm) {
      // мягкая заливка
      const amb = new THREE.AmbientLight(0xfff4e6, 0.42);
      add(amb);
      // световые кольца под потолком
      [[-12, -8], [12, -8], [-12, 8], [12, 8], [0, 0]].forEach(([lx, lz]) => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.1, 8, 22),
          mat(0xffffff, 0xfff2d0, 0.75));
        ring.rotation.x = Math.PI / 2;
        ring.position.set(bx + lx, F + FH - 0.35, bz + lz);
        add(ring);
        light(0xfff2d0, 0.42, 17, lx, FH - 0.7, lz);
      });
      // линейные светильники вдоль прохода
      for (let k = -2; k <= 2; k++) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 7),
          mat(0xffffff, 0xffffff, 0.6));
        strip.position.set(bx + 2, F + FH - 0.22, bz + k * 7);
        add(strip);
      }
    }

    return api;
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  АНИМАЦИЯ: ступени эскалаторов, мерцание ламп, экраны, вентиляторы
  //  Вызывается каждый кадр из главного цикла игры.
  // ═════════════════════════════════════════════════════════════════════════
  function animateMall(state, dt, t) {
    if (!state) return;

    // ── ступени эскалаторов ползут ──
    if (state.escalators) {
      for (let i = 0; i < state.escalators.length; i++) {
        const g = state.escalators[i];
        const u = g.userData;
        if (!u || !u.steps) continue;
        for (let s = 0; s < u.steps.length; s++) {
          const step = u.steps[s];
          let p = step.userData.s + dt * u.speed * (u.dir > 0 ? 1 : -1);
          if (p > 1) p -= 1;
          if (p < 0) p += 1;
          step.userData.s = p;
          step.position.y = u.baseY + 0.62 + u.rise * p;
          step.position.z = u.baseZ + 10 - 10 * p;
        }
      }
    }

    // ── мерцание аварийных ламп в подвалах ──
    if (state.flicker) {
      for (let i = 0; i < state.flicker.length; i++) {
        const f = state.flicker[i];
        f.ph += dt * (f.red ? 3.1 : 8.5);
        const n = Math.sin(f.ph) * Math.sin(f.ph * 2.7);
        const on = f.red ? (0.28 + Math.abs(n) * 0.5) : (n > -0.35 ? 0.34 : 0.05);
        if (f.light) f.light.intensity = on;
        if (f.mesh && f.mesh.material) {
          f.mesh.material.emissiveIntensity = f.red ? 0.4 + Math.abs(n) * 0.6
                                                     : (n > -0.35 ? 0.55 : 0.08);
        }
      }
    }

    // ── экраны переливаются ──
    if (state.screens) {
      for (let i = 0; i < state.screens.length; i++) {
        const s = state.screens[i];
        if (!s.material) continue;
        s.material.emissiveIntensity = 0.35 + Math.sin(t * 1.7 + i * 0.9) * 0.22;
      }
    }

    // ── вентиляторы крутятся ──
    if (state.neon) {
      for (let i = 0; i < state.neon.length; i++) {
        const n = state.neon[i];
        if (n.mesh && n.spin) n.mesh.rotation.z += dt * n.spin;
      }
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  ЭКСПОРТ
  // ═════════════════════════════════════════════════════════════════════════
  window.FZ_MALL = {
    build: buildGrandMall,
    animate: animateMall,
    LIFT_X: LIFT_X,
    LIFT_Z: LIFT_Z,
    DOORW: DOORW,
    DOORH: DOORH,
    ATRIUM: ATRIUM,
    MW: MW,
    MD: MD
  };
})();
