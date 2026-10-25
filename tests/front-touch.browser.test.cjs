// Real touch input (CDP), not a desktop viewport pretending to be a phone.
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
  let page;
  const errors = [];
  try {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 1,
    });
    page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(e.stack));
    const url = process.env.GAME_URL || "http://127.0.0.1:3000";
    await page.route("**/*", (r) =>
      r.request().url().startsWith(url) ||
      /^(data|blob):/.test(r.request().url())
        ? r.continue()
        : r.abort(),
    );
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => window.FZFront && FZFront.info().phase === "life",
    );
    assert(
      await page.evaluate(
        () => FZFront.info().renderer && FZFront.info().actors === 8,
      ),
    );
    assert.equal(await page.locator("#fzTouch").isVisible(), false);
    await page.screenshot({ path: "/home/user/front-touch-intro-v9.png" });
    await page.waitForFunction(
      () => FZFront.info().phase === "title",
      {},
      { timeout: 60000 },
    );
    assert((await page.locator("#fzIntro").textContent()).includes("FANTAZIA"));
    await page.waitForTimeout(650);
    await page.screenshot({ path: "/home/user/front-touch-title-v9.png" });
    await page.waitForSelector("#fzIntro", { state: "detached" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.FZFront);
    await page.waitForSelector("#fzIntroSkip");
    await page.tap("#fzIntroSkip");
    assert.equal(
      await page.locator("#fzIntro").count(),
      0,
      "autoplay on reload is skippable",
    );
    await page.tap("#authTabReg");
    await page.fill("#regUsername", "TouchV9" + Date.now());
    await page.fill("#regPassword", "touch-local-test-v9");
    await page.fill("#regPasswordConfirm", "touch-local-test-v9");
    await page.tap("#registerForm .auth-submit-btn");
    await page.waitForSelector("#serverScreen", {
      state: "visible",
      timeout: 15000,
    });
    await page.screenshot({ path: "/home/user/front-main-mobile-v9.png" });
    await page.tap(".fz-play");
    await page.waitForFunction(
      () =>
        typeof localPlayer !== "undefined" &&
        localPlayer &&
        cityWorldReady() &&
        FZUI.playing(),
      {},
      { timeout: 100000 },
    );
    await page.waitForFunction(() => !window._loadingGate && window.FZSky?.active());
    await page.evaluate(() => FZSky.descend());
    await page.waitForSelector("#cityIntroSkip", { timeout: 30000 });
    await page.tap("#cityIntroSkip");
    await page.waitForFunction(() => !window.cine);
    await page.waitForSelector("#fzTouchStick", { state: "visible" });
    assert.equal(
      await page.evaluate(() => FZFront.info().renderer),
      false,
      "opening camera/cast released on PLAY; native city renderer retained",
    );
    assert.equal(await page.locator("#touchCameraZone").isVisible(), false);
    const cdp = await ctx.newCDPSession(page);
    const touch = (type, points) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: points.map(([id, x, y]) => ({
          id,
          x,
          y,
          radiusX: 4,
          radiusY: 4,
          force: 1,
        })),
      });
    const rect = await page.locator("#fzTouchStick").boundingBox(),
      jx = rect.x + rect.width / 2,
      jy = rect.y + rect.height / 2;
    const before = await page.evaluate(() => ({
      yaw: cameraAngleH,
      zoom: CONFIG.CAMERA_DISTANCE,
      p: localPlayer.mesh.position.toArray(),
    }));
    await touch("touchStart", [[1, jx, jy]]);
    await touch("touchMove", [[1, jx, jy - 35]]);
    await touch("touchStart", [
      [1, jx, jy - 35],
      [2, 230, 350],
    ]);
    await touch("touchMove", [
      [1, jx, jy - 35],
      [2, 275, 330],
    ]);
    await page.waitForFunction(
      (p) =>
        Math.hypot(
          localPlayer.mesh.position.x - p[0],
          localPlayer.mesh.position.z - p[2],
        ) > 0.05,
      before.p,
      { timeout: 15000 },
    );
    const during = await page.evaluate(() => ({
      yaw: cameraAngleH,
      zoom: CONFIG.CAMERA_DISTANCE,
      info: FZTouch.info(),
    }));
    assert(Math.abs(during.yaw - before.yaw) > 0.05);
    assert.equal(during.zoom, before.zoom, "move+look is NOT pinch zoom");
    assert(during.info.moving && during.info.lookPointers === 1);
    await touch("touchEnd", [[2, 275, 330]]);
    assert.equal(await page.evaluate(() => FZTouch.info().lookPointers), 0);
    assert.equal(await page.evaluate(() => FZTouch.info().moving), true);
    await touch("touchEnd", []);
    assert(
      await page.evaluate(
        () =>
          !keys.KeyW && FZTouch.vector().x === 0 && FZTouch.vector().y === 0,
      ),
    );
    const zoom = await page.evaluate(() => CONFIG.CAMERA_DISTANCE);
    await touch("touchStart", [
      [3, 180, 330],
      [4, 270, 330],
    ]);
    await touch("touchMove", [
      [3, 155, 330],
      [4, 290, 330],
    ]);
    assert((await page.evaluate(() => CONFIG.CAMERA_DISTANCE)) < zoom);
    await touch("touchCancel", []);
    assert.deepEqual(
      await page.evaluate(() => ({
        move: FZTouch.info().moving,
        look: FZTouch.info().lookPointers,
      })),
      { move: false, look: 0 },
    );
    await page.screenshot({ path: "/home/user/touch-game-v9.png" });
    // A jump pointer cancelled by the browser must never leave Space pressed.
    const jump = await page.locator("#fzTouchJump").boundingBox();
    await touch("touchStart", [[5, jump.x + 20, jump.y + 20]]);
    assert(await page.evaluate(() => !!keys.Space));
    await touch("touchCancel", []);
    assert.equal(await page.evaluate(() => !!keys.Space), false);
    await page.tap("#fzTouchMore");
    await page.locator('[data-tool="phone"]').tap();
    assert(await page.locator("#phoneUI").isVisible());
    assert.equal(await page.locator("#fzTouch").isVisible(), false);
    await page.tap("#fzPhoneClose");
    await page.waitForSelector("#fzTouchMore", { state: "visible" });
    await page.tap("#fzTouchMore");
    await page.locator('[data-tool="dance"]').tap();
    await page.locator("#danceBar .dance-btn").nth(1).tap();
    await page.waitForSelector("#fzTouchStick", { state: "visible" });
    await touch("touchStart", [[6, jx, jy]]);
    await touch("touchEnd", []);
    assert.equal(
      await page.evaluate(() => currentDance),
      null,
      "moving can leave an emote",
    );
    await page.tap("#fzTouchMore");
    assert(await page.locator("#fzTouchPanel").isVisible());
    assert.equal(await page.locator("#fzTouch").isVisible(), false);
    await page.locator('[data-tool="view"]').tap();
    await page.waitForSelector("#fzTouchMore", { state: "visible" });
    await page.tap("#fzTouchMore");
    await page.locator('[data-tool="inventory"]').tap();
    assert(await page.locator("#inventoryModal").isVisible());
    assert.equal(await page.locator("#fzTouch").isVisible(), false);
    await page.tap("#inventoryModal .modal-close");
    await page.waitForSelector("#fzUIOpen", { state: "visible" });
    await page.tap("#fzUIOpen");
    await page.fill("#fzUISearch", "Школа");
    await page.locator("#fzUIList button").tap();
    await page.locator("#fz8bBody button").first().tap();
    await page.waitForFunction(
      () => isInsideBuilding && FZ8B.info()?.type === "school" && !window.cine,
      {},
      { timeout: 20000 },
    );
    await page.evaluate(() => {
      const e = interactables.find((e) => e.fz8b && e.action === "lesson");
      localPlayer.mesh.position.copy(e.position);
      checkInteractables();
      FZTouch.update();
    });
    await page.waitForSelector("#fzTouchUse", { state: "visible" });
    await page.tap("#fzTouchUse");
    await page.waitForSelector("#fz8bPanel", { state: "visible" });
    assert.equal(await page.locator("#fzTouch").isVisible(), false);
    const yaw = await page.evaluate(() => cameraAngleH);
    await page.locator("#fz8bBody button").nth(1).tap();
    assert.equal(await page.evaluate(() => FZ8B.state().grades.math.at(-1)), 5);
    await page
      .getByRole("button", { name: "Завершить урок", exact: true })
      .tap();
    assert.equal(await page.locator("#fz8bPanel").isVisible(), false);
    assert.equal(
      await page.evaluate(() => cameraAngleH),
      yaw,
      "UI taps do not turn camera",
    );
    await page.waitForSelector("#fzTouchMore", { state: "visible" });
    await page.tap("#fzTouchMore");
    await page.locator('[data-tool="leave"]').tap();
    await page.waitForFunction(() => !isInsideBuilding && !window.cine);
    // A timed household action also completes through the phone's E equivalent.
    await page.evaluate(() => FZ8B.visit("house"));
    await page.waitForFunction(
      () => isInsideBuilding && FZ8B.info()?.type === "house" && !window.cine,
    );
    const cooked = await page.evaluate(() => FZ8B.state().cooked);
    await page.evaluate(() => {
      const e = interactables.find((e) => e.fz8b && e.action === "cook");
      localPlayer.mesh.position.copy(e.position);
      checkInteractables();
      FZTouch.update();
    });
    await page.waitForSelector("#fzTouchUse", { state: "visible" });
    await page.tap("#fzTouchUse");
    await page.waitForFunction((n) => FZ8B.state().cooked === n + 1, cooked, {
      timeout: 30000,
    });
    await page.tap("#fzTouchMore");
    await page.locator('[data-tool="leave"]').tap();
    await page.waitForFunction(() => !isInsideBuilding && !window.cine);
    // Landscape: panel scrolling and controls stay inside the visible viewport.
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForSelector("#fzTouchMore", { state: "visible" });
    await page.tap("#fzTouchMore");
    const angle = await page.evaluate(() => cameraAngleH);
    await touch("touchStart", [[7, 420, 310]]);
    await touch("touchMove", [[7, 420, 130]]);
    await touch("touchEnd", []);
    assert.equal(await page.evaluate(() => cameraAngleH), angle);
    await page.locator("#fzTouchSensitivity").scrollIntoViewIfNeeded();
    assert(await page.locator("#fzTouchSensitivity").isVisible());
    await page.locator("#fzTouchClose").scrollIntoViewIfNeeded();
    await page.tap("#fzTouchClose");
    for (const id of [
      "fzTouchUse",
      "fzTouchJump",
      "fzTouchAttack",
      "fzTouchRun",
      "fzTouchCrouch",
      "fzTouchMore",
    ]) {
      const box = await page.locator("#" + id).boundingBox();
      assert(
        box &&
          box.x >= 0 &&
          box.y >= 0 &&
          box.x + box.width <= 845 &&
          box.y + box.height <= 391,
        id + " reachable",
      );
    }
    await page.screenshot({ path: "/home/user/touch-landscape-v9.png" });
    assert.equal(
      await page.evaluate(() => !!document.pointerLockElement),
      false,
    );
    await page.evaluate(() => backToServers());
    await page.waitForSelector("#serverScreen", { state: "visible" });
    await page.waitForFunction(() => !FZFront.info().renderer);
    assert(
      await page.locator("#menuCityCanvas").isVisible(),
      "classic menu backdrop restored",
    );
    assert.equal(await page.evaluate(() => FZFront.info().failed), false);
    assert.equal(await page.locator("#fzTouch").isVisible(), false);
    assert.equal(await page.locator("#fzIntro").count(), 0);
    assert.deepEqual(errors, []);
    console.log(
      "PASS v9: real 3D intro + automatic page-load lifecycle, phone login/Play, simultaneous touch move/look, pinch, cancellation, menus, school answer/completion, landscape and return to menu.",
    );
  } catch (e) {
    console.error("PAGE ERRORS", errors);
    if (page)
      console.error(
        "STATE",
        await page
          .evaluate(() => ({
            body: document.body.className,
            touch: window.FZTouch?.info(),
            blocked: window.FZTouch?.blocked(),
            front: window.FZFront?.info(),
          }))
          .catch(() => null),
      );
    throw e;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
