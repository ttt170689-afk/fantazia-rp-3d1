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
      viewport: { width: 844, height: 390 },
      hasTouch: true,
      isMobile: true,
      reducedMotion: "reduce",
    });
    await ctx.addInitScript(() => {
      const native = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return /webgl/i.test(type) ? null : native.call(this, type, ...args);
      };
    });
    const page = await ctx.newPage(),
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
    await page.waitForFunction(() => window.FZFront);
    await page.waitForFunction(() => FZFront.info().failed);
    assert(await page.evaluate(() => FZFront.info().failed));
    await page.waitForSelector("#fzIntro", {
      state: "detached",
      timeout: 10000,
    });
    assert(await page.locator("#authTabReg").isVisible());
    await page.tap("#authTabReg");
    await page.fill("#regUsername", "FallbackOnly");
    await page.fill("#regPassword", "not-submitted");
    await page.locator("#regPasswordConfirm").scrollIntoViewIfNeeded();
    await page.fill("#regPasswordConfirm", "not-submitted");
    // Replay and dismiss must work even without a GPU; no invisible overlay survives.
    await page.evaluate(() => FZFront.start());
    await page.tap("#fzIntroSkip");
    assert.equal(await page.locator("#fzIntro").count(), 0);
    assert.equal(
      await page.evaluate(() => document.getElementById("authScreen").inert),
      false,
    );
    assert.equal(await page.locator("#fzTouch").isVisible(), false);
    assert.deepEqual(errors, []);
    console.log(
      "PASS intro fallback: WebGL unavailable, reduced motion, landscape registration scrolling, replay, skip, focus/auth recovery.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
