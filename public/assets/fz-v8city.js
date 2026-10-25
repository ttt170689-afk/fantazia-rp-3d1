/* ============================================================
   FANTAZIA RP · v8.1 «SUPER» — МОДУЛЬ 4: НОВЫЕ РАЙОНЫ ГОРОДА
   Деловой квартал · Порт · Парк развлечений · Пляж · Промзона
   Жилые кварталы · Стройка · Подработки · Аттракционы · Фотоместа
   ============================================================ */
(function () {
'use strict';
// The restored original world does not install the later six expansion districts.
if (window.FZ_CLASSIC_WORLD) return;
const SKEY = 'fz8_city';
const $ = (id) => document.getElementById(id);
function G(n) { try { return window[n]; } catch (e) { return undefined; } }
function ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function fmt(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
function notify(t, c) { try { const f = G('showNotification') || (G('FZ8H') && G('FZ8H').notify); if (typeof f === 'function') f(t, c); } catch (e) {} }
function banner(t, d) { try { if (typeof G('showWorldEventBanner') === 'function') G('showWorldEventBanner')(t, d); } catch (e) {} }
function money() { try { return Math.round(G('localPlayer').money); } catch (e) { return 0; } }
function addMoney(v) { v = Number(v); if (!isFinite(v)) v = 0; try { if (G('FZ8H') && G('FZ8H').addMoney) { G('FZ8H').addMoney(v); return; } } catch (e) {} try { G('localPlayer').money = Math.max(0, G('localPlayer').money + v); } catch (e) {} }
function addCoins(v) {
  try {
    if (G('FZ8H') && G('FZ8H').addCoins) { G('FZ8H').addCoins(v); return; }
    if (typeof G('localCoins') === 'number') {
      window.localCoins = Math.max(0, window.localCoins + v);
      const cd = $('coinsDisplay'); if (cd) cd.textContent = '💎 ' + window.localCoins;
    }
  } catch (e) {}
}
function xp(k, v) { try { if (G('FZ8L') && G('FZ8L').xp) G('FZ8L').xp(k, v); } catch (e) {} }
function fx(n, a, b) { try { const F = G('FZFX'); if (F && typeof F[n] === 'function') F[n](a, b); } catch (e) {} }
function pp() { try { return G('localPlayer').mesh.position; } catch (e) { return { x: 0, y: 0, z: 0 }; } }
function lifeS() { try { return G('FZ8L').S; } catch (e) { return null; } }

// ---------------- СОСТОЯНИЕ ----------------
const DEF = { v: 1, ach: [], rides: 0, photos: [], jobsDone: 0, portBoxes: 0, factoryShifts: 0, kartsBest: 0, tourDone: 0, seen: false, projects: 0, visits: [] };
let C = JSON.parse(JSON.stringify(DEF));
function loadC() { try { const r = localStorage.getItem(SKEY); if (r) { const o = JSON.parse(r); C = Object.assign(JSON.parse(JSON.stringify(DEF)), o); if (!Array.isArray(C.ach)) C.ach = []; if (!Array.isArray(C.photos)) C.photos = []; if (!Array.isArray(C.visits)) C.visits = []; } } catch (e) {} }
let saveT = 0;
function saveC(force) { const n = performance.now(); if (!force && n - saveT < 1500) return; saveT = n; try { localStorage.setItem(SKEY, JSON.stringify(C)); } catch (e) {} }
function hasA(id) { return C.ach.indexOf(id) >= 0; }
const ACH = [
  { id: 'ride1',   name: 'Прокатился',       icon: '🎡', desc: 'Прокатиться на любом аттракционе', reward: 700 },
  { id: 'ride5',   name: 'Аттракциономан',   icon: '🎢', desc: 'Прокатиться 5 раз', reward: 2400 },
  { id: 'port',    name: 'Докер',            icon: '⚓', desc: 'Разгрузить 5 контейнеров в порту', reward: 2000 },
  { id: 'shift',   name: 'Смена закончена',  icon: '🏭', desc: 'Отработать 3 смены на заводе', reward: 2600 },
  { id: 'photo3',  name: 'Фотоохотник',      icon: '📸', desc: 'Сделать снимок в 3 фотоместах', reward: 1800 },
  { id: 'tour',    name: 'Обзорный полёт',   icon: '🚁', desc: 'Совершить вертолётный тур', reward: 2200 },
  { id: 'bigshop', name: 'Городской житель', icon: '🏙️', desc: 'Посетить все 6 новых районов', reward: 3600 },
  { id: 'kart',    name: 'Картинг-мастер',   icon: '🏎️', desc: 'Проехать круг картинга быстрее 42 секунд', reward: 3000 },
];
function checkA(id) {
  if (hasA(id)) return;
  const a = ACH.find(x => x.id === id); if (!a) return;
  C.ach.push(id); addMoney(a.reward);
  notify('🏅 ' + a.icon + ' ' + a.name + ' (+$' + fmt(a.reward) + ')', 'ach');
  banner('🏅 ДОСТИЖЕНИЕ v8.1: ' + a.name, a.desc + ' · +$' + fmt(a.reward));
  fx('flash', 0.22, [1, 0.9, 0.4]);
  saveC(true);
}
// район посещён
function visitDistrict(id, name) {
  if (C.visits.indexOf(id) >= 0) return;
  C.visits.push(id);
  notify('🏙️ Новый район открыт: ' + name + ' (' + C.visits.length + '/6)');
  if (C.visits.length >= 6) checkA('bigshop');
  saveC(true);
}

// ---------------- СТРОИТЕЛЬНЫЕ ХЕЛПЕРЫ ----------------
let MAT = null;
function mats(T) {
  if (MAT) return MAT;
  MAT = {
    concrete: new T.MeshLambertMaterial({ color: 0x9aa0a8 }),
    darkConcrete: new T.MeshLambertMaterial({ color: 0x6b7078 }),
    glass: new T.MeshLambertMaterial({ color: 0x8fd3ff, transparent: true, opacity: 0.75 }),
    glassDark: new T.MeshLambertMaterial({ color: 0x2f4f6f, transparent: true, opacity: 0.9 }),
    steel: new T.MeshLambertMaterial({ color: 0x8f98a3 }),
    rust: new T.MeshLambertMaterial({ color: 0x9c5a3c }),
    wood: new T.MeshLambertMaterial({ color: 0x8a5a33 }),
    asphalt: new T.MeshLambertMaterial({ color: 0x3a3d44 }),
    sand: new T.MeshLambertMaterial({ color: 0xe6d3a3 }),
    grass: new T.MeshLambertMaterial({ color: 0x4f8f3f }),
    red: new T.MeshLambertMaterial({ color: 0xc0392b }),
    white: new T.MeshLambertMaterial({ color: 0xe8e8ef }),
    yellow: new T.MeshLambertMaterial({ color: 0xf2c14e }),
    blue: new T.MeshLambertMaterial({ color: 0x2f8fd8 }),
    purple: new T.MeshLambertMaterial({ color: 0x6c5ce7 }),
    neon: new T.MeshBasicMaterial({ color: 0x00e5ff }),
    neonPink: new T.MeshBasicMaterial({ color: 0xff3b81 }),
    neonGold: new T.MeshBasicMaterial({ color: 0xffd76a }),
    water: new T.MeshLambertMaterial({ color: 0x1b6ca8, transparent: true, opacity: 0.85 }),
  };
  return MAT;
}
function box(T, g, w, h, d, x, y, z, mat, ry) {
  const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); if (ry) m.rotation.y = ry;
  g.add(m); return m;
}
function cyl(T, g, r1, r2, h, x, y, z, mat, seg) {
  const m = new T.Mesh(new T.CylinderGeometry(r1, r2, h, seg || 10), mat);
  m.position.set(x, y, z); g.add(m); return m;
}
function plane(T, g, w, h, x, y, z, mat, rx, ry) {
  const m = new T.Mesh(new T.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z);
  if (rx !== undefined) m.rotation.x = rx;
  if (ry !== undefined) m.rotation.y = ry;
  g.add(m); return m;
}
function spotFreeBig(x, z, radius, spacing) {
  try {
    if (G('buildings').some(b => b && b.bounds && x > b.bounds.minX - radius && x < b.bounds.maxX + radius && z > b.bounds.minZ - radius && z < b.bounds.maxZ + radius)) return false;
    if (G('streetColliders').some(c => Math.hypot(c.x - x, c.z - z) < radius + (c.r || 1))) return false;
    if (G('interactables').some(i => i.position && Math.hypot(i.position.x - x, i.position.z - z) < radius)) return false;
    const zones = window._fz8CityZones || [];
    if (zones.some(zz => Math.hypot(zz.x - x, zz.z - z) < (zz.r + spacing))) return false;
    const W = G('CONFIG') ? G('CONFIG').WORLD_SIZE : 1200;
    if (Math.abs(x) > W / 2 - 60 || Math.abs(z) > W / 2 - 60) return false;
  } catch (e) { return false; }
  return true;
}
function findArea(prefX, prefZ, radius, spacing) {
  for (let ring = 1; ring < 22; ring++) {
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2 + ring * 0.19;
      const r = ring * 20;
      const x = prefX + Math.cos(ang) * r, z = prefZ + Math.sin(ang) * r;
      if (spotFreeBig(x, z, radius, spacing)) return { x: x, z: z };
    }
  }
  return null;
}
function claimZone(name, x, z, r) {
  window._fz8CityZones = window._fz8CityZones || [];
  window._fz8CityZones.push({ name: name, x: x, z: z, r: r });
}
function addBuilding(x, z, w, h, d, name, type) {
  try {
    G('buildings').push({ x: x, z: z, w: w, h: h, d: d, name: name, type: type, mesh: null, bounds: { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 } });
  } catch (e) {}
}
function addInter(x, z, type, name, range, extra) {
  try {
    const o = Object.assign({ position: { x: x, y: 0, z: z }, type: type, name: name, range: range || 3, fz8: true, fz8c: true }, extra || {});
    G('interactables').push(o);
    return o;
  } catch (e) { return null; }
}
function addCollider(x, z, r) { try { G('streetColliders').push({ x: x, z: z, r: r }); } catch (e) {} }
function label(x, z, text, color) {
  try {
    const T = G('THREE'), sc = G('scene');
    if (!T || !sc) return null;
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
    const c = cv.getContext('2d');
    c.fillStyle = 'rgba(8,6,18,0.8)'; c.fillRect(0, 0, 512, 128);
    c.strokeStyle = color || '#7cffb2'; c.lineWidth = 7; c.strokeRect(8, 8, 496, 112);
    c.fillStyle = color || '#7cffb2'; c.font = 'bold 60px Arial'; c.textAlign = 'center';
    c.fillText(text, 256, 88);
    const tex = new T.CanvasTexture(cv);
    const m = new T.Mesh(new T.PlaneGeometry(9, 2.25), new T.MeshBasicMaterial({ map: tex, transparent: true, side: T.DoubleSide }));
    m.position.set(x, 5.4, z);
    sc.add(m);
    return m;
  } catch (e) { return null; }
}

// ---------------- РАЙОН 1: ДЕЛОВОЙ КВАРТАЛ ----------------
const towers = [];
function buildBusinessDistrict(area) {
  const T = G('THREE'), sc = G('scene'), M = mats(T);
  const N = 5;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const bx = area.x + Math.cos(a) * 46, bz = area.z + Math.sin(a) * 46;
    const w = 18 + (i % 3) * 4, d = 16 + (i % 2) * 5, h = 42 + i * 11;
    const g = new T.Group();
    box(T, g, w, h, d, 0, h / 2, 0, M.concrete);
    // стеклянные полосы-этажи
    for (let f = 0; f < Math.floor(h / 4.2); f++) {
      const y = 2.4 + f * 4.2;
      const gm = (f % 3 === 0) ? M.glass : M.glassDark;
      plane(T, g, w + 0.06, 2.6, 0, y, d / 2 + 0.04, gm, 0, 0);
      plane(T, g, d + 0.06, 2.6, w / 2 + 0.04, y, 0, gm, 0, Math.PI / 2);
      plane(T, g, w + 0.06, 2.6, 0, y, -d / 2 - 0.04, gm, 0, Math.PI);
      plane(T, g, d + 0.06, 2.6, -w / 2 - 0.04, y, 0, gm, 0, -Math.PI / 2);
    }
    // крыша, антенна, маяк
    box(T, g, w + 1.2, 1.2, d + 1.2, 0, h + 0.5, 0, M.darkConcrete);
    cyl(T, g, 0.22, 0.22, 9, w * 0.3, h + 5, 0, M.steel, 6);
    const beacon = new T.Mesh(new T.SphereGeometry(0.34, 8, 6), M.neonPink);
    beacon.position.set(w * 0.3, h + 9.6, 0); g.add(beacon);
    // вывеска на фасаде
    box(T, g, w * 0.6, 2.2, 0.3, 0, h - 3, d / 2 + 0.3, M.neon);
    g.position.set(bx, 0, bz);
    sc.add(g);
    addBuilding(bx, bz, w, h, d, 'Небоскрёб FZ-' + (i + 1), 'fz8_tower');
    addCollider(bx, bz, Math.max(w, d) * 0.62);
    towers.push({ g: g, beacon: beacon, seed: i });
    if (i === 0) {
      addInter(bx, bz + d / 2 + 3, 'fz8c_tour', '🚁 Вертолётный тур по городу ($1200)', 3.4);
      const hg = new T.Group();
      cyl(T, hg, 1.1, 1.1, 0.6, 0, 0.4, 0, M.steel, 10);
      box(T, hg, 5.2, 1.1, 1.7, 0, 1.2, 0, M.darkConcrete);
      box(T, hg, 1.2, 0.7, 1.2, 2.4, 1.6, 0, M.steel);
      const rot = box(T, hg, 9.5, 0.14, 0.5, 0, 1.9, 0, M.darkConcrete);
      const tail = box(T, hg, 0.5, 1.2, 0.14, -4.4, 1.6, 0, M.darkConcrete);
      hg.position.set(bx + 6, 0, bz + d / 2 + 5.5);
      sc.add(hg);
      heli = { g: hg, rot: rot, tail: tail, base: { x: bx + 6, z: bz + d / 2 + 5.5 } };
      addCollider(bx + 6, bz + d / 2 + 5.5, 3.2);
    }
  }
  label(area.x, area.z, 'ДЕЛОВОЙ КВАРТАЛ', '#4a9dff');
  claimZone('business', area.x, area.z, 78);
  addInter(area.x, area.z, 'fz8c_district', '🏙️ Деловой квартал', 14, { dist: 'business' });
  return area;
}
let heli = null;
// ---------------- РАЙОН 2: ПОРТ ----------------
function buildPort(area) {
  const T = G('THREE'), sc = G('scene'), M = mats(T);
  const g = new T.Group();
  // вода + причал
  plane(T, g, 90, 70, 0, 0.06, -30, M.water, -Math.PI / 2);
  box(T, g, 70, 1.6, 14, 0, 0.8, 4, M.concrete);
  box(T, g, 70, 1.2, 1.2, 0, 1.8, -3, M.darkConcrete);
  // краны
  for (let i = -1; i <= 1; i++) {
    const cx = i * 22;
    cyl(T, g, 0.5, 0.6, 14, cx, 7, 0, M.yellow, 8);
    box(T, g, 1.2, 1.2, 26, cx, 14, -8, M.yellow);
    box(T, g, 0.6, 8, 0.6, cx, 10.5, 4.5, M.steel);
    box(T, g, 3.2, 1.4, 1.2, cx, 12.4, 4.5, M.steel);
    addCollider(cx, 0, 2);
  }
  // контейнеры (штабели)
  const colors = [M.red, M.blue, M.yellow, M.grass, M.purple];
  for (let i = 0; i < 26; i++) {
    const cx = -30 + (i % 9) * 7.4, cz = 12 + Math.floor(i / 9) * 12;
    const stack = ri(1, 3);
    for (let k = 0; k < stack; k++) box(T, g, 7, 2.6, 2.9, cx, 1.3 + k * 2.7, cz, colors[(i + k) % colors.length]);
    if (i % 3 === 0) { const lid = box(T, g, 7.1, 0.16, 3, cx, 1.3 + stack * 2.7, cz, M.steel); lid.userData.stack = stack; }
    addCollider(cx, cz, 4.2);
  }
  // склад
  box(T, g, 26, 9, 16, 34, 4.5, 22, M.darkConcrete);
  box(T, g, 26, 0.6, 16, 34, 9.3, 22, M.steel);
  addBuilding(area.x + 34, area.z + 22, 26, 9, 16, 'Портовый склад', 'fz8_warehouse');
  addCollider(area.x + 34, area.z + 22, 15);
  // корабль у причала
  const ship = new T.Group();
  box(T, ship, 44, 5.4, 12, 0, 2.7, 0, M.darkConcrete);
  box(T, ship, 12, 6.5, 9, -13, 8, 0, M.white);
  cyl(T, ship, 0.7, 0.7, 9, 6, 9, 0, M.red, 8);
  box(T, ship, 30, 1.2, 8.4, 2, 5, 0, M.rust);
  ship.position.set(0, 0, -14);
  g.add(ship);
  g.position.set(area.x, 0, area.z);
  sc.add(g);
  addInter(area.x - 6, area.z + 12.6, 'fz8c_portjob', '⚓ Разгрузить контейнеры (подработка)', 4.2);
  addInter(area.x + 30, area.z + 12, 'fz8c_fish2', '🎣 Рыбалка с пирса (крупный улов)', 4.5);
  addInter(area.x - 26, area.z + 13, 'fz8c_photo', '📸 Фото у контейнеров', 4, { spot: 'port' });
  label(area.x, area.z - 6, 'ПОРТ FANTAZIA', '#2f8fd8');
  claimZone('port', area.x, area.z, 70);
  return area;
}
// ---------------- РАЙОН 3: ПАРК РАЗВЛЕЧЕНИЙ ----------------
const rides = [];
function buildAmusementPark(area) {
  const T = G('THREE'), sc = G('scene'), M = mats(T);
  const g = new T.Group();
  // колесо обозрения
  const wheel = new T.Group();
  const R = 13;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const spoke = box(T, wheel, 0.3, R * 2, 0.3, 0, 0, 0, M.white);
    spoke.rotation.z = a;
    const cab = box(T, wheel, 2.2, 1.8, 1.8, Math.cos(a) * R, Math.sin(a) * R, 0, (i % 3 === 0) ? M.neonPink : (i % 3 === 1 ? M.neon : M.neonGold));
    cab.rotation.z = 0;
  }
  wheel.position.set(0, R + 2.4, 0);
  g.add(wheel);
  cyl(T, g, 0.6, 0.9, R + 2.4, -4, (R + 2.4) / 2, 0, M.steel, 8);
  cyl(T, g, 0.6, 0.9, R + 2.4, 4, (R + 2.4) / 2, 0, M.steel, 8);
  box(T, g, 12, 1.2, 2, 0, 0.6, 0, M.darkConcrete);
  // карусель
  const car = new T.Group();
  cyl(T, car, 7, 7, 0.5, 0, 0.3, 0, M.white, 18);
  cyl(T, car, 0.8, 1, 5, 0, 2.5, 0, M.neonGold, 10);
  cyl(T, car, 7.4, 1, 2.2, 0, 5.4, 0, M.red, 18);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const hx = Math.cos(a) * 5, hz = Math.sin(a) * 5;
    cyl(T, car, 0.14, 0.14, 3.6, hx, 2.6, hz, M.steel, 6);
    box(T, car, 0.7, 1.5, 1.9, hx, 1.3, hz, (i % 2 ? M.neonPink : M.white));
  }
  car.position.set(30, 0, 6);
  g.add(car);
  // автодром (картинг)
  const track = new T.Group();
  plane(T, track, 46, 30, 0, 0.05, 0, M.asphalt, -Math.PI / 2);
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    box(T, track, 1.4, 0.5, 1.4, Math.cos(a) * 11, 0.25, Math.sin(a) * 7.2, (i % 2 ? M.white : M.red));
  }
  const karts = [];
  for (let i = 0; i < 4; i++) {
    const kg = new T.Group();
    box(T, kg, 1.5, 0.5, 2.4, 0, 0.45, 0, [M.red, M.blue, M.yellow, M.purple][i]);
    box(T, kg, 1, 0.5, 1, 0, 0.9, -0.2, M.darkConcrete);
    [[-0.7, 0.8], [0.7, 0.8], [-0.7, -0.8], [0.7, -0.8]].forEach(([wx, wz]) => {
      const w = cyl(T, kg, 0.28, 0.28, 0.2, wx, 0.28, wz, M.darkConcrete, 8); w.rotation.z = Math.PI / 2;
    });
    kg.userData.a = (i / 4) * Math.PI * 2;
    track.add(kg);
    karts.push(kg);
  }
  track.position.set(-34, 0, 14);
  g.add(track);
  // павильоны
  [[-6, -22], [8, -24]].forEach(([px, pz], i) => {
    box(T, g, 8, 4, 6, px, 2, pz, i ? M.red : M.yellow);
    box(T, g, 8.6, 0.5, 6.6, px, 4.2, pz, M.white);
    box(T, g, 2, 1.4, 0.3, px, 2.2, pz + 3.1, M.neonGold);
    addCollider(area.x + px, area.z + pz, 5);
  });
  g.position.set(area.x, 0, area.z);
  sc.add(g);
  rides.push({ wheel: wheel, carousel: car, karts: karts, seed: 0 });
  addBuilding(area.x - 6, area.z - 22, 8, 4, 6, 'Павильон мороженого', 'fz8_kiosk');
  addInter(area.x + 14, area.z + 6, 'fz8c_ride', '🎡 Прокатиться на колесе обозрения ($250)', 4);
  addInter(area.x + 30, area.z + 12, 'fz8c_ride', '🎠 Карусель ($150)', 4);
  addInter(area.x - 34, area.z + 22, 'fz8c_kart', '🏎️ Заезд на картинге ($400)', 5);
  addInter(area.x - 6, area.z - 17, 'fz8c_ice', '🍦 Купить мороженое ($60)', 3.2);
  addInter(area.x + 8, area.z - 19, 'fz8c_photo', '📸 Фотоместо: колесо обозрения', 4, { spot: 'wheel' });
  label(area.x, area.z + 26, 'ПАРК РАЗВЛЕЧЕНИЙ', '#ff3b81');
  claimZone('park', area.x, area.z, 60);
  return area;
}

