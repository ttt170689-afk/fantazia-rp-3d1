const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  THREE = require("three");
const P = require("../public/assets/fz-metro-policy.js");
assert.equal(P.stations.length, 5);
assert.equal(new Set(P.stations.map((s) => s.id)).size, 5);
assert.equal(P.next(4), 0);
for (const s of P.stations)
  assert(fs.statSync("../public/audio/metro/" + s.id + ".mp3").size > 1000);
for (const s of Object.keys(P.duration)) {
  const t = P.advance(s, P.duration[s] - 0.01, 0.1);
  assert(t.changed);
  assert(Object.hasOwn(P.duration, t.state));
  assert.equal(P.advance(s, 0, NaN).elapsed, 0);
}
assert(!P.blocked(0, 7));
assert(!P.blocked(0, -1));
assert(P.blocked(0, -3));
assert(P.blocked(8, 6));
assert(P.blocked(24, 5));
assert(!P.blocked(0, -4, true));
assert(P.blocked(0, 0, true));
const player = new THREE.Group(),
  rig = new THREE.Group(),
  realHand = new THREE.Bone(),
  obsoleteHand = new THREE.Group();
realHand.name = "rightHand";
rig.add(realHand);
player.add(rig);
player.userData = { isSuperRig: true, srModel: rig, rightHand: obsoleteHand };
const camera = new THREE.PerspectiveCamera();
camera.rotation.set(0.2, 0.8, 0);
const ctx = {
  THREE,
  localPlayer: { mesh: player },
  DLC: {},
  ITEMS: { slot: 2, vm: null },
  camera,
  cameraMode: "third",
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync("../public/assets/fz-flash-grip.js", "utf8"),
  ctx,
);
const lamp = new THREE.Group(),
  lens = new THREE.Object3D();
lens.position.y = 0.355;
lamp.add(lens);
lamp.userData.lens = lens;
ctx.FZFlash.attach(lamp);
assert.equal(lamp.parent, realHand, "real rig bone, never removed native palm");
ctx.FZFlash.update();
const q = lamp.getWorldQuaternion(new THREE.Quaternion()),
  axis = new THREE.Vector3(0, 1, 0).applyQuaternion(q),
  forward = new THREE.Vector3(0, 0, 1).applyQuaternion(
    player.getWorldQuaternion(new THREE.Quaternion()),
  );
assert(axis.distanceTo(forward) < 1e-8);
ctx.cameraMode = "first";
ctx.FZFlash.update();
assert(
  new THREE.Vector3(0, 1, 0)
    .applyQuaternion(lamp.getWorldQuaternion(new THREE.Quaternion()))
    .distanceTo(camera.getWorldDirection(new THREE.Vector3())) < 1e-8,
);
for (let z = 28; z >= -4; z -= 0.1)
  assert(!P.blocked(0, z, false, true), "continuous stair/door path");
assert(P.blocked(4, -2, false, true), "solid train wall between doors");
assert(P.blocked(0, -2, false, false), "closed door blocks pedestrians");
assert.equal(P.ground(25), 0);
assert.equal(P.ground(13), -8);
for (let z = 13; z < 25; z += 0.05)
  assert(Math.abs(P.ground(z + 0.05) - P.ground(z)) < 0.034);
ctx.ITEMS.vmItem = lamp;
const light = new THREE.SpotLight();
ctx.FZFlash.beam(light);
assert(
  light.position.distanceTo(lens.getWorldPosition(new THREE.Vector3())) < 1e-8,
);
for (let i = 0; i < 30; i++) ctx.FZFlash.update();
assert.equal(realHand.children.length, 1);
assert.equal(obsoleteHand.children.length, 0);
console.log(
  "PASS v23: five recorded stations, bounded metro phases, platform/train collision, actual SuperRig wrist attachment, no duplicate light model, lens-origin/beam-axis agreement.",
);
