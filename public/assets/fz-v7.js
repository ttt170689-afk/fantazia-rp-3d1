// ======================================================
// 🏢 FANTAZIA v7.0 «КОРПОРАЦИЯ»: бизнес-центр, датацентр, банк,
// космодром, колонизация планет, крипта-биржа, хакер-минигейм,
// курьерские заказы, дроны над городом, рекламный экран
// ======================================================
(function () {
'use strict';

const H = window.FZ7H || {};
const FZv5 = H.FZ || null;

// ---------------- КОНТЕНТ ----------------
const BIZ = [
  { id:'coffee', ico:'☕', name:'Кофейня-франшиза «Уют+»', base:45,   cost:600,   desc:'Кофе с собой и выпечка' },
  { id:'taxi',   ico:'🚕', name:'Таксопарк «Фантазия»',    base:95,   cost:1500,  desc:'Машины работают круглосуточно' },
  { id:'market', ico:'🛒', name:'Супермаркет «24 часа»',   base:185,  cost:3200,  desc:'Продукты и товары каждый день' },
  { id:'hotel',  ico:'🏨', name:'Отель «Grand Fantazia»',  base:340,  cost:6500,  desc:'Туристы, командировки, отзывы 5★' },
  { id:'plant',  ico:'🏭', name:'Завод «Химтек»',          base:620,  cost:12000, desc:'Промышленность и экспорт' },
];
const COLONIES = [
  { id:'moon',    ico:'🌕', name:'Луна',       money:3000,   btc:25,   inc:45,   btcInc:0.4, color:0xcfd6dd, desc:'Гелий-3 и первая база' },
  { id:'mars',    ico:'🔴', name:'Марс',       money:9000,   btc:80,   inc:130,  btcInc:0.9, color:0xe05a2b, desc:'Терраформ 3-й стадии' },
  { id:'europa',  ico:'🧊', name:'Европа',     money:24000,  btc:200,  inc:320,  btcInc:1.8, color:0x7fd8ff, desc:'Подлёдный океан' },
  { id:'titan',   ico:'🟠', name:'Титан',      money:60000,  btc:480,  inc:780,  btcInc:3.2, color:0xf0a03a, desc:'Метановая энергетика' },
  { id:'proxima', ico:'✨', name:'Проксима b',  money:150000, btc:1200, inc:1900, btcInc:6.5, color:0xb9a2ff, desc:'Первая звёздная колония' },
];
const QUESTS = [
  { id:'q_biz1', ico:'💼', name:'Купить первый бизнес',     rw:300,   btc:0,  hint:'Менеджер в бизнес-центре' },
  { id:'q_srv',  ico:'🖥️', name:'Довести до 4 серверов',    rw:800,   btc:2,  hint:'Датацентр FZ-CLOUD' },
  { id:'q_hack', ico:'💻', name:'Взломать терминал',        rw:600,   btc:5,  hint:'Терминал в офисе или датацентре' },
  { id:'q_btc',  ico:'₿',  name:'Продать ₿ на бирже',       rw:1500,  btc:0,  hint:'Банкомат → биржа' },
  { id:'q_col1', ico:'🌕', name:'Основать колонию на Луне', rw:2500,  btc:0,  hint:'Пульт миссий на космодроме' },
  { id:'q_biz3', ico:'🏙️', name:'Владеть 3 бизнесами',      rw:6000,  btc:0,  hint:'Покупай и развивай' },
  { id:'q_col3', ico:'🚀', name:'Колонизировать 3 мира',    rw:20000, btc:40, hint:'Луна · Марс · Европа' },
];
const IS_TYPE = { biz_office:1, biz_server:1, biz_bank:1, biz_space:1 };
let S = null, places = {}, rocket = null, droneList = [], bb = null, holo = [];
let npcCache = {}, deliver = null, hack = null, flags = {}, billboardT = 0, waterT = 0, inServerRoom = false;
const T = { acc:0, bacc:0, dacc:0, started:false };

function DEFAULTS() {
  return { biz:{}, servers:0, cooling:0, offline:0, btc:0, rate:95, hist:[95], deposit:0, loan:0,
    cols:{}, quests:{}, last:Date.now(), hacked:0, delivered:0, sold:0, gift:false };
}
function load() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem('fz7_state') || 'null'); } catch (e) {}
  S = Object.assign(DEFAULTS(), raw || {});
  if (!S.biz) S.biz = {};
  if (!S.cols) S.cols = {};
  if (!S.quests) S.quests = {};
  if (!Array.isArray(S.hist) || !S.hist.length) S.hist = [S.rate || 95];
}
function save() { try { localStorage.setItem('fz7_state', JSON.stringify(S)); } catch (e) {} }

