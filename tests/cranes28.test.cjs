const assert = require("node:assert/strict"),
  vm = require("node:vm"),
  fs = require("node:fs"),
  THREE = require("three"),
  { JSDOM } = require("jsdom");
const dom = new JSDOM("<body></body>", {
    url: "https://game.test",
    pretendToBeVisual: true,
    runScripts: "outside-only",
  }),
  w = dom.window,
  ctx = dom.getInternalVMContext();
w.THREE = THREE;
w.HTMLElement.prototype.setPointerCapture = () => {};
const run = (s) => vm.runInContext(s, ctx);
run(
  `let scene=new THREE.Scene(),interactables=[],localPlayer={mesh:new THREE.Group()},sittingOn=null,isInsideBuilding=false,isInFactory=false,isInBasement=false,localCar=null,keys={},velocity={y:0},isGrounded=true,cameraAngleH=0,cameraAngleV=0;window.cameraMode='first';window.FZUI={playing:()=>true};window.FZTouch={blocked:()=>false};function showNotification(){}function standUpFromSeat(){sittingOn=null;}`,
);
run(fs.readFileSync("../public/assets/fz-cranes.js", "utf8"));
const tick = (n) => {
  for (let i = 0; i < n; i++) w.FZCranes.update(0.05);
};
const point = (site, x, y, z) =>
  new THREE.Vector3(x, y, z)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), site.rot)
    .add(new THREE.Vector3(site.x, 0, site.z));
function place(p) {
  run(`localPlayer.mesh.position.set(${p.x},${p.y},${p.z});`);
}
for (const [i, angle] of [0, 0.7, 1.3, Math.PI].entries())
  w._mkCrane(100 + i * 60, 150, angle);
assert.equal(w.FZCranes.info().count, 4);
assert.equal(run("interactables.length"), 12);
run("scene").traverse((o) => {
  assert(
    [...o.position.toArray(), ...o.scale.toArray()].every(Number.isFinite),
  );
  if (o.isInstancedMesh)
    assert([...o.instanceMatrix.array].every(Number.isFinite));
});
const entries = run("interactables.filter(e=>e.kind==='ladder')");
for (const entry of entries) {
  const site = w.FZCranes.info().sites[entries.indexOf(entry)];
  place(new THREE.Vector3(-100, 0, -100));
  w.FZCranes.interact(entry);
  assert(!w.FZCranes.active(), "cannot climb remotely");
  place(entry.position);
  w.FZCranes.interact(entry);
  assert(w.FZCranes.locked());
  run("keys.KeyW=true");
  let old = 0;
  for (let i = 0; i < 200; i++) {
    w.FZCranes.update(0.05);
    const y = run("localPlayer.mesh.position.y");
    assert(y >= old - 1e-8 && y - old <= 0.150001);
    old = y;
  }
  run("keys.KeyW=false");
  assert.equal(w.FZCranes.info().rider.mode, "deck");
  assert(Math.abs(run("localPlayer.mesh.position.y") - 28) < 1e-8);
  assert(!w.FZCranes.locked());
  for (let z = 3; z < 21; z += 0.5) {
    const p = point(site, 0, 28, z);
    assert.equal(w.FZCranes.collision(p.x, p.z), false, "walkable jib center");
  }
  for (const x of [-3, 3]) {
    const p = point(site, x, 28, 12);
    assert.equal(w.FZCranes.collision(p.x, p.z), true, "rail blocks side fall");
  }
  const far = point(site, 0, 28, 25);
  assert(w.FZCranes.collision(far.x, far.z));
  // Controls work only at the cabin, and clamp cable/trolley travel.
  place(point(site, 0, 28, 12));
  const buttons = [...w.document.querySelectorAll("#fzCraneControls button")];
  buttons.find((b) => b.textContent === "Крюк ↓").click();
  assert.equal(w.FZCranes.info().sites[entries.indexOf(entry)].hook, 12);
  place(point(site, 0, 28, -0.4));
  for (let i = 0; i < 50; i++)
    buttons.find((b) => b.textContent === "Крюк ↓").click();
  assert.equal(w.FZCranes.info().sites[entries.indexOf(entry)].hook, 23);
  for (let i = 0; i < 50; i++)
    buttons.find((b) => b.textContent === "Тележка →").click();
  assert.equal(w.FZCranes.info().sites[entries.indexOf(entry)].trolley, 20);
  const down = run("interactables").find(
    (e) => e.crane === entry.crane && e.kind === "down",
  );
  place(down.position);
  w.FZCranes.interact(down);
  run("keys.KeyS=true");
  tick(200);
  run("keys.KeyS=false");
  assert(!w.FZCranes.active());
  assert.equal(w.document.querySelector("#fzCraneControls"), null);
  assert.equal(run("localPlayer.mesh.position.y"), 0);
}
// Touch hold does not continue after pointer cancellation or a hidden tab.
place(entries[0].position);
w.FZCranes.interact(entries[0]);
const up = w.document.querySelector("#fzCraneControls button");
up.dispatchEvent(new w.MouseEvent("pointerdown", { bubbles: true }));
tick(10);
const y = run("localPlayer.mesh.position.y");
assert(y > 0);
up.dispatchEvent(new w.MouseEvent("pointercancel", { bubbles: true }));
tick(10);
assert.equal(run("localPlayer.mesh.position.y"), y);
up.dispatchEvent(new w.MouseEvent("pointerdown", { bubbles: true }));
w.dispatchEvent(new w.Event("blur"));
tick(10);
assert.equal(run("localPlayer.mesh.position.y"), y);
w.FZCranes.release();
// World replacement releases exactly the resources allocated by these cranes.
const resources = new Set();
run("scene").traverse((o) => {
  if (o.geometry) resources.add(o.geometry);
  if (o.material) resources.add(o.material);
});
let disposed = 0;
resources.forEach((r) => r.addEventListener("dispose", () => disposed++));
run("scene=new THREE.Scene()");
w._mkCrane(500, 500, 0);
assert.equal(disposed, resources.size);
assert.equal(w.FZCranes.info().count, 1);
assert.equal(run("interactables.length"), 3);
w.FZCranes.dispose();
w.FZCranes.dispose();
assert.equal(run("scene.children.length"), 0);
assert.equal(run("interactables.length"), 0);
console.log(
  "PASS cranes28: four rotations, bounded ladder motion, guards, full catwalk, cabin proximity, hook/trolley clamps, touch cancel, world replacement and owned disposal",
);
