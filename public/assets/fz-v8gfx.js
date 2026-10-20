// ==========================================================
// 🎨 FANTAZIA v8.0 «SUPER GRAPHICS»
// Постобработка (bloom/grade/vignette/grain/CA), небо (солнце, луна,
// звёзды, лучи), тени, светофоры, свет в окнах, неон, уличные объекты,
// частицы (дождь, снег, листья, дым, искры), экранные эффекты,
// настройки качества и авто-адаптация под FPS.
// ==========================================================
(function () {
'use strict';

const GFX_KEY = 'fz8_gfx';
const TIERS = ['off', 'low', 'medium', 'high', 'ultra'];
const isMob = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || ('ontouchstart' in window && window.innerWidth < 1024);

const P = {
  tier: isMob ? 'medium' : 'high',
  bloom: 0.85, exposure: 1.06, saturation: 1.12, contrast: 1.05, grain: 0.035, vignette: 0.45, aberr: 0.0016,
  shake: 0.35, // множитель тряски
  fpsShow: false, renderScale: 1.0, auto: true,
};
function saveP() { try { localStorage.setItem(GFX_KEY, JSON.stringify({ tier: P.tier, auto: P.auto, fpsShow: P.fpsShow, renderScale: P.renderScale })); } catch (e) {} }
function loadP() {
  try {
    const s = JSON.parse(localStorage.getItem(GFX_KEY) || 'null');
    if (s) { if (s.tier && TIERS.indexOf(s.tier) >= 0) P.tier = s.tier; if (typeof s.auto === 'boolean') P.auto = s.auto; if (typeof s.fpsShow === 'boolean') P.fpsShow = s.fpsShow; if (typeof s.renderScale === 'number') P.renderScale = s.renderScale; }
  } catch (e) {}
}
function ti() { return TIERS.indexOf(P.tier); }
function applyTier(persist = true) {
  const i = ti();
  P.bloom = i >= 4 ? 1.15 : i === 3 ? 0.85 : i === 2 ? 0.5 : 0;
  P.grain = i >= 4 ? 0.045 : i === 3 ? 0.03 : 0.02;
  P.aberr = i >= 4 ? 0.0022 : i === 3 ? 0.0014 : 0;
  P.vignette = i >= 1 ? 0.45 : 0.25;
  try { if (shadowLight) shadowLight.castShadow = i >= 4; } catch (e) {}
  if (persist) saveP();
}

// ---------------- СОСТОЯНИЕ ----------------
let renderer = null, sceneRef = null, camRef = null, origRender = null, patched = false;
let rtScene = null, rtB = [null, null], rtC = null, quadScene = null, quadCam = null, quadMesh = null, quadMat = null;
const V2 = { x: 1, y: 1 };
let frames = 0, fpsAcc = 0, fps = 60, adaptT = 0, degraded = false;
const timeU = { value: 0 };
let shadowLight = null, hemi = null, sunMesh = null, sunGlow = null, moonMesh = null, starField = null, shootStar = null, flareGroup = null, flareParts = [];
let cloudsExtra = null, haze = null, trafficLamps = [], windowPool = null, windowT = 0, neonPool = [], propGroup = null;
let rainSplash = null, snowPts = null, dustPts = null, leavesPts = null, smokePuffs = [], exhaustT = 0, blobGroup = null, blobGeo = null, blobMat = null;
let screenEls = null, shake = { amp: 0, t: 0 }, fovKick = 0, chestFeel = 0;
let lastHealth = 100, damagePulse = 0, speedLinesEl = null, rainOverlay = null;

// ---------------- SHADERS ----------------
const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const FRAG_BRIGHT = 'uniform sampler2D tDiffuse; uniform float threshold; uniform float soft; varying vec2 vUv;'
  + 'void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.2126,0.7152,0.0722)); float f = smoothstep(threshold, threshold + soft, l); gl_FragColor = vec4(c.rgb * f, 1.0); }';
const FRAG_BLUR = 'uniform sampler2D tDiffuse; uniform vec2 dir; varying vec2 vUv;'
  + 'void main(){ vec4 s = texture2D(tDiffuse, vUv) * 0.227027;'
  + ' s += texture2D(tDiffuse, vUv + dir * 1.3846153846) * 0.3162162162;'
  + ' s += texture2D(tDiffuse, vUv - dir * 1.3846153846) * 0.3162162162;'
  + ' s += texture2D(tDiffuse, vUv + dir * 3.2307692308) * 0.0702702703;'
  + ' s += texture2D(tDiffuse, vUv - dir * 3.2307692308) * 0.0702702703;'
  + ' gl_FragColor = s; }';
const FRAG_COMP = 'uniform sampler2D tDiffuse; uniform sampler2D tBloom; uniform float bloom; uniform float exposure; uniform float saturation;'
  + ' uniform float contrast; uniform vec3 tint; uniform float vignette; uniform float grain; uniform float aberr; uniform float time; uniform float fade; uniform float shock;'
  + ' varying vec2 vUv;'
  + ' float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }'
  + 'void main(){ vec2 uv = vUv; vec2 d = uv - 0.5; float r2 = dot(d,d);'
  + ' vec2 ca = d * (aberr + shock * 0.02);'
  + ' vec3 col; col.r = texture2D(tDiffuse, uv - ca).r; col.g = texture2D(tDiffuse, uv).g; col.b = texture2D(tDiffuse, uv + ca).b;'
  + ' vec3 bl = texture2D(tBloom, uv + ca * 0.6).rgb; col += bl * bloom;'
  + ' col *= exposure; col *= tint;'
  + ' float lum = dot(col, vec3(0.2126,0.7152,0.0722)); col = mix(vec3(lum), col, saturation);'
  + ' col = (col - 0.5) * contrast + 0.5;'
  + ' float v = smoothstep(0.95, 0.28, length(d)); col *= mix(1.0, v, vignette);'
  + ' col += (rnd(uv * 1024.0 + vec2(time, time * 1.37)) - 0.5) * grain;'
  + ' col = mix(vec3(0.0), col, clamp(fade, 0.0, 1.0));'
  + ' gl_FragColor = vec4(max(col, 0.0), 1.0); }';

function mkQuad(frag, uniforms) {
  const mat = new THREE.ShaderMaterial({ uniforms: uniforms, vertexShader: VERT, fragmentShader: frag, depthTest: false, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  return mesh;
}
function ensureQuad() {
  if (quadScene) return;
  quadScene = new THREE.Scene();
  quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  quadMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  quadMesh.frustumCulled = false;
  quadScene.add(quadMesh);
}
function rtSize() {
  const pr = Math.min((renderer && renderer.getPixelRatio) ? renderer.getPixelRatio() : 1, 2);
  const rs = P.renderScale;
  return { w: Math.max(320, Math.floor(window.innerWidth * pr * rs)), h: Math.max(240, Math.floor(window.innerHeight * pr * rs)) };
}
function allocTargets() {
  const s = rtSize();
  const enc = renderer.outputEncoding;
  const mk = (w, h) => {
    const rt = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: true, stencilBuffer: false });
    try { rt.texture.encoding = enc; } catch (e) {}
    return rt;
  };
  if (rtScene) { rtScene.dispose(); rtB[0].dispose(); rtB[1].dispose(); }
  rtScene = mk(s.w, s.h);
  rtB[0] = mk(Math.floor(s.w / 3), Math.floor(s.h / 3));
  rtB[1] = mk(Math.floor(s.w / 3), Math.floor(s.h / 3));
  V2.x = s.w; V2.y = s.h;
}
function pass(target, mesh, mat) {
  renderer.setRenderTarget(target);
  renderer.clear(true, true, false);
  quadMesh.material = mat;
  origRender(quadScene, quadCam);
}
let brightMat = null, blurMat = null, compMat = null, passScene = null, passCam = null;
function buildPasses() {
  brightMat = mkQuad(FRAG_BRIGHT, { tDiffuse: { value: null }, threshold: { value: 0.72 }, soft: { value: 0.28 } }).material;
  blurMat = mkQuad(FRAG_BLUR, { tDiffuse: { value: null }, dir: { value: new THREE.Vector2() } }).material;
  compMat = mkQuad(FRAG_COMP, {
    tDiffuse: { value: null }, tBloom: { value: null }, bloom: { value: P.bloom }, exposure: { value: P.exposure },
    saturation: { value: P.saturation }, contrast: { value: P.contrast }, tint: { value: new THREE.Vector3(1, 1, 1) },
    vignette: { value: P.vignette }, grain: { value: P.grain }, aberr: { value: P.aberr }, time: timeU, fade: { value: 1 }, shock: { value: 0 },
  }).material;
  passScene = quadScene; passCam = quadCam;
}
let fade = 1, fadeTarget = 1, shockLevel = 0;
function sizeCheck() {
  const s = rtSize();
  if (!rtScene || Math.abs(s.w - V2.x) > 2 || Math.abs(s.h - V2.y) > 2) allocTargets();
}
function compose(sc, cam) {
  if (!origRender) return;
  if (ti() === 0 || !rtScene || !sc || !cam) { try { renderer.setRenderTarget(null); } catch (e) {} return origRender(sc, cam); }
  try {
    sizeCheck();
    renderer.setRenderTarget(rtScene);
    renderer.clear(true, true, true);
    origRender(sc, cam);
    // bloom
    if (P.bloom > 0.01) {
      brightMat.uniforms.tDiffuse.value = rtScene.texture;
      brightMat.uniforms.threshold.value = ti() >= 4 ? 0.62 : 0.72;
      pass(rtB[0], null, brightMat);
      const passes = ti() >= 4 ? 3 : ti() === 3 ? 2 : 1;
      for (let i = 0; i < passes; i++) {
        const spread = (1.1 + i * 0.9);
        blurMat.uniforms.tDiffuse.value = rtB[0].texture;
        blurMat.uniforms.dir.value.set(spread / rtB[0].width, 0);
        pass(rtB[1], null, blurMat);
        blurMat.uniforms.tDiffuse.value = rtB[1].texture;
        blurMat.uniforms.dir.value.set(0, spread / rtB[0].height);
        pass(rtB[0], null, blurMat);
      }
    }
    // финальный композит
    const u = compMat.uniforms;
    u.tDiffuse.value = rtScene.texture;
    u.tBloom.value = rtB[0].texture;
    u.bloom.value = P.bloom * (1 + shockLevel * 0.6);
    u.exposure.value = P.exposure * (1 + shockLevel * 0.35);
    u.saturation.value = P.saturation;
    u.contrast.value = P.contrast;
    u.vignette.value = P.vignette;
    u.grain.value = P.grain;
    u.aberr.value = P.aberr;
    u.fade.value = fade;
    u.shock.value = shockLevel;
    renderer.setRenderTarget(null);
    renderer.clear(true, true, false);
    quadMesh.material = compMat;
    origRender(quadScene, quadCam);
  } catch (e) {
    try { renderer.setRenderTarget(null); } catch (e2) {}
    try { origRender(sc, cam); } catch (e3) {}
  }
}
function patchRenderer() {
  if (patched || !renderer || !renderer.render) return;
  origRender = renderer.render.bind(renderer);
  renderer.render = function (sc, cam) {
    try { applyShakeToCamera(); } catch (e) {}
    compose(sc, cam);
  };
  patched = true;
}

// ---------------- НЕБО: СОЛНЦЕ, ЛУНА, ЗВЁЗДЫ, ЛУЧИ ----------------
function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  try { draw(cv.getContext('2d'), w, h); } catch (e) {}
  const t = new THREE.CanvasTexture(cv);
  return t;
}
function radialTex(color, size) {
  return canvasTex(size || 128, size || 128, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, color);
    g.addColorStop(0.25, color.replace('rgb', 'rgba').replace(')', ',0.55)'));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
}
function buildSky() {
  try {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('rgb(255,244,214)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false }));
    s.scale.set(90, 90, 1); s.renderOrder = 5; sceneRef.add(s); sunGlow = s;
    const disc = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('rgb(255,255,245)', 64), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false }));
    disc.scale.set(34, 34, 1); disc.renderOrder = 6; sceneRef.add(disc); sunMesh = disc;
    const moonTex = canvasTex(128, 128, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      const g = c.createRadialGradient(64, 64, 8, 64, 64, 60);
      g.addColorStop(0, 'rgba(236,240,255,1)'); g.addColorStop(0.7, 'rgba(200,210,240,0.85)'); g.addColorStop(1, 'rgba(150,160,200,0)');
      c.fillStyle = g; c.beginPath(); c.arc(64, 64, 58, 0, 7); c.fill();
      c.fillStyle = 'rgba(140,150,190,0.35)';
      [[48, 52, 10], [78, 70, 7], [60, 88, 6], [86, 44, 5]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); });
    });
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, depthWrite: false, depthTest: false, fog: false }));
    m.scale.set(48, 48, 1); m.renderOrder = 5; sceneRef.add(m); moonMesh = m;
    // звёзды
    const n = isMob ? 260 : 620, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.48 + 0.02, r = 660;
      pos[i * 3] = Math.cos(th) * Math.cos(ph) * r;
      pos[i * 3 + 1] = Math.sin(ph) * r + 40;
      pos[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xdfe6ff, size: 2.4, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
    starField = new THREE.Points(g, mat);
    starField.renderOrder = 4; sceneRef.add(starField);
    // падающая звезда
    const ss = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('rgb(255,255,255)', 64), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false }));
    ss.scale.set(60, 4, 1); ss.visible = false; sceneRef.add(ss); shootStar = ss;
    // линзовые блики
    flareGroup = new THREE.Group(); sceneRef.add(flareGroup);
    const cols = ['rgba(255,236,180,', 'rgba(180,230,255,', 'rgba(255,190,210,', 'rgba(200,255,220,'];
    for (let i = 0; i < 6; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex(cols[i % cols.length] + '0.85)', 96), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, opacity: 0, fog: false }));
      const sz = 26 + i * 14;
      sp.scale.set(sz, sz, 1);
      sp.userData.off = 0.25 + i * 0.22;
      sp.userData.side = (i % 2 ? 1 : -1) * (10 + i * 26);
      flareGroup.add(sp);
      flareParts.push(sp);
    }
    // дымка у горизонта
    const hazeTex = canvasTex(256, 128, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.55, 'rgba(255,255,255,0.16)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    });
    const hz = new THREE.Mesh(new THREE.CylinderGeometry(640, 640, 120, 24, 1, true), new THREE.MeshBasicMaterial({ map: hazeTex, transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0.5 }));
    hz.position.y = 40; hz.renderOrder = 3; sceneRef.add(hz); haze = hz;
    // доп. облака, если своих нет
    if (!window.clouds || !window.clouds.length) {
      cloudsExtra = new THREE.Group();
      const cm = new THREE.MeshLambertMaterial({ color: 0xf2f4ff, transparent: true, opacity: 0.72, depthWrite: false, fog: false });
      for (let i = 0; i < 22; i++) {
        const cg = new THREE.Group();
        const cnt = 3 + Math.floor(Math.random() * 4);
        for (let k = 0; k < cnt; k++) {
          const s2 = new THREE.Mesh(new THREE.SphereGeometry(9 + Math.random() * 12, 7, 5), cm);
          s2.position.set(k * 12 - cnt * 6 + Math.random() * 4, Math.random() * 3, Math.random() * 6);
          s2.scale.y = 0.5; cg.add(s2);
        }
        cg.position.set((Math.random() - 0.5) * 1100, 150 + Math.random() * 70, (Math.random() - 0.5) * 1100);
        cloudsExtra.add(cg);
      }
      sceneRef.add(cloudsExtra);
    }
  } catch (e) {}
}
function sunDirNow(out) {
  const h = (window.FZDN && typeof window.FZDN.hours === 'number') ? window.FZDN.hours : 12;
  const a = ((h - 6) / 12) * Math.PI;
  const tilt = 0.55;
  const v = out || new THREE.Vector3();
  v.set(Math.cos(a) * Math.cos(tilt), Math.sin(a), Math.cos(a) * Math.sin(tilt)).normalize();
  return v;
}
function buildLights() {
  try {
    sunLight = new THREE.DirectionalLight(0xfff2d0, 0.75);
    sunLight.position.set(60, 90, 30);
    sceneRef.add(sunLight); sunLight.target.position.set(0, 0, 0); sceneRef.add(sunLight.target);
    hemi = new THREE.HemisphereLight(0x9fc6ff, 0x3a3428, 0.42);
    sceneRef.add(hemi);
    if (renderer && ti() >= 4) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(1024, 1024);
      const d = 60;
      sunLight.shadow.camera.left = -d; sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d; sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.camera.near = 1; sunLight.shadow.camera.far = 260;
      sunLight.shadow.bias = -0.0009;
    }
  } catch (e) {}
}
let groundHooked = false;
function hookGround() {
  if (groundHooked || !sceneRef) return;
  groundHooked = true;
  try {
    let best = null, bestA = 0;
    sceneRef.traverse(o => {
      if (!o.isMesh || !o.geometry) return;
      const g = o.geometry;
      if (g.type !== 'PlaneGeometry' || !g.parameters) return;
      if (Math.abs(o.rotation.x + Math.PI / 2) > 0.2) return;
      const a = g.parameters.width * g.parameters.height;
      if (a > bestA) { bestA = a; best = o; }
    });
    if (best) { best.receiveShadow = ti() >= 4; window._fz8Ground = best; }
  } catch (e) {}
}

