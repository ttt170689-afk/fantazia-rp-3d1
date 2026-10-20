// FANTAZIA RP 3D — v8.5 «Обжитый город»
// Native interior integration. Only the current floor is allocated;
// static detail is instanced, moving parts remain separate meshes.
(function () {
'use strict';
const G = n => window[n];
const $ = id => document.getElementById(id);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
// Seeded decoration: furniture does not jump around on repeat visits.
let seed = 85;
function ri(a, b) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return a + seed % (b - a + 1); }
function notify(text) { if (typeof showNotification === 'function') showNotification(text, 'info'); }
const KEY = 'fz8home_v1';
const state = { tea: 0, baths: 0, rests: 0, cooked: 0, laundry: 0, books: 0, grades: {}, visited: [] };
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    for (const key of ['tea','baths','rests','cooked','laundry','books'])
      if (Number.isSafeInteger(raw[key]) && raw[key] >= 0) state[key] = Math.min(raw[key], 1000000);
    if (Array.isArray(raw.visited)) state.visited = raw.visited.filter(v => typeof v === 'string').slice(0, 30);
    if (raw.grades && typeof raw.grades === 'object')
      for (const key of Object.keys(QUESTIONS)) {
        const v = raw.grades[key];
        if (Array.isArray(v)) state.grades[key] = v.filter(n => Number.isInteger(n) && n >= 2 && n <= 5).slice(-20);
      }
  } catch (_) { /* corrupt/unavailable storage must not stop entry */ }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {} }
// ---------------- СТРОИТЕЛЬНЫЕ ХЕЛПЕРЫ ----------------
// всё строится лениво (при первом входе) и переиспользует геометрии/материалы
const GEO = {}, MATS = {};
function T3() { return G('THREE'); }
function geoBox() { if (!GEO.box) GEO.box = new (T3().BoxGeometry)(1, 1, 1); return GEO.box; }
function geoCyl(seg) {
  const k = 'cyl' + (seg || 10);
  if (!GEO[k]) GEO[k] = new (T3().CylinderGeometry)(0.5, 0.5, 1, seg || 10);
  return GEO[k];
}
function geoSph(seg) {
  const k = 'sph' + (seg || 8);
  if (!GEO[k]) GEO[k] = new (T3().SphereGeometry)(0.5, seg || 8, (seg || 8) / 2 + 2);
  return GEO[k];
}
function geoPlane() { if (!GEO.plane) GEO.plane = new (T3().PlaneGeometry)(1, 1); return GEO.plane; }
function geoTorus() { if (!GEO.torus) GEO.torus = new (T3().TorusGeometry)(0.5, 0.14, 6, 12); return GEO.torus; }
function geoBoxHole() { if (!GEO.ring) GEO.ring = new (T3().RingGeometry)(0.3, 0.5, 14); return GEO.ring; }
function mat(col, opt) {
  const key = col + '|' + (opt || '');
  if (MATS[key]) return MATS[key];
  const p = { color: col };
  if (opt) opt.split(' ').forEach(o => {
    if (o === 'glass') { p.transparent = true; p.opacity = 0.38; }
    else if (o === 'glow') { }
    else if (o === 'flat') { p.flatShading = true; }
    else if (o === 'double') { p.side = T3().DoubleSide; }
  });
  const m = opt && opt.indexOf('glow') >= 0 ? new (T3().MeshBasicMaterial)(p) : new (T3().MeshLambertMaterial)(p);
  MATS[key] = m;
  return m;
}
function mkBox(parent, w, h, d, col, x, y, z, ry, opt) {
  const m = new (T3().Mesh)(geoBox(), mat(col, opt));
  m.scale.set(w, h, d); m.position.set(x, y, z); if (ry) m.rotation.y = ry;
  m.castShadow = false; m.receiveShadow = false;
  parent.add(m); return m;
}
function mkCyl(parent, r, h, col, x, y, z, seg, opt, rTop) {
  const m = new (T3().Mesh)(geoCyl(seg || 10), mat(col, opt));
  m.scale.set(r * 2, h, r * 2); if (rTop !== undefined) m.scale.set(r * 2, h, r * 2);
  m.position.set(x, y, z); parent.add(m); return m;
}
function mkSph(parent, r, col, x, y, z, seg, opt) {
  const m = new (T3().Mesh)(geoSph(seg || 8), mat(col, opt));
  m.scale.setScalar(r * 2); m.position.set(x, y, z); parent.add(m); return m;
}
function mkPlane(parent, w, h, col, x, y, z, rx, ry, opt) {
  const m = new (T3().Mesh)(geoPlane(), mat(col, opt || 'double'));
  m.scale.set(w, h, 1); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0);
  parent.add(m); return m;
}
function mkTorus(parent, r, col, x, y, z, rx, ry) {
  const m = new (T3().Mesh)(geoTorus(), mat(col));
  m.scale.setScalar(r * 2); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0);
  parent.add(m); return m;
}
function rug(g, col, x, z, w, d, ry) {
  const m = new (T3().Mesh)(geoBox(), mat(col));
  m.scale.set(w, 0.03, d); m.position.set(x, 0.02, z); m.rotation.y = ry || 0; g.add(m);
  const border = new (T3().Mesh)(geoBox(), mat(0xf3e9d6));
  border.scale.set(w * 0.86, 0.032, d * 0.86); border.position.set(x, 0.025, z); border.rotation.y = ry || 0; g.add(border);
}
let windowViewMaterial=null;
function windowPane(g, x, y, z, w, h, ry) {
  if(!windowViewMaterial) {
    const cv=document.createElement('canvas');cv.width=256;cv.height=128;const c=cv.getContext('2d');
    if(c){
      c.fillStyle='#b6d6e3';c.fillRect(0,0,256,128);c.fillStyle='#dae5d5';c.fillRect(0,72,256,56);
      c.fillStyle='#d9ceb7';c.fillRect(18,52,48,76);c.fillRect(190,38,44,90);
      c.fillStyle='#7c9eaa';for(let xx=24;xx<60;xx+=12)for(let yy=62;yy<120;yy+=18)c.fillRect(xx,yy,6,9);
      c.fillStyle='#769980';for(const xx of [85,120,165]){c.beginPath();c.ellipse(xx,94,28,31,0,0,Math.PI*2);c.fill();}
      windowViewMaterial=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv),side:THREE.DoubleSide});
    }
  }
  if(windowViewMaterial){const view=new THREE.Mesh(geoPlane(),windowViewMaterial);view.position.set(x,y,z);view.scale.set(w,h,1);view.rotation.y=ry||0;g.add(view);}
  mkPlane(g, w, h, 0x9fd8ff, x+Math.sin(ry||0)*.015, y, z+Math.cos(ry||0)*.015, 0, ry, 'glass');
  const fr = mat(0xf5f5f5);
  const t = 0.08;
  // рама
  [[0, h / 2 + 0.05], [0, -h / 2 - 0.05]].forEach(([dx, dy]) => { const m = new (T3().Mesh)(geoBox(), fr); m.scale.set(w + 0.16, t, 0.08); m.position.set(x + (ry ? 0 : dx), y + dy, z + (ry ? dx : 0)); m.rotation.y = ry || 0; g.add(m); });
  [-w / 2 - 0.05, w / 2 + 0.05].forEach(dx => { const m = new (T3().Mesh)(geoBox(), fr); m.scale.set(t, h + 0.16, 0.08); m.position.set(x + (ry ? 0 : dx), y, z + (ry ? dx : 0)); m.rotation.y = ry || 0; g.add(m); });
  // подоконник и шторы
  const sill = new (T3().Mesh)(geoBox(), mat(0xefe9df));
  sill.scale.set(w + 0.5, 0.1, 0.3); sill.position.set(x + (ry ? (ry > 0 ? -0.2 : 0.2) : 0), y - h / 2 - 0.1, z + (ry ? 0 : 0.2)); sill.rotation.y = ry || 0; g.add(sill);
  [-w / 2 - 0.3, w / 2 + 0.3].forEach(dx => {
    const cur = new (T3().Mesh)(geoBox(), mat(0xdcd3e8));
    cur.scale.set(0.4, h + 1.0, 0.1); cur.position.set(x + (ry ? 0 : dx), y + 0.35, z + (ry ? dx : 0.22)); cur.rotation.y = ry || 0; g.add(cur);
  });
}
function picture(g, x, y, z, ry, col) {
  const fr = new (T3().Mesh)(geoBox(), mat(0x7a5a34));
  fr.scale.set(1.1, 0.8, 0.07); fr.position.set(x, y, z); fr.rotation.y = ry || 0; g.add(fr);
  const cv = new (T3().Mesh)(geoBox(), mat(col || 0x4a7ab8));
  cv.scale.set(0.94, 0.64, 0.09); cv.position.set(x, y, z); cv.rotation.y = ry || 0; g.add(cv);
}
function plant(g, x, z, s, potCol) {
  s = s || 1;
  mkCyl(g, 0.28 * s, 0.42 * s, potCol || 0xa8593a, x, 0.21 * s, z, 10);
  mkCyl(g, 0.3 * s, 0.06 * s, 0x8a4630, x, 0.44 * s, z, 10);
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2;
    mkSph(g, 0.24 * s, 0x2f7a45, x + Math.cos(a) * 0.16 * s, 0.75 * s, z + Math.sin(a) * 0.16 * s, 8);
  }
  mkSph(g, 0.28 * s, 0x367f4a, x, 0.95 * s, z, 8);
}
function ceilingLight(g, x, z, y, col) {
  mkCyl(g, 0.34, 0.1, col || 0xfff2d0, x, y, z, 12, 'glow');
  mkCyl(g, 0.05, 0.24, 0x8a8f95, x, y + 0.16, z, 6);
}
// ---------------- МЕБЕЛЬ: КУХНЯ ----------------
function kitKitchen(g, cx, cz, ry) {
  const grp = new (T3().Group)(); grp.position.set(cx, 0, cz); grp.rotation.y = ry || 0; g.add(grp);
  const wood = 0x9a6b3f, top = 0x3a3f45, steel = 0xb9c0c8;
  // гарнитур вдоль стены (линия X)
  for (let i = 0; i < 4; i++) {
    const x = -2.7 + i * 1.4;
    // тумба
    mkBox(grp, 1.3, 0.86, 0.62, wood, x, 0.43, -1.35);
    mkBox(grp, 1.36, 0.08, 0.68, top, x, 0.9, -1.35);
    // дверцы и ручки
    mkBox(grp, 0.58, 0.7, 0.04, 0x8a5f36, x - 0.32, 0.43, -1.03);
    mkBox(grp, 0.58, 0.7, 0.04, 0x8a5f36, x + 0.32, 0.43, -1.03);
    mkBox(grp, 0.06, 0.22, 0.04, steel, x - 0.06, 0.5, -1.0);
    mkBox(grp, 0.06, 0.22, 0.04, steel, x + 0.06, 0.5, -1.0);
    // верхние шкафчики
    mkBox(grp, 1.3, 0.7, 0.42, 0xd9cbb6, x, 1.95, -1.45);
    mkBox(grp, 0.6, 0.62, 0.03, 0xcbbda8, x - 0.33, 1.95, -1.22);
    mkBox(grp, 0.6, 0.62, 0.03, 0xcbbda8, x + 0.33, 1.95, -1.22);
  }
  // мойка с краном и посудой
  mkBox(grp, 0.9, 0.16, 0.6, 0x9aa2ad, 2.2, 0.94, -1.33);
  mkBox(grp, 0.7, 0.1, 0.46, 0x6f7680, 2.2, 0.86, -1.33);
  mkCyl(grp, 0.045, 0.42, 0xd8dde2, 2.2, 1.2, -1.55, 8);
  mkCyl(grp, 0.035, 0.26, 0xd8dde2, 2.2, 1.36, -1.44, 8).rotation.x = Math.PI / 2;
  // плита с конфорками и духовкой
  mkBox(grp, 1.2, 0.86, 0.62, 0x2b2f36, -2.7, 0.43, -1.35);
  mkBox(grp, 1.24, 0.06, 0.66, 0x14161a, -2.7, 0.9, -1.35);
  [[-0.35, -0.16], [0.35, -0.16], [-0.35, 0.16], [0.35, 0.16]].forEach(([dx, dz]) => mkCyl(grp, 0.16, 0.04, 0x3a3f45, -2.7 + dx, 0.93, -1.35 + dz, 12));
  mkBox(grp, 1.0, 0.5, 0.05, 0x6f7680, -2.7, 0.45, -1.03);
  mkBox(grp, 1.0, 0.06, 0.06, steel, -2.7, 0.72, -1.0);
  // вытяжка
  mkBox(grp, 1.1, 0.5, 0.5, 0xb9c0c8, -2.7, 2.0, -1.4);
  mkBox(grp, 0.5, 0.4, 0.3, 0xb9c0c8, -2.7, 2.4, -1.5);
  // холодильник с магнитами
  mkBox(grp, 1.0, 2.1, 0.75, 0xe8eaee, 3.35, 1.05, -1.3);
  mkBox(grp, 0.95, 1.3, 0.04, 0xdfe2e8, 3.35, 1.5, -0.91);
  mkBox(grp, 0.95, 0.62, 0.04, 0xdfe2e8, 3.35, 0.55, -0.91);
  mkBox(grp, 0.06, 0.5, 0.06, steel, 3.85, 1.5, -0.9);
  mkBox(grp, 0.06, 0.4, 0.06, steel, 3.85, 0.6, -0.9);
  [[3.05, 1.9, 0xffd76a], [3.6, 1.75, 0xff6b6b], [3.3, 1.6, 0x7cffb2]].forEach(([mx, my, mc]) => mkBox(grp, 0.16, 0.16, 0.03, mc, mx, my, -0.9));
  // микроволновка
  mkBox(grp, 0.62, 0.36, 0.44, 0x9aa2ad, 1.2, 1.12, -1.4);
  mkBox(grp, 0.42, 0.24, 0.03, 0x2b2f36, 1.1, 1.12, -1.17);
  mkBox(grp, 0.08, 0.24, 0.03, 0x6f7680, 1.42, 1.12, -1.17);
  // чайник, кружки, тарелки, кастрюля
  mkCyl(grp, 0.16, 0.28, 0xd8dde2, -1.3, 1.06, -1.3, 12);
  mkCyl(grp, 0.17, 0.04, 0x9aa2ad, -1.3, 1.21, -1.3, 12);
  mkCyl(grp, 0.04, 0.1, 0x2b2f36, -1.3, 1.28, -1.3, 8);
  mkCyl(grp, 0.05, 0.3, 0x2b2f36, -1.48, 1.14, -1.28, 8).rotation.z = 0.6;
  mkCyl(grp, 0.1, 0.18, 0x2b2f36, -1.62, 1.0, -1.28, 10).rotation.z = 0.9;
  [-0.62, -0.42, -0.22].forEach((mx, i) => {
    const cc = [0xf5f5f5, 0xff6b6b, 0x7cffb2][i];
    mkCyl(grp, 0.08, 0.14, cc, mx, 1.0, -1.3, 12);
    mkCyl(grp, 0.064, 0.005, 0x584030, mx, 1.071, -1.3, 12);
    mkTorus(grp, 0.055, cc, mx + 0.09, 1.0, -1.3, 0, Math.PI / 2);
  });
  mkCyl(grp, 0.18, 0.02, 0xf5f5f5, 0.4, 0.945, -1.3, 14);
  mkCyl(grp, 0.14, 0.02, 0x7cffb2, 0.75, 0.945, -1.3, 14);
  mkCyl(grp, 0.2, 0.16, 0x9aa2ad, 1.7, 0.97, -1.3, 12);
  mkCyl(grp, 0.21, 0.03, 0xd8dde2, 1.7, 1.06, -1.3, 12);
  // сушилка с полотенцем и специи
  mkBox(grp, 0.5, 0.04, 0.3, wood, -0.2, 1.35, -1.1);
  mkPlane(grp, 0.3, 0.4, 0xf0e2c8, -0.2, 1.16, -1.1, 0, Math.PI / 2);
  for (let i = 0; i < 4; i++) mkCyl(grp, 0.03, 0.12, [0xffd76a, 0xc0392b, 0x7cffb2, 0x8e44ad][i], 0.3 + i * 0.09, 1.02, -1.5, 8);
  // обеденный стол и стулья
  mkBox(grp, 1.7, 0.09, 1.0, wood, 0.2, 0.76, 0.9);
  [[-0.72, -0.42], [0.72, -0.42], [-0.72, 0.42], [0.72, 0.42]].forEach(([dx, dz]) => mkBox(grp, 0.09, 0.72, 0.09, 0x7a4f2a, 0.2 + dx, 0.36, 0.9 + dz));
  [[-1.35, 0.9, -1], [1.75, 0.9, 1], [0.2, -0.35, 0], [0.2, 2.15, 2]].forEach(([sx, sz, r]) => chair(grp, sx, sz, r * Math.PI / 2));
  // чайник и кружка на столе + сахарница
  mkCyl(grp, 0.14, 0.24, 0xd8dde2, 0, 0.92, 0.9, 12);
  mkCyl(grp, 0.09, 0.13, 0xf5f5f5, 0.55, 0.87, 0.75, 12);
  mkCyl(grp, 0.073, 0.005, 0x584030, 0.55, 0.937, 0.75, 12);
  mkTorus(grp, 0.06, 0xf5f5f5, 0.64, 0.87, 0.75, 0, Math.PI / 2);
  mkCyl(grp, 0.09, 0.12, 0xffd76a, -0.5, 0.86, 1.05, 10);
  return grp;
}
function chair(g, x, z, ry) {
  const g2 = new (T3().Group)(); g2.position.set(x, 0, z); g2.rotation.y = ry || 0; g.add(g2);
  const col = 0x8a5a34;
  mkBox(g2, 0.46, 0.07, 0.46, col, 0, 0.45, 0);
  mkBox(g2, 0.46, 0.6, 0.07, col, 0, 0.78, -0.2);
  [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]].forEach(([dx, dz]) => mkBox(g2, 0.06, 0.45, 0.06, 0x6f4a28, dx, 0.22, dz));
  return g2;
}

