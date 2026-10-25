// Actual restored world: no imported GLB, no streamed tower district.
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
  const errors = [],
    requests = [];
  try {
    const context = await browser.newContext({
      viewport: { width: 1100, height: 720 },
    });
    await context.addInitScript(() => {
      localStorage.setItem("fz_seen_city_intro_v9", "1");
    });
    page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.stack));
    page.on("request", (r) => requests.push(r.url()));
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
    assert.equal(
      await page.evaluate(() => FZFront.info().autoplay),
      "page-load",
    );
    assert.equal(await page.evaluate(() => FZFront.info().actors), 7);
    await page.screenshot({ path: "/home/user/intro-original-life.png" });
    await page.waitForFunction(
      () => FZFront.info().phase === "mall",
      {},
      { timeout: 20000 },
    );
    await page.screenshot({ path: "/home/user/intro-original-mall.png" });
    await page.waitForFunction(
      () => FZFront.info().phase === "quarter",
      {},
      { timeout: 20000 },
    );
    await page.screenshot({ path: "/home/user/intro-original-lab.png" });
    await page.waitForSelector("#fzIntro", {
      state: "detached",
      timeout: 20000,
    });
    assert.equal(await page.evaluate(() => FZFront.info().renderer), false);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#fzIntroSkip");
    assert.equal(
      await page.evaluate(() => FZFront.info().autoplay),
      "page-load",
      "autoplays again despite old saved seen key",
    );
    await page.click("#fzIntroSkip");
    await page.click("#authTabReg");
    await page.fill("#regUsername", "OriginalCity" + Date.now());
    await page.fill("#regPassword", "original-local-test");
    await page.fill("#regPasswordConfirm", "original-local-test");
    await page.click("#registerForm .auth-submit-btn");
    await page.waitForSelector("#serverScreen", {
      state: "visible",
      timeout: 15000,
    });
    await page.click(".fz-play");
    await page.waitForFunction(
      () =>
        typeof localPlayer !== "undefined" &&
        localPlayer?.mesh &&
        cityWorldReady() &&
        FZUI.playing(),
      {},
      { timeout: 100000 },
    );
    await page.waitForFunction(() => !window._loadingGate && window.FZSky?.active());
    await page.evaluate(() => FZSky.descend());
    if (await page.locator("#cityIntroSkip").isVisible())
      await page.click("#cityIntroSkip");
    else {
      await page.waitForSelector("#cityIntroSkip", { timeout: 20000 });
      await page.click("#cityIntroSkip");
    }
    await page.waitForFunction(() => !window.cine);
    assert(
      await page.evaluate(
        () =>
          Math.hypot(
            localPlayer.mesh.position.x - 131,
            localPlayer.mesh.position.z + 30,
          ) < 1,
      ),
    );
    assert.equal(
      await page.evaluate(() =>
        checkCollision(
          localPlayer.mesh.position.x,
          localPlayer.mesh.position.z,
        ),
      ),
      false,
      "arrival-square spawn clear",
    );
    assert.equal(await page.evaluate(() => NEWCITY.loaded), false);
    assert.equal(await page.evaluate(() => FZCITY.info().chunks), 0);
    assert(
      !requests.some((u) => u.includes("fantazia_city.glb")),
      "new GLB is not fetched",
    );
    assert.equal(await page.evaluate(() => !!window._fz8CityBuilt), false);
    const mall = await page.evaluate(() => {
      const b = buildings.find((b) => b.type === "mall");
      return {
        x: b.x,
        z: b.z,
        w: b.w,
        h: b.h,
        d: b.d,
        name: b.name,
        visible: b.mesh.visible,
      };
    });
    assert.deepEqual(mall, {
      x: 131,
      z: -129,
      w: 120,
      h: 55,
      d: 100,
      name: "🏬 GRAND MALL",
      visible: true,
    });
    console.log(
      "RESTORED WORLD",
      mall,
      await page.evaluate(() => ({
        buildings: buildings.length,
        p: localPlayer.mesh.position.toArray(),
      })),
    );
    await page.click("#fzUIOpen");
    await page.fill("#fzUISearch", "Старый город");
    await page.locator("#fzUIList button").click();
    await page.getByRole("button", { name: "GRAND MALL", exact: true }).click();
    await page.waitForFunction(() => nearestInteractable?.type === "mall");
    await page.screenshot({ path: "/home/user/original-grand-mall.png" });
    await page.keyboard.press("KeyE");
    await page.waitForFunction(
      () => isInsideBuilding && currentBuildingType === "mall" && !window.cine,
      {},
      { timeout: 60000 },
    );
    assert(
      await page.evaluate(() =>
        interactables.some(
          (e) => e.type === "elevator" || e.type === "stairs_up",
        ),
      ),
    );
    await page.evaluate(() => exitBuilding());
    await page.waitForFunction(() => !isInsideBuilding && !window.cine);
    assert(await page.evaluate(() => FZClassic.travel("lab")));
    await page.waitForFunction(() => nearestInteractable?.type === "factory");
    await page.screenshot({ path: "/home/user/original-laboratory.png" });
    await page.keyboard.press("KeyE");
    await page.waitForFunction(
      () => isInFactory && !window.cine,
      {},
      { timeout: 60000 },
    );
    assert.equal(
      await page.evaluate(
        () => interactables.filter((e) => e.type === "factory_gen").length,
      ),
      3,
    );
    assert(
      await page.evaluate(() =>
        interactables.some((e) => e.type === "factory_note"),
      ),
    );
    assert.equal(
      await page.evaluate(() => FZClassic.travel("square")),
      false,
      "cannot teleport out of laboratory through map",
    );
    await page.screenshot({
      // Software WebGL can take longer to read back this dense laboratory frame.
      timeout: 90000,
      path: "/home/user/original-laboratory-inside.png",
    });
    await page.evaluate(() => exitFactory());
    assert(
      await page.evaluate(() => isInFactory),
      "original rescue prerequisite stays locked",
    );
    // Seed the completed-escape state only to test cleanup/return, not claim a full quest run.
    await page.evaluate(() => {
      DLC.victimRescued = true;
      DLC._exitReady = true;
      exitFactory();
    });
    await page.waitForFunction(() => !isInFactory && !window.cine);
    assert(
      await page.evaluate(
        () =>
          Math.abs(localPlayer.mesh.position.x + 430) < 1 &&
          Math.abs(localPlayer.mesh.position.z - (FACTORY_FZ + 16)) < 1,
      ),
      "lab remains at the retained forest location",
    );
    assert(await page.evaluate(() => FZClassic.travel("square")));
    await page.waitForTimeout(6000);
    assert(
      await page.evaluate(
        () =>
          Math.hypot(
            localPlayer.mesh.position.x - 131,
            localPlayer.mesh.position.z + 30,
          ) < 1,
      ),
      "no delayed new-city auto teleport",
    );
    assert.equal(await page.evaluate(() => FZCITY.info().chunks), 0);
    assert.deepEqual(errors, []);
    console.log(
      "PASS autoplay/reload, classic UI, arrival-square spawn and GRAND MALL footprint, native E mall/laboratory entrances, generators/notes, exact forest return, no GLB/new districts, no page errors.",
    );
  } catch (e) {
    console.error("PAGE ERRORS", errors);
    if (page)
      console.error(
        "STATE",
        await page
          .evaluate(() => ({
            p:
              typeof localPlayer !== "undefined"
                ? localPlayer?.mesh?.position?.toArray()
                : null,
            ready: window._classicWorldReady,
            loading: window._loadingGate,
            front: window.FZFront?.info(),
            cine: !!window.cine,
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
