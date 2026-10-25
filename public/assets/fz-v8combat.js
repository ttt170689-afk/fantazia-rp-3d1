/* ============================================================
   FANTAZIA RP · v8.3 «SUPER» — МОДУЛЬ 6: БОЙ, ОРУЖИЕ, РЕЙДЫ
   6 стволов с прокачкой · патроны · перезарядка · прицел
   Враги с ИИ и полосками HP · банды в районах · рейд-волны
   Нокаут и больница · лут с врагов · оружейный магазин
   ============================================================ */
(function () {
'use strict';
const SKEY = 'fz8_wpn';
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
    if (typeof G('localCoins') === 'number') { window.localCoins = Math.max(0, window.localCoins + v); const cd = $('coinsDisplay'); if (cd) cd.textContent = '💎 ' + window.localCoins; }
  } catch (e) {}
}
function xp(k, v) { try { if (G('FZ8L') && G('FZ8L').xp) G('FZ8L').xp(k, v); } catch (e) {} }
function fx(n, a, b) { try { const F = G('FZFX'); if (F && typeof F[n] === 'function') F[n](a, b); } catch (e) {} }
function puff(x, y, z, s, color, life, op) { try { if (G('FZFX') && G('FZFX').puff) G('FZFX').puff(x, y, z, s, color, life, op); } catch (e) {} }
function pp() { try { return G('localPlayer').mesh.position; } catch (e) { return { x: 0, y: 0, z: 0 }; } }
function lifeS() { try { return G('FZ8L').S; } catch (e) { return null; } }
function camFwd() {
  try {
    const c = G('camera'), T = G('THREE');
    const v = new T.Vector3(); c.getWorldDirection(v);
    const len = Math.hypot(v.x, v.z) || 1;
    return { x: v.x / len, z: v.z / len, y: v.y };
  } catch (e) { return { x: 0, z: -1, y: 0 }; }
}
function losBlocked(ax, az, bx, bz) {
  try {
    if (typeof G('_blocked') === 'function') {
      const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / 1.1));
      for (let i = 1; i < n; i++) {
        const t = i / n;
        if (G('_blocked')(ax + (bx - ax) * t, az + (bz - az) * t, 0.1)) return true;
      }
      return false;
    }
  } catch (e) {}
  return false;
}

// ---------------- СОСТОЯНИЕ ----------------
const DEF = { v: 1, owned: ['fists'], cur: 'fists', ammo: { '9mm': 0, '12g': 0, '762': 0 }, up: {}, kills: 0, headshots: 0, raids: 0, bestWave: 0, deaths: 0, earned: 0, seen: false, ach: [], mob: false, hits: 0, misses: 0 };
let W = JSON.parse(JSON.stringify(DEF));
function loadW() { try { const r = localStorage.getItem(SKEY); if (r) { const o = JSON.parse(r); W = Object.assign(JSON.parse(JSON.stringify(DEF)), o); W.ammo = Object.assign({ '9mm': 0, '12g': 0, '762': 0 }, o.ammo || {}); W.up = o.up || {}; if (!Array.isArray(W.owned)) W.owned = ['fists']; if (!Array.isArray(W.ach)) W.ach = []; } } catch (e) {} }
let saveT = 0;
function saveW(force) { const n = performance.now(); if (!force && n - saveT < 1200) return; saveT = n; try { localStorage.setItem(SKEY, JSON.stringify(W)); } catch (e) {} }
function hasA(id) { return W.ach.indexOf(id) >= 0; }
const ACH = [
  { id: 'kill1',   name: 'Первая кровь',    icon: '🩸', desc: 'Победить первого врага',        reward: 900 },
  { id: 'kill25',  name: 'Уличный боец',    icon: '🥊', desc: 'Победить 25 врагов',            reward: 4200 },
  { id: 'kill100', name: 'Гроза района',    icon: '💀', desc: 'Победить 100 врагов',           reward: 15000 },
  { id: 'snipe',   name: 'Снайпер',         icon: '🎯', desc: 'Убить врага с 70+ метров',      reward: 5200 },
  { id: 'wall',    name: 'Бронебойный',     icon: '🧱', desc: 'Купить максимальную прокачку урона', reward: 8000 },
  { id: 'arsenal', name: 'Арсенал',         icon: '🧰', desc: 'Купить все стволы',             reward: 22000 },
  { id: 'wave5',   name: 'Держим оборону',  icon: '🛡️', desc: 'Пережить 5 волн рейда',         reward: 12000 },
  { id: 'wave10',  name: 'Несокрушимый',    icon: '⚔️', desc: 'Пережить 10 волн рейда',        reward: 30000 },
  { id: 'nohit',   name: 'Чистая работа',   icon: '✨', desc: 'Пройди волну рейда без урона',  reward: 9000 },
  { id: 'ammo',    name: 'Запасливый',      icon: '🧷', desc: 'Купить 200 патронов за раз',    reward: 3600 },
];
function checkA(id) {
  if (hasA(id)) return;
  const a = ACH.find(x => x.id === id); if (!a) return;
  W.ach.push(id); addMoney(a.reward);
  notify('🏅 ' + a.icon + ' ' + a.name + ' (+$' + fmt(a.reward) + ')', 'ach');
  banner('🏅 ДОСТИЖЕНИЕ v8.3: ' + a.name, a.desc + ' · +$' + fmt(a.reward));
  fx('flash', 0.22, [1, 0.85, 0.4]);
  saveW(true);
}