// ---------------- УТИЛИТЫ ----------------
function money() { return (localPlayer && localPlayer.money) || 0; }
function addMoney(n) {
  try {
    if (!localPlayer) return;
    localPlayer.money = Math.max(0, (localPlayer.money || 0) + n);
    const el = document.getElementById('moneyDisplay'); if (el) el.textContent = localPlayer.money;
  } catch (e) {}
}
function coins(n) {
  try { localCoins = Math.max(0, (localCoins || 0) + n); const el = document.getElementById('coinsDisplay'); if (el) el.textContent = localCoins; } catch (e) {}
}
function note(t, k) { try { showNotification(t, k || 'info'); } catch (e) {} }
function bigBanner(t, d, k) {
  try { if (typeof showWorldEventBanner === 'function') showWorldEventBanner(t, d, k || 'info'); else note(t); } catch (e) { note(t); }
}
function sfx(name) { try { if (typeof SFX !== 'undefined' && SFX && typeof SFX[name] === 'function') SFX[name](); } catch (e) {} }
function fmt(n) { return Math.floor(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// ---------------- HUD-ДОК ----------------
function dockInit() {
  if (document.getElementById('fz7Dock')) return;
  try {
    if (!document.getElementById('fz7Css')) {
      const st = document.createElement('style'); st.id = 'fz7Css';
      st.textContent =
        '#fz7Dock{position:fixed;right:12px;top:212px;z-index:6000;display:flex;flex-direction:column;gap:6px;align-items:flex-end;}'
        + '#fz7Dock .fz7b{width:50px;height:50px;border-radius:14px;border:1.4px solid #6c5ce788;background:linear-gradient(150deg,#1a1636ee,#0d0a1cdd);color:#fff;font-size:21px;cursor:pointer;backdrop-filter:blur(6px);box-shadow:0 4px 18px #0009;}'
        + '#fz7Dock .fz7b:hover{border-color:#a29bfe;}'
        + '#fz7Chip{background:rgba(9,7,22,.82);border:1px solid #ffd76a66;border-radius:12px;padding:6px 10px;color:#fff;font:12px Arial;line-height:1.5;backdrop-filter:blur(6px);text-align:right;}'
        + '#fz7Order{background:rgba(9,24,14,.86);border:1px solid #7cffb288;border-radius:12px;padding:6px 10px;color:#fff;font:12px Arial;max-width:190px;text-align:right;}'
        + '@media (max-width:820px){#fz7Dock{right:8px;top:auto;bottom:186px;flex-direction:column-reverse;gap:5px;}#fz7Dock .fz7b{width:44px;height:44px;font-size:18px;}#fz7Chip,#fz7Order{font-size:10px;padding:4px 7px;max-width:150px;}}';
      document.head.appendChild(st);
    }
    const d = document.createElement('div');
    d.id = 'fz7Dock';
    d.innerHTML =
      '<div id="fz7Chip">💼 0 · ₿ 0<span style="color:#7cffb2"> · +0 $/мин</span></div>'
      + '<button class="fz7b" title="Корпорация — бизнесы" onclick="FZ7_open(\'biz\')">💼</button>'
      + '<button class="fz7b" title="Датацентр — серверы и ₿" onclick="FZ7_open(\'srv\')">🖥️</button>'
      + '<button class="fz7b" title="Банк — вклад, кредит, биржа" onclick="FZ7_open(\'bank\')">🏦</button>'
      + '<button class="fz7b" title="Космодром — колонизация" onclick="FZ7_open(\'space\')">🚀</button>'
      + '<button class="fz7b" title="Хакер-терминал" onclick="FZ7_open(\'hack\')">💻</button>';
    document.body.appendChild(d);
  } catch (e) {}
}
function dockRefresh() {
  try {
    const chip = document.getElementById('fz7Chip');
    if (chip && S) {
      const n = BIZ.filter(b => (S.biz[b.id] || 0) > 0).length;
      const c = COLONIES.filter(w => S.cols[w.id]).length;
      chip.innerHTML = '💼 ' + n + ' · 🌍 ' + c + ' · ₿ ' + (Math.round(S.btc * 10) / 10)
        + '<br><span style="color:#7cffb2">+' + fmt(incomeMin()) + ' $/мин</span>';
    }
    const od = document.getElementById('fz7Order');
    if (deliver) {
      let el = od;
      if (!el) { el = document.createElement('div'); el.id = 'fz7Order'; document.getElementById('fz7Dock').appendChild(el); }
      el.innerHTML = '📦 Заказ: ' + deliver.name + '<br><span style="color:#7cffb2">' + Math.round(distTo(deliver.x, deliver.z)) + ' м · ' + Math.ceil(deliver.t) + ' с</span>';
    } else if (od) { od.remove(); }
  } catch (e) {}
}

// ---------------- МОДАЛКИ ----------------
function modal(id, title, html, w) {
  let m = document.getElementById(id);
  if (!m) {
    m = document.createElement('div'); m.id = id;
    m.style.cssText = 'position:fixed;inset:0;z-index:8200;display:flex;align-items:center;justify-content:center;background:rgba(4,2,12,.74);backdrop-filter:blur(4px);padding:12px;box-sizing:border-box;';
    document.body.appendChild(m);
    m.onclick = (e) => { if (e.target === m) m.style.display = 'none'; };
  }
  m.innerHTML = '<div style="width:min(' + (w || 470) + 'px,96vw);max-height:86vh;overflow:auto;background:linear-gradient(160deg,#161230,#0a0918);border:1.5px solid #6c5ce766;border-radius:18px;padding:16px;box-shadow:0 0 80px #6c5ce744;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:10px;">'
    + '<div style="font:bold 16px Arial;color:#fff;">' + title + '</div>'
    + '<button onclick="document.getElementById(\'' + id + '\').style.display=\'none\'" style="background:#ffffff14;color:#fff;border:1px solid #ffffff2e;border-radius:10px;width:32px;height:32px;cursor:pointer;font-size:15px;flex:0 0 auto;">✕</button></div>'
    + html + '</div>';
  m.style.display = 'flex';
  return m;
}
function rowHTML(ico, title, sub, right) {
  return '<div style="display:flex;align-items:center;gap:10px;background:#ffffff08;border:1px solid #ffffff14;border-radius:12px;padding:9px 11px;margin-bottom:8px;">'
    + '<div style="font-size:23px;width:30px;text-align:center;">' + ico + '</div>'
    + '<div style="flex:1;min-width:0;"><div style="color:#fff;font:13px Arial;">' + title + '</div>'
    + '<div style="color:#a29bfe;font:11px Arial;margin-top:2px;">' + sub + '</div></div>'
    + '<div style="text-align:right;">' + right + '</div></div>';
}
function btn(label, fn, color) {
  return '<button onclick="' + fn + '" style="background:' + (color || 'linear-gradient(135deg,#6c5ce7,#4834d4)') + ';color:#fff;border:none;border-radius:10px;padding:7px 12px;cursor:pointer;font:bold 12px Arial;white-space:nowrap;margin:2px 0;">' + label + '</button>';
}
function bar(pct, color) {
  return '<div style="height:7px;border-radius:5px;background:#ffffff18;overflow:hidden;margin-top:6px;"><div style="height:100%;width:' + clamp(pct, 0, 100) + '%;background:' + color + ';transition:width .3s;"></div></div>';
}

// ---------------- РАСЧЁТЫ ----------------
function bizLevel(id) { return S.biz[id] || 0; }
function bizInc(id) {
  const b = BIZ.find(x => x.id === id), lv = bizLevel(id);
  if (!b || !lv) return 0;
  return Math.round(b.base * (1 + (lv - 1) * 0.85));
}
function bizIncome() { return BIZ.reduce((a, b) => a + bizInc(b.id), 0); }
function colIncome() { return COLONIES.reduce((a, w) => a + (S.cols[w.id] ? w.inc : 0), 0); }
function colBtc() { return COLONIES.reduce((a, w) => a + (S.cols[w.id] ? w.btcInc : 0), 0); }
function incomeMin() { return bizIncome() + colIncome(); }
function capacity() { return 2 + S.cooling * 2; }
function miningPerMin() { return Math.max(0, S.servers - S.offline) * 1.2; }

// ---------------- ПАНЕЛИ ----------------
function bizPanel() {
  let h = '<div style="color:#ffd76a;font:12px Arial;margin-bottom:10px;">💰 Баланс: <b>' + fmt(money()) + ' $</b> · пассивный доход: <b>' + fmt(incomeMin()) + ' $/мин</b></div>';
  BIZ.forEach(b => {
    const lv = bizLevel(b.id);
    const cost = lv === 0 ? b.cost : Math.round(b.cost * Math.pow(1.9, lv));
    const sub = b.desc + ' · ур. <b style="color:#7cffb2">' + lv + '/5</b>' + (lv ? ' · +' + fmt(bizInc(b.id)) + ' $/мин' : '');
    const right = lv >= 5 ? '<span style="color:#7cffb2;font:12px Arial;">MAX</span>'
      : btn(lv ? ('⬆️ ' + fmt(cost) + '$') : ('Купить ' + fmt(cost) + '$'), 'FZ7_buyBiz(\'' + b.id + '\')');
    h += rowHTML(b.ico, b.name, sub, right);
    if (lv) h += '<div style="margin:-4px 0 8px 0;">' + bar(lv / 5 * 100, 'linear-gradient(90deg,#6c5ce7,#00d2a0)') + '</div>';
  });
  h += '<div style="color:#fff;font:bold 13px Arial;margin:14px 0 8px;">📜 Бизнес-цели</div>';
  QUESTS.forEach(q => {
    const done = !!S.quests[q.id];
    h += rowHTML(done ? '✅' : q.ico, '<span style="' + (done ? 'color:#7cffb2' : '') + '">' + q.name + '</span>',
      'Награда: +' + fmt(q.rw) + ' $' + (q.btc ? ' и +' + q.btc + ' ₿' : '') + ' · ' + q.hint,
      done ? '<span style="color:#7cffb2;font:12px Arial;">готово</span>' : '');
  });
  h += '<div style="color:#7f8fa6;font:11px Arial;margin-top:10px;">Бизнесы приносят деньги каждую минуту, даже пока ты гуляешь по городу. Пока тебя не было — до 4 часов дохода.</div>';
  modal('fz7m_biz', '💼 КОРПОРАЦИЯ FANTAZIA', h, 520);
}
function srvPanel() {
  const cap = capacity();
  const heat = S.servers ? Math.round(S.servers / Math.max(cap, 1) * 100) : 0;
  let h = '<div style="color:#7fd8ff;font:12px Arial;margin-bottom:10px;">FZ-CLOUD · стоек: <b>' + S.servers + '</b> · охлаждение: <b>' + S.cooling + '</b> (лимит ' + cap + ')' + (S.offline ? ' · <span style="color:#ff7675">выключено: ' + S.offline + '</span>' : '') + '</div>';
  h += '<div style="color:#fff;font:12px Arial;">Нагрузка серверной: ' + heat + '%</div>' + bar(heat, heat > 100 ? 'linear-gradient(90deg,#ff7675,#d63031)' : 'linear-gradient(90deg,#00cec9,#6c5ce7)');
  h += '<div style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap;">'
    + btn('➕ Стойка ' + fmt(400 + 120 * S.servers) + '$', 'FZ7_buyServer()')
    + btn('❄️ Охлаждение ' + fmt(300 + 100 * S.cooling) + '$', 'FZ7_buyCool()', 'linear-gradient(135deg,#0984e3,#0652dd)')
    + (S.offline ? btn('🔧 Перезагрузка ' + fmt(120 * S.offline) + '$', 'FZ7_reboot()', 'linear-gradient(135deg,#e17055,#c0392b)') : '')
    + '</div>';
  h += '<div style="color:#ffd76a;font:13px Arial;margin-bottom:10px;">₿ Добыча: <b>' + (Math.round(miningPerMin() * 10) / 10) + ' ₿/мин</b> · на счету: <b>' + (Math.round(S.btc * 100) / 100) + ' ₿</b></div>';
  h += rowHTML('💻', 'Взлом серверной', 'Мини-игра «повтори код» · награда до 24 ₿', btn('Взломать', 'FZ7_open(\'hack\')'))
    + rowHTML('📈', 'Курс ₿ → $', 'Сейчас: <b style="color:#7cffb2">' + fmt(S.rate) + '$</b> за 1 ₿ (меняется каждые 15 секунд)', btn('Биржа', 'FZ7_open(\'bank\')'));
  h += '<div style="color:#7f8fa6;font:11px Arial;margin-top:8px;">Каждая стойка даёт ~1.2 ₿/мин. Без охлаждения серверы перегреваются и отключаются.</div>';
  modal('fz7m_srv', '🖥️ ДАТАЦЕНТР FZ-CLOUD', h, 520);
}
function bankPanel() {
  const hist = S.hist.slice(-30);
  const mx = Math.max.apply(null, hist), mn = Math.min.apply(null, hist);
  let spark = '';
  try {
    const cv = document.createElement('canvas'); cv.width = 420; cv.height = 70;
    const c = cv.getContext('2d');
    c.fillStyle = '#0d0a1c'; c.fillRect(0, 0, 420, 70);
    c.beginPath();
    hist.forEach((v, i) => {
      const x = i / Math.max(1, hist.length - 1) * 410 + 5;
      const y = 64 - (v - mn) / Math.max(1, mx - mn) * 56;
      if (i) c.lineTo(x, y); else c.moveTo(x, y);
    });
    c.strokeStyle = '#7cffb2'; c.lineWidth = 2.4; c.stroke();
    spark = '<img src="' + cv.toDataURL() + '" style="width:100%;border-radius:10px;border:1px solid #ffffff22;margin:6px 0 10px;">';
  } catch (e) {}
  const up = hist.length > 1 ? hist[hist.length - 1] - hist[0] : 0;
  let h = '<div style="color:#ffd76a;font:12px Arial;margin-bottom:8px;">💰 Баланс: <b>' + fmt(money()) + ' $</b> · ₿: <b>' + (Math.round(S.btc * 100) / 100) + '</b></div>';
  h += '<div style="color:#fff;font:bold 13px Arial;margin-bottom:6px;">₿ Крипто-биржа <span style="color:' + (up >= 0 ? '#7cffb2' : '#ff7675') + ';font:12px Arial;">' + fmt(S.rate) + '$ (' + (up >= 0 ? '+' : '') + Math.round(up) + ')</span></div>';
  h += spark;
  h += '<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">'
    + btn('Купить 1 ₿ · ' + fmt(Math.round(S.rate * 1.02)) + '$', 'FZ7_btc(1)')
    + btn('Купить 5 ₿ · ' + fmt(Math.round(S.rate * 1.02 * 5)) + '$', 'FZ7_btc(5)')
    + btn('Продать 1 ₿ → ' + fmt(Math.round(S.rate * 0.98)) + '$', 'FZ7_btc(-1)', 'linear-gradient(135deg,#00b894,#00846a)')
    + btn('Продать всё → ' + fmt(Math.round(S.rate * 0.98 * S.btc)) + '$', 'FZ7_btc(-99)', 'linear-gradient(135deg,#00b894,#00846a)')
    + '</div>';
  h += '<div style="color:#fff;font:bold 13px Arial;margin-bottom:6px;">🏦 Вклад и кредит</div>';
  h += rowHTML('💵', 'Вклад под 1% в минуту', 'На вкладе: <b style="color:#7cffb2">' + fmt(S.deposit) + ' $</b>', btn('+500$', 'FZ7_dep(500)') + btn('Всё', 'FZ7_dep(-1)'));
  h += rowHTML('📤', 'Снять со вклада', 'Вернуть деньги в кошелёк', btn('Снять', 'FZ7_dep(0)'));
  h += rowHTML('💳', 'Кредит (до 5 000$)', 'Долг: <b style="color:' + (S.loan ? '#ff7675' : '#7cffb2') + '">' + fmt(S.loan) + ' $</b> под 1%/мин', btn('Взять 5к', 'FZ7_loan(5000)') + btn('Погасить', 'FZ7_loan(-1)', 'linear-gradient(135deg,#e17055,#c0392b)'));
  h += '<div style="color:#7f8fa6;font:11px Arial;margin-top:8px;">Вклад растёт каждую минуту, кредит — тоже. Банк никогда не забывает 🙂</div>';
  modal('fz7m_bank', '🏦 БАНК FANTAZIA', h, 520);
}
function spacePanel() {
  let h = '<div style="color:#a29bfe;font:12px Arial;margin-bottom:10px;">Космодром «Фантазия» · колоний: <b>' + COLONIES.filter(w => S.cols[w.id]).length + '/5</b> · доход колоний: <b>' + fmt(colIncome()) + ' $/мин</b> + <b>' + (Math.round(colBtc() * 10) / 10) + ' ₿/мин</b></div>';
  h += '<div style="color:#ffd76a;font:12px Arial;margin-bottom:10px;">💰 ' + fmt(money()) + ' $ · ₿ ' + (Math.round(S.btc * 100) / 100) + '</div>';
  COLONIES.forEach((w, i) => {
    const own = !!S.cols[w.id];
    const prev = i === 0 || S.cols[COLONIES[i - 1].id];
    const sub = w.desc + ' · цена: ' + fmt(w.money) + '$ + ' + w.btc + ' ₿<br>дача: +' + fmt(w.inc) + ' $/мин' + (w.btcInc ? ' и +' + w.btcInc + ' ₿/мин' : '');
    let right;
    if (own) right = '<span style="color:#7cffb2;font:12px Arial;">🛰️ колония<br>активна</span>';
    else if (!prev) right = '<span style="color:#7f8fa6;font:12px Arial;">нужна<br>предыдущая</span>';
    else right = btn('🚀 Запуск', 'FZ7_colonize(\'' + w.id + '\')');
    h += rowHTML(w.ico, w.name, sub, right);
  });
  h += '<div style="color:#7f8fa6;font:11px Arial;margin-top:8px;">После запуска ракета уходит в небо, а на площадке остаётся флаг колонии. Каждая колония работает сама и приносит деньги.</div>';
  modal('fz7m_space', '🚀 ЦЕНТР КОЛОНИЗАЦИИ', h, 540);
}
function managerPanel() {
  let h = '<div style="color:#a29bfe;font:12px Arial;margin-bottom:12px;">Менеджер: «Здравствуй! Хочешь открыть своё дело? Или возьми заказ — город большой, товар нужно доставить.»</div>';
  h += rowHTML('💼', 'Бизнес-панель', 'Купить бизнес, поднять уровень, посмотреть цели', btn('Открыть', 'FZ7_open(\'biz\')'));
  h += rowHTML('📦', deliver ? '🏃 Заказ уже в работе' : 'Курьерский заказ',
    deliver ? 'Доставь груз — маркер горит в городе' : 'Случайная точка · 180 секунд · ~300-600$ + монетки',
    deliver ? '<span style="color:#ffd76a;font:12px;">в пути</span>' : btn('Взять заказ', 'FZ7_takeOrder()', 'linear-gradient(135deg,#00b894,#00846a)'));
  h += rowHTML('❓', 'Как всё работает', 'Бизнес → деньги · серверы → ₿ · банк → вклады · космодром → колонии', btn('Гид', 'FZ7_open(\'help\')'));
  modal('fz7m_mgr', '👔 МЕНЕДЖЕР · БИЗНЕС-ЦЕНТР', h, 480);
}
function helpPanel() {
  const h = '<div style="color:#dfe6e9;font:12.5px Arial;line-height:1.75;">'
    + '<b style="color:#ffd76a">💼 Бизнесы</b> — покупай у Менеджера, доход капает каждую минуту, уровни 1-5.<br>'
    + '<b style="color:#7fd8ff">🖥️ Серверы</b> — каждая стойка даёт ₿. Без охлаждения перегреется.<br>'
    + '<b style="color:#7cffb2">₿ Биржа</b> — курс меняется каждые 15 секунд.<br>'
    + '<b style="color:#ffd76a">🏦 Банк</b> — вклад под 1%/мин и кредит до 5 000$.<br>'
    + '<b style="color:#a29bfe">🚀 Колонии</b> — от Луны до Проксимы: приносят деньги и ₿ сами.<br>'
    + '<b style="color:#ff7675">💻 Хакер</b> — повтори код на терминале: до 24 ₿.<br>'
    + '<b style="color:#00b894">📦 Заказы</b> — бери у Менеджера, беги по маркеру, забирай деньги.<br>'
    + '<b style="color:#dfe6e9">📜 Цели</b> — 7 бизнес-целей с наградами (список в панели 💼).</div>';
  modal('fz7m_help', '❓ ГИД ПО КОРПОРАЦИИ', h, 470);
}
window.FZ7_help = helpPanel;
window.FZ7_open = function (w) {
  sfx('tick');
  try {
    if (w === 'biz') return bizPanel();
    if (w === 'srv') return srvPanel();
    if (w === 'bank') return bankPanel();
    if (w === 'space') return spacePanel();
    if (w === 'hack') return hackStart();
    if (w === 'mgr') return managerPanel();
    if (w === 'help') return helpPanel();
  } catch (e) { note('⚠️ Панель не открылась, попробуй снова', 'error'); }
};

// ---------------- ДЕЙСТВИЯ ----------------
window.FZ7_buyBiz = function (id) {
  const b = BIZ.find(x => x.id === id); if (!b || !S) return;
  const lv = bizLevel(id);
  if (lv >= 5) { note('Максимальный уровень!', 'info'); return; }
  const cost = lv === 0 ? b.cost : Math.round(b.cost * Math.pow(1.9, lv));
  if (money() < cost) { sfx('fail'); note('💸 Не хватает ' + fmt(cost - money()) + '$', 'error'); return; }
  addMoney(-cost); S.biz[id] = lv + 1; save();
  sfx('ding');
  note((lv ? '⬆️ ' + b.name + ' → ур.' + (lv + 1) : '🎉 Открыт бизнес: ' + b.name) + ' · +' + fmt(bizInc(id)) + ' $/мин', 'success');
  if (lv === 0) bigBanner('💼 НОВЫЙ БИЗНЕС', b.ico + ' <b>' + b.name + '</b><br>Доход: <b>+' + fmt(bizInc(id)) + ' $/мин</b>', 'success');
  checkQuests(); bizPanel(); dockRefresh();
};
window.FZ7_buyServer = function () {
  const c = 400 + 120 * S.servers;
  if (money() < c) { sfx('fail'); note('💸 Нужно ' + fmt(c) + '$', 'error'); return; }
  addMoney(-c); S.servers++; save(); sfx('ok');
  note('🖥️ Стойка установлена! Всего: ' + S.servers + ' · ₿ ' + (Math.round(miningPerMin() * 10) / 10) + '/мин', 'success');
  if (S.servers > capacity()) note('🔥 Внимание: серверы перегреваются! Нужно охлаждение.', 'error');
  checkQuests(); srvPanel(); dockRefresh(); serverLights();
};
window.FZ7_buyCool = function () {
  const c = 300 + 100 * S.cooling;
  if (money() < c) { sfx('fail'); note('💸 Нужно ' + fmt(c) + '$', 'error'); return; }
  addMoney(-c); S.cooling++; save(); sfx('ok');
  note('❄️ Охлаждение усилено. Лимит: ' + capacity() + ' стоек', 'success');
  srvPanel(); serverLights();
};
window.FZ7_reboot = function () {
  if (!S.offline) return;
  const c = 120 * S.offline;
  if (money() < c) { sfx('fail'); note('💸 Нужно ' + fmt(c) + '$ на ремонт', 'error'); return; }
  addMoney(-c); S.offline = 0; save(); sfx('ding');
  note('🔧 Серверы снова в сети! ₿ ' + (Math.round(miningPerMin() * 10) / 10) + '/мин', 'success');
  srvPanel(); dockRefresh(); serverLights();
};
window.FZ7_btc = function (n) {
  if (!S) return;
  if (n < 0) {
    const amt = n === -99 ? S.btc : Math.min(1, S.btc);
    if (amt <= 0.01) { sfx('fail'); note('Нет ₿ для продажи', 'error'); return; }
    const gain = Math.floor(amt * S.rate * 0.98);
    S.btc -= amt; addMoney(gain); S.sold++; save();
    sfx('ding'); note('₿ Продано ' + (Math.round(amt * 100) / 100) + ' ₿ → +' + fmt(gain) + '$', 'success');
  } else {
    const cost = Math.ceil(n * S.rate * 1.02);
    if (money() < cost) { sfx('fail'); note('💸 Нужно ' + fmt(cost) + '$', 'error'); return; }
    addMoney(-cost); S.btc += n; save();
    sfx('ok'); note('₿ Куплено ' + n + ' ₿ за ' + fmt(cost) + '$', 'success');
  }
  checkQuests(); bankPanel(); dockRefresh();
};
window.FZ7_dep = function (n) {
  if (!S) return;
  if (n === 0) {
    if (S.deposit <= 0) { note('Вклад пуст', 'info'); return; }
    addMoney(S.deposit); note('📤 Снято со вклада: +' + fmt(S.deposit) + '$', 'success');
    S.deposit = 0; save(); sfx('ok');
  } else {
    const amt = n === -1 ? money() : Math.min(n, money());
    if (amt <= 0) { sfx('fail'); note('Нет свободных денег', 'error'); return; }
    addMoney(-amt); S.deposit += amt; save(); sfx('ok');
    note('💵 Вклад пополнен на ' + fmt(amt) + '$ (1% в минуту)', 'success');
  }
  bankPanel(); dockRefresh();
};
window.FZ7_loan = function (n) {
  if (!S) return;
  if (n < 0) {
    const amt = Math.min(S.loan, money());
    if (amt <= 0) { sfx('fail'); note('Нечего гасить', 'error'); return; }
    addMoney(-amt); S.loan -= amt; save(); sfx('ok');
    note('💳 Погашено ' + fmt(amt) + '$ долга. Осталось: ' + fmt(S.loan) + '$', 'success');
  } else {
    if (S.loan > 0) { sfx('fail'); note('Сначала погаси старый кредит', 'error'); return; }
    addMoney(n); S.loan += n; save(); sfx('ok');
    note('💳 Кредит получен: ' + fmt(n) + '$ (1% в минуту)', 'success');
  }
  bankPanel(); dockRefresh();
};
window.FZ7_colonize = function (id) {
  const i = COLONIES.findIndex(w => w.id === id);
  if (i < 0 || !S) return;
  const w = COLONIES[i];
  if (S.cols[id]) { note('Колония уже основана', 'info'); return; }
  if (i > 0 && !S.cols[COLONIES[i - 1].id]) { sfx('fail'); note('Сначала колонизируй ' + COLONIES[i - 1].name, 'error'); return; }
  if (money() < w.money) { sfx('fail'); note('💸 Нужно ' + fmt(w.money - money()) + '$', 'error'); return; }
  if (S.btc < w.btc) { sfx('fail'); note('₿ Нужно ещё ' + (Math.round((w.btc - S.btc) * 100) / 100) + ' ₿', 'error'); return; }
  addMoney(-w.money); S.btc -= w.btc; S.cols[id] = Date.now(); save();
  bigBanner('🚀 ЗАПУСК: ' + w.name.toUpperCase(), 'Корабль «Фантазия-1» уходит в небо!<br>Колония даёт <b>+' + fmt(w.inc) + ' $/мин</b>' + (w.btcInc ? ' и <b>+' + w.btcInc + ' ₿/мин</b>' : ''), 'success');
  launchRocket(id);
  checkQuests(); spacePanel(); dockRefresh();
};
window.FZ7_takeOrder = function () {
  if (!S) return;
  if (deliver) { note('📦 Заказ уже в работе: ' + Math.ceil(deliver.t) + ' с', 'info'); return; }
  const pts = [];
  try {
    buildings.forEach(b => {
      if (!b || !b.type) return;
      if (/^(shop_|biz_|cafe|job_)/.test(b.type)) pts.push({ x: b.x, z: b.z + (b.d || 10) / 2 + 3, n: b.name });
    });
  } catch (e) {}
  if (!pts.length) pts.push({ x: 30, z: 30, n: 'Точка на карте' });
  const t = pts[Math.floor(Math.random() * pts.length)];
  deliver = { x: t.x, z: t.z, name: String(t.n || 'Точка').slice(0, 20), t: 180, reward: 220 + Math.floor(Math.random() * 6) * 60 };
  makeOrderBeacon();
  sfx('door');
  note('📦 Заказ: доставь груз к «' + deliver.name + '» за 180 секунд. Маркер уже в небе!', 'info');
  try { document.getElementById('fz7m_mgr').style.display = 'none'; } catch (e) {}
  dockRefresh();
};

// ---------------- ДОСТАВКА ----------------
function makeOrderBeacon() {
  try {
    if (!deliver) return;
    if (!deliver.mesh) {
      const g = new THREE.Group();
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 34, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x00e676, transparent: true, opacity: 0.24, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      cyl.position.y = 17; g.add(cyl);
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.3, 20),
        new THREE.MeshBasicMaterial({ color: 0x7cffb2, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
      scene.add(g);
      deliver.mesh = g; deliver.ring = ring;
    }
    deliver.mesh.visible = true;
    deliver.mesh.position.set(deliver.x, 0, deliver.z);
  } catch (e) {}
}
function deliverDone(fail) {
  try { if (deliver && deliver.mesh) scene.remove(deliver.mesh); } catch (e) {}
  deliver = null;
  dockRefresh();
  if (fail) { sfx('fail'); note('📦 Заказ сорван — время вышло', 'error'); }
}
function distTo(x, z) {
  try {
    const p = localPlayer && localPlayer.mesh && localPlayer.mesh.position;
    if (!p) return 9999;
    return Math.hypot(p.x - x, p.z - z);
  } catch (e) { return 9999; }
}
function deliverUpdate(dt) {
  if (!deliver) return;
  deliver.t -= dt;
  if (deliver.ring) { const s = 1 + 0.25 * Math.sin(Date.now() / 220); deliver.ring.scale.set(s, s, 1); }
  if (deliver.t <= 0) { deliverDone(true); return; }
  if (distTo(deliver.x, deliver.z) < 3.4) {
    const reward = deliver.reward, nm = deliver.name;
    addMoney(reward); coins(3);
    deliverDone(false);
    bigBanner('📦 ЗАКАЗ ДОСТАВЛЕН', 'Клиент «' + nm + '» доволен!<br><b>+' + fmt(reward) + ' $</b> и <b>+3 🪙</b>', 'success');
    if (S) { S.delivered++; save(); checkQuests(); }
  }
}

// ---------------- ХАКЕР-МИНИГЕЙМ ----------------
const HACK_COLORS = ['#ff7675', '#74b9ff', '#55efc4', '#fdcb6e'];
function hackStart() {
  hack = { seq: [], step: 0, round: 0, input: false };
  let h = '<div style="color:#7cffb2;font:12px Arial;margin-bottom:10px;">Терминал FZ-CLOUD · повтори код. 3 раунда — до 24 ₿.</div>'
    + '<div id="fz7HackInfo" style="color:#ffd76a;font:bold 13px Arial;margin-bottom:10px;min-height:18px;">Раунд 1/3 · следи за кодом…</div>'
    + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">';
  for (let i = 0; i < 9; i++) {
    if (i === 4) h += '<div style="border-radius:12px;background:#ffffff0a;border:1px dashed #ffffff22;display:flex;align-items:center;justify-content:center;color:#7f8fa6;font:11px Arial;min-height:62px;">FZ</div>';
    else {
      const t = i < 4 ? i : i - 5;
      h += '<button id="fz7ht' + i + '" onclick="FZ7_hackTile(' + i + ')" style="height:62px;border-radius:12px;border:1px solid #ffffff22;background:' + HACK_COLORS[t] + '33;cursor:pointer;transition:all .18s;"></button>';
    }
  }
  h += '</div><div style="color:#7f8fa6;font:11px Arial;margin-top:10px;">Одинаковые цвета повторяются (как клавиши) — жми любой из них. Ошибка сбросит прогресс.</div>';
  modal('fz7m_hack', '💻 ВЗЛОМ ТЕРМИНАЛА', h, 400);
  setTimeout(hackNextRound, 800);
}
function tileIdx(i) { if (i === 4) return -1; return i < 4 ? i : i - 5; }
function hackFlash(i, ms) {
  const el = document.getElementById('fz7ht' + i); if (!el) return;
  const t = tileIdx(i); if (t < 0) return;
  el.style.background = HACK_COLORS[t]; el.style.boxShadow = '0 0 22px ' + HACK_COLORS[t];
  setTimeout(() => { try { el.style.background = HACK_COLORS[t] + '33'; el.style.boxShadow = 'none'; } catch (e) {} }, ms || 300);
}
function hackNextRound() {
  if (!hack) return;
  if (hack.round >= 3) {
    const rw = 6 + Math.floor(Math.random() * 3) * 4 + 6;
    if (S) { S.btc += rw; S.hacked++; save(); }
    const info = document.getElementById('fz7HackInfo');
    if (info) info.innerHTML = '<span style="color:#7cffb2">✅ ВЗЛОМ УСПЕШЕН! +' + rw + ' ₿</span>';
    sfx('ding'); note('💻 Взлом удался: +' + rw + ' ₿', 'success');
    checkQuests(); dockRefresh();
    setTimeout(() => { try { document.getElementById('fz7m_hack').style.display = 'none'; } catch (e) {} hack = null; }, 1500);
    return;
  }
  hack.round++; hack.step = 0; hack.input = false;
  const len = 2 + hack.round * 2;
  hack.seq = [];
  for (let i = 0; i < len; i++) hack.seq.push(Math.floor(Math.random() * 4));
  const info = document.getElementById('fz7HackInfo');
  if (info) { info.style.color = '#ffd76a'; info.textContent = 'Раунд ' + hack.round + '/3 · следи за кодом…'; }
  hack.seq.forEach((t, i) => { setTimeout(() => { hackFlash(t, 330); sfx('keypad'); }, 450 + i * 540); });
  setTimeout(() => {
    if (!hack) return;
    hack.input = true;
    const inf = document.getElementById('fz7HackInfo');
    if (inf) { inf.textContent = '👉 Твой ход!'; inf.style.color = '#7cffb2'; }
  }, 450 + hack.seq.length * 540);
}
window.FZ7_hackTile = function (i) {
  if (!hack || !hack.input) return;
  const t = tileIdx(i); if (t < 0) return;
  hackFlash(i, 240); sfx('keypad');
  if (hack.seq[hack.step] === t) {
    hack.step++;
    if (hack.step >= hack.seq.length) {
      hack.input = false;
      const inf = document.getElementById('fz7HackInfo');
      if (inf) { inf.textContent = '✅ Верно! Следующий раунд…'; inf.style.color = '#7cffb2'; }
      sfx('ok');
      setTimeout(hackNextRound, 950);
    }
  } else {
    hack.input = false;
    const inf = document.getElementById('fz7HackInfo');
    if (inf) inf.innerHTML = '<span style="color:#ff7675">❌ Сброс. Терминал заперся — попробуй ещё раз.</span>';
    sfx('fail'); note('💻 Взлом провален. Попробуй снова!', 'error');
    setTimeout(() => { hack = null; }, 500);
  }
};

// ---------------- ЦЕЛИ / ТИКИ ----------------
function checkQuests() {
  if (!S) return;
  const grant = (id) => {
    const q = QUESTS.find(x => x.id === id);
    if (!q || S.quests[id]) return;
    S.quests[id] = Date.now();
    if (q.rw) addMoney(q.rw);
    if (q.btc) S.btc += q.btc;
    save(); sfx('ding');
    bigBanner('📜 ЦЕЛЬ ВЫПОЛНЕНА', q.ico + ' <b>' + q.name + '</b><br>Награда: <b>+' + fmt(q.rw) + ' $</b>' + (q.btc ? ' и <b>+' + q.btc + ' ₿</b>' : ''), 'success');
  };
  const owned = BIZ.filter(b => bizLevel(b.id) > 0).length;
  const cols = COLONIES.filter(w => S.cols[w.id]).length;
  if (owned >= 1) grant('q_biz1');
  if (S.servers >= 4) grant('q_srv');
  if (S.hacked >= 1) grant('q_hack');
  if (S.sold >= 1) grant('q_btc');
  if (S.cols.moon) grant('q_col1');
  if (owned >= 3) grant('q_biz3');
  if (cols >= 3) grant('q_col3');
}
function econTick(cycles, offline) {
  const mult = offline ? 0.85 : 1;
  const gain = Math.round((bizIncome() + colIncome()) * cycles * mult);
  let btcGain = colBtc() * cycles * mult;
  if (S.servers > 0) btcGain += miningPerMin() * cycles * (offline ? 0.5 : 1);
  if (S.deposit > 0) S.deposit = Math.round(S.deposit * Math.pow(1.01, cycles));
  if (gain > 0) addMoney(gain);
  if (btcGain > 0) S.btc += btcGain;
  S.last = Date.now(); save();
  return { gain: gain, btc: Math.round(btcGain * 10) / 10 };
}

// ---------------- ИНТЕРЬЕРЫ ----------------
function fzRoom(bx, bz, W, D, FH, wall, floor, dark) {
  const addObj = (m) => { scene.add(m); interiorObjects.push(m); return m; };
  const mat = (c, e, ei) => new THREE.MeshLambertMaterial({ color: c, emissive: e || 0, emissiveIntensity: ei || 0 });
  interiorBounds = { W: W / 2 - 0.9, D: D / 2 - 0.9 };
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(floor));
  fl.rotation.x = -Math.PI / 2; fl.position.set(bx, 0.01, bz); addObj(fl);
  const ce = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(new THREE.Color(wall).multiplyScalar(0.5).getHex()));
  ce.rotation.x = Math.PI / 2; ce.position.set(bx, FH, bz); addObj(ce);
  const wc = new THREE.Color(wall).lerp(new THREE.Color(0xffffff), dark ? 0.05 : 0.3).getHex();
  [[bx, bz - D / 2, 0, W], [bx, bz + D / 2, Math.PI, W], [bx - W / 2, bz, Math.PI / 2, D], [bx + W / 2, bz, -Math.PI / 2, D]].forEach(([x, z, ry, w]) => {
    const wl = new THREE.Mesh(new THREE.PlaneGeometry(w, FH), mat(wc));
    wl.position.set(x, FH / 2, z); wl.rotation.y = ry; addObj(wl);
  });
  return { addObj: addObj, mat: mat };
}
function fzSign(text, bx, bz, x, y, z, addObj, color) {
  try {
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 96;
    const c = cv.getContext('2d');
    c.fillStyle = 'rgba(0,0,0,0.72)'; c.fillRect(0, 0, 640, 96);
    c.fillStyle = color || '#ffd76a'; c.font = 'bold 40px Arial'; c.textAlign = 'center';
    c.fillText(text, 320, 64);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.05), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, side: THREE.DoubleSide }));
    m.position.set(bx + x, y, bz + z); addObj(m);
  } catch (e) {}
}
function fzLamp(bx, bz, x, z, fh, addObj, warm) {
  const L = new THREE.PointLight(warm || 0xffe8c0, 0.85, 32);
  L.position.set(bx + x, fh - 0.7, bz + z); addObj(L);
  const p = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 0.55), new THREE.MeshBasicMaterial({ color: warm ? 0xffd9a0 : 0xf2f6ff }));
  p.position.set(bx + x, fh - 0.3, bz + z); addObj(p);
}
function fzBox(addObj, mat, w, h, d, x, y, z, c, ry) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
  m.position.set(x, y, z); if (ry) m.rotation.y = ry;
  addObj(m); return m;
}
function fzNpcRaw(x, z, shirt, name) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.5), new THREE.MeshLambertMaterial({ color: shirt || 0x3498db }));
  body.position.y = 1.3; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshLambertMaterial({ color: 0xd4a574 }));
  head.position.y = 2.1; g.add(head);
  [-0.13, 0.13].forEach(ex => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    e.position.set(ex, 2.15, 0.3); g.add(e);
  });
  [-0.55, 0.55].forEach(ax => {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), new THREE.MeshLambertMaterial({ color: 0xd4a574 }));
    a.position.set(ax, 1.3, 0); g.add(a);
  });
  try {
    const nc = document.createElement('canvas'); nc.width = 220; nc.height = 40;
    const nctx = nc.getContext('2d');
    nctx.fillStyle = 'rgba(0,0,0,0.65)'; nctx.fillRect(0, 0, 220, 40);
    nctx.fillStyle = '#dfe6e9'; nctx.font = 'bold 18px Arial'; nctx.textAlign = 'center';
    nctx.fillText(name || 'NPC', 110, 27);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(nc), transparent: true }));
    sp.scale.set(2.2, 0.4, 1); sp.position.y = 2.85; g.add(sp);
  } catch (e) {}
  g.position.set(x, 0, z);
  scene.add(g);
  return g;
}
function fzNpc(type, idx, x, z, role, name) {
  const key = type + '_' + idx;
  if (npcCache[key]) { npcCache[key].visible = true; return npcCache[key]; }
  let mesh = null;
  try {
    if (typeof spawnNPC === 'function' && typeof npcs !== 'undefined') {
      const before = npcs.length;
      spawnNPC(x, 0, z, role || 'merchant');
      if (npcs.length > before) {
        const rec = npcs.pop();
        mesh = rec.mesh || rec;
        const last = interactables[interactables.length - 1];
        if (last && last.type === 'npc') interactables.pop();
      }
    }
  } catch (e) { mesh = null; }
  if (!mesh) mesh = fzNpcRaw(x, z, role === 'clerk' ? 0x8e44ad : role === 'chef' ? 0xffffff : 0xb8860b, name);
  npcCache[key] = mesh;
  return mesh;
}
function desk(addObj, mat, x, z, scrColor) {
  fzBox(addObj, mat, 2.5, 0.1, 1.3, x, 0.78, z, 0x8a6a44);
  [[-1.1, -0.5], [1.1, -0.5], [-1.1, 0.5], [1.1, 0.5]].forEach(([dx, dz]) => fzBox(addObj, mat, 0.1, 0.75, 0.1, x + dx, 0.38, z + dz, 0x3a3a3a));
  fzBox(addObj, mat, 1.0, 0.62, 0.08, x, 1.14, z - 0.35, 0x1a1a22);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.52), new THREE.MeshBasicMaterial({ color: scrColor || 0x2e86de }));
  scr.position.set(x, 1.14, z - 0.3); addObj(scr);
  interiorColliders.push({ minX: x - 1.3, maxX: x + 1.3, minZ: z - 0.75, maxZ: z + 0.75 });
}
function rackUnit(addObj, mat, x, z, seed) {
  fzBox(addObj, mat, 1.15, 2.5, 0.95, x, 1.25, z, 0x22262e);
  for (let i = 0; i < 6; i++) {
    const lit = (seed + i * 7) % 3 !== 0;
    const c = lit ? [0x00e5ff, 0x00ff9d, 0x00e5ff][i % 3] : 0x333a44;
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.1), new THREE.MeshBasicMaterial({ color: c }));
    l.position.set(x, 0.35 + i * 0.36, z + 0.49); addObj(l);
    const l2 = l.clone(); l2.position.z = z - 0.49; l2.rotation.y = Math.PI; addObj(l2);
  }
  interiorColliders.push({ minX: x - 0.65, maxX: x + 0.65, minZ: z - 0.55, maxZ: z + 0.55 });
}
function buildOffice(bx, bz) {
  const W = 44, D = 32, FH = 3.4;
  const R = fzRoom(bx, bz, W, D, FH, 0x35506b, 0xd8dde4, false);
  const addObj = R.addObj, mat = R.mat;
  fzLamp(bx, bz, -12, 0, FH, addObj); fzLamp(bx, bz, 12, 0, FH, addObj); fzLamp(bx, bz, 0, 12, FH, addObj);
  fzSign('🏢 БИЗНЕС-ЦЕНТР FANTAZIA · open space', bx, bz, 0, 2.7, -D / 2 + 0.3, addObj, '#7fd8ff');
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(22, 12), mat(0x2b3f57));
  carpet.rotation.x = -Math.PI / 2; carpet.position.set(bx, 0.03, bz - 4); addObj(carpet);
  [[-16, -7], [-6, -7], [4, -7], [14, -7], [-11, 1], [-1, 1], [9, 1]].forEach(([x, z], i) => {
    desk(addObj, mat, bx + x, bz + z, [0x2e86de, 0x9b59b6, 0x27ae60][i % 3]);
  });
  fzBox(addObj, mat, 8, 0.15, 3, bx + 12, 0.85, bz + 11, 0x6b4a2a);
  for (let i = 0; i < 6; i++) fzBox(addObj, mat, 0.5, 0.9, 0.5, bx + 9 + (i % 3) * 3, 0.45, bz + (i < 3 ? 9.2 : 12.8), 0x2c3e50);
  interiorColliders.push({ minX: bx + 8, maxX: bx + 16, minZ: bz + 9.3, maxZ: bz + 12.7 });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(10, 3), new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.14, side: THREE.DoubleSide }));
  glass.position.set(bx + 12, 1.5, bz + 13.4); addObj(glass);
  fzSign('🪑 ПЕРЕГОВОРНАЯ', bx, bz, 12, 2.6, 13.9, addObj, '#a29bfe');
  fzBox(addObj, mat, 0.5, 1.2, 0.5, bx - 19, 0.6, bz + 12, 0xdfe6e9);
  fzBox(addObj, mat, 0.36, 0.4, 0.36, bx - 19, 1.45, bz + 12, 0x74b9ff);
  interiorColliders.push({ minX: bx - 19.4, maxX: bx - 18.6, minZ: bz + 11.6, maxZ: bz + 12.4 });
  fzBox(addObj, mat, 2.2, 1.0, 1.0, bx + 18, 0.5, bz + 12, 0x2c3e50);
  fzBox(addObj, mat, 1.1, 0.7, 0.1, bx + 18, 1.45, bz + 11.7, 0x1a1a22);
  const ts = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.6), new THREE.MeshBasicMaterial({ color: 0x00ff9d }));
  ts.position.set(bx + 18, 1.45, bz + 11.6); addObj(ts);
  interiorColliders.push({ minX: bx + 16.8, maxX: bx + 19.2, minZ: bz + 11.4, maxZ: bz + 12.6 });
  fzSign('💻 ТЕРМИНАЛ · ВЗЛОМ', bx, bz, 18, 2.4, 12.8, addObj, '#00ff9d');
  fzNpc('biz_office', 0, bx, bz - 13, 'merchant', '👔 Менеджер');
  fzSign('👔 МЕНЕДЖЕР', bx, bz, 0, 2.5, -13.6, addObj, '#ffd76a');
  interactables.push({ position: { x: bx, y: 0, z: bz - 11.4 }, type: 'fz7_manager', fz: 1, name: '👔 Менеджер — бизнес и заказы', range: 3.4, interior: true });
  interactables.push({ position: { x: bx + 18, y: 0, z: bz + 10.6 }, type: 'fz7_hack', fz: 1, name: '💻 Терминал — взлом за ₿', range: 3, interior: true });
  interactables.push({ position: { x: bx - 19, y: 0, z: bz + 10.6 }, type: 'fz7_water', fz: 1, name: '🚰 Кулер — попить воды', range: 2.6, interior: true });
  const fi = document.getElementById('floorIndicator'); if (fi) fi.textContent = '🏢 Бизнес-центр';
}
function buildServer(bx, bz) {
  const W = 46, D = 26, FH = 3.6;
  const R = fzRoom(bx, bz, W, D, FH, 0x14243a, 0x1b2330, true);
  const addObj = R.addObj, mat = R.mat;
  fzLamp(bx, bz, -14, 0, FH, addObj, 0x66b8ff); fzLamp(bx, bz, 0, 0, FH, addObj, 0x66b8ff); fzLamp(bx, bz, 14, 0, FH, addObj, 0x66b8ff);
  fzSign('🖥️ FZ-CLOUD · ДАТАЦЕНТР · 99.98% UPTIME', bx, bz, 0, 2.9, -D / 2 + 0.3, addObj, '#7fd8ff');
  let seed = 1;
  [-7, -3.2, 3.2, 7].forEach(rz => {
    for (let i = 0; i < 6; i++) rackUnit(addObj, mat, bx - 15 + i * 6, bz + rz, seed++);
  });
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.5), new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.22 }));
  fl.rotation.x = -Math.PI / 2; fl.position.set(bx, 0.04, bz + 2); addObj(fl);
  fzBox(addObj, mat, 4, 1.0, 1.2, bx, 0.5, bz + 11, 0x22303f);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshBasicMaterial({ color: 0x00e5ff }));
  scr.position.set(bx, 1.6, bz + 10.5); addObj(scr);
  interiorColliders.push({ minX: bx - 2.2, maxX: bx + 2.2, minZ: bz + 10.3, maxZ: bz + 11.7 });
  fzSign('🖥️ ПУЛЬТ · СЕРВЕРЫ · ₿ · ВЗЛОМ', bx, bz, 0, 2.4, 11.8, addObj, '#00e5ff');
  interactables.push({ position: { x: bx, y: 0, z: bz + 9.3 }, type: 'fz7_server', fz: 1, name: '🖥️ Пульт датацентра — серверы и ₿', range: 3.6, interior: true });
  interactables.push({ position: { x: bx + 8, y: 0, z: bz + 9.3 }, type: 'fz7_hack', fz: 1, name: '💻 Терминал — взлом за ₿', range: 3, interior: true });
  const fi = document.getElementById('floorIndicator'); if (fi) fi.textContent = '🖥️ FZ-CLOUD';
}
function buildBank(bx, bz) {
  const W = 36, D = 26, FH = 3.6;
  const R = fzRoom(bx, bz, W, D, FH, 0x2a2418, 0xe8e4dc, false);
  const addObj = R.addObj, mat = R.mat;
  fzLamp(bx, bz, -9, 0, FH, addObj); fzLamp(bx, bz, 9, 0, FH, addObj);
  fzSign('🏦 БАНК FANTAZIA · вклады · кредиты · ₿', bx, bz, 0, 2.85, -D / 2 + 0.3, addObj, '#ffd76a');
  [-8, 0, 8].forEach(x => {
    fzBox(addObj, mat, 5, 1.05, 1.2, bx + x, 0.52, bz - 6, 0x7a5a30);
    fzBox(addObj, mat, 5.3, 0.1, 1.4, bx + x, 1.1, bz - 6, 0xb08a52);
    const g = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.5), new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.16, side: THREE.DoubleSide }));
    g.position.set(bx + x, 1.95, bz - 5.4); addObj(g);
    interiorColliders.push({ minX: bx + x - 2.7, maxX: bx + x + 2.7, minZ: bz - 6.8, maxZ: bz - 5.2 });
  });
  fzSign('КАССА', bx, bz, 0, 2.55, -7.6, addObj, '#ffd76a');
  const door = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.5, 22), mat(0x9aa2ad));
  door.rotation.z = Math.PI / 2; door.position.set(bx - 13, 2.1, bz - 11.5); addObj(door);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.18, 8, 20), mat(0xd4af37));
  ring.position.set(bx - 13, 2.1, bz - 11.2); addObj(ring);
  fzSign('🔐 ХРАНИЛИЩЕ', bx, bz, -13, 4.4, -12.3, addObj, '#d4af37');
  fzBox(addObj, mat, 1.3, 1.9, 0.9, bx + 14, 0.95, bz + 10, 0x2c3e50);
  const sc = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.7), new THREE.MeshBasicMaterial({ color: 0x00ff9d }));
  sc.position.set(bx + 14, 1.3, bz + 10.5); addObj(sc);
  interiorColliders.push({ minX: bx + 13.2, maxX: bx + 14.8, minZ: bz + 9.4, maxZ: bz + 10.6 });
  fzSign('🏧 БАНКОМАТ · ВКЛАД · КРЕДИТ · БИРЖА', bx, bz, 14, 2.55, 11.1, addObj, '#00ff9d');
  fzNpc('biz_bank', 0, bx, bz - 9, 'clerk', '👩‍💼 Кассир');
  interactables.push({ position: { x: bx + 14, y: 0, z: bz + 8.6 }, type: 'fz7_atm', fz: 1, name: '🏧 Банкомат — вклад, кредит, биржа ₿', range: 3, interior: true });
  interactables.push({ position: { x: bx, y: 0, z: bz - 8.6 }, type: 'fz7_banker', fz: 1, name: '👩‍💼 Кассир — вклад и обмен ₿', range: 3.2, interior: true });
  interactables.push({ position: { x: bx - 13, y: 0, z: bz - 9.2 }, type: 'fz7_vault', fz: 1, name: '🔐 Хранилище — осмотреть сейф', range: 3, interior: true });
  const fi = document.getElementById('floorIndicator'); if (fi) fi.textContent = '🏦 Банк FANTAZIA';
}
function buildSpace(bx, bz) {
  const W = 48, D = 34, FH = 3.8;
  const R = fzRoom(bx, bz, W, D, FH, 0x1a1a2e, 0x1f2733, true);
  const addObj = R.addObj, mat = R.mat;
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(20, 9), new THREE.MeshBasicMaterial({ color: 0x05060f }));
  sky.position.set(bx, 3.6, bz - D / 2 + 0.25); addObj(sky);
  const pts = [];
  for (let i = 0; i < 90; i++) pts.push(bx + (Math.random() - 0.5) * 19, 3.6 + (Math.random() - 0.5) * 8.2, bz - D / 2 + 0.4);
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
  addObj(new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.13 })));
  fzSign('🚀 ЦЕНТР УПРАВЛЕНИЯ КОЛОНИЗАЦИЕЙ', bx, bz, 0, 4.5, -D / 2 + 0.5, addObj, '#a29bfe');
  fzLamp(bx, bz, -12, 2, FH, addObj, 0x9f8fff); fzLamp(bx, bz, 12, 2, FH, addObj, 0x9f8fff);
  [-12, -4, 4, 12].forEach(x => {
    fzBox(addObj, mat, 5, 1.0, 1.4, bx + x, 0.5, bz + 8, 0x2b3446);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshBasicMaterial({ color: 0x38d9f5 }));
    s.position.set(bx + x, 1.35, bz + 7.4); addObj(s);
    interiorColliders.push({ minX: bx + x - 2.7, maxX: bx + x + 2.7, minZ: bz + 7.2, maxZ: bz + 8.8 });
  });
  fzSign('🛰️ ПУЛЬТ МИССИЙ', bx, bz, 0, 2.5, 9.8, addObj, '#38d9f5');
  holo = [];
  COLONIES.forEach((w, i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 12), new THREE.MeshLambertMaterial({ color: w.color, emissive: w.color, emissiveIntensity: 0.35 }));
    m.position.set(bx - 10 + i * 5, 2.3, bz - 4); addObj(m); holo.push(m);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.2, 14), new THREE.MeshBasicMaterial({ color: 0x38d9f5, transparent: true, opacity: 0.35 }));
    base.position.set(bx - 10 + i * 5, 0.12, bz - 4); addObj(base);
  });
  interactables.push({ position: { x: bx, y: 0, z: bz + 5.6 }, type: 'fz7_mission', fz: 1, name: '🛰️ Пульт миссий — колонизация планет', range: 4, interior: true });
  interactables.push({ position: { x: bx, y: 0, z: bz - 9 }, type: 'fz7_planets', fz: 1, name: '🪐 Голограммы планет — изучить', range: 3.4, interior: true });
  const fi = document.getElementById('floorIndicator'); if (fi) fi.textContent = '🚀 Космодром';
}
window.FZ7_buildInterior = function (type) {
  if (!IS_TYPE[type]) return false;
  try {
    const bx = INTERIOR_BASE.x, bz = INTERIOR_BASE.z;
    if (type === 'biz_office') buildOffice(bx, bz);
    else if (type === 'biz_server') buildServer(bx, bz);
    else if (type === 'biz_bank') buildBank(bx, bz);
    else if (type === 'biz_space') buildSpace(bx, bz);
  } catch (e) {}
  return true;
};
window.FZ7_enterable = function (t) { return !!IS_TYPE[t]; };

