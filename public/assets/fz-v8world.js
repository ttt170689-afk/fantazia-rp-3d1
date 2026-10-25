/* ============================================================
   FANTAZIA RP · v8.0 «SUPER» — МОДУЛЬ 3: ГОРОД, СОБЫТИЯ, КОНТЕНТ
   Городские события · фракции · диалоги · мини-игры · сюжет v8
   Городской транспорт · лотерея · достижения v8
   ============================================================ */
(function () {
'use strict';
const SKEY = 'fz8_world';
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
function addCoins(v) { try { if (G('FZ8H') && G('FZ8H').addCoins) G('FZ8H').addCoins(v); } catch (e) {} }
function xp(k, v) { try { if (G('FZ8L') && G('FZ8L').xp) G('FZ8L').xp(k, v); } catch (e) {} }
function fx(n, a, b) { try { const F = G('FZFX'); if (F && typeof F[n] === 'function') F[n](a, b); } catch (e) {} }
function pp() { try { return G('localPlayer').mesh.position; } catch (e) { return { x: 0, y: 0, z: 0 }; } }
function LS() { return (G('FZ8L') && G('FZ8L').S) ? G('FZ8L').S : null; }
function lifeSave() { try { if (G('FZ8L') && G('FZ8L').save) G('FZ8L').save(true); } catch (e) {} }

// ---------------- СОСТОЯНИЕ ----------------
const DEF = {
  v: 8,
  rep: { corp: 0, street: 0, police: 0, space: 0 },
  repXp: { corp: 0, street: 0, police: 0, space: 0 },
  ach: [], lottery: 0, lotWins: 0, lotSpent: 0,
  chapters: [], talkCount: 0, fishCount: 0, targetScore: 0, snakeBest: 0, arenaWaves: 0,
  eventLog: [], busT: 0, tickets: 0, news: '', rumor: 0, season: '',
};
let W = JSON.parse(JSON.stringify(DEF));
function loadW() {
  try {
    const raw = localStorage.getItem(SKEY);
    if (raw) {
      const o = JSON.parse(raw);
      W = Object.assign(JSON.parse(JSON.stringify(DEF)), o);
      W.rep = Object.assign({ corp: 0, street: 0, police: 0, space: 0 }, o.rep || {});
      W.repXp = Object.assign({ corp: 0, street: 0, police: 0, space: 0 }, o.repXp || {});
      if (!Array.isArray(W.ach)) W.ach = [];
      if (!Array.isArray(W.chapters)) W.chapters = [];
      if (!Array.isArray(W.eventLog)) W.eventLog = [];
    }
  } catch (e) {}
}
let saveT = 0;
function saveW(force) {
  const n = performance.now();
  if (!force && n - saveT < 1500) return;
  saveT = n;
  try { localStorage.setItem(SKEY, JSON.stringify(W)); } catch (e) {}
}

// ---------------- ФРАКЦИИ ----------------
const FACTIONS = {
  corp:   { name: 'Корпорация FZ', icon: '🏢', color: '#4a9dff', desc: 'Бизнес, серверы и биржа. Ранг даёт скидки в бизнес-центре и доход.' },
  street: { name: 'Улица',         icon: '🧢', color: '#ff6b6b', desc: 'Районы, тёмные дела. Ранг снижает розыск и цены у торговцев.' },
  police: { name: 'Полиция',       icon: '👮', color: '#74b9ff', desc: 'Порядок. Ранг уменьшает штрафы и учит находить ящики.' },
  space:  { name: 'Космофлот',     icon: '🚀', color: '#a29bfe', desc: 'Колонизация и майнинг. Ранг повышает добычу ₿.' },
};
const RANKS = ['Новичок', 'Знакомый', 'Свой человек', 'Авторитет', 'Правая рука', 'Легенда'];
function repNeed(lv) { return Math.round(120 * Math.pow(1.7, lv)); }
function addRep(k, v) {
  if (!FACTIONS[k]) return;
  W.repXp[k] += v;
  let up = 0;
  while (W.rep[k] < 5 && W.repXp[k] >= repNeed(W.rep[k])) {
    W.repXp[k] -= repNeed(W.rep[k]); W.rep[k]++; up++;
  }
  if (up) {
    notify(FACTIONS[k].icon + ' ' + FACTIONS[k].name + ': ранг ' + W.rep[k] + ' — «' + RANKS[W.rep[k]] + '»!', 'levelup');
    addMoney(1500 * W.rep[k]);
    banner(FACTIONS[k].icon + ' РЕПУТАЦИЯ: ' + FACTIONS[k].name + ' · ранг ' + W.rep[k]);
    fx('flash', 0.2, [0.6, 0.9, 1]);
    checkAchW('rep3');
    saveW(true);
  }
}
function repMul(k) { return 1 + W.rep[k] * 0.05; }

// ---------------- ГОРОДСКИЕ СОБЫТИЯ ----------------
const EVENTS = [
  { id: 'parade',  name: 'Парад FANTAZIA',  icon: '🎉', dur: 150, banner: 'Парад по центральной улице — весь город на ногах!', effect: 'Доход ×1.4, NPC чаще улыбаются', mult: 1.4, rep: 'street', spawn: 'parade' },
  { id: 'market',  name: 'Ночной рынок',    icon: '🏮', dur: 180, banner: 'Ночной рынок: скидки и редкие ресурсы у ящиков', effect: 'Ящики дают в 2 раза больше', mult: 1.2, rep: 'corp', spawn: 'lanterns' },
  { id: 'marathon',name: 'Городской марафон',icon: '🏃', dur: 140, banner: 'Марафон! Беги — за каждый круг платят', effect: 'XP скорости ×2', mult: 1.1, rep: 'police', spawn: 'flags' },
  { id: 'concert', name: 'Концерт на площади', icon: '🎤', dur: 160, banner: 'Концерт: свет, музыка, толпа!', effect: '+XP харизмы, неон ярче', mult: 1.25, rep: 'street', spawn: 'stage' },
  { id: 'drone',   name: 'Атака дронов',    icon: '🛸', dur: 120, banner: 'Неизвестные дроны над городом — сбей их за награду!', effect: 'Дроны в небе, награда за сбитие', mult: 1.0, rep: 'police', spawn: 'drones' },
  { id: 'auction', name: 'Аукцион техники', icon: '🔨', dur: 150, banner: 'Аукцион: техника по низким ценам', effect: 'Транспорт −25%', mult: 1.15, rep: 'corp', spawn: 'podium' },
  { id: 'festival',name: 'Фестиваль еды',   icon: '🍔', dur: 170, banner: 'Фестиваль еды: сытость восстанавливается сама', effect: 'Еда бесплатно', mult: 1.3, rep: 'street', spawn: 'booths' },
  { id: 'solar',   name: 'Солнечный пик',   icon: '☀️', dur: 130, banner: 'Пик солнца: солнечные панели дают вдвое', effect: 'Доход дома ×2', mult: 1.2, rep: 'space', spawn: 'rays' },
];
let curEvent = null, evCd = 120, evObj = null, evTick = 0;
function startEvent() { return false; } // City events are disabled, including manual API calls.
function endEvent() {
  if (!curEvent) return;
  notify(curEvent.icon + ' Событие завершено: ' + curEvent.name);
  curEvent = null; evCd = ri(210, 420);
  clearEventProps();
  fx('speedLines', 0);
}
function updateEvents() {} // No automatic events or resource awards.
function eventTickFx(dt) {
  if (!curEvent) return;
  evTick += dt;
  if (evTick < 1.2) return;
  evTick = 0;
  if (curEvent.id === 'festival') { try { const vit = G('FZ8L').S.vit; vit.food = clamp(vit.food + 6, 0, 100); vit.water = clamp(vit.water + 4, 0, 100); } catch (e) {} }
  if (curEvent.id === 'marathon') { xp('speed', 12); addMoney(120); }
  if (curEvent.id === 'concert') { xp('charm', 10); }
  if (curEvent.id === 'solar') { addMoney(400); }
  if (curEvent.id === 'drone') { if (Math.random() < 0.35) notify('🛸 Дрон в небе — сбей его ради награды!'); }
  if (curEvent.id === 'parade') { if (Math.random() < 0.4) { addMoney(260); notify('🎉 Парад: горожане бросают монетки +$260'); } }
  if (curEvent.id === 'market') { if (Math.random() < 0.4) { try { const r = G('FZ8L').S.res; const k = pick(Object.keys(r)); r[k] += 2; notify('🏮 Ночной рынок: +2 ресурса'); } catch (e) {} } }
  if (curEvent.id === 'auction' && Math.random() < 0.3) notify('🔨 Аукцион: техника дешевле на 25%');
}
function buildEventProps(kind) {
  try {
    const T = G('THREE'), sc = G('scene');
    if (!T || !sc) return;
    evObj = new T.Group();
    const p = pp();
    if (kind === 'lanterns' || kind === 'booths') {
      const col = kind === 'lanterns' ? 0xff5e57 : 0xffd76a;
      for (let i = 0; i < 16; i++) {
        const m = new T.Mesh(new T.SphereGeometry(0.34, 8, 6), new T.MeshBasicMaterial({ color: col }));
        m.position.set(p.x + Math.sin(i * 0.9) * 30, 3.4, p.z + Math.cos(i * 0.9) * 30);
        evObj.add(m);
      }
    } else if (kind === 'stage') {
      const st = new T.Mesh(new T.BoxGeometry(12, 1.2, 8), new T.MeshLambertMaterial({ color: 0x24203a }));
      st.position.set(p.x + 18, 0.6, p.z + 18); evObj.add(st);
      for (let i = 0; i < 6; i++) {
        const L = new T.Mesh(new T.ConeGeometry(0.6, 2.2, 8), new T.MeshBasicMaterial({ color: [0xff3b81, 0x00e5ff, 0xffd76a][i % 3] }));
        L.position.set(p.x + 13 + i * 2, 2.2, p.z + 14); L.rotation.x = 0.5; evObj.add(L);
      }
    } else if (kind === 'drones') {
      for (let i = 0; i < 5; i++) {
        const d = new T.Mesh(new T.BoxGeometry(0.9, 0.34, 0.9), new T.MeshLambertMaterial({ color: 0x1b2233 }));
        d.position.set(p.x + (i - 2) * 14, 9 + i, p.z + (i % 2 ? 16 : -16));
        d.userData.ev = 'drone'; evObj.add(d);
      }
    } else if (kind === 'flags' || kind === 'podium' || kind === 'rays' || kind === 'parade') {
      for (let i = 0; i < 14; i++) {
        const f = new T.Mesh(new T.PlaneGeometry(1.6, 1.0), new T.MeshBasicMaterial({ color: [0x7cffb2, 0xffd76a, 0xff6b6b, 0x4a9dff][i % 4], side: T.DoubleSide }));
        f.position.set(p.x + (i - 7) * 6, 3.6, p.z + (i % 2 ? 12 : -12)); evObj.add(f);
      }
    }
    sc.add(evObj);
  } catch (e) {}
}
function clearEventProps() { try { if (evObj) { G('scene').remove(evObj); evObj = null; } } catch (e) {} }
function eventMult() { return curEvent ? (curEvent.mult || 1) : 1; }

// ---------------- ДИАЛОГИ NPC ----------------
const DIALOGS = {
  shopper:  ['Слышал про ночной рынок? Говорят, там можно найти золото в ящиках.', 'Не подскажешь, где тут кофе? Второй день не сплю.', 'Город растёт: скоро тут будет второй космодром, зуб даю.', 'Ты видел дроны в небе? Полиция следит за всеми.', 'Мне бы машину… но цены — космос.', 'Фестиваль еды — лучшее, что случалось с этим городом.', 'Работаю на заводе, а мечтаю о своём бизнесе.', 'Если найдёшь ящик — не забудь поделиться, ага.'],
  merchant: ['Свежий товар! Не проходи мимо.', 'У меня лучшие цены в квартале, клянусь.', 'Псс, есть кое-что редкое… но не здесь.', 'Скидка за наличные, друг!', 'Мой бизнес вырос на 40% за месяц, представляешь?', 'Слышал, что курьеры неплохо зарабатывают.', 'Не бери кредит — бери у меня. Шутка. Или нет.'],
  worker:   ['Смена закончится — пойду в спортзал.', 'Начальник опять требует переработку…', 'Серверные стойки греются, нужен новый кулер.', 'Хочешь подработку? Спроси менеджера в бизнес-центре.', 'Я коплю на пентхаус. Лет через двадцать куплю.'],
  tourist:  ['Вау! Тут реально красивый город.', 'Как найти смотровую площадку?', 'Мы приехали на парад — такое не каждый день увидишь.', 'Слышал, в космос можно слетать? Серьёзно?'],
  default:  ['Привет!', 'Хорошего дня!', 'Как дела в Фантазии?', 'Береги себя, тут бывает опасно.'],
};
const TALK_BONUS = [
  { t: 'money', v: [60, 240], text: '💵 Собеседник дал немного денег' },
  { t: 'rep_street', text: '🧢 Ты понравился местным (+репутация улицы)' },
  { t: 'rep_corp', text: '🏢 Полезный знакомый из корпорации (+репутация)' },
  { t: 'res', text: '🔩 Тебе дали ресурсы' },
  { t: 'xp_charm', text: '💬 Разговор прокачал харизму' },
  { t: 'nothing', text: '🙂 Просто приятный разговор' },
];
function nearestNpc() {
  try {
    const npcs = G('npcs'); if (!npcs || !npcs.length) return null;
    const p = pp(); let best = null, bd = 4.2;
    npcs.forEach(n => {
      if (!n || !n.mesh || n.isInterior) return;
      const d = Math.hypot(n.mesh.position.x - p.x, n.mesh.position.z - p.z);
      if (d < bd) { bd = d; best = n; }
    });
    return best;
  } catch (e) { return null; }
}
function talkToNpc(n) {
  const role = (n && n.role) || 'default';
  const lines = DIALOGS[role] || DIALOGS.default;
  const line = pick(lines);
  W.talkCount++;
  let extra = '';
  const roll = Math.random();
  if (roll < 0.18) { const m = ri(60, 240); addMoney(m); extra = '<br><b style="color:#ffd76a">💵 +$' + m + '</b>'; }
  else if (roll < 0.34) { addRep(pick(['street', 'corp']), 14); extra = '<br><b style="color:#7cffb2">🤝 Репутация выросла</b>'; }
  else if (roll < 0.46) { try { const r = G('FZ8L').S.res; r[pick(Object.keys(r))] += 2; } catch (e) {} extra = '<br><b>🔩 +2 ресурса</b>'; }
  else if (roll < 0.6) { xp('charm', 26); extra = '<br><b style="color:#a29bfe">💬 +26 XP харизмы</b>'; }
  const who = ({ shopper: '🚶 Горожанин', merchant: '🧑‍💼 Торговец', worker: '👷 Рабочий', tourist: '🧳 Турист' })[role] || '🧑 Прохожий';
  notify(who + ': «' + line + '»' + extra.replace(/<br>/g, ' '));
  showDialog(who, line, extra);
  xp('charm', 8);
  if (W.talkCount >= 10) checkAchW('talker');
  saveW(true);
}
function showDialog(who, line, extra) {
  try {
    let d = $('fz8Dialog');
    if (!d) {
      d = document.createElement('div'); d.id = 'fz8Dialog';
      d.style.cssText = 'position:fixed;left:50%;bottom:12%;transform:translateX(-50%);z-index:6500;max-width:min(560px,92vw);background:rgba(6,4,16,.9);border:1.4px solid #6c5ce7aa;border-radius:14px;padding:12px 16px;color:#fff;font:14px Arial;box-shadow:0 8px 30px #0008;';
      document.body.appendChild(d);
    }
    d.innerHTML = '<div style="color:#7cffb2;font:bold 12px Arial;margin-bottom:4px;">' + who + '</div>' + line + extra;
    d.style.display = 'block';
    clearTimeout(d._t);
    d._t = setTimeout(() => { d.style.display = 'none'; }, 6200);
  } catch (e) {}
}
// интеракт «поговорить»
let talkInter = null;
function refreshTalkInter() {
  try {
    const T = G('THREE'), inter = G('interactables');
    if (!inter) return;
    const n = nearestNpc();
    const cur = n ? n.mesh.position : null;
    if (!cur) { if (talkInter) { const i = inter.indexOf(talkInter); if (i >= 0) inter.splice(i, 1); talkInter = null; } return; }
    if (!talkInter) {
      talkInter = { position: { x: cur.x, y: 0, z: cur.z }, type: 'fz8_talk', name: '💬 Поговорить с прохожим', range: 2.6, fz8: true, npc: n };
      inter.push(talkInter);
    } else {
      talkInter.position.x = cur.x; talkInter.position.z = cur.z; talkInter.npc = n;
    }
  } catch (e) {}
}
function removeTalkInter() {
  try { const inter = G('interactables'); if (talkInter && inter) { const i = inter.indexOf(talkInter); if (i >= 0) inter.splice(i, 1); } talkInter = null; } catch (e) {}
}

// ---------------- АЧИВКИ v8 ----------------
const ACHW = [
  { id: 'event1',   name: 'Не пропускаю движ', icon: '🎪', desc: 'Поучаствовать в городском событии', reward: 900 },
  { id: 'event5',   name: 'Тусовщик',          icon: '🎊', desc: 'Поучаствовать в 5 событиях', reward: 2600 },
  { id: 'rep3',     name: 'Уважаемый человек', icon: '🤝', desc: 'Получить ранг 3 у любой фракции', reward: 3000 },
  { id: 'talker',   name: 'Душа компании',     icon: '🗣️', desc: 'Поговорить с 10 горожанами', reward: 1200 },
  { id: 'fish5',    name: 'Рыбак',             icon: '🎣', desc: 'Поймать 5 рыб', reward: 1400 },
  { id: 'fish20',   name: 'Нептун',            icon: '🐟', desc: 'Поймать 20 рыб', reward: 4200 },
  { id: 'target',   name: 'Снайпер',           icon: '🎯', desc: 'Набрать 15 очков в тире', reward: 2200 },
  { id: 'snake',    name: 'Ретро-геймер',      icon: '🐍', desc: 'Набрать 10 очков в змейке', reward: 2200 },
  { id: 'arena3',   name: 'Гладиатор',         icon: '⚔️', desc: 'Продержаться 3 волны арены', reward: 3600 },
  { id: 'lot',      name: 'Счастливчик',       icon: '🎟️', desc: 'Выиграть в лотерею', reward: 1500 },
  { id: 'bus',      name: 'Пассажир',          icon: '🚌', desc: 'Прокатиться на городском автобусе', reward: 800 },
  { id: 'story8',   name: 'Новая глава',       icon: '📖', desc: 'Пройти 10 глав сюжета v8', reward: 9000 },
];
function hasAchW(id) { return W.ach.indexOf(id) >= 0; }
function checkAchW(id) {
  if (hasAchW(id)) return;
  const a = ACHW.find(x => x.id === id); if (!a) return;
  W.ach.push(id);
  addMoney(a.reward);
  notify('🏅 ' + a.icon + ' ' + a.name + ' (+$' + fmt(a.reward) + ')');
  banner('🏅 ДОСТИЖЕНИЕ v8: ' + a.name, a.desc + ' · +$' + fmt(a.reward));
  fx('flash', 0.22, [1, 0.9, 0.4]);
  saveW(true);
}

// ---------------- МИНИ-ИГРЫ ----------------
function mgModal(title, html, width) {
  let m = $('fz8Mg');
  if (!m) {
    m = document.createElement('div'); m.id = 'fz8Mg';
    m.style.cssText = 'position:fixed;inset:0;z-index:8400;background:rgba(4,2,12,.8);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;';
    m.onclick = (e) => { if (e.target === m) mgClose(); };
    document.body.appendChild(m);
  }
  m.innerHTML = '<div style="width:min(' + (width || 520) + 'px,96vw);max-height:90vh;overflow:auto;background:linear-gradient(165deg,#151232,#090818);border:1.5px solid #6c5ce766;border-radius:18px;padding:16px;color:#fff;font:14px Arial;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><div style="font:bold 16px Arial;">' + title + '</div><button onclick="FZ8W.mgClose()" style="background:#ffffff14;color:#fff;border:1px solid #ffffff30;border-radius:10px;width:30px;height:30px;cursor:pointer;">✕</button></div>'
    + html + '</div>';
  m.style.display = 'flex';
  return m;
}
function mgClose() { stopAllGames(); const m = $('fz8Mg'); if (m) m.style.display = 'none'; }
let gameTimers = [];
function stopAllGames() { gameTimers.forEach(t => clearInterval(t)); gameTimers = []; }
function gameTimer(fn, ms) { const t = setInterval(fn, ms); gameTimers.push(t); return t; }

// --- РЫБАЛКА ---
let fish = null;
function openFishing() {
  fish = { pos: 0, dir: 1, zone: 30 + Math.random() * 40, caught: 0, tries: 0, active: true, time: 0 };
  const html = '<div style="color:#a29bfe;font:12px Arial;margin-bottom:8px;">Останавливай крючок в зелёной зоне! 3 попытки. Чем сложнее рыба, тем больше награда.</div>'
    + '<div style="height:26px;background:#ffffff12;border-radius:8px;position:relative;overflow:hidden;margin-bottom:10px;">'
    + '<div id="fz8FishZone" style="position:absolute;top:0;bottom:0;left:30%;width:22%;background:linear-gradient(180deg,#00b894,#00997a);"></div>'
    + '<div id="fz8FishHook" style="position:absolute;top:0;bottom:0;width:5px;background:#FFD76A;left:0%;"></div></div>'
    + '<div id="fz8FishInfo" style="font:13px Arial;margin-bottom:10px;">Поймано: 0 · Осталось попыток: 3</div>'
    + '<button id="fz8FishBtn" style="width:100%;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,#00b894,#00997a);color:#fff;font:bold 15px Arial;cursor:pointer;">🎣 Тянуть!</button>';
  mgModal('🎣 Рыбалка на набережной', html);
  $('fz8FishBtn').onclick = fishPull;
  gameTimer(() => {
    if (!fish || !fish.active) return;
    const so = $('fz8FishZone'), ho = $('fz8FishHook');
    if (!so || !ho) { stopAllGames(); return; }
    so.style.left = fish.zone + '%';
    ho.style.left = fish.pos + '%';
  }, 30);
  gameTimer(fishMove, 26);
  gameTimer(() => { if (fish) { fish.zone = 10 + Math.random() * 70; if (Math.random() < 0.3) fish.dir *= -1; } }, 1400);
}
function fishMove() {
  if (!fish || !fish.active) return;
  fish.pos += fish.dir * (1.6 + (fish.caught * 0.35));
  if (fish.pos <= 0) { fish.pos = 0; fish.dir = 1; }
  if (fish.pos >= 97) { fish.pos = 97; fish.dir = -1; }
}
function fishPull() {
  if (!fish || !fish.active) return;
  fish.tries--;
  const inZone = fish.pos >= fish.zone - 2 && fish.pos <= fish.zone + 22;
  const info = $('fz8FishInfo');
  if (inZone) {
    fish.caught++;
    const reward = ri(180, 520) + (curEvent && curEvent.id === 'festival' ? 300 : 0);
    addMoney(reward);
    xp('stamina', 20);
    W.fishCount++;
    const kinds = ['🐟 Окунь', '🐠 Карась', '🐡 Ёрш', '🦈 Редкая рыба', '🦑 Кальмар'];
    const kind = pick(kinds);
    notify('🎣 Улов: ' + kind + ' (+$' + fmt(reward) + ')');
    if (W.fishCount >= 5) checkAchW('fish5');
    if (W.fishCount >= 20) checkAchW('fish20');
    if (Math.random() < 0.08) { try { G('FZ8L').S.res.gold += 1; notify('🥇 В сетке блеснуло золото: +1 золото'); } catch (e) {} }
  } else {
    notify('💦 Сорвалась!', 'warn');
  }
  if (info) info.textContent = 'Поймано: ' + fish.caught + ' · Осталось попыток: ' + fish.tries;
  saveW(true);
  if (fish.tries <= 0) {
    fish.active = false;
    stopAllGames();
    setTimeout(() => { mgClose(); notify('🎣 Рыбалка окончена. Поймано: ' + fish.caught); fish = null; }, 500);
  }
}

// --- ТИР ---
let tgt = null;
function openTarget() {
  tgt = { shots: 0, hits: 0, active: true, t: 0, target: ri(1, 5) };
  const cells = [1, 2, 3, 4, 5].map(i => '<div data-i="' + i + '" class="fz8Tgt" style="height:64px;border-radius:12px;background:#ffffff12;border:1.5px solid #ffffff1e;display:flex;align-items:center;justify-content:center;font:22px Arial;cursor:pointer;">🎯</div>').join('');
  mgModal('🎯 Тир', '<div style="color:#a29bfe;font:12px Arial;margin-bottom:8px;">Кликай по мишени, где загорится 🎯. 12 попыток. За 15 попаданий — достижение и денежный приз.</div>'
    + '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:10px;">' + cells + '</div>'
    + '<div id="fz8TgtInfo" style="font:13px Arial;">Попыток: 0/12 · Попаданий: 0</div>');
  document.querySelectorAll('.fz8Tgt').forEach(c => {
    c.onclick = () => {
      if (!tgt || !tgt.active) return;
      tgt.shots++;
      if (Number(c.dataset.i) === tgt.target) {
        tgt.hits++; addMoney(60); xp('charm', 6);
        c.style.background = '#00b89455';
        setTimeout(() => { c.style.background = '#ffffff12'; }, 120);
      } else {
        c.style.background = '#e8439355';
        setTimeout(() => { c.style.background = '#ffffff12'; }, 120);
      }
      if (tgt.hits >= 15) checkAchW('target');
      const info = $('fz8TgtInfo'); if (info) info.textContent = 'Попыток: ' + tgt.shots + '/12 · Попаданий: ' + tgt.hits + '/15';
      if (tgt.shots >= 12) endTarget();
    };
  });
  gameTimer(() => { if (tgt && tgt.active) tgt.target = ri(1, 5); }, 850);
}
function endTarget() {
  if (!tgt) return;
  tgt.active = false; stopAllGames();
  tgt.target = 0;
  const prize = tgt.hits * 220;
  addMoney(prize);
  if (tgt.hits > (G('FZ8L').S.targetBest || 0)) { G('FZ8L').S.targetBest = tgt.hits; }
  W.targetScore = Math.max(W.targetScore, tgt.hits);
  notify('🎯 Тир: ' + tgt.hits + '/12 попаданий · приз $' + fmt(prize));
  banner('🎯 ТИР: ' + tgt.hits + '/12', 'Награда $' + fmt(prize));
  saveW(true);
  setTimeout(() => { mgClose(); tgt = null; }, 900);
}

// --- ЗМЕЙКА ---
let snake = null;
function openSnake() {
  snake = { cells: [], dir: [1, 0], step: 0, speed: 340, score: 0, active: true, cvs: null };
  const html = '<div style="color:#a29bfe;font:12px Arial;margin-bottom:8px;">Управление: стрелки на экране или W A S D. Собирай 💎 — каждая даёт деньги.</div>'
    + '<canvas id="fz8Snake" width="360" height="360" style="width:100%;max-width:360px;display:block;margin:0 auto;background:#0b0a18;border-radius:14px;border:1.5px solid #6c5ce766;"></canvas>'
    + '<div id="fz8SnakeInfo" style="font:13px Arial;margin-top:8px;text-align:center;">Очков: 0 · Рекорд: ' + (G('FZ8L').S.snakeBest || 0) + '</div>'
    + '<div style="display:grid;grid-template-columns:repeat(3,52px);gap:6px;justify-content:center;margin-top:10px;">'
    + '<div></div><button class="fz8B" onclick="FZ8W.snakeDir(0,-1)">↑</button><div></div>'
    + '<button class="fz8B" onclick="FZ8W.snakeDir(-1,0)">←</button><button class="fz8B" onclick="FZ8W.snakeDir(0,1)">↓</button><button class="fz8B" onclick="FZ8W.snakeDir(1,0)">→</button></div>';
  mgModal('🐍 Змейка FZ', html);
  snake.cvs = $('fz8Snake').getContext('2d');
  snake.cells = [[5, 5], [4, 5], [3, 5]];
  snake.food = [8, 5];
  gameTimer(snakeStep, 180);
  drawSnake();
}
function snakeDir(x, y) { if (snake && (snake.dir[0] !== -x || snake.dir[1] !== -y)) snake.dir = [x, y]; }
function snakeStep() {
  if (!snake || !snake.active) return;
  const h = snake.cells[0];
  const nx = h[0] + snake.dir[0], ny = h[1] + snake.dir[1];
  if (nx < 0 || ny < 0 || nx > 17 || ny > 17 || snake.cells.some(c => c[0] === nx && c[1] === ny)) {
    snake.active = false; stopAllGames();
    const best = Math.max(G('FZ8L').S.snakeBest || 0, snake.score);
    G('FZ8L').S.snakeBest = best;
    if (snake.score >= 10) checkAchW('snake');
    notify('🐍 Змейка: ' + snake.score + ' очков. Рекорд: ' + best);
    setTimeout(() => { mgClose(); snake = null; }, 600);
    return;
  }
  snake.cells.unshift([nx, ny]);
  if (nx === snake.food[0] && ny === snake.food[1]) {
    snake.score++;
    addMoney(140); xp('hack', 8);
    snake.food = [ri(0, 17), ri(0, 17)];
    const info = $('fz8SnakeInfo'); if (info) info.textContent = 'Очков: ' + snake.score + ' · Рекорд: ' + Math.max(G('FZ8L').S.snakeBest || 0, snake.score);
  } else snake.cells.pop();
  drawSnake();
}
function drawSnake() {
  if (!snake || !snake.cvs) return;
  const c = snake.cvs;
  c.fillStyle = '#0b0a18'; c.fillRect(0, 0, 360, 360);
  c.strokeStyle = '#ffffff10';
  for (let i = 0; i <= 18; i++) { c.beginPath(); c.moveTo(i * 20, 0); c.lineTo(i * 20, 360); c.moveTo(0, i * 20); c.lineTo(360, i * 20); c.stroke(); }
  c.fillStyle = '#7cffb2';
  snake.cells.forEach((p, i) => { c.fillStyle = i === 0 ? '#ffd76a' : '#7cffb2'; c.fillRect(p[0] * 20 + 2, p[1] * 20 + 2, 16, 16); });
  c.fillStyle = '#e84393';
  c.fillRect(snake.food[0] * 20 + 4, snake.food[1] * 20 + 4, 12, 12);
}
// клавиши для змейки
try {
  window.addEventListener('keydown', (e) => {
    if (!snake || !snake.active) return;
    const m = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] }[e.code];
    if (m) { e.preventDefault(); snakeDir(m[0], m[1]); }
  });
} catch (e) {}