// ---------------- ОРУЖИЕ ----------------
const WEAPONS = [
  { id: 'fists',   name: 'Кулаки',              icon: '✋', dmg: 8,   rate: 0.42, range: 2.6,  melee: true,  price: 0 },
  { id: 'bat',     name: 'Бита «Аргумент»',     icon: '🏏', dmg: 22,  rate: 0.72, range: 3.1,  melee: true,  price: 2800 },
  { id: 'pistol',  name: 'Пистолет «Фантом»',   icon: '🔫', dmg: 26,  rate: 0.33, range: 46,   ammo: '9mm',  mag: 12, spread: 0.022, price: 9800 },
  { id: 'shotgun', name: 'Дробовик «Гром»',     icon: '🔥', dmg: 62,  rate: 0.92, range: 22,   ammo: '12g',  mag: 6,  spread: 0.085, price: 25000, multi: 3 },
  { id: 'rifle',   name: 'Автомат FZ-74',       icon: '⚡', dmg: 18,  rate: 0.115, range: 60,  ammo: '762',  mag: 30, spread: 0.034, price: 54000 },
  { id: 'sniper',  name: 'Снайперка «Игла»',    icon: '🎯', dmg: 135, rate: 1.45, range: 140,  ammo: '762',  mag: 5,  spread: 0.005, price: 86000, scope: true },
];
const AMMO = { '9mm': { name: '9×19', icon: '🧷', price: 5 }, '12g': { name: '12 калибр', icon: '🔴', price: 11 }, '762': { name: '7.62×39', icon: '🟠', price: 8 } };
const UPGRADES = [
  { id: 'dmg',  name: 'Усиленный ствол',  icon: '💥', desc: '+14% урона за уровень',  max: 3, base: 5200 },
  { id: 'mag',  name: 'Расширенный магазин', icon: '📦', desc: '+30% ёмкости за уровень', max: 3, base: 4200 },
  { id: 'rate', name: 'Облегчённый затвор', icon: '⚙️', desc: '−10% задержки за уровень', max: 3, base: 6000 },
];
function wById(id) { return WEAPONS.find(x => x.id === id) || WEAPONS[0]; }
function curW() { return wById(W.cur); }
function upLv(wid, uid) { return (W.up[wid + '_' + uid] || 0); }
function upPrice(wid, uid) {
  const w = wById(wid), u = UPGRADES.find(x => x.id === uid);
  const tier = Math.max(1, WEAPONS.indexOf(w));
  return Math.round(u.base * tier * Math.pow(1.6, upLv(wid, uid)));
}
function weaponStat(w) {
  const dl = w.melee ? upLv(w.id, 'dmg') : upLv(w.id, 'dmg');
  const ml = w.melee ? 0 : upLv(w.id, 'mag');
  const rl = w.melee ? 0 : upLv(w.id, 'rate');
  const perk = (function () { try { return G('FZ8C2') && G('FZ8C2').state().perks.indexOf('master') >= 0 ? 1.1 : 1; } catch (e) { return 1; } })();
  return {
    dmg: Math.round(w.dmg * (1 + dl * 0.14) * perk),
    mag: Math.max(1, Math.round((w.mag || 0) * (1 + ml * 0.3))),
    rate: (w.rate || 0.4) * (1 - rl * 0.1),
    range: w.range, spread: w.spread || 0, melee: !!w.melee, multi: w.multi || 1, scope: !!w.scope,
  };
}
function buyWeapon(id) {
  const w = wById(id);
  if (W.owned.indexOf(id) >= 0) return;
  if (money() < w.price) { notify('❌ Нужно $' + fmt(w.price), 'warn'); return; }
  addMoney(-w.price);
  W.owned.push(id);
  if (w.ammo) W.ammo[w.ammo] = (W.ammo[w.ammo] || 0) + weaponStat(w).mag * 2;
  notify('🔫 Куплено: ' + w.icon + ' ' + w.name + (w.ammo ? ' (+' + weaponStat(w).mag * 2 + ' патронов)' : ''));
  xp('power', 60);
  fx('flash', 0.16, [1, 0.9, 0.6]);
  if (WEAPONS.every(x => W.owned.indexOf(x.id) >= 0)) checkA('arsenal');
  saveW(true);
  buildWeaponMesh();
  if ($('fz8Arsenal')) openArsenal();
}
function buyAmmo(kind, count) {
  const a = AMMO[kind];
  const price = Math.round(a.price * count * (W.owned.indexOf('rifle') >= 0 ? 0.94 : 1));
  if (money() < price) { notify('❌ Нужно $' + fmt(price), 'warn'); return; }
  addMoney(-price);
  W.ammo[kind] = (W.ammo[kind] || 0) + count;
  notify('🧷 Куплено патронов: ' + a.icon + ' ' + count + ' шт. за $' + fmt(price));
  if (count >= 200) checkA('ammo');
  saveW(true);
  if ($('fz8Arsenal')) openArsenal();
}
function buyUpgrade(wid, uid) {
  const w = wById(wid), u = UPGRADES.find(x => x.id === uid);
  if (W.owned.indexOf(wid) < 0) { notify('❌ Сначала купи оружие', 'warn'); return; }
  const lv = upLv(wid, uid);
  if (lv >= u.max) { notify('ℹ️ Максимальный уровень', 'warn'); return; }
  const price = upPrice(wid, uid);
  if (money() < price) { notify('❌ Нужно $' + fmt(price), 'warn'); return; }
  addMoney(-price);
  W.up[wid + '_' + uid] = lv + 1;
  notify(u.icon + ' Улучшение: ' + w.name + ' — ' + u.name + ' ур.' + (lv + 1));
  fx('flash', 0.12, [0.7, 1, 0.8]);
  const full = WEAPONS.every(x => upLv(x.id, 'dmg') >= 3);
  if (full) checkA('wall');
  saveW(true);
  if ($('fz8Arsenal')) openArsenal();
}
function selectWeapon(id, silent) {
  if (W.owned.indexOf(id) < 0) { notify('❌ Ствол не куплен — загляни в оружейный магазин', 'warn'); return; }
  W.cur = id;
  ammoNow = W.ammo[(curW().ammo || '')] || 0;
  buildWeaponMesh();
  if (!silent) notify(curW().icon + ' В руках: ' + curW().name + (curW().ammo ? ' · патронов ' + ammoNow : ''));
  updateWeaponHud();
  saveW(true);
}
let reloading = 0, cooldown = 0, ammoNow = 0;
function reload() {
  const w = curW();
  if (w.melee || !w.ammo || reloading > 0) return;
  const st = weaponStat(w);
  if ((W.ammo[w.ammo] || 0) <= 0) { notify('❌ Нет патронов (' + AMMO[w.ammo].name + ') — купи в магазине', 'warn'); return; }
  if (ammoNow >= st.mag) return;
  reloading = 1.4;
  try { if (G('SFX') && G('SFX').reload) G('SFX').reload(); } catch (e) {}
  notify('🔄 Перезарядка…');
}

