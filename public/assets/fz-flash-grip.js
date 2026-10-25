/* v23: a palm grip, not an elbow attachment. Lens and beam share one world axis. */
(function () {
  "use strict";
  const up = new THREE.Vector3(0, 1, 0),
    dir = new THREE.Vector3(),
    q = new THREE.Quaternion(),
    parentQ = new THREE.Quaternion();
  function handFor(m) {
    return m.userData.isSuperRig
      ? m.userData.srModel?.getObjectByName("rightHand") ||
          m.getObjectByName("rightHand")
      : m.userData.rightHand ||
          m.getObjectByName("rightHand") ||
          m.userData.rightElbow ||
          m.userData.rightArm;
  }
  function aimArm(m) {
    const a = m.userData.rightArm,
      e = m.userData.rightElbow,
      h = handFor(m);
    if (!a || !e || !h) return;
    m.updateMatrixWorld(true);
    const v0 = a.getWorldPosition(new THREE.Vector3()),
      v1 = e.getWorldPosition(new THREE.Vector3()),
      v2 = h.getWorldPosition(new THREE.Vector3());
    const l1 = v0.distanceTo(v1),
      l2 = v1.distanceTo(v2);
    if (l1 < 0.02 || l2 < 0.02) return;
    const mq = m.getWorldQuaternion(new THREE.Quaternion()),
      d = new THREE.Vector3(-0.1, -0.35, 0.55).normalize().applyQuaternion(mq),
      length = (l1 + l2) * 0.78;
    const target = v0.clone().addScaledVector(d, length),
      along = (l1 * l1 - l2 * l2 + length * length) / (2 * length),
      height = Math.sqrt(Math.max(0, l1 * l1 - along * along));
    const pole = new THREE.Vector3(1, -0.3, 0).applyQuaternion(mq);
    pole.addScaledVector(d, -pole.dot(d)).normalize();
    const bend = v0
      .clone()
      .addScaledVector(d, along)
      .addScaledVector(pole, height);
    function turn(bone, from, to) {
      const delta = new THREE.Quaternion().setFromUnitVectors(
          from.normalize(),
          to.normalize(),
        ),
        world = bone
          .getWorldQuaternion(new THREE.Quaternion())
          .premultiply(delta),
        parent = bone.parent
          .getWorldQuaternion(new THREE.Quaternion())
          .invert();
      bone.quaternion.copy(parent.multiply(world));
      m.updateMatrixWorld(true);
    }
    turn(a, v1.clone().sub(v0), bend.sub(v0));
    const current = e.getWorldPosition(new THREE.Vector3());
    turn(
      e,
      h.getWorldPosition(new THREE.Vector3()).sub(current),
      target.sub(current),
    );
  }
  function attach(fl) {
    const m = localPlayer?.mesh;
    if (!m) return;
    const hand = handFor(m);
    if (!hand) return;
    hand.add(fl);
    fl.position.set(0, -0.14, 0.055);
    fl.scale.setScalar(1);
    DLC.flashMesh = fl;
  }
  function refineVM(vm) {
    if (vm.userData.grip23) return;
    const u = vm.userData,
      a = u.arm,
      fore = a.children[0],
      palm = a.children[1],
      fingers = a.children[2],
      thumb = a.children[3];
    fore.geometry.dispose();
    fore.geometry = new THREE.CylinderGeometry(0.055, 0.085, 0.46, 12);
    fore.geometry.rotateX(Math.PI / 2);
    fore.position.set(0.07, -0.055, -0.025);
    palm.geometry.dispose();
    palm.geometry = new THREE.BoxGeometry(0.05, 0.1, 0.15);
    palm.position.set(0.065, -0.015, -0.3);
    fingers.visible = false;
    thumb.position.set(-0.015, 0.065, -0.29);
    thumb.rotation.z = -0.5;
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(
        new THREE.TorusGeometry(0.072, 0.016, 6, 12, Math.PI * 1.45),
        palm.material,
      );
      f.rotation.z = 0.3 * Math.PI;
      f.position.set(0, -0.008, -0.245 - i * 0.035);
      a.add(f);
    }
    u.holder.position.set(0, -0.008, -0.3);
    u.base.set(0.28, -0.27, -0.38);
    vm.userData.grip23 = true;
  }
  function align(fl) {
    if (!fl?.parent) return;
    fl.parent.updateWorldMatrix(true, false);
    fl.parent.getWorldQuaternion(parentQ);
    fl.quaternion.copy(
      parentQ.invert().multiply(q.setFromUnitVectors(up, dir)),
    );
    fl.updateWorldMatrix(false, true);
  }
  function direction() {
    if (window.cameraMode === "first") camera.getWorldDirection(dir);
    else
      dir
        .set(0, 0, 1)
        .applyQuaternion(localPlayer.mesh.getWorldQuaternion(q))
        .normalize();
  }
  function update() {
    if (!localPlayer?.mesh || typeof ITEMS === "undefined") return;
    const m = localPlayer.mesh,
      u = m.userData,
      held = ITEMS.slot === 2;
    if (DLC.flashMesh && DLC.flashMesh.parent !== handFor(m))
      attach(DLC.flashMesh);
    if (!held && u.grip27Restore) {
      for (const [bone, rotation] of u.grip27Restore)
        bone.quaternion.copy(rotation);
      delete u.grip27Restore;
    }
    if (held && u.isSuperRig) {
      if (!u.grip27Restore)
        u.grip27Restore = [
          "fingerR1",
          "fingerR2",
          "fingerR3",
          "fingerR4",
          "thumbR",
        ]
          .map((name) => u.srModel?.getObjectByName(name))
          .filter(Boolean)
          .map((b) => [b, b.quaternion.clone()]);
      aimArm(m);
      for (let i = 1; i <= 4; i++) {
        const finger = u.srModel?.getObjectByName("fingerR" + i);
        if (finger) finger.rotation.x = -1.35;
      }
      const thumb = u.srModel?.getObjectByName("thumbR");
      if (thumb) thumb.rotation.z = -0.65;
    }
    direction();
    if (held && !u.isSuperRig && u.rightArm && u.rightElbow) {
      u.rightArm.rotation.set(-0.65, 0, -0.08);
      u.rightElbow.rotation.set(-0.9, 0, 0);
      if (u.rightHand) {
        u.rightHand.rotation.set(0, 0, 0);
        for (const f of u.rightHand.userData.fingers || []) f.rotation.x = 1.25;
      }
    }
    align(DLC.flashMesh);
    if (ITEMS.vm) {
      refineVM(ITEMS.vm);
      if (held) {
        ITEMS.vm.userData.arm.rotation.set(0, 0, 0);
        ITEMS.vm.userData.armL.visible = false;
        if (ITEMS.vmItem) {
          ITEMS.vmItem.position.set(0, 0, 0);
          align(ITEMS.vmItem);
        }
      }
    }
  }
  function beam(light) {
    const fl = window.cameraMode === "first" ? ITEMS.vmItem : DLC.flashMesh;
    if (!fl?.userData.lens) return false;
    fl.userData.lens.getWorldPosition(light.position);
    direction();
    light.target.position.copy(light.position).addScaledVector(dir, 25);
    return true;
  }
  window.FZFlash = {
    attach,
    update,
    beam,
    info: () => ({
      hand: DLC.flashMesh?.parent?.name || "native palm",
      vm: !!ITEMS.vm?.userData.grip23,
    }),
  };
})();