// ---------------- МЕБЕЛЬ: ГОСТИНАЯ ----------------
function kitLiving(g, cx, cz, ry) {
  const grp = new (T3().Group)(); grp.position.set(cx, 0, cz); grp.rotation.y = ry || 0; g.add(grp);
  const fab = 0x4a5a7a, fabDark = 0x3b4862, wood = 0x8a5f36, dark = 0x2b2f36;
  // диван (основание, спинка, подлокотники, подушки)
  mkBox(grp, 2.4, 0.4, 0.95, fabDark, -1.2, 0.28, 1.6);
  mkBox(grp, 2.4, 0.62, 0.28, fab, -1.2, 0.79, 2.08);
  mkBox(grp, 0.28, 0.62, 0.95, fab, -2.42, 0.5, 1.6);
  mkBox(grp, 0.28, 0.62, 0.95, fab, 0.02, 0.5, 1.6);
  [-1.85, -1.2, -0.55].forEach((bx, i) => mkBox(grp, 0.55, 0.5, 0.2, [0xf0c674, 0x7cffb2, 0xf0c674][i], bx, 0.62, 2.0));
  [-1.85, -1.2, -0.55].forEach(bx => mkBox(grp, 0.5, 0.14, 0.85, 0x5a6b8a, bx, 0.52, 1.5));
  // кресло
  mkBox(grp, 0.9, 0.38, 0.85, fabDark, 1.5, 0.27, 1.75);
  mkBox(grp, 0.9, 0.6, 0.26, fab, 1.5, 0.76, 2.15);
  mkBox(grp, 0.24, 0.55, 0.85, fab, 1.02, 0.48, 1.75);
  mkBox(grp, 0.24, 0.55, 0.85, fab, 1.98, 0.48, 1.75);
  // журнальный стол с кружкой, пультом и журналами
  mkBox(grp, 0.95, 0.08, 0.6, wood, 0.1, 0.42, 0.75);
  [[-0.4, -0.22], [0.4, -0.22], [-0.4, 0.22], [0.4, 0.22]].forEach(([dx, dz]) => mkBox(grp, 0.07, 0.38, 0.07, 0x6f4a28, 0.1 + dx, 0.19, 0.75 + dz));
  mkCyl(grp, 0.08, 0.13, 0xf5f5f5, -0.15, 0.52, 0.68, 12);
  mkTorus(grp, 0.055, 0xf5f5f5, -0.06, 0.52, 0.68, 0, Math.PI / 2);
  mkBox(grp, 0.2, 0.03, 0.06, dark, 0.3, 0.48, 0.85);
  mkBox(grp, 0.26, 0.02, 0.34, 0xc0392b, 0.05, 0.47, 0.9);
  mkBox(grp, 0.24, 0.02, 0.32, 0x2f7a45, 0.05, 0.49, 0.88);
  rug(grp, 0x8a4a5a, 0, 0.9, 3.6, 2.4);
  // ТВ на тумбе (с приставкой и колонками)
  mkBox(grp, 2.0, 0.45, 0.5, wood, 0, 0.22, -1.9);
  mkBox(grp, 0.5, 0.34, 0.04, 0x7a5230, -0.5, 0.24, -1.63);
  mkBox(grp, 0.5, 0.34, 0.04, 0x7a5230, 0.5, 0.24, -1.63);
  mkBox(grp, 1.35, 0.82, 0.08, dark, 0, 1.0, -1.95);
  mkBox(grp, 1.25, 0.72, 0.02, 0x1b3a5a, 0, 1.0, -1.9);
  mkBox(grp, 0.5, 0.06, 0.3, dark, 0, 0.5, -1.9);
  mkBox(grp, 0.5, 0.06, 0.22, 0x3a3f45, 0.9, 0.52, -1.85);
  mkBox(grp, 0.18, 0.34, 0.18, 0x14161a, -1.0, 0.62, -1.85);
  mkBox(grp, 0.18, 0.34, 0.18, 0x14161a, 1.25, 0.62, -1.85);
  // книжный стеллаж
  kitShelf(grp, 3.3, -1.2, -Math.PI / 2);
  // торшер
  mkCyl(grp, 0.24, 0.05, 0x3a3f45, 2.5, 0.03, -1.2, 12);
  mkCyl(grp, 0.05, 1.5, 0x8a8f95, 2.5, 0.78, -1.2, 8);
  mkCyl(grp, 0.3, 0.36, 0xfff2d0, 2.5, 1.66, -1.2, 12, 'glow');
  // часы и картина
  picture(grp, -1.6, 2.1, -3.4, 0, 0x4a7ab8);
  mkCyl(grp, 0.3, 0.06, 0xf5f5f5, 1.2, 2.2, -3.4, 14).rotation.x = Math.PI / 2;
  mkCyl(grp, 0.03, 0.16, 0x2b2f36, 1.2, 2.2, -3.36, 6);
  mkBox(grp, 0.02, 0.1, 0.02, 0x2b2f36, 1.24, 2.2, -3.34);
  return grp;
}
function kitShelf(g, x, z, ry) {
  const g2 = new (T3().Group)(); g2.position.set(x, 0, z); g2.rotation.y = ry || 0; g.add(g2);
  mkBox(g2, 1.4, 2.0, 0.06, 0x8a5f36, 0, 1.0, -0.2);
  [-0.67, 0.67].forEach(x => mkBox(g2, 0.06, 2, 0.4, 0x8a5f36, x, 1, 0));
  for (let i = 0; i < 4; i++) {
    mkBox(g2, 1.3, 0.05, 0.36, 0x7a5230, 0, 0.3 + i * 0.5, 0);
    const n = ri(4, 7);
    for (let k = 0; k < n; k++) {
      const col = [0xc0392b, 0x2f7a45, 0x2c6fbb, 0xd9a441, 0x8e44ad][ri(0, 4)];
      mkBox(g2, 0.06, ri(24, 34) / 100, 0.26, col, -0.58 + k * (1.16 / Math.max(1, n - 1 || 1)), 0.49 + i * 0.5, 0.02);
    }
  }
  return g2;
}
// ---------------- МЕБЕЛЬ: СПАЛЬНЯ ----------------
function kitBedroom(g, cx, cz, ry, single) {
  const grp = new (T3().Group)(); grp.position.set(cx, 0, cz); grp.rotation.y = ry || 0; g.add(grp);
  const wood = 0x7a5a34, sheet = 0xf2f0ea, blanket = 0x5a7ab0;
  const W = single ? 1.1 : 1.8;
  // кровать: каркас, матрас, одеяло, подушки
  mkBox(grp, W + 0.12, 0.32, 2.1, wood, 0, 0.16, 0);
  mkBox(grp, W, 0.24, 2.0, sheet, 0, 0.44, 0);
  mkBox(grp, W + 0.06, 0.7, 0.12, 0x6f4a28, 0, 0.55, -1.06);
  mkBox(grp, W, 0.14, single ? 1.2 : 1.35, blanket, 0, 0.62, 0.28);
  const pillows = single ? [[0, -0.75]] : [[-0.42, -0.75], [0.42, -0.75]];
  pillows.forEach(([px, pz]) => { mkBox(grp, single ? 0.7 : 0.72, 0.16, 0.42, 0xfdfcf7, px, 0.6, pz); mkBox(grp, 0.6, 0.12, 0.34, 0xf2f0ea, px, 0.7, pz + 0.02); });
  // тумбочка с лампой, будильником, книгой
  mkBox(grp, 0.55, 0.55, 0.45, wood, -W / 2 - 0.5, 0.28, -0.85);
  mkBox(grp, 0.5, 0.2, 0.03, 0x6f4a28, -W / 2 - 0.5, 0.38, -0.63);
  mkCyl(grp, 0.1, 0.06, 0x8a8f95, -W / 2 - 0.5, 0.58, -0.85, 10);
  mkCyl(grp, 0.04, 0.34, 0x8a8f95, -W / 2 - 0.5, 0.76, -0.85, 8);
  mkCyl(grp, 0.22, 0.24, 0xfff2d0, -W / 2 - 0.5, 1.0, -0.85, 12, 'glow');
  mkBox(grp, 0.22, 0.14, 0.14, 0x2b2f36, -W / 2 + 0.05, 0.62, -0.85);
  mkBox(grp, 0.2, 0.04, 0.26, 0xc0392b, -W / 2 - 0.9, 0.58, -0.7);
  // шкаф с одеждой и зеркалом
  const sx = W / 2 + 1.5;
  mkBox(grp, 1.5, 2.1, 0.62, wood, sx, 1.05, -1.4);
  mkBox(grp, 0.7, 2.0, 0.04, 0x8a6a42, sx - 0.37, 1.05, -1.08);
  mkBox(grp, 0.7, 2.0, 0.04, 0x8a6a42, sx + 0.37, 1.05, -1.08);
  mkBox(grp, 0.05, 0.5, 0.05, 0xb9c0c8, sx - 0.06, 1.1, -1.05);
  mkBox(grp, 0.05, 0.5, 0.05, 0xb9c0c8, sx + 0.06, 1.1, -1.05);
  // открытая дверца: полка с вещами
  mkBox(grp, 0.5, 0.05, 0.5, 0x7a5230, sx - 1.0, 1.6, -1.5);
  [-0.2, 0, 0.2].forEach((dz, i) => mkBox(grp, 0.34, 0.08, 0.1, [0xc0392b, 0x2c6fbb, 0x2f7a45][i], sx - 1.0, 1.66, -1.5 + dz));
  // стул с одеждой и коврик
  chair(grp, -W / 2 - 1.4, 0.6, 1.2);
  mkBox(grp, 0.4, 0.5, 0.02, 0x8e44ad, -W / 2 - 1.4, 0.85, 0.42);
  rug(grp, 0x6a5a8a, 0, 1.3, W + 1.6, 1.4);
  // картина и полка
  picture(grp, 0, 2.1, -D_HALF(), 0, 0x2f7a45);
  return grp;
}
function D_HALF() { return 3.6; }
// ---------------- МЕБЕЛЬ: ВАННАЯ ----------------
function kitBathroom(g, cx, cz, ry) {
  const grp = new (T3().Group)(); grp.position.set(cx, 0, cz); grp.rotation.y = ry || 0; g.add(grp);
  const tile = 0xdfe8ee, white = 0xf7f9fb, chrome = 0xc8ced6;
  // плитка на полу
  mkBox(grp, 4.6, 0.04, 3.2, tile, 0, 0.02, 0);
  for (let i = 0; i < 6; i++) for (let k = 0; k < 4; k++) mkBox(grp, 0.72, 0.05, 0.72, (i + k) % 2 ? 0xeaf2f6 : 0xd6e2ea, -1.95 + i * 0.78, 0.045, -1.15 + k * 0.78);
  // ванна с водой, бортиками, смесителем и шторкой
  mkBox(grp, 1.8, 0.42, 0.9, white, -1.35, 0.21, -1.1);
  mkBox(grp, 1.6, 0.1, 0.7, 0x9fd8ff, -1.35, 0.5, -1.1);
  [-1.55, -0.65].forEach(z => mkBox(grp, 1.84, 0.08, 0.08, 0xe8eef2, -1.35, 0.62, z));
  [-2.23, -0.47].forEach(x => mkBox(grp, 0.08, 0.08, 0.86, 0xe8eef2, x, 0.62, -1.1));
  mkCyl(grp, 0.05, 0.3, chrome, -2.1, 0.78, -1.1, 8);
  mkCyl(grp, 0.04, 0.28, chrome, -2.1, 0.92, -1.0, 8).rotation.x = Math.PI / 2;
  mkCyl(grp, 0.05, 0.06, 0xff6b6b, -2.1, 0.7, -1.1, 8);
  mkBox(grp, 1.9, 1.6, 0.05, 0xa8d8f0, -1.35, 1.3, 0.45, 0, 'glass');
  mkBox(grp, 0.06, 1.7, 0.06, chrome, -2.3, 1.4, 0.45);
  mkBox(grp, 0.06, 1.7, 0.06, chrome, -0.4, 1.4, 0.45);
  // шампунь, гель, мочалка, стаканчики
  [[-2.0, 0xffd76a], [-1.85, 0x7cffb2], [-1.7, 0xf5a5c8]].forEach(([bx, bc], i) => mkCyl(grp, 0.06, 0.22, bc, bx, 0.72, -1.42, 8));
  mkSph(grp, 0.11, 0xf0c674, -2.05, 0.55, -0.85, 8);
  [-0.85, -0.7].forEach(bx => mkCyl(grp, 0.04, 0.14, 0xf7f9fb, bx, 0.72, -1.42, 8));
  // унитаз с бачком, кнопкой, бумагой и ёршиком
  mkBox(grp, 0.5, 0.42, 0.62, white, 1.5, 0.21, -1.3);
  mkBox(grp, 0.44, 0.06, 0.56, 0xe8eef2, 1.5, 0.45, -1.3);
  mkBox(grp, 0.5, 0.66, 0.2, white, 1.5, 0.68, -1.55);
  mkCyl(grp, 0.07, 0.05, chrome, 1.5, 1.03, -1.55, 10);
  mkBox(grp, 0.16, 0.16, 0.1, 0xf7f9fb, 1.82, 0.5, -1.3);
  mkCyl(grp, 0.05, 0.34, chrome, 1.84, 0.2, -1.05, 8);
  // раковина с зеркалом, полкой и полотенцами
  mkBox(grp, 0.9, 0.8, 0.5, 0x8a6a42, 1.6, 0.4, 0.9);
  mkBox(grp, 0.86, 0.1, 0.46, white, 1.6, 0.85, 0.9);
  mkBox(grp, 0.7, 0.08, 0.32, 0x6f7680, 1.6, 0.8, 0.9);
  mkCyl(grp, 0.04, 0.34, chrome, 1.6, 1.05, 0.68, 8);
  mkCyl(grp, 0.035, 0.22, chrome, 1.6, 1.18, 0.78, 8).rotation.x = Math.PI / 2;
  mkPlane(grp, 0.76, 0.9, 0xcfe8f5, 1.6, 1.85, 0.66, 0, 0, 'glass');
  mkBox(grp, 0.9, 0.06, 0.05, chrome, 1.6, 1.76, 0.66);
  [-0.4, 0.4].forEach(dx => mkBox(grp, 0.06, 0.9, 0.06, chrome, 1.6 + dx, 1.85, 0.66));
  // зубные щётки, паста, мыло
  [[-0.3, 0x7cffb2], [0.3, 0xff6b6b]].forEach(([dx, cc]) => { mkCyl(grp, 0.02, 0.2, 0xf7f9fb, 1.6 + dx, 0.98, 0.95, 6); mkBox(grp, 0.03, 0.03, 0.1, cc, 1.6 + dx, 1.09, 0.98); });
  mkCyl(grp, 0.05, 0.14, 0x9fd8ff, 1.85, 0.93, 0.85, 8);
  mkBox(grp, 0.2, 0.06, 0.14, 0xf0c674, 1.3, 0.93, 0.85);
  // стиральная машина с люком и панелью
  mkBox(grp, 0.8, 0.9, 0.65, 0xf2f4f7, -0.6, 0.45, 1.15);
  mkCyl(grp, 0.24, 0.06, 0x2b2f36, -0.6, 0.5, 1.5, 14).rotation.x = Math.PI / 2;
  mkCyl(grp, 0.2, 0.05, 0x5a6470, -0.6, 0.5, 1.53, 14).rotation.x = Math.PI / 2;
  mkBox(grp, 0.7, 0.1, 0.04, 0x8a8f95, -0.6, 0.82, 1.5);
  mkCyl(grp, 0.05, 0.04, 0x3a3f45, -0.42, 0.82, 1.51, 10);
  // полотенца на крючках, корзина, коврик
  [0.6, 1.0].forEach((tz, i) => mkBox(grp, 0.36, 0.6, 0.05, [0x9fd8ff, 0xf5a5c8][i], 0.2 + tz, 1.5, 1.5));
  mkCyl(grp, 0.22, 0.34, 0xc8a878, -2.0, 0.17, 1.3, 12);
  rug(grp, 0x8ab4c8, 0.6, 0.2, 1.4, 0.8);
  return grp;
}
// ---------------- МЕБЕЛЬ: ПРИХОЖАЯ И БАЛКОН ----------------
function kitHall(g, cx, cz, ry) {
  const grp = new (T3().Group)(); grp.position.set(cx, 0, cz); grp.rotation.y = ry || 0; g.add(grp);
  const wood = 0x8a6a42;
  // вешалка с куртками
  mkBox(grp, 1.6, 0.1, 0.1, 0xb9c0c8, 0, 1.9, -0.4);
  [-0.55, 0, 0.55].forEach((hx, i) => {
    mkBox(grp, 0.5, 1.0, 0.16, [0x2c6fbb, 0x8e44ad, 0x2f7a45][i], hx, 1.35, -0.4);
    mkCyl(grp, 0.02, 0.12, 0xb9c0c8, hx, 1.92, -0.4, 6);
  });
  // обувница с парами обуви
  mkBox(grp, 1.5, 0.5, 0.5, wood, 0, 0.25, -0.4);
  mkBox(grp, 1.4, 0.04, 0.44, 0x7a5230, 0, 0.36, -0.4);
  [[-0.45, 0x2b2f36], [0, 0x3a3f45], [0.45, 0x4a3f35]].forEach(([bx, bc]) => { mkBox(grp, 0.24, 0.14, 0.4, bc, bx, 0.16, -0.4); mkBox(grp, 0.24, 0.12, 0.36, bc, bx, 0.44, -0.4); });
  // зеркало, ключница, сумка, зонт
  mkPlane(grp, 0.8, 1.5, 0xcfe8f5, 1.1, 1.5, -0.65, 0, 0, 'glass');
  mkBox(grp, 0.9, 0.06, 0.05, 0xb9c0c8, 1.1, 2.28, -0.65);
  mkBox(grp, 0.4, 0.3, 0.06, 0x7a5230, -1.1, 1.7, -0.65);
  [[-1.16, 1.74], [-1.04, 1.7], [-1.1, 1.62]].forEach(([kx, ky]) => mkBox(grp, 0.05, 0.12, 0.04, 0xd9d9d9, kx, ky, -0.6));
  mkBox(grp, 0.4, 0.42, 0.16, 0x8e44ad, -1.6, 0.22, 0.4);
  mkCyl(grp, 0.045, 0.9, 0x2b2f36, 1.9, 0.5, 0.4, 8);
  mkCyl(grp, 0.08, 0.14, 0x2b2f36, 1.9, 0.95, 0.4, 8);
  // комод с рамкой и коврик
  mkBox(grp, 1.4, 0.9, 0.45, wood, 1.4, 0.45, 1.6);
  [0.24, 0.54, 0.82].forEach(dy => mkBox(grp, 1.2, 0.22, 0.04, 0x7a5230, 1.4, dy + 0.1, 1.38));
  mkBox(grp, 0.36, 0.44, 0.03, 0x7a5230, 1.4, 1.12, 1.6);
  mkPlane(grp, 0.28, 0.36, 0x5a7ab0, 1.4, 1.12, 1.59, 0, Math.PI);
  rug(grp, 0x6a5a4a, 0, 0.9, 1.6, 1.0);
  return grp;
}
function kitBalcony(g, cx, cz, W, D, ry) {
  const grp = new (T3().Group)(); grp.position.set(cx, 0, cz); grp.rotation.y = ry || 0; g.add(grp);
  // бортик
  for (let i = 0; i < 8; i++) mkBox(grp, 0.08, 1.0, 0.08, 0xb9c0c8, -W / 2 + 0.3 + i * (W - 0.6) / 7, 0.5, -D / 2 + 0.2);
  mkBox(grp, W, 0.1, 0.1, 0xb9c0c8, 0, 1.0, -D / 2 + 0.2);
  mkBox(grp, W, 0.06, 0.08, 0xb9c0c8, 0, 0.55, -D / 2 + 0.2);
  // сушилка с бельём, растения, столик с кружкой, стульчик, ящики
  mkBox(grp, 1.2, 0.06, 0.5, 0xb9c0c8, -0.6, 1.35, 0.2);
  [-0.4, 0, 0.4].forEach((bx, i) => mkBox(grp, 0.3, 0.7, 0.03, [0xf7f9fb, 0x9fd8ff, 0xf0c674][i], bx, 1.0, 0.2));
  plant(grp, 1.0, -0.2, 0.9);
  plant(grp, 1.35, 0.5, 0.7, 0x8a6a42);
  mkCyl(grp, 0.28, 0.06, 0x6f4a28, -0.9, 0.62, -0.7, 12);
  mkCyl(grp, 0.04, 0.6, 0x6f4a28, -0.9, 0.3, -0.7, 8);
  mkCyl(grp, 0.07, 0.12, 0xf5f5f5, -0.9, 0.71, -0.7, 12);
  chair(grp, 0.2, 0.6, -0.6);
  return grp;
}