// ---------------- СВЕТОФОРЫ (живой цикл) ----------------
function collectTraffic() {
  try {
    if (!sceneRef || trafficLamps.length || trafficScanTries > 40) return;
    trafficScanTries++;
    const groups = {};
    sceneRef.traverse(o => {
      if (!o.isMesh || !o.geometry || !o.geometry.parameters) return;
      const r = o.geometry.parameters.radius;
      if (r !== 0.12) return;
      const y = o.position.y;
      if (y < 3.2 || y > 4.6) return;
      const key = o.position.x.toFixed(2) + '|' + o.position.z.toFixed(2);
      groups[key] = groups[key] || [];
      groups[key].push(o);
    });
    Object.keys(groups).forEach(k => {
      const arr = groups[k];
      if (arr.length < 3) return;
      arr.sort((a, b) => b.position.y - a.position.y); // 0 красный, 1 жёлтый, 2 зелёный
      trafficLamps.push({ lamps: arr, seed: Math.random() * 6 });
    });
  } catch (e) {}
}
function updateTraffic(dt) {
  if (!trafficLamps.length) return;
  const TL = window._tlCache;
  if (!TL) return;
  trafficPhase += dt;
  trafficLamps.forEach(t => {
    const cycle = (trafficPhase + t.seed) % 12;
    let on = 0;
    if (cycle < 5.5) on = 0; else if (cycle < 6.5) on = 1; else on = 2;
    t.lamps.forEach((lamp, i) => { try { lamp.material = (i === on) ? TL.on[i] : TL.off[i]; } catch (e) {} });
  });
}
let trafficPhase = 0, trafficScanTries = 0;