// --- АРЕНА ---
let arena = null;
function openArena() {
  arena = { wave: 0, hp: 100, ehp: 0, emax: 0, active: false, hits: 0 };
  renderArena();
}
function renderArena() {
  const a = arena; if (!a) return;
  const html = '<div style="color:#a29bfe;font:12px Arial;margin-bottom:8px;">Волны врагов: атакуй вовремя! Каждая волна сильнее, награда растёт. Проигрыш — потеря 15 HP.</div>'
    + '<div style="background:#ffffff10;border-radius:12px;padding:12px;margin-bottom:10px;">'
    + '<div style="display:flex;justify-content:space-between;font:13px Arial;margin-bottom:6px;"><span>Волна ' + a.wave + ' · враг: ' + Math.max(0, Math.round(a.ehp)) + ' HP</span><span>Ты: ' + Math.round(a.hp) + ' HP</span></div>'
    + '<div style="height:10px;border-radius:6px;background:#00000066;overflow:hidden;margin-bottom:5px;"><i style="display:block;height:100%;width:' + (a.emax ? clamp(a.ehp / a.emax * 100, 0, 100) : 0) + '%;background:linear-gradient(90deg,#e84393,#ff6b6b);"></i></div>'
    + '<div style="height:10px;border-radius:6px;background:#00000066;overflow:hidden;"><i style="display:block;height:100%;width:' + clamp(a.hp, 0, 100) + '%;background:linear-gradient(90deg,#00b894,#7cffb2);"></i></div></div>'
    + '<div style="display:flex;gap:8px;">'
    + '<button class="fz8B g" onclick="FZ8W.arenaHit()" style="flex:2;">⚔️ Атака (усиль урон в такт)</button>'
    + '<button class="fz8B y" onclick="FZ8W.arenaHeal()" style="flex:1;' + (money() >= 400 ? '' : 'opacity:.5;') + '">🩹 Лечение $400</button></div>'
    + '<div style="color:#7f8fa6;font:11px Arial;margin-top:8px;">Совет: атакуй, пока шкала врага мигает — тогда урон двойной. Каждая третья волна — босс.</div>';
  mgModal('⚔️ Арена боёв', html, 560);
}
function arenaStart() {
  const a = arena; if (!a) return;
  a.active = true;
  a.wave++;
  a.emax = 40 + a.wave * 26 + (a.wave % 3 === 0 ? 90 : 0);
  a.ehp = a.emax;
  a.hits = 0;
  if (a.wave > 3) checkAchW('arena3');
  if (a.wave > W.arenaWaves) W.arenaWaves = a.wave;
  renderArena();
  if (!gameTimers.length) gameTimer(arenaTick, 1600);
}
function arenaTick() {
  const a = arena;
  if (!a || !a.active) { stopAllGames(); return; }
  const dmg = 6 + a.wave * 2 + (Math.random() < 0.3 ? 8 : 0);
  a.hp -= dmg;
  if (a.hp <= 0) { arenaLose(); return; }
  renderArena();
}
function arenaHit() {
  const a = arena;
  if (!a) return;
  if (!a.active) { arenaStart(); return; }
  const power = 1 + (G('FZ8L') ? (G('FZ8L').S.skills.power - 1) * 0.07 : 0);
  const crit = Math.random() < 0.22;
  let dmg = ri(9, 17) * power * (crit ? 2 : 1);
  if (curEvent && curEvent.id === 'arena') dmg *= 1.4;
  a.ehp -= dmg; a.hits++;
  fx('shake', 6);
  if (crit) notify('💥 Критический удар −' + Math.round(dmg));
  if (a.ehp <= 0) {
    const prize = 500 + a.wave * 420;
    addMoney(prize); xp('power', 40 + a.wave * 12);
    addRep('street', 18);
    notify('⚔️ Волна ' + a.wave + ' пройдена! +$' + fmt(prize));
    banner('⚔️ АРЕНА: волна ' + a.wave, 'Награда $' + fmt(prize));
    saveW(true);
    setTimeout(() => { if (arena) { arena.active = false; arenaStart(); } }, 500);
  } else renderArena();
}
function arenaHeal() {
  const a = arena; if (!a) return;
  if (money() < 400) { notify('❌ Нужно $400', 'warn'); return; }
  addMoney(-400); a.hp = clamp(a.hp + 35, 0, 100);
  notify('🩹 +35 HP');
  renderArena();
}
function arenaLose() {
  const a = arena; if (!a) return;
  a.active = false; stopAllGames();
  try { G('localPlayer').health = Math.max(5, (G('localPlayer').health || 100) - 15); if (G('updateHealthBar')) G('updateHealthBar')(); } catch (e) {}
  notify('💀 Ты проиграл арену на волне ' + a.wave + '. Отдыхай и возвращайся!', 'warn');
  fx('damage');
  saveW(true);
  setTimeout(() => { mgClose(); arena = null; }, 800);
}

