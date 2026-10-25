// FANTAZIA RP — v8.6 «Морской район»
// An isolated coastal extension. Native movement, collisions and ground heights
// are shared with the game; no replacement of the existing city or its interiors.
(function () {
  'use strict';
  const ORIGIN = { x: 6000, z: 0 },
    KEY = 'fz8sea_v1',
    DECK = 3.2;
  const PORTS = [
    { name: 'Морской вокзал', x: -35, z: 32, exit: { x: -48, z: 32, y: 2.8 } },
    { name: 'Остров Сосновый', x: 48, z: 32, exit: { x: 59, z: 32, y: 2.8 } },
  ];
  const ROUTE = [
    { x: -35, z: 32 },
    { x: -22, z: 78 },
    { x: 27, z: 78 },
    { x: 48, z: 32 },
  ];
  const STATS = { voyages: 0, fish: 0, beacon: false, cargo: [] };
  let world = null,
    ownerScene = null,
    ferry = null,
    ride = null,
    returnTo = null,
    activity = null;
  let time = 0,
    wasHere = false,
    oldAtmosphere = null,
    modal = null,
    hud = null,
    previousFocus = null,
    saveBlocked = false;
  const materials = new Map(),
    geometries = new Map(),
    statics = [],
    surfaces = [],
    colliders = [],
    spots = [],
    animated = [];
  const vesselSpecs = {
    ferry: { x: -35, z: 32, y: DECK, w: 12, d: 26, title: 'Паром «Бриз»', obstacles: [] },
    cargo: { x: -32, z: -118, y: 4.8, w: 20, d: 58, title: 'Сухогруз «Север»', obstacles: [] },
    yacht: { x: 125, z: -126, y: 2.7, w: 10, d: 28, title: 'Яхта «Аврора»', obstacles: [] },
  };
  const $ = (id) => document.getElementById(id);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const lerp = (a, b, t) => a + (b - a) * t;
  function ready() {
    return (
      typeof scene !== 'undefined' &&
      scene &&
      typeof localPlayer !== 'undefined' &&
      localPlayer &&
      localPlayer.mesh
    );
  }
  function indoors() {
    return (
      (typeof isInsideBuilding !== 'undefined' && isInsideBuilding) ||
      (typeof isInFactory !== 'undefined' && isInFactory) ||
      (typeof isInBasement !== 'undefined' && isInBasement)
    );
  }
  function say(s) {
    if (typeof showNotification === 'function') showNotification(s, 'info');
  }
  function position() {
    const p = localPlayer.mesh.position;
    return { x: p.x - ORIGIN.x, z: p.z - ORIGIN.z, y: p.y };
  }
  function inArea() {
    if (!ready() || indoors()) return false;
    const p = position();
    return Math.abs(p.x) < 330 && Math.abs(p.z) < 250;
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(STATS));
      saveBlocked = false;
    } catch (_) {
      saveBlocked = true;
    }
  }
  function load() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || '{}');
      for (const k of ['voyages', 'fish'])
        if (Number.isSafeInteger(v[k]) && v[k] >= 0) STATS[k] = Math.min(1e6, v[k]);
      STATS.beacon = v.beacon === true;
      if (Array.isArray(v.cargo)) STATS.cargo = [...new Set(v.cargo.filter((n) => [1, 2, 3].includes(n)))];
    } catch (_) {}
  }
  function mat(color, extra) {
    const key = color + JSON.stringify(extra || {});
    if (!materials.has(key)) {
      const m = new THREE.MeshStandardMaterial(
        Object.assign({ color, roughness: 0.76, metalness: 0.05 }, extra),
      );
      m.color.convertSRGBToLinear();
      materials.set(key, m);
    }
    return materials.get(key);
  }
  function geo(key, make) {
    if (!geometries.has(key)) geometries.set(key, make());
    return geometries.get(key);
  }
  function mesh(g, geometry, material, x, y, z) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  }
  function box(g, w, h, d, color, x, y, z, extra) {
    const m = mesh(
      g,
      geo('box', () => new THREE.BoxGeometry(1, 1, 1)),
      mat(color, extra),
      x,
      y,
      z,
    );
    m.scale.set(w, h, d);
    return m;
  }
  function cyl(g, r, h, color, x, y, z, segments = 12) {
    const m = mesh(
      g,
      geo('cyl' + segments, () => new THREE.CylinderGeometry(0.5, 0.5, 1, segments)),
      mat(color),
      x,
      y,
      z,
    );
    m.scale.set(r * 2, h, r * 2);
    return m;
  }
  function ball(g, r, color, x, y, z) {
    const m = mesh(
      g,
      geo('sphere', () => new THREE.SphereGeometry(1, 10, 6)),
      mat(color),
      x,
      y,
      z,
    );
    m.scale.setScalar(r);
    return m;
  }
  function beam(g, a, b, r, color) {
    const from = new THREE.Vector3(...a),
      to = new THREE.Vector3(...b),
      d = to.clone().sub(from);
    const m = cyl(g, r, d.length(), color, ...from.clone().add(to).multiplyScalar(0.5).toArray(), 6);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return m;
  }
  function ring(g, r, color, x, y, z, rx = 0) {
    const m = mesh(
      g,
      geo('ring', () => new THREE.TorusGeometry(1, 0.16, 6, 20)),
      mat(color),
      x,
      y,
      z,
    );
    m.scale.setScalar(r);
    m.rotation.x = rx;
    return m;
  }
  function label(g, text, x, y, z, w = 6, ry = 0, bg = '#173e50') {
    const cv = document.createElement('canvas');
    cv.width = 768;
    cv.height = 160;
    const c = cv.getContext('2d');
    if (!c) return;
    c.fillStyle = bg;
    c.fillRect(0, 0, 768, 160);
    c.fillStyle = '#efb36b';
    c.fillRect(0, 0, 12, 160);
    c.fillStyle = '#fff5df';
    c.font = 'bold 38px Arial';
    c.textAlign = 'center';
    c.fillText(text, 390, 95, 715);
    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    const m = mesh(
      g,
      geo('plane', () => new THREE.PlaneGeometry(1, 1)),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }),
      x,
      y,
      z,
    );
    m.scale.set(w, (w * 160) / 768, 1);
    m.rotation.y = ry;
    return m;
  }
  function surface(id, x0, x1, z0, z1, height) {
    surfaces.push({ id, x0, x1, z0, z1, height });
  }
  function solid(x, z, w, d, extra) {
    colliders.push(Object.assign({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 }, extra));
  }
  function floorAt(x, z) {
    let y = null;
    for (const s of surfaces)
      if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) {
        const h = typeof s.height === 'function' ? s.height(x, z) : s.height;
        y = y === null ? h : Math.max(h, y);
      }
    return y;
  }
  function spot(id, name, x, y, z, action, extra) {
    const s = Object.assign(
      {
        id,
        name,
        type: 'fz8sea',
        fz8sea: true,
        range: 3.4,
        action,
        position: { x: ORIGIN.x + x, y, z: ORIGIN.z + z },
      },
      extra,
    );
    spots.push(s);
    interactables.push(s);
    return s;
  }
  function local(v, x, z) {
    const dx = x - v.x,
      dz = z - v.z,
      c = Math.cos(v.angle || 0),
      s = Math.sin(v.angle || 0);
    return { x: dx * c - dz * s, z: dx * s + dz * c };
  }
  function global(v, x, z) {
    const c = Math.cos(v.angle || 0),
      s = Math.sin(v.angle || 0);
    return { x: v.x + x * c + z * s, z: v.z - x * s + z * c };
  }
  function ridingVessel() {
    return ride ? vesselSpecs[ride.kind] : null;
  }
  function boundsHit(x, z, c, r = 0.5) {
    return x + r > c.x0 && x - r < c.x1 && z + r > c.z0 && z - r < c.z1;
  }
  function deckBlocked(v, x, z) {
    return (
      [
        [-0.55, -0.55],
        [0.55, -0.55],
        [-0.55, 0.55],
        [0.55, 0.55],
      ].some(([dx, dz]) => !inHull(v, x + dx, z + dz)) || v.obstacles.some((c) => boundsHit(x, z, c))
    );
  }
  function collision(x, z) {
    if (!world || indoors() || !inArea()) return null;
    x -= ORIGIN.x;
    z -= ORIGIN.z;
    const v = ridingVessel();
    if (v) {
      const p = local(v, x, z);
      return deckBlocked(v, p.x, p.z);
    }
    if (colliders.some((c) => boundsHit(x, z, c))) return true;
    // Sampling the complete player footprint prevents walking over pier edges.
    for (const [dx, dz] of [
      [-0.5, -0.5],
      [0.5, -0.5],
      [-0.5, 0.5],
      [0.5, 0.5],
      [0, 0],
    ])
      if (floorAt(x + dx, z + dz) === null) return true;
    return false;
  }
  function ground() {
    if (!world || !inArea()) return null;
    if (ride) return ridingVessel().y;
    const p = position();
    return floorAt(p.x, p.z);
  }
  function put(x, y, z) {
    localPlayer.mesh.position.set(ORIGIN.x + x, y, ORIGIN.z + z);
    if (typeof velocity !== 'undefined' && velocity) {
      velocity.x = velocity.y = velocity.z = 0;
    }
    if (typeof sittingOn !== 'undefined' && sittingOn && typeof standUpFromSeat === 'function')
      standUpFromSeat();
  }
  function rail(g, points, color = 0xe2e5d8) {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i],
        b = points[i + 1],
        length = Math.hypot(b[0] - a[0], b[2] - a[2]),
        n = Math.ceil(length / 3);
      for (let j = 0; j <= n; j++) {
        if (i > 0 && j === 0) continue;
        const t = j / n,
          x = lerp(a[0], b[0], t),
          y = lerp(a[1], b[1], t),
          z = lerp(a[2], b[2], t);
        cyl(g, 0.065, 1.15, color, x, y + 0.575, z, 6);
      }
      for (const h of [0.5, 1.15]) beam(g, [a[0], a[1] + h, a[2]], [b[0], b[1] + h, b[2]], 0.055, color);
    }
  }
  function bollard(g, x, y, z) {
    cyl(g, 0.22, 0.55, 0x254452, x, y + 0.275, z);
    box(g, 0.7, 0.12, 0.2, 0x254452, x, y + 0.5, z);
    ring(g, 0.35, 0xc2a47c, x, y + 0.06, z, Math.PI / 2);
  }
  function bench(g, x, y, z, ry = 0) {
    const p = new THREE.Group();
    p.position.set(x, y, z);
    p.rotation.y = ry;
    g.add(p);
    for (let i = 0; i < 4; i++) box(p, 2.5, 0.08, 0.13, 0xb5804d, 0, 0.48, -0.25 + i * 0.17);
    for (let i = 0; i < 3; i++) box(p, 2.5, 0.13, 0.08, 0xb5804d, 0, 0.75 + i * 0.17, -0.3);
    for (const dx of [-0.95, 0.95]) {
      box(p, 0.12, 0.48, 0.55, 0x2b4a54, dx, 0.24, 0);
      box(p, 0.1, 0.8, 0.1, 0x2b4a54, dx, 0.8, -0.3);
    }
  }
  function lamp(g, x, y, z) {
    cyl(g, 0.1, 5.2, 0x304f59, x, y + 2.6, z, 8);
    box(g, 0.9, 0.15, 0.9, 0x304f59, x, y + 5.25, z);
    box(g, 0.65, 0.18, 0.65, 0xf1d59f, x, y + 5.15, z, { emissive: 0xf1c581, emissiveIntensity: 0.55 });
  }
  function tree(g, x, y, z) {
    cyl(g, 0.27, 3.2, 0x7d624b, x, y + 1.6, z, 7);
    for (let i = 0; i < 3; i++) {
      const m = mesh(
        g,
        geo('cone', () => new THREE.ConeGeometry(1, 1, 9)),
        mat(i % 2 ? 0x53745a : 0x3e6653),
        x,
        y + 3 + i * 1.3,
        z,
      );
      m.scale.set(2.4 - i * 0.45, 3.3, 2.4 - i * 0.45);
    }
  }
  function container(g, x, y, z, color, number) {
    box(g, 5, 3.1, 10, color, x, y + 1.55, z);
    for (let i = 0; i < 12; i++) box(g, 5.06, 2.95, 0.07, color, x, y + 1.55, z - 4.7 + i * 0.85);
    box(g, 0.08, 2.95, 0.12, 0xc9d4d1, x, y + 1.55, z + 5.05);
    label(g, number, x, y + 1.8, z + 5.12, 3.7);
  }
  function batch(root) {
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(),
      groups = new Map();
    root.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh) return;
      for (let p = o; p && p !== root; p = p.parent) if (p.userData.moving) return;
      const key = o.geometry.uuid + o.material.uuid;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(o);
    });
    let count = 0;
    groups.forEach((list) => {
      if (list.length < 2) return;
      const inst = new THREE.InstancedMesh(list[0].geometry, list[0].material, list.length);
      list.forEach((m, i) => {
        inst.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
        m.parent.remove(m);
      });
      inst.instanceMatrix.needsUpdate = true;
      inst.frustumCulled = false;
      root.add(inst);
      count += list.length;
    });
    return count;
  }

  function ocean(g) {
    const geometry = geo('sea', () => new THREE.PlaneGeometry(1600, 1400, 160, 140).rotateX(-Math.PI / 2));
    const material = new THREE.ShaderMaterial({
      fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
      vertexShader: `uniform float uTime; varying vec3 vWorld; varying vec3 vNormal; varying vec2 vSea;
      #include <fog_pars_vertex>
      void main(){vec3 p=position;float a=p.x*.09+p.z*.055+uTime*.9;float b=p.z*.17-p.x*.037+uTime*1.3;
        p.y=.06+sin(a)*.17+sin(b)*.07;vNormal=normalize(vec3(-cos(a)*.0153+cos(b)*.00259,1.,-cos(a)*.00935-cos(b)*.0119));
        vSea=p.xz;vec4 wp=modelMatrix*vec4(p,1.);vWorld=wp.xyz;vec4 mvPosition=viewMatrix*wp;gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
      fragmentShader: `uniform float uTime; varying vec3 vWorld; varying vec3 vNormal; varying vec2 vSea;
      #include <fog_pars_fragment>
      float shore(vec2 p,vec2 c,vec2 h){vec2 q=abs(p-c)-h;return length(max(q,0.))+min(max(q.x,q.y),0.);}
      void main(){vec3 n=normalize(vNormal);vec3 viewDir=normalize(cameraPosition-vWorld);float fres=pow(1.-max(0.,dot(viewDir,n)),3.);
        float dist=min(shore(vSea,vec2(-145.,0.),vec2(75.,160.)),min(shore(vSea,vec2(105.,0.),vec2(40.,65.)),shore(vSea,vec2(120.,145.),vec2(25.,25.))));
        vec3 deep=vec3(.012,.12,.22),shall=vec3(.025,.32,.34);vec3 color=mix(shall,deep,smoothstep(0.,28.,dist));
        float ripple=sin(vSea.x*.8+sin(vSea.y*.9)+uTime)*sin(vSea.y*.73-uTime*.5);color+=ripple*.016;
        float foam=(1.-smoothstep(.2,2.,dist))*smoothstep(.4,.8,sin(dist*5.-uTime*1.5+sin(vSea.x*.3)));
        color=mix(color,vec3(.84,.92,.83),foam*.7);color=mix(color,vec3(.15,.42,.5),fres*.65);
        float sun=pow(max(0.,dot(reflect(-normalize(vec3(-.5,1.,.4)),n),viewDir)),140.);color+=vec3(1.,.85,.6)*sun*.65;
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
        #include <fog_fragment>
      }`,
    });
    const water = mesh(g, geometry, material, 0, 0, 0);
    water.userData.moving = true;
    animated.push({ kind: 'water', mesh: water });
  }
  function land(g) {
    for (const [id, x0, x1, z0, z1, color] of [
      ['coast', -220, -70, -160, 160, 0xc4b487],
      ['island', 65, 145, -65, 65, 0xd8c395],
      ['lighthouse', 95, 145, 120, 170, 0xcbb78b],
    ]) {
      box(g, x1 - x0, 3, z1 - z0, color, (x0 + x1) / 2, 0.5, (z0 + z1) / 2);
      surface(id, x0, x1, z0, z1, 2);
    }
    box(g, 92, 0.05, 275, 0x71836c, -170, 2.025, 0);
    box(g, 48, 0.05, 100, 0x89926b, 110, 2.025, 0);
    // Coastal avenue, promenade and tile joints.
    box(g, 17, 0.09, 304, 0x5c6c70, -120, 2.05, 0);
    box(g, 24, 0.07, 302, 0xb6beb1, -88, 2.04, 0);
    for (let z = -147; z < 150; z += 8) {
      box(g, 0.15, 0.012, 3, 0xe5d7ab, -120, 2.103, z);
      box(g, 23, 0.009, 0.04, 0x939f96, -88, 2.081, z);
    }
    for (let z = -144; z <= 145; z += 24) {
      lamp(g, -101, 2, z);
      if (z > 55 || z < -65) {
        bench(g, -96, 2, z, Math.PI / 2);
        solid(-96, z, 0.8, 2.8);
      }
    }
    // Port terminal, striped canopy, information boards and ticket counter.
    box(g, 22, 0.2, 18, 0xd9d8c4, -87, 1.9, 33);
    for (const x of [-96, -78]) for (const z of [25, 41]) cyl(g, 0.17, 5.5, 0x305563, x, 4.9, z, 8);
    box(g, 24, 0.32, 19, 0xe5d7b8, -87, 7.8, 33);
    for (let x = -98; x < -75; x += 2) box(g, 1, 0.025, 19, 0xd4885b, x, 7.98, 33);
    label(g, 'МОРСКОЙ ВОКЗАЛ', -87, 6.8, 23.4, 15, Math.PI);
    label(g, 'ПАРОМ → ОСТРОВ', -76.8, 4.7, 33, 8, Math.PI / 2);
    box(g, 5, 1.2, 1.1, 0x315c68, -94, 2.6, 31);
    solid(-94, 31, 5, 1.2);
    label(g, 'БРИЗ • ПРОЕЗД БЕСПЛАТНЫЙ', -94, 3.8, 31.7, 5);
    for (const z of [28, 38]) bench(g, -84, 2, z);
    // Two docks and a cargo loading pier. Heights differ only at marked boarding points.
    for (const [id, x0, x1, z0, z1, h] of [
      ['westPier', -76, -41, 28, 36, 2.8],
      ['eastPier', 53, 68, 28, 36, 2.8],
      ['cargoPier', -76, -44, -122, -114, 2.8],
      ['yachtPier', 121, 129, -110, -62, 2],
    ]) {
      box(g, x1 - x0, 0.45, z1 - z0, 0x9a7957, (x0 + x1) / 2, h - 0.225, (z0 + z1) / 2);
      surface(id, x0, x1, z0, z1, h);
      for (let x = x0 + 1; x < x1; x += 6)
        for (const z of [z0 + 1, z1 - 1]) {
          cyl(g, 0.28, h + 1, 0x5e6658, x, (h - 1) / 2, z, 8);
          bollard(g, x, h, z);
        }
      if (id === 'yachtPier')
        for (let z = z0 + 1; z < z1; z += 6) box(g, 7.8, 0.02, 0.1, 0x685642, 125, h + 0.013, z);
      else
        for (let x = x0 + 0.3; x < x1; x += 1)
          box(g, 0.04, 0.02, z1 - z0 - 0.2, 0x685642, x, h + 0.013, (z0 + z1) / 2);
    }
    // Short, walkable ramps up to the taller wooden piers.
    for (const z of [32, -118]) {
      surface('pierRamp', -82, -76, z - 4, z + 4, (x) => lerp(2, 2.8, clamp((x + 82) / 6, 0, 1)));
      const b = box(g, 6.06, 0.18, 8, 0x9a7957, -79, 2.31, z);
      b.rotation.z = Math.atan2(0.8, 6);
    }
    surface('islandRamp', 68, 76, 28, 36, (x) => lerp(2.8, 2, clamp((x - 68) / 8, 0, 1)));
    const ramp = box(g, 8.04, 0.18, 8, 0x9a7957, 72, 2.31, 32);
    ramp.rotation.z = -Math.atan2(0.8, 8);
    // Beach: loungers, parasols, changing cabins, lifebuoy station.
    for (const z of [82, 100, 118, 136])
      for (const x of [-86, -77]) {
        box(g, 1.5, 0.18, 3, 0xf0dfb5, x, 2.35, z);
        const back = box(g, 1.5, 0.18, 1.1, 0xe7b877, x, 2.7, z - 1);
        back.rotation.x = -0.5;
        cyl(g, 0.06, 3.3, 0xbca984, x + 2.5, 3.65, z);
        const canopy = mesh(
          g,
          geo('umbrella', () => new THREE.ConeGeometry(2.5, 0.7, 12)),
          mat(z % 4 ? 0xd98259 : 0xe4bd74),
          x + 2.5,
          5.3,
          z,
        );
        canopy.rotation.y = 0.2;
        solid(x, z, 1.8, 3.2);
        solid(x + 2.5, z, 0.3, 0.3);
      }
    for (let i = 0; i < 3; i++) {
      box(g, 2.6, 3.2, 2.6, [0x538f9d, 0xc59665, 0x8fada4][i], -106, 3.6, 91 + i * 5);
      box(g, 1.5, 2.4, 0.06, 0xf2e5c8, -106, 3.3, 92.34 + i * 5);
      solid(-106, 91 + i * 5, 2.6, 2.6);
    }
    ring(g, 0.65, 0xdc7c43, -73, 3.8, 70);
    box(g, 0.16, 2, 0.16, 0xe9ddc0, -73, 3, 70);
    for (let i = 0; i < 25; i++) {
      const x = -207 + (i % 4) * 21,
        z = -145 + Math.floor(i / 4) * 45;
      tree(g, x, 2, z);
      solid(x, z, 1, 1);
    }
    for (const [x, z] of [
      [78, -35],
      [134, -43],
      [82, 44],
      [137, 48],
      [110, 148],
    ]) {
      tree(g, x, 2, z);
      solid(x, z, 1, 1);
    }
    // Island pavilion: shade, table, mugs, telescope and a readable arrival sign.
    for (const x of [93, 117]) for (const z of [-10, 10]) cyl(g, 0.15, 3.5, 0x537373, x, 3.75, z);
    box(g, 26, 0.25, 23, 0xb7a27b, 105, 5.6, 0);
    box(g, 3, 0.1, 2, 0xad8158, 105, 2.8, 0);
    solid(105, 0, 3, 2);
    for (const x of [103.7, 106.3])
      for (const z of [-0.8, 0.8]) box(g, 0.12, 0.75, 0.12, 0x7f694f, x, 2.375, z);
    for (const x of [104.5, 105.5]) {
      cyl(g, 0.12, 0.2, 0xf5e8c6, x, 2.96, 0);
      ring(g, 0.07, 0xf5e8c6, x + 0.13, 2.98, 0);
    }
    bench(g, 105, 2, 3);
    bench(g, 105, 2, -3, Math.PI);
    label(g, 'СОСНОВЫЙ • ПЛЯЖ И МАЯК', 92, 4.1, 27, 13);
    beam(g, [140, 2, 12], [140, 3.4, 12], 0.08, 0x334d59);
    const scope = cyl(g, 0.18, 1.2, 0x4f7282, 140, 3.5, 12);
    scope.rotation.x = 1.1;
  }
  function mainHeight(x) {
    return 2 + 4 * Math.min(clamp((x + 70) / 25, 0, 1), clamp((65 - x) / 25, 0, 1));
  }
  function footHeight(z) {
    return 2 + 2 * Math.sin(clamp((z - 65) / 55, 0, 1) * Math.PI);
  }
  function bridges(g) {
    surface('mainBridge', -72, 67, -55, -43, (x) => mainHeight(x));
    for (let x = -72; x < 67; x += 1) {
      const a = mainHeight(x),
        b = mainHeight(x + 1);
      const m = box(g, Math.hypot(1, b - a), 0.3, 12, 0x697c80, x + 0.5, (a + b) / 2 - 0.15, -49);
      m.rotation.z = Math.atan2(b - a, 1);
      if (x % 6 === 0) box(g, 2, 0.015, 0.18, 0xf5d9a3, x, mainHeight(x) + 0.02, -49);
    }
    const north = [],
      south = [];
    for (let x = -72; x <= 67; x += 1) {
      north.push([x, mainHeight(x), -55]);
      south.push([x, mainHeight(x), -43]);
    }
    rail(g, north);
    rail(g, south);
    for (const x of [-45, 40]) {
      for (const z of [-55.8, -42.2]) {
        box(g, 1.5, 26, 1.5, 0xdbe0cf, x, 13, z);
        box(g, 2.4, 1, 2.4, 0x9aa9a0, x, 1, z);
      }
      beam(g, [x, 24, -56], [x, 24, -42], 0.4, 0xdbe0cf);
    }
    for (const z of [-55.8, -42.2]) {
      let previous = null;
      for (let i = 0; i <= 20; i++) {
        const x = -45 + i * 4.25,
          y = 12 + 52 * Math.pow(i / 20 - 0.5, 2);
        const p = [x, y, z];
        if (previous) beam(g, previous, p, 0.12, 0xe5d5b3);
        beam(g, [x, mainHeight(x) + 0.2, z], p, 0.045, 0xe5d5b3);
        previous = p;
      }
    }
    label(g, 'ПРИМОРСКИЙ МОСТ', -65, 4.7, -41, 12);
    for (const x of [-58, 55]) lamp(g, x, mainHeight(x), -44);
    // Second bridge is a narrower arched wooden footbridge to the lighthouse.
    surface('footbridge', 110, 122, 63, 122, (x, z) => footHeight(z));
    const a = [],
      b = [];
    for (let z = 63; z <= 122; z++) {
      const y = footHeight(z),
        next = footHeight(z + 1),
        m = box(g, 12, 0.22, Math.hypot(1, next - y), 0x9f815b, 116, (y + next) / 2 - 0.11, z + 0.5);
      m.rotation.x = -Math.atan2(next - y, 1);
      a.push([110, y, z]);
      b.push([122, y, z]);
    }
    rail(g, a, 0xbeb9a0);
    rail(g, b, 0xbeb9a0);
    for (const z of [75, 90, 105])
      for (const x of [111, 121]) cyl(g, 0.3, footHeight(z) + 1, 0x64705f, x, (footHeight(z) - 1) / 2, z, 8);
    label(g, 'ТРОПА К МАЯКУ', 116, 4, 64, 10, Math.PI);
  }
  function portDetails(g) {
    for (let i = 0; i < 8; i++) {
      const x = -172 + (i % 4) * 12,
        z = -115 + Math.floor(i / 4) * 14;
      container(g, x, 2, z, [0x497f90, 0xb88352, 0x567c69, 0x8b6350][i % 4], 'FZ • ' + (208 + i));
      solid(x, z, 5, 10);
      if (i % 3 === 0) container(g, x, 5.1, z, 0xb78e5e, 'FZ • ' + (308 + i));
    }
    // Gantry crane: portal legs, overhead trolley, cable and suspended hook.
    for (const x of [-102, -78])
      for (const z of [-137, -95]) {
        box(g, 1.2, 20, 1.2, 0xc39c5e, x, 12, z);
        solid(x, z, 1.2, 1.2);
        box(g, 2, 0.7, 4, 0x365965, x, 2.35, z);
      }
    for (const x of [-102, -78]) beam(g, [x, 22, -137], [x, 22, -70], 0.75, 0xc39c5e);
    beam(g, [-102, 23, -114], [-40, 23, -114], 0.7, 0xc39c5e);
    box(g, 3.5, 1.5, 3.5, 0x3c6677, -55, 22, -114);
    beam(g, [-55, 22, -114], [-55, 10, -114], 0.055, 0x3b4848);
    ring(g, 0.65, 0x3b4848, -55, 9.5, -114);
    label(g, 'ПОРТ ФАНТАЗИЯ', -131, 7, -90, 22);
    // Warehouse loading face, lamps and access doors (exterior landmark).
    box(g, 46, 11, 16, 0x506c72, -170, 7.5, -146);
    solid(-170, -146, 46, 16);
    box(g, 48, 0.6, 18, 0xaab6ac, -170, 13.2, -146);
    for (const x of [-184, -170, -156]) {
      box(g, 8, 6, 0.1, 0x374c53, x, 5, -137.9);
      label(g, 'СКЛАД ' + Math.round((x + 198) / 14), x, 9, -137.8, 7);
    }
    for (const z of [-124, -112]) {
      bollard(g, -71, 2, z);
      ring(g, 0.5, 0xe28b50, -70.8, 3.4, z, 0);
    }
    // Lighthouse with rotating lantern and external observation terrace.
    cyl(g, 6, 1, 0xb4b1a0, 120, 2.5, 145, 20);
    cyl(g, 3, 21, 0xe4e5d7, 120, 13.5, 145, 20);
    for (const y of [8, 14, 20]) cyl(g, 3.04, 2, 0xb86b4e, 120, y, 145, 20);
    box(g, 1.3, 2.5, 0.12, 0x3a5b65, 120, 3.3, 141.94);
    solid(120, 145, 7, 7);
    cyl(g, 4.2, 0.35, 0x4c6771, 120, 24.2, 145, 20);
    cyl(g, 2.5, 2.2, 0x9bc6c6, 120, 25.4, 145, 12);
    const roof = mesh(
      g,
      geo('lighthouseRoof', () => new THREE.ConeGeometry(3.2, 1.6, 16)),
      mat(0x526e76),
      120,
      27.2,
      145,
    );
    const lantern = new THREE.Group();
    lantern.position.set(120, 25.4, 145);
    lantern.userData.moving = true;
    g.add(lantern);
    box(lantern, 1.4, 1, 0.4, 0xffdda1, 0, 0, 0, { emissive: 0xffd182, emissiveIntensity: 1 });
    const glow = mesh(
      lantern,
      geo('beam', () => new THREE.ConeGeometry(5, 40, 20, 1, true)),
      new THREE.MeshBasicMaterial({
        color: 0xffe9ad,
        transparent: true,
        opacity: 0.055,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      0,
      0,
      20,
    );
    glow.rotation.x = -Math.PI / 2;
    animated.push({ kind: 'beacon', mesh: lantern });
    label(g, 'МАЯК «СОСНОВЫЙ»', 120, 5, 141.8, 8);
    bench(g, 134, 2, 153, -Math.PI / 2);
    // Buoys and distant sailboats give the horizon some life without collision cost.
    for (let i = 0; i < 12; i++) {
      const buoy = new THREE.Group();
      buoy.position.set(-15 + i * 11, 0, 102);
      buoy.userData.moving = true;
      g.add(buoy);
      cyl(buoy, 0.6, 0.35, i % 2 ? 0xd18a4e : 0x4a8c74, 0, 0.4, 0);
      cyl(buoy, 0.12, 1.3, 0xd1c5a8, 0, 1, 0);
      animated.push({ kind: 'bob', mesh: buoy, phase: i });
    }
  }

  const OUTLINE = [
    [-0.4, -0.5],
    [0.4, -0.5],
    [0.5, -0.38],
    [0.5, 0.32],
    [0.3, 0.46],
    [0, 0.5],
    [-0.3, 0.46],
    [-0.5, 0.32],
    [-0.5, -0.38],
  ];
  function inHull(v, x, z) {
    let inside = false;
    for (let i = 0, j = OUTLINE.length - 1; i < OUTLINE.length; j = i++) {
      const a = OUTLINE[i],
        b = OUTLINE[j],
        ax = a[0] * v.w,
        az = a[1] * v.d,
        bx = b[0] * v.w,
        bz = b[1] * v.d;
      if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
    }
    return inside;
  }
  function hull(g, v, color) {
    const key = 'hull' + v.w + 'x' + v.d;
    const geometry = geo(key, () => {
      const a = [],
        idx = [],
        n = OUTLINE.length;
      for (const y of [-(v.y || 0.75) - 0.65, -0.18])
        for (const [x, z] of OUTLINE) a.push(x * v.w * (y < -1 ? 0.7 : 1), y, z * v.d * (y < -1 ? 0.9 : 1));
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        idx.push(i, j, i + n, j, j + n, i + n);
      }
      for (let i = 1; i < n - 1; i++) idx.push(n, n + i, n + i + 1);
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
      geom.setIndex(idx);
      geom.computeVertexNormals();
      return geom;
    });
    mesh(g, geometry, mat(color, { side: THREE.DoubleSide }), 0, 0, 0);
    const shape = new THREE.Shape();
    OUTLINE.forEach(([x, z], i) => (i ? shape.lineTo(x * v.w, -z * v.d) : shape.moveTo(x * v.w, -z * v.d)));
    shape.closePath();
    const deck = geo('deck' + v.w + 'x' + v.d, () => new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2));
    mesh(g, deck, mat(0xc4ad82, { side: THREE.DoubleSide }), 0, 0, 0);
    const edge = OUTLINE.map(([x, z]) => [x * v.w, 0, z * v.d]);
    edge.push(edge[0]);
    rail(g, edge, 0xd9ded2);
    for (let z = -v.d * 0.35; z < v.d * 0.35; z += 1.1)
      box(g, v.w * 0.9, 0.012, 0.025, 0x9c8769, 0, 0.012, z);
    for (const x of [-v.w * 0.4, v.w * 0.4])
      for (const z of [-v.d * 0.33, v.d * 0.3]) {
        bollard(g, x, 0.02, z);
        ring(g, 0.42, 0xe39952, x, 1, z);
      }
    // Fenders against the hull, portholes and painted waterline.
    for (const side of [-1, 1])
      for (let z = -v.d * 0.3; z < v.d * 0.3; z += 3.3) {
        const tyre = ring(g, 0.42, 0x29414b, side * (v.w / 2 + 0.12), -0.65, z);
        tyre.rotation.y = Math.PI / 2;
        box(g, 0.08, 0.25, 2, 0xf0dba9, side * (v.w / 2 + 0.03), -1.3, z);
      }
  }
  function vSolid(v, x, z, w, d) {
    v.obstacles.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
  }
  function ship(kind) {
    const v = vesselSpecs[kind],
      g = new THREE.Group();
    g.name = 'fz8sea_' + kind;
    g.position.set(v.x, v.y, v.z);
    g.userData.moving = true;
    world.add(g);
    v.group = g;
    v.angle = 0;
    hull(g, v, kind === 'cargo' ? 0x325c6e : kind === 'ferry' ? 0x3b8294 : 0xe2e5d7);
    if (kind === 'ferry') {
      // Walk-through cabin: two side windows, wide aft door, steering station.
      for (const x of [-3.6, 3.6]) {
        box(g, 0.16, 1.1, 9, 0xf1e6cd, x, 0.55, 1.5);
        box(g, 0.08, 1.35, 9, 0x7db0bd, x, 1.8, 1.5, { transparent: true, opacity: 0.42 });
        vSolid(v, x, 1.5, 0.2, 9);
        for (let z = -3; z <= 6; z += 2.25) box(g, 0.14, 2.65, 0.12, 0xf1e6cd, x, 1.325, z);
      }
      box(g, 7.3, 1.1, 0.16, 0xf1e6cd, 0, 0.55, 6);
      box(g, 7.3, 1.4, 0.1, 0x92c1c9, 0, 1.8, 6, { transparent: true, opacity: 0.45 });
      vSolid(v, 0, 6, 7.3, 0.2);
      for (const x of [-2.5, 2.5]) {
        box(g, 2.2, 2.7, 0.14, 0xece2c9, x, 1.35, -3);
        vSolid(v, x, -3, 2.2, 0.18);
      }
      box(g, 7.8, 0.18, 9.8, 0xeee4ce, 0, 2.8, 1.5);
      box(g, 1.8, 1.4, 1.8, 0xd39b5c, 0, 3.55, 1.5);
      cyl(g, 0.13, 4, 0xd1d8ca, 0, 4.2, 4);
      label(g, 'БРИЗ • FZ 086', 0, 2.5, -3.12, 5, Math.PI);
      for (const x of [-2.7, 2.7])
        for (const z of [-0.5, 2]) {
          bench(g, x, 0, z, x < 0 ? Math.PI / 2 : -Math.PI / 2);
          vSolid(v, x, z, 0.8, 2.5);
        }
      box(g, 2.5, 0.95, 0.8, 0x335563, 0, 0.475, 4.8);
      vSolid(v, 0, 4.8, 2.5, 0.9);
      ring(g, 0.4, 0x9c8051, 0, 1.15, 4.3);
      for (let i = 0; i < 3; i++)
        box(g, 0.4, 0.2, 0.04, 0x87c4b7, -0.8 + i * 0.8, 0.8, 4.37, {
          emissive: 0x467f70,
          emissiveIntensity: 0.5,
        });
      for (const x of [-3.7, 3.7]) bench(g, x, 0, -8);
      label(g, 'ОСТОРОЖНО • ШВАРТОВКА', 0, 1, -11.4, 4, Math.PI);
      ferry = {
        state: 'dwell',
        port: 0,
        next: 1,
        wait: 12,
        distance: 0,
        leg: 0,
        progress: 0,
        speed: 5.5,
        route: ROUTE.map((p) => ({ ...p })),
      };
    } else if (kind === 'cargo') {
      for (const x of [-3, 3])
        for (const z of [-9, 3, 15]) {
          container(g, x, 0, z, x < 0 ? 0x567b70 : 0xaf8057, 'FZ-CARGO');
          vSolid(v, x, z, 5, 10);
          if (z === 3) container(g, x, 3.1, z, 0x4e7f92, 'EXPORT');
        }
      box(g, 12, 5, 7, 0xe0deca, 0, 2.5, -22);
      vSolid(v, 0, -22, 12, 7);
      box(g, 10, 2, 5, 0xd0d5c5, 0, 6, -22);
      for (const x of [-4, -2, 0, 2, 4]) box(g, 1.5, 1, 0.08, 0x608e9e, x, 6, -19.46);
      box(g, 3, 4, 3, 0xa1744f, 0, 9, -23);
      cyl(g, 0.16, 8, 0xa9b9b4, 0, 10, -19);
      label(g, 'СЕВЕР • FANTAZIA', 0, 4.3, -18.4, 9);
      for (const [x, z] of [
        [-8, -14],
        [8, 9],
        [8, -12],
      ])
        ring(g, 0.5, 0xdba25c, x, 1, z);
      [
        [-5.6, -9, -Math.PI / 2],
        [5.6, 3, Math.PI / 2],
        [5.6, 15, Math.PI / 2],
      ].forEach(([x, z, ry], i) => label(g, 'ГРУЗ №' + (i + 1), x, 1.8, z, 3.2, ry));
    } else {
      box(g, 5.7, 2.3, 8, 0xf1ead8, 0, 1.15, -1);
      vSolid(v, 0, -1, 5.8, 8);
      box(g, 5.8, 0.9, 5.5, 0x79a7b3, 0, 2.7, -1, { transparent: true, opacity: 0.75 });
      box(g, 6, 0.2, 6, 0xf4e8cf, 0, 3.3, -1);
      for (const x of [-2.4, 2.4]) {
        box(g, 1.4, 0.3, 3, 0xc8b58f, x, 0.3, 7);
        box(g, 1.4, 0.18, 0.8, 0xe9dac0, x, 0.6, 6);
        vSolid(v, x, 7, 1.5, 3.2);
      }
      cyl(g, 0.65, 0.12, 0xb49060, 0, 0.75, -8);
      cyl(g, 0.08, 0.75, 0x70858a, 0, 0.375, -8);
      vSolid(v, 0, -8, 1.3, 1.3);
      for (const x of [-0.3, 0.3]) {
        cyl(g, 0.1, 0.2, 0xdef0e5, x, 0.9, -8);
        cyl(g, 0.075, 0.01, 0x6e4933, x, 1.01, -8);
      }
      bench(g, -2.7, 0, -8, Math.PI / 2);
      bench(g, 2.7, 0, -8, -Math.PI / 2);
      label(g, 'АВРОРА', 0, 2.1, -5.08, 4, Math.PI);
    }
    batch(g);
    return g;
  }
  function smallBoats(g) {
    for (const [x, z, color, phase] of [
      [180, -110, 0xe1d0ac, 0],
      [-12, 175, 0x9cadb0, 2],
      [195, 60, 0xb9c6c3, 4],
    ]) {
      const boat = new THREE.Group();
      boat.position.set(x, 0.7, z);
      boat.userData.moving = true;
      g.add(boat);
      const v = { w: 4, d: 11 };
      hull(boat, v, color);
      cyl(boat, 0.08, 11, 0x8a7a5e, 0, 5.5, 0);
      const sailGeometry = geo('sail', () => {
        const a = new THREE.BufferGeometry();
        a.setAttribute('position', new THREE.Float32BufferAttribute([0, 2, 0, 0, 10, 0, 0, 2, 4.6], 3));
        a.computeVertexNormals();
        return a;
      });
      mesh(boat, sailGeometry, mat(0xf1e6c9, { side: THREE.DoubleSide }), 0, 0, 0);
      animated.push({ kind: 'sail', mesh: boat, phase, baseX: x, baseZ: z });
      batch(boat);
    }
    // Seagulls: fixed-size flock, no per-frame mesh allocation.
    for (let i = 0; i < 9; i++) {
      const bird = new THREE.Group();
      bird.userData.moving = true;
      g.add(bird);
      const left = box(bird, 1.1, 0.06, 0.3, 0xf0eee0, -0.5, 0, 0),
        right = box(bird, 1.1, 0.06, 0.3, 0xf0eee0, 0.5, 0, 0);
      ball(bird, 0.16, 0xe9e9df, 0, 0, 0.08);
      animated.push({ kind: 'bird', mesh: bird, left, right, phase: i * 0.7 });
    }
  }
  function build() {
    if (!ready()) return false;
    if (world && ownerScene === scene) return true;
    if (world) dispose();
    ownerScene = scene;
    world = new THREE.Group();
    world.name = 'fz8sea_coast';
    world.position.set(ORIGIN.x, 0, ORIGIN.z);
    scene.add(world);
    ocean(world);
    land(world);
    bridges(world);
    portDetails(world);
    Object.keys(vesselSpecs).forEach(ship);
    smallBoats(world);
    // Local fill; the game retains control of its own global day/night lighting.
    world.add(new THREE.HemisphereLight(0xc6e3e9, 0x7a8269, 0.7));
    spot('arrival', 'Карта морского района', -91, 2, 12, 'map');
    spot('return', 'Вернуться в город', -110, 2, 12, 'return');
    label(world, 'ГОРОД ←   /   ПРИЧАЛ →', -110, 4.6, 12, 12);
    spot('west', 'Посадка на паром «Бриз»', -47, 2.8, 32, 'board', { kind: 'ferry', port: 0 });
    spot('east', 'Посадка на паром «Бриз»', 59, 2.8, 32, 'board', { kind: 'ferry', port: 1 });
    spot('cargo', 'Подняться на сухогруз', -46, 2.8, -118, 'board', { kind: 'cargo' });
    spot('yacht', 'Подняться на яхту', 125, 2, -107, 'board', { kind: 'yacht' });
    spot('fish', 'Рыбалка с пирса', 125, 2, -88, 'fish');
    beam(world, [127.8, 2.3, -88], [131, 5, -88], 0.035, 0x6c634c);
    beam(world, [131, 5, -88], [132, 0.25, -88], 0.009, 0xd6d8c4);
    const bobber = new THREE.Group();
    bobber.userData.moving = true;
    bobber.position.set(132, 0, -88);
    world.add(bobber);
    ball(bobber, 0.12, 0xe08e49, 0, 0.3, 0);
    animated.push({ kind: 'bob', mesh: bobber, phase: 2 });
    label(world, 'РЫБАЛКА • E', 125, 3.7, -91, 5);
    spot('beacon', 'Осмотреть маяк', 120, 2, 139, 'beacon');
    spot('manifest', 'Грузовой манифест', -128, 2, -92, 'manifest');
    box(world, 2, 1.3, 0.25, 0x335764, -128, 2.7, -93);
    label(world, 'ГРУЗЫ • СЕВЕР', -128, 3.2, -92.83, 4);
    spot('exitShip', 'Сойти на причал', 0, -999, 0, 'exitShip', { shipOnly: true });
    spot('helm', 'Маршрут и расписание', 0, -999, 0, 'map', { shipOnly: true, kind: 'ferry' });
    for (let i = 0; i < 3; i++)
      spot('tag' + i, 'Проверить контейнер №' + (i + 1), 0, -999, 0, 'tag', {
        shipOnly: true,
        kind: 'cargo',
        number: i + 1,
      });
    // Hinged gangways are shown only while the ferry is berthed.
    for (const [i, x, w] of [
      [0, -40.5, 3],
      [1, 53, 2],
    ]) {
      const gang = box(world, w, 0.15, 2.6, 0xc9b88f, x, DECK - 0.1, 32);
      gang.userData.moving = true;
      animated.push({ kind: 'gangway', mesh: gang, port: i });
    }
    const count = batch(world);
    world.userData.instances = count;
    world.visible = false;
    ensureUI();
    updateShipSpots();
    return true;
  }
  function canTravel() {
    return (
      ready() &&
      !indoors() &&
      !window.cine &&
      !window._loadingGate &&
      !window.localCar &&
      !(window.FZ8L && window.FZ8L.drive && window.FZ8L.drive()) &&
      !(window.FZ8M && window.FZ8M.ride && window.FZ8M.ride())
    );
  }
  function enter() {
    if(window.FZSky?.active()){showNotification("Сначала спустись в город через белый свет.","info");return false;}
    if (!canTravel()) {
      say('Выйди из помещения или транспорта и дождись завершения загрузки.');
      return false;
    }
    if (inArea()) {
      close();
      return true;
    }
    if (!build()) return false;
    returnTo = localPlayer.mesh.position.clone();
    oldAtmosphere = {
      fog: scene.fog ? scene.fog.clone() : null,
      background: scene.background,
      cameraFar: typeof camera !== 'undefined' ? camera.far : null,
    };
    close();
    put(-91, 2.02, 12);
    activateAtmosphere();
    world.visible = true;
    wasHere = true;
    say('Морской район: мосты, пляж, причалы и маяк. E — взаимодействовать.');
    return true;
  }
  function leave() {
    if (ride) {
      say('Сначала сойди с корабля у причала.');
      return false;
    }
    if (!inArea()) return false;
    const dest =
      returnTo ||
      (window.NEWCITY && NEWCITY.loaded
        ? { x: NEWCITY.spawnX, y: 0, z: NEWCITY.spawnZ }
        : (typeof SPAWN_POINT !== 'undefined' ? { x: SPAWN_POINT.x, y: 0, z: SPAWN_POINT.z } : { x: 131, y: 0, z: -30 }));
    close();
    activity = null;
    localPlayer.mesh.position.set(dest.x, dest.y, dest.z);
    if (typeof velocity !== 'undefined') velocity.y = 0;
    if (oldAtmosphere) {
      scene.fog = oldAtmosphere.fog;
      scene.background = oldAtmosphere.background;
      if (typeof camera !== 'undefined' && oldAtmosphere.cameraFar !== null) {
        camera.far = oldAtmosphere.cameraFar;
        camera.updateProjectionMatrix();
      }
    }
    wasHere = false;
    world.visible = false;
    hud.hidden = true;
    returnTo = null;
    oldAtmosphere = null;
    say('Ты вернулся в город.');
    return true;
  }
  function activateAtmosphere() {
    scene.fog = new THREE.Fog(0xa8c9ce, 190, 660);
    scene.background = new THREE.Color(0xa8c9ce);
    if (typeof camera !== 'undefined') {
      camera.far = Math.max(camera.far, 900);
      camera.updateProjectionMatrix();
    }
  }
  function board(s) {
    if (!near(s) || ride) return false;
    const v = vesselSpecs[s.kind];
    if (!v) return false;
    if (s.kind === 'ferry' && (ferry.state !== 'dwell' || ferry.port !== s.port || ferry.wait < 1.5)) {
      say('Дождись парома. Посадка закрывается за 1,5 секунды до отправления.');
      return false;
    }
    ride = { kind: s.kind, from: s.port === undefined ? null : s.port, boardSpot: s.id };
    activity = null;
    const start =
      s.kind === 'cargo' ? { x: -7.3, z: -12 } : s.kind === 'yacht' ? { x: 0, z: 9.8 } : { x: 0, z: -8 };
    const p = global(v, start.x, start.z);
    put(p.x, v.y, p.z);
    close();
    updateShipSpots();
    say('На борту: ' + v.title + '. Можно ходить по палубе.');
    return true;
  }
  function disembark() {
    if (!ride) return false;
    if (ride.kind === 'ferry' && ferry.state !== 'dwell') {
      say('Высадка только у причала.');
      return false;
    }
    let dest;
    if (ride.kind === 'ferry') {
      dest = PORTS[ferry.port].exit;
      if (ride.from !== ferry.port) {
        STATS.voyages++;
        save();
      }
    } else {
      const s = spots.find((s) => s.id === ride.boardSpot);
      dest = { x: s.position.x - ORIGIN.x, z: s.position.z - ORIGIN.z, y: s.position.y };
    }
    ride = null;
    put(dest.x, dest.y, dest.z);
    close();
    updateShipSpots();
    say('Ты на причале.');
    return true;
  }
  function ferryStep(dt) {
    const v = vesselSpecs.ferry,
      old = { x: v.x, z: v.z, angle: v.angle },
      rider = ride && ride.kind === 'ferry' ? local(old, position().x, position().z) : null;
    if (ferry.state === 'dwell') {
      ferry.wait = Math.max(0, ferry.wait - dt);
      if (ferry.wait === 0) {
        ferry.state = 'sailing';
        ferry.leg = 0;
        ferry.progress = 0;
        ferry.route = (ferry.port === 0 ? ROUTE : [...ROUTE].reverse()).map((p) => ({ ...p }));
        ferry.next = 1 - ferry.port;
        if (ride && ride.kind === 'ferry')
          say('Паром отправляется. Следующая остановка: ' + PORTS[ferry.next].name);
      }
    } else {
      let remaining = dt * ferry.speed;
      while (remaining > 0 && ferry.state === 'sailing') {
        const a = ferry.route[ferry.leg],
          b = ferry.route[ferry.leg + 1],
          len = Math.hypot(b.x - a.x, b.z - a.z),
          step = Math.min(remaining, len - ferry.progress);
        ferry.progress += step;
        remaining -= step;
        ferry.distance += step;
        const t = ferry.progress / len;
        v.x = lerp(a.x, b.x, t);
        v.z = lerp(a.z, b.z, t);
        let target = Math.atan2(b.x - a.x, b.z - a.z);
        if (ferry.leg === ferry.route.length - 2) target *= 1 - clamp((t - 0.65) / 0.35, 0, 1);
        let diff = ((target - v.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        v.angle += diff * Math.min(1, dt * 3.5);
        if (ferry.progress >= len - 1e-6) {
          ferry.leg++;
          ferry.progress = 0;
          if (ferry.leg === ferry.route.length - 1) {
            ferry.state = 'dwell';
            ferry.port = ferry.next;
            ferry.wait = 12;
            v.x = PORTS[ferry.port].x;
            v.z = PORTS[ferry.port].z;
            v.angle = 0;
            if (ride && ride.kind === 'ferry') say('Причал: ' + PORTS[ferry.port].name + '. Можно выходить.');
          }
        }
      }
    }
    v.group.position.set(v.x, v.y, v.z);
    v.group.rotation.y = v.angle;
    if (rider) {
      const next = global(v, rider.x, rider.z);
      const p = localPlayer.mesh.position;
      p.x = ORIGIN.x + next.x;
      p.z = ORIGIN.z + next.z;
      p.y = Math.max(v.y, p.y);
      localPlayer.mesh.rotation.y += v.angle - old.angle;
    }
  }
  function updateShipSpots() {
    for (const s of spots.filter((s) => s.shipOnly)) {
      s.position.y = -999;
      s.disabled = true;
      if (!ride || (s.kind && s.kind !== ride.kind)) continue;
      const v = ridingVessel();
      let p;
      if (s.action === 'exitShip')
        p =
          ride.kind === 'cargo'
            ? { x: -7.3, z: -12 }
            : ride.kind === 'yacht'
              ? { x: 0, z: 9.8 }
              : { x: 0, z: -8 };
      else if (s.action === 'tag')
        p = [
          { x: -7.3, z: -9 },
          { x: 7.3, z: 3 },
          { x: 7.3, z: 15 },
        ][s.number - 1];
      else p = { x: 0, z: 3.2 };
      const pos = global(v, p.x, p.z);
      s.position = { x: ORIGIN.x + pos.x, y: v.y, z: ORIGIN.z + pos.z };
      s.disabled = false;
    }
  }

  function visibleSpot(s) {
    return !!world && inArea() && !s.disabled && (!s.shipOnly || !!ride) && (!ride || s.shipOnly);
  }
  function near(s) {
    if (!ready() || !spots.includes(s) || !visibleSpot(s)) return false;
    const p = localPlayer.mesh.position;
    return (
      Math.abs(p.y - s.position.y) < 2.2 && Math.hypot(p.x - s.position.x, p.z - s.position.z) <= s.range
    );
  }
  function closest() {
    if (!inArea()) return null;
    const p = localPlayer.mesh.position;
    return (
      spots
        .filter(near)
        .sort(
          (a, b) =>
            Math.hypot(p.x - a.position.x, p.z - a.position.z) -
            Math.hypot(p.x - b.position.x, p.z - b.position.z),
        )[0] || null
    );
  }
  function text(parent, tag, content, cls) {
    const el = document.createElement(tag);
    el.textContent = content;
    if (cls) el.className = cls;
    parent.appendChild(el);
    return el;
  }
  function button(parent, label, fn) {
    const b = text(parent, 'button', label);
    b.type = 'button';
    b.onclick = fn;
    return b;
  }
  function close() {
    if (modal) {
      modal.hidden = true;
      if (previousFocus && previousFocus.isConnected) previousFocus.focus();
      previousFocus = null;
    }
  }
  function open(title) {
    ensureUI();
    if (window.FZ8L && window.FZ8L.close) window.FZ8L.close();
    if (modal.hidden) previousFocus = document.activeElement;
    modal.hidden = false;
    $('fzSeaTitle').textContent = title;
    const body = $('fzSeaBody');
    body.replaceChildren();
    if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
    if (typeof keys !== 'undefined') Object.keys(keys).forEach((k) => (keys[k] = false));
    modal.querySelector('[data-close]').focus();
    return body;
  }
  function eta() {
    if (!ferry) return 'Готов к отправлению';
    if (ferry.state === 'dwell')
      return PORTS[ferry.port].name + ' • отправление через ' + Math.ceil(ferry.wait) + ' с';
    let remaining = 0;
    for (let i = ferry.leg; i < ferry.route.length - 1; i++)
      remaining += Math.hypot(
        ferry.route[i + 1].x - ferry.route[i].x,
        ferry.route[i + 1].z - ferry.route[i].z,
      );
    remaining -= ferry.progress;
    return 'В пути → ' + PORTS[ferry.next].name + ' • ' + Math.ceil(remaining / ferry.speed) + ' с';
  }
  function map() {
    const b = open('Морской район');
    text(b, 'div', 'ПРИМОРСКИЙ • FANTAZIA RP', 'sea-eyebrow');
    const card = text(b, 'div', '', 'sea-map');
    // SVG is a static local schematic, not a remote map or a decorative screenshot.
    card.innerHTML =
      '<svg viewBox="0 0 560 260" role="img" aria-label="Схема: побережье слева, остров справа, мост сверху, маяк внизу, паром между причалами"><rect width="560" height="260" fill="#c0dedb"/><path d="M0 0H170V260H0Z M350 35H475V174H350Z M390 214H465V260H390Z" fill="#eee0b9"/><path d="M165 50H355M421 170V218" stroke="#8b846a" stroke-width="9"/><path d="M190 135Q210 208 300 205T335 135" fill="none" stroke="#277d90" stroke-width="3" stroke-dasharray="7 6"/><g fill="#244c5c" font-family="Arial" font-size="14"><text x="20" y="30">ПОРТ</text><text x="20" y="126">ПРИЧАЛ А</text><text x="366" y="110">СОСНОВЫЙ</text><text x="365" y="145">ПРИЧАЛ Б</text><text x="217" y="34">МОСТ</text><text x="400" y="244">МАЯК</text><text x="20" y="228">ПЛЯЖ</text></g><g fill="#d99053"><circle cx="184" cy="135" r="7"/><circle cx="338" cy="135" r="7"/></g></svg>';
    text(
      b,
      'p',
      'Большой мост ведёт с набережной на Сосновый остров. Деревянный мост — дальше к маяку. Паром «Бриз» ходит между двумя причалами.',
      'sea-muted',
    );
    text(b, 'p', eta(), 'sea-status');
    const list = text(b, 'div', '', 'sea-grid');
    for (const [title, desc] of [
      ['Порт', 'Сухогруз, кран, контейнеры и грузовой манифест'],
      ['Пляж', 'Зонты, шезлонги и прогулочная набережная'],
      ['Остров', 'Яхта, рыбалка, павильон и маяк'],
    ]) {
      const c = text(list, 'section', '');
      text(c, 'h3', title);
      text(c, 'p', desc);
    }
    text(
      b,
      'p',
      'Поездки: ' +
        STATS.voyages +
        ' • Рыба: ' +
        STATS.fish +
        ' • Грузы: ' +
        STATS.cargo.length +
        '/3 • Маяк: ' +
        (STATS.beacon ? 'осмотрен' : 'не осмотрен'),
      'sea-muted',
    );
    if (!inArea()) button(b, 'Отправиться на набережную', enter);
    else if (ride) button(b, 'Сойти на причал', disembark);
    else button(b, 'Вернуться в город', leave);
    button(b, 'Закрыть карту', close);
    text(
      b,
      'small',
      'Посадка — E у причала. На пароме можно ходить; выход только на остановке. В воду заходить нельзя.',
      'sea-muted',
    );
    if (saveBlocked)
      text(b, 'p', 'Браузер запретил сохранение: прогресс доступен только до закрытия страницы.');
  }
  function ensureUI() {
    if (modal) return;
    const st = document.createElement('style');
    st.textContent = `
  #fzSeaModal[hidden],#fzSeaHud[hidden]{display:none!important}#fzSeaModal{position:fixed;inset:0;z-index:12010;display:grid;place-items:center;padding:16px;background:#0a2735bc;font:14px/1.5 Arial;color:#234554}
  #fzSeaModal .sea-card{width:min(680px,100%);max-height:88dvh;overflow:auto;box-sizing:border-box;padding:24px;border-radius:18px;background:#f5f0e3;box-shadow:0 20px 80px #061d4260;border:1px solid #b4c5ba}#fzSeaModal h2{font-size:26px;margin:0 0 12px}#fzSeaModal [data-close]{float:right}
  #fzSeaModal button,#fzSeaHud button{background:#235c6d;color:#fff5df;border:1px solid #608b92;border-radius:8px;padding:10px 13px;min-height:42px;cursor:pointer;font:600 13px Arial;margin:4px 8px 4px 0}#fzSeaModal button:hover,#fzSeaHud button:hover{background:#37788b}#fzSeaModal button:focus-visible,#fzSeaHud button:focus-visible{outline:3px solid #dc9c52;outline-offset:3px}
  .sea-map{border-radius:10px;overflow:hidden;margin:12px 0}.sea-map svg{display:block;width:100%;height:auto}.sea-eyebrow{font-size:11px;letter-spacing:2px;color:#977b4b}.sea-muted{color:#627b7e;display:block}.sea-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.sea-grid section{border-top:2px solid #d8a266}.sea-grid h3{font-size:15px;margin-bottom:4px}.sea-grid p{margin-top:0;font-size:12px}.sea-status{background:#dce8e1;padding:10px;border-radius:7px}
  #fzSeaHud{position:fixed;right:14px;top:110px;width:244px;z-index:185;color:#e9f2e7;background:#173e50e8;border:1px solid #6d99a0;border-radius:12px;padding:12px;font:13px/1.5 Arial;box-sizing:border-box}#fzSeaHud strong,#fzSeaHud small{display:block}#fzSeaHud small{color:#c5dcd5;margin:4px 0}#fzSeaHud button{padding:8px;min-height:38px}#fzSeaHud progress{width:100%;accent-color:#d9a463}body.cine-on #fzSeaHud{display:none}
  @media(max-width:600px){#fzSeaHud{right:5px;top:105px;width:184px;padding:8px;font-size:11px}#fzSeaModal .sea-card{padding:16px}.sea-grid{grid-template-columns:1fr}.sea-grid p{margin-bottom:2px}#fzSeaModal h2{font-size:21px;max-width:220px}}`;
    document.head.appendChild(st);
    modal = document.createElement('div');
    modal.id = 'fzSeaModal';
    modal.hidden = true;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'fzSeaTitle');
    modal.innerHTML =
      '<section class="sea-card"><button data-close>Закрыть</button><h2 id="fzSeaTitle"></h2><div id="fzSeaBody"></div></section>';
    document.body.appendChild(modal);
    modal.querySelector('[data-close]').onclick = close;
    modal.onclick = (e) => {
      if (e.target === modal) close();
    };
    hud = document.createElement('aside');
    hud.id = 'fzSeaHud';
    hud.hidden = true;
    hud.innerHTML =
      '<strong id="fzSeaPlace">Морской район</strong><small id="fzSeaSchedule"></small><small id="fzSeaAction" aria-live="polite"></small><progress id="fzSeaProgress" max="8" value="0" hidden></progress><button id="fzSeaMap">Карта моря</button><button id="fzSeaUse">Действие · E</button>';
    document.body.appendChild(hud);
    $('fzSeaMap').onclick = map;
    $('fzSeaUse').onclick = () => {
      const s = closest();
      if (s) interact(s);
    };
    for (const el of [modal, hud])
      for (const name of ['pointerdown', 'mousedown']) el.addEventListener(name, (e) => e.stopPropagation());
    window.addEventListener(
      'keydown',
      (e) => {
        if (modal.hidden) return;
        e.stopImmediatePropagation();
        if (e.key === 'Escape') {
          e.preventDefault();
          close();
        }
        if (e.key === 'Tab') {
          const list = [...modal.querySelectorAll('button:not(:disabled)')],
            i = list.indexOf(document.activeElement);
          e.preventDefault();
          list[(i + (e.shiftKey ? -1 : 1) + list.length) % list.length].focus();
        }
      },
      true,
    );
    if (window.FZ8_addDock) window.FZ8_addDock({ id: 'sea', icon: '⚓', name: 'Морской район' });
    window.FZ8L_EXT = window.FZ8L_EXT || {};
    window.FZ8L_EXT.sea = () => {
      setTimeout(map, 0);
      return '<p>Открываю карту моря…</p>';
    };
  }
  function interact(s) {
    if (!s || s.type !== 'fz8sea') return false;
    if (!near(s)) return true;
    switch (s.action) {
      case 'map':
        map();
        break;
      case 'return':
        leave();
        break;
      case 'board':
        board(s);
        break;
      case 'exitShip':
        disembark();
        break;
      case 'beacon':
        STATS.beacon = true;
        save();
        say('Маяк «Сосновый». Его вращающийся огонь отмечает вход в бухту. Место записано в журнал.');
        break;
      case 'manifest': {
        const b = open('Грузовой манифест');
        text(
          b,
          'p',
          'На сухогрузе «Север» проверь три контейнера. Проходы — по бортам; посадка у грузового причала.',
        );
        for (let i = 1; i <= 3; i++)
          text(b, 'p', (STATS.cargo.includes(i) ? 'Проверен' : 'Ожидает проверки') + ' • контейнер №' + i);
        if (STATS.cargo.length === 3) text(b, 'h3', 'Все грузы проверены. Спасибо за помощь порту!');
        break;
      }
      case 'tag':
        if (!STATS.cargo.includes(s.number)) {
          STATS.cargo.push(s.number);
          save();
          say('Контейнер №' + s.number + ': пломба цела. Проверено ' + STATS.cargo.length + '/3.');
        } else say('Этот контейнер уже проверен.');
        break;
      case 'fish':
        if (activity) {
          say('Снасть уже в воде.');
          break;
        }
        if (time < (world.userData.fishReady || 0)) {
          say('Дай рыбе немного времени — повторная попытка через 20 секунд.');
          break;
        }
        activity = { spot: s, time: 0 };
        say('Снасть заброшена. Оставайся у пирса 8 секунд.');
        break;
    }
    return true;
  }
  let hudTimer = 0;
  function update(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || !ready()) return;
    dt = Math.min(dt, 0.1);
    time += dt;
    const here = inArea();
    if (!world) {
      return;
    }
    if (!here) {
      world.visible = false;
      hud.hidden = true;
      activity = null;
      if (ride) {
        ride = null;
        updateShipSpots();
      }
      wasHere = false;
      return;
    }
    if (!wasHere) {
      activateAtmosphere();
      wasHere = true;
    }
    world.visible = true;
    hud.hidden = false;
    ferryStep(dt);
    updateShipSpots();
    for (const a of animated) {
      if (a.kind === 'gangway') {
        a.mesh.visible = ferry.state === 'dwell' && ferry.port === a.port;
      } else if (a.kind === 'water') a.mesh.material.uniforms.uTime.value = time;
      else if (a.kind === 'beacon') a.mesh.rotation.y = time * 0.28;
      else if (a.kind === 'bob') {
        a.mesh.position.y = 0.08 + Math.sin(time * 1.2 + a.phase) * 0.12;
        a.mesh.rotation.z = Math.sin(time + a.phase) * 0.06;
      } else if (a.kind === 'sail') {
        a.mesh.position.y = 0.75 + Math.sin(time + a.phase) * 0.12;
        a.mesh.position.x = a.baseX + Math.sin(time * 0.035 + a.phase) * 12;
        a.mesh.rotation.y = 0.2 + Math.sin(time * 0.04 + a.phase) * 0.18;
      } else if (a.kind === 'bird') {
        a.mesh.position.set(
          -60 + Math.cos(time * 0.07 + a.phase) * 76,
          18 + Math.sin(time * 0.4 + a.phase) * 2,
          20 + Math.sin(time * 0.07 + a.phase) * 65,
        );
        a.mesh.rotation.y = -time * 0.07 - a.phase;
        a.left.rotation.z = Math.sin(time * 4 + a.phase) * 0.35;
        a.right.rotation.z = -a.left.rotation.z;
      }
    }
    if (activity) {
      if (!near(activity.spot)) {
        activity = null;
        say('Рыбалка прервана: ты отошёл от снасти.');
      } else {
        activity.time += dt;
        if (activity.time >= 8) {
          STATS.fish++;
          save();
          world.userData.fishReady = time + 20;
          say(
            'Улов: ' +
              ['ставрида', 'кефаль', 'морской окунь'][(STATS.fish - 1) % 3] +
              '. Всего поймано: ' +
              STATS.fish,
          );
          activity = null;
        }
      }
    }
    hudTimer += dt;
    if (hudTimer >= 0.2) {
      hudTimer = 0;
      const s = closest();
      $('fzSeaPlace').textContent = ride ? ridingVessel().title : 'Приморский • морской район';
      $('fzSeaSchedule').textContent = eta();
      $('fzSeaAction').textContent = activity
        ? 'Ждём поклёвку…'
        : s
          ? s.name
          : 'E у предмета • вода непроходима';
      $('fzSeaUse').disabled = !s;
      $('fzSeaProgress').hidden = !activity;
      if (activity) $('fzSeaProgress').value = activity.time;
    }
  }
  function dispose() {
    if (!world) return;
    const geos = new Set(),
      mats = new Set(),
      textures = new Set();
    world.traverse((o) => {
      if (o.isInstancedMesh && o.dispose) o.dispose();
      if (o.geometry) geos.add(o.geometry);
      if (o.material)
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          mats.add(m);
          if (m.map) textures.add(m.map);
        }
    });
    textures.forEach((x) => x.dispose());
    mats.forEach((x) => x.dispose());
    geos.forEach((x) => x.dispose());
    if (world.parent) world.parent.remove(world);
    if (typeof interactables !== 'undefined') interactables = interactables.filter((s) => !s.fz8sea);
    materials.clear();
    geometries.clear();
    for (const a of [surfaces, colliders, spots, animated, statics]) a.length = 0;
    for (const v of Object.values(vesselSpecs)) {
      v.obstacles = [];
      v.group = null;
    }
    vesselSpecs.ferry.x = PORTS[0].x;
    vesselSpecs.ferry.z = PORTS[0].z;
    world = null;
    ownerScene = null;
    ferry = null;
    ride = null;
    activity = null;
    wasHere = false;
    if (hud) hud.hidden = true;
  }
  window.FZ8SEA = {
    enter,
    leave,
    map,
    build,
    update,
    interact,
    visibleSpot,
    ground,
    collision,
    disembark,
    aboard: () => !!ride,
    active: inArea,
    modalOpen: () => !!modal && !modal.hidden,
    info: () => ({
      built: !!world,
      aboard: ride ? ride.kind : null,
      port: ferry ? ferry.port : null,
      state: ferry ? ferry.state : null,
      wait: ferry ? ferry.wait : 0,
      eta: eta(),
      instances: world ? world.userData.instances : 0,
      stats: JSON.parse(JSON.stringify(STATS)),
      surfaceCount: surfaces.length,
    }),
    // Read-only data for maps and regression tests; no teleport/debug-money API.
    locations: () =>
      spots.map((s) => ({
        id: s.id,
        name: s.name,
        x: s.position.x,
        y: s.position.y,
        z: s.position.z,
        disabled: !!s.disabled,
      })),
  };
  load();
  ensureUI();
})();
