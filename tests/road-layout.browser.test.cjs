const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright-core");
(async () => {
  const c = require("@sparticuz/chromium");
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_EXECUTABLE || (await c.executablePath()),
    args: c.args,
    headless: true,
  });
  const errors = [];
  try {
    const context = await browser.newContext({
      viewport: { width: 1100, height: 720 },
    });
    await context.addInitScript(() => {
      window.FZ_LAYOUT_AUDIT = true;
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.stack));
    const url = process.env.GAME_URL || "http://127.0.0.1:3000";
    await page.route("**/*", (r) =>
      r.request().url().startsWith(url) ||
      /^(data|blob):/.test(r.request().url())
        ? r.continue()
        : r.abort(),
    );
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.locator("#fzIntroSkip").click();
    await page.click("#authTabReg");
    await page.fill("#regUsername", "RoadLayout" + Date.now());
    await page.fill("#regPassword", "road-layout-local");
    await page.fill("#regPasswordConfirm", "road-layout-local");
    await page.click("#registerForm .auth-submit-btn");
    await page.waitForSelector("#serverScreen", { state: "visible" });
    await page.click(".fz-play");
    await page.waitForFunction(
      () =>
        typeof localPlayer !== "undefined" &&
        localPlayer?.mesh &&
        cityWorldReady(),
      {},
      { timeout: 120000 },
    );
    await page.waitForFunction(() => !window._loadingGate && window.FZSky?.active());
    await page.evaluate(() => FZSky.descend());
    await page.waitForSelector("#cityIntroSkip", { timeout: 20000 });
    await page.click("#cityIntroSkip");
    await page.waitForFunction(() => !window.cine);
    await page.waitForFunction(
      () => buildings.some((b) => b.type === "biz_space"),
      {},
      { timeout: 45000 },
    );
    const result = await page.evaluate(() => ({
      plots: FZRoads.plots,
      observations: FZRoads.observations,
      buildingHits: buildings
        .filter((b) => b.bounds && FZRoads.hit(b.bounds, true))
        .map((b) => ({ name: b.name, bounds: b.bounds })),
      colliderHits: streetColliders.filter((c) =>
        FZRoads.hit(FZRoads.rect(c.x, c.z, 2 * c.r, 2 * c.r), true),
      ),
      roads: FZRoads.roads,
      counts: {
        buildings: buildings.length,
        colliders: streetColliders.length,
        props: FZRoads.props.length,
      },
      mall: buildings.find((b) => b.type === "mall")?.bounds,
      lab: buildings.find((b) => b.type === "factory")?.bounds,
      spawnBlocked: checkCollision(SPAWN_POINT.x, SPAWN_POINT.z),
      spawn: { x: localPlayer.mesh.position.x, z: localPlayer.mesh.position.z },
      quarter: window._cityQuarter,
      mallDesign: window._mallDesign,
      desert:
        typeof buildDesert !== "undefined" ||
        interactables.some((e) => /ОАЗИС|ЗОЛОТОЙ КОЛОС/.test(e.name)),
      roadSamples: (() => {
        const blocked = [];
        for (const r of FZRoads.roads) {
          const extent = Math.min(520, r.length / 2 - 1);
          for (let a = -extent; a <= extent; a += 2)
            for (const lane of [
              -2,
              2,
              ...(r.walk ? [-r.half - 2, r.half + 2] : []),
            ]) {
              const x = r.axis === "x" ? r.center + lane : a + (r.along || 0),
                z = r.axis === "z" ? r.center + lane : a + (r.along || 0);
              if (checkCollision(x, z)) blocked.push({ x, z });
            }
        }
        return blocked;
      })(),
      arrivalPath: (() => {
        const blocked = [];
        for (let z = -74; z <= -30; z += 0.5)
          for (const x of [130, 131, 132])
            if (checkCollision(x, z)) blocked.push({ x, z });
        return blocked;
      })(),
      parkPaths: (() => {
        const blocked = [];
        for (let t = 16; t <= 44; t += 0.5)
          for (const [x, z] of [
            [15.2, t],
            [44.8, t],
            [t, 15.2],
            [t, 44.8],
          ])
            if (checkCollision(x, z)) blocked.push({ x, z });
        return blocked;
      })(),
      businesses: ["biz_office", "biz_server", "biz_bank", "biz_space"].map(
        (type, i) => {
          const b = buildings.find((b) => b.type === type),
            e = interactables.find((e) => e.type === type);
          return {
            type,
            x: b?.x,
            z: b?.z,
            site: FZRoads.businesses[i],
            entrance: e?.position,
            blocked: e ? checkCollision(e.position.x, e.position.z) : true,
          };
        },
      ),
    }));
    fs.writeFileSync(
      "/home/user/road-audit.json",
      JSON.stringify({ errors, ...result }, null, 2),
    );
    console.log(
      JSON.stringify(
        {
          errors,
          counts: result.counts,
          buildingHits: result.buildingHits,
          colliderHits: result.colliderHits,
          observationCount: result.observations.length,
          observations: result.observations.slice(0, 30),
        },
        null,
        2,
      ),
    );
    // Deterministic overhead capture after rendering, without an animation-frame camera race.
    for (const [name, pos, look] of [
      ["centre", [160, 160, 170], [25, 0, 5]],
      ["park", [90, 60, 95], [30, 0, 30]],
      ["mall", [187, 48, -21], [131, 24, -122]],
      ["arrival", [131, 7, -19], [131, 17, -110]],
      ["quarter", [378, 160, 285], [258, 0, 156]],
    ]) {
      const image = await page.evaluate(
        ({ pos, look }) => {
          camera.position.set(...pos);
          camera.lookAt(...look);
          renderer.render(scene, camera);
          return renderer.domElement.toDataURL("image/png");
        },
        { pos, look },
      );
      fs.writeFileSync(
        "/home/user/road-" + name + ".png",
        Buffer.from(image.split(",")[1], "base64"),
      );
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(
      result.buildingHits,
      [],
      "building footprints must clear roads and sidewalks",
    );
    assert.deepEqual(
      result.colliderHits,
      [],
      "colliders must clear roads and sidewalks",
    );
    assert.deepEqual(
      result.observations,
      [],
      "actual static geometry must clear carriageways before merging",
    );
    assert.equal(result.spawnBlocked, false);
    assert.deepEqual(result.spawn, { x: 131, z: -30 });
    assert.equal(result.desert, false);
    assert.equal(result.quarter.buildings, 16);
    assert.equal(result.mallDesign.version, "12.0");
    assert.equal(result.mallDesign.stepped, true);
    assert.deepEqual(
      result.roadSamples,
      [],
      "actual movement checks on carriageways and sidewalks",
    );
    assert.deepEqual(result.parkPaths, [], "park ring path is passable");
    assert.deepEqual(
      result.arrivalPath,
      [],
      "spawn-to-mall pedestrian route is clear",
    );
    for (const b of result.businesses) {
      assert.equal(b.x, b.site.x);
      assert.equal(b.z, b.site.z);
      assert.equal(b.blocked, false, b.type + " entrance");
    }
    for (let i = 0; i < result.plots.length; i++)
      for (let j = 0; j < i; j++) {
        const a = result.plots[i].bounds,
          b = result.plots[j].bounds;
        assert(
          !(
            a.minX < b.maxX &&
            a.maxX > b.minX &&
            a.minZ < b.maxZ &&
            a.maxZ > b.minZ
          ),
          "overlapping parcels " +
            result.plots[i].id +
            " / " +
            result.plots[j].id,
        );
      }
    console.log("ROAD LAYOUT PASS");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
