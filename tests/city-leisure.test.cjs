const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const { JSDOM } = require("jsdom"),
  THREE = require("three");
const dom = new JSDOM("<body></body>", {
  url: "https://fantazia.test",
  runScripts: "outside-only",
  pretendToBeVisual: true,
});
const w = dom.window;
w.THREE = THREE;
w.HTMLCanvasElement.prototype.getContext = () =>
  new Proxy({}, { get: () => () => {} });
const run = (s) => vm.runInContext(s, dom.getInternalVMContext());
run(`let scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,1,.1,1000),localPlayer={mesh:new THREE.Object3D()},interactables=[],velocity={x:0,y:0,z:0},keys={},localCar=null,isInsideBuilding=false,isInFactory=false,isInBasement=false,cameraAngleH=.7,cameraAngleV=.3,currentUser={username:'tester'};
window.NEWCITY={x:3000,z:0,spawnX:3000,spawnZ:180,loaded:true};window.FZUI={playing:()=>true};window.FZ8SEA={active:()=>false,aboard:()=>false};localPlayer.mesh.position.set(3000,0,180);`);
for (const name of [
  "fz-city-spaces",
  "fz-city-urban",
  "fz-city-stream",
  "fz-city-leisure",
])
  run(
    fs.readFileSync(
      path.join(__dirname, "../public/assets/" + name + ".js"),
      "utf8",
    ),
  );
const api = w.FZLeisure,
  city = w.FZCITY,
  math = api.math;
assert.equal(math.meter(0), 0);
assert.equal(math.meter(1 / 0.65), 1);
assert.equal(math.meter(2 / 0.65), 0);
assert.equal(math.release(0.5).hit, true);
assert.equal(math.release(0.1).hit, false);
assert.equal(math.release(0.9).hit, false);
const a = { x: 1, y: 1.8, z: 12 },
  b = { x: 1, y: 3.05, z: 4 };
assert.deepEqual(JSON.parse(JSON.stringify(math.trajectory(a, b, 0, 0))), a);
const end = math.trajectory(a, b, 0, math.flight);
assert(Math.abs(end.y - b.y) < 1e-9);
assert.equal(end.z, b.z);
assert(
  math.trajectory(a, b, 0, math.flight - 0.05).y > end.y,
  "ball descends through rim",
);
for (let seed = 0; seed < 32; seed++) {
  const plan = w.FZCitySpaces.plan(seed, "homes");
  assert.deepEqual(
    JSON.parse(JSON.stringify(plan)),
    JSON.parse(JSON.stringify(w.FZCitySpaces.plan(seed, "homes"))),
  );
  assert(plan.pieces.length < 300);
  assert.equal(plan.entries.filter((e) => e.type === "sit_bench").length, 2);
  for (const c of plan.obstacles)
    assert(
      c.minX <= c.maxX &&
        c.minZ <= c.maxZ &&
        Object.values(c).every(Number.isFinite),
    );
  // Flood fill from the southern approach: every seat/court must be reachable.
  const blocked = (x, z) =>
    plan.obstacles.some(
      (c) =>
        x + 0.5 > c.minX &&
        x - 0.5 < c.maxX &&
        z + 0.5 > c.minZ &&
        z - 0.5 < c.maxZ,
    );
  const reached = new Set(["119,149"]),
    queue = [[119, 149]];
  while (queue.length) {
    const [x, z] = queue.shift();
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        nz = z + dz,
        k = nx + "," + nz;
      if (
        nx < 92 ||
        nx > 146 ||
        nz < 92 ||
        nz > 150 ||
        blocked(nx, nz) ||
        reached.has(k)
      )
        continue;
      reached.add(k);
      queue.push([nx, nz]);
    }
  }
  for (const e of plan.entries)
    assert(
      reached.has(Math.round(e.x) + "," + Math.round(e.z)),
      plan.kind + " entry is walkable",
    );
}
city.travel("east");
for (let n = 0; n < 20; n++) city.update();
assert.equal(new Set(city.places().map((p) => p.kind)).size, 4);
assert(run("interactables.filter(e=>e.cityLeisure).length<=75"));
const entry = run("interactables.find(e=>e.type==='city_basketball')");
assert(entry);
assert.equal(api.start(entry), false, "cannot start remotely");
run(
  "localPlayer.mesh.position.copy(interactables.find(e=>e.type==='city_basketball').position)",
);
const beforeBasketYaw = run("cameraAngleH");
assert(api.start(entry));
assert(api.modalOpen());
assert.equal(api.state().attempts, 0);
let ball = run("scene.getObjectByName('FZ_BASKETBALL')"),
  disposed = 0;
ball.geometry.addEventListener("dispose", () => disposed++);
ball.material.addEventListener("dispose", () => disposed++);
ball.material.map.addEventListener("dispose", () => disposed++);
for (let shot = 0; shot < 5; shot++) {
  for (let n = 0; n < 100; n++) {
    api.update(0.025);
    if (
      w.document.getElementById("fzBasketHint").textContent ===
      "Сейчас — центр!"
    )
      break;
  }
  w.document.getElementById("fzBasketShoot").click();
  assert.equal(api.state().state, "flight");
  w.document.getElementById("fzBasketShoot").click();
  for (let n = 0; n < 13; n++) api.update(0.1);
  assert.equal(api.state().attempts, shot + 1);
  assert.equal(api.state().score, shot + 1);
}
assert.equal(api.state().state, "done");
assert.equal(w.localStorage.getItem("fz.basket.v1:tester"), "5");
assert.equal(w.document.getElementById("fzBasketAgain").hidden, false);
api.close();
assert.equal(disposed, 3);
assert.equal(run("scene.getObjectByName('FZ_BASKETBALL')"), undefined);
assert.equal(run("cameraAngleH"), beforeBasketYaw, "restore the actual pre-activity city camera");
assert(api.start(entry));
w.document.getElementById("fzBasketShoot").click();
for (let n = 0; n < 13; n++) api.update(0.1);
assert.equal(api.state().score, 0, "off-centre release misses");
assert.equal(api.state().best, 5);
run("isInsideBuilding=true");
api.update(0.1);
assert.equal(api.state(), null);
assert(!api.modalOpen());
run("isInsideBuilding=false");
assert(api.directory());
w.document.querySelector(".leisure-place").click();
assert(!w.document.getElementById("fzCityRoute").hidden);
city.travel("west");
for (let n = 0; n < 20; n++) city.update();
assert(
  w.document.getElementById("fzCityRoute").hidden,
  "unloaded route cleared",
);
assert(run("interactables.filter(e=>e.cityLeisure).length<=75"));
run(
  "localPlayer.mesh.position.copy(interactables.find(e=>e.type==='city_basketball').position)",
);
assert(api.start(run("interactables.find(e=>e.type==='city_basketball')")));
run("scene=new THREE.Scene()");
city.update();
api.update(0.1);
assert.equal(api.state(), null);
run("window.FZUI.playing=()=>false");
assert.equal(api.directory(), false);
api.update(0.1);
assert(!api.modalOpen());
console.log(
  "PASS public spaces: deterministic layouts, reachable seats/courts, 5-shot scoring, misses, records, bounded interactions, GPU disposal, scene/interior/auth lifecycle.",
);
dom.window.close();