// ---------------- ГОРОДСКОЙ АВТОБУС ----------------
const BUS_ROUTE = [[-60, -60], [60, -60], [60, 60], [-60, 60]];
let busMesh = null, busIdx = 0, busProgress = 0, busRide = null;
function buildBus() {
  try {
    const T = G('THREE'), sc = G('scene');
    if (!T || !sc || busMesh) return;
    const g = new T.Group();
    const body = new T.Mesh(new T.BoxGeometry(2.4, 2.2, 7.4), new T.MeshLambertMaterial({ color: 0x2f8fd8 }));
    body.position.y = 1.5; g.add(body);
    const win = new T.Mesh(new T.BoxGeometry(2.5, 0.8, 5.6), new T.MeshLambertMaterial({ color: 0x9fd8ff }));
    win.position.y = 2.1; g.add(win);
    [[-1, 2.4], [1, 2.4], [-1, -2.4], [1, -2.4]].forEach(([sx, wz]) => {
      const w = new T.Mesh(new T.CylinderGeometry(0.46, 0.46, 0.3, 10), new T.MeshLambertMaterial({ color: 0x14161a }));
      w.rotation.z = Math.PI / 2; w.position.set(sx * 1.2, 0.46, wz); g.add(w);
    });
    const sign = new T.Mesh(new T.PlaneGeometry(2.2, 0.5), new T.MeshBasicMaterial({ color: 0xffd76a }));
    sign.position.set(0, 2.7, 3.72); g.add(sign);
    g.position.set(BUS_ROUTE[0][0], 0, BUS_ROUTE[0][1]);
    sc.add(g); busMesh = g;
    // остановки
    BUS_ROUTE.forEach(([x, z], i) => {
      const pole = new T.Mesh(new T.CylinderGeometry(0.11, 0.11, 3.4, 8), new T.MeshLambertMaterial({ color: 0x9aa2ad }));
      pole.position.set(x + 2.6, 1.7, z); sc.add(pole);
      const plate = new T.Mesh(new T.PlaneGeometry(1.6, 0.6), new T.MeshBasicMaterial({ color: 0x2f8fd8, side: T.DoubleSide }));
      plate.position.set(x + 2.6, 3.2, z); sc.add(plate);
      try {
        G('interactables').push({ position: { x: x + 2.6, y: 0, z: z }, type: 'fz8_bus', name: '🚌 Городская остановка (проезд $50)', range: 3.2, fz8: true, stop: i });
        G('streetColliders').push({ x: x + 2.6, z: z, r: 0.6 });
      } catch (e) {}
    });
  } catch (e) {}
}
function updateBus(dt) {
  if (!busMesh) return;
  const a = BUS_ROUTE[busIdx], b = BUS_ROUTE[(busIdx + 1) % BUS_ROUTE.length];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  busProgress += dt * 6 / len;
  if (busProgress >= 1) { busProgress = 0; busIdx = (busIdx + 1) % BUS_ROUTE.length; }
  const x = a[0] + (b[0] - a[0]) * busProgress, z = a[1] + (b[1] - a[1]) * busProgress;
  try {
    busMesh.position.set(x, 0, z);
    busMesh.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]);
  } catch (e) {}
  if (busRide) {
    busRide.t += dt;
    try { busMesh.position.set(busRide.x, 0, busRide.z); } catch (e) {}
    if (busRide.t > 2.2) {
      const stop = BUS_ROUTE[(busIdx + 1) % BUS_ROUTE.length];
      try { G('localPlayer').mesh.position.set(stop[0] + 2.6, 1, stop[1]); } catch (e) {}
      notify('🚌 Ты приехал на остановку №' + (((busIdx + 1) % BUS_ROUTE.length) + 1));
      checkAchW('bus');
      addRep('police', 6);
      busRide = null;
      fx('flash', 0.2, [0.6, 0.8, 1]);
    }
  }
}
function rideBus(stop) {
  if (money() < 50) { notify('❌ Проезд стоит $50', 'warn'); return; }
  if (busRide) { notify('⏳ Ты уже в автобусе', 'warn'); return; }
  addMoney(-50);
  W.tickets++;
  const target = BUS_ROUTE[(busIdx + 1) % BUS_ROUTE.length];
  busRide = { t: 0, x: target[0] + 2.6, z: target[1] };
  notify('🚌 Сел в автобус — едем к следующей остановке…');
  fx('letterbox', true);
  setTimeout(() => fx('letterbox', false), 2000);
  saveW(true);
}

