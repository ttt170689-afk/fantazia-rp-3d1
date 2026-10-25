(async () => {
  const assert = require("node:assert/strict"),
    fs = require("fs"),
    vm = require("vm"),
    acorn = require("acorn"),
    THREE = require("three");
  const html = fs.readFileSync("../public/index.html", "utf8");
  let native;
  for (const match of html.matchAll(
    /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi,
  )) {
    if (!match[1].includes("function createCharacter(")) continue;
    const ast = acorn.parse(match[1], { ecmaVersion: "latest" });
    const node = ast.body.find(
      (n) =>
        n.type === "FunctionDeclaration" && n.id.name === "createCharacter",
    );
    if (node) native = match[1].slice(node.start, node.end);
  }
  assert(native);
  const world = new THREE.Scene(),
    borrowed = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial(),
    );
  world.add(borrowed);
  let destroyed = false;
  borrowed.geometry.addEventListener("dispose", () => (destroyed = true));
  const ctx = {
    THREE,
    scene: world,
    FZOpeningPlan: require("../public/assets/fz-opening-plan.js"),
    checkCollision: () => false,
    document: {
      createElement: () => ({
        getContext: () => ({
          createRadialGradient: () => ({ addColorStop() {} }),
          fillRect() {},
        }),
      }),
    },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(native + ";window.FZNativeCharacter=createCharacter;", ctx);
  vm.runInContext(
    fs.readFileSync("../public/assets/fz-opening-avatar.js", "utf8"),
    ctx,
  );
  vm.runInContext(
    fs.readFileSync("../public/assets/fz-opening-cast.js", "utf8"),
    ctx,
  );
  const a = {
    square: { x: 131, z: -30 },
    bench: { x: 117, z: -24, y: 0.62, rot: -Math.PI / 2 },
    mall: { x: 131, z: -129 },
    entrance: { x: 131, z: -76 },
  };
  ctx.TextDecoder = TextDecoder;
  ctx.URL = URL;
  ctx.Blob = Blob;
  ctx.console = console;
  for (const file of ["loaders/GLTFLoader.js", "utils/SkeletonUtils.js"])
    vm.runInContext(
      fs.readFileSync("node_modules/three/examples/js/" + file, "utf8"),
      ctx,
    );
  const bytes = fs.readFileSync("../public/exports/player_super.glb");
  const src = await new Promise((resolve, reject) =>
    new THREE.GLTFLoader().parse(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
      resolve,
      reject,
    ),
  );
  ctx.SuperRig = { enabled: true, ready: true, src };
  const borrowedAssets = new Set();
  src.scene.traverse((o) => {
    if (o.geometry) borrowedAssets.add(o.geometry);
    for (const m of o.material
      ? Array.isArray(o.material)
        ? o.material
        : [o.material]
      : [])
      borrowedAssets.add(m);
  });
  let sourceDisposed = 0;
  for (const asset of borrowedAssets)
    asset.addEventListener("dispose", () => sourceDisposed++);
  const sourceJSON = JSON.stringify(src.scene.toJSON());
  const cast = ctx.FZOpeningCast.create(a);
  assert.equal(cast.info().length, 8);
  assert(cast.info().every((a) => a.joints));
  let worst = 0;
  for (let t = 0; t < 41; t += 0.13) {
    cast.update(t);
    worst = Math.max(worst, cast.acting().handError);
    cast.root.traverse((o) =>
      assert(
        o.position
          .toArray()
          .concat(o.quaternion.toArray())
          .every(Number.isFinite),
      ),
    );
  }
  assert(worst < 0.2, "parcel grip stays close to both hands: " + worst);
  for (const [t, state] of [
    [13, "approach"],
    [15, "transfer"],
    [17, "received"],
  ]) {
    cast.update(t);
    assert.equal(cast.acting().handover, state);
  }
  assert(
    cast
      .info()
      .every(
        (a) =>
          a.model === "game-player-super-v26" &&
          a.asset === "exports/player_super.glb",
      ),
  );
  for (const actor of cast.root.children.filter(
    (o) => o.userData.cinemaModel,
  )) {
    assert.equal(
      actor.userData.head.visible,
      false,
      "no redesigned body is rendered",
    );
    let actual = 0,
      expected = 0;
    src.scene.traverse((o) => {
      if (o.isMesh) expected++;
    });
    actor.userData.cinemaVisual.traverse((o) => {
      if (!o.isMesh) return;
      actual++;
      assert(!borrowedAssets.has(o.geometry));
      const original = src.scene.getObjectByName(o.name);
      assert.deepEqual(
        o.geometry.attributes.position.array,
        original.geometry.attributes.position.array,
        "exact original game geometry",
      );
      for (const material of Array.isArray(o.material)
        ? o.material
        : [o.material])
        assert(!borrowedAssets.has(material));
    });
    assert.equal(actual, expected);
  }
  for (const time of [0, 3, 6, 8, 12, 17, 24]) {
    cast.update(time);
    cast.root.updateMatrixWorld(true);
    for (const actor of cast.root.children.filter(
      (o) => o.userData.cinemaModel,
    ))
      for (const binding of actor.userData.cinemaBinders) {
        const expected = new THREE.Matrix4().multiplyMatrices(
          binding.control.matrixWorld,
          binding.offset,
        );
        assert(
          expected.elements.every(
            (n, i) => Math.abs(n - binding.bone.matrixWorld.elements[i]) < 1e-5,
          ),
          "GLB bones follow the control rig without changing rest offsets",
        );
      }
  }
  // Full-strength stance foot is fixed in world space, level, and on the ground.
  const walker = cast.root.getObjectByName("opening_courier"),
    u = walker.userData;
  walker.rotation.set(0, 0, 0);
  ctx.FZOpeningAvatar.gait(u, 0, 0);
  assert(u.leftKnee.rotation.x < 0.25, "standing is not a permanent crouch");
  for (let distance = 0.01; distance < 0.59; distance += 0.01) {
    walker.position.set(0, 0, distance);
    ctx.FZOpeningAvatar.gait(u, distance, 1);
    walker.updateMatrixWorld(true);
    const point = u.leftFoot.getWorldPosition(new THREE.Vector3());
    assert(Math.abs(point.y) < 1e-8);
    assert(Math.abs(point.z - 0.3) < 1e-8);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(
      u.leftFoot.getWorldQuaternion(new THREE.Quaternion()),
    );
    assert(up.distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-8);
  }
  walker.position.set(0, 0, 0);
  ctx.FZOpeningAvatar.gait(u, 0.8, 1);
  walker.updateMatrixWorld(true);
  assert(u.leftFoot.getWorldPosition(new THREE.Vector3()).y > 0.14);
  const snapshot = () => {
    const rows = [];
    cast.root.traverse((o) =>
      rows.push([
        o.position.toArray(),
        o.quaternion.toArray(),
        o.scale.toArray(),
        o.visible,
      ]),
    );
    return JSON.stringify(rows);
  };
  cast.update(12);
  const expected = snapshot();
  cast.update(3);
  cast.update(12);
  assert.equal(
    snapshot(),
    expected,
    "poses depend on timeline, not prior frame history",
  );
  cast.update(10, true);
  const reduced = JSON.stringify(cast.info());
  cast.update(30, true);
  assert.equal(JSON.stringify(cast.info()), reduced);
  cast.dispose();
  cast.dispose();
  assert.equal(world.children.length, 1);
  assert.equal(world.children[0], borrowed);
  assert(!destroyed);
  assert.equal(sourceDisposed, 0, "never dispose the gameplay model source");
  assert.equal(
    JSON.stringify(src.scene.toJSON()),
    sourceJSON,
    "source bones/materials/geometry are unchanged",
  );
  console.log(
    "PASS articulated cast: real native character factory, eight exact gameplay GLB clones, planted stance feet and swing lift, finite IK, handover phases, grip error " +
      worst.toFixed(4) +
      "m, deterministic poses, reduced motion, owned-resource cleanup.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
