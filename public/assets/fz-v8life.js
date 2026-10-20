/* ============================================================
   FANTAZIA RP · v8.0 «SUPER» — МОДУЛЬ 2: ЖИЗНЬ И ПРОКАЧКА
   Скиллы · крафт · питомцы · жильё · транспорт
   розыск · достижения · ежедневки · генератор заданий
   ============================================================ */
(function () {
'use strict';
const SKEY = 'fz8_life';
const $ = (id) => document.getElementById(id);
function G(n) { try { return window[n]; } catch (e) { return undefined; } }
function rnd(a, b) { return a + Math.random() * (b - a); }
function ri(a, b) { return Math.floor(rnd(a, b + 1)); }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function fmt(n) { n = Math.round(n); return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
function notify(t, c) { try { const f = G('showNotification') || (G('FZ8H') && G('FZ8H').notify); if (typeof f === 'function') f(t, c); } catch (e) {} }
function money() { try { return Math.round(G('localPlayer') ? G('localPlayer').money : 0); } catch (e) { return 0; } }
function addMoney(v) {
  v = Number(v); if (!isFinite(v)) v = 0;
  try {
    if (G('FZ8H') && typeof G('FZ8H').addMoney === 'function') { G('FZ8H').addMoney(v); return true; }
    if (G('localPlayer')) { G('localPlayer').money = Math.max(0, (G('localPlayer').money || 0) + v); const md = $('moneyDisplay'); if (md) md.textContent = '$' + fmt(G('localPlayer').money); return true; }
  } catch (e) {}
  return false;
}
function addCoins(v) { try { if (G('FZ8H') && typeof G('FZ8H').addCoins === 'function') { G('FZ8H').addCoins(v); return true; } if (typeof G('localCoins') === 'number') { window.localCoins += v; const cd = $('coinsDisplay'); if (cd) cd.textContent = '💎 ' + window.localCoins; return true; } } catch (e) {} return false; }
function sfx(n) { try { const s = G('SFX'); if (s && typeof s[n] === 'function') s[n](); else if (s && typeof s.play === 'function') s.play(n); } catch (e) {} }
function fx(name, a, b) { try { const F = G('FZFX'); if (F && typeof F[name] === 'function') F[name](a, b); } catch (e) {} }
function pp() { try { return G('localPlayer').mesh.position; } catch (e) { return { x: 0, y: 0, z: 0 }; } }
function hp() { try { return (typeof G('localPlayer').health === 'number') ? G('localPlayer').health : 100; } catch (e) { return 100; } }

// ---------------- СОСТОЯНИЕ ----------------
const DEF = {
  v: 8,
  skills: { speed: 1, power: 1, stealth: 1, charm: 1, hack: 1, stamina: 1 },
  xp: { speed: 0, power: 0, stealth: 0, charm: 0, hack: 0, stamina: 0 },
  vit: { food: 100, water: 100, energy: 100 },
  res: { metal: 0, plastic: 0, chip: 0, cloth: 0, chem: 0, gold: 0 },
  items: { medkit: 0, energy: 0, repair: 0, jammer: 0, lucky: 0, snack: 0 },
  pet: null, petName: '', petFed: 100, petXp: 0,
  home: 0, homeUp: [],
  car: 0, fuel: 100, carDamage: 0,
  wanted: 0, wantedT: 0, fines: 0,
  ach: [], daily: { day: '', streak: 0 },
  quests: [], questDay: '',
  stats: { walk: 0, craft: 0, loot: 0, races: 0, sleeps: 0, pets: 0, meals: 0, buyCar: 0, achCount: 0 },
  seen: false,
};
let S = JSON.parse(JSON.stringify(DEF));
function loadS() {
  try {
    const raw = localStorage.getItem(SKEY);
    if (raw) {
      const o = JSON.parse(raw);
      S = Object.assign(JSON.parse(JSON.stringify(DEF)), o);
      S.skills = Object.assign(JSON.parse(JSON.stringify(DEF.skills)), o.skills || {});
      S.xp = Object.assign(JSON.parse(JSON.stringify(DEF.xp)), o.xp || {});
      S.vit = Object.assign({ food: 100, water: 100, energy: 100 }, o.vit || {});
      S.res = Object.assign(JSON.parse(JSON.stringify(DEF.res)), o.res || {});
      S.items = Object.assign(JSON.parse(JSON.stringify(DEF.items)), o.items || {});
      S.stats = Object.assign(JSON.parse(JSON.stringify(DEF.stats)), o.stats || {});
      S.daily = Object.assign({ day: '', streak: 0 }, o.daily || {});
      if (!Array.isArray(S.ach)) S.ach = [];
      if (!Array.isArray(S.homeUp)) S.homeUp = [];
      if (!Array.isArray(S.quests)) S.quests = [];
    }
  } catch (e) {}
}
let saveT = 0;
function saveS(force) {
  const now = performance.now();
  if (!force && now - saveT < 1200) return;
  saveT = now;
  try { localStorage.setItem(SKEY, JSON.stringify(S)); } catch (e) {}
}

// ---------------- СКИЛЛЫ ----------------
const SKILLS = {
  speed:    { name: 'Скорость',    icon: '🏃', desc: 'Быстрее бег (+4% за ур.)',            max: 20 },
  power:    { name: 'Сила',        icon: '💪', desc: 'Больше урона и здоровья (+5% за ур.)', max: 20 },
  stealth:  { name: 'Скрытность',  icon: '🥷', desc: 'Медленнее растёт розыск',              max: 20 },
  charm:    { name: 'Харизма',     icon: '💬', desc: 'Дешевле покупки (−1.5% за ур.)',      max: 20 },
  hack:     { name: 'Взлом',       icon: '💻', desc: 'Выгоднее хакер-минигейм',              max: 20 },
};
function xpNeed(lv) { return Math.round(60 * Math.pow(1.42, lv - 1)); }
function addXp(k, v) {
  if (k === 'stamina' || (!S.xp[k] && S.xp[k] !== 0)) return;
  S.xp[k] += v;
  let up = 0;
  while (S.skills[k] < SKILLS[k].max && S.xp[k] >= xpNeed(S.skills[k])) {
    S.xp[k] -= xpNeed(S.skills[k]);
    S.skills[k]++;
    up++;
  }
  if (up) {
    notify('⬆️ ' + SKILLS[k].icon + ' ' + SKILLS[k].name + ' → ур. ' + S.skills[k], 'levelup');
    sfx('coin');
    fx('flash', 0.18, [1, 0.9, 0.5]);
    checkAch('skill5');
    if (S.skills[k] >= 10) checkAch('skill10');
    renderDock();
  }
}
function skillBonus(k) { return S.skills[k] || 1; }
function priceMul() { return clamp(1 - (skillBonus('charm') - 1) * 0.015, 0.7, 1); }

// Needs are retired. Keep inert compatibility fields for older content modules
// and saved inventories; no depletion, penalties, warnings or HUD.
const RETIRED_VITALS = {};
for (const key of ['food', 'water', 'energy']) {
  Object.defineProperty(RETIRED_VITALS, key, { enumerable: true, get: () => 100, set: () => {} });
}
function retireNeeds() {
  Object.defineProperty(S, 'vit', { enumerable: true, configurable: true, get: () => RETIRED_VITALS, set: () => {} });
}
function eat(kind) {
  if (kind === 'meal') { S.stats.meals++; notify('🍽️ Приятного аппетита!'); checkAch('meals10'); }
  saveS(true);
}
function rest(mins) {
  S.stats.sleeps++;
  notify('😴 Ты отдохнул.');
  checkAch('sleeper');
}

// ---------------- РЕСУРСЫ И КРАФТ ----------------
const RES = {
  metal:   { name: 'Металл',   icon: '🔩', price: 40 },
  plastic: { name: 'Пластик',  icon: '🧴', price: 25 },
  chip:    { name: 'Чип',      icon: '🔌', price: 90 },
  cloth:   { name: 'Ткань',    icon: '🧵', price: 30 },
  chem:    { name: 'Химия',    icon: '⚗️', price: 55 },
  gold:    { name: 'Золото',   icon: '🥇', price: 220 },
};
const RECIPES = [
  { id: 'medkit', name: 'Аптечка',            icon: '💉', need: { cloth: 3, chem: 2 },            out: 1, desc: 'Лечит 45 HP' },
  { id: 'energy', name: 'Энергетик',          icon: '🥤', need: { chem: 2, plastic: 2 },          out: 1, desc: 'Напиток' },
  { id: 'repair', name: 'Ремкомплект',        icon: '🔧', need: { metal: 4, plastic: 2 },         out: 1, desc: 'Чинит авто' },
  { id: 'jammer', name: 'Глушилка',           icon: '📡', need: { chip: 2, metal: 2 },            out: 1, desc: 'Сбрасывает розыск' },
  { id: 'lucky',  name: 'Талисман удачи',     icon: '🍀', need: { gold: 1, cloth: 2 },            out: 1, desc: '+10% к доходу 5 мин' },
  { id: 'snack',  name: 'Сухпаёк',            icon: '🥪', need: { chem: 1, cloth: 1 },            out: 2, desc: 'Перекус' },
  { id: 'chipset',name: 'Серверный чипсет',   icon: '🖥️', need: { chip: 4, metal: 3, gold: 1 },   out: 1, desc: 'Продать за $1450' },
];
function canCraft(r) { return Object.keys(r.need).every(k => (S.res[k] || 0) >= r.need[k]); }
function craft(id) {
  const r = RECIPES.find(x => x.id === id);
  if (!r) return false;
  if (!canCraft(r)) { notify('❌ Не хватает ресурсов для «' + r.name + '»', 'warn'); return false; }
  Object.keys(r.need).forEach(k => { S.res[k] -= r.need[k]; });
  if (r.id === 'chipset') { addMoney(1450); notify('🖥️ Чипсет собран и продан за $1450'); }
  else { S.items[r.id] = (S.items[r.id] || 0) + r.out; notify('🛠️ Изготовлено: ' + r.icon + ' ' + r.name + ' ×' + r.out); }
  S.stats.craft += r.out;
  addXp('hack', 12);
  checkAch('craft5'); if (S.stats.craft >= 25) checkAch('craft25');
  sfx('click'); saveS(true);
  if ($('fz8Panel') && panelMode === 'craft') openPanel('craft');
  return true;
}
function useItem(id) {
  if (!S.items[id]) { notify('❌ Нет предмета', 'warn'); return; }
  if (S.homeUp.indexOf('garden') >= 0 && id === 'snack') { }
  S.items[id]--;
  if (id === 'medkit') { heal(45); notify('💉 Аптечка: +45 HP'); }
  else if (id === 'energy') { notify('🥤 Напиток выпит.'); }
  else if (id === 'repair') { S.carDamage = 0; notify('🔧 Авто отремонтировано'); }
  else if (id === 'jammer') { S.wanted = 0; S.wantedT = 0; notify('📡 Глушилка: розыск сброшен'); }
  else if (id === 'lucky') { S.luckyT = 300; notify('🍀 Талисман удачи активен 5 минут'); }
  else if (id === 'snack') { eat('snack'); notify('🥪 Перекусил'); }
  sfx('click'); saveS(true);
  if ($('fz8Panel') && panelMode === 'bag') openPanel('bag');
}
function heal(v) {
  try {
    const lp = G('localPlayer');
    if (lp) { lp.health = clamp((lp.health || 100) + v, 0, 100); if (typeof G('updateHealthBar') === 'function') G('updateHealthBar')(); }
  } catch (e) {}
}
// лут-ящики по городу
const lootBoxes = [];
function lootSpot(x, z) {
  return !lootBoxes.some(b => Math.hypot(b.x - x, b.z - z) < 24);
}
function buildLoot() {
  try {
    const T = G('THREE'), sc = G('scene');
    if (!T || !sc) return;
    const spots = [[-30, 40], [42, -26], [-52, -44], [70, 18], [22, 62], [-88, 12], [96, -60], [-16, -74], [58, 74], [-104, -22], [8, 104], [-120, 46]];
    spots.forEach(([x, z], i) => {
      if (!lootSpot(x, z)) return;
      const g = new T.Group();
      const box = new T.Mesh(new T.BoxGeometry(1.1, 0.95, 0.85), new T.MeshLambertMaterial({ color: i % 3 === 0 ? 0xd9a528 : 0x8a6a3a }));
      box.position.y = 0.48; g.add(box);
      const lid = new T.Mesh(new T.BoxGeometry(1.16, 0.12, 0.9), new T.MeshLambertMaterial({ color: 0x5a4526 }));
      lid.position.y = 1.0; g.add(lid);
      const glow = new T.Mesh(new T.SphereGeometry(0.18, 8, 6), new T.MeshBasicMaterial({ color: 0xffe08a }));
      glow.position.y = 1.25; g.add(glow);
      g.position.set(x, 0, z);
      sc.add(g);
      const rec = { x: x, z: z, mesh: g, glow: glow, cd: 0, opened: 0 };
      lootBoxes.push(rec);
      try {
        const inter = { position: { x: x, y: 0, z: z }, type: 'fz8_loot', name: '📦 Открыть ящик с припасами', range: 2.4, fz8: true };
        if (Array.isArray(G('interactables'))) G('interactables').push(inter);
        else if (typeof G('addInteractable') === 'function') G('addInteractable')(inter);
      } catch (e) {}
    });
  } catch (e) {}
}
let lootCount = 0;
function openLoot(rec) {
  try {
    if (rec.cd > 0) { notify('📦 Ящик пуст — пополнится позже', 'warn'); return; }
    rec.cd = 240 + ri(0, 120);
    rec.opened++;
    lootCount++;
    const keys = Object.keys(RES);
    const n = ri(2, 4);
    const got = [];
    for (let i = 0; i < n; i++) {
      const k = pick(keys);
      const v = k === 'gold' ? ri(1, 2) : (k === 'chip' ? ri(1, 3) : ri(2, 6));
      S.res[k] += v; got.push(RES[k].icon + v);
    }
    const cash = ri(60, 240);
    addMoney(cash);
    S.stats.loot++;
    addXp('hack', 18); addXp('stealth', 8);
    notify('📦 Ящик: ' + got.join(' ') + ' и $' + cash);
    fx('burst', rec.x, 1, rec.z, 0xffd76a, 10);
    sfx('coin');
    checkAch('loot5'); if (S.stats.loot >= 20) checkAch('loot20');
    if (Math.random() < 0.12) { addCoins(1); notify('💎 Бонус: +1 кристалл'); }
    saveS(true);
  } catch (e) {}
}
function updateLoot(dt) {
  lootBoxes.forEach(b => {
    if (b.cd > 0) { b.cd -= dt; if (b.cd <= 0) { b.cd = 0; try { b.glow.visible = true; } catch (e) {} } }
    try {
      b.glow.visible = b.cd <= 0;
      if (b.glow.visible) { b.glow.position.y = 1.22 + Math.sin(performance.now() * 0.003 + b.x) * 0.09; }
    } catch (e) {}
  });
}

// ---------------- ДОСТИЖЕНИЯ ----------------
const ACH = [
  { id: 'first', name: 'Первые шаги', icon: '👣', desc: 'Пройти 2 км', reward: 300 },
  { id: 'loot5', name: 'Искатель', icon: '📦', desc: 'Открыть 5 ящиков', reward: 500 },
  { id: 'loot20', name: 'Кладоискатель', icon: '🗝️', desc: 'Открыть 20 ящиков', reward: 1800 },
  { id: 'craft5', name: 'Мастерская', icon: '🛠️', desc: 'Изготовить 5 предметов', reward: 600 },
  { id: 'craft25', name: 'Инженер', icon: '⚙️', desc: 'Изготовить 25 предметов', reward: 2400 },
  { id: 'skill5', name: 'Опытный', icon: '⭐', desc: 'Прокачать любой навык до 5', reward: 900 },
  { id: 'skill10', name: 'Ветеран', icon: '🌟', desc: 'Прокачать любой навык до 10', reward: 3000 },
  { id: 'meals10', name: 'Гурман', icon: '🍽️', desc: 'Съесть 10 блюд', reward: 700 },
  { id: 'sleeper', name: 'Соня', icon: '😴', desc: 'Отдохнуть дома', reward: 400 },
  { id: 'pet', name: 'Друг', icon: '🐾', desc: 'Завести питомца', reward: 800 },
  { id: 'petlv5', name: 'Дрессировщик', icon: '🎾', desc: 'Прокачать питомца до ур.5', reward: 2200 },
  { id: 'home1', name: 'Своя крыша', icon: '🏠', desc: 'Купить жильё', reward: 1200 },
  { id: 'homefull', name: 'Дизайнер', icon: '🛋️', desc: 'Купить 5 улучшений дома', reward: 3200 },
  { id: 'car1', name: 'Колёса', icon: '🚗', desc: 'Купить транспорт', reward: 1200 },
  { id: 'race1', name: 'Стрит-рейсер', icon: '🏁', desc: 'Выиграть гонку', reward: 2000 },
  { id: 'race5', name: 'Чемпион', icon: '🏆', desc: 'Выиграть 5 гонок', reward: 5000 },
  { id: 'race10', name: 'Легенда трека', icon: '🥇', desc: 'Выиграть 10 гонок', reward: 9000 },
  { id: 'wanted3', name: 'Особо опасен', icon: '🚨', desc: 'Дойти до 3 звёзд розыска', reward: 1500 },
  { id: 'clean', name: 'Чист перед законом', icon: '👮', desc: 'Сбросить розыск', reward: 600 },
  { id: 'quest10', name: 'Исполнитель', icon: '📋', desc: 'Выполнить 10 заданий', reward: 2600 },
  { id: 'rich', name: 'Первый миллион', icon: '💰', desc: 'Накопить $1 000 000', reward: 15000 },
  { id: 'daily7', name: 'Верный игрок', icon: '📅', desc: 'Забрать награду 7 дней подряд', reward: 4000 },
  { id: 'drone', name: 'Охотник на дронов', icon: '🛸', desc: 'Сбить дрон полиции', reward: 1400 },
  { id: 'explorer', name: 'Путешественник', icon: '🧭', desc: 'Пройти 25 км', reward: 2400 },
];
function hasAch(id) { return S.ach.indexOf(id) >= 0; }
function checkAch(id) {
  if (hasAch(id)) return;
  const a = ACH.find(x => x.id === id);
  if (!a) return;
  S.ach.push(id);
  S.stats.achCount = S.ach.length;
  addMoney(a.reward);
  try { if (typeof G('showWorldEventBanner') === 'function') G('showWorldEventBanner')('🏅 ДОСТИЖЕНИЕ: ' + a.name + ' · +$' + fmt(a.reward)); } catch (e) {}
  fx('flash', 0.2, [1, 0.86, 0.4]);
  sfx('coin');
  notify('🏅 ' + a.icon + ' ' + a.name + ' (+$' + fmt(a.reward) + ')', 'ach');
  saveS(true);
}

// ---------------- ПИТОМЦЫ ----------------
const PETS = [
  { id: 'cat',  name: 'Кот Барсик',   icon: '🐈', price: 1500,  color: 0xd9a05a, bonus: 'charm',  desc: '+8% к доходу и скидки',     scale: 0.42 },
  { id: 'dog',  name: 'Пёс Рекс',     icon: '🐕', price: 2200,  color: 0x8a5a33, bonus: 'power',  desc: '+10% урона и HP',           scale: 0.5 },
  { id: 'drone',name: 'Дрон-помощник',icon: '🛸', price: 6500,  color: 0x51607a, bonus: 'hack',   desc: '+12% к взлому, ловит лут',  scale: 0.5 },
];
let petMesh = null;
function petLv() { return clamp(1 + Math.floor(S.petXp / 120), 1, 10); }
function petBonus() { const p = PETS.find(x => x.id === S.pet); return p ? 1 + 0.02 * petLv() : 1; }
function buyPet(id) {
  const p = PETS.find(x => x.id === id);
  if (!p || S.pet) return false;
  const price = Math.round(p.price * priceMul());
  if (money() < price) { notify('❌ Нужно $' + fmt(price), 'warn'); return false; }
  addMoney(-price);
  S.pet = id; S.petName = p.name; S.petFed = 100; S.petXp = 0;
  buildPetMesh();
  notify(p.icon + ' ' + p.name + ' теперь с тобой! ' + p.desc);
  checkAch('pet'); sfx('coin'); saveS(true);
  fx('burst', pp().x, 0.6, pp().z, 0xffd76a, 12);
  return true;
}
function buildPetMesh() {
  try {
    const T = G('THREE'), sc = G('scene');
    if (!T || !sc) return;
    if (petMesh) { try { sc.remove(petMesh); } catch (e) {} petMesh = null; }
    const p = PETS.find(x => x.id === S.pet);
    if (!p) return;
    const g = new T.Group();
    const mat = new T.MeshLambertMaterial({ color: p.color });
    const body = new T.Mesh(new T.BoxGeometry(0.62, 0.44, 1.0), mat); body.position.y = 0.36; g.add(body);
    const head = new T.Mesh(new T.BoxGeometry(0.42, 0.4, 0.4), mat); head.position.set(0, 0.62, 0.55); g.add(head);
    const e1 = new T.Mesh(new T.SphereGeometry(0.06, 6, 6), new T.MeshBasicMaterial({ color: 0x111111 })); e1.position.set(0.11, 0.68, 0.74); g.add(e1);
    const e2 = e1.clone(); e2.position.x = -0.11; g.add(e2);
    [[-0.2, 0.35], [0.2, 0.35], [-0.2, -0.35], [0.2, -0.35]].forEach(([x, z]) => {
      const l = new T.Mesh(new T.BoxGeometry(0.14, 0.36, 0.14), mat); l.position.set(x, 0.18, z); g.add(l);
    });
    if (S.pet === 'cat') { const t = new T.Mesh(new T.BoxGeometry(0.1, 0.1, 0.55), mat); t.position.set(0, 0.62, -0.5); g.add(t); }
    if (S.pet === 'dog') { const t = new T.Mesh(new T.BoxGeometry(0.14, 0.14, 0.34), mat); t.position.set(0, 0.66, -0.5); g.add(t); }
    if (S.pet === 'drone') {
      g.children.forEach(c => { c.position.y += 0.75; });
      [[-0.45, 0.45], [0.45, 0.45], [-0.45, -0.45], [0.45, -0.45]].forEach(([x, z]) => {
        const r = new T.Mesh(new T.CylinderGeometry(0.26, 0.26, 0.05, 8), new T.MeshLambertMaterial({ color: 0x2b3446 }));
        r.position.set(x, 1.05, z); g.add(r);
      });
      const lamp = new T.Mesh(new T.SphereGeometry(0.09, 8, 6), new T.MeshBasicMaterial({ color: 0x00ff9d }));
      lamp.position.set(0, 0.9, 0.5); g.add(lamp); g.userData.lamp = lamp;
    }
    const pos = pp();
    g.position.set(pos.x - 1.2, 0, pos.z - 1.2);
    g.scale.setScalar(p.scale * 1.5);
    sc.add(g); petMesh = g;
    try { if (G('FZFX') && G('FZFX').trackBlob) G('FZFX').trackBlob(g); } catch (e) {}
  } catch (e) {}
}
function updatePet(dt) {
  if (!S.pet || !petMesh) return;
  const p = pp();
  const t = performance.now() * 0.001;
  const tx = p.x - 1.4 + Math.sin(t * 0.7) * 0.3;
  const tz = p.z - 1.4 + Math.cos(t * 0.6) * 0.3;
  try {
    petMesh.position.x += (tx - petMesh.position.x) * Math.min(1, dt * 2.6);
    petMesh.position.z += (tz - petMesh.position.z) * Math.min(1, dt * 2.6);
    const moving = Math.hypot(tx - petMesh.position.x, tz - petMesh.position.z) > 0.4;
    if (moving) petMesh.position.y = Math.abs(Math.sin(t * 7)) * 0.14 * (S.pet === 'drone' ? 0 : 1);
    if (S.pet === 'drone') petMesh.position.y = 0.55 + Math.sin(t * 1.6) * 0.12;
    petMesh.rotation.y = Math.atan2(tx - petMesh.position.x, tz - petMesh.position.z);
    if (petMesh.userData.lamp) petMesh.userData.lamp.visible = ((window.FZDN && window.FZDN.nightF) || 0) > 0.3;
  } catch (e) {}
  S.petFed = clamp(S.petFed - dt * 0.24, 0, 100);
  const gain = dt * (S.petFed > 45 ? 1.6 : 0.4) * petBonus();
  S.petXp += gain;
  if (petLv() >= 5) checkAch('petlv5');
  petFindT += dt;
  if (petFindT > 25) {
    petFindT = 0;
    if (S.pet === 'drone' && Math.random() < 0.4) {
      const k = pick(Object.keys(RES));
      S.res[k] += 1;
      notify('🛸 Дрон-помощник нашёл: ' + RES[k].icon + ' ×1');
    } else if (S.pet === 'cat' && Math.random() < 0.25) {
      const c = ri(40, 160); addMoney(c);
      notify('🐈 Кот принёс $' + c);
    } else if (S.pet === 'dog' && Math.random() < 0.25) {
      addXp('power', 22); notify('🐕 Пёс натаскал тебе силы (+22 XP)');
    }
  }
}
let petFindT = 0;
function feedPet() {
  if (!S.pet) return;
  if (S.items.snack > 0) { S.items.snack--; S.petFed = 100; notify('🐾 Питомец накормлен'); }
  else if (money() >= 60) { addMoney(-60); S.petFed = 100; notify('🐾 Корм куплен за $60, питомец доволен'); }
  else notify('❌ Нет корма и денег (нужно $60)', 'warn');
  saveS(true);
  if (panelMode === 'pet') openPanel('pet');
}

// ---------------- ЖИЛЬЁ ----------------
const HOMES = [
  { id: 0, name: 'Студия в центре',   price: 12000,  rent: 90,  beds: 1, desc: 'Простое жильё, +$90/мин аренда подселенца' },
  { id: 1, name: 'Квартира с видом',  price: 45000,  rent: 260, beds: 2, desc: 'Просторно, +$260/мин, свой бар' },
  { id: 2, name: 'Пентхаус',          price: 130000, rent: 640, beds: 3, desc: 'Шикарно, +$640/мин, джакузи и терраса' },
];
const HOME_UPS = [
  { id: 'bed',    name: 'Хорошая кровать', icon: '🛏️', price: 1500,  desc: 'Для отдыха дома' },
  { id: 'garden', name: 'Домашний сад',    icon: '🌱', price: 2600,  desc: '+2 еды каждый час' },
  { id: 'gym',    name: 'Домашний спортзал',icon: '🏋️', price: 4800, desc: '+30% XP к силе и скорости' },
  { id: 'bunker', name: 'Бункер-хранилище',icon: '🔒', price: 9000,  desc: 'Розыск падает в 2 раза быстрее' },
  { id: 'study',  name: 'Кабинет-лаборатория', icon: '🔬', price: 11000, desc: 'Крафт даёт больше предметов' },
  { id: 'garage', name: 'Гараж',           icon: '🏚️', price: 15000, desc: 'Топливо не тратится в городе' },
  { id: 'solar',  name: 'Солнечные панели',icon: '☀️', price: 20000, desc: 'Пассивный доход $120/мин' },
  { id: 'lab',    name: 'Серверная',       icon: '🗄️', price: 26000, desc: '+2 к максимуму дронов и доход от майнинга' },
];
function buyHome(id) {
  const h = HOMES[id];
  if (!h) return;
  const price = Math.round(h.price * priceMul());
  if (money() < price) { notify('❌ Нужно $' + fmt(price) + ' — не хватает', 'warn'); return; }
  addMoney(-price);
  S.home = id + 1;
  notify('🏠 Куплено жильё: ' + h.name + '! Возврат $' + h.rent + '/мин запущен');
  checkAch('home1'); sfx('coin'); saveS(true);
  if (panelMode === 'home') openPanel('home');
}
function buyHomeUp(id) {
  if (!S.home) { notify('❌ Сначала купи жильё', 'warn'); return; }
  if (S.homeUp.indexOf(id) >= 0) return;
  const u = HOME_UPS.find(x => x.id === id);
  if (!u) return;
  const price = Math.round(u.price * priceMul());
  if (money() < price) { notify('❌ Нужно $' + fmt(price), 'warn'); return; }
  addMoney(-price);
  S.homeUp.push(id);
  notify(u.icon + ' Установлено: ' + u.name + ' — ' + u.desc);
  sfx('click');
  if (S.homeUp.length >= 5) checkAch('homefull');
  saveS(true);
  if (panelMode === 'home') openPanel('home');
}
function sleepHome() {
  if (!S.home) { notify('❌ Нужно своё жильё, чтобы отдохнуть', 'warn'); return; }
  const bonus = S.homeUp.indexOf('bed') >= 0 ? 1.4 : 1;
  rest(8 * bonus * S.home);
  try { if (typeof G('setDNTime') === 'function') G('setDNTime')(6.5); } catch (e) {}
  fx('letterbox', true); setTimeout(() => fx('letterbox', false), 1200);
  fx('flash', 0.5, [0, 0, 0], 900);
}

// ---------------- ТРАНСПОРТ ----------------
const VEH = [
  { id: 0, name: 'Скутер FZ-50',   icon: '🛵', price: 9000,   speed: 1.35, fuel: 0.9,  color: 0xff6b6b },
  { id: 1, name: 'Седан FZ-Turbo', icon: '🚗', price: 34000,  speed: 1.85, fuel: 1.3,  color: 0x3aa0ff },
  { id: 2, name: 'Суперкар MEGA',  icon: '🏎️', price: 120000, speed: 2.55, fuel: 1.8,  color: 0xffd76a },
];
let carMesh = null, driving = false;
function curVeh() { return S.car ? VEH[S.car - 1] : null; }
function buyCar(id) {
  const v = VEH[id];
  if (!v) return;
  const price = Math.round(v.price * priceMul());
  if (money() < price) { notify('❌ Нужно $' + fmt(price), 'warn'); return; }
  if (S.car && S.car !== id + 1) notify('ℹ️ Старый транспорт продан в зачёт (50%) — ' + fmt(Math.round((curVeh() ? curVeh().price : 0) * 0.5)) + '$');
  if (S.car) addMoney(Math.round(curVeh().price * 0.5));
  addMoney(-price);
  S.car = id + 1; S.fuel = 100; S.carDamage = 0; S.stats.buyCar = (S.stats.buyCar || 0) + 1;
  notify(v.icon + ' Куплено: ' + v.name + ' (скорость ×' + v.speed + ')');
  checkAch('car1'); sfx('coin'); saveS(true);
  buildCarMesh();
  if (panelMode === 'car') openPanel('car');
  if (S.stats.buyCar >= 1) { S.buyAll = (S.buyAll || 0); }
}
function buildCarMesh() {
  try {
    const T = G('THREE'), sc = G('scene');
    if (!T || !sc || !S.car) return;
    if (carMesh) { try { sc.remove(carMesh); } catch (e) {} carMesh = null; }
    const v = curVeh();
    const g = new T.Group();
    const body = new T.Mesh(new T.BoxGeometry(1.9, 0.62, 4.1), new T.MeshLambertMaterial({ color: v.color }));
    body.position.y = 0.66; g.add(body);
    const cab = new T.Mesh(new T.BoxGeometry(1.7, 0.55, 1.9), new T.MeshLambertMaterial({ color: 0x101828 }));
    cab.position.set(0, 1.16, -0.2); g.add(cab);
    const wheelG = new T.CylinderGeometry(0.36, 0.36, 0.28, 12);
    const wheelM = new T.MeshLambertMaterial({ color: 0x14161a });
    [[-1, 1.35], [1, 1.35], [-1, -1.35], [1, -1.35]].forEach(([sx, wz]) => {
      const w = new T.Mesh(wheelG, wheelM); w.rotation.z = Math.PI / 2; w.position.set(sx * 0.92, 0.36, wz); g.add(w);
    });
    [[-0.6], [0.6]].forEach(([ox]) => {
      const h = new T.Mesh(new T.SphereGeometry(0.16, 8, 6), new T.MeshBasicMaterial({ color: 0xfff2c4 }));
      h.position.set(ox, 0.68, 2.06); g.add(h);
    });
    const tail = new T.Mesh(new T.BoxGeometry(1.5, 0.14, 0.1), new T.MeshBasicMaterial({ color: 0xff3b30 }));
    tail.position.set(0, 0.7, -2.07); g.add(tail);
    g.visible = false; sc.add(g); carMesh = g;
    try { if (G('FZFX') && G('FZFX').trackBlob) G('FZFX').trackBlob(g); } catch (e) {}
  } catch (e) {}
}
function toggleDrive() {
  if (!S.car) { notify('❌ Сначала купи транспорт', 'warn'); return; }
  driving = !driving;
  if (carMesh) carMesh.visible = driving;
  notify(driving ? (curVeh().icon + ' Ты за рулём. Скорость выше, но тратится топливо') : '🚶 Пешком');
  try { if (typeof G('showNotification') === 'function') G('showNotification')(driving ? 'За рулём' : 'Пешком'); } catch (e) {}
}
function FZ8_speedMul() {
  let m = 1;
  const v = curVeh();
  if (driving && v && S.fuel > 0 && S.carDamage < 100) m *= v.speed * (1 - S.carDamage / 420);
  m *= 1 + (skillBonus('speed') - 1) * 0.04;
  if (S.homeUp.indexOf('gym') >= 0) m *= 1.05;
  if (S.pet === 'dog') m *= 1.03;
  return clamp(m, 0.5, 4);
}
function updateVehicle(dt) {
  if (!S.car || !carMesh) return;
  if (!driving) { carMesh.visible = false; }
  if (driving) {
    const p = pp();
    carMesh.position.set(p.x, 0, p.z);
    const camF = G('camera'), Tm = G('THREE');
    if (camF && Tm && Tm.Vector3) {
      try {
        const dir = new Tm.Vector3(); camF.getWorldDirection(dir);
        carMesh.rotation.y = Math.atan2(dir.x, dir.z); carMesh.rotation.x = 0;
      } catch (e) {}
    }
    const v = curVeh();
    const useFuel = S.homeUp.indexOf('garage') >= 0 ? 0.25 : 1;
    S.fuel = clamp(S.fuel - dt * 0.35 * v.fuel * useFuel, 0, 100);
    if (S.fuel <= 0) { notify('⛽ Бензин кончился — заправься в панели авто', 'warn'); driving = false; carMesh.visible = false; }
    if (Math.random() < dt * 0.02) { S.carDamage = clamp(S.carDamage + 1, 0, 100); if (S.carDamage % 10 === 0) notify('🔧 Авто повреждено на ' + Math.round(S.carDamage) + '%'); }
  }
}
function refuel(amount) {
  amount = Number(amount);
  if (!isFinite(amount) || amount <= 0) amount = 25;
  if (amount > 100) amount = 100;
  const cost = Math.round(amount * 9 * priceMul());
  if (money() < cost) { notify('❌ Нужно $' + fmt(cost), 'warn'); return; }
  addMoney(-cost); S.fuel = clamp(S.fuel + amount, 0, 100);
  notify('⛽ Заправлено на ' + amount + '% за $' + fmt(cost));
  saveS(true);
  if (panelMode === 'car') openPanel('car');
}
function fixCar() {
  if (S.carDamage <= 0) { notify('ℹ️ Авто в порядке'); return; }
  if (S.items.repair > 0) { S.items.repair--; S.carDamage = 0; notify('🔧 Ремкомплект использован'); }
  else {
    const cost = Math.round(S.carDamage * 60 * priceMul());
    if (money() < cost) { notify('❌ Ремонт стоит $' + fmt(cost), 'warn'); return; }
    addMoney(-cost); S.carDamage = 0; notify('🔧 Авто отремонтировано за $' + fmt(cost));
  }
  saveS(true);
  if (panelMode === 'car') openPanel('car');
}

// ---------------- ГОНКИ ----------------
const RACE_CIRCUIT = [[-80, -80], [0, -110], [90, -90], [112, -10], [80, 80], [0, 112], [-90, 80], [-112, 0]];
let race = null, raceCd = 0;
function startRace() {
  if (!S.car) { notify('❌ Для гонки нужен свой транспорт', 'warn'); return; }
  if (race) { notify('🏁 Гонка уже идёт!', 'warn'); return; }
  if (raceCd > 0) { notify('⏳ Старт будет доступен через ' + Math.ceil(raceCd) + ' с', 'warn'); return; }
  race = { i: 0, t: 0, best: S.raceBest || 0 };
  buildRaceMarkers();
  notify('🏁 ГОНКА НАЧАЛАСЬ! Мчись по 8 кольцам. Лучшее время: ' + (S.raceBest ? S.raceBest.toFixed(1) + 'с' : '—'));
  try { if (typeof G('showWorldEventBanner') === 'function') G('showWorldEventBanner')('🏁 ГОНКА: 8 чекпоинтов'); } catch (e) {}
  fx('letterbox', true);
}
const raceMarkers = [];
function buildRaceMarkers() {
  try {
    const T = G('THREE'), sc = G('scene');
    if (!T || !sc) return;
    clearRaceMarkers();
    RACE_CIRCUIT.forEach(([x, z], i) => {
      const m = new T.Mesh(new T.TorusGeometry(3.6, 0.22, 8, 24), new T.MeshBasicMaterial({ color: i === 0 ? 0x7cffb2 : 0xffd76a }));
      m.position.set(x, 3.2, z); m.rotation.x = Math.PI / 2;
      sc.add(m); raceMarkers.push(m);
    });
  } catch (e) {}
}
function clearRaceMarkers() {
  const sc = G('scene');
  raceMarkers.forEach(m => { try { sc.remove(m); } catch (e) {} });
  raceMarkers.length = 0;
}
function updateRace(dt) {
  if (!race) { if (raceCd > 0) raceCd -= dt; return; }
  race.t += dt;
  if (race.t > 200) { endRace(false); return; }
  const p = pp();
  const [cx, cz] = RACE_CIRCUIT[race.i];
  raceMarkers.forEach((m, i) => { try { m.visible = i >= race.i; m.rotation.z += dt * 1.4; } catch (e) {} });
  if (Math.hypot(p.x - cx, p.z - cz) < 4.6) {
    race.i++;
    sfx('click');
    fx('flash', 0.14, [0.4, 1, 0.6]);
    addXp('speed', 18);
    if (race.i >= RACE_CIRCUIT.length) endRace(true);
    else notify('🏁 Чекпоинт ' + race.i + '/' + RACE_CIRCUIT.length);
  }
}
function endRace(win) {
  const t = race ? race.t : 0;
  race = null; raceCd = 25;
  clearRaceMarkers();
  fx('letterbox', false);
  if (!win) { notify('💨 Гонка провалена — время вышло', 'warn'); return; }
  const bonus = clamp(Math.round((170 - t) * 18), 300, 4200);
  const prize = 1200 + bonus;
  addMoney(prize);
  S.stats.races++;
  if (!S.raceBest || t < S.raceBest) S.raceBest = t;
  notify('🏆 ФИНИШ! Время ' + t.toFixed(1) + 'с · приз $' + fmt(prize));
  try { if (typeof G('showWorldEventBanner') === 'function') G('showWorldEventBanner')('🏆 ПОБЕДА В ГОНКЕ! $' + fmt(prize)); } catch (e) {}
  checkAch('race1');
  if (S.stats.races >= 5) checkAch('race5');
  if (S.stats.races >= 10) checkAch('race10');
  addXp('speed', 90); addXp('stamina', 40);
  fx('burst', pp().x, 1.4, pp().z, 0xffd76a, 22);
  saveS(true);
}

// ---------------- РОЗЫСК И ПОЛИЦИЯ ----------------
const WANTED_ACTS = [
  { id: 'atm',    name: 'Взломать банкомат',   icon: '🏧', stars: 1, money: [280, 760],   xp: 'hack',  cd: 90 },
  { id: 'shop',   name: 'Ограбить лавку',      icon: '🏪', stars: 2, money: [500, 1500],  xp: 'power', cd: 140 },
  { id: 'fight',  name: 'Уличная драка',       icon: '🥊', stars: 1, money: [60, 220],    xp: 'power', cd: 45 },
  { id: 'car',    name: 'Угнать машину',       icon: '🔓', stars: 3, money: [1400, 3800], xp: 'stealth', cd: 240 },
];
const actCd = {};
let police = null;
function doCrime(id) {
  const a = WANTED_ACTS.find(x => x.id === id);
  if (!a) return;
  if ((actCd[id] || 0) > 0) { notify('⏳ Ещё рано: ' + Math.ceil(actCd[id]) + ' с', 'warn'); return; }
  const stealthReduce = clamp(1 - (skillBonus('stealth') - 1) * 0.05, 0.35, 1);
  const chance = a.id === 'car' ? 0.45 : a.id === 'shop' ? 0.6 : 0.8;
  if (Math.random() > chance * (1 + (skillBonus('stealth') - 1) * 0.03)) {
    actCd[id] = a.cd;
    notify('😬 Не вышло — тебя заметили, но обошлось', 'warn');
    S.wanted = clamp(S.wanted + 0.5 * stealthReduce, 0, 5);
    return;
  }
  const cash = ri(a.money[0], a.money[1]);
  addMoney(cash);
  addXp(a.xp, a.id === 'fight' ? 34 : 26);
  actCd[id] = a.cd;
  S.wanted = clamp(S.wanted + a.stars * stealthReduce, 0, 5);
  S.wantedT = 45;
  notify(a.icon + ' Удачно! +$' + fmt(cash) + ' · розыск ' + S.wanted.toFixed(1) + '★');
  if (S.wanted >= 3) checkAch('wanted3');
  sfx('coin');
  spawnPolice();
  saveS(true);
  if (panelMode === 'crime') openPanel('crime');
}
function spawnPolice() {
  if (S.wanted < 1) return;
  if (police) return;
  try {
    const T = G('THREE'), sc = G('scene');
    if (!T || !sc) return;
    const g = new T.Group();
    const body = new T.Mesh(new T.BoxGeometry(0.9, 0.34, 0.9), new T.MeshLambertMaterial({ color: 0x22304a })); g.add(body);
    const rot = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 0.08, 10), new T.MeshLambertMaterial({ color: 0x2f3f5f }));
    rot.position.y = 0.22; g.add(rot);
    const lamp = new T.Mesh(new T.SphereGeometry(0.12, 8, 6), new T.MeshBasicMaterial({ color: 0xff3b30 }));
    lamp.position.set(0, -0.2, 0); g.add(lamp);
    const p = pp();
    g.position.set(p.x + 26, 9, p.z + 26);
    sc.add(g);
    police = { mesh: g, lamp: lamp, t: 0 };
  } catch (e) {}
}
function updateWanted(dt) {
  Object.keys(actCd).forEach(k => { if (actCd[k] > 0) actCd[k] -= dt; });
  if (S.wanted > 0) {
    S.wantedT -= dt;
    const decay = 0.012 * (S.homeUp.indexOf('bunker') >= 0 ? 2 : 1) * (1 + (skillBonus('stealth') - 1) * 0.05);
    if (S.wantedT <= 0) {
      S.wanted = clamp(S.wanted - decay, 0, 5);
      if (S.wanted < 0.05) { S.wanted = 0; notify('✅ Ты больше не в розыске'); checkAch('clean'); policeClean(); saveS(true); }
    }
  }
  if (S.wanted >= 1) { if (!police) spawnPolice(); }
  else if (police) policeClean();
  if (police) {
    police.t += dt;
    const p = pp();
    try {
      const m = police.mesh;
      const dx = p.x - m.position.x, dz = p.z - m.position.z;
      const d = Math.hypot(dx, dz);
      const spd = 7 + S.wanted * 1.6;
      if (d > 1.6) { m.position.x += (dx / d) * Math.min(spd * dt, d); m.position.z += (dz / d) * Math.min(spd * dt, d); }
      m.position.y = 8 + Math.sin(police.t * 2) * 0.6;
      m.rotation.y = Math.atan2(dx, dz);
      if (police.lamp) police.lamp.visible = Math.sin(police.t * 10) > 0;
      if (d < 2.6 && S.wanted > 0) { caught(); }
    } catch (e) {}
    if (Math.random() < dt * 0.05) { try { if (typeof G('playBeacon') === 'function') G('playBeacon')(); } catch (e) {} }
  }
  // дрон-сбитие: если игрок в транспорте и рядом с дроном — можно сбить
  if (police && S.wanted > 0 && driving) {
    const p = pp();
    try { if (Math.hypot(police.mesh.position.x - p.x, police.mesh.position.z - p.z) < 5 && Math.random() < dt * 0.3) { shootDrone(); } } catch (e) {}
  }
}
function shootDrone() {
  if (!police) return;
  try { G('scene').remove(police.mesh); } catch (e) {}
  police = null;
  S.wanted = clamp(S.wanted - 1, 0, 5);
  S.wantedT = 8;
  notify('🛸 Дрон сбит! Розыск −1★');
  checkAch('drone');
  fx('burst', pp().x, 6, pp().z, 0xff8844, 18);
  saveS(true);
}
function caught() {
  if (S.wanted <= 0) return;
  const fine = Math.round(S.wanted * 900 + ri(0, 300));
  addMoney(-fine);
  S.wanted = 0; S.wantedT = 0; S.fines = (S.fines || 0) + fine;
  notify('🚨 Полиция поймала! Штраф $' + fmt(fine), 'warn');
  fx('flash', 0.4, [1, 0.2, 0.2]);
  fx('shake', 22);
  try { if (typeof G('showWorldEventBanner') === 'function') G('showWorldEventBanner')('🚨 ШТРАФ $' + fmt(fine)); } catch (e) {}
  policeClean();
  saveS(true);
}
function policeClean() { if (police) { try { G('scene').remove(police.mesh); } catch (e) {} police = null; } }

// ---------------- ЕЖЕДНЕВНЫЕ НАГРАДЫ ----------------
const DAILY = [
  { d: 1, r: '$1200',       fn: () => addMoney(1200) },
  { d: 2, r: 'Аптечка ×2',  fn: () => { S.items.medkit += 2; } },
  { d: 3, r: '300 XP',      fn: () => { addXp('power', 150); addXp('speed', 150); } },
  { d: 4, r: 'Ресурсы ×12', fn: () => { ['metal', 'plastic', 'chip'].forEach(k => S.res[k] += 4); } },
  { d: 5, r: '$9000',       fn: () => addMoney(9000) },
  { d: 6, r: '💎 5 кристаллов', fn: () => addCoins(5) },
  { d: 7, r: '💎 15 + $30000', fn: () => { addCoins(15); addMoney(30000); } },
];
function todayKey() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function dailyReady() { return S.daily.day !== todayKey(); }
function claimDaily() {
  if (!dailyReady()) { notify('⏳ Награда уже получена сегодня — приходи завтра', 'warn'); return; }
  const y = new Date(Date.now() - 86400000);
  const yKey = y.getFullYear() + '-' + (y.getMonth() + 1) + '-' + y.getDate();
  S.daily.streak = (S.daily.day === yKey) ? (S.daily.streak + 1) : 1;
  if (S.daily.streak > 7) S.daily.streak = 1;
  S.daily.day = todayKey();
  const d = DAILY[S.daily.streak - 1];
  d.fn();
  notify('📅 День ' + S.daily.streak + '/7: ' + d.r);
  try { if (typeof G('showWorldEventBanner') === 'function') G('showWorldEventBanner')('📅 ЕЖЕДНЕВНАЯ НАГРАДА · ' + d.r); } catch (e) {}
  if (S.daily.streak >= 7) checkAch('daily7');
  fx('burst', pp().x, 1.2, pp().z, 0xffd76a, 16);
  sfx('coin');
  saveS(true);
  if (panelMode === 'daily') openPanel('daily');
}

// ---------------- ГЕНЕРАТОР ЗАДАНИЙ ----------------
const QGEN = [
  { t: 'loot',  name: 'Открыть ящиков',        icon: '📦', from: 2, to: 5,  money: [900, 2200],   xpK: 'stealth' },
  { t: 'craft', name: 'Изготовить предметов',  icon: '🛠️', from: 1, to: 4,  money: [1200, 2600],  xpK: 'hack' },
  { t: 'race',  name: 'Победить в гонке',      icon: '🏁', from: 1, to: 2,  money: [2600, 5200],  xpK: 'speed' },
  { t: 'meals', name: 'Съесть блюд',           icon: '🍽️', from: 1, to: 3,  money: [700, 1600],   xpK: 'charm' },
  { t: 'crime', name: 'Совершить тёмных дел',  icon: '🕶️', from: 1, to: 3,  money: [1800, 4200],  xpK: 'stealth' },
  { t: 'walk',  name: 'Пройти км пешком',      icon: '🚶', from: 1, to: 3,  money: [800, 1900],   xpK: 'stamina' },
  { t: 'pet',   name: 'Покормить питомца',     icon: '🐾', from: 1, to: 2,  money: [600, 1400],   xpK: 'charm' },
];
function genQuests() {
  if (S.questDay === todayKey() && S.quests.length) return;
  S.questDay = todayKey();
  const pool = QGEN.slice();
  const out = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const q = pool.splice(ri(0, pool.length - 1), 1)[0];
    const need = ri(q.from, q.to);
    out.push({ t: q.t, need: need, prog: 0, name: q.name, icon: q.icon, money: ri(q.money[0], q.money[1]), xpK: q.xpK, done: false });
  }
  S.quests = out;
  saveS(true);
  notify('📋 Новые ежедневные задания — ' + out.length + ' шт. (смотри в доке 🎮)');
}
function qProg(t, v) {
  let changed = false;
  S.quests.forEach(q => {
    if (q.t !== t || q.done) return;
    q.prog = Math.min(q.need, q.prog + v);
    if (q.prog >= q.need) {
      q.done = true;
      addMoney(q.money);
      addXp(q.xpK, 120);
      S.questDone = (S.questDone || 0) + 1;
      notify('✅ Задание выполнено: ' + q.icon + ' ' + q.name + ' +$' + fmt(q.money));
      if (S.questDone >= 10) checkAch('quest10');
      changed = true;
    }
  });
  if (changed) saveS(true);
}
function qAccept() {
  /* задания активны сразу */
}
let lastQStats = null;
function updateQuests() {
  if (!lastQStats) { lastQStats = Object.assign({}, S.stats); return; }
  const st = S.stats;
  if (st.loot > lastQStats.loot) qProg('loot', st.loot - lastQStats.loot);
  if (st.craft > lastQStats.craft) qProg('craft', st.craft - lastQStats.craft);
  if (st.races > lastQStats.races) qProg('race', st.races - lastQStats.races);
  if (st.meals > lastQStats.meals) qProg('meals', st.meals - lastQStats.meals);
  if ((S.fines || 0) > (lastQStats.fines || 0)) qProg('crime', 1);
  const km = (st.walk - lastQStats.walk) / 1000;
  if (km > 0) qProg('walk', Math.round(km * 10) / 10);
  if (S.petFed > 90 && lastPetFed <= 90) qProg('pet', 1);
  lastPetFed = S.petFed;
  lastQStats = Object.assign({}, st);
}
let lastPetFed = 100;

