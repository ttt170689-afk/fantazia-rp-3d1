const assert = require("node:assert/strict"),
  vm = require("node:vm"),
  fs = require("node:fs"),
  THREE = require("three");
const ctx = {
  THREE,
  document: { hidden: false },
  INTERIOR_BASE: { x: 2000, z: 2000 },
  localPlayer: { mesh: new THREE.Object3D() },
  FZUI: { playing: () => true },
  console,
};
ctx.window = ctx;
let target = null,
  viewport = new THREE.Vector4(10, 20, 800, 600),
  scissor = new THREE.Vector4(4, 5, 400, 300),
  scissorTest = true,
  color = new THREE.Color(0x123456),
  alpha = 0.4,
  calls = 0,
  fail = false;
ctx.renderer = {
  autoClear: false,
  getRenderTarget: () => target,
  setRenderTarget: (t) => (target = t),
  getViewport: (v) => v.copy(viewport),
  setViewport(...args) {
    viewport = args.length === 1 ? args[0].clone() : new THREE.Vector4(...args);
  },
  getScissor: (v) => v.copy(scissor),
  setScissor: (v) => (scissor = v.clone()),
  getScissorTest: () => scissorTest,
  setScissorTest: (b) => (scissorTest = b),
  getClearColor: (c) => c.copy(color),
  getClearAlpha: () => alpha,
  setClearColor(c, a) {
    color = c.clone();
    alpha = a;
  },
  render(world, camera) {
    assert(world.isScene);
    assert(camera.isPerspectiveCamera);
    assert(
      camera.userData.fzOpeningPass,
      "separate film pass bypasses the city compositor",
    );
    calls++;
    if (fail) throw Error("simulated render failure");
  },
};
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync("../public/assets/fz-cinema-film.js", "utf8"),
  ctx,
);
function visit() {
  return {
    screens: [0, 1].map((i) => ({
      film: "Film " + i,
      time: 0,
      paused: false,
      screen: {
        mesh: new THREE.Mesh(
          new THREE.PlaneGeometry(16, 9),
          new THREE.MeshBasicMaterial(),
        ),
      },
    })),
  };
}
const film = ctx.FZCinemaFilm,
  k = visit();
film.prepare(k);
ctx.localPlayer.mesh.position.set(2000, 0, 2020);
film.render(k);
assert.equal(calls, 2, "one initial poster frame per screen");
assert.equal(target, null);
assert.deepEqual(viewport.toArray(), [10, 20, 800, 600]);
assert.deepEqual(scissor.toArray(), [4, 5, 400, 300]);
assert.equal(scissorTest, true);
assert.equal(alpha, 0.4);
assert.equal(color.getHex(), 0x123456);
assert.equal(ctx.renderer.autoClear, false);
for (let i = 0; i < 20; i++) {
  k.screens.forEach((s) => (s.time += 0.1));
  film.render(k);
}
assert.equal(calls, 2, "offscreen hall does not render repeatedly");
ctx.localPlayer.mesh.position.set(1987, 0, 1997);
film.render(k);
assert.equal(calls, 3);
film.render(k);
assert.equal(calls, 3, "same film tick is reused");
k.screens[0].time += 0.1;
film.render(k);
assert.equal(calls, 4);
ctx.document.hidden = true;
k.screens[0].time += 1;
film.render(k);
assert.equal(calls, 4, "hidden tab does not draw");
ctx.document.hidden = false;
const allocated = k.screens.map((s) => s.screen.mesh.material.map);
assert(allocated.every((t) => t.isTexture));
// Restore caller state even if a renderer fails mid-pass.
fail = true;
k.screens[0].time += 0.1;
assert.throws(() => film.render(k), /simulated/);
assert.equal(target, null);
assert.deepEqual(viewport.toArray(), [10, 20, 800, 600]);
assert.deepEqual(scissor.toArray(), [4, 5, 400, 300]);
assert.equal(ctx.renderer.autoClear, false);
fail = false;
film.release();
assert.equal(film.info().length, 0);
film.release();
film.prepare(visit());
assert.equal(film.info().length, 2);
film.release();
console.log(
  "PASS film28: two real scenes, fixed render targets, offscreen/hidden budget, same-tick reuse, compositor bypass, renderer-state restoration on failure and restart",
);
