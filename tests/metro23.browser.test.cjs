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
    const light = await p.evaluate(() => {
      setHeldItem(2);
      DLC.flashOn = true;
      updateFlashlight();
      const id = DLC.flashMesh.uuid;
      for (let i = 0; i < 40; i++) updateFlashlight();
      const expected =
        localPlayer.mesh.userData.srModel.getObjectByName("rightHand");
      return {
        same: id === DLC.flashMesh.uuid,
        correct: DLC.flashMesh.parent === expected,
        inside: !!localPlayer.mesh.getObjectById(DLC.flashMesh.id),
      };
    });
    assert.deepEqual(light, { same: true, correct: true, inside: true });
    await p.evaluate(() => {
      window.cameraMode = "first";
      updateViewModel(0.016);
      updateFlashlight();
    });
    const beam = await p.evaluate(() => {
      FZFlash.update();
      FZFlash.beam(_flash);
      const f = ITEMS.vmItem;
      return {
        dot: new THREE.Vector3(0, 1, 0)
          .applyQuaternion(f.getWorldQuaternion(new THREE.Quaternion()))
          .dot(camera.getWorldDirection(new THREE.Vector3())),
        distance: _flash.position.distanceTo(
          f.userData.lens.getWorldPosition(new THREE.Vector3()),
        ),
      };
    });
    assert(beam.dot > 0.999999 && beam.distance < 1e-6);
    await p.tap("#fzUIOpen");
    await p.fill("#fzUISearch", "Метро — станции");
    await p.locator("#fzUIList button").tap();
    await p.waitForSelector("#fzMetroPanel");
    assert.equal(await p.locator(".metro-stations>div").count(), 5);
    await p.tap("[data-test]");
    await p.waitForFunction(
      () => FZMetroAudio.info().playing,
      {},
      { timeout: 10000 },
    );
    await p.uncheck("[data-voice]");
    assert.equal(await p.evaluate(() => FZMetroAudio.info().playing), false);
    await p.check("[data-voice]");
    await p.click("#fzMetroPanel [data-close]");
    assert.equal(await p.evaluate(() => FZMetroAudio.info().active), false);
    await p.evaluate(() => FZSky.descend());
    await p.tap("#cityIntroSkip");
    await p.waitForFunction(() => !cine && !FZSky.active());
    await p.tap("#fzUIOpen");
    await p.fill("#fzUISearch", "Метро — станции");
    await p.locator("#fzUIList button").tap();
    await p.locator(".metro-stations button").first().tap();
    assert(
      (await p.evaluate(() => window.navTarget.label)).includes("Центральная"),
    );
    const entries = await p.evaluate(() => FZMetro.info().stations);
    assert.equal(entries.length, 5);
    assert.equal(
      await p.evaluate(() => FZMetro.enter(0)),
      false,
      "remote entry denied",
    );
    await p.evaluate(() => {
      window.sourceDisposed = 0;
      const all = new Set();
      SuperRig.src.scene.traverse((o) => {
        if (o.geometry) all.add(o.geometry);
        for (const m of o.material
          ? Array.isArray(o.material)
            ? o.material
            : [o.material]
          : []) {
          all.add(m);
          Object.values(m)
            .filter((v) => v?.isTexture)
            .forEach((v) => all.add(v));
        }
      });
      all.forEach((r) => r.addEventListener("dispose", () => sourceDisposed++));
      const e = FZMetro.info().stations[0];
      localPlayer.mesh.position.set(e.x, 0, e.z + 4);
      window.cameraMode = "first";
      cameraAngleH = Math.PI;
      cameraAngleV = 0.1;
    });
    const before = await p.evaluate(() => localPlayer.mesh.position.toArray());
    assert(await p.evaluate(() => FZMetro.enter(0)));
    assert.deepEqual(
      await p.evaluate(() => localPlayer.mesh.position.toArray()),
      before,
      "E does not teleport",
    );
    await p.evaluate(() => FZMetro.exit());
    assert.deepEqual(
      await p.evaluate(() => localPlayer.mesh.position.toArray()),
      before,
      "cleanup does not teleport",
    );
    await p.keyboard.down("w");
    await p.waitForFunction(() => FZMetro.active(), {}, { timeout: 15000 });
    assert(
      Math.abs(
        (await p.evaluate(() => localPlayer.mesh.position.z)) - before[2],
      ) < 2,
      "automatic threshold crossing preserves position",
    );
    await p.waitForFunction(
      () => localPlayer.mesh.position.z < FZMetro.info().origin.z + 8,
      {},
      { timeout: 70000 },
    );
    await p.keyboard.up("w");
    assert(
      Math.abs((await p.evaluate(() => localPlayer.mesh.position.y)) + 8) < 0.1,
      "walked down eight metres",
    );
    const phase = async (state) => {
      await p.evaluate((state) => {
        for (let i = 0; i < 1500 && FZMetro.info().state !== state; i++)
          FZMetro.update(0.1);
      }, state);
      assert.equal(await p.evaluate(() => FZMetro.info().state), state);
    };
    await phase("open");
    await p.evaluate(() => {
      for (let i = 0; i < 8; i++) FZMetro.update(0.1);
    });
    assert.equal(
      await p.evaluate(() => FZMetro.board()),
      false,
      "remote boarding denied",
    );
    await p.keyboard.down("w");
    await p.waitForFunction(() => FZMetro.ride(), {}, { timeout: 45000 });
    await p.keyboard.up("w");
    await p.evaluate(() => {
      const e = interactables.find(
        (e) => e.type === "metro_seat" && e.seat.train,
      );
      localPlayer.mesh.position.set(
        e.position.x,
        FZMetro.info().origin.y,
        e.position.z,
      );
      checkInteractables();
      FZTouch.update();
    });
    await p.tap("#fzTouchUse");
    assert(
      await p.evaluate(() => !!sittingOn?.spot.metro),
      "native mobile use sits in train",
    );
    await p.screenshot({ path: "/home/user/v27-seated-phone.png" });
    for (const expected of [1, 2, 3, 4, 0]) {
      await phase("travel");
      assert.equal(await p.evaluate(() => FZMetro.alight()), false);
      const start = await p.evaluate(() => ({
        p: localPlayer.mesh.position.toArray(),
        o: { ...FZMetro.info().origin },
      }));
      await p.evaluate(() => {
        for (let i = 0; i < 40; i++) FZMetro.update(0.1);
      });
      const middle = await p.evaluate(() => ({
        p: localPlayer.mesh.position.toArray(),
        o: { ...FZMetro.info().origin },
        s: { ...sittingOn.spot },
      }));
      assert(
        Math.hypot(middle.o.x - start.o.x, middle.o.z - start.o.z) > 1,
        "train actually travels between coordinates",
      );
      assert(
        Math.abs(middle.p[0] - middle.o.x - (start.p[0] - start.o.x)) < 1e-6,
        "passenger carried with train",
      );
      assert(
        Math.abs(middle.s.x - middle.p[0]) < 1e-6,
        "seat travels with rider",
      );
      await phase("arriving");
      await phase("open");
      assert.equal(await p.evaluate(() => FZMetro.info().index), expected);
      assert.equal(
        await p.evaluate(() => FZMetroAudio.info().last),
        ["center", "factory", "park", "port", "business"][expected],
      );
      const o = await p.evaluate(() => FZMetro.info().origin),
        e = entries[expected];
      assert(
        Math.hypot(o.x - e.x, o.z - (e.z - 23)) < 1e-6,
        "exact station endpoint",
      );
    }
    await p.evaluate(() => {
      standUpFromSeat();
      cameraAngleH = 0;
      cameraAngleV = 0;
    });
    assert.equal(
      await p.evaluate(() => localPlayer.mesh.position.y),
      -8,
      "stand up on train floor",
    );
    // Walk from the leftmost chair to its nearest door, then onto the platform.
    await p.keyboard.down("a");
    await p.waitForFunction(
      () => localPlayer.mesh.position.x >= FZMetro.info().origin.x - 8.2,
      {},
      { timeout: 20000 },
    );
    await p.keyboard.up("a");
    await p.keyboard.down("w");
    await p.waitForFunction(() => !FZMetro.ride(), {}, { timeout: 20000 });
    await p.keyboard.up("w");
    // Start at the foot of the stair to exercise its complete uphill route.
    await p.evaluate(() => {
      const o = FZMetro.info().origin;
      localPlayer.mesh.position.set(o.x, -8, o.z + 12);
      cameraAngleH = 0;
    });
    await p.keyboard.down("w");
    await p.waitForFunction(() => !FZMetro.active(), {}, { timeout: 70000 });
    assert.equal(
      await p.evaluate(() => cameraAngleH),
      0,
      "walking exit keeps heading",
    );
    assert.equal(
      await p.evaluate(() => keys.KeyW),
      true,
      "walking exit does not release held movement",
    );
    await p.keyboard.up("w");
    assert(Math.abs(await p.evaluate(() => localPlayer.mesh.position.y)) < 0.1);
    assert.equal(await p.evaluate(() => camera.layers.mask), 1);
    assert.equal(await p.evaluate(() => FZMetroAudio.info().active), false);
    console.log(
      "PASS native walk down/up, physical boarding/alighting, touch seating, continuous seated full-ring ride",
    );
    await p.setViewportSize({ width: 1100, height: 700 });
    for (const type of ["bank", "cinema", "bank"]) {
      await p.evaluate((type) => {
        enterBuilding(type, type === "bank" ? "Банк" : "Кинотеатр");
        cameraMode = "first";
        cameraAngleH = Math.PI;
        cameraAngleV = 0;
      }, type);
      const info = await p.evaluate(() => FZBuildings.info());
      assert.equal(info.staff, type === "bank" ? 5 : 2);
      assert.equal(info.seats, type === "bank" ? 8 : 66);
      await p.screenshot({ path: "/home/user/v27-" + type + ".png" });
      await p.evaluate(() => {
        const e = interactables.find((e) => e.building28 && e.kind === "seat");
        localPlayer.mesh.position.set(e.position.x, 0, e.position.z);
        FZBuildings.interact(e);
      });
      assert(await p.evaluate(() => !!sittingOn?.spot.building28));
      await p.evaluate(() => standUpFromSeat());
      assert.equal(
        await p.evaluate(() =>
          checkCollision(
            localPlayer.mesh.position.x,
            localPlayer.mesh.position.z,
          ),
        ),
        false,
        "seat exit has free standing space",
      );
      if (type === "bank") {
        await p.evaluate(() => {
          const e = interactables.find(
            (e) => e.building28 && e.kind === "bank",
          );
          localPlayer.mesh.position.copy(e.position);
          FZBuildings.interact(e);
        });
        assert(await p.locator("#fz7m_bank").isVisible());
        await p.evaluate(
          () => (document.getElementById("fz7m_bank").style.display = "none"),
        );
      } else {
        assert(
          await p.evaluate(() => {
            const e = interactables.find(
              (e) => e.building28 && e.kind === "film",
            );
            localPlayer.mesh.position.copy(e.position);
            return FZBuildings.interact(e);
          }),
        );
      }
      await p.evaluate(() => {
        FZBuildings.close();
        _exitBuildingNow();
      });
      assert.equal(await p.evaluate(() => FZBuildings.info()), null);
      assert.equal(
        await p.evaluate(
          () => interactables.filter((e) => e.building28).length,
        ),
        0,
      );
    }
    // Restart the real loading renderer twice; never reuse a context-lost canvas.
    await p.evaluate(() => {
      const c = document.createElement("canvas");
      c.id = "dance27Test";
      c.style.cssText =
        "position:fixed;inset:0;z-index:999999;background:#101528";
      document.body.append(c);
      window._playLoadDanceStop = false;
    });
    for (let i = 0; i < 2; i++) {
      await p.evaluate(() =>
        FZLoadingDancer.start(document.getElementById("dance27Test")),
      );
      await p.waitForFunction(
        () =>
          FZLoadingDancer.info().time > 0.2 && FZLoadingDancer.info().draws > 0,
      );
      assert.equal(
        await p.evaluate(() => FZLoadingDancer.info().clip),
        "ANIM_Dance_Loop",
      );
      if (i === 1)
        await p
          .locator("#dance27Test")
          .screenshot({ path: "/home/user/v27-loading-dancer.png" });
      await p.evaluate(() => FZLoadingDancer.stop());
    }
    await p.evaluate(() => {
      document.getElementById("dance27Test").remove();
      window._playLoadDanceStop = true;
    });
    assert.equal(
      await p.evaluate(() => sourceDisposed),
      0,
      "no shared gameplay assets disposed by staff or dancer",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS v28 venues, native account panel, seat clearance, lifecycle, real GLB dancing and renderer restart; no page errors",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
