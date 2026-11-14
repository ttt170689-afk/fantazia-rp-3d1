/* Owned expedition sets: no global scene edits or private animation loop. */
(function () {
  "use strict";
  const P = FZExpedition52Policy;
  function build(id) {
    const map = P.map(id),
      owned = new Set(),
      world = new THREE.Scene(),
      vehicles = [],
      relays = [],
      notes = [],
      monsters = new Map();
    world.name = "Expedition52 / " + id;
    world.background = new THREE.Color(map.color);
    world.fog = new THREE.Fog(map.color, 36, 110);
    const own = (x) => (owned.add(x), x),
      mat = (c, extra = {}) =>
        own(
          new THREE.MeshStandardMaterial({
            color: c,
            roughness: 0.8,
            ...extra,
          }),
        );
    const cube = own(new THREE.BoxGeometry(1, 1, 1)),
      sphere = own(new THREE.SphereGeometry(1, 16, 10)),
      cylinder = own(new THREE.CylinderGeometry(1, 1, 1, 12));
    // Deterministic local surface maps: no CDN, random flicker or downloaded textures.
    function surface(kind) {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 256;
      const c = cv.getContext("2d");
      let seed = kind === "wall" ? 52 : 152;
      const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      c.fillStyle = kind === "wall" ? "#999b96" : "#747c73";
      c.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 5000; i++) {
        const v = Math.floor(70 + random() * 100);
        c.fillStyle = `rgba(${v},${v},${v},.3)`;
        c.fillRect(
          random() * 256,
          random() * 256,
          random() * 3 + 1,
          random() * 2 + 1,
        );
      }
      c.lineWidth = 1;
      c.strokeStyle = "#353b3855";
      for (let i = 0; i < 16; i++) {
        let x = random() * 256,
          y = random() * 256;
        c.beginPath();
        c.moveTo(x, y);
        for (let j = 0; j < 6; j++) {
          x += (random() - 0.5) * 16;
          y += random() * 12;
          c.lineTo(x, y);
        }
        c.stroke();
      }
      if (kind === "wall") {
        for (let y = 0; y < 256; y += 64) {
          c.fillStyle = "#444b4655";
          c.fillRect(0, y, 256, 2);
          c.fillRect(y % 128 ? 64 : 180, y, 2, 64);
        }
        for (let i = 0; i < 10; i++) {
          const x = random() * 256,
            w = random() * 15 + 2;
          const gr = c.createLinearGradient(0, 0, 0, 240);
          gr.addColorStop(0, "#2a302f70");
          gr.addColorStop(1, "#2a302f00");
          c.fillStyle = gr;
          c.fillRect(x, 0, w, 240);
        }
      }
      const t = own(new THREE.CanvasTexture(cv));
      t.encoding = THREE.sRGBEncoding;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(kind === "wall" ? 2 : 12, kind === "wall" ? 2 : 12);
      t.anisotropy = 4;
      return t;
    }
    const concrete = mat(0x8a9290, { map: surface("wall") }),
      metal = mat(0x26313b, { metalness: 0.4 }),
      rust = mat(0x694f3e),
      glass = mat(0x334d59, { metalness: 0.4, roughness: 0.2 }),
      light = mat(map.accent, { emissive: map.accent, emissiveIntensity: 0.6 }),
      black = mat(0x11151c),
      paper = mat(0xc7bba0);
    function mesh(parent, g, m, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
      const o = new THREE.Mesh(g, m);
      o.position.set(x, y, z);
      o.scale.set(sx, sy, sz);
      o.castShadow = true;
      o.receiveShadow = true;
      parent.add(o);
      return o;
    }
    const box = (p, w, h, d, x, y, z, m) => mesh(p, cube, m, x, y, z, w, h, d);
    function label(parent, text, x, y, z, w = 5) {
      const cv = document.createElement("canvas");
      cv.width = 512;
      cv.height = 128;
      const ctx = cv.getContext("2d");
      ctx.fillStyle = "#111a24";
      ctx.fillRect(0, 0, 512, 128);
      ctx.fillStyle = "#e4e8e7";
      ctx.font = "bold 28px Arial";
      ctx.textAlign = "center";
      ctx.fillText(text, 256, 75, 480);
      const t = own(new THREE.CanvasTexture(cv));
      t.encoding = THREE.sRGBEncoding;
      const m = own(
        new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }),
      );
      return box(parent, w, w / 4, 0.04, x, y, z, m);
    }
    const ground = mat(id === "quarry" ? 0x455346 : 0x5b625f, {
      map: surface("ground"),
    });
    box(world, 82, 0.5, 82, 0, -0.3, 0, ground);
    // Roads are deliberately clear all around the perimeter; collision is shared.
    const road = mat(0x1d242b),
      paint = mat(0xada489);
    for (const x of [-32, 32]) box(world, 10, 0.03, 74, x, -0.025, 0, road);
    for (const z of [-32, 32]) box(world, 74, 0.035, 10, 0, -0.02, z, road);
    for (let i = -28; i <= 28; i += 7)
      for (const side of [-1, 1]) {
        box(world, 0.12, 0.02, 2.4, side * 32, 0.01, i, paint);
        box(world, 2.4, 0.02, 0.12, i, 0.01, side * 32, paint);
      }
    // Perimeter with light posts, visible boundary and fenced vista silhouettes.
    for (const s of [-1, 1]) {
      box(world, 80, 1.1, 0.3, 0, 0.55, s * 39.3, metal);
      box(world, 0.3, 1.1, 80, s * 39.3, 0.55, 0, metal);
    }
    for (let i = 0; i < 12; i++) {
      // Offset posts from the spawn/respawn camera axes.
      const a = (i * Math.PI) / 6 + 0.13,
        radius = 38 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))),
        x = Math.cos(a) * radius,
        z = Math.sin(a) * radius;
      box(world, 0.15, 5, 0.15, x, 2.5, z, metal);
      box(world, 0.65, 0.16, 0.4, x, 5, z, light);
    }
    world.add(new THREE.HemisphereLight(0xc7d9e8, 0x424139, 0.65));
    const moon = new THREE.DirectionalLight(0xd9e5ef, 0.85);
    moon.position.set(-20, 35, 12);
    world.add(moon);
    // Shared collider footprints also define the visible abandoned architecture.
    map.blocks.forEach(([x, z, w, d], i) => {
      const h = w < 6 ? 2.1 : 4.5 + (i % 2) * 1.2;
      if (id === "quarry" && w > 10) {
        const water = mat(0x25464d, { metalness: 0.5, roughness: 0.18 });
        box(world, w, 0.2, d, x, 0.03, z, water);
        for (const s of [-1, 1]) {
          box(world, 0.4, 1.3, d, x + (s * w) / 2, 0.65, z, concrete);
          box(world, w, 1.3, 0.4, x, 0.65, z + (s * d) / 2, concrete);
        }
        for (let k = 0; k < 4; k++)
          box(
            world,
            w * 0.7,
            0.05,
            0.09,
            x,
            0.18,
            z - d * 0.3 + k * d * 0.18,
            glass,
          );
      } else {
        box(world, w, h, d, x, h / 2, z, concrete);
        box(world, w + 0.3, 0.2, d + 0.3, x, h, z, metal);
        for (let k = 0; k < Math.floor(w / 2); k++) {
          const wx = x - w / 2 + 1 + k * 2;
          box(
            world,
            1.1,
            1.2,
            0.06,
            wx,
            h * 0.62,
            z + d / 2 + 0.04,
            k % 3 === 0 ? black : glass,
          );
          box(world, 0.08, 1.2, 0.1, wx, h * 0.62, z + d / 2 + 0.07, rust);
        }
        if (w > 7) {
          label(
            world,
            i === 0
              ? "СЛУЖЕБНЫЙ КОРПУС"
              : id === "observatory"
                ? "АРХИВ ЧАСТОТ"
                : "ПРОХОД ЗАКРЫТ",
            x,
            1.4,
            z + d / 2 + 0.09,
            Math.min(w - 1, 7),
          );
          for (let k = 0; k < 3; k++) {
            const b = box(
              world,
              w * 0.8,
              0.14,
              0.2,
              x,
              h + 0.25 + k * 0.2,
              z + (k - 1) * d * 0.25,
              rust,
            );
            b.rotation.z = (k - 1) * 0.09;
          }
        }
      }
    });
    if (id === "depot") {
      for (const x of [-9, 10]) {
        box(world, 0.09, 0.08, 56, x, 0.08, 0, metal);
        for (let z = -26; z <= 26; z += 2)
          box(world, 2, 0.1, 0.18, x, 0.03, z, rust);
      }
      for (const x of [-20, 20]) {
        for (let k = 0; k < 6; k++) {
          box(world, 1.3, 0.7, 0.08, x - 4.5 + k * 1.8, 2.4, -11.92, black);
          box(world, 1.2, 0.12, 0.08, x - 4.5 + k * 1.8, 1.8, -11.9, rust);
        }
        const roof = box(world, 12, 0.15, 10, x, 6, -16, metal);
        roof.rotation.z = x < 0 ? 0.09 : -0.12;
      }
    } else if (id === "observatory") {
      const dome = own(
        new THREE.SphereGeometry(5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      );
      mesh(world, dome, metal, -18, 5, -16);
      for (const x of [-30, 30]) {
        box(world, 0.3, 11, 0.3, x, 5.5, 20, metal);
        const dish = mesh(
          world,
          own(
            new THREE.SphereGeometry(
              2,
              16,
              8,
              0,
              Math.PI * 2,
              0,
              Math.PI * 0.35,
            ),
          ),
          glass,
          x,
          10.5,
          20,
        );
        dish.rotation.z = 0.7;
      }
    } else
      for (const z of [-16, 15]) {
        box(world, 5, 1.2, 1, 19, 1.1, z, rust);
        for (const x of [17, 21])
          mesh(world, cylinder, metal, x, 1.1, z, 0.6, 2, 0.6).rotation.z =
            Math.PI / 2;
      }
    // Fog silhouettes do not introduce invisible colliders into the playable area.
    for (let i = 0; i < 18; i++) {
      const a = i * 2.399,
        x = Math.cos(a) * 52,
        z = Math.sin(a) * 52,
        h = 8 + (i % 6);
      box(world, 2, h, 2, x, h / 2, z, metal);
      if (id !== "observatory") mesh(world, sphere, ground, x, h, z, 3, 4, 3);
    }
    // Only immutable, body-level scenery is batched. Interactive parts, actors,
    // vehicles and mission markers retain their independent visibility/transforms.
    const batches = new Map();
    for (const o of world.children.filter((o) => o.isMesh)) {
      const key = o.geometry.uuid + "/" + o.material.uuid;
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key).push(o);
    }
    for (const group of batches.values()) {
      if (group.length < 2) continue;
      const inst = own(
        new THREE.InstancedMesh(
          group[0].geometry,
          group[0].material,
          group.length,
        ),
      );
      inst.frustumCulled = false;
      inst.receiveShadow = true;
      group.forEach((o, i) => {
        o.updateMatrix();
        inst.setMatrixAt(i, o.matrix);
        world.remove(o);
      });
      world.add(inst);
    }
    const ringGeo = own(new THREE.TorusGeometry(1, 0.045, 6, 32));
    const extraction = mesh(world, ringGeo, light, 0, 0.08, 32, 2.6, 2.6, 2.6);
    extraction.rotation.x = Math.PI / 2;
    // Keep the start camera lane clear, especially in portrait view.
    label(world, "ЭВАКУАЦИЯ / СТАРТ", 8, 2.6, 38, 6);
    map.relays.forEach(([x, z], i) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      world.add(g);
      box(g, 1.1, 1.9, 0.65, 0, 0.95, 0, metal);
      const lamp = box(
        g,
        0.7,
        0.18,
        0.04,
        0,
        1.5,
        0.35,
        mat(0x9e4b3e, { emissive: 0x9e4b3e, emissiveIntensity: 0.5 }),
      );
      for (let k = 0; k < 3; k++)
        box(g, 0.12, 0.35, 0.06, -0.24 + k * 0.24, 0.8, 0.36, paper);
      label(g, "РЕЛЕ " + (i + 1), 0, 2.35, 0, 2.7);
      relays.push({ g, lamp });
    });
    P.notes
      .filter((n) => n.map === id)
      .forEach((n) => {
        const g = new THREE.Group();
        g.position.set(n.x, 0, n.z);
        world.add(g);
        box(g, 1.2, 0.12, 0.8, 0, 0.85, 0, rust);
        for (const x of [-0.45, 0.45])
          box(g, 0.08, 0.85, 0.6, x, 0.42, 0, metal);
        box(g, 0.43, 0.02, 0.55, 0, 0.93, 0, paper);
        label(g, "ЗАПИСЬ", 0, 1.8, 0, 1.7);
        notes.push({ id: n.id, g });
      });
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = shadowCanvas.height = 64;
    const sc = shadowCanvas.getContext("2d"),
      gradient = sc.createRadialGradient(32, 32, 4, 32, 32, 32);
    gradient.addColorStop(0, "#000a");
    gradient.addColorStop(1, "#0000");
    sc.fillStyle = gradient;
    sc.fillRect(0, 0, 64, 64);
    const shadow = own(
        new THREE.MeshBasicMaterial({
          map: own(new THREE.CanvasTexture(shadowCanvas)),
          transparent: true,
          depthWrite: false,
        }),
      ),
      plane = own(new THREE.PlaneGeometry(1, 1));
    function vehicle(type, index) {
      const c = P.car(type),
        g = new THREE.Group(),
        wheels = [],
        doors = [];
      g.name = "Vehicle52 / " + type;
      g.position.set(-9 - index * 7, 0, 32);
      world.add(g);
      mesh(g, plane, shadow, 0, 0.04, 0, 3.6, 5.6, 1).rotation.x = -Math.PI / 2;
      const body = mat(c.color, { metalness: 0.48, roughness: 0.3 });
      const shape = new THREE.Shape();
      shape.moveTo(-0.85, -1.9);
      shape.lineTo(0.85, -1.9);
      shape.quadraticCurveTo(1.05, -1.6, 1, 1.55);
      shape.quadraticCurveTo(0.85, 2.05, 0, 2.1);
      shape.quadraticCurveTo(-0.85, 2.05, -1, 1.55);
      shape.lineTo(-1, -1.6);
      shape.closePath();
      const geo = own(
        new THREE.ExtrudeGeometry(shape, {
          depth: 0.5,
          bevelEnabled: true,
          bevelSize: 0.1,
          bevelThickness: 0.08,
          bevelSegments: 2,
          steps: 1,
        }),
      );
      geo.rotateX(-Math.PI / 2);
      mesh(g, geo, body, 0, 0.55, 0);
      box(g, 1.5, 0.68, 1.6, 0, 1.25, -0.15, glass);
      box(g, 1.6, 0.12, 1.7, 0, 1.65, -0.15, body);
      box(g, 1.85, 0.2, 0.3, 0, 0.5, 2, metal);
      for (const side of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(side * 0.97, 0.9, 0.65);
        g.add(pivot);
        box(pivot, 0.08, 0.65, 1.45, 0, 0.08, -0.7, body);
        doors.push(pivot);
        for (const z of [-1.25, 1.25]) {
          const w = new THREE.Group();
          w.position.set(side * 0.99, 0.42, z);
          g.add(w);
          mesh(w, cylinder, black, 0, 0, 0, 0.37, 0.24, 0.37).rotation.z =
            Math.PI / 2;
          mesh(
            w,
            cylinder,
            metal,
            side * 0.13,
            0,
            0,
            0.2,
            0.02,
            0.2,
          ).rotation.z = Math.PI / 2;
          wheels.push(w);
        }
        box(g, 0.35, 0.17, 0.08, side * 0.6, 0.89, 2.05, light);
        box(
          g,
          0.26,
          0.13,
          0.06,
          side * 0.65,
          0.85,
          -2,
          mat(0xa63836, { emissive: 0x6c1010 }),
        );
      }
      if (type === "rover") {
        box(g, 1.65, 0.18, 1.4, 0, 1.9, -0.1, metal);
        mesh(g, cylinder, black, 0, 1, -2.1, 0.43, 0.2, 0.43).rotation.x =
          Math.PI / 2;
      }
      if (type === "rally") box(g, 1.9, 0.12, 0.35, 0, 1.2, -1.7, metal);
      label(g, c.name, 0, 2.4, 0, 2.4);
      return {
        id: type,
        g,
        wheels,
        doors,
        x: g.position.x,
        z: g.position.z,
        yaw: Math.PI / 2,
        speed: 0,
        door: 0,
      };
    }
    P.cars.forEach((c, i) => vehicles.push(vehicle(c.id, i)));
    function monster(type) {
      const g = new THREE.Group(),
        legs = [],
        kind = P.monsters[type],
        skin = mat(
          type === "warden" ? 0x434c51 : type === "hound" ? 0x363e4c : 0x535a54,
        ),
        eye = mat(0x75d5c2, { emissive: 0x75d5c2, emissiveIntensity: 1.5 });
      const height = type === "warden" ? 2.5 : type === "listener" ? 2 : 0.9;
      mesh(
        g,
        sphere,
        skin,
        0,
        height * 0.65,
        0,
        type === "hound" ? 0.42 : 0.52,
        height * 0.45,
        type === "hound" ? 0.8 : 0.36,
      );
      const head = new THREE.Group();
      head.position.set(0, height, 0.25);
      g.add(head);
      mesh(head, sphere, skin, 0, 0, 0, 0.3, 0.3, 0.32);
      for (const s of [-1, 1]) {
        mesh(head, sphere, eye, s * 0.13, 0.03, 0.29, 0.065, 0.035, 0.04);
        for (let k = 0; k < (type === "hound" ? 2 : 1); k++) {
          const leg = new THREE.Group();
          leg.position.set(s * 0.4, height * 0.55, k ? -0.5 : 0.3);
          g.add(leg);
          mesh(
            leg,
            cylinder,
            skin,
            0,
            -height * 0.23,
            0,
            0.08,
            height * 0.5,
            0.08,
          );
          mesh(leg, sphere, metal, 0, -height * 0.48, 0.13, 0.11, 0.09, 0.25);
          legs.push(leg);
        }
      }
      if (type === "listener")
        for (let k = 0; k < 5; k++) {
          const horn = mesh(
            head,
            cylinder,
            skin,
            (k - 2) * 0.15,
            0.4,
            0,
            0.035,
            0.75,
            0.035,
          );
          horn.rotation.z = (k - 2) * -0.25;
        }
      if (type === "warden") {
        box(g, 1.4, 0.25, 0.6, 0, 1.8, 0, metal);
        mesh(g, ringGeo, eye, 0, 2.7, 0, 0.45, 0.45, 0.45).rotation.x =
          Math.PI / 2;
      }
      const warning = mesh(
        g,
        ringGeo,
        mat(0xe8b25e, { emissive: 0xe8b25e }),
        0,
        0.06,
        0,
        kind.range,
        kind.range,
        kind.range,
      );
      warning.rotation.x = Math.PI / 2;
      warning.visible = false;
      const hpBar = box(g, 0.8, 0.07, 0.08, 0, height + 0.7, 0, light);
      world.add(g);
      return { g, legs, head, warning, eye, hpBar };
    }
    map.mobs.forEach((v, i) => monsters.set(i, monster(v[2])));
    const checkpoints = map.checkpoints.map(([x, z], i) => {
      const g = mesh(world, ringGeo, light, x, 2.5, z, 3.7, 3.7, 3.7);
      g.name = "Checkpoint " + i;
      g.visible = false;
      return g;
    });
    const control = mesh(world, ringGeo, light, 0, 0.07, 0, 4.5, 4.5, 4.5);
    control.rotation.x = Math.PI / 2;
    control.visible = false;
    const beamGeometry = own(new THREE.BufferGeometry());
    beamGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 1], 3),
    );
    const beam = new THREE.Line(
      beamGeometry,
      own(
        new THREE.LineBasicMaterial({
          color: 0x9df4ef,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
          toneMapped: false,
        }),
      ),
    );
    beam.frustumCulled = false;
    beam.visible = false;
    world.add(beam);
    function dispose() {
      owned.forEach((r) => r.dispose?.());
      owned.clear();
      world.clear();
    }
    return {
      world,
      owned,
      vehicles,
      relays,
      notes,
      monsters,
      checkpoints,
      control,
      beam,
      dispose,
    };
  }
  function actor() {
    const root = new THREE.Group(),
      source = window.SuperRig?.src;
    let model,
      mixer,
      actions = {},
      current = "",
      fallback = false;
    if (source && THREE.SkeletonUtils) {
      model = THREE.SkeletonUtils.clone(source.scene);
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model),
        size = bounds.getSize(new THREE.Vector3());
      model.scale.multiplyScalar(1.78 / Math.max(0.1, size.y));
      model.position.y = -bounds.min.y * model.scale.y;
      root.add(model);
      mixer = new THREE.AnimationMixer(model);
      for (const clip of source.animations)
        actions[clip.name] = mixer.clipAction(clip);
    } else {
      fallback = true;
      model = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.22, 1.5, 10),
        new THREE.MeshStandardMaterial({ color: 0x728a99 }),
      );
      model.position.y = 0.8;
      root.add(model);
    }
    const names = {
      idle: "ANIM_Idle_Loop",
      walk: "ANIM_Walk_Loop",
      run: "ANIM_Run_Loop",
      attack: "ANIM_Point",
      down: "ANIM_Defeat",
      win: "ANIM_Victory",
    };
    return {
      root,
      update(dt, pose) {
        const name = names[pose] || names.idle;
        if (name !== current && actions[name]) {
          if (actions[current]) actions[current].fadeOut(0.15);
          const a = actions[name];
          a.reset().setLoop(
            ["attack", "down", "win"].includes(pose)
              ? THREE.LoopOnce
              : THREE.LoopRepeat,
            Infinity,
          );
          a.clampWhenFinished = true;
          a.fadeIn(0.15).play();
          current = name;
        }
        mixer?.update(dt);
      },
      info: () => ({ clip: current, fallback, clips: Object.keys(actions) }),
      dispose() {
        mixer?.stopAllAction();
        mixer?.uncacheRoot(model);
        root.traverse((o) => {
          if (o.isSkinnedMesh) o.skeleton.dispose();
        });
        if (fallback) {
          model.geometry.dispose();
          model.material.dispose();
        }
        root.parent?.remove(root);
      },
    };
  }
  function animate(set, state, t, dt, reduced = false) {
    for (const e of state?.mobs || []) {
      const v = set.monsters.get(e.id);
      v.g.position.set(e.x, 0, e.z);
      v.g.rotation.set(0, e.yaw, e.hp <= 0 ? Math.PI / 2 : 0);
      v.g.scale.y = e.hp <= 0 ? 0.35 : 1;
      v.warning.visible = e.state === "windup";
      v.hpBar.scale.x = 0.8 * Math.max(0, e.hp / P.monsters[e.type].hp);
      v.eye.emissive.setHex(
        e.state === "windup"
          ? 0xffb44c
          : e.state === "stunned"
            ? 0x80baff
            : 0x75d5c2,
      );
      const moving = ["patrol", "chase"].includes(e.state);
      v.legs.forEach(
        (l, i) =>
          (l.rotation.x =
            !reduced && moving ? Math.sin(t * 7 + i * Math.PI) * 0.45 : 0),
      );
      v.head.rotation.z = !reduced ? Math.sin(t * 1.5 + e.id) * 0.07 : 0;
    }
    for (const v of set.vehicles) {
      v.g.position.set(v.x, 0, v.z);
      v.g.rotation.y = v.yaw;
      v.wheels.forEach((w) => (w.rotation.x += (v.speed * dt) / 0.37));
      v.doors.forEach((door, i) => (door.rotation.y = (i ? -1 : 1) * v.door));
    }
    for (let i = 0; i < set.relays.length; i++)
      if (state?.relays.includes(i)) {
        set.relays[i].lamp.material.color.setHex(0x6ee1c5);
        set.relays[i].lamp.material.emissive.setHex(0x3abfa0);
      }
  }
  window.FZExpedition52World = { build, actor, animate };
})();