// ---------------- ОБНОВЛЕНИЕ МИРА ----------------
let walkAcc = 0, lastPos = null, tickT = 0, luckyBonus = 0;
function updateLife(dt) {
  if ((S.luckyT || 0) > 0) S.luckyT -= dt;
  // дистанция
  const p = pp();
  if (lastPos && dt > 0.001) {
    const d = Math.hypot(p.x - lastPos.x, p.z - lastPos.z);
    if (d < 12) { S.stats.walk += d; }
    const spd = d / dt;
    window.FZ8RUSH = spd;
    S.spd = spd;
  }
  lastPos = { x: p.x, z: p.z };
  if (S.stats.walk > 2000 && !hasAch('first')) checkAch('first');
  if (S.stats.walk > 25000 && !hasAch('explorer')) checkAch('explorer');
  if (money() >= 1000000 && !hasAch('rich')) checkAch('rich');
  updatePet(dt);
  updateVehicle(dt);
  updateLoot(dt);
  updateRace(dt);
  updateWanted(dt);
  tickT += dt;
  if (tickT > 6) { tickT = 0; updateQuests(); }
  // пассивный доход жилья и улучшений
  S.homeTick = (S.homeTick || 0) + dt;
  if (S.homeTick > 12) {
    S.homeTick = 0;
    let inc = 0;
    if (S.home) inc += HOMES[S.home - 1].rent / 5;
    if (S.homeUp.indexOf('solar') >= 0) inc += 120 / 5;
    if (inc > 0) addMoney(inc * (S.homeUp.indexOf('garden') >= 0 ? 1.05 : 1));
  }
  saveS(false);
}
function initLife() {
  loadS();
  retireNeeds();
  S.seen = true;
  try { if (S.pet) buildPetMesh(); } catch (e) {}
  try { if (S.car) buildCarMesh(); } catch (e) {}
  setTimeout(() => { try { buildLoot(); genQuests(); } catch (e) {} }, 2600);
  buildDock();
  saveS(true);
}

