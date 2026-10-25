const assert = require("node:assert/strict"),
  THREE = require("three");
global.THREE = THREE;
global.scene = new THREE.Scene();
global.FZOpeningPlan = require("../public/assets/fz-opening-plan.js");
const Portal = require("../public/assets/fz-letter-portal.js"),
  font = new THREE.FontLoader().parse(
    require("../public/fonts/helvetiker_bold.typeface.json"),
  );
const anchors = {
  square: { x: 131, z: -30 },
  bench: { x: 117, z: -24, rot: -Math.PI / 2 },
  mall: { x: 131, z: -129 },
  entrance: { x: 131, z: -76 },
};
for (const aspect of [390 / 844, 16 / 9]) {
  const p = Portal.create(anchors, font),
    cam = new THREE.PerspectiveCamera(aspect < 1 ? 60 : 52, aspect, 0.018, 360);
  p.pose(0, cam);
  assert(p.info().cameraLocalZ > 10);
  assert(!p.info().crossed);
  const bounds = p.text.geometry.boundingBox;
  for (const x of [bounds.min.x, bounds.max.x])
    for (const y of [bounds.min.y, bounds.max.y]) {
      cam.updateMatrixWorld();
      const q = new THREE.Vector3(x, y, 0)
        .applyMatrix4(p.root.matrixWorld)
        .project(cam);
      assert(
        Math.abs(q.x) < 0.99 && Math.abs(q.y) < 0.99,
        "whole credit fits before travel",
      );
    }
  p.pose(7, cam);
  const ray = new THREE.Raycaster();
  ray.layers.set(1);
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(p.root.quaternion);
  ray.set(new THREE.Vector3(0, 0, 5).applyMatrix4(p.root.matrixWorld), dir);
  assert.equal(
    ray.intersectObject(p.text).length,
    0,
    "counter of A is physically empty",
  );
  ray.set(new THREE.Vector3(0, -0.7, 5).applyMatrix4(p.root.matrixWorld), dir);
  assert(
    ray.intersectObject(p.text).length > 0,
    "crossbar is real solid geometry",
  );
  let insideTime = 0;
  let previous = Infinity;
  for (let t = 3; t < 9; t += 0.05) {
    p.pose(t, cam);
    assert(p.info().cameraLocalZ <= previous + 1e-8);
    previous = p.info().cameraLocalZ;
    if (p.info().inside) insideTime += 0.05;
    assert(cam.position.toArray().every(Number.isFinite));
  }
  assert(
    insideTime > 2.3 && insideTime < 2.7,
    "sustained real passage, not an invisible frame",
  );
  assert.equal(p.info().counterRibs, 7);
  assert(p.info().crossed);
  assert(previous < -0.24);
  p.pose(8.9999, cam);
  const end = FZOpeningPlan.framedSample(
    2.1,
    anchors,
    false,
    aspect < 1,
  ).position;
  assert(
    cam.position.distanceTo(new THREE.Vector3(...end)) < 1e-5,
    "continuous exit into the city shot",
  );
  p.pose(0, cam, true);
  assert(!p.info().crossed);
  const first = cam.position.clone();
  p.pose(2.8, cam, true);
  assert(cam.position.equals(first), "reduced-motion camera does not fly");
  // Even an error in the second pass restores caller-owned render state.
  const background = new THREE.Color(0x123456);
  scene.background = background;
  let renders = 0;
  const renderer = {
    autoClear: true,
    clearDepth() {},
    render(world) {
      assert.equal(world, scene);
      if (++renders === 2) throw Error("simulated GPU failure");
    },
  };
  assert.throws(() => p.render(renderer, scene, cam), /simulated/);
  assert.equal(scene.background, background);
  assert(renderer.autoClear);
  assert.equal(cam.layers.mask, 1);
  p.dispose();
  p.dispose();
  assert.equal(scene.children.length, 0);
}
console.log(
  "PASS physical A portal: licensed local glyph geometry, empty counter/solid crossbar raycasts, portrait/landscape framing, signed-depth crossing, continuous exit, reduced motion, two-pass exception safety and disposal.",
);
