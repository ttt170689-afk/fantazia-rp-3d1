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
    // Bevelled phalanges instead of four torus rings. One shared geometry,
    // no new objects during update and no changes to the articulated story rig.
    const outline=new THREE.Shape();outline.moveTo(-.38,-.5);outline.lineTo(.38,-.5);outline.lineTo(.5,-.38);outline.lineTo(.5,.38);outline.lineTo(.38,.5);outline.lineTo(-.38,.5);outline.lineTo(-.5,.38);outline.lineTo(-.5,-.38);outline.closePath();
    const segment=new THREE.ExtrudeGeometry(outline,{depth:.84,steps:1,bevelEnabled:true,bevelThickness:.08,bevelSize:.05,bevelSegments:1});segment.translate(0,0,-.42);
    fore.geometry.dispose();fore.geometry=segment;fore.scale.set(.085,.09,.44);fore.position.set(.07,-.055,-.025);
    palm.geometry.dispose();palm.geometry=segment;palm.scale.set(.045,.085,.15);palm.position.set(.065,-.015,-.3);
    fingers.visible=false;thumb.visible=false;
    const bone=(parent,from,to,width,depth,name)=>{
      const start=new THREE.Vector3(...from),end=new THREE.Vector3(...to),delta=end.clone().sub(start);
      const m=new THREE.Mesh(segment,palm.material);m.name=name;m.position.copy(start.add(end).multiplyScalar(.5));m.scale.set(width,delta.length()+.003,depth);m.quaternion.setFromUnitVectors(up,delta.normalize());parent.add(m);return m;
    };
    u.fingers44=[];
    for(let i=0;i<4;i++){
      const finger=new THREE.Group();finger.name=['Little','Ring','Middle','Index'][i]+' finger · three phalanges';a.add(finger);
      const z=-.245-i*.035,reach=[.86,.96,1,.93][i];
      const joints=[[.064,-.006,z],[.045,.049,z-.002],[-.012*reach,.061,z-.004],[-.049*reach,.033,z-.007]];
      for(let j=0;j<3;j++)bone(finger,joints[j],joints[j+1],.026-j*.002,.025-j*.001,'Phalanx '+(j+1));
      u.fingers44.push(finger);
    }
    const thumbGrip=new THREE.Group();thumbGrip.name='Opposing thumb · two phalanges';thumbGrip.position.set(.06,.018,-.36);a.add(thumbGrip);
    bone(thumbGrip,[0,0,0],[-.025,.043,-.035],.033,.029,'Thumb proximal');bone(thumbGrip,[-.025,.043,-.035],[-.06,.042,-.055],.028,.025,'Thumb distal');u.thumb44=thumbGrip;
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