// ---------------- МОДЕЛЬ В РУКАХ И ИНТЕРФЕЙС ----------------
let vm = null, vmKick = 0;
function buildWeaponMesh() {
  try {
    const T = G('THREE'), sc = G('scene');
    if (!T || !sc) return;
    if (vm) { try { sc.remove(vm); } catch (e) {} vm = null; }
    const w = curW();
    const g = new T.Group();
    const dark = new T.MeshLambertMaterial({ color: 0x22262e });
    const steel = new T.MeshLambertMaterial({ color: 0x8f98a3 });
    const wood = new T.MeshLambertMaterial({ color: 0x6b4a2a });
    const mk = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
    if (w.id === 'fists') {
      const skin = new T.MeshLambertMaterial({ color: 0xe0b48f });
      mk(new T.BoxGeometry(0.16, 0.14, 0.26), skin, 0, 0, -0.1);
      mk(new T.BoxGeometry(0.14, 0.12, 0.2), skin, 0.24, -0.02, -0.05);
    } else if (w.id === 'bat') {
      mk(new T.CylinderGeometry(0.035, 0.05, 1.15, 8), wood, 0, 0, -0.35).rotation.x = Math.PI / 2;
      mk(new T.CylinderGeometry(0.075, 0.055, 0.42, 8), wood, 0, 0, -1.0).rotation.x = Math.PI / 2;
      mk(new T.BoxGeometry(0.07, 0.07, 0.14), dark, 0, 0, 0.16);
    } else if (w.id === 'pistol') {
      mk(new T.BoxGeometry(0.07, 0.1, 0.32), dark, 0, 0, -0.16);
      mk(new T.BoxGeometry(0.06, 0.17, 0.09), dark, 0, -0.12, 0.02);
      mk(new T.BoxGeometry(0.05, 0.05, 0.12), steel, 0, 0.055, -0.3);
    } else if (w.id === 'shotgun') {
      mk(new T.CylinderGeometry(0.045, 0.045, 1.0, 8), steel, 0, 0.02, -0.42).rotation.x = Math.PI / 2;
      mk(new T.CylinderGeometry(0.038, 0.038, 0.9, 8), dark, 0, -0.06, -0.4).rotation.x = Math.PI / 2;
      mk(new T.BoxGeometry(0.09, 0.14, 0.34), wood, 0, -0.08, 0.14);
      mk(new T.BoxGeometry(0.08, 0.1, 0.26), wood, 0, -0.04, -0.72);
    } else if (w.id === 'rifle') {
      mk(new T.BoxGeometry(0.08, 0.14, 0.72), dark, 0, 0, -0.3);
      mk(new T.CylinderGeometry(0.032, 0.032, 0.66, 8), steel, 0, 0.03, -0.82).rotation.x = Math.PI / 2;
      mk(new T.BoxGeometry(0.06, 0.22, 0.12), dark, 0, -0.15, 0.02);
      mk(new T.BoxGeometry(0.07, 0.26, 0.16), dark, 0, -0.16, -0.34);
      mk(new T.BoxGeometry(0.05, 0.09, 0.2), steel, 0, 0.1, -0.5);
    } else if (w.id === 'sniper') {
      mk(new T.BoxGeometry(0.08, 0.12, 1.15), dark, 0, 0, -0.5);
      mk(new T.CylinderGeometry(0.03, 0.03, 0.9, 8), steel, 0, 0.02, -1.3).rotation.x = Math.PI / 2;
      mk(new T.CylinderGeometry(0.055, 0.055, 0.42, 10), steel, 0, 0.15, -0.42).rotation.x = Math.PI / 2;
      mk(new T.CylinderGeometry(0.05, 0.05, 0.1, 10), steel, 0, 0.15, -0.66).rotation.x = Math.PI / 2;
      mk(new T.BoxGeometry(0.07, 0.2, 0.2), wood, 0, -0.14, 0.06);
    }
    g.scale.setScalar(1.05);
    sc.add(g);
    vm = g;
  } catch (e) {}
}
function placeViewModel() {
  if (!vm) return;
  try {
    const cam = G('camera'), T = G('THREE');
    if (!cam || !T) return;
    vm.position.copy(cam.position);
    vm.quaternion.copy(cam.quaternion);
    vm.translateX(0.24);
    vm.translateY(-0.2 - vmKick * 0.1);
    vm.translateZ(-0.5 + vmKick * 0.25);
    vm.rotateY(-0.06);
    vm.visible = true;
  } catch (e) {}
}
function updateWeaponHud() {
  const d = $('fz8Wpn');
  if (!d) return;
  const w = curW(), st = weaponStat(w);
  const ammoTxt = w.melee ? '∞' : (ammoNow + ' / ' + st.mag);
  const bag = w.melee ? '' : ('<div style="font:10px Arial;color:#a29bfe;">запас: ' + (W.ammo[w.ammo] || 0) + ' ' + AMMO[w.ammo].name + '</div>');
  d.innerHTML = '<div style="display:flex;align-items:center;gap:8px;"><div style="font-size:22px;">' + w.icon + '</div>'
    + '<div><div style="font:bold 12px Arial;color:#fff;">' + w.name + '</div>'
    + '<div style="font:11px Arial;color:#ffd76a;">' + ammoTxt + ' · урон ' + st.dmg + '</div>' + bag + '</div></div>'
    + (reloading > 0 ? '<div style="font:11px Arial;color:#7cffb2;margin-top:3px;">перезарядка…</div>' : '');
  d.style.display = 'block';
}
function buildCombatUI() {
  try {
    if (!$('fz8WpnCss')) {
      const st = document.createElement('style'); st.id = 'fz8WpnCss';
      st.textContent =
        '#fz8Wpn{position:fixed;right:12px;bottom:104px;z-index:6118;background:rgba(6,4,16,.82);border:1.4px solid #ffffff22;border-radius:14px;padding:9px 12px;pointer-events:none;backdrop-filter:blur(6px);min-width:150px;}'
        + '@media (max-width:820px){#fz8Wpn{right:8px;bottom:196px;padding:7px 9px;min-width:120px;}}'
        + '#fz8Gun{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:6117;pointer-events:none;display:none;}'
        + '#fz8Gun .dot{width:3px;height:3px;background:#ff5b5b;border-radius:50%;box-shadow:0 0 4px #000;}'
        + '#fz8Gun .ring{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);border:1.6px solid rgba(255,255,255,.55);border-radius:50%;}'
        + '#fz8Shoot{position:fixed;right:14px;bottom:250px;z-index:6119;width:74px;height:74px;border-radius:50%;border:2px solid #ff6b6b88;background:rgba(200,40,40,.35);color:#fff;font:bold 22px Arial;display:none;}'
        + '#fz8Kills{position:fixed;left:50%;top:78px;transform:translateX(-50%);z-index:6116;background:rgba(6,4,16,.72);border:1px solid #ff6b6b66;border-radius:12px;padding:6px 12px;color:#fff;font:bold 13px Arial;display:none;pointer-events:none;}';
      document.head.appendChild(st);
    }
    if (!$('fz8Wpn')) { const d = document.createElement('div'); d.id = 'fz8Wpn'; document.body.appendChild(d); }
    if (!$('fz8Gun')) { const g = document.createElement('div'); g.id = 'fz8Gun'; g.innerHTML = '<div class="dot"></div><div class="ring" style="width:26px;height:26px;"></div>'; document.body.appendChild(g); }
    if (!$('fz8Kills')) { const k = document.createElement('div'); k.id = 'fz8Kills'; document.body.appendChild(k); }
    if (!$('fz8Shoot')) {
      const b = document.createElement('button'); b.id = 'fz8Shoot'; b.textContent = '🔫';
      b.onclick = (e) => { e.preventDefault(); shoot(); };
      document.body.appendChild(b);
      b.style.display = (G('mobileReady') || 'ontouchstart' in window) ? 'block' : 'none';
    }
    try { const ch = $('crosshair'); if (ch) ch.style.display = 'none'; } catch (e) {}
  } catch (e) {}
}
function updateGunUI() {
  const g = $('fz8Gun');
  if (!g) return;
  g.style.display = uiOpenNow() ? 'none' : 'block';
  const ring = g.querySelector('.ring');
  if (ring) { const s = 22 + (vmKick * 40); ring.style.width = s + 'px'; ring.style.height = s + 'px'; }
  const k = $('fz8Kills');
  if (k) {
    if (raid) { k.style.display = 'block'; k.textContent = '⚔️ РЕЙД · волна ' + raid.wave + ' · врагов ' + enemies.filter(e => e.alive).length + ' · счёт ' + raid.score; }
    else if (curW().melee === false && (W.ammo[curW().ammo] || 0) <= 0 && ammoNow <= 0) { k.style.display = 'block'; k.textContent = '🧷 Нет патронов — купи в оружейном магазине (панель 🧰, клавиша R — перезарядка)'; }
    else { k.style.display = 'none'; }
  }
}
// ---------------- ВЫСТРЕЛ ----------------
let tracerT = 0;
let iframeT = 0, regenT = 0, healT = 0;
function makeTracer(from, to, color) {
  try {
    const T = G('THREE'), sc = G('scene');
    const dir = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
    const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
    const geo = new T.CylinderGeometry(0.022, 0.022, len, 6);
    const mat = new T.MeshBasicMaterial({ color: color || 0xffe08a, transparent: true, opacity: 0.9 });
    const m = new T.Mesh(geo, mat);
    m.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(dir.x / len, dir.y / len, dir.z / len));
    m.userData.life = 0.06;
    sc.add(m);
    tracers.push(m);
    tracerT = 0.5;
  } catch (e) {}
}
const tracers = [];
function uiOpenNow() {
  try {
    if (window.FZLeisure && FZLeisure.modalOpen()) return true;
    if (window.cine || (G('PIN') && G('PIN').open)) return true;
    const ids = ['fz8WpnModal', 'fz8PanelLife', 'cityModal2', 'fz8Modal', 'fz8CityModal', 'shopPanel', 'fz8Modal2'];
    for (let i = 0; i < ids.length; i++) {
      const el = $(ids[i]);
      if (!el) continue;
      const cs = window.getComputedStyle ? window.getComputedStyle(el) : null;
      if (cs && cs.display !== 'none' && cs.visibility !== 'hidden') return true;
    }
  } catch (e) {}
  return false;
}
function shoot() {
  if (window.cine) return;
  const w = curW(), st = weaponStat(w);
  if (cooldown > 0 || reloading > 0) return;
  if (!w.melee && ammoNow <= 0) {
    notify('🧷 Пусто! ' + (W.ammo[w.ammo] > 0 ? 'Перезарядись (R)' : 'Нет патронов ' + AMMO[w.ammo].name), 'warn');
    if (W.ammo[w.ammo] > 0) reload();
    cooldown = 0.4;
    return;
  }
  cooldown = st.rate;
  vmKick = Math.min(1, vmKick + (w.melee ? 0.7 : (w.id === 'sniper' ? 1 : 0.45)));
  const p = pp(), f = camFwd();
  const eyeY = camY();
  if (w.melee) {
    try { if (G('SFX') && G('SFX').swing) G('SFX').swing(); } catch (e) {}
    meleeHit(st, p, eyeY, f);
    return;
  }
  ammoNow--;
  try { if (G('SFX') && G('SFX').shoot) G('SFX').shoot(); else if (G('SFX') && G('SFX').click) G('SFX').click(); } catch (e) {}
  fx('flash', w.id === 'sniper' ? 0.16 : 0.09, [1, 0.85, 0.5], 120);
  fx('shake', w.id === 'shotgun' ? 12 : w.id === 'sniper' ? 14 : 5);
  fx('fov', w.id === 'shotgun' ? 4 : 1.5);
  try { G('localPlayer').mesh.position.x += (Math.random() - 0.5) * 0.02; } catch (e) {}
  const muzzle = { x: p.x + f.x * 1.1, y: eyeY - 0.16, z: p.z + f.z * 1.1 };
  puff(muzzle.x, muzzle.y, muzzle.z, 0.22, 0xffd76a, 0.35, 0.5);
  const hit = pickTarget(st, p, eyeY);
  const maxD = st.range;
  const end = hit ? { x: hit.pos.x, y: hit.pos.y + 0.25, z: hit.pos.z } : { x: muzzle.x + f.x * maxD, y: muzzle.y + f.y * maxD, z: muzzle.z + f.z * maxD };
  makeTracer(muzzle, end, w.id === 'sniper' ? 0x9fe8ff : 0xffe08a);
  if (hit) {
    damageEnemy(hit.enemy, hit.dmg, hit.dist, st);
    W.hits++;
  } else {
    W.misses++;
    if (Math.abs(end.y) < 40) puff(end.x, end.y, end.z, 0.3, 0xb9bcc4, 0.5, 0.35);
  }
  if (w.multi > 1) {
    for (let i = 0; i < w.multi - 1; i++) {
      const extra = pickTarget(st, p, eyeY, hit ? hit.enemy : null);
      if (extra) { damageEnemy(extra.enemy, Math.round(extra.dmg * 0.6), extra.dist, st); W.hits++; }
    }
  }
  updateWeaponHud();
  saveW(false);
}
function camY() { try { return G('camera').position.y; } catch (e) { return 1.7; } }
function pickTarget(st, p, eyeY, exclude) {
  const f = camFwd();
  const cone = 0.06 + st.spread;    // косинусный порог
  let best = null;
  enemies.forEach(e => {
    if (!e.alive || e === exclude) return;
    const dx = e.mesh.position.x - p.x, dz = e.mesh.position.z - p.z, dy = (e.mesh.position.y + 1.1) - eyeY;
    const dist = Math.hypot(dx, dz, dy);
    if (dist > st.range) return;
    const nx = dx / dist, nz = dz / dist;
    const dot = nx * f.x + nz * f.z;
    if (dot < Math.cos(0.34)) return;                 // ~19° общий конус
    if (dist > 3 && losBlockedShot(p.x, p.z, e.mesh.position.x, e.mesh.position.z)) return;
    if (!best || dist < best.dist) best = { enemy: e, dist: dist, dmg: st.dmg, pos: { x: e.mesh.position.x, y: e.mesh.position.y + 1.0, z: e.mesh.position.z } };
  });
  if (!best) return null;
  if (best.dist > st.range * 0.75) best.dmg = Math.round(best.dmg * 0.78);
  return best;
}
function losBlockedShot(ax, az, bx, bz) {
  try {
    const bld = G('buildings') || [];
    const n = Math.max(3, Math.ceil(Math.hypot(bx - ax, bz - az) / 1.5));
    for (let i = 1; i < n; i++) {
      const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      for (let k = 0; k < bld.length; k++) {
        const b = bld[k];
        if (!b || !b.bounds) continue;
        if (x > b.bounds.minX && x < b.bounds.maxX && z > b.bounds.minZ && z < b.bounds.maxZ && b.h > 2.4) return true;
      }
    }
  } catch (e) {}
  return false;
}
function meleeHit(st, p, eyeY, f) {
  let best = null;
  enemies.forEach(e => {
    if (!e.alive) return;
    const dx = e.mesh.position.x - p.x, dz = e.mesh.position.z - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist > st.range) return;
    const dot = (dx / (dist || 1)) * f.x + (dz / (dist || 1)) * f.z;
    if (dot < 0.25) return;
    if (!best || dist < best.dist) best = { enemy: e, dist: dist, dmg: st.dmg, pos: { x: e.mesh.position.x, y: e.mesh.position.y + 1.0, z: e.mesh.position.z } };
  });
  if (best) { damageEnemy(best.enemy, best.dmg, best.dist, st); fx('shake', 8); }
  else { W.misses++; }
}

