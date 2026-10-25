const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const { JSDOM } = require("jsdom"),
  THREE = require("three");
const P = require("../public/assets/fz-building-policy.js");
for (const bad of [
  null,
  [],
  {},
  "bad",
  { bag: { popcorn: -1, juice: NaN }, rest: Infinity },
  { cases: ["bad"], tickets: [-1, 4, "0"] },
  { bag: { popcorn: 999999 }, receipts: ["x".repeat(1000)] },
]) {
  const s = P.clean(bad);
  assert.equal(s.version, 28);
  assert(s.rest >= 0 && s.rest <= 999);
  assert((s.bag.popcorn || 0) <= 999);
  assert(s.tickets.every((i) => i === 0 || i === 1));
  assert(s.receipts.every((x) => x.length <= 100));
}
const storage = new Map(),
  adapter = {
    getItem: (k) => storage.get(k),
    setItem: (k, v) => storage.set(k, v),
  };
const a = new P.Store(adapter, "Alice", "home"),
  b = new P.Store(adapter, "Bob", "home");
a.data.bag.popcorn = 3;
a.save();
assert.equal(new P.Store(adapter, "Alice", "home").data.bag.popcorn, 3);
assert.equal(b.data.bag.popcorn || 0, 0);
const denied = new P.Store(
  {
    getItem() {
      throw Error();
    },
    setItem() {
      throw Error();
    },
  },
  "x",
  "x",
);
assert(!denied.save());
for (const target of [1, 3, 0]) {
  const l = {
    y: target === 0 ? 15.6 : 0,
    from: 0,
    to: target,
    phase: "closing",
    elapsed: 0,
  };
  let previous = l.y;
  for (let i = 0; i < 600; i++) {
    P.liftStep(l, 0.05, 5.2);
    assert(Math.abs(l.y - previous) < 0.2, "continuous bounded lift velocity");
    previous = l.y;
  }
  assert.equal(l.phase, "open");
  assert(Math.abs(l.y - target * 5.2) < 1e-8);
}
assert(P.liftInside(19, 18));
assert(!P.liftInside(19, 13));
assert(P.liftDoorway(19, 14));
for (let f = 0; f < 3; f++) {
  const r = { floor: f, minX: -22, maxX: -16, minZ: 10, maxZ: 22 };
  for (let z = 10; z <= 22; z += 0.1) {
    const y = f * 5.2 + ((22 - z) / 12) * 5.2;
    assert(Math.abs(P.rampHeight(r, -19, z, y) - y) < 1e-8);
    assert.equal(P.rampHeight(r, 0, z, y), null);
  }
}
const dom = new JSDOM(
    '<body><div id="floorIndicator"></div><div id="moneyDisplay"></div></body>',
    { url: "https://game.test", runScripts: "outside-only" },
  ),
  w = dom.window,
  ctx = dom.getInternalVMContext();
w.THREE = THREE;
w.HTMLCanvasElement.prototype.getContext = function () {
  return new Proxy({}, { get: () => () => {} });
};
const run = (s) => vm.runInContext(s, ctx);
run(
  `const scene=new THREE.Scene(),INTERIOR_BASE={x:2000,z:2000};let interiorObjects=[],interiorColliders=[],interactables=[],npcs=[],isInsideBuilding=true,currentBuildingType='apartment',currentBuildingName='Жилой дом',currentFloor=0,maxFloors=4,interiorBounds=null,sittingOn=null;let localPlayer={mesh:new THREE.Group(),money:500},outsidePos={x:100,z:100},currentUser={username:'test'},cameraAngleH=0,cameraAngleV=0,velocity={y:0};const camera=new THREE.PerspectiveCamera();function showNotification(){}function buildInterior(){}function standUpFromSeat(){sittingOn=null;}function sitOnBench(e){sittingOn={spot:e.seat};localPlayer.mesh.position.set(e.seat.x,e.seat.y,e.seat.z);}function FZNativeCharacter(){const g=new THREE.Group();g.userData.head=new THREE.Group();g.add(g.userData.head);return g;}window.FZOpeningAvatar={refine(){},pose(){}};window.FZUI={playing:()=>true};window.FZPlay={release(){}};window.cameraMode='first';function doorCine(fn){fn()}function _exitBuildingNow(){};`,
);
for (const file of [
  "fz-building-policy",
  "fz-residence-tasks",
  "fz-building-kit",
  "fz-building-details",
  "fz-building-layouts",
  "fz-buildings",
])
  run(fs.readFileSync("../public/assets/" + file + ".js", "utf8"));