// ---------------- ОБЪЕКТЫ ШКОЛЫ ----------------
function desk(g, x, z, ry, col) {
  const g2 = new (T3().Group)(); g2.position.set(x, 0, z); g2.rotation.y = ry || 0; g.add(g2);
  const top = col || 0xc8a878;
  mkBox(g2, 1.05, 0.06, 0.55, top, 0, 0.75, 0);
  mkBox(g2, 1.0, 0.5, 0.06, 0xb9986a, 0, 0.5, -0.24);
  [[-0.44, -0.2], [0.44, -0.2], [-0.44, 0.2], [0.44, 0.2]].forEach(([dx, dz]) => mkBox(g2, 0.06, 0.72, 0.06, 0x8a8f95, dx, 0.36, dz));
  return g2;
}
function deskSet(g, cx, cz, rows, cols, ry, gapX, gapZ) {
  gapX = gapX || 1.4; gapZ = gapZ || 1.6;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = cx + (c - (cols - 1) / 2) * gapX, z = cz + (r - (rows - 1) / 2) * gapZ;
    desk(g, x, z, ry);
    chair(g, x, z + 0.62, Math.PI + (ry || 0));
    if (ri(0,99) < 50) mkBox(g, 0.3, 0.02, 0.4, 0xf7f9fb, x, 0.79, z - 0.05, ry || 0);
    if (ri(0,99) < 40) mkBox(g, 0.16, 0.03, 0.22, [0xc0392b, 0x2c6fbb, 0x2f7a45][ri(0, 2)], x + 0.2, 0.8, z + 0.05, ry || 0);
  }
}
function blackboard(g, x, y, z, ry, col, w) {
  mkBox(g, (w || 4.2) + 0.3, 1.9, 0.14, 0x7a5230, x, y, z, ry);
  mkBox(g, w || 4.2, 1.6, 0.16, col || 0x243b30, x, y, z + 0.02, ry);
  mkBox(g, (w || 4.2) + 0.2, 0.1, 0.28, 0x9aa2ad, x, y - 1.0, z + 0.1, ry);
  for (let i = 0; i < 3; i++) mkBox(g, 0.16, 0.05, 0.05, [0xf7f9fb, 0xf0c674, 0x9fd8ff][i], x - 0.5 + i * 0.5, y - 0.95, z + 0.16, ry);
  // меловые надписи-штрихи
  for (let i = 0; i < 5; i++) mkBox(g, 0.9, 0.05, 0.02, 0xe8eef2, x - 1.4 + i * 0.7, y + 0.5 - (i % 2) * 0.35, z + 0.11, ry);
}
function teacherDesk(g, x, z, ry) {
  mkBox(g, 1.6, 0.08, 0.8, 0x8a6a42, x, 0.76, z, ry);
  mkBox(g, 1.5, 0.7, 0.7, 0x7a5a34, x, 0.38, z, ry);
  mkBox(g, 0.5, 0.34, 0.04, 0x6f4a28, x - 0.4, 0.5, z + 0.37, ry);
  mkBox(g, 0.5, 0.34, 0.04, 0x6f4a28, x + 0.4, 0.5, z + 0.37, ry);
  chair(g, x, z + 0.9, Math.PI + (ry || 0));
  // журнал, стакан с ручками, ноутбук, кружка
  mkBox(g, 0.36, 0.04, 0.26, 0x2f7a45, x - 0.4, 0.82, z + 0.1, ry);
  mkCyl(g, 0.06, 0.12, 0x9fd8ff, x + 0.5, 0.86, z + 0.15, 10);
  [-0.03, 0.02, 0.05].forEach((dx, i) => mkBox(g, 0.02, 0.16, 0.02, [0xc0392b, 0x2c6fbb, 0x2b2f36][i], x + 0.5 + dx, 0.94, z + 0.15));
  mkBox(g, 0.44, 0.02, 0.3, 0x3a3f45, x - 0.2, 0.79, z - 0.1, ry);
  mkBox(g, 0.44, 0.28, 0.02, 0x2b2f36, x - 0.2, 0.92, z - 0.25, ry);
  mkCyl(g, 0.07, 0.12, 0xf5f5f5, x + 0.15, 0.86, z - 0.2, 12);
}
function lockers(g, x, z, ry, n) {
  for (let i = 0; i < (n || 6); i++) {
    const col = [0x3a6f9a, 0x2f7a45, 0x9a5a3a, 0x6a5a8a][i % 4];
    mkBox(g, 0.5, 2.0, 0.45, col, x + i * 0.52, 1.0, z, ry);
    mkBox(g, 0.44, 0.9, 0.03, 0x000000, x + i * 0.52, 1.4, z + 0.23, ry);
    mkBox(g, 0.1, 0.06, 0.05, 0xd9d9d9, x + i * 0.52 + 0.14, 1.1, z + 0.24, ry);
    mkBox(g, 0.16, 0.04, 0.1, 0xd9d9d9, x + i * 0.52, 1.98, z + 0.14, ry);
  }
}
function computerSet(g, x, z, ry, n) {
  for (let i = 0; i < (n || 4); i++) {
    const cx = x + i * 1.5;
    mkBox(g, 1.2, 0.06, 0.6, 0xd8d2c8, cx, 0.75, z, ry);
    [[-0.5, -0.24], [0.5, -0.24], [-0.5, 0.24], [0.5, 0.24]].forEach(([dx, dz]) => mkBox(g, 0.06, 0.72, 0.06, 0x8a8f95, cx + dx, 0.36, z + dz, ry));
    mkBox(g, 0.06, 0.3, 0.6, 0xc8c2b8, cx, 1.16, z - 0.2, ry);
    mkBox(g, 0.6, 0.42, 0.04, 0x1b1e24, cx, 1.05, z - 0.02, ry);
    mkBox(g, 0.54, 0.36, 0.02, [0x1b3a5a, 0x1b5a3a, 0x3a1b5a][i % 3], cx, 1.05, z + 0.01, ry);
    mkBox(g, 0.44, 0.03, 0.16, 0x2b2f36, cx, 0.79, z + 0.18, ry);
    mkBox(g, 0.16, 0.4, 0.4, 0x2b2f36, cx + 0.45, 0.2, z - 0.24, ry);
    chair(g, cx, z + 0.72, Math.PI + (ry || 0));
  }
}
function labSet(g, x, z, ry) {
  mkBox(g, 1.4, 0.08, 0.7, 0x3a3f45, x, 0.78, z, ry);
  mkBox(g, 1.3, 0.7, 0.6, 0x2b2f36, x, 0.38, z, ry);
  mkBox(g, 1.3, 0.05, 0.05, 0xd9d9d9, x, 0.72, z + 0.32, ry);
  // колбы, пробирки, штатив, спиртовка, микроскоп
  mkCyl(g, 0.1, 0.24, 0xd8f0ff, x - 0.45, 0.94, z, 12, 'glass');
  mkCyl(g, 0.06, 0.3, 0x9ff0d8, x - 0.15, 0.97, z + 0.05, 10, 'glass');
  for (let i = 0; i < 4; i++) mkCyl(g, 0.03, 0.16, [0xff6b6b, 0xffd76a, 0x7cffb2, 0x9fd8ff][i], x + 0.1 + i * 0.07, 0.9, z - 0.2, 8, 'glass');
  mkBox(g, 0.3, 0.04, 0.2, 0x8a6a42, x + 0.25, 0.84, z - 0.2, ry);
  mkCyl(g, 0.08, 0.14, 0xb9c0c8, x + 0.5, 0.89, z + 0.1, 10);
  mkCyl(g, 0.05, 0.08, 0xffd76a, x + 0.5, 1.0, z + 0.1, 8, 'glow');
  // микроскоп
  mkBox(g, 0.2, 0.05, 0.3, 0x2b2f36, x - 0.6, 0.84, z + 0.25);
  mkBox(g, 0.06, 0.3, 0.06, 0x3a3f45, x - 0.6, 1.0, z + 0.25);
  mkCyl(g, 0.05, 0.16, 0x8a8f95, x - 0.6, 1.2, z + 0.25, 8);
  mkCyl(g, 0.03, 0.08, 0x2b2f36, x - 0.6, 1.31, z + 0.25, 6);
}
function skeleton(g, x, z, ry) {
  mkCyl(g, 0.16, 0.05, 0x8a8f95, x, 0.06, z, 10);
  mkCyl(g, 0.05, 1.3, 0xb9c0c8, x, 0.7, z, 8);
  mkSph(g, 0.16, 0xe8e2d8, x, 1.55, z, 10);
  mkBox(g, 0.12, 0.1, 0.14, 0xf7f9fb, x, 1.45, z, ry);
  for (let i = 0; i < 5; i++) mkBox(g, 0.42, 0.04, 0.1, 0xe8e2d8, x, 1.28 - i * 0.1, z);
  mkBox(g, 0.06, 0.6, 0.06, 0xe8e2d8, x - 0.24, 1.05, z);
  mkBox(g, 0.06, 0.6, 0.06, 0xe8e2d8, x + 0.24, 1.05, z);
  mkBox(g, 0.06, 0.66, 0.06, 0xe8e2d8, x - 0.12, 0.36, z);
  mkBox(g, 0.06, 0.66, 0.06, 0xe8e2d8, x + 0.12, 0.36, z);
}
function hoop(g, x, z, ry) {
  mkCyl(g, 0.08, 3.2, 0x8a8f95, x, 1.6, z, 8);
  mkBox(g, 1.8, 1.1, 0.08, 0xf7f9fb, x, 3.0, z, ry);
  mkBox(g, 1.0, 0.7, 0.02, 0xc0392b, x, 2.95, z + 0.05, ry);
  const ring = new (T3().Mesh)(geoTorus(), mat(0xe8622a));
  ring.scale.setScalar(0.9); ring.position.set(x, 2.55, z + 0.45); ring.rotation.x = Math.PI / 2; g.add(ring);
  // сетка
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    mkBox(g, 0.02, 0.42, 0.02, 0xf7f9fb, x + Math.cos(a) * 0.28, 2.34, z + 0.45 + Math.sin(a) * 0.28);
  }
  mkCyl(g, 0.28, 0.02, 0xf7f9fb, x, 2.13, z + 0.45, 12);
}
function gymWall(g, x, z, ry, n) {
  mkBox(g, 0.16, 3.0, 0.16, 0x8a6a42, x, 1.5, z, ry);
  mkBox(g, 0.16, 3.0, 0.16, 0x8a6a42, x + 1.6, 1.5, z, ry);
  for (let i = 0; i < (n || 6); i++) mkCyl(g, 0.05, 1.7, 0x8a6a42, x + 0.8, 0.5 + i * 0.45, z, 8).rotation.z = Math.PI / 2;
}
function gymMat(g, x, z, ry) {
  mkBox(g, 2.0, 0.12, 1.0, 0x2c6fbb, x, 0.06, z, ry);
  mkBox(g, 1.9, 0.1, 0.9, 0x3a7fca, x, 0.13, z, ry);
}
function canteenTable(g, x, z, ry, seats) {
  mkBox(g, 2.4, 0.08, 0.9, 0xe8e2d8, x, 0.76, z, ry);
  [[-1.05, -0.35], [1.05, -0.35], [-1.05, 0.35], [1.05, 0.35]].forEach(([dx, dz]) => mkBox(g, 0.08, 0.72, 0.08, 0x9aa2ad, x + dx, 0.38, z + dz, ry));
  const n = seats || 4;
  for (let i = 0; i < n; i++) {
    const side = i < n / 2 ? -1 : 1, idx = i % Math.ceil(n / 2);
    chair(g, x - 0.8 + idx * 1.6, z + side * 0.85, side < 0 ? 0 : Math.PI);
    // поднос с едой и стакан
    if (ri(0,99) < 60) {
      mkBox(g, 0.42, 0.03, 0.3, 0x8a5f36, x - 0.8 + idx * 1.6, 0.82, z + side * 0.35);
      mkCyl(g, 0.1, 0.06, 0xf7f9fb, x - 0.8 + idx * 1.6 - 0.1, 0.86, z + side * 0.35, 10);
      mkCyl(g, 0.07, 0.1, 0x9fd8ff, x - 0.8 + idx * 1.6 + 0.12, 0.88, z + side * 0.35, 10);
    }
  }
}
function canteenCounter(g, x, z, ry) {
  mkBox(g, 3.2, 1.0, 0.8, 0xd8d2c8, x, 0.5, z, ry);
  mkBox(g, 3.3, 0.08, 0.9, 0x9aa2ad, x, 1.04, z, ry);
  mkBox(g, 3.2, 0.9, 0.06, 0xa8d8f0, x, 1.6, z - 0.6, ry, 'glass');
  // кастрюли, подносы, касса, меню
  mkCyl(g, 0.22, 0.18, 0xb9c0c8, x - 1.0, 1.16, z, 12);
  mkCyl(g, 0.2, 0.16, 0xb9c0c8, x - 0.4, 1.15, z, 12);
  [-1.0, -0.4].forEach(kx => mkCyl(g, 0.23, 0.04, 0xd9d9d9, x + kx, 1.25, z, 12));
  mkBox(g, 0.7, 0.06, 0.5, 0x8a5f36, x + 0.7, 1.1, z);
  mkBox(g, 0.4, 0.3, 0.3, 0x2b2f36, x + 1.3, 1.22, z);
  mkBox(g, 0.34, 0.2, 0.02, 0x7cffb2, x + 1.3, 1.3, z + 0.16);
  const menu = new (T3().Group)(); menu.position.set(x, 2.2, z - 0.75); g.add(menu);
  mkBox(menu, 1.6, 0.9, 0.06, 0x3a3f45, 0, 0, 0);
  for (let i = 0; i < 5; i++) mkBox(menu, 1.3, 0.06, 0.02, i === 0 ? 0xf0c674 : 0xe8eef2, 0, 0.3 - i * 0.14, 0.04);
}
function cooler(g, x, z) {
  mkBox(g, 0.42, 1.0, 0.42, 0xf2f4f7, x, 0.5, z);
  mkCyl(g, 0.2, 0.5, 0x9fd8ff, x, 1.25, z, 12, 'glass');
  mkCyl(g, 0.05, 0.1, 0x2b2f36, x, 0.85, z + 0.22, 8);
  mkCyl(g, 0.04, 0.12, 0xf7f9fb, x, 0.62, z + 0.24, 8);
}
function fireExt(g, x, y, z, ry) {
  mkBox(g, 0.26, 0.26, 0.04, 0xe8e2d8, x, y, z, ry);
  mkCyl(g, 0.09, 0.5, 0xc0392b, x, y - 0.35, z + 0.05, 10);
  mkBox(g, 0.12, 0.06, 0.05, 0x2b2f36, x, y - 0.08, z + 0.06);
}
function piano(g, x, z, ry) {
  mkBox(g, 1.5, 0.5, 0.6, 0x1b1e24, x, 0.95, z, ry);
  mkBox(g, 1.4, 0.12, 0.24, 0xf7f9fb, x, 0.76, z + 0.4, ry);
  for (let i = 0; i < 14; i++) mkBox(g, 0.06, 0.1, 0.18, 0x1b1e24, x - 0.62 + i * 0.095, 0.82, z + 0.44, ry);
  [[-0.6, 0.2], [0.6, 0.2], [-0.6, -0.2], [0.6, -0.2]].forEach(([dx, dz]) => mkBox(g, 0.1, 0.7, 0.1, 0x14161a, x + dx, 0.35, z + dz, ry));
  chair(g, x, z + 1.0, Math.PI + (ry || 0));
}
function stageChair(g, x, z, ry, col) {
  mkBox(g, 0.5, 0.1, 0.5, col || 0x8a2a3a, x, 0.5, z, ry);
  mkBox(g, 0.5, 0.7, 0.1, col || 0x8a2a3a, x, 0.85, z - 0.2, ry);
  [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].forEach(([dx, dz]) => mkBox(g, 0.06, 0.5, 0.06, 0x5a1a26, x + dx, 0.25, z + dz, ry));
}
function easel(g, x, z, ry) {
  [[-0.35, 0.2], [0.35, 0.2], [0, -0.3]].forEach(([dx, dz]) => mkBox(g, 0.07, 1.6, 0.07, 0x8a6a42, x + dx, 0.8, z + dz, ry));
  mkBox(g, 0.5, 0.04, 0.1, 0x8a6a42, x, 0.9, z + 0.16, ry);
  mkBox(g, 0.9, 0.7, 0.05, 0xf7f9fb, x, 1.25, z + 0.1, ry);
  mkBox(g, 0.5, 0.4, 0.02, [0xc0392b, 0x2c6fbb, 0x2f7a45, 0xf0c674][ri(0, 3)], x - 0.15, 1.3, z + 0.13, ry);
}
function globe(g, x, y, z) {
  mkCyl(g, 0.05, 0.1, 0x8a6a42, x, y, z, 10);
  mkCyl(g, 0.03, 0.3, 0x8a6a42, x, y + 0.2, z, 8);
  mkSph(g, 0.22, 0x2c6fbb, x, y + 0.55, z, 14);
  mkBox(g, 0.3, 0.1, 0.02, 0x2f7a45, x, y + 0.6, z + 0.2);
}
function wallMap(g, x, y, z, ry, col) {
  mkBox(g, 2.4, 1.4, 0.06, 0xf7f9fb, x, y, z, ry);
  mkBox(g, 2.2, 1.2, 0.07, col || 0xa8c8e8, x, y, z, ry);
  mkBox(g, 0.5, 0.3, 0.08, 0x8ab87a, x - 0.5, y + 0.2, z, ry);
  mkBox(g, 0.4, 0.24, 0.08, 0x8ab87a, x + 0.6, y - 0.3, z, ry);
}