// ---------------- ЭКСПОРТ ----------------
window.FZ8L = {
  get S() { return S; }, save: saveS, skills: SKILLS, craft: craft, useItem: useItem, recipes: RECIPES,
  buyPet: buyPet, feedPet: feedPet, buyHome: buyHome, buyHomeUp: buyHomeUp, sleepHome: sleepHome,
  buyCar: buyCar, toggleDrive: toggleDrive, refuel: refuel, fixCar: fixCar, drive: () => driving,
  startRace: startRace, raceInfo: () => race, doCrime: doCrime, daily: claimDaily, dailyReady: dailyReady,
  panel: openPanel, eat: eat, rest: rest, ach: () => S.ach, xp: addXp, q: () => S.quests, quests: genQuests,
  vitals: () => S.vit, res: () => S.res, items: () => S.items,
  buildLoot: buildLoot, lootBoxes: lootBoxes, drive: () => driving, race: () => race,
  debug: { give: (k, v) => { S.res[k] = (S.res[k] || 0) + v; notify('dev: ' + k + ' +' + v); }, money: (v) => addMoney(v), wipe: () => { S = JSON.parse(JSON.stringify(DEF)); retireNeeds(); saveS(true); notify('dev: сброс v8'); } },
};
// ---------------- ИНТЕРАКТ ----------------
window.FZ8_onInteract = function (inter) {
  if (!inter || !inter.type) return false;
  if (inter.type === 'fz8_loot') {
    const rec = lootBoxes.find(b => Math.hypot(b.x - inter.position.x, b.z - inter.position.z) < 1.5);
    if (rec) openLoot(rec);
    return true;
  }
  return false;
};
window.FZ8_orderQuest = qAccept;
window.FZ8_speedMul = FZ8_speedMul;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(initLife, 900));
else setTimeout(initLife, 900);