// ---------------- РАЙОН 4: ПЛЯЖ ----------------
function buildBeach(area) {
  const T = G('THREE'), sc = G('scene'), M = mats(T);
  const g = new T.Group();
  plane(T, g, 120, 70, 0, 0.045, 0, M.sand, -Math.PI / 2);
  plane(T, g, 130, 40, 0, 0.05, -55, M.water, -Math.PI / 2);
  // пирс
  for (let i = 0; i < 16; i++) cyl(T, g, 0.24, 0.24, 2.6, -4, 1.3, -32 - i * 3, M.wood, 6);
  box(T, g, 3.4, 0.3, 48, -4, 2.7, -56, M.wood);
  // зонтики и лежаки
  const cols = [M.red, M.blue, M.yellow, M.purple, M.grass];
  for (let i = 0; i < 16; i++) {
    const px = -46 + (i % 8) * 13, pz = -6 + Math.floor(i / 8) * 12;
    cyl(T, g, 0.1, 0.1, 3, px, 1.5, pz, M.white, 6);
    const um = cyl(T, g, 3.4, 0.4, 1.2, px, 3, pz, cols[i % cols.length], 12);
    um.rotation.z = 0.06;
    box(T, g, 2, 0.24, 0.9, px + 4, 0.5, pz, M.white);
    box(T, g, 2, 0.6, 0.2, px + 4, 0.8, pz - 0.38, M.white);
  }
  // вышка спасателя
  box(T, g, 4, 0.4, 4, 44, 5, 6, M.wood);
  [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]].forEach(([lx, lz]) => cyl(T, g, 0.16, 0.16, 5, 44 + lx, 2.5, 6 + lz, M.wood, 6));
  box(T, g, 4.4, 0.5, 4.4, 44, 7.3, 6, M.red);
  // лодки
  for (let i = 0; i < 4; i++) {
    const bx = -20 + i * 11;
    const boat = new T.Group();
    box(T, boat, 4.4, 1.2, 1.8, 0, 0.6, 0, (i % 2 ? M.white : M.blue));
    box(T, boat, 1.4, 0.8, 1.4, 0.4, 1.2, 0, M.wood);
    boat.position.set(bx, 0.1, -30);
    boat.rotation.y = (i - 1.5) * 0.2;
    g.add(boat);
    addCollider(area.x + bx, area.z - 30, 2.4);
  }
  // волейбол
  cyl(T, g, 0.12, 0.12, 3, -30, 1.5, 16, M.steel, 6);
  cyl(T, g, 0.12, 0.12, 3, -22, 1.5, 16, M.steel, 6);
  box(T, g, 8, 0.08, 0.08, -26, 2.9, 16, M.white);
  g.position.set(area.x, 0, area.z);
  sc.add(g);
  addInter(area.x - 4, area.z - 32, 'fz8c_fish2', '🎣 Рыбалка с пирса', 4.5);
  addInter(area.x - 26, area.z + 14, 'fz8c_volley', '🏐 Пляжный волейбол ($100)', 4.2);
  addInter(area.x + 40, area.z + 14, 'fz8c_photo', '📸 Фотоместо: пляж и закат', 4, { spot: 'beach' });
  addInter(area.x - 46, area.z - 2, 'fz8c_surf', '🏄 Аренда сёрфа ($300)', 4);
  addInter(area.x + 12, area.z - 6, 'fz8c_ice', '🍹 Коктейль на пляже ($90)', 3.2);
  label(area.x, area.z + 30, 'ПЛЯЖ FANTAZIA', '#f2c14e');
  claimZone('beach', area.x, area.z, 70);
  return area;
}
// ---------------- РАЙОН 5: ПРОМЗОНА ----------------
const pipes = [];
function buildIndustrial(area) {
  const T = G('THREE'), sc = G('scene'), M = mats(T);
  const g = new T.Group();
  for (let i = 0; i < 3; i++) {
    const bx = -30 + i * 32, bz = 0;
    const h = 14 + i * 5;
    box(T, g, 26, h, 18, bx, h / 2, bz, M.darkConcrete);
    box(T, g, 26.6, 0.8, 18.6, bx, h + 0.4, bz, M.steel);
    // зубцы-фонари на крыше
    for (let k = 0; k < 4; k++) box(T, g, 5, 1.6, 16, bx - 9 + k * 6, h + 1.6, bz, M.glassDark);
    // трубы
    const px = bx + 9, pz = bz + 5;
    cyl(T, g, 1.1, 1.4, h + 12, px, (h + 12) / 2, pz, M.rust, 10);
    cyl(T, g, 1.3, 1.1, 1.2, px, h + 12.5, pz, M.red, 10);
    pipes.push({ x: area.x + px, z: area.z + pz, y: h + 13, t: Math.random() * 3 });
    addBuilding(area.x + bx, area.z + bz, 26, h, 18, 'Цех №' + (i + 1), 'fz8_factory');
    addCollider(area.x + bx, area.z + bz, 15);
    // окна
    for (let f = 0; f < Math.floor(h / 4.4); f++) {
      plane(T, g, 24, 1.8, bx, 3 + f * 4.4, bz + 9.05, M.glass, 0, 0);
      plane(T, g, 24, 1.8, bx, 3 + f * 4.4, bz - 9.05, M.glass, 0, Math.PI);
    }
  }
  // ангары, трубы-переходы, бочки, погрузчики
  for (let i = 0; i < 12; i++) {
    const bx = -46 + (i % 6) * 15, bz = 26 + Math.floor(i / 6) * 12;
    cyl(T, g, 0.7, 0.7, 2, bx, 1, bz, (i % 3 ? M.rust : M.yellow), 8);
    addCollider(area.x + bx, area.z + bz, 1.6);
  }
  const fg = new T.Group();
  box(T, fg, 3.4, 1.4, 1.8, 0, 0.9, 0, M.yellow);
  box(T, fg, 1, 1.2, 1, 0, 2.2, 0, M.steel);
  box(T, fg, 0.4, 2.4, 0.4, -1.7, 1.4, 0, M.steel);
  fg.position.set(area.x - 40, 0, area.z + 4);
  sc.add(fg);
  g.position.set(area.x, 0, area.z);
  sc.add(g);
  addInter(area.x - 62, area.z + 12, 'fz8c_shift', '🏭 Смена на заводе (работа)', 4.2);
  addInter(area.x + 62, area.z + 12, 'fz8c_scrap', '🔧 Разобрать металлолом (ресурсы)', 4.2);
  addInter(area.x + 30, area.z + 26, 'fz8c_photo', '📸 Фотоместо: заводские трубы', 4, { spot: 'factory' });
  label(area.x, area.z + 40, 'ПРОМЗОНА', '#9c5a3c');
  claimZone('industrial', area.x, area.z, 80);
  return area;
}
// ---------------- РАЙОН 6: ЖИЛЫЕ КВАРТАЛЫ + СТРОЙКА ----------------
const sites = [];
function buildResidential(area) {
  const T = G('THREE'), sc = G('scene'), M = mats(T);
  const g = new T.Group();
  for (let i = 0; i < 6; i++) {
    const bx = -40 + (i % 3) * 40, bz = -20 + Math.floor(i / 3) * 40;
    const w = 22, d = 16, h = 18 + (i % 3) * 4;
    box(T, g, w, h, d, bx, h / 2, bz, (i % 2) ? M.concrete : new T.MeshLambertMaterial({ color: 0xb0855f }));
    // балконы
    for (let f = 1; f < Math.floor(h / 3.2); f++) {
      for (let k = 0; k < 4; k++) {
        const ox = -8 + k * 5.4, y = f * 3.2;
        box(T, g, 3.2, 0.2, 1.4, bx + ox, y, bz + d / 2 + 0.7, M.white);
        box(T, g, 3.2, 0.9, 0.14, bx + ox, y + 0.5, bz + d / 2 + 1.3, M.steel);
        plane(T, g, 2.4, 1.6, bx + ox, y + 0.9, bz + d / 2 + 0.02, M.glassDark, 0, 0);
      }
    }
    box(T, g, w + 1, 0.9, d + 1, bx, h + 0.4, bz, M.darkConcrete);
    // кондиционеры
    for (let k = 0; k < 3; k++) box(T, g, 1, 0.7, 0.6, bx - 9 + k * 8, h - 4 - (k % 2), bz - d / 2 - 0.4, M.white);
    addBuilding(area.x + bx, area.z + bz, w, h, d, 'ЖК «Фантазия»', 'fz8_house');
    addCollider(area.x + bx, area.z + bz, 13);
  }
  // детская площадка + школа + спортплощадка
  const pg = new T.Group();
  plane(T, pg, 26, 18, 0, 0.05, 0, new T.MeshLambertMaterial({ color: 0xd8b45f }), -Math.PI / 2);
  cyl(T, pg, 0.2, 0.2, 5, -6, 2.5, -4, M.red, 6);
  box(T, pg, 3.4, 0.3, 2, -3.6, 3.6, -4, M.blue);
  box(T, pg, 3.4, 0.3, 2, -8.4, 3.6, -4, M.blue);
  box(T, pg, 4, 1.6, 1.2, 6, 0.9, 3, M.yellow);
  box(T, pg, 4, 0.3, 1.2, 6, 3.4, 3, M.grass);
  for (let i = 0; i < 5; i++) box(T, pg, 0.9, 1.2, 0.9, -9 + i * 3.6, 0.6, 6, (i % 2 ? M.red : M.blue));
  pg.position.set(area.x - 60, 0, area.z + 30);
  sc.add(pg);
  addInter(area.x - 60, area.z + 30, 'fz8c_play', '🤸 Спортивная площадка (+сила)', 5);
  // стройка
  const sg = new T.Group();
  box(T, sg, 30, 1, 24, 0, 0.5, 0, M.darkConcrete);
  const fl = [];
  for (let f = 0; f < 8; f++) {
    const flr = box(T, sg, 26, 2.8, 20, 0, 2 + f * 3.2, 0, M.concrete);
    flr.visible = f < 2;
    fl.push(flr);
  }
  cyl(T, sg, 0.5, 0.7, 34, -17, 17, 0, M.yellow, 8);
  box(T, sg, 1.1, 1.1, 26, -17, 34, 0, M.yellow);
  const banner2 = box(T, sg, 8, 2.4, 0.3, 0, 5, 12.4, M.neonGold);
  const crate = box(T, sg, 12, 2.4, 3, 16, 1.7, 16, M.steel); // бытовка
  sg.position.set(area.x + 62, 0, area.z + 34);
  sc.add(sg);
  sites.push({ g: sg, floors: fl, prog: 2, t: 0, x: area.x + 62, z: area.z + 34 });
  addBuilding(area.x + 62, area.z + 34, 30, 26, 24, 'Стройка «Новая Фантазия»', 'fz8_build');
  addCollider(area.x + 62, area.z + 34, 17);
  g.position.set(area.x, 0, area.z);
  sc.add(g);
  addInter(area.x + 62, area.z + 50, 'fz8c_site', '🏗️ Помочь на стройке (ускорить этаж)', 4.5);
  addInter(area.x - 40, area.z - 34, 'fz8c_photo', '📸 Фотоместо: стройка и краны', 4, { spot: 'site' });
  label(area.x, area.z - 34, 'ЖИЛЫЕ КВАРТАЛЫ', '#7cffb2');
  claimZone('residential', area.x, area.z, 78);
  return area;
}