// ---------------- FLOOR PLANS ----------------
const PLANS = {
  school: [
    [['Математика • 101','math'], ['Литература • 102','lit'], ['Медпункт • 103','nurse'],
     ['Столовая','canteen'], ['Спортзал','gym'], ['Гардероб','cloak']],
    [['Физика • 201','physics'], ['Биология • 202','bio'], ['Информатика • 203','it'],
     ['Библиотека','library'], ['История • 204','hist'], ['Учительская','staff']],
    [['Рисование • 301','art'], ['Музыка • 302','music'], ['Актовый зал','auditorium'],
     ['Проектная мастерская','project'], ['Читальный зал','reading'], ['Кабинет директора','principal']]
  ],
  house: [
    [['Кухня-столовая','kitchen'], ['Гостиная','living'], ['Кабинет','study'],
     ['Ванная','bath'], ['Прихожая','hall'], ['Прачечная','laundry']],
    [['Главная спальня','bed'], ['Детская','kids'], ['Гостевая спальня','guest'],
     ['Ванная второго этажа','bath'], ['Библиотека','reading'], ['Зимний сад','garden']]
  ],
  apartment: [
    [['Кухня','kitchen'], ['Гостиная-спальня','studio'], ['Ванная','bath'], ['Прихожая','hall']],
    [['Кухня-столовая','kitchen'], ['Гостиная','living'], ['Спальня','bed'],
     ['Ванная','bath'], ['Детская','kids'], ['Кабинет','study']],
    [['Кухня пентхауса','kitchen'], ['Гостиная','living'], ['Спальня','bed'],
     ['Ванная','bath'], ['Библиотека','reading'], ['Зимний сад','garden']]
  ]
};
const QUESTIONS = {
  math: [ ['Сколько будет 7 × 8?', ['54','56','64'], 1, '7 × 8 = 56.'], ['Площадь квадрата со стороной 6?', ['12','24','36'], 2, 'Площадь: сторона × сторона.'] ],
  lit: [ ['Кто написал «Сказку о рыбаке и рыбке»?', ['А. Пушкин','Л. Толстой','А. Чехов'], 0, 'Автор — Александр Сергеевич Пушкин.'] ],
  physics: [ ['В каких единицах измеряют силу?', ['Вольт','Ньютон','Ватт'], 1, 'Ньютон — единица силы в СИ.'], ['Что измеряет термометр?', ['Давление','Скорость','Температуру'], 2, 'Термометр измеряет температуру.'] ],
  bio: [ ['Как растения получают энергию света?', ['Фотосинтез','Испарение','Замерзание'], 0, 'При фотосинтезе световая энергия преобразуется в химическую.'] ],
  it: [ ['Сколько бит в одном байте?', ['4','8','16'], 1, 'Один байт содержит 8 бит.'] ],
  hist: [ ['В каком году состоялся первый полёт человека в космос?', ['1945','1961','1969'], 1, 'Юрий Гагарин совершил полёт 12 апреля 1961 года.'] ]
};
let active = null, panel = null, panelReturnFocus = null, currentQuiz = null, task = null;
let elapsed = 0, hudTimer = 0;
const cooldowns = new Map();
function owned(o) { return !!o && !!o.fz8b; }
function inside() { return typeof isInsideBuilding !== 'undefined' && isInsideBuilding; }
function available() {
  return typeof scene !== 'undefined' && scene && typeof localPlayer !== 'undefined' && localPlayer && localPlayer.mesh;
}
function sign(g, text, x, y, z, w, ry, bg, fg) {
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = bg || '#233c42'; ctx.fillRect(0, 0, 768, 160);
  ctx.strokeStyle = '#b8c6b2'; ctx.lineWidth = 5; ctx.strokeRect(8, 8, 752, 144);
  ctx.fillStyle = fg || '#fff3d6'; ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(text, 384, 94, 718);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geoPlane(), material);
  mesh.position.set(x,y,z); mesh.scale.set(w || 3, (w || 3)*160/768, 1); mesh.rotation.y = ry || 0;
  g.add(mesh);
  if (active) active.resources.push(texture, material);
  return mesh;
}
function collider(x,z,w,d) {
  const c = { minX: INTERIOR_BASE.x+x-w/2, maxX: INTERIOR_BASE.x+x+w/2,
    minZ: INTERIOR_BASE.z+z-d/2, maxZ: INTERIOR_BASE.z+z+d/2 };
  interiorColliders.push(c); return c;
}
let contactMaterial=null;
function contactShadow(g,x,z,w,d) {
  if(!contactMaterial) {
    const cv=document.createElement('canvas'); cv.width=cv.height=64;
    const c=cv.getContext('2d');
    if(!c) return;
    for(let r=30;r>0;r-=2){c.fillStyle='rgba(25,28,24,0.025)';c.beginPath();c.ellipse(32,32,r,r,0,0,Math.PI*2);c.fill();}
    contactMaterial=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  }
  const m=new THREE.Mesh(geoPlane(),contactMaterial);m.rotation.x=-Math.PI/2;m.position.set(x,.018,z);m.scale.set(w+1,d+1,1);g.add(m);
}
function obstacle(room,x,z,w,d) {
  const dir=room.z>0?-1:1;
  contactShadow(room.group,x,z,w,d);
  return collider(room.x+x*dir,room.z+z*dir,w,d);
}
function addSpot(label, x,z,action, extra) {
  const spot = Object.assign({ type: 'fz8b_action', fz8b: true, interior: true,
    name: label, position: { x: INTERIOR_BASE.x+x, y: currentFloor*3.5, z: INTERIOR_BASE.z+z },
    range: 1.9, action, floor: currentFloor },extra || {});
  interactables.push(spot); active.spots.push(spot); return spot;
}
function roomSpot(room,label,x,z,action,extra) {
  const dir=room.z>0?-1:1;
  return addSpot(label,room.x+x*dir,room.z+z*dir,action,Object.assign({ room: room.id },extra));
}
function wall(g,x,z,w,d,color) {
  mkBox(g,w,3.2,d,color,x,1.6,z); const c=collider(x,z,w,d); active.walls.push(c);
  mkBox(g,w+.02,.13,d+.04,0xc8bdac,x,.065,z);
}
function door(g,x,z,id,title) {
  const pivot = new THREE.Group(); pivot.position.set(x-1.2,0,z); pivot.userData.live = true; g.add(pivot);
  mkBox(pivot,2.4,2.55,.09,0x927047,1.2,1.275,0);
  mkBox(pivot,1.8,.86,.1,0xa8d4df,1.2,1.7,0,0,'glass');
  mkBox(pivot,.14,.06,.2,0xdac89d,2.15,1.05,.08);
  [-1.3,1.3].forEach(dx=>mkBox(g,.14,2.72,.24,0xc9b593,x+dx,1.36,z));
  mkBox(g,2.75,.18,.24,0xc9b593,x,2.7,z);
  const c = collider(x,z,2.4,.16);
  // Doors start open; the collision is installed only once fully closed.
  interiorColliders.splice(interiorColliders.indexOf(c),1);
  const d = { id, pivot, open: true, angle: -Math.PI/2, target: -Math.PI/2, collider: c, x,z };
  pivot.rotation.y=d.angle; active.doors.push(d);
  const spot=addSpot('Закрыть дверь: '+title,x,z>0?z-.85:z+.85,'door',{ door:id,range:1.65 });
  d.spot=spot;
}
function toggleDoor(id) {
  const d=active && active.doors.find(d=>d.id===id); if (!d) return false;
  const p=localPlayer.mesh.position, dx=p.x-INTERIOR_BASE.x-d.x, dz=p.z-INTERIOR_BASE.z-d.z;
  if (d.open && Math.abs(dx)<1.8 && Math.abs(dz)<.68) { notify('Отойди от дверного проёма, чтобы закрыть дверь.'); return false; }
  d.open=!d.open; d.target=d.open?-Math.PI/2:0;
  const i=interiorColliders.indexOf(d.collider); if(i>=0) interiorColliders.splice(i,1);
  d.spot.name=(d.open?'Закрыть':'Открыть')+' дверь';
  return true;
}
// One instanced draw per geometry/material; excludes lights and animated props.
function batch(root) {
  root.updateMatrixWorld(true);
  const inverse=new THREE.Matrix4().copy(root.matrixWorld).invert(), groups=new Map();
  root.traverse(o=>{
    if(!o.isMesh || o.isInstancedMesh) return;
    for(let p=o;p && p!==root;p=p.parent) if(p.userData.live) return;
    const key=o.geometry.uuid+':'+o.material.uuid;
    if(!groups.has(key)) groups.set(key,[]); groups.get(key).push(o);
  });
  let instances=0;
  groups.forEach(meshes=>{
    if(meshes.length<2) return;
    const inst=new THREE.InstancedMesh(meshes[0].geometry,meshes[0].material,meshes.length);
    meshes.forEach((m,i)=>{ inst.setMatrixAt(i,new THREE.Matrix4().multiplyMatrices(inverse,m.matrixWorld)); m.parent.remove(m); });
    inst.instanceMatrix.needsUpdate=true; inst.frustumCulled=false; root.add(inst); instances+=meshes.length;
  });
  return instances;
}
function table(g,x,z) { desk(g,x,z); chair(g,x,z+1,Math.PI); }
function decorate(room) {
  const g=new THREE.Group(); g.position.set(room.x,0,room.z); g.rotation.y=room.z>0?Math.PI:0; active.root.add(g); room.group=g;
  const k=room.kind;
  const schools=active.type==='school';
  const tile=['bath','nurse','canteen','laundry','physics','bio'].includes(k);
  mkBox(g,11.78,.12,10.78,tile?0xcad8d5:schools?0xb99d72:0xaf8a61,0,-.07,0);
  if(tile) {
    for(let x=-5;x<=5;x+=1) mkBox(g,.018,.006,10.6,0x9bb2ae,x,.004,0);
    for(let z=-5;z<=5;z+=1) mkBox(g,11.6,.006,.018,0x9bb2ae,0,.004,z);
  } else {
    for(let z=-5;z<=5;z+=.55) mkBox(g,11.6,.007,.014,0x94744f,0,.002,z);
  }
  const windowGroup=new THREE.Group();windowGroup.position.set(-5.81,0,-2);windowGroup.rotation.y=Math.PI/2;g.add(windowGroup);
  windowPane(windowGroup,0,1.9,0,3.4,1.65,0);
  // Radiator under the window, with vertical sections and a wall socket.
  mkBox(windowGroup,2.4,.65,.2,0xe4e3d8,0,.52,.2);
  for(let x=-1;x<=1;x+=.2) mkBox(windowGroup,.06,.6,.25,0xc9cfc9,x,.52,.2);
  mkBox(g,.12,.12,.1,0xf8f2df,4,.3,-5.32);
  ceilingLight(g,-2,0,3.04); ceilingLight(g,2,0,3.04);
  mkBox(g,.03,.85,10.6,schools?0x8eaaa1:tile?0x8caeae:0x7f9583,-5.83,.5,0);
  mkBox(g,.05,.07,10.6,0xd8c9ac,-5.8,.95,0);
  if(schools) {
    sign(g,k==='math'?'ГЕОМЕТРИЯ • АЛГЕБРА':k==='it'?'ДУМАЙ → ПИШИ → ПРОВЕРЯЙ':'ФАНТАЗИЯ • УЧИМСЯ ВМЕСТЕ',-5.79,2,2.2,3.4,Math.PI/2,'#d4c39b','#365250');
    fireExt(g,5.65,1.4,3,Math.PI/2);
  } else picture(g,5.8,1.9,0,-Math.PI/2,0x6e8b8a);

  if(QUESTIONS[k]) {
    deskSet(g,0,.25,3,3,0,2.5,2.1);
    blackboard(g,0,1.85,-4.8,0); sign(g, k==='math'?'a² + b² = c²':k==='physics'?'F = m × a':k==='bio'?'Клетка → ткань → орган':k==='it'?'01001000 • алгоритмы':k==='hist'?'1961 • Первый полёт':'Читаем • думаем • обсуждаем',0,1.9,-4.69,3.8,0,'#243b30');
    teacherDesk(g,-3.7,-3.9,0); obstacle(room,-3.7,-3.9,1.8,.9);
    for(let r=0;r<3;r++) for(let c=0;c<3;c++) obstacle(room,(c-1)*2.5,.25+(r-1)*2.1,1.15,1.4);
    if(k==='bio') { skeleton(g,4,-3.7); plant(g,4,3,1.1); }
    if(k==='physics'||k==='bio') { labSet(g,3.8,-3.8); obstacle(room,3.8,-3.8,1.6,.9); }
    if(k==='it') { computerSet(g,-3.7,-3.8,0,5); }
    if(k==='hist') { wallMap(g,4,2,-5.2,0); globe(g,3.8,.75,-3.7); }
    roomSpot(room,'Начать урок: '+room.title,-1.25,-3.25,'lesson',{subject:k,range:1.7});
  } else switch(k) {
    case 'kitchen':
      kitKitchen(g,0,-3.75,0); obstacle(room,0,-5.1,8,.85); obstacle(room,.2,-2.85,1.9,1.3);
      roomSpot(room,'Вскипятить чайник',-1.3,-3.95,'tea');
      roomSpot(room,'Приготовить обед',-3.5,-3.75,'cook');
      plant(g,4,3,1); rug(g,0x547e79,0,1.1,5,2.2);
      picture(g,-5.82,1.9,0,Math.PI/2,0x8faa83); break;
    case 'living':
      kitLiving(g,0,-.7,0); obstacle(room,-1.2,.9,2.9,1.25); obstacle(room,1.5,1.05,1.4,1.1); obstacle(room,.1,.05,1.1,.75);
      obstacle(room,0,-2.6,2.2,.65); roomSpot(room,'Включить телевизор',0,-1.65,'tv'); break;
    case 'bed': case 'guest': case 'kids': case 'studio':
      kitBedroom(g,-1,-1.5,0,k==='kids'); obstacle(room,-1,-1.5,k==='kids'?1.4:2.1,2.3);
      obstacle(room,1.4,-2.9,1.8,.85); table(g,3.6,1.5); obstacle(room,3.6,1.5,1.3,1.2);
      roomSpot(room,'Отдохнуть на кровати',-2.7,-.7,'rest');
      if(k==='kids') { for(let i=0;i<8;i++) mkBox(g,.22,.22,.22,[0xe27756,0xe2be65,0x749eaa][i%3],-3+i*.4,.13,2.4); mkSph(g,.3,0xe78944,2,.3,3); }
      if(k==='studio') { kitShelf(g,4,-3.6,0); mkBox(g,1.6,.8,.12,0x253d48,0,1.1,4.9); }
      break;
    case 'bath':
      kitBathroom(g,0,-1,0); obstacle(room,-1.35,-2.1,1.9,1); obstacle(room,1.5,-2.3,.6,.8);
      obstacle(room,1.6,-.1,1,.7); obstacle(room,-.6,.15,.9,.8);
      roomSpot(room,'Наполнить ванну',-3,-1.4,'bath'); roomSpot(room,'Запустить стирку',-.6,1.3,'wash'); break;
    case 'laundry':
      kitBathroom(g,-1,-1,0); kitShelf(g,4,-2,0); rug(g,0x829eab,0,2,4,2);
      obstacle(room,-1.6,.15,.9,.8); roomSpot(room,'Запустить стирку',-1.6,1.3,'wash');
      mkBox(g,2,.08,.55,0xbacbd0,2,.9,1); for(let i=0;i<3;i++) mkBox(g,.45,.08,.35,0xf0dfcf,2,.98+i*.08,1); break;
    case 'hall': case 'cloak':
      if(k==='hall') kitHall(g,-3,-2,0); else { lockers(g,-5,-4.9,0,19); lockers(g,-5,4.9,0,19); }
      for(const x of [-3,3]) { mkBox(g,2.5,.12,.65,0x9d7650,x,.45,0); obstacle(room,x,0,2.6,.75); }
      plant(g,4,-3,1); roomSpot(room,k==='hall'?'Посмотреть ключницу':'Посмотреть расписание',0,0,k==='hall'?'keys':'schedule'); break;
    case 'study': case 'staff': case 'principal': case 'project':
      teacherDesk(g,0,-2.5,0); obstacle(room,0,-2.5,1.8,1.2); kitShelf(g,-4.5,-3,0); kitShelf(g,4.5,-3,0);
      if(k==='staff'||k==='project') { table(g,-3,1); table(g,3,1); }
      else { globe(g,3,.75,1.5); table(g,3,1.5); }
      roomSpot(room,k==='principal'?'Открыть дневник':'Почитать записи',0,-.7,k==='principal'?'journal':'read'); break;
    case 'library': case 'reading':
      for(let x=-4.5;x<=4.5;x+=1.8) { kitShelf(g,x,-4.7,0); obstacle(room,x,-4.7,1.5,.5); }
      for(const x of [-3,3]) { table(g,x,0); obstacle(room,x,0,1.3,1.4); }
      roomSpot(room,'Взять книгу',0,-3.5,'read'); rug(g,0x749188,0,2,4,2); break;
    case 'garden':
      for(const x of [-4,4]) for(const z of [-3,0,3]) { plant(g,x,z,1.5); obstacle(room,x,z,1,1); }
      kitBalcony(g,0,-1,8,5,0); roomSpot(room,'Полить растения',2,2,'water'); break;
    case 'nurse':
      kitBedroom(g,-3,-1,0,true); obstacle(room,-3,-1,1.5,2.3); teacherDesk(g,3,-3,0);
      mkBox(g,1,1.8,.45,0xe8f0e9,4,.9,2); mkBox(g,.18,.5,.04,0xc84e4e,4,1.3,2.25); mkBox(g,.5,.18,.04,0xc84e4e,4,1.3,2.25);
      roomSpot(room,'Отдохнуть в медпункте',-1.5,-.5,'rest'); break;
    case 'canteen':
      canteenCounter(g,0,-4.3,0); obstacle(room,0,-4.3,3.5,1);
      for(const x of [-3,3]) for(const z of [-.5,3]) { canteenTable(g,x,z,0,4); obstacle(room,x,z,2.5,1.1); }
      roomSpot(room,'Взять школьный обед',0,-2.9,'lunch'); cooler(g,-5,-2.5); break;
    case 'gym':
      hoop(g,0,-4.9); gymWall(g,-5,0,0,6); gymMat(g,-3,3); gymMat(g,3,3);
      mkSph(g,.26,0xdf8541,1,.27,1.5,12); for(const x of [-4,4]) mkBox(g,.06,.02,8,0xf5e3bc,x,.01,0);
      mkBox(g,8,.02,.06,0xf5e3bc,0,.01,0); mkTorus(g,1,0xf5e3bc,0,.02,0,Math.PI/2,0);
      roomSpot(room,'Бросить мяч в кольцо',0,-.7,'basket'); break;
    case 'art':
      for(const x of [-3,0,3]) for(const z of [-2,2]) { easel(g,x,z); obstacle(room,x,z,1,.7); }
      roomSpot(room,'Посмотреть палитру',-4,2,'art'); break;
    case 'music':
      piano(g,0,-3); for(const x of [-3,0,3]) for(const z of [0,2.5]) stageChair(g,x,z);
      roomSpot(room,'Сыграть на пианино',0,-1.5,'music'); break;
    case 'auditorium':
      mkBox(g,9,.25,2,0x96754e,0,.125,-4); piano(g,-3,-3.6);
      for(let x=-4;x<=4;x+=1.3) for(let z=-.5;z<=3;z+=1.4) { stageChair(g,x,z); obstacle(room,x,z,.65,.65); }
      roomSpot(room,'Включить свет сцены',0,-2.1,'stage'); break;
  }
  if(!['gym','bath','laundry'].includes(k)) plant(g,-5,3.7,.8);
  roomSpot(room,'Выключатель света',room.width/2-1,4.2,'light');
}
function build(type) {
  if(!PLANS[type] || !available()) return false;
  const floor=clamp(currentFloor,0,PLANS[type].length-1), plan=PLANS[type][floor];
  seed=85+floor*731+(type==='school'?500:0);
  const cols=plan.length/2, half=cols*6, root=new THREE.Group();
  root.name='fz8b_'+type+'_'+floor; root.position.set(INTERIOR_BASE.x,floor*3.5,INTERIOR_BASE.z);
  active={type,floor,root,resources:[],spots:[],doors:[],rooms:[],walls:[], lightsOn:true,instances:0};
  scene.add(root); interiorObjects.push(root); interiorBounds={W:half-.3,D:13.7};
  interactables=interactables.filter(i=>!i.interior); nearestInteractable=null;
  mkBox(root,half*2,.2,28,0xcbbca3,0,-.12,0);
  mkBox(root,half*2,.15,28,0xf2eee4,0,3.3,0);
  wall(root,-half,0,.2,28,0xe8e1d3); wall(root,half,0,.2,28,0xe8e1d3);
  wall(root,0,-14,half*2,.2,0xe8e1d3); wall(root,0,14,half*2,.2,0xe8e1d3);
  for(let c=1;c<cols;c++) for(const z of [-8.5,8.5]) wall(root,-half+c*12,z,.16,11,0xe9e2d6);
  plan.forEach(([title,kind],i)=>{
    const x=-half+6+(i%cols)*12, z=i<cols?-8.5:8.5, edge=z<0?-3:3;
    const room={id:type+floor+'r'+i,title,kind,x,z,width:12}; active.rooms.push(room);
    wall(root,x-3.65,edge,4.7,.18,0xe7dfce); wall(root,x+3.65,edge,4.7,.18,0xe7dfce);
    mkBox(root,2.6,.5,.18,0xe7dfce,x,2.95,edge);
    door(root,x,edge,room.id,title);
    sign(root,title,x,2.85,edge+(z<0?.13:-.13),3.5,z<0?0:Math.PI);
    decorate(room);
  });
  const light=new THREE.HemisphereLight(0xfff2d9,0x63767b,1.15); root.add(light); active.light=light;
  const fill=new THREE.PointLight(0xffe5bd,.5,35,2); fill.position.set(0,2.85,0); root.add(fill);
  // End-of-corridor lift: accessible buttons, no walking into a fake shaft.
  mkBox(root,.18,2.7,2.4,0x64787c,half-.25,1.35,0);
  for(const z of [-.58,.58]) mkBox(root,.06,2.35,1.1,0xb6c1bd,half-.4,1.18,z);
  sign(root,'ЛИФТ • '+(floor+1),half-.47,2.75,0,2.4,-Math.PI/2);
  addSpot('Лифт: выбрать этаж',half-1.65,0,'lift',{range:2.3});
  // Stair landing with visible steps and rails; transfer is by E, not a walkable ramp.
  for(let i=0;i<7;i++) mkBox(root,1.5,.14,.25,0xc1b9a8,-half+1.2,.14+i*.22,-1.7+i*.27);
  mkBox(root,.06,1.4,2,0x536e73,-half+2.1,.7,-.9);
  sign(root,'ЛЕСТНИЦА • E',-half+1.7,2.65,1.1,2.6,0);
  collider(-half+1.2,-.85,1.6,2.2);
  addSpot('Лестница: выбрать этаж',-half+2.6,.65,'lift');
  addSpot('Выйти на улицу',0,0,'exit',{range:1.1});
  sign(root,'ВЫХОД • E',0,2.95,0,2.3,0,'#28594d');
  sign(root,type==='school'?'ШКОЛА №1 • ЭТАЖ '+(floor+1):type==='apartment'?['КВАРТИРА 212','КВАРТИРА 305','ПЕНТХАУС 401'][floor]:'ОСОБНЯК • ЭТАЖ '+(floor+1),0,2.8,-1.5,4.4,0);
  for(const x of [-half+4,half-4]) ceilingLight(root,x,0,3.08);
  active.instances=batch(root);
  localPlayer.mesh.position.set(INTERIOR_BASE.x,floor*3.5+.01,INTERIOR_BASE.z);
  if(typeof velocity!=='undefined' && velocity) {velocity.x=0;velocity.y=0;velocity.z=0;}
  const key=type+floor; if(!state.visited.includes(key)) { state.visited.push(key); save(); }
  ensureUI(); $('fz8bHud').hidden=false; updateHud();
  return true;
}

