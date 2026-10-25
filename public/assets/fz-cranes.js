/* v28: replaces the existing reserved construction-site crane factory.
 * Ladder -> guarded service deck -> cabin/trolley. No new road obstacles. */
(function () {
  "use strict";
  let owner = null,
    cranes = [],
    rider = null,
    panel = null,
    hold = 0;
  const H = 28;
  function world(c, x, y, z) {
    return new THREE.Vector3(x, y, z)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), c.rot)
      .add(new THREE.Vector3(c.x, 0, c.z));
  }
  function local(c, p) {
    return p
      .clone()
      .sub(new THREE.Vector3(c.x, 0, c.z))
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), -c.rot);
  }
  function action(c, name, x, y, z, kind) {
    const a = {
      type: "crane28",
      crane28: true,
      name,
      position: world(c, x, y, z),
      range: 2.5,
      kind,
      crane: c,
    };
    c.actions.push(a);
    interactables.push(a);
  }
  function build(x, z, rot) {
    if (owner !== scene) {
      dispose();
      owner = scene;
    }
    const root = new THREE.Group();
    root.name = "climbable_crane28";
    root.position.set(x, 0, z);
    root.rotation.y = rot;
    scene.add(root);
    const resources = new Set(),
      geo = new THREE.BoxGeometry(1, 1, 1);
    resources.add(geo);
    const mats = new Map();
    function mat(color) {
      if (!mats.has(color)) {
        const m = new THREE.MeshLambertMaterial({ color });
        mats.set(color, m);
        resources.add(m);
      }
      return mats.get(color);
    }
    const batch = new Map();
    function box(w, h, d, px, py, pz, color = 0xe6b438, rotation = 0) {
      const key = String(color);
      if (!batch.has(key)) batch.set(key, []);
      batch
        .get(key)
        .push(
          new THREE.Matrix4().compose(
            new THREE.Vector3(px, py, pz),
            new THREE.Quaternion().setFromAxisAngle(
              new THREE.Vector3(0, 0, 1),
              rotation,
            ),
            new THREE.Vector3(w, h, d),
          ),
        );
    }
    function beam(a, b, color) {
      const direction = new THREE.Vector3().subVectors(b, a),
        m = new THREE.Matrix4().compose(
          a.clone().add(b).multiplyScalar(0.5),
          new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            direction.clone().normalize(),
          ),
          new THREE.Vector3(0.12, direction.length(), 0.12),
        );
      const key = String(color);
      if (!batch.has(key)) batch.set(key, []);
      batch.get(key).push(m);
    }
    for (const px of [-1.15, 1.15])
      for (const pz of [-1.15, 1.15]) box(0.22, H, 0.22, px, H / 2, pz);
    for (let y = 0; y < H; y += 2.8) {
      for (const pz of [-1.15, 1.15]) {
        box(2.5, 0.13, 0.13, 0, y, pz);
        beam(
          new THREE.Vector3(-1.15, y, pz),
          new THREE.Vector3(1.15, y + 2.8, pz),
          0xe6b438,
        );
      }
      for (const px of [-1.15, 1.15])
        beam(
          new THREE.Vector3(px, y, -1.15),
          new THREE.Vector3(px, y + 2.8, 1.15),
          0xd6a72b,
        );
    }
    box(5, 0.6, 5, 0, -0.3, 0, 0x5a6571);
    for (const px of [-0.72, 0.72])
      box(0.08, H, 0.08, px, H / 2, 1.65, 0x98a5b2);
    for (let y = 0.4; y < H; y += 0.4)
      box(1.5, 0.06, 0.08, 0, y, 1.65, 0xc5ced4);
    const cageGeo = new THREE.TorusGeometry(1, 0.055, 5, 16, Math.PI * 1.5);
    resources.add(cageGeo);
    for (let y = 2.5; y < H; y += 2) {
      const ring = new THREE.Mesh(cageGeo, mat(0x97a3ae));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, y, 1.7);
      root.add(ring);
    }
    box(5, 0.25, 7, 0, H - 0.125, -0.5, 0x5b6570);
    box(2.3, 0.18, 23, 0, H - 0.09, 10, 0x737e88);
    for (const px of [-1.3, 1.3])
      for (let pz = 2; pz < 22; pz += 2) {
        box(0.08, 1.2, 0.08, px, H + 0.6, pz, 0xe6b438);
        box(0.08, 0.08, 2.1, px, H + 1.2, pz, 0xe6b438);
      }
    for (const px of [-2.4, 2.4]) {
      box(0.09, 0.09, 7, px, H + 1.2, -0.5, 0xe6b438);
      for (let z = -4; z <= 3; z += 1.75)
        box(0.09, 1.2, 0.09, px, H + 0.6, z, 0xe6b438);
    }
    box(4.9, 0.09, 0.1, 0, H + 1.2, -4, 0xe6b438);
    for (const px of [-1.6, 1.6]) {
      box(0.18, 0.18, 28, px, H + 0.75, 8, 0xe6b438);
      box(0.18, 0.18, 28, px, H + 3.2, 8, 0xe6b438);
      for (let z = -5; z < 22; z += 3)
        beam(
          new THREE.Vector3(px, H + 0.8, z),
          new THREE.Vector3(px, H + 3.2, z + 3),
          0xe6b438,
        );
    }
    for (let z = -5; z < 22; z += 3)
      box(3.2, 0.15, 0.15, 0, H + 3.2, z, 0xe6b438);
    box(3.5, 1.7, 3.5, 0, H + 2, -6.5, 0x4d5660);
    box(3.3, 0.15, 2.5, 0, H + 3.6, -2.5, 0x476b85);
    box(3.3, 3.6, 0.12, 0, H + 1.8, -3.75, 0x476b85);
    for (const x of [-1.65, 1.65]) {
      box(0.12, 0.8, 2.5, x, H + 0.4, -2.5, 0x476b85);
      box(0.06, 2.2, 2.2, x, H + 2, -2.5, 0xb4d5de);
    }
    box(0.4, 0.6, 0.3, 0.6, H + 1, -1, 0x182333);
    const trolley = new THREE.Group();
    trolley.position.set(0, H + 2, 12);
    root.add(trolley);
    const tm = new THREE.Mesh(geo, mat(0x263747));
    tm.scale.set(2, 0.6, 1.6);
    trolley.add(tm);
    const rope = new THREE.Mesh(geo, mat(0x8a979c));
    rope.scale.set(0.045, 12, 0.045);
    rope.position.y = -6;
    trolley.add(rope);
    const hook = new THREE.Mesh(geo, mat(0x283542));
    hook.scale.set(0.6, 0.7, 0.3);
    hook.position.y = -12;
    trolley.add(hook);
    for (const [color, items] of batch) {
      const m = new THREE.InstancedMesh(geo, mat(Number(color)), items.length);
      items.forEach((v, i) => m.setMatrixAt(i, v));
      m.instanceMatrix.needsUpdate = true;
      m.frustumCulled = false;
      root.add(m);
    }
    const c = {
      root,
      x,
      z,
      rot,
      resources,
      actions: [],
      trolley,
      rope,
      hook,
      length: 12,
    };
    cranes.push(c);
    action(c, "Кран — подняться по лестнице", 0, 0, 2.8, "ladder");
    action(c, "Кран — спуститься", 0, H, 2.2, "down");
    action(c, "Кабина — управление крюком", 0, H, -0.4, "controls");
    return root;
  }
  function available() {
    return (
      window.FZUI?.playing() &&
      !window._loadingGate &&
      !window.cine &&
      !isInsideBuilding &&
      !isInFactory &&
      !isInBasement &&
      !window.FZSky?.active() &&
      !localCar &&
      !window.FZMetro?.active()
    );
  }
  function removePanel() {
    panel?.remove();
    panel = null;
    hold = 0;
  }
  function controls() {
    removePanel();
    panel = document.createElement("div");
    panel.className = "fz28-crane";
    panel.id = "fzCraneControls";
    const title = document.createElement("strong");
    title.textContent =
      rider.mode === "ladder"
        ? "ЛЕСТНИЦА · W / S"
        : "КРАН · СЕРВИСНАЯ ПЛОЩАДКА";
    panel.append(title);
    const button = (label, down, up) => {
      const b = document.createElement("button");
      b.textContent = label;
      panel.append(b);
      if (up) {
        b.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          b.setPointerCapture(e.pointerId);
          down();
        });
        for (const ev of ["pointerup", "pointercancel", "lostpointercapture"])
          b.addEventListener(ev, up);
      } else b.onclick = down;
    };
    if (rider.mode === "ladder") {
      button(
        "▲ Вверх",
        () => (hold = 1),
        () => (hold = 0),
      );
      button(
        "▼ Вниз",
        () => (hold = -1),
        () => (hold = 0),
      );
    } else {
      button("Спуститься по лестнице", () => {
        const p = local(rider.crane, localPlayer.mesh.position);
        if (Math.hypot(p.x, p.z - 2.2) > 3) {
          showNotification("Подойдите к лестнице.", "info");
          return;
        }
        rider.mode = "ladder";
        rider.y = H;
        controls();
      });
      button("Крюк ↑", () => adjust(0, -1));
      button("Крюк ↓", () => adjust(0, 1));
      button("Тележка ←", () => adjust(-1, 0));
      button("Тележка →", () => adjust(1, 0));
    }
    document.body.append(panel);
  }
  function adjust(z, length) {
    if (!rider || rider.mode !== "deck") return;
    const c = rider.crane,
      p = local(c, localPlayer.mesh.position);
    if (Math.hypot(p.x, p.z + 0.4) > 3) {
      showNotification("Управление доступно возле кабины.", "info");
      return;
    }
    c.length = Math.max(3, Math.min(23, c.length + length));
    c.trolley.position.z = Math.max(3, Math.min(20, c.trolley.position.z + z));
    c.rope.scale.y = c.length;
    c.rope.position.y = -c.length / 2;
    c.hook.position.y = -c.length;
  }
  function interact(e) {
    if (!e?.crane28) return false;
    if (!available()) return true;
    const p = localPlayer.mesh.position;
    if (p.distanceTo(e.position) > 3.4) return true;
    if (e.kind === "ladder" && !rider) {
      rider = { crane: e.crane, mode: "ladder", y: Math.max(0, p.y) };
      if (sittingOn) standUpFromSeat();
      controls();
    } else if (e.kind === "down" && rider?.crane === e.crane) {
      rider.mode = "ladder";
      rider.y = H;
      controls();
    } else if (e.kind === "controls" && rider?.crane === e.crane) controls();
    return true;
  }
  function update(dt) {
    if (!rider) return;
    if (!available()) {
      release();
      return;
    }
    if (document.hidden) return;
    const d = Math.min(0.05, Math.max(0, Number.isFinite(dt) ? dt : 0));
    if (rider.mode === "ladder") {
      const blocked = window.FZTouch?.blocked(),
        axis = blocked ? 0 : hold || (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
      rider.y = Math.max(0, Math.min(H, rider.y + axis * d * 3));
      const target = world(rider.crane, 0, rider.y, 2.2);
      localPlayer.mesh.position.copy(target);
      velocity.y = 0;
      isGrounded = true;
      localPlayer.currentAnimation = axis ? "walk" : "idle";
      if (rider.y >= H && axis > 0) {
        rider.mode = "deck";
        cameraAngleH =
          rider.crane.rot + (window.cameraMode === "first" ? 0 : Math.PI / 2);
        cameraAngleV = 0.1;
        controls();
        showNotification(
          "Вы на сервисной площадке. Стрела ограждена перилами.",
          "info",
        );
      } else if (rider.y <= 0 && axis < 0) {
        localPlayer.mesh.position.copy(world(rider.crane, 0, 0, 3.1));
        release();
      }
    }
  }
  function collision(x, z) {
    if (!rider) return null;
    if (rider.mode === "ladder") return true;
    const p = local(rider.crane, new THREE.Vector3(x, H, z));
    return !(
      (Math.abs(p.x) < 1.85 && p.z > -3.5 && p.z < 2.5) ||
      (Math.abs(p.x) < 0.83 && p.z >= 2.5 && p.z < 21)
    );
  }
  function release() {
    removePanel();
    rider = null;
  }
  function dispose() {
    release();
    if (typeof interactables !== "undefined")
      interactables = interactables.filter((e) => !e.crane28);
    for (const c of cranes) {
      c.root.parent?.remove(c.root);
      c.resources.forEach((r) => r.dispose?.());
    }
    cranes = [];
  }
  window._mkCrane = build;
  window.FZCranes = {
    interact,
    update,
    collision,
    release,
    dispose,
    active: () => !!rider,
    locked: () => rider?.mode === "ladder",
    ground: () => (rider ? (rider.mode === "ladder" ? rider.y : H) : null),
    accept: (e) =>
      e?.crane28
        ? Math.abs(localPlayer.mesh.position.y - e.position.y) < 3
        : !rider,
    info: () => ({
      count: cranes.length,
      rider: rider ? { mode: rider.mode, y: rider.y } : null,
      sites: cranes.map((c) => ({
        x: c.x,
        z: c.z,
        rot: c.rot,
        height: H,
        hook: c.length,
        trolley: c.trolley.position.z,
      })),
    }),
  };
  window.addEventListener("blur", () => (hold = 0));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) hold = 0;
  });
})();