// ---------------- СВЕТ В ОКНАХ НОЧЬЮ ----------------
function buildWindowPool() {
  try {
    const count = isMob ? 90 : 170;
    windowPool = { meshes: [], mats: [], t: 0 };
    const mk = (c, op) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, fog: true });
    windowPool.mats = [mk(0xffd98a, 0.95), mk(0xbfe6ff, 0.9), mk(0x2a2f3d, 0.65)];
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.4), windowPool.mats[0]);
      m.visible = false; m.renderOrder = 1;
      sceneRef.add(m);
      windowPool.meshes.push(m);
    }
  } catch (e) {}
}
function rebuildWindows() {
  try {
    if (!windowPool || !buildings || !buildings.length) return;
    const pp = localPlayer && localPlayer.mesh ? localPlayer.mesh.position : { x: 0, z: 0 };
    const list = buildings
      .filter(b => b && b.bounds && b.h >= 5)
      .map(b => ({ b: b, d: Math.hypot(b.x - pp.x, b.z - pp.z) }))
      .sort((a, b2) => a.d - b2.d)
      .slice(0, isMob ? 5 : 9);
    let idx = 0;
    const rnd = (i) => Math.abs(Math.sin(i * 91.7) * 43758.5) % 1;
    list.forEach(({ b }, bi) => {
      const H = b.h, nb = Math.max(1, Math.floor(b.h / 3.2));
      for (let fy = 0; fy < nb; fy++) {
        for (let fx = 0; fx < 4; fx++) {
          for (let side = 0; side < 2; side++) {
            if (idx >= windowPool.meshes.length) return;
            const m = windowPool.meshes[idx];
            const y = 1.9 + fy * 3.2 + 0.7;
            if (y > H - 0.8) continue;
            const w = b.w, d = b.d;
            const off = (side ? 1 : -1) * (fx % 2 === 0 ? 1 : -1);
            if (side === 0) {
              m.position.set(b.x + off * (w / 2 - 1.6), y, b.z + d / 2 + 0.06);
              m.rotation.y = 0;
            } else {
              m.position.set(b.x + w / 2 + 0.06, y, b.z + off * (d / 2 - 1.6));
              m.rotation.y = Math.PI / 2;
            }
            const r = rnd(idx + bi * 31);
            m.material = windowPool.mats[r < 0.42 ? 0 : (r < 0.8 ? 1 : 2)];
            m.scale.set(0.9 + (r % 0.5), 1, 1);
            idx++;
          }
        }
      }
    });
    for (let i = idx; i < windowPool.meshes.length; i++) windowPool.meshes[i].visible = false;
    windowPool.count = idx;
  } catch (e) {}
}
function updateWindows(dt) {
  if (!windowPool) return;
  const night = (window.FZDN && window.FZDN.nightF) || 0;
  windowT += dt;
  if (windowT > 6) { windowT = 0; rebuildWindows(); }
  const show = night > 0.3;
  for (let i = 0; i < (windowPool.count || 0); i++) {
    const m = windowPool.meshes[i];
    if (!m) continue;
    let vis = show;
    if (vis && (i % 7 === 0)) vis = (Math.sin(performance.now() * 0.004 + i) > -0.75);
    m.visible = vis;
    if (vis) { try { m.material.opacity = (m.material === windowPool.mats[0] ? 0.95 : 0.9) * Math.min(1, night * 1.4); } catch (e) {} }
  }
}

// ---------------- НЕОН И ВЫВЕСКИ ----------------
const NEON_ADS = [
  ['FANTAZIA', '#ff3b81'], ['24/7', '#00e5ff'], ['PIZZA', '#ffb300'], ['МОТЕЛЬ', '#a29bfe'],
  ['КАЗИНО', '#ffd76a'], ['СУШИ', '#ff5252'], ['FZ-CLOUD', '#00ff9d'], ['FITNESS', '#7cffb2'],
  ['ТАКСИ', '#f9ca24'], ['КОФЕ', '#e17055'], ['АВТО', '#4a9dff'], ['БАНК', '#ffd76a'],
];
let neonMats = null;
function buildNeon() {
  try {
    if (!neonMats) {
      neonMats = NEON_ADS.map(([t, c]) => {
        const tex = canvasTex(512, 128, (ctx, w, h) => {
          ctx.fillStyle = 'rgba(6,6,14,0.9)'; ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = c; ctx.lineWidth = 6; ctx.strokeRect(6, 6, w - 12, h - 12);
          ctx.shadowColor = c; ctx.shadowBlur = 26;
          ctx.fillStyle = c; ctx.font = 'bold 64px Arial'; ctx.textAlign = 'center';
          ctx.fillText(t, w / 2, h / 2 + 22);
        });
        return new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
      });
    }
    const count = isMob ? 10 : 20;
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.75), neonMats[i % neonMats.length]);
      m.visible = false; m.renderOrder = 2;
      sceneRef.add(m);
      neonPool.push({ m: m, flick: i % 5 === 0, ph: Math.random() * 6 });
      try {
        const L = new THREE.PointLight(0xffffff, 0, 22);
        L.color.set(NEON_ADS[i % NEON_ADS.length][1]);
        sceneRef.add(L); neonPool[neonPool.length - 1].L = L;
      } catch (e) {}
    }
  } catch (e) {}
}
function rebuildNeon() {
  try {
    if (!neonPool.length || !buildings) return;
    const pp = localPlayer && localPlayer.mesh ? localPlayer.mesh.position : { x: 0, z: 0 };
    const list = buildings.map(b => ({ b: b, d: Math.hypot(b.x - pp.x, b.z - pp.z) })).filter(o => o.b && o.b.bounds).sort((a, b2) => a.d - b2.d).slice(1, isMob ? 6 : 12);
    let i = 0;
    list.forEach(({ b }) => {
      const cnt = Math.min(2, neonPool.length - i);
      for (let k = 0; k < cnt; k++) {
        const p = neonPool[i]; if (!p) return;
        const hi = 3.4 + k * 3.1;
        if (hi > b.h + 1) continue;
        const side = k % 2;
        if (side === 0) {
          p.m.position.set(b.x, hi, b.z + b.d / 2 + 0.09); p.m.rotation.y = 0;
        } else {
          p.m.position.set(b.x + b.w / 2 + 0.09, hi, b.z); p.m.rotation.y = Math.PI / 2;
        }
        p.m.userData.on = true;
        if (p.L) { p.L.position.set(p.m.position.x, p.m.position.y, p.m.position.z); }
        i++;
      }
    });
    for (let k = i; k < neonPool.length; k++) { neonPool[k].m.userData.on = false; if (neonPool[k].L) neonPool[k].L.intensity = 0; }
  } catch (e) {}
}
function updateNeon(dt) {
  if (!neonPool.length) return;
  neonT += dt;
  if (neonT > 9) { neonT = 0; rebuildNeon(); }
  const night = (window.FZDN && window.FZDN.nightF) || 0;
  const on = night > 0.25;
  neonPool.forEach(p => {
    let vis = !!(on && p.m.userData.on);
    if (vis && p.flick && Math.sin(performance.now() * 0.013 + p.ph) < -0.86) vis = false;
    p.m.visible = vis;
    if (p.L) { try { p.L.intensity = vis ? 1.05 : 0; } catch (e) {} }
  });
}
let neonT = 0;

