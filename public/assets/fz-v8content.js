/* ============================================================
   FANTAZIA RP · v8.2 «SUPER» — МОДУЛЬ 5: ПРЕДМЕТЫ И ПРОГРЕСС
   Магазин предметов · гаджеты с эффектами · коллекция карточек
   Сезонный пропуск · перки · челленджи · сюжет-2 · достижения
   ============================================================ */
(function () {
'use strict';
const SKEY = 'fz8_cont';
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
function coins() { try { return (typeof G('localCoins') === 'number') ? window.localCoins : 0; } catch (e) { return 0; } }
function xp(k, v) { try { if (G('FZ8L') && G('FZ8L').xp) G('FZ8L').xp(k, v); } catch (e) {} }
function fx(n, a, b) { try { const F = G('FZFX'); if (F && typeof F[n] === 'function') F[n](a, b); } catch (e) {} }
function lifeS() { try { return G('FZ8L').S; } catch (e) { return null; } }
function rep(k) { try { return G('FZ8W').rep()[k] || 0; } catch (e) { return 0; } }

// ---------------- СОСТОЯНИЕ ----------------
const DEF = {
  v: 1, season: { xp: 0, lv: 1, premium: false, claimed: [] }, cards: {}, tokens: 0, perks: [],
  buffs: {}, items: {}, challenges: { day: '', daily: [], week: '', weekly: [] },
  ach: [], chapters2: [], bought: 0, seen: false, spent: 0,
};
let P = JSON.parse(JSON.stringify(DEF));
function loadP() {
  try {
    const r = localStorage.getItem(SKEY);
    if (r) {
      const o = JSON.parse(r);
      P = Object.assign(JSON.parse(JSON.stringify(DEF)), o);
      P.season = Object.assign({ xp: 0, lv: 1, premium: false, claimed: [] }, o.season || {});
      if (!Array.isArray(P.season.claimed)) P.season.claimed = [];
      P.cards = o.cards || {}; P.buffs = o.buffs || {}; P.items = o.items || {};
      P.challenges = Object.assign({ day: '', daily: [], week: '', weekly: [] }, o.challenges || {});
      ['ach', 'perks', 'chapters2'].forEach(k => { if (!Array.isArray(P[k])) P[k] = []; });
      P.challenges.daily = P.challenges.daily || []; P.challenges.weekly = P.challenges.weekly || [];
    }
  } catch (e) {}
}
let saveT = 0;
function saveP(force) { const n = performance.now(); if (!force && n - saveT < 1200) return; saveT = n; try { localStorage.setItem(SKEY, JSON.stringify(P)); } catch (e) {} }
function hasAch(id) { return P.ach.indexOf(id) >= 0; }
const ACH = [
  { id: 'buy1',    name: 'Шопоголик',       icon: '🛍️', desc: 'Купить 5 предметов',            reward: 1200 },
  { id: 'buy15',   name: 'Коллекционер',    icon: '🧰', desc: 'Купить 15 предметов',           reward: 5200 },
  { id: 'card10',  name: 'Картоман',        icon: '🃏', desc: 'Собрать 10 карточек города',    reward: 3200 },
  { id: 'card30',  name: 'Полный набор',    icon: '🎴', desc: 'Собрать все 30 карточек',       reward: 14000 },
  { id: 'set1',    name: 'Комплект',        icon: '📦', desc: 'Собрать целый набор карточек',  reward: 4500 },
  { id: 'lv10',    name: 'Сезонный боец',   icon: '🏵️', desc: 'Взять 10-й уровень сезона',     reward: 6000 },
  { id: 'lv30',    name: 'Чемпион сезона',  icon: '👑', desc: 'Пройти сезон до 30 уровня',     reward: 22000 },
  { id: 'perk4',   name: 'Талант',          icon: '✨', desc: 'Открыть 4 перка',               reward: 5000 },
  { id: 'perk12',  name: 'Легенда',         icon: '🌟', desc: 'Открыть все 12 перков',         reward: 18000 },
  { id: 'chall1',  name: 'Испытание пройдено', icon: '📌', desc: 'Закрыть любой челлендж',     reward: 1600 },
  { id: 'chall12', name: 'Машина вызовов',  icon: '🔥', desc: 'Закрыть 12 челленджей',         reward: 9000 },
  { id: 'story20', name: 'Финальная глава', icon: '📚', desc: 'Пройти все 20 глав (v8 + v8.2)', reward: 30000 },
];
function checkA(id) {
  if (hasAch(id)) return;
  const a = ACH.find(x => x.id === id); if (!a) return;
  P.ach.push(id); addMoney(a.reward);
  notify('🏅 ' + a.icon + ' ' + a.name + ' (+$' + fmt(a.reward) + ')', 'ach');
  banner('🏅 ДОСТИЖЕНИЕ v8.2: ' + a.name, a.desc + ' · +$' + fmt(a.reward));
  fx('flash', 0.22, [1, 0.9, 0.4]);
  saveP(true);
}

// ---------------- СЕЗОННЫЙ ПРОПУСК ----------------
const SEASON_LV = 30;
function seasonNeed(lv) { return Math.round(140 * Math.pow(1.19, lv - 1)); }
function seasonXp(v) {
  if (v <= 0) return;
  P.season.xp += v;
  let up = 0;
  while (P.season.lv < SEASON_LV && P.season.xp >= seasonNeed(P.season.lv)) {
    P.season.xp -= seasonNeed(P.season.lv);
    P.season.lv++;
    P.tokens++;
    up++;
  }
  if (up) {
    notify('🏵️ Сезон: уровень ' + P.season.lv + '! +' + up + ' жетон перка (всего ' + P.tokens + ')', 'levelup');
    banner('🏵️ СЕЗОННЫЙ ПРОПУСК: уровень ' + P.season.lv, (P.season.lv >= SEASON_LV ? 'Сезон пройден!' : 'Награды открыты — забери в панели 🏵️'));
    fx('flash', 0.2, [1, 0.85, 0.4]);
    if (P.season.lv >= 10) checkA('lv10');
    if (P.season.lv >= SEASON_LV) checkA('lv30');
    saveP(true);
  }
  saveP(false);
}
const REWARDS = [
  { lv: 1,  money: 2500,  free: true },   { lv: 2,  card: 'bus' },          { lv: 3,  money: 4000 },
  { lv: 4,  gems: 3 },                    { lv: 5,  rank: 'street' },       { lv: 6,  money: 6500 },
  { lv: 7,  card: 'tower' },              { lv: 8,  money: 9000 },          { lv: 9,  gems: 5 },
  { lv: 10, money: 14000, big: true },    { lv: 11, card: 'port' },          { lv: 12, money: 16000 },
  { lv: 13, gems: 8 },                    { lv: 14, rank: 'corp' },          { lv: 15, money: 22000, big: true },
  { lv: 16, card: 'wheel' },              { lv: 17, money: 26000 },          { lv: 18, gems: 10 },
  { lv: 19, money: 30000 },               { lv: 20, card: 'beach', big: true }, { lv: 21, money: 34000 },
  { lv: 22, gems: 12 },                   { lv: 23, rank: 'space' },         { lv: 24, money: 40000 },
  { lv: 25, card: 'factory', big: true }, { lv: 26, money: 46000 },          { lv: 27, gems: 16 },
  { lv: 28, money: 52000 },               { lv: 29, card: 'nexus' },         { lv: 30, money: 90000, gems: 30, big: true },
];
function rewardText(r) {
  const out = [];
  if (r.money) out.push('$' + fmt(r.money));
  if (r.gems) out.push('💎 ' + r.gems);
  if (r.card) out.push('🃏 карта «' + (CARD_NAME[r.card] || r.card) + '»');
  if (r.rank) out.push('🤝 репутация ' + r.rank);
  return out.join(' · ');
}
function claimReward(lv) {
  const r = REWARDS.find(x => x.lv === lv);
  if (!r) return;
  if (P.season.lv < lv) { notify('❌ Нужен уровень сезона ' + lv, 'warn'); return; }
  const key = 'r' + lv;
  if (P.season.claimed.indexOf(key) >= 0) { notify('ℹ️ Награда уже получена', 'warn'); return; }
  if (r.money) addMoney(r.money);
  if (r.gems) addCoins(r.gems);
  if (r.card) giveCard(r.card);
  if (r.rank) { try { const W = G('FZ8W'); for (let i = 0; i < 12; i++) W.debug.rep(r.rank, 200); } catch (e) {} }
  P.season.claimed.push(key);
  notify('🏵️ Сезон ' + lv + ': ' + rewardText(r));
  fx('burst', 0, 1.4, 0, 0xffd76a, 14);
  saveP(true);
}
function claimAll() {
  let n = 0;
  REWARDS.forEach(r => { if (P.season.lv >= r.lv && P.season.claimed.indexOf('r' + r.lv) < 0) { claimReward(r.lv); n++; } });
  if (!n) notify('ℹ️ Пока нечего забирать', 'warn');
}
function premiumPass() {
  if (P.season.premium) { notify('ℹ️ Премиум-сезон уже активен'); return; }
  if (coins() < 120) { notify('❌ Нужно 120 кристаллов (у тебя ' + coins() + ')', 'warn'); return; }
  addCoins(-120);
  P.season.premium = true;
  notify('👑 Премиум-сезон активирован: все награды удваиваются!', 'levelup');
  banner('👑 ПРЕМИУМ-СЕЗОН', 'Награды сезонного пропуска теперь x2');
  saveP(true);
}
function premiumMul() { return P.season.premium ? 2 : 1; }

// ---------------- КОЛЛЕКЦИЯ КАРТОЧЕК ----------------
const CARDS = [
  { id: 'bus',     name: 'Городской автобус', icon: '🚌', set: 'city',    rare: 1, from: 'Прокатись на автобусе' },
  { id: 'tower',   name: 'Небоскрёб FZ',      icon: '🏢', set: 'city',    rare: 2, from: 'Побывай в деловом квартале' },
  { id: 'park',    name: 'Парк развлечений',  icon: '🎡', set: 'city',    rare: 2, from: 'Прокатись на аттракционе' },
  { id: 'beach',   name: 'Пляж',              icon: '🏖️', set: 'city',    rare: 1, from: 'Сделай фото на пляже' },
  { id: 'port',    name: 'Порт',              icon: '⚓', set: 'city',    rare: 3, from: 'Отработай в порту' },
  { id: 'factory', name: 'Промзона',          icon: '🏭', set: 'city',    rare: 3, from: 'Отработай смену на заводе' },
  { id: 'coffee',  name: 'Кофейня',           icon: '☕', set: 'biz',     rare: 1, from: 'Купи кофейню (бизнес)' },
  { id: 'server',  name: 'Стойка FZ-CLOUD',   icon: '🖥️', set: 'biz',     rare: 2, from: 'Купи 3 сервера' },
  { id: 'btc',     name: 'Биткоин',           icon: '₿',  set: 'biz',     rare: 3, from: 'Соверши сделку на бирже' },
  { id: 'bank',    name: 'Золотой вклад',     icon: '🏦', set: 'biz',     rare: 3, from: 'Открой вклад в банке' },
  { id: 'moon',    name: 'Лунная база',       icon: '🌙', set: 'biz',     rare: 4, from: 'Основай колонию на Луне' },
  { id: 'nexus',   name: 'Корпоративный нексус', icon: '🌐', set: 'biz',  rare: 5, from: 'Ранг 5 у корпорации' },
  { id: 'cat',     name: 'Кот Барсик',        icon: '🐈', set: 'life',    rare: 2, from: 'Заведи кота' },
  { id: 'dog',     name: 'Пёс Рекс',          icon: '🐕', set: 'life',    rare: 2, from: 'Заведи пса' },
  { id: 'drone',   name: 'Дрон-помощник',     icon: '🛸', set: 'life',    rare: 3, from: 'Заведи дрон' },
  { id: 'home',    name: 'Своя квартира',     icon: '🏠', set: 'life',    rare: 2, from: 'Купи жильё' },
  { id: 'penthouse', name: 'Пентхаус',        icon: '🏙️', set: 'life',    rare: 5, from: 'Купи пентхаус' },
  { id: 'car',     name: 'Суперкар MEGA',     icon: '🏎️', set: 'life',    rare: 4, from: 'Купи суперкар' },
  { id: 'race',    name: 'Кубок гонки',       icon: '🏆', set: 'hard',    rare: 3, from: 'Победи в гонке' },
  { id: 'kart',    name: 'Картинг-кубок',     icon: '🥇', set: 'hard',    rare: 4, from: 'Быстрый круг картинга' },
  { id: 'arena',   name: 'Арена: волна 5',    icon: '⚔️', set: 'hard',    rare: 4, from: 'Продержись 5 волн' },
  { id: 'snake',   name: 'Змейка: 10 очков',  icon: '🐍', set: 'hard',    rare: 3, from: 'Набери 10 очков в змейке' },
  { id: 'target',  name: 'Снайпер тира',      icon: '🎯', set: 'hard',    rare: 3, from: '15 попаданий в тире' },
  { id: 'fish',    name: 'Нептун',            icon: '🐟', set: 'hard',    rare: 4, from: 'Поймай 20 рыб' },
  { id: 'parade',  name: 'Парад',             icon: '🎉', set: 'events',  rare: 2, from: 'Застань парад' },
  { id: 'market',  name: 'Ночной рынок',      icon: '🏮', set: 'events',  rare: 2, from: 'Застань ночной рынок' },
  { id: 'drones',  name: 'Атака дронов',      icon: '🛸', set: 'events',  rare: 3, from: 'Сбей полицейский дрон' },
  { id: 'solar',   name: 'Солнечный пик',     icon: '☀️', set: 'events',  rare: 2, from: 'Застань солнечный пик' },
  { id: 'legend',  name: 'Легенда города',    icon: '👑', set: 'events',  rare: 5, from: 'Ранг 5 у любой фракции' },
  { id: 'photo',   name: 'Фотоохотник',       icon: '📸', set: 'events',  rare: 2, from: 'Открой 3 фотоместа' },
];
const CARD_NAME = {}; CARDS.forEach(c => { CARD_NAME[c.id] = c.name; });
const CARD_SETS = {
  city:   { name: 'Город',        icon: '🏙️', reward: [8000, 4] },
  biz:    { name: 'Корпорация',   icon: '💼', reward: [12000, 6] },
  life:   { name: 'Жизнь',        icon: '🐾', reward: [10000, 5] },
  hard:   { name: 'Испытания',    icon: '⚔️', reward: [14000, 8] },
  events: { name: 'События',      icon: '🎊', reward: [11000, 6] },
};
const RARE_NAME = ['', 'обычная', 'необычная', 'редкая', 'эпическая', 'легендарная'];
const RARE_COLOR = ['', '#b2bec3', '#74b9ff', '#7cffb2', '#a29bfe', '#ffd76a'];
function giveCard(id, silent) {
  const card = CARDS.find(c => c.id === id);
  if (!card) return false;
  const have = P.cards[id] || 0;
  const isNew = have === 0;
  P.cards[id] = have + 1;
  if (!silent) {
    notify((isNew ? '🃏 Новая карточка: ' : '🃏 Дубликат карточки: ') + card.icon + ' ' + card.name + ' (' + RARE_NAME[card.rare] + ')');
    if (!isNew) { const c = 120 * card.rare; addMoney(c); notify('💰 Дубликат обменян на $' + fmt(c)); }
  }
  if (isNew) {
    seasonXp(40 * card.rare);
    fx('flash', 0.18, [0.7, 0.9, 1]);
    const total = Object.keys(P.cards).length;
    if (total >= 10) checkA('card10');
    if (total >= CARDS.length) checkA('card30');
    // комплекты
    Object.keys(CARD_SETS).forEach(k => {
      const set = CARDS.filter(c => c.set === k);
      if (set.every(c => P.cards[c.id] > 0)) {
        const flag = 'set_' + k;
        if (P.ach.indexOf(flag) < 0) {
          P.ach.push(flag);
          const rw = CARD_SETS[k].reward;
          addMoney(rw[0]); addCoins(rw[1]);
          banner('📦 НАБОР СОБРАН: ' + CARD_SETS[k].icon + ' ' + CARD_SETS[k].name, 'Награда $' + fmt(rw[0]) + ' и 💎' + rw[1]);
          checkA('set1');
        }
      }
    });
  }
  saveP(true);
  return true;
}
function cardFrom(kind, id) { giveCard(id); void kind; }

// ---------------- МАГАЗИН ПРЕДМЕТОВ ----------------
const ITEMS = [
  // еда и расходники
  { id: 'coffee2',  name: 'Двойной кофе',      icon: '☕', price: 180,   cat: 'food', desc: 'Горячий напиток', use: () => { vit(0, 0, 45); vit(10, 0, 0); } },
  { id: 'burger',   name: 'Бургер FZ',         icon: '🍔', price: 320,   cat: 'food', desc: 'Перекус',          use: () => { vit(55, 0, 0); } },
  { id: 'sushi',    name: 'Суши-сет',          icon: '🍣', price: 620,   cat: 'food', desc: 'Обед', use: () => { vit(80, 0, 15); } },
  { id: 'water2',   name: 'Спортивная вода',   icon: '💧', price: 120,   cat: 'food', desc: 'Напиток',            use: () => { vit(0, 60, 0); } },
  { id: 'medkit2',  name: 'Аптечка PRO',       icon: '💉', price: 900,   cat: 'food', desc: 'Лечит 60 HP',          use: () => { heal(60); } },
  { id: 'energy2',  name: 'Энергетик X',       icon: '🥤', price: 450,   cat: 'food', desc: 'Напиток',              use: () => { vit(0, 0, 70); } },
  // гаджеты с эффектами
  { id: 'speedboost', name: 'Ускоритель бега', icon: '👟', price: 2600,  cat: 'gadget', desc: '+25% к скорости на 5 минут', buff: { key: 'speed', mult: 0.25, time: 300 } },
  { id: 'luckycoin',  name: 'Монета удачи',    icon: '🍀', price: 3200,  cat: 'gadget', desc: '+20% к доходу на 10 минут',  buff: { key: 'income', mult: 0.2, time: 600 } },
  { id: 'glass',      name: 'Очки ясности',    icon: '🕶️', price: 2400,  cat: 'gadget', desc: '+30% XP на 8 минут',         buff: { key: 'xp', mult: 0.3, time: 480 } },
  { id: 'jammer2',    name: 'Глушилка PRO',    icon: '📡', price: 4200,  cat: 'gadget', desc: 'Мгновенно сбрасывает розыск', use: () => { try { const S = lifeS(); S.wanted = 0; S.wantedT = 0; notify('📡 Розыск сброшен'); } catch (e) {} } },
  { id: 'scanner',    name: 'Сканер ресурсов', icon: '📶', price: 5400,  cat: 'gadget', desc: 'Находит 3 ящика рядом на карте', use: () => { scanBoxes(); } },
  { id: 'thermos',    name: 'Термос-бесконечность', icon: '🫖', price: 3600, cat: 'gadget', desc: 'Многоразовый термос', passive: 'thermos' },
  { id: 'backpack',   name: 'Рюкзак мастермайнд', icon: '🎒', price: 4800, cat: 'gadget', desc: 'Постоянно: +25% ресурсов из ящиков', passive: 'backpack' },
  { id: 'armor',      name: 'Бронежилет',      icon: '🦺', price: 7200,  cat: 'gadget', desc: 'Постоянно: −40% урона', passive: 'armor' },
  // одежда
  { id: 'hoodie',   name: 'Худи FANTAZIA',     icon: '🧥', price: 1800,  cat: 'cloth', desc: 'Стильный вид + 5% харизмы', passive: 'hoodie' },
  { id: 'cap2',     name: 'Кепка FZ',          icon: '🧢', price: 900,   cat: 'cloth', desc: 'Классика улиц', passive: 'cap' },
  { id: 'mask2',    name: 'Маска-неон',        icon: '😷', price: 3400,  cat: 'cloth', desc: '−25% к росту розыска', passive: 'mask' },
  { id: 'chain2',   name: 'Золотая цепь',      icon: '📿', price: 6200,  cat: 'cloth', desc: '+10% к доходу', passive: 'chain' },
  { id: 'sneakers', name: 'Кроссовки Turbo',   icon: '👟', price: 2800,  cat: 'cloth', desc: '+8% к скорости', passive: 'sneakers' },
  { id: 'watch',    name: 'Умные часы',        icon: '⌚', price: 4400,  cat: 'cloth', desc: 'Показывают таймеры активностей', passive: 'watch' },
  // авто и дом
  { id: 'nitro',    name: 'Нитро-комплект',    icon: '🔥', price: 8500,  cat: 'auto', desc: 'Постоянно: +15% скорости за рулём', passive: 'nitro' },
  { id: 'bigtank',  name: 'Большой бак',       icon: '⛽', price: 5200,  cat: 'auto', desc: 'Постоянно: −50% расхода топлива', passive: 'bigtank' },
  { id: 'spoiler',  name: 'Спойлер MEGA',      icon: '🏁', price: 3800,  cat: 'auto', desc: '+5% к призу заездов', passive: 'spoiler' },
  { id: 'sofa',     name: 'Массажное кресло',  icon: '💺', price: 9600,  cat: 'home', desc: 'Мебель для гостиной', passive: 'sofa' },
  { id: 'piano',    name: 'Рояль в гостиной',  icon: '🎹', price: 14000, cat: 'home', desc: '+15% к доходу жилья', passive: 'piano' },
  { id: 'safe',     name: 'Домашний сейф',     icon: '🔐', price: 18000, cat: 'home', desc: '−50% к штрафам', passive: 'safe' },
  // премиум
  { id: 'jetpack',  name: 'Джетпак',           icon: '🚀', price: 46000, cat: 'premium', desc: 'Постоянно: прыжки выше и +30% скорости', passive: 'jetpack' },
  { id: 'drone2',   name: 'Дрон-телохранитель',icon: '🛸', price: 38000, cat: 'premium', desc: 'Отгоняет полицейский дрон', passive: 'drone2' },
  { id: 'vipcard',  name: 'VIP-карта города',  icon: '💳', price: 30000, cat: 'premium', desc: '−25% на всё в этом магазине', passive: 'vipcard' },
  { id: 'core',     name: 'Ядро FANTAZIA',     icon: '🔮', price: 90000, cat: 'premium', desc: 'Постоянно: +40% ко всему доходу', passive: 'core' },
];
const CATS = { food: { name: 'Еда и расходники', icon: '🍔' }, gadget: { name: 'Гаджеты', icon: '🔧' }, cloth: { name: 'Стиль', icon: '🧥' }, auto: { name: 'Авто', icon: '🚗' }, home: { name: 'Дом', icon: '🏠' }, premium: { name: 'Премиум', icon: '💎' } };
function vit() {} // Needs removed; legacy consumables remain optional role-play items.
function heal(v) { try { const lp = G('localPlayer'); lp.health = clamp((lp.health || 100) + v, 0, 100); if (G('updateHealthBar')) G('updateHealthBar')(); } catch (e) {} }
function priceOf(it) {
  let p = it.price;
  if (P.items.vipcard) p *= 0.75;
  const lv = P.season.lv;
  p *= clamp(1 - lv * 0.006, 0.75, 1);
  return Math.round(p);
}
function owns(id) { return !!P.items[id]; }
function buyItem(id) {
  const it = ITEMS.find(x => x.id === id);
  if (!it) return;
  if (it.passive && owns(id)) { notify('ℹ️ Уже куплено', 'warn'); return; }
  const price = priceOf(it);
  if (money() < price) { notify('❌ Нужно $' + fmt(price), 'warn'); return; }
  addMoney(-price);
  P.spent += price; P.bought++;
  if (it.passive) { P.items[id] = 1; applyPassives(); }
  else { P.items[id] = (P.items[id] || 0) + 1; }
  seasonXp(Math.round(price / 120));
  notify('🛍️ Куплено: ' + it.icon + ' ' + it.name + ' за $' + fmt(price));
  fx('flash', 0.14, [0.8, 0.9, 1]);
  if (P.bought >= 5) checkA('buy1');
  if (P.bought >= 15) checkA('buy15');
  syncLifeItems();
  saveP(true);
  if ($('fz8PanelLife')) openPanelC('shop');
}
function useItemC(id) {
  const it = ITEMS.find(x => x.id === id);
  if (!it || !P.items[id]) { notify('❌ Нет предмета', 'warn'); return; }
  if (it.passive) { notify('ℹ️ Это пассивный предмет — он работает постоянно'); return; }
  P.items[id]--;
  if (it.use) { try { it.use(); } catch (e) {} }
  if (it.buff) {
    P.buffs[it.buff.key] = { mult: it.buff.mult, until: Date.now() + it.buff.time * 1000 };
    notify('⚡ Активирован эффект: ' + it.name + ' (+' + Math.round(it.buff.mult * 100) + '% на ' + Math.round(it.buff.time / 60) + ' мин)');
  }
  notify('✅ Использовано: ' + it.icon + ' ' + it.name);
  saveP(true);
  if ($('fz8PanelLife')) openPanelC('shop');
}
function applyPassives() {} // No hydration passive after needs removal.
function buff(k) {
  const b = P.buffs[k];
  if (!b) return 1;
  if (Date.now() > b.until) { delete P.buffs[k]; return 1; }
  return 1 + (b.mult || 0) * premiumMul();
}
function hasPassive(k) { return !!P.items[k]; }
function scanBoxes() {
  try {
    const boxes = G('FZ8L').lootBoxes || [];
    const p = { x: G('localPlayer').mesh.position.x, z: G('localPlayer').mesh.position.z };
    boxes.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    boxes.slice(0, 3).forEach((b, i) => {
      setTimeout(() => notify('📶 Сканер: ящик ' + (i + 1) + ' на координатах ' + Math.round(b.x) + ', ' + Math.round(b.z) + ' (' + Math.round(Math.hypot(b.x - p.x, b.z - p.z)) + ' м)'), i * 900);
    });
  } catch (e) { notify('❌ Сканер не нашёл ящиков', 'warn'); }
}
function syncLifeItems() {
  try {
    const S = lifeS(); if (!S) return;
    if (P.items.burger) { }
    if (hasPassive('backpack')) S.resBonus = 0.25; else S.resBonus = 0;
    if (hasPassive('armor')) S.dmgMul = 0.6; else S.dmgMul = 1;
    if (hasPassive('safe')) S.fineMul = 0.5; else S.fineMul = 1;
  } catch (e) {}
}

// ---------------- ПЕРКИ ----------------
const PERKS = [
  { id: 'income1', name: 'Коммерсант',      icon: '💵', cost: 1, req: [],        desc: '+15% ко всем доходам' },
  { id: 'income2', name: 'Магнат',          icon: '💰', cost: 3, req: ['income1'], desc: '+30% ко всем доходам (суммарно)' },
  { id: 'speed1',  name: 'Быстрые ноги',    icon: '🏃', cost: 1, req: [],        desc: '+10% к скорости' },
  { id: 'luck1',   name: 'Удачливый',       icon: '🍀', cost: 2, req: [],        desc: '+20% к призам мини-игр и заездов' },
  { id: 'craft1',  name: 'Мастер-крафтер',  icon: '🛠️', cost: 2, req: [],        desc: 'Крафт иногда даёт двойной результат' },
  { id: 'sneak1',  name: 'Тень',            icon: '🥷', cost: 2, req: [],        desc: '−30% к росту розыска' },
  { id: 'trade1',  name: 'Торговец',        icon: '🤝', cost: 2, req: [],        desc: '−15% к ценам магазинов' },
  { id: 'xp1',     name: 'Обучаемый',       icon: '📚', cost: 1, req: [],        desc: '+25% к опыту навыков' },
  { id: 'energy1', name: 'Двужильный',      icon: '🫀', cost: 2, req: [],        desc: 'Силы тратятся на 35% медленнее' },
  { id: 'cards1',  name: 'Коллекционер+',   icon: '🃏', cost: 3, req: [],        desc: 'Больше шансов выбить карточку' },
  { id: 'season1', name: 'Сезонный ветеран',icon: '🏵️', cost: 2, req: [],        desc: '+25% к сезонному XP' },
  { id: 'master',  name: 'Хозяин Фантазии', icon: '👑', cost: 6, req: ['income2', 'xp1'], desc: '+10% ко всему: доход, скорость, призы, опыт' },
];
function hasPerk(id) { return P.perks.indexOf(id) >= 0; }
function perkMul(id) { return hasPerk(id) ? 1 : 0; }
function perkSum() { let s = 0; ['master'].forEach(k => { if (hasPerk(k)) s += 0.1; }); return 1 + s; }
function buyPerk(id) {
  const pk = PERKS.find(x => x.id === id);
  if (!pk || hasPerk(id)) return;
  if (!pk.req.every(r => hasPerk(r))) { notify('❌ Сначала нужны перки: ' + pk.req.join(', '), 'warn'); return; }
  if (P.tokens < pk.cost) { notify('❌ Нужно ' + pk.cost + ' жетон(а) перка (у тебя ' + P.tokens + ')', 'warn'); return; }
  P.tokens -= pk.cost;
  P.perks.push(id);
  notify('✨ Перк открыт: ' + pk.icon + ' ' + pk.name + ' — ' + pk.desc, 'levelup');
  banner('✨ НОВЫЙ ПЕРК: ' + pk.name, pk.desc);
  if (P.perks.length >= 4) checkA('perk4');
  if (P.perks.length >= PERKS.length) checkA('perk12');
  applyPassives(); syncPerks();
  saveP(true);
  if ($('fz8PanelLife')) openPanelC('perks');
}
function syncPerks() {
  try {
    const S = lifeS(); if (!S) return;
    S.perkSpeed = hasPerk('speed1') ? 1.1 : 1;
    S.perkIncome = (hasPerk('income2') ? 1.3 : hasPerk('income1') ? 1.15 : 1) * perkSum();
    S.perkTrade = hasPerk('trade1') ? 0.85 : 1;
    S.perkXp = (hasPerk('xp1') ? 1.25 : 1) * perkSum();
    S.perkEnergy = hasPerk('energy1') ? 0.65 : 1;
  } catch (e) {}
}

// ---------------- ЧЕЛЛЕНДЖИ ----------------
const CH_DAILY = [
  { t: 'money',  icon: '💰', text: 'Заработай $',           from: 4000, to: 14000, reward: [1200, 2600] },
  { t: 'loot',   icon: '📦', text: 'Открой ящиков',         from: 2, to: 5,       reward: [900, 2000] },
  { t: 'ride',   icon: '🎡', text: 'Прокатись на аттракционе', from: 1, to: 3,    reward: [1000, 2200] },
  { t: 'talk',   icon: '💬', text: 'Поговори с горожанами', from: 2, to: 6,       reward: [800, 1800] },
  { t: 'job',    icon: '👷', text: 'Закрой подработку',     from: 1, to: 2,       reward: [1600, 3200] },
  { t: 'fish',   icon: '🎣', text: 'Поймай рыбу',           from: 1, to: 4,       reward: [1100, 2400] },
  { t: 'event',  icon: '🎪', text: 'Поучаствуй в событиях',  from: 1, to: 3,      reward: [1400, 3000] },
];
const CH_WEEK = [
  { t: 'money',  icon: '💎', text: 'Заработай за неделю $', from: 90000, to: 260000, reward: [9000, 18000] },
  { t: 'cards',  icon: '🃏', text: 'Собери новых карточек', from: 3, to: 6,        reward: [7000, 14000] },
  { t: 'arena',  icon: '⚔️', text: 'Пройди волн арены',     from: 3, to: 7,        reward: [8000, 16000] },
  { t: 'races',  icon: '🏁', text: 'Победи в заездах',      from: 2, to: 5,        reward: [8500, 17000] },
  { t: 'visit',  icon: '🏙️', text: 'Посети районы города',  from: 3, to: 6,        reward: [6000, 12000] },
];
function todayKey() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function weekKey() { const d = new Date(); const one = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const day = (one.getDay() + 6) % 7; one.setDate(one.getDate() - day); return 'w' + one.getFullYear() + '-' + (one.getMonth() + 1) + '-' + one.getDate(); }
let baseStat = null;
function statSnapshot() {
  const S = lifeS() || { stats: {} };
  const w = G('FZ8W') ? G('FZ8W').state() : { talkCount: 0, fishCount: 0, eventLog: [] };
  const c = G('FZ8C') ? G('FZ8C').state() : { rides: 0, jobsDone: 0, visits: [] };
  return {
    money: money(), loot: S.stats.loot || 0, talk: w.talkCount || 0, fish: w.fishCount || 0,
    events: (w.eventLog || []).length, rides: c.rides || 0, jobs: c.jobsDone || 0,
    cards: Object.keys(P.cards).length, races: (S.stats.races || 0), arena: (c.arenaWaves || 0),
    visits: (c.visits || []).length,
  };
}
function rollChallenges() {
  const dk = todayKey(), wk = weekKey();
  if (P.challenges.day !== dk || !P.challenges.daily.length) {
    P.challenges.day = dk;
    P.challenges.daily = [];
    const pool = CH_DAILY.slice();
    for (let i = 0; i < 3 && pool.length; i++) {
      const q = pool.splice(ri(0, pool.length - 1), 1)[0];
      P.challenges.daily.push({ t: q.t, icon: q.icon, text: q.text, need: ri(q.from, q.to), prog: 0, reward: ri(q.reward[0], q.reward[1]), done: false });
    }
    notify('📌 Новые ежедневные челленджи — 3 шт. (панель 🎽)');
  }
  if (P.challenges.week !== wk || !P.challenges.weekly.length) {
    P.challenges.week = wk;
    P.challenges.weekly = [];
    const pool = CH_WEEK.slice();
    for (let i = 0; i < 3 && pool.length; i++) {
      const q = pool.splice(ri(0, pool.length - 1), 1)[0];
      P.challenges.weekly.push({ t: q.t, icon: q.icon, text: q.text, need: ri(q.from, q.to), prog: 0, reward: ri(q.reward[0], q.reward[1]), done: false });
    }
    notify('🗓️ Новые недельные челленджи — 3 шт. (панель 🎽)');
  }
  baseStat = statSnapshot();
}
function updateChallenges() {
  if (!baseStat) { baseStat = statSnapshot(); return; }
  const now = statSnapshot();
  const apply = (list, key) => list.forEach(q => {
    if (q.done) return;
    let v = 0;
    if (q.t === 'money') v = Math.max(0, now.money - baseStat.money);
    else if (key === 'daily') v = Math.max(0, (now[q.t] || 0) - (baseStat[q.t] || 0));
    else v = (now[q.t] || 0) - (baseStat[q.t] || 0);
    if (key === 'weekly') q.prog = Math.min(q.need, Math.max(q.prog, v));
    else q.prog = Math.min(q.need, Math.max(q.prog, v));
    if (q.prog >= q.need) {
      q.done = true;
      const pay = Math.round(q.reward * (key === 'weekly' ? 1 : 1) * premiumMul());
      addMoney(pay);
      seasonXp(key === 'weekly' ? 300 : 120);
      P.chClosed = (P.chClosed || 0) + 1;
      notify('✅ Челлендж закрыт: ' + q.icon + ' ' + q.text + ' ' + q.need + ' · +$' + fmt(pay));
      if (P.chClosed >= 1) checkA('chall1');
      if (P.chClosed >= 12) checkA('chall12');
      fx('flash', 0.16, [0.6, 1, 0.7]);
      saveP(true);
    }
  });
  apply(P.challenges.daily, 'daily');
  apply(P.challenges.weekly, 'weekly');
  baseStat = now;
}
function chReset() { P.challenges.daily = []; P.challenges.weekly = []; rollChallenges(); saveP(true); }

// ---------------- СЮЖЕТ-2 (главы 11-20) ----------------
function cardsCount() { return Object.keys(P.cards).length; }
function setsCount() { return Object.keys(CARD_SETS).filter(k => CARDS.filter(c => c.set === k).every(c => P.cards[c.id] > 0)).length; }
function districtsVisited() { try { return (G('FZ8C').state().visits || []).length; } catch (e) { return 0; } }
function fz7() { try { const r = localStorage.getItem('fz7_state'); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
const CHAPTERS2 = [
  { id: 11, name: 'Коллекционер',     desc: 'Собери 5 карточек города',                          check: () => cardsCount() >= 5, reward: 6000 },
  { id: 12, name: 'Сезон открыт',     desc: 'Возьми 5-й уровень сезонного пропуска',             check: () => P.season.lv >= 5, reward: 8000 },
  { id: 13, name: 'Городское хозяйство', desc: 'Посети 4 района города',                         check: () => districtsVisited() >= 4, reward: 10000 },
  { id: 14, name: 'Первый перк',      desc: 'Открой любой перк',                                 check: () => P.perks.length >= 1, reward: 12000 },
  { id: 15, name: 'Любимец публики',  desc: 'Закрой 3 челленджа',                                check: () => (P.chClosed || 0) >= 3, reward: 15000 },
  { id: 16, name: 'Комплект собран',  desc: 'Собери полный набор карточек',                      check: () => setsCount() >= 1, reward: 18000 },
  { id: 17, name: 'Магнат',           desc: 'Открой перк «Магнат» или заработай $400 000',        check: () => hasPerk('income2') || money() >= 400000, reward: 22000 },
  { id: 18, name: 'Испытания города', desc: 'Пройди 5 волн арены и выиграй 5 заездов',            check: () => { const c = G('FZ8C') ? G('FZ8C').state() : {}; const S = lifeS() || { stats: {} }; return (c.arenaWaves || 0) >= 5 && (S.stats.races || 0) >= 5; }, reward: 26000 },
  { id: 19, name: 'Хозяин коллекции', desc: 'Собери 20 карточек и 20-й уровень сезона',           check: () => cardsCount() >= 20 && P.season.lv >= 20, reward: 34000 },
  { id: 20, name: 'Легенда Фантазии', desc: 'Все 30 карточек, 30-й уровень, 8 перков и $1 000 000', check: () => cardsCount() >= 30 && P.season.lv >= 30 && P.perks.length >= 8 && money() >= 1000000, reward: 90000 },
];
function story2Tick() {
  CHAPTERS2.forEach(c => {
    if (P.chapters2.indexOf(c.id) >= 0) return;
    let ok = false;
    try { ok = !!c.check(); } catch (e) { ok = false; }
    if (!ok) return;
    P.chapters2.push(c.id); P.chapters2.sort((a, b) => a - b);
    const pay = Math.round(c.reward * premiumMul());
    addMoney(pay);
    P.tokens++;
    seasonXp(200);
    banner('📖 ГЛАВА ' + c.id + ' ЗАВЕРШЕНА', c.name + ' · награда $' + fmt(pay) + ' и жетон перка');
    notify('📖 Глава ' + c.id + ' «' + c.name + '» пройдена! +$' + fmt(pay) + ' + жетон', 'levelup');
    fx('flash', 0.25, [0.85, 0.9, 1]);
    if (P.chapters2.length >= 10) {
      checkA('story20');
      banner('👑 ФИНАЛ v8.2', 'Ты прошёл все 20 глав и стал легендой Фантазии!');
    }
    saveP(true);
  });
}

// ---------------- ИСТОЧНИКИ КАРТОЧЕК ----------------
function cardFrom(src, id) {
  P.cardGot = P.cardGot || {};
  const key = 'g_' + src;
  if (P.cardGot[key]) return false;
  const chance = hasPerk('cards1') ? 1 : 1;
  P.cardGot[key] = 1;
  if (chance < 1 && Math.random() > chance) { saveP(true); return false; }
  giveCard(id);
  return true;
}
function checkCardSources() {
  const S = lifeS() || { stats: {}, home: 0, car: 0, pet: null, skills: {}, homeUp: [] };
  const w = G('FZ8W') ? G('FZ8W').state() : { talkCount: 0, fishCount: 0, eventLog: [] };
  const c = G('FZ8C') ? G('FZ8C').state() : { rides: 0, jobsDone: 0, visits: [], photos: [], factoryShifts: 0, portBoxes: 0 };
  const f = fz7() || {};
  const ev = (w.eventLog || []).map(e => e.id);
  if ((S.stats.loot || 0) >= 3) cardFrom('loot3', 'bus');
  if ((c.visits || []).indexOf('business') >= 0) cardFrom('visitBiz', 'tower');
  if ((c.rides || 0) >= 1) cardFrom('ride1', 'park');
  if ((c.photos || []).indexOf('beach') >= 0) cardFrom('photoBeach', 'beach');
  if ((c.portBoxes || 0) >= 3) cardFrom('port3', 'port');
  if ((c.factoryShifts || 0) >= 1) cardFrom('shift1', 'factory');
  if (Object.keys(f.biz || {}).length >= 1) cardFrom('biz1', 'coffee');
  if ((f.servers || 0) >= 3) cardFrom('srv3', 'server');
  if ((f.btc || 0) >= 1) cardFrom('btc1', 'btc');
  if ((f.deposit || 0) > 0) cardFrom('dep1', 'bank');
  if (Object.keys(f.cols || {}).indexOf('moon') >= 0) cardFrom('moon1', 'moon');
  if (rep('corp') >= 5) cardFrom('corp5', 'nexus');
  if (S.pet === 'cat') cardFrom('petCat', 'cat');
  if (S.pet === 'dog') cardFrom('petDog', 'dog');
  if (S.pet === 'drone') cardFrom('petDrone', 'drone');
  if ((S.home || 0) >= 1) cardFrom('home1', 'home');
  if ((S.home || 0) >= 3) cardFrom('home3', 'penthouse');
  if ((S.car || 0) >= 3) cardFrom('car3', 'car');
  if (ev.indexOf('parade') >= 0) cardFrom('evParade', 'parade');
  if (ev.indexOf('market') >= 0) cardFrom('evMarket', 'market');
  if (ev.indexOf('solar') >= 0) cardFrom('evSolar', 'solar');
  if ((c.arenaWaves || 0) >= 3) cardFrom('arena3', 'arena');
  if ((S.stats.races || 0) >= 1) cardFrom('race1', 'race');
  if ((c.kartsBest || 0) > 0 && c.kartsBest < 60) cardFrom('kart1', 'kart');
  if ((S.snakeBest || 0) >= 10) cardFrom('snake10', 'snake');
  if ((S.targetBest || 0) >= 15) cardFrom('target15', 'target');
  if ((w.fishCount || 0) >= 15) cardFrom('fish15', 'fish');
  if ((c.photos || []).length >= 3) cardFrom('photo3', 'photo');
  if (Object.keys(G('FZ8W') ? G('FZ8W').rep() : {}).some(k => G('FZ8W').rep()[k] >= 5)) cardFrom('rep5', 'legend');
  if (S.wanted >= 3) cardFrom('wanted3', 'drones');
}
// ---------------- ОБНОВЛЕНИЕ ----------------
let t4 = 0, moneyT = 0, lastMoney = null, deltaT = 0;
function updateContent(dt) {
  t4 += dt;
  if (t4 > 3.5) {
    t4 = 0;
    checkCardSources();
    updateChallenges();
    if (P.challenges.day !== todayKey() || P.challenges.week !== weekKey()) rollChallenges();
  }
  // сезонный XP идёт за заработанные деньги
  moneyT += dt;
  const m = money();
  if (lastMoney === null) lastMoney = m;
  if (moneyT > 5) {
    moneyT = 0;
    const d = m - lastMoney;
    if (d > 0) seasonXp(Math.round(d / 90) * perkSum());
    lastMoney = m;
  }
  story2Tick();
  applyPassives();
  // таймер эффектов
  if (t4 > 1 && Object.keys(P.buffs).length) {
    Object.keys(P.buffs).forEach(k => { if (Date.now() > P.buffs[k].until) { delete P.buffs[k]; notify('⌛ Эффект «' + k + '» закончился'); } });
  }
  deltaT += dt;
  syncPerks();
}
// множители в ядро и модули
const prevSpeedMul = window.FZ8_speedMul;
window.FZ8_speedMul = function () {
  let m = 1;
  try { if (prevSpeedMul) m = prevSpeedMul(); } catch (e) {}
  try { const S = lifeS(); if (S && S.perkSpeed) m *= S.perkSpeed; } catch (e) {}
  if (hasPassive('sneakers')) m *= 1.08;
  if (hasPassive('jetpack')) m *= 1.3;
  if (hasPassive('nitro') && G('FZ8L') && G('FZ8L').drive && G('FZ8L').drive()) m *= 1.15;
  m *= buff('speed');
  return m;
};
window.FZ8C2 = {
  state: () => P, cards: () => P.cards, cardList: CARDS, items: ITEMS, perks: PERKS, chapters: CHAPTERS2,
  buy: buyItem, use: useItemC, giveCard: giveCard, seasonXp: seasonXp, claim: claimReward, claimAll: claimAll,
  premium: premiumPass, perk: buyPerk, challenges: () => P.challenges, roll: rollChallenges, panel: openPanelC, buff: buff, hasPassive: hasPassive,
  debug: {
    money: (v) => addMoney(v), gems: (v) => addCoins(v), tokens: (v) => { P.tokens += v; }, seasonxp: (v) => seasonXp(v),
    card: (id) => giveCard(id), cardsAll: () => CARDS.forEach(c => { P.cardGot = P.cardGot || {}; P.cardGot['g_' + c.id] = 1; giveCard(c.id, true); }),
    wipe: () => { P = JSON.parse(JSON.stringify(DEF)); saveP(true); notify('dev: сброс v8 content'); },
  },
};
// ---------------- ПАНЕЛИ ----------------
function cityModal2(title, html, width) {
  let m = $('fz8Cont');
  if (!m) {
    m = document.createElement('div'); m.id = 'fz8Cont';
    m.style.cssText = 'position:fixed;inset:0;z-index:8460;background:rgba(4,2,12,.8);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;';
    m.onclick = (e) => { if (e.target === m) m.style.display = 'none'; };
    document.body.appendChild(m);
  }
  m.innerHTML = '<div style="width:min(' + (width || 560) + 'px,96vw);max-height:90vh;overflow:auto;background:linear-gradient(165deg,#141230,#090818);border:1.5px solid #6c5ce766;border-radius:18px;padding:16px;color:#fff;font:14px Arial;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><div style="font:bold 16px Arial;">' + title + '</div>'
    + '<button onclick="document.getElementById(\'fz8Cont\').style.display=\'none\'" style="background:#ffffff14;color:#fff;border:1px solid #ffffff30;border-radius:10px;width:30px;height:30px;cursor:pointer;">✕</button></div>' + html + '</div>';
  m.style.display = 'flex';
  return m;
}
function openPanelC(mode) {
  P.panelMode = mode;
  if (mode === 'shop') panelShop();
  else if (mode === 'cards') panelCards();
  else if (mode === 'season') panelSeason();
  else if (mode === 'perks') panelPerks();
  else if (mode === 'challenges') panelChallenges();
  else if (mode === 'story2') panelStory2();
}
function panelShop(cat) {
  cat = cat || P.shopCat || 'food';
  P.shopCat = cat;
  let h = '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;">'
    + Object.keys(CATS).map(k => '<button onclick="FZ8C2.panel(\'shop\');FZ8C2.setCat(\'' + k + '\')" style="padding:7px 10px;border-radius:11px;border:1.3px solid ' + (k === cat ? '#7cffb2' : '#ffffff22') + ';background:' + (k === cat ? 'linear-gradient(135deg,#00b894,#00997a)' : '#ffffff10') + ';color:#fff;cursor:pointer;font:bold 12px Arial;">' + CATS[k].icon + ' ' + CATS[k].name + '</button>').join('')
    + '</div>';
  h += '<div class="fz8Chip" style="margin-bottom:9px;">Покупок: ' + P.bought + ' · потрачено: $' + fmt(P.spent) + (P.items.vipcard ? ' · VIP-скидка активна' : '') + '</div>';
  h += ITEMS.filter(i => i.cat === cat).map(i => {
    const own = owns(i.id);
    const price = priceOf(i);
    return '<div class="fz8Row"><div><div class="nm">' + i.icon + ' ' + i.name + (i.passive && own ? ' <span style="color:#7cffb2">✔</span>' : '') + (!i.passive && P.items[i.id] ? ' ×' + P.items[i.id] : '') + '</div><div class="sb">' + i.desc + '</div></div>'
      + '<div style="display:flex;gap:6px;">' + (i.passive && own ? '<div class="vl">куплено</div>' : '<button class="fz8B ' + (money() >= price ? 'g' : '') + '" ' + (money() >= price ? '' : 'disabled') + ' onclick="FZ8C2.buy(\'' + i.id + '\')">$' + fmt(price) + '</button>')
      + (!i.passive ? '<button class="fz8B y" onclick="FZ8C2.use(\'' + i.id + '\')">Исп.</button>' : '') + '</div></div>';
  }).join('');
  h += '<div class="fz8Hint">Пассивные предметы работают постоянно: гаджеты, стиль, авто и дом. Расходники можно использовать много раз. VIP-карта даёт −25% на всё в магазине.</div>';
  cityModal2('🛍️ Магазин Фантазии', h, 580);
}
function setCat(k) { panelShop(k); }
function panelCards() {
  const total = Object.keys(P.cards).length;
  let h = '<div class="fz8Chip" style="margin-bottom:10px;">Собрано ' + total + ' / ' + CARDS.length + ' карточек · наборы: ' + setsCount() + '/' + Object.keys(CARD_SETS).length + '</div>';
  h += Object.keys(CARD_SETS).map(k => {
    const set = CARDS.filter(c => c.set === k);
    const got = set.filter(c => P.cards[c.id] > 0).length;
    const full = got === set.length;
    return '<div class="fz8Row" style="display:block;"><div style="display:flex;justify-content:space-between;"><div class="nm">' + CARD_SETS[k].icon + ' ' + CARD_SETS[k].name + '</div><div class="vl">' + got + '/' + set.length + (full ? ' ✅' : '') + '</div></div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:7px;">' + set.map(c => {
        const have = P.cards[c.id] > 0;
        return '<div class="fz8Chip" style="border-color:' + (have ? RARE_COLOR[c.rare] : '#ffffff18') + ';opacity:' + (have ? 1 : 0.45) + ';min-width:120px;">' + c.icon + ' ' + c.name + '<div style="font-size:10px;color:' + RARE_COLOR[c.rare] + ';">' + RARE_NAME[c.rare] + (have && P.cards[c.id] > 1 ? ' · ×' + P.cards[c.id] : '') + '</div></div>';
      }).join('') + '</div>'
      + '<div class="sb" style="margin-top:6px;">' + (full ? 'Набор собран: награда получена' : 'Как получить: ' + set.filter(c => !P.cards[c.id]).map(c => c.from).join(' · ')) + '</div></div>';
  }).join('');
  cityModal2('🃏 Коллекция карточек', h, 600);
}
function panelSeason() {
  const need = seasonNeed(P.season.lv);
  let h = '<div class="fz8Row" style="display:block;"><div style="display:flex;justify-content:space-between;"><div class="nm">🏵️ Уровень ' + P.season.lv + ' / ' + SEASON_LV + (P.season.premium ? ' · 👑 премиум' : '') + '</div><div class="vl">' + Math.round(P.season.xp) + ' / ' + (P.season.lv >= SEASON_LV ? '—' : need) + ' XP</div></div>'
    + '<div class="fz8Bar"><i style="width:' + (P.season.lv >= SEASON_LV ? 100 : Math.round(P.season.xp / need * 100)) + '%"></i></div></div>';
  h += '<div style="display:flex;gap:8px;margin:8px 0;"><button class="fz8B g" onclick="FZ8C2.claimAll()">Забрать все доступные</button>'
    + (P.season.premium ? '<div class="fz8Chip">👑 Премиум активен: награды ×2</div>' : '<button class="fz8B y" onclick="FZ8C2.premium()">👑 Премиум-сезон за 💎120</button>') + '</div>';
  h += REWARDS.map(r => {
    const claimed = P.season.claimed.indexOf('r' + r.lv) >= 0;
    const avail = P.season.lv >= r.lv;
    return '<div class="fz8Row" style="border-color:' + (r.big ? '#ffd76a66' : '#ffffff14') + ';' + (avail && !claimed ? 'background:#00b8941a;' : '') + '"><div><div class="nm">Уровень ' + r.lv + (r.big ? ' ⭐' : '') + '</div><div class="sb">' + rewardText(r) + '</div></div>'
      + (claimed ? '<div class="vl">✅</div>' : '<button class="fz8B ' + (avail ? 'g' : '') + '" ' + (avail ? '' : 'disabled') + ' onclick="FZ8C2.claim(' + r.lv + ')">' + (avail ? 'Забрать' : 'закрыто') + '</button>') + '</div>';
  }).join('');
  h += '<div class="fz8Hint">Сезонный XP капает за всё: покупки, карточки, челленджи, доход и действия в городе. Уровни дают деньги, кристаллы, карточки и жетоны перков.</div>';
  cityModal2('🏵️ Сезонный пропуск', h, 580);
}
function panelPerks() {
  let h = '<div class="fz8Chip" style="margin-bottom:10px;">Жетоны перков: <b>' + P.tokens + '</b> · открыто перков: ' + P.perks.length + '/' + PERKS.length + '</div>';
  h += PERKS.map(k => {
    const own = hasPerk(k.id);
    const can = !own && P.tokens >= k.cost && k.req.every(r => hasPerk(r));
    return '<div class="fz8Row"><div><div class="nm">' + k.icon + ' ' + k.name + (own ? ' <span style="color:#7cffb2">✔</span>' : '') + '</div><div class="sb">' + k.desc + (k.req.length ? ' · требует: ' + k.req.join(', ') : '') + '</div></div>'
      + (own ? '<div class="vl">открыт</div>' : '<button class="fz8B ' + (can ? 'g' : '') + '" ' + (can ? '' : 'disabled') + ' onclick="FZ8C2.perk(\'' + k.id + '\')">' + k.cost + ' 🎟️</button>') + '</div>';
  }).join('');
  h += '<div class="fz8Hint">Жетоны дают за уровни сезонного пропуска и за главы сюжета-2. Перки работают постоянно и суммируются с предметами магазина.</div>';
  cityModal2('✨ Перки', h, 580);
}
function panelChallenges() {
  const blk = (list, title) => '<div class="fz8Chip" style="margin:10px 0 8px;">' + title + '</div>' + (list.length ? list.map(q => '<div class="fz8Row" style="display:block;"><div style="display:flex;justify-content:space-between;"><div><div class="nm">' + q.icon + ' ' + q.text + ' ' + q.need + '</div><div class="sb">Награда: $' + fmt(Math.round(q.reward * premiumMul())) + '</div></div><div class="vl">' + (q.done ? '✅' : q.prog + '/' + q.need) + '</div></div><div class="fz8Bar"><i style="width:' + clamp(q.prog / q.need * 100, 0, 100) + '%"></i></div></div>').join('') : '<div class="fz8Row"><div class="nm">Челленджи генерируются…</div></div>');
  let h = '<div class="fz8Chip" style="margin-bottom:8px;">Закрыто всего: ' + (P.chClosed || 0) + ' · премиум-множитель: ×' + premiumMul() + '</div>';
  h += blk(P.challenges.daily, '📌 ЕЖЕДНЕВНЫЕ (обновляются каждый день)');
  h += blk(P.challenges.weekly, '🗓️ НЕДЕЛЬНЫЕ (более крупные призы)');
  h += '<div style="display:flex;gap:8px;margin-top:10px;"><button class="fz8B" onclick="FZ8C2.roll()">Обновить (сброс)</button></div>';
  h += '<div class="fz8Hint">Прогресс считается автоматически по твоим действиям: доход, ящики, аттракционы, разговоры, подработки, рыбалка, события, арена и заезды.</div>';
  cityModal2('🎽 Челленджи', h, 580);
}
function panelStory2() {
  let h = '<div class="fz8Chip" style="margin-bottom:9px;">Главы v8.2: ' + P.chapters2.length + '/10 · за каждую главу деньги и жетон перка</div>';
  h += CHAPTERS2.map(c => {
    const ok = P.chapters2.indexOf(c.id) >= 0;
    const cur = !ok && P.chapters2.length === c.id - 11;
    return '<div class="fz8Row" style="display:block;' + (cur ? 'border-color:#7cffb2;' : '') + '"><div style="display:flex;justify-content:space-between;"><div><div class="nm">' + (ok ? '✅' : cur ? '▶' : '🔒') + ' Глава ' + c.id + ': ' + c.name + '</div><div class="sb">' + c.desc + '</div></div><div class="vl">$' + fmt(Math.round(c.reward * premiumMul())) + '</div></div></div>';
  }).join('');
  h += '<div class="fz8Hint">Сюжет-2 связывает все системы v8: карточки, сезонный пропуск, перки, челленджи, районы города и механики v7.</div>';
  cityModal2('📚 Сюжет v8.2 — главы 11-20', h, 580);
}
window.FZ8C2.setCat = setCat;
// ---------------- ДОК ----------------
[['shop', '🛍️', 'Магазин предметов'], ['cards', '🃏', 'Коллекция карточек'], ['season', '🏵️', 'Сезонный пропуск'],
 ['perks', '✨', 'Перки'], ['challenges', '🎽', 'Челленджи'], ['story2', '📚', 'Сюжет 11-20']].forEach(([id, icon, name]) => {
  if (G('FZ8_addDock')) G('FZ8_addDock')({ id: id, icon: icon, name: name });
});
window.FZ8L_EXT = window.FZ8L_EXT || {};
[['shop', panelShop], ['cards', panelCards], ['season', panelSeason], ['perks', panelPerks], ['challenges', panelChallenges], ['story2', panelStory2]].forEach(([id, fn]) => { window.FZ8L_EXT[id] = () => { openPanelC(id); return '<div class="fz8Hint">Открываю раздел…</div>'; }; });
// ---------------- ХУК ОБНОВЛЕНИЯ ----------------
window.FZ8C2_update = function (delta) { try { updateContent(Math.min(delta || 0.016, 0.12)); } catch (e) { if (!window._fz8C2Err) { window._fz8C2Err = 1; try { console.warn('[fz8content]', e); } catch (x) {} } } };
// ---------------- ИНИЦИАЛИЗАЦИЯ ----------------
loadP();
rollChallenges();
syncPerks(); syncLifeItems();
setTimeout(() => {
  try {
    if (!P.seen) {
      P.seen = true; saveP(true);
      setTimeout(() => {
        notify('🛍️ v8.2: открылся магазин предметов, коллекция карточек, сезонный пропуск, перки и челленджи. Док 🎮 → 🛍️ 🃏 🏵️ ✨ 🎽 📚');
        banner('🛍️ НОВЫЙ ПРОГРЕСС v8.2', '30 предметов · 30 карточек · 30 уровней сезона · 12 перков · челленджи');
      }, 15000);
    }
  } catch (e) {}
}, 5200);
})();