function at(x, y, z) {
  run(
    `localPlayer.mesh.position.set(INTERIOR_BASE.x+${x},${y},INTERIOR_BASE.z+${z});`,
  );
}
function tick(n = 30) {
  for (let i = 0; i < n; i++) w.FZBuildings.update(0.05);
}
function actions() {
  return run("interactables.filter(e=>e.building28)");
}
function placeAction(e) {
  at(e.position.x - 2000, e.position.y, e.position.z - 2000);
}
function use(e) {
  placeAction(e);
  assert(w.FZBuildings.interact(e));
}
const report = [];
for (const [type, name, floors] of [
  ["apartment", "Жилой дом", 4],
  ["house", "Дом", 2],
  ["cinema", "Кинотеатр", 1],
  ["bank", "Банк", 1],
  ["biz_bank", "Банк", 1],
  ["office", "Суд", 1],
  ["hospital", "Больница", 2],
  ["office", "Офисы", 2],
]) {
  run(
    `currentBuildingType=${JSON.stringify(type)};currentBuildingName=${JSON.stringify(name)};buildInterior(currentBuildingType);`,
  );
  tick(1);
  const info = w.FZBuildings.info();
  assert.equal(info.floors, floors);
  assert.equal(run("interiorObjects.length"), 1);
  assert.equal(
    w.FZBuildings.collision(2000, 2021),
    false,
    type + " " + name + " spawn clear",
  );
  run("interiorObjects[0]").traverse((o) => {
    assert(
      [...o.position.toArray(), ...o.scale.toArray()].every(Number.isFinite),
    );
    if (o.isInstancedMesh)
      assert([...o.instanceMatrix.array].every(Number.isFinite));
  });
  for (const e of actions().filter((e) => e.kind === "door"))
    e.door.open = true;
  tick();
  // Traverse actual collision model, independently on each floor. Stair boundaries are tested separately.
  for (let f = 0; f < floors; f++) {
    at(0, f * 5.2, 21);
    tick(1);
    const queue = [[0, 42]],
      seen = new Set(["0,42"]);
    let i = 0;
    while (i < queue.length) {
      const [x, z] = queue[i++];
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx,
          nz = z + dz,
          key = nx + "," + nz;
        if (seen.has(key) || nx < -52 || nx > 52 || nz < -50 || nz > 50)
          continue;
        if (w.FZBuildings.collision(2000 + nx * 0.5, 2000 + nz * 0.5)) continue;
        seen.add(key);
        queue.push([nx, nz]);
      }
    }
    const inaccessible = [];
    for (const e of actions().filter((e) => e.floor === f && !e.liftPanel)) {
      const x = e.position.x - 2000,
        z = e.position.z - 2000;
      // Must be usable from a reachable point on its side, not necessarily its anchor's exact center.
      if (
        !queue.some(
          ([gx, gz]) =>
            Math.hypot(gx * 0.5 - x, gz * 0.5 - z) < Math.min(e.range, 1.8),
        )
      )
        inaccessible.push(e.name + "@" + x + "," + z);
    }
    assert.deepEqual(inaccessible, [], type + "/" + f + " unreachable actions");
  }
  const seat = actions().find((e) => e.kind === "seat");
  if (seat) {
    use(seat);
    assert(run("!!sittingOn"));
    run("standUpFromSeat()");
  }
  if (info.lift) {
    at(19, 0, 18);
    assert(w.FZBuildings.requestLift(floors - 1));
    tick(600);
    assert(
      Math.abs(run("localPlayer.mesh.position.y") - (floors - 1) * 5.2) < 1e-7,
    );
    assert.equal(w.FZBuildings.info().lift.phase, "open");
    // Obstruction keeps cabin and landing door open, never moves a partial passenger.
    at(19, (floors - 1) * 5.2, 14);
    assert(w.FZBuildings.requestLift(0));
    tick(80);
    assert.equal(w.FZBuildings.info().lift.phase, "closing");
    assert(Math.abs(w.FZBuildings.info().lift.y - (floors - 1) * 5.2) < 1e-7);
    at(19, (floors - 1) * 5.2, 18);
    tick(600);
    assert(Math.abs(run("localPlayer.mesh.position.y")) < 1e-7);
    for (let f = 0; f < floors - 1; f++)
      for (let z = 21.9; z >= 10; z -= 0.1) {
        const y = f * 5.2 + ((22 - z) / 12) * 5.2;
        at(-19, y, z);
        assert(Math.abs(w.FZBuildings.ground() - y) < 1e-7);
        assert.equal(
          w.FZBuildings.collision(1981, 2000 + z),
          false,
          "stair path unblocked",
        );
      }
  }
  if (type === "cinema") {
    const snacks = actions().find((e) => e.kind === "snacks");
    use(snacks);
    w.document.querySelector('[data-action="popcorn"]').click();
    assert.equal(w.FZBuildings.info().data.bag.popcorn, 1);
    assert.equal(run("localPlayer.money"), 465);
    const bag = actions().find((e) => e.kind === "bag");
    use(bag);
    [...w.document.querySelectorAll("button")]
      .find((b) => b.textContent.includes("Использовать: Попкорн"))
      .click();
    assert.equal(w.FZBuildings.info().data.wrappers, 1);
    use(actions().find((e) => e.kind === "trash"));
    assert.equal(w.FZBuildings.info().data.wrappers, 0);
    run("localPlayer.money=0");
    use(snacks);
    w.document.querySelector('[data-action="popcorn"]').click();
    assert.equal(w.FZBuildings.info().data.bag.popcorn, 0, "no unpaid snack");
    run("localPlayer.money=500");
  }
  if (name === "Суд") {
    use(actions().find((e) => e.kind === "cases"));
    const click = (t) =>
      [...w.document.querySelectorAll("button")]
        .find((b) => b.textContent.includes(t))
        .click();
    click("Посылка");
    click("Принять");
    click("Перейти");
    click("Передать посылку");
    assert.equal(w.FZBuildings.info().data.cases.length, 1);
  }
  if (type === "apartment") {
    at(-8, 0, 0);
    run('window.cameraMode="third";camera.position.set(2000,3,2000)');
    w.FZBuildings.beforeRender();
    assert(
      run("camera.position.x") < 1996,
      "third-person camera remains on its side of apartment wall",
    );
    run('window.cameraMode="first"');
  }
  report.push({ type, name, ...info });
  w.FZBuildings.release();
  assert.equal(actions().length, 0);
  assert.equal(run("interiorObjects.length"), 0);
  assert.equal(w.document.querySelector("#fzBuildingPanel"), null);
  assert.equal(w.FZBuildings.info(), null);
}
console.log(
  "PASS v28 policy/storage, 8 layout variants, all-floor action reachability, doors, real lift carrying/obstruction, ramps, purchases/use/trash, hearings and lifecycle",
);
console.table(
  report.map((r) => ({
    type: r.type,
    name: r.name,
    floors: r.floors,
    doors: r.doors,
    seats: r.seats,
    actions: r.actions,
  })),
);