// ---------------- УЛИЧНЫЕ ОБЪЕКТЫ ----------------
function propBox(g, w, h, d, x, y, z, c) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: c }));
  m.position.set(x, y, z); g.add(m); return m;
}
function propCyl(g, r1, r2, h, x, y, z, c, seg) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg || 10), new THREE.MeshLambertMaterial({ color: c }));
  m.position.set(x, y, z); g.add(m); return m;
}
function buildProp(kind, x, z, ry) {
  const g = new THREE.Group();
  const add = (m) => { g.add(m); return m; };
  if (kind === 'bench') {
    propBox(g, 2.6, 0.12, 0.7, 0, 0.55, 0, 0x8a5a33);
    propBox(g, 2.6, 0.5, 0.1, 0, 0.85, -0.32, 0x7a4a28);
    [[-1.05], [1.05]].forEach(([ox]) => propBox(g, 0.14, 0.55, 0.6, ox, 0.27, 0, 0x4a4a4a));
  } else if (kind === 'bin') {
    propCyl(g, 0.42, 0.34, 1.0, 0, 0.5, 0, 0x2f4f3a);
    propCyl(g, 0.46, 0.46, 0.08, 0, 1.04, 0, 0x1f2f26);
  } else if (kind === 'hydrant') {
    propCyl(g, 0.17, 0.2, 0.75, 0, 0.38, 0, 0xc0392b);
    propCyl(g, 0.1, 0.1, 0.3, 0, 0.85, 0, 0xa93226);
    propBox(g, 0.5, 0.1, 0.12, 0, 0.55, 0, 0xa93226);
  } else if (kind === 'planter') {
    propBox(g, 1.5, 0.55, 0.9, 0, 0.28, 0, 0x6b4a2a);
    propBox(g, 1.3, 0.28, 0.75, 0, 0.62, 0, 0x3d6b34);
    propCyl(g, 0.2, 0.3, 1.0, -0.3, 1.15, 0, 0x4f8f3f, 7);
    propCyl(g, 0.22, 0.32, 1.2, 0.35, 1.25, 0.1, 0x3f7f33, 7);
  } else if (kind === 'booth') {
    propBox(g, 1.5, 2.5, 1.5, 0, 1.25, 0, 0x1b5e9c);
    propBox(g, 1.3, 1.7, 0.08, 0, 1.5, 0.72, 0x9fd8ff);
    propBox(g, 1.7, 0.16, 1.7, 0, 2.55, 0, 0x123f6a);
  } else if (kind === 'busstop') {
    propBox(g, 6, 0.18, 3.4, 0, 2.7, 0, 0x37474f);
    [[-2.8], [2.8]].forEach(([ox]) => propBox(g, 0.18, 2.7, 0.18, ox, 1.35, -1.5, 0x546e7a));
    propBox(g, 5.6, 1.7, 0.1, 0, 1.5, -1.6, 0x9fd8ff);
    propBox(g, 5.4, 0.14, 0.8, 0, 0.5, -1.1, 0x8a5a33);
    propBox(g, 0.9, 1.5, 0.14, 2.6, 0.95, 1.2, 0xe7c14b);
  } else if (kind === 'vending') {
    propBox(g, 1.1, 2.0, 0.8, 0, 1.0, 0, 0xb03a2e);
    propBox(g, 0.8, 1.1, 0.1, 0, 1.25, 0.42, 0x111a2a);
    propBox(g, 1.2, 0.12, 0.9, 0, 2.05, 0, 0x7a2a20);
  } else if (kind === 'atm') {
    propBox(g, 1.2, 2.1, 0.7, 0, 1.05, 0, 0x2c3e50);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.55), new THREE.MeshBasicMaterial({ color: 0x00ff9d }));
    s.position.set(0, 1.45, 0.37); add(s);
    propBox(g, 1.3, 0.3, 0.75, 0, 2.15, 0, 0x1a252f);
  } else if (kind === 'mail') {
    propBox(g, 0.5, 1.0, 0.4, 0, 1.0, 0, 0x1e3a8a);
    propBox(g, 0.56, 0.1, 0.46, 0, 1.52, 0, 0x16307a);
    propCyl(g, 0.07, 0.07, 1.0, 0, 0.5, 0, 0x555b66, 8);
  } else if (kind === 'sign') {
    propCyl(g, 0.08, 0.08, 3.2, 0, 1.6, 0, 0x8f8f8f, 8);
    propBox(g, 1.7, 0.5, 0.08, 0, 3.1, 0, 0x2f6f4f);
  } else if (kind === 'statue') {
    propBox(g, 1.8, 0.5, 1.8, 0, 0.25, 0, 0x6b7280);
    propBox(g, 1.3, 0.4, 1.3, 0, 0.7, 0, 0x7b8288);
    propCyl(g, 0.28, 0.34, 1.9, 0, 1.85, 0, 0x9aa2ad, 10);
    propCyl(g, 0.34, 0.34, 0.5, 0, 2.95, 0, 0x9aa2ad, 10);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 10), new THREE.MeshLambertMaterial({ color: 0x9aa2ad }));
    head.position.y = 3.4; add(head);
    propBox(g, 1.5, 0.12, 0.12, 0, 2.5, 0, 0x8a9299);
  }
  g.position.set(x, 0, z);
  if (ry) g.rotation.y = ry;
  try {
    g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    sceneRef.add(g);
  } catch (e) {}
  return g;
}
function freeSpot(x, z, r) {
  try {
    if (buildings.some(b => b && b.bounds && x > b.bounds.minX - r && x < b.bounds.maxX + r && z > b.bounds.minZ - r && z < b.bounds.maxZ + r)) return false;
    if (streetColliders.some(c => Math.hypot(c.x - x, c.z - z) < r + (c.r || 1))) return false;
    if (interactables.some(i => i.position && Math.hypot(i.position.x - x, i.position.z - z) < r + 1.6)) return false;
  } catch (e) { return false; }
  return true;
}
function buildStreetProps() {
  try {
    const kinds = ['bench', 'bench', 'bin', 'planter', 'hydrant', 'mail', 'sign', 'booth', 'vending', 'busstop', 'atm', 'bin'];
    let n = 0, placed = 0;
    const lines = [8, -8, 62, -62];
    const limit = isMob ? 40 : 90;
    for (let li = 0; li < lines.length && placed < limit; li++) {
      const off = lines[li];
      const horiz = Math.abs(off) < 20; // вдоль дороги x=0 → стоим на тротуаре z=±8
      for (let t = -140; t <= 140 && placed < limit; t += 13) {
        const x = horiz ? t : off;
        const z = horiz ? off : t;
        if (Math.abs(Math.abs(t) - 60) < 12) continue;   // не в перекрёстках
        if (Math.abs(t) < 14) continue;
        if (Math.hypot(x, z) < 16) continue;
        if (!freeSpot(x, z, 2.2)) continue;
        const kind = kinds[(n++) % kinds.length];
        buildProp(kind, x, z, horiz ? (off > 0 ? 0 : Math.PI) : (off > 0 ? -Math.PI / 2 : Math.PI / 2));
        if (kind !== 'planter' && kind !== 'bench' && kind !== 'sign') {
          try { streetColliders.push({ x: x, z: z, r: kind === 'busstop' ? 3.0 : 0.6 }); } catch (e) {}
        }
        placed++;
      }
    }
    // статуя на площади + клумбы
    if (freeSpot(6, -20, 4)) { buildProp('statue', 6, -20, 0.4); try { streetColliders.push({ x: 6, z: -20, r: 1.6 }); } catch (e) {} }
    [[-14, 24], [16, 22], [-22, -30], [24, -22]].forEach(([px, pz]) => { if (freeSpot(px, pz, 2)) buildProp('planter', px, pz, Math.random() * 3); });
  } catch (e) {}
}