// ---------------- МОДАЛКА АКТИВНОСТИ ----------------
function cityModal(title, html, width) {
  let m = $('fz8City');
  if (!m) {
    m = document.createElement('div'); m.id = 'fz8City';
    m.style.cssText = 'position:fixed;inset:0;z-index:8450;background:rgba(4,2,12,.8);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;';
    m.onclick = (e) => { if (e.target === m) cityClose(); };
    document.body.appendChild(m);
  }
  m.innerHTML = '<div style="width:min(' + (width || 520) + 'px,96vw);max-height:90vh;overflow:auto;background:linear-gradient(165deg,#141230,#090818);border:1.5px solid #6c5ce766;border-radius:18px;padding:16px;color:#fff;font:14px Arial;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><div style="font:bold 16px Arial;">' + title + '</div>'
    + '<button onclick="FZ8C.close()" style="background:#ffffff14;color:#fff;border:1px solid #ffffff30;border-radius:10px;width:30px;height:30px;cursor:pointer;">✕</button></div>' + html + '</div>';
  m.style.display = 'flex';
  return m;
}
function cityClose() { const m = $('fz8City'); if (m) m.style.display = 'none'; }
function btn(label, fn, cls, id) {
  const b = document.createElement('button');
  b.className = 'fz8B ' + (cls || 'g');
  b.textContent = label;
  if (id) b.id = id;
  b.onclick = fn;
  return b;
}