// ---------------- ЛОТЕРЕЯ ----------------
const LOT_PRIZES = [
  { w: 34, t: 'Пусто', v: 0 },
  { w: 26, t: '$300', v: 300 },
  { w: 16, t: '$900', v: 900 },
  { w: 10, t: '$2500', v: 2500 },
  { w: 7,  t: '💎 3 кристалла', gems: 3 },
  { w: 4,  t: '$9000', v: 9000 },
  { w: 2,  t: '💎 15 кристаллов', gems: 15 },
  { w: 1,  t: '💰 ДЖЕКПОТ $60000', v: 60000 },
];
function playLottery() {
  if (!lotteryAnim() && money() < 250) { notify('❌ Билет стоит $250', 'warn'); return; }
  addMoney(-250);
  W.lotSpent += 250;
  W.lottery++;
  const total = LOT_PRIZES.reduce((a, p) => a + p.w, 0);
  let r = Math.random() * total, prize = LOT_PRIZES[0];
  for (const p of LOT_PRIZES) { r -= p.w; if (r <= 0) { prize = p; break; } }
  setTimeout(() => {
    if (prize.v) { addMoney(prize.v * (lifeAchBonus())); W.lotWins++; }
    if (prize.gems) { addCoins(prize.gems); W.lotWins++; }
    if (prize.t.indexOf('ДЖЕКПОТ') >= 0) { checkAchW('lot'); banner('💰 ДЖЕКПОТ!', 'Ты сорвал $60 000 в лотерее FANTAZIA!'); fx('burst', pp().x, 1.5, pp().z, 0xffd76a, 26); }
    else if (prize.v >= 900) { checkAchW('lot'); banner('🎟️ Крупный выигрыш', prize.t); }
    notify('🎟️ Билет: ' + prize.t);
    if (prize.v || prize.gems) xp('charm', 20);
    saveW(true);
    updateLotteryPanel();
  }, 900);
}
function lifeAchBonus() { return 1; }
function lotteryAnim() { return false; }
function updateLotteryPanel() {
  const el = $('fz8LotInfo');
  if (el) el.innerHTML = 'Билетов куплено: <b>' + W.lottery + '</b> · выигрышей: <b>' + W.lotWins + '</b> · потрачено: <b>$' + fmt(W.lotSpent) + '</b>';
}