// ---------------- ЧАСТИЦЫ ----------------
function mkPoints(count, size, color, blending) {
  const pos = new Float32Array(count * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: color, size: size, transparent: true, opacity: 0.9, depthWrite: false, blending: blending || THREE.NormalBlending, sizeAttenuation: true });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  return p;
}
function buildParticles() {
  try {
    // брызги дождя
    rainSplash = mkPoints(isMob ? 120 : 260, 0.5, 0xaad4ff, THREE.AdditiveBlending);
    rainSplash.material.opacity = 0;
    sceneRef.add(rainSplash);
    rainSplash.userData.data = [];
    for (let i = 0; i < rainSplash.geometry.attributes.position.count; i++) rainSplash.userData.data.push({ life: Math.random(), x: 0, z: 0 });
    // снег
    snowPts = mkPoints(isMob ? 200 : 460, 0.42, 0xffffff);
    snowPts.visible = false;
    sceneRef.add(snowPts);
    snowPts.userData.data = [];
    for (let i = 0; i < snowPts.geometry.attributes.position.count; i++) snowPts.userData.data.push({ y: Math.random() * 30, x: (Math.random() - 0.5) * 90, z: (Math.random() - 0.5) * 90, s: 0.5 + Math.random(), ph: Math.random() * 6 });
    // пылинки/мошки днём
    dustPts = mkPoints(isMob ? 60 : 150, 0.22, 0xffe9b0, THREE.AdditiveBlending);
    dustPts.material.opacity = 0.5;
    sceneRef.add(dustPts);
    dustPts.userData.data = [];
    for (let i = 0; i < dustPts.geometry.attributes.position.count; i++) dustPts.userData.data.push({ x: (Math.random() - 0.5) * 60, y: 0.6 + Math.random() * 4, z: (Math.random() - 0.5) * 60, ph: Math.random() * 6 });
    // листья
    leavesPts = mkPoints(isMob ? 40 : 90, 0.55, 0xd8a44a);
    sceneRef.add(leavesPts);
    leavesPts.userData.data = [];
    for (let i = 0; i < leavesPts.geometry.attributes.position.count; i++) leavesPts.userData.data.push({ x: (Math.random() - 0.5) * 80, y: Math.random() * 12, z: (Math.random() - 0.5) * 80, ph: Math.random() * 6, s: 0.6 + Math.random() });
  } catch (e) {}
}
function updateParticles(dt, pp, t) {
  const rain = (window.FZDN && window.FZDN.rain) || 0;
  const night = (window.FZDN && window.FZDN.nightF) || 0;
  // брызги
  if (rainSplash) {
    const show = rain > 0.25;
    rainSplash.material.opacity = show ? Math.min(0.75, rain * 0.8) : 0;
    if (show) {
      const arr = rainSplash.geometry.attributes.position.array, d = rainSplash.userData.data;
      for (let i = 0; i < d.length; i++) {
        const e = d[i];
        e.life -= dt * 2.2;
        if (e.life <= 0) {
          e.life = 1;
          e.x = pp.x + (Math.random() - 0.5) * 46;
          e.z = pp.z + (Math.random() - 0.5) * 46;
        }
        arr[i * 3] = e.x; arr[i * 3 + 1] = 0.12 + (1 - e.life) * 0.25; arr[i * 3 + 2] = e.z;
      }
      rainSplash.geometry.attributes.position.needsUpdate = true;
    }
  }
  // снег
  if (snowPts) {
    const snowOn = P.tier !== 'off' && window.FZ8F && window.FZ8F.snow;
    snowPts.visible = !!snowOn;
    if (snowOn) {
      const arr = snowPts.geometry.attributes.position.array, d = snowPts.userData.data;
      for (let i = 0; i < d.length; i++) {
        const e = d[i];
        e.y -= dt * (1.4 * e.s);
        e.ph += dt;
        if (e.y < 0.2) { e.y = 26 + Math.random() * 8; e.x = (Math.random() - 0.5) * 90; e.z = (Math.random() - 0.5) * 90; }
        arr[i * 3] = pp.x + e.x + Math.sin(e.ph * 0.7) * 1.6;
        arr[i * 3 + 1] = e.y;
        arr[i * 3 + 2] = pp.z + e.z + Math.cos(e.ph * 0.5) * 1.4;
      }
      snowPts.geometry.attributes.position.needsUpdate = true;
    }
  }
  // пылинки
  if (dustPts) {
    const on = night < 0.4;
    dustPts.visible = on;
    if (on) {
      const arr = dustPts.geometry.attributes.position.array, d = dustPts.userData.data;
      for (let i = 0; i < d.length; i++) {
        const e = d[i];
        arr[i * 3] = pp.x + e.x + Math.sin(t * 0.4 + e.ph) * 1.1;
        arr[i * 3 + 1] = e.y + Math.sin(t * 0.9 + e.ph) * 0.35;
        arr[i * 3 + 2] = pp.z + e.z + Math.cos(t * 0.33 + e.ph) * 1.1;
      }
      dustPts.geometry.attributes.position.needsUpdate = true;
    }
  }
  // листья
  if (leavesPts) {
    const arr = leavesPts.geometry.attributes.position.array, d = leavesPts.userData.data;
    for (let i = 0; i < d.length; i++) {
      const e = d[i];
      e.ph += dt * 0.9;
      e.y -= dt * 0.5 * e.s;
      if (e.y < 0.1) { e.y = 10 + Math.random() * 4; e.x = (Math.random() - 0.5) * 80; e.z = (Math.random() - 0.5) * 80; }
      arr[i * 3] = pp.x + e.x + Math.sin(e.ph) * 3;
      arr[i * 3 + 1] = e.y;
      arr[i * 3 + 2] = pp.z + e.z + Math.cos(e.ph * 0.8) * 3;
    }
    leavesPts.geometry.attributes.position.needsUpdate = true;
  }
  // дым из труб + выхлоп
  for (let i = smokePuffs.length - 1; i >= 0; i--) {
    const s = smokePuffs[i];
    s.life -= dt;
    if (s.life <= 0) { try { sceneRef.remove(s.m); } catch (e) {} smokePuffs.splice(i, 1); continue; }
    s.m.position.y += dt * s.vy;
    s.m.position.x += dt * s.vx;
    const k = s.life / s.max;
    try { s.m.material.opacity = s.op * k; s.m.scale.setScalar(s.s0 * (1.6 - k * 0.7)); } catch (e) {}
  }
  exhaustT += dt;
  if (exhaustT > 0.45) {
    exhaustT = 0;
    try {
      const cars = window.cars;
      if (cars && cars.length && smokePuffs.length < 26) {
        for (let c = 0; c < Math.min(2, cars.length); c++) {
          const car = cars[Math.floor(Math.random() * cars.length)];
          if (!car || !car.mesh) continue;
          const m = car.mesh, px = m.position.x, pz = m.position.z;
          if (Math.hypot(px - pp.x, pz - pp.z) > 60) continue;
          puff(px, 0.5, pz, 0.5, 0x9aa0a6, 1.6, 0.22);
        }
      }
      // дым из труб домов
      if (buildings && buildings.length && smokePuffs.length < 22) {
        const b = buildings[Math.floor(Math.random() * buildings.length)];
        if (b && b.h > 7 && Math.hypot(b.x - pp.x, b.z - pp.z) < 90) puff(b.x + b.w * 0.3, b.h + 0.8, b.z - b.d * 0.3, 1.2, 0xc8ccd4, 3, 0.16);
      }
    } catch (e) {}
  }
}
function puff(x, y, z, s0, color, life, op) {
  try {
    const m = new THREE.Mesh(new THREE.SphereGeometry(s0, 6, 5), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: op, depthWrite: false }));
    m.position.set(x, y, z);
    sceneRef.add(m);
    smokePuffs.push({ m: m, life: life, max: life, vy: 0.9, vx: (Math.random() - 0.5) * 0.3, op: op, s0: s0 });
    if (smokePuffs.length > 40) { const old = smokePuffs.shift(); try { sceneRef.remove(old.m); } catch (e) {} }
  } catch (e) {}
}
function burst(x, y, z, color, count, power) {
  try {
    for (let i = 0; i < (count || 14); i++) {
      const s0 = 0.4 + Math.random() * 1.1;
      puff(x + (Math.random() - 0.5) * 2, y + Math.random() * 1.6, z + (Math.random() - 0.5) * 2, s0, color || 0xffb347, 1.4 + Math.random() * 0.9, 0.9);
    }
    FZFX.flash(0.25, [1, 0.85, 0.5]);
  } catch (e) {}
}

// ---------------- ТЕНИ-ПЯТНА ПОД ОБЪЕКТАМИ ----------------
function buildBlobs() {
  try {
    blobGeo = new THREE.CircleGeometry(1, 16);
    blobMat = new THREE.MeshBasicMaterial({
      map: canvasTex(64, 64, (c, w, h) => {
        const g = c.createRadialGradient(32, 32, 2, 32, 32, 30);
        g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.6, 'rgba(0,0,0,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.fillRect(0, 0, w, h);
      }),
      transparent: true, depthWrite: false, opacity: 0.85,
    });
    blobGroup = new THREE.Group(); sceneRef.add(blobGroup);
    window.FZ_blobPool = [];
  } catch (e) {}
}
function blobFor(i) {
  if (window.FZ_blobPool[i]) return window.FZ_blobPool[i];
  const m = new THREE.Mesh(blobGeo, blobMat);
  m.rotation.x = -Math.PI / 2; m.renderOrder = 2; m.visible = false;
  blobGroup.add(m);
  window.FZ_blobPool[i] = m;
  return m;
}
function updateBlobs() {
  if (!blobGroup) return;
  const ents = [];
  try { if (localPlayer && localPlayer.mesh) ents.push(localPlayer.mesh); } catch (e) {}
  try { if (typeof npcs !== 'undefined' && npcs) npcs.forEach(n => { if (n && n.mesh && n.mesh.visible !== false) ents.push(n.mesh); }); } catch (e) {}
  try { if (typeof cars !== 'undefined' && cars) cars.forEach(c => { if (c && c.mesh) ents.push(c.mesh); }); } catch (e) {}
  try { if (typeof remotePlayers !== 'undefined' && remotePlayers) Object.keys(remotePlayers).forEach(k => { const rp = remotePlayers[k]; if (rp && rp.mesh) ents.push(rp.mesh); }); } catch (e) {}
  try { (window.FZ_blobEntities || []).forEach(e => { const mm = e && (e.mesh || e); if (mm && mm.position) ents.push(mm); }); } catch (e) {}
  const max = Math.min(ents.length, window.FZ_blobPool.length ? 200 : 200);
  for (let i = 0; i < max; i++) {
    const m = blobFor(i), e = ents[i];
    try {
      const sc = e.scale ? (e.scale.x || 1) : 1;
      m.position.set(e.position.x, 0.035, e.position.z);
      const k = 0.55 * sc;
      m.scale.set(k, k, 1);
      m.visible = blobGroup.parent === sceneRef;
    } catch (err) { m.visible = false; }
  }
  for (let i = max; i < (window.FZ_blobPool.length || 0); i++) { if (window.FZ_blobPool[i]) window.FZ_blobPool[i].visible = false; }
}

