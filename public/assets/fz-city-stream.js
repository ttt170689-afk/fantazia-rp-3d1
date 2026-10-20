// v8.7: 9.52km square city envelope; original 952m GLB remains untouched.
// Deterministic layouts drive both collision and visuals. At most 25 chunks
// are rendered, with a two-chunk/frame build budget and shared GPU resources.
(function () {
  "use strict";
  const TILE = 238,
    HALF = 4760,
    RADIUS = 2,
    LIMIT = 25;
  const chunks = new Map(),
    layouts = new Map(),
    mats = new Map(),
    geometry = new Map();
  const districts = [
    [
      "heart",
      "Площадь Фантазии",
      4,
      2,
      "Новый центр: часовая башня, прогулочная площадь и террасные высотки",
    ],
    [
      "center",
      "Центр — исходный город",
      0,
      0,
      "Городская площадь, метро и знакомые улицы",
    ],
    ["north", "Северный жилой", 0, -6, "Жилые кварталы, дворы и школы"],
    ["east", "Восточный деловой", 6, 0, "Офисы, высотки и широкие проспекты"],
    ["west", "Западные сады", -6, 0, "Озёрный парк, фонтаны и коттеджи"],
    ["south", "Южный жилой", 0, 6, "Квартиры, магазины и скверы"],
    [
      "campus",
      "Университетский",
      6,
      6,
      "Университетский сад и геодезическая оранжерея",
    ],
    [
      "works",
      "Промышленный",
      -6,
      -6,
      "Кирпичное депо, мастерские и индустриальные дворы",
    ],
    [
      "heights",
      "Северные высоты",
      6,
      -6,
      "Северный шпиль и ступенчатый силуэт высоток",
    ],
    [
      "gardens",
      "Солнечный",
      -6,
      6,
      "Ботанический сад, пруды и прогулочные аллеи",
    ],
  ];
  let root = null,
    owner = null,
    stamp = "",
    queue = [],
    panel = null,
    previousFocus = null,
    counts = 0;
  let frustum = null,
    projection = null,
    bound = null;
  function base() {
    return {
      x: window.NEWCITY ? NEWCITY.x : 3000,
      z: window.NEWCITY ? NEWCITY.z : 0,
    };
  }
  function interior() {
    return (
      (typeof isInsideBuilding !== "undefined" && isInsideBuilding) ||
      (typeof isInFactory !== "undefined" && isInFactory) ||
      (typeof isInBasement !== "undefined" && isInBasement)
    );
  }
  function ready() {
    if (window.FZ_CLASSIC_WORLD) return false;
    return (
      typeof scene !== "undefined" &&
      scene &&
      typeof localPlayer !== "undefined" &&
      localPlayer &&
      localPlayer.mesh &&
      window.NEWCITY &&
      NEWCITY.loaded
    );
  }
  function core(x, z) {
    const b = base();
    return Math.abs(x - b.x) < 476 && Math.abs(z - b.z) < 476;
  }
  function inBounds(x, z) {
    const b = base();
    return (
      x >= b.x - HALF && x <= b.x + HALF && z >= b.z - HALF && z <= b.z + HALF
    );
  }
  function cell(x, z) {
    const b = base();
    return { i: Math.floor((x - b.x) / TILE), j: Math.floor((z - b.z) / TILE) };
  }
  function excluded(i, j) {
    const b = base(),
      x = b.x + (i + 0.5) * TILE,
      z = b.z + (j + 0.5) * TILE;
    // Leave the old city and existing sea pocket alone. Indoor pockets are
    // invisible while inside; their coordinates need no permanent terrain cutout.
    return (
      (i >= -2 && i < 2 && j >= -2 && j < 2) ||
      (Math.abs(x) < 720 && Math.abs(z) < 720) ||
      (Math.abs(x - 6000) < 500 && Math.abs(z) < 480) ||
      i < -20 ||
      i >= 20 ||
      j < -20 ||
      j >= 20
    );
  }
  function hash(i, j, k = 0) {
    let n =
      Math.imul(i + 8121, 73856093) ^
      Math.imul(j + 2309, 19349663) ^
      Math.imul(k + 17, 83492791);
    n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    return (n ^ (n >>> 16)) >>> 0;
  }
  function theme(i, j) {
    if (j <= -4 && i <= -4) return "works";
    if (i <= -4) return "gardens";
    if (i >= 4 && j < 4) return "towers";
    if (i >= 4 && j >= 4) return "campus";
    return "homes";
  }
  function layout(i, j) {
    const key = i + ":" + j;
    if (layouts.has(key)) return layouts.get(key);
    const b = base(),
      x = b.x + i * TILE,
      z = b.z + j * TILE,
      t = theme(i, j),
      data = {
        key,
        i,
        j,
        x,
        z,
        theme: t,
        buildings: [],
        obstacles: [],
        trees: [],
      };
    data.urban = window.FZUrban ? FZUrban.plan(i, j, t, hash(i, j, 121)) : null;
    const plots = data.urban
      ? data.urban.plots
      : Array.from({ length: 9 }, (_, n) => ({
          n,
          x: 49 + (n % 3) * 69,
          z: 49 + Math.floor(n / 3) * 69,
        })).filter((p) => p.n !== 4);
    for (const plot of plots) {
      const n = plot.n;
      const h = hash(i, j, n),
        cx = x + plot.x,
        cz = z + plot.z;
      const type =
        t === "works"
          ? "office"
          : t === "gardens"
            ? "house"
            : (n === 1 || (t === "campus" && n === 0)) &&
                (h % 3 === 0 || t === "campus")
              ? "school"
              : n === 6
                ? "shop_grocery"
                : h % 4 === 0
                  ? "office"
                  : "apartment";
      const w = plot.width || (t === "gardens" ? 16 + (h % 7) : 24 + (h % 15)),
        d =
          plot.depth ||
          (t === "gardens" ? 14 + ((h >>> 4) % 7) : 25 + ((h >>> 4) % 13)),
        floors =
          plot.floors ||
          (type === "house"
            ? 2
            : type === "school"
              ? 3
              : t === "towers"
                ? 8 + (h % 10)
                : t === "works"
                  ? 2
                  : 3 + (h % 5));
      const building = {
        x: cx,
        z: cz,
        w,
        d,
        h: floors * 3.5,
        type,
        floors,
        color: h % 5,
        style: plot.style || "slab",
      };
      if (type === "house") {
        building.hedges = [
          { x: cx - w / 2 - 4, z: cz, w: 1, d: d + 9 },
          { x: cx + w / 2 + 4, z: cz, w: 1, d: d + 9 },
          { x: cx, z: cz - d / 2 - 4, w: w + 9, d: 1 },
        ];
        for (const side of [-1, 1])
          building.hedges.push({
            x: cx + side * (w / 4 + 3),
            z: cz + d / 2 + 4,
            w: w / 2 + 2,
            d: 1,
          });
        for (const c of building.hedges)
          data.obstacles.push({
            minX: c.x - c.w / 2,
            maxX: c.x + c.w / 2,
            minZ: c.z - c.d / 2,
            maxZ: c.z + c.d / 2,
          });
      }
      data.buildings.push(building);
      data.obstacles.push({
        minX: cx - w / 2,
        maxX: cx + w / 2,
        minZ: cz - d / 2,
        maxZ: cz + d / 2,
      });
    }
    data.trees = [
      [101, 101],
      [137, 101],
      [101, 137],
      [137, 137],
    ];
    if (data.urban) {
      data.trees.push(...data.urban.trees);
      for (const c of data.urban.obstacles)
        data.obstacles.push({
          minX: x + c.minX,
          maxX: x + c.maxX,
          minZ: z + c.minZ,
          maxZ: z + c.maxZ,
        });
    }
    for (const n of [70, 140, 210])
      data.trees.push([25, n], [n, 25], [227, n], [n, 227]);
    for (const [dx, dz] of data.trees)
      data.obstacles.push({
        minX: x + dx - 1,
        maxX: x + dx + 1,
        minZ: z + dz - 1,
        maxZ: z + dz + 1,
      });
    data.space = window.FZCitySpaces
      ? FZCitySpaces.plan(hash(i, j, 91), t)
      : null;
    if (data.space)
      for (const c of data.space.obstacles)
        data.obstacles.push({
          minX: x + c.minX,
          maxX: x + c.maxX,
          minZ: z + c.minZ,
          maxZ: z + c.maxZ,
        });
    layouts.set(key, data);
    if (layouts.size > 80) layouts.delete(layouts.keys().next().value);
    return data;
  }
  function collision(x, z) {
    if (!ready() || interior() || (window.FZ8SEA && FZ8SEA.active()))
      return null;
    const p = localPlayer.mesh.position;
    if (!inBounds(p.x, p.z)) return null;
    if (!inBounds(x - 0.5, z - 0.5) || !inBounds(x + 0.5, z + 0.5)) return true;
    if (core(x, z)) return null;
    const { i, j } = cell(x, z);
    if (excluded(i, j)) return null;
    return layout(i, j).obstacles.some(
      (c) =>
        x + 0.5 > c.minX &&
        x - 0.5 < c.maxX &&
        z + 0.5 > c.minZ &&
        z - 0.5 < c.maxZ,
    );
  }
  function material(color) {
    if (!mats.has(color)) {
      const m = new THREE.MeshLambertMaterial({ color });
      m.color.convertSRGBToLinear();
      mats.set(color, m);
    }
    return mats.get(color);
  }
  function geom(k) {
    if (!geometry.has(k))
      geometry.set(
        k,
        k === "dome"
          ? new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)
          : k === "leaf"
            ? new THREE.IcosahedronGeometry(0.5, 1)
            : k === "roof"
              ? roofGeometry()
              : k === "plane"
                ? new THREE.PlaneGeometry(1, 1)
                : k === "box"
                  ? new THREE.BoxGeometry(1, 1, 1)
                  : k === "cone"
                    ? new THREE.ConeGeometry(1, 1, 7)
                    : new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
      );
    return geometry.get(k);
  }
  function shape(g, k, mat, x, y, z, w, h, d) {
    const m = new THREE.Mesh(
      geom(k),
      typeof mat === "number" ? material(mat) : mat,
    );
    m.position.set(x, y, z);
    m.scale.set(w, h, d);
    g.add(m);
    return m;
  }
  function roofGeometry() {
    // Proper pitched roof, not a cone that leaves the corners of a house exposed.
    const points = [
      [-0.5, 0, -0.5],
      [0.5, 0, -0.5],
      [0.5, 0, 0.5],
      [-0.5, 0, 0.5],
      [0, 1, -0.5],
      [0, 1, 0.5],
    ];
    const indices = [
      0, 4, 1, 3, 2, 5, 0, 3, 5, 0, 5, 4, 1, 4, 5, 1, 5, 2, 0, 1, 2, 0, 2, 3,
    ];
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        indices.flatMap((i) => points[i]),
        3,
      ),
    );
    g.computeVertexNormals();
    return g;
  }
  const PALETTES = {
    homes: ["#d6c9b3", "#b5c1b9", "#c5b7a7", "#d2b19c", "#9facac"],
    gardens: ["#e2d5b8", "#c9d0b2", "#dbbc9f", "#b8c9c5", "#d4c9bd"],
    towers: ["#728e98", "#718b88", "#849b9f", "#a5a69b", "#7c91a4"],
    campus: ["#d5c2a7", "#bdc8b6", "#c8b0a1", "#a4bec1", "#d3c5af"],
    works: ["#ad826b", "#ae9b83", "#8e9d9b", "#b79e87", "#929ba6"],
  };
  function facade(color, floors, district) {
    const key = "facade:" + district + ":" + color;
    if (mats.has(key)) return mats.get(key);
    const cv = document.createElement("canvas"),
      ec = document.createElement("canvas");
    cv.width = ec.width = 256;
    cv.height = ec.height = 512;
    const c = cv.getContext("2d"),
      e = ec.getContext("2d");
    c.fillStyle = PALETTES[district][color];
    c.fillRect(0, 0, 256, 512);
    e.fillStyle = "#000";
    e.fillRect(0, 0, 256, 512);
    const rows = 4,
      step = 480 / rows,
      glass = district === "towers";
    for (let y = 0; y < rows; y++) {
      const yy = 12 + y * step;
      c.fillStyle = glass ? "#a7b8bb" : "#e5ded1";
      c.fillRect(0, yy + step - 3, 256, 2);
      for (let x = 0; x < 6; x++) {
        const xx = 12 + x * 40,
          ww = glass ? 32 : 24,
          hh = step * 0.57;
        c.fillStyle = "#526367";
        c.fillRect(xx - 2, yy - 2, ww + 4, hh + 4);
        c.fillStyle = (x + y + color) % 5 === 0 ? "#d7c499" : "#354f5c";
        c.fillRect(xx, yy, ww, hh);
        c.fillStyle = glass ? "#768e96" : "#91a5aa";
        c.fillRect(xx + 2, yy + 2, ww - 4, hh * 0.22);
        c.fillStyle = "#d4d9ce";
        c.fillRect(xx + ww / 2, yy, 1, hh);
        c.fillRect(xx, yy + hh * 0.65, ww, 1);
        if ((x * 3 + y + color) % 5 === 0) {
          e.fillStyle = "#d7b681";
          e.fillRect(xx, yy, ww, hh);
        }
      }
    }
    const texture = new THREE.CanvasTexture(cv),
      emission = new THREE.CanvasTexture(ec);
    texture.encoding = emission.encoding = THREE.sRGBEncoding;
    const m = new THREE.MeshLambertMaterial({
      map: texture,
      emissiveMap: emission,
      emissive: 0xffdfac,
      emissiveIntensity: 0,
    });
    // One repeating facade per palette, not a separate GPU texture for every height.
    texture.wrapT = emission.wrapT = THREE.RepeatWrapping;
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        "#include <uv_vertex>",
        `#include <uv_vertex>
#ifdef USE_UV
#ifdef USE_INSTANCING
  vUv.y *= length(instanceMatrix[1].xyz) / 14.0;
#else
  vUv.y *= length(modelMatrix[1].xyz) / 14.0;
#endif
#endif`,
      );
    };
    m.customProgramCacheKey = () => "fz-facade-height-v10";
    m.userData.cityWindows = true;
    mats.set(key, m);
    return m;
  }
  function urbanMaterial(color) {
    if (typeof color === "number") return color;
    if (color.label) return labelMaterial(color.label);
    const key = color.clock ? "city-clock" : "city-water";
    if (mats.has(key)) return mats.get(key);
    if (color.clock) {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 256;
      const c = cv.getContext("2d");
      c.fillStyle = "#344f50";
      c.fillRect(0, 0, 256, 256);
      c.fillStyle = "#eee0ba";
      c.beginPath();
      c.arc(128, 128, 118, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#34575a";
      c.font = "bold 27px Georgia";
      c.textAlign = "center";
      c.textBaseline = "middle";
      for (let n = 1; n <= 12; n++) {
        const a = (n * Math.PI) / 6;
        c.fillText(String(n), 128 + Math.sin(a) * 94, 128 - Math.cos(a) * 94);
      }
      c.strokeStyle = "#34575a";
      c.lineWidth = 7;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(101, 82);
      c.lineTo(128, 128);
      c.lineTo(196, 89);
      c.stroke();
      const map = new THREE.CanvasTexture(cv);
      map.encoding = THREE.sRGBEncoding;
      const m = new THREE.MeshLambertMaterial({
        map,
        emissive: 0x635c40,
        emissiveMap: map,
        emissiveIntensity: 0.24,
      });
      mats.set(key, m);
    } else
      mats.set(
        key,
        new THREE.MeshPhongMaterial({
          color: 0x689fa3,
          specular: 0xb5d2ce,
          shininess: 65,
        }),
      );
    return mats.get(key);
  }
  function massing(g, b, d) {
    const x = b.x - d.x,
      z = b.z - d.z;
    const stepped = b.type !== "house" && d.theme !== "works" && b.floors >= 5;
    const baseFloors = stepped ? 3 : b.floors,
      baseH = baseFloors * 3.5;
    shape(
      g,
      "box",
      facade(b.color, baseFloors, d.theme),
      x,
      baseH / 2,
      z,
      b.w,
      baseH,
      b.d,
    );
    shape(g, "box", 0x708580, x, baseH + 0.1, z, b.w + 0.3, 0.2, b.d + 0.3);
    architecture(g, { ...b, h: baseH, floors: baseFloors }, d);
    if (stepped) {
      const tiers = b.style === "slab" ? 1 : 2;
      let y = baseH;
      for (let n = 0; n < tiers; n++) {
        const floors =
          n === 0 && tiers === 2
            ? Math.ceil((b.floors - baseFloors) / 2)
            : b.floors -
              baseFloors -
              Math.ceil((b.floors - baseFloors) / 2) * (tiers - 1);
        const h = floors * 3.5,
          w = b.w * (n === 0 ? 0.76 : 0.54),
          dep = b.d * (n === 0 ? 0.73 : 0.49);
        // The entire upper volume sits on the previous tier, never a floating facade.
        shape(
          g,
          "box",
          facade(b.color, floors, d.theme),
          x,
          y + h / 2,
          z - 2,
          w,
          h,
          dep,
        );
        shape(
          g,
          "box",
          0xc0c4b1,
          x,
          y + h + 0.14,
          z - 2,
          w + 0.8,
          0.28,
          dep + 0.8,
        );
        for (const dx of [-w / 2, w / 2])
          shape(
            g,
            "box",
            0xabc0b8,
            x + dx,
            y + h / 2,
            z - 2,
            0.25,
            h,
            dep + 0.2,
          );
        y += h;
      }
      // Planted podium terraces around the inset tower.
      for (const dx of [-b.w * 0.43, b.w * 0.43]) {
        shape(g, "box", 0xa6b09a, x + dx, baseH + 0.8, z, 1.3, 1.5, b.d * 0.7);
        shape(g, "box", 0x627d57, x + dx, baseH + 1.7, z, 1.1, 0.7, b.d * 0.65);
      }
      if (b.style === "stepped")
        shape(g, "cyl", 0xa4b2a3, x, y + 5, z - 2, 0.15, 10, 0.15);
    } else if (d.theme === "works") {
      for (const dx of [-b.w / 3, 0, b.w / 3])
        shape(
          g,
          "roof",
          0x647a7b,
          x + dx,
          baseH + 0.2,
          z,
          b.w / 3,
          2.8,
          b.d + 1,
        );
    }
  }
  function litMaterial() {
    const key = "warm-lamps";
    if (!mats.has(key)) {
      const m = new THREE.MeshLambertMaterial({
        color: 0xffedbf,
        emissive: 0xffd59c,
        emissiveIntensity: 0.25,
      });
      m.userData.cityLamp = true;
      mats.set(key, m);
    }
    return mats.get(key);
  }
  function labelMaterial(label) {
    const key = "sign:" + label;
    if (mats.has(key)) return mats.get(key);
    const cv = document.createElement("canvas");
    cv.width = 512;
    cv.height = 96;
    const c = cv.getContext("2d");
    c.fillStyle = "#24464c";
    c.fillRect(0, 0, 512, 96);
    c.fillStyle = "#b8a174";
    c.fillRect(12, 8, 488, 2);
    c.fillRect(12, 86, 488, 2);
    c.font = "600 34px Arial";
    c.textAlign = "center";
    c.fillStyle = "#f1e7d0";
    c.fillText(label, 256, 59, 480);
    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    const m = new THREE.MeshLambertMaterial({ map: tex });
    mats.set(key, m);
    return m;
  }
  function shadow(g, x, z, w, d) {
    const key = "contact-shadow";
    if (!mats.has(key)) {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 64;
      const c = cv.getContext("2d"),
        gradient = c.createRadialGradient(32, 32, 4, 32, 32, 32);
      // Unit test canvas shims may omit gradient implementations.
      if (gradient) {
        gradient.addColorStop(0, "rgba(15,28,31,.3)");
        gradient.addColorStop(0.6, "rgba(15,28,31,.18)");
        gradient.addColorStop(1, "rgba(15,28,31,0)");
        c.fillStyle = gradient;
        c.fillRect(0, 0, 64, 64);
      }
      mats.set(
        key,
        new THREE.MeshBasicMaterial({
          map: new THREE.CanvasTexture(cv),
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
        }),
      );
    }
    const m = shape(g, "plane", mats.get(key), x, 0.065, z, w, d, 1);
    m.rotation.x = -Math.PI / 2;
  }
  function tree(g, x, z, seed, district) {
    const h = (district === "gardens" ? 6.5 : 4.5) + (seed % 4) * 0.45,
      leaf = [0x517858, 0x68805b, 0x819168, 0x466b5a][seed % 4];
    shape(g, "box", 0x9daca2, x, 0.18, z, 2, 0.36, 2);
    shape(g, "box", 0x586b50, x, 0.38, z, 1.75, 0.08, 1.75);
    shape(g, "cyl", 0x735a45, x, h * 0.4, z, 0.3, h * 0.8, 0.3);
    if (district === "gardens" && seed % 3 === 0) {
      for (let n = 0; n < 3; n++)
        shape(
          g,
          "cone",
          leaf,
          x,
          h - 1 + n * 0.9,
          z,
          2.6 - n * 0.55,
          2.5,
          2.6 - n * 0.55,
        );
    } else {
      shape(g, "leaf", leaf, x, h, z, 4.5, 3.4, 4.5);
      shape(g, "leaf", 0x76905e, x + 0.7, h + 0.9, z - 0.3, 3, 2.4, 3.5);
    }
    shadow(g, x, z, 7, 7);
  }
  function streetDetail(g, d) {
    // Clear pedestrian routes between building rows and along both road edges.
    for (const n of [84, 153]) {
      shape(g, "box", 0xb9baad, n, 0.018, 126, 5, 0.036, 212);
      shape(g, "box", 0xb9baad, 126, 0.019, n, 212, 0.038, 5);
    }
    for (const n of [19, 235]) {
      shape(g, "box", 0xbec1b6, n, 0.025, 119, 6, 0.05, 238);
      shape(g, "box", 0xbec1b6, 119, 0.026, n, 238, 0.052, 6);
    }
    for (const n of [16.2, 232]) {
      shape(g, "box", 0xddd8c9, n, 0.08, 119, 0.25, 0.16, 238);
      shape(g, "box", 0xddd8c9, 119, 0.08, n, 238, 0.16, 0.25);
    }
    for (let n = 26; n < 238; n += 8) {
      for (const k of [19, 235]) {
        shape(g, "box", 0xa8afa6, k, 0.056, n, 5.8, 0.008, 0.04);
        shape(g, "box", 0xa8afa6, n, 0.057, k, 0.04, 0.008, 5.8);
      }
    }
    for (let n = 0; n < 6; n++) {
      shape(g, "box", 0xf1ead6, 1.5 + n * 2.4, 0.045, 27, 1.25, 0.02, 4.5);
      shape(g, "box", 0xf1ead6, 27, 0.046, 1.5 + n * 2.4, 4.5, 0.02, 1.25);
    }
    shape(g, "box", 0xf1ead6, 4, 0.045, 21, 6, 0.02, 0.25);
    shape(g, "box", 0xf1ead6, 21, 0.045, 4, 0.25, 0.02, 6);
    // Wayfinding boards stand off the walking strip, never across a doorway.
    shape(g, "cyl", 0x40595d, 24, 1.6, 33, 0.12, 3.2, 0.12);
    shape(
      g,
      "box",
      labelMaterial(
        {
          homes: "ЛИПОВЫЙ ПРОСПЕКТ",
          towers: "ДЕЛОВОЙ КВАРТАЛ",
          gardens: "САДОВАЯ УЛИЦА",
          campus: "УНИВЕРСИТЕТСКАЯ",
          works: "ПРОМЫШЛЕННЫЙ",
        }[d.theme],
      ),
      24,
      3.15,
      33,
      5,
      0.85,
      0.12,
    );
    for (let n = 0; n < d.trees.length; n++)
      tree(g, ...d.trees[n], hash(d.i, d.j, n), d.theme);
  }
  function architecture(g, b, d) {
    const { w, h, d: depth, type, floors, color } = b,
      x = b.x - d.x,
      z = b.z - d.z;
    const front = z + depth / 2;
    shadow(g, x, z, w + 9, depth + 9);
    if (b.hedges)
      for (const c of b.hedges)
        shape(g, "box", 0x557b57, c.x - d.x, 0.5, c.z - d.z, c.w, 1, c.d);
    // Stone base, recessed entry, structural bands and full-width cornice.
    shape(g, "box", 0x9a9e91, x, 0.35, z, w + 0.25, 0.7, depth + 0.25);
    shape(g, "box", 0xd5cdb9, x, 3.5, front + 0.12, w, 0.24, 0.3);
    for (const side of [-1, 1])
      shape(
        g,
        "box",
        0xd5cdb9,
        x + side * (w / 2 - 0.3),
        h / 2,
        front + 0.12,
        0.6,
        h,
        0.32,
      );
    if (type === "house") {
      shape(g, "roof", 0x715a4b, x, h + 0.2, z, w + 1, 3.3, depth + 1);
      shape(g, "box", 0x9c8f7a, x - w * 0.25, h + 2.5, z, 0.9, 3, 1);
    } else {
      for (const side of [-1, 1]) {
        shape(
          g,
          "box",
          0x9ca9a5,
          x,
          h + 0.6,
          z + (side * depth) / 2,
          w + 0.4,
          0.8,
          0.25,
        );
        shape(
          g,
          "box",
          0x9ca9a5,
          x + (side * w) / 2,
          h + 0.6,
          z,
          0.25,
          0.8,
          depth,
        );
      }
      shape(
        g,
        "box",
        0x7c8b8c,
        x + w * 0.2,
        h + 0.8,
        z - depth * 0.2,
        3.2,
        1.1,
        2.8,
      );
      if (d.theme === "towers") {
        shape(g, "box", 0x82999f, x, h + 2, z, w * 0.55, 3.6, depth * 0.6);
        for (const dx of [-w * 0.25, 0, w * 0.25])
          shape(g, "box", 0x9bb2b5, x + dx, h * 0.5, front + 0.2, 0.2, h, 0.25);
      } else if (d.theme === "works") {
        for (let k = -1; k <= 1; k++)
          shape(
            g,
            "box",
            0x829a9b,
            x + k * w * 0.25,
            2.2,
            front + 0.1,
            w * 0.2,
            3.2,
            0.16,
          );
      } else if (type === "apartment") {
        for (let floor = 1; floor < floors; floor += 2)
          for (const side of [-1, 1]) {
            const bx = x + side * w * 0.3,
              by = floor * 3.5;
            shape(g, "box", 0xb8b8a8, bx, by, front + 0.6, 4, 0.18, 1.2);
            shape(g, "box", 0x607a7c, bx, by + 0.6, front + 1.15, 4, 0.7, 0.1);
          }
      }
    }
    // Shopfronts and entrance signs identify working doors, not fake portals.
    const title = {
      house: "ДОМ",
      apartment: "ЖИЛОЙ ДОМ",
      school: "ШКОЛА",
      office: d.theme === "works" ? "МАСТЕРСКАЯ" : "БИЗНЕС-ЦЕНТР",
      shop_grocery: "ПРОДУКТЫ 24ч",
    }[type];
    shape(
      g,
      "box",
      labelMaterial(title),
      x,
      3.05,
      front + 0.13,
      type === "house" ? 3.8 : 7.8,
      0.85,
      0.08,
    );
    shape(g, "box", 0x244951, x, 1.3, front + 0.12, 2.2, 2.6, 0.14);
    shape(g, "box", 0xa4b7ae, x + 0.45, 1.25, front + 0.23, 0.05, 0.4, 0.04);
    if (type === "shop_grocery" || type === "office" || type === "school") {
      for (const side of [-1, 1])
        shape(
          g,
          "box",
          0x456f79,
          x + side * 5,
          1.65,
          front + 0.1,
          5,
          2.6,
          0.12,
        );
      shape(
        g,
        "box",
        0x466960,
        x,
        3.65,
        front + 1.2,
        Math.min(w - 1, 15),
        0.18,
        2.4,
      );
      shape(
        g,
        "box",
        0xd7c59e,
        x,
        3.48,
        front + 2.35,
        Math.min(w - 1, 15),
        0.35,
        0.1,
      );
    }
    shape(g, "box", litMaterial(), x, 2.65, front + 0.3, 1.8, 0.1, 0.2);
    // Connect each real entrance to the pedestrian grid without steps/collision.
    const edge = z + depth / 2 + 3,
      target = z < 80 ? 84 : z < 150 ? 153 : 216;
    shape(
      g,
      "box",
      0xb9baad,
      x,
      0.028,
      (edge + target) / 2,
      3,
      0.056,
      Math.abs(target - edge) + 1,
    );
  }
  function plazaDetail(g, d) {
    shape(g, "box", 0xcfc7b1, 119, 0.044, 119, 49, 0.088, 49);
    for (let n = 99; n < 143; n += 4) {
      shape(g, "box", 0xaea998, n, 0.092, 119, 0.035, 0.008, 48);
      shape(g, "box", 0xaea998, 119, 0.093, n, 48, 0.008, 0.035);
    }
    if (d.theme === "towers" || d.theme === "campus") {
      shape(g, "cyl", 0x7f9791, 119, 0.35, 119, 7.5, 0.7, 7.5);
      const a = shape(g, "box", 0xbba06e, 118.2, 3.8, 119, 1, 6.8, 1);
      a.rotation.z = -0.24;
      const b = shape(g, "box", 0x6a9093, 120, 2.8, 119, 1, 5, 1);
      b.rotation.z = 0.24;
      shape(g, "leaf", 0xcdb684, 119, 7, 119, 2.1, 2.1, 2.1);
    } else {
      shape(g, "cyl", 0x9faeaa, 119, 0.35, 119, 8, 0.7, 8);
      shape(g, "cyl", 0x628f98, 119, 0.72, 119, 7, 0.05, 7);
      shape(g, "cyl", 0xb6c1b1, 119, 1.15, 119, 1.2, 1.6, 1.2);
      shape(g, "cyl", 0x9caea6, 119, 1.95, 119, 3.5, 0.18, 3.5);
      shape(g, "cyl", 0x86b8c1, 119, 2.08, 119, 3.1, 0.06, 3.1);
    }
  }
  function gardenDetail(g) {
    for (const x of [105, 133]) {
      shape(g, "box", 0x74886c, x, 0.12, 119, 3.4, 0.24, 10);
      shape(g, "box", 0x4f684a, x, 0.27, 119, 3, 0.1, 9.6);
      for (let n = 0; n < 6; n++) {
        const z = 115 + n * 1.5;
        shape(
          g,
          "leaf",
          [0xb78373, 0xc3b388, 0x897398][n % 3],
          x,
          0.48,
          z,
          1.5,
          0.5,
          1.2,
        );
      }
    }
    for (const x of [114.5, 123.5])
      for (const z of [137, 141])
        shape(g, "box", 0x79664c, x, 1.5, z, 0.3, 3, 0.3);
    for (let n = 0; n < 8; n++)
      shape(g, "box", 0x9f8967, 114.5 + n * 1.28, 3.1, 139, 0.17, 0.25, 5);
    for (const z of [137, 141])
      shape(g, "box", 0x79664c, 119, 2.9, z, 9.5, 0.3, 0.22);
  }
  // Local ambient passers-by, not network players or quest NPCs. Four low-poly
  // figures per active group, one draw; at most 12 animated near the player.
  const crowdTemp = new THREE.Object3D(),
    crowdBase = new THREE.Matrix4(),
    crowdPart = new THREE.Matrix4();
  function makeCrowd(g) {
    const m = new THREE.InstancedMesh(geom("box"), material(0xffffff), 36);
    m.name = "cityPedestrians";
    m.frustumCulled = false;
    m.visible = false;
    for (let n = 0; n < 4; n++)
      for (let part = 0; part < 9; part++) {
        const color =
          part === 0
            ? [0x7b9998, 0xb8876c, 0x8c9a74, 0x89849c][n]
            : part === 1 || part === 5 || part === 6
              ? 0xc7a688
              : part === 2
                ? 0x514738
                : part >= 7
                  ? 0x333e41
                  : 0x526775;
        m.setColorAt(
          n * 9 + part,
          new THREE.Color(color).convertSRGBToLinear(),
        );
      }
    g.add(m);
    g.userData.crowd = m;
    animateCrowd(g, 0);
  }
  function animateCrowd(g, time) {
    const m = g.userData.crowd;
    if (!m) return;
    for (let n = 0; n < 4; n++) {
      const t = (time * (0.9 + n * 0.08) + n * 42) % 320,
        along = 40 + (t < 160 ? t : 320 - t),
        axis = n % 2,
        yaw = (axis ? Math.PI / 2 : 0) + (t < 160 ? 0 : Math.PI),
        bob = Math.abs(Math.sin(time * 3 + n)) * 0.025,
        swing = Math.sin(time * 3 + n) * 0.38;
      crowdBase.makeRotationY(yaw);
      crowdBase.setPosition(axis ? along : 19, 0, axis ? 19 : along);
      const parts = [
        [0, 1.35 + bob, 0, 0.5, 0.62, 0.3, 0],
        [0, 1.91 + bob, 0, 0.34, 0.42, 0.34, 0],
        [0, 2.11 + bob, 0, 0.36, 0.12, 0.36, 0],
        [-0.14, 0.65, 0, 0.2, 0.74, 0.23, swing],
        [0.14, 0.65, 0, 0.2, 0.74, 0.23, -swing],
        [-0.36, 1.25, 0, 0.16, 0.66, 0.18, -swing],
        [0.36, 1.25, 0, 0.16, 0.66, 0.18, swing],
        [-0.14, 0.2, Math.sin(swing) * 0.2, 0.22, 0.16, 0.36, 0],
        [0.14, 0.2, -Math.sin(swing) * 0.2, 0.22, 0.16, 0.36, 0],
      ];
      parts.forEach(([x, y, z, w, h, d, r], i) => {
        crowdTemp.position.set(x, y, z);
        crowdTemp.scale.set(w, h, d);
        crowdTemp.rotation.set(r, 0, 0);
        crowdTemp.updateMatrix();
        m.setMatrixAt(
          n * 9 + i,
          crowdPart.multiplyMatrices(crowdBase, crowdTemp.matrix),
        );
      });
    }
    m.instanceMatrix.needsUpdate = true;
  }
  function updateCrowds(p) {
    const count =
      typeof SETTINGS !== "undefined" && SETTINGS.perf
        ? 0
        : typeof innerWidth !== "undefined" && innerWidth < 650
          ? 1
          : 3;
    const list = [...chunks.values()].sort(
      (a, b) =>
        a.g.position.distanceToSquared(p) - b.g.position.distanceToSquared(p),
    );
    list.forEach((c, i) => {
      const m = c.g.userData.crowd;
      if (!m) return;
      m.visible = i < count && c.g.position.distanceToSquared(p) < 350 * 350;
      if (m.visible) animateCrowd(c.g, performance.now() / 1000);
    });
  }
  function updateCityLight() {
    const night = Math.max(0, Math.min(1, (window.FZDN && FZDN.nightF) || 0));
    for (const m of mats.values()) {
      if (m.userData.cityWindows) m.emissiveIntensity = night * 0.8;
      if (m.userData.cityLamp) m.emissiveIntensity = 0.25 + night * 1.5;
    }
  }
  function batch(g) {
    g.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(),
      groups = new Map();
    g.traverse((o) => {
      if (!o.isMesh) return;
      const solid =
        o.material.isMeshLambertMaterial &&
        !o.material.map &&
        !o.material.transparent &&
        !o.material.userData.cityLamp;
      const key = o.geometry.uuid + (solid ? "solid" : o.material.uuid);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(o);
    });
    groups.forEach((ms) => {
      const m = new THREE.InstancedMesh(
        ms[0].geometry,
        ms[0].material.isMeshLambertMaterial &&
        !ms[0].material.map &&
        !ms[0].material.transparent &&
        !ms[0].material.userData.cityLamp
          ? material(0xffffff)
          : ms[0].material,
        ms.length,
      );
      ms.forEach((o, i) => {
        m.setMatrixAt(
          i,
          new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld),
        );
        if (m.material === material(0xffffff))
          m.setColorAt(i, o.material.color);
        o.parent.remove(o);
      });
      m.instanceMatrix.needsUpdate = true;
      m.frustumCulled = false;
      g.add(m);
    });
  }
  function build(i, j) {
    const d = layout(i, j),
      g = new THREE.Group();
    g.name = "cityChunk_" + d.key;
    g.position.set(d.x, 0, d.z);
    root.add(g);
    shape(g, "box", 0x7f916f, TILE / 2, -0.12, TILE / 2, TILE, 0.24, TILE);
    shape(g, "box", 0x505e65, 8, 0.015, TILE / 2, 16, 0.03, TILE);
    shape(g, "box", 0x505e65, TILE / 2, 0.015, 8, TILE, 0.03, 16);
    shape(g, "box", 0xb5b7a7, 19, 0.025, TILE / 2, 6, 0.05, TILE);
    shape(g, "box", 0xb5b7a7, TILE / 2, 0.025, 19, TILE, 0.05, 6);
    for (let n = 40; n < TILE; n += 40) {
      shape(g, "box", 0xe1d5ae, 8, 0.04, n, 0.2, 0.02, 7);
      shape(g, "box", 0xe1d5ae, n, 0.04, 8, 7, 0.02, 0.2);
      for (const [x, z] of [
        [21, n],
        [n, 21],
      ]) {
        shape(g, "cyl", 0x455761, x, 2.6, z, 0.12, 5.2, 0.12);
        shape(g, "box", 0x455761, x - 0.7, 5.2, z, 1.6, 0.12, 0.12);
        shape(g, "box", litMaterial(), x - 1.3, 5.15, z, 0.7, 0.15, 0.4);
      }
    }
    for (const building of d.buildings) {
      const { w, h, d: depth, type, floors, color } = building,
        x = building.x - d.x,
        z = building.z - d.z;
      massing(g, building, d);
      shape(g, "box", 0x39505b, x, 1.3, z + depth / 2 + 0.04, 2, 2.6, 0.1);
      shape(g, "box", 0xd3ba86, x, 3, z + depth / 2 + 0.5, 4, 0.15, 1.2);
      shape(g, "box", 0xb6b8a8, x, 0.02, z + depth / 2 + 3, w + 4, 0.04, 6);
      const names = {
        house: "Коттедж",
        apartment: "Жилой дом",
        school: "Школа",
        office: "Офис",
        shop_grocery: "Продукты 24ч",
      };
      interactables.push({
        type,
        name: (names[type] || type) + " • квартал " + (i + 21) + "/" + (j + 21),
        position: { x: building.x, y: 0, z: building.z + depth / 2 + 2 },
        range: 3.2,
        cityChunk: d.key,
      });
    }
    streetDetail(g, d);
    if (d.urban && d.urban.landmark) shadow(g, 118, 49, 48, 48);
    if (d.urban)
      for (const p of d.urban.pieces) {
        const mesh = shape(
          g,
          p.shape,
          urbanMaterial(p.color),
          p.x,
          p.y,
          p.z,
          p.w,
          p.h,
          p.d,
        );
        mesh.rotation.y = p.rotation;
        if (p.direction)
          mesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(...p.direction),
          );
      }
    if (d.space) {
      for (const p of d.space.pieces) {
        const mat =
          typeof p.color === "object" ? labelMaterial(p.color.label) : p.color;
        const mesh = shape(g, p.shape, mat, p.x, p.y, p.z, p.w, p.h, p.d);
        mesh.rotation.y = p.rotation;
      }
      for (const e of d.space.entries) {
        const entry = {
          type: e.type,
          name: e.name,
          position: { x: d.x + e.x, y: 0, z: d.z + e.z },
          range: e.range,
          cityLeisure: d.key,
        };
        if (e.seat)
          entry.seat = {
            ...e.seat,
            x: d.x + e.seat.x,
            z: d.z + e.seat.z,
            cityLeisure: d.key,
          };
        for (const name of ["hoop", "launch"])
          if (e[name])
            entry[name] = {
              ...e[name],
              x: d.x + e[name].x,
              z: d.z + e[name].z,
            };
        interactables.push(entry);
      }
    } else {
      plazaDetail(g, d);
      gardenDetail(g);
    }
    batch(g);
    makeCrowd(g);
    chunks.set(d.key, { g, i, j });
    counts++;
    return g;
  }
  function remove(key) {
    const c = chunks.get(key);
    if (!c) return;
    c.g.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
    });
    if (window.FZLeisure) FZLeisure.forget(key);
    if (
      typeof sittingOn !== "undefined" &&
      sittingOn &&
      sittingOn.spot.cityLeisure === key &&
      typeof standUpFromSeat === "function"
    )
      standUpFromSeat();
    root.remove(c.g);
    chunks.delete(key);
    interactables = interactables.filter(
      (s) => s.cityChunk !== key && s.cityLeisure !== key,
    );
  }
  function reset() {
    for (const k of [...chunks.keys()]) remove(k);
    if (root && root.parent) root.parent.remove(root);
    root = null;
    owner = null;
    stamp = "";
    queue = [];
  }
  function ensure() {
    if (root && owner === scene) return;
    if (root) reset();
    root = new THREE.Group();
    root.name = "FZ_CITY_STREAM";
    scene.add(root);
    owner = scene;
  }
  function plan() {
    const p = localPlayer.mesh.position,
      { i, j } = cell(p.x, p.z),
      key = i + ":" + j;
    if (key === stamp) return;
    stamp = key;
    const wanted = new Set();
    queue = [];
    for (let a = i - RADIUS; a <= i + RADIUS; a++)
      for (let b = j - RADIUS; b <= j + RADIUS; b++) {
        if (excluded(a, b)) continue;
        const k = a + ":" + b;
        wanted.add(k);
        if (!chunks.has(k))
          queue.push({ i: a, j: b, dist: (a - i) ** 2 + (b - j) ** 2 });
      }
    queue.sort((a, b) => a.dist - b.dist);
    for (const k of [...chunks.keys()]) if (!wanted.has(k)) remove(k);
  }
  let viewState = null;
  function releaseView() {
    if (!viewState) return;
    const v = viewState;
    if (v.camera.far === v.limit) {
      v.camera.far = v.far;
      v.camera.updateProjectionMatrix();
    }
    if (v.fog && typeof scene !== "undefined" && scene.fog === v.fog) {
      v.fog.near = v.near;
      v.fog.far = v.fogFar;
    }
    viewState = null;
  }
  function syncView(eligible) {
    if (!eligible || typeof camera === "undefined" || !camera) {
      releaseView();
      return;
    }
    if (viewState && (viewState.camera !== camera || viewState.scene !== scene))
      releaseView();
    if (!viewState) {
      const dn = window.FZDN,
        fog = scene.fog;
      viewState = {
        scene,
        camera,
        far: camera.far,
        limit: 0,
        fog,
        near: fog ? (dn && dn.fogObj === fog ? dn.baseFogNear : fog.near) : 0,
        fogFar: fog ? (dn && dn.fogObj === fog ? dn.baseFogFar : fog.far) : 0,
      };
      if (fog && typeof fog.far === "number") {
        fog.near = 220;
        fog.far = 520;
      }
    }
    const limit = Math.min(
      750,
      typeof SETTINGS !== "undefined" ? (SETTINGS.drawDist || 420) + 300 : 750,
    );
    if (viewState.limit && camera.far !== viewState.limit)
      viewState.far = camera.far;
    viewState.limit = limit;
    if (camera.far !== limit) {
      camera.far = limit;
      camera.updateProjectionMatrix();
    }
  }
  let arrivalMesh = null;
  function arrive() {
    if (
      !window.FZ_CITY_ARRIVAL ||
      !ready() ||
      arrivalMesh === localPlayer.mesh ||
      !window.FZUI ||
      !FZUI.playing() ||
      window._loadingGate ||
      window.cine ||
      interior() ||
      (typeof localCar !== "undefined" && localCar) ||
      (window.FZ8SEA && (FZ8SEA.active() || FZ8SEA.aboard())) ||
      (window.FZ8M && FZ8M.ride && FZ8M.ride()) ||
      (window.FZ8L && FZ8L.drive && FZ8L.drive())
    )
      return false;
    arrivalMesh = localPlayer.mesh;
    const p = localPlayer.mesh.position;
    // Only relocate a genuine fresh spawn, never a resumed position or a return from sea.
    const original = typeof SPAWN_POINT !== "undefined" ? SPAWN_POINT : NEWCITY;
    if (
      Math.min(
        Math.hypot(p.x - NEWCITY.spawnX, p.z - NEWCITY.spawnZ),
        Math.hypot(p.x - original.x, p.z - original.z),
      ) > 30
    )
      return false;
    const ok = travel("heart");

    return ok;
  }
  function update() {
    if (!ready()) {
      releaseView();
      return;
    }
    arrive();
    const pos = localPlayer.mesh.position,
      tile = cell(pos.x, pos.z);
    syncView(
      !interior() &&
        !(window.FZ8SEA && FZ8SEA.active()) &&
        !(window.FZUI && !FZUI.playing()) &&
        !window.cine &&
        !excluded(tile.i, tile.j) &&
        inBounds(pos.x, pos.z),
    );
    ensure();
    if (
      interior() ||
      (window.FZ8SEA && FZ8SEA.active()) ||
      (window.FZUI && !FZUI.playing())
    ) {
      root.visible = false;
      return;
    }
    root.visible = true;
    const p = localPlayer.mesh.position;
    if (!inBounds(p.x, p.z)) {
      root.visible = false;
      return;
    }
    plan();
    updateCityLight();
    updateCrowds(p);
    for (let n = 0; n < 2 && queue.length; n++) {
      const q = queue.shift();
      build(q.i, q.j);
    }
    if (chunks.size > LIMIT) throw new Error("City streaming budget exceeded");
    if (typeof camera !== "undefined" && camera) {
      if (!frustum) {
        frustum = new THREE.Frustum();
        projection = new THREE.Matrix4();
        bound = new THREE.Sphere();
      }
      frustum.setFromProjectionMatrix(
        projection.multiplyMatrices(
          camera.projectionMatrix,
          camera.matrixWorldInverse,
        ),
      );
      for (const c of chunks.values()) {
        bound.center.set(
          c.g.position.x + TILE / 2,
          30,
          c.g.position.z + TILE / 2,
        );
        bound.radius = 178;
        c.g.visible = frustum.intersectsSphere(bound);
      }
    }
  }
  function travel(id) {
    if (
      !ready() ||
      interior() ||
      (window.FZUI && !FZUI.playing()) ||
      window.cine ||
      window._loadingGate ||
      (typeof localCar !== "undefined" && localCar) ||
      (window.FZ8SEA && (FZ8SEA.active() || FZ8SEA.aboard())) ||
      (window.FZ8M && FZ8M.ride && FZ8M.ride()) ||
      (window.FZ8L && FZ8L.drive && FZ8L.drive())
    ) {
      if (typeof showNotification === "function")
        showNotification(
          "Сначала выйди из помещения или транспорта и вернись в город.",
          "info",
        );
      return false;
    }
    const d = districts.find((d) => d[0] === id);
    if (!d) return false;
    const b = base(),
      x =
        id === "center"
          ? NEWCITY.spawnX
          : b.x + d[2] * TILE + (id === "heart" ? 118 : 84),
      z =
        id === "center"
          ? NEWCITY.spawnZ
          : b.z + d[3] * TILE + (id === "heart" ? 202 : 180);
    ensure();
    if (window.FZLeisure) FZLeisure.close();
    if (
      typeof sittingOn !== "undefined" &&
      sittingOn &&
      typeof standUpFromSeat === "function"
    )
      standUpFromSeat();
    localPlayer.mesh.position.set(x, 0, z);
    if (id !== "center") {
      const look = Math.atan2(
        b.x + d[2] * TILE + 118 - x,
        b.z + d[3] * TILE + 49 - z,
      );
      localPlayer.mesh.rotation.y = look;
      if (typeof cameraAngleH !== "undefined")
        cameraAngleH = window.cameraMode === "first" ? look : look - Math.PI;
      if (typeof cameraAngleV !== "undefined")
        cameraAngleV = window.cameraMode === "first" ? -0.07 : -0.23;
    }
    if (typeof velocity !== "undefined")
      velocity.x = velocity.y = velocity.z = 0;
    stamp = "";
    plan();
    while (queue.length && queue[0].dist <= 1) {
      const q = queue.shift();
      build(q.i, q.j);
    }
    close();
    update();
    return true;
  }
  function close() {
    if (!panel) return;
    panel.hidden = true;
    if (previousFocus && previousFocus.isConnected) previousFocus.focus();
    previousFocus = null;
  }
  function open() {
    if (window.FZUI && !FZUI.playing()) return;
    if (!panel) {
      const style = document.createElement("style");
      style.textContent =
        "#fzCityMap[hidden]{display:none!important}#fzCityMap{position:fixed;inset:0;z-index:12040;background:#071823bb;display:grid;place-items:center;padding:16px;font:14px/1.5 Arial;color:#e8e4d8}#fzCityMap article{background:#172e3c;border:1px solid #52717e;border-radius:16px;padding:22px;width:min(650px,100%);max-height:86dvh;overflow:auto;box-sizing:border-box}#fzCityMap h2{margin:0}#fzCityMap button{min-height:44px;margin:5px;padding:10px;border:1px solid #718e9a;border-radius:9px;background:#234657;color:#fff;cursor:pointer}#fzCityMap [data-close]{float:right}#fzCityMap button:focus-visible{outline:3px solid #d5b173}#fzCityMap section{border-top:1px solid #43606c;padding:8px 0}body:not(.fz-playing) #fzCityMap{display:none!important}";
      document.head.appendChild(style);
      panel = document.createElement("div");
      panel.id = "fzCityMap";
      panel.hidden = true;
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      panel.setAttribute("aria-labelledby", "fzCityTitle");
      panel.innerHTML =
        '<article><button data-close>Закрыть</button><h2 id="fzCityTitle">Открой Фантазию</h2><p>Площадь с часовой башней, озёрный парк, ботанический сад, старое депо и высотные кварталы.</p><p>Выбери район для поездки. Входы в дома, дворовые занятия и прогулочные маршруты сохранены. Подгружаются только ближайшие кварталы.</p><div id="fzCityDest"></div></article>';
      document.body.appendChild(panel);
      panel.querySelector("[data-close]").onclick = close;
      panel.onclick = (e) => {
        if (e.target === panel) close();
      };
      for (const ev of ["mousedown", "pointerdown", "touchstart"])
        panel.addEventListener(ev, (e) => e.stopPropagation());
      for (const d of districts) {
        const row = document.createElement("section"),
          btn = document.createElement("button"),
          p = document.createElement("p");
        btn.textContent = d[1];
        btn.onclick = () => travel(d[0]);
        p.textContent = d[4];
        row.append(btn, p);
        panel.querySelector("#fzCityDest").appendChild(row);
      }
      window.addEventListener(
        "keydown",
        (e) => {
          if (panel.hidden) return;
          e.stopImmediatePropagation();
          if (e.key === "Escape") {
            e.preventDefault();
            close();
          }
          if (e.key === "Tab") {
            const b = [...panel.querySelectorAll("button")],
              i = b.indexOf(document.activeElement);
            e.preventDefault();
            b[(i + (e.shiftKey ? -1 : 1) + b.length) % b.length].focus();
          }
        },
        true,
      );
    }
    previousFocus = document.activeElement;
    panel.hidden = false;
    panel.querySelector("[data-close]").focus();
    if (typeof keys !== "undefined")
      Object.keys(keys).forEach((k) => (keys[k] = false));
    if (document.pointerLockElement && document.exitPointerLock)
      document.exitPointerLock();
  }
  let gridMap = null,
    gridSource = null;
  function minimap(canvas) {
    if (!ready() || interior() || (window.FZ8SEA && FZ8SEA.active()))
      return false;
    const p = localPlayer.mesh.position;
    if (!inBounds(p.x, p.z)) return false;
    const c = canvas.getContext("2d"),
      size = canvas.width,
      scale = size / 600,
      mx = (x) => size / 2 + (x - p.x) * scale,
      mz = (z) => size / 2 + (z - p.z) * scale;
    c.clearRect(0, 0, size, size);
    c.save();
    c.beginPath();
    c.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    c.clip();
    c.fillStyle = "#243e40";
    c.fillRect(0, 0, size, size);
    const G = NEWCITY.grid;
    if (G) {
      if (gridSource !== G) {
        gridSource = G;
        gridMap = document.createElement("canvas");
        gridMap.width = G.W;
        gridMap.height = G.D;
        const gc = gridMap.getContext("2d");
        gc.fillStyle = "#344d50";
        gc.fillRect(0, 0, G.W, G.D);
        gc.fillStyle = "#9ca99b";
        for (let j = 0; j < G.D; j++)
          for (let i = 0; i < G.W; i++)
            if (G.grid[j * G.W + i]) gc.fillRect(i, j, 1, 1);
      }
      c.drawImage(
        gridMap,
        mx(G.ox),
        mz(G.oz),
        G.W * G.CELL * scale,
        G.D * G.CELL * scale,
      );
    }
    const cellP = cell(p.x, p.z);
    for (let i = cellP.i - 2; i <= cellP.i + 2; i++)
      for (let j = cellP.j - 2; j <= cellP.j + 2; j++) {
        if (excluded(i, j)) continue;
        const d = layout(i, j);
        c.fillStyle = "#84928b";
        c.fillRect(mx(d.x), mz(d.z), 16 * scale, TILE * scale);
        c.fillRect(mx(d.x), mz(d.z), TILE * scale, 16 * scale);
        if (d.urban) {
          c.fillStyle = "#66855b";
          for (const p of d.urban.parks)
            c.fillRect(
              mx(d.x + p.x - 29),
              mz(d.z + p.z - 29),
              58 * scale,
              58 * scale,
            );
          if (d.urban.landmark) {
            c.fillStyle = d.urban.landmark === "pond" ? "#72b6bf" : "#e1c78a";
            c.fillRect(mx(d.x + 108), mz(d.z + 39), 20 * scale, 20 * scale);
          }
        }
        c.fillStyle = "#bdb4a0";
        for (const b of d.buildings)
          c.fillRect(
            mx(b.x - b.w / 2),
            mz(b.z - b.d / 2),
            b.w * scale,
            b.d * scale,
          );
      }
    if (window.FZLeisure) FZLeisure.drawMap(c, mx, mz);
    if (typeof remotePlayers !== "undefined") {
      c.fillStyle = "#75c9e8";
      for (const r of Object.values(remotePlayers)) {
        const v = r.targetPos;
        if (!v) continue;
        c.beginPath();
        c.arc(mx(v.x), mz(v.z), 2, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.save();
    c.translate(size / 2, size / 2);
    c.rotate(-localPlayer.mesh.rotation.y);
    c.fillStyle = "#ffe29d";
    c.beginPath();
    c.moveTo(0, 7);
    c.lineTo(-4, -5);
    c.lineTo(4, -5);
    c.closePath();
    c.fill();
    c.restore();
    c.fillStyle = "#fff5d6";
    c.font = "bold 12px Arial";
    c.textAlign = "center";
    c.fillText("С", size / 2, 16);
    c.font = "10px Arial";
    c.fillText(
      core(p.x, p.z)
        ? "ЦЕНТР"
        : "КВАРТАЛ " + (cellP.i + 21) + "/" + (cellP.j + 21),
      size / 2,
      size - 15,
    );
    c.restore();
    return true;
  }
  window.FZCITY = {
    minimap,
    places: () =>
      [...chunks.values()]
        .map((c) => {
          const d = layout(c.i, c.j);
          if (!d.space) return null;
          return {
            key: d.key,
            kind: d.space.kind,
            name: d.space.name,
            x: d.x + 119,
            z: d.z + (d.space.kind === "court" ? 124 : 145),
          };
        })
        .filter(Boolean),
    update,
    arrive,
    collision,
    open,
    close,
    travel,
    info: () => ({
      size: HALF * 2,
      areaRatio: 100,
      chunks: chunks.size,
      pending: queue.length,
      layoutCache: layouts.size,
      built: counts,
      materials: mats.size,
      geometries: geometry.size,
      style: "masterplan-v10",
      landmarks: window.FZUrban ? FZUrban.specials : [],
      districts: districts.map((d) => ({ id: d[0], name: d[1] })),
    }),
  };
})();
