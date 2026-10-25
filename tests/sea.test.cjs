const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm'),
  assert = require('node:assert/strict');
const { JSDOM } = require('jsdom'),
  THREE = require('three'),
  acorn = require('acorn');
const index = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8'),
  funcs = {};
const wanted = ['checkCollision', '_fzGroundY', 'checkInteractables'];
for (const m of index.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
  if (!m[1].trim()) continue;
  for (const n of acorn.parse(m[1], { ecmaVersion: 'latest' }).body)
    if (n.type === 'FunctionDeclaration' && wanted.includes(n.id.name))
      funcs[n.id.name] = m[1].slice(n.start, n.end);
}
assert.equal(Object.keys(funcs).length, 3);
function env(storage) {
  const dom = new JSDOM('<body><div id="interactHint"></div><button id="enterBuildingBtn"></button></body>', {
      url: 'https://sea.test',
      runScripts: 'outside-only',
    }),
    w = dom.window;
  w.THREE = THREE;
  w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {} });
  const run = (s) => vm.runInContext(s, dom.getInternalVMContext());
  run(`let scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(65,1,.1,350),localPlayer={mesh:new THREE.Object3D()},velocity={x:0,y:0,z:0},keys={};
 let isInsideBuilding=false,isInFactory=false,isInBasement=false,sittingOn=null,interactables=[],nearestInteractable=null,interiorColliders=[],interiorBounds=null,streetColliders=[],buildings=[],basementColliders=[];
 const CONFIG={WORLD_SIZE:1200},INTERIOR_BASE={x:2000,z:2000},BASEMENT_BASE={x:0,z:0},FACTORY_BASE={x:0,z:0};
 let currentFloor=0;const notifications=[];function showNotification(t){notifications.push(t)};localPlayer.mesh.position.set(3010,0,180);
 scene.fog=new THREE.Fog(0xabcabc,100,500);scene.background=new THREE.Color(0xabcabc);`);
  Object.values(funcs).forEach(run);
  if (storage) w.localStorage.setItem('fz8sea_v1', storage);
  run(fs.readFileSync(path.join(__dirname, '../public/assets/fz-v8sea.js'), 'utf8'));
  const api = w.FZ8SEA;
  function point(x, z, y) {
    run(`localPlayer.mesh.position.set(${6000 + x},${y === undefined ? 2 : y},${z})`);
  }
  function tick(t) {
    for (let i = 0; i < Math.ceil(t / 0.05); i++) api.update(0.05);
  }
  function find(id) {
    return run(`interactables.find(s=>s.id===${JSON.stringify(id)}&&s.fz8sea)`);
  }
  function use(id) {
    const s = find(id);
    assert(s, 'spot ' + id);
    run(`localPlayer.mesh.position.set(${s.position.x},${s.position.y},${s.position.z})`);
    api.interact(s);
    return s;
  }
  return { dom, w, run, api, point, tick, find, use };
}
const e = env(),
  { api, run, point, tick, use, find, w } = e;
assert.equal(api.enter(), true);
assert(api.active());
const count = run('scene.children.length');
assert.equal(api.enter(), true);
assert.equal(run('scene.children.length'), count);
assert.equal(run('_fzGroundY()'), 2);
assert.equal(api.collision(5910, 12), false);
assert.equal(api.collision(6000, 0), true, 'sea is not walkable');
// Both bridges are traversable at every 0.5m, and ground heights vary continuously.
for (const [id, points] of [
  ['suspension', Array.from({ length: 269 }, (_, i) => [-71 + i * 0.5, -49])],
  ['footbridge', Array.from({ length: 123 }, (_, i) => [116, 62 + i * 0.5])],
]) {
  let prior = null;
  for (const [x, z] of points) {
    point(x, z);
    assert.equal(run(`checkCollision(${6000 + x},${z})`), false, id + ': ' + x + ',' + z);
    const y = run('_fzGroundY()');
    assert(Number.isFinite(y) && y >= 2 && y <= 6);
    if (prior !== null) assert(Math.abs(y - prior) < 0.2, id + ' no height steps');
    prior = y;
  }
}
point(0, -49, 6);
assert.equal(api.collision(6000, -55), true, 'bridge guard edge');
// Pier ramp does not suddenly step up underneath the player.
let prior = 2;
for (let x = -84; x <= -72; x += 0.25) {
  point(x, 32);
  const y = run('_fzGroundY()');
  assert(Math.abs(y - prior) <= 0.1, 'smooth pier ramp ' + x + ' ' + prior + ' -> ' + y);
  prior = y;
}
// Every shore interaction is reachable using native collision and analytic ground.
for (const id of ['arrival', 'return', 'west', 'east', 'cargo', 'yacht', 'fish', 'beacon', 'manifest']) {
  const s = find(id);
  point(s.position.x - 6000, s.position.z, s.position.y);
  assert.equal(
    run('checkCollision(localPlayer.mesh.position.x,localPlayer.mesh.position.z)'),
    false,
    'blocked ' + id,
  );
  assert.notEqual(run('_fzGroundY()'), null);
}
// All three land masses and all shore actions connect without crossing water.
point(-92, 12);
const gridStep = 2,
  queue = [[-46, 6]],
  seen = new Set(['-46,6']);