// ---------------- ИНТЕРАКТ ----------------
window.FZ7_onInteract = function (inter) {
  if (!inter || !inter.type || inter.type.indexOf('fz7_') !== 0) return false;
  if (inter.type === 'fz7_manager') { managerPanel(); return true; }
  if (inter.type === 'fz7_hack') { hackStart(); return true; }
  if (inter.type === 'fz7_server') { srvPanel(); return true; }
  if (inter.type === 'fz7_atm' || inter.type === 'fz7_banker') { bankPanel(); return true; }
  if (inter.type === 'fz7_vault') { note('🔐 Хранилище заперто. Твой вклад надёжен — сейф открывают только утром.', 'info'); return true; }
  if (inter.type === 'fz7_mission') { spacePanel(); return true; }
  if (inter.type === 'fz7_planets') {
    const own = COLONIES.filter(w => S.cols[w.id]).map(w => w.ico + ' ' + w.name).join(', ') || 'пока ничего не колонизировано';
    bigBanner('🪐 КАРТА КОЛОНИЙ', 'Освоено: ' + own + '<br>Всего миров: ' + COLONIES.length, 'info');
    return true;
  }
  if (inter.type === 'fz7_water') {
    const now = Date.now();
    if (waterT && now - waterT < 45000) { note('🚰 Ты уже напился, хватит 🙂', 'info'); return true; }
    waterT = now;
    try { localPlayer.health = Math.min(100, (localPlayer.health || 100) + 15); updateHealthBar(); } catch (e) {}
    sfx('ok'); note('🚰 Вода освежает: +15 HP', 'success');
    return true;
  }
  return false;
};

