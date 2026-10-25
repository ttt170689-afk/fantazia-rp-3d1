// Restoring the classic UI must not undo the city, loading or touch modules.
const assert = require("node:assert/strict");
const { chromium } = require("playwright-core");
(async () => {
  const c = require("@sparticuz/chromium");
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_EXECUTABLE || (await c.executablePath()),
    args: c.args,
    headless: true,
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      reducedMotion: "reduce",
    });
    await context.addInitScript(() =>
      localStorage.setItem("fz_seen_city_intro_v9", "1"),
    );
    const page = await context.newPage(),
      errors = [];
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
      () => window.FZFront && window.FZTouch && window.FZCITY,
    );
    await page.waitForSelector("#fzIntroSkip");
    await page.click("#fzIntroSkip");
    assert.equal(await page.locator(".front-welcome").count(), 0);
    assert.equal(
      await page.evaluate(() => FZFront.info().renderer),
      false,
      "3D scene is intro-only",
    );
    assert.equal(await page.locator(".auth-bolt").textContent(), "⚡");
    const card = await page.locator(".auth-card").boundingBox();
    assert(
      Math.abs(card.x + card.width / 2 - 640) < 2,
      "classic centred login",
    );
    assert.equal(
      await page.evaluate(
        () =>
          getComputedStyle(document.querySelector("#authScreen"))
            .backgroundColor,
      ),
      "rgb(10, 2, 3)",
    );
    assert.equal(await page.evaluate(() => window.FZ_CLASSIC_WORLD), true);
    assert.equal(await page.evaluate(() => FZCITY.info().districts.length), 10);
    await page.screenshot({ path: "/home/user/classic-login-restored.png" });
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      await page.click("#authTabReg");
      await page.locator("#regPasswordConfirm").scrollIntoViewIfNeeded();
      await page.fill("#regPasswordConfirm", "scroll-test");
      await page
        .locator("#registerForm .auth-submit-btn")
        .scrollIntoViewIfNeeded();
      const button = await page
        .locator("#registerForm .auth-submit-btn")
        .boundingBox();
      assert(
        button.y >= 0 && button.y + button.height <= viewport.height + 1,
        "registration accessible in portrait and landscape",
      );
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "no horizontal overflow",
      );
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.fill("#regUsername", "ClassicUI" + Date.now());
    await page.fill("#regPassword", "classic-local-test");
    await page.fill("#regPasswordConfirm", "classic-local-test");
    await page.click("#registerForm .auth-submit-btn");
    await page.waitForSelector("#serverScreen", {
      state: "visible",
      timeout: 15000,
    });
    await page.waitForTimeout(700);
    assert.match(await page.locator(".fz-play").textContent(), /ИГРАТЬ/);
    const menu = await page.locator(".fz-menu-nav").boundingBox();
    assert(
      Math.abs(menu.x + menu.width / 2 - 640) < 2,
      "classic centred main menu",
    );
    assert(await page.locator("#menuCityCanvas").isVisible());
    assert.equal(await page.evaluate(() => FZFront.info().renderer), false);
    await page.screenshot({ path: "/home/user/classic-menu-restored.png" });
    await page
      .getByRole("button", { name: "Заставка ↗", exact: true })
      .click();
    await page.waitForSelector("#fzIntroSkip");
    await page.click("#fzIntroSkip");
    assert.equal(
      await page.evaluate(() => FZFront.info().renderer),
      false,
      "intro GPU disposed on return to classic menu",
    );
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      for (const selector of [".fz-play", ".fz-exit"]) {
        await page.locator(selector).scrollIntoViewIfNeeded();
        const b = await page.locator(selector).boundingBox();
        assert(
          b.y >= 0 && b.y + b.height <= viewport.height + 1,
          "menu buttons reachable",
        );
      }
    }
    await page.click(".fz-exit");
    await page.waitForSelector("#authScreen", { state: "visible" });
    assert.equal(await page.evaluate(() => FZFront.info().renderer), false);
    assert.deepEqual(errors, []);
    console.log(
      "PASS classic centred login/menu, original palette, Play label, mobile scrolling, replay, logout, original world and touch modules preserved.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