// ---------------- ЭКРАННЫЕ ЭФФЕКТЫ ----------------
function buildScreenFX() {
  try {
    if (document.getElementById('fz8fx')) { screenEls = window._fz8els; return; }
    const css = document.createElement('style'); css.id = 'fz8Css';
    css.textContent =
      '#fz8fx{position:fixed;inset:0;pointer-events:none;z-index:900;overflow:hidden;}'
      + '#fz8fx .fz8vig{position:absolute;inset:0;background:radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%);opacity:0;transition:opacity .5s;}'
      + '#fz8fx .fz8dmg{position:absolute;inset:0;background:radial-gradient(ellipse at center, rgba(255,0,0,0) 35%, rgba(190,20,20,0.7) 100%);opacity:0;}'
      + '#fz8fx .fz8low{position:absolute;inset:0;background:radial-gradient(ellipse at center, rgba(255,0,0,0) 40%, rgba(120,0,0,0.65) 100%);opacity:0;}'
      + '#fz8fx .fz8lines{position:absolute;inset:-10%;opacity:0;background:repeating-conic-gradient(from 0deg at 50% 50%, rgba(255,255,255,0.00) 0deg 2deg, rgba(255,255,255,0.35) 2deg 2.6deg);mask-image:radial-gradient(ellipse at center, transparent 34%, black 78%);-webkit-mask-image:radial-gradient(ellipse at center, transparent 34%, black 78%);}'
      + '#fz8fx .fz8rain{position:absolute;inset:0;opacity:0;background-image:radial-gradient(circle at 12% 22%, rgba(255,255,255,0.32) 0 2px, transparent 3px),radial-gradient(circle at 68% 42%, rgba(255,255,255,0.26) 0 2.5px, transparent 4px),radial-gradient(circle at 34% 74%, rgba(255,255,255,0.22) 0 2px, transparent 3px),radial-gradient(circle at 82% 82%, rgba(255,255,255,0.28) 0 3px, transparent 4px),radial-gradient(circle at 52% 12%, rgba(255,255,255,0.2) 0 2px, transparent 3px);animation:fz8rainmove 1.1s linear infinite;transition:opacity .8s;}'
      + '@keyframes fz8rainmove{0%{background-position:0 0,0 0,0 0,0 0,0 0;}100%{background-position:-14px 26px,-9px 22px,-12px 18px,-16px 30px,-8px 20px;}}'
      + '#fz8fx .fz8bar{position:absolute;left:0;right:0;height:0;background:#000;transition:height .35s;}'
      + '#fz8fx .fz8bar.top{top:0;} #fz8fx .fz8bar.bot{bottom:0;}'
      + '#fz8hint{position:fixed;left:50%;bottom:14%;transform:translateX(-50%);z-index:920;background:rgba(6,4,16,.82);border:1px solid #ffd76a66;border-radius:12px;color:#fff;font:14px Arial;padding:10px 16px;display:none;}';
    document.head.appendChild(css);
    const fx = document.createElement('div'); fx.id = 'fz8fx';
    fx.innerHTML = '<div class="fz8vig"></div><div class="fz8dmg"></div><div class="fz8low"></div><div class="fz8lines"></div><div class="fz8rain"></div><div class="fz8bar top"></div><div class="fz8bar bot"></div>';
    document.body.appendChild(fx);
    const hint = document.createElement('div'); hint.id = 'fz8hint'; document.body.appendChild(hint);
    window._fz8els = {
      vig: fx.querySelector('.fz8vig'), dmg: fx.querySelector('.fz8dmg'), low: fx.querySelector('.fz8low'),
      lines: fx.querySelector('.fz8lines'), rain: fx.querySelector('.fz8rain'),
      barT: fx.querySelector('.fz8bar.top'), barB: fx.querySelector('.fz8bar.bot'), hint: hint,
    };
    screenEls = window._fz8els;
  } catch (e) { screenEls = { vig: null, dmg: null, low: null, lines: null, rain: null, barT: null, barB: null, hint: null }; }
}
function hintMsg(t, ms) {
  try {
    buildScreenFX();
    const h = screenEls.hint; if (!h) return;
    h.innerHTML = t; h.style.display = 'block';
    clearTimeout(h._t);
    h._t = setTimeout(() => { h.style.display = 'none'; }, ms || 3200);
  } catch (e) {}
}
function applyShakeToCamera() {
  try {
    if (!camRef) camRef = (typeof camera !== 'undefined') ? camera : null;
    if (!camRef) return;
    camRef.userData = camRef.userData || {};
    const u = camRef.userData;
    if (u._shaken) { camRef.position.x = u.ox; camRef.position.y = u.oy; camRef.position.z = u.oz; u._shaken = false; }
    if (shake.amp > 0.0005 || fovKick > 0.01) {
      u.ox = camRef.position.x; u.oy = camRef.position.y; u.oz = camRef.position.z;
      u.ofov = camRef.fov;
      const a = shake.amp * (window.FZPlay?.reducedMotion() ? 0 : P.shake);
      camRef.position.x += (Math.random() - 0.5) * a;
      camRef.position.y += (Math.random() - 0.5) * a;
      camRef.position.z += (Math.random() - 0.5) * a;
      camRef.rotation.z += (Math.random() - 0.5) * a * 0.12;
      u._rotz = camRef.rotation.z;
      if (fovKick > 0.01) { camRef.fov = u.ofov + fovKick; if (camRef.updateProjectionMatrix) camRef.updateProjectionMatrix(); }
      u._shaken = true;
      u._fovk = fovKick;
    }
  } catch (e) {}
}
function updateShake(dt) {
  shake.amp *= Math.pow(0.02, dt);
  shake.t += dt;
  fovKick *= Math.pow(0.06, dt);
  shockLevel *= Math.pow(0.08, dt);
  if (fadeTarget !== fade) { fade += (fadeTarget - fade) * Math.min(1, dt * 4); if (Math.abs(fadeTarget - fade) < 0.01) fade = fadeTarget; }
}

// ---------------- ПАНЕЛЬ ГРАФИКИ + ОТЛАДКА ----------------
function gfxPanel() {
  buildScreenFX();
  let m = document.getElementById('fz8Panel');
  if (!m) {
    m = document.createElement('div'); m.id = 'fz8Panel';
    m.style.cssText = 'position:fixed;inset:0;z-index:8300;display:flex;align-items:center;justify-content:center;background:rgba(4,2,12,.76);backdrop-filter:blur(4px);padding:12px;box-sizing:border-box;';
    m.onclick = (e) => { if (e.target === m) m.style.display = 'none'; };
    document.body.appendChild(m);
  }
  const tierBtns = TIERS.map(t => {
    const on = P.tier === t;
    return '<button onclick="FZFX.setTier(\'' + t + '\')" style="flex:1;margin:2px;padding:9px 4px;border-radius:10px;cursor:pointer;font:bold 12px Arial;border:1.5px solid ' + (on ? '#7cffb2' : '#ffffff22') + ';background:' + (on ? 'linear-gradient(135deg,#00b894,#00997a)' : '#ffffff10') + ';color:#fff;">' + t.toUpperCase() + '</button>';
  }).join('');
  const row = (name, val, extra) => '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;background:#ffffff08;border:1px solid #ffffff14;border-radius:12px;padding:9px 12px;margin-bottom:8px;"><div style="color:#fff;font:13px Arial;">' + name + '</div><div style="color:#ffd76a;font:bold 13px Arial;">' + val + '</div>' + (extra || '') + '</div>';
  const h = '<div style="width:min(520px,96vw);max-height:88vh;overflow:auto;background:linear-gradient(160deg,#141230,#0a0918);border:1.5px solid #6c5ce766;border-radius:18px;padding:16px;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><div style="font:bold 16px Arial;color:#fff;">⚙️ ГРАФИКА И КАЧЕСТВО</div>'
    + '<button onclick="document.getElementById(\'fz8Panel\').style.display=\'none\'" style="background:#ffffff14;color:#fff;border:1px solid #ffffff2e;border-radius:10px;width:32px;height:32px;cursor:pointer;">✕</button></div>'
    + '<div style="display:flex;margin-bottom:10px;">' + tierBtns + '</div>'
    + '<div style="color:#a29bfe;font:11px Arial;margin-bottom:10px;">off — максимум FPS · low — без постобработки · medium — bloom · high — bloom + лучи + хроматика · ultra — тени + широкий bloom</div>'
    + row('FPS сейчас', Math.round(fps))
    + row('Разрешение рендера', Math.round(P.renderScale * 100) + '%')
    + row('Авто-адаптация', P.auto ? 'вкл' : 'выкл', '<button onclick="FZFX.auto(!FZFX.auto())" style="background:#6c5ce7;color:#fff;border:none;border-radius:9px;padding:6px 10px;cursor:pointer;font:bold 11px Arial;">' + (P.auto ? 'Выключить' : 'Включить') + '</button>')
    + row('Снег ❄️', window.FZ8F && window.FZ8F.snow ? 'идёт' : 'нет', '<button onclick="FZFX.snow(!(window.FZ8F&&window.FZ8F.snow))" style="background:#0984e3;color:#fff;border:none;border-radius:9px;padding:6px 10px;cursor:pointer;font:bold 11px Arial;">Переключить</button>')
    + row('Тряска камеры', Math.round(P.shake * 100) + '%', '<button onclick="FZFX.shakeSet(1)" style="background:#ffffff14;color:#fff;border:1px solid #ffffff22;border-radius:9px;padding:5px 9px;cursor:pointer;font:11px Arial;">100%</button><button onclick="FZFX.shakeSet(0.3)" style="background:#ffffff14;color:#fff;border:1px solid #ffffff22;border-radius:9px;padding:5px 9px;cursor:pointer;font:11px Arial;margin-left:4px;">30%</button><button onclick="FZFX.shakeSet(0)" style="background:#ffffff14;color:#fff;border:1px solid #ffffff22;border-radius:9px;padding:5px 9px;cursor:pointer;font:11px Arial;margin-left:4px;">выкл</button>')
    + row('Отладочная панель (F3)', P.fpsShow ? 'вкл' : 'выкл', '<button onclick="FZFX.debug()" style="background:#6c5ce7;color:#fff;border:none;border-radius:9px;padding:6px 10px;cursor:pointer;font:bold 11px Arial;">Переключить</button>')
    + '<div style="display:flex;gap:8px;margin-top:6px;"><button onclick="FZFX.renderScale(' + Math.max(0.5, P.renderScale - 0.1).toFixed(2) + ')" style="flex:1;background:#ffffff12;color:#fff;border:1px solid #ffffff22;border-radius:10px;padding:9px;cursor:pointer;font:bold 12px Arial;">− разрешение</button>'
    + '<button onclick="FZFX.renderScale(' + Math.min(1, P.renderScale + 0.1).toFixed(2) + ')" style="flex:1;background:#ffffff12;color:#fff;border:1px solid #ffffff22;border-radius:10px;padding:9px;cursor:pointer;font:bold 12px Arial;">+ разрешение</button></div>'
    + '<div style="color:#7f8fa6;font:11px Arial;margin-top:10px;">Если FPS ниже 26 — качество снижается автоматически (разрешение и постобработка). F3 — счётчик FPS и статистика рендера.</div>'
    + '</div>';
  m.innerHTML = h;
  m.style.display = 'flex';
}
function debugInit() {
  if (document.getElementById('fz8Dbg')) return;
  const d = document.createElement('div'); d.id = 'fz8Dbg';
  d.style.cssText = 'position:fixed;left:10px;top:50%;transform:translateY(-50%);z-index:6100;background:rgba(4,6,14,.78);border:1px solid #7cffb288;border-radius:10px;padding:8px 10px;color:#dfe6e9;font:11px Consolas,monospace;line-height:1.5;display:none;pointer-events:none;white-space:pre;';
  document.body.appendChild(d);
}
function gfxButton() {
  if (document.getElementById('fz8GfxBtn')) return;
  try {
    if (!document.getElementById('fz8BtnCss')) {
      const st = document.createElement('style'); st.id = 'fz8BtnCss';
      st.textContent = '#fz8GfxBtn{position:fixed;right:200px;top:16px;z-index:6100;width:44px;height:44px;border-radius:13px;border:1.4px solid #6c5ce788;background:linear-gradient(150deg,#1a1636ee,#0d0a1cdd);color:#fff;font-size:20px;cursor:pointer;backdrop-filter:blur(6px);}'
        + '#fz8GfxBtn:hover{border-color:#a29bfe;}'
        + '@media (max-width:820px){#fz8GfxBtn{right:auto;left:8px;top:98px;width:40px;height:40px;font-size:18px;}}';
      document.head.appendChild(st);
    }
    const b = document.createElement('button');
    b.id = 'fz8GfxBtn'; b.title = 'Графика и качество (F4)'; b.textContent = '⚙️';
    b.onclick = () => gfxPanel();
    document.body.appendChild(b);
  } catch (e) {}
}

