/* Real renderer/material lifecycle, desktop. No physical-GPU/FPS claim. */
const assert = require("node:assert/strict"),
  { chromium } = require("playwright-core");
(async () => {
  const c = require("@sparticuz/chromium"),
    b = await chromium.launch({
      executablePath:
        process.env.CHROMIUM_EXECUTABLE || (await c.executablePath()),
      args: c.args,
      headless: true,
    });
  const errors = [];
  try {
    const p = await b.newPage({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
    });
    p.on("pageerror", (e) => errors.push(e.stack));
    p.on("console", (m) => {
      if (
        m.type() === "error" &&
        /THREE.WebGLProgram|shader error|VALIDATE_STATUS/.test(m.text())
      )
        errors.push(m.text());
    });
    const base = process.env.GAME_URL || "http://127.0.0.1:3000";
    await p.route("**/*", (r) =>
      r.request().url().startsWith(base) ||
      /^(data|blob):/.test(r.request().url())
        ? r.continue()
        : r.abort(),
    );
    await p.goto(base, { waitUntil: "domcontentloaded" });
    await p.click("#fzIntroSkip");
    await p.click("#authTabReg");
    await p.fill("#regUsername", "SkyLook" + Date.now());
    await p.fill("#regPassword", "local-test");
    await p.fill("#regPasswordConfirm", "local-test");
    await p.click("#registerForm .auth-submit-btn");
    await p.waitForSelector("#serverScreen", { state: "visible" });
    await p.click(".fz-play");
    await p.waitForFunction(
      () =>
        FZSky.info().look?.active && !window._loadingGate && socket.connected,
      {},
      { timeout: 120000 },
    );
    await p.waitForTimeout(1200);
    const state = await p.evaluate(() => {
      const r = scene.getObjectByName("Fantazia cloud arrival"),
        floor = r.getObjectByName("sky_travertine_deck");
      return {
        look: FZSky.info(),
        camera: camera.layers.mask,
        avatar: localPlayer.mesh.layers.mask,
        encoding: renderer.outputEncoding,
        pbr: floor.material.isMeshStandardMaterial,
        bump: !!floor.material.bumpMap,
        clouds: r.getObjectByName("sky_cloud_bank").isInstancedMesh,
        lights: r.children
          .filter((o) => o.isLight)
          .map((o) => [o.type, o.layers.mask, o.shadow?.camera.layers.mask]),
        vignette: getComputedStyle(document.getElementById("vignetteOverlay"))
          .opacity,
      };
    });
    assert.equal(state.camera, 4);
    assert.equal(state.avatar, 5);
    assert.equal(state.encoding, 3001);
    assert(state.pbr && state.bump && state.clouds);
    assert(state.look.look.shadows);
    assert(state.lights.every((l) => l[1] === 4));
    assert(state.lights.find((l) => l[0] === "DirectionalLight")[2] === 4);
    assert(Number(state.vignette) < 0.3);
    await p.screenshot({ path: "/home/user/v18-plaza.png" });
    // First-person hands/held items added late in the native frame must still render on layer 2.
    await p.evaluate(() => {
      window.cameraMode = "first";
      setHeldItem(2);
    });
    await p.waitForFunction(() => ITEMS.vm?.layers.mask === 5);
    assert(
      await p.evaluate(() => ITEMS.vm.children.every((o) => o.layers.mask & 4)),
    );
    await p.evaluate(() => {
      window.cameraMode = "third";
      localPlayer.mesh.position.set(-15, 360, -1392);
      cameraAngleH = 0.5;
      cameraAngleV = -0.22;
    });
    await p.waitForTimeout(900);
    await p.screenshot({ path: "/home/user/v18-materials.png" });
    // User controls remain effective; in particular "no tone mapping" is a valid zero enum.
    await p.evaluate(() => {
      applySetting("toneMap", "none");
      applySetting("exposure", 11);
      applySetting("shadowQuality", "off");
    });
    await p.waitForFunction(() => !FZSky.info().look.shadows);
    assert.equal(await p.evaluate(() => renderer.toneMapping), 0);
    assert.equal(await p.evaluate(() => renderer.toneMappingExposure), 1.1);
    await p.evaluate(() => {
      applySetting("toneMap", "aces");
      applySetting("exposure", 9);
      applySetting("shadowQuality", "high");
      applyAntialiasing();
    });
    await p.waitForFunction(
      () =>
        renderer.outputEncoding === THREE.sRGBEncoding &&
        camera.layers.mask === 4 &&
        FZSky.info().look.shadows,
      {},
      { timeout: 30000 },
    );
    await p.evaluate(() => FZSky.descend());
    await p.click("#cityIntroSkip");
    await p.waitForFunction(() => !window.cine && !FZSky.active());
    assert.deepEqual(
      await p.evaluate(() => ({
        camera: camera.layers.mask,
        avatar: localPlayer.mesh.layers.mask,
        hands: ITEMS.vm.layers.mask,
        encoding: renderer.outputEncoding,
        active: FZSky.info().look.active,
      })),
      { camera: 1, avatar: 1, hands: 1, encoding: 3000, active: false },
    );
    // The AA replacement owns a new GL context. Let that renderer actually draw
    // the city before taking a baseline; an immediate Skip/Arrive can upload no
    // city buffers at all and mistake the next first city render for a sky leak.
    await p.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await p.evaluate(() => FZSky.arrive());
    await p.waitForFunction(() => FZSky.info().look.active);
    const stable = await p.evaluate(() => ({
      geometry: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
    }));
    for (let i = 0; i < 2; i++) {
      await p.evaluate(() => FZSky.descend());
      await p.click("#cityIntroSkip");
      await p.waitForFunction(() => !cine);
      await p.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      await p.evaluate(() => FZSky.arrive());
      await p.waitForFunction(() => FZSky.info().look.active);
    }
    const later = await p.evaluate(() => ({
      geometry: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
    }));
    assert(
      later.geometry <= stable.geometry + 4,
      JSON.stringify({ stable, later }),
    );
    assert(
      later.textures <= stable.textures + 4,
      JSON.stringify({ stable, later }),
    );
    await p.evaluate(() => backToServers());
    assert.deepEqual(
      await p.evaluate(() => ({
        active: FZSky.info().look.active,
        camera: camera.layers.mask,
        encoding: renderer.outputEncoding,
        visible: scene.getObjectByName("Fantazia cloud arrival").visible,
        skyClass: document.body.classList.contains("fz-in-sky"),
      })),
      {
        active: false,
        camera: 1,
        encoding: 3000,
        visible: false,
        skyClass: false,
      },
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS sky renderer: real PBR/bump/layers/shadows, late first-person items, preserved image controls, AA replacement, descent/logout restore, bounded repeated GPU resources, no JS/shader errors.",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
