// Native browser path with a clean profile: register -> Play -> real GLB -> menu.
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { chromium: pw } = require("playwright-core");
(async () => {
  let executable = process.env.CHROMIUM_EXECUTABLE,
    args = ["--no-sandbox"];
  if (!executable) {
    const c = require("@sparticuz/chromium");
    executable = await c.executablePath();
    args = c.args;
  }
  const browser = await pw.launch({
    headless: true,
    executablePath: executable,
    args,
  });
  const errors = [];
  let page;
  try {
    page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on("pageerror", (e) => errors.push(e.stack));
    const url = process.env.GAME_URL || "http://127.0.0.1:3000";
    await page.route("**/*", (r) => {
      const u = r.request().url();
      if (u.startsWith(url) || u.startsWith("blob:") || u.startsWith("data:"))
        return r.continue();
      if (
        u ===
        "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"
      )
        return r.fulfill({
          body: fs.readFileSync(require.resolve("three/build/three.min.js")),
          contentType: "application/javascript",
        });
      return r.abort();
    });
    const hidden = async (ids) => {
      for (const id of ids)
        assert.equal(
          await page.locator("#" + id).isVisible(),
          false,
          id + " must be hidden",
        );
    };
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.FZUI);
    if (await page.locator("#fzIntro").isVisible()) {
      await page.click("#fzIntroSkip");
      await page.waitForSelector("#fzIntro", { state: "detached" });
    }
    await page.waitForTimeout(4500);
    await hidden([
      "hud",
      "fz8Dock",
      "fz7Dock",
      "fz8Hud",
      "fz8Wpn",
      "fz8GfxBtn",
      "questPanel",
      "worldEventBanner",
      "fzUIBar",
      "srBadge",
    ]);
    await page.click("#authTabReg");
    await page.waitForTimeout(1200);
    await page.screenshot({ path: "/home/user/ui-registration.png" });
    await page.fill("#regUsername", "BrowserTest" + Date.now());
    await page.fill("#regPassword", "local-test-only-87");
    await page.fill("#regPasswordConfirm", "local-test-only-87");
    await page.click("#registerForm .auth-submit-btn");
    await page.waitForSelector("#serverScreen", {
      state: "visible",
      timeout: 10000,
    });
    await hidden(["fz8Dock", "fzUIBar", "questPanel", "worldEventBanner"]);
    await page.click(".fz-play");
    await page.waitForFunction(
      () =>
        typeof localPlayer !== "undefined" &&
        localPlayer &&
        localPlayer.mesh &&
        NEWCITY.loaded &&
        FZUI.playing(),
      {},
      { timeout: 90000 },
    );
    await page.waitForSelector("#cityIntroSkip", { timeout: 30000 });
    await page.click("#cityIntroSkip");
    await page.waitForFunction(() => !window.cine, {}, { timeout: 10000 });
    await page.waitForTimeout(700);
    console.log(
      "AUTH / PLAY loaded",
      await page.evaluate(() => ({
        p: localPlayer.mesh.position.toArray(),
        city: FZCITY.info(),
      })),
    );
    assert(
      await page.evaluate(
        () =>
          Math.hypot(
            localPlayer.mesh.position.x - (NEWCITY.x + 4 * 238 + 118),
            localPlayer.mesh.position.z - (NEWCITY.z + 2 * 238 + 202),
          ) < 1,
      ),
      "new game starts on Fantazia Square",
    );
    await page.waitForFunction(
      () => FZCITY.info().pending === 0 && camera.position.y < 3,
      {},
      { timeout: 30000 },
    );
    await page.screenshot({ path: "/home/user/city-native-v10.png" });
    await hidden([
      "fz8Dock",
      "fz7Dock",
      "fz8Hud",
      "fz8Wpn",
      "fz8GfxBtn",
      "questPanel",
      "worldEventBanner",
      "srBadge",
    ]);
    assert.equal(
      await page.evaluate(() => DLC.hasFlashlight && !!window._flash),
      true,
    );
    assert.equal(await page.locator("#fz8Hud").count(), 0);
    assert.equal(await page.locator("#fzStory").count(), 0);
    assert(
      await page.evaluate(
        () =>
          FZV5.story.disabled &&
          !FZV5.guide &&
          !interactables.some((i) => i.type === "fz_guide"),
      ),
    );
    assert(
      await page.evaluate(() => {
        const speed = FZ8_speedMul(),
          hp = localPlayer.health;
        FZ8L.S.vit.food = FZ8L.S.vit.water = FZ8L.S.vit.energy = 0;
        return (
          FZ8_speedMul() === speed &&
          localPlayer.health === hp &&
          Object.values(FZ8L.vitals()).every((v) => v === 100)
        );
      }),
    );
    assert.equal(await page.locator("#hud .top-bar").isVisible(), false);
    assert.equal(await page.locator("#chatPanel").isVisible(), false);
    assert(
      await page.evaluate(
        () =>
          !localPlayer.mesh.userData.nameTag ||
          !localPlayer.mesh.userData.nameTag.visible,
      ),
    );
    await page.keyboard.press("Enter");
    assert(await page.locator("#chatPanel").isVisible());
    assert(
      await page
        .locator("#chatInput")
        .evaluate((e) => e === document.activeElement),
    );
    await page.fill("#chatInput", "unsent draft");
    await page.keyboard.press("Escape");
    await page.click("#chatToggleBtn");
    assert.equal(await page.locator("#chatPanel").isVisible(), false);
    await page.evaluate(() => {
      localPlayer.health = 70;
      updateHealthBar();
      FZUI.update();
    });
    assert(await page.locator(".health-bar-container").isVisible());
    await page.evaluate(() => {
      localPlayer.health = 100;
      updateHealthBar();
      FZUI.update();
    });
    assert.equal(
      await page.locator(".health-bar-container").isVisible(),
      false,
    );
    const flashBefore = await page.evaluate(() => DLC.flashOn);
    await page.click("#fzUIFlash");
    assert.equal(await page.evaluate(() => DLC.flashOn), !flashBefore);
    await page.waitForFunction((v) => _flash.visible === v, !flashBefore, {
      timeout: 10000,
    });
    await page.keyboard.press("KeyF");
    assert.equal(await page.evaluate(() => DLC.flashOn), flashBefore);
    await page.click("#fzUIOpen");
    assert(await page.locator("#fzUIMenu").isVisible());
    assert(
      (await page.locator("#fzUIList button").count()) <= 12,
      "home menu is not a wall of buttons",
    );
    assert(
      (await page.locator("#fzUISummary").textContent()).includes("монет"),
    );
    await page.locator('#fzUICategories [data-section="player"]').click();
    assert((await page.locator("#fzUIList").textContent()).includes("Чат"));

    await page.fill("#fzUISearch", "метро");
    assert((await page.locator("#fzUIList button").count()) > 0);
    await page.fill("#fzUISearch", "Школа");
    await page.locator("#fzUIList button").first().click();
    assert(await page.locator("#fz8bPanel").isVisible());
    await page.keyboard.press("Escape");
    await page.click("#fzUIOpen");
    await page.fill("#fzUISearch", "Большой город");
    await page.locator("#fzUIList button").click();
    assert(await page.locator("#fzCityMap").isVisible());
    await page
      .getByRole("button", { name: "Восточный деловой", exact: true })
      .click();
    await page.waitForFunction(() => FZCITY.info().pending === 0);
    assert.equal(await page.evaluate(() => FZCITY.info().chunks), 25);
    assert(
      await page.evaluate(
        () =>
          camera.far <= 750 &&
          (!window.skyDome || skyDome.scale.x * 900 < camera.far),
      ),
      "sky stays inside shortened city view",
    );
    assert.equal(
      await page.evaluate(() => {
        const p = localPlayer.mesh.position;
        return checkCollision(p.x, p.z);
      }),
      false,
    );
    const coll = await page.evaluate(() => {
      const p = localPlayer.mesh.position;
      return checkCollision(NEWCITY.x + 6 * 238 + 49, 49);
    });
    assert.equal(coll, true);
    const pos = await page.evaluate(() => localPlayer.mesh.position.toArray());
    await page.click("#gameCanvas", { position: { x: 600, y: 400 } });
    await page.waitForFunction(() => isPointerLocked || window.mobileReady);
    await page.keyboard.down("KeyW");
    await page.waitForFunction(
      (p) =>
        Math.hypot(
          localPlayer.mesh.position.x - p[0],
          localPlayer.mesh.position.z - p[2],
        ) > 0.1,
      pos,
      { timeout: 10000 },
    );
    await page.keyboard.up("KeyW");
    const after = await page.evaluate(() =>
      localPlayer.mesh.position.toArray(),
    );
    assert(
      Math.hypot(after[0] - pos[0], after[2] - pos[2]) > 0.1,
      "walking in new district",
    );
    await page.screenshot({ path: "/home/user/ui-city.png" });
    // Optional courtyard interactions, through the native E handler and UI.
    await page.evaluate(() => {
      const e = interactables.find(
        (e) => e.cityLeisure && e.type === "sit_bench",
      );
      localPlayer.mesh.position.copy(e.position);
      checkInteractables();
    });
    await page.keyboard.press("KeyE");
    assert(
      await page.evaluate(() => !!sittingOn && !!sittingOn.spot.cityLeisure),
    );
    await page.keyboard.press("KeyE");
    assert(await page.evaluate(() => !sittingOn));
    assert(
      await page.evaluate(
        () =>
          !checkCollision(
            localPlayer.mesh.position.x,
            localPlayer.mesh.position.z,
          ),
      ),
    );
    await page.keyboard.press("KeyM");
    await page.fill("#fzUISearch", "Дворы рядом");
    await page.locator("#fzUIList button").click();
    assert(await page.locator("#fzLeisure").isVisible());
    assert((await page.locator(".leisure-place").count()) > 0);
    await page.locator(".leisure-place").first().click();
    await page.waitForSelector("#fzCityRoute", { state: "visible" });
    await page.evaluate(() => {
      const e = interactables.find((e) => e.type === "city_basketball");
      localPlayer.mesh.position.copy(e.position);
      checkInteractables();
    });
    await page.keyboard.press("KeyE");
    assert(await page.locator("#fzBasketShoot").isVisible());
    const beforeSport = await page.evaluate(() =>
      localPlayer.mesh.position.toArray(),
    );
    await page.keyboard.press("KeyW");
    await page.keyboard.press("Space");
    assert.equal(await page.evaluate(() => FZLeisure.state().state), "flight");
    assert.equal(
      await page.evaluate(() => !!keys.Space),
      false,
      "shoot does not jump",
    );
    await page.screenshot({ path: "/home/user/city-basketball-8.9.png" });
    await page.waitForFunction(
      () => FZLeisure.state()?.attempts === 1,
      {},
      { timeout: 30000 },
    );
    assert(
      await page.evaluate(
        (p) =>
          Math.hypot(
            localPlayer.mesh.position.x - p[0],
            localPlayer.mesh.position.z - p[2],
          ) < 0.1,
        beforeSport,
      ),
    );
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => FZLeisure.state()), null);
    assert(await page.evaluate(() => !scene.getObjectByName("FZ_BASKETBALL")));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      checkInteractables();
      handleInteraction();
    });
    assert(await page.locator("#fzBasketShoot").isVisible());
    await page.screenshot({
      path: "/home/user/city-basketball-mobile-8.9.png",
    });
    await page.click("#fzBasketShoot");
    assert.equal(await page.evaluate(() => FZLeisure.state().state), "flight");
    await page.click("#fzLeisureClose");
    assert.equal(await page.locator("#fzLeisure").isVisible(), false);
    await page.setViewportSize({ width: 1280, height: 800 });
    // Streaming is bounded after repeated district changes; removed entrances do not accumulate.
    for (const id of ["west", "works", "heights", "east"]) {
      assert(await page.evaluate((id) => FZCITY.travel(id), id));
      await page.waitForFunction(() => FZCITY.info().pending === 0);
      assert(
        await page.evaluate(
          () =>
            FZCITY.info().chunks <= 25 &&
            interactables.filter((i) => i.cityChunk).length <= 200,
        ),
      );
    }
    // Use a generated doorway with the native interaction path, then return exactly.
    const entrance = await page.evaluate(() => {
      const e = interactables.find(
        (i) => i.cityChunk && i.type === "apartment",
      );
      localPlayer.mesh.position.set(e.position.x, 0, e.position.z);
      nearestInteractable = e;
      handleInteraction();
      return e.position;
    });
    await page.waitForFunction(() => isInsideBuilding);
    assert(await page.evaluate(() => !!FZ8B.info()));
    await page.evaluate(() => _exitBuildingNow());
    assert.equal(await page.evaluate(() => isInsideBuilding), false);
    await page.waitForFunction(() => !window.cine, {}, { timeout: 30000 });
    assert(
      await page.evaluate(
        (p) =>
          Math.hypot(
            localPlayer.mesh.position.x - p.x,
            localPlayer.mesh.position.z - p.z - 3,
          ) < 0.1,
        entrance,
      ),
    );
    assert(await page.evaluate(() => FZCITY.travel("center")));
    await page.setViewportSize({ width: 390, height: 844 });
    // M releases desktop pointer lock before testing the narrow layout.
    await page.keyboard.press("KeyM");
    await hidden(["mobileTopBtns", "mobMenu", "mobDance"]);
    assert(await page.locator("#fzUISearch").isVisible());
    await page.fill("#fzUISearch", "море");
    assert((await page.locator("#fzUIList button").count()) > 0);
    await page.screenshot({ path: "/home/user/ui-mobile-menu.png" });
    await page.keyboard.press("Escape");
    await page.click("#fzUIOpen");
    await page.fill("#fzUISearch", "");
    await page.locator('#fzUICategories [data-section="city"]').click();
    await page.screenshot({ path: "/home/user/ui-mobile-sections-8.8.png" });
    await page.keyboard.press("Escape");
    await page.evaluate(() => backToServers());
    await hidden(["hud", "fzUIBar", "fz8Dock", "fz8Wpn"]);
    await page.click(".fz-play");
    await page.waitForFunction(() => FZUI.playing(), {}, { timeout: 60000 });
    assert.equal(await page.locator("#cityIntroSkip").count(), 0);
    await page.evaluate(() => backToServers());
    await page.click(".fz-exit");
    await page.waitForSelector("#authScreen", { state: "visible" });
    await page.waitForTimeout(1000);
    await hidden([
      "hud",
      "fzUIBar",
      "fz8Dock",
      "fz8Wpn",
      "worldEventBanner",
      "questPanel",
    ]);
    assert.deepEqual(errors, []);
    console.log(
      "PASS clean registration, real Play, startup flashlight, unified menu, districts, collisions, bounded streaming, native doorway, mobile menu and logout; no page errors.",
    );
  } catch (e) {
    if (page) {
      await page
        .screenshot({ path: "/home/user/ui-failure.png" })
        .catch(() => {});
      console.error(
        "STATE",
        await page
          .evaluate(() => ({
            body: document.body.className,
            auth: document.getElementById("authError")?.textContent,
            gate: window._loadingGate,
            cine: window.cine && { i: window.cine.i, t: window.cine.t },
            frame: typeof _fpsFrames !== "undefined" && _fpsFrames,
            render: typeof renderer !== "undefined" && renderer?.info.render,
            flash: typeof DLC !== "undefined" && {
              on: DLC.flashOn,
              visible: window._flash?.visible,
            },
            p:
              typeof localPlayer !== "undefined" &&
              localPlayer?.mesh?.position.toArray(),
            city: window.FZCITY?.info(),
          }))
          .catch(() => ({})),
      );
    }
    console.error("PAGE ERRORS", errors);
    throw e;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