// ---------------- ОБНОВЛЕНИЕ НЕБА И СВЕТА ----------------
function updateSky(dt, pp, t) {
  const night = (window.FZDN && window.FZDN.nightF) || 0;
  const h = (window.FZDN && typeof window.FZDN.hours === 'number') ? window.FZDN.hours : 12;
  const dir = sunDirNow(sunDirV);
  const sunUp = Math.max(0, dir.y);
  const dusk = Math.min(1, Math.max(0, 1 - Math.abs(dir.y) * 5));
  const R = 620;
  const camPos = camRef ? camRef.position : pp;
  if (sunMesh) {
    const sunVis = dir.y > -0.1;
    sunMesh.visible = sunVis; if (sunGlow) sunGlow.visible = sunVis;
    sunMesh.position.set(camPos.x + dir.x * R, camPos.y + dir.y * R, camPos.z + dir.z * R);
    if (sunGlow) sunGlow.position.copy(sunMesh.position);
    const warm = dusk;
    try {
      sunMesh.material.color.setRGB(1, 0.96 - warm * 0.22, 0.86 - warm * 0.5);
      sunMesh.material.opacity = 0.45 + sunUp * 0.55;
      if (sunGlow) { sunGlow.material.color.setRGB(1, 0.9 - warm * 0.35, 0.7 - warm * 0.55); sunGlow.material.opacity = 0.35 + sunUp * 0.5; sunGlow.scale.setScalar(90 + 60 * sunUp); }
    } catch (e) {}
  }
  if (moonMesh) {
    const moonDir = { x: -dir.x, y: -dir.y, z: -dir.z };
    const mVis = night > 0.25 && moonDir.y > -0.15;
    moonMesh.visible = mVis;
    moonMesh.position.set(camPos.x + moonDir.x * R, camPos.y + moonDir.y * R, camPos.z + moonDir.z * R);
    try { moonMesh.material.opacity = Math.min(0.95, night * 1.1); } catch (e) {}
  }
  if (starField) {
    try {
      starField.material.opacity = Math.max(0, night * 1.05 - 0.05) * (0.85 + 0.15 * Math.sin(t * 1.7));
      starField.position.set(camPos.x, camPos.y, camPos.z);
      starField.rotation.y = t * 0.004;
    } catch (e) {}
  }
  // падающая звезда
  if (shootStar) {
    shootStarT -= dt;
    if (shootStarT <= 0 && night > 0.6 && Math.random() < 0.4) {
      shootStarT = 6 + Math.random() * 22;
      shootStar.userData.life = 1.1;
      const a = Math.random() * 6.28, r = 520;
      shootStar.userData.from = { x: camPos.x + Math.cos(a) * r, y: 260 + Math.random() * 160, z: camPos.z + Math.sin(a) * r };
      shootStar.userData.to = { x: shootStar.userData.from.x - Math.cos(a) * 220, y: 60, z: shootStar.userData.from.z - Math.sin(a) * 220 };
    }
    if (shootStar.userData.life > 0) {
      shootStar.userData.life -= dt;
      const k = 1 - Math.max(0, shootStar.userData.life);
      const f = shootStar.userData.from, to = shootStar.userData.to;
      shootStar.visible = true;
      shootStar.position.set(f.x + (to.x - f.x) * k, f.y + (to.y - f.y) * k, f.z + (to.z - f.z) * k);
      try { shootStar.material.opacity = Math.max(0, shootStar.userData.life); } catch (e) {}
    } else if (shootStar.visible) { shootStar.visible = false; }
  }
  if (haze) {
    haze.position.set(camPos.x, 40, camPos.z);
    try {
      haze.material.color.setRGB(1, 0.72 + 0.28 * (1 - dusk), 0.6 + 0.4 * (1 - dusk));
      haze.material.opacity = 0.22 + dusk * 0.55;
    } catch (e) {}
  }
  if (cloudsExtra) { cloudsExtra.rotation.y += dt * 0.004; }
  // блики
  if (flareGroup && camRef) {
    const camDir = new THREE.Vector3();
    try { camRef.getWorldDirection(camDir); } catch (e) {}
    const dot = camDir.x * dir.x + camDir.y * dir.y + camDir.z * dir.z;
    const strength = Math.max(0, (dot - 0.5) / 0.5) * (dir.y > 0.02 ? 1 : 0) * (1 - night) * (1 - ((window.FZDN && window.FZDN.rain) || 0));
    const right = new THREE.Vector3(), up = new THREE.Vector3();
    try { right.setFromMatrixColumn(camRef.matrixWorld, 0); up.setFromMatrixColumn(camRef.matrixWorld, 1); } catch (e) {}
    flareParts.forEach(sp => {
      const t2 = sp.userData.off;
      const off = sp.userData.side;
      sp.position.set(
        camPos.x + (dir.x * (0.9 - t2)) * 240 + right.x * off * (0.4 + t2 * 0.6) + up.x * off * 0.35,
        camPos.y + (dir.y * (0.9 - t2)) * 240 + right.y * off * (0.4 + t2 * 0.6) + up.y * off * 0.35,
        camPos.z + (dir.z * (0.9 - t2)) * 240 + right.z * off * (0.4 + t2 * 0.6) + up.z * off * 0.35
      );
      try { sp.material.opacity = Math.max(0, strength * (0.55 - t2 * 0.6)); } catch (e) {}
      sp.scale.setScalar((26 + t2 * 60) * (0.6 + strength));
    });
  }
  // свет и тон
  if (sunLight) {
    const k = Math.max(0, dir.y);
    sunLight.position.set(camPos.x + dir.x * 90, Math.max(20, camPos.y + dir.y * 120), camPos.z + dir.z * 90);
    sunLight.target.position.set(camPos.x, 0, camPos.z);
    sunLight.intensity = 0.12 + k * 0.85;
    try { sunLight.color.setRGB(1, 0.93 - dusk * 0.12, 0.82 - dusk * 0.35); } catch (e) {}
  }
  if (hemi) {
    hemi.intensity = 0.3 + (1 - night) * 0.22;
    try { hemi.color.setRGB(0.6 + (1 - night) * 0.22, 0.72, 0.9); hemi.groundColor.setRGB(0.22 + (1 - night) * 0.12, 0.2, 0.16); } catch (e) {}
  }
  if (compMat) {
    const u = compMat.uniforms;
    const cold = night, warm = dusk * (1 - night);
    u.tint.value.set(1 - cold * 0.12 + warm * 0.1, 1 - cold * 0.06 - warm * 0.02, 1 + cold * 0.16 - warm * 0.12);
    u.saturation.value = P.saturation * (1 + cold * 0.05) * (1 - (window.FZDN && window.FZDN.rain ? 0.12 : 0));
    u.exposure.value = P.exposure * (1 - cold * 0.1) * (1 - ((window.FZDN && window.FZDN.rain) || 0) * 0.12);
    const nightVig = P.vignette + cold * 0.25;
    u.vignette.value = nightVig;
  }
}
let sunDirV = null, shootStarT = 8;