// ---------------- УЛИЦА: ЗДАНИЯ, РАКЕТА, ДРОНЫ, ЭКРАН ----------------
function neon(x, y, z, c) {
  try {
    const L = new THREE.PointLight(c, 0, 34);
    L.position.set(x, y, z); scene.add(L);
    if (FZv5) { FZv5.neon = FZv5.neon || []; FZv5.neon.push(L); }
    return L;
  } catch (e) { return null; }
}
function myLamp(x, z) {
  try {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 6, 5), new THREE.MeshLambertMaterial({ color: 0x555b66 }));
    pole.position.set(x, 3, z); scene.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 6, 5), new THREE.MeshBasicMaterial({ color: 0xfff0c0 }));
    bulb.position.set(x, 6.1, z); scene.add(bulb);
    neon(x, 5.9, z, 0xffe0a0);
    try { streetColliders.push({ x: x, z: z, r: 0.35 }); } catch (e) {}
  } catch (e) {}
}
window.FZ7_placeBiz = function (idx, x, z) {
  const id = 'business:' + idx;
  const site = FZRoads.businesses[idx];
  if (!site) return false;
  x=site.x; z=site.z;
  const before = new Set(scene.children);
  return FZRoads.withOwner(id, () => {
  try {
    if (idx === 0) {
      createBuilding(x, z, 16, 11, 14, 0x2c3e50, '🏢 Бизнес-центр FANTAZIA', 'biz_office');
      places.office = { x: x, z: z };
      for (let i = 0; i < 3; i++) {
        const gl = new THREE.Mesh(new THREE.PlaneGeometry(15, 2.2), new THREE.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.13 }));
        gl.position.set(x, 2.4 + i * 3, z + 7.06); scene.add(gl);
      }
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), new THREE.MeshLambertMaterial({ color: 0x9aa2ad }));
      ant.position.set(x + 5, 14, z - 4); scene.add(ant);
      const red = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
      red.position.set(x + 5, 17.1, z - 4); scene.add(red);
      window._fz7Beacon = { m: red, t: 0 };
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
      bb = { cv: cv, tex: new THREE.CanvasTexture(cv), i: 0 };
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(11, 5.5), new THREE.MeshBasicMaterial({ map: bb.tex }));
      scr.position.set(x, 7.6, z + 7.1); scene.add(scr);
      drawBillboard();
      neon(x, 11.5, z + 8, 0x4a9dff); myLamp(x - 11, z + 10); myLamp(x + 11, z + 10);
    } else if (idx === 1) {
      createBuilding(x, z, 18, 8, 14, 0x1b2a41, '🖥️ Датацентр FZ-CLOUD', 'biz_server');
      places.server = { x: x, z: z };
      for (let i = 0; i < 6; i++) {
        const st = new THREE.Mesh(new THREE.PlaneGeometry(16, 0.35), new THREE.MeshBasicMaterial({ color: 0x00e5ff }));
        st.position.set(x, 1.2 + i * 1.1, z + 7.06); scene.add(st);
      }
      for (let i = 0; i < 3; i++) {
        const u = new THREE.Mesh(new THREE.BoxGeometry(4, 1.6, 3), new THREE.MeshLambertMaterial({ color: 0x4b5563 }));
        u.position.set(x - 6 + i * 6, 8.8, z); scene.add(u);
        const fan = new THREE.Mesh(new THREE.CircleGeometry(1.1, 14), new THREE.MeshBasicMaterial({ color: 0x22303f }));
        fan.position.set(x - 6 + i * 6, 9.62, z); fan.rotation.x = -Math.PI / 2; scene.add(fan);
      }
      serverLights();
      neon(x, 6, z + 8, 0x00e5ff); myLamp(x - 12, z + 10); myLamp(x + 12, z + 10);
    } else if (idx === 2) {
      createBuilding(x, z, 14, 9, 12, 0x1c2e40, '🏦 Банк FANTAZIA', 'biz_bank');
      places.bank = { x: x, z: z };
      for (let i = 0; i < 4; i++) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 7, 10), new THREE.MeshLambertMaterial({ color: 0xe8e4dc }));
        col.position.set(x - 5 + i * 3.3, 3.5, z + 6.4); scene.add(col);
      }
      const gold = new THREE.Mesh(new THREE.PlaneGeometry(13, 3.4), new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.2 }));
      gold.position.set(x, 6.6, z + 6.1); scene.add(gold);
      const atm = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2, 0.8), new THREE.MeshLambertMaterial({ color: 0x2c3e50 }));
      atm.position.set(x + 8.6, 1, z + 6.6); scene.add(atm);
      const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), new THREE.MeshBasicMaterial({ color: 0x00ff9d }));
      sc.position.set(x + 8.6, 1.3, z + 7.02); scene.add(sc);
      neon(x, 9.5, z + 7, 0xffd76a); myLamp(x - 10, z + 9); myLamp(x + 10, z + 9);
    } else if (idx === 3) {
      createBuilding(x, z, 20, 7, 16, 0xc0c8d0, '🚀 Космодром «Фантазия»', 'biz_space');
      places.space = { x: x, z: z };
      // Launchpad, terminal, tower and tanks share a reserved off-road parcel.
      const padX = x + 25, padZ = z;
      places.pad = { x: padX, z: padZ };
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 0.4, 26), new THREE.MeshLambertMaterial({ color: 0x6b7280 }));
      pad.position.set(padX, 0.2, padZ); scene.add(pad);
      const mark = new THREE.Mesh(new THREE.RingGeometry(4.6, 5.2, 30), new THREE.MeshBasicMaterial({ color: 0xffd76a, side: THREE.DoubleSide }));
      mark.rotation.x = -Math.PI / 2; mark.position.set(padX, 0.42, padZ); scene.add(mark);
      rocket = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 8, 14), new THREE.MeshLambertMaterial({ color: 0xf2f4f7 }));
      body.position.y = 4; rocket.add(body);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(1.3, 3, 14), new THREE.MeshLambertMaterial({ color: 0xe74c3c }));
      nose.position.y = 9.5; rocket.add(nose);
      for (let i = 0; i < 4; i++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.2, 1.6), new THREE.MeshLambertMaterial({ color: 0xe74c3c }));
        fin.position.set(Math.cos(i * Math.PI / 2) * 1.3, 0.9, Math.sin(i * Math.PI / 2) * 1.3);
        fin.rotation.y = -i * Math.PI / 2; rocket.add(fin);
      }
      const bell = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.0, 1.2, 14), new THREE.MeshLambertMaterial({ color: 0x374151 }));
      bell.position.y = -0.6; rocket.add(bell);
      const fl = new THREE.Mesh(new THREE.ConeGeometry(1.2, 4, 12), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.9 }));
      fl.position.y = -3; fl.rotation.x = Math.PI; fl.visible = false; rocket.add(fl);
      rocket.userData.flame = fl;
      rocket.position.set(padX, 0.4, padZ); scene.add(rocket);
      try { streetColliders.push({ x: padX, z: padZ, r: 2.2 }); } catch (e) {}
      const tower = new THREE.Mesh(new THREE.BoxGeometry(1.4, 12, 1.4), new THREE.MeshLambertMaterial({ color: 0x8a3030 }));
      tower.position.set(padX + 4.4, 6, padZ); scene.add(tower);
      streetColliders.push({x:padX+4.4,z:padZ,r:1.0});
      const arm = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.35, 0.35), new THREE.MeshLambertMaterial({ color: 0x8a3030 }));
      arm.position.set(padX + 2.6, 11.4, padZ); scene.add(arm);
      [-6, -3.4].forEach(off => {
        const tk = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 6, 14), new THREE.MeshLambertMaterial({ color: 0xdfe6e9 }));
        tk.position.set(padX + off, 3, padZ + 9); scene.add(tk);
        streetColliders.push({x:padX+off,z:padZ+9,r:1.4});
      });
      neon(x, 8, z + 9, 0xa29bfe); myLamp(x - 14, z + 12); myLamp(x + 14, z + 12);
      plantFlags();
    }
    return true;
  } catch (e) { console.warn('[layout] business', idx, e); return false; }
  finally { FZRoads.observe(scene.children.filter(o => !before.has(o)), id); }
  });
};
function serverLights() {
  try {
    if (!places.server || !S) return;
    if (!window._fz7SrvL) window._fz7SrvL = neon(places.server.x, 3, places.server.z + 8.5, 0x00e5ff);
    if (window._fz7SrvL) window._fz7SrvL.color.setHex(S.servers > S.offline ? 0x00e5ff : 0xff3b30);
  } catch (e) {}
}
function drawBillboard() {
  try {
    if (!bb) return;
    const c = bb.cv.getContext('2d'), W = bb.cv.width, Hh = bb.cv.height;
    const ads = [
      ['FANTAZIA RP', '#ffd76a', 'Город, который живёт'],
      ['БИЗНЕС-ЦЕНТР', '#7fd8ff', 'Открой своё дело!'],
      ['FZ-CLOUD', '#00e5ff', 'Серверы · ₿ · 99.98% uptime'],
      ['КОСМОДРОМ', '#a29bfe', 'Колонизируй планеты!'],
      ['БАНК FANTAZIA', '#ffd76a', 'Вклад 1%/мин · кредит'],
    ];
    const a = ads[bb.i % ads.length];
    const g = c.createLinearGradient(0, 0, W, Hh);
    g.addColorStop(0, '#1b2140'); g.addColorStop(1, '#0b0f1a');
    c.fillStyle = g; c.fillRect(0, 0, W, Hh);
    c.fillStyle = a[1];
    c.fillRect(0, 0, W, 6); c.fillRect(0, Hh - 6, W, 6);
    c.font = 'bold 52px Arial'; c.textAlign = 'center';
    c.fillText(a[0], W / 2, 110);
    c.fillStyle = '#dfe6e9'; c.font = '26px Arial';
    c.fillText(a[2], W / 2, 160);
    const x = (Date.now() / 8) % (W + 140) - 70;
    const lg = c.createLinearGradient(x - 40, 0, x + 40, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,0.16)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = lg; c.fillRect(x - 40, 0, 80, Hh);
    c.fillStyle = '#7cffb2'; c.font = 'bold 20px Arial';
    c.fillText('▶ ИГРАЙ · СТРОЙ · КОЛОНИЗИРУЙ', W / 2, 226);
    if (bb.tex) bb.tex.needsUpdate = true;
  } catch (e) {}
}
function dronesInit() {
  try {
    if (droneList.length) return;
    const c = places.office || { x: 40, z: 40 };
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 1.1), new THREE.MeshLambertMaterial({ color: 0x2f3640 })));
      [[-0.8, 0], [0.8, 0], [0, -0.8], [0, 0.8]].forEach(([ax, az]) => {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.09, 0.16), new THREE.MeshLambertMaterial({ color: 0x57606f }));
        arm.position.set(ax * 0.5, 0.06, az * 0.5); g.add(arm);
        const rot = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.06), new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.45 }));
        rot.position.set(ax, 0.2, az); rot.userData.spin = true; g.add(rot);
      });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
      lamp.position.set(0, -0.24, 0); g.add(lamp);
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.5), new THREE.MeshLambertMaterial({ color: 0xe1b12c }));
      pack.position.set(0, -0.42, 0); g.add(pack);
      const r = 22 + i * 9, h = 17 + i * 3;
      g.position.set(c.x + r, h, c.z);
      scene.add(g);
      droneList.push({ g: g, r: r, h: h, a: i * 1.7, sp: 0.09 + i * 0.03, cx: c.x, cz: c.z, lamp: lamp, lit: false });
    }
  } catch (e) {}
}
function dronesUpdate(dt) {
  if (!droneList.length) return;
  const night = (window.FZDN && window.FZDN.nightF) || 0;
  droneList.forEach((d, i) => {
    d.a += dt * d.sp;
    d.g.position.set(d.cx + Math.cos(d.a) * d.r, d.h + Math.sin(d.a * 2.3) * 1.4, d.cz + Math.sin(d.a) * d.r);
    d.g.rotation.y = -d.a;
    d.g.children.forEach(ch => { if (ch.userData.spin) ch.rotation.y += dt * 26; });
    d.lamp.visible = Math.floor(Date.now() / 500 + i) % 2 === 0;
    if (!d.lit && night > 0.4) {
      try { const L = new THREE.PointLight(0xff3b30, 0.9, 12); L.position.set(0, -0.4, 0); d.g.add(L); d.lit = true; } catch (e) {}
    }
  });
}
function plantFlags() {
  try {
    if (!places.space || !S) return;
    const P = places.pad || { x: places.space.x, z: places.space.z + 17 };
    const padX = P.x, padZ = P.z;
    COLONIES.forEach((w, i) => {
      if (!S.cols[w.id] || flags[w.id]) return;
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.4, 6), new THREE.MeshLambertMaterial({ color: 0xcfd6dd }));
      pole.position.y = 1.7; g.add(pole);
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), new THREE.MeshLambertMaterial({ color: w.color, side: THREE.DoubleSide }));
      cloth.position.set(0.8, 3, 0); g.add(cloth);
      g.position.set(padX - 7 + i * 3.5, 0.4, padZ + 6.5);
      scene.add(g); flags[w.id] = g;
    });
  } catch (e) {}
}
function launchRocket(id) {
  try {
    if (!rocket) { plantFlags(); return; }
    rocket.position.y = 0.4;
    rocket.rotation.z = 0;
    rocket.userData.launch = { t: 0, world: id };
    sfx('roar');
    setTimeout(() => { try { if (typeof SFX !== 'undefined') SFX.noise(1.2, 0.25, 500); } catch (e) {} }, 900);
  } catch (e) {}
}
function rocketUpdate(dt) {
  try {
    if (!rocket) return;
    const L = rocket.userData.launch;
    const fl = rocket.userData.flame;
    if (!L) { if (fl) fl.visible = false; return; }
    if (fl) { fl.visible = true; fl.scale.set(1 + Math.random() * 0.35, 0.8 + Math.random() * 0.7, 1 + Math.random() * 0.35); }
    L.t += dt;
    rocket.position.y = 0.4 + L.t * L.t * 9;
    rocket.rotation.z = Math.min(0.22, L.t * 0.07);
    if (L.t > 5.2) {
      rocket.userData.launch = null;
      rocket.position.y = 0.4; rocket.rotation.z = 0;
      if (fl) fl.visible = false;
      plantFlags();
      note('🚀 Корабль вышел на орбиту. Флаг колонии остался на площадке!', 'success');
    }
  } catch (e) {}
}