// ---------------- ПОДРАБОТКИ ----------------
let job = null;
function startJob(kind) {
  const conf = {
    port:    { name: 'Разгрузка контейнеров', truck: '📦 Контейнер', total: 8, per: [140, 320], xp: 'power',  loc: 'порт' },
    factory: { name: 'Смена на заводе',       truck: '⚙️ Деталь',   total: 10, per: [160, 380], xp: 'power', loc: 'завод' },
    courier: { name: 'Курьерская смена',      truck: '📨 Посылка',   total: 12, per: [120, 280], xp: 'speed', loc: 'город' },
  }[kind];
  if (!conf) return;
  if (job) { notify('⏳ Ты уже работаешь', 'warn'); return; }
  job = { kind: kind, conf: conf, done: 0, earned: 0, t: 0, last: 0 };
  renderJob();
  gameTick();
}
let jobTimer = null;
function gameTick() {
  if (jobTimer) clearInterval(jobTimer);
  jobTimer = setInterval(() => {
    if (!job) { clearInterval(jobTimer); jobTimer = null; return; }
    job.t += 0.1;
    if (job.t - job.last > 3.2) { job.last = job.t; job.miss = (job.miss || 0) + 1; }
    const bar = $('fz8JobBar'); if (bar) bar.style.width = clamp(job.done / job.conf.total * 100, 0, 100) + '%';
    const info = $('fz8JobInfo');
    if (info) info.innerHTML = 'Выполнено: <b>' + job.done + '/' + job.conf.total + '</b> · заработано: <b>$' + fmt(job.earned) + '</b>' + (job.miss ? ' · промахов: ' + job.miss : '');
    if (job.t > 60) { notify('⌛ Смена окончена по времени', 'warn'); endJob(); }
  }, 100);
}
function renderJob() {
  const j = job; if (!j) return;
  const m = cityModal('👷 Подработка: ' + j.conf.name,
    '<div style="color:#a29bfe;font:12px Arial;margin-bottom:8px;">Кликай по кнопке, пока она подсвечена — каждая деталь приносит деньги. Пропустил 3 секунды — промах.</div>'
    + '<div style="height:14px;border-radius:8px;background:#ffffff14;overflow:hidden;margin-bottom:10px;"><i id="fz8JobBar" style="display:block;height:100%;width:0%;background:linear-gradient(90deg,#00b894,#7cffb2);"></i></div>'
    + '<div id="fz8JobInfo" style="font:13px Arial;margin-bottom:12px;">Выполнено: 0/' + j.conf.total + '</div>'
    + '<button id="fz8JobBtn" style="width:100%;padding:16px;border-radius:14px;border:none;background:linear-gradient(135deg,#e17055,#b3391f);color:#fff;font:bold 17px Arial;cursor:pointer;">' + j.conf.truck + ' Взять в работу</button>'
    + '<button onclick="FZ8C.endJob()" style="width:100%;margin-top:8px;padding:10px;border-radius:12px;border:1px solid #ffffff22;background:#ffffff10;color:#fff;font:bold 13px Arial;cursor:pointer;">Закончить смену</button>');
  const b = $('fz8JobBtn');
  if (b) b.onclick = doJobClick;
}
function doJobClick() {
  const j = job; if (!j) return;
  const good = Math.random() > 0.18;
  if (good) {
    const pay = ri(j.conf.per[0], j.conf.per[1]);
    j.earned += pay;
    j.done++;
    if (j.kind === 'port') { C.portBoxes++; if (C.portBoxes >= 5) checkA('port'); }
    if (j.kind === 'factory') { C.factoryShifts = C.factoryShifts; }
    xp(j.conf.xp, 6);
    const btn2 = $('fz8JobBtn');
    if (btn2) { btn2.style.background = 'linear-gradient(135deg,#00b894,#00997a)'; setTimeout(() => { if (btn2) btn2.style.background = 'linear-gradient(135deg,#e17055,#b3391f)'; }, 90); }
  } else {
    job.miss = (job.miss || 0) + 1;
    notify('😬 Брак! Деталь упала', 'warn');
  }
  if (job.done >= job.conf.total) endJob();
  else { const bar = $('fz8JobBar'); if (bar) bar.style.width = clamp(job.done / job.conf.total * 100, 0, 100) + '%'; const info = $('fz8JobInfo'); if (info) info.innerHTML = 'Выполнено: <b>' + job.done + '/' + job.conf.total + '</b> · заработано: <b>$' + fmt(job.earned) + '</b>' + (job.miss ? ' · промахов: ' + job.miss : ''); }
}
function endJob() {
  const j = job; if (!j) return;
  const penalty = (j.miss || 0) * 40;
  const total = Math.max(0, Math.round(j.earned - penalty));
  addMoney(total);
  C.jobsDone++;
  if (j.kind === 'factory') { C.factoryShifts++; xp('stamina', 40); if (C.factoryShifts >= 3) checkA('shift'); }
  if (j.kind === 'port') { xp('power', 45); }
  if (j.kind === 'courier') { xp('speed', 45); }
  notify('💰 Смена закрыта: $' + fmt(total) + (penalty ? ' (штраф $' + fmt(penalty) + ' за промахи)' : ''));
  banner('👷 СМЕНА ЗАВЕРШЕНА', j.conf.name + ' · $' + fmt(total));
  job = null;
  if (jobTimer) { clearInterval(jobTimer); jobTimer = null; }
  saveC(true);
  setTimeout(cityClose, 700);
}

