const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  THREE = require("three");
const quality = require("../public/assets/fz-sky-visual.js").quality;
assert.equal(quality(false, "custom", "high", false).shadow, true);
for (const args of [
  [true, "quality", "high", false],
  [false, "battery", "high", false],
  [false, "custom", "off", false],
  [false, "custom", "high", true],
])
  assert.equal(quality(...args).shadow, false);
assert.equal(quality(false, "battery", "high", false).bump, false);
assert.equal(quality(true, "balanced", "high", false).clouds, 16);
const canvas = () => ({
  getContext: () => ({
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {},
    drawImage() {},
    fillRect() {},
    beginPath() {},
    arc() {},
    fill() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
  }),
});
const render = () => ({
  capabilities: { getMaxAnisotropy: () => 8 },
  shadowMap: { enabled: true, type: THREE.PCFShadowMap },
  outputEncoding: THREE.LinearEncoding,
  toneMapping: THREE.ReinhardToneMapping,
  toneMappingExposure: 1.3,
});
let profile = "custom";
const world = new THREE.Scene(),
  root = new THREE.Group();
root.position.set(0, 360, -1400);
world.add(root);
const ctx = {
  THREE,
  renderer: render(),
  SETTINGS: { shadowQuality: "high", perf: false },
  document: { createElement: canvas },
  navigator: { maxTouchPoints: 0 },
  matchMedia: () => ({ matches: false }),
  FZPlay: { info: () => ({ profile }), managed: () => profile !== "custom" },
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync("../public/assets/fz-sky-visual.js", "utf8"),
  ctx,
);
const resources = new Set(),
  look = ctx.FZSkyVisual.create(root, resources),
  camera = new THREE.PerspectiveCamera(60, 1, 0.1, 320);
camera.layers.mask = 9;
const player = { mesh: new THREE.Group() },
  remote = { mesh: new THREE.Group() },
  hands = new THREE.Group(),
  child = new THREE.Mesh(
    new THREE.BoxGeometry(),
    new THREE.MeshLambertMaterial(),
  );
child.layers.mask = 8;
player.mesh.add(child);
world.add(player.mesh, remote.mesh, hands, camera);
player.mesh.position.copy(root.position);
look.setLayers();
root.traverse((o) => assert.equal(o.layers.mask, 4));
assert(look.materials.stone.isMeshStandardMaterial);
assert(look.maps.glow.isCanvasTexture);
assert.equal(look.materials.light.emissive.getHex(), 0x408aff);
assert.equal(look.materials.neonPink.color.getHex(), 0xff52bd);
assert(look.materials.wood.map.isCanvasTexture);
assert(look.maps.height.encoding === THREE.LinearEncoding);
assert(look.maps.stone.encoding === THREE.sRGBEncoding);
const before = {
  encoding: ctx.renderer.outputEncoding,
  tone: ctx.renderer.toneMapping,
  exposure: ctx.renderer.toneMappingExposure,
  shadow: ctx.renderer.shadowMap.enabled,
  type: ctx.renderer.shadowMap.type,
};
for (let i = 0; i < 3; i++) {
  look.update(true, ctx.renderer, camera, player, { remote }, [hands]);
  assert.equal(camera.layers.mask, 4);
  assert.equal(camera.far, 450);
  assert.equal(child.layers.mask, 12);
  assert.equal(remote.mesh.layers.mask, 5);
  assert.equal(hands.layers.mask, 5);
  assert.equal(ctx.renderer.outputEncoding, THREE.sRGBEncoding);
  assert(look.info().shadows);
  assert.equal(ctx.renderer.toneMapping, before.tone);
  assert.equal(
    ctx.renderer.toneMappingExposure,
    before.exposure,
    "user image settings never overridden",
  );
  look.release();
  assert.equal(camera.layers.mask, 9);
  assert.equal(camera.far, 320);
  assert.equal(child.layers.mask, 8);
  assert.equal(remote.mesh.layers.mask, 1);
  assert.equal(hands.layers.mask, 1);
  assert.equal(ctx.renderer.outputEncoding, before.encoding);
  assert.equal(ctx.renderer.shadowMap.type, before.type);
  assert.equal(ctx.renderer.shadowMap.enabled, before.shadow);
}
look.update(true, ctx.renderer, camera, player);
ctx.SETTINGS.shadowQuality = "off";
look.update(true, ctx.renderer, camera, player);
assert(!look.info().shadows);
look.release();
assert.equal(
  ctx.renderer.shadowMap.enabled,
  false,
  "changed settings persist after leaving",
);
ctx.SETTINGS.shadowQuality = "high";
profile = "battery";
look.update(true, ctx.renderer, camera, player);
assert.equal(look.materials.stone.bumpMap, null);
assert.equal(look.info().quality.clouds, 16);
assert.equal(ctx.renderer.shadowMap.enabled, false);
look.release();
profile = "custom";
look.update(true, ctx.renderer, camera, player);
const old = ctx.renderer;
ctx.renderer = render();
look.update(true, ctx.renderer, camera, player);
assert.equal(
  old.outputEncoding,
  THREE.LinearEncoding,
  "AA renderer replacement restores old owner",
);
assert.equal(camera.layers.mask, 4);
assert.equal(ctx.renderer.outputEncoding, THREE.sRGBEncoding);
look.release();
assert.equal(camera.layers.mask, 9);
assert.equal(ctx.renderer.outputEncoding, THREE.LinearEncoding);
let destroyed = 0;
child.geometry.addEventListener("dispose", () => destroyed++);
child.material.addEventListener("dispose", () => destroyed++);
look.update(true, ctx.renderer, camera, player);
look.dispose();
look.dispose();
resources.forEach((r) => r.dispose?.());
assert.equal(destroyed, 0, "never dispose borrowed native player assets");
assert.equal(child.layers.mask, 8);
assert.equal(camera.layers.mask, 9);
const policy = require("../public/assets/fz-sky-policy.js");
assert(policy.blocked(-14, -1398, false));
assert(policy.blocked(7.1, -1412, true));
assert(!policy.blocked(0, -1390, false));
assert(!policy.blocked(18, -1387, false));
console.log(
  "PASS sky visual: scoped layers/lights, PBR maps, bounded phone/battery quality, user image settings, repeated release, renderer replacement, owned-only disposal and support collisions.",
);