// ---------------- ЦИКЛ ----------------
function onMinute() {
  const r = econTick(1, false);
  if (S.servers > 0) {
    const cap = capacity();
    if (S.servers > cap) {
      if (S.offline < S.servers - cap) {
        S.offline++; sfx('fail');
        note('🔥 Перегрев! Стойка отключилась. Нужно охлаждение или ремонт.', 'error');
      }
    } else if (S.offline > 0) {
      S.offline--; note('🔧 Инженер подлатал стойку — вернулась в сеть.', 'info');
    }
    if (S.offline || Math.random() < 0.3) serverLights();
  }
  if (S.loan > 0) S.loan = Math.round(S.loan * 1.01);
  save();
  if (r.gain > 0 || r.btc > 0) {
    const parts = [];
    if (r.gain > 0) parts.push('+' + fmt(r.gain) + ' $');
    if (r.btc > 0) parts.push('+' + r.btc + ' ₿');
    note('💼 Доход корпорации: ' + parts.join(' и '), 'money');
  }
  checkQuests();
  if (S.loan > 15000 && Math.random() < 0.25) note('💳 Банк напоминает: долг ' + fmt(S.loan) + ' $. Проценты капают!', 'error');
  if (Math.random() < 0.12 && incomeMin() > 0) {
    const msgs = ['💼 Корпорация растёт: ' + fmt(incomeMin()) + ' $/мин', '₿ Курс ' + fmt(S.rate) + '$ за 1 ₿', '🚀 Колонии работают: ' + COLONIES.filter(w => S.cols[w.id]).length + '/5', '💻 Терминал в датацентре ждёт взлома'];
    note(msgs[Math.floor(Math.random() * msgs.length)], 'info');
  }
}
function initOnce() {
  try { dockInit(); } catch (e) {}
  T.acc = 0; T.bacc = 0; T.dacc = 0;
  const now = Date.now();
  const el = Math.max(0, (now - (S.last || now)) / 1000);
  const cycles = Math.floor(el / 60);
  if (cycles >= 2) {
    const r = econTick(Math.min(cycles, 240), true);
    const h = Math.floor(el / 3600), m = Math.floor(el % 3600 / 60);
    const when = (h ? h + ' ч ' : '') + m + ' мин';
    setTimeout(() => bigBanner('💼 КОРПОРАЦИЯ РАБОТАЛА БЕЗ ТЕБЯ', 'Прошло: <b>' + when + '</b><br>Доход: <b>+' + fmt(r.gain) + ' $</b>' + (r.btc ? ' и <b>+' + r.btc + ' ₿</b>' : ''), 'success'), 7000);
  } else { S.last = now; save(); }
  if (!S.gift) {
    S.gift = true; S.servers = Math.max(S.servers, 1); save();
    setTimeout(() => bigBanner('🏢 КОРПОРАЦИЯ FANTAZIA', 'Город вырос: <b>бизнес-центр</b>, <b>датацентр</b>, <b>банк</b> и <b>космодром</b>.<br>Первая серверная стойка — подарок! Кнопки справа: 💼 🖥️ 🏦 🚀 💻', 'info'), 9500);
    note('🎁 Подарок: первая серверная стойка уже работает', 'success');
  }
  checkQuests();
  dockRefresh();
  if (!T.started) {
    T.started = true;
    setTimeout(() => { dronesInit(); plantFlags(); }, 7000);
    setTimeout(() => { if (bb) { bb.i++; drawBillboard(); } }, 5000);
  }
}
function FZ7_update(delta) {
  const dt = Math.min(delta || 0.016, 0.1);
  if (!S) { load(); initOnce(); }
  if (!S) return;
  T.acc += dt;
  if (T.acc >= 60) { T.acc -= 60; onMinute(); }
  T.bacc += dt;
  if (T.bacc >= 15) {
    T.bacc -= 15;
    S.rate = Math.round(clamp(S.rate * (1 + (Math.random() - 0.47) * 0.11), 32, 540) * 100) / 100;
    S.hist.push(S.rate); if (S.hist.length > 40) S.hist.shift();
    save();
  }
  T.dacc += dt;
  if (T.dacc >= 1) { T.dacc -= 1; dockRefresh(); }
  dronesUpdate(dt);
  rocketUpdate(dt);
  billboardT += dt;
  if (billboardT > 3.4) { billboardT = 0; if (bb) { bb.i++; drawBillboard(); } }
  if (window._fz7Beacon) {
    window._fz7Beacon.t += dt;
    window._fz7Beacon.m.visible = window._fz7Beacon.t % 1.4 < 0.7;
  }
  if (window._fz7SrvL) window._fz7SrvL.intensity = ((window.FZDN && window.FZDN.nightF) || 0.2) * 1.2;
  if (holo.length) holo.forEach((m, i) => { try { m.rotation.y += dt * (0.4 + i * 0.1); } catch (e) {} });
  const inB = (typeof isInsideBuilding !== 'undefined' && isInsideBuilding);
  const bt = (inB && typeof currentBuildingType !== 'undefined' && currentBuildingType) ? currentBuildingType : '';
  if (inB && bt === 'biz_server' && !inServerRoom) { inServerRoom = true; try { SFX.humStart(42, 0.035); } catch (e) {} }
  else if ((!inB || bt !== 'biz_server') && inServerRoom) { inServerRoom = false; try { SFX.humStop(); } catch (e) {} }
  Object.keys(npcCache).forEach(k => { try { npcCache[k].visible = !!(inB && bt === k); } catch (e) {} });
  deliverUpdate(dt);
}
window.FZ7_update = FZ7_update;
window.FZ7_state = function () { return S; };
})();
