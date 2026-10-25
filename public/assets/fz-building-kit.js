/* v28 shared construction kit. Every GPU resource belongs to one visit.
 * Local coordinates are converted once; no city geometry is copied or disposed. */
(function () {
  "use strict";
  const C = {
    wall: 0xd4d8dc,
    floor: 0x77818e,
    wood: 0x80604c,
    dark: 0x233044,
    metal: 0x687889,
    glass: 0x83a8bb,
    light: 0xffe6b0,
    blue: 0x385d80,
    red: 0x8d4052,
    green: 0x4f795d,
  };
  class Kit {
    constructor(type, floors) {
      this.type = type;
      this.wallColor = type === "cinema" ? 0x354151 : C.wall;
      this.floorColor = type === "cinema" ? 0x202936 : C.floor;
      this.floors = floors;
      this.FH = 5.2;
      this.root = new THREE.Group();
      this.root.name = "building28_" + type;
      this.root.position.set(INTERIOR_BASE.x, 0, INTERIOR_BASE.z);
      this.resources = new Set();
      this.materials = new Map();
      this.groups = [];
      this.colliders = [];
      this.actions = [];
      this.doors = [];
      this.staff = [];
      this.screens = [];
      this.ramps = [];
      this.batches = new Map();
      this.current = 0;
      this.time = 0;
      this.boxGeo = this.own(new THREE.BoxGeometry(1, 1, 1));
      this.cylGeo = this.own(new THREE.CylinderGeometry(0.5, 0.5, 1, 10));
      for (let f = 0; f < floors; f++) {
        const g = new THREE.Group();
        g.position.y = f * this.FH;
        g.name = "floor_" + (f + 1);
        this.root.add(g);
        this.groups.push(g);
      }
      const light = new THREE.HemisphereLight(0xd8e8ff, 0x605341, 0.45);
      this.root.add(light);
      const sun = new THREE.DirectionalLight(0xffecd2, 0.35);
      sun.position.set(8, 20, 15);
      this.root.add(sun);
    }
    own(r) {
      this.resources.add(r);
      return r;
    }
    mat(color, glow = false) {
      const key = color + ":" + glow;
      if (!this.materials.has(key))
        this.materials.set(
          key,
          this.own(
            new THREE.MeshStandardMaterial({
              roughness: 0.85,
              metalness: 0.03,
              color,
              emissive: glow ? color : 0,
              emissiveIntensity: glow ? 0.5 : 0,
            }),
          ),
        );
      return this.materials.get(key);
    }
    floor(f) {
      this.current = f;
      return this;
    }
    collider(x, z, w, d, y = 0, h = 3.4, extra = {}) {
      const c = {
        minX: x - w / 2,
        maxX: x + w / 2,
        minZ: z - d / 2,
        maxZ: z + d / 2,
        minY: this.current * this.FH + y,
        maxY: this.current * this.FH + y + h,
        ...extra,
      };
      this.colliders.push(c);
      return c;
    }
    shape(geo, w, h, d, x, y, z, color, solid = false, rot = 0) {
      const key = this.current + ":" + geo.uuid + ":" + color;
      if (!this.batches.has(key))
        this.batches.set(key, {
          geo,
          mat: this.mat(color),
          floor: this.current,
          items: [],
        });
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          rot,
        ),
        new THREE.Vector3(w, h, d),
      );
      this.batches.get(key).items.push(m);
      if (solid) this.collider(x, z, w, d, y - h / 2, h);
    }
    box(w, h, d, x, y, z, color = C.wall, solid = false, rot = 0) {
      this.shape(this.boxGeo, w, h, d, x, y, z, color, solid, rot);
    }
    cyl(r, h, x, y, z, color = C.metal, solid = false) {
      this.shape(this.cylGeo, r * 2, h, r * 2, x, y, z, color, solid);
    }
    moving(w, h, d, x, y, z, color, parent = this.groups[this.current]) {
      const m = new THREE.Mesh(this.boxGeo, this.mat(color));
      m.scale.set(w, h, d);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    }
    sign(text, x, y, z, w = 4, h = 0.55, rot = 0) {
      const c = document.createElement("canvas");
      c.width = 768;
      c.height = Math.max(96, Math.round((768 * h) / w));
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#132338";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = "#e4f5ff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "600 " + Math.min(48, c.height * 0.55) + "px Arial";
      ctx.fillText(text, 384, c.height / 2, 734);
      const texture = this.own(new THREE.CanvasTexture(c));
      const m = new THREE.Mesh(
        this.own(new THREE.PlaneGeometry(w, h)),
        this.own(
          new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
        ),
      );
      m.position.set(x, y, z);
      m.rotation.y = rot;
      this.groups[this.current].add(m);
      return { mesh: m, canvas: c, texture };
    }
    action(name, x, z, kind, data = {}) {
      const a = {
        type: "building28",
        building28: true,
        interior: true,
        name,
        kind,
        floor: this.current,
        position: new THREE.Vector3(
          INTERIOR_BASE.x + x,
          this.current * this.FH,
          INTERIOR_BASE.z + z,
        ),
        range: 2.25,
        ...data,
      };
      this.actions.push(a);
      return a;
    }
    wallZ(x, z, w, opening = null) {
      if (!opening) {
        this.box(w, this.FH, 0.24, x, this.FH / 2, z, this.wallColor, true);
        return;
      }
      const [cx, width] = opening,
        left = x - w / 2,
        right = x + w / 2;
      if (cx - width / 2 > left)
        this.box(
          cx - width / 2 - left,
          this.FH,
          0.24,
          (left + cx - width / 2) / 2,
          this.FH / 2,
          z,
          this.wallColor,
          true,
        );
      if (cx + width / 2 < right)
        this.box(
          right - cx - width / 2,
          this.FH,
          0.24,
          (right + cx + width / 2) / 2,
          this.FH / 2,
          z,
          this.wallColor,
          true,
        );
      this.box(
        width,
        this.FH - 3.7,
        0.24,
        cx,
        (this.FH + 3.7) / 2,
        z,
        this.wallColor,
      );
    }
    wallX(x, z, d, opening = null) {
      if (!opening) {
        this.box(0.24, this.FH, d, x, this.FH / 2, z, this.wallColor, true);
        return;
      }
      const [cz, width] = opening,
        lo = z - d / 2,
        hi = z + d / 2;
      if (cz - width / 2 > lo)
        this.box(
          0.24,
          this.FH,
          cz - width / 2 - lo,
          x,
          this.FH / 2,
          (lo + cz - width / 2) / 2,
          this.wallColor,
          true,
        );
      if (cz + width / 2 < hi)
        this.box(
          0.24,
          this.FH,
          hi - cz - width / 2,
          x,
          this.FH / 2,
          (hi + cz + width / 2) / 2,
          this.wallColor,
          true,
        );
      this.box(
        0.24,
        this.FH - 3.7,
        width,
        x,
        (this.FH + 3.7) / 2,
        cz,
        this.wallColor,
      );
    }
    door(x, z, axis, label, open = false) {
      const width = 2.6,
        pivot = new THREE.Group();
      pivot.position.set(
        x - (axis === "z" ? width / 2 : 0),
        0,
        z - (axis === "x" ? width / 2 : 0),
      );
      pivot.rotation.y = axis === "x" ? -Math.PI / 2 : 0;
      this.groups[this.current].add(pivot);
      this.moving(width, 3.5, 0.13, width / 2, 1.75, 0, C.wood, pivot);
      this.moving(0.07, 0.3, 0.17, width - 0.22, 1.65, 0.09, 0xe2c58a, pivot);
      this.moving(width - 0.3, 0.08, 0.15, width / 2, 0.2, 0, C.dark, pivot);
      const collider = this.collider(
        x,
        z,
        axis === "z" ? width : 0.25,
        axis === "z" ? 0.25 : width,
        0,
        3.6,
        { door: true },
      );
      const door = {
        pivot,
        base: axis === "x" ? -Math.PI / 2 : 0,
        open,
        amount: open ? 1 : 0,
        collider,
        x,
        z,
        axis,
        floor: this.current,
      };
      this.doors.push(door);
      for (const side of [-1, 1])
        this.action(
          label + " — дверь",
          x + (axis === "x" ? side * 1.4 : 0),
          z + (axis === "z" ? side * 1.4 : 0),
          "door",
          { door, range: 1.9 },
        );
      this.sign(
        label,
        x + (axis === "x" ? 0.15 : 0),
        4,
        z + (axis === "z" ? 0.15 : 0),
        3.2,
        0.5,
        axis === "x" ? Math.PI / 2 : 0,
      );
      return door;
    }
    seat(x, z, rot = 0, name = "Сесть", color = C.blue) {
      this.box(0.95, 0.18, 0.9, x, 0.8, z, color, true);
      this.box(
        0.95,
        1,
        0.14,
        x - Math.sin(rot) * 0.39,
        1.3,
        z - Math.cos(rot) * 0.39,
        color,
        false,
        rot,
      );
      for (const dx of [-0.36, 0.36])
        this.box(0.07, 0.75, 0.65, x + dx, 0.38, z, C.metal);
      const seat = {
        x: INTERIOR_BASE.x + x,
        y: this.current * this.FH + 0.15,
        z: INTERIOR_BASE.z + z,
        rot,
        groundY: this.current * this.FH,
        standOffset: 1.15,
        building28: true,
      };
      this.action(
        name,
        x + Math.sin(rot) * 1.1,
        z + Math.cos(rot) * 1.1,
        "seat",
        { seat, range: 1.5 },
      );
    }
    bench(x, z, rot = 0, count = 3) {
      for (let i = 0; i < count; i++)
        this.seat(
          x + (i - (count - 1) / 2) * 1.1,
          z,
          rot,
          "Скамья — сесть",
          C.green,
        );
    }
    desk(x, z, w = 3) {
      this.box(w, 0.15, 1.4, x, 1.2, z, C.wood, true);
      this.box(0.15, 1.15, 1.25, x - w / 2 + 0.15, 0.57, z, C.dark);
      this.box(0.15, 1.15, 1.25, x + w / 2 - 0.15, 0.57, z, C.dark);
      this.box(w - 0.3, 0.75, 0.12, x, 0.8, z - 0.5, C.wood);
      this.box(0.9, 0.55, 0.07, x + 0.4, 1.65, z - 0.2, C.dark);
      this.box(0.07, 0.25, 0.07, x + 0.4, 1.35, z - 0.2, C.metal);
      this.box(0.8, 0.04, 0.3, x + 0.4, 1.3, z + 0.3, C.metal);
      this.box(0.55, 0.035, 0.4, x - 0.65, 1.3, z + 0.15, 0xe7e0d0);
    }
    staffMember(
      name,
      x,
      z,
      role = "talk",
      text = "Добро пожаловать.",
      rot = 0,
    ) {
      const appearance = {
        skinColor: 0xf1c6a2,
        shirtColor: [0x385d80, 0x546850, 0x7b4357][this.staff.length % 3],
        pantsColor: 0x263140,
        hairColor: 0x543d2f,
        hairStyle: this.staff.length % 3,
      };
      const g = FZNativeCharacter(appearance, false);
      FZOpeningAvatar.refine(g, this.staff.length, appearance);
      g.position.set(x, 0, z);
      g.rotation.y = rot;
      g.name = "staff28_" + name;
      this.groups[this.current].add(g);
      this.staff.push(g);
      this.sign(name, x, 3.5, z, 3.6, 0.45, rot);
      this.action(name, x + Math.sin(rot) * 2, z + Math.cos(rot) * 2, role, {
        text,
      });
      return g;
    }
    plant(x, z) {
      this.cyl(0.42, 0.65, x, 0.325, z, 0x8d674a);
      this.box(0.1, 1.5, 0.1, x, 1.2, z, C.wood);
      for (let i = 0; i < 4; i++)
        this.box(
          0.8,
          0.22,
          0.65,
          x + (i % 2 ? 0.2 : -0.2),
          1.3 + i * 0.22,
          z + (i % 2 ? 0.15 : -0.15),
          C.green,
          false,
          i * 0.7,
        );
    }
    bin(x, z, recycle = false) {
      this.cyl(0.36, 0.9, x, 0.45, z, recycle ? 0x427c70 : C.dark, true);
      this.cyl(0.38, 0.09, x, 0.94, z, C.metal);
      this.sign(recycle ? "БУМАГА" : "МУСОР", x, 0.65, z + 0.37, 0.65, 0.22);
      this.action(
        recycle ? "Сдать макулатуру" : "Выбросить упаковку",
        x,
        z + 1.2,
        "trash",
        { recycle, range: 1.5 },
      );
    }
    ceilingLamp(x, z) {
      this.box(3, 0.08, 0.65, x, this.FH - 0.14, z, 0xffe9b8);
    }
    bed(x, z) {
      this.box(3, 0.45, 4.4, x, 0.3, z, C.wood, true);
      this.box(2.9, 0.3, 4.1, x, 0.66, z, 0xe7e3d9);
      this.box(2.9, 0.12, 2.5, x, 0.86, z + 0.7, C.blue);
      this.box(2.8, 0.2, 0.8, x, 0.92, z - 1.5, 0xf4eedd);
      this.box(3, 1.45, 0.16, x, 0.8, z - 2.2, C.wood);
      this.action("Отдохнуть", x + 2, z, "rest");
      this.box(0.8, 0.75, 0.8, x + 2.2, 0.38, z - 1.4, C.wood, true);
      this.cyl(0.18, 0.4, x + 2.2, 1.05, z - 1.4, C.light);
    }
    kitchen(x, z) {
      for (let i = 0; i < 3; i++) {
        this.box(1.3, 1.1, 1.2, x + i * 1.35, 0.55, z, C.wood, true);
        this.box(1.32, 0.12, 1.3, x + i * 1.35, 1.16, z, 0xc6c6c0);
        this.box(1.3, 1, 0.6, x + i * 1.35, 2.75, z - 0.25, 0xb4c0c4);
        this.box(0.35, 0.05, 0.08, x + i * 1.35, 0.85, z + 0.63, C.metal);
      }
      this.box(0.9, 0.04, 0.8, x, 1.24, z, C.metal);
      this.box(0.08, 0.45, 0.08, x, 1.45, z - 0.3, C.metal);
      this.box(0.08, 0.08, 0.3, x, 1.65, z - 0.15, C.metal);
      for (const dx of [-0.28, 0.28])
        for (const dz of [-0.22, 0.22])
          this.cyl(0.17, 0.025, x + 1.35 + dx, 1.25, z + dz, C.dark);
      this.box(1.25, 2.8, 1.25, x + 4.4, 1.4, z, 0xdbe0e1, true);
      this.box(0.07, 0.7, 0.08, x + 4.9, 1.8, z + 0.67, C.metal);
      this.action("Кухня — приготовить чай", x + 1.3, z + 1.8, "tea");
      this.action("Холодильник — продукты", x + 4.4, z + 1.8, "cupboard");
    }
    bathroom(x, z) {
      this.box(2, 0.7, 2, x, 0.35, z, 0xe5e8e8, true);
      this.box(1.65, 0.05, 1.65, x, 0.73, z, 0x7fa4b8);
      this.box(0.08, 2.6, 0.08, x - 0.85, 1.3, z - 0.8, C.metal);
      this.box(0.4, 0.06, 0.4, x - 0.7, 2.6, z - 0.7, C.metal);
      this.cyl(0.48, 0.65, x + 3, 0.34, z, 0xf0efeb, true);
      this.box(0.95, 1, 0.45, x + 3, 0.8, z - 0.5, 0xf0efeb);
      this.box(1.2, 0.25, 0.8, x + 5, 1.1, z, 0xe5e8e8, true);
      this.box(0.7, 1.3, 0.05, x + 5, 2.2, z - 0.4, C.glass);
      this.action("Ванная — умыться", x + 5, z + 1.4, "wash");
    }
    bookcase(x, z) {
      this.box(3, 3, 0.5, x, 1.5, z, C.wood, true);
      for (let row = 0; row < 4; row++)
        for (let i = 0; i < 8; i++)
          this.box(
            0.24,
            0.48 + (i % 3) * 0.09,
            0.35,
            x - 1.2 + i * 0.34,
            0.4 + row * 0.7,
            z + 0.3,
            [C.red, C.blue, C.green, 0xccac73][(i + row) % 4],
          );
      this.action("Книжный шкаф", x, z + 1.5, "books");
    }
    sofa(x, z) {
      for (let i = -1; i <= 1; i++)
        this.seat(x + i * 1.05, z, 0, "Диван — сесть", 0x59716e);
      this.box(3.8, 0.8, 0.15, x, 1.1, z - 0.45, 0x59716e);
    }
    television(x, z) {
      this.box(3.5, 1.9, 0.18, x, 2, z, C.dark, true);
      this.box(3.2, 1.65, 0.03, x, 2, z + 0.11, C.blue);
      this.sign("FANTAZIA · ГОРОДСКОЙ КАНАЛ", x, 2, z + 0.14, 3, 0.5);
      this.action("Телевизор — новости", x, z + 2, "news");
    }
    wardrobe(x, z) {
      this.box(3, 3.5, 1, x, 1.75, z, C.wood, true);
      this.box(0.04, 3.3, 0.05, x, 1.7, z + 0.52, C.dark);
      for (const dx of [-0.15, 0.15])
        this.box(0.05, 0.5, 0.06, x + dx, 1.6, z + 0.55, C.metal);
      this.action("Шкаф — хранение", x, z + 1.8, "storage");
    }
    apartment(side, number) {
      const x = side < 0 ? -14 : 14;
      this.wallX(side * 4, -8, 30, [-5, 2.8]);
      this.door(side * 4, -5, "x", "КВАРТИРА " + number, false);
      this.wallZ(x, -11, 20, [x, 2.8]);
      this.door(x, -11, "z", "Спальня " + number, true);
      this.wallX(x + 3, -17, 12, [-16, 2.8]);
      this.door(x + 3, -16, "x", "Санузел", true);
      this.bed(x - 4, -18);
      this.bathroom(x + 4, -20);
      this.kitchen(x - 6, 5);
      this.sofa(x - 3, -7);
      this.television(x - 3, -10.75);
      this.wardrobe(x + 7, -7);
      this.bookcase(x - 7, -10.65);
      this.box(3, 0.15, 1.6, x + 2, 1.2, 1, C.wood, true);
      this.seat(x + 2, 3, Math.PI, "Обеденный стул");
      this.plant(x + 8, 5);
      this.ceilingLamp(x, -4);
      this.ceilingLamp(x, -17);
    }
    finish() {
      for (const b of this.batches.values()) {
        const mesh = new THREE.InstancedMesh(b.geo, b.mat, b.items.length);
        b.items.forEach((m, i) => mesh.setMatrixAt(i, m));
        mesh.instanceMatrix.needsUpdate = true;
        mesh.frustumCulled = false;
        this.groups[b.floor].add(mesh);
      }
      this.batches.clear();
      this.root.traverse((o) => {
        if (o.geometry) this.resources.add(o.geometry);
        if (o.skeleton?.boneTexture) this.resources.add(o.skeleton.boneTexture);
        for (const m of o.material
          ? Array.isArray(o.material)
            ? o.material
            : [o.material]
          : []) {
          this.resources.add(m);
          for (const t of Object.values(m))
            if (t?.isTexture) this.resources.add(t);
        }
      });
      return this;
    }
    dispose() {
      this.root.traverse((o) => {
        if (o.skeleton?.boneTexture) this.resources.add(o.skeleton.boneTexture);
      });
      this.root.parent?.remove(this.root);
      this.resources.forEach((r) => r.dispose?.());
      this.resources.clear();
    }
  }
  window.FZBuildingKit = { Kit, C };
})();
