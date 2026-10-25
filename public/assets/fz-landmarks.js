// Shared actual GRAND MALL geometry for the playable world and pre-login plaza film.
(function () {
  "use strict";
  function mall(target, x, z) {
    const colliders = [],
      w = 120,
      d = 100,
      h = 55;
    const mat = (color, emissive = 0) =>
      new THREE.MeshLambertMaterial({ color, emissive });
    function box(w, h, d, m, x, y, z) {
      const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      o.position.set(x, y, z);
      o.receiveShadow = true;
      target.add(o);
      return o;
    }
    function paving(w, d, m, x, z, y = 0.045) {
      const o = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
      o.rotation.x = -Math.PI / 2;
      o.position.set(x, y, z);
      o.receiveShadow = true;
      target.add(o);
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
      target.add(o);
      return o;
    }
    function planter(x, z, stone, green) {
      box(3, 0.65, 1.8, stone, x, 0.325, z);
      box(2.65, 0.6, 1.45, green, x, 0.9, z);
      colliders.push({ x: x - 0.85, z, r: 0.9 }, { x: x + 0.85, z, r: 0.9 });
    }
    const stone = mat(0xd8d4c8),
      ivory = mat(0xf1eee5),
      graphite = mat(0x263b49),
      bronze = mat(0xb28d59);
    const glass = mat(0x497d94, 0x07141c),
      glassLight = mat(0x7ea6b2, 0x0a171c),
      glow = mat(0xffe5af, 0x66502a);
    // Broad retail podium, a recessed upper volume and a glazed roof lantern.
    // Keeping the old site's dimensions/name and the actual native interior entrance.
    const body = box(w, 32, d, stone, x, 16, z);
    body.name = "grand-mall-podium";
    box(w + 1.5, 0.8, d + 1.5, ivory, x, 32.4, z);
    box(64, 20, 72, graphite, x, 42, z - 12);
    box(65, 0.8, 73, bronze, x, 52.4, z - 12);
    box(32, 1.8, 42, glassLight, x, 53.7, z - 12);
    // Long shop windows, deep reveals and regular stone mullions.
    for (const y of [6.8, 16.2, 25]) {
      for (const side of [-1, 1]) {
        box(112, 6.4, 0.22, glass, x, y, z + side * 50.14);
        box(0.22, 6.4, 88, glassLight, x + side * 60.14, y, z);
      }
      box(120.8, 0.45, 101, ivory, x, y + 3.5, z);
    }
    for (let dx = -56; dx <= 56; dx += 8) {
      if (Math.abs(dx) < 16) continue;
      box(1.0, 28, 0.85, ivory, x + dx, 15, z + 50.5);
      box(0.22, 28, 0.95, bronze, x + dx + 0.7, 15, z + 50.5);
    }
    // Central glazed portal with no column in the doorway.
    box(30, 27, 0.5, graphite, x, 13.5, z + 50.4);
    for (let dx = -12; dx <= 12; dx += 4)
      box(0.16, 20, 0.3, bronze, x + dx, 10, z + 50.8);
    box(13, 5.6, 0.2, glassLight, x, 2.8, z + 50.9);
    box(0.13, 5.6, 0.25, ivory, x, 2.8, z + 51.05);
    box(29, 0.6, 5, graphite, x, 6.4, z + 52);
    box(28, 0.12, 4.7, glow, x, 6.04, z + 52);
    for (const side of [-1, 1]) {
      box(0.35, 6.2, 0.35, bronze, x + side * 13, 3.1, z + 53.5);
      colliders.push({ x: x + side * 13, z: z + 53.5, r: 0.3 });
    }
    label("GRAND MALL", x, 24, z + 50.78, 27, 3.4);
    label("GRAND MALL", x, 44, z + 24.2, 53, 6.5);
    label(
      "МАГАЗИНЫ  /  КИНО  /  РЕСТОРАНЫ",
      x,
      20.3,
      z + 50.8,
      25,
      1.35,
      "#d2bd94",
    );
    label("ГЛАВНЫЙ ВХОД", x, 5.3, z + 51.1, 9, 0.65);
    // Upper façade rhythm and roof planting (no tall featureless rear wall).
    for (let dx = -28; dx <= 28; dx += 7)
      box(0.32, 18, 0.5, bronze, x + dx, 42, z + 24.5);
    for (const side of [-1, 1])
      for (let dz = -40; dz <= 40; dz += 10)
        box(0.6, 27, 0.65, ivory, x + side * 60.4, 16, z + dz);
    for (const dx of [-45, 45])
      for (const dz of [-25, 5, 30]) {
        box(8, 0.7, 4, graphite, x + dx, 33.1, z + dz);
        box(7.5, 0.6, 3.5, mat(0x4b7053), x + dx, 33.7, z + dz);
      }
    paving(116, 8, mat(0xc4c3bc), x, z + 54.4, 0.06);
    paving(10, 8, ivory, x, z + 54.4, 0.065);
    paving(7, 4, ivory, x, z + 60, 0.06);
    for (const dx of [-46, -33, 33, 46])
      planter(x + dx, z + 54.5, graphite, mat(0x52795a));
    return { body, colliders };
  }
  window.FZLandmarks = { mall };
})();
