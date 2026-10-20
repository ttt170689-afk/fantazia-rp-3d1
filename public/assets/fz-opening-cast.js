/* Staged residents made with the game's native spawnNPC factory, in the live scene.
 * Only these temporary residents/hand props are owned here. No buildings or streets.
 * No networking, quest hooks, police updates, currency or saved data are touched. */
(function () {
  "use strict";
  function create(anchors) {
    const root = new THREE.Group();
    root.name = "fz_opening_cast";
    root.userData.openingOnly = true;
    scene.add(root);
    const actors = [],
      geos = new Set(),
      mats = new Set(),
      textures = new Set();
    let disposed = false;
    const s = anchors.square,
      b = anchors.bench,
      e = anchors.entrance;
    function box(parent, color, size, pos) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(...size),
        new THREE.MeshLambertMaterial({ color }),
      );
      mesh.position.set(...pos);
      parent.add(mesh);
      return mesh;
    }
    function free(x, z) {
      return !checkCollision(x, z);
    }
    function spot(x, z) {
      for (const r of [0, 1.5, 3, 5])
        for (let i = 0; i < 8; i++) {
          const p = {
            x: x + Math.cos((i * Math.PI) / 4) * r,
            z: z + Math.sin((i * Math.PI) / 4) * r,
          };
          if (free(p.x, p.z)) return p;
        }
      return { x: s.x, z: s.z };
    }
    function person(id, x, z, color, role = "shopper") {
      const count = npcs.length;
      spawnNPC(x, 0, z, role);
      const npc = npcs.pop();
      if (npcs.length !== count || !npc?.mesh)
        throw Error("Native NPC factory contract changed");
      const g = npc.mesh;
      root.add(g);
      g.name = "opening_" + id;
      g.children.filter((o) => o.isSprite).forEach((o) => (o.visible = false));
      g.userData.body.material.color.setHex(color);
      const a = { id, g, parts: g.userData, home: { x, z } };
      actors.push(a);
      return a;
    }
    function idle(a, t) {
      const u = a.parts;
      u.body.position.y = 1.3 + Math.sin(t * 1.5) * 0.012;
      u.head.rotation.set(0, Math.sin(t * 0.8) * 0.035, 0);
      u.leftArm.rotation.set(0, 0, 0.03);
      u.rightArm.rotation.set(0, 0, -0.03);
      u.leftLeg.rotation.set(0, 0, 0);
      u.rightLeg.rotation.set(0, 0, 0);
    }
    function walk(a, t, strength = 1) {
      const q = Math.sin(t * 7) * 0.48 * strength,
        u = a.parts;
      u.leftLeg.rotation.x = q;
      u.rightLeg.rotation.x = -q;
      u.leftArm.rotation.x = -q * 0.7;
      u.rightArm.rotation.x = q * 0.7;
      u.body.position.y = 1.3 + Math.abs(Math.cos(t * 7)) * 0.025 * strength;
    }
    function move(a, x, z) {
      if (free(x, z)) a.g.position.set(x, 0, z);
    }
    function route(a, t, from, to, period) {
      const phase = (t % period) / period,
        forward = phase < 0.5,
        p = forward ? phase * 2 : 2 - phase * 2;
      const x = from.x + (to.x - from.x) * p,
        z = from.z + (to.z - from.z) * p;
      move(a, x, z);
      a.g.rotation.y =
        Math.atan2(to.x - from.x, to.z - from.z) + (forward ? 0 : Math.PI);
      walk(a, t);
    }
    function collect() {
      root.traverse((o) => {
        if (o.geometry) geos.add(o.geometry);
        for (const m of o.material
          ? Array.isArray(o.material)
            ? o.material
            : [o.material]
          : []) {
          mats.add(m);
          for (const value of Object.values(m))
            if (value?.isTexture) textures.add(value);
        }
      });
    }
    function dispose() {
      if (disposed) return;
      disposed = true;
      collect();
      root.parent?.remove(root);
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      actors.length = 0;
    }
    try {
      // The original benches are looked up in sitSpots. We do not build a second square.
      const courier = person("courier", s.x - 5, s.z + 2, 0x668da3),
        receiver = person("receiver", s.x + 5, s.z + 2, 0xb28259);
      receiver.g.rotation.y = -Math.PI / 2;
      const parcel = box(
        root,
        0xad8153,
        [0.68, 0.5, 0.5],
        [s.x - 4.4, 1.2, s.z + 2],
      );
      box(parcel, 0xe1c799, [0.13, 0.51, 0.51], [0, 0, 0]);
      const reader = person("reader", b.x, b.z, 0x7c739a);
      reader.g.position.y = b.y - 0.9;
      reader.g.rotation.y = b.rot;
      const book = box(reader.g, 0x405b73, [0.52, 0.055, 0.35], [0, 1.12, 0.5]);
      box(book, 0xf0e5cb, [0.48, 0.018, 0.32], [0, 0.035, 0]);
      const page = box(book, 0xe8dfcc, [0.24, 0.006, 0.3], [0.12, 0.055, 0]);
      const f1 = spot(s.x - 2, s.z - 3),
        f2 = spot(f1.x + 1.5, f1.z + 0.15);
      const friend = person("conversation", f1.x, f1.z, 0x8e574d),
        listener = person("coffee", f2.x, f2.z, 0x668064);
      friend.g.rotation.y = Math.atan2(f2.x - f1.x, f2.z - f1.z);
      listener.g.rotation.y = friend.g.rotation.y + Math.PI;
      const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.105, 0.075, 0.23, 10),
        new THREE.MeshLambertMaterial({ color: 0xeee1c6 }),
      );
      listener.g.add(cup);
      const c = spot(s.x + 8, s.z - 5),
        cleaner = person("sweeper", c.x, c.z, 0xbca047);
      const broom = new THREE.Group();
      cleaner.g.add(broom);
      broom.position.set(0.65, 0.15, 0.5);
      box(broom, 0x927146, [0.045, 1.5, 0.045], [0, 0.75, 0]);
      box(broom, 0x5c6754, [0.55, 0.12, 0.18], [0, 0.03, 0]);
      const m1 = spot(e.x - 5, e.z + 6),
        m2 = spot(e.x + 5, e.z + 6);
      const shopper = person("shopping", m1.x, m1.z, 0x916657),
        phone = person("phone", m2.x, m2.z, 0x485f88);
      const bag = box(
        shopper.g,
        0xba9b6a,
        [0.35, 0.48, 0.22],
        [0.66, 0.6, 0.1],
      );
      const mobile = box(
        phone.g,
        0x26333e,
        [0.14, 0.24, 0.035],
        [-0.38, 1.55, 0.43],
      );
      box(mobile, 0x8bb7c8, [0.115, 0.19, 0.01], [0, 0, 0.024]);
      collect();
      function update(t, reduced = false) {
        if (disposed) return;
        const time = reduced ? 6 : t;
        for (const a of actors) idle(a, time);
        // Timed hand-over: approach -> slow down -> offer -> recipient keeps parcel.
        const u = Math.max(0, Math.min(1, (time - 5.4) / 4.2));
        move(courier, s.x - 5 + u * 8.4, s.z + 2);
        courier.g.rotation.y = Math.PI / 2;
        if (u < 1) walk(courier, time, Math.min(1, (1 - u) * 8));
        courier.parts.leftArm.rotation.x = courier.parts.rightArm.rotation.x =
          -0.85;
        const hand = FZOpeningPlan.smooth((time - 9.6) / 1.2);
        parcel.position.set(
          (courier.g.position.x + 0.65) * (1 - hand) +
            (receiver.g.position.x - 0.6) * hand,
          1.2 + Math.sin(hand * Math.PI) * 0.08,
          s.z + 2,
        );
        receiver.parts.leftArm.rotation.x = receiver.parts.rightArm.rotation.x =
          -hand * 0.85;
        if (hand === 1) {
          courier.parts.rightArm.rotation.z = -0.55 - Math.sin(time * 4) * 0.12;
          courier.parts.rightArm.rotation.x = -1;
        }
        reader.parts.leftLeg.rotation.x = reader.parts.rightLeg.rotation.x =
          -1.35;
        reader.parts.leftArm.rotation.x = reader.parts.rightArm.rotation.x =
          -0.85;
        reader.parts.head.rotation.x = 0.18;
        page.rotation.z = Math.sin(time * 0.7) * 0.15;
        friend.parts.rightArm.rotation.x =
          -0.35 - Math.max(0, Math.sin(time * 1.6)) * 0.5;
        friend.parts.head.rotation.y = Math.sin(time * 1.2) * 0.12;
        const sip = Math.max(0, Math.sin(time * 0.65));
        listener.parts.leftArm.rotation.x = -0.8 - sip * 0.35;
        cup.position.set(-0.36, 1.45 + sip * 0.42, 0.4);
        cup.rotation.x = -sip * 0.25;
        listener.parts.head.rotation.x = Math.sin(time * 1.8) * 0.045;
        cleaner.parts.leftArm.rotation.x = -0.6;
        cleaner.parts.rightArm.rotation.x = -0.8;
        broom.rotation.z = Math.sin(time * 2.3) * 0.22;
        cleaner.parts.body.rotation.z = Math.sin(time * 2.3) * 0.035;
        route(shopper, time, m1, { x: m1.x + 3, z: m1.z }, 14);
        bag.rotation.z = Math.sin(time * 7) * 0.08;
        phone.parts.leftArm.rotation.x = -1.1;
        phone.parts.head.rotation.x = 0.2;
        phone.parts.rightArm.rotation.x = -0.7 - Math.sin(time * 3) * 0.04;
      }
      return {
        root,
        update,
        dispose,
        info: () =>
          actors.map((a) => ({
            id: a.id,
            position: a.g.position.toArray(),
            source: "spawnNPC",
            uuid: a.g.uuid,
          })),
      };
    } catch (error) {
      dispose();
      throw error;
    }
  }
  window.FZOpeningCast = { create };
})();