// ---------------- ВРАГИ ----------------
const enemies = [];
const TYPES = {
  thug:    { name: 'Гопник',      hp: 45,  dmg: 6,  speed: 3.1, color: 0x4a4f5a, hood: 0x2b2f36, ranged: false, aggro: 18, money: [120, 380], xp: 24 },
  bandit:  { name: 'Бандит',      hp: 85,  dmg: 11, speed: 3.6, color: 0x6b3a3a, hood: 0x33201f, ranged: false, aggro: 24, money: [320, 900], xp: 42 },
  shooter: { name: 'Стрелок',     hp: 65,  dmg: 9,  speed: 3.0, color: 0x2f3f5f, hood: 0x1b2436, ranged: true,  aggro: 30, money: [420, 1200], xp: 52 },
  brute:   { name: 'Громила',     hp: 170, dmg: 18, speed: 2.4, color: 0x5a4a2a, hood: 0x2b2418, ranged: false, aggro: 20, money: [700, 2000], xp: 90, scale: 1.25 },
};
function makeEnemy(kind, x, z, zone) {
  try {
    const T = G('THREE'), sc = G('scene');
    if (!T || !sc) return null;
    const cfg = TYPES[kind] || TYPES.thug;
    const g = new T.Group();
    const mBody = new T.MeshLambertMaterial({ color: cfg.color });
    const mHood = new T.MeshLambertMaterial({ color: cfg.hood });
    const mSkin = new T.MeshLambertMaterial({ color: 0xc79268 });
    const body = new T.Mesh(new T.BoxGeometry(0.72, 1.05, 0.42), mBody); body.position.y = 1.15; g.add(body);
    const head = new T.Mesh(new T.BoxGeometry(0.42, 0.42, 0.42), mSkin); head.position.y = 1.95; g.add(head);
    const hood = new T.Mesh(new T.BoxGeometry(0.5, 0.3, 0.5), mHood); hood.position.y = 2.08; g.add(hood);
    const legs = [];
    [[-0.18], [0.18]].forEach(([ox]) => {
      const l = new T.Mesh(new T.BoxGeometry(0.26, 0.85, 0.28), mHood);
      l.position.set(ox, 0.42, 0); g.add(l); legs.push(l);
    });
    const arms = [];
    [-1, 1].forEach((s) => {
      const a = new T.Mesh(new T.BoxGeometry(0.22, 0.9, 0.24), mBody);
      a.position.set(s * 0.48, 1.2, 0); g.add(a); arms.push(a);
    });
    if (cfg.ranged) {
      const gun = new T.Mesh(new T.BoxGeometry(0.1, 0.12, 0.5), new T.MeshLambertMaterial({ color: 0x22262e }));
      gun.position.set(0.48, 0.85, -0.35); g.add(gun);
    } else {
      const bat = new T.Mesh(new T.CylinderGeometry(0.04, 0.05, 0.9, 6), new T.MeshLambertMaterial({ color: 0x6b4a2a }));
      bat.position.set(0.48, 0.7, -0.2); bat.rotation.x = 1.2; g.add(bat);
    }
    // полоска HP
    const barBg = new T.Mesh(new T.PlaneGeometry(1.05, 0.14), new T.MeshBasicMaterial({ color: 0x1c1f26, transparent: true, opacity: 0.85 }));
    const barFg = new T.Mesh(new T.PlaneGeometry(1.0, 0.1), new T.MeshBasicMaterial({ color: 0xff5b5b }));
    barBg.position.y = 2.5; barFg.position.set(0, 2.5, 0.01);
    g.add(barBg); g.add(barFg);
    if (cfg.scale) g.scale.setScalar(cfg.scale);
    g.position.set(x, 0, z);
    sc.add(g);
    const e = {
      kind: kind, cfg: cfg, mesh: g, hp: cfg.hp, maxHp: cfg.hp, alive: true, state: 'idle', t: 0, atk: 0,
      home: { x: x, z: z }, zone: zone || null, legs: legs, arms: arms, bar: barFg, flashT: 0, wander: { x: x, z: z },
      seen: false, hurt: 0,
    };
    enemies.push(e);
    try { if (G('FZFX') && G('FZFX').trackBlob) G('FZFX').trackBlob(g); } catch (x2) {}
    return e;
  } catch (e) { return null; }
}
function spawnAt(x, z, kind, zone) {
  let ok = true;
  try {
    const bld = G('buildings') || [];
    ok = !bld.some(b => b && b.bounds && x > b.bounds.minX - 1 && x < b.bounds.maxX + 1 && z > b.bounds.minZ - 1 && z < b.bounds.maxZ + 1);
  } catch (e) {}
  if (!ok) return null;
  return makeEnemy(kind || 'thug', x, z, zone);
}
const ZONES = [
  { id: 'industrial', name: 'Склады промзоны', kind: ['thug', 'bandit', 'shooter'], count: 4, radius: 14 },
  { id: 'port',       name: 'Портовые доки',   kind: ['bandit', 'shooter'],          count: 4, radius: 16 },
  { id: 'park',       name: 'Заброшенный парк',kind: ['thug', 'bandit'],             count: 3, radius: 12 },
  { id: 'residential',name: 'Тёмные дворы',    kind: ['thug', 'brute'],              count: 3, radius: 14 },
];
function zoneCenter(id) {
  try { const a = (G('FZ8C') ? G('FZ8C').districts() : []).find(d => d.id === id); if (a) return { x: a.x, z: a.z }; } catch (e) {}
  return null;
}
function populateZone(z) {
  const c = zoneCenter(z.id);
  if (!c) return;
  for (let i = 0; i < z.count; i++) {
    const ang = Math.random() * Math.PI * 2, r = 6 + Math.random() * z.radius;
    spawnAt(c.x + Math.cos(ang) * r, c.z + Math.sin(ang) * r, pick(z.kind), z.id);
  }
}
let nightSpawnT = 0;
function nightThugs(dt) {
  const night = (window.FZDN && window.FZDN.nightF) || 0;
  if (night < 0.5) return;
  nightSpawnT += dt;
  if (nightSpawnT < 45) return;
  nightSpawnT = 0;
  const alive = enemies.filter(e => e.alive).length;
  if (alive > 14) return;
  const p = pp();
  const ang = Math.random() * Math.PI * 2, r = 34 + Math.random() * 26;
  spawnAt(p.x + Math.cos(ang) * r, p.z + Math.sin(ang) * r, Math.random() < 0.3 ? 'bandit' : 'thug', 'street');
}
function damageEnemy(e, dmg, dist, st) {
  if (!e || !e.alive) return;
  e.hp -= dmg;
  e.hurt = 0.2;
  if (e.state === 'idle') e.state = 'chase';
  puff(e.mesh.position.x, e.mesh.position.y + 1.2, e.mesh.position.z, 0.28, 0xa01818, 0.4, 0.6);
  fx('burst', e.mesh.position.x, 1.2, e.mesh.position.z, 0xff4444, 3);
  try { e.bar.scale.x = clamp(e.hp / e.maxHp, 0, 1); e.bar.position.x = -0.5 * (1 - clamp(e.hp / e.maxHp, 0, 1)); } catch (x) {}
  if (dist > 70) checkA('snipe');
  if (e.hp <= 0) killEnemy(e, st);
}
function killEnemy(e, st) {
  e.alive = false;
  W.kills++;
  const cfg = e.cfg;
  const cash = ri(cfg.money[0], cfg.money[1]);
  addMoney(cash);
  W.earned += cash;
  xp('power', cfg.xp);
  xp('stealth', Math.round(cfg.xp / 3));
  const s = lifeS();
  if (s && Math.random() < 0.5) { const k = pick(['metal', 'plastic', 'chip']); s.res[k] += ri(1, 3); }
  if (Math.random() < 0.35) {
    const ammoKinds = Object.keys(AMMO).filter(k => W.owned.some(id => wById(id).ammo === k));
    if (ammoKinds.length) { const k = pick(ammoKinds); const n = ri(4, 14); W.ammo[k] += n; notify('🧷 Трофеи: +' + n + ' патронов ' + AMMO[k].name); }
  }
  notify('💀 ' + cfg.name + ' повержен · +$' + fmt(cash) + ' · +' + cfg.xp + ' XP силы');
  if (raid) { raid.kills++; raid.score += Math.round(cash / 10); raid.nodmgWindow = false; }
  try {
    const idx = enemies.indexOf(e);
    if (idx >= 0) enemies.splice(idx, 1);
    G('scene').remove(e.mesh);
  } catch (x) {}
  puff(e.mesh.position.x, 1, e.mesh.position.z, 1.6, 0x7a1010, 1.2, 0.5);
  if (W.kills >= 1) checkA('kill1');
  if (W.kills >= 25) checkA('kill25');
  if (W.kills >= 100) checkA('kill100');
  // розыск и репутация
  try { const S = lifeS(); if (S) { S.wanted = clamp((S.wanted || 0) + 0.25, 0, 5); S.wantedT = 30; } } catch (x) {}
  try { if (G('FZ8W')) G('FZ8W').debug.rep('street', 18); } catch (x) {}
  void st;
  saveW(true);
}
function updateEnemies(dt) {
  const p = pp();
  const eyeY = camY();
  enemies.forEach(e => {
    if (!e.alive) return;
    const m = e.mesh;
    const dx = p.x - m.position.x, dz = p.z - m.position.z;
    const dist = Math.hypot(dx, dz);
    e.t += dt;
    if (e.hurt > 0) e.hurt -= dt;
    if (e.flashT > 0) { e.flashT -= dt; if (e.flashT <= 0) { try { m.visible = true; } catch (x) {} } }
    // состояние
    if (e.state === 'idle' && dist < e.cfg.aggro) e.state = 'chase';
    if (e.state === 'chase' && dist > e.cfg.aggro * 1.8) e.state = 'idle';
    if (e.state === 'idle') {
      if (e.t % 4 < 0.05 || !e.wander) {
        const ang = Math.random() * Math.PI * 2;
        e.wander = { x: e.home.x + Math.cos(ang) * 6, z: e.home.z + Math.sin(ang) * 6 };
      }
      const wx = e.wander.x - m.position.x, wz = e.wander.z - m.position.z;
      const wd = Math.hypot(wx, wz);
      if (wd > 0.7) {
        m.position.x += (wx / wd) * dt * e.cfg.speed * 0.45;
        m.position.z += (wz / wd) * dt * e.cfg.speed * 0.45;
        m.rotation.y = Math.atan2(wx, wz);
        animateLegs(e, dt, 6);
      }
      try { e.bar.parent.visible = dist < 30; } catch (x) {}
      return;
    }
    if (e.state === 'chase') {
      m.rotation.y = Math.atan2(dx, dz);
      const stop = e.cfg.ranged ? 14 : 1.9;
      if (dist > stop) {
        const step = dt * e.cfg.speed;
        const nx = m.position.x + (dx / (dist || 1)) * step, nz = m.position.z + (dz / (dist || 1)) * step;
        const blocked = losBlockedShot(m.position.x, m.position.z, nx, nz);
        if (!blocked) { m.position.x = nx; m.position.z = nz; }
        else { m.position.x += (dz / (dist || 1)) * step * 0.8; m.position.z -= (dx / (dist || 1)) * step * 0.8; }
        animateLegs(e, dt, 12);
      }
      e.atk -= dt;
      if (dist < e.cfg.aggro + 4) {
        if (!e.cfg.ranged && dist < 2.4 && e.atk <= 0) {
          e.atk = 1.1;
          hitPlayer(e.cfg.dmg + ri(0, 4), e);
        } else if (e.cfg.ranged && dist < 30 && e.atk <= 0) {
          e.atk = 1.35 + Math.random() * 0.5;
          tracerToPlayer(e);
          if (Math.random() < 0.62) hitPlayer(e.cfg.dmg + ri(0, 3), e);
        }
      }
      try { e.bar.parent.visible = true; } catch (x) {}
    }
  });
  // чистка далёких
  if (enemies.length > 30) {
    enemies.sort((a, b) => Math.hypot(b.mesh.position.x - p.x, b.mesh.position.z - p.z) - Math.hypot(a.mesh.position.x - p.x, a.mesh.position.z - p.z));
    for (let i = 30; i < enemies.length; i++) { try { G('scene').remove(enemies[i].mesh); } catch (e) {} }
    enemies.length = 30;
  }
  void eyeY;
}
function animateLegs(e, dt, speed) {
  const k = Math.sin(e.t * speed);
  try {
    e.legs[0].rotation.x = k * 0.6;
    e.legs[1].rotation.x = -k * 0.6;
    e.arms[0].rotation.x = -k * 0.3;
    e.arms[1].rotation.x = k * 0.3;
  } catch (x) {}
  void dt;
}
function tracerToPlayer(e) {
  const p = pp(), f = { x: (p.x - e.mesh.position.x), z: (p.z - e.mesh.position.z) };
  const len = Math.hypot(f.x, f.z) || 1;
  makeTracer(
    { x: e.mesh.position.x + (f.x / len) * 0.6, y: e.mesh.position.y + 1.3, z: e.mesh.position.z + (f.z / len) * 0.6 },
    { x: p.x - (f.x / len) * 0.4, y: camY() - 0.1, z: p.z - (f.z / len) * 0.4 }, 0xff6b6b);
  puff(e.mesh.position.x + (f.x / len) * 0.7, e.mesh.position.y + 1.3, e.mesh.position.z + (f.z / len) * 0.6, 0.2, 0xffcc66, 0.3, 0.5);
}
function hitPlayer(dmg, e) {
  if (iframeT > 0) return;
  iframeT = (e && e.cfg && e.cfg.ranged) ? 0.22 : 0.34;
  try {
    const S = lifeS();
    let mul = 1;
    if (S && S.dmgMul) mul = S.dmgMul;
    if (G('FZ8C2') && G('FZ8C2').hasPassive && G('FZ8C2').hasPassive('armor')) mul *= 0.6;
    const d = Math.max(1, Math.round(dmg * mul));
    const lp = G('localPlayer');
    lp.health = Math.max(0, (lp.health || 100) - d);
    if (G('updateHealthBar')) G('updateHealthBar')();
    fx('damage');
    fx('shake', 10);
    if (raid) { raid.damageTaken += d; }
    notify('💢 Урон −' + d + (e ? ' от ' + e.cfg.name : ''), 'warn');
    if (lp.health <= 0) knockedOut(e);
  } catch (x) {}
}
function knockedOut(e) {
  try {
    const lp = G('localPlayer');
    const S = lifeS();
    W.deaths++;
    let fine = Math.round(money() * 0.08);
    if (G('FZ8C2') && G('FZ8C2').hasPassive && G('FZ8C2').hasPassive('safe')) fine = Math.round(fine * 0.5);
    fine = Math.min(fine, 50000);
    addMoney(-fine);
    lp.health = 65;
    if (G('updateHealthBar')) G('updateHealthBar')();
    if (S) { S.wanted = 0; S.wantedT = 0; }
    // ближайшая больница или точка возрождения
    let dst = { x: 0, z: 0 };
    try {
      const b = (G('buildings') || []).find(x => x && x.type === 'hospital');
      if (b) dst = { x: b.x, z: b.z + b.d / 2 + 6 };
    } catch (x) {}
    try { lp.mesh.position.set(dst.x, 1, dst.z); } catch (x) {}
    enemies.forEach(en => { try { G('scene').remove(en.mesh); } catch (x) {} });
    enemies.length = 0;
    fx('fade', 1, 0);
    fx('letterbox', true);
    setTimeout(() => { fx('letterbox', false); }, 1400);
    notify('🚑 Тебя вырубили' + (e ? ' (' + e.cfg.name + ')' : '') + '! Штраф $' + fmt(fine) + ', очнулся в больнице', 'warn');
    banner('🚑 НОКАУТ', 'Очнулся в больнице · потеряно $' + fmt(fine));
    if (raid) endRaid(false);
    saveW(true);
  } catch (x) {}
}

