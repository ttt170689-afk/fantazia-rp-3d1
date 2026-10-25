// Extract actual native functions rather than a parallel implementation.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const acorn = require("acorn"),
  { JSDOM } = require("jsdom");
const html = fs.readFileSync("../public/index.html", "utf8"),
  nodes = new Map();
for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
  if (!m[1].trim()) continue;
  for (const n of acorn.parse(m[1], { ecmaVersion: "latest" }).body) {
    if (n.type === "FunctionDeclaration")
      nodes.set(n.id.name, m[1].slice(n.start, n.end));
    if (n.type === "VariableDeclaration")
      for (const d of n.declarations)
        if (d.id.name === "SETTINGS")
          nodes.set("SETTINGS", m[1].slice(d.init.start, d.init.end));
  }
}
const dom = new JSDOM(html, { url: "https://test.invalid" });
const defaults = vm.runInNewContext("(" + nodes.get("SETTINGS") + ")");
function settings(saved) {
  const context = {
    SETTINGS: structuredClone(defaults),
    CONFIG: {},
    window: { innerWidth: 1200 },
    document: dom.window.document,
    localStorage: { getItem: () => saved },
    navigator: { userAgent: "Test desktop" },
  };
  vm.createContext(context);
  vm.runInContext(
    nodes.get("loadSavedSettings") + ";loadSavedSettings()",
    context,
  );
  return context.SETTINGS;
}
const s = settings(
  JSON.stringify({
    fpsCap: 30,
    fov: 10000,
    mouseSens: -3,
    localRange: 999,
    renderScale: 400,
    shadowQuality: "invalid",
    fog: "false",
    nav: false,
    menuHidden: ["jobs", 12, null],
    admin: true,
    camMode: "first",
  }),
);
assert.equal(s.fpsCap, 30);
assert.equal(s.fov, 100);
assert.equal(s.mouseSens, 1);
assert.equal(s.localRange, 80);
assert.equal(s.renderScale, defaults.renderScale);
assert.equal(s.shadowQuality, defaults.shadowQuality);
assert.equal(s.fog, true);
assert.equal(s.nav, false);
assert.equal(s.camMode, "first");
assert(!("admin" in s));
assert.equal(s.menuHidden.join(","), "jobs");
assert.equal(settings("{bad json").fpsCap, defaults.fpsCap);
assert.equal(settings('{"fpsCap":null}').fpsCap, defaults.fpsCap);
let ratio = 1.5;
const c = {
  SETTINGS: { dynRes: true, renderScale: 1.5, fpsCap: 30 },
  document: { hidden: false, body: { classList: { contains: () => true } } },
  window: {},
  renderer: { setPixelRatio: (r) => (ratio = r) },
  _dynScale: null,
};
vm.createContext(c);
vm.runInContext(nodes.get("updateDynamicRes"), c);
c.updateDynamicRes(30);
assert.equal(ratio, 1.5);
c.updateDynamicRes(10);
assert.equal(ratio, 1.25);
c.updateDynamicRes(30);
assert.equal(ratio, 1.5);
c.document.hidden = true;
c.updateDynamicRes(1);
assert.equal(ratio, 1.5);
c.document.hidden = false;
c.FZPlay = c.window.FZPlay = { managed: () => true };
c.updateDynamicRes(1);
assert.equal(ratio, 1.5);
const loop = nodes.get("animate");
assert.equal((loop.match(/updateDayNight\(delta\)/g) || []).length, 1);
assert(!loop.includes("Math.floor(animationTime * 60) % 5"));
assert(loop.includes("_gameLoopStarted"));
assert(!/\bcanvas\s*\{[^}]*100dvh\s*!important/.test(html));
dom.window.close();
console.log(
  "PASS native settings whitelist/bounds, malformed storage, target-aware legacy resolution, single day/night update and scoped mobile canvas CSS",
);