// ---------------- АТТРАКЦИОНЫ ----------------
let ride = null;
function takeRide(kind) {
  const conf = {
    wheel:    { name: 'Колесо обозрения', price: 250, xp: 'stamina', money: [200, 500] },
    carousel: { name: 'Карусель',         price: 150, xp: 'charm',   money: [80, 220] },
    kart:     { name: 'Автодром',         price: 200, xp: 'speed',   money: [120, 300] },
  }[kind] || { name: 'Аттракцион', price: 200, xp: 'charm', money: [100, 260] };
  if (money() < conf.price) { notify('❌ Нужно $' + conf.price, 'warn'); return; }
  addMoney(-conf.price);
  C.rides++;
  checkA('ride1');
  if (C.rides >= 5) checkA('ride5');
  xp(conf.xp, 40);
  const jackpot = ri(conf.money[0], conf.money[1]);
  addMoney(jackpot);
  notify('🎢 ' + conf.name + ': катаешься! +$' + fmt(jackpot) + ' (аттракционов: ' + C.rides + ')');
  fx('letterbox', true);
  fx('speedLines', 0.4);
  fx('fov', 8);
  setTimeout(() => { fx('letterbox', false); fx('speedLines', 0); }, 2600);
  if (Math.random() < 0.15) { addCoins(1); notify('💎 Бонус аттракциона: +1 кристалл'); }
  saveC(true);
}
// ---------------- ВЕРТОЛЁТНЫЙ ТУР ----------------
let tour = null;
function heliTour() {
  if (tour) { notify('⏳ Тур уже идёт', 'warn'); return; }
  if (money() < 1200) { notify('❌ Тур стоит $1200', 'warn'); return; }
  addMoney(-1200);
  const spots = window._fz8CityAreas || [];
  tour = { t: 0, dst: spots.length ? spots[C.tourDone % spots.length] : null, done: false };
  notify('🚁 Вертолёт поднимается — обзорная экскурсия по городу…');
  fx('letterbox', true);
  fx('flash', 0.35, [1, 1, 1], 900);
  if (heli) heli.flying = 1.8;
}
function updateTour(dt) {
  if (!tour) return;
  tour.t += dt;
  if (!tour.done && tour.t > 1.1) {
    tour.done = true;
    if (tour.dst) { try { G('localPlayer').mesh.position.set(tour.dst.x + 6, 1, tour.dst.z + 6); } catch (e) {} }
    fx('shake', 16);
    fx('fov', 12);
    xp('charm', 70);
  }
  if (tour.t > 3.0) {
    fx('letterbox', false);
    fx('fov', 0);
    C.tourDone++;
    checkA('tour');
    addMoney(600);
    notify('🚁 Экскурсия завершена! +$600 и +70 XP харизмы');
    banner('🚁 ВЕРТОЛЁТНЫЙ ТУР', 'Ты увидел город с высоты птичьего полёта');
    tour = null;
    saveC(true);
  }
}
// ---------------- ФОТОМЕСТА ----------------
const PHOTO_SPOTS = {
  port:    { name: 'Порт и контейнеры',   sky: ['#1b2a4a', '#2f8fd8'], icon: '⚓' },
  wheel:   { name: 'Колесо обозрения',    sky: ['#3a1b4a', '#ff3b81'], icon: '🎡' },
  beach:   { name: 'Пляж и закат',        sky: ['#4a2b1b', '#ffb74d'], icon: '🏖️' },
  factory: { name: 'Заводские трубы',     sky: ['#2b2b33', '#9c5a3c'], icon: '🏭' },
  site:    { name: 'Стройка и краны',     sky: ['#1b3a2a', '#7cffb2'], icon: '🏗️' },
};
function takePhoto(spot) {
  const p = PHOTO_SPOTS[spot] || { name: 'Фотоместо', sky: ['#1a1a2e', '#6c5ce7'], icon: '📸' };
  if (!C.photos.includes(spot)) C.photos.push(spot);
  cityModal('📸 ' + p.name,
    '<canvas id="fz8Photo" width="480" height="270" style="width:100%;border-radius:14px;border:1.5px solid #6c5ce766;"></canvas>'
    + '<div style="font:12px Arial;color:#a29bfe;margin-top:8px;">Снимок сделан: ' + p.name + ' · фотомест открыто ' + C.photos.length + '/' + Object.keys(PHOTO_SPOTS).length + '</div>'
    + '<div style="display:flex;gap:8px;margin-top:10px;"><button class="fz8B g" onclick="FZ8C.reward(\'photo\')">Опубликовать (+$700)</button>'
    + '<button class="fz8B" onclick="FZ8C.close()">Закрыть</button></div>');
  try {
    const cv = $('fz8Photo'), c = cv.getContext('2d');
    const grd = c.createLinearGradient(0, 0, 0, 270);
    grd.addColorStop(0, p.sky[0]); grd.addColorStop(1, p.sky[1]);
    c.fillStyle = grd; c.fillRect(0, 0, 480, 270);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 0; i < 9; i++) { const b = 30 + (i % 5) * 22; c.fillRect(30 + i * 48, 270 - b, 34, b); }
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.beginPath(); c.arc(400, 60, 26, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.font = 'bold 26px Arial';
    c.fillText(p.icon + ' FANTAZIA', 22, 46);
    c.font = '16px Arial'; c.fillText(p.name, 22, 250);
  } catch (e) {}
  xp('charm', 20);
  if (C.photos.length >= 3) checkA('photo3');
  saveC(true);
}