// ---------------- СЮЖЕТ v8 ----------------
function fz7state() { try { const r = localStorage.getItem('fz7_state'); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
function lifeS() { return (G('FZ8L') && G('FZ8L').S) ? G('FZ8L').S : { stats: {}, skills: {}, ach: [] }; }
const CHAPTERS = [
  { id: 1, name: 'Новый день в Фантазии',    desc: 'Осмотрись: открой любой ящик 📦 и поговори с горожанином',      check: () => (lifeS().stats.loot || 0) >= 1 && W.talkCount >= 1, reward: 1500 },
  { id: 2, name: 'Первый доход',            desc: 'Накопи $25 000 или купи любой бизнес в бизнес-центре',        check: () => money() >= 25000 || !!(fz7state() && Object.keys(fz7state().biz || {}).length), reward: 3000 },
  { id: 3, name: 'Своя крыша',              desc: 'Купи жильё 🏠 и любое улучшение',                            check: () => lifeS().home > 0, reward: 4200 },
  { id: 4, name: 'Колёса',                  desc: 'Купи транспорт 🚗 и прокатись',                              check: () => (lifeS().car || 0) > 0, reward: 5400 },
  { id: 5, name: 'Репутация',               desc: 'Получи ранг 2 у любой фракции',                              check: () => Object.keys(W.rep).some(k => W.rep[k] >= 2), reward: 7000 },
  { id: 6, name: 'Скорость',                desc: 'Победи в гонке 🏁',                                          check: () => (lifeS().stats.races || 0) >= 1, reward: 9000 },
  { id: 7, name: 'Серверный магнат',        desc: 'Купи 3 сервера в датацентре FZ-CLOUD',                       check: () => !!(fz7state() && (fz7state().servers || 0) >= 3), reward: 12000 },
  { id: 8, name: 'Взгляд в небо',           desc: 'Основай первую колонию 🚀',                                  check: () => !!(fz7state() && Object.keys(fz7state().cols || {}).length), reward: 16000 },
  { id: 9, name: 'Легенда улиц',            desc: 'Собери 6 достижений v8 и поймай 5 рыб 🎣',                    check: () => W.ach.length >= 6 && W.fishCount >= 5, reward: 22000 },
  { id: 10, name: 'Хозяин города',          desc: 'Накопи $1 000 000 и получи ранг 4 у любой фракции',           check: () => money() >= 1000000 && Object.keys(W.rep).some(k => W.rep[k] >= 4), reward: 45000 },
];
function storyTick() {
  CHAPTERS.forEach(c => {
    if (W.chapters.indexOf(c.id) >= 0) return;
    let ok = false;
    try { ok = !!c.check(); } catch (e) { ok = false; }
    if (!ok) return;
    W.chapters.push(c.id);
    W.chapters.sort((a, b) => a - b);
    addMoney(c.reward);
    xp('charm', 60);
    banner('📖 ГЛАВА ' + c.id + ' ЗАВЕРШЕНА', c.name + ' · награда $' + fmt(c.reward));
    notify('📖 Глава ' + c.id + ' «' + c.name + '» пройдена! +$' + fmt(c.reward), 'levelup');
    fx('flash', 0.25, [0.8, 0.9, 1]);
    if (W.chapters.length >= 10) checkAchW('story8');
    saveW(true);
  });
}
function curChapter() { for (const c of CHAPTERS) if (W.chapters.indexOf(c.id) < 0) return c; return null; }

// ---------------- СЛУХИ И НОВОСТИ ----------------
const RUMORS = [
  'Жители заметили странные огни над космодромом…',
  'Бармен говорит, что в баре платят больше по вечерам.',
  'Курьеры жалуются на дроны-конкуренты.',
  'На площади готовят большой фестиваль.',
  'Кто-то скупает золото оптом — цена растёт.',
  'Полиция усилила патрулирование после серии краж.',
  'Синоптики обещают снег — запасайся теплом.',
  'В бизнес-центре открыли новый этаж.',
];
function updateRumor(dt) {
  W.rumor -= dt;
  if (W.rumor > 0) return;
  W.rumor = ri(40, 90);
  W.news = pick(RUMORS);
  try {
    if (typeof G('showWorldEventBanner') === 'function' && Math.random() < 0.4) banner('📰 ГОРОДСКИЕ НОВОСТИ', W.news);
    else notify('📰 ' + W.news);
  } catch (e) {}
}

// ---------------- ТОЧКИ АКТИВНОСТИ ----------------
const SPOTS = [
  { id: 'fish',    icon: '🎣', name: 'Рыбалка на набережной',  type: 'fz8_fish',   pref: [-40, 30],  color: 0x2f8fd8 },
  { id: 'target',  icon: '🎯', name: 'Тир «Меткий глаз»',      type: 'fz8_target', pref: [40, 30],   color: 0xe84393 },
  { id: 'arena',   icon: '⚔️', name: 'Арена боёв',             type: 'fz8_arena',  pref: [-40, -40], color: 0xb3366f },
  { id: 'lot',     icon: '🎟️', name: 'Лотерейный киоск',       type: 'fz8_lot',    pref: [40, -30],  color: 0xffd76a },
];
const spotRecs = [];
function spotFree(x, z) {
  try {
    if (G('buildings').some(b => b && b.bounds && x > b.bounds.minX - 3 && x < b.bounds.maxX + 3 && z > b.bounds.minZ - 3 && z < b.bounds.maxZ + 3)) return false;
    if (spotRecs.some(s => Math.hypot(s.x - x, s.z - z) < 20)) return false;
    if (G('streetColliders').some(c => Math.hypot(c.x - x, c.z - z) < 4)) return false;
    if (G('interactables').some(i => i.position && Math.hypot(i.position.x - x, i.position.z - z) < 4)) return false;
  } catch (e) { return false; }
  return true;
}
function placeSpot(sp) {
  try {
    const T = G('THREE'), sc = G('scene');
    if (!T || !sc) return;
    let pos = null;
    for (let ring = 0; ring < 12 && !pos; ring++) {
      for (let a = 0; a < 12; a++) {
        const ang = (a / 12) * Math.PI * 2;
        const r = 6 + ring * 7;
        const x = sp.pref[0] + Math.cos(ang) * r, z = sp.pref[1] + Math.sin(ang) * r;
        if (spotFree(x, z)) { pos = { x: x, z: z }; break; }
      }
    }
    if (!pos) { pos = { x: sp.pref[0], z: sp.pref[1] }; }
    const g = new T.Group();
    const base = new T.Mesh(new T.BoxGeometry(2.4, 0.5, 2.4), new T.MeshLambertMaterial({ color: 0x2a2f3d }));
    base.position.y = 0.25; g.add(base);
    const post = new T.Mesh(new T.CylinderGeometry(0.14, 0.14, 3.4, 8), new T.MeshLambertMaterial({ color: 0x9aa2ad }));
    post.position.y = 1.7; g.add(post);
    const board = new T.Mesh(new T.PlaneGeometry(2.2, 1.1), new T.MeshBasicMaterial({ color: sp.color, side: T.DoubleSide }));
    board.position.y = 3.1; g.add(board);
    const lamp = new T.Mesh(new T.SphereGeometry(0.2, 8, 6), new T.MeshBasicMaterial({ color: sp.color }));
    lamp.position.y = 3.9; g.add(lamp);
    g.position.set(pos.x, 0, pos.z);
    g.rotation.y = Math.random() * 6.28;
    sc.add(g);
    const rec = { id: sp.id, x: pos.x, z: pos.z, mesh: g, lamp: lamp, sp: sp };
    spotRecs.push(rec);
    G('interactables').push({ position: { x: pos.x, y: 0, z: pos.z }, type: sp.type, name: sp.icon + ' ' + sp.name, range: 3.0, fz8: true });
    G('streetColliders').push({ x: pos.x, z: pos.z, r: 1.4 });
    return rec;
  } catch (e) { return null; }
}
function buildSpots() {
  SPOTS.forEach(sp => { if (!spotRecs.some(r => r.id === sp.id)) placeSpot(sp); });
}

// ---------------- ИНТЕРАКТ ----------------
window.FZ8W_onInteract = function (inter) {
  if (!inter || !inter.type) return false;
  switch (inter.type) {
    case 'fz8_fish': openFishing(); return true;
    case 'fz8_target': openTarget(); return true;
    case 'fz8_arena': openArena(); return true;
    case 'fz8_lot': playLottery(); return true;
    case 'fz8_bus': rideBus(inter.stop || 0); return true;
    case 'fz8_talk': if (talkInter && talkInter.npc) { talkToNpc(talkInter.npc); return true; } return false;
    default: return false;
  }
};
// объединённый хук: ядро зовёт FZ8_onInteract из модуля 2
const prevFZ8Interact = window.FZ8_onInteract;
window.FZ8_onInteract = function (inter) {
  try { if (window.FZ8W_onInteract(inter)) return true; } catch (e) {}
  try { return prevFZ8Interact ? !!prevFZ8Interact(inter) : false; } catch (e) { return false; }
};

// ---------------- ПАНЕЛИ v8 ----------------
function panelEvents() {
  const e = curEvent;
  let h = '<div class="fz8Row" style="display:block;"><div class="nm">' + (e ? e.icon + ' СЕЙЧАС ИДЁТ: ' + e.name : '🕐 Спокойный город') + '</div><div class="sb">'
    + (e ? e.banner + '<br>Осталось ' + Math.ceil(e.dur - e.t) + ' с · ' + e.effect : 'Событие начнётся автоматически через ' + Math.ceil(evCd) + ' с. События дают бонусы к доходу, ресурсам и XP.')
    + '</div>' + (e ? '<div class="fz8Bar"><i style="width:' + clamp((1 - e.t / e.dur) * 100, 0, 100) + '%"></i></div>' : '') + '</div>';
  h += '<div class="fz8Chip" style="margin-bottom:9px;">Всего событий в истории: ' + W.eventLog.length + ' · прошло за сессию: ' + W.eventLog.filter(l => Date.now() - l.at < 3600000).length + '</div>';
  h += EVENTS.map(x => '<div class="fz8Row"><div><div class="nm">' + x.icon + ' ' + x.name + '</div><div class="sb">' + x.effect + ' · длительность ' + x.dur + 'с</div></div>' + (e && e.id === x.id ? '<div class="vl">идёт</div>' : '') + '</div>').join('');
  h += '<div class="fz8Hint">Хочешь событие прямо сейчас? Нажми кнопку — ускорит старт.</div>'
    + '<button class="fz8B g" onclick="FZ8W.forceEvent()">🎪 Запустить событие сейчас</button>';
  return h;
}
function panelFactions() {
  let h = '<div class="fz8Chip" style="margin-bottom:9px;">Репутация растёт от дел: бизнес, улица, порядок и космос. Каждый ранг даёт деньги и бонусы.</div>';
  h += Object.keys(FACTIONS).map(k => {
    const f = FACTIONS[k], lv = W.rep[k], need = repNeed(lv);
    const pct = lv >= 5 ? 100 : Math.round(W.repXp[k] / need * 100);
    return '<div class="fz8Row" style="display:block;"><div style="display:flex;justify-content:space-between;"><div><div class="nm">' + f.icon + ' ' + f.name + '</div><div class="sb">' + f.desc + '</div></div><div class="vl">' + lv + '/5 · ' + RANKS[lv] + '</div></div>'
      + '<div class="fz8Bar"><i style="width:' + pct + '%"></i></div><div class="sb" style="margin-top:3px;">' + fmt(W.repXp[k]) + ' / ' + (lv >= 5 ? '—' : fmt(need)) + ' очков · бонус ×' + repMul(k).toFixed(2) + '</div></div>';
  }).join('');
  h += '<div class="fz8Hint">Ускорить репутацию: общайся с людьми, побеждай на арене (улица), работай с бизнесом (корпорация), соблюдай закон (полиция), занимайся космосом.</div>';
  return h;
}
function panelGames() {
  return '<div class="fz8Grid" style="margin-bottom:10px;">'
    + '<div class="fz8Chip">🐍 Змейка: рекорд ' + (lifeS().snakeBest || 0) + '</div>'
    + '<div class="fz8Chip">🎯 Тир: лучший ' + (lifeS().targetBest || 0) + '/12</div>'
    + '<div class="fz8Chip">🎣 Рыбалка: ' + W.fishCount + ' рыб</div>'
    + '<div class="fz8Chip">⚔️ Арена: волна ' + W.arenaWaves + '</div>'
    + '<div class="fz8Chip">🎟️ Лотерея: ' + W.lottery + ' билетов</div></div>'
    + '<div class="fz8Row"><div><div class="nm">🐍 Змейка FZ</div><div class="sb">Ретро-аркада: ешь кристаллы, растёт хвост и счёт</div></div><button class="fz8B g" onclick="FZ8W.openSnake()">Играть</button></div>'
    + '<div class="fz8Row"><div><div class="nm">🎯 Тир</div><div class="sb">12 попыток, попадай по вспыхивающей цели — деньги за попадание</div></div><button class="fz8B g" onclick="FZ8W.openTarget()">Играть</button></div>'
    + '<div class="fz8Row"><div><div class="nm">🎣 Рыбалка</div><div class="sb">Останавливай крючок в зоне — редкие рыбы за деньги и золото</div></div><button class="fz8B g" onclick="FZ8W.openFishing()">Играть</button></div>'
    + '<div class="fz8Row"><div><div class="nm">⚔️ Арена боёв</div><div class="sb">Волны врагов, призы растут, каждая 3-я волна — босс</div></div><button class="fz8B g" onclick="FZ8W.openArena()">Войти</button></div>'
    + '<div class="fz8Row"><div><div class="nm">🎟️ Лотерея</div><div class="sb">Билет $250 · джекпот $60 000 <span id="fz8LotInfo"></span></div></div><button class="fz8B y" onclick="FZ8W.lottery()">Купить билет</button></div>'
    + '<div class="fz8Hint">Мини-игры можно открыть и в городе: подойди к павильонам 🎯🎣⚔️🎟️ и нажми E. Точки отмечены своими вывесками.</div>';
}
function panelStory() {
  const done = W.chapters.length;
  let h = '<div class="fz8Chip" style="margin-bottom:9px;">Главы v8: ' + done + '/10 · За каждую главу солидная награда. Прогресс проверяется автоматически.</div>';
  h += CHAPTERS.map(c => {
    const ok = W.chapters.indexOf(c.id) >= 0;
    const cur = curChapter() === c;
    return '<div class="fz8Row" style="display:block;' + (cur ? 'border-color:#7cffb2;' : '') + '"><div style="display:flex;justify-content:space-between;"><div><div class="nm">' + (ok ? '✅' : cur ? '▶' : '🔒') + ' Глава ' + c.id + ': ' + c.name + '</div><div class="sb">' + c.desc + '</div></div><div class="vl">$' + fmt(c.reward) + '</div></div></div>';
  }).join('');
  h += '<div class="fz8Hint">Главы связаны с механиками v7 и v8: бизнес, колонии, транспорт, репутация, мини-игры.</div>';
  return h;
}
function panelTransport() {
  let h = '<div class="fz8Row" style="display:block;"><div class="nm">🚌 Городской автобус</div><div class="sb">Кольцевой маршрут по 4 остановкам: [' + BUS_ROUTE.map((p, i) => '№' + (i + 1)).join(', ') + ']. Проезд $50 — быстро переехать в другой район.</div></div>';
  h += '<div class="fz8Chip">Куплено билетов: ' + W.tickets + ' · следующий автобус у остановки №' + ((busIdx % 4) + 1) + '</div>';
  h += '<div class="fz8Row"><div><div class="nm">📈 Текущее положение</div><div class="sb">Позиция автобуса обновляется в реальном времени, ищи синюю полосу с табло</div></div><button class="fz8B" onclick="FZ8W.busInfo()">Показать</button></div>';
  h += '<div class="fz8Hint">Автобус едет сам по маршруту. Подойди к остановке (синий столб) и нажми E — или выбери проезд здесь, если стоишь рядом.</div>';
  return h;
}
function busInfo() {
  const d = ['№1 (-60,-60)', '№2 (60,-60)', '№3 (60,60)', '№4 (-60,60)'];
  const p = pp();
  const nearest = BUS_ROUTE.map((b, i) => ({ i: i, d: Math.hypot(b[0] + 2.6 - p.x, b[1] - p.z) })).sort((a, b) => a.d - b.d)[0];
  notify('🚌 Ближайшая остановка: ' + d[nearest.i] + ' — ' + Math.round(nearest.d) + ' м. Автобус сейчас у ' + d[busIdx % 4]);
}
window.FZ8L_EXT = window.FZ8L_EXT || {};
window.FZ8L_EXT.events = panelEvents;
window.FZ8L_EXT.factions = panelFactions;
window.FZ8L_EXT.games = panelGames;
window.FZ8L_EXT.story = panelStory;
window.FZ8L_EXT.transport = panelTransport;
['events', 'factions', 'games', 'story', 'transport'].forEach((id, i) => {
  if (id === 'events') return;
  if (G('FZ8_addDock')) G('FZ8_addDock')({ id: id, icon: ['🎪', '🤝', '🎯', '📖', '🚌'][i], name: ['События города', 'Фракции', 'Мини-игры', 'Сюжет v8', 'Транспорт'][i] });
});

// ---------------- ОБНОВЛЕНИЕ ----------------
let spotT = 0, storyT = 0, talkT = 0, rumorT = 0;
function FZ8W_update(delta) {
  const dt = Math.min(delta || 0.016, 0.12);
  try {
    updateEvents(dt);
    updateBus(dt);
    spotT += dt; storyT += dt; talkT += dt; rumorT += dt;
    if (spotT > 1.5) { spotT = 0; if (typeof scene !== 'undefined' && G('buildings') && G('buildings').length > 4) buildSpots(); if (!busMesh) buildBus(); }
    if (storyT > 4) { storyT = 0; storyTick(); }
    if (talkT > 1.2) { talkT = 0; refreshTalkInter(); }
    if (rumorT > 1) { rumorT = 0; updateRumor(dt); }
    // анимация лампочек у павильонов
    spotRecs.forEach(r => { try { r.lamp.visible = Math.sin(performance.now() * 0.003 + r.x) > -0.3; } catch (e) {} });
    // бонус события к доходу — применяется в модуле 2 через eventMult
    if (curEvent && Math.random() < dt * 0.02) try { G('FZ8L').S.eventBonus = eventMult(); } catch (e) {}
    // сезонная погода
    const m = new Date().getMonth();
    const season = (m === 11 || m === 0 || m === 1) ? 'winter' : (m >= 8 && m <= 10) ? 'autumn' : (m >= 5 && m <= 7) ? 'summer' : 'spring';
    if (season !== W.season) {
      W.season = season;
      try { if (season === 'winter' && G('FZFX') && G('FZFX').snow) { window.FZ8F = window.FZ8F || {}; window.FZ8F.snow = true; } } catch (e) {}
      saveW(true);
    }
  } catch (e) { if (!window._fz8WErr) { window._fz8WErr = 1; try { console.warn('[fz8world]', e); } catch (x) {} } }
}
// ---------------- ЭКСПОРТ ----------------
window.FZ8W = {
  openFishing: openFishing, openTarget: openTarget, openSnake: openSnake, openArena: openArena,
  arenaHit: arenaHit, arenaHeal: arenaHeal, snakeDir: snakeDir, mgClose: mgClose,
  lottery: playLottery, forceEvent: () => { if (curEvent) endEvent(); evCd = 1; },
  events: () => curEvent, rep: () => W.rep, talk: talkToNpc, story: () => W.chapters, chapters: CHAPTERS,
  bus: rideBus, busInfo: busInfo, buildSpots: buildSpots, buildBus: buildBus, state: () => W,
  ach: () => W.ach, debug: {
    event: (id) => { const e = EVENTS.find(x => x.id === id); if (e) startEvent(e); },
    rep: (k, v) => addRep(k, v), money: (v) => addMoney(v), wipe: () => { W = JSON.parse(JSON.stringify(DEF)); saveW(true); notify('dev: сброс v8 world'); },
  },
};
window.FZ8W_update = FZ8W_update;
loadW();
setTimeout(() => {
  try {
    buildSpots();
    buildBus();
    if (!W.seen) {
      W.seen = true; saveW(true);
      setTimeout(() => {
        notify('🎪 v8.0 «SUPER»: в городе появились события, фракции, мини-игры, арена, рыбалка, тир, лотерея и автобус! Док слева 🎮 — кнопки 🎪 🤝 🎯 📖 🚌.');
        banner('🌆 ГОРОД v8', 'События 💥 Фракции 🤝 Мини-игры 🎯 Арена ⚔️ Сюжет из 10 глав 📖');
      }, 9000);
    }
    setTimeout(() => { try { G('FZ8_addDock')({ id: 'games', icon: '🎯', name: 'Мини-игры' }); } catch (e) {} }, 1200);
    saveW(true);
  } catch (e) {}
}, 3200);
})();