// ---------------- РЕЙД ----------------
let raid = null;
function startRaid(zoneId) {
  if (raid) { notify('⏳ Рейд уже идёт', 'warn'); return; }
  const z = ZONES.find(x => x.id === zoneId) || ZONES[0];
  const c = zoneCenter(z.id);
  if (!c) { notify('❌ Район не найден — подойди к бойцам в промзоне или порту', 'warn'); return; }
  raid = { zone: z, wave: 0, score: 0, kills: 0, damageTaken: 0, rest: 0, active: true, x: c.x, z: c.z, clean: true };
  notify('⚔️ РЕЙД в зоне «' + z.name + '»! Отбивай волны — между ними 6 секунд передышки', 'warn');
  banner('⚔️ РЕЙД НАЧАЛСЯ', z.name + ' · отбивай волны врагов, за каждую — деньги');
  nextWave();
  saveW(true);
}
function nextWave() {
  if (!raid) return;
  raid.wave++;
  const n = Math.min(8, 2 + Math.floor(raid.wave * 0.8) + (raid.wave % 3 === 0 ? 2 : 0));
  const kinds = raid.zone.kind;
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2, r = 12 + Math.random() * 14;
    const kind = (raid.wave % 3 === 0 && i === 0) ? 'brute' : pick(kinds);
    const e = spawnAt(raid.x + Math.cos(ang) * r, raid.z + Math.sin(ang) * r, kind, raid.zone.id);
    if (e) { e.state = 'chase'; e.maxHp = Math.round(e.maxHp * (1 + (raid.wave - 1) * 0.12)); e.hp = e.maxHp; }
  }
  raid.waveDmg = raid.damageTaken;
  notify('⚔️ Волна ' + raid.wave + ': врагов ' + n + (raid.wave % 3 === 0 ? ' (босс-громила!)' : ''));
  if (raid.wave >= 5) checkA('wave5');
  if (raid.wave >= 10) checkA('wave10');
}
function updateRaid(dt) {
  if (!raid) return;
  const alive = enemies.filter(e => e.alive).length;
  if (alive === 0) {
    if (raid.rest <= 0) {
      const prize = 900 + raid.wave * 750;
      addMoney(prize);
      xp('power', 60 + raid.wave * 20);
      notify('🏆 Волна ' + raid.wave + ' отбита! +$' + fmt(prize));
      if (raid.damageTaken === raid.waveDmg) checkA('nohit');
      raid.rest = 6;
    }
    raid.rest -= dt;
    if (raid.rest <= 0) { raid.rest = 0; nextWave(); }
  }
}
function endRaid(win) {
  if (!raid) return;
  const bonus = win ? 4000 + raid.wave * 1200 : 0;
  if (bonus) addMoney(bonus);
  W.raids++;
  if (raid.wave > W.bestWave) W.bestWave = raid.wave;
  notify((win ? '🎉 Рейд завершён!' : '💥 Рейд прерван') + ' Волн: ' + raid.wave + ' · убито: ' + raid.kills + (bonus ? ' · бонус $' + fmt(bonus) : ''));
  if (win) banner('🎉 РЕЙД ПРОЙДЕН', 'Волн ' + raid.wave + ' · убито ' + raid.kills + ' · бонус $' + fmt(bonus));
  enemies.slice().forEach(e => { if (e.zone === raid.zone.id && e.zone) { try { G('scene').remove(e.mesh); enemies.splice(enemies.indexOf(e), 1); } catch (x) {} } });
  raid = null;
  saveW(true);
}
// ---------------- ОРУЖЕЙНЫЙ МАГАЗИН ----------------
function buildArsenal() {
  try {
    if (window._fz8ArsenalBuilt) return;
    const T = G('THREE'), sc = G('scene');
    if (!T || !sc) return;
    const areas = (G('FZ8C') ? G('FZ8C').districts() : []);
    const spots = [];
    const ind = areas.find(a => a.id === 'industrial');
    const port = areas.find(a => a.id === 'port');
    if (ind) spots.push({ x: ind.x - 40, z: ind.z + 40 });
    if (port) spots.push({ x: port.x + 20, z: port.z + 40 });
    spots.forEach((s, i) => {
      const g = new T.Group();
      const base = new T.Mesh(new T.BoxGeometry(9, 4.5, 7), new T.MeshLambertMaterial({ color: 0x2b2f36 }));
      base.position.y = 2.25; g.add(base);
      const sign = new T.Mesh(new T.PlaneGeometry(7, 1.8), new T.MeshBasicMaterial({ color: 0xff6b6b }));
      sign.position.set(0, 3.9, 3.6); g.add(sign);
      const pole = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 4, 8), new T.MeshLambertMaterial({ color: 0x9aa2ad }));
      pole.position.set(-3, 2, 3.6); g.add(pole);
      for (let k = 0; k < 3; k++) {
        const gun = new T.Mesh(new T.BoxGeometry(0.12, 0.2, 1.1), new T.MeshLambertMaterial({ color: 0x14161a }));
        gun.position.set(-2 + k * 2, 3.1, 3.7); gun.rotation.z = 0.35; g.add(gun);
      }
      g.position.set(s.x, 0, s.z);
      g.rotation.y = i ? Math.PI : 0;
      sc.add(g);
      addInter(s.x, s.z, 'fz8k_arsenal', '🔫 Оружейный магазин «СТВОЛ» (купить стволы и патроны)', 4.2);
      addCollider(s.x, s.z, 5);
    });
    window._fz8ArsenalBuilt = true;
  } catch (e) {}
}
function addInter(x, z, type, name, range) {
  try { G('interactables').push({ position: { x: x, y: 0, z: z }, type: type, name: name, range: range || 3.4, fz8: true, fz8k: true }); } catch (e) {}
}
function addCollider(x, z, r) { try { G('streetColliders').push({ x: x, z: z, r: r }); } catch (e) {} }
// ---------------- ОБНОВЛЕНИЕ ----------------
let hudT = 0, zonesT = 0, builtT = 0, killFxT = 0;
function FZ8K_update(delta) {
  const dt = Math.min(delta || 0.016, 0.12);
  try {
    // таймеры оружия / неуязвимость / регенерация
    if (iframeT > 0) iframeT -= dt;
    try {
      const pl = pp();
      const threat = enemies.some(x => x.alive && Math.hypot(x.mesh.position.x - pl.x, x.mesh.position.z - pl.z) < 26);
      const lp2 = G('localPlayer');
      if (!threat && !raid && lp2 && lp2.health < 100) {
        regenT += dt;
        if (regenT > 6) { healT += dt; if (healT >= 1) { healT = 0; lp2.health = Math.min(100, lp2.health + 2); if (G('updateHealthBar')) G('updateHealthBar')(); } }
      } else { regenT = 0; }
    } catch (e) {}
    if (cooldown > 0) cooldown -= dt;
    if (reloading > 0) {
      reloading -= dt;
      if (reloading <= 0) {
        reloading = 0;
        const w = curW(), st = weaponStat(w);
        const need = st.mag - ammoNow;
        const have = W.ammo[w.ammo] || 0;
        const take = Math.min(need, have);
        W.ammo[w.ammo] = have - take;
        ammoNow += take;
        notify('🔄 Перезаряжено: ' + ammoNow + '/' + st.mag);
        updateWeaponHud();
        saveW(true);
      }
    }
      vmKick = Math.max(0, vmKick - dt * 5);
    // прицел/ХУД
    hudT += dt;
    if (hudT > 0.25) { hudT = 0; updateGunUI(); updateWeaponHud(); }
    placeViewModel();
    // трассеры
    for (let i = tracers.length - 1; i >= 0; i--) {
      const m = tracers[i];
      m.userData.life -= dt;
      try { m.material.opacity = Math.max(0, m.userData.life * 16); } catch (e) {}
      if (m.userData.life <= 0) { try { G('scene').remove(m); } catch (e) {} tracers.splice(i, 1); }
    }
    killFxT += dt;
    // враги
    updateEnemies(dt);
    nightThugs(dt);
    updateRaid(dt);
    // заселение зон
    zonesT += dt;
    if (zonesT > 20) {
      zonesT = 0;
      const alive = enemies.filter(e => e.alive).length;
      if (alive < 12) ZONES.forEach(z => { if (enemies.filter(e => e.zone === z.id && e.alive).length < 3) populateZone(z); });
    }
    builtT += dt;
    if (builtT > 3 && !window._fz8CombatReady) {
      builtT = 0;
      if (G('buildings') && G('buildings').length > 5 && G('FZ8C') && G('FZ8C').districts().length >= 5) {
        window._fz8CombatReady = true;
        buildArsenal();
        ZONES.forEach(populateZone);
      }
    }
    // синхронизация патронов при смене
    const w = curW();
    if (!w.melee && ammoNow > weaponStat(w).mag) ammoNow = weaponStat(w).mag;
    if (!window.FZ8_wpnAmmoLoaded) { window.FZ8_wpnAmmoLoaded = true; ammoNow = Math.min(W.ammo[w.ammo] || 0, weaponStat(w).mag); }
  } catch (e) { if (!window._fz8KErr) { window._fz8KErr = 1; try { console.warn('[fz8combat]', e); } catch (x) {} } }
}
// ---------------- ПАНЕЛИ ----------------
function modalK(title, html, width) {
  let m = $('fz8WpnModal');
  if (!m) {
    m = document.createElement('div'); m.id = 'fz8WpnModal';
    m.style.cssText = 'position:fixed;inset:0;z-index:8470;background:rgba(4,2,12,.8);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;';
    m.onclick = (e) => { if (e.target === m) m.style.display = 'none'; };
    document.body.appendChild(m);
  }
  m.innerHTML = '<div style="width:min(' + (width || 600) + 'px,96vw);max-height:90vh;overflow:auto;background:linear-gradient(165deg,#1a1420,#0a0812);border:1.5px solid #ff6b6b66;border-radius:18px;padding:16px;color:#fff;font:14px Arial;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><div style="font:bold 16px Arial;">' + title + '</div>'
    + '<button onclick="document.getElementById(\'fz8WpnModal\').style.display=\'none\'" style="background:#ffffff14;color:#fff;border:1px solid #ffffff30;border-radius:10px;width:30px;height:30px;cursor:pointer;">✕</button></div>' + html + '</div>';
  m.style.display = 'flex';
  return m;
}
function openArsenal() {
  const w = curW(), st = weaponStat(w);
  let h = '<div class="fz8Row" style="display:block;"><div class="nm">🧰 Арсенал: убито врагов ' + W.kills + ' · рейдов ' + W.raids + ' · лучшая волна ' + W.bestWave + ' · нокаутов ' + W.deaths + '</div>'
    + '<div class="sb">Точность: ' + (W.hits + W.misses ? Math.round(W.hits / (W.hits + W.misses) * 100) : 0) + '% · заработано на боях: $' + fmt(W.earned) + '</div></div>';
  h += '<div class="fz8Chip" style="margin:8px 0;">🔫 ОРУЖИЕ</div>';
  h += WEAPONS.map(x => {
    const own = W.owned.indexOf(x.id) >= 0;
    const s2 = weaponStat(x);
    return '<div class="fz8Row" style="' + (W.cur === x.id ? 'border-color:#7cffb2;' : '') + '"><div><div class="nm">' + x.icon + ' ' + x.name + (W.cur === x.id ? ' · в руках' : '') + '</div>'
      + '<div class="sb">урон ' + s2.dmg + ' · скорострельность ' + (1 / s2.rate).toFixed(1) + '/с · дальность ' + s2.range + ' м' + (x.ammo ? ' · магазин ' + s2.mag : '') + '</div></div>'
      + '<div style="display:flex;gap:6px;">' + (own ? '<button class="fz8B ' + (W.cur === x.id ? '' : 'g') + '" onclick="FZ8K.take(\'' + x.id + '\')">В руки</button>'
        : '<button class="fz8B ' + (money() >= x.price ? 'g' : '') + '" ' + (money() >= x.price ? '' : 'disabled') + ' onclick="FZ8K.buy(\'' + x.id + '\')">$' + fmt(x.price) + '</button>') + '</div></div>';
  }).join('');
  h += '<div class="fz8Chip" style="margin:10px 0 8px;">🧷 ПАТРОНЫ</div>';
  h += Object.keys(AMMO).map(k => '<div class="fz8Row"><div><div class="nm">' + AMMO[k].icon + ' ' + AMMO[k].name + '</div><div class="sb">в сумке: ' + (W.ammo[k] || 0) + ' шт. · $' + AMMO[k].price + '/шт</div></div>'
    + '<div style="display:flex;gap:6px;"><button class="fz8B g" onclick="FZ8K.ammo(\'' + k + '\',30)">+30 · $' + fmt(AMMO[k].price * 30) + '</button>'
    + '<button class="fz8B y" onclick="FZ8K.ammo(\'' + k + '\',200)">+200 · $' + fmt(AMMO[k].price * 200) + '</button></div></div>').join('');
  h += '<div class="fz8Chip" style="margin:10px 0 8px;">⚙️ ПРОКАЧКА (для выбранного: ' + w.name + ')</div>';
  h += UPGRADES.map(u => {
    const lv = upLv(w.id, u.id);
    const price = upPrice(w.id, u.id);
    return '<div class="fz8Row"><div><div class="nm">' + u.icon + ' ' + u.name + ' · ур. ' + lv + '/' + u.max + '</div><div class="sb">' + u.desc + '</div></div>'
      + (lv >= u.max ? '<div class="vl">макс</div>' : '<button class="fz8B ' + (money() >= price ? 'g' : '') + '" ' + (money() >= price ? '' : 'disabled') + ' onclick="FZ8K.up(\'' + w.id + '\',\'' + u.id + '\')">$' + fmt(price) + '</button>') + '</div>';
  }).join('');
  h += '<div class="fz8Hint">Управление: ЛКМ — выстрел/удар, R — перезарядка, клавиши 4-9 — быстрый выбор ствола. Стрельба в городе повышает розыск. Прокачка действует на каждое оружие отдельно.</div>';
  modalK('🔫 ' + w.icon + ' АРСЕНАЛ «СТВОЛ»', h, 620);
}
function openRaidPanel() {
  let h = '<div class="fz8Chip" style="margin-bottom:9px;">Рейды — это волны врагов в районах города. Между волнами 6 секунд передышки, каждая волна приносит деньги и опыт.</div>';
  if (raid) {
    h += '<div class="fz8Row" style="display:block;"><div class="nm">⚔️ СЕЙЧАС: ' + raid.zone.name + ' · волна ' + raid.wave + '</div>'
      + '<div class="sb">убито: ' + raid.kills + ' · получено урона: ' + raid.damageTaken + ' · осталось врагов: ' + enemies.filter(e => e.alive).length + '</div></div>'
      + '<button class="fz8B r" onclick="FZ8K.endRaid()">Прервать рейд</button>';
  } else {
    h += ZONES.map(z => '<div class="fz8Row"><div><div class="nm">⚔️ ' + z.name + '</div><div class="sb">враги: ' + z.kind.map(k => TYPES[k].name).join(', ') + ' · бойцов одновременно до ' + z.count + '</div></div>'
      + '<button class="fz8B g" onclick="FZ8K.raid(\'' + z.id + '\')">Начать рейд</button></div>').join('');
  }
  h += '<div class="fz8Hint">Банды также сами появляются в промзоне, порту, парке и тёмных дворах, а ночью — прямо на улицах. С них падают деньги, патроны, ресурсы и опыт. Не забывай про аптечки и бронежилет из магазина предметов.</div>';
  modalK('⚔️ РЕЙДЫ И БАНДЫ', h, 600);
}
// ---------------- ЭКСПОРТ И ХУКИ ----------------
window.FZ8K = {
  buy: buyWeapon, take: selectWeapon, ammo: buyAmmo, up: buyUpgrade, shoot: shoot, reload: reload,
  raid: startRaid, endRaid: () => endRaid(true), arsenal: openArsenal, raids: openRaidPanel,
  state: () => W, weapons: WEAPONS, enemies: () => enemies, spawn: (k, x, z) => spawnAt(x, z, k, 'test'),
  kills: () => W.kills, hurt: (d) => hitPlayer(d, null), give: (k, n) => { W.ammo[k] = (W.ammo[k] || 0) + n; ammoNow = Math.min(weaponStat(curW()).mag, W.ammo[curW().ammo] || 0); },
  debug: { money: (v) => addMoney(v), all: () => { WEAPONS.forEach(w2 => { if (W.owned.indexOf(w2.id) < 0) { W.owned.push(w2.id); } }); Object.keys(AMMO).forEach(k => W.ammo[k] += 500); buildWeaponMesh(); notify('dev: арсенал выдан'); }, wipe: () => { W = JSON.parse(JSON.stringify(DEF)); saveW(true); notify('dev: сброс оружия'); } },
};
window.FZ8K_update = FZ8K_update;
window.FZ8K_onInteract = function (inter) {
  if (!inter || !inter.type) return false;
  if (inter.type === 'fz8k_arsenal') { openArsenal(); return true; }
  return false;
};
const prevInteractK = window.FZ8_onInteract;
window.FZ8_onInteract = function (inter) {
  try { if (window.FZ8K_onInteract(inter)) return true; } catch (e) {}
  try { return prevInteractK ? !!prevInteractK(inter) : false; } catch (e) { return false; }
};
// мышь: выстрел при захвате курсора
try {
  document.addEventListener('mousedown', (e) => {
    try {
      if (e.button !== 0) return;
      if (!G('isPointerLocked')) return;
      if (uiOpenNow()) return;
      shoot();
    } catch (x) {}
  }, false);
  window.addEventListener('keydown', (e) => {
    try {
      if (/^Digit[4-9]$/.test(e.code)) {
        const map = { Digit4: 'fists', Digit5: 'bat', Digit6: 'pistol', Digit7: 'shotgun', Digit8: 'rifle', Digit9: 'sniper' };
        selectWeapon(map[e.code]);
      } else if (e.code === 'KeyR') reload();
    } catch (x) {}
  });
} catch (e) {}
// ---------------- ДОК И РАЗДЕЛЫ ----------------
[['arsenal', '🧰', 'Арсенал'], ['raids', '⚔️', 'Рейды и банды']].forEach(([id, icon, name]) => {
  try { if (G('FZ8_addDock')) G('FZ8_addDock')({ id: id, icon: icon, name: name }); } catch (e) {}
});
window.FZ8L_EXT = window.FZ8L_EXT || {};
window.FZ8L_EXT.arsenal = () => { setTimeout(openArsenal, 30); return '<div class="fz8Hint">Открываю арсенал…</div>'; };
window.FZ8L_EXT.raids = () => { setTimeout(openRaidPanel, 30); return '<div class="fz8Hint">Открываю рейды…</div>'; };
// ---------------- ИНИЦИАЛИЗАЦИЯ ----------------
loadW();
buildCombatUI();
setTimeout(() => {
  try {
    buildWeaponMesh();
    ammoNow = Math.min(W.ammo[curW().ammo] || 0, weaponStat(curW()).mag);
    updateWeaponHud();
    if (!W.seen) {
      W.seen = true; saveW(true);
      setTimeout(() => {
        notify('🔫 v8.3: боевая система готова — 6 стволов, 4 типа врагов, рейды и оружейный магазин «СТВОЛ». ЛКМ — стрелять, R — перезарядка, 4-9 — выбор оружия. Панель 🧰 в доке');
        banner('🔫 БОЕВАЯ СИСТЕМА v8.3', 'Арсенал 🧰 · рейды ⚔️ · банды в районах · оружейный магазин');
      }, 18000);
    }
  } catch (e) {}
}, 5600);
})();