// ---------------- КАРТИНГ ----------------
let kartRace = null;
const KART_CP = [[0, -12], [12, 0], [0, 12], [-12, 0]];
function startKart() {
  const track = window._fz8KartCenter;
  if (!track) { notify('❌ Трасса не найдена', 'warn'); return; }
  if (money() < 400) { notify('❌ Заезд стоит $400', 'warn'); return; }
  if (kartRace) { notify('⏳ Заезд уже идёт!', 'warn'); return; }
  addMoney(-400);
  kartRace = { i: 0, t: 0, track: track, marks: [] };
  try {
    const T = G('THREE'), sc = G('scene');
    KART_CP.forEach(([dx, dz], i) => {
      const m = new T.Mesh(new T.TorusGeometry(2.6, 0.2, 8, 20), new T.MeshBasicMaterial({ color: i === 0 ? 0x7cffb2 : 0xffd76a }));
      m.position.set(track.x + dx, 2.4, track.z + dz); m.rotation.x = Math.PI / 2;
      sc.add(m); kartRace.marks.push(m);
    });
    try { G('localPlayer').mesh.position.set(track.x, 1, track.z - 12); } catch (e) {}
  } catch (e) {}
  notify('🏎️ Заезд начался! Проедь 4 сектора по кругу — уложись в 42 секунды');
  banner('🏎️ КАРТИНГ', '4 сектора · цель — быстрый круг');
  saveC(true);
}
function updateKart(dt) {
  if (!kartRace) return;
  kartRace.t += dt;
  const p = pp();
  const [dx, dz] = KART_CP[kartRace.i];
  const tx = kartRace.track.x + dx, tz = kartRace.track.z + dz;
  kartRace.marks.forEach((m, i) => { try { m.visible = i >= kartRace.i; m.rotation.z += dt * 2; } catch (e) {} });
  if (Math.hypot(p.x - tx, p.z - tz) < 4) {
    kartRace.i++;
    fx('flash', 0.12, [0.5, 1, 0.6]);
    xp('speed', 20);
    if (kartRace.i >= KART_CP.length) endKart();
    else notify('🏎️ Сектор ' + kartRace.i + '/4');
  }
  if (kartRace.t > 42) endKartKart();
}
function endKart() {
  const t = kartRace ? kartRace.t : 0;
  const prize = clamp(Math.round(2400 - t * 30), 500, 2400);
  addMoney(prize);
  xp('speed', 80);
  if (!C.kartsBest || t < C.kartsBest) C.kartsBest = t;
  if (t < 42) checkA('kart');
  notify('🏁 Круг пройден за ' + t.toFixed(1) + 'с · приз $' + fmt(prize));
  banner('🏁 КАРТИНГ: ' + t.toFixed(1) + ' с', 'Приз $' + fmt(prize) + ' · рекорд ' + (C.kartsBest || t).toFixed(1) + 'с');
  clearKart();
  saveC(true);
}
function endKartKart() {
  notify('⌛ Время вышло — круг не засчитан, попробуй ещё', 'warn');
  clearKart();
}
function clearKart() {
  if (kartRace) kartRace.marks.forEach(m => { try { G('scene').remove(m); } catch (e) {} });
  kartRace = null;
}
// ---------------- МЕЛКИЕ АКТИВНОСТИ ----------------
function cityActivity(kind) {
  if (kind === 'volley') {
    if (money() < 100) { notify('❌ Нужно $100', 'warn'); return; }
    addMoney(-100);
    const win = Math.random() < 0.55;
    if (win) { addMoney(320); xp('speed', 45); notify('🏐 Победа в волейболе! +$320'); banner('🏐 ПОБЕДА', 'Ты выиграл пляжный матч'); }
    else { xp('speed', 18); notify('🏐 Проиграл матч, но размялся (+18 XP)'); }
  } else if (kind === 'surf') {
    if (money() < 300) { notify('❌ Аренда $300', 'warn'); return; }
    addMoney(-300);
    xp('speed', 70); xp('stamina', 40);
    notify('🏄 Ты прокатился на волне! +70 XP скорости');
    fx('speedLines', 0.7); fx('fov', 10);
    setTimeout(() => { fx('speedLines', 0); fx('fov', 0); }, 2200);
    if (Math.random() < 0.2) { addMoney(500); notify('🌊 Фотограф поймал твой трюк: +$500'); }
  } else if (kind === 'ice') {
    if (money() < 60) { notify('❌ Нужно $60', 'warn'); return; }
    addMoney(-60);
    notify('🍦 Вкусно!');
  } else if (kind === 'play') {
    xp('power', 55); xp('stamina', 30);
    notify('🤸 Тренировка на площадке: +55 XP силы');
  } else if (kind === 'scrap') {
    const S2 = lifeS();
    if (S2) { S2.res.metal += ri(4, 9); S2.res.plastic += ri(2, 5); if (Math.random() < 0.25) S2.res.chip += 1; }
    xp('hack', 25);
    notify('🔧 Разобрал металлолом: +металл, +пластик ' + (Math.random() < 0.25 ? 'и чип' : ''));
  } else if (kind === 'site') {
    const s = sites[0];
    if (!s) { notify('Стройка не найдена', 'warn'); return; }
    if (s.prog >= s.floors.length) { notify('🏗️ Стройка завершена — работа больше не нужна'); return; }
    s.prog++;
    if (s.floors[s.prog - 1]) s.floors[s.prog - 1].visible = true;
    addMoney(450); xp('power', 25);
    C.projects = (C.projects || 0) + 1;
    notify('🏗️ Ты помог поднять этаж! +$450 · этажей: ' + s.prog + '/' + s.floors.length);
    fx('shake', 10);
  }
  saveC(true);
}
function fish2() {
  const S2 = lifeS();
  const reward = ri(320, 900);
  addMoney(reward);
  xp('stamina', 35);
  try { if (G('FZ8W')) { const w = G('FZ8W').state(); if (w) w.fishCount++; } } catch (e) {}
  notify('🎣 Крупный улов с пирса: +$' + fmt(reward));
  if (Math.random() < 0.12) { try { if (S2) S2.res.gold += 1; } catch (e) {} notify('🥇 Золото в сетке!'); }
  saveC(true);
}
// ---------------- ОБНОВЛЕНИЕ МИРА ----------------
let t3 = 0, ensureT = 0;
function updateCity(dt) {
  t3 += dt;
  // аттракционы крутятся
  rides.forEach(r => {
    try {
      r.wheel.rotation.z += dt * 0.28;
      r.carousel.rotation.y += dt * 0.5;
      (r.karts || []).forEach((k, i) => {
        k.userData.a += dt * (0.6 + i * 0.05);
        k.position.set(Math.cos(k.userData.a) * 11, 0.35, Math.sin(k.userData.a) * 7.2);
        k.rotation.y = -k.userData.a + Math.PI / 2;
      });
    } catch (e) {}
  });
  // маяки башен
  towers.forEach(tw => { try { tw.beacon.visible = Math.sin(t3 * 3 + tw.seed) > 0; } catch (e) {} });
  // дым заводов
  if (Math.random() < dt * 1.2) pipes.forEach(p => { try { if (Math.hypot(p.x - pp().x, p.z - pp().z) < 140 && G('FZFX') && G('FZFX').puff) G('FZFX').puff(p.x, p.y, p.z, 2.4, 0xbfc4cc, 5, 0.2); } catch (e) {} });
  // вертолёт
  if (heli) {
    try {
      heli.rot.rotation.y += dt * (heli.flying > 0 ? 26 : 3);
      heli.tail.rotation.y += dt * 8;
      if (heli.flying > 0) {
        heli.flying -= dt;
        heli.g.position.y = Math.max(0, Math.sin(Math.max(0, heli.flying) * 2) * 26);
        heli.g.rotation.y += dt * 0.8;
      } else { heli.g.position.y = 0; }
    } catch (e) {}
  }
  // стройка растёт сама
  sites.forEach(s => {
    s.t += dt;
    if (s.t > 34 && s.prog < s.floors.length) {
      s.t = 0;
      s.prog++;
      try { s.floors[s.prog - 1].visible = true; } catch (e) {}
      notify('🏗️ Стройка «Новая Фантазия»: готово ' + s.prog + '/' + s.floors.length + ' этажей');
      if (s.prog >= s.floors.length) {
        banner('🏗️ СТРОЙКА ЗАВЕРШЕНА', 'В городе появился новый жилой комплекс «Новая Фантазия»');
        addMoney(2000);
        notify('🎉 Город вырос! Ты получил $2000 за вклад в развитие', 'levelup');
        addBuilding(s.x, s.z, 30, 26, 24, 'ЖК «Новая Фантазия»', 'fz8_house');
      }
    }
  });
  // посещение районов
  try {
    const p = pp();
    (window._fz8CityZones || []).forEach(z => {
      if (Math.hypot(p.x - z.x, p.z - z.z) < 60) visitDistrict(z.name, z.name);
    });
  } catch (e) {}
  // картинг и тур
  updateKart(dt);
  updateTour(dt);
  // подработка: смена без кликов закрывается по таймеру
  ensureT += dt;
  if (ensureT > 2.5) { ensureT = 0; ensureBuilt(); }
}
function ensureBuilt() { if (!window._fz8CityBuilt) buildAll(); }
function buildAll() {
  if (window.FZ_CLASSIC_WORLD) return false;
  try {
    if (!G('scene') || !G('buildings') || G('buildings').length < 5) return false;
    if (window._fz8CityBuilt) return true;
    const T = G('THREE');
    if (!T) return false;
    mats(T);
    const areas = [];
    const plan = [
      ['business',    240, -240, 96, 150],
      ['port',       -280,  220, 90, 150],
      ['park',        260,  250, 76, 140],
      ['beach',      -260, -280, 90, 150],
      ['industrial',  330,   30, 96, 150],
      ['residential', -30,   330, 96, 150],
    ];
    for (const [id, px, pz, radius, spacing] of plan) {
      const a = findArea(px, pz, radius, spacing);
      if (!a) continue;
      claimZone(id, a.x, a.z, radius);
      if (id === 'business') buildBusinessDistrict(a);
      else if (id === 'port') buildPort(a);
      else if (id === 'park') { buildAmusementPark(a); window._fz8KartCenter = { x: a.x - 34, z: a.z + 14 }; }
      else if (id === 'beach') buildBeach(a);
      else if (id === 'industrial') buildIndustrial(a);
      else if (id === 'residential') buildResidential(a);
      areas.push({ id: id, x: a.x, z: a.z, name: DISTRICTS[id].name });
    }
    window._fz8CityAreas = areas;
    window._fz8CityBuilt = true;
    return true;
  } catch (e) { return false; }
}
const DISTRICTS = {
  business:    { name: 'Деловой квартал', icon: '🏙️', desc: '5 небоскрёбов-башен с маяками, вертолётная площадка и обзорный тур.' },
  port:        { name: 'Порт FANTAZIA',   icon: '⚓', desc: 'Краны, контейнеры, корабль. Подработка на разгрузке и рыбалка с пирса.' },
  park:        { name: 'Парк развлечений', icon: '🎡', desc: 'Колесо обозрения, карусель, автодром, картинг-трасса и павильоны.' },
  beach:       { name: 'Пляж',            icon: '🏖️', desc: 'Песок, зонтики, пирс, волейбол, сёрф и ледяные коктейли.' },
  industrial:  { name: 'Промзона',        icon: '🏭', desc: 'Три цеха с дымящими трубами, смены на заводе и разбор металлолома.' },
  residential: { name: 'Жилые кварталы',  icon: '🏘️', desc: 'Дома с балконами, детская и спортплощадки, живая стройка нового ЖК.' },
};

