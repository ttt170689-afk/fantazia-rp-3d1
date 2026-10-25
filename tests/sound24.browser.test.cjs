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
    const base = process.env.GAME_URL || "http://127.0.0.1:3000";
    const p = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const errors = [],
      badAudio = [];
    p.on("pageerror", (e) => errors.push(e.stack));
    p.on("response", (r) => {
      if (r.url().includes("/audio/") && r.status() >= 400)
        badAudio.push(r.url());
    });
    await p.route("**/*", (r) =>
      r.request().url().startsWith(base) ||
      /^(blob|data):/.test(r.request().url())
        ? r.continue()
        : r.abort(),
    );
    await p.goto(base, { waitUntil: "domcontentloaded" });
    assert.equal(await p.evaluate(() => FZSound.info().unlocked), false);
    assert.equal(
      await p.evaluate(() => FZSound.info().buffers),
      0,
      "no pre-gesture soundtrack downloads",
    );
    await p.tap("#fzIntroSkip");
    await p.tap("#authTabReg");
    await p.fill("#regUsername", "SoundTest" + Date.now());
    await p.fill("#regPassword", "local-test");
    await p.fill("#regPasswordConfirm", "local-test");
    await p.tap("#registerForm .auth-submit-btn");
    await p.waitForSelector("#serverScreen", { state: "visible" });
    await p.waitForFunction(
      () => FZSound.info().track === "neon-route" && FZSound.info().playing,
    );
    await p.evaluate(() => {
      FZSound.stopVoice();
      window._testAnalyser = getAudioCtx().createAnalyser();
      _testAnalyser.fftSize = 2048;
      FZSound.bus("music").connect(_testAnalyser);
    });
    await p.waitForFunction(() => {
      const data = new Float32Array(2048);
      _testAnalyser.getFloatTimeDomainData(data);
      return data.some((n) => Math.abs(n) > 0.001);
    });
    await p.evaluate(() => FZSound.open());
    assert(await p.locator("#fzSoundPanel").isVisible());
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await p.locator('[data-level="music"]').fill("0.55");
    assert.equal(await p.evaluate(() => FZSound.info().prefs.music), 0.55);
    for (const track of ["above-clouds", "last-train", "neon-route"]) {
      await p.tap('[data-track="' + track + '"]');
      await p.waitForFunction(
        (t) => FZSound.info().track === t && FZSound.info().playing,
        track,
      );
      assert((await p.evaluate(() => FZSound.info().loops)) <= 2);
    }
    await p.locator("#fzSoundPanel [data-bg]").uncheck();
    await p.waitForFunction(() => !FZSound.info().playing);
    assert.equal(await p.evaluate(() => SETTINGS.bgMusic), false);
    await p.locator("#fzSoundPanel [data-bg]").check();
    await p.waitForFunction(() => FZSound.info().playing);
    await p.tap('[data-voice="welcome"]');
    await p.waitForFunction(
      () => FZSound.info().ducked && FZSound.info().voice === "welcome",
    );
    await p.waitForFunction(() => FZSound.info().gains.music < 0.2);
    await p.tap('[data-effect="doors"]');
    assert((await p.evaluate(() => FZSound.info().sources)) > 0);
    await p.screenshot({ path: "/home/user/sound24-phone.png" });
    await p.locator("#fzSoundPanel [data-enabled]").uncheck();
    await p.waitForFunction(() => FZSound.info().masterGain === 0);
    assert.equal(await p.evaluate(() => FZSound.info().sources), 0);
    assert.equal(await p.evaluate(() => FZSound.info().playing), false);
    await p.locator("#fzSoundPanel [data-enabled]").check();
    await p.waitForFunction(() => FZSound.info().playing);
    await p.locator("#fzSoundPanel [data-close]").tap();
    // Genuine native intro replay should get a new spoken credit, not a one-time flag.
    await p.evaluate(() => FZFront.start());
    await p.waitForFunction(
      () =>
        FZSound.info().zone === "intro" && FZSound.info().voice === "credit",
    );
    await p.tap("#fzIntroSkip");
    await p.waitForFunction(() => FZSound.info().zone === "lobby");
    await p.tap(".fz-play");
    await p.waitForFunction(
      () => FZSky.active() && !window._loadingGate,
      {},
      { timeout: 120000 },
    );
    await p.waitForFunction(
      () =>
        FZSound.info().zone === "sky" &&
        FZSound.info().track === "above-clouds",
    );
    await p.tap("#fzUIOpen");
    await p.fill("#fzUISearch", "Настройки звука");
    await p.locator("#fzUIList button").tap();
    assert(await p.locator("#fzSoundPanel").isVisible());
    assert.equal(await p.evaluate(() => FZTouch.blocked()), true);
    await p.keyboard.press("Tab");
    assert(
      await p.evaluate(
        () => document.activeElement.closest("#fzSoundPanel") !== null,
      ),
    );
    await p.keyboard.press("Escape");
    assert.equal(await p.locator("#fzSoundPanel").isVisible(), false);
    await p.evaluate(() => {
      FZSound.set({ footsteps: true });
      window._soundHits = {};
      const original = FZSound.effect;
      FZSound.effect = (name, options) => {
        _soundHits[name] = (_soundHits[name] || 0) + 1;
        return original(name, options);
      };
    });
    await p.tap("#fzUIFlash");
    assert((await p.evaluate(() => _soundHits.flash)) > 0);
    await p.keyboard.down("w");
    await p.waitForFunction(() => _soundHits.step > 0);
    await p.keyboard.up("w");
    await p.evaluate(() => FZSky.descend());
    await p.waitForSelector("#cityIntroSkip", { state: "visible" });
    await p.tap("#cityIntroSkip");
    await p.waitForFunction(() => !FZSky.active() && !window.cine);
    await p.waitForFunction(() => FZSound.info().zone === "city");
    await p.evaluate(() => {
      const e = FZMetro.info().stations[0];
      localPlayer.mesh.position.set(e.x, 0, e.z + 4);
      FZMetro.enter(0);
    });
    await p.waitForFunction(
      () =>
        FZSound.info().zone === "metro" &&
        FZSound.info().track === "last-train",
    );
    await p.waitForFunction(
      () => FZMetroAudio.info().playing && FZSound.info().ducked,
    );
    assert.equal(
      await p.evaluate(() => FZSound.info().voice),
      "",
      "metro preempts city narration",
    );
    await p.evaluate(() => FZSound.set({ voice: 0 }));
    assert.equal(await p.evaluate(() => FZMetroAudio.info().playing), false);
    await p.evaluate(() => FZSound.set({ voice: 0.9 }));
    // Simulate visibility state/event, verifying graph cleanup rather than physical OS audio behavior.
    await p.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await p.waitForFunction(() => FZSound.info().masterGain === 0);
    assert.equal(await p.evaluate(() => FZSound.info().sources), 0);
    assert.equal(await p.evaluate(() => FZMetroAudio.info().playing), false);
    await p.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await p.waitForFunction(() => FZSound.info().playing);
    await p.evaluate(() => backToServers());
    await p.waitForFunction(() => FZSound.info().zone === "lobby");
    assert.equal(await p.evaluate(() => FZMetroAudio.info().active), false);
    assert((await p.evaluate(() => FZSound.info().buffers)) <= 3);
    await p.evaluate(() => FZSound.set({ enabled: false }));
    await p.reload({ waitUntil: "domcontentloaded" });
    assert.equal(await p.evaluate(() => FZSound.info().prefs.enabled), false);
    assert.equal(await p.evaluate(() => FZSound.info().prefs.music), 0.55);
    assert.equal(await p.evaluate(() => FZSound.info().unlocked), false);
    assert.deepEqual(errors, []);
    assert.deepEqual(badAudio, []);
    console.log(
      "PASS sound24: no pre-gesture downloads, decoded/nonzero music, three bounded loops, actual voice ducking, mobile mixer/focus/input, mute/persistence, replay credit, sky/city/metro zones, metro voice priority, visibility cleanup and logout; zero pageerrors.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
