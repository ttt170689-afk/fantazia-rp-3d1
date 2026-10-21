/* v17: native articulated avatars, two-bone arm reach, timed acting and owned props.
 * Same createCharacter factory as the game, captured before optional SuperRig hooks.
 * No NPC registry edits, network, story/economy writes, or borrowed player resources. */
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
      e = anchors.entrance,
      P = FZOpeningPlan;
    const clamp = (x) => Math.max(0, Math.min(1, x)),
      smooth = P.smooth;
    const skins = [
      0xe4bc98, 0xb48162, 0xe1b799, 0x9c6b4d, 0xe6c9ad, 0xc39473, 0xc6a17f,
      0xdcb497,
    ];
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = shadowCanvas.height = 64;
    const ctx = shadowCanvas.getContext("2d"),
      gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(0,0,0,.48)");
    gradient.addColorStop(0.45, "rgba(0,0,0,.24)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas),
      shadowMaterial = new THREE.MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      });
    textures.add(shadowTexture);
    mats.add(shadowMaterial);
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
      return { ...s };
    }
    function person(id, x, z, color) {
      const index = actors.length,
        g = FZNativeCharacter(
          {
            skinColor: skins[index % skins.length],
            shirtColor: color,
            pantsColor: [0x303c4d, 0x49473f, 0x334d54][index % 3],
            hairColor: [0x302b27, 0x5f4131, 0x958473][index % 3],
            hairStyle: index % 2,
          },
          false,
        );
      g.position.set(x, 0, z);
      g.name = "opening_" + id;
      root.add(g);
      const oldShadow = g.children.find(
        (o) => o.geometry?.type === "CircleGeometry",
      );
      if (oldShadow) {
        g.remove(oldShadow);
        oldShadow.geometry.dispose();
        oldShadow.material.dispose();
      }
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(1.85, 1.25),
        shadowMaterial,
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.075;
      g.add(shadow);
      const a = { id, g, parts: g.userData, shadow, index, home: { x, z } };
      actors.push(a);
      return a;
    }
    function idle(a, t) {
      const u = a.parts,
        phase = t + a.index * 0.73,
        breathe = Math.sin(phase * 1.5) * 0.014;
      for (const key of [
        "body",
        "head",
        "leftArm",
        "rightArm",
        "leftElbow",
        "rightElbow",
        "leftLeg",
        "rightLeg",
        "leftKnee",
        "rightKnee",
        "leftHand",
        "rightHand",
      ])
        u[key].rotation.set(0, 0, 0);
      u.body.position.set(0, 1.4 + breathe, 0);
      u.head.position.set(0, 2.35 + breathe, 0);
      u.leftArm.position.set(-0.66, 1.9 + breathe, 0);
      u.rightArm.position.set(0.66, 1.9 + breathe, 0);
      u.leftElbow.rotation.x = u.rightElbow.rotation.x = -0.13;
      u.head.rotation.y = Math.sin(phase * 0.65) * 0.035;
      const blink = phase % 4.7;
      u.face.eyeL.scale.y = u.face.eyeR.scale.y = blink < 0.14 ? 0.1 : 1;
      u.face.mouth.scale.y = 1;
      u.face.browL.rotation.z = 0.03;
      u.face.browR.rotation.z = -0.03;
      for (const hand of [u.leftHand, u.rightHand]) {
        hand.userData.fingers.forEach(
          (f, i) => (f.rotation.x = 0.25 + i * 0.025),
        );
        hand.userData.thumb.rotation.x = 0.15;
      }
      a.shadow.position.y = 0.075 - a.g.position.y;
    }
    function grip(a, amount = 0.9) {
      for (const hand of [a.parts.leftHand, a.parts.rightHand])
        hand.userData.fingers.forEach((f) => (f.rotation.x = amount));
    }
    function walk(a, distance, strength = 1) {
      const u = a.parts,
        ph = distance * 7.2,
        w = Math.sin(ph),
        q = w * 0.5 * strength;
      u.leftLeg.rotation.x = -q;
      u.rightLeg.rotation.x = q;
      u.leftKnee.rotation.x = 0.04 + Math.max(0, w) * 0.6 * strength;
      u.rightKnee.rotation.x = 0.04 + Math.max(0, -w) * 0.6 * strength;
      u.leftArm.rotation.x = q * 0.75;
      u.rightArm.rotation.x = -q * 0.75;
      u.body.rotation.y = w * 0.07 * strength;
      u.body.rotation.z = w * 0.025 * strength;
      u.body.position.y += Math.cos(ph * 2) * 0.02 * strength;
      u.head.position.y += Math.cos(ph * 2) * 0.015 * strength;
    }
    // Analytic two-bone reach. Both native segments pivot at real shoulders/elbows.
    const down = new THREE.Vector3(0, -1, 0),
      target = new THREE.Vector3(),
      dir = new THREE.Vector3(),
      pole = new THREE.Vector3(),
      elbow = new THREE.Vector3(),
      upperDir = new THREE.Vector3(),
      lowerDir = new THREE.Vector3();
    const upperQ = new THREE.Quaternion(),
      lowerQ = new THREE.Quaternion(),
      invQ = new THREE.Quaternion();
    function reach(a, side, point) {
      const arm = a.parts[side + "Arm"],
        joint = a.parts[side + "Elbow"];
      target.set(...point);
      dir.copy(target).sub(arm.position);
      const distance = Math.max(0.05, Math.min(1.015, dir.length()));
      dir.normalize();
      target.copy(arm.position).addScaledVector(dir, distance);
      const along =
          (0.5 * 0.5 - 0.52 * 0.52 + distance * distance) / (2 * distance),
        height = Math.sqrt(Math.max(0, 0.25 - along * along));
      pole.set(side === "left" ? -0.7 : 0.7, -0.15, -1);
      pole.addScaledVector(dir, -pole.dot(dir)).normalize();
      elbow
        .copy(arm.position)
        .addScaledVector(dir, along)
        .addScaledVector(pole, height);
      upperDir.copy(elbow).sub(arm.position).normalize();
      lowerDir.copy(target).sub(elbow).normalize();
      upperQ.setFromUnitVectors(down, upperDir);
      lowerQ.setFromUnitVectors(down, lowerDir);
      arm.quaternion.copy(upperQ);
      joint.quaternion.copy(invQ.copy(upperQ).invert().multiply(lowerQ));
    }
    const temp = new THREE.Vector3(),
      left = new THREE.Vector3(),
      right = new THREE.Vector3();
    function handPoint(a, side, out) {
      a.g.updateMatrixWorld(true);
      return a.parts[side + "Hand"].getWorldPosition(out);
    }
    function localPoint(a, point) {
      a.g.updateMatrixWorld(true);
      return a.g.localToWorld(new THREE.Vector3(...point));
    }
    function holdBox(a, world) {
      a.g.updateMatrixWorld(true);
      const p = a.g.worldToLocal(world.clone());
      reach(a, "left", [p.x - 0.31, p.y, p.z]);
      reach(a, "right", [p.x + 0.31, p.y, p.z]);
      grip(a);
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
      const courier = person("courier", s.x - 5, s.z + 2, 0x668da3),
        receiver = person("receiver", s.x + 5, s.z + 2, 0xb28259);
      receiver.g.rotation.y = -Math.PI / 2;
      const parcel = box(root, 0xb78c5b, [0.68, 0.5, 0.5], [0, 0, 0]);
      box(parcel, 0xe4d1a9, [0.12, 0.505, 0.505], [0, 0, 0]);
      const label = box(
        parcel,
        0xeee3cd,
        [0.23, 0.17, 0.009],
        [0.15, 0.03, 0.255],
      );
      box(label, 0x59636b, [0.16, 0.025, 0.01], [0, 0.02, 0.007]);
      const reader = person("reader", b.x, b.z, 0x7c739a);
      reader.g.position.y = b.y - 0.96;
      reader.g.rotation.y = b.rot;
      const book = box(root, 0x405b73, [0.68, 0.05, 0.43], [0, 0, 0]);
      box(book, 0xf0e5cb, [0.63, 0.025, 0.39], [0, 0.035, 0]);
      const hinge = new THREE.Group();
      book.add(hinge);
      hinge.position.y = 0.055;
      box(hinge, 0xe8dfcc, [0.31, 0.006, 0.36], [0.155, 0, 0]);
      const f1 = spot(s.x - 2, s.z - 3),
        f2 = spot(f1.x + 1.7, f1.z + 0.15);
      const friend = person("conversation", f1.x, f1.z, 0x8e574d),
        listener = person("coffee", f2.x, f2.z, 0x668064);
      friend.g.rotation.y = Math.atan2(f2.x - f1.x, f2.z - f1.z);
      listener.g.rotation.y = friend.g.rotation.y + Math.PI;
      const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.085, 0.26, 12),
        new THREE.MeshLambertMaterial({ color: 0xeee1c6 }),
      );
      root.add(cup);
      const coffee = new THREE.Mesh(
        new THREE.CircleGeometry(0.098, 12),
        new THREE.MeshLambertMaterial({ color: 0x593a27 }),
      );
      coffee.rotation.x = -Math.PI / 2;
      coffee.position.y = 0.131;
      cup.add(coffee);
      const c = spot(s.x + 8, s.z - 5),
        cleaner = person("sweeper", c.x, c.z, 0xbca047);
      const broom = new THREE.Group();
      cleaner.g.add(broom);
      broom.position.set(0.75, 0.1, 0.65);
      box(broom, 0x927146, [0.045, 1.65, 0.045], [0, 0.825, 0]);
      box(broom, 0x5c6754, [0.6, 0.13, 0.2], [0, 0.04, 0]);
      const m1 = spot(e.x - 5, e.z + 6),
        m2 = spot(e.x + 5, e.z + 6),
        shopper = person("shopping", m1.x, m1.z, 0x916657),
        phone = person("phone", m2.x, m2.z, 0x485f88);
      const bag = box(root, 0xba9b6a, [0.37, 0.5, 0.25], [0, 0, 0]);
      box(bag, 0x8d744e, [0.18, 0.04, 0.04], [0, 0.38, 0]);
      for (const x of [-0.09, 0.09])
        box(bag, 0x8d744e, [0.025, 0.12, 0.025], [x, 0.31, 0]);
      const mobile = box(root, 0x26333e, [0.16, 0.28, 0.045], [0, 0, 0]);
      box(mobile, 0x8bb7c8, [0.135, 0.225, 0.01], [0, 0, 0.026]);
      let state = "approach",
        handError = 0;
      function update(time, reduced = false) {
        if (disposed) return;
        const t = reduced ? 10.2 : time;
        for (const a of actors) idle(a, t);
        const u = clamp((t - 9) / 5.2),
          travel = 8.4 * smooth(u),
          speed = 30 * u * u * (1 - u) * (1 - u);
        if (free(s.x - 5 + travel, s.z + 2))
          courier.g.position.set(s.x - 5 + travel, 0, s.z + 2);
        courier.g.rotation.y = Math.PI / 2;
        walk(courier, travel, Math.min(1, speed));
        const giving = smooth((t - 14.2) / 1.5);
        state = t < 14.2 ? "approach" : t < 15.7 ? "transfer" : "received";
        const source = localPoint(courier, [0, 1.3, 0.65]),
          dest = localPoint(receiver, [0, 1.3, 0.65]);
        parcel.position.copy(source).lerp(dest, giving);
        parcel.rotation.set(0, Math.PI / 2, 0);
        if (giving < 1) holdBox(courier, parcel.position);
        if (giving > 0) holdBox(receiver, parcel.position);
        if (giving === 1) {
          const wave = smooth((t - 15.7) / 0.8);
          reach(courier, "right", [0.7, 1.6 + wave * 0.7, 0.4]);
          courier.parts.rightHand.rotation.z = Math.sin(t * 5) * 0.18 * wave;
          courier.parts.head.rotation.y = -0.06;
        }
        handPoint(giving < 0.5 ? courier : receiver, "left", left);
        handPoint(giving < 0.5 ? courier : receiver, "right", right);
        handError = temp
          .copy(left)
          .add(right)
          .multiplyScalar(0.5)
          .distanceTo(parcel.position);
        // Seated knees bend down from the seat instead of two rigid sticks through it.
        reader.parts.leftLeg.rotation.x = reader.parts.rightLeg.rotation.x =
          -Math.PI / 2;
        reader.parts.leftKnee.rotation.x = reader.parts.rightKnee.rotation.x =
          Math.PI / 2;
        reader.parts.head.rotation.x = 0.18;
        reader.parts.head.rotation.y = Math.sin(t * 0.6) * 0.04;
        const turn = smooth(clamp((((t + 1) % 6) - 4.5) / 1.2));
        reach(reader, "left", [-0.32, 1.14, 0.6]);
        reach(reader, "right", [
          0.32 - turn * 0.48,
          1.14 + Math.sin(turn * Math.PI) * 0.12,
          0.6,
        ]);
        grip(reader, 0.5);
        book.position.copy(localPoint(reader, [0, 1.12, 0.6]));
        book.quaternion.copy(reader.g.quaternion);
        hinge.rotation.z = -turn * Math.PI;
        // Conversation alternates gesture and listening, with short mouth/blink motions.
        const talk = Math.max(0, Math.sin(t * 1.3));
        reach(friend, "right", [0.64, 1.3 + talk * 0.3, 0.38 + talk * 0.2]);
        friend.parts.head.rotation.y = Math.sin(t * 0.9) * 0.09;
        friend.parts.head.rotation.x = Math.sin(t * 1.7) * 0.035;
        friend.parts.face.mouth.scale.y =
          1 + talk * Math.abs(Math.sin(t * 8)) * 0.8;
        const sip = smooth(clamp((Math.sin(t * 0.65) - 0.35) / 0.65));
        reach(listener, "left", [-0.24, 1.36 + sip * 0.84, 0.5 - sip * 0.07]);
        grip(listener, 0.8);
        handPoint(listener, "left", temp);
        cup.position.copy(temp).add(new THREE.Vector3(0, 0.04, 0));
        cup.quaternion.copy(listener.g.quaternion);
        cup.rotateX(-sip * 0.3);
        listener.parts.head.rotation.x =
          -sip * 0.035 + Math.sin(t * 1.5) * 0.025;
        const sweep = Math.sin(t * 1.8) * 0.24;
        broom.rotation.z = sweep;
        reach(cleaner, "left", [0.48 - sweep * 0.5, 1.35, 0.65]);
        reach(cleaner, "right", [0.65 - sweep * 0.3, 0.9, 0.65]);
        grip(cleaner, 0.9);
        cleaner.parts.body.rotation.z = -sweep * 0.12;
        cleaner.parts.head.rotation.x = 0.12;
        const cycle = (t % 18) / 18,
          going = cycle < 0.5,
          p = going ? smooth(cycle * 2) : 1 - smooth(cycle * 2 - 1),
          distance = p * 3;
        if (free(m1.x + distance, m1.z))
          shopper.g.position.set(m1.x + distance, 0, m1.z);
        const turnAround = smooth(clamp((cycle - 0.45) / 0.1)),
          turnBack = smooth(clamp((cycle - 0.95) / 0.05));
        shopper.g.rotation.y =
          Math.PI / 2 - Math.PI * turnAround + Math.PI * turnBack;
        walk(shopper, distance, Math.abs(Math.sin(cycle * Math.PI * 2)));
        handPoint(shopper, "right", temp);
        bag.position.copy(temp);
        bag.position.y -= 0.36;
        bag.quaternion.copy(shopper.g.quaternion);
        bag.rotateZ(Math.sin(distance * 7) * 0.07);
        reach(phone, "left", [-0.3, 1.65, 0.58]);
        reach(phone, "right", [-0.05, 1.65, 0.63 + Math.sin(t * 5) * 0.02]);
        grip(phone, 0.65);
        phone.parts.head.rotation.x = 0.2;
        handPoint(phone, "left", temp);
        mobile.position.copy(temp);
        mobile.quaternion.copy(phone.g.quaternion);
        mobile.rotateX(-0.15);
      }
      collect();
      return {
        root,
        update,
        dispose,
        info: () =>
          actors.map((a) => ({
            id: a.id,
            position: a.g.position.toArray(),
            source: "native-articulated-avatar",
            joints: !!a.parts.leftElbow && !!a.parts.leftKnee,
            uuid: a.g.uuid,
          })),
        acting: () => ({ handover: state, handError }),
      };
    } catch (error) {
      dispose();
      throw error;
    }
  }
  window.FZOpeningCast = { create };
})();
