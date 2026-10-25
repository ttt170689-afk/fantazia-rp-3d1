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
    const base = process.env.GAME_URL || "http://127.0.0.1:3000",
      p = await b.newPage({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      });
    p.on("pageerror", (e) => errors.push(e.stack));
    await p.route("**/*", (r) =>
      r.request().url().startsWith(base) ||
      /^(blob|data):/.test(r.request().url())
        ? r.continue()
        : r.abort(),
    );
    await p.goto(base, { waitUntil: "domcontentloaded" });
    await p.click("#fzIntroSkip");
    await p.click("#authTabReg");
    await p.fill("#regUsername", "MetroTest" + Date.now());
    await p.fill("#regPassword", "local-test");
    await p.fill("#regPasswordConfirm", "local-test");
    await p.click("#registerForm .auth-submit-btn");
    await p.waitForSelector("#serverScreen", { state: "visible" });
    assert(await p.locator(".fz-lobby-story").isVisible());
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await p.screenshot({ path: "/home/user/lobby23-phone.png" });
    await p.tap(".fz-play");
    await p.waitForFunction(
      () => FZSky.info().look?.active && !window._loadingGate,
      {},
      { timeout: 120000 },
    );
    await p.waitForFunction(() => localPlayer.mesh.userData.isSuperRig);

    await p.evaluate(() => FZSky.descend());
    await p.tap("#cityIntroSkip");
    await p.waitForFunction(() => !cine && !FZSky.active());
    assert((await p.evaluate(() => FZCranes.info().count)) > 0);
    await p.evaluate(() => {
      window.sourceDisposed28 = 0;
      const owned = new Set();
      SuperRig.src.scene.traverse((o) => {
        if (o.geometry) owned.add(o.geometry);
        for (const m of o.material
          ? Array.isArray(o.material)
            ? o.material
            : [o.material]
          : []) {
          owned.add(m);
          Object.values(m)
            .filter((v) => v?.isTexture)
            .forEach((v) => owned.add(v));
        }
      });
      owned.forEach((r) =>
        r.addEventListener("dispose", () => sourceDisposed28++),
      );
    });
    await p.evaluate(() => FZBuildingDirectory.open());
    assert(await p.locator("#fzBuildingDirectory").isVisible());
    await p.locator('[data-category="crane"]').tap();
    assert((await p.locator(".fz28-place").count()) > 0);
    const navBefore = await p.evaluate(() =>
      localPlayer.mesh.position.toArray(),
    );
    await p.locator(".fz28-place button").first().tap();
    assert.deepEqual(
      await p.evaluate(() => localPlayer.mesh.position.toArray()),
      navBefore,
      "directory only marks a walking route",
    );
    assert(await p.evaluate(() => !!window.navTarget));
    await p.setViewportSize({ width: 1100, height: 700 });
    await p.evaluate(() => {
      enterBuilding("apartment", "Жилой дом");
      window.cameraMode = "first";
      cameraAngleH = -2.35;
      cameraAngleV = 0;
    });
    await p.waitForTimeout(1000);
    assert.equal(await p.evaluate(() => FZBuildings.info().floors), 4);
    await p.screenshot({ path: "/home/user/v28-foyer.png" });
    // Native mobile interaction opens the real door, not a duplicate custom input path.
    await p.evaluate(() => {
      const e = interactables.find(
        (e) => e.building28 && e.kind === "door" && e.floor === 0,
      );
      localPlayer.mesh.position.copy(e.position);
      checkInteractables();
      FZTouch.update();
    });
    await p.tap("#fzTouchUse");
    await p.waitForTimeout(800);
    assert(
      await p.evaluate(
        () =>
          interactables.find((e) => e.building28 && e.kind === "door").door
            .open,
      ),
    );
    await p.evaluate(() => {
      const e = interactables.find(
        (e) => e.building28 && e.kind === "roomLight",
      );
      localPlayer.mesh.position.copy(e.position);
      FZBuildings.interact(e);
    });
    assert.equal(
      await p.evaluate(() => Object.values(FZBuildings.info().data.lights)[0]),
      false,
    );
    await p.evaluate(() => {
      const e = interactables.find((e) => e.building28 && e.kind === "curtain");
      localPlayer.mesh.position.copy(e.position);
      FZBuildings.interact(e);
    });
    assert.equal(
      await p.evaluate(
        () => Object.values(FZBuildings.info().data.curtains)[0],
      ),
      false,
    );
    await p.evaluate(() => {
      for (const e of interactables.filter(
        (e) => e.building28 && e.kind === "door" && e.floor === 0,
      ))
        e.door.open = true;
      for (let i = 0; i < 25; i++) FZBuildings.update(0.05);
      localPlayer.mesh.position.set(
        INTERIOR_BASE.x - 14,
        0,
        INTERIOR_BASE.z - 4,
      );
      cameraAngleH = Math.PI;
      cameraAngleV = 0;
    });
    await p.screenshot({ path: "/home/user/v28-apartment.png" });
    // Actual native keyboard motion on the full stair flight.
    await p.evaluate(() => {
      localPlayer.mesh.position.set(
        INTERIOR_BASE.x - 19,
        0,
        INTERIOR_BASE.z + 22.1,
      );
      cameraAngleH = Math.PI;
      cameraAngleV = 0.15;
    });
    await p.keyboard.down("w");
    await p.waitForFunction(
      () => localPlayer.mesh.position.y > 5.15,
      {},
      { timeout: 60000 },
    );
    await p.keyboard.up("w");
    assert.equal(await p.evaluate(() => currentFloor), 1);
    console.log(
      "STAIRS PASS",
      await p.evaluate(() => localPlayer.mesh.position.toArray()),
    );
    await p.screenshot({ path: "/home/user/v28-stairs.png" });
    // Bring the cabin to this floor, board without changing floors, ride to fourth.
    await p.evaluate(() => {
      localPlayer.mesh.position.set(
        INTERIOR_BASE.x + 19,
        5.2,
        INTERIOR_BASE.z + 11,
      );
      FZBuildings.requestLift(1);
      for (let i = 0; i < 250; i++) FZBuildings.update(0.05);
    });
    await p.evaluate(() => {
      localPlayer.mesh.position.set(
        INTERIOR_BASE.x + 19,
        5.2,
        INTERIOR_BASE.z + 18,
      );
      FZBuildings.requestLift(3);
    });
    const intermediate = await p.evaluate(() => {
      for (let i = 0; i < 65; i++) FZBuildings.update(0.05);
      return localPlayer.mesh.position.y;
    });
    assert(intermediate > 5.2 && intermediate < 15.6);
    await p.evaluate(() => {
      for (let i = 0; i < 250; i++) FZBuildings.update(0.05);
    });
    assert(
      Math.abs((await p.evaluate(() => localPlayer.mesh.position.y)) - 15.6) <
        0.02,
    );
    await p.evaluate(() => {
      const e = interactables.find(
        (e) => e.building28 && e.kind === "seat" && e.floor === 3,
      );
      localPlayer.mesh.position.copy(e.position);
      FZBuildings.interact(e);
    });
    assert(await p.evaluate(() => !!sittingOn?.spot.building28));
    await p.evaluate(() => standUpFromSeat());
    assert(
      Math.abs((await p.evaluate(() => localPlayer.mesh.position.y)) - 15.6) <
        0.02,
    );
    await p.evaluate(() => {
      _exitBuildingNow();
      enterBuilding("cinema", "Кинотеатр");
      cameraAngleH = Math.PI;
      cameraAngleV = 0;
    });
    await p.waitForTimeout(500);
    console.log("CINEMA", await p.evaluate(() => FZBuildings.info()));
    await p.screenshot({ path: "/home/user/v28-cinema-foyer.png" });
    await p.evaluate(() => {
      const e = interactables.find((e) => e.building28 && e.kind === "snacks");
      localPlayer.mesh.position.copy(e.position);
      checkInteractables();
      FZTouch.update();
      localPlayer.money = 500;
    });
    await p.tap("#fzTouchUse");
    assert(await p.locator("#fzBuildingPanel").isVisible());
    await p.locator('[data-action="popcorn"]').tap();
    assert.equal(await p.evaluate(() => localPlayer.money), 465);
    assert.equal(
      await p.evaluate(() => FZBuildings.info().data.bag.popcorn),
      1,
    );
    await p.locator("#fzBuildingPanel .fz28-close").tap();
    await p.evaluate(() => {
      localPlayer.mesh.position.set(
        INTERIOR_BASE.x - 13,
        0,
        INTERIOR_BASE.z - 3,
      );
      cameraAngleH = Math.PI;
      cameraAngleV = 0;
    });
    await p.waitForFunction(() => FZCinemaFilm.info()[0]?.frames > 2);
    await p.screenshot({ path: "/home/user/v28-cinema-film.png" });
    assert.equal(await p.evaluate(() => FZCinemaFilm.info().length), 2);
    await p.evaluate(() => {
      const e = interactables.find(
        (e) => e.building28 && e.kind === "film" && e.screen === 0,
      );
      localPlayer.mesh.position.copy(e.position);
      FZBuildings.interact(e);
    });
    await p.getByRole("button", { name: "Пауза", exact: true }).tap();
    const t = await p.evaluate(() => FZBuildings.info().films[0].time);
    await p.waitForTimeout(500);
    assert.equal(await p.evaluate(() => FZBuildings.info().films[0].time), t);
    await p.evaluate(() => {
      localPlayer.mesh.position.set(
        INTERIOR_BASE.x + 13,
        0,
        INTERIOR_BASE.z - 3,
      );
      cameraAngleH = Math.PI;
    });
    await p.waitForFunction(() => FZCinemaFilm.info()[1].frames > 2);
    await p.screenshot({ path: "/home/user/v28-night-express.png" });
    for (const type of ["bank", "office", "hospital"]) {
      await p.evaluate((type) => {
        _exitBuildingNow();
        enterBuilding(type, type === "office" ? "Суд" : type);
        cameraAngleH = Math.PI;
        cameraAngleV = 0;
      }, type);
      await p.waitForTimeout(500);
      console.log(type, await p.evaluate(() => FZBuildings.info()));
      await p.screenshot({ path: "/home/user/v28-" + type + ".png" });
    }
    await p.evaluate(() => {
      _exitBuildingNow();
      const a = interactables.find((e) => e.crane28 && e.kind === "ladder");
      localPlayer.mesh.position.copy(a.position);
      FZCranes.interact(a);
    });
    await p.keyboard.down("w");
    await p.waitForFunction(
      () => FZCranes.info().rider?.mode === "deck",
      {},
      { timeout: 65000 },
    );
    await p.keyboard.up("w");
    assert(
      Math.abs((await p.evaluate(() => localPlayer.mesh.position.y)) - 28) <
        0.1,
    );
    await p.screenshot({ path: "/home/user/v28-crane.png" });
    await p.evaluate(() => {
      const a = interactables.find(
        (e) =>
          e.crane28 &&
          e.kind === "down" &&
          e.position.distanceTo(localPlayer.mesh.position) < 3,
      );
      FZCranes.interact(a);
    });
    await p.keyboard.down("s");
    await p.waitForFunction(() => !FZCranes.active(), {}, { timeout: 65000 });
    await p.keyboard.up("s");
    assert.equal(
      await p.evaluate(() => sourceDisposed28),
      0,
      "shared gameplay assets survive all visits",
    );
    await p.setViewportSize({ width: 390, height: 844 });
    await p.evaluate(() => {
      enterBuilding("house", "Дом");
      const e = interactables.find(
        (e) => e.building28 && e.kind === "concierge",
      );
      localPlayer.mesh.position.copy(e.position);
      FZBuildings.interact(e);
    });
    assert(await p.locator("#fzBuildingPanel").isVisible());
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await p.screenshot({ path: "/home/user/v28-concierge-phone.png" });
    await p.evaluate(() => backToServers());
    assert.equal(await p.locator("#fzBuildingPanel").count(), 0);
    assert.equal(await p.locator("#fzCraneControls").count(), 0);
    assert.equal(await p.evaluate(() => FZBuildings.info()), null);
    assert.deepEqual(errors, []);
    console.log(
      "PASS v28 live browser smoke: actual stairs, lift ride, local 3D film, multi-floor interiors and crane up/down",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
