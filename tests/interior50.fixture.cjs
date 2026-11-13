"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("./node_modules/jsdom");
const THREE = require("./node_modules/three");
const files = [
  "fz-building-policy",
  "fz-residence-tasks",
  "fz-building-kit",
  "fz-building-details",
  "fz-interior50-policy",
  "fz-interior50-catalog",
  "fz-interior50-props",
  "fz-interior50-layouts",
  "fz-interior50-civic",
  "fz-interior50-route",
  "fz-interior50-ui",
  "fz-interior50",
  "fz-building-layouts",
  "fz-buildings",
];
function create() {
  const dom = new JSDOM(
    '<body class="game-active"><div id="floorIndicator"></div><div id="moneyDisplay"></div><div id="interiorHUD"></div><button id="originalFocus">Открыть</button></body>',
    {
      url: "https://game.test",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    },
  );
  const w = dom.window;
  w.THREE = THREE;
  w.HTMLCanvasElement.prototype.getContext = function () {
    return new Proxy({}, { get: () => () => {} });
  };
  w.HTMLElement.prototype.getClientRects = () => [
    { x: 0, y: 0, width: 40, height: 40 },
  ];
  const context = dom.getInternalVMContext();
  const run = (code) => vm.runInContext(code, context);
  run(`
    const scene = new THREE.Scene();
    const INTERIOR_BASE = { x: 2000, z: 2000 };
    let interiorObjects = [], interiorColliders = [], interactables = [], npcs = [];
    let isInsideBuilding = true, currentBuildingType = 'apartment', currentBuildingName = 'Дом';
    let currentFloor = 0, maxFloors = 4, interiorBounds = null, sittingOn = null;
    let localPlayer = { mesh: new THREE.Group(), money: 500, health: 73 };
    let outsidePos = { x: 100, y: 0, z: 100 }, currentUser = { username: 'test', isGuest: true };
    let cameraAngleH = 0, cameraAngleV = 0, velocity = { y: 0 };
    let notifications = [], bankOpened = 0, releasedInput = 0;
    const camera = new THREE.PerspectiveCamera();
    function showNotification(text) { notifications.push(text); }
    function buildInterior() {}
    function standUpFromSeat() { sittingOn = null; }
    function sitOnBench(e) {
      sittingOn = { spot: e.seat };
      localPlayer.mesh.position.set(e.seat.x, e.seat.y, e.seat.z);
    }
    function FZNativeCharacter() {
      const g = new THREE.Group();
      g.userData.head = new THREE.Group();
      g.add(g.userData.head);
      return g;
    }
    window.FZOpeningAvatar = { refine() {}, pose() {} };
    window.FZUI = { playing: () => true };
    window.FZPlay = { release() { releasedInput++; } };
    window.FZSound = { effect() {} };
    window.FZ7_open = name => { if (name === 'bank') bankOpened++; };
    window.cameraMode = 'first';
    function doorCine(fn) { fn(); }
    function _exitBuildingNow() { FZBuildings.release(); isInsideBuilding = false; }
  `);
  for (const file of files)
    run(
      fs.readFileSync(
        path.resolve(__dirname, "../public/assets/" + file + ".js"),
        "utf8",
      ),
    );
  function enter(type = "apartment", name = type) {
    run(
      `isInsideBuilding = true; currentBuildingType = ${JSON.stringify(type)}; currentBuildingName = ${JSON.stringify(name)}; buildInterior(currentBuildingType);`,
    );
    tick(1);
  }
  function at(x, y, z) {
    run(`localPlayer.mesh.position.set(2000 + ${x}, ${y}, 2000 + ${z});`);
  }
  function tick(count = 30, dt = 0.05) {
    for (let i = 0; i < count; i++) w.FZBuildings.update(dt);
  }
  function actions() {
    return run("interactables.filter(e => e.building28)");
  }
  function use(e) {
    if (!e) throw Error("missing action");
    at(e.position.x - 2000, e.position.y, e.position.z - 2000);
    return w.FZBuildings.interact(e);
  }
  function command(id, extra = () => true) {
    return actions().find((e) => e.command50 === id && extra(e));
  }
  function click(id) {
    const el = w.document.querySelector('[data-fz50="' + id + '"]');
    if (!el || el.disabled) throw Error("missing enabled button " + id);
    el.click();
  }
  function info() {
    return JSON.parse(JSON.stringify(w.FZInterior50.info()));
  }
  function shutdown() {
    w.FZBuildings.release();
    dom.window.close();
  }
  return {
    dom,
    w,
    run,
    enter,
    at,
    tick,
    actions,
    use,
    command,
    click,
    info,
    shutdown,
  };
}
module.exports = { create, files };