// ---------------- ИНТЕРФЕЙС ----------------
function panelDistricts() {
  const areas = window._fz8CityAreas || [];
  let h = '<div class="fz8Chip" style="margin-bottom:9px;">Открыто районов: ' + C.visits.length + '/6 · новых объектов: ' + (C.projects || 0) + ' · подработок: ' + C.jobsDone + '</div>';
  h += Object.keys(DISTRICTS).map(k => {
    const d = DISTRICTS[k];
    const a = areas.find(x => x.id === k);
    const done = C.visits.indexOf(k) >= 0;
    const px = pp();
    const dist = a ? Math.round(Math.hypot(a.x - px.x, a.z - px.z)) : null;
    return '<div class="fz8Row"><div><div class="nm">' + d.icon + ' ' + d.name + '</div><div class="sb">' + d.desc + '</div>'
      + (a ? '<div class="sb">Координаты: ' + Math.round(a.x) + ', ' + Math.round(a.z) + (dist !== null ? ' · ' + dist + ' м от тебя' : '') + '</div>' : '') + '</div>'
      + '<div class="vl">' + (done ? '✅' : 'не был') + '</div></div>';
  }).join('');
  h += '<div class="fz8Hint">Районы построены по окраинам города: деловой квартал, порт, парк развлечений, пляж, промзона и жилые кварталы. В каждом — свои активности и фотоместа.</div>';
  return h;
}
function panelRides() {
  let h = '<div class="fz8Chip" style="margin-bottom:9px;">Прокатов: ' + C.rides + ' · рекорд картинга: ' + (C.kartsBest ? C.kartsBest.toFixed(1) + ' с' : '—') + ' · туров: ' + C.tourDone + '</div>';
  h += '<div class="fz8Row"><div><div class="nm">🎡 Колесо обозрения</div><div class="sb">$250 · панорама города, XP выносливости, приз за поездку</div></div><button class="fz8B g" onclick="FZ8C.ride(\'wheel\')">Поехали</button></div>';
  h += '<div class="fz8Row"><div><div class="nm">🎠 Карусель</div><div class="sb">$150 · +XP харизмы, подарок-сюрприз</div></div><button class="fz8B g" onclick="FZ8C.ride(\'carousel\')">Поехали</button></div>';
  h += '<div class="fz8Row"><div><div class="nm">🏎️ Автодром</div><div class="sb">$200 · +XP скорости</div></div><button class="fz8B g" onclick="FZ8C.ride(\'kart\')">Поехали</button></div>';
  h += '<div class="fz8Row"><div><div class="nm">🏎️ Картинг-трасса (на время)</div><div class="sb">$400 · 4 сектора, приз до $2 400, рекорд ' + (C.kartsBest ? C.kartsBest.toFixed(1) + 'с' : 'не поставлен') + '</div></div><button class="fz8B y" onclick="FZ8C.startKart()">Заезд</button></div>';
  h += '<div class="fz8Row"><div><div class="nm">🚁 Вертолётный тур</div><div class="sb">$1200 · обзорная экскурсия по новым районам с телепортом и наградой</div></div><button class="fz8B" onclick="FZ8C.heliTour()">Полетели</button></div>';
  h += '<div class="fz8Hint">Аттракционы крутятся в реальном времени, картинг работает как мини-гонка с секторами, вертолёт поднимается в воздух и переносит тебя в другой район.</div>';
  return h;
}
function panelJobs() {
  let h = '<div class="fz8Chip" style="margin-bottom:9px;">Смен отработано: ' + C.jobsDone + ' · контейнеров разгружено: ' + C.portBoxes + ' · смен на заводе: ' + C.factoryShifts + '</div>';
  h += '<div class="fz8Row"><div><div class="nm">⚓ Разгрузка контейнеров (порт)</div><div class="sb">8 контейнеров · $140–320 за каждый · промахи уменьшают выплату</div></div><button class="fz8B g" onclick="FZ8C.job(\'port\')">Начать</button></div>';
  h += '<div class="fz8Row"><div><div class="nm">🏭 Смена на заводе</div><div class="sb">10 деталей · $160–380 · +XP выносливости и достижение за 3 смены</div></div><button class="fz8B g" onclick="FZ8C.job(\'factory\')">Начать</button></div>';
  h += '<div class="fz8Row"><div><div class="nm">📨 Курьерская смена</div><div class="sb">12 посылок · $120–280 · +XP скорости</div></div><button class="fz8B g" onclick="FZ8C.job(\'courier\')">Начать</button></div>';
  h += '<div class="fz8Row"><div><div class="nm">🔧 Разбор металлолома</div><div class="sb">Ресурсы для крафта: металл, пластик, иногда чипы</div></div><button class="fz8B y" onclick="FZ8C.act(\'scrap\')">Разобрать</button></div>';
  h += '<div class="fz8Row"><div><div class="nm">🏗️ Помощь на стройке</div><div class="sb">$450 за этаж · ускоряет рост нового ЖК</div></div><button class="fz8B y" onclick="FZ8C.act(\'site\')">Помочь</button></div>';
  h += '<div class="fz8Row"><div><div class="nm">🎣 Рыбалка с пирса</div><div class="sb">$320–900 за крупный улов, шанс золота</div></div><button class="fz8B g" onclick="FZ8C.fish2()">Забросить</button></div>';
  h += '<div class="fz8Hint">Подработки — это интерактивные смены: кликай по кнопке, пока она подсвечена. Промахи уменьшают выплату, но не отменяют её.</div>';
  return h;
}
window.FZ8L_EXT = window.FZ8L_EXT || {};
window.FZ8L_EXT.districts = panelDistricts;
window.FZ8L_EXT.rides = panelRides;
window.FZ8L_EXT.jobs = panelJobs;
[['districts', '🏙️', 'Районы города'], ['rides', '🎡', 'Аттракционы'], ['jobs', '👷', 'Подработки']].forEach(([id, icon, name]) => {
  if (G('FZ8_addDock')) G('FZ8_addDock')({ id: id, icon: icon, name: name });
});
// ---------------- ИНТЕРАКТ ----------------
window.FZ8C_onInteract = function (inter) {
  if (!inter || !inter.type) return false;
  const t = inter.type;
  if (t === 'fz8c_tour') { heliTour(); return true; }
  if (t === 'fz8c_portjob') { startJob('port'); return true; }
  if (t === 'fz8c_shift') { startJob('factory'); return true; }
  if (t === 'fz8c_job') { startJob(inter.kind || 'courier'); return true; }
  if (t === 'fz8c_ride') { takeRide(inter.kind || pick(['wheel', 'carousel', 'kart'])); return true; }
  if (t === 'fz8c_kart') { startKart(); return true; }
  if (t === 'fz8c_fish2') { fish2(); return true; }
  if (t === 'fz8c_photo') { takePhoto(inter.spot, inter.position.x, inter.position.z); return true; }
  if (t === 'fz8c_ice') { cityActivity('ice'); return true; }
  if (t === 'fz8c_play') { cityActivity('play'); return true; }
  if (t === 'fz8c_scrap') { cityActivity('scrap'); return true; }
  if (t === 'fz8c_site') { cityActivity('site'); return true; }
  if (t === 'fz8c_volley') { cityActivity('volley'); return true; }
  if (t === 'fz8c_surf') { cityActivity('surf'); return true; }
  if (t === 'fz8c_district') {
    const areas = window._fz8CityAreas || [];
    notify('🏙️ Районов построено: ' + areas.length + '/6 · открыто: ' + C.visits.length + '/6');
    return true;
  }
  return false;
};
const prevInteract = window.FZ8_onInteract;
window.FZ8_onInteract = function (inter) {
  try { if (window.FZ8C_onInteract(inter)) return true; } catch (e) {}
  try { return prevInteract ? !!prevInteract(inter) : false; } catch (e) { return false; }
};
// ---------------- ХУК ОБНОВЛЕНИЯ ----------------
let builtT = 0;
function FZ8C_update(delta) {
  const dt = Math.min(delta || 0.016, 0.12);
  try {
    if (!window._fz8CityBuilt) {
      builtT += dt;
      if (builtT > 1.2) { builtT = 0; buildAll(); }
    }
    if (window._fz8CityBuilt) updateCity(dt);
  } catch (e) { if (!window._fz8CErr) { window._fz8CErr = 1; try { console.warn('[fz8city]', e); } catch (x) {} } }
}
window.FZ8C_update = FZ8C_update;
window.FZ8C = {
  build: buildAll, update: FZ8C_update, districts: () => window._fz8CityAreas || [], state: () => C, ach: () => C.ach,
  job: startJob, endJob: endJob, ride: takeRide, heliTour: heliTour, startKart: startKart, act: cityActivity,
  fish2: fish2, photo: takePhoto, close: cityClose, reward: (kind) => { if (kind === 'photo') { addMoney(700); xp('charm', 30); notify('📸 Фото опубликовано: +$700'); cityClose(); } },
  debug: { money: (v) => addMoney(v), build: () => { window._fz8CityBuilt = false; builtT = 99; }, wipe: () => { C = JSON.parse(JSON.stringify(DEF)); saveC(true); notify('dev: сброс v8 city'); } },
};
loadC();
setTimeout(() => {
  try {
    if (buildAll() && !C.seen) {
      C.seen = true; saveC(true);
      setTimeout(() => {
        notify('🏙️ v8.1: вокруг города выросли 6 новых районов — деловой квартал, порт, парк развлечений, пляж, промзона и жилые кварталы. Док 🎮 → 🏙️ 🎡 👷');
        banner('🏙️ НОВЫЕ РАЙОНЫ ГОРОДА', 'Порт ⚓ Парк 🎡 Пляж 🏖️ Промзона 🏭 Деловой квартал 🏙️ Жилые кварталы 🏘️');
      }, 12000);
    }
  } catch (e) {}
}, 4200);
})();
