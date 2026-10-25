// ============================================================
//  FANTAZIA RP 3D — v8.4 «МЕТРО»
//  Модуль: кольцевая линия метро, поезда, билеты, станции
// ============================================================
(function () {
'use strict';
if(window.FZ_METRO23)return;
function G(n) { try { return window[n]; } catch (e) { return undefined; } }
function $(id) { try { return document.getElementById(id); } catch (e) { return null; } }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function fmt(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
function money() { try { return (G('localPlayer') && G('localPlayer').money) || window.localMoney || 0; } catch (e) { return 0; } }
function addMoney(v) {
  v = Number(v); if (!isFinite(v)) v = 0;
  let before = null;
  try { const lp0 = G('localPlayer'); before = (lp0 && typeof lp0.money === 'number') ? lp0.money : null; } catch (e) {}
  let applied = false;
  try { if (G('FZ8H') && G('FZ8H').addMoney) { G('FZ8H').addMoney(v); applied = true; } } catch (e) {}
  if (!applied) { try { if (typeof window.addMoney === 'function') { window.addMoney(v); applied = true; } } catch (e) {} }
  if (!applied) { try { if (typeof G('addMoney') === 'function') { G('addMoney')(v); applied = true; } } catch (e) {} }
  try {
    const lp = G('localPlayer');
    if (lp && typeof lp.money === 'number') {
      if (before !== null && lp.money === before && v !== 0) lp.money = Math.max(0, lp.money + v);
      window.localMoney = lp.money;
    } else { window.localMoney = Math.max(0, (window.localMoney || 0) + v); }
  } catch (e) {}
  try { const d = $('moneyDisplay'); if (d) d.textContent = '$' + fmt(money()); } catch (e) {}
}
function addCoins(v) {
  try {
    window.localCoins = (window.localCoins || 0) + v;
    const d = $('coinsDisplay'); if (d) d.textContent = '💎 ' + (window.localCoins || 0);
  } catch (e) {}
}
function notify(text, kind) { try { if (G('showNotification')) G('showNotification')(text, kind); } catch (e) {} }
function banner(t, s) { try { if (G('showWorldEventBanner')) G('showWorldEventBanner')(t, s); } catch (e) {} }
function xp(skill, v) { try { if (G('FZ8L') && G('FZ8L').addXP) G('FZ8L').addXP(skill, v); } catch (e) {} }
function fx(k, a, b, c) { try { if (G('FZFX') && G('FZFX')[k]) G('FZFX')[k](a, b, c); } catch (e) {} }
function puff(x, y, z, r, col, life, up) { try { if (G('FZFX') && G('FZFX').puff) G('FZFX').puff(x, y, z, r, col, life, up); } catch (e) {} }
function pp() { try { return { x: G('localPlayer').mesh.position.x, z: G('localPlayer').mesh.position.z }; } catch (e) { return { x: 0, z: 0 }; } }
function lifeS() { try { return G('FZ8L') && G('FZ8L').S; } catch (e) { return null; } }

const SKEY = 'fz8_metro';
const DEF = {
  rides: 0, tickets: 0, card: false, fines: 0, tips: 0, coins: 0, dist: 0, stations: [], lost: {}, busk: 0,
  ach: [], seen: false, express: 0, best: 0, passengers: 0, inspects: 0, shopAt: {},
};
let M = JSON.parse(JSON.stringify(DEF));
let dirty = false;
function saveM(now) {
  dirty = true;
  if (!now) return;
  try { localStorage.setItem(SKEY, JSON.stringify(M)); } catch (e) {}
  dirty = false;
}
function loadM() {
  try {
    const raw = localStorage.getItem(SKEY);
    if (raw) { const o = JSON.parse(raw); Object.keys(DEF).forEach(k => { if (o[k] !== undefined) M[k] = o[k]; }); }
  } catch (e) {}
}
function checkA(id) {
  if (!id || M.ach.indexOf(id) >= 0) return false;
  if (ACH[id] && ACH[id].test && !ACH[id].test()) return false;
  M.ach.push(id);
  const a = ACH[id] || {};
  notify('🏅 Достижение метро: ' + (a.name || id) + (a.prize ? ' (+$' + fmt(a.prize) + ')' : ''));
  if (a.prize) addMoney(a.prize);
  if (a.gems) addCoins(a.gems);
  saveM(true);
  return true;
}
const ACH = {
  metro1:   { name: 'Первый билет',      desc: 'Купить билет в метро',                prize: 700,  test: () => M.tickets >= 1 },
  metroRide:{ name: 'Пассажир',          desc: 'Совершить первую поездку',             prize: 1200, test: () => M.rides >= 1 },
  metroAll: { name: 'Всё кольцо',        desc: 'Побывать на всех 5 станциях',          prize: 6000, test: () => M.stations.length >= 5 },
  metroCard:{ name: 'Проездной',         desc: 'Купить сезонную карту метро',          prize: 2500, test: () => M.card },
  metroFar: { name: 'Дальний рейс',      desc: 'Проехать 5 000 м в метро',             prize: 4200, test: () => M.dist >= 5000 },
  metroBusk:{ name: 'Уличный музыкант',  desc: 'Оставить 3 монеты музыканту в метро',  prize: 1800, test: () => M.tips >= 3 },
  metro10:  { name: 'Завсегдатай',       desc: 'Совершить 10 поездок',                 prize: 5000, test: () => M.rides >= 10 },
  metroLost:{ name: 'Бюро находок',      desc: 'Найти забытую вещь на станции',        prize: 1500, test: () => Object.keys(M.lost).length >= 1 },
};
// ---------------- СТАНЦИИ ----------------
const STATIONS = [
  { id: 'center',   name: 'Центральная',  ox: 0,    oz: 0,    zone: null,         color: 0xffd76a },
  { id: 'factory',  name: 'Заводская',    ox: 350,  oz: 34,   zone: 'industrial', color: 0xff8a5b },
  { id: 'park',     name: 'Парковая',     ox: 280,  oz: 254,  zone: 'park',       color: 0x7cffb2 },
  { id: 'port',     name: 'Портовая',     ox: -260, oz: 224,  zone: 'port',       color: 0x5bc8ff },
  { id: 'business', name: 'Деловая',      ox: 260,  oz: -236, zone: 'business',   color: 0xc39bff },
];
const LINES = [
  { id: 'ring', name: 'Кольцевая', stations: ['center', 'factory', 'park', 'port', 'business'] },
];

// ---------------- ГЕОМЕТРИЯ ----------------
function labelMesh(text, w, h, color, bg) {
  try {
    const T = G('THREE');
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 192;
    const c = cv.getContext('2d');
    c.fillStyle = bg || 'rgba(8,6,18,0.88)'; c.fillRect(0, 0, 1024, 192);
    c.fillStyle = color || '#ffffff'; c.font = 'bold 104px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 512, 100);
    c.strokeStyle = color || '#ffffff'; c.lineWidth = 6; c.strokeRect(6, 6, 1012, 180);
    return new T.Mesh(new T.PlaneGeometry(w || 12, h || 2.2), new T.MeshBasicMaterial({ map: new T.CanvasTexture(cv), transparent: true, side: T.DoubleSide }));
  } catch (e) { return null; }
}
function freeSpot(x, z, r) {
  try {
    const bld = G('buildings') || [];
    for (let ring = 0; ring < 8; ring++) {
      for (let a = 0; a < 12; a++) {
        const ang = a / 12 * Math.PI * 2, rr = ring * 12;
        const px = x + Math.cos(ang) * rr, pz = z + Math.sin(ang) * rr;
        let ok = true;
        for (let i = 0; i < bld.length; i++) {
          const b = bld[i];
          if (!b || !b.bounds) continue;
          if (px > b.bounds.minX - r && px < b.bounds.maxX + r && pz > b.bounds.minZ - r && pz < b.bounds.maxZ + r) { ok = false; break; }
        }
        if (ok) return { x: px, z: pz };
      }
    }
  } catch (e) {}
  return { x: x, z: z };
}
function stationDecor(st, g, mk, mats) {
  try {
    const T = G('THREE');
    const hh = st.heading || 0;
    const l2w2 = (lx, lz) => ({ x: st.bx + lx * Math.cos(hh) + lz * Math.sin(hh), z: st.bz - lx * Math.sin(hh) + lz * Math.cos(hh) });
    const steelM = new T.MeshLambertMaterial({ color: 0x9aa2ad });
    const yellow = new T.MeshBasicMaterial({ color: 0xffd76a });
    const lampOn = new T.MeshBasicMaterial({ color: 0xfff2d0 });
    const camM = new T.MeshLambertMaterial({ color: 0x2b2f36 });
    // жёлтая полоса безопасности и тактильная плитка у края платформы
    mk(new T.BoxGeometry(19.6, 0.05, 0.3), yellow, 0, 0.24, -2.62);
    const tile = new T.InstancedMesh(new T.BoxGeometry(0.42, 0.05, 0.42), new T.MeshLambertMaterial({ color: 0xc9a227 }), 20);
    const dmy = new T.Object3D();
    for (let i = 0; i < 20; i++) { dmy.position.set(-9.3 + i * 0.98, 0.25, -2.15); dmy.updateMatrix(); tile.setMatrixAt(i, dmy.matrix); }
    g.add(tile);
    // перила вдоль платформы (две линии поручней)
    for (let i = 0; i < 7; i++) {
      const p1 = mk(new T.CylinderGeometry(0.06, 0.06, 1.05, 8), steelM, -9 + i * 3, 0.72, -2.45);
      void p1;
    }
    const rail1 = mk(new T.BoxGeometry(19.4, 0.08, 0.08), steelM, 0, 1.24, -2.45);
    void rail1;
    const rail2 = mk(new T.BoxGeometry(19.4, 0.06, 0.06), steelM, 0, 0.95, -2.45);
    void rail2;
    // плафоны на навесе
    for (let i = 0; i < 6; i++) mk(new T.BoxGeometry(1.5, 0.09, 0.4), lampOn, -8.5 + i * 3.4, 4.05, 0.9);
    // скамейки (2 ряда по 2) дальше от края
    for (let i = 0; i < 4; i++) {
      const bx = -6 + (i % 2) * 12, bz = 1.5 + Math.floor(i / 2) * 0.9;
      mk(new T.BoxGeometry(2.6, 0.14, 0.6), mats.dark, bx, 0.62, bz);
      mk(new T.BoxGeometry(2.6, 0.5, 0.12), mats.dark, bx, 0.92, bz - 0.26);
      [-1.1, 1.1].forEach(ox => mk(new T.BoxGeometry(0.14, 0.34, 0.5), mats.conc, bx + ox, 0.4, bz));
    }
    // урны и кадки с растениями
    [-8.5, 8.5].forEach(x => { mk(new T.CylinderGeometry(0.34, 0.28, 0.95, 10), camM, x, 0.7, 1.6); mk(new T.CylinderGeometry(0.36, 0.36, 0.1, 10), steelM, x, 1.2, 1.6); });
    [-4, 4].forEach(x => {
      mk(new T.CylinderGeometry(0.42, 0.32, 0.6, 10), new T.MeshLambertMaterial({ color: 0x8a5a3a }), x, 0.5, 2.2);
      mk(new T.SphereGeometry(0.5, 10, 8), new T.MeshLambertMaterial({ color: 0x2f7a45 }), x, 1.05, 2.2);
    });
    // видеокамеры на колоннах
    [-8.6, 8.6].forEach((x, i) => {
      const cam = mk(new T.BoxGeometry(0.34, 0.24, 0.5), camM, x, 3.5, -1.4);
      cam.rotation.y = i ? -0.6 : 0.6;
      const led = mk(new T.SphereGeometry(0.06, 6, 6), new T.MeshBasicMaterial({ color: 0xff5b5b }), x, 3.36, -1.4);
      void led;
    });
    // табло «следующий поезд» и часы
    const bd = makeBoard(7.4, 1.85);
    if (bd) { bd.mesh.position.set(-5.4, 3.1, 1.2); g.add(bd.mesh); st.board = bd; }
    const ck = makeBoard(2.6, 0.9);
    if (ck) { ck.mesh.position.set(7.6, 3.2, 1.2); g.add(ck.mesh); st.clock = ck; drawBoard(ck, realClock(), 'город'); }
    // указатели направлений и схема линии
    const dir1 = makeBoard(5.2, 0.8);
    if (dir1) { dir1.mesh.position.set(-2.2, 3.5, 1.2); g.add(dir1.mesh); drawBoard(dir1, '← ' + 'к центру', 'кольцевая линия'); }
    const dir2 = makeBoard(5.2, 0.8);
    if (dir2) { dir2.mesh.position.set(3.2, 3.5, 1.2); g.add(dir2.mesh); drawBoard(dir2, '🚪 Выход в город', 'к остановкам и такси'); }
    const mapB = makeBoard(4.6, 1.6);
    if (mapB) { mapB.mesh.position.set(0, 1.9, 2.72); mapB.mesh.rotation.y = Math.PI; g.add(mapB.mesh); drawBoard(mapB, '🚇 СХЕМА КОЛЬЦА', '5 станций · 2.1 км · 15 м/с'); }
    // лестница на платформу (с внешней стороны, там где выход в город) + перила
    const stepM = new T.MeshLambertMaterial({ color: 0x60646a });
    for (let i = 0; i < 4; i++) mk(new T.BoxGeometry(4.6, 0.06, 0.44), stepM, 0, 0.03 + i * 0.055, 3.05 + i * 0.44);
    [-2.4, 2.4].forEach(ox => {
      mk(new T.BoxGeometry(0.09, 0.95, 2.6), steelM, ox, 0.6, 3.9);
      mk(new T.BoxGeometry(0.09, 0.09, 2.6), steelM, ox, 1.05, 3.9);
      mk(new T.CylinderGeometry(0.09, 0.09, 1.0, 8), steelM, ox, 0.5, 5.15);
    });
    // портал выхода: стойки, вывеска «МЕТРО» наружу и внутрь
    [-3.6, 3.6].forEach(ox => mk(new T.CylinderGeometry(0.12, 0.12, 3.0, 8), camM, ox, 1.5, 2.9));
    mk(new T.BoxGeometry(8.0, 0.35, 0.5), camM, 0, 3.05, 2.9);
    const exitSign = makeBoard(7, 1.2);
    if (exitSign) { exitSign.mesh.position.set(0, 3.9, 2.94); g.add(exitSign.mesh); drawBoard(exitSign, 'МЕТРО', 'станция «' + st.name + '»'); }
    // пожарный щит и автомат пополнения
    mk(new T.BoxGeometry(1.2, 0.9, 0.2), new T.MeshLambertMaterial({ color: 0xa02a2a }), 9.2, 1.6, 2.7);
    mk(new T.BoxGeometry(0.9, 1.6, 0.6), camM, 6.4, 0.9, 1.9);
    mk(new T.PlaneGeometry(0.6, 0.7), new T.MeshBasicMaterial({ color: 0x7cffb2 }), 6.4, 1.05, 2.21).rotation.y = Math.PI;
    // турникеты с открывающимися створками (створки анимируются рядом с игроком)
    const gates = [];
    [-4.6, -3.4, -2.2].forEach((gx, gi) => {
      const body2 = mk(new T.BoxGeometry(0.5, 1.05, 0.9), mats.conc, gx, 0.62, 2.4);
      void body2;
      const door = new T.Group();
      const panel = new T.Mesh(new T.BoxGeometry(0.9, 0.8, 0.08), new T.MeshLambertMaterial({ color: 0x2b2f36, transparent: true, opacity: 0.9 }));
      panel.position.set(0.45, 0, 0); door.add(panel);
      const wp = l2w2(gx + 0.25, 2.4);
      door.position.set(gx + 0.25, 0.85, 2.4); g.add(door);
      gates.push({ panels: [door], open: 0, gi: gi, x: wp.x, z: wp.z });
    });
    st.gates = gates;
    for (let i = 0; i < gates.length; i++) railKit.gates.push(gates[i]);
    return true;
  } catch (e) { return false; }
}
function buildStation(st) {
  try {
    const T = G('THREE'), sc = G('scene');
    if (!T || !sc) return null;
    const spot = freeSpot(st.ox, st.oz, 22);
    st.x = spot.x; st.z = spot.z;
    // платформа смещена наружу от центра кольца: путь проходит мимо неё в 4.8 м
    const h = Math.atan2(st.x, st.z);                 // направление «наружу от центра города»
    st.heading = h;
    let off2 = 4.8;
    const bld = G('buildings') || [];
    const blockedAt = (px, pz) => bld.some(b => b && b.bounds && px > b.bounds.minX - 11 && px < b.bounds.maxX + 11 && pz > b.bounds.minZ - 11 && pz < b.bounds.maxZ + 11);
    for (let tryI = 0; tryI < 7; tryI++) {
      const bx = st.x + Math.sin(h) * off2, bz = st.z + Math.cos(h) * off2;
      if (!blockedAt(bx, bz)) break;
      off2 += 5;
    }
    st.bx = st.x + Math.sin(h) * off2;
    st.bz = st.z + Math.cos(h) * off2;
    const g = new T.Group();
    const conc = new T.MeshLambertMaterial({ color: 0x4a4f58 });
    const dark = new T.MeshLambertMaterial({ color: 0x24282f });
    const glass = new T.MeshLambertMaterial({ color: 0x8fd6ff, transparent: true, opacity: 0.35 });
    const line = new T.MeshLambertMaterial({ color: st.color });
    const mk = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
    mk(new T.BoxGeometry(20, 0.22, 5.6), conc, 0, 0.11, 0);                 // платформа
    mk(new T.BoxGeometry(20, 0.26, 0.5), line, 0, 0.13, 2.75);              // цветная кромка с внешней стороны
    for (let i = 0; i < 6; i++) mk(new T.CylinderGeometry(0.13, 0.13, 3.9, 8), dark, -8.6 + i * 3.4, 2.15, 0.4);
    mk(new T.BoxGeometry(20.6, 0.28, 5.0), dark, 0, 4.2, 0.5);              // навес над дальней половиной
    mk(new T.BoxGeometry(20.6, 0.12, 5.0), line, 0, 4.4, 0.5);
    const sign = labelMesh('🚇 ' + st.name, 13, 2.4, '#' + st.color.toString(16).padStart(6, '0'));
    if (sign) { sign.position.set(0, 5.6, 0.4); g.add(sign); }
    const glassStrip = mk(new T.BoxGeometry(18.4, 2.0, 0.06), glass, 0, 1.1, 2.45);
    void glassStrip;
    // билетный автомат, снек-автомат, бюро находок, музыкант, стойки
    const tv = mk(new T.BoxGeometry(1.0, 1.8, 0.7), dark, 2.4, 1.0, 2.0);
    void tv;
    mk(new T.PlaneGeometry(0.8, 0.9), new T.MeshBasicMaterial({ color: 0x7cffb2 }), 2.4, 1.25, 2.36).rotation.y = Math.PI;
    const vending = mk(new T.BoxGeometry(1.1, 2.0, 0.8), new T.MeshLambertMaterial({ color: 0x7a2d3a }), -2.4, 1.1, 1.9);
    void vending;
    mk(new T.PlaneGeometry(0.7, 1.0), new T.MeshBasicMaterial({ color: 0xffd76a }), -2.4, 1.25, 2.31).rotation.y = Math.PI;
    mk(new T.BoxGeometry(1.2, 0.8, 0.9), new T.MeshLambertMaterial({ color: 0x6b4a2a }), 6.5, 0.5, -2.0);
    // музыкант
    const mus = new T.Group();
    const msBody = new T.Mesh(new T.BoxGeometry(0.6, 0.85, 0.4), new T.MeshLambertMaterial({ color: 0x2f6b8a })); msBody.position.y = 0.85; mus.add(msBody);
    const msHead = new T.Mesh(new T.BoxGeometry(0.36, 0.36, 0.36), new T.MeshLambertMaterial({ color: 0xd0a37a })); msHead.position.y = 1.5; mus.add(msHead);
    const gui = new T.Mesh(new T.BoxGeometry(0.34, 0.5, 0.12), new T.MeshLambertMaterial({ color: 0x8a5a2a })); gui.position.set(0.4, 0.9, 0.25); gui.rotation.z = -0.5; mus.add(gui);
    const stool = new T.Mesh(new T.BoxGeometry(0.5, 0.5, 0.5), dark); stool.position.y = 0.25; mus.add(stool);
    mus.position.set(8.4, 0, -1.6); g.add(mus);
    // пассажиры
    const pax = [];
    for (let i = 0; i < 5; i++) {
      const c = new T.Group();
      const col = pick([0x3b4a6b, 0x6b3b4a, 0x4a6b3b, 0x6b5a3b, 0x3b6b6b]);
      const b2 = new T.Mesh(new T.BoxGeometry(0.6, 0.9, 0.36), new T.MeshLambertMaterial({ color: col })); b2.position.y = 0.85; c.add(b2);
      const h2 = new T.Mesh(new T.BoxGeometry(0.34, 0.34, 0.34), new T.MeshLambertMaterial({ color: 0xc79a72 })); h2.position.y = 1.5; c.add(h2);
      [[-0.14], [0.14]].forEach(([ox]) => { const l = new T.Mesh(new T.BoxGeometry(0.22, 0.8, 0.24), new T.MeshLambertMaterial({ color: 0x2b2f36 })); l.position.set(ox, 0.4, 0); c.add(l); });
      c.position.set(-8 + i * 3.4, 0.22, -1.3); c.userData.ph = Math.random() * 6.28; c.userData.home = { x: c.position.x, z: c.position.z };
      g.add(c); pax.push(c);
    }
    stationDecor(st, g, mk, { conc: conc, dark: dark, glass: glass, line: line });
    st.pax = pax; st.group = g;
    g.position.set(st.bx, 0, st.bz);
    g.rotation.y = h;
    sc.add(g);
    const l2w = (lx, lz) => ({ x: st.bx + lx * Math.cos(h) + lz * Math.sin(h), z: st.bz - lx * Math.sin(h) + lz * Math.cos(h) });
    const tvp = l2w(2.4, 2.0), vp = l2w(-2.4, 1.9), lp = l2w(6.5, -0.4), mp = l2w(8.4, -0.2), bp = l2w(0, -2.2);
    addInter(tvp.x, tvp.z, 'fz8m_ticket', '🎫 Билетный автомат: билет $40 / сезонная карта $4 000', 3.4);
    addInter(vp.x, vp.z, 'fz8m_vend', '🥤 Автомат с напитками и снеками ($90)', 3.2);
    addInter(lp.x, lp.z, 'fz8m_lost', '📦 Бюро находок (забытые вещи)', 3.2);
    addInter(mp.x, mp.z, 'fz8m_busk', '🎸 Уличный музыкант в метро', 3.2);
    addInter(bp.x, bp.z, 'fz8m_board', '🚇 Посадка на поезд «Кольцевая»', 6.0);
    st.spots = { board: bp, ticket: tvp, vend: vp, lost: lp, busk: mp };
    return st;
  } catch (e) { return null; }
}
function addInter(x, z, type, name, range) {
  try { G('interactables').push({ position: { x: x, y: 0, z: z }, type: type, name: name, range: range || 3.4, fz8: true, fz8m: true }); } catch (e) {}
}
// ---------------- ТАБЛО, ЧАСЫ, ПОДСВЕТКА ----------------
function makeBoard(w, h) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
  const c = cv.getContext('2d');
  // jsdom: could be null
  const T = G('THREE');
  const tex = new T.CanvasTexture(cv);
  const mat = new T.MeshBasicMaterial({ map: tex, transparent: true });
  const mesh = new T.Mesh(new T.PlaneGeometry(w || 6, h || 1.5), mat);
  return { cv: cv, c: c, tex: tex, mesh: mesh, l1: '', l2: '' };
}
function drawBoard(b, l1, l2) {
  if (!b || !b.c) return;
  if (b.l1 === l1 && b.l2 === l2) return;
  b.l1 = l1; b.l2 = l2;
  const SMALL = [[1024, 192, 104], [512, 128, 46], [256, 64, 26], [128, 32, 14]];
  const fit = SMALL.find(f => f[0] === b.cv.width + 0) || [512, 128, 46];
  const c = b.c, W = b.cv.width, H = b.cv.height;
  const fs = fit[2];
  c.clearRect(0, 0, W, H);
  c.fillStyle = 'rgba(6,10,16,0.92)'; c.fillRect(0, 0, W, H);
  c.strokeStyle = '#5bc8ff'; c.lineWidth = Math.max(2, W / 128); c.strokeRect(3, 3, W - 6, H - 6);
  c.fillStyle = '#dff3ff'; c.font = 'bold ' + fs + 'px Arial'; c.textAlign = 'left'; c.textBaseline = 'middle';
  c.fillText(String(l1 || ''), W * 0.035, H * (l2 ? 0.36 : 0.5));
  if (l2) {
    c.fillStyle = '#7cffb2'; c.font = 'bold ' + Math.round(fs * 0.68) + 'px Arial';
    c.fillText(String(l2), W * 0.035, H * 0.74);
  }
  if (b.tex) b.tex.needsUpdate = true;
}
function realClock() {
  let h = 12, m = 0;
  try {
    if (window.FZDN && typeof window.FZDN.hours === 'number') { h = Math.floor(window.FZDN.hours); m = Math.floor((window.FZDN.hours % 1) * 60); }
    else { const d = new Date(); h = d.getHours(); m = d.getMinutes(); }
  } catch (e) {}
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}
function ringStats() {
  const order = LINES[0].stations;
  const sts = (train && train.stations ? train.stations : STATIONS);
  let total = 0, n = 0;
  for (let i = 0; i < order.length; i++) {
    const a = sts.find(x => x.id === order[i]), b = sts.find(x => x.id === order[(i + 1) % order.length]);
    if (!a || !b) continue;
    total += Math.hypot(b.x - a.x, b.z - a.z); n++;
  }
  return { len: total, segs: n, segAvg: n ? total / n : 400 };
}
function etaToStation(st) {
  if (!train || !st) return '';
  const order = LINES[0].stations;
  const idx = order.indexOf(st.id);
  if (idx < 0) return '';
  if (train.state === 'dwell') {
    if (train.seg === idx) return 'стоит у платформы · двери открыты';
    const segsTo0 = (idx - train.seg + order.length) % order.length;
    return 'через ~' + Math.round(train.dwell + segsTo0 * (ringStats().segAvg / TRAIN.speed + TRAIN.dwellTime)) + ' с';
  }
  const si = segInfo(train.stations || STATIONS, train.seg);
  const rest = (si.len * (1 - train.t)) / train.speed;
  const segsTo = (idx - train.seg + order.length) % order.length;
  const perSeg = ringStats().segAvg / TRAIN.speed + TRAIN.dwellTime;
  return 'через ~' + Math.max(3, Math.round(rest + Math.max(0, segsTo - 1) * perSeg)) + ' с';
}
function updateDecor(dt) {
  decorT.board += dt; decorT.clock += dt;
  try {
    if (decorT.board > 0.5) {
      decorT.board = 0;
      STATIONS.forEach(st => { if (st.board) drawBoard(st.board, '→ след. ' + nextStationFromStation(st), etaToStation(st)); });
      if (train) {
        if (train.routeBoard) drawBoard(train.routeBoard, '→ ' + nextStationName(), train.state === 'dwell' ? 'двери открыты' : 'через ' + eta() + ' с');
        if (train.sideBoards) train.sideBoards.forEach(b => drawBoard(b, 'Кольцевая · ' + nextStationName(), 'СТАНЦИЯ: ' + (train.state === 'dwell' ? (trainAtStation() ? trainAtStation().name : '') : 'следующая')));
      }
    }
    if (decorT.clock > 10) { decorT.clock = 0; STATIONS.forEach(st => { if (st.clock) drawBoard(st.clock, realClock(), 'город'); }); }
  } catch (e) {}
  // светофоры и стрелки
  try {
    if (railKit) {
      railKit.sems.forEach(sm => {
        const red = !!train && sm.seg === train.seg && (train.state === 'dwell' || train.t > 0.6);
        if (sm.red !== red) {
          sm.red = red;
          if (sm.lampR) sm.lampR.material.color.setHex(red ? 0xff3b3b : 0x3a1a1a);
          if (sm.lampG) sm.lampG.material.color.setHex(red ? 0x1a3a1a : 0x2bff7c);
        }
      });
      railKit.gates.forEach(gt => {
        const near = Math.hypot(gt.x - pp().x, gt.z - pp().z) < 3.4;
        gt.open = gt.open === undefined ? 0 : gt.open;
        const target = near ? 1 : 0;
        gt.open += (target - gt.open) * Math.min(1, delta2 * 4);
        gt.panels.forEach((p, i) => { p.rotation.y = (i ? -1 : 1) * gt.open * 1.25; });
      });
    }
  } catch (e) {}
}
function trainSegIndex() { return train ? train.seg : -1; }
function nextStationFromStation(st) {
  const order = LINES[0].stations;
  const idx = order.indexOf(st.id);
  if (idx < 0) return '—';
  const nextId = order[(idx + 1) % order.length];
  const nx = (train && train.stations ? train.stations : STATIONS).find(x => x.id === nextId);
  return nx ? nx.name : '—';
}
let decorT = { board: 0, clock: 0 };
let delta2 = 0.016;
const railKit = { sems: [], gates: [], lamps: [], signals: 0, sleepers: 0, switches: 0 };
function buildRails(stations) {
  try {
    const T = G('THREE'), sc = G('scene');
    if (!T || !sc) return;
    const matBallast = new T.MeshLambertMaterial({ color: 0x413d36 });
    const matRail = new T.MeshLambertMaterial({ color: 0xa8b0bb });
    const matSleeper = new T.MeshLambertMaterial({ color: 0x4d3d29 });
    const matPlate = new T.MeshLambertMaterial({ color: 0x2c2a27 });
    const matCurb = new T.MeshLambertMaterial({ color: 0x585c62 });
    const matPost = new T.MeshLambertMaterial({ color: 0x767b81 });
    const matCable = new T.MeshLambertMaterial({ color: 0x1c1c20 });
    const matLampOn = new T.MeshBasicMaterial({ color: 0xfff0c0 });
    const g = new T.Group();
    g.name = 'fz8Rails';
    const order = LINES[0].stations.map(id => stations.find(s => s.id === id)).filter(Boolean);
    const SLEEPER_STEP = 2.2;
    const half = 0.75;
    const kit = { sems: [], gates: [], lamps: [], signals: 0, sleepers: 0, switches: 0 };
    for (let i = 0; i < order.length; i++) {
      const a = order[i], b = order[(i + 1) % order.length];
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
      const ang = Math.atan2(dx, dz);
      const nx = Math.cos(ang), nz = -Math.sin(ang);
      const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
      const at = (t, off) => ({ x: a.x + dx * t + nx * (off || 0), z: a.z + dz * t + nz * (off || 0) });
      // насыпь с обочинами
      const bg = new T.Mesh(new T.BoxGeometry(3.6, 0.34, len), matBallast);
      bg.position.set(mid.x, 0.17, mid.z); bg.rotation.y = ang; g.add(bg);
      [-1.95, 1.95].forEach(off => {
        const curb = new T.Mesh(new T.BoxGeometry(0.4, 0.52, len), matCurb);
        curb.position.set(mid.x + nx * off, 0.26, mid.z + nz * off); curb.rotation.y = ang; g.add(curb);
      });
      // рельсы: шейка + головка + подрельсовые прокладки
      [-half, half].forEach(off => {
        const web = new T.Mesh(new T.BoxGeometry(0.15, 0.22, len), matRail);
        web.position.set(mid.x + nx * off, 0.44, mid.z + nz * off); web.rotation.y = ang; g.add(web);
        const head = new T.Mesh(new T.BoxGeometry(0.28, 0.07, len), matRail);
        head.position.set(mid.x + nx * off, 0.575, mid.z + nz * off); head.rotation.y = ang; g.add(head);
        const foot = new T.Mesh(new T.BoxGeometry(0.42, 0.05, len), matPlate);
        foot.position.set(mid.x + nx * off, 0.31, mid.z + nz * off); foot.rotation.y = ang; g.add(foot);
      });
      // шпалы (InstancedMesh) + прокладки-крепления (InstancedMesh)
      const n = Math.max(2, Math.floor(len / SLEEPER_STEP));
      const dmy = new T.Object3D();
      const sleepers = new T.InstancedMesh(new T.BoxGeometry(2.95, 0.17, 0.3), matSleeper, n);
      const plates = new T.InstancedMesh(new T.BoxGeometry(0.5, 0.06, 0.42), matPlate, n * 2);
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        dmy.position.set(a.x + dx * t, 0.36, a.z + dz * t);
        dmy.rotation.set(0, ang, 0);
        dmy.updateMatrix();
        sleepers.setMatrixAt(k, dmy.matrix);
        [-half, half].forEach((off, pi) => {
          const pp2 = at(t, off);
          dmy.position.set(pp2.x, 0.4, pp2.z);
          dmy.updateMatrix();
          plates.setMatrixAt(k * 2 + pi, dmy.matrix);
        });
      }
      g.add(sleepers); g.add(plates);
      kit.sleepers += n;
      // путевые фонари (каждые ~30 м) и контактный кабель
      const nLamp = Math.max(1, Math.floor(len / 30));
      for (let k = 0; k < nLamp; k++) {
        const t = (k + 0.5) / nLamp;
        const p = at(t, 2.5);
        const post = new T.Mesh(new T.BoxGeometry(0.2, 5.2, 0.2), matPost);
        post.position.set(p.x, 2.6, p.z); g.add(post);
        const arm = new T.Mesh(new T.BoxGeometry(0.12, 0.12, 2.4), matPost);
        arm.position.set(p.x - nx * 1.2, 5.1, p.z - nz * 1.2); arm.rotation.y = ang; g.add(arm);
        const lamp = new T.Mesh(new T.BoxGeometry(0.9, 0.18, 0.34), matLampOn);
        lamp.position.set(p.x - nx * 1.9, 5.0, p.z - nz * 1.9); lamp.rotation.y = ang; g.add(lamp);
        kit.lamps.push(lamp);
      }
      const cable = new T.Mesh(new T.BoxGeometry(0.06, 0.06, len), matCable);
      cable.position.set(mid.x - nx * 0.7, 5.25, mid.z - nz * 0.7); cable.rotation.y = ang; g.add(cable);
      // светофор перед станцией (в 26 м до станции)
      const tSem = Math.max(0.04, 1 - 26 / len);
      const sp = at(tSem, 2.3);
      const mast = new T.Mesh(new T.BoxGeometry(0.18, 4.4, 0.18), matPost);
      mast.position.set(sp.x, 2.2, sp.z); g.add(mast);
      const boxHead = new T.Mesh(new T.BoxGeometry(0.55, 1.25, 0.36), new T.MeshLambertMaterial({ color: 0x1b1e22 }));
      boxHead.position.set(sp.x, 4.0, sp.z); boxHead.rotation.y = ang; g.add(boxHead);
      const lampR = new T.Mesh(new T.CircleGeometry(0.17, 12), new T.MeshBasicMaterial({ color: 0x3a1a1a }));
      lampR.position.set(sp.x - nx * 0.2, 4.36, sp.z - nz * 0.2); lampR.rotation.y = ang; g.add(lampR);
      const lampG = new T.Mesh(new T.CircleGeometry(0.17, 12), new T.MeshBasicMaterial({ color: 0x2bff7c }));
      lampG.position.set(sp.x - nx * 0.2, 3.72, sp.z - nz * 0.2); lampG.rotation.y = ang; g.add(lampG);
      kit.sems.push({ seg: i, at: true, red: false, lampR: lampR, lampG: lampG, x: sp.x, z: sp.z });
      kit.signals++;
      // километровый столбик на середине перегона
      const kp = at(0.5, 2.2);
      const km = new T.Mesh(new T.BoxGeometry(0.26, 1.0, 0.2), matCurb);
      km.position.set(kp.x, 0.5, kp.z); g.add(km);
      const kmb = makeBoard(1.1, 0.5);
      if (kmb && kmb.mesh) { kmb.mesh.position.set(kp.x, 1.15, kp.z); kmb.mesh.rotation.y = ang + Math.PI / 2; g.add(kmb.mesh); drawBoard(kmb, 'п.' + (i + 1) + '-' + ((i + 1) % order.length + 1), Math.round(len) + ' м'); }
      // стрелочный перевод (декоративный) возле станции «Заводская» — съезд к депо
      if (a.id === 'factory' || b.id === 'factory') {
        const hold = (a.id === 'factory' ? a : b);
        const tSw = a.id === 'factory' ? 0.06 : 0.94;
        const sw = at(tSw, 0);
        const swAng = ang + (a.id === 'factory' ? 0.16 : -0.16);
        const swLen = 26;
        const depo = new T.Group();
        const dbg = new T.Mesh(new T.BoxGeometry(3.2, 0.3, swLen), matBallast);
        dbg.position.set(0, 0.15, swLen / 2); depo.add(dbg);
        [-half, half].forEach(off => {
          const r1 = new T.Mesh(new T.BoxGeometry(0.15, 0.22, swLen), matRail); r1.position.set(off, 0.44, swLen / 2); depo.add(r1);
          const r2 = new T.Mesh(new T.BoxGeometry(0.28, 0.07, swLen), matRail); r2.position.set(off, 0.575, swLen / 2); depo.add(r2);
        });
        // ангар депо
        const hangar = new T.Mesh(new T.BoxGeometry(9, 6, swLen * 0.55), new T.MeshLambertMaterial({ color: 0x5a4a3a }));
        hangar.position.set(0, 3, swLen * 0.72); hangar.scale.z = 0.72; depo.add(hangar);
        const roof2 = new T.Mesh(new T.BoxGeometry(10, 0.4, swLen * 0.46), new T.MeshLambertMaterial({ color: 0x3a3229 }));
        roof2.position.set(0, 6.2, swLen * 0.72); depo.add(roof2);
        const dSign = makeBoard(5.4, 1.1);
        if (dSign && dSign.mesh) { dSign.mesh.position.set(0, 4.4, swLen * 0.46); depo.add(dSign.mesh); drawBoard(dSign, '🚇 ДЕПО', 'отстой и ремонт'); }
        // старый вагон в тупике
        const old = new T.Mesh(new T.BoxGeometry(2.6, 2.2, 9), new T.MeshLambertMaterial({ color: 0x6b5a4a }));
        old.position.set(0, 1.4, swLen - 6); depo.add(old);
        depo.position.set(sw.x, 0, sw.z);
        depo.rotation.y = swAng;
        g.add(depo);
        kit.switches++;
        void hold;
      }
    }
    sc.add(g);
    window._fz8Rails = g;
    railKit.sems = kit.sems; railKit.lamps = kit.lamps; railKit.signals = kit.signals; railKit.sleepers = kit.sleepers; railKit.switches = kit.switches;
    console.log('[fz8metro] путь: ' + kit.sleepers + ' шпал, ' + kit.lamps.length + ' светильников, ' + kit.signals + ' светофоров, стрелок: ' + kit.switches);
  } catch (e) { try { console.warn('[fz8metro] rails', e); } catch (x) {} }
}
// ---------------- ПОЕЗД ----------------
const TRAIN = { speed: 15, dwellTime: 8, cars: 3 };
let train = null, ride = null;
function buildTrain(stations) {
  try {
    const T = G('THREE'), sc = G('scene');
    if (!T || !sc) return null;
    const g = new T.Group();
    const body = new T.MeshLambertMaterial({ color: 0xd24b4b });
    const dark = new T.MeshLambertMaterial({ color: 0x1b1e24 });
    const steelM = new T.MeshLambertMaterial({ color: 0x9aa2ad });
    const glassW = new T.MeshLambertMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.42 });
    const light = new T.MeshBasicMaterial({ color: 0xfff2c4 });
    const red = new T.MeshBasicMaterial({ color: 0xff3b3b });
    const doorM = new T.MeshLambertMaterial({ color: 0xbf4343 });
    const doorM2 = new T.MeshLambertMaterial({ color: 0x8f2f2f });
    const handrails = [];
    const doorPanels = [];
    // ---------- ЛОКОМОТИВ ----------
    const head = new T.Mesh(new T.BoxGeometry(2.7, 2.4, 3.4), body); head.position.set(0, 1.55, 0); g.add(head);
    const nose = new T.Mesh(new T.BoxGeometry(2.4, 1.6, 1.4), body); nose.position.set(0, 1.1, 2.2); g.add(nose);
    const win = new T.Mesh(new T.PlaneGeometry(2.0, 0.9), glassW); win.position.set(0, 2.1, -1.72); win.rotation.y = Math.PI; g.add(win);
    const winFront = new T.Mesh(new T.PlaneGeometry(1.9, 0.85), glassW); winFront.position.set(0, 2.0, 2.91); g.add(winFront);
    const grille = new T.InstancedMesh(new T.BoxGeometry(0.12, 0.7, 0.1), dark, 6);
    { const dmy0 = new T.Object3D();
      for (let i = 0; i < 6; i++) { dmy0.position.set(-1.0 + i * 0.4, 1.1, 2.92); dmy0.updateMatrix(); grille.setMatrixAt(i, dmy0.matrix); }
    }
    g.add(grille);
    // фары + конусы света
    [-0.9, 0.9].forEach(x => {
      const l = new T.Mesh(new T.SphereGeometry(0.24, 8, 8), light); l.position.set(x, 0.8, 2.9); g.add(l);
      const cone = new T.Mesh(new T.ConeGeometry(1.5, 9, 10, 1, true), new T.MeshBasicMaterial({ color: 0xfff2c4, transparent: true, opacity: 0.09, side: T.DoubleSide, depthWrite: false }));
      cone.position.set(x, 0.8, 7.2); cone.rotation.x = -Math.PI / 2; g.add(cone);
    });
    // буфер и номер
    const buf = new T.Mesh(new T.BoxGeometry(2.5, 0.4, 0.4), steelM); buf.position.set(0, 0.5, 2.95); g.add(buf);
    const numB = makeBoard(1.8, 0.6);
    if (numB) { numB.mesh.position.set(0, 0.55, 3.16); g.add(numB.mesh); drawBoard(numB, 'T-104', 'Кольцевая'); }
    // маршрутное табло на лбу поезда
    const routeBoard = makeBoard(2.4, 0.72);
    if (routeBoard) { routeBoard.mesh.position.set(0, 3.0, 2.92); g.add(routeBoard.mesh); drawBoard(routeBoard, '→ ' + (stations.find(s => s.id === LINES[0].stations[1]) || {}).name, 'Кольцевая линия'); }
    // ---------- ВАГОНЫ ----------
    const floors = [];
    const sideBoards = [];
    for (let c = 0; c < TRAIN.cars - 1; c++) {
      const z0 = -3.2 - c * 12.4;
      const w = new T.Group();
      const floor = new T.Mesh(new T.BoxGeometry(2.6, 0.22, 11.6), new T.MeshLambertMaterial({ color: 0x6b6f78 }));
      floor.position.set(0, 0.6, z0); w.add(floor); floors.push({ x: 0, z: z0, fMax: 5.2, lMax: 1.05 });
      // тактильная полоса и линолеум
      const lino = new T.Mesh(new T.BoxGeometry(2.2, 0.04, 11.4), new T.MeshLambertMaterial({ color: 0x5b6068 }));
      lino.position.set(0, 0.72, z0); w.add(lino);
      const sides = [-1, 1];
      sides.forEach(sx => {
        const wall = new T.Mesh(new T.BoxGeometry(0.16, 2.1, 11.6), body);
        wall.position.set(sx * 1.32, 1.8, z0); w.add(wall);
        for (let i = 0; i < 4; i++) {
          const wd = new T.Mesh(new T.BoxGeometry(0.06, 1.0, 1.7), glassW);
          wd.position.set(sx * 1.44, 2.0, z0 - 4.2 + i * 2.8); w.add(wd);
          const wf = new T.Mesh(new T.BoxGeometry(0.08, 0.14, 1.95), dark);
          wf.position.set(sx * 1.42, 1.42, z0 - 4.2 + i * 2.8); w.add(wf);
        }
        // двери: по две на борт, каждая — из двух створок
        [-2.6, 2.6].forEach(ez => {
          const frame = new T.Mesh(new T.BoxGeometry(0.2, 2.3, 2.5), dark);
          frame.position.set(sx * 1.34, 1.75, z0 + ez); w.add(frame);
          [-1, 1].forEach(sgn => {
            const pnl = new T.Mesh(new T.BoxGeometry(0.12, 2.15, 1.08), sgn < 0 ? doorM : doorM2);
            pnl.position.set(sx * 1.4, 1.72, z0 + ez + sgn * 0.56);
            w.add(pnl);
            doorPanels.push({ mesh: pnl, baseZ: z0 + ez + sgn * 0.56, sgn: sgn, side: sx });
          });
        });
        // боковые табло снаружи
        const sb = makeBoard(3.2, 0.8);
        if (sb) { sb.mesh.position.set(sx * 1.45, 2.55, z0); sb.mesh.rotation.y = sx < 0 ? -Math.PI / 2 : Math.PI / 2; w.add(sb.mesh); sideBoards.push(sb); }
      });
      const roof = new T.Mesh(new T.BoxGeometry(2.9, 0.22, 11.8), dark);
      roof.position.set(0, 2.95, z0); w.add(roof);
      // вентиляция на крыше
      for (let i = 0; i < 3; i++) { const vent = new T.Mesh(new T.BoxGeometry(1.0, 0.22, 0.8), steelM); vent.position.set(0, 3.14, z0 - 3.6 + i * 3.6); w.add(vent); }
      [-5.6, 5.6].forEach(ez => {
        const end = new T.Mesh(new T.BoxGeometry(2.6, 2.1, 0.14), body);
        end.position.set(0, 1.8, z0 + ez); w.add(end);
      });
      // скамейки
      [-0.85, 0.85].forEach(sx => { const bench = new T.Mesh(new T.BoxGeometry(0.5, 0.1, 9), new T.MeshLambertMaterial({ color: 0x7a5a34 })); bench.position.set(sx, 1.05, z0); w.add(bench); });
      // поручни: продольные штанги у потолка + вертикальные стойки
      [-0.7, 0.7].forEach(sx => {
        const bar = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 10.8, 8), steelM);
        bar.rotation.x = Math.PI / 2; bar.position.set(sx, 2.55, z0); w.add(bar); handrails.push(bar);
      });
      for (let i = 0; i < 5; i++) {
        [-0.7, 0.7].forEach(sx => {
          const post = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 1.95, 8), steelM);
          post.position.set(sx, 1.72, z0 - 4.4 + i * 2.2); w.add(post); handrails.push(post);
        });
      }
      // поручни-кольца над дверями
      [-2.6, 2.6].forEach(ez => {
        [-1, 1].forEach(sx => {
          const ring = new T.Mesh(new T.TorusGeometry(0.16, 0.03, 6, 12), steelM);
          ring.position.set(sx * 1.15, 2.25, z0 + ez); ring.rotation.y = Math.PI / 2; w.add(ring); handrails.push(ring);
        });
      });
      // лампы
      for (let i = 0; i < 3; i++) {
        const lamp = new T.Mesh(new T.BoxGeometry(1.4, 0.06, 0.3), light);
        lamp.position.set(0, 2.78, z0 - 3.6 + i * 3.6); w.add(lamp);
      }
      // кнопка связи и схема линии внутри вагона
      const lineMap = makeBoard(1.6, 0.6);
      if (lineMap) { lineMap.mesh.position.set(-1.2, 1.95, z0 - 5.62); lineMap.mesh.rotation.y = Math.PI; w.add(lineMap.mesh); drawBoard(lineMap, 'КОЛЬЦО', '5 станций'); }
      const sos = new T.Mesh(new T.BoxGeometry(0.3, 0.4, 0.1), red);
      sos.position.set(1.2, 1.8, z0 - 5.62); w.add(sos);
      g.add(w);
    }
    // хвостовые стоп-сигналы
    const lastZ = -3.2 - (TRAIN.cars - 2) * 12.4;
    [-0.9, 0.9].forEach(x => { const t2 = new T.Mesh(new T.SphereGeometry(0.2, 8, 8), red); t2.position.set(x, 1.7, lastZ - 5.7); g.add(t2); });
    sc.add(g);
    train = {
      mesh: g, seg: 0, t: 0, state: 'run', dwell: 0, x: 0, z: 0, heading: 0, prev: { x: 0, z: 0 },
      floors: floors, speed: TRAIN.speed, dist: 0, doors: 0, stations: stations,
      doorPanels: doorPanels, handrails: handrails, routeBoard: routeBoard, sideBoards: sideBoards,
    };
    const first = stations.find(s => s.id === LINES[0].stations[0]) || stations[0];
    train.x = first.x; train.z = first.z; train.prev = { x: first.x, z: first.z };
    g.position.set(train.x, 0, train.z);
    console.log('[fz8metro] поезд: ' + (TRAIN.cars) + ' вагона(ов), створок ' + doorPanels.length + ', поручней ' + handrails.length);
    return train;
  } catch (e) { try { console.warn('[fz8metro] train', e); } catch (x) {} return null; }
}
function segInfo(stations, i) {
  const order = LINES[0].stations.map(id => stations.find(s => s.id === id)).filter(Boolean);
  const a = order[i % order.length], b = order[(i + 1) % order.length];
  return { a: a, b: b, len: Math.hypot(b.x - a.x, b.z - a.z), ang: Math.atan2(b.x - a.x, b.z - a.z) };
}
function updateTrain(dt) {
  if (!train || !train.stations || !train.stations.length) return;
  const si = segInfo(train.stations, train.seg);
  train.prev = { x: train.x, z: train.z };
  if (train.state === 'run') {
    train.t += (train.speed * dt) / Math.max(1, si.len);
    if (train.t >= 1) { train.t = 1; train.state = 'dwell'; train.dwell = TRAIN.dwellTime; train.warned = false; announceArrival(si.b); }
    const k = train.t;
    train.x = si.a.x + (si.b.x - si.a.x) * k;
    train.z = si.a.z + (si.b.z - si.a.z) * k;
    train.heading = si.ang;
  } else {
    train.x = si.b.x; train.z = si.b.z; train.heading = si.ang;
    train.dwell -= dt;
    train.doors = clamp(train.doors + dt * 1.6, 0, 1);
    if (!train.warned && train.dwell <= 1.7) {
      train.warned = true;
      notify('🔔 Осторожно, двери закрываются! Поезд отправляется', 'warn');
      try { if (G('SFX') && G('SFX').horn) G('SFX').horn(); } catch (e) {}
      if (ride) {
        // если пассажир стоит у двери — выпускаем автоматически, иначе везём дальше
        const pdx = pp().x - train.x, pdz = pp().z - train.z;
        const off = Math.hypot(pdx, pdz);
        if (off > 2.6) notify('🚇 Ты не успел выйти — едем дальше до следующей станции', 'info');
      }
    }
    if (train.dwell <= 0) {
      train.state = 'run'; train.t = 0; train.warned = false;
      train.seg = (train.seg + 1) % LINES[0].stations.length;
      notify('🚇 Поезд отправляется · следующая станция — «' + nextStationName() + '»', 'info');
    }
  }
  // створки дверей
  if (train.doorPanels) {
    const open = train.state === 'dwell' ? train.doors : 0;
    if (train.state === 'run' && train.doors > 0) train.lastDoors = train.doors;
    if (train.state === 'run') train.doors = Math.max(0, (train.lastDoors || 0) - dt * 3);
    for (let i = 0; i < train.doorPanels.length; i++) {
      const dp = train.doorPanels[i];
      dp.mesh.position.z = dp.baseZ + dp.sgn * (train.state === 'dwell' ? open : train.doors) * 1.06;
    }
  }
  const dx = train.x - train.prev.x, dz = train.z - train.prev.z;
  train.dist += Math.hypot(dx, dz);
  train.mesh.position.set(train.x, 0.1, train.z);
  train.mesh.rotation.y = train.heading;
}
function markVisited(st) {
  if (!st || !st.id || M.stations.includes(st.id)) return false;
  M.stations.push(st.id);
  notify('🚇 Новая станция на карте: «' + st.name + '» (' + M.stations.length + '/' + STATIONS.length + ')');
  if (M.stations.length >= STATIONS.length) checkA('metroAll');
  saveM(true);
  return true;
}
function announceArrival(st) {
  if (!st) return;
  markVisited(st);
  notify('🚇 Станция «' + st.name + '» · двери открыты 8 секунд', 'info');
  try { if (G('SFX') && G('SFX').bell) G('SFX').bell(); } catch (e) {}
  if (ride) banner('🚇 ' + st.name, 'Можешь выйти — жми E у дверей или просто сойди с платформы поезда');
}
function trainAtStation() {
  if (!train || train.state !== 'dwell') return null;
  const si = segInfo(train.stations, train.seg);
  return si.b;
}
function boardTrain() {
  if (ride) { notify('🚇 Ты уже в поезде', 'warn'); return; }
  if (!train) { notify('🚇 Поезд ещё не на линии', 'warn'); return; }
  const near = trainAtStation();
  const p = pp();
  const distTrain = Math.hypot(train.x - p.x, train.z - p.z);
  if (distTrain > 14) {
    notify('🚇 Поезд ' + (train.state === 'dwell' ? 'стоит на станции «' + (near ? near.name : '—') + '»' : 'в пути') + '. Следующий поезд через ~' + eta() + ' с', 'warn');
    return;
  }
  if (!near) { notify('🚇 Поезд уже отходит — двери закрыты', 'warn'); return; }
  // билет
  let fare = false;
  if (M.card) fare = true;
  else if (M.tickets > 0) { M.tickets--; fare = true; notify('🎫 Билет прокомпостирован · осталось билетов: ' + M.tickets); }
  else { notify('🚨 У тебя нет билета — едешь зайцем! Контролёр может оштрафовать ($260)', 'warn'); }
  const floor = train.floors[Math.floor(train.floors.length / 2)] || { z: -9, fMax: 5, lMax: 1 };
  const sx = Math.sin(train.heading), cz = Math.cos(train.heading);
  const px = train.x + floor.z * sx, pz = train.z + floor.z * cz;
  try { G('localPlayer').mesh.position.set(px, 0.75, pz); } catch (e) {}
  ride = { fare: fare, boardedAt: Date.now(), from: near.id, dist: 0, inspected: false };
  M.passengers++;
  notify('🚇 Ты вошёл в вагон. Следующая станция — «' + nextStationName() + '»', 'info');
  banner('🚇 В ПОЕЗДЕ', 'Кольцевая линия · следующая: ' + nextStationName());
  checkA('metro1');
  saveM(true);
}
function nextStationName() {
  if (!train || !train.stations || !train.stations.length) return '—';
  const si = segInfo(train.stations, train.seg);
  return train.state === 'dwell' ? si.b.name : si.b.name;
}
function eta() {
  if (!train || !train.stations || !train.stations.length) return 0;
  if (train.state === 'dwell') return Math.ceil(train.dwell) + 2;
  const si = segInfo(train.stations, train.seg);
  return Math.ceil((si.len * (1 - train.t)) / train.speed) + 1;
}
function exitTrain() {
  if (!ride) return;
  const st = trainAtStation();
  if (!st) { notify('🚇 На ходу не выйти! Дождись станции', 'warn'); return; }
  const p = pp();
  const bx = st.spots ? st.spots.board.x : st.x, bz = st.spots ? st.spots.board.z : st.z;
  try { G('localPlayer').mesh.position.set(bx, 1, bz); } catch (e) {}
  const travelled = Math.round(ride.dist);
  M.dist += travelled;
  if (travelled > 20) {
    M.rides++;
    notify('🚇 Поездка завершена: ' + travelled + ' м · всего поездок ' + M.rides);
    checkA('metroRide');
    if (M.rides >= 10) checkA('metro10');
    if (M.dist >= 5000) checkA('metroFar');
    if (M.dist > M.best) M.best = M.dist;
    xp('logic', 8 + Math.round(travelled / 120));
  }
  ride = null;
  saveM(true);
}
function updateRiding(dt) {
  if (!ride || !train) return;
  try {
    const lp = G('localPlayer');
    if (!lp || !lp.mesh) return;
    const p = lp.mesh.position;
    const sx = Math.sin(train.heading), cz = Math.cos(train.heading);
    let f = (p.x - train.x) * sx + (p.z - train.z) * cz;
    let l = (p.x - train.x) * cz - (p.z - train.z) * sx;
    f = clamp(f, -14.6, 7.4); l = clamp(l, -1.05, 1.05);
    p.x = train.x + f * sx + l * cz;
    p.z = train.z + f * cz - l * sx;
    ride.dist += Math.hypot(train.x - train.prev.x, train.z - train.prev.z);
    // контролёр: 12% шанс раз за поездку
    if (!ride.inspected && train.state === 'run' && Math.random() < dt * 0.02) {
      ride.inspected = true;
      M.inspects++;
      if (!ride.fare) {
        addMoney(-260);
        M.fines++;
        notify('👮 Контролёр: штраф $260 за безбилетный проезд! Купить билет можно на станции', 'warn');
        banner('👮 КОНТРОЛЁР', 'Штраф $260 · в следующий раз купи билет 🎫');
        fx('damage');
      } else {
        notify('👮 Контролёр проверил билет — всё в порядке');
      }
      saveM(true);
    }
  } catch (e) {}
}

