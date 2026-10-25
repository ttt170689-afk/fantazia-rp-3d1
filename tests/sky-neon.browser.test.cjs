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
    });
    p.on("pageerror", (e) => errors.push(e.stack));
    p.on("console", (m) => {
      if (
        m.type() === "error" &&
        /THREE.WebGLProgram|VALIDATE_STATUS/.test(m.text())
      )
        errors.push(m.text());
    });
    await p.emulateMedia({ reducedMotion: "no-preference" });
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
    await p.fill("#regUsername", "Neon" + Date.now());
    await p.fill("#regPassword", "local-test");
    await p.fill("#regPasswordConfirm", "local-test");
    await p.click("#registerForm .auth-submit-btn");
    await p.waitForSelector("#serverScreen", { state: "visible" });
    await p.click(".fz-play");
    await p.waitForFunction(
      () =>
        FZSky.info().neon?.strength === 1 &&
        !window._loadingGate &&
        FZSky.info().garden.brand,
      {},
      { timeout: 120000 },
    );
    assert.equal(await p.evaluate(() => FZSky.info().neon.routeArrows), 13);
    await p.tap("#fzUIOpen");
    await p.fill("#fzUISearch", "неон");
    await p.locator("#fzUIList button").tap();
    await p.waitForSelector("#fzPlayPanel", { state: "visible" });
    await p.selectOption("[data-pref=quality]", "balanced");
    const slider = p.locator("[data-pref=neonBrightness]");
    await slider.focus();
    await slider.press("Home");
    await p.waitForFunction(() => FZSky.info().neon.strength === 0.35);
    assert.equal(
      await p.locator("[data-value=neonBrightness]").innerText(),
      "35%",
    );
    assert.equal(
      await p.evaluate(
        () => scene.getObjectByName("sky_stage_light_wave").material.color.r,
      ),
      0.35,
    );
    assert.equal(
      await p.evaluate(() =>
        scene.getObjectByName("sky_route_label_news").material.color.getHex(),
      ),
      0xffffff,
    );
    await slider.press("End");
    await p.waitForFunction(() => FZSky.info().neon.strength === 1.3);
    assert.equal(
      await p.locator("[data-value=neonBrightness]").innerText(),
      "130%",
    );
    await p.uncheck("[data-pref=neonMotion]");
    await p.waitForFunction(() => !FZSky.info().neon.motion);
    const matrices = () =>
      p.evaluate(() =>
        Array.from(
          scene.getObjectByName("sky_stage_light_wave").instanceMatrix.array,
        ),
      );
    const still = await matrices();
    await p.waitForTimeout(450);
    assert.deepEqual(await matrices(), still);
    await p.check("[data-pref=neonMotion]");
    await p.waitForFunction(() => FZSky.info().neon.motion);
    await p.waitForTimeout(450);
    assert.notDeepEqual(await matrices(), still);
    await p.check("[data-pref=reduceMotion]");
    await p.waitForFunction(() => !FZSky.info().neon.motion);
    await p.uncheck("[data-pref=reduceMotion]");
    await p.waitForFunction(() => FZSky.info().neon.motion);
    await p.emulateMedia({ reducedMotion: "reduce" });
    await p.waitForFunction(() => !FZSky.info().neon.motion);
    await p.emulateMedia({ reducedMotion: "no-preference" });
    await p.waitForFunction(() => FZSky.info().neon.motion);
    await p.selectOption("[data-pref=quality]", "battery");
    await p.waitForFunction(() => !FZSky.info().neon.motion);
    await p.selectOption("[data-pref=quality]", "balanced");
    await p.waitForFunction(() => FZSky.info().neon.motion);
    await slider.focus();
    await slider.press("Home");
    await p.uncheck("[data-pref=neonMotion]");
    await p.screenshot({ path: "/home/user/v21-neon-settings.png" });
    await p.click("#fzPlayPanel [data-close]");
    await p.evaluate(() => {
      localPlayer.mesh.position.set(14, 360, -1410.5);
      checkInteractables();
      FZTouch.update();
    });
    await p.waitForFunction(() => FZSky.info().neon.selected === "news");
    await p.tap("#fzTouchUse");
    await p.waitForSelector("#newsModal", { state: "visible" });
    await p.tap("#newsModal .news-close");
    await p.evaluate(() => {
      localPlayer.mesh.position.set(18, 359.25, -1389.2);
      checkInteractables();
      FZTouch.update();
    });
    await p.waitForFunction(() => FZSky.info().neon.selected === "city");
    await p.tap("#fzTouchUse");
    await p.waitForFunction(() => FZSky.busy());
    await p.tap("#cityIntroSkip");
    await p.waitForFunction(() => !cine && !FZSky.active());
    assert.equal(await p.evaluate(() => camera.layers.mask), 1);
    const saved = await p.evaluate(() =>
      JSON.parse(localStorage.getItem("fz_play_v13")),
    );
    assert.equal(saved.neonBrightness, 0.35);
    assert.equal(saved.neonMotion, false);
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.click("#fzIntroSkip");
    assert.deepEqual(await p.evaluate(() => FZPlay.info().prefs), saved);
    assert.deepEqual(errors, []);
    console.log(
      "PASS neon controls: real slider bounds/output/material response, unchanged label contrast, static/animated wave, user/OS/battery motion guards, both marked destinations and interactions, city restoration and saved preferences after reload.",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
