// ═══════════════════════════════════════════════════════════════════════════
//  ЭКСПОРТ ДАННЫХ ИГРЫ В JSON ДЛЯ UNITY
//  Вытаскивает из живого JS-кода: косметику (206 шт), работы, товары,
//  константы мира, этажи ТЦ. Всё это Unity читает из StreamingAssets —
//  переписывать вручную 206 предметов не нужно.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'Assets', 'StreamingAssets');
fs.mkdirSync(OUT, { recursive: true });

function save(name, obj) {
  const p = path.join(OUT, name);
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
  const n = Array.isArray(obj) ? obj.length : Object.keys(obj).length;
  console.log('  ' + name.padEnd(22) + n + ' записей');
}

// ── 1. КОСМЕТИКА: исполняем модуль с заглушкой THREE ──
function extractCosmetics() {
  function G() { return {}; }
  const T = {
    MeshStandardMaterial: p => p, MeshLambertMaterial: p => p,
    Mesh: function () {
      return { position: { set() {}, x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 },
               scale: { set() {} }, userData: {}, add() {} };
    },
    Group: function () { return { add() {}, children: [], position: { set() {} }, rotation: {} }; },
    CylinderGeometry: G, SphereGeometry: G, BoxGeometry: G, ConeGeometry: G,
    TorusGeometry: G, CircleGeometry: G, OctahedronGeometry: G, PlaneGeometry: G
  };
  const win = { THREE: T, console: { log() {}, warn() {} } };
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'fz52-cosmetics.js'), 'utf8');
  new Function('window', 'THREE', 'console', src)(win, T, { log() {}, warn() {} });
  const C = win.FZ_COSMETICS;
  return {
    items: C.ITEMS.map(i => ({
      id: i.id, name: i.name, emoji: i.emoji, type: i.type,
      rarity: i.rarity, coinPrice: i.coinPrice,
      slot: i.cfg.slot || 'head',
      color: i.cfg.color !== undefined ? i.cfg.color : 0xffffff,
      size: i.cfg.size !== undefined ? i.cfg.size : 1,
      glow: i.cfg.glow || 0,
      emissive: i.cfg.emissive || 0,
      metal: i.cfg.metal !== undefined ? i.cfg.metal : -1,
      // доп. параметры архетипов
      band: i.cfg.band || 0, gem: i.cfg.gem || 0, lens: i.cfg.lens || 0,
      accent: i.cfg.accent || 0, pom: i.cfg.pom || 0, points: i.cfg.points || 0,
      visor: i.cfg.visor || 0, crest: i.cfg.crest || 0, eyes: i.cfg.eyes || 0,
      pendant: i.cfg.pendant || 0, segments: i.cfg.segments || 0,
      rings: i.cfg.rings || 0, spin: i.cfg.spin || 0, opacity: i.cfg.opacity || 0,
      inner: i.cfg.inner || 0, tips: i.cfg.tips || 0, spike: i.cfg.spike || 0,
      buckle: i.cfg.buckle || 0, collar: i.cfg.collar || 0, shape: i.cfg.shape || '',
      frame: i.cfg.frame || 0
    })),
    rarities: Object.keys(C.RARITY).map(k => ({
      id: k, name: C.RARITY[k].name, color: C.RARITY[k].color,
      mult: C.RARITY[k].mult, glow: C.RARITY[k].glow
    }))
  };
}

// ── 2. ДАННЫЕ ИЗ index.html через регулярки ──
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
const srv = fs.readFileSync(path.join(__dirname, '..', '..', 'server.js'), 'utf8');

function grabBlock(text, startPat, open, close) {
  const i = text.indexOf(startPat);
  if (i < 0) return null;
  let d = 0, j = text.indexOf(open, i);
  const from = j;
  for (; j < text.length; j++) {
    if (text[j] === open) d++;
    else if (text[j] === close) { d--; if (d === 0) return text.slice(from, j + 1); }
  }
  return null;
}

