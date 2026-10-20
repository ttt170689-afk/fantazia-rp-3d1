// v8.9: deterministic public spaces. One description drives meshes, obstacles
// and interactions; no private geometries, timers or GPU resources per block.
(function () {
  "use strict";
  const TYPES = ["park", "court", "market", "terrace"];
  const NAMES = {
    park: "Тихий сад",
    court: "Дворовый баскетбол",
    market: "Квартальный рынок",
    terrace: "Городская терраса",
  };
  function plan(seed, theme) {
    const kind = TYPES[seed % TYPES.length];
    const pieces = [],
      obstacles = [],
      entries = [];
    function part(shape, color, x, y, z, w, h, d, solid = false, rotation = 0) {
      const p = { shape, color, x, y, z, w, h, d, rotation };
      pieces.push(p);
      if (solid) {
        const c = Math.abs(Math.cos(rotation)),
          s = Math.abs(Math.sin(rotation));
        const dx = (w * c + d * s) / 2,
          dz = (d * c + w * s) / 2;
        obstacles.push({
          minX: x - dx,
          maxX: x + dx,
          minZ: z - dz,
          maxZ: z + dz,
        });
      }
      return p;
    }
    const box = (color, x, y, z, w, h, d, solid = false) =>
      part("box", color, x, y, z, w, h, d, solid);
    const cylinder = (color, x, y, z, w, h, d, solid = false) =>
      part("cyl", color, x, y, z, w, h, d, solid);
    function sign(label, x, y, z, w = 6) {
      part("box", { label }, x, y, z, w, 0.9, 0.12);
    }
    function bench(x, z) {
      box(0x98764f, x, 0.56, z, 3.2, 0.16, 0.72, true);
      for (let n = 0; n < 3; n++)
        box(0xb18c5c, x, 0.84 + n * 0.17, z - 0.34, 3.2, 0.12, 0.1);
      for (const side of [-1, 1]) {
        box(0x324c50, x + side * 1.15, 0.27, z, 0.14, 0.54, 0.6);
        box(0x324c50, x + side * 1.5, 0.8, z, 0.1, 0.1, 0.7);
      }
      entries.push({
        type: "sit_bench",
        name: "Скамейка — посидеть",
        x,
        z: z + 1.4,
        range: 2.3,
        seat: { x, y: 0.64, z, rot: 0 },
      });
    }
    function planter(x, z, w = 5, d = 3) {
      box(0xb5b19e, x, 0.32, z, w, 0.64, d, true);
      box(0x546944, x, 0.67, z, w - 0.3, 0.12, d - 0.3);
      for (let n = 0; n < 5; n++) {
        const xx = x - w * 0.35 + n * w * 0.175;
        part(
          "leaf",
          [0xc59480, 0xc6b46f, 0x9c89b5][(seed + n) % 3],
          xx,
          0.97,
          z,
          0.65,
          0.55,
          0.65,
        );
      }
    }
    function pergola(x, z) {
      for (const dx of [-5, 5])
        for (const dz of [-3, 3])
          box(0x897c61, x + dx, 1.65, z + dz, 0.22, 3.3, 0.22, true);
      for (const dz of [-3, 3])
        box(0xa29470, x, 3.25, z + dz, 10.8, 0.24, 0.26);
      for (let dx = -5; dx <= 5; dx++)
        box(0xb5a780, x + dx, 3.5, z, 0.16, 0.22, 7);
    }
    function ring(x, y, z, r, color) {
      for (let n = 0; n < 24; n++) {
        const a = (n * Math.PI) / 12;
        part(
          "box",
          color,
          x + Math.cos(a) * r,
          y,
          z + Math.sin(a) * r,
          0.09,
          0.06,
          r * 0.27,
          false,
          -a,
        );
      }
    }
    // A single footprint, but four different spatial compositions.
    box(kind === "park" ? 0x839773 : 0xc1baaa, 119, 0.045, 119, 49, 0.09, 49);
    for (const n of [95, 143]) {
      box(0xa5a68d, n, 0.09, 119, 0.25, 0.08, 48);
      box(0xa5a68d, 119, 0.09, n, 48, 0.08, 0.25);
    }
    bench(108, 139);
    bench(131, 139);
    // A low sign facing the southern approach, without covering a doorway.
    sign(NAMES[kind], 139, 1.4, 143, 6);
    box(0x40585a, 136.5, 0.7, 143, 0.12, 1.4, 0.12, true);
    box(0x40585a, 141.5, 0.7, 143, 0.12, 1.4, 0.12, true);
    if (kind === "park") {
      for (const dx of [106, 132]) {
        box(0xbab6a0, dx, 0.1, 117, 4, 0.05, 38);
        planter(dx, 106, 8, 5);
        planter(dx, 127, 8, 4);
      }
      box(0xbab6a0, 119, 0.1, 119, 44, 0.05, 4);
      cylinder(0x9caaa0, 119, 0.4, 110, 8, 0.8, 8, true);
      cylinder(0x698e9b, 119, 0.82, 110, 7.3, 0.04, 7.3);
      cylinder(0xc3bda8, 119, 1.1, 110, 0.8, 1.2, 0.8);
      cylinder(0x9fb6b4, 119, 1.8, 110, 3, 0.16, 3);
      for (let n = 0; n < 10; n++) {
        const a = (n * Math.PI) / 5;
        cylinder(
          0xb0d4d0,
          119 + Math.cos(a) * 1.1,
          1.1,
          110 + Math.sin(a) * 1.1,
          0.08,
          1.15,
          0.08,
        );
      }
      pergola(119, 132);
      // Quiet gravel garden with small boulders and ornamental planting.
      for (const dx of [99, 139])
        for (const dz of [111, 121, 131]) {
          part("leaf", 0x8a9584, dx, 0.45, dz, 1.5, 0.9, 1.2, true);
          part("cone", 0x668062, dx + 1, 1, dz + 1, 1, 2, 1);
        }
    } else if (kind === "court") {
      box(0x476f72, 119, 0.12, 117, 26, 0.09, 32);
      box(0xae8265, 119, 0.17, 117, 20, 0.02, 28);
      for (const dx of [109, 129])
        box(0xf0e3c4, dx, 0.188, 117, 0.1, 0.012, 28);
      for (const dz of [103, 117, 131])
        box(0xf0e3c4, 119, 0.19, dz, 20, 0.012, 0.1);
      ring(119, 0.19, 117, 2.2, 0xf0e3c4);
      for (const dz of [103, 126]) {
        for (const dx of [116, 122])
          box(0xf0e3c4, dx, 0.19, dz + 2.5, 0.1, 0.012, 5);
        box(0xf0e3c4, 119, 0.19, dz === 103 ? 108 : 126, 6, 0.012, 0.1);
      }
      for (const end of [-1, 1]) {
        const z = 117 + end * 15,
          rimZ = z - end * 1.8;
        box(0x344d55, 119, 1.9, z, 0.18, 3.8, 0.18, true);
        box(0xe5e2d3, 119, 3.65, z - end * 0.55, 1.8, 1.05, 0.12);
        box(0x34535b, 119, 3.5, z - end * 0.64, 0.65, 0.45, 0.03);
        box(0xe9e7da, 119, 3.5, z - end * 0.67, 0.54, 0.34, 0.02);
        box(0xcc8053, 119, 3.05, z - end * 1.25, 0.08, 0.08, 1.1);
        ring(119, 3.05, rimZ, 0.45, 0xcb7349);
        for (let n = 0; n < 8; n++) {
          const a = (n * Math.PI) / 4;
          cylinder(
            0xdedbcb,
            119 + Math.cos(a) * 0.34,
            2.8,
            rimZ + Math.sin(a) * 0.34,
            0.022,
            0.45,
            0.022,
          );
        }
      }
      // Fence only at the sides; both ends stay open and walkable.
      for (const dx of [104, 134]) {
        for (let z = 102; z <= 132; z += 5)
          box(0x435d60, dx, 1.1, z, 0.1, 2.2, 0.1, true);
        for (const y of [0.7, 1.4, 2.1])
          box(0x6c8280, dx, y, 117, 0.045, 0.04, 30);
      }
      entries.push({
        type: "city_basketball",
        name: "Баскетбол — пять бросков",
        x: 119,
        z: 124,
        range: 3.8,
        hoop: { x: 119, y: 3.05, z: 103.8 },
        launch: { x: 119, y: 1.8, z: 111.5 },
      });
    } else if (kind === "market") {
      for (const x of [105, 133])
        for (const z of [106, 120]) {
          box(0x846a50, x, 0.72, z, 6, 1.44, 3, true);
          box(0xb4a078, x, 1.5, z, 6.3, 0.15, 3.3);
          for (const dx of [-3, 3])
            for (const dz of [-1.5, 1.5])
              box(0x566764, x + dx, 1.8, z + dz, 0.12, 3.6, 0.12);
          box(0xcfb16f, x, 3.5, z, 7, 0.12, 5);
          for (let n = 0; n < 7; n++)
            box(n % 2 ? 0xe0d0aa : 0x758f7a, x - 3 + n, 3.58, z, 0.9, 0.08, 5);
          for (let n = 0; n < 4; n++) {
            box(0x6b5941, x - 2.2 + n * 1.45, 1.75, z, 1.2, 0.4, 1.7);
            for (const dz of [-0.4, 0.3])
              part(
                "leaf",
                [0xbf7056, 0xbbab62, 0x87965b, 0xbb8b55][n],
                x - 2.2 + n * 1.45,
                2,
                z + dz,
                0.6,
                0.4,
                0.6,
              );
          }
        }
      pergola(119, 132);
      sign("ЛОКАЛЬНЫЙ РЫНОК", 119, 3.2, 98, 10);
      for (const dx of [114, 124])
        box(0x4e6961, dx, 1.6, 98, 0.18, 3.2, 0.18, true);
      // Stalls are scenery; the normal grocery interiors still handle purchases.
      planter(119, 119, 5, 5);
    } else {
      box(0xa69b84, 119, 0.12, 117, 36, 0.1, 32);
      for (let x = 102; x <= 136; x += 2)
        box(0x928c79, x, 0.18, 117, 0.04, 0.01, 32);
      for (const x of [108, 130])
        for (const z of [106, 122]) {
          cylinder(0x4f625e, x, 0.52, z, 0.22, 1, 0.22);
          cylinder(0xb7a581, x, 1.05, z, 3, 0.13, 3, true);
          for (const side of [-1, 1]) {
            box(0x897358, x + side * 2, 0.55, z, 1, 0.16, 1, true);
            for (const dz of [-0.32, 0.32])
              box(0x405552, x + side * 2, 0.26, z + dz, 0.7, 0.5, 0.08);
          }
          cylinder(0x53635a, x, 2.05, z, 0.08, 2, 0.08);
          part(
            "cone",
            seed % 2 ? 0xc5af81 : 0x859e92,
            x,
            3.2,
            z,
            3.5,
            0.8,
            3.5,
          );
        }
      pergola(119, 132);
      planter(119, 104, 4, 4);
      planter(119, 121, 4, 4);
      sign(
        theme === "works" ? "СКВЕР МАСТЕРОВ" : "ОТКРЫТАЯ ТЕРРАСА",
        119,
        3.2,
        98,
        9,
      );
      for (const x of [114.5, 123.5])
        box(0x566764, x, 1.6, 98, 0.15, 3.2, 0.15, true);
    }
    return { kind, name: NAMES[kind], pieces, obstacles, entries };
  }
  window.FZCitySpaces = { plan, names: { ...NAMES } };
})();
