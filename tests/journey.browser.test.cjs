// Real main game, phone viewport/touch device; hardware FPS is NOT asserted.
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { chromium } = require("playwright-core");
(async () => {
  const c = require("@sparticuz/chromium"),
    browser = await chromium.launch({
      executablePath:
        process.env.CHROMIUM_EXECUTABLE || (await c.executablePath()),
      args: c.args,
      headless: true,
    });
  const errors = [];
  try {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 3,
      acceptDownloads: true,
    });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(e.stack));
    const base = process.env.GAME_URL || "http://127.0.0.1:3000";
    await page.route("**/*", (r) =>
      r.request().url().startsWith(base) ||
      /^(blob|data):/.test(r.request().url())
        ? r.continue()
        : r.abort(),
    );
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.locator("#fzIntroSkip").click();
    assert.equal(await page.locator("#fzConnection").isVisible(), false);
    await page.click("#authTabReg");
    await page.fill("#regUsername", "PhoneReady" + Date.now());
    await page.fill("#regPassword", "phone-ready-local");
    await page.fill("#regPasswordConfirm", "phone-ready-local");
    await page.click("#registerForm .auth-submit-btn");
    await page.waitForSelector("#serverScreen", { state: "visible" });
    await page.click(".fz-play");
    await page.waitForFunction(
      () => window.FZUI?.playing() && cityWorldReady(),
      {},
      { timeout: 120000 },
    );
    await page.waitForFunction(
      () => !window._loadingGate && window.FZSky?.active(),
    );
    await page.evaluate(() => FZSky.descend());
    await page.locator("#cityIntroSkip").click();
    await page.waitForFunction(() => !window.cine);
    await page.waitForSelector("#fzTouch", { state: "visible" });
    await page.waitForTimeout(1500); // let first city shader compilation settle in software WebGL
    // Short tap wholly between frames: both events dispatched in one JS task.
    await page.evaluate(() => {
      FZPlay.release();
      localPlayer.mesh.position.set(131, 0, -30);
      isGrounded = true;
      velocity.y = 0;
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          code: "Space",
          key: " ",
          bubbles: true,
        }),
      );
      document.dispatchEvent(
        new KeyboardEvent("keyup", { code: "Space", key: " ", bubbles: true }),
      );
    });
    await page.waitForFunction(() => localPlayer.mesh.position.y > 0.1);
    await page.waitForFunction(() => isGrounded);
    assert(await page.evaluate(() => FZJourney.savePlace("Моя площадь")));
    const saved = await page.evaluate(() => FZJourney.info());
    assert.equal(saved.data.places.length, 1);
    assert(await page.evaluate(() => FZGuide.start("first")));
    await page.evaluate(() => {
      const s = FZGuide.info(),
        p = s.places.find((p) => p.id === s.route.ids[0]);
      localPlayer.mesh.position.set(p.x, 0, p.z);
    });
    await page.waitForFunction(() => FZGuide.info().pending?.index === 1);
    await page.evaluate(() => {
      localPlayer.mesh.position.set(131, 0, -30);
      FZGuide.pause();
    });
    await page.click("#fzUIOpen");
    await page.fill("#fzUISearch", "Мой город");
    await page.locator("#fzUIList button").click();
    await page.waitForSelector("#fzJourney", { state: "visible" });
    const before = await page.evaluate(() => ({
      p: localPlayer.mesh.position.toArray(),
      h: cameraAngleH,
      v: cameraAngleV,
      zoom: CONFIG.CAMERA_DISTANCE,
    }));
    await page.evaluate(() => {
      document
        .querySelector("#fzJourney h2")
        .dispatchEvent(new WheelEvent("wheel", { deltaY: 200, bubbles: true }));
      document.dispatchEvent(
        new KeyboardEvent("keydown", { code: "KeyW", bubbles: true }),
      );
      document.dispatchEvent(
        new KeyboardEvent("keydown", { code: "Space", bubbles: true }),
      );
      document.dispatchEvent(
        new MouseEvent("mousemove", {
          movementX: 200,
          movementY: 100,
          bubbles: true,
        }),
      );
    });
    await page.waitForTimeout(200);
    assert.deepEqual(
      await page.evaluate(() => ({
        p: localPlayer.mesh.position.toArray(),
        h: cameraAngleH,
        v: cameraAngleV,
        zoom: CONFIG.CAMERA_DISTANCE,
      })),
      before,
      "menu never drives movement/camera",
    );
    await page.locator("#fzJourney details").first().locator("summary").click();
    const downloadPromise = page.waitForEvent("download");
    await page.click("#fzJourney [data-export]");
    const download = await downloadPromise,
      backup = fs.readFileSync(await download.path(), "utf8");
    assert.equal(JSON.parse(backup).journal.pending.index, 1);
    assert(!backup.includes("password"));
    await page.locator("#fzJourney [data-import]").setInputFiles({
      name: "city.json",
      mimeType: "application/json",
      buffer: Buffer.from(backup),
    });
    await page.waitForSelector("#fzJourney [data-confirm]", {
      state: "visible",
    });
    await page.click("#fzJourney [data-confirm]");
    assert.equal(
      await page.evaluate(() => FZJourney.info().data.places.length),
      1,
    );
    await page.locator("#fzJourney [data-import]").setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from("{"),
    });
    await page.waitForFunction(() =>
      document
        .querySelector("#fzJourney [data-status]")
        .textContent.includes("JSON"),
    );
    assert.equal(
      await page.locator("#fzJourney [data-confirm]").isVisible(),
      false,
    );
    // Actual visualViewport position/height binding, including keyboard-style offset.
    assert(
      await page.evaluate(
        () =>
          parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue(
              "--fz-viewport-height",
            ),
          ) === Math.round(visualViewport.height),
      ),
    );
    for (const size of [
      { width: 320, height: 700 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(size);
      await page.waitForFunction(
        () =>
          parseFloat(
            document.documentElement.style.getPropertyValue(
              "--fz-viewport-height",
            ),
          ) === Math.round(visualViewport.height),
      );
      const r = await page.locator("#fzJourney .fz-play-card").boundingBox();
      assert(
        r.x >= 0 &&
          r.width <= size.width &&
          r.y >= 0 &&
          r.y + r.height <= size.height + 1,
        JSON.stringify({
          r,
          size,
          v: await page.evaluate(() => ({
            h: innerHeight,
            w: innerWidth,
            vh: visualViewport.height,
            vt: visualViewport.offsetTop,
          })),
        }),
      );
    }
    await page.click("#fzJourney [data-close]");
    assert.equal(
      await page.evaluate(() => {
        isInFactory = true;
        const ok = FZJourney.resume("last");
        isInFactory = false;
        return ok;
      }),
      false,
      "cannot leave lab via bookmark",
    );
    const account = await page.evaluate(() => currentUser.username);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("#fzIntroSkip").click();
    await page.waitForSelector("#serverScreen", { state: "visible" });
    await page.click(".fz-play");
    await page.waitForFunction(
      () =>
        FZUI.playing() &&
        cityWorldReady() &&
        !window._loadingGate &&
        FZSky.active(),
      {},
      { timeout: 120000 },
    );
    assert.equal(await page.evaluate(() => FZJourney.info().user), account);
    assert.equal(
      await page.evaluate(() => FZJourney.info().data.places.length),
      1,
    );
    assert.equal(
      await page.evaluate(() => FZGuide.exportState().pending.index),
      1,
    );
    assert.equal(
      await page.evaluate(() => FZGuide.info().route),
      null,
      "walk never auto-starts after login",
    );
    await page.evaluate(() => FZJourney.open());
    await page.click("#fzJourney [data-places] button:first-of-type");
    assert.equal(
      await page.evaluate(() => window.cameraMode),
      "first",
      "saved-place resume still uses the white-light descent",
    );
    await page.locator("#cityIntroSkip").click();
    await page.waitForFunction(() => !window.cine && !FZSky.active());
    assert(
      await page.evaluate(
        () =>
          Math.hypot(
            localPlayer.mesh.position.x - 131,
            localPlayer.mesh.position.z + 30,
          ) < 0.1,
      ),
    );
    assert(await page.evaluate(() => FZGuide.start("first", true)));
    assert.equal(await page.evaluate(() => FZGuide.info().route.index), 1);
    // Closing a dialog invalidates an in-flight file read (no stale confirmation).
    assert(
      await page.evaluate(async () => {
        FZJourney.open();
        let finish;
        const text = JSON.stringify(FZJourney.snapshot());
        const task = FZJourney.importFile({
          size: text.length,
          text: () =>
            new Promise((resolve) => {
              finish = resolve;
            }),
        });
        FZJourney.close();
        finish(text);
        return (await task) === false;
      }),
    );
    // A logout/server exit cancels the arrival callback before deleting the player.
    assert(
      await page.evaluate(() => {
        FZSky.spawn(localPlayer.mesh);
        const started = FZJourney.resume("last");
        backToServers();
        return started && !FZSky.info().flight && localPlayer === null;
      }),
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS v15 browser: short-tap jump, saved place, pause/reload/resume itinerary, isolated menu input, JSON export/import/errors, 320px/landscape layout, lab guard, sky-first rejoin and first-person saved-place descent; no page errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
