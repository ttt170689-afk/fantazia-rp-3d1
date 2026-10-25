/* v26: the SAME player_super.glb used in gameplay. No redesigned cinema bodies.
 * Native joints are hidden animation controls; bind-space offsets drive cloned
 * GLB bones without overwriting the rig's rest transforms. GPU assets are owned. */
(function (root) {
  "use strict";
  const LEG = 0.5,
    HIP_IDLE = 0.997,
    HIP_WALK = 0.945;
  function load() {
    if (!root.SuperRig?.enabled) return Promise.resolve();
    if (root.SuperRig.ready) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error("Не загрузилась игровая модель персонажа")),
        15000,
      );
      root.SuperRig.sourceReady.then(
        () => {
          clearTimeout(timer);
          resolve();
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }
  function refine(g, index, appearance) {
    const u = g.userData;
    for (const side of ["left", "right"]) {
      const knee = u[side + "Knee"];
      u[side + "Foot"] = knee.children.find(
        (o) => o.isMesh && o.geometry.parameters?.height === 0.16,
      );
      u[side + "Foot"].position.set(0, -LEG, 0);
    }
    u.cinemaModel = "game-native-v26";
    if (!root.SuperRig?.enabled) return g;
    if (!root.SuperRig.ready)
      throw Error("Opening requires the actual gameplay GLB");
    const original = root.SuperRig.src.scene,
      model = THREE.SkeletonUtils.clone(original);
    const geometries = new Map(),
      materials = new Map(),
      textures = new Map();
    function material(m) {
      if (materials.has(m)) return materials.get(m);
      const copy = m.clone();
      materials.set(m, copy);
      for (const k of Object.keys(copy))
        if (copy[k]?.isTexture) {
          const tex = copy[k];
          if (!textures.has(tex)) textures.set(tex, tex.clone());
          copy[k] = textures.get(tex);
        }
      let color;
      if (["Skin_Face", "Skin_Hands"].includes(m.name))
        color = appearance.skinColor;
      if (["Hoodie_Blue", "Accent_Cyan"].includes(m.name))
        color = appearance.shirtColor;
      if (["Pants_Navy", "Shoes_Charcoal"].includes(m.name))
        color = appearance.pantsColor;
      if (["Hair_Brown", "Eyebrow_L", "Eyebrow_R"].includes(m.name))
        color = appearance.hairColor;
      if (color !== undefined) {
        copy.color.set(color);
        if (["Accent_Cyan", "Shoes_Charcoal"].includes(m.name))
          copy.color.multiplyScalar(0.72);
        if (m.name.startsWith("Eyebrow_")) copy.color.multiplyScalar(0.6);
      }
      return copy;
    }
    model.traverse((o) => {
      if (!o.isMesh) return;
      if (!geometries.has(o.geometry))
        geometries.set(o.geometry, o.geometry.clone());
      o.geometry = geometries.get(o.geometry);
      o.material = Array.isArray(o.material)
        ? o.material.map(material)
        : material(o.material);
      o.frustumCulled = false;
      o.castShadow = true;
    });
    // Keep the original control hierarchy, but never render its old meshes.
    g.traverse((o) => {
      if (o.isMesh) o.visible = false;
    });
    model.name = "cinema_game_player_super";
    g.add(model);
    g.updateMatrixWorld(true);
    const controls = {
      spine: u.body,
      head: u.head,
      hair: u.hair,
      leftEye: u.face.eyeL,
      rightEye: u.face.eyeR,
      pupilL: u.face.pupL,
      pupilR: u.face.pupR,
      browL: u.face.browL,
      browR: u.face.browR,
      mouth: u.face.mouth,
    };
    for (const side of ["left", "right"]) {
      for (const part of ["Arm", "Elbow", "Hand", "Leg", "Knee", "Foot"])
        controls[side + part] = u[side + part];
      const suffix = side === "left" ? "L" : "R";
      u[side + "Hand"].userData.fingers.forEach(
        (finger, i) => (controls["finger" + suffix + (i + 1)] = finger),
      );
      controls["thumb" + suffix] = u[side + "Hand"].userData.thumb;
    }
    const binders = [];
    model.traverse((bone) => {
      const control = controls[bone.name.replace(/[.\s:]/g, "")];
      if (bone.isBone && control)
        binders.push({
          bone,
          control,
          offset: new THREE.Matrix4()
            .copy(control.matrixWorld)
            .invert()
            .multiply(bone.matrixWorld),
        });
    });
    u.cinemaRoot = g;
    u.cinemaVisual = model;
    u.cinemaBinders = binders;
    u.cinemaModel = "game-player-super-v26";
    u.cinemaAsset = "exports/player_super.glb";
    return g;
  }
  const desired = new THREE.Matrix4(),
    local = new THREE.Matrix4();
  function pose(u) {
    if (!u.cinemaBinders) return;
    u.cinemaRoot.updateMatrixWorld(true);
    // Source traversal is parent-first, so every parent inverse is current.
    for (const { bone, control, offset } of u.cinemaBinders) {
      desired.multiplyMatrices(control.matrixWorld, offset);
      local.copy(bone.parent.matrixWorld).invert().multiply(desired);
      local.decompose(bone.position, bone.quaternion, bone.scale);
      bone.updateMatrixWorld(true);
    }
  }
  function legPose(u, side, z, lift = 0) {
    const hip = u[side + "Leg"],
      knee = u[side + "Knee"],
      foot = u[side + "Foot"];
    const dy = hip.position.y - lift,
      d = Math.min(2 * LEG - 0.001, Math.max(0.05, Math.hypot(dy, z))),
      angle = Math.atan2(-z, dy);
    hip.rotation.x =
      angle - Math.acos(THREE.MathUtils.clamp(d / (2 * LEG), -1, 1));
    knee.rotation.x =
      Math.PI -
      Math.acos(
        THREE.MathUtils.clamp((2 * LEG * LEG - d * d) / (2 * LEG * LEG), -1, 1),
      );
    foot.rotation.x = -hip.rotation.x - knee.rotation.x;
  }
  function gait(u, distance, strength = 1) {
    for (const [side, offset] of [
      ["left", 0],
      ["right", 0.5],
    ]) {
      u[side + "Leg"].position.y = HIP_IDLE - (HIP_IDLE - HIP_WALK) * strength;
      const phase = (((distance + offset) % 1) + 1) % 1,
        swing = Math.max(0, (phase - 0.6) / 0.4),
        smooth = swing * swing * (3 - 2 * swing);
      const z = (phase < 0.6 ? 0.3 - phase : -0.3 + 0.6 * smooth) * strength;
      legPose(u, side, z, Math.sin(swing * Math.PI) * 0.16 * strength);
    }
  }
  root.FZOpeningAvatar = { load, refine, gait, legPose, pose };
  if (typeof module !== "undefined" && module.exports)
    module.exports = root.FZOpeningAvatar;
})(typeof window === "undefined" ? globalThis : window);
