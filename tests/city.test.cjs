const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const { JSDOM } = require("jsdom"),
  THREE = require("three");
const dom = new JSDOM('<body class="game-active fz-playing"></body>', {
    url: "https://fantazia.test",
    runScripts: "outside-only",
  }),
  w = dom.window,
  ctx = dom.getInternalVMContext();
w.THREE = THREE;
w.HTMLCanvasElement.prototype.getContext = () =>
  new Proxy({}, { get: () => () => {} });
const run = (s) => vm.runInContext(s, ctx);
run(`let scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,1,.1,1000),localPlayer={mesh:new THREE.Object3D()},interactables=[],velocity={x:1,y:1,z:1},keys={},localCar=null,isInsideBuilding=false,isInFactory=false,isInBasement=false;
window.NEWCITY={x:3000,z:0,spawnX:3000,spawnZ:180,loaded:true};window.FZUI={playing:()=>true};window.FZ8SEA={active:()=>false,aboard:()=>false};localPlayer.mesh.position.set(3000,0,180);`);
run(
  fs.readFileSync(
    require("node:path").join(__dirname, "../public/assets/fz-city-spaces.js"),
    "utf8",
  ),
);
run(
  fs.readFileSync(
    require("node:path").join(__dirname, "../public/assets/fz-city-urban.js"),
    "utf8",
  ),
);
run(
  fs.readFileSync(
    require("node:path").join(__dirname, "../public/assets/fz-city-stream.js"),
    "utf8",
  ),
);
const api = w.FZCITY;
const settle = () => {
  for (let i = 0; i < 20; i++) api.update();
  assert(api.info().chunks <= 25);
  assert(api.info().layoutCache <= 80);
};
assert.equal(api.info().size, 9520);
assert.equal(api.info().areaRatio, 100);
assert.equal(api.collision(3000, 180), null);
for (let round = 0; round < 3; round++)
  for (const d of api.info().districts) {
    assert(api.travel(d.id), d.id);
    settle();
    if (d.id === "center") continue;
    assert.equal(
      run(
        "FZCITY.collision(localPlayer.mesh.position.x,localPlayer.mesh.position.z)",
      ),
      false,
      "district spawn is clear",
    );
    const e = run("interactables.find(e=>e.cityChunk)");
    assert(e);
    assert.equal(
      api.collision(e.position.x, e.position.z),
      false,
      "entrance walkable",
    );
    assert.equal(
      api.collision(e.position.x, e.position.z - 5),
      true,
      "wall solid",
    );
    assert(run("interactables.filter(e=>e.cityChunk).length<=200"));
    for (const entry of run("interactables.filter(e=>e.cityChunk)")) {
      for (const offset of [0, 3, 8])
        assert.equal(
          api.collision(entry.position.x, entry.position.z + offset),
          false,
          "all doors/garden gates have a clear exit",
        );
    }
    assert(
      run(
        "scene.getObjectByName('FZ_CITY_STREAM').children.filter(g=>g.userData.crowd&&g.userData.crowd.visible).length<=3",
      ),
      "no more than 12 active ambient walkers",
    );
    assert(
      api.info().materials < 180 && api.info().geometries <= 7,
      "shared material/geometry budget: " + JSON.stringify(api.info()),
    );

    const root = run("scene.getObjectByName('FZ_CITY_STREAM')");
    assert(root.children.length <= 25);
    root.traverse((o) => {
      if (o.isInstancedMesh) {
        assert(o.count > 0);
        assert([...o.instanceMatrix.array].every(Number.isFinite));
      }
    });
  }
