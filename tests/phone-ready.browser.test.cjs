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
    await page.waitForFunction(() => !window._loadingGate && window.FZSky?.active());
    await page.evaluate(() => FZSky.descend());
    await page.locator("#cityIntroSkip").click();
    await page.waitForFunction(() => !window.cine);
    await page.waitForSelector("#fzTouch", { state: "visible" });
    assert(await page.evaluate(() => FZPlay.managed()));
    assert(await page.evaluate(() => renderer.getPixelRatio() <= 1));
    assert.equal(await page.evaluate(() => SETTINGS.fpsCap), 30);
    await page.click("#fzUIOpen");
    assert.notEqual(
      await page.evaluate(() => document.activeElement.id),
      "fzUISearch",
      "menu does not force open phone keyboard",
    );
    await page.fill("#fzUISearch", "Настройки игры на телефоне");
    await page.locator("#fzUIList button").click();
    await page.waitForSelector("#fzPlayPanel", { state: "visible" });
    await page.selectOption("#fzPlayPanel [data-pref=quality]", "balanced");
    await page.check("#fzPlayPanel [data-pref=leftHand]");
    await page.locator("#fzPlayPanel [data-pref=size]").evaluate((el) => {
      el.value = "1.2";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.check("#fzPlayPanel [data-pref=reduceMotion]");
    await page.screenshot({ path: "/home/user/phone-comfort.png" });
    await page.click("#fzPlayPanel [data-close]");
    await page.waitForSelector("#fzTouch", { state: "visible" });
    for (const size of [
      { width: 390, height: 844 },
      { width: 320, height: 700 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(size);
      await page.waitForTimeout(150);
      const boxes = await page.evaluate(() => {
        const a = document
            .getElementById("fzTouchStick")
            .getBoundingClientRect(),
          b = document.getElementById("fzTouchActions").getBoundingClientRect();
        return {
          stick: { left: a.left, right: a.right, bottom: a.bottom },
          actions: { left: b.left, right: b.right, bottom: b.bottom },
          w: innerWidth,
          h: innerHeight,
        };
      });
      assert(
        boxes.stick.left >= boxes.actions.right,
        "left-handed controls do not overlap",
      );
      assert(
        boxes.stick.right <= boxes.w &&
          boxes.actions.left >= 0 &&
          boxes.stick.bottom <= boxes.h &&
          boxes.actions.bottom <= boxes.h,
      );
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      keys.KeyW = true;
      keys.Space = true;
      window.dispatchEvent(new Event("blur"));
    });
    assert(
      await page.evaluate(
        () => !keys.KeyW && !keys.Space && !FZTouch.info().moving,
      ),
    );
    // Real directory uses current native entrance positions, not stale fixed landmarks.
    await page.click("#fzUIOpen");
    await page.fill("#fzUISearch", "места, избранное");
    await page.locator("#fzUIList button").click();
    const mapSize = await page.locator("#fzCityGuide canvas").boundingBox();
    assert(
      Math.abs(mapSize.width / mapSize.height - 760 / 360) < 0.05,
      "map is not stretched to viewport by legacy CSS",
    );
    await page.fill("#fzCityGuide [data-search]", "GRAND MALL");
    await page.locator("#fzCityGuide .fz-guide-row button").nth(1).click();
    assert.equal(await page.evaluate(() => FZGuide.info().favorites.length), 1);
    await page.screenshot({ path: "/home/user/phone-city-guide.png" });
    const before = await page.evaluate(() =>
      localPlayer.mesh.position.toArray(),
    );
    await page.locator("#fzCityGuide .fz-guide-row button").first().click();
    assert.deepEqual(
      await page.evaluate(() => localPlayer.mesh.position.toArray()),
      before,
      "pinning never teleports",
    );
    assert(
      await page.evaluate(() => {
        const e = interactables.find((e) => e.type === "mall");
        return navTarget.x === e.position.x && navTarget.z === e.position.z;
      }),
    );
    // Exercise progression with seeded checkpoint positions, not a claim of physically walking the route.
    assert(await page.evaluate(() => FZGuide.start("first")));
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        const s = FZGuide.info(),
          e = s.places.find((e) => e.id === s.route.ids[s.route.index]);
        localPlayer.mesh.position.set(e.x, 0, e.z);
      });
      await page.waitForFunction(
        (i) => !FZGuide.info().route || FZGuide.info().route.index > i,
        i,
      );
    }
    assert(
      await page.evaluate(() => FZGuide.info().completed.includes("first")),
    );
    await page.evaluate(() => {
      isInFactory = true;
    });
    assert.equal(
      await page.evaluate(() => FZPlay.rescue()),
      false,
      "no quest bypass",
    );
    await page.evaluate(() => {
      isInFactory = false;
    });
    assert(await page.evaluate(() => FZPlay.rescue()));
    assert.equal(await page.evaluate(() => FZPlay.rescue()), false, "cooldown");
    assert(
      await page.evaluate(
        () =>
          !checkCollision(
            localPlayer.mesh.position.x,
            localPlayer.mesh.position.z,
          ),
      ),
    );
    // Actual Socket.IO disconnect/reconnect: keep avatar and position; server stats remain authoritative.
    const old = await page.evaluate(() => {
      localPlayer.mesh.position.x += 3;
      return {
        id: localPlayer.mesh.uuid,
        p: localPlayer.mesh.position.toArray(),
      };
    });
    await page.evaluate(() => socket.disconnect());
    await page.waitForSelector("#fzConnection", {
      state: "visible",
      timeout: 15000,
    });
    await page.evaluate(() => socket.connect());
    await page.waitForFunction(
      () => socket.connected && localPlayer.id === socket.id,
    );
    assert.deepEqual(
      await page.evaluate(() => ({
        id: localPlayer.mesh.uuid,
        p: localPlayer.mesh.position.toArray(),
      })),
      old,
    );
    await page.waitForSelector("#fzConnection", { state: "hidden" });
    // A new native renderer must keep controls/lifecycle hooks; custom quality releases the light override.
    await page.evaluate(() => {
      FZFX.setTier("low", true);
      FZPlay.set("quality", "custom");
      applySetting("shaderQuality", "medium");
    });
    assert.equal(
      await page.locator("#fz8Panel").isVisible(),
      false,
      "silent tier never opens a dialog",
    );
    assert(
      await page.evaluate(
        () =>
          !FZPlay.managed() &&
          !window._perfMaxLights &&
          SETTINGS.maxLights === 8,
      ),
    );
    assert(
      await page.evaluate(() => {
        const old = renderer;
        applyAntialiasing();
        return renderer !== old;
      }),
    );
    await page.evaluate(() => FZPlay.set("quality", "balanced"));
    // Context loss simulation using the actual WebGL extension.
    const supportsLoss = await page.evaluate(
      () => !!renderer.getContext().getExtension("WEBGL_lose_context"),
    );
    if (supportsLoss) {
      await page.evaluate(() => renderer.forceContextLoss());
      await page.waitForSelector("#fzGpuRecovery", { state: "visible" });
      assert(await page.evaluate(() => FZPlay.paused()));
      await page.evaluate(() => renderer.forceContextRestore());
      await page.waitForFunction(
        () => !FZPlay.info().lost,
        {},
        { timeout: 20000 },
      );
      await page.waitForSelector("#fzGpuRecovery", { state: "hidden" });
      assert.equal(await page.evaluate(() => localPlayer.mesh.uuid), old.id);
    }
    // Still-photo preview/download: no DOM display corruption, no filming mode.
    const hud = await page.evaluate(
      () => document.getElementById("hud").style.display,
    );
    await page.evaluate(() => takePhoto());
    await page.waitForSelector("#fzPhoto", { state: "visible" });
    assert.equal(
      await page.evaluate(() => document.getElementById("hud").style.display),
      hud,
    );
    const download = page.waitForEvent("download");
    await page.click("#fzPhoto [data-download]");
    const photo = await download;
    assert(photo.suggestedFilename().endsWith(".png"));
    await page.click("#fzPhoto [data-close]");
    assert.equal(
      await page.evaluate(() => FZPhoto.info().hasImage),
      false,
      "object URL released",
    );
    // Repeated entry into utility dialogs stays bounded.
    await page.evaluate(() => {
      for (let i = 0; i < 10; i++) {
        FZPlay.open();
        FZPlay.close();
        FZGuide.open();
        FZGuide.close();
      }
    });
    assert.equal(await page.locator("#fzPlayPanel").count(), 1);
    assert.equal(await page.locator("#fzCityGuide").count(), 1);
    const manifest = await (
      await page.request.get(base + "/manifest.webmanifest")
    ).json();
    assert.equal(manifest.orientation, "any");
    for (const icon of manifest.icons)
      assert.equal(
        (await page.request.get(base + "/" + icon.src)).status(),
        200,
      );
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("fz_play_v13")),
    );
    const journal = await page.evaluate(() =>
      Object.keys(localStorage)
        .filter((k) => k.startsWith("fz_city_journal_v13:"))
        .map((k) => JSON.parse(localStorage.getItem(k))),
    );
    assert(
      journal.some(
        (j) => j.favorites.length === 1 && j.completed.includes("first"),
      ),
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("#fzIntroSkip").click();
    assert.deepEqual(await page.evaluate(() => FZPlay.info().prefs), saved);
    assert.equal(await page.locator("#fzPlayPanel").isVisible(), false);
    assert.deepEqual(errors, []);
    console.log(
      "PASS phone readiness: actual renderer profiles, left-handed 320/390/844 layout, settings persistence, directory/favorites/walks, guarded rescue, reconnect without duplicate avatar, WebGL recovery (" +
        supportsLoss +
        "), photo download, manifest, no page errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
