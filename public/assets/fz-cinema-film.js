/* Two actual locally rendered 3D shorts. No video hosts, extra WebGL context,
 * third-party footage or duplicate city. The game renderer owns the pass. */
(function () {
  "use strict";
  let films = [];
  function release() {
    for (const f of films) {
      f.target.dispose();
      f.resources.forEach((r) => r.dispose?.());
    }
    films = [];
  }
  function prepare(k) {
    release();
    for (let index = 0; index < k.screens.length; index++) {
      const resources = new Set(),
        world = new THREE.Scene(),
        camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 180);
      camera.userData.fzOpeningPass = true;
      const target = new THREE.WebGLRenderTarget(480, 270, {
        depthBuffer: true,
      });
      target.texture.encoding = THREE.sRGBEncoding;
      const palette = new Map(),
        box = new THREE.BoxGeometry(1, 1, 1),
        sphere = new THREE.SphereGeometry(1, 16, 10);
      resources.add(box);
      resources.add(sphere);
      function mat(color, glow) {
        const key = color + ":" + glow;
        if (!palette.has(key)) {
          const m = glow
            ? new THREE.MeshBasicMaterial({ color })
            : new THREE.MeshLambertMaterial({ color });
          palette.set(key, m);
          resources.add(m);
        }
        return palette.get(key);
      }
      function shape(
        geo,
        color,
        x,
        y,
        z,
        sx,
        sy,
        sz,
        glow = false,
        parent = world,
      ) {
        const o = new THREE.Mesh(geo, mat(color, glow));
        o.position.set(x, y, z);
        o.scale.set(sx, sy, sz);
        parent.add(o);
        return o;
      }
      world.add(new THREE.HemisphereLight(0xc1dfff, 0x293647, 1.1));
      const sun = new THREE.DirectionalLight(0xffead0, 1.4);
      sun.position.set(10, 20, 10);
      world.add(sun);
      const film = {
        resources,
        world,
        camera,
        target,
        frame: -1,
        draws: 0,
        screen: k.screens[index],
        index,
      };
      if (index === 0) {
        world.background = new THREE.Color(0x050a23);
        const rocket = new THREE.Group();
        world.add(rocket);
        film.rocket = rocket;
        shape(box, 0xe2e9ef, 0, 0, 0, 1.3, 4, 1.3, false, rocket);
        const cone = new THREE.ConeGeometry(0.93, 1.6, 12);
        resources.add(cone);
        shape(cone, 0xd65353, 0, 2.8, 0, 1, 1, 1, false, rocket);
        for (const x of [-1, 1])
          shape(box, 0xd65353, x, -1.3, 0, 0.6, 1.4, 0.8, false, rocket);
        film.flame = shape(
          cone,
          0xffac37,
          0,
          -3,
          0,
          0.65,
          1.6,
          0.65,
          true,
          rocket,
        );
        film.flame.rotation.z = Math.PI;
        film.planet = shape(sphere, 0x356b94, -14, -12, -20, 13, 13, 13);
        for (let i = 0; i < 75; i++)
          shape(
            sphere,
            0xd1e5ff,
            Math.sin(i * 13.31) * 70,
            Math.cos(i * 8.73) * 40,
            -40 - (i % 7) * 8,
            0.1,
            0.1,
            0.1,
            true,
          );
        shape(sphere, 0xbcbcba, 25, 13, -55, 6, 6, 6);
        shape(box, 0x385368, 0, -5, 0, 8, 0.5, 8);
      } else {
        world.background = new THREE.Color(0x11203c);
        world.fog = new THREE.Fog(0x11203c, 50, 110);
        shape(box, 0x182a33, 0, -2, 0, 120, 1, 120);
        for (let i = 0; i < 16; i++) {
          const x = ((i % 8) - 4) * 9,
            z = i < 8 ? -17 : 18,
            h = 5 + ((i * 7) % 17);
          shape(box, i % 2 ? 0x304b69 : 0x3c5368, x, h / 2 - 1, z, 6, h, 6);
          for (let row = 0; row < 3; row++)
            shape(
              box,
              0xf0d495,
              x,
              1 + row * 3,
              z + (i < 8 ? 3.04 : -3.04),
              4,
              0.8,
              0.04,
              true,
            );
        }
        for (const z of [-2.6, 2.6])
          shape(box, 0x9daab5, 0, -0.8, z, 110, 0.1, 0.1);
        for (let x = -48; x < 48; x += 3)
          shape(box, 0x654c3e, x, -0.9, 0, 0.4, 0.15, 7);
        const train = new THREE.Group();
        world.add(train);
        film.train = train;
        for (let car = 0; car < 3; car++) {
          const x = car * 9;
          shape(box, 0x35668a, x, 1.2, 0, 8, 3.6, 4, false, train);
          shape(box, 0xd4d4ce, x, 3.1, 0, 8.2, 0.25, 4.2, false, train);
          for (const z of [-2.02, 2.02])
            for (let a = -2.5; a <= 2.5; a += 2.5)
              shape(box, 0xa8dfe8, x + a, 2, z, 1.7, 1.2, 0.04, true, train);
          for (const dx of [-2.6, 2.6])
            shape(
              sphere,
              0x111820,
              x + dx,
              -0.45,
              0,
              0.8,
              0.8,
              2.1,
              false,
              train,
            );
        }
        shape(box, 0x4d6475, 12, -0.4, 7, 28, 0.9, 7);
        for (const x of [0, 12, 24])
          shape(box, 0x758b9e, x, 2.5, 9, 0.2, 5, 0.2);
        shape(box, 0x637688, 12, 5.1, 9, 30, 0.25, 7);
        shape(sphere, 0xd2d9df, -23, 28, -60, 4, 4, 4, true);
      }
      film.screen.screen.mesh.material.map = target.texture;
      film.screen.screen.mesh.material.needsUpdate = true;
      films.push(film);
    }
  }
  function pose(f, t) {
    const u = t % 32;
    if (f.index === 0) {
      f.rocket.position.set(
        Math.sin(t * 0.3) * 2,
        Math.min(15, u * 0.9) - 3,
        Math.cos(t * 0.2),
      );
      f.rocket.rotation.z = Math.sin(t * 0.45) * 0.12;
      f.flame.scale.y = 1.3 + Math.sin(t * 19) * 0.3;
      const a = u * 0.13;
      f.camera.position.set(
        Math.sin(a) * 17,
        6 + Math.sin(u * 0.15) * 7,
        Math.cos(a) * 17 + 8,
      );
      f.camera.lookAt(f.rocket.position);
      f.planet.rotation.y = t * 0.04;
    } else {
      f.train.position.x = -45 + (u / 32) * 70;
      f.camera.position.set(
        f.train.position.x + 16,
        7 + Math.sin(u * 0.18) * 2,
        17,
      );
      f.camera.lookAt(f.train.position.x + 8, 1.5, 0);
    }
  }
  function render(k) {
    if (!films.length || document.hidden || !window.FZUI?.playing()) return;
    const x = localPlayer.mesh.position.x - INTERIOR_BASE.x,
      z = localPlayer.mesh.position.z - INTERIOR_BASE.z;
    for (const f of films) {
      const near = z < 8 && (f.index === 0 ? x < 0 : x > 0),
        frame = Math.floor(f.screen.time * 12);
      if (f.frame >= 0 && (!near || f.frame === frame)) continue;
      const rt = renderer.getRenderTarget(),
        auto = renderer.autoClear,
        viewport = renderer.getViewport(new THREE.Vector4()),
        scissor = renderer.getScissor(new THREE.Vector4()),
        test = renderer.getScissorTest(),
        color = renderer.getClearColor(new THREE.Color()).clone(),
        alpha = renderer.getClearAlpha();
      try {
        pose(f, f.screen.time);
        renderer.setRenderTarget(f.target);
        renderer.setViewport(0, 0, 480, 270);
        renderer.setScissorTest(false);
        renderer.autoClear = true;
        renderer.render(f.world, f.camera);
        f.frame = frame;
        f.draws++;
      } finally {
        renderer.setRenderTarget(rt);
        renderer.setViewport(viewport);
        renderer.setScissor(scissor);
        renderer.setScissorTest(test);
        renderer.setClearColor(color, alpha);
        renderer.autoClear = auto;
      }
    }
  }
  window.FZCinemaFilm = {
    prepare,
    render,
    release,
    info: () =>
      films.map((f) => ({
        title: f.screen.film,
        frames: f.draws,
        scene: f.world.uuid,
        paused: f.screen.paused,
      })),
  };
})();