// ---------------- INTERACTIONS, TIMED TASKS AND UI ----------------
function near(spot) {
  if(!available() || !active || !inside() || spot.floor!==currentFloor) return false;
  const p=localPlayer.mesh.position;
  if(spot.room) {
    const r=active.rooms.find(r=>r.id===spot.room);
    if(!r || Math.abs(p.x-INTERIOR_BASE.x-r.x)>5.9 || Math.abs(p.z-INTERIOR_BASE.z-r.z)>5.4) return false;
  }
  return Math.abs(p.y-currentFloor*3.5)<2 && Math.hypot(p.x-spot.position.x,p.z-spot.position.z)<=spot.range+.2;
}
function closePanel() {
  if(!panel) return;
  panel.hidden=true; currentQuiz=null;
  if(panelReturnFocus && panelReturnFocus.isConnected) panelReturnFocus.focus();
  panelReturnFocus=null;
}
function showPanel(title) {
  ensureUI();
  if(panel.hidden) panelReturnFocus=document.activeElement;
  panel.hidden=false; panel.querySelector('h2').textContent=title;
  const body=$('fz8bBody'); body.replaceChildren();
  if(typeof keys!=='undefined') Object.keys(keys).forEach(k=>{keys[k]=false;});
  panel.querySelector('[data-close]').focus();
  if(document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
  return body;
}
function text(parent,tag,content,cls) {
  const el=document.createElement(tag); el.textContent=content; if(cls) el.className=cls; parent.appendChild(el); return el;
}
function button(parent,label,fn) { const b=text(parent,'button',label); b.type='button'; b.addEventListener('click',fn); return b; }
function ensureUI() {
  if(panel) return;
  const style=document.createElement('style'); style.textContent=`
    #fz8bPanel[hidden],#fz8bHud[hidden]{display:none!important}
    #fz8bPanel{position:fixed;inset:0;z-index:12000;background:#0d1f28ba;display:grid;place-items:center;padding:14px;font:14px/1.5 Arial,sans-serif;color:#243b40}
    #fz8bPanel .b-card{background:#f3eee2;border:1px solid #cfc5ad;border-radius:18px;width:min(680px,100%);max-height:85dvh;overflow:auto;box-shadow:0 20px 80px #0005;padding:24px;box-sizing:border-box}
    #fz8bPanel h2{font-size:23px;margin:0 44px 16px 0} #fz8bPanel h3{margin:14px 0 6px}
    #fz8bPanel button,#fz8bHud button{background:#315e61;color:#fff4df;border:1px solid #668887;border-radius:9px;min-height:42px;padding:9px 14px;cursor:pointer;margin:4px 6px 4px 0;font:600 13px Arial}
    #fz8bPanel button:hover,#fz8bHud button:hover{background:#477779} #fz8bPanel button:focus-visible,#fz8bHud button:focus-visible{outline:3px solid #d18f44;outline-offset:3px}
    #fz8bPanel button:disabled{opacity:.5;cursor:default} #fz8bPanel [data-close]{float:right;margin-top:-5px}
    #fz8bPanel .b-muted{color:#637572} #fz8bPanel .b-rooms{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0}
    #fz8bPanel .b-room{background:#e4dfd0;border-radius:9px;padding:9px} #fz8bPanel .b-line{border-top:1px solid #cfc5ad;padding-top:12px;margin-top:12px}
    #fz8bHud{position:fixed;right:14px;top:110px;max-width:250px;z-index:180;background:#173d42e8;color:#fff1d9;padding:12px;border:1px solid #71908b;border-radius:12px;font:13px/1.4 Arial}
    #fz8bHud strong,#fz8bHud small{display:block} #fz8bHud small{color:#bfd5cb;margin:4px 0} #fz8bHud button{min-height:36px;padding:7px 10px}
    body.cine-on #fz8bHud{display:none} @media(max-width:600px){#fz8bHud{top:86px;right:6px;max-width:180px;padding:8px;font-size:11px}#fz8bPanel .b-card{padding:16px}#fz8bPanel .b-rooms{grid-template-columns:1fr}}
  `; document.head.appendChild(style);
  panel=document.createElement('div'); panel.id='fz8bPanel'; panel.hidden=true;
  panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true'); panel.setAttribute('aria-labelledby','fz8bTitle');
  panel.innerHTML='<section class="b-card"><button data-close aria-label="Закрыть">Закрыть</button><h2 id="fz8bTitle"></h2><div id="fz8bBody"></div></section>';
  document.body.appendChild(panel); panel.querySelector('[data-close]').onclick=closePanel;
  panel.addEventListener('click',e=>{if(e.target===panel) closePanel();});
  panel.addEventListener('pointerdown',e=>e.stopPropagation()); panel.addEventListener('mousedown',e=>e.stopPropagation());
  // Keep controls and keyboard focus in the dialog, not in the game's hotkeys.
  window.addEventListener('keydown',e=>{
    if(panel.hidden) return;
    e.stopImmediatePropagation();
    if(e.key==='Escape'){e.preventDefault();closePanel();}
    if(e.key==='Tab') {
      const list=[...panel.querySelectorAll('button:not(:disabled),a[href]')];
      const i=list.indexOf(document.activeElement), n=(i+(e.shiftKey?-1:1)+list.length)%list.length;
      e.preventDefault(); if(list[n]) list[n].focus();
    }
  },true);
  const hud=document.createElement('aside'); hud.id='fz8bHud'; hud.hidden=true;
  hud.innerHTML='<strong id="fz8bRoom"></strong><small id="fz8bStatus" aria-live="polite"></small><button id="fz8bPlan">План / дневник</button><button id="fz8bUse">Действие · E</button>';
  document.body.appendChild(hud); $('fz8bPlan').onclick=showPlan;
  $('fz8bUse').onclick=()=>{ const spot=closestSpot(); if(spot) interact(spot); else notify('Подойди к двери или предмету.'); };
  hud.addEventListener('pointerdown',e=>e.stopPropagation()); hud.addEventListener('mousedown',e=>e.stopPropagation());
  if(window.FZ8_addDock) window.FZ8_addDock({id:'interiors',icon:'🏫',name:'Интерьеры'});
  window.FZ8L_EXT=window.FZ8L_EXT||{};
  window.FZ8L_EXT.interiors=()=>{ setTimeout(directory,0); return '<p>Открываю школу и жильё…</p>'; };
}
function directory() {
  if(window.FZ8L && window.FZ8L.close) window.FZ8L.close();
  const body=showPanel('Школа и жилые интерьеры');
  text(body,'p','Исследуй комнаты, открывай двери, пользуйся вещами. На компьютере — E рядом с предметом, на телефоне — «Действие».','b-muted');
  [['school','🏫 Школа №1','3 этажа • 18 помещений • уроки и дневник'],['house','🏡 Особняк «Закат»','2 этажа • кухня, спальни, ванная, кабинет и зимний сад'],['apartment','🏢 Жилой дом «Липы»','3 квартиры • компактная, семейная и пентхаус']].forEach(([type,title,desc])=>{
    const card=text(body,'section','', 'b-line'); text(card,'h3',title); text(card,'p',desc);
    button(card,'Посетить интерьер',()=>visit(type));
  });
  text(body,'p','Осмотр бесплатный. Это не покупка недвижимости. При выходе вернёшься туда, откуда вошёл.','b-muted');
  if(active) button(body,'План текущего этажа',showPlan);
}
function visit(type) {
  if(!PLANS[type] || !available()) return false;
  if(window.FZ8SEA && window.FZ8SEA.aboard()) { notify('Сначала сойди на причал.'); return false; }
  if(inside() || (typeof isInFactory!=='undefined'&&isInFactory) || (typeof isInBasement!=='undefined'&&isInBasement)) { notify('Сначала выйди из текущего помещения.'); return false; }
  if(window.cine || window._loadingGate || (window.FZ8M && window.FZ8M.ride && window.FZ8M.ride()) || window.localCar) { notify('Закончи поездку или выйди из транспорта.'); return false; }
  closePanel(); enterBuilding(type,{school:'Школа №1 «Фантазия»',house:'Особняк «Закат»',apartment:'Жилой дом «Липы»'}[type]); return true;
}
function showPlan() {
  if(!active) return directory();
  const body=showPanel('Этаж '+(active.floor+1)+' • '+({school:'Школа №1',house:'Особняк',apartment:'Квартиры'}[active.type]));
  for(const [side,label] of [[-1,'Северные комнаты'],[1,'Южные комнаты']]) {
    text(body,'p',label,'b-muted'); const grid=text(body,'div','', 'b-rooms');
    active.rooms.filter(r=>Math.sign(r.z)===side).forEach(r=>text(grid,'div',r.title,'b-room'));
  }
  text(body,'p','Комнаты по обе стороны коридора. Лифт справа, лестница слева. Выход — в центре. Между этажами переходи через E у лифта или лестницы.','b-muted');
  button(body,'Дневник и домашние дела',journal);
  button(body,'Закрыть план',closePanel);
}
function lift() {
  const body=showPanel(active.type==='apartment'?'Выбрать квартиру':'Выбрать этаж');
  PLANS[active.type].forEach((plan,i)=>{
    const label=active.type==='apartment'?['212 • Компактная квартира','305 • Семейная квартира','401 • Пентхаус'][i]:'Этаж '+(i+1)+' — '+plan.slice(0,3).map(p=>p[0]).join(', ');
    const b=button(body,label,()=>{
      const spot=active.spots.find(s=>s.action==='lift' && near(s));
      if(!spot){ notify('Подойди к лифту или лестнице.'); return; }
      const delta=i-currentFloor; closePanel(); if(delta) changeFloor(delta);
    }); b.disabled=i===currentFloor;
  });
}
function journal() {
  const body=showPanel('Дневник и домашние дела');
  for(const key of Object.keys(QUESTIONS)) {
    const names={math:'Математика',physics:'Физика',bio:'Биология',lit:'Литература',it:'Информатика',hist:'История'};
    text(body,'p',names[key]+': '+((state.grades[key]||[]).join(' · ')||'ещё нет оценок'));
  }
  text(body,'p','Чаепития: '+state.tea+' · Обеды: '+state.cooked+' · Ванны: '+state.baths+' · Стирки: '+state.laundry+' · Отдых: '+state.rests+' · Книги: '+state.books,'b-line');
  text(body,'p','Прогресс хранится в этом браузере. Повторный урок доступен через 30 секунд.','b-muted');
}
function lesson(spot) {
  if((cooldowns.get('lesson:'+spot.subject)||0)>elapsed) {notify('Перемена! Следующий урок через полминуты.');return;}
  const list=QUESTIONS[spot.subject], q=list[(state.grades[spot.subject]||[]).length%list.length];
  const body=showPanel(spot.name.replace('Начать урок: ',''));
  text(body,'p',q[0]); currentQuiz={spot,q};
  q[1].forEach((answer,index)=>button(body,answer,()=>{
    if(!currentQuiz || !near(spot)) {closePanel();return;}
    currentQuiz=null; const grade=index===q[2]?5:3;
    state.grades[spot.subject]=[...(state.grades[spot.subject]||[]),grade].slice(-20); save();
    cooldowns.set('lesson:'+spot.subject,elapsed+30);
    body.querySelectorAll('button').forEach(b=>b.disabled=true);
    text(body,'h3',grade===5?'Верно! Оценка: 5':'Разберём вместе. Оценка: 3'); text(body,'p',q[3]);
    button(body,'Завершить урок',closePanel);
  }));
}
function taskEffect(spot,kind) {
  const root=new THREE.Group(); root.userData.live=true; active.root.add(root);
  root.position.set(spot.position.x-INTERIOR_BASE.x,0,spot.position.z-INTERIOR_BASE.z);
  const room=active.rooms.find(r=>r.id===spot.room); if(room && room.z>0) root.rotation.y=Math.PI;
  if(kind==='tea') for(let i=0;i<6;i++) mkSph(root,.065,0xe5f1ec,(i%2)*.1,1+i*.12,-.6,8,'glass');
  if(kind==='basket') mkSph(root,.24,0xdf8541,0,1,0,12);
  if(kind==='bath') { mkBox(root,1.5,.03,.68,0x8bcbd0,1.65,.43,-.7,0,'glass'); }
  if(kind==='wash') {
    const drum=new THREE.Group();drum.position.set(0,.5,-.77);root.add(drum);
    mkTorus(drum,.19,0x9dc8d5,0,0,0,0,0);
    for(let i=0;i<3;i++) mkSph(drum,.065,[0xf2e9d5,0x8eaec4,0xdcb0ae][i],Math.cos(i*2.1)*.1,Math.sin(i*2.1)*.1,.02,8);
  }
  return root;
}
function startTask(spot,kind,seconds,label) {
  if(task) {notify('Сначала дождись завершения текущего действия.');return;}
  if((cooldowns.get(kind)||0)>elapsed){notify('Можно повторить чуть позже.');return;}
  task={spot,kind,duration:seconds,time:0,label,owner:active,effect:taskEffect(spot,kind)};
  notify(label); updateHud();
}
function finishTask(t) {
  if(t.effect) t.effect.removeFromParent ? t.effect.removeFromParent() : t.effect.parent.remove(t.effect);
  cooldowns.set(t.kind,elapsed+15);
  const stats={tea:'tea',bath:'baths',wash:'laundry',rest:'rests',cook:'cooked',lunch:'cooked',read:'books'};
  if(stats[t.kind]) state[stats[t.kind]]++; save();
  notify(({tea:'Чай готов!',bath:'Ванна готова — можно освежиться.',wash:'Стирка закончена. Бельё чистое.',rest:'Ты отдохнул.',cook:'Обед готов!',lunch:'Приятного аппетита!',read:'Книга прочитана. Запись добавлена в дневник.',basket:'Попадание! Мяч прошёл через кольцо.'})[t.kind]||'Готово.');
}
function interact(spot) {
  if(!owned(spot)) return false;
  if(spot.type==='fz8b_entry') { if(available() && Math.hypot(localPlayer.mesh.position.x-spot.position.x,localPlayer.mesh.position.z-spot.position.z)<=spot.range+.2) visit(spot.destination); return true; }
  if(!near(spot)) return true;
  switch(spot.action) {
    case 'door': toggleDoor(spot.door); break;
    case 'exit': closePanel(); exitBuilding(); break;
    case 'lift': lift(); break;
    case 'lesson': lesson(spot); break;
    case 'journal': journal(); break;
    case 'light': active.lightsOn=!active.lightsOn; active.light.intensity=active.lightsOn?1.15:.3; notify(active.lightsOn?'Свет включён.':'Свет приглушён.'); break;
    case 'tea': startTask(spot,'tea',5,'Чайник закипает…'); break;
    case 'bath': startTask(spot,'bath',6,'Набираем воду в ванну…'); break;
    case 'wash': startTask(spot,'wash',8,'Стиральная машина работает…'); break;
    case 'rest': startTask(spot,'rest',5,'Отдыхаем…'); break;
    case 'cook': startTask(spot,'cook',6,'Готовим обед…'); break;
    case 'lunch': startTask(spot,'lunch',3,'Обед в столовой…'); break;
    case 'read': startTask(spot,'read',5,'Читаем главу…'); break;
    case 'basket': startTask(spot,'basket',2,'Бросок!'); break;
    case 'tv': {
      const room=active.rooms.find(r=>r.id===spot.room);
      if(!room.screen) { room.screen=mkBox(room.group,1.24,.71,.03,0x4a9fbd,0,1,-2.59,0,'glow'); room.screen.userData.live=true; }
      else room.screen.visible=!room.screen.visible;
      notify(room.screen.visible?'Телевизор включён: канал «Фантазия».':'Телевизор выключен.'); break;
    }
    case 'stage': active.light.intensity=active.light.intensity>.7?.45:1.15; notify('Сценическое освещение переключено.'); break;
    case 'music': playNotes(); break;
    case 'water': notify('Растения политы. Не забывай давать почве просохнуть.'); break;
    case 'keys': notify('Ключи от квартиры и почтового ящика висят на своих местах.'); break;
    case 'schedule': showPlan(); break;
    case 'art': {const body=showPanel('Урок рисования');text(body,'p','Смешай жёлтый и синий — получится зелёный. Нарисуй зимний сад, используя тёплый свет и холодные тени.');break;}
  }
  return true;
}
let audio=null;
function playNotes() {
  try {
    const Audio=window.AudioContext||window.webkitAudioContext; if(!Audio) return notify('Аудио в этом браузере недоступно.');
    audio=audio||new Audio(); audio.resume(); const at=audio.currentTime;
    [261.63,329.63,392,523.25].forEach((hz,i)=>{const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=hz;o.type='triangle';o.connect(g);g.connect(audio.destination);g.gain.setValueAtTime(.08,at+i*.22);g.gain.exponentialRampToValueAtTime(.001,at+i*.22+.5);o.start(at+i*.22);o.stop(at+i*.22+.55);o.onended=()=>{o.disconnect();g.disconnect();};});
    notify('На пианино звучит короткое арпеджио.');
  } catch(_){notify('Разреши звук в браузере.');}
}
function closestSpot() { return active && active.spots.filter(near).sort((a,b)=>localPlayer.mesh.position.distanceToSquared(new THREE.Vector3(a.position.x,a.position.y,a.position.z))-localPlayer.mesh.position.distanceToSquared(new THREE.Vector3(b.position.x,b.position.y,b.position.z)))[0]; }
function updateHud() {
  if(!active || !$('fz8bHud')) return;
  const p=localPlayer.mesh.position, x=p.x-INTERIOR_BASE.x,z=p.z-INTERIOR_BASE.z;
  const room=active.rooms.find(r=>Math.abs(x-r.x)<5.9 && Math.abs(z-r.z)<5.4);
  $('fz8bRoom').textContent=(room?room.title:'Коридор')+' • '+(active.floor+1)+' этаж';
  const spot=closestSpot();
  $('fz8bStatus').textContent=task?task.label+' '+Math.ceil(task.duration-task.time)+' с':spot?spot.name:'Подойди к предмету или двери';
  $('fz8bUse').disabled=!spot;
}
function release() {
  closePanel(); currentQuiz=null;
  if(!active) return;
  task=null;
  active.root.traverse(o=>{if(o.isInstancedMesh && o.dispose) o.dispose();});
  active.resources.forEach(r=>r.dispose());
  active.root.removeFromParent ? active.root.removeFromParent() : scene.remove(active.root);
  interiorObjects=interiorObjects.filter(o=>o!==active.root);
  interactables=interactables.filter(i=>!(owned(i)&&i.interior)); nearestInteractable=null;
  active=null; if($('fz8bHud')) $('fz8bHud').hidden=true;
}
function update(dt) {
  if(!Number.isFinite(dt) || dt<=0) return;
  dt=Math.min(dt,.1); elapsed+=dt;
  if(!available()) return;
  if(!active) { exteriorTick(dt); return; }
  if(!inside() || currentBuildingType!==active.type || currentFloor!==active.floor) {release();return;}
  active.doors.forEach(d=>{
    d.angle+=(d.target-d.angle)*Math.min(1,dt*8); d.pivot.rotation.y=d.angle;
    if(!d.open && Math.abs(d.angle)<.03 && !interiorColliders.includes(d.collider)) {
      const p=localPlayer.mesh.position,c=d.collider;
      if(p.x>c.minX-.55&&p.x<c.maxX+.55&&p.z>c.minZ-.55&&p.z<c.maxZ+.55){d.open=true;d.target=-Math.PI/2;d.spot.name='Закрыть дверь';}
      else interiorColliders.push(c);
    }
  });
  if(task) {
    if(task.owner!==active || !near(task.spot)) {
      if(task.effect.parent) task.effect.parent.remove(task.effect); task=null; notify('Действие прервано: ты отошёл от предмета.');
    } else {
      task.time+=dt; const t=task.time/task.duration;
      if(task.kind==='tea') task.effect.children.forEach((m,i)=>{m.position.y=1+((task.time*.4+i*.12)%.9);m.position.x=Math.sin(task.time+i)*.07;});
      if(task.kind==='wash') task.effect.children[0].rotation.z=task.time*5;
      if(task.kind==='bath') task.effect.children[0].position.y=.43+Math.min(1,t)*.13;
      if(task.kind==='basket') {const ball=task.effect.children[0];ball.position.z=-3.75*Math.min(1,t/.8);ball.position.y=t<.8?1+2.35*Math.sin(t/.8*Math.PI*.72):2.8-(t-.8)*9;}
      if(task.time>=task.duration){const done=task;task=null;finishTask(done);}
    }
  }
  hudTimer+=dt;if(hudTimer>.15){hudTimer=0;updateHud();}
}

// New entrances are placed only on genuinely free cells in the loaded city.
// A directory remains available if a map has no suitable vacant plot.
let exteriorTimer=0, exteriorScene=null;
const entrances=[];
function freePlot(grid,x,z,w,d) {
  if(x-w/2<grid.ox+4 || z-d/2<grid.oz+4 || x+w/2>grid.ox+grid.W*grid.CELL-4 || z+d/2>grid.oz+grid.D*grid.CELL-4) return false;
  for(let xx=x-w/2;xx<=x+w/2;xx+=grid.CELL) for(let zz=z-d/2;zz<=z+d/2;zz+=grid.CELL) {
    const ix=Math.floor((xx-grid.ox)/grid.CELL),iz=Math.floor((zz-grid.oz)/grid.CELL);
    if(grid.grid[iz*grid.W+ix]) return false;
  }
  return !entrances.some(e=>Math.abs(x-e.x)<26 && Math.abs(z-e.z)<24);
}
function exteriorTick(dt) {
  exteriorTimer+=dt; if(exteriorTimer<3) return; exteriorTimer=0;
  const nc=window.NEWCITY; if(!nc || !nc.loaded || !nc.grid || exteriorScene===scene) return;
  exteriorScene=scene;
  const specs=[['school','ШКОЛА №1',0xd5b47c,3],['house','ОСОБНЯК «ЗАКАТ»',0xb7cab2,2],['apartment','ЖК «ЛИПЫ»',0xc4d2ce,3]];
  for(const [type,title,color,floors] of specs) {
    let site=null;
    for(let r=32;r<=220&&!site;r+=12) for(let a=0;a<32&&!site;a++) {
      const x=Math.round(nc.spawnX+Math.cos(a*Math.PI/16)*r),z=Math.round(nc.spawnZ+Math.sin(a*Math.PI/16)*r);
      if(freePlot(nc.grid,x,z,26,24)) site={x,z};
    }
    if(!site) continue;
    const {x,z}=site,g=new THREE.Group();g.position.set(x,0,z);g.name='fz8b_exterior_'+type;
    mkBox(g,25,.12,23,0xc6c6b6,0,-.08,0);
    mkBox(g,18,floors*3.5,12,color,0,floors*1.75,-2);
    mkBox(g,18.7,.3,12.7,0x526970,0,floors*3.5,-2);
    for(let f=0;f<floors;f++) {
      mkBox(g,18.2,.15,12.2,0xe9e4d4,0,f*3.5+.1,-2);
      for(let col=-7;col<=7;col+=3.5) for(const side of [-1,1]) {
        if(f===0&&Math.abs(col)<2&&side===1) continue;
        mkBox(g,2,1.65,.1,0x405e6c,col,1.9+f*3.5,-2+side*6.06);
        mkBox(g,.07,1.65,.14,0xf3edda,col,1.9+f*3.5,-2+side*6.08);
        mkBox(g,2,.07,.14,0xf3edda,col,1.9+f*3.5,-2+side*6.08);
      }
    }
    mkBox(g,2.5,2.6,.16,0x466b70,0,1.3,4.1);
    mkBox(g,.06,2.6,.18,0xd9e3dd,0,1.3,4.15);
    mkBox(g,4,.15,2,0x526970,0,3.2,4.7);
    sign(g,title,0,4.15,4.14,7,0);
    for(const bx of [-7,7]) {plant(g,bx,6,1.3);mkBox(g,2.5,.15,.6,0x886b46,bx,.5,8);}
    scene.add(g);batch(g);
    const bounds={minX:x-9,maxX:x+9,minZ:z-8,maxZ:z+4};
    const entry={type:'fz8b_entry',fz8b:true,destination:type,name:'Войти: '+title,position:{x,y:0,z:z+5.7},range:3.4};
    interactables.push(entry); entrances.push({type,x,z,root:g,bounds,entry});
    buildings.push({x,z:z-2,w:18,d:12,h:floors*3.5,name:title,type,mesh:g,bounds});
  }
}
function outsideBlocked(x,z) {
  if(inside()) return false;
  return entrances.some(e=>x+.5>e.bounds.minX&&x-.5<e.bounds.maxX&&z+.5>e.bounds.minZ&&z-.5<e.bounds.maxZ);
}
// Keep the third-person camera on the player's side of interior partitions.
function constrainCamera(cam,player) {
  if(!active) return;
  const dx=cam.position.x-player.x,dz=cam.position.z-player.z;
  let fraction=1;
  const list=active.walls.concat(active.doors.filter(d=>!d.open).map(d=>d.collider));
  for(const c of list) {
    let lo=0,hi=1;
    for(const [origin,dir,min,max] of [[player.x,dx,c.minX-.12,c.maxX+.12],[player.z,dz,c.minZ-.12,c.maxZ+.12]]) {
      if(Math.abs(dir)<1e-8) { if(origin<min||origin>max) {hi=-1;break;} }
      else {const a=(min-origin)/dir,b=(max-origin)/dir;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));}
    }
    if(lo<=hi&&hi>=0&&lo>0) fraction=Math.min(fraction,Math.max(0,lo-.025));
  }
  cam.position.x=player.x+dx*fraction;cam.position.z=player.z+dz*fraction;
}
window.FZ8B={
  build,release,update,interact,outsideBlocked,constrainCamera,directory,visit,
  state:()=>JSON.parse(JSON.stringify(state)),
  info:()=>active?{type:active.type,floor:active.floor,rooms:active.rooms.map(({id,title,kind,x,z})=>({id,title,kind,x,z})),instances:active.instances,doors:active.doors.map(d=>({id:d.id,open:d.open,angle:d.angle})),spots:active.spots.map(s=>({name:s.name,action:s.action,position:s.position})),task:task?task.kind:null}:null,
  entrances:()=>entrances.map(e=>({type:e.type,x:e.x,z:e.z})),
};
window.FZ8B_update=update;
load();
ensureUI();
})();
