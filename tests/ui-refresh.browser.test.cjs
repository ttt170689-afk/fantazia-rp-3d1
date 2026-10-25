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
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 1,
      acceptDownloads: true,
    });
    p.on("pageerror", (e) => errors.push(e.stack));
    const base = process.env.GAME_URL || "http://127.0.0.1:3000";
    await p.route("**/*", (r) =>
      r.request().url().startsWith(base) ||
      /^(blob|data):/.test(r.request().url())
        ? r.continue()
        : r.abort(),
    );
    await p.goto(base, { waitUntil: "domcontentloaded" });
    await p.click("#fzIntroSkip");
    await p.click("#authTabReg");
    await p.fill("#regUsername", "Buttons" + Date.now());
    await p.fill("#regPassword", "local-test");
    await p.fill("#regPasswordConfirm", "local-test");
    await p.click("#registerForm .auth-submit-btn");
    await p.waitForSelector("#serverScreen", { state: "visible" });
    await p.click(".fz-play");
    await p.waitForFunction(
      () =>
        FZSky.info().look?.active &&
        !window._loadingGate &&
        FZSky.info().garden.brand,
      {},
      { timeout: 120000 },
    );
    await p.waitForTimeout(1200);
    assert.equal(
      await p.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--fz-neon-cyan")
          .trim(),
      ),
      "#61dcff",
    );
    assert.equal(
      await p.evaluate(() => FZSky.info().garden.theme),
      "neon-cyan-magenta",
    );
    assert.equal(
      await p.evaluate(() => {
        let count = 0;
        scene.getObjectByName("sky_garden_architecture").traverse((o) => {
          if (o.name === "sky_neon_light_pool") {
            if (o.material.depthWrite)
              throw Error("Neon must not occlude objects");
            count++;
          }
        });
        return count;
      }),
      4,
    );
    assert.equal(
      await p.evaluate(() => FZSky.info().garden.leafInstances),
      1120,
    );
    assert.equal(await p.evaluate(() => FZSky.info().look.shadows), false);
    for (const size of [
      { width: 320, height: 740 },
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await p.setViewportSize(size);
      await p.waitForTimeout(300);
      const bad = await p.evaluate(() =>
        [
          ...document.querySelectorAll(
            "#fzUIBar button,#fzTouchActions button,#fzTouchMore",
          ),
        ]
          .filter((e) => {
            const r = e.getBoundingClientRect();
            return (
              r.width < 40 ||
              r.height < 40 ||
              r.x < 0 ||
              r.right > innerWidth + 0.5 ||
              r.bottom > innerHeight + 0.5
            );
          })
          .map((e) => ({
            id: e.id,
            text: e.textContent,
            rect: e.getBoundingClientRect().toJSON(),
          })),
      );
      assert.deepEqual(bad, [], JSON.stringify(size));
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await p.waitForTimeout(300);
    await p.screenshot({ path: "/home/user/v19-phone.png" });
    const light = await p.evaluate(() => DLC.flashOn);
    await p.tap("#fzUIFlash");
    await p.waitForFunction((v) => DLC.flashOn !== v, light);
    assert.equal(
      await p.getAttribute("#fzUIFlash", "aria-pressed"),
      String(!light),
    );
    await p.tap("#fzUIFlash");
    await p.waitForFunction((v) => DLC.flashOn === v, light);
    await p.tap("#fzUINews");
    await p.waitForSelector("#newsModal", { state: "visible" });
    assert.equal(await p.locator("#fzTouch").isVisible(), false);
    await p.tap("#newsModal .news-close");
    await p.waitForSelector("#fzTouchRun", { state: "visible" });
    await p.tap("#fzTouchRun");
    assert.equal(await p.getAttribute("#fzTouchRun", "aria-pressed"), "true");
    await p.tap("#fzTouchCrouch");
    assert.equal(
      await p.getAttribute("#fzTouchCrouch", "aria-pressed"),
      "true",
    );
    assert.equal(await p.getAttribute("#fzTouchRun", "aria-pressed"), "false");
    await p.tap("#fzTouchCrouch");
    await p.tap("#fzUIOpen");
    assert.equal(await p.getAttribute("#fzUIOpen", "aria-expanded"), "true");
    assert.equal(await p.locator("#fzTouch").isVisible(), false);
    for (const category of ["player", "activities", "settings", "city"]) {
      await p.tap(`[data-section="${category}"]`);
      assert.equal(
        await p.getAttribute(`[data-section="${category}"]`, "aria-pressed"),
        "true",
      );
      assert((await p.locator("#fzUIList button").count()) > 0);
    }
    assert.equal(
      await p.locator("#fzUIList button svg").count(),
      await p.locator("#fzUIList button").count(),
    );
    await p.screenshot({ path: "/home/user/v19-menu-phone.png" });
    await p.fill("#fzUISearch", "Новости");
    assert.equal(await p.locator("#fzUIList button").count(), 1);
    await p.locator("#fzUIList button").tap();
    await p.waitForSelector("#newsModal", { state: "visible" });
    assert.equal(await p.locator("#fzUIMenu").isVisible(), false);
    await p.tap("#newsModal .news-close");
    await p.tap("#fzUIOpen");
    await p.fill("#fzUISearch", "Сделать фото");
    await p.locator("#fzUIList button").tap();
    await p.waitForSelector("#fzPhoto", { state: "visible" });
    const download = p.waitForEvent("download");
    await p.click("#fzPhoto [data-download]");
    const d = await download;
    assert(/\.png$/i.test(d.suggestedFilename()));
    assert.equal(await d.failure(), null);
    await p.click("#fzPhoto [data-close]");
    await p.tap("#fzUIOpen");
    await p.fill("#fzUISearch", "Спуститься");
    await p.locator("#fzUIList button").tap();
    await p.waitForFunction(() => FZSky.busy());
    assert.equal(await p.evaluate(() => cameraMode), "first");
    await p.tap("#cityIntroSkip");
    await p.waitForFunction(() => !cine && !FZSky.active());
    assert.equal(await p.evaluate(() => camera.layers.mask), 1);
    assert.deepEqual(errors, []);
    console.log(
      "PASS UI/neon: 320/390/844 viewport targets, real flashlight/news/menu/search/category handlers, SVG icons, run/crouch, modal input blocking, PNG download and first-person descent.",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