// Production masterplan determinism and reachable public frontage.
for (const landmark of w.FZUrban.specials) {
  const [i, j] = landmark.key.split(":").map(Number);
  const a = w.FZUrban.plan(i, j, "towers", 12345),
    b = w.FZUrban.plan(i, j, "towers", 12345);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert(a.plots.length < 8);
  assert(
    a.pieces.every((p) =>
      [p.x, p.y, p.z, p.w, p.h, p.d, p.rotation].every(Number.isFinite),
    ),
  );
}
for (const district of api.info().districts.filter((d) => d.id !== "center")) {
  api.travel(district.id);
  settle();
  const pos = run("localPlayer.mesh.position.clone()"),
    ox = 3000 + Math.floor((pos.x - 3000) / 238) * 238,
    oz = Math.floor(pos.z / 238) * 238;
  const side = 119,
    seen = new Uint8Array(side * side),
    queue = [4 + 14 * side];
  seen[queue[0]] = 1;
  for (let head = 0; head < queue.length; head++) {
    const id = queue[head],
      cx = id % side,
      cz = Math.floor(id / side);
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cx + dx,
        nz = cz + dz,
        nid = nx + nz * side;
      if (
        nx < 0 ||
        nz < 0 ||
        nx >= side ||
        nz >= side ||
        seen[nid] ||
        api.collision(ox + nx * 2, oz + nz * 2)
      )
        continue;
      seen[nid] = 1;
      queue.push(nid);
    }
  }
  const entries = run("interactables.filter(e=>e.cityChunk)").filter(
    (e) =>
      e.position.x >= ox &&
      e.position.x < ox + 238 &&
      e.position.z >= oz &&
      e.position.z < oz + 238,
  );
  for (const e of entries)
    assert(
      seen[
        Math.round((e.position.x - ox) / 2) +
          Math.round((e.position.z + 3 - oz) / 2) * side
      ],
      district.id + ": street-to-door route " + e.name,
    );
}
// First arrival is gated; it must not steal a return trip or repeat every frame.
api.travel("center");
run("window.FZ_CITY_ARRIVAL=true;window._loadingGate=true");
assert.equal(api.arrive(), false);
run("window._loadingGate=false");
assert.equal(api.arrive(), true);
assert.equal(run("localPlayer.mesh.position.x"), 4070);
assert.equal(run("localPlayer.mesh.position.z"), 678);
api.travel("center");
settle();
assert.equal(
  run("localPlayer.mesh.position.x"),
  3000,
  "manual return stays in original centre",
);
run(
  "localPlayer.mesh=new THREE.Object3D();localPlayer.mesh.position.set(3000,0,180);window.cine={}",
);
assert.equal(api.arrive(), false);
run("window.cine=null");
assert.equal(api.arrive(), true, "new player session can arrive again");
run("window.FZ_CITY_ARRIVAL=false");
api.travel("center");
settle();
assert.equal(run("camera.far"), 1000, "original view distance restored");
api.travel("east");
settle();
assert.equal(
  run("camera.far"),
  750,
  "distant old world is not rendered from new districts",
);
assert.equal(api.collision(3000 + 4760, 1000), true);
assert.equal(api.collision(3000 - 4760, 1000), true);
assert.equal(api.collision(3000, 4760), true);
const point = run("localPlayer.mesh.position.clone()");
run("isInsideBuilding=true");
api.update();
assert.equal(run("scene.getObjectByName('FZ_CITY_STREAM').visible"), false);
assert.equal(api.collision(point.x, point.z), null);
assert.equal(api.travel("center"), false);
run("isInsideBuilding=false");
run("localCar={}");
assert.equal(api.travel("center"), false);
run("localCar=null");
api.travel("east");
settle();
const old = run("scene");
run("scene=new THREE.Scene()");
api.update();
settle();
assert.equal(old.getObjectByName("FZ_CITY_STREAM"), undefined);
assert(run("interactables.filter(e=>e.cityChunk).length<=200"));
api.open();
assert.equal(w.document.getElementById("fzCityMap").hidden, false);
api.close();
assert.equal(w.document.getElementById("fzCityMap").hidden, true);
console.log(
  "PASS city: 10 districts, 100x envelope, deterministic collision/entrances, <=25 chunks/200 entries/80 cached layouts, interior/car guards, scene replacement and menu.",
);
dom.window.close();