// ---------------- ПУБЛИЧНЫЙ API ЭФФЕКТОВ ----------------
function flashEl() {
  try {
    if (!window._fz8flash) {
      const fx = document.getElementById('fz8fx');
      if (!fx) return null;
      const d = document.createElement('div');
      d.style.cssText = 'position:absolute;inset:0;background:#fff;opacity:0;transition:opacity .3s;mix-blend-mode:screen;';
      fx.appendChild(d); window._fz8flash = d;
    }
    return window._fz8flash;
  } catch (e) { return null; }
}
window.FZFX = {
  shake: function (a) { shake.amp = Math.max(shake.amp, a * 0.12); },
  shakeSet: function (v) { P.shake = v; saveP(); hintMsg('Тряска камеры: ' + Math.round(v * 100) + '%', 1600); },
  fov: function (v) { fovKick = Math.max(fovKick, v); },
  shock: function (v) { shockLevel = Math.max(shockLevel, v); },
  flash: function (op, rgb, ms) {
    const e = flashEl();
    if (!e) return;
    try {
      e.style.background = rgb ? 'rgb(' + rgb.map(v => Math.round(v * 255)).join(',') + ')' : '#fff';
      e.style.transition = 'opacity .05s';
      e.style.opacity = String(Math.min(0.85, op || 0.4));
      setTimeout(() => { e.style.transition = 'opacity ' + ((ms || 400)) + 'ms'; e.style.opacity = '0'; }, 60);
    } catch (err) {}
  },
  damage: function () {
    damagePulse = 1;
    FZFX.shake(14);
    FZFX.shock(0.5);
  },
  burst: burst,
  puff: puff,
  fade: function (op, ms) {
    try {
      const e = flashEl();
      if (!e) return;
      e.style.background = '#000';
      e.style.transition = 'opacity ' + ((ms || 500) / 2) + 'ms';
      e.style.opacity = String(clamp(op, 0, 1));
      if (op > 0.5) setTimeout(() => { e.style.opacity = '0'; }, (ms || 500));
    } catch (err) {}
  },
  letterbox: function (on) {
    buildScreenFX();
    try {
      screenEls.barT.style.height = on ? '9vh' : '0px';
      screenEls.barB.style.height = on ? '9vh' : '0px';
    } catch (e) {}
  },
  speedLines: function (v) { speedLinesManual = v; },
  hint: hintMsg,
  setTier: function (t, silent) {
    if (TIERS.indexOf(t) < 0) return;
    P.tier = t; applyTier();
    try { if (renderer) { renderer.shadowMap.enabled = ti() >= 4; if (window._fz8Ground) window._fz8Ground.receiveShadow = ti() >= 4; } } catch (e) {}
    if (!silent) { hintMsg('Графика: ' + t.toUpperCase(), 1800); gfxPanel(); }
  },
  sessionQuality: function(t) { if (TIERS.includes(t)) { P.tier=t; P.auto=false; P.renderScale=1; applyTier(false); } },
  tier: function () { return P.tier; },
  auto: function (v) { if (typeof v === 'boolean') { P.auto = v; saveP(); } return P.auto; },
  snow: function (v) { window.FZ8F = window.FZ8F || {}; window.FZ8F.snow = (typeof v === 'boolean') ? v : !window.FZ8F.snow; saveP(); return window.FZ8F.snow; },
  debug: function () {
    P.fpsShow = !P.fpsShow; saveP();
    const d = document.getElementById('fz8Dbg'); if (d) d.style.display = P.fpsShow ? 'block' : 'none';
  },
  renderScale: function (v) { P.renderScale = clamp(v, 0.5, 1); saveP(); allocTargets(); gfxPanel(); },
  panel: gfxPanel,
  trackBlob: function (o) { window.FZ_blobEntities = window.FZ_blobEntities || []; window.FZ_blobEntities.push(o); },
  fps: function () { return Math.round(fps); },
  state: function () { return { tier: P.tier, fps: Math.round(fps), scale: P.renderScale, bloom: P.bloom }; },
};
let speedLinesManual = 0;
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// ---------------- ИНИЦИАЛИЗАЦИЯ ----------------
let inited = false, initTries = 0, propsDone = false, extraT = 0, hookT = 0, lastPP = { x: 0, z: 0 }, sprintSpeed = 0;
function tryInit() {
  if (inited) return true;
  const W = (typeof window !== 'undefined') ? window : {};
  if (!W.renderer || !W.scene || !W.camera) return false;
  renderer = W.renderer; sceneRef = W.scene; camRef = W.camera;
  patchRenderer();
  ensureQuad();
  buildPasses();
  allocTargets();
  loadP();
  applyTier();
  buildSky();
  buildLights();
  buildBlobs();
  buildParticles();
  buildWindowPool();
  buildNeon();
  buildScreenFX();
  gfxButton();
  debugInit();
  inited = true;
  try { window.FZ8G = { P: P, sunDesc: sunDirV, hint: hintMsg }; } catch (e) {}
  return true;
}
function FZ8GFX_update(delta) {
  const dt = Math.min(delta || 0.016, 0.12);
  if (!inited) {
    initTries++;
    if (!tryInit()) return;
  }
  timeU.value += dt;
  updateShake(dt);
  const pp = (localPlayer && localPlayer.mesh) ? localPlayer.mesh.position : { x: 0, y: 0, z: 0 };
  const t = timeU.value;
  hookT += dt;
  if (hookT > 0.5) {
    hookT = 0;
    hookGround();
    collectTraffic();
    if (!propsDone && typeof buildings !== 'undefined' && buildings.length > 4 && t > 2) { propsDone = true; buildStreetProps(); rebuildNeon(); rebuildWindows(); }
  }
  updateSky(dt, pp, t);
  updateTraffic(dt);
  updateWindows(dt);
  updateNeon(dt);
  updateParticles(dt, pp, t);
  updateBlobs();
  // экранные эффекты
  const night = (window.FZDN && window.FZDN.nightF) || 0;
  const rain = (window.FZDN && window.FZDN.rain) || 0;
  try {
    const hp = (localPlayer && typeof localPlayer.health === 'number') ? localPlayer.health : 100;
    if (hp < lastHealth - 3) { FZFX.damage(); damagePulse = 1; }
    lastHealth = hp;
    const lowHp = hp < 35 ? (1 - hp / 35) : 0;
    if (screenEls) {
      if (screenEls.vig) screenEls.vig.style.opacity = String(Math.min(0.85, night * 0.5));
      damagePulse *= Math.pow(0.06, dt);
      if (screenEls.dmg) screenEls.dmg.style.opacity = (damagePulse * 0.9).toFixed(3);
      if (screenEls.low) screenEls.low.style.opacity = (lowHp * (0.55 + 0.25 * Math.sin(t * 4.5))).toFixed(3);
      if (screenEls.rain) screenEls.rain.style.opacity = rain > 0.3 ? String(Math.min(0.6, rain * 0.6)) : '0';
      // спидлайны
      const dx = pp.x - lastPP.x, dz = pp.z - lastPP.z;
      const spd = Math.hypot(dx, dz) / Math.max(dt, 0.0001);
      lastPP.x = pp.x; lastPP.z = pp.z;
      sprintSpeed += (spd - sprintSpeed) * Math.min(1, dt * 4);
      let sl = speedLinesManual;
      if (sprintSpeed > 9.5) sl = Math.max(sl, Math.min(1, (sprintSpeed - 9.5) / 8));
      if (screenEls.lines) {
        screenEls.lines.style.opacity = String(Math.max(0, Math.min(0.5, sl * 0.5)));
        screenEls.lines.style.transform = 'rotate(' + ((t * 40) % 360).toFixed(1) + 'deg)';
      }
    }
  } catch (e) {}
  // FPS + авто-адаптация
  fpsAcc += dt; frames++;
  if (fpsAcc >= 0.5) {
    fps = frames / fpsAcc; frames = 0; fpsAcc = 0;
    adaptT += 0.5;
    if (P.auto && adaptT > 1.5) {
      adaptT = 0;
      if (fps < 26) {
        if (P.renderScale > 0.66) { P.renderScale = Math.max(0.62, P.renderScale - 0.12); saveP(); allocTargets(); hintMsg('⚙️ Авто-настройка: разрешение ' + Math.round(P.renderScale * 100) + '% (FPS ' + Math.round(fps) + ')', 2600); }
        else if (ti() > 1) {
          FZFX.setTier(TIERS[ti() - 1], true);
          hintMsg('⚙️ Графика снижена до ' + P.tier.toUpperCase() + ' — не хватает FPS. Можно поднять в ⚙️', 3200);
        }
      } else if (fps > 52 && P.renderScale < 0.999) {
        P.renderScale = Math.min(1, P.renderScale + 0.08); saveP(); allocTargets();
      }
    }
    if (P.fpsShow) {
      const d = document.getElementById('fz8Dbg');
      if (d) {
        let calls = '-', tris = '-';
        try { calls = renderer.info.render.calls; tris = renderer.info.render.triangles; } catch (e) {}
        let mem = '-';
        try { mem = Math.round(renderer.info.memory.geometries) + '/' + Math.round(renderer.info.memory.textures); } catch (e) {}
        d.style.display = 'block';
        d.textContent = 'FPS ' + Math.round(fps) + '  (' + Math.round(1000 / Math.max(fps, 1)) + ' мс)\n'
          + 'Тир ' + P.tier + ' · scale ' + Math.round(P.renderScale * 100) + '%\n'
          + 'Вызовов ' + calls + ' · трис ' + tris + '\n'
          + 'Геом/текст ' + mem + '\n'
          + 'Игрок x' + pp.x.toFixed(0) + ' z' + pp.z.toFixed(0) + ' · ночь ' + Math.round(night * 100) + '%\n'
          + 'Снег ' + ((window.FZ8F && window.FZ8F.snow) ? 'да' : 'нет') + ' · дождь ' + Math.round(rain * 100) + '%';
      }
    }
  }
}
// ---------------- ХОТКЕИ ----------------
try {
  window.addEventListener('keydown', function (e) {
    if (e.key === 'F3') { e.preventDefault(); FZFX.debug(); }
    else if (e.key === 'F4') { e.preventDefault(); gfxPanel(); }
  });
} catch (e) {}
// ---------------- РЕСАЙЗ ----------------
try {
  window.addEventListener('resize', function () { try { if (rtScene) allocTargets(); } catch (e) {} });
} catch (e) {}
window.FZ8GFX_update = FZ8GFX_update;
window.FZ8GFX = { tier: () => P.tier, panel: gfxPanel, rebuild: rebuildWindows };
})();