function evalBlock(txt) {
  try { return new Function('return ' + txt)(); } catch (e) { return null; }
}

// работы
const jobsTxt = grabBlock(srv, 'const jobDefinitions', '{', '}');
const jobs = jobsTxt ? evalBlock(jobsTxt) : {};

// товары магазина
const shopTxt = grabBlock(srv, 'const shopItems', '{', '}');
const shop = shopTxt ? evalBlock(shopTxt) : {};

// конфиги интерьеров
const intTxt = grabBlock(html, 'const INTERIOR_CONFIGS', '{', '}');
const interiors = intTxt ? evalBlock(intTxt) : {};

// ежедневные награды
const dailyTxt = grabBlock(html, 'const DAILY_REWARDS', '[', ']');
const daily = dailyTxt ? evalBlock(dailyTxt) : [];

// ── 3. КОНСТАНТЫ МИРА ──
function num(pat, def) {
  const m = html.match(pat);
  return m ? Number(m[1]) : def;
}
// ВАЖНО: в JS-игре скорости заданы «на кадр» при 60 FPS
// (mesh.position.x += speed каждый кадр, velocity.y -= GRAVITY).
// Unity работает в единицах В СЕКУНДУ (Time.deltaTime), поэтому
// умножаем на 60 — иначе персонаж будет ползти в 60 раз медленнее.
const FPS = 60;
const world = {
  worldSize:   num(/WORLD_SIZE:\s*(\d+)/, 1200),
  moveSpeed:   +(num(/MOVE_SPEED:\s*([\d.]+)/, 0.15) * FPS).toFixed(2),
  sprintSpeed: +(num(/SPRINT_SPEED:\s*([\d.]+)/, 0.28) * FPS).toFixed(2),
  jumpForce:   +(num(/JUMP_FORCE:\s*([\d.]+)/, 0.2) * FPS).toFixed(2),
  gravity:     +(num(/GRAVITY:\s*(-?[\d.]+)/, 0.008) * FPS * FPS).toFixed(2),
  cameraDistance: num(/CAMERA_DISTANCE:\s*([\d.]+)/, 8),
  cameraHeight:   num(/CAMERA_HEIGHT:\s*([\d.]+)/, 4),
  mallFloorHeight: num(/MALL_FH\s*=\s*([\d.]+)/, 5.5),
  mallGround:      num(/MALL_GROUND\s*=\s*(\d+)/, 5),
  interiorBaseX:   2000,
  interiorBaseZ:   2000,
  spawn: { x: 17, y: 0, z: 21 },
  mallFloors: (html.match(/const MALL_FLOORS = \[([^\]]+)\]/) || [, ''])[1]
                .split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean),
  escalator: { xUp: [-14, -12], zBottom: 10, zTop: 0 },
  lift: { x: 21.0, z: -2.0, doorWidth: 2.1, doorHeight: 3.6 }
};

// ── 4. АНТИЧИТ: правила прямо из рабочего модуля ──
const AC = require(path.join(__dirname, '..', '..', 'anticheat.js')).AC;

console.log('\nЭКСПОРТ ДАННЫХ ИГРЫ → Unity StreamingAssets:');
const cos = extractCosmetics();
save('cosmetics.json', cos.items);
save('rarities.json', cos.rarities);
save('jobs.json', jobs || {});
save('shop.json', shop || {});
save('interiors.json', interiors || {});
save('daily_rewards.json', daily || []);
save('world.json', world);
save('anticheat.json', {
  maxSpeed: AC.MAX_SPEED, maxJump: AC.MAX_JUMP_DIST,
  worldMinX: AC.WORLD_MIN_X, worldMaxX: AC.WORLD_MAX_X,
  worldMinY: AC.WORLD_MIN_Y, worldMaxY: AC.WORLD_MAX_Y,
  worldMinZ: AC.WORLD_MIN_Z, worldMaxZ: AC.WORLD_MAX_Z,
  limits: AC.LIMITS
});
console.log('\nГотово. Файлы в unity-port/Assets/StreamingAssets/');
