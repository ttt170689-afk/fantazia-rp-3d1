/* v18 cloud-plaza materials and scoped lighting. No city replacement or extra RAF.
 * Layer 2 isolates the high-altitude pavilion from the city's camera-centred sky.
 * All textures are small, deterministic, local canvas assets. No network textures.
 */
(function (global) {
  "use strict";
  function quality(mobile, profile, shadows, perf) {
    return {
      bump: !perf && profile !== "battery",
      shadow:
        !mobile &&
        !perf &&
        shadows !== "off" &&
        (profile === "custom" || profile === "quality"),
      map: shadows === "low" ? 512 : 1024,
      clouds: mobile || profile === "battery" ? 16 : 24,
    };
  }
  function create(root, resources) {
    const own = (r) => {
        resources.add(r);
        return r;
      },
      mats = {},
      maps = {},
      layers = new Map();
    let session = null,
      tier = null,
      frames = 0,
      disposed = false;
    function random(seed) {
      return () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      };
    }
    function canvas(w, h) {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      return c;
    }
    function texture(c, repeat = 1, color = true) {
      const t = own(new THREE.CanvasTexture(c));
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat, repeat);
      t.encoding = color ? THREE.sRGBEncoding : THREE.LinearEncoding;
      t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      return t;
    }
    const stone = canvas(512, 512),
      sx = stone.getContext("2d"),
      im = sx.createImageData(512, 512),
      rand = random(1807);
    for (let y = 0; y < 512; y++)
      for (let x = 0; x < 512; x++) {
        const i = (y * 512 + x) * 4,
          tile = (Math.floor(x / 128) * 3 + Math.floor(y / 128) * 7) % 5;
        const seam = x % 128 < 2 || y % 128 < 2,
          noise = (rand() - 0.5) * 12 + Math.sin(x * 0.05 + y * 0.021) * 2;
        const base = seam ? 98 : 158 + tile * 3 + noise;
        im.data[i] = base + 8;
        im.data[i + 1] = base + 5;
        im.data[i + 2] = base - 2;
        im.data[i + 3] = 255;
      }
    sx.putImageData(im, 0, 0);
    maps.stone = texture(stone, 0.25);
    const height = canvas(512, 512),
      hx = height.getContext("2d");
    hx.drawImage(stone, 0, 0);
    maps.height = texture(height, 0.25, false);
    const wood = canvas(512, 128),
      wx = wood.getContext("2d"),
      wi = wx.createImageData(512, 128),
      wr = random(28);
    for (let y = 0; y < 128; y++)
      for (let x = 0; x < 512; x++) {
        const i = (y * 512 + x) * 4,
          g =
            Math.sin(y * 0.8 + Math.sin(x * 0.018) * 2) * 8 +
            Math.sin(y * 2.3 + x * 0.007) * 4 +
            (wr() - 0.5) * 9;
        wi.data[i] = 119 + g;
        wi.data[i + 1] = 78 + g * 0.7;
        wi.data[i + 2] = 43 + g * 0.4;
        wi.data[i + 3] = 255;
      }
    wx.putImageData(wi, 0, 0);
    maps.wood = texture(wood);
    maps.woodHeight = texture(wood, 1, false);
    const brush = canvas(128, 128),
      bx = brush.getContext("2d"),
      br = random(43);
    for (let y = 0; y < 128; y++) {
      const v = 130 + Math.floor(br() * 30);
      bx.fillStyle = `rgb(${v},${v},${v})`;
      bx.fillRect(0, y, 128, 1);
    }
    maps.brush = texture(brush, 1, false);
    const grille = canvas(64, 64),
      gx = grille.getContext("2d");
    gx.fillStyle = "#282f36";
    gx.fillRect(0, 0, 64, 64);
    gx.fillStyle = "#0c1118";
    for (let y = 4; y < 64; y += 8)
      for (let x = 4; x < 64; x += 8) {
        gx.beginPath();
        gx.arc(x + (y % 16 ? 2 : 0), y, 1.5, 0, 7);
        gx.fill();
      }
    maps.grille = texture(grille, 2);
    // A roughness-filtered ambient sky reflection, not real-time reflections of players.
    const faces = [];
    for (let f = 0; f < 6; f++) {
      const c = canvas(64, 64),
        x = c.getContext("2d"),
        g = x.createLinearGradient(0, 0, 0, 64);
      g.addColorStop(0, f === 3 ? "#222637" : "#25366c");
      g.addColorStop(0.5, "#635791");
      g.addColorStop(1, "#161e39");
      x.fillStyle = g;
      x.fillRect(0, 0, 64, 64);
      if (f === 4) {
        x.fillStyle = "#9bdfff";
        x.fillRect(10, 8, 20, 10);
      }
      faces.push(c);
    }
    const environment = own(new THREE.CubeTexture(faces));
    environment.encoding = THREE.sRGBEncoding;
    environment.needsUpdate = true;
    function material(name, options) {
      const m = own(
        new THREE.MeshStandardMaterial({
          ...options,
          envMap: environment,
          envMapIntensity: options.metalness > 0.5 ? 0.85 : 0.2,
        }),
      );
      m.color.convertSRGBToLinear();
      mats[name] = m;
      return m;
    }
    material("stone", {
      color: 0xaeb9d0,
      map: maps.stone,
      bumpMap: maps.height,
      bumpScale: 0.025,
      roughness: 0.88,
      metalness: 0,
    });
    material("trim", { color: 0xa5a69f, roughness: 0.74, metalness: 0.06 });
    material("wood", {
      color: 0xffffff,
      map: maps.wood,
      bumpMap: maps.woodHeight,
      bumpScale: 0.018,
      roughness: 0.63,
      metalness: 0,
    });
    material("brass", {
      color: 0x9da8cf,
      metalness: 0.82,
      roughness: 0.32,
      roughnessMap: maps.brush,
    });
    material("steel", {
      color: 0x4c5965,
      metalness: 0.8,
      roughness: 0.39,
      roughnessMap: maps.brush,
    });
    material("dark", { color: 0x11172d, roughness: 0.61, metalness: 0.28 });
    material("grille", {
      color: 0xffffff,
      map: maps.grille,
      roughness: 0.82,
      metalness: 0.2,
    });
    material("glass", {
      color: 0xbad3df,
      metalness: 0.12,
      roughness: 0.15,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    material("light", {
      color: 0xc4eaff,
      emissive: 0x408aff,
      emissiveIntensity: 1.5,
      roughness: 0.4,
      metalness: 0.2,
    });
    material("pot", { color: 0x655e53, roughness: 0.85, metalness: 0 });
    mats.neonPink = own(
      new THREE.MeshBasicMaterial({ color: 0xff52bd, toneMapped: false }),
    );
    mats.leaf = own(
      new THREE.MeshLambertMaterial({
        color: 0x586d48,
        side: THREE.DoubleSide,
      }),
    );
    mats.leaf.color.convertSRGBToLinear();
    // A small density/shading bake replaces visibly flattened sphere clouds.
    // Camera-facing banks occupy the distant horizon only, not a fullscreen volume pass.
    const cloud = canvas(256, 128),
      cx = cloud.getContext("2d"),
      ci = cx.createImageData(256, 128),
      cr = random(980);
    const grid = Array.from({ length: 64 * 64 }, () => cr());
    function noise(x, y) {
      const ix = Math.floor(x),
        iy = Math.floor(y),
        fx = x - ix,
        fy = y - iy,
        s = fx * fx * (3 - 2 * fx),
        t = fy * fy * (3 - 2 * fy),
        v = (a, b) => grid[((b + 256) % 64) * 64 + ((a + 256) % 64)];
      return (
        (v(ix, iy) * (1 - s) + v(ix + 1, iy) * s) * (1 - t) +
        (v(ix, iy + 1) * (1 - s) + v(ix + 1, iy + 1) * s) * t
      );
    }
    const puffs = Array.from({ length: 18 }, (_, i) => ({
      x: 0.15 + (i / 17) * 0.7,
      y: 0.49 + cr() * 0.19,
      rx: 0.055 + cr() * 0.08,
      ry: 0.08 + cr() * 0.15,
    }));
    for (let y = 0; y < 128; y++)
      for (let x = 0; x < 256; x++) {
        const u = x / 255,
          v = y / 127;
        let density = 0;
        for (const p of puffs) {
          const dx = (u - p.x) / p.rx,
            dy = (v - p.y) / p.ry;
          density += Math.exp(-2 * (dx * dx + dy * dy));
        }
        const n =
          noise(u * 14, v * 10) * 0.5 +
          noise(u * 29, v * 24) * 0.28 +
          noise(u * 61, v * 51) * 0.15 +
          noise(u * 123, v * 97) * 0.07;
        density = Math.max(0, density * (0.55 + n * 0.8) - 0.16);
        const alpha = 1 - Math.exp(-density * 3.1),
          shade = Math.max(
            0,
            Math.min(1, (v - 0.36) * 1.7 + noise(u * 17, v * 15) * 0.21),
          );
        const i = (y * 256 + x) * 4;
        ci.data[i] = 252 - shade * 57;
        ci.data[i + 1] = 253 - shade * 53;
        ci.data[i + 2] = 254 - shade * 46;
        ci.data[i + 3] = Math.round(alpha * 247);
      }
    cx.putImageData(ci, 0, 0);
    maps.cloud = texture(cloud);
    maps.cloud.wrapS = maps.cloud.wrapT = THREE.ClampToEdgeWrapping;
    mats.cloud = own(
      new THREE.MeshBasicMaterial({
        map: maps.cloud,
        transparent: true,
        depthWrite: false,
        alphaTest: 0.008,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    mats.cloud.color.setHex(0x7584b2);
    // Small shared soft light pool. No bloom pass, shadow light or large particle system.
    const glowCanvas = canvas(64, 64),
      gc = glowCanvas.getContext("2d"),
      gg = gc.createRadialGradient(32, 32, 0, 32, 32, 32);
    gg.addColorStop(0, "rgba(255,255,255,1)");
    gg.addColorStop(0.3, "rgba(255,255,255,.5)");
    gg.addColorStop(1, "rgba(255,255,255,0)");
    gc.fillStyle = gg;
    gc.fillRect(0, 0, 64, 64);
    maps.glow = texture(glowCanvas);
    maps.glow.wrapS = maps.glow.wrapT = THREE.ClampToEdgeWrapping;
    const sky = canvas(4, 512),
      skyCtx = sky.getContext("2d"),
      grad = skyCtx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, "#070b20");
    grad.addColorStop(0.42, "#141d40");
    grad.addColorStop(0.56, "#30345b");
    grad.addColorStop(0.75, "#573e74");
    grad.addColorStop(1, "#242b4d");
    skyCtx.fillStyle = grad;
    skyCtx.fillRect(0, 0, 4, 512);
    maps.sky = texture(sky);
    maps.sky.wrapT = THREE.ClampToEdgeWrapping;
    maps.sky.wrapS = THREE.ClampToEdgeWrapping;
    const ao = canvas(128, 128),
      ax = ao.getContext("2d"),
      ag = ax.createRadialGradient(64, 64, 3, 64, 64, 64);
    ag.addColorStop(0, "rgba(0,0,0,.45)");
    ag.addColorStop(0.55, "rgba(0,0,0,.23)");
    ag.addColorStop(1, "rgba(0,0,0,0)");
    ax.fillStyle = ag;
    ax.fillRect(0, 0, 128, 128);
    maps.shadow = texture(ao);
    const softShadows = new THREE.Group();
    softShadows.name = "sky_mobile_contact_shadows";
    root.add(softShadows);
    const shadowGeo = own(new THREE.PlaneGeometry(1, 1)),
      shadowMat = own(
        new THREE.MeshBasicMaterial({
          map: maps.shadow,
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
        }),
      );
    function contact(x, z, w, d, y = 0.012) {
      const p = new THREE.Mesh(shadowGeo, shadowMat);
      p.rotation.x = -Math.PI / 2;
      p.position.set(x, y, z);
      p.scale.set(w, d, 1);
      softShadows.add(p);
      return p;
    }
    contact(0, -17, 18, 14);
    for (const z of [-5, 8]) contact(-20, z, 7, 3);
    contact(14, -13, 4, 3);
    contact(-14, 2, 3.2, 2.2);
    for (const p of [
      ...(global.FZSkyPolicy?.gardenPools || []),
      ...(global.FZSkyPolicy?.gardenTrees || []),
    ])
      contact(p.x, p.z, p.r * 2.5, p.r * 2.5);
    const playerShadow = contact(0, 0, 1.5, 1.1, 0.016);
    const sun = new THREE.DirectionalLight(0xaac5ff, 0.95);
    sun.position.set(-32, 48, 24);
    sun.target.position.set(0, 0, -2);
    root.add(sun, sun.target);
    Object.assign(sun.shadow.camera, {
      left: -36,
      right: 36,
      top: 36,
      bottom: -36,
      near: 1,
      far: 110,
    });
    sun.shadow.camera.layers.set(2);
    sun.shadow.bias = -0.00025;
    sun.shadow.normalBias = 0.025;
    sun.shadow.radius = 2;
    const hemi = new THREE.HemisphereLight(0x91afff, 0x805897, 0.72);
    root.add(hemi);
    function addLayer(object) {
      if (!object) return;
      object.traverse((o) => {
        if (!layers.has(o)) layers.set(o, o.layers.mask);
        o.layers.enable(2);
      });
    }
    function release() {
      if (!session) return;
      for (const [o, mask] of layers) o.layers.mask = mask;
      layers.clear();
      const { r, c } = session;
      r.outputEncoding = session.encoding;
      const sameSettings =
        session.shadowSetting === SETTINGS.shadowQuality &&
        session.perfSetting === SETTINGS.perf &&
        session.profile === window.FZPlay?.info().profile;
      r.shadowMap.enabled = sameSettings
        ? session.shadows
        : SETTINGS.shadowQuality !== "off" &&
          !SETTINGS.perf &&
          !window.FZPlay?.managed();
      r.shadowMap.type = sameSettings
        ? session.shadowType
        : SETTINGS.shadowQuality === "low"
          ? THREE.PCFShadowMap
          : THREE.PCFSoftShadowMap;
      c.layers.mask = session.cameraMask;
      c.far = session.far;
      c.updateProjectionMatrix();
      session = null;
      tier = null;
      sun.castShadow = false;
    }
    function update(on, r, c, player, remote = {}, extras = []) {
      if (!on) {
        release();
        return;
      }
      if (session && (session.r !== r || session.c !== c)) release();
      if (!session)
        session = {
          r,
          c,
          encoding: r.outputEncoding,
          shadows: r.shadowMap.enabled,
          shadowType: r.shadowMap.type,
          shadowSetting: SETTINGS.shadowQuality,
          perfSetting: SETTINGS.perf,
          profile: window.FZPlay?.info().profile,
          cameraMask: c.layers.mask,
          far: c.far,
        };
      const phone =
        navigator.maxTouchPoints > 0 || matchMedia("(pointer:coarse)").matches;
      const q = quality(
        phone,
        window.FZPlay?.info().profile || "custom",
        SETTINGS.shadowQuality,
        SETTINGS.perf,
      );
      const key = JSON.stringify(q);
      if (tier !== key) {
        tier = key;
        mats.stone.bumpMap = q.bump ? maps.height : null;
        mats.wood.bumpMap = q.bump ? maps.woodHeight : null;
        mats.stone.needsUpdate = mats.wood.needsUpdate = true;
        if (sun.shadow.mapSize.x !== q.map) {
          sun.shadow.map?.dispose();
          sun.shadow.map = null;
          sun.shadow.mapSize.set(q.map, q.map);
        }
      }
      sun.castShadow = q.shadow;
      r.shadowMap.enabled = q.shadow;
      r.shadowMap.type = THREE.PCFSoftShadowMap;
      r.outputEncoding = THREE.sRGBEncoding;
      c.layers.set(2);
      if (c.far < 450) {
        c.far = 450;
        c.updateProjectionMatrix();
      }
      addLayer(player?.mesh);
      for (const p of Object.values(remote)) addLayer(p.mesh);
      extras.filter(Boolean).forEach(addLayer);
      if (player?.mesh) {
        const p = player.mesh.position;
        playerShadow.position.set(
          p.x - root.position.x,
          0.016,
          p.z - root.position.z,
        );
        playerShadow.visible =
          !q.shadow && Math.abs(p.y - root.position.y) < 0.1;
      }
      softShadows.visible = !q.shadow;
      if (++frames % 120 === 0)
        for (const [o, mask] of layers) {
          let top = o;
          while (top.parent) top = top.parent;
          if (!top.isScene) {
            o.layers.mask = mask;
            layers.delete(o);
          }
        }
      return q;
    }
    function dispose() {
      if (disposed) return;
      disposed = true;
      release();
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
    return {
      materials: mats,
      maps,
      contact,
      update,
      release,
      dispose,
      info: () => ({
        active: !!session,
        quality: tier ? JSON.parse(tier) : null,
        materials: Object.keys(mats).length,
        textures: [...resources].filter((r) => r.isTexture).length,
        layer: 2,
        shadows: sun.castShadow,
        shadowSize: sun.shadow.mapSize.x,
      }),
      setLayers: () => root.traverse((o) => o.layers.set(2)),
    };
  }
  const api = { quality, create };
  global.FZSkyVisual = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
