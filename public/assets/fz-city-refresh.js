/* Native-city refresh: a real street quarter, arrival plaza and GRAND MALL.
 * All positions are planned by FZRoads before visual meshes or collisions exist.
 * No UI replacement, imported world, or additional render loop. */
(function () {
  "use strict";
  const mat = (color, emissive = 0) =>
    new THREE.MeshLambertMaterial({ color, emissive });
  function box(w, h, d, m, x, y, z) {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z);
    o.receiveShadow = true;
    scene.add(o);
    return o;
  }
  function paving(w, d, m, x, z, y = 0.045) {
    const o = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
    o.rotation.x = -Math.PI / 2;
    o.position.set(x, y, z);
    o.receiveShadow = true;
    scene.add(o);
    return o;
  }
  function label(text, x, y, z, w, h, color = "#f4ead8", bg = "#192c39") {
    const cv = document.createElement("canvas");
    cv.width = 1024;
    cv.height = Math.max(64, Math.round((1024 * h) / w));
    const c = cv.getContext("2d");
    c.fillStyle = bg;
    c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = color;
    c.textAlign = "center";
    c.textBaseline = "middle";
    let size = cv.height * 0.64;
    c.font = "600 " + size + "px Arial";
    while (c.measureText(text).width > 960) {
      size -= 2;
      c.font = "600 " + size + "px Arial";
    }
    c.fillText(text, 512, cv.height / 2);
    const o = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) }),
    );
    o.position.set(x, y, z);
    scene.add(o);
    return o;
  }
  function planter(x, z, stone, green) {
    box(3, 0.65, 1.8, stone, x, 0.325, z);
    box(2.65, 0.6, 1.45, green, x, 0.9, z);
    streetColliders.push(
      { x: x - 0.85, z, r: 0.9 },
      { x: x + 0.85, z, r: 0.9 },
    );
  }
  function lamp(x, z, metal) {
    box(0.14, 4.8, 0.14, metal, x, 2.4, z);
    box(0.75, 0.2, 0.75, mat(0xffedc0, 0x554422), x, 4.8, z);
    streetColliders.push({ x, z, r: 0.24 });
  }
  function buildArrival() {
    return FZRoads.withOwner("spawn", () => {
      const { x, z } = FZRoads.spawn,
        stone = mat(0xc8c5bb),
        dark = mat(0x414c55),
        green = mat(0x4d794d);
      paving(42, 32, stone, x, z);
      // Fine paving joints; the middle is deliberately empty for spawning and walking.
      for (let dx = -20; dx <= 20; dx += 4)
        paving(0.04, 32, dark, x + dx, z, 0.047);
      for (let dz = -16; dz <= 16; dz += 4)
        paving(42, 0.04, dark, x, z + dz, 0.047);
      paving(7, 33, mat(0xe1ddd0), x, z, 0.049);
      paving(7, 8, stone, x, z - 19.5);
      for (const side of [-1, 1]) {
        createBench(x + side * 14, z - 7, (side * Math.PI) / 2);
        createBench(x + side * 14, z + 6, (side * Math.PI) / 2);
        planter(x + side * 17, z - 12, dark, green);
        planter(x + side * 17, z + 12, dark, green);
        lamp(x + side * 19, z - 4, dark);
        lamp(x + side * 19, z + 4, dark);
      }
      // Low information stand on the EDGE, not at the arrival point.
      box(5, 1.4, 0.35, dark, x + 12, 0.7, z + 12);
      label("ПЛОЩАДЬ ФАНТАЗИИ", x + 12, 1.6, z + 12.2, 5, 0.65);
      streetColliders.push(
        { x: x + 10, z: z + 12, r: 0.5 },
        { x: x + 12, z: z + 12, r: 0.5 },
        { x: x + 14, z: z + 12, r: 0.5 },
      );
      label("КАРТА ГОРОДА • E / ДЕЙСТВИЕ", x + 12, 0.85, z + 12.22, 4.7, 0.5);
      interactables.push({
        type: "city_guide",
        name: "Карта города и места рядом",
        position: { x: x + 12, y: 0, z: z + 10 },
        range: 3,
        cityLeisure: true,
      });
      window._arrivalPlaza = { x, z, width: 42, depth: 32 };
    });
  }
  function buildQuarter() {
    const ground = mat(0x9ca4a7),
      stone = mat(0xc8c7c0),
      dark = mat(0x3d4b55),
      green = mat(0x4f7757);
    // Street asphalt is at y=.01; the district foundation is below it, never a road overlay.
    // Four separate paved blocks: no nearly-coplanar foundation under the streets.
    for (const [a, b] of [
      [172, 250],
      [270, 348],
    ])
      for (const [c, d] of [
        [70, 146],
        [166, 242],
      ])
        paving(b - a, d - c, ground, (a + b) / 2, (c + d) / 2, 0.025);
    const names = [
      "КОФЕ И ПЕКАРНЯ",
      "ГОРОДСКОЙ МАРКЕТ",
      "ДОМ НА ПРОСПЕКТЕ",
      "ТЕХНИКА И СВЯЗЬ",
    ];
    const palette = [0xc4b49e, 0xb9c7ce, 0xd6d4c8, 0xa7b5b2];
    FZRoads.quarter.forEach((p, i) =>
      FZRoads.withOwner(p.id, () => {
        const row = Math.floor(i / 4),
          col = i % 4,
          h = [16, 24, 19, 28][(col + row) % 4];
        const type =
          row === 3
            ? "apartment"
            : row === 1
              ? "office"
              : ["shop_food", "shop_clothing", "office", "shop_electronics"][
                  col
                ];
        const name =
          row === 0
            ? names[col]
            : row === 1
              ? "ПРОСПЕКТ • ОФИС " + (col + 1)
              : row === 2
                ? [
                    "КАФЕ НА УГЛУ",
                    "ГОРОДСКОЙ БУТИК",
                    "ЦЕНТР УСЛУГ",
                    "ЭЛЕКТРОНИКА",
                  ][col]
                : "ПРОСПЕКТ • ДОМ " + (col + 1);
        paving(30, 28, stone, p.x, p.z + 2, 0.07);
        const mesh = createBuilding(
          p.x,
          p.z,
          24,
          h,
          18,
          palette[col],
          name,
          type,
        );
        // Distinct floor bands and terracotta/stone vertical accents, not random towers.
        const trim = mat(col % 2 ? 0x414f5a : 0x9d7154);
        for (let y = 5; y < h; y += 4) {
          const band = new THREE.Mesh(
            new THREE.BoxGeometry(24.2, 0.22, 0.3),
            trim,
          );
          band.position.set(0, y, 9.25);
          mesh.add(band);
        }
        planter(p.x + 12.6, p.z + 12.6, dark, green);
        lamp(p.x - 13.5, p.z + 11, dark);
        // Clear front-door centre and a strip connecting it to the parcel pavement.
        paving(4, 5, mat(0xe1ded2), p.x, p.z + 11, 0.095);
      }),
    );
    window._cityQuarter = {
      name: "Восточный проспект",
      buildings: FZRoads.quarter.length,
      desert: false,
      farm: false,
    };
  }
  function buildMall() {
    const x = FZRoads.mall.x,
      z = FZRoads.mall.z,
      w = 120,
      d = 100,
      h = 55;
    const { body, colliders } = FZLandmarks.mall(scene, x, z);
    streetColliders.push(...colliders);
    buildings.push({
      mesh: body,
      x,
      z,
      w,
      h,
      d,
      name: "🏬 GRAND MALL",
      type: "mall",
      bounds: FZRoads.rect(x, z, w + 1, d + 1),
    });
    interactables.push({
      position: { x, y: 0, z: z + d / 2 + 3 },
      type: "mall",
      name: "🏬 GRAND MALL",
      range: 6,
    });
    window.MALL_PARKING = { x: x + w / 2 + 22, z, w: 40, d };
    createParkingLot(MALL_PARKING.x, z, 40, d, "GRAND MALL • PARKING");
    spawnCarsInParking();
    window._mallDesign = {
      version: "12.0",
      style: "stone-glass-bronze",
      stepped: true,
      entrance: { x, z: z + 53 },
    };
  }
  window.FZCityRefresh = { buildArrival, buildQuarter, buildMall };
})();
