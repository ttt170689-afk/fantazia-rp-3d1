// Native-scene ownership proof: intro and Play must share actual object identities.
const assert = require("node:assert/strict");
const { chromium } = require("playwright-core");
(async () => {
  const c = require("@sparticuz/chromium"),
    browser = await chromium.launch({
      executablePath:
        process.env.CHROMIUM_EXECUTABLE || (await c.executablePath()),
      args: c.args,
      headless: true,
    });
  try {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2,
    });
    const p = await ctx.newPage(),
      errors = [],
      connections = [];
    p.on("pageerror", (e) => errors.push(e.stack));
    const base = process.env.GAME_URL || "http://127.0.0.1:3000";
    p.on("request", (r) => {
      if (r.url().includes("transport=")) connections.push(r.url());
    });
    await p.route("**/*", (r) =>
      r.request().url().startsWith(base) ||
      /^(data|blob):/.test(r.request().url())
        ? r.continue()
        : r.abort(),
    );
    await p.goto(base, { waitUntil: "domcontentloaded" });
    assert.equal(
      await p.locator("#fzIntro").count(),
      1,
      "single intro, including bootstrap placeholder",
    );
    await p.waitForFunction(
      () => FZFront.info().ready,
      {},
      { timeout: 120000 },
    );
    const native = await p.evaluate(() => ({
      scene: scene.uuid,
      mall: buildings.find((b) => b.type === "mall").mesh.uuid,
      npcs: npcs.length,
      children: scene.children.length,
      interacts: interactables.length,
      colliders: streetColliders.length,
      canvas: renderer.domElement.id,
      player: localPlayer,
    }));
    assert.equal(native.player, null);
    assert.equal(connections.length, 0, "no prelogin connection");
    assert.equal(
      await p.evaluate(() => FZFront.info().sceneUUID),
      native.scene,
    );
    assert.equal(
      await p.evaluate(() => FZFront.info().anchors.mall.uuid),
      native.mall,
    );
    assert.equal(
      await p.evaluate(
        () => scene.getObjectByName("fz_opening_cast").parent === scene,
      ),
      true,
    );
    assert.equal(await p.evaluate(() => FZFront.info().actors), 8);
    assert(
      await p.evaluate(() =>
        FZFront.info().cast.every(
          (a) => a.joints && a.source === "game-character",
        ),
      ),
    );
    assert.equal(await p.evaluate(() => FZFront.info().portal.letter), "A");
    assert.equal(await p.locator("#gameCanvas").count(), 1);
    await p.waitForFunction(
      () => FZFront.info().phase === "gateway",
      {},
      { timeout: 30000 },
    );
    assert.equal(
      await p.evaluate(
        () =>
          getComputedStyle(
            document.querySelector("#fzIntro .front-credit-type"),
          ).transform,
      ),
      "none",
      "no CSS zoom fake",
    );
    assert.equal(await p.evaluate(() => FZFront.info().build), 28);
    assert(
      await p.evaluate(() =>
        FZFront.info().cast.every((a) => a.model === "game-player-super-v26"),
      ),
    );
    await p.waitForFunction(
      () => FZFront.info().phase === "life",
      {},
      { timeout: 30000 },
    );
    assert(
      await p.evaluate(() => FZFront.info().portal.crossed),
      "lens really passed behind A",
    );
    await p.waitForFunction(
      () => FZFront.info().acting?.handover === "received",
    );
    assert(
      await p.evaluate(() => {
        const info = FZFront.info();
        const frame = FZOpeningPlan.sample(info.elapsed, info.anchors);
        const cam = new THREE.PerspectiveCamera(
          60,
          innerWidth / innerHeight,
          0.12,
          360,
        );
        cam.position.fromArray(info.camera);
        cam.lookAt(new THREE.Vector3(...frame.look));
        cam.updateMatrixWorld();
        return info.cast
          .filter((a) => ["courier", "receiver"].includes(a.id))
          .every((a) => {
            const pos = new THREE.Vector3(...a.position);
            pos.y += 1.3;
            pos.project(cam);
            return Math.abs(pos.x) < 0.95 && Math.abs(pos.y) < 0.95;
          });
      }),
      "both participants of the handover fit the phone frame",
    );
    // Hold page visibility to exercise the director's own suspension (not a hardware background test).
    await p.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const elapsed = await p.evaluate(() => FZFront.info().elapsed);
    await p.waitForTimeout(250);
    assert.equal(await p.evaluate(() => FZFront.info().elapsed), elapsed);
    await p.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const size = await p.locator("#fzIntroSkip").boundingBox();
    assert(size.x >= 0 && size.x + size.width <= 390);
    await p.screenshot({ path: "/home/user/opening-native-phone.png" });
    await p.evaluate(() => {
      window.skinDisposal = { allocated: 0, released: 0 };
      scene.getObjectByName("fz_opening_cast").traverse((o) => {
        if (o.isSkinnedMesh && o.skeleton.boneTexture) {
          skinDisposal.allocated++;
          o.skeleton.boneTexture.addEventListener(
            "dispose",
            () => skinDisposal.released++,
          );
        }
      });
    });
    await p.click("#fzIntroSkip");
    assert.equal(await p.locator("#fzIntro").count(), 0);
    const after = await p.evaluate(() => ({
      scene: scene.uuid,
      mall: buildings.find((b) => b.type === "mall").mesh.uuid,
      npcs: npcs.length,
      children: scene.children.length,
      interacts: interactables.length,
      colliders: streetColliders.length,
      cast: !!scene.getObjectByName("fz_opening_cast"),
    }));
    assert.equal(after.scene, native.scene);
    assert.equal(after.mall, native.mall);
    assert.equal(after.npcs, native.npcs);
    assert.equal(after.children, native.children - 2);
    assert.equal(after.interacts, native.interacts);
    assert.equal(after.colliders, native.colliders);
    assert(!after.cast);
    const skinDisposal = await p.evaluate(() => window.skinDisposal);
    assert(
      skinDisposal.allocated > 32,
      "actual gameplay GLB primitives were rendered",
    );
    assert.equal(
      skinDisposal.released,
      skinDisposal.allocated,
      "all owned bone textures released on skip",
    );
    for (let i = 0; i < 2; i++) {
      assert(await p.evaluate(() => FZFront.start()));
      await p.waitForFunction(() => FZFront.info().ready);
      await p.keyboard.press("Escape");
      assert.equal(
        await p.evaluate(() => scene.children.length),
        after.children,
      );
      assert.equal(await p.evaluate(() => npcs.length), native.npcs);
    }
    assert.equal(
      await p.evaluate(() => document.querySelector("#authScreen").inert),
      false,
    );
    await p.click("#authTabReg");
    await p.fill("#regUsername", "NativeIntro" + Date.now());
    await p.fill("#regPassword", "native-intro-test");
    await p.fill("#regPasswordConfirm", "native-intro-test");
    await p.click("#registerForm .auth-submit-btn");
    await p.waitForSelector("#serverScreen", { state: "visible" });
    await p.click(".fz-play");
    await p.waitForFunction(
      () => FZUI.playing() && !window._loadingGate && FZSky.active(),
      {},
      { timeout: 120000 },
    );
    assert.equal(
      await p.evaluate(() => scene.uuid),
      native.scene,
      "Play did not rebuild the city",
    );
    assert.equal(
      await p.evaluate(
        () => buildings.find((b) => b.type === "mall").mesh.uuid,
      ),
      native.mall,
      "same native mall object in Play",
    );
    assert.equal(await p.locator("#gameCanvas").count(), 1);
    assert.equal(
      await p.evaluate(() => FZFront.start()),
      false,
      "no opening can interrupt gameplay",
    );
    await p.waitForSelector("#fzTouch", { state: "visible" });
    assert(await p.evaluate(() => _gameLoopStarted));
    await p.evaluate(() => backToServers());
    assert(await p.evaluate(() => FZFront.start()));
    await p.waitForFunction(() => FZFront.info().ready);
    const lost = await p.evaluate(() => {
      const ext = renderer.getContext().getExtension("WEBGL_lose_context");
      if (!ext) return false;
      ext.loseContext();
      return true;
    });
    if (lost) {
      await p.waitForFunction(() => FZFront.info().failed);
      assert.equal(
        await p.evaluate(() => !!scene.getObjectByName("fz_opening_cast")),
        false,
      );
      await p.click("#fzIntroSkip");
      assert.equal(
        await p.locator("#fzGpuRecovery").isVisible(),
        false,
        "no GPU modal blocks prelogin/menu",
      );
      assert.equal(await p.evaluate(() => scene.uuid), native.scene);
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS native opening: real scene/mall object identities survive into Play; 8 actual gameplay GLB avatars, live handover, title fly-through, no prelogin socket/player, visibility pause, repeated skip/cleanup, unchanged world registries and functioning phone controls.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