// ---------------- ДЕЙСТВИЯ НА СТАНЦИИ ----------------
function ticketPanel() {
  const h = '<div class="fz8Row" style="display:block;"><div class="nm">🎫 Билеты метро</div>'
    + '<div class="sb">В сумке билетов: ' + M.tickets + ' · сезонная карта: ' + (M.card ? 'есть ✅' : 'нет') + '</div></div>'
    + '<div class="fz8Row"><div><div class="nm">Билет на 1 поездку</div><div class="sb">$40 · компостируется при входе в вагон</div></div><button class="fz8B g" onclick="FZ8M.buyTicket(1)">$40</button></div>'
    + '<div class="fz8Row"><div><div class="nm">Блок из 10 поездок</div><div class="sb">$340 вместо $400 — экономия $60</div></div><button class="fz8B y" onclick="FZ8M.buyTicket(10)">$340</button></div>'
    + '<div class="fz8Row"><div><div class="nm">🚇 Сезонная карта</div><div class="sb">Проезд без билетов навсегда + приоритетная посадка</div></div>'
    + (M.card ? '<div class="vl">куплена</div>' : '<button class="fz8B g" onclick="FZ8M.buyCard()">$4 000</button>') + '</div>'
    + '<div class="fz8Hint">Поезда ходят по кольцу: Центральная → Заводская → Парковая → Портовая → Деловая. Поезд стоит на станции 8 секунд. Контролёр проверяет билеты с шансом ~12% за поездку, штраф $260.</div>';
  modalM('🎫 ' + M.tickets + ' билетов · ' + (M.card ? 'сезонная карта' : 'без карты'), h, 560);
}
function buyTicket(n) {
  const price = n === 10 ? 340 : 40 * n;
  if (money() < price) { notify('💸 Не хватает $' + fmt(price - money()), 'warn'); return; }
  addMoney(-price); M.tickets += n;
  notify('🎫 Куплено билетов: ' + n + ' (всего ' + M.tickets + ')');
  checkA('metro1');
  saveM(true);
  ticketPanel();
}
function buyCard() {
  if (M.card) { notify('🚇 Сезонная карта уже есть'); return; }
  if (money() < 4000) { notify('💸 Сезонная карта стоит $4 000', 'warn'); return; }
  addMoney(-4000); M.card = true;
  notify('🚇 Сезонная карта активирована — проезд бесплатный!');
  banner('🚇 СЕЗОННАЯ КАРТА', 'Проезд в метро бесплатный');
  checkA('metroCard');
  saveM(true);
  ticketPanel();
}
function vendMachine() {
  if (money() < 90) { notify('💸 Автомат просит $90', 'warn'); return; }
  addMoney(-90);
  try {
    const lp = G('localPlayer');
    if (lp && lp.health < 100) { lp.health = Math.min(100, lp.health + 10); if (G('updateHealthBar')) G('updateHealthBar')(); }
  } catch (e) {}
  const snacks = ['кола и чипсы', 'кофе и сэндвич', 'горячий шоколад и печенье', 'энергетик и сухарики'];
  notify('🥤 Из автомата: ' + pick(snacks) + ' (+10 HP)');
  puff(pp().x, 1.4, pp().z, 0.4, 0xffd76a, 0.6, 0.4);
  saveM(true);
}
function lostFound() {
  const today = new Date().toDateString();
  const st = (train && train.stations ? train.stations : STATIONS).filter(s => s.x !== undefined);
  const p = pp();
  let near = null, bd = 1e9;
  st.forEach(s => { const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < bd) { bd = d; near = s; } });
  const key = (near ? near.id : 'x') + '|' + today;
  if (M.lost[key]) { notify('📦 В бюро находок сегодня уже пусто — приходи завтра', 'warn'); return; }
  M.lost[key] = 1;
  const kind = Math.random();
  checkA('metroLost');
  if (kind < 0.4) { const cash = ri(400, 1800); addMoney(cash); notify('📦 В забытой сумке нашлись $' + fmt(cash)); }
  else if (kind < 0.7) { const c = ri(1, 3); addCoins(c); notify('📦 В потерянном кошельке ' + c + ' 💎'); }
  else if (kind < 0.9) { try { const S = lifeS(); const k = pick(['metal', 'plastic', 'chip', 'cloth']); if (S) { S.res[k] += ri(4, 12); } } catch (e) {} notify('📦 Найдены запчасти и материалы (в рюкзак)'); }
  else { M.tickets += 2; notify('📦 Кто-то забыл 2 билета метро — теперь они твои'); }
  xp('logic', 15);
  saveM(true);
}
function buskTip() {
  if (money() < 150) { notify('💸 Нужно $150 для монеты музыканту', 'warn'); return; }
  addMoney(-150);
  M.tips++; xp('charm', 18);
  const back = Math.random() < 0.35 ? ri(300, 1200) : 0;
  if (back) { addMoney(back); notify('🎸 Музыкант сыграл для тебя песню, прохожие накидали $' + fmt(back) + ' — половина твоя!'); }
  else notify('🎸 Музыкант играет «Fantazia Blues» — +18 опыта харизмы (монет оставлено: ' + M.tips + ')');
  if (M.tips >= 3) checkA('metroBusk');
  saveM(true);
}
function expressTo(id) {
  const st = (train && train.stations ? train.stations : []).find(s => s.id === id);
  if (!st || st.x === undefined) { notify('🚇 Станция не найдена', 'warn'); return; }
  if (ride) { notify('🚇 Сначала выйди из поезда', 'warn'); return; }
  if (money() < 500) { notify('💸 Экспресс-переход стоит $500', 'warn'); return; }
  addMoney(-500); M.express++;
  try { G('localPlayer').mesh.position.set(st.spots ? st.spots.board.x : st.x, 1, st.spots ? st.spots.board.z : st.z); } catch (e) {}
  fx('fade', 1);
  setTimeout(() => fx('fade', 0), 700);
  notify('🚇 Экспресс-переход: ты на станции «' + st.name + '» (−$500)');
  markVisited(st);
  saveM(true);
  metroPanel();
}
// ---------------- ПАНЕЛЬ ----------------
function modalM(title, html, width) {
  let m = $('fz8MetroModal');
  if (!m) {
    m = document.createElement('div'); m.id = 'fz8MetroModal';
    m.style.cssText = 'position:fixed;inset:0;z-index:8472;background:rgba(4,2,12,.8);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;';
    m.onclick = (e) => { if (e.target === m) m.style.display = 'none'; };
    document.body.appendChild(m);
  }
  m.innerHTML = '<div style="width:min(' + (width || 620) + 'px,96vw);max-height:90vh;overflow:auto;background:linear-gradient(165deg,#101a20,#080a12);border:1.5px solid #5bc8ff66;border-radius:18px;padding:16px;color:#fff;font:14px Arial;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><div style="font:bold 16px Arial;">' + title + '</div>'
    + '<button onclick="document.getElementById(\'fz8MetroModal\').style.display=\'none\'" style="background:#ffffff14;color:#fff;border:1px solid #ffffff30;border-radius:10px;width:30px;height:30px;cursor:pointer;">✕</button></div>' + html + '</div>';
  m.style.display = 'flex';
  return m;
}
function metroPanel() {
  const near = trainAtStation();
  let h = '<div class="fz8Row" style="display:block;"><div class="nm">🚇 Кольцевая линия · ' + (ride ? 'ты в поезде' : (near ? 'поезд на станции «' + near.name + '»' : 'поезд в пути')) + '</div>'
    + '<div class="sb">Поездок: ' + M.rides + ' · проехано: ' + fmt(M.dist) + ' м · пассажиров перевезено (ты): ' + M.passengers + ' · штрафов: ' + M.fines + ' · билетов: ' + M.tickets + (M.card ? ' · карта ✅' : '') + '</div></div>';
  h += '<div class="fz8Chip" style="margin:9px 0 8px;">СТАНЦИИ</div>';
  const list = (train && train.stations ? train.stations : STATIONS).filter(s => s.x !== undefined);
  h += list.map((s, i) => {
    const visited = M.stations.includes(s.id);
    const isNext = ride && nextStationName() === s.name;
    return '<div class="fz8Row" style="' + (isNext ? 'border-color:#7cffb2;' : '') + '"><div><div class="nm">' + (visited ? '✅' : '⚪') + ' ' + (i + 1) + '. ' + s.name + (isNext ? ' · следующая' : '') + '</div>'
      + '<div class="sb">' + (s.zone ? 'район: ' + s.zone : 'центр города') + ' · путь до неё от текущей точки кольца: ' + Math.round(Math.hypot(s.x - pp().x, s.z - pp().z)) + ' м</div></div>'
      + '<button class="fz8B ' + (money() >= 500 ? 'y' : '') + '" ' + (money() >= 500 ? '' : 'disabled') + ' onclick="FZ8M.express(\'' + s.id + '\')">Экспресс $500</button></div>';
  }).join('');
  h += '<div class="fz8Chip" style="margin:10px 0 8px;">ДЕЙСТВИЯ</div>';
  h += '<div class="fz8Row"><div><div class="nm">🎫 Билетный автомат</div><div class="sb">билет $40 · блок из 10 — $340 · сезонная карта $4 000</div></div><button class="fz8B g" onclick="FZ8M.tickets()">Открыть</button></div>';
  h += '<div class="fz8Row"><div><div class="nm">' + (ride ? '🚪 Выйти из поезда' : '🚪 Сесть в поезд') + '</div><div class="sb">' + (ride ? 'можно только на станции, когда двери открыты' : 'нужно стоять у платформы, когда поезд на станции') + '</div></div>'
    + '<button class="fz8B ' + (ride ? 'r' : 'g') + '" onclick="FZ8M.' + (ride ? 'exit()' : 'board()') + '">' + (ride ? 'Выйти' : 'Сесть') + '</button></div>';
  h += '<div class="fz8Row"><div><div class="nm">📋 Расписание</div><div class="sb">' + (train ? (train.state === 'dwell' ? 'двери открыты ещё ' + Math.ceil(train.dwell) + ' с' : 'ближайшая станция через ~' + eta() + ' с') : 'поезд выходит на линию…') + '</div></div><div class="vl">' + (train ? 'линия активна' : 'ожидание') + '</div></div>';
  h += '<div class="fz8Hint">На станциях: автомат с напитками ($90), бюро находок (раз в день), уличный музыкант, пассажиры. Достижения метро: ' + M.ach.length + '/' + Object.keys(ACH).length + '. Кольцо: Центральная → Заводская → Парковая → Портовая → Деловая → Центральная.</div>';
  modalM('🚇 МЕТРО ФАНТАЗИИ', h, 640);
}
// ---------------- HUD ----------------
let hudM = 0, hudEl = null, saveT = 0, builtT2 = 0, ready = false;
function buildMetroUI() {
  try {
    if (!$('fz8MetroCss')) {
      const st = document.createElement('style'); st.id = 'fz8MetroCss';
      st.textContent = '#fz8MetroHud{position:fixed;left:50%;bottom:118px;transform:translateX(-50%);z-index:6116;background:rgba(6,10,18,.78);border:1px solid #5bc8ff55;border-radius:12px;padding:6px 14px;color:#dff3ff;font:bold 12px Arial;display:none;pointer-events:none;text-align:center;}'
        + '#fz8MetroOut{position:fixed;left:14px;bottom:250px;z-index:6119;width:66px;height:66px;border-radius:50%;border:2px solid #5bc8ff88;background:rgba(20,60,90,.4);color:#fff;font:bold 11px Arial;display:none;}';
      document.head.appendChild(st);
    }
    if (!$('fz8MetroHud')) { const d = document.createElement('div'); d.id = 'fz8MetroHud'; document.body.appendChild(d); hudEl = d; }
    if (!$('fz8MetroOut')) {
      const b = document.createElement('button'); b.id = 'fz8MetroOut'; b.textContent = '🚪 Выйти';
      b.onclick = (e) => { e.preventDefault(); exitTrain(); };
      document.body.appendChild(b);
    }
  } catch (e) {}
}
function updateMetroHud() {
  const d = $('fz8MetroHud'); if (!d) return;
  if (ride) {
    d.style.display = 'block';
    d.innerHTML = '🚇 Кольцевая · ' + (train && train.state === 'dwell' ? 'стоим на станции «' + nextStationName() + '» · двери открыты' : 'следующая «' + nextStationName() + '» через ~' + eta() + ' с')
      + '<div style="font:11px Arial;color:#9fd8ff;margin-top:2px;">проехано в этой поездке: ' + Math.round(ride.dist) + ' м · E — выйти на станции</div>';
    const b = $('fz8MetroOut');
    if (b) b.style.display = (train && train.state === 'dwell') ? 'block' : 'none';
  } else {
    d.style.display = 'none';
    const b = $('fz8MetroOut'); if (b) b.style.display = 'none';
  }
}
// ---------------- ИНИЦИАЛИЗАЦИЯ ХУКАМИ МОДУЛЕЙ ----------------
function spawnAll() {
  if (ready) return;
  try {
    if (!G('buildings') || G('buildings').length < 5) return;
    if (!G('FZ8C') || !G('FZ8C').districts || G('FZ8C').districts().length < 5) return;
    const districts = G('FZ8C').districts();
    STATIONS.forEach(s => {
      if (s.zone) {
        const d = districts.find(x => x.id === s.zone);
        if (d) { s.ox = d.x + 26; s.oz = d.z - 26; }
      } else { s.ox = 22; s.oz = -18; }
      buildStation(s);
    });
    const ok = STATIONS.filter(s => s.x !== undefined);
    if (ok.length < 3) return;
    buildRails(ok);
    buildTrain(ok);
    ready = true;
    window._fz8MetroReady = true;
    let ring = 0;
    for (let i = 0; i < ok.length; i++) {
      const a = ok[i], b = ok[(i + 1) % ok.length];
      ring += Math.hypot(b.x - a.x, b.z - a.z);
    }
    console.log('[fz8metro] станций на линии: ' + ok.length + ', длина кольца ' + Math.round(ring) + ' м');
  } catch (e) { try { console.warn('[fz8metro] spawn', e); } catch (x) {} }
}
function FZ8M_update(delta) {
  const dt = Math.min(delta || 0.016, 0.12);
  try {
    if (!ready) { builtT2 += dt; if (builtT2 > 3) { builtT2 = 0; spawnAll(); } }
    if (!ready) return;
    delta2 = dt;
    updateTrain(dt);
    updateRiding(dt);
    updateDecor(dt);
    // пассажиры: покачивание и неторопливое хождение рядом
    const p = pp();
    STATIONS.forEach(s => {
      if (!s.pax) return;
      if (Math.hypot(s.x - p.x, s.z - p.z) > 70) return;
      s.pax.forEach(c => {
        c.userData.ph += dt * 1.5;
        c.position.y = 0.22 + Math.abs(Math.sin(c.userData.ph * 0.8)) * 0.03;
        c.position.z = c.userData.home.z + Math.sin(c.userData.ph * 0.3) * 0.8;
        c.rotation.y = Math.sin(c.userData.ph * 0.25) * 0.6;
      });
    });
    hudM += dt;
    if (hudM > 0.3) {
      hudM = 0; updateMetroHud();
      if (train && train.state === 'dwell') {
        const st = trainAtStation();
        const near = st && Math.hypot(st.x - p.x, st.z - p.z) < 34;
        if (st && near) markVisited(st);
      }
    }
    saveT += dt;
    if (saveT > 8 && dirty) { saveT = 0; saveM(true); }
  } catch (e) { if (!window._fz8MErr) { window._fz8MErr = 1; try { console.warn('[fz8metro]', e); } catch (x) {} } }
}
// ---------------- ЭКСПОРТ ----------------
window.FZ8M = {
  stations: () => STATIONS, state: () => M, trains: () => train, ride: () => ride,
  tickets: ticketPanel, buyTicket: buyTicket, buyCard: buyCard, express: expressTo,
  board: boardTrain, exit: exitTrain, metro: metroPanel, tip: buskTip, vend: vendMachine, lost: lostFound,
  eta: eta, next: nextStationName, rideInfo: () => (ride ? { dist: ride.dist, fare: ride.fare, from: ride.from } : null),
  rails: () => railKit, decor: () => ({ boards: STATIONS.filter(s => s.board).length, clocks: STATIONS.filter(s => s.clock).length, gates: railKit ? railKit.gates.length : 0, sems: railKit ? railKit.sems.length : 0 }),
  doors: () => (train ? { state: train.state, doors: +train.doors.toFixed(2), panels: train.doorPanels ? train.doorPanels.length : 0, handrails: train.handrails ? train.handrails.length : 0 } : null),
  dist: () => (train ? Math.round(train.dist) : 0),
  debug: {
    money: (v) => addMoney(v), all: () => { M.card = true; M.tickets += 5; STATIONS.forEach(s => { if (!M.stations.includes(s.id)) M.stations.push(s.id); }); saveM(true); notify('dev: метро-доступ выдан'); },
    wipe: () => { M = JSON.parse(JSON.stringify(DEF)); saveM(true); notify('dev: метро сброшено'); },
    arrive: () => { if (train && train.state === 'run') { train.t = 0.999; } },
  },
};
window.FZ8M_update = FZ8M_update;
window.FZ8M_onInteract = function (inter) {
  if (!inter || !inter.type) return false;
  switch (inter.type) {
    case 'fz8m_ticket': ticketPanel(); return true;
    case 'fz8m_vend': vendMachine(); return true;
    case 'fz8m_lost': lostFound(); return true;
    case 'fz8m_busk': buskTip(); return true;
    case 'fz8m_board': boardTrain(); return true;
    case 'fz8m_exit': exitTrain(); return true;
  }
  return false;
};
const prevInteractM = window.FZ8_onInteract;
window.FZ8_onInteract = function (inter) {
  try { if (window.FZ8M_onInteract(inter)) return true; } catch (e) {}
  try { return prevInteractM ? !!prevInteractM(inter) : false; } catch (e) { return false; }
};
try {
  window.addEventListener('keydown', (e) => {
    try { if (e.code === 'KeyE' && ride) exitTrain(); } catch (x) {}
  });
  window.addEventListener('keydown', (e) => {
    try { if (e.code === 'KeyT') metroPanel(); } catch (x) {}
  });
} catch (e) {}
[['metro', '🚇', 'Метро']].forEach(([id, icon, name]) => {
  try { if (G('FZ8_addDock')) G('FZ8_addDock')({ id: id, icon: icon, name: name }); } catch (e) {}
});
window.FZ8L_EXT = window.FZ8L_EXT || {};
window.FZ8L_EXT.metro = () => { setTimeout(metroPanel, 30); return '<div class="fz8Hint">Открываю метро…</div>'; };
loadM();
buildMetroUI();
setTimeout(() => {
  try {
    if (!M.seen) {
      M.seen = true; saveM(true);
      setTimeout(() => {
        notify('🚇 v8.4: в городе открылось метро — кольцевая линия на 5 станций, поезда, билеты и автобусные… то есть вагонные приключения! Панель 🚇 в доке или клавиша T');
        banner('🚇 МЕТРО ФАНТАЗИИ', '5 станций · поезда по кольцу · билеты, контролёр, уличные музыканты');
      }, 21000);
    }
  } catch (e) {}
}, 6000);
})();
