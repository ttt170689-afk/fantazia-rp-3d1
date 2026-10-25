const assert = require("node:assert/strict");
const { chromium } = require("playwright-core");
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
    const page = await b.newPage({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2,
    });
    page.on("pageerror", (e) => errors.push(e.stack));
    const base = process.env.GAME_URL || "http://127.0.0.1:3000";
    await page.route("**/*", (r) =>
      r.request().url().startsWith(base) ||
      /^(blob|data):/.test(r.request().url())
        ? r.continue()
        : r.abort(),
    );
    await page.goto(base, { waitUntil: "domcontentloaded" });
    assert.equal(
      await page.evaluate(() => FZFront.info().credit),
      "TEMKA_PLAY_OFFICIAL",
    );
    assert.equal(
      await page.evaluate(() => FZFront.info().citySource),
      "live-gameplay-scene",
    );
    await page.screenshot({ path: "/home/user/sky-credit.png" });
    await page.waitForFunction(() => FZFront.info().phase === "life");
    await page.screenshot({ path: "/home/user/sky-city-opening.png" });
    await page.click("#fzIntroSkip");
    await page.click("#authTabReg");
    await page.fill("#regUsername", "SkyVisitor" + Date.now());
    await page.fill("#regPassword", "sky-test-local");
    await page.fill("#regPasswordConfirm", "sky-test-local");
    await page.click("#registerForm .auth-submit-btn");
    await page.waitForSelector("#serverScreen", { state: "visible" });
    await page.click(".fz-play");
    await page.waitForFunction(
      () =>
        window.FZSky?.active() &&
        !window._loadingGate &&
        socket.connected &&
        localPlayer.id === socket.id,
      {},
      { timeout: 120000 },
    );
    assert.equal(
      await page.evaluate(() => window.cine),
      null,
      "spawn is explorable, no automatic forced descent",
    );
    assert.equal(await page.evaluate(() => localPlayer.mesh.position.y), 360);
    assert(
      await page.evaluate(
        () =>
          !checkCollision(
            localPlayer.mesh.position.x,
            localPlayer.mesh.position.z,
          ),
      ),
    );
    await page.waitForSelector("#fzTouch", { state: "visible" });
    await page.screenshot({ path: "/home/user/sky-spawn-phone.png" });
    // A spoofed client/admin nickname flag must not unlock the stage.
    assert(
      await page.evaluate(() => {
        localPlayer.isAdmin = true;
        return checkCollision(0, -1417);
      }),
    );
    assert.equal(
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            socket.emit("sky:stage", {}, (r) => resolve(r.ok)),
          ),
      ),
      false,
    );
    assert(await page.evaluate(()=>!!currentUser.token),'normal registration receives a server session');
    await page.evaluate(()=>FZSky.openStage());
    await page.waitForTimeout(400);
    assert.equal(await page.locator('#fzStageAccess').count(),0,'no key dialog');
    assert.equal(await page.evaluate(()=>FZSky.info().stageAllowed),false);
    assert.equal(await page.evaluate(()=>FZSky.info().descentClouds.wall),false);
    assert(await page.evaluate(()=>FZSky.info().descentClouds.light>2));
    await page.evaluate(() =>
      socket.emit("updatePosition", { position: { x: 0, y: 361.2, z: -1417 } }),
    );
    await page.waitForFunction(
      () => localPlayer.mesh.position.z === FZSkyPolicy.spawn.z,
    );
    await page.evaluate(() => {
      localPlayer.mesh.position.set(14, 360, -1410.5);
      checkInteractables();
      FZTouch.update();
    });
    await page.tap("#fzTouchUse");
    await page.waitForSelector("#newsModal", { state: "visible" });
    assert(
      await page
        .locator("#newsModal")
        .innerText()
        .then((t) => t.includes("НЕБЕСНАЯ ПЛОЩАДЬ")),
    );
    assert.equal(await page.locator("#fzTouch").isVisible(), false);
    await page.tap("#newsModal .news-close");
    assert.equal(
      await page.locator("#newsSideBtn").count(),
      1,
      "old button retained",
    );
    await page.evaluate(() => {
      localPlayer.mesh.position.set(18, 360, -1392.5);
      checkInteractables();
      FZTouch.update();
    });
    await page.tap("#fzTouchUse");
    await page.waitForFunction(() => FZSky.busy());
    assert.equal(await page.evaluate(() => cameraMode), "first");
    await page.waitForFunction(
      () => document.getElementById("fzSkyWhite")?.style.opacity > 0.2,
    );
    await page.screenshot({ path: "/home/user/sky-descent-light.png" });
    await page.waitForFunction(
      () => !FZSky.busy() && !window.cine,
      {},
      { timeout: 30000 },
    );
    assert(
      await page.evaluate(
        () =>
          localPlayer.mesh.position.distanceTo(
            new THREE.Vector3(SPAWN_POINT.x, 0, SPAWN_POINT.z),
          ) < 0.1,
      ),
    );
    assert.equal(await page.locator("#fzSkyWhite").isVisible(), false);
    assert.equal(await page.evaluate(() => FZSky.active()), false);
    assert(
      await page.evaluate(() => !checkCollision(SPAWN_POINT.x, SPAWN_POINT.z)),
    );
    await page.evaluate(() => {
      isInFactory = true;
    });
    assert.equal(await page.evaluate(() => FZSky.arrive()), false);
    await page.evaluate(() => {
      isInFactory = false;
    });
    for (let i = 0; i < 3; i++) {
      assert(await page.evaluate(() => FZSky.arrive()));
      await page.evaluate(() => FZSky.descend());
      await page.click("#cityIntroSkip");
      await page.waitForFunction(() => !window.cine);
    }
    assert.equal(
      await page.evaluate(() => interactables.filter((e) => e.sky).length),
      4, // news, descent, stage and the v23 metro information kiosk
    );
    assert(await page.evaluate(() => FZSky.arrive()));
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(150);
    await page.screenshot({ path: "/home/user/sky-spawn-landscape.png" });
    const menus = await page.evaluate(() => {
      const a = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
      });
      return document.getElementById("gameCanvas").dispatchEvent(a);
    });
    assert.equal(menus, false);
    assert.deepEqual(errors, []);
    console.log(
      "PASS SKY: shared Fantazia intro + credit, public cloud spawn, stage denial despite client flag, server correction, news action/retained button, real first-person descent and white fade, skip/repeat cleanup, story guard, portrait/landscape, context menu, no JS errors",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
