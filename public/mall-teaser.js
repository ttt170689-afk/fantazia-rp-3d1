// ═══════════════════════════════════════════════════════════════════════
//  FZ_TEASER_MALL — GRAND MALL, ПЕРЕНЕСЁННЫЙ ИЗ ТИЗЕРА КАК ЕСТЬ
//
//  Код buildMALL() и его хелперы (box/sph/cyl/tMesh/hazardTex) скопированы
//  из teaser.html без изменений геометрии — именно та сборка, где
//  «всё аккуратно стоит»: мрамор, атриум в 3 уровня, эскалаторы,
//  бутики LUXE/STREET/CHIC/URBAN, фонтан, карусель, ОБЪЁМНЫЙ ЛИФТ,
//  служебный комплекс с броневоротами B1 и грузовым лифтом.
//
//  Оригинал строит в группу GM (S.add(GM), GM.position.z = 4).
//  Здесь GM создаётся локально, поэтому весь молл можно поставить
//  в любую точку игрового мира одним вызовом:
//      FZ_TEASER_MALL.build(scene, x, y, z)
//
//  Система координат тизера: x ∈ [-22,22], z ∈ [-36,0],
//  стеклянный южный фасад (вход) — на z = 0.
// ═══════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  window.FZ_TEASER_MALL = {
    root: null,
    api: null,

    // Строит молл из тизера и возвращает корневую группу.
    build: function (scene, ox, oy, oz, opts) {
      if (!window.THREE || !scene) {
        console.warn('[TEASER MALL] нет THREE/scene');
        return null;
      }
      // Опции интеграции в игру (в самом тизере их нет):
      //   noFountain — не строить фонтан (игрок просил его убрать);
      //   noLift     — не строить бутафорский лифт тизера, потому что
      //                в игре на этом месте стоит НАСТОЯЩИЙ рабочий лифт
      //                с кабиной, табло и катсценой.
      opts = opts || {};
      const OPT_NO_FOUNTAIN = !!opts.noFountain;
      const OPT_NO_LIFT = !!opts.noLift;
      const DOC = document;
      const GM = new THREE.Group();
      GM.name = 'FZ_TEASER_MALL';
      scene.add(GM);

      // капли фонтана (оригинал держит их в GM.userData)
      const mallSpr = { pts: null, pos: null, ph: null, n: 0 };
      GM.userData = mallSpr;

      // ── ПАЛИТРА МАТЕРИАЛОВ ИЗ ТИЗЕРА (NM) ──
      // Создаётся при каждой сборке: материалы three.js нельзя
      // переиспользовать между сценами после dispose().
      const NM = {
          wall: new THREE.MeshLambertMaterial({ color: 0x10151e }),
          wall2: new THREE.MeshLambertMaterial({ color: 0x171d29 }),
          wallDark: new THREE.MeshLambertMaterial({ color: 0x0a0d13 }),
          conc: new THREE.MeshLambertMaterial({ color: 0x23262c }),
          conc2: new THREE.MeshLambertMaterial({ color: 0x2b2e35 }),
          steel: new THREE.MeshLambertMaterial({ color: 0x2c3138 }),
          steelGloss: new THREE.MeshPhongMaterial({ color: 0x3a4048, specular: 0x8899aa, shininess: 90 }),
          asphalt: new THREE.MeshPhongMaterial({ color: 0x12151c, specular: 0x334055, shininess: 150 }),
          marble: new THREE.MeshPhongMaterial({ color: 0x191d26, specular: 0x46536a, shininess: 160 }),
          marble2: new THREE.MeshPhongMaterial({ color: 0x14171f, specular: 0x39455c, shininess: 140 }),
          glassD: new THREE.MeshBasicMaterial({ color: 0x0a0f16, transparent: true, opacity: 0.8 }),
          glassGlow: new THREE.MeshBasicMaterial({ color: 0x2a1d12, transparent: true, opacity: 0.9 }),
          water: new THREE.MeshPhongMaterial({ color: 0x0d1a20, specular: 0x6fa8b0, shininess: 200, transparent: true, opacity: 0.85 }),
          bush: new THREE.MeshLambertMaterial({ color: 0x10180f }),
          leaf: new THREE.MeshLambertMaterial({ color: 0x1a2418 }),
          leaf2: new THREE.MeshLambertMaterial({ color: 0x141d14 }),
          pot: new THREE.MeshLambertMaterial({ color: 0x33261a }),
          warm: new THREE.MeshBasicMaterial({ color: 0xffc074 }),
          warmDim: new THREE.MeshBasicMaterial({ color: 0xff9c3c }),
          cool: new THREE.MeshBasicMaterial({ color: 0xbfe6ff }),
          redGlow: new THREE.MeshBasicMaterial({ color: 0xff2a14 }),
          ylw: new THREE.MeshLambertMaterial({ color: 0x8a7a2a }),
          cabSt: new THREE.MeshPhongMaterial({ color: 0x2e333c, specular: 0x8fa0b0, shininess: 120 }),
          doorM: new THREE.MeshLambertMaterial({ color: 0x39434a })
        };

      // ── ХЕЛПЕРЫ ИЗ ТИЗЕРА (без изменений) ──
      function box(w, h, d, m, x, y, z) {
          const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
          o.position.set(x || 0, y || 0, z || 0);
          return o;
        }

      function sph(r, m, x, y, z) {
          const o = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), m);
          o.position.set(x || 0, y || 0, z || 0);
          return o;
        }

      function cyl(rt, rb, h, seg, m, x, y, z, rx) {
          const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
          o.position.set(x || 0, y || 0, z || 0);
          if (rx) o.rotation.x = rx;
          return o;
        }

      function tMesh(txt, w, h, fill, glow, fontPx, pxW, pxH) {
          try {
            const tex = mkTex(txt, pxW, pxH, fill, glow, fontPx);
            if (!tex) return null;
            // v17: НЕ DoubleSide! Иначе сзади текст читается зеркально («натноф»).
            // Делаем группу из двух односторонних плоскостей — читаемо с любой стороны.
            const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.FrontSide, depthWrite: false });
            const geo = new THREE.PlaneGeometry(w, h);
            const g = new THREE.Group();
            const front = new THREE.Mesh(geo, mat);
            g.add(front);
            const back = new THREE.Mesh(geo, mat);
            back.rotation.y = Math.PI;
            back.position.z = -0.004;
            g.add(back);
            g.material = mat;   // совместимость со старым кодом
            return g;
          } catch (e) { return null; }
        }

      function hazardTex() {
          try {
            const cv = DOC.createElement('canvas');
            cv.width = 64; cv.height = 64;
            const c2 = cv.getContext('2d');
            if (!c2) return null;
            c2.fillStyle = '#b8860b'; c2.fillRect(0, 0, 64, 64);
            c2.fillStyle = '#181004';
            c2.beginPath();
            for (let i = -64; i < 128; i += 16) {
              c2.moveTo(i, 64); c2.lineTo(i + 64, 0); c2.lineTo(i + 78, 0); c2.lineTo(i + 14, 64);
              c2.fill();
            }
            const tex = new THREE.CanvasTexture(cv);
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            return tex;
          } catch (e) { return null; }
        }

      function setFreightInd(txt) {
          try {
            const F8 = GM.freight;
            if (!F8 || !F8.indCtx) return;
            const c = F8.indCtx;
            c.clearRect(0, 0, 256, 80);
            c.font = '700 50px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
            c.shadowColor = '#ff5030'; c.shadowBlur = 18;
            c.fillStyle = '#ffb0a0';
            c.fillText(txt, 128, 42);
            c.shadowBlur = 4;
            c.fillText(txt, 128, 42);
            if (F8.indTex) F8.indTex.needsUpdate = true;
          } catch (e) {}
        }

      function buildMALL() {
          const B = GM; // строим прямо в группу
          const put = (m) => { B.add(m); return m; };
          // ── пол: мраморная плитка (canvas 8×8, повтор 6×5) ──
          const ftex = (function () {
            try {
              const cv = DOC.createElement('canvas'); cv.width = 512; cv.height = 512;
              const g = cv.getContext('2d');
              for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) {
                const v = (x + y) % 2 ? 245 : 229;
                g.fillStyle = 'rgb(' + v + ',' + (v - 5) + ',' + (v - 16) + ')';
                g.fillRect(x * 128, y * 128, 128, 128);
              }
              // прожилки мрамора
              for (let i = 0; i < 30; i++) {
                g.strokeStyle = 'rgba(' + (Math.random() < 0.5 ? '255,255,255' : '150,130,100') + ',' + (0.08 + Math.random() * 0.12).toFixed(2) + ')';
                g.lineWidth = 1 + Math.random() * 1.8;
                g.beginPath();
                let vx = Math.random() * 512, vy = Math.random() * 512;
                g.moveTo(vx, vy);
                for (let st = 0; st < 5; st++) { vx += (Math.random() - 0.5) * 150; vy += (Math.random() - 0.5) * 150; g.lineTo(vx, vy); }
                g.stroke();
              }
              g.strokeStyle = 'rgba(110,100,85,0.45)'; g.lineWidth = 2;
              for (let x = 0; x <= 4; x++) { g.beginPath(); g.moveTo(x * 128, 0); g.lineTo(x * 128, 512); g.stroke(); }
              for (let y = 0; y <= 4; y++) { g.beginPath(); g.moveTo(0, y * 128); g.lineTo(512, y * 128); g.stroke(); }
              const t2 = new THREE.CanvasTexture(cv);
              t2.wrapS = t2.wrapT = THREE.RepeatWrapping; t2.repeat.set(6, 5);
              return t2;
            } catch (e) { return null; }
          })();
          const floorM = ftex
            ? new THREE.MeshLambertMaterial({ map: ftex })
            : new THREE.MeshLambertMaterial({ color: 0xefece2 });
          const fl = new THREE.Mesh(new THREE.PlaneGeometry(44, 36), floorM);
          fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0.02, -22); B.add(fl);
          // тёмные швы-линии на полу (для глубины)
          for (let z = -40; z <= -4; z += 4) {
            const seam = new THREE.Mesh(new THREE.PlaneGeometry(44, 0.06), new THREE.MeshBasicMaterial({ color: 0xbfb8a8, transparent: true, opacity: 0.5 }));
            seam.rotation.x = -Math.PI / 2; seam.position.set(0, 0.04, z + 0.1); B.add(seam);
          }
          // ── панели стен (canvas: тёплый мрамор + швы панелей) — «пять звёзд» ──
          const wallTex = (function () {
            try {
              const cv = DOC.createElement('canvas'); cv.width = 256; cv.height = 256;
              const g = cv.getContext('2d');
              g.fillStyle = '#f3ecdd'; g.fillRect(0, 0, 256, 256);
              for (let i = 0; i < 700; i++) {
                g.fillStyle = Math.random() < 0.5 ? 'rgba(120,100,70,0.05)' : 'rgba(255,255,255,0.05)';
                g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
              }
              for (let v = 0; v < 4; v++) {
                const gr = g.createLinearGradient(v * 64, 0, v * 64 + 64, 0);
                gr.addColorStop(0, 'rgba(140,120,90,0.30)');
                gr.addColorStop(0.5, 'rgba(140,120,90,0.04)');
                gr.addColorStop(1, 'rgba(140,120,90,0.30)');
                g.fillStyle = gr; g.fillRect(v * 64, 0, 64, 256);
              }
              g.fillStyle = 'rgba(150,130,95,0.5)';
              g.fillRect(0, 244, 256, 3);  // цоколь
              g.fillRect(0, 6, 256, 2);    // карниз
              const t3 = new THREE.CanvasTexture(cv);
              t3.wrapS = THREE.RepeatWrapping; t3.repeat.set(6, 1);
              return t3;
            } catch (e) { return null; }
          })();
          // ── потолок: кессонная сетка под плитами ──
          const ceilTex = (function () {
            try {
              const cv = DOC.createElement('canvas'); cv.width = 256; cv.height = 256;
              const g = cv.getContext('2d');
              g.fillStyle = '#f8f5ee'; g.fillRect(0, 0, 256, 256);
              for (let i = 0; i < 350; i++) { g.fillStyle = 'rgba(160,150,130,0.05)'; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
              g.strokeStyle = 'rgba(150,140,120,0.4)'; g.lineWidth = 2;
              for (let i = 0; i <= 4; i++) {
                g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.stroke();
                g.beginPath(); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke();
              }
              const t4 = new THREE.CanvasTexture(cv);
              t4.wrapS = t4.wrapT = THREE.RepeatWrapping; t4.repeat.set(4, 4);
              return t4;
            } catch (e) { return null; }
          })();
          const ceilM = ceilTex ? new THREE.MeshLambertMaterial({ map: ceilTex }) : null;
          const goldM = new THREE.MeshBasicMaterial({ color: 0xd4af37 });
          const goldStrip = (w, d, x, y, z) => B.add(box(w, 0.05, d, goldM, x, y, z));
          // ── цветовые палитры молла (как в игре) ──
          const MM = {
            beige: wallTex ? new THREE.MeshLambertMaterial({ map: wallTex }) : new THREE.MeshLambertMaterial({ color: 0xf0ebe0 }),
            beige2: new THREE.MeshLambertMaterial({ color: 0xece7dc }),
            dark: new THREE.MeshLambertMaterial({ color: 0x3a3f4a }),
            metal: new THREE.MeshLambertMaterial({ color: 0x8a8f98 }),
            glass: new THREE.MeshBasicMaterial({ color: 0x9ad4ff, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
            marble: new THREE.MeshLambertMaterial({ color: 0xf4f1ea }),
            colM: new THREE.MeshLambertMaterial({ color: 0xf4efe4 })
          };
          // ── периметр: пол 0 (высота 5.5) ──
          const wallS = (x, z, w, d, m) => put(new THREE.Mesh(new THREE.BoxGeometry(w, 5.5, d), m)).position.set(x, 2.75, z);
          // северная стена (глухая, бежевая)
          wallS(0, -40.2, 44.4, 0.5, MM.beige);
          // западная стена (глухая)
          wallS(-22.25, -22, 0.5, 36.4, MM.beige);
          // восточная стена — v39: ГЛУХАЯ.
          // В тизере здесь были два проёма (под служебные ворота z≈-19 и под
          // грузовой лифт z≈-24). Оба объекта удалены как дубли настоящих,
          // поэтому проёмы заделаны — иначе в зале зияли бы дыры в стене.
          wallS(22.25, -22, 0.5, 36.4, MM.beige);
          // южная стена — стеклянный вход (сплошное стекло + стойки)
          for (let x = -20; x <= 20; x += 4) {
            const st = new THREE.Mesh(new THREE.BoxGeometry(0.16, 5.5, 0.3), MM.metal);
            st.position.set(x, 2.75, -4.0); B.add(st);
          }
          const glWall = new THREE.Mesh(new THREE.BoxGeometry(44, 5.3, 0.16), MM.glass);
          glWall.position.set(0, 2.65, -4.0); B.add(glWall);
          // козырёк входа изнутри + табличка
          B.add(box(6, 0.3, 0.5, MM.dark, 0, 5.0, -3.6));
          // ── потолочные плиты с ПРОЁМОМ АТРИУМА (проём: local x∈[-16,-10], z∈[-23,-11]) ──
          //   над полом 0 — плита y=5.5 (потолок/пол 1), над ней y=11 (пол 2), потолок 16.6
          const slabs = [
            { w: 44, d: 17, x: 0, z: -31.5 },   // северная часть (z -40..-23)
            { w: 44, d: 7, x: 0, z: -7.5 },     // южная часть (z -11..-4)
            { w: 6, d: 12, x: -19, z: -17 },    // западный край
            { w: 32, d: 12, x: 6, z: -17 }      // восточный край (большой)
          ];
          const slabPut = (y, topM, botM) => {
            slabs.forEach((s) => {
              const sb = new THREE.Mesh(new THREE.BoxGeometry(s.w, 0.34, s.d), topM || MM.marble);
              sb.position.set(s.x, y, s.z); B.add(sb);
              if (botM) {
                const sb2 = new THREE.Mesh(new THREE.BoxGeometry(s.w - 0.2, 0.06, s.d - 0.2), botM);
                sb2.position.set(s.x, y - 0.2, s.z); B.add(sb2);
              }
            });
          };
          slabPut(5.5, MM.marble, ceilM);    // пол 1 (снизу — кессонный потолок)
          slabPut(11.0, MM.marble, ceilM);   // пол 2
          // потолок здания (невидимый фон) над полом 2
          const roof2 = new THREE.Mesh(new THREE.BoxGeometry(44, 0.5, 36), new THREE.MeshLambertMaterial({ color: 0xded8cc }));
          roof2.position.set(0, 16.55, -22); B.add(roof2);
          // световые кольца (как в игре) на потолке 1 и 2 этажей
          [[5.15, -14, -8], [5.15, 14, -8], [5.15, -14, -26], [5.15, 14, -26], [5.15, -14, -36], [5.15, 14, -36]].forEach(([y2, lx, lz]) => {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.09, 8, 26), new THREE.MeshBasicMaterial({ color: 0xfff2c0 }));
            ring.rotation.x = Math.PI / 2; ring.position.set(lx, y2, lz); B.add(ring);
            const pl = new THREE.PointLight(0xFFF6E0, 0.7, 16);
            pl.position.set(lx, y2 - 0.4, lz); B.add(pl);
          });
          // ── люстра атриума (видна с пола 0 через проём) ──
          (function atriumChandelier() {
            const cx = -13, cz = -17;
            const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 6), new THREE.MeshLambertMaterial({ color: 0x3a3f4a }));
            rod.position.set(cx, 11 - 1.3, cz); B.add(rod);
            const r1 = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.09, 8, 28), new THREE.MeshBasicMaterial({ color: 0xfff0c0 }));
            r1.rotation.x = Math.PI / 2; r1.position.set(cx, 9.7, cz); B.add(r1);
            const r2 = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.07, 8, 24), new THREE.MeshBasicMaterial({ color: 0xfff6d8 }));
            r2.rotation.x = Math.PI / 2; r2.position.set(cx, 9.35, cz); B.add(r2);
            for (let i = 0; i < 8; i++) {
              const a = i / 8 * 6.283;
              B.add(sph(0.09, new THREE.MeshBasicMaterial({ color: 0xffe8b0 }), cx + Math.cos(a) * 1.7, 9.7, cz + Math.sin(a) * 1.7));
            }
            const al = new THREE.PointLight(0xfff2dd, 1.15, 24, 1.6);
            al.position.set(cx, 9.4, cz); B.add(al);
          })();
          // ── подвесные светильники центрального зала + тёплый свет у входа ──
          (function hallPendants() {
            const bodyM = new THREE.MeshLambertMaterial({ color: 0x3a3f4a });
            const glowM = new THREE.MeshBasicMaterial({ color: 0xfff0c8 });
            [[-6, -18, 3.6], [2, -18, 3.4], [10, -18, 3.6], [7.5, -26, 4.3]].forEach(([px, pz, py]) => {
              const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 5.5 - py, 5), bodyM);
              rod.position.set(px, (5.5 + py) / 2, pz); B.add(rod);
              const sh = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.42, 12, 1, true), bodyM);
              sh.position.set(px, py, pz); B.add(sh);
              B.add(sph(0.15, glowM, px, py - 0.14, pz));
            });
            const p1 = new THREE.PointLight(0xfff0d0, 0.75, 15, 1.6); p1.position.set(-2, 3.1, -18); B.add(p1);
            const p2 = new THREE.PointLight(0xfff0d0, 0.6, 13, 1.6); p2.position.set(9, 3.1, -22); B.add(p2);
            const eL = new THREE.PointLight(0xffd9a0, 0.9, 16, 1.6); eL.position.set(0, 4.4, -7); B.add(eL);
          })();
          // ── золотая отделка: кромки стен, кромка атриума, рамки пола ──
          goldStrip(44, 0.05, 0, 5.2, -39.85);
          goldStrip(0.05, 36, -21.95, 5.2, -22);
          goldStrip(0.05, 36, 21.95, 5.2, -22);
          goldStrip(6.6, 0.05, -13, 5.28, -23.1);
          goldStrip(6.6, 0.05, -13, 5.28, -10.9);
          goldStrip(0.05, 12.4, -16.25, 5.28, -17);
          goldStrip(0.05, 12.4, -9.75, 5.28, -17);
          goldStrip(43, 0.07, 0, 0.05, -5.2);
          goldStrip(43, 0.07, 0, 0.05, -38.8);
          goldStrip(0.07, 33.6, -21.2, 0.05, -22);
          goldStrip(0.07, 33.6, 21.2, 0.05, -22);
          // ── интерьерная вывеска GRAND MALL над бутиками ──
          const sgnGM = tMesh('★ GRAND MALL ★', 8.5, 1.05, '#fff6dc', '#ff9a3c', 92, 1100, 160);
          if (sgnGM) { sgnGM.position.set(0, 5.35, -39.15); B.add(sgnGM); }
          // ── стеклянные перила атриума на полах 1-2 (голубое стекло + поручень) ──
          const railSegs = [
            // вокруг проёма: проём x∈[-16,-10] (ширина 6), z∈[-23,-11] (глубина 12)
            { w: 6.4, d: 0.12, x: -13, z: -23.2 },   // север
            { w: 6.4, d: 0.12, x: -13, z: -10.8 },   // юг
            { w: 0.12, d: 12.6, x: -16.2, z: -17 },  // запад
            { w: 0.12, d: 12.6, x: -9.8, z: -17 }    // восток
          ];
          [5.5, 11.0].forEach((ly) => {
            railSegs.forEach((r) => {
              const gl = new THREE.Mesh(new THREE.BoxGeometry(r.w, 1.05, r.d),
                new THREE.MeshLambertMaterial({ color: 0x9ad4ff, emissive: 0x66c6ff, emissiveIntensity: 0.14, transparent: true, opacity: 0.5 }));
              gl.position.set(r.x, ly + 0.55, r.z); B.add(gl);
              const hb = new THREE.Mesh(new THREE.BoxGeometry(r.w * 1.02, 0.1, r.d * 1.02), MM.metal);
              hb.position.set(r.x, ly + 1.12, r.z); B.add(hb);
            });
          });
          // ── КОЛОННЫ (как в игре) ──
          [[-15, -30], [0, -30], [15, -30], [-15, -13], [0, -13], [15, -13]].forEach(([cx, cz]) => {
            const col = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 5.5, 10), MM.colM);
            col.position.set(cx, 2.75, cz); B.add(col);
            B.add(box(1.2, 0.2, 1.2, MM.beige2, cx, 5.42, cz));
            B.add(box(1.2, 0.24, 1.2, MM.beige2, cx, 0.1, cz));
          });
          // ── ЭСКАЛАТОРЫ (два: вверх x=-14, вниз x=-12; низ z=-12, верх z=-22) ──
          const esc = { up: { x: -14, dir: 1 }, down: { x: -12, dir: -1 } };
          GM.esc = [];
          const escZ0 = -12, escZ1 = -22, runE = escZ0 - escZ1, riseE = 4.95;
          const escAng = Math.atan2(riseE, runE);
          const slopeLen = Math.sqrt(runE * runE + riseE * riseE);
          Object.values(esc).forEach((e, ei) => {
            const dirUp = ei === 0;
            const g = new THREE.Group();
            const steps = [];
            // ферма + полотно
            const truss = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, slopeLen), MM.metal);
            truss.position.set(e.x, riseE / 2 + 0.35, (escZ0 + escZ1) / 2); truss.rotation.x = -escAng; g.add(truss);
            const deck = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, slopeLen), MM.dark);
            deck.position.set(e.x, riseE / 2 + 0.62, (escZ0 + escZ1) / 2); deck.rotation.x = -escAng; g.add(deck);
            for (let st = 0; st < 14; st++) {
              const s = st / 14;
              const step = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.08, 0.66),
                new THREE.MeshLambertMaterial({ color: 0xc8ccd4, emissive: 0x55606e, emissiveIntensity: 0.08 }));
              step.position.set(e.x, 0.62 + riseE * s, escZ0 - runE * s);
              step.userData = { s: s };
              g.add(step); steps.push(step);
            }
            // балюстрады + светящиеся поручни
            [-0.85, 0.85].forEach((sx) => {
              const bal = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.95, slopeLen), MM.dark);
              bal.position.set(e.x + sx, riseE / 2 + 1.15, (escZ0 + escZ1) / 2); bal.rotation.x = -escAng; g.add(bal);
              const hr = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, slopeLen, 8),
                new THREE.MeshLambertMaterial({ color: 0x39424e, emissive: 0x00e5ff, emissiveIntensity: 0.4 }));
              hr.rotation.x = Math.PI / 2 - escAng;
              hr.position.set(e.x + sx, riseE / 2 + 1.66, (escZ0 + escZ1) / 2);
              g.add(hr);
            });
            // гребёнки
            B.add(box(1.7, 0.06, 0.9, new THREE.MeshLambertMaterial({ color: 0xffce38 }), e.x, 0.02, escZ0 + 0.4));
            B.add(box(1.7, 0.06, 0.9, new THREE.MeshLambertMaterial({ color: 0xffce38 }), e.x, 5.52, escZ1 - 0.4));
            // табличка «ВВЕРХ/ВНИЗ»
            const sgnE = tMesh(dirUp ? '↑ ВВЕРХ' : '↓ ВНИЗ', 0.9, 0.22, '#39424e', null, 30, 400, 90);
            if (sgnE) { sgnE.position.set(e.x + 1.15, 1.7, escZ0 + 0.6); sgnE.rotation.y = dirUp ? -Math.PI / 4 : Math.PI / 4; B.add(sgnE); }
            B.add(g);
            GM.esc.push({ x: e.x, dir: e.dir, steps: steps });
          });
          // ── БУТИКИ вдоль северной стены (как в игре: LUXE/STREET/CHIC/URBAN) ──
          [['LUXE', 0xffd700, '#fff2b0'], ['STREET', 0x00b4d8, '#c8f0ff'], ['CHIC', 0xff6b9d, '#ffd8e4'], ['URBAN', 0x2ecc71, '#d6ffe6']]
            .forEach(([n, c, glow], i) => {
              const sx = -15 + i * 10;
              const pane = box(7, 3.2, 0.4, new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.22 }), sx, 1.6, -39.6);
              B.add(pane);
              // «вешалки» с одеждой
              for (let c2 = 0; c2 < 6; c2++) {
                B.add(box(0.5, 0.9, 0.12, new THREE.MeshLambertMaterial({ color: [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0xecf0f1][c2] }), sx - 2.5 + c2, 1.7, -39.0));
              }
              B.add(box(0.6, 0.06, 0.6, MM.metal, sx, 0.03, -38.2));   // подиум
              B.add(box(0.45, 0.75, 0.45, new THREE.MeshLambertMaterial({ color: c }), sx, 0.45, -38.2));
              const sgnB = tMesh(n, 2.6, 0.5, glow, null, 60, 700, 140);
              if (sgnB) { sgnB.position.set(sx, 3.9, -39.3); B.add(sgnB); }
            });
          // подпись «1 ЭТАЖ · МОДА» над бутиками
          const sgnF1 = tMesh('1 ЭТАЖ · МОДА', 7, 0.7, '#8a6f3f', '#d4af37', 56, 1100, 180);
          if (sgnF1) { sgnF1.position.set(-0, 4.55, -39.3); B.add(sgnF1); }
          // ── ВИТРИНЫ западной/восточной стен (наполнение) ──
          [[-21.7, -30, 1], [21.7, -30, -1], [21.7, -7, -1]].forEach(([wx, wz, dirx]) => {
            const pane = box(1.9, 3.0, 0.14, new THREE.MeshLambertMaterial({ color: 0x111820, emissive: 0x1a2430, emissiveIntensity: 0.4 }), wx, 1.7, wz);
            B.add(pane);
            const inn = box(1.6, 2.5, 0.1, new THREE.MeshBasicMaterial({ color: 0x3a4a5e, transparent: true, opacity: 0.7 }), wx, 1.75, wz - dirx * 0.1);
            B.add(inn);
          });
          // ── ЛИФТ (северо-восток, как в игре: x=16, z=-30) ──
          if (!OPT_NO_LIFT) {
          B.add(box(4.4, 5.5, 0.5, MM.beige2, 16, 2.75, -32.4));
          const dl = box(1.25, 2.6, 0.14, new THREE.MeshLambertMaterial({ color: 0xb8b8c0 }), 15.4, 1.3, -32.2);
          const dr = box(1.25, 2.6, 0.14, new THREE.MeshLambertMaterial({ color: 0xb8b8c0 }), 16.7, 1.3, -32.2);
          B.add(dl); B.add(dr);
          const sgnL = tMesh('ЛИФТ', 1.6, 0.4, '#5a4a3a', '#c8a060', 52, 500, 120);
          if (sgnL) { sgnL.position.set(16, 5.1, -32.1); B.add(sgnL); }
          B.add(sph(0.06, new THREE.MeshBasicMaterial({ color: 0xff5533 }), 15.4, 2.6, -32.05)); // кнопка
          }
          // ── ФОНТАН (как в игре: x=7.5, z=-26) ──
          if (!OPT_NO_FOUNTAIN) {
          B.add(cyl(2.6, 2.9, 0.55, 20, new THREE.MeshLambertMaterial({ color: 0x8fa8b2 }), 7.5, 0.28, -26));
          const water = cyl(2.35, 2.35, 0.12, 20, new THREE.MeshLambertMaterial({ color: 0x35c4f0, emissive: 0x35c4f0, emissiveIntensity: 0.35 }), 7.5, 0.56, -26);
          B.add(water);
          B.add(cyl(1.1, 1.4, 0.9, 14, new THREE.MeshLambertMaterial({ color: 0xa8c0ca }), 7.5, 1.0, -26));
          B.add(cyl(0.16, 0.3, 1.5, 10, new THREE.MeshLambertMaterial({ color: 0x9adfff, emissive: 0x35c4f0, emissiveIntensity: 0.55 }), 7.5, 2.1, -26));
          const fLight = new THREE.PointLight(0x35c4f0, 0.8, 9);
          fLight.position.set(7.5, 1.8, -26); B.add(fLight);
          // брызги-точки
          const spN = 160;
          const spos = new Float32Array(spN * 3);
          const sph2 = [];
          for (let i = 0; i < spN; i++) {
            sph2.push({ a: Math.random() * 6.28, r: 0.4 + Math.random() * 1.8, h: 0.8 + Math.random() * 1.7, sp: 1.1 + Math.random() * 1.5, ph: Math.random() * 6 });
          }
          const spGeo = new THREE.BufferGeometry();
          spGeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
          const spPts = new THREE.Points(spGeo, new THREE.PointsMaterial({ color: 0x9adfff, size: 0.05, transparent: true, opacity: 0.5 }));
          B.add(spPts);
          mallSpr.pts = spPts; mallSpr.pos = spos; mallSpr.ph = sph2; mallSpr.n = spN;
          const sgnF = tMesh('ФОНТАН', 2.9, 0.62, '#eaffff', '#35c4f0', 74, 900, 180);
          if (sgnF) { sgnF.position.set(7.5, 4.25, -26); B.add(sgnF); }
          }
          // ── КАРУСЕЛЬ (как в игре: x=7.5, z=-18) — медленно вращается ──
          const caru = new THREE.Group(); caru.position.set(7.5, 0, -18); B.add(caru);
          caru.add(cyl(2.7, 2.7, 0.35, 18, new THREE.MeshLambertMaterial({ color: 0xd4a05a }), 0, 0.18, 0));
          caru.add(cyl(0.5, 0.5, 0.2, 10, new THREE.MeshLambertMaterial({ color: 0x8a5a2a }), 0, 0.45, 0)); // ось
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * 6.283;
            const pole = cyl(0.05, 0.05, 3.6, 8, new THREE.MeshLambertMaterial({ color: 0xd8d8d8, emissive: 0xfff6c0, emissiveIntensity: 0.2 }), Math.cos(a) * 2.0, 2.1, Math.sin(a) * 2.0);
            caru.add(pole);
            const horse = box(0.9, 0.5, 0.35, new THREE.MeshLambertMaterial({ color: [0xf4f0e8, 0xa23b3b, 0x3b6ba2, 0x3ba25a, 0xa2893b, 0x6b3ba2][k] }), Math.cos(a) * 2.0, 1.1 + (k % 2) * 0.35, Math.sin(a) * 2.0);
            horse.rotation.y = -a + Math.PI / 2; caru.add(horse);
          }
          const cupola = new THREE.Mesh(new THREE.ConeGeometry(2.9, 1.4, 18), new THREE.MeshLambertMaterial({ color: 0xc0392b, emissive: 0xff4d5e, emissiveIntensity: 0.22 }));
          cupola.position.y = 4.5; caru.add(cupola);
          const cupL = new THREE.PointLight(0xffe0b0, 0.5, 9);
          cupL.position.y = 3.4; caru.add(cupL);
          GM.caru = caru;
          // ── КИОСК МОРОЖЕНОГО (у входа: x=-16, z=-8) ──
          B.add(cyl(1.4, 1.4, 2.8, 10, new THREE.MeshLambertMaterial({ color: 0xff9f43 }), -16, 1.4, -8));
          B.add(cyl(0.05, 0.05, 0.3, 6, new THREE.MeshLambertMaterial({ color: 0x8a5a2a }), -16, 3.0, -8));
          const roofK = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.1, 10), new THREE.MeshLambertMaterial({ color: 0xe17055 }));
          roofK.position.set(-16, 3.6, -8); B.add(roofK);
          const sgnK = tMesh('МОРОЖЕНОЕ', 1.6, 0.4, '#5a2a10', '#ffb060', 40, 700, 160);
          if (sgnK) { sgnK.position.set(-16, 2.2, -8); B.add(sgnK); }
          // ── скамейки и растения (как в игре) ──
          [[-7.5, -13], [7.5, -13], [-7.5, -31], [7.5, -31]].forEach(([bx2, bz2]) => {
            B.add(box(2.6, 0.14, 0.7, new THREE.MeshLambertMaterial({ color: 0x8a6a4a }), bx2, 0.5, bz2));
            B.add(box(2.6, 0.55, 0.14, new THREE.MeshLambertMaterial({ color: 0x8a6a4a }), bx2, 0.28, bz2 + 0.3));
          });
          [-10, 0, 10].forEach((px) => {
            [-33.2, -10.8].forEach((pz) => {
              if (px === 10 && pz === -33.2) return; // место лифта
              B.add(box(0.75, 0.55, 0.75, new THREE.MeshLambertMaterial({ color: 0xa8703d }), px, 0.28, pz));
              const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.75, 8, 7), new THREE.MeshLambertMaterial({ color: 0x2d6b1e }));
              leaf.position.set(px, 1.2, pz); leaf.scale.y = 1.4; B.add(leaf);
            });
          });
          // ════ СЛУЖЕБНЫЙ КОМПЛЕКС ТИЗЕРА УДАЛЁН (v39) ════
          // В тизере здесь строились броневорота B1, грузовой лифт с табло
          // B1→B5 и комната босса. В игре всё это дублировало настоящие
          // объекты: рабочий лифт (кабина + катсцена + табло B5…3),
          // fzServiceDoor (заколоченный досками служебный вход) и
          // fzBossDoorway. Из-за дублей игрок видел два лифта рядом и
          // вторую служебную дверь без досок. Настоящие объекты строит
          // buildMallInterior в public/index.html.
          // Пустые заглушки: setFreightInd и внешние вызовы их проверяют.
          GM.brd = [];
          GM.svc = null;
          GM.freight = null;
          // 2 этаж (вид снизу через атриум): витрины электроники над северной стеной
          for (let i = 0; i < 6; i++) {
            const c = [0x0af, 0xfa0, 0xaf0, 0xf0a, 0xaff, 0xa0f][i];
            B.add(box(2.6, 1.6, 0.14, new THREE.MeshLambertMaterial({ color: 0x101014, emissive: c, emissiveIntensity: 0.5 }), -17 + i * 3.2, 8.6, -39.6));
          }
          const sgnE2 = tMesh('2 ЭТАЖ · ЭЛЕКТРОНИКА + ИГРЫ', 8, 0.6, '#9fdcff', '#2a7ab0', 44, 1300, 170);
          if (sgnE2) { sgnE2.position.set(0, 10.2, -39.5); B.add(sgnE2); }
          // 3 этаж: фудкорт-панель у северо-востока (видна сквозь атриум)
          const sgnE3 = tMesh('3 ЭТАЖ · ФУДКОРТ + КИНО', 9, 0.65, '#ffd9a0', '#ff9a3c', 44, 1400, 180);
          if (sgnE3) { sgnE3.position.set(10, 15.6, -35); sgnE3.rotation.y = 0.6; B.add(sgnE3); }
          const sgnE3b = tMesh('FANTAZIA CINEMA', 5, 0.6, '#c8b8ff', '#6c5ce7', 50, 900, 150);
          if (sgnE3b) { sgnE3b.position.set(10, 15.0, -33); sgnE3b.rotation.y = 0.6; B.add(sgnE3b); }
        }
      // ── СБОРКА ──
      buildMALL();

      // ставим молл в мир
      GM.position.set(ox || 0, oy || 0, oz || 0);

      FZ_TEASER_MALL.root = GM;
      FZ_TEASER_MALL.api = GM.userData;
      FZ_TEASER_MALL.setFreightInd = setFreightInd;

      let n = 0;
      GM.traverse(function () { n++; });
      console.log('[TEASER MALL] 🏬 молл из тизера построен: ' + n + ' объектов');
      return GM;
    },

    // Анимация капель фонтана (как в тизере)
    animate: function (dt) {
      const GM = FZ_TEASER_MALL.root;
      if (!GM || !GM.userData || !GM.userData.pts) return;
      const s = GM.userData;
      const pos = s.pos;
      for (let i = 0; i < s.n; i++) {
        s.ph[i] += dt * 2.2;
        pos[i * 3 + 1] = 1.1 + Math.abs(Math.sin(s.ph[i])) * 1.5;
      }
      s.pts.geometry.attributes.position.needsUpdate = true;
    }
  };
})();