let cursor = 0;
while (cursor < queue.length) {
  const [x, z] = queue[cursor++];
  for (const [dx, dz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const nx = x + dx,
      nz = z + dz,
      key = nx + ',' + nz;
    if (
      seen.has(key) ||
      Math.abs(nx) > 112 ||
      Math.abs(nz) > 87 ||
      api.collision(6000 + nx * gridStep, nz * gridStep)
    )
      continue;
    seen.add(key);
    queue.push([nx, nz]);
  }
}
for (const id of ['arrival', 'return', 'west', 'east', 'cargo', 'yacht', 'fish', 'beacon', 'manifest']) {
  const s = find(id);
  assert(
    queue.some(([x, z]) => Math.hypot(6000 + x * gridStep - s.position.x, z * gridStep - s.position.z) < 2.2),
    'shore path: ' + id,
  );
}
// No remote boarding; repeated boarding does not replace the original embarkation.
point(-91, 12);
api.interact(find('west'));
assert.equal(api.aboard(), false);
use('west');
assert.equal(api.info().aboard, 'ferry');
assert.equal(run('_fzGroundY()'), 3.2);
let p0 = run('localPlayer.mesh.position.clone()');
tick(14);
assert.equal(api.info().state, 'sailing');
assert.equal(api.disembark(), false);
assert(
  run('localPlayer.mesh.position.distanceTo(new THREE.Vector3(' + p0.x + ',' + p0.y + ',' + p0.z + '))') > 1,
);
assert.equal(
  run('checkCollision(localPlayer.mesh.position.x,localPlayer.mesh.position.z)'),
  false,
  'moving passenger still on deck',
);
// Walk on moving deck (local sideways motion), then complete one voyage.
run('localPlayer.mesh.position.x+=.15');
tick(0.2);
for (let i = 0; i < 1200 && !(api.info().state === 'dwell' && api.info().port === 1); i++) tick(0.05);
assert.equal(api.info().port, 1);
assert.equal(api.info().state, 'dwell');
assert.equal(api.disembark(), true);
assert.equal(api.info().stats.voyages, 1);
assert.equal(api.info().aboard, null);
assert.equal(
  run('checkCollision(localPlayer.mesh.position.x,localPlayer.mesh.position.z)'),
  false,
  'disembark safe',
);
// Static ships: hull limits, containers, cargo scanning; return to exact boarding spot.
use('cargo');
assert.equal(api.info().aboard, 'cargo');
assert.equal(run('_fzGroundY()'), 4.8);
for (const id of ['tag0', 'tag1', 'tag2']) {
  const s = find(id);
  point(s.position.x - 6000, s.position.z, s.position.y);
  assert.equal(
    run('checkCollision(localPlayer.mesh.position.x,localPlayer.mesh.position.z)'),
    false,
    id + ' approachable',
  );
  api.interact(s);
  api.interact(s);
}
assert.equal(api.info().stats.cargo.length, 3);
assert.equal(api.disembark(), true);
use('yacht');
assert.equal(api.info().aboard, 'yacht');
assert.equal(run('_fzGroundY()'), 2.7);
assert.equal(run('checkCollision(localPlayer.mesh.position.x,localPlayer.mesh.position.z)'), false);
assert.equal(api.disembark(), true);
// Fishing completion, anti-spam cooldown, cancellation, progress persists.
use('fish');
tick(8.2);
assert.equal(api.info().stats.fish, 1);
use('fish');
tick(8.2);
assert.equal(api.info().stats.fish, 1);
tick(20);
use('fish');
point(110, 0);
tick(10);
assert.equal(api.info().stats.fish, 1);
use('beacon');
assert.equal(api.info().stats.beacon, true);
const stats = w.localStorage.getItem('fz8sea_v1');
assert(stats);
// Modal keyboard interaction and native nearest-target filtering.
api.map();
assert(!w.document.getElementById('fzSeaModal').hidden);
w.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
assert(w.document.getElementById('fzSeaModal').hidden);
point(0, 0);
run('checkInteractables()');
assert.equal(run('nearestInteractable'), null, 'disabled ship spots not selected');
// State is owned only in this region and must never override the city/interiors.
assert.equal(api.leave(), true);
assert.equal(api.collision(0, 0), null);
assert.equal(api.ground(), null);
assert.equal(run('localPlayer.mesh.position.x'), 3010);
assert.equal(run('localPlayer.mesh.position.z'), 180);
assert.equal(run('camera.far'), 350);
assert.equal(run('scene.fog.color.getHex()'), 0xabcabc);
for (let i = 0; i < 5; i++) {
  api.enter();
  tick(0.1);
  api.leave();
  assert.equal(run('scene.children.length'), count);
}
run('isInsideBuilding=true');
assert.equal(api.enter(), false);
assert.equal(api.ground(), null);
run('isInsideBuilding=false');
// Validate geometry and static instancing, with real Three.js matrices.
let meshes = 0;
run('scene').traverse((o) => {
  if (o.isMesh) {
    meshes++;
    assert(o.material && o.material.isMaterial);
    if (o.isInstancedMesh) for (const v of o.instanceMatrix.array) assert(Number.isFinite(v));
  }
});
const fresh = env(stats);
assert.deepEqual(JSON.parse(JSON.stringify(fresh.api.info().stats)), JSON.parse(stats));
fresh.dom.window.close();
const malformed = env('{"fish":-5,"voyages":"NaN","cargo":[1,1,99,"2"],"beacon":"yes"}');
assert.equal(malformed.api.info().stats.fish, 0);
assert.equal(malformed.api.info().stats.voyages, 0);
assert.equal(malformed.api.info().stats.cargo.length, 1);
malformed.dom.window.close();
console.log(
  'PASS sea: bridges, continuous heights, pier ramps, shore actions, hull collisions, ferry voyage, static ships, fishing, storage, return and isolation.',
  { meshes, instances: api.info().instances, stats: api.info().stats },
);
e.dom.window.close();
