// v10 masterplan: mixed-use blocks, park plots and district landmarks.
// All solid props use the same descriptors for drawing and collision.
(function () {
  "use strict";
  const SPECIAL = {
    "4:2": ["civic", "Площадь Фантазии", "clock"],
    "6:0": ["boulevard", "Деловой проспект", "pavilion"],
    "-6:0": ["park", "Озёрный парк", "pond"],
    "6:6": ["campus", "Университетский сад", "glasshouse"],
    "-6:-6": ["depot", "Старое депо", "depot"],
    "6:-6": ["skyline", "Северный шпиль", "spire"],
    "-6:6": ["garden", "Ботанический сад", "glasshouse"],
    "0:-6": ["civic", "Северная площадь", "clock"],
    "0:6": ["boulevard", "Южный бульвар", "pavilion"],
  };
  function plan(i, j, theme, seed) {
    const special = SPECIAL[i + ":" + j];
    const mode = special ? special[0] : ["mixed", "avenue", "green"][seed % 3];
    const plots = [],
      pieces = [],
      obstacles = [],
      trees = [],
      parks = [];
    const at = (n) => ({
      x: 49 + (n % 3) * 69,
      z: 49 + Math.floor(n / 3) * 69,
    });
    const skip = new Set([4]);
    if (special) skip.add(1);
    if (mode === "park" || mode === "garden")
      for (const n of [2, 3, 5, 7]) skip.add(n);
    else if (mode === "civic" || mode === "boulevard" || mode === "avenue")
      skip.add(7);
    else if (mode === "campus") skip.add(5);
    else if (mode === "depot") skip.add(2);
    else if (mode === "green") for (const n of [3, 5]) skip.add(n);
    for (let n = 0; n < 9; n++)
      if (!skip.has(n)) {
        const p = at(n),
          v = (seed >>> ((n % 6) * 4)) & 15;
        plots.push({
          n,
          x: p.x + (n === 0 ? 0 : ((v % 3) - 1) * 5),
          z: p.z + (n === 0 ? 0 : (((v >>> 2) % 3) - 1) * 4),
          style:
            theme === "gardens"
              ? "villa"
              : theme === "works"
                ? "warehouse"
                : ["terraced", "slab", "stepped"][v % 3],
          width:
            theme === "gardens"
              ? 22 + (v % 5)
              : theme === "works"
                ? 40 + (v % 5)
                : 28 + (v % 10),
          depth:
            theme === "gardens"
              ? 19 + (v % 4)
              : theme === "works"
                ? 37 + (v % 5)
                : 29 + (v % 8),
          floors:
            theme === "towers"
              ? [5, 9, 14, 19][v % 4]
              : theme === "works"
                ? 2
                : theme === "gardens"
                  ? 2
                  : [3, 4, 6, 8][v % 4],
        });
      }
    function part(shape, color, x, y, z, w, h, d, solid = false, rotation = 0) {
      pieces.push({ shape, color, x, y, z, w, h, d, rotation });
      if (solid) {
        const c = Math.abs(Math.cos(rotation)),
          s = Math.abs(Math.sin(rotation)),
          dx = (w * c + d * s) / 2,
          dz = (d * c + w * s) / 2;
        obstacles.push({
          minX: x - dx,
          maxX: x + dx,
          minZ: z - dz,
          maxZ: z + dz,
        });
      }
    }
    const box = (c, x, y, z, w, h, d, solid = false) =>
      part("box", c, x, y, z, w, h, d, solid);
    const cyl = (c, x, y, z, w, h, d, solid = false) =>
      part("cyl", c, x, y, z, w, h, d, solid);
    const sign = (label, x, y, z, w) => box({ label }, x, y, z, w, 1.3, 0.15);
    function bed(x, z, w, d) {
      box(0xa5a68d, x, 0.25, z, w, 0.5, d, true);
      box(0x586b50, x, 0.54, z, w - 0.4, 0.12, d - 0.4);
      for (let n = 0; n < 5; n++)
        part(
          "leaf",
          [0xb8876c, 0xcdb684, 0x9c89b5][n % 3],
          x - w * 0.36 + n * w * 0.18,
          0.9,
          z,
          0.9,
          0.65,
          0.9,
        );
    }
    function lawn(n, kind = "grove") {
      const p = at(n);
      parks.push({ x: p.x, z: p.z, kind });
      box(
        kind === "square" ? 0xc0c4b1 : 0x8c9a74,
        p.x,
        0.01,
        p.z,
        59,
        0.02,
        58,
      );
      box(0xbab6a0, p.x, 0.055, p.z, 4, 0.03, 58);
      box(0xbab6a0, p.x, 0.056, p.z, 59, 0.032, 4);
      if (kind === "grove") {
        for (const dx of [-22, -13, 14, 23])
          for (const dz of [-19, 18]) trees.push([p.x + dx, p.z + dz]);
        bed(p.x - 14, p.z, 7, 3);
        bed(p.x + 14, p.z, 7, 3);
      } else if (kind === "square") {
        for (const dx of [-22, 22])
          for (const dz of [-20, 20]) trees.push([p.x + dx, p.z + dz]);
        for (const dx of [-19, 19]) bed(p.x + dx, p.z, 3, 16);
        for (let n = -24; n <= 24; n += 6)
          box(0xa6b09a, p.x + n, 0.08, p.z, 0.045, 0.02, 54);
      }
    }
    function pond(x, z) {
      // No invisible water crossing: the basin is solid, paths go around it.
      box(0xaea998, x, 0.23, z, 47, 0.46, 34, true);
      box({ water: true }, x, 0.48, z, 44.5, 0.04, 31.5);
      for (const dx of [-25, 25]) box(0xc3bda8, x + dx, 0.09, z, 4, 0.06, 40);
      for (const dz of [-20, 20]) box(0xc3bda8, x, 0.09, z + dz, 54, 0.06, 4);
      for (const dx of [-20, 20])
        for (const dz of [-23, 23]) trees.push([x + dx, z + dz]);
      for (let k = 0; k < 9; k++) {
        const px = x - 17 + k * 4;
        part("leaf", 0x668062, px, 0.55, z + 10, 2, 0.15, 1.4);
        part("leaf", 0xb5b19e, px + 0.3, 0.67, z + 10, 0.55, 0.3, 0.55);
      }
      for (const dx of [-17, 17]) {
        cyl(0xc0c4b1, x + dx, 0.9, z, 1, 1.2, 1);
        cyl(0xb5d2ce, x + dx, 2.1, z, 0.11, 2.6, 0.11);
        cyl(0x9bb2b5, x + dx, 2.85, z, 2.3, 0.08, 2.3);
      }
    }
    function clock(x, z) {
      cyl(0xb5b19e, x, 0.6, z, 24, 1.2, 24, true);
      box(0xc3b388, x, 4.5, z, 18, 8, 18);
      box(0xa69b84, x, 23, z, 11, 38, 11);
      for (const dx of [-5.8, 5.8])
        for (const dz of [-5.8, 5.8])
          box(0xe1d5ae, x + dx, 24, z + dz, 0.65, 40, 0.65);
      box(0xc3bda8, x, 44, z, 15, 8, 15);
      for (const rot of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
        part(
          "box",
          { clock: true },
          x + Math.sin(rot) * 7.6,
          44,
          z + Math.cos(rot) * 7.6,
          6.3,
          6.3,
          0.12,
          false,
          rot,
        );
      box(0x566764, x, 48.5, z, 17, 1, 17);
      part("roof", 0x566764, x, 49, z, 16, 6, 16);
      cyl(0xbba06e, x, 57, z, 0.28, 9, 0.28);
      part("leaf", 0xcfb16f, x, 61.6, z, 1.1, 1.1, 1.1);
      sign("FANTAZIA", x, 6.5, z + 9.1, 11);
    }
    function glasshouse(x, z) {
      cyl(0xb5b7a7, x, 0.6, z, 43, 1.2, 43, true);
      cyl(0x6c8280, x, 3, z, 37, 5, 37);
      part("dome", 0x7b9998, x, 5.5, z, 38, 28, 38);
      const point = (a, t) => [
        x + 19.1 * Math.cos(t) * Math.sin(a),
        5.5 + 14.1 * Math.sin(t),
        z + 19.1 * Math.cos(t) * Math.cos(a),
      ];
      function beam(a, b) {
        const delta = b.map((v, n) => v - a[n]),
          length = Math.hypot(...delta);
        part(
          "cyl",
          0xc0c4b1,
          (a[0] + b[0]) / 2,
          (a[1] + b[1]) / 2,
          (a[2] + b[2]) / 2,
          0.18,
          length,
          0.18,
        );
        pieces[pieces.length - 1].direction = delta.map((v) => v / length);
      }
      for (let k = 0; k < 16; k++) {
        const a = (k * Math.PI) / 8;
        cyl(
          0xc0c4b1,
          x + Math.sin(a) * 18.7,
          3,
          z + Math.cos(a) * 18.7,
          0.22,
          5,
          0.22,
        );
        for (let j = 0; j < 8; j++)
          beam(
            point(a, (j * Math.PI) / 16),
            point(a, ((j + 1) * Math.PI) / 16),
          );
        for (let j = 1; j < 8; j += 2)
          beam(
            point(a, (j * Math.PI) / 16),
            point(a + Math.PI / 8, (j * Math.PI) / 16),
          );
      }
      sign("БОТАНИЧЕСКИЙ САД", x, 3, z + 20, 16);
      for (const dx of [-24, 24]) trees.push([x + dx, z + 22]);
    }
    function depot(x, z) {
      box(0x98764f, x, 5, z, 42, 10, 38, true);
      for (const dx of [-14, 0, 14]) {
        part("roof", 0x566764, x + dx, 10, z, 14, 4, 40);
        box(0x4e6961, x + dx, 3.5, z + 19.1, 10, 6, 0.15);
        for (let y = 1; y < 6; y++)
          box(0x8a9584, x + dx, y, z + 19.2, 10, 0.09, 0.05);
      }
      cyl(0xae8265, x + 15, 20, z - 12, 4, 40, 4);
      cyl(0x566764, x + 15, 40, z - 12, 4.5, 1, 4.5);
      sign("ДЕПО / FZ", x, 8, z + 19.2, 13);
    }
    function pavilion(x, z) {
      box(0xb9baad, x, 0.35, z, 48, 0.7, 40, true);
      for (const dx of [-16, 0, 16]) {
        box(0xa4b7ae, x + dx, 5, z, 13, 10, 31);
        box(0x607a7c, x + dx, 4, z + 15.6, 10, 7, 0.15);
        part("box", 0xe1d5ae, x + dx, 11, z, 16, 0.8, 38);
      }
      sign("ГОРОДСКАЯ ГАЛЕРЕЯ", x, 8.8, z + 15.8, 22);
    }
    function spire(x, z) {
      cyl(0xa4b7ae, x, 0.6, z, 25, 1.2, 25, true);
      for (const dx of [-6, 6]) box(0x607a7c, x + dx, 34, z, 4, 68, 10);
      for (const y of [10, 30, 50]) box(0xc3bda8, x, y, z, 18, 1, 12);
      part("cone", 0xb6c1b1, x, 80, z, 9, 26, 9);
      cyl(0xcdb684, x, 97, z, 0.25, 9, 0.25);
      sign("СЕВЕРНЫЙ ШПИЛЬ", x, 4, z + 7, 17);
    }
    if (special) {
      lawn(1, "square");
      ({ clock, glasshouse, depot, pavilion, spire, pond })[special[2]](
        118,
        49,
      );
    }
    for (const n of skip) {
      if (n === 4 || (n === 1 && special)) continue;
      if ((mode === "park" || mode === "garden") && n === 2) {
        lawn(n, "empty");
        pond(187, 49);
      } else lawn(n, n === 7 || mode === "depot" ? "square" : "grove");
    }
    // Street frontage: a small parking bay, shelter and correctly bounded props.
    if (!skip.has(7)) {
      box(0x647a7b, 118, 0.025, 216, 42, 0.05, 15);
      for (let x = 100; x <= 136; x += 9)
        box(0xddd8c9, x, 0.058, 216, 0.12, 0.012, 11);
      for (const [x, c] of [
        [104, 0x7b9998],
        [131, 0xb4a078],
      ]) {
        box(c, x, 0.83, 216, 4.2, 1.35, 2, true);
        box(0x526775, x, 1.65, 216, 2.25, 0.7, 1.75);
        for (const dx of [-1.3, 1.3])
          for (const dz of [-1.05, 1.05])
            cyl(0x405552, x + dx, 0.4, 216 + dz, 0.55, 0.65, 0.25);
      }
    }
    box(0xb5b19e, 65, 0.04, 24, 11, 0.08, 4);
    for (const dx of [-4.5, 4.5])
      box(0x4e6961, 65 + dx, 1.6, 24, 0.15, 3.2, 0.15, true);
    box(0x476f72, 65, 3.2, 24, 10.5, 0.2, 4.5);
    box(0xb7a581, 65, 0.55, 24.8, 7, 0.15, 0.7, true);
    sign("FZ / ГОРОД", 65, 2.5, 25.8, 5);
    return {
      mode,
      name: special ? special[1] : null,
      landmark: special ? special[2] : null,
      plots,
      pieces,
      obstacles,
      trees,
      parks,
    };
  }
  window.FZUrban = {
    plan,
    specials: Object.entries(SPECIAL).map(([key, v]) => ({
      key,
      name: v[1],
      kind: v[2],
    })),
  };
})();