// ---------------- ИНТЕРФЕЙС ----------------
let panelMode = '';
function injectCss() {
  if ($('fz8LifeCss')) return;
  const st = document.createElement('style'); st.id = 'fz8LifeCss';
  st.textContent =
    '#fz8Dock{position:fixed;left:10px;top:50%;transform:translateY(-50%);z-index:6120;display:flex;flex-direction:column;flex-wrap:wrap-reverse;align-content:flex-start;gap:6px;max-height:min(74vh,600px);overflow:visible;}'
    + '#fz8Dock button{width:44px;height:44px;border-radius:13px;border:1.4px solid #6c5ce788;background:linear-gradient(150deg,#1a1636ee,#0d0a1cdd);color:#fff;font-size:20px;cursor:pointer;backdrop-filter:blur(6px);position:relative;transition:transform .12s,border-color .12s;flex:0 0 auto;}'
    + '#fz8Dock button:hover{transform:scale(1.09);border-color:#a29bfe;}'
    + '#fz8Dock button.on{border-color:#7cffb2;box-shadow:0 0 14px #7cffb255;}'
    + '#fz8Dock .badge{position:absolute;top:-5px;right:-5px;background:#e84393;color:#fff;border-radius:9px;font:bold 10px Arial;padding:1px 5px;}'
    + '#fz8Dock .lbl{display:none;}'
    + '@media (max-width:820px){#fz8Dock{left:4px;max-height:56vh;transform:translateY(-50%) scale(.8);transform-origin:left center;}}'
    + '.fz8Modal{position:fixed;inset:0;z-index:8200;background:rgba(4,2,12,.76);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;}'
    + '.fz8Card{width:min(680px,96vw);max-height:90vh;overflow:auto;background:linear-gradient(165deg,#151232,#090818);border:1.5px solid #6c5ce766;border-radius:18px;padding:16px;color:#fff;font:14px Arial;}'
    + '.fz8Card h3{margin:0 0 10px;font-size:17px;color:#fff;}'
    + '.fz8Tabs{display:flex;flex-wrap:wrap;gap:5px;margin:10px 0;}'
    + '.fz8Tabs button{flex:0 0 auto;padding:7px 10px;border-radius:11px;border:1.3px solid #ffffff22;background:#ffffff10;color:#fff;cursor:pointer;font:bold 12px Arial;}'
    + '.fz8Tabs button.on{border-color:#7cffb2;background:linear-gradient(135deg,#00b894,#00997a);}'
    + '.fz8Row{display:flex;justify-content:space-between;align-items:center;gap:9px;background:#ffffff08;border:1px solid #ffffff14;border-radius:12px;padding:9px 12px;margin-bottom:7px;}'
    + '.fz8Row .nm{font:13px Arial;color:#fff;}'
    + '.fz8Row .sb{font:11px Arial;color:#a29bfe;margin-top:2px;}'
    + '.fz8Row .vl{font:bold 13px Arial;color:#ffd76a;}'
    + '.fz8B{background:#6c5ce7;color:#fff;border:none;border-radius:10px;padding:8px 12px;cursor:pointer;font:bold 12px Arial;}'
    + '.fz8B.g{background:linear-gradient(135deg,#00b894,#00997a);} .fz8B.r{background:linear-gradient(135deg,#e84393,#b3366f);} .fz8B.y{background:linear-gradient(135deg,#e1a300,#b57e00);color:#1a1400;} .fz8B:disabled{opacity:.45;cursor:not-allowed;}'
    + '.fz8Bar{height:9px;border-radius:6px;background:#ffffff18;overflow:hidden;margin-top:5px;}'
    + '.fz8Bar i{display:block;height:100%;background:linear-gradient(90deg,#00b894,#7cffb2);}'
    + '.fz8Bar.f i{background:linear-gradient(90deg,#e17055,#ffb347);} .fz8Bar.w i{background:linear-gradient(90deg,#0984e3,#74b9ff);} .fz8Bar.e i{background:linear-gradient(90deg,#e1a300,#ffe066);}'
    + '.fz8Grid{display:flex;flex-wrap:wrap;gap:8px;}'
    + '.fz8Chip{background:#ffffff0d;border:1px solid #ffffff1c;border-radius:12px;padding:8px 11px;font:12px Arial;color:#fff;}'
    + '.fz8Hint{color:#7f8fa6;font:11px Arial;margin-top:10px;line-height:1.5;}'
    + '#fz8Hud{position:fixed;left:118px;top:50%;transform:translateY(-50%);z-index:6115;pointer-events:none;display:flex;flex-direction:column;gap:4px;width:120px;}'
    + '#fz8Hud .row{display:flex;align-items:center;gap:5px;font:10px Arial;color:#dfe6e9;}'
    + '#fz8Hud .bg{flex:1;height:7px;border-radius:5px;background:#00000066;overflow:hidden;}'
    + '#fz8Hud .bg i{display:block;height:100%;}'
    + '@media (max-width:820px){#fz8Hud{width:80px;left:96px;}}'
    + '#fz8Race{position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:6115;background:rgba(5,8,20,.78);border:1.4px solid #ffd76a88;border-radius:12px;padding:7px 14px;color:#ffd76a;font:bold 14px Arial;display:none;}';
  document.head.appendChild(st);
}
function buildHud() {
  const old = $('fz8Hud'); if (old) old.remove();
  if ($('fz8Race')) return;
  const r = document.createElement('div'); r.id = 'fz8Race'; document.body.appendChild(r);
}
function updateHud() {
  const rr = $('fz8Race');
  if (rr) {
    if (race) { rr.style.display = 'block'; rr.textContent = '🏁 Чекпоинт ' + race.i + '/' + RACE_CIRCUIT.length + ' · ' + race.t.toFixed(1) + 'с'; }
    else if (S.wanted > 0) { rr.style.display = 'block'; rr.style.color = '#ff6b6b'; rr.textContent = '🚨 Розыск ' + '★'.repeat(Math.round(S.wanted)) + ' · штраф ' + fmt(S.wanted * 900); }
    else rr.style.display = 'none';
  }
}
const DOCK = [
  { id: 'craft', icon: '🎒', name: 'Инвентарь и крафт' },
  { id: 'skills', icon: '🧠', name: 'Навыки' },
  { id: 'quests', icon: '📋', name: 'Задания дня' },
  { id: 'daily', icon: '📅', name: 'Ежедневная награда' },
  { id: 'pet', icon: '🐾', name: 'Питомцы' },
  { id: 'home', icon: '🏠', name: 'Жильё' },
  { id: 'car', icon: '🚗', name: 'Транспорт и гонки' },
  { id: 'crime', icon: '🕶️', name: 'Розыск' },
  { id: 'ach', icon: '🏅', name: 'Достижения' },
];
function dockList() { return DOCK.concat(Array.isArray(window.FZ8_DOCK_EXT) ? window.FZ8_DOCK_EXT : []); }
function buildDock() {
  injectCss(); buildHud();
  const d = $('fz8Dock');
  const html = dockList().map(b => '<button data-id="' + b.id + '" title="' + b.name + '">' + b.icon + '</button>').join('');
  if (!d) {
    const nd = document.createElement('div'); nd.id = 'fz8Dock'; nd.innerHTML = html;
    document.body.appendChild(nd);
  } else if (d.childElementCount !== dockList().length) {
    d.innerHTML = html;
  }
  const host = $('fz8Dock');
  host.querySelectorAll('button').forEach(b => { b.onclick = () => openPanel(b.dataset.id); });
  renderDock();
}
window.FZ8_addDock = function (entry) {
  window.FZ8_DOCK_EXT = window.FZ8_DOCK_EXT || [];
  if (!window.FZ8_DOCK_EXT.some(e => e.id === entry.id)) window.FZ8_DOCK_EXT.push(entry);
  try { buildDock(); } catch (e) {}
};
function renderDock() {
  const d = $('fz8Dock'); if (!d) return;
  d.querySelectorAll('button').forEach(b => {
    const id = b.dataset.id;
    b.classList.toggle('on', panelMode === id);
    const old = b.querySelector('.badge'); if (old) old.remove();
    let n = 0;
    if (id === 'quests') n = S.quests.filter(q => !q.done).length;
    else if (id === 'daily' && dailyReady()) n = 1;
    else if (id === 'craft') n = Object.keys(S.items).reduce((a, k) => a + S.items[k], 0);
    else if (id === 'crime' && S.wanted > 0) n = Math.round(S.wanted);
    if (n > 0) { const s2 = document.createElement('span'); s2.className = 'badge'; s2.textContent = n > 99 ? '99+' : n; b.appendChild(s2); }
  });
}
function bar(cls, v) { return '<div class="fz8Bar ' + cls + '"><i style="width:' + clamp(v, 0, 100) + '%"></i></div>'; }
function closePanel() { const m = $('fz8PanelLife'); if (m) m.style.display = 'none'; panelMode = ''; renderDock(); }
function openPanel(mode) {
  injectCss(); buildDock();
  panelMode = mode || 'craft';
  let m = $('fz8PanelLife');
  if (!m) {
    m = document.createElement('div'); m.id = 'fz8PanelLife'; m.className = 'fz8Modal';
    m.onclick = (e) => { if (e.target === m) closePanel(); };
    document.body.appendChild(m);
  }
  m.innerHTML = '<div class="fz8Card">' + bodyFor(panelMode) + '</div>';
  m.style.display = 'flex';
  renderDock();
}
function bodyFor(mode) {
  const tabs = '<div class="fz8Tabs"><button onclick="FZ8L.close();if(window.FZUI)FZUI.open()">← Все разделы</button></div>';
  const head = (t) => '<div style="display:flex;justify-content:space-between;align-items:center;"><h3>' + t + '</h3><button class="fz8B" onclick="FZ8L.close()">✕</button></div>';
  let body = '';
  try {
    if (window.FZ8L_EXT && typeof window.FZ8L_EXT[mode] === 'function') {
      const ext = dockList().find(b => b.id === mode);
      return head((ext ? ext.icon + ' ' + ext.name : '🎮 v8') ) + tabs + window.FZ8L_EXT[mode]();
    }
  } catch (e) { return head('⚠️ Ошибка раздела') + tabs; }
  if (mode === 'skills') {
    body = head('🧠 Навыки') + tabs + '<div class="fz8Chip" style="margin-bottom:9px;">Всего опыта вложено: ' + fmt(Object.keys(S.xp).reduce((a, k) => a + S.xp[k], 0)) + ' · Уровни дают постоянные бонусы</div>';
    body += Object.keys(SKILLS).filter(k => k !== 'stamina').map(k => {
      const sk = SKILLS[k], lv = S.skills[k], need = xpNeed(lv);
      const pct = lv >= sk.max ? 100 : Math.round(S.xp[k] / need * 100);
      return '<div class="fz8Row" style="display:block;"><div style="display:flex;justify-content:space-between;"><div><div class="nm">' + sk.icon + ' ' + sk.name + '</div><div class="sb">' + sk.desc + '</div></div><div class="vl">ур. ' + lv + '/' + sk.max + '</div></div>' + bar('', pct) + '<div class="sb" style="margin-top:4px;">' + fmt(S.xp[k]) + ' / ' + fmt(need) + ' XP</div></div>';
    }).join('');
  } else if (mode === 'craft') {
    body = head('🎒 Инвентарь и крафт') + tabs;
    body += '<div class="fz8Grid" style="margin-bottom:10px;">' + Object.keys(RES).map(k => '<div class="fz8Chip">' + RES[k].icon + ' ' + RES[k].name + ': <b style="color:#ffd76a">' + S.res[k] + '</b></div>').join('') + '</div>';
    body += '<div class="fz8Chip" style="margin-bottom:9px;">🎯 Предметы: ' + (Object.keys(S.items).some(k => S.items[k] > 0) ? Object.keys(S.items).filter(k => S.items[k] > 0).map(k => RECIPES.find(r => r.id === k) ? RECIPES.find(r => r.id === k).icon + ' ' + (S.items[k]) : k + ':' + S.items[k]).join(' · ') : 'пусто') + '</div>';
    body += RECIPES.map(r => '<div class="fz8Row"><div><div class="nm">' + r.icon + ' ' + r.name + '</div><div class="sb">' + Object.keys(r.need).map(k => RES[k].icon + r.need[k]).join(' ') + ' · ' + r.desc + '</div></div><div style="display:flex;gap:6px;">'
      + '<button class="fz8B ' + (canCraft(r) ? 'g' : '') + '" ' + (canCraft(r) ? '' : 'disabled') + ' onclick="FZ8L.craft(\'' + r.id + '\')">Создать</button>'
      + (S.items[r.id] ? '<button class="fz8B y" onclick="FZ8L.useItem(\'' + r.id + '\')">Исп. (' + S.items[r.id] + ')</button>' : '')
      + '</div></div>').join('');
    body += '<div class="fz8Hint">Ресурсы падают из ящиков 📦 по всему городу (жёлтое свечение). Талисман удачи даёт бонус к доходу, глушилка сбрасывает розыск.</div>';
  } else if (mode === 'quests') {
    body = head('📋 Задания дня') + tabs;
    if (!S.quests.length) body += '<div class="fz8Row"><div class="nm">Задания генерируются… открой окно позже</div></div>';
    body += S.quests.map(q => '<div class="fz8Row" style="display:block;"><div style="display:flex;justify-content:space-between;"><div><div class="nm">' + q.icon + ' ' + q.name + ' ' + q.need + '</div><div class="sb">Награда: $' + fmt(q.money) + ' + 120 XP</div></div><div class="vl">' + (q.done ? '✅' : q.prog + '/' + q.need) + '</div></div>' + bar('', q.prog / q.need * 100) + '</div>').join('');
    body += '<div class="fz8Hint">Новые 3 задания каждый день. Прогресс идёт автоматически, награда начисляется сама.</div>';
  } else if (mode === 'daily') {
    body = head('📅 Ежедневная награда') + tabs;
    body += '<div class="fz8Chip" style="margin-bottom:9px;">Серия: ' + S.daily.streak + '/7 дней ' + (dailyReady() ? '· <b style="color:#7cffb2">награда доступна!</b>' : '· получено сегодня (заходи каждый день, чтобы не потерять серию)') + '</div>';
    body += '<div class="fz8Grid" style="margin-bottom:10px;">' + DAILY.map((d, i) => '<div class="fz8Chip" style="border-color:' + (i + 1 <= S.daily.streak ? '#7cffb2' : '#ffffff1c') + '">День ' + d.d + ': ' + d.r + (i + 1 <= S.daily.streak && !dailyReady() ? ' ✅' : '') + '</div>').join('') + '</div>';
    body += '<button class="fz8B ' + (dailyReady() ? 'g' : '') + '" ' + (dailyReady() ? '' : 'disabled') + ' onclick="FZ8L.daily()">Забрать награду</button>';
  } else if (mode === 'pet') {
    body = head('🐾 Питомцы') + tabs;
    if (S.pet) {
      const p = PETS.find(x => x.id === S.pet);
      body += '<div class="fz8Row" style="display:block;"><div style="display:flex;justify-content:space-between;"><div><div class="nm">' + p.icon + ' ' + S.petName + ' · ур. ' + petLv() + '</div><div class="sb">' + p.desc + ' (текущий бонус ×' + petBonus().toFixed(2) + ')</div></div></div>'
        + '<div class="sb">Сытность питомца: ' + Math.round(S.petFed) + '%</div>' + bar('f', S.petFed) + '</div>'
        + '<div style="display:flex;gap:8px;margin-top:6px;"><button class="fz8B g" onclick="FZ8L.feedPet()">Накормить ($60 или сухпаёк)</button>'
        + '<button class="fz8B y" onclick="FZ8L.petPlay()">Играть (+XP питомцу)</button></div>';
    } else {
      body += PETS.map(p => '<div class="fz8Row"><div><div class="nm">' + p.icon + ' ' + p.name + '</div><div class="sb">' + p.desc + '</div></div><button class="fz8B ' + (money() >= p.price ? 'g' : '') + '" ' + (money() >= p.price ? '' : 'disabled') + ' onclick="FZ8L.buyPet(\'' + p.id + '\')">$' + fmt(Math.round(p.price * priceMul())) + '</button></div>').join('');
    }
    body += '<div class="fz8Hint">Питомец бегает за тобой, копит опыт и приносит находки. Дрон-помощник ищет ресурсы, кот — деньги, пёс — силу.</div>';
  } else if (mode === 'home') {
    body = head('🏠 Жильё и улучшения') + tabs;
    if (!S.home) {
      body += HOMES.map((h, i) => '<div class="fz8Row"><div><div class="nm">' + h.name + '</div><div class="sb">' + h.desc + '</div></div><button class="fz8B ' + (money() >= h.price ? 'g' : '') + '" ' + (money() >= h.price ? '' : 'disabled') + ' onclick="FZ8L.buyHome(' + i + ')">$' + fmt(Math.round(h.price * priceMul())) + '</button></div>').join('');
    } else {
      const h = HOMES[S.home - 1];
      body += '<div class="fz8Row" style="display:block;"><div class="nm">🏡 ' + h.name + '</div><div class="sb">Пассивная аренда $' + h.rent + '/мин · улучшений: ' + S.homeUp.length + '/' + HOME_UPS.length + '</div></div>';
      body += HOME_UPS.map(u => {
        const own = S.homeUp.indexOf(u.id) >= 0;
        return '<div class="fz8Row"><div><div class="nm">' + u.icon + ' ' + u.name + '</div><div class="sb">' + u.desc + '</div></div>' + (own ? '<div class="vl">✅ куплено</div>' : '<button class="fz8B ' + (money() >= u.price ? 'g' : '') + '" ' + (money() >= u.price ? '' : 'disabled') + ' onclick="FZ8L.buyHomeUp(\'' + u.id + '\')">$' + fmt(Math.round(u.price * priceMul())) + '</button>') + '</div>';
      }).join('');
      body += '<div style="display:flex;gap:8px;margin-top:8px;"><button class="fz8B g" onclick="FZ8L.sleepHome()">😴 Поспать 8 часов</button></div>';
      body += '<div class="fz8Hint">Сон по желанию переводит время на утро. Следить за едой, водой и усталостью не нужно.</div>';
    }
  } else if (mode === 'car') {
    body = head('🚗 Транспорт и гонки') + tabs;
    if (!S.car) {
      body += VEH.map((v, i) => '<div class="fz8Row"><div><div class="nm">' + v.icon + ' ' + v.name + '</div><div class="sb">Скорость ×' + v.speed + ' к бегу · расход ×' + v.fuel + '</div></div><button class="fz8B ' + (money() >= v.price ? 'g' : '') + '" ' + (money() >= v.price ? '' : 'disabled') + ' onclick="FZ8L.buyCar(' + i + ')">$' + fmt(Math.round(v.price * priceMul())) + '</button></div>').join('');
      body += '<div class="fz8Hint">Владея транспортом, можно участвовать в гонках по кольцу города — приз до $5 400 за заезд.</div>';
    } else {
      const v = curVeh();
      body += '<div class="fz8Row" style="display:block;"><div style="display:flex;justify-content:space-between;"><div><div class="nm">' + v.icon + ' ' + v.name + '</div><div class="sb">Скорость ×' + v.speed.toFixed(2) + ' · повреждения ' + Math.round(S.carDamage) + '%</div></div><div class="vl">' + (driving ? 'за рулём' : 'припаркован') + '</div></div>'
        + '<div class="sb">Топливо: ' + Math.round(S.fuel) + '%</div>' + bar('e', S.fuel)
        + '<div class="sb" style="margin-top:5px;">Состояние: ' + Math.round(100 - S.carDamage) + '%</div>' + bar('f', 100 - S.carDamage) + '</div>';
      body += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:8px 0;">'
        + '<button class="fz8B ' + (driving ? 'r' : 'g') + '" onclick="FZ8L.toggleDrive()">' + (driving ? '🚶 Выйти из машины' : '🚗 Сесть за руль') + '</button>'
        + '<button class="fz8B y" onclick="FZ8L.refuel(25)">⛽ Заправить 25% ($' + fmt(Math.round(25 * 9 * priceMul())) + ')</button>'
        + '<button class="fz8B" onclick="FZ8L.fixCar()">🔧 Починить</button>'
        + '<button class="fz8B r" onclick="FZ8L.startRace()">🏁 Начать гонку</button></div>';
      body += '<div class="fz8Chip">Рекорд круга: ' + (S.raceBest ? S.raceBest.toFixed(1) + ' с' : '—') + ' · побед: ' + S.stats.races + ' · лучший приз зависит от времени</div>';
    }
  } else if (mode === 'crime') {
    body = head('🕶️ Розыск и тёмные дела') + tabs;
    const stars = Math.round(S.wanted);
    body += '<div class="fz8Row" style="display:block;"><div class="nm">Уровень розыска: ' + (stars ? '★'.repeat(stars) + '<span style="color:#444">' + '★'.repeat(5 - stars) + '</span>' : 'чисто ✅') + '</div>'
      + '<div class="sb">Скрытность снижает рост розыска. Штраф при поимке: $' + fmt(S.wanted * 900) + ' · всего уплачено штрафов: $' + fmt(S.fines || 0) + '</div>' + bar('f', S.wanted / 5 * 100) + '</div>';
    body += WANTED_ACTS.map(a => '<div class="fz8Row"><div><div class="nm">' + a.icon + ' ' + a.name + '</div><div class="sb">Доход $' + fmt(a.money[0]) + '–' + fmt(a.money[1]) + ' · +' + a.stars + '★ · откат ' + a.cd + 'с</div></div>'
      + '<button class="fz8B r" ' + ((actCd[a.id] || 0) > 0 ? 'disabled' : '') + ' onclick="FZ8L.doCrime(\'' + a.id + '\')">' + ((actCd[a.id] || 0) > 0 ? Math.ceil(actCd[a.id]) + 'с' : 'Рискнуть') + '</button></div>').join('');
    body += '<div class="fz8Hint">При 1★ и выше в небо поднимается полицейский дрон: догонит — штраф. Сбросить розыск можно глушилкой 📡, бункером-хранилищем или ожиданием. Cбить дрон можно, сбив его на транспорте.</div>';
  } else if (mode === 'ach') {
    body = head('🏅 Достижения') + tabs;
    body += '<div class="fz8Chip" style="margin-bottom:9px;">Открыто ' + S.ach.length + ' / ' + ACH.length + ' · награды начисляются сразу</div>';
    body += ACH.map(a => '<div class="fz8Row"><div><div class="nm" style="opacity:' + (hasAch(a.id) ? 1 : 0.5) + '">' + a.icon + ' ' + a.name + '</div><div class="sb">' + a.desc + '</div></div>' + (hasAch(a.id) ? '<div class="vl">✅</div>' : '<div class="sb">$' + fmt(a.reward) + '</div>') + '</div>').join('');
  } else {
    body = head('🎮 v8.0 SUPER') + tabs + '<div class="fz8Hint">Выбери раздел выше.</div>';
  }
  return body;
}
window.FZ8L = window.FZ8L || {};
window.FZ8L.close = closePanel;
window.FZ8L.panel = openPanel;
window.FZ8L.petPlay = function () { if (!S.pet) return; S.petXp += 45; S.petFed = clamp(S.petFed - 4, 0, 100); notify('🎾 Поиграли с питомцем (+45 XP)'); saveS(true); if (panelMode === 'pet') openPanel('pet'); };
// ---------------- ХУК ОБНОВЛЕНИЯ ----------------
window.FZ8L_update = function (delta) {
  try {
    const dt = Math.min(delta || 0.016, 0.1);
    if (!buildDock._done) { buildDock._done = true; buildDock(); }
    updateLife(dt);
    updateHud();
  } catch (e) { if (!window._fz8LifeErr) { window._fz8LifeErr = 1; try { console.warn('[fz8life]', e); } catch (x) {} } }
};
// периодическое обновление открытой панели
setInterval(() => { try {
  const host = $('fz8PanelLife');
  if (!host || host.style.display !== 'flex') return;
  const card = host.querySelector('.fz8Card');
  const keep = card ? card.scrollTop : 0;
  openPanel(panelMode);
  const card2 = host.querySelector('.fz8Card');
  if (card2) card2.scrollTop = keep;
} catch (e) {} }, 4000);
initLife();
})();
