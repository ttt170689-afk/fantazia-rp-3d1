// ═══════════════════════════════════════════════════════════════════════════
//  FANTAZIA RP v52 — КОСМЕТИКА: 200+ ПРЕДМЕТОВ
//
//  ПОЧЕМУ ГЕНЕРАТОР, А НЕ 200 РУЧНЫХ CASE:
//  В игре каждый аксессуар — отдельная ветка switch с ручной сборкой мешей
//  (~15 строк на предмет). 200 предметов = 3000 строк копипасты, которые
//  невозможно поддерживать и которые раздувают файл.
//  Вместо этого: 24 БАЗОВЫХ АРХЕТИПА (шляпа, очки, крылья, аура…), каждый
//  параметризован цветом, металличностью, размером и свечением. Комбинации
//  дают 200+ визуально разных предметов при полностью читаемом коде.
//
//  ЭКОНОМИКА: у каждого предмета цена в монетах и редкость. Монеты
//  зарабатываются игрой (см. FZ_EARN ниже), а не выдаются просто так.
// ═══════════════════════════════════════════════════════════════════════════
(function FZ_COSMETICS() {
  'use strict';

  var T = window.THREE;
  if (!T) { console.warn('[FZ52] THREE не найден — косметика не загружена'); return; }

  // ── редкости: влияют на цену, свечение и рамку в UI ──
  var RARITY = {
    common:    { name: 'Обычный',      color: '#9aa0a8', mult: 1.0,  glow: 0.00 },
    uncommon:  { name: 'Необычный',    color: '#4ade80', mult: 1.8,  glow: 0.10 },
    rare:      { name: 'Редкий',       color: '#38bdf8', mult: 3.2,  glow: 0.22 },
    epic:      { name: 'Эпический',    color: '#a855f7', mult: 6.0,  glow: 0.38 },
    legendary: { name: 'Легендарный',  color: '#f59e0b', mult: 12.0, glow: 0.60 },
    mythic:    { name: 'Мифический',   color: '#ef4444', mult: 24.0, glow: 0.85 }
  };

  // ── палитра: переиспользуется всеми архетипами ──
  var C = {
    gold:    0xFFD700, silver: 0xC0C0C0, bronze:  0xCD7F32, plat:  0xE5E4E2,
    ruby:    0xE0115F, sapph:  0x0F52BA, emerald: 0x50C878, amethyst: 0x9966CC,
    onyx:    0x1A1A1A, pearl:  0xF8F6F0, coral:   0xFF7F50, jade:  0x00A86B,
    neonPink:0xFF6EC7, neonCyan:0x00F5FF, neonLime:0xCCFF00, neonOrange:0xFF6B35,
    crimson: 0xDC143C, navy:   0x1B2A4A, forest:  0x228B22, plum:  0x8E4585,
    ice:     0xB0E0E6, lava:   0xFF4500, void_:   0x2D1B4E, toxic: 0x39FF14,
    rose:    0xFF007F, mint:   0x98FF98, sand:    0xC2B280, ash:   0x4A4A4A
  };

  function mkMat(color, opts) {
    opts = opts || {};
    var p = {
      color: color,
      metalness: opts.metal !== undefined ? opts.metal : 0.3,
      roughness: opts.rough !== undefined ? opts.rough : 0.55
    };
    if (opts.emissive) { p.emissive = opts.emissive; p.emissiveIntensity = opts.glow || 0.4; }
    if (opts.transparent) { p.transparent = true; p.opacity = opts.opacity || 0.6; }
    try { return new T.MeshStandardMaterial(p); }
    catch (e) { return new T.MeshLambertMaterial({ color: color }); }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  АРХЕТИПЫ. Каждый — функция(group, cfg), строящая 3D-предмет.
  //  Координаты подобраны под модель игрока: голова y≈2.35, торс y≈1.6.
  // ═══════════════════════════════════════════════════════════════════════
  var BUILD = {

    // ── ГОЛОВНЫЕ УБОРЫ ──
    hat: function (g, c) {
      var m = mkMat(c.color, c);
      var brim = new T.Mesh(new T.CylinderGeometry(0.46 * c.size, 0.46 * c.size, 0.035, 20), m);
      brim.position.y = 2.72; g.add(brim);
      var top = new T.Mesh(new T.CylinderGeometry(0.29 * c.size, 0.31 * c.size, 0.42 * c.size, 20), m);
      top.position.y = 2.94; g.add(top);
      if (c.band) {
        var b = new T.Mesh(new T.CylinderGeometry(0.315 * c.size, 0.315 * c.size, 0.07, 20), mkMat(c.band, { metal: 0.6 }));
        b.position.y = 2.79; g.add(b);
      }
    },

    cap: function (g, c) {
      var m = mkMat(c.color, c);
      var dome = new T.Mesh(new T.SphereGeometry(0.36 * c.size, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), m);
      dome.position.y = 2.62; g.add(dome);
      var peak = new T.Mesh(new T.BoxGeometry(0.44 * c.size, 0.035, 0.3 * c.size), m);
      peak.position.set(0, 2.63, 0.3 * c.size); g.add(peak);
      if (c.accent) {
        var btn = new T.Mesh(new T.SphereGeometry(0.035, 8, 6), mkMat(c.accent, { metal: 0.8 }));
        btn.position.y = 2.98; g.add(btn);
      }
    },

    crown: function (g, c) {
      var m = mkMat(c.color, { metal: 0.95, rough: 0.15, emissive: c.emissive, glow: c.glow });
      var band = new T.Mesh(new T.CylinderGeometry(0.35 * c.size, 0.35 * c.size, 0.13, 20), m);
      band.position.y = 2.72; g.add(band);
      var pts = c.points || 5;
      for (var i = 0; i < pts; i++) {
        var a = (i / pts) * Math.PI * 2;
        var sp = new T.Mesh(new T.ConeGeometry(0.055 * c.size, 0.22 * c.size, 6), m);
        sp.position.set(Math.cos(a) * 0.33 * c.size, 2.88, Math.sin(a) * 0.33 * c.size);
        g.add(sp);
        if (c.gem) {
          var gem = new T.Mesh(new T.OctahedronGeometry(0.04 * c.size), mkMat(c.gem, { metal: 0.2, rough: 0.05, emissive: c.gem, glow: 0.5 }));
          gem.position.set(Math.cos(a) * 0.33 * c.size, 3.0, Math.sin(a) * 0.33 * c.size);
          g.add(gem);
        }
      }
    },

    helmet: function (g, c) {
      var m = mkMat(c.color, { metal: 0.85, rough: 0.3 });
      var sh = new T.Mesh(new T.SphereGeometry(0.4 * c.size, 16, 12), m);
      sh.position.y = 2.42; sh.scale.z = 1.1; g.add(sh);
      if (c.visor) {
        var v = new T.Mesh(new T.BoxGeometry(0.5 * c.size, 0.14, 0.06),
          mkMat(c.visor, { metal: 0.4, rough: 0.05, transparent: true, opacity: 0.75, emissive: c.visor, glow: 0.4 }));
        v.position.set(0, 2.36, 0.36 * c.size); g.add(v);
      }
      if (c.crest) {
        var cr = new T.Mesh(new T.BoxGeometry(0.05, 0.2 * c.size, 0.5 * c.size), mkMat(c.crest, { metal: 0.7 }));
        cr.position.y = 2.75; g.add(cr);
      }
    },

    beanie: function (g, c) {
      var m = mkMat(c.color, { metal: 0.05, rough: 0.9 });
      var b = new T.Mesh(new T.SphereGeometry(0.37 * c.size, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), m);
      b.position.y = 2.58; g.add(b);
      var cuff = new T.Mesh(new T.CylinderGeometry(0.375 * c.size, 0.375 * c.size, 0.12, 16), m);
      cuff.position.y = 2.5; g.add(cuff);
      if (c.pom) {
        var p = new T.Mesh(new T.SphereGeometry(0.09 * c.size, 10, 8), mkMat(c.pom, { rough: 1 }));
        p.position.y = 2.92; g.add(p);
      }
    },

    // ── ОЧКИ И МАСКИ ──
    glasses: function (g, c) {
      var fm = mkMat(c.color, { metal: 0.7, rough: 0.25 });
      var lm = mkMat(c.lens || 0x111111, {
        metal: 0.1, rough: 0.05, transparent: true,
        opacity: c.opacity || 0.72, emissive: c.emissive, glow: c.glow
      });
      [-0.16, 0.16].forEach(function (x) {
        var l = new T.Mesh(new T.CircleGeometry(0.115 * c.size, 16), lm);
        l.position.set(x, 2.36, 0.34); g.add(l);
        var r = new T.Mesh(new T.TorusGeometry(0.118 * c.size, 0.015, 6, 18), fm);
        r.position.set(x, 2.36, 0.34); g.add(r);
      });
      var br = new T.Mesh(new T.BoxGeometry(0.09, 0.014, 0.014), fm);
      br.position.set(0, 2.37, 0.34); g.add(br);
      [-0.3, 0.3].forEach(function (x) {
        var t = new T.Mesh(new T.BoxGeometry(0.014, 0.014, 0.24), fm);
        t.position.set(x, 2.36, 0.22); g.add(t);
      });
    },

    visorGlass: function (g, c) {
      var v = new T.Mesh(new T.BoxGeometry(0.58 * c.size, 0.13, 0.05),
        mkMat(c.color, { metal: 0.3, rough: 0.05, transparent: true, opacity: 0.8, emissive: c.emissive || c.color, glow: c.glow || 0.6 }));
      v.position.set(0, 2.37, 0.33); g.add(v);
      var fr = new T.Mesh(new T.BoxGeometry(0.6 * c.size, 0.03, 0.06), mkMat(c.frame || C.ash, { metal: 0.8 }));
      fr.position.set(0, 2.45, 0.33); g.add(fr);
    },

    mask: function (g, c) {
      var m = mkMat(c.color, c);
      var f = new T.Mesh(new T.SphereGeometry(0.33 * c.size, 14, 10, 0, Math.PI, 0, Math.PI), m);
      f.position.set(0, 2.33, 0.06); f.rotation.y = -Math.PI / 2; g.add(f);
      if (c.eyes) {
        [-0.13, 0.13].forEach(function (x) {
          var e = new T.Mesh(new T.SphereGeometry(0.045, 8, 6),
            mkMat(c.eyes, { emissive: c.eyes, glow: 0.9, metal: 0 }));
          e.position.set(x, 2.4, 0.3); g.add(e);
        });
      }
    },

    // ── УКРАШЕНИЯ ──
    earrings: function (g, c) {
      var m = mkMat(c.color, { metal: 0.92, rough: 0.18 });
      [-0.37, 0.37].forEach(function (x) {
        var h = new T.Mesh(new T.TorusGeometry(0.055 * c.size, 0.012, 6, 14), m);
        h.position.set(x, 2.27, 0); h.rotation.y = Math.PI / 2; g.add(h);
        if (c.gem) {
          var d = new T.Mesh(new T.OctahedronGeometry(0.038 * c.size),
            mkMat(c.gem, { metal: 0.15, rough: 0.05, emissive: c.gem, glow: 0.45 }));
          d.position.set(x, 2.19, 0); g.add(d);
        }
      });
    },

    necklace: function (g, c) {
      var m = mkMat(c.color, { metal: 0.9, rough: 0.2 });
      var ch = new T.Mesh(new T.TorusGeometry(0.19 * c.size, 0.016, 8, 26), m);
      ch.position.set(0, 1.93, 0.05); ch.rotation.x = Math.PI / 2 - 0.28; g.add(ch);
      if (c.pendant) {
        var p = new T.Mesh(new T.OctahedronGeometry(0.06 * c.size),
          mkMat(c.pendant, { metal: 0.25, rough: 0.05, emissive: c.pendant, glow: 0.5 }));
        p.position.set(0, 1.79, 0.17); g.add(p);
      }
    },

    watch: function (g, c) {
      var band = mkMat(c.band || C.onyx, { metal: 0.2, rough: 0.8 });
      var face = mkMat(c.color, { metal: 0.95, rough: 0.1, emissive: c.emissive, glow: c.glow });
      var b = new T.Mesh(new T.TorusGeometry(0.058, 0.013, 8, 16), band);
      b.position.set(0.33, 1.32, 0.04); b.rotation.y = Math.PI / 2; g.add(b);
      var f = new T.Mesh(new T.CylinderGeometry(0.045 * c.size, 0.045 * c.size, 0.018, 14), face);
      f.position.set(0.36, 1.32, 0.04); f.rotation.z = Math.PI / 2; g.add(f);
    },

    // ── СПИНА ──
    wings: function (g, c) {
      var m = mkMat(c.color, {
        metal: c.metal || 0.2, rough: 0.4,
        transparent: true, opacity: c.opacity || 0.82,
        emissive: c.emissive, glow: c.glow
      });
      [-1, 1].forEach(function (s) {
        var wing = new T.Group();
        var seg = c.segments || 3;
        for (var i = 0; i < seg; i++) {
          var len = (0.55 - i * 0.1) * c.size;
          var f = new T.Mesh(new T.BoxGeometry(len, 0.055, 0.022), m);
          f.position.set(s * (0.22 + len / 2), 1.92 - i * 0.19, -0.2);
          f.rotation.z = s * (0.42 - i * 0.16);
          f.rotation.y = s * 0.28;
          wing.add(f);
        }
        g.add(wing);
      });
    },

    cape: function (g, c) {
      var m = mkMat(c.color, {
        metal: 0.05, rough: 0.85, transparent: true, opacity: c.opacity || 0.9,
        emissive: c.emissive, glow: c.glow
      });
      var body = new T.Mesh(new T.BoxGeometry(0.62 * c.size, 1.05 * c.size, 0.035), m);
      body.position.set(0, 1.42, -0.22); body.rotation.x = -0.08; g.add(body);
      var col = new T.Mesh(new T.BoxGeometry(0.5, 0.13, 0.09), mkMat(c.collar || c.color, { metal: 0.4 }));
      col.position.set(0, 1.97, -0.16); g.add(col);
    },

    backpack: function (g, c) {
      var m = mkMat(c.color, { metal: 0.1, rough: 0.85 });
      var b = new T.Mesh(new T.BoxGeometry(0.42 * c.size, 0.52 * c.size, 0.22 * c.size), m);
      b.position.set(0, 1.6, -0.28); g.add(b);
      var pk = new T.Mesh(new T.BoxGeometry(0.3 * c.size, 0.2 * c.size, 0.1), mkMat(c.accent || C.ash, { rough: 0.9 }));
      pk.position.set(0, 1.46, -0.4); g.add(pk);
      [-0.16, 0.16].forEach(function (x) {
        var st = new T.Mesh(new T.BoxGeometry(0.06, 0.42, 0.04), mkMat(c.accent || C.onyx, { rough: 0.9 }));
        st.position.set(x, 1.72, -0.14); g.add(st);
      });
    },

    // ── ЭФФЕКТЫ ──
    halo: function (g, c) {
      var m = mkMat(c.color, {
        metal: 0.1, rough: 0.2, emissive: c.emissive || c.color,
        glow: c.glow || 0.85, transparent: true, opacity: 0.9
      });
      var h = new T.Mesh(new T.TorusGeometry(0.3 * c.size, 0.032, 10, 28), m);
      h.position.y = 3.06; h.rotation.x = Math.PI / 2;
      h.userData.fzSpin = c.spin || 0.6;
      h.userData.fzFloat = 0.035;
      g.add(h);
    },

    aura: function (g, c) {
      var m = mkMat(c.color, {
        transparent: true, opacity: c.opacity || 0.18,
        emissive: c.emissive || c.color, glow: c.glow || 0.7, metal: 0
      });
      var a = new T.Mesh(new T.SphereGeometry(0.95 * c.size, 16, 12), m);
      a.position.y = 1.3;
      a.userData.fzPulse = 0.07;
      g.add(a);
      var ringCount = c.rings || 2;
      for (var i = 0; i < ringCount; i++) {
        var r = new T.Mesh(new T.TorusGeometry((0.55 + i * 0.2) * c.size, 0.02, 8, 26), m);
        r.position.y = 0.16 + i * 0.5;
        r.rotation.x = Math.PI / 2;
        r.userData.fzSpin = (i % 2 ? -0.5 : 0.5) * (c.spin || 1);
        g.add(r);
      }
    },

    horns: function (g, c) {
      var m = mkMat(c.color, { metal: c.metal || 0.3, rough: 0.5, emissive: c.emissive, glow: c.glow });
      [-1, 1].forEach(function (s) {
        var h = new T.Mesh(new T.ConeGeometry(0.062 * c.size, 0.3 * c.size, 8), m);
        h.position.set(s * 0.22, 2.78, 0);
        h.rotation.z = s * -0.42;
        g.add(h);
        if (c.tips) {
          var t = new T.Mesh(new T.SphereGeometry(0.03 * c.size, 8, 6),
            mkMat(c.tips, { emissive: c.tips, glow: 0.8 }));
          t.position.set(s * 0.3, 2.93, 0); g.add(t);
        }
      });
    },

    ears: function (g, c) {
      var m = mkMat(c.color, { metal: 0.02, rough: 0.95 });
      [-1, 1].forEach(function (s) {
        var e = new T.Mesh(new T.ConeGeometry(0.1 * c.size, 0.24 * c.size, 8), m);
        e.position.set(s * 0.2, 2.78, 0); e.rotation.z = s * -0.22; g.add(e);
        var inner = new T.Mesh(new T.ConeGeometry(0.06 * c.size, 0.16 * c.size, 8),
          mkMat(c.inner || C.rose, { rough: 1 }));
        inner.position.set(s * 0.2, 2.76, 0.03); inner.rotation.z = s * -0.22; g.add(inner);
      });
    },

    tail: function (g, c) {
      var m = mkMat(c.color, { metal: 0.05, rough: 0.9 });
      var seg = c.segments || 5;
      for (var i = 0; i < seg; i++) {
        var t = i / seg;
        var s = new T.Mesh(new T.SphereGeometry((0.09 - t * 0.045) * c.size, 8, 6), m);
        s.position.set(0, 1.0 - t * 0.34, -0.26 - t * 0.42);
        s.userData.fzWag = 0.05 + t * 0.09;
        g.add(s);
      }
    },

    // ── В РУКАХ ──
    handItem: function (g, c) {
      var m = mkMat(c.color, { metal: c.metal || 0.6, rough: 0.4, emissive: c.emissive, glow: c.glow });
      var it = new T.Mesh(
        c.shape === 'sphere' ? new T.SphereGeometry(0.1 * c.size, 12, 10) :
        c.shape === 'cone'   ? new T.ConeGeometry(0.08 * c.size, 0.3 * c.size, 10) :
                               new T.BoxGeometry(0.09 * c.size, 0.32 * c.size, 0.09 * c.size),
        m);
      it.position.set(0.34, 1.16, 0.1);
      it.rotation.z = -0.2;
      g.add(it);
    },

    shoulder: function (g, c) {
      var m = mkMat(c.color, { metal: 0.8, rough: 0.35, emissive: c.emissive, glow: c.glow });
      [-1, 1].forEach(function (s) {
        var pad = new T.Mesh(new T.SphereGeometry(0.16 * c.size, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), m);
        pad.position.set(s * 0.33, 1.86, 0); g.add(pad);
        if (c.spike) {
          var sp = new T.Mesh(new T.ConeGeometry(0.04 * c.size, 0.14 * c.size, 6), mkMat(c.spike, { metal: 0.9 }));
          sp.position.set(s * 0.36, 1.98, 0); sp.rotation.z = s * -0.35; g.add(sp);
        }
      });
    },

    belt: function (g, c) {
      var m = mkMat(c.color, { metal: 0.2, rough: 0.8 });
      var b = new T.Mesh(new T.CylinderGeometry(0.3 * c.size, 0.3 * c.size, 0.1, 18), m);
      b.position.y = 1.24; g.add(b);
      var bk = new T.Mesh(new T.BoxGeometry(0.13, 0.11, 0.05), mkMat(c.buckle || C.gold, { metal: 0.95, rough: 0.1 }));
      bk.position.set(0, 1.24, 0.29); g.add(bk);
    },

    scarf: function (g, c) {
      var m = mkMat(c.color, { metal: 0.02, rough: 0.95 });
      var n = new T.Mesh(new T.TorusGeometry(0.21, 0.07, 8, 18), m);
      n.position.set(0, 2.0, 0); n.rotation.x = Math.PI / 2; g.add(n);
      var tail = new T.Mesh(new T.BoxGeometry(0.14, 0.5 * c.size, 0.05), m);
      tail.position.set(0.12, 1.72, 0.14); tail.rotation.z = 0.14; g.add(tail);
    },

    trail: function (g, c) {
      var m = mkMat(c.color, {
        transparent: true, opacity: 0.5, emissive: c.emissive || c.color,
        glow: c.glow || 0.8, metal: 0
      });
      for (var i = 0; i < 6; i++) {
        var p = new T.Mesh(new T.SphereGeometry((0.07 - i * 0.008) * c.size, 8, 6), m);
        p.position.set(0, 0.2 + i * 0.05, -0.3 - i * 0.16);
        p.userData.fzOrbit = { r: 0.34, a: (i / 6) * Math.PI * 2, sp: 1.3 };
        g.add(p);
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  //  КАТАЛОГ: 200+ ПРЕДМЕТОВ
  //  Формат: [id, название, эмодзи, архетип, редкость, cfg]
  // ═══════════════════════════════════════════════════════════════════════
  function item(id, name, emoji, type, rarity, cfg) {
    cfg = cfg || {};
    if (cfg.size === undefined) cfg.size = 1;
    var base = cfg.base || 30;
    return {
      id: id, name: name, emoji: emoji, type: type, rarity: rarity,
      cfg: cfg,
      coinPrice: Math.round(base * RARITY[rarity].mult),
      slot: cfg.slot || 'head'
    };
  }

  var ITEMS = [];

  // ── ШЛЯПЫ (24) ──
  [
    ['tophat_black',  'Цилиндр',          '🎩', C.onyx,   'common',    { band: C.ash }],
    ['tophat_gold',   'Золотой цилиндр',  '🎩', C.gold,   'epic',      { band: C.onyx, metal: 0.95 }],
    ['tophat_royal',  'Царский цилиндр',  '🎩', C.plum,   'legendary', { band: C.gold, metal: 0.6 }],
    ['fedora_brown',  'Федора',           '👒', 0x6B4423, 'common',    { band: C.onyx }],
    ['fedora_white',  'Белая федора',     '👒', C.pearl,  'uncommon',  { band: C.crimson }],
    ['cowboy',        'Ковбойская',       '🤠', 0x8B5A2B, 'uncommon',  { band: C.gold, size: 1.15 }],
    ['cowboy_black',  'Чёрный ковбой',    '🤠', C.onyx,   'rare',      { band: C.silver, size: 1.15 }],
    ['wizard',        'Шляпа мага',       '🧙', C.void_,  'epic',      { band: C.neonCyan, size: 1.2 }],
    ['wizard_star',   'Звёздный колпак',  '🌟', 0x2A1B5E, 'legendary', { band: C.gold, size: 1.25 }],
    ['witch',         'Ведьмина шляпа',   '🧹', 0x1A0E2E, 'rare',      { band: C.toxic }],
    ['party',         'Праздничный',      '🥳', C.neonPink,'common',   { band: C.neonCyan }],
    ['bowler',        'Котелок',          '🎓', 0x3A3A3A, 'common',    { band: C.onyx }],
    ['sombrero',      'Сомбреро',         '🌮', C.sand,   'uncommon',  { band: C.crimson, size: 1.35 }],
    ['chef',          'Колпак повара',    '👨‍🍳', C.pearl, 'uncommon',  {}],
    ['pirate',        'Пиратская',        '🏴‍☠️', C.onyx,  'rare',      { band: C.crimson }],
    ['santa',         'Колпак Санты',     '🎅', C.crimson,'rare',      { band: C.pearl }],
    ['crown_flower',  'Венок',            '🌸', C.rose,   'uncommon',  { band: C.mint }],
    ['halo_hat',      'Нимб-шляпа',       '😇', C.gold,   'epic',      { band: C.pearl, glow: 0.4, emissive: C.gold }],
    ['cyber_hat',     'Кибер-шляпа',      '🤖', C.ash,    'epic',      { band: C.neonCyan, emissive: C.neonCyan, glow: 0.5 }],
    ['void_hat',      'Шляпа пустоты',    '🌌', C.void_,  'mythic',    { band: C.amethyst, emissive: C.amethyst, glow: 0.7 }],
    ['lava_hat',      'Лавовый убор',     '🌋', C.lava,   'legendary', { band: C.onyx, emissive: C.lava, glow: 0.8 }],
    ['ice_hat',       'Ледяной убор',     '❄️', C.ice,    'legendary', { band: C.pearl, emissive: C.ice, glow: 0.6 }],
    ['toxic_hat',     'Токсичный',        '☢️', C.toxic,  'epic',      { band: C.onyx, emissive: C.toxic, glow: 0.7 }],
    ['rainbow_hat',   'Радужный',         '🌈', C.neonPink,'mythic',   { band: C.neonCyan, emissive: C.neonPink, glow: 0.9 }]
  ].forEach(function (a) { ITEMS.push(item(a[0], a[1], a[2], 'hat', a[4], Object.assign({ color: a[3], base: 25 }, a[5]))); });

  // ── КЕПКИ (18) ──
  [
    ['cap_red',    'Красная кепка',   '🧢', C.crimson,  'common'],
    ['cap_blue',   'Синяя кепка',     '🧢', C.sapph,    'common'],
    ['cap_black',  'Чёрная кепка',    '🧢', C.onyx,     'common'],
    ['cap_white',  'Белая кепка',     '🧢', C.pearl,    'common'],
    ['cap_green',  'Зелёная кепка',   '🧢', C.forest,   'common'],
    ['cap_pink',   'Розовая кепка',   '🧢', C.rose,     'uncommon'],
    ['cap_gold',   'Золотая кепка',   '🧢', C.gold,     'rare',      { metal: 0.9, accent: C.onyx }],
    ['cap_neon',   'Неоновая кепка',  '🧢', C.neonLime, 'rare',      { emissive: C.neonLime, glow: 0.5 }],
    ['cap_camo',   'Камуфляж',        '🪖', 0x4B5320,   'uncommon',  { accent: C.sand }],
    ['cap_king',   'Кепка короля',    '👑', C.plum,     'epic',      { accent: C.gold, metal: 0.5 }],
    ['cap_ice',    'Ледяная кепка',   '🧊', C.ice,      'epic',      { emissive: C.ice, glow: 0.45 }],
    ['cap_fire',   'Огненная кепка',  '🔥', C.lava,     'epic',      { emissive: C.lava, glow: 0.6 }],
    ['cap_void',   'Кепка бездны',    '🕳️', C.void_,    'legendary', { emissive: C.amethyst, glow: 0.6 }],
    ['cap_cyber',  'Кибер-кепка',     '⚡', 0x1E2A3A,   'legendary', { accent: C.neonCyan, emissive: C.neonCyan, glow: 0.7 }],
    ['cap_pro',    'Про-кепка',       '🎮', C.onyx,     'rare',      { accent: C.neonPink }],
    ['cap_sport',  'Спортивная',      '⚽', C.pearl,    'common',    { accent: C.crimson }],
    ['cap_retro',  'Ретро-кепка',     '📼', C.coral,    'uncommon',  { accent: C.jade }],
    ['cap_mythic', 'Мифическая',      '✨', C.neonPink, 'mythic',    { accent: C.gold, emissive: C.neonPink, glow: 0.9 }]
  ].forEach(function (a) { ITEMS.push(item(a[0], a[1], a[2], 'cap', a[4], Object.assign({ color: a[3], base: 18 }, a[5] || {}))); });

  // ── КОРОНЫ (14) ──
  [
    ['crown_gold',    'Золотая корона',   '👑', C.gold,     'epic',      { gem: C.ruby, points: 5 }],
    ['crown_silver',  'Серебряная',       '👑', C.silver,   'rare',      { gem: C.sapph, points: 5 }],
    ['crown_bronze',  'Бронзовая',        '👑', C.bronze,   'uncommon',  { points: 4 }],
    ['crown_ruby',    'Рубиновая',        '💎', C.gold,     'legendary', { gem: C.ruby, points: 7 }],
    ['crown_sapph',   'Сапфировая',       '💎', C.silver,   'legendary', { gem: C.sapph, points: 7 }],
    ['crown_emerald', 'Изумрудная',       '💚', C.gold,     'legendary', { gem: C.emerald, points: 7 }],
    ['crown_diamond', 'Алмазная',         '💍', C.plat,     'mythic',    { gem: C.ice, points: 9, glow: 0.5, emissive: C.ice }],
    ['crown_dark',    'Тёмная корона',    '🖤', C.onyx,     'epic',      { gem: C.crimson, points: 6 }],
    ['crown_ice',     'Ледяная корона',   '❄️', C.ice,      'legendary', { gem: C.pearl, points: 6, emissive: C.ice, glow: 0.6 }],
    ['crown_fire',    'Огненная корона',  '🔥', C.lava,     'legendary', { gem: C.gold, points: 6, emissive: C.lava, glow: 0.8 }],
    ['crown_void',    'Корона бездны',    '🌌', C.void_,    'mythic',    { gem: C.amethyst, points: 8, emissive: C.amethyst, glow: 0.85 }],
    ['crown_nature',  'Природная',        '🌿', C.jade,     'rare',      { gem: C.mint, points: 5 }],
    ['crown_rose',    'Розовая корона',   '🌹', C.rose,     'epic',      { gem: C.pearl, points: 6 }],
    ['crown_god',     'Корона богов',     '⚜️', C.gold,     'mythic',    { gem: C.neonCyan, points: 10, emissive: C.gold, glow: 1.0 }]
  ].forEach(function (a) { ITEMS.push(item(a[0], a[1], a[2], 'crown', a[4], Object.assign({ color: a[3], base: 40 }, a[5]))); });

  // ── ШЛЕМЫ (14) ──
  [
    ['helm_knight',  'Рыцарский шлем',  '⚔️', C.silver,  'rare',      { visor: C.onyx, crest: C.crimson }],
    ['helm_gold',    'Золотой шлем',    '🛡️', C.gold,    'epic',      { visor: C.ruby, crest: C.crimson }],
    ['helm_space',   'Космошлем',       '🚀', C.plat,    'epic',      { visor: C.neonCyan }],
    ['helm_cyber',   'Кибершлем',       '🤖', 0x2A3441,  'legendary', { visor: C.neonPink, crest: C.neonCyan }],
    ['helm_samurai', 'Самурайский',     '🗡️', C.crimson, 'legendary', { visor: C.onyx, crest: C.gold }],
    ['helm_viking',  'Викинг',          '🪓', 0x6B6B6B,  'rare',      { crest: C.sand }],
    ['helm_diver',   'Водолазный',      '🤿', C.bronze,  'rare',      { visor: C.ice }],
    ['helm_pilot',   'Пилот',           '✈️', 0x8B7355,  'uncommon',  { visor: C.ice }],
    ['helm_moto',    'Мотошлем',        '🏍️', C.onyx,    'uncommon',  { visor: C.neonOrange }],
    ['helm_lava',    'Лавовый шлем',    '🌋', C.lava,    'legendary', { visor: C.gold, crest: C.onyx }],
    ['helm_ice',     'Ледяной шлем',    '🧊', C.ice,     'legendary', { visor: C.pearl, crest: C.plat }],
    ['helm_void',    'Шлем бездны',     '🌑', C.void_,   'mythic',    { visor: C.amethyst, crest: C.amethyst }],
    ['helm_toxic',   'Токсичный шлем',  '☣️', 0x3A4A20,  'epic',      { visor: C.toxic, crest: C.toxic }],
    ['helm_god',     'Шлем титана',     '⚡', C.plat,    'mythic',    { visor: C.gold, crest: C.neonCyan }]
  ].forEach(function (a) { ITEMS.push(item(a[0], a[1], a[2], 'helmet', a[4], Object.assign({ color: a[3], base: 45 }, a[5]))); });

  // ── ШАПКИ (10) ──
  [
    ['beanie_red',   'Шапка красная',  '🧶', C.crimson, 'common',   { pom: C.pearl }],
    ['beanie_blue',  'Шапка синяя',    '🧶', C.sapph,   'common',   { pom: C.pearl }],
    ['beanie_grey',  'Шапка серая',    '🧶', C.ash,     'common',   {}],
    ['beanie_pink',  'Шапка розовая',  '🧶', C.rose,    'uncommon', { pom: C.pearl }],
    ['beanie_mint',  'Шапка мятная',   '🧶', C.mint,    'uncommon', { pom: C.pearl }],
    ['beanie_gold',  'Шапка золотая',  '🧶', C.gold,    'rare',     { pom: C.onyx, metal: 0.7 }],
    ['beanie_neon',  'Шапка неон',     '🧶', C.neonLime,'rare',     { pom: C.neonPink, emissive: C.neonLime, glow: 0.4 }],
    ['beanie_ice',   'Шапка ледяная',  '🧶', C.ice,     'epic',     { pom: C.pearl, emissive: C.ice, glow: 0.4 }],
    ['beanie_fire',  'Шапка огня',     '🧶', C.lava,    'epic',     { pom: C.gold, emissive: C.lava, glow: 0.5 }],
    ['beanie_void',  'Шапка бездны',   '🧶', C.void_,   'legendary',{ pom: C.amethyst, emissive: C.amethyst, glow: 0.6 }]
  ].forEach(function (a) { ITEMS.push(item(a[0], a[1], a[2], 'beanie', a[4], Object.assign({ color: a[3], base: 15 }, a[5]))); });

  // ── ОЧКИ (22) ──
  [
    ['glass_sun',    'Солнечные',      '🕶️', C.onyx,   'common',    { lens: 0x111111 }],
    ['glass_aviator','Авиаторы',       '🕶️', C.gold,   'uncommon',  { lens: 0x3A2A1A, metal: 0.9 }],
    ['glass_round',  'Круглые',        '👓', C.bronze, 'common',     { lens: 0x223344, opacity: 0.4 }],
    ['glass_nerd',   'Ботанские',      '🤓', C.onyx,   'common',     { lens: 0xCCDDEE, opacity: 0.3 }],
    ['glass_red',    'Красные',        '🕶️', C.crimson,'uncommon',  { lens: 0x330000 }],
    ['glass_blue',   'Синие',          '🕶️', C.sapph,  'uncommon',  { lens: 0x001133 }],
    ['glass_pink',   'Розовые',        '🕶️', C.rose,   'uncommon',  { lens: 0x330022 }],
    ['glass_mirror', 'Зеркальные',     '🪞', C.silver, 'rare',       { lens: C.plat, metal: 0.95, opacity: 0.9 }],
    ['glass_neon',   'Неоновые',       '💫', C.onyx,   'rare',       { lens: C.neonCyan, emissive: C.neonCyan, glow: 0.6 }],
    ['glass_cyber',  'Кибер-очки',     '🤖', C.ash,    'epic',       { lens: C.neonPink, emissive: C.neonPink, glow: 0.7 }],
    ['glass_3d',     '3D-очки',        '🎬', C.crimson,'uncommon',   { lens: C.sapph, opacity: 0.5 }],
    ['glass_heart',  'Сердечки',       '💗', C.rose,   'rare',       { lens: C.neonPink, emissive: C.rose, glow: 0.4 }],
    ['glass_star',   'Звёздные',       '⭐', C.gold,   'epic',       { lens: C.gold, emissive: C.gold, glow: 0.6 }],
    ['glass_ice',    'Ледяные',        '❄️', C.ice,    'epic',       { lens: C.ice, emissive: C.ice, glow: 0.5 }],
    ['glass_fire',   'Огненные',       '🔥', C.lava,   'epic',       { lens: C.lava, emissive: C.lava, glow: 0.7 }],
    ['glass_void',   'Очки бездны',    '🌌', C.void_,  'legendary',  { lens: C.amethyst, emissive: C.amethyst, glow: 0.8 }],
    ['glass_matrix', 'Матрица',        '💻', C.onyx,   'legendary',  { lens: C.toxic, emissive: C.toxic, glow: 0.9 }],
    ['glass_god',    'Око бога',       '👁️', C.gold,   'mythic',     { lens: C.neonCyan, emissive: C.neonCyan, glow: 1.0 }],
    ['visor_cyber',  'Визор кибер',    '🥽', C.neonCyan,'epic',      { frame: C.ash, glow: 0.7 }],
    ['visor_red',    'Визор красный',  '🥽', C.crimson, 'rare',      { frame: C.onyx, glow: 0.6 }],
    ['visor_gold',   'Визор золотой',  '🥽', C.gold,    'legendary', { frame: C.onyx, glow: 0.8 }],
    ['visor_void',   'Визор бездны',   '🥽', C.amethyst,'mythic',    { frame: C.void_, glow: 1.0 }]
  ].forEach(function (a) {
    var type = a[0].indexOf('visor') === 0 ? 'visorGlass' : 'glasses';
    ITEMS.push(item(a[0], a[1], a[2], type, a[4], Object.assign({ color: a[3], base: 20 }, a[5])));
  });

  // ── МАСКИ (12) ──
  [
    ['mask_ninja',  'Маска ниндзя',   '🥷', C.onyx,    'uncommon', { eyes: C.crimson }],
    ['mask_gas',    'Противогаз',     '😷', 0x4A5A3A,  'rare',     { eyes: C.ice }],
    ['mask_hockey', 'Хоккейная',      '🏒', C.pearl,   'rare',     { eyes: C.onyx }],
    ['mask_theater','Театральная',    '🎭', C.gold,    'epic',     { eyes: C.onyx }],
    ['mask_fox',    'Лисья маска',    '🦊', C.neonOrange,'rare',   { eyes: C.gold }],
    ['mask_cat',    'Кошачья',        '🐱', C.pearl,   'uncommon', { eyes: C.emerald }],
    ['mask_skull',  'Череп',          '💀', C.pearl,   'epic',     { eyes: C.crimson }],
    ['mask_demon',  'Демон',          '👹', C.crimson, 'legendary',{ eyes: C.lava }],
    ['mask_ice',    'Ледяная маска',  '🧊', C.ice,     'epic',     { eyes: C.pearl, emissive: C.ice, glow: 0.5 }],
    ['mask_void',   'Маска бездны',   '🌑', C.void_,   'mythic',   { eyes: C.amethyst, emissive: C.amethyst, glow: 0.8 }],
    ['mask_cyber',  'Кибермаска',     '🤖', 0x2A3441,  'legendary',{ eyes: C.neonCyan, emissive: C.neonCyan, glow: 0.7 }],
    ['mask_toxic',  'Токсичная',      '☣️', 0x3A4A20,  'epic',     { eyes: C.toxic, emissive: C.toxic, glow: 0.7 }]
  ].forEach(function (a) { ITEMS.push(item(a[0], a[1], a[2], 'mask', a[4], Object.assign({ color: a[3], base: 28 }, a[5]))); });

  // ── СЕРЬГИ И ОЖЕРЕЛЬЯ (18) ──
  [
    ['ear_gold',    'Серьги золото',   '💛', 'earrings', C.gold,   'uncommon', {}],
    ['ear_silver',  'Серьги серебро',  '🤍', 'earrings', C.silver, 'common',   {}],
    ['ear_ruby',    'Серьги рубин',    '❤️', 'earrings', C.gold,   'rare',     { gem: C.ruby }],
    ['ear_sapph',   'Серьги сапфир',   '💙', 'earrings', C.silver, 'rare',     { gem: C.sapph }],
    ['ear_emerald', 'Серьги изумруд',  '💚', 'earrings', C.gold,   'epic',     { gem: C.emerald }],
    ['ear_diamond', 'Серьги алмаз',    '💎', 'earrings', C.plat,   'legendary',{ gem: C.ice }],
    ['ear_void',    'Серьги бездны',   '🌌', 'earrings', C.void_,  'mythic',   { gem: C.amethyst }],
    ['neck_gold',   'Цепь золотая',    '📿', 'necklace', C.gold,   'uncommon', {}],
    ['neck_silver', 'Цепь серебряная', '📿', 'necklace', C.silver, 'common',   {}],
    ['neck_ruby',   'Кулон рубин',     '❤️', 'necklace', C.gold,   'rare',     { pendant: C.ruby }],
    ['neck_sapph',  'Кулон сапфир',    '💙', 'necklace', C.silver, 'rare',     { pendant: C.sapph }],
    ['neck_skull',  'Кулон череп',     '💀', 'necklace', C.onyx,   'epic',     { pendant: C.pearl }],
    ['neck_star',   'Кулон звезда',    '⭐', 'necklace', C.gold,   'epic',     { pendant: C.gold }],
    ['neck_void',   'Кулон бездны',    '🕳️', 'necklace', C.void_,  'mythic',   { pendant: C.amethyst }],
    ['watch_gold',  'Часы золотые',    '⌚', 'watch',    C.gold,   'rare',     { band: C.onyx }],
    ['watch_silver','Часы серебряные', '⌚', 'watch',    C.silver, 'uncommon', { band: C.onyx }],
    ['watch_cyber', 'Часы кибер',      '⌚', 'watch',    C.neonCyan,'epic',    { band: C.ash, emissive: C.neonCyan, glow: 0.6 }],
    ['watch_god',   'Часы вечности',   '⏳', 'watch',    C.gold,   'mythic',   { band: C.void_, emissive: C.gold, glow: 0.8 }]
  ].forEach(function (a) { ITEMS.push(item(a[0], a[1], a[2], a[3], a[5], Object.assign({ color: a[4], base: 22 }, a[6]))); });

  // ── КРЫЛЬЯ (16) ──
  [
    ['wing_angel',   'Крылья ангела',   '😇', C.pearl,    'epic',      { segments: 4, opacity: 0.9 }],
    ['wing_demon',   'Крылья демона',   '😈', C.crimson,  'epic',      { segments: 3, opacity: 0.9 }],
    ['wing_fairy',   'Крылья феи',      '🧚', C.neonPink, 'rare',      { segments: 3, opacity: 0.55, emissive: C.neonPink, glow: 0.4 }],
    ['wing_bat',     'Крылья мыши',     '🦇', 0x2A1A2A,   'rare',      { segments: 3 }],
    ['wing_gold',    'Золотые крылья',  '🪶', C.gold,     'legendary', { segments: 4, metal: 0.9, emissive: C.gold, glow: 0.4 }],
    ['wing_ice',     'Ледяные крылья',  '❄️', C.ice,      'legendary', { segments: 4, opacity: 0.65, emissive: C.ice, glow: 0.6 }],
    ['wing_fire',    'Огненные крылья', '🔥', C.lava,     'legendary', { segments: 4, emissive: C.lava, glow: 0.85 }],
    ['wing_void',    'Крылья бездны',   '🌌', C.void_,    'mythic',    { segments: 5, emissive: C.amethyst, glow: 0.9 }],
    ['wing_cyber',   'Кибер-крылья',    '⚡', C.neonCyan, 'mythic',    { segments: 4, emissive: C.neonCyan, glow: 0.95 }],
    ['wing_toxic',   'Токсичные',       '☢️', C.toxic,    'epic',      { segments: 3, emissive: C.toxic, glow: 0.7 }],
    ['cape_hero',    'Плащ героя',      '🦸', C.crimson,  'epic',      { collar: C.gold }],
    ['cape_king',    'Королевский плащ','👑', C.plum,     'legendary', { collar: C.gold }],
    ['cape_shadow',  'Плащ теней',      '🌑', C.onyx,     'epic',      { opacity: 0.75 }],
    ['cape_star',    'Звёздный плащ',   '🌠', 0x1B2A5E,   'legendary', { collar: C.gold, emissive: C.sapph, glow: 0.4 }],
    ['cape_void',    'Плащ бездны',     '🕳️', C.void_,    'mythic',    { collar: C.amethyst, emissive: C.amethyst, glow: 0.6 }],
    ['cape_fire',    'Плащ пламени',    '🔥', C.lava,     'legendary', { collar: C.gold, emissive: C.lava, glow: 0.7 }]
  ].forEach(function (a) {
    var type = a[0].indexOf('cape') === 0 ? 'cape' : 'wings';
    ITEMS.push(item(a[0], a[1], a[2], type, a[4], Object.assign({ color: a[3], base: 55, slot: 'back' }, a[5])));
  });

  // ── ЭФФЕКТЫ: НИМБЫ И АУРЫ (20) ──
  [
    ['halo_gold',   'Нимб золотой',   '😇', 'halo', C.gold,     'epic',      {}],
    ['halo_white',  'Нимб белый',     '⚪', 'halo', C.pearl,    'rare',      {}],
    ['halo_blue',   'Нимб синий',     '🔵', 'halo', C.sapph,    'rare',      {}],
    ['halo_pink',   'Нимб розовый',   '🌸', 'halo', C.neonPink, 'epic',      {}],
    ['halo_toxic',  'Нимб токсик',    '☢️', 'halo', C.toxic,    'epic',      {}],
    ['halo_fire',   'Нимб огня',      '🔥', 'halo', C.lava,     'legendary', {}],
    ['halo_ice',    'Нимб льда',      '❄️', 'halo', C.ice,      'legendary', {}],
    ['halo_void',   'Нимб бездны',    '🌌', 'halo', C.amethyst, 'mythic',    { spin: 1.2 }],
    ['aura_red',    'Аура красная',   '🟥', 'aura', C.crimson,  'epic',      {}],
    ['aura_blue',   'Аура синяя',     '🟦', 'aura', C.sapph,    'epic',      {}],
    ['aura_green',  'Аура зелёная',   '🟩', 'aura', C.emerald,  'epic',      {}],
    ['aura_gold',   'Аура золотая',   '🟨', 'aura', C.gold,     'legendary', { rings: 3 }],
    ['aura_void',   'Аура бездны',    '🟪', 'aura', C.amethyst, 'mythic',    { rings: 3, spin: 1.4 }],
    ['aura_fire',   'Аура пламени',   '🔥', 'aura', C.lava,     'legendary', { rings: 3 }],
    ['aura_ice',    'Аура льда',      '🧊', 'aura', C.ice,      'legendary', { rings: 2 }],
    ['aura_toxic',  'Аура токсик',    '☣️', 'aura', C.toxic,    'epic',      {}],
    ['trail_fire',  'След огня',      '🔥', 'trail', C.lava,    'epic',      {}],
    ['trail_ice',   'След льда',      '❄️', 'trail', C.ice,     'epic',      {}],
    ['trail_neon',  'Неоновый след',  '💫', 'trail', C.neonCyan,'legendary', {}],
    ['trail_void',  'След бездны',    '🌌', 'trail', C.amethyst,'mythic',    {}]
  ].forEach(function (a) { ITEMS.push(item(a[0], a[1], a[2], a[3], a[5], Object.assign({ color: a[4], base: 60, slot: 'aura' }, a[6]))); });

  // ── РОГА, УШИ, ХВОСТЫ (18) ──
  [
    ['horn_demon',  'Рога демона',    '😈', 'horns', C.crimson,  'rare',      { tips: C.onyx }],
    ['horn_gold',   'Золотые рога',   '🐐', 'horns', C.gold,     'epic',      { metal: 0.9 }],
    ['horn_ice',    'Ледяные рога',   '❄️', 'horns', C.ice,      'epic',      { tips: C.pearl, emissive: C.ice, glow: 0.5 }],
    ['horn_fire',   'Огненные рога',  '🔥', 'horns', C.lava,     'legendary', { tips: C.gold, emissive: C.lava, glow: 0.8 }],
    ['horn_void',   'Рога бездны',    '🌑', 'horns', C.void_,    'mythic',    { tips: C.amethyst, emissive: C.amethyst, glow: 0.9 }],
    ['horn_bone',   'Костяные рога',  '🦴', 'horns', C.pearl,    'uncommon',  {}],
    ['ear_cat',     'Кошачьи ушки',   '🐱', 'ears',  C.onyx,     'rare',      { inner: C.rose }],
    ['ear_cat_w',   'Ушки белые',     '🐈', 'ears',  C.pearl,    'rare',      { inner: C.rose }],
    ['ear_fox',     'Лисьи ушки',     '🦊', 'ears',  C.neonOrange,'rare',     { inner: C.pearl }],
    ['ear_wolf',    'Волчьи ушки',    '🐺', 'ears',  C.ash,      'rare',      { inner: C.rose }],
    ['ear_bunny',   'Заячьи ушки',    '🐰', 'ears',  C.pearl,    'uncommon',  { inner: C.rose, size: 1.5 }],
    ['ears_void',   'Ушки бездны',    '🌌', 'ears',  C.void_,    'legendary', { inner: C.amethyst }],
    ['tail_cat',    'Кошачий хвост',  '🐈', 'tail',  C.onyx,     'rare',      {}],
    ['tail_fox',    'Лисий хвост',    '🦊', 'tail',  C.neonOrange,'epic',     { segments: 6 }],
    ['tail_wolf',   'Волчий хвост',   '🐺', 'tail',  C.ash,      'epic',      { segments: 6 }],
    ['tail_devil',  'Хвост демона',   '😈', 'tail',  C.crimson,  'epic',      { segments: 5 }],
    ['tail_dragon', 'Хвост дракона',  '🐉', 'tail',  C.emerald,  'legendary', { segments: 7 }],
    ['tail_void',   'Хвост бездны',   '🌑', 'tail',  C.void_,    'mythic',    { segments: 7 }]
  ].forEach(function (a) { ITEMS.push(item(a[0], a[1], a[2], a[3], a[5], Object.assign({ color: a[4], base: 35, slot: 'body' }, a[6]))); });

  // ── ЭКИПИРОВКА (20) ──
  [
    ['pack_school',  'Рюкзак школьный',  '🎒', 'backpack', 0x2A5A8A,  'common',    { accent: C.crimson }],
    ['pack_tactical','Рюкзак тактик',    '🎒', 'backpack', 0x3A4A2A,  'uncommon',  { accent: C.onyx }],
    ['pack_gold',    'Рюкзак золотой',   '🎒', 'backpack', C.gold,    'epic',      { accent: C.onyx }],
    ['pack_jet',     'Реактивный ранец', '🚀', 'backpack', C.silver,  'legendary', { accent: C.neonOrange }],
    ['shoulder_st',  'Наплечники сталь', '🛡️', 'shoulder', C.silver,  'rare',      {}],
    ['shoulder_gold','Наплечники злато', '🛡️', 'shoulder', C.gold,    'epic',      { spike: C.onyx }],
    ['shoulder_spike','Наплечники шипы', '⚔️', 'shoulder', C.ash,     'epic',      { spike: C.silver }],
    ['shoulder_void','Наплечники бездны','🌑', 'shoulder', C.void_,   'mythic',    { spike: C.amethyst, emissive: C.amethyst, glow: 0.6 }],
    ['belt_leather', 'Ремень кожаный',   '🥋', 'belt',     0x5A3A20,  'common',    { buckle: C.bronze }],
    ['belt_gold',    'Ремень золотой',   '👔', 'belt',     C.onyx,    'rare',      { buckle: C.gold }],
    ['belt_champion','Пояс чемпиона',    '🏆', 'belt',     C.crimson, 'legendary', { buckle: C.gold }],
    ['scarf_red',    'Шарф красный',     '🧣', 'scarf',    C.crimson, 'common',    {}],
    ['scarf_blue',   'Шарф синий',       '🧣', 'scarf',    C.sapph,   'common',    {}],
    ['scarf_gold',   'Шарф золотой',     '🧣', 'scarf',    C.gold,    'rare',      {}],
    ['scarf_void',   'Шарф бездны',      '🧣', 'scarf',    C.void_,   'epic',      { emissive: C.amethyst, glow: 0.4 }],
    ['hand_sword',   'Меч',              '⚔️', 'handItem', C.silver,  'rare',      { shape: 'box', size: 1.4 }],
    ['hand_staff',   'Посох',            '🪄', 'handItem', 0x6B4423,  'epic',      { shape: 'cone', size: 1.5 }],
    ['hand_orb',     'Сфера силы',       '🔮', 'handItem', C.amethyst,'legendary', { shape: 'sphere', emissive: C.amethyst, glow: 0.8 }],
    ['hand_torch',   'Факел',            '🔦', 'handItem', C.lava,    'rare',      { shape: 'cone', emissive: C.lava, glow: 0.9 }],
    ['hand_void',    'Клинок бездны',    '🗡️', 'handItem', C.void_,   'mythic',    { shape: 'box', size: 1.5, emissive: C.amethyst, glow: 0.9 }]
  ].forEach(function (a) { ITEMS.push(item(a[0], a[1], a[2], a[3], a[5], Object.assign({ color: a[4], base: 40, slot: 'gear' }, a[6]))); });

  // ═══════════════════════════════════════════════════════════════════════
  //  ПУБЛИЧНОЕ API
  // ═══════════════════════════════════════════════════════════════════════
  window.FZ_COSMETICS = {
    ITEMS: ITEMS,
    RARITY: RARITY,
    COLORS: C,

    count: function () { return ITEMS.length; },

    byId: function (id) {
      for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].id === id) return ITEMS[i];
      return null;
    },

    byRarity: function (r) {
      return ITEMS.filter(function (i) { return i.rarity === r; });
    },

    bySlot: function (s) {
      return ITEMS.filter(function (i) { return (i.cfg.slot || 'head') === s; });
    },

    // Построить 3D-предмет в переданную группу.
    build: function (group, id) {
      var it = this.byId(id);
      if (!it || !group) return false;
      var fn = BUILD[it.type];
      if (!fn) return false;
      try {
        fn(group, it.cfg);
        return true;
      } catch (e) {
        console.warn('[FZ52] не удалось собрать', id, e && e.message);
        return false;
      }
    },

    // Анимация «живых» частей: нимбы крутятся, ауры пульсируют, хвосты виляют.
    animate: function (group, t) {
      if (!group) return;
      for (var i = 0; i < group.children.length; i++) {
        var c = group.children[i], u = c.userData;
        if (!u) continue;
        if (u.fzSpin) c.rotation.z = t * u.fzSpin;
        if (u.fzFloat) c.position.y += Math.sin(t * 2.2) * u.fzFloat * 0.01;
        if (u.fzPulse) {
          var s = 1 + Math.sin(t * 1.8) * u.fzPulse;
          c.scale.set(s, s, s);
        }
        if (u.fzWag) c.position.x = Math.sin(t * 3.4) * u.fzWag;
        if (u.fzOrbit) {
          var o = u.fzOrbit;
          c.position.x = Math.cos(t * o.sp + o.a) * o.r;
          c.position.z = -0.3 + Math.sin(t * o.sp + o.a) * o.r * 0.5;
        }
      }
    }
  };

  console.log('[FZ52] косметика загружена:', ITEMS.length, 'предметов');
})();
