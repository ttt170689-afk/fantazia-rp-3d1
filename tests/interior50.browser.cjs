"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { fork } = require("node:child_process");
const { chromium } = require("playwright-core");
const chrome = require("@sparticuz/chromium").default;

(async () => {
  const root = path.resolve(__dirname, "..");
  const child = fork(path.join(root, "server.js"), {
    cwd: root,
    env: { ...process.env, PORT: "0", FANTAZIA_RUNTIME_SECRET: "S".repeat(43) },
    execArgv: ["--require", path.join(__dirname, "closed-fixture-hook.cjs")],
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  let browser;
  let logs = "";
  child.stdout.on("data", (buffer) => (logs += buffer));
  child.stderr.on("data", (buffer) => (logs += buffer));
  try {
    let timer;
    const port = await Promise.race([
      new Promise((resolve, reject) => {
        child.once("message", (message) => resolve(message.port));
        child.once("exit", () => reject(Error(logs)));
      }),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(Error("server startup timeout")),
          12000,
        );
      }),
    ]).finally(() => clearTimeout(timer));
    if (process.platform === "linux") {
      const pkg = require("@sparticuz/chromium");
      await pkg.inflate(
        path.join(
          path.dirname(require.resolve("@sparticuz/chromium")),
          "../bin/al2023.tar.br",
        ),
      );
      pkg.setupLambdaEnvironment(
        path.join(require("node:os").tmpdir(), "al2023/lib"),
      );
    }
    browser = await chromium.launch({
      executablePath:
        process.env.CHROMIUM_EXECUTABLE || (await chrome.executablePath()),
      args: chrome.args.filter(
        (arg) =>
          ![
            "--disable-web-security",
            "--allow-running-insecure-content",
            "--single-process",
          ].includes(arg),
      ),
      headless: true,
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const url = "http://127.0.0.1:" + port;
    await page.route("**/*", (route) =>
      route.request().url().startsWith(url) ||
      /^(blob|data):/.test(route.request().url())
        ? route.continue()
        : route.abort(),
    );
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => currentUser?.isGuest === true);
    await page.waitForSelector("#fzIntro", {
      state: "detached",
      timeout: 16000,
    });
    // User-facing seen-story choice bypasses the opening and resumes in a real home.
    await page.locator(".fz-story-choice40 input").check();
    await page.locator(".fz-play").click();
    await page.waitForFunction(
      () =>
        localPlayer?.mesh &&
        renderer?.info.render.frame > 20 &&
        !window._loadingGate,
      {},
      { timeout: 120000 },
    );
    await page.waitForSelector("#playLoadOv", {
      state: "hidden",
      timeout: 30000,
    });
    await page.waitForFunction(
      () =>
        FZInterior50.info()?.type === "house" ||
        FZInterior50.info()?.type === "apartment",
      {},
      { timeout: 30000 },
    );
    // Software WebGL uses a reduced render resolution; game geometry and native input stay real.
    await page.evaluate(() => {
      SETTINGS.renderScale = 0.35;
      SETTINGS.dynRes = false;
      renderer.setPixelRatio(0.35);
    });
    assert.equal(await page.locator("#fzRoom48").count(), 0);
    assert(await page.evaluate(() => localPlayer.mesh.userData.isSuperRig));
    assert(await page.locator("#fzInterior50Tools").isVisible());
    async function resize(size) {
      await page.evaluate(async () => {
        if (document.fullscreenElement) await document.exitFullscreen();
      });
      const session = await context.newCDPSession(page);
      const { windowId } = await session.send("Browser.getWindowForTarget");
      await session.send("Browser.setWindowBounds", {
        windowId,
        bounds: { windowState: "normal" },
      });
      await session.detach();
      await page.setViewportSize(size);
    }
    async function screenshot(name) {
      if (!process.env.FZ_INTERIOR_SCREENSHOTS) return;
      fs.mkdirSync(process.env.FZ_INTERIOR_SCREENSHOTS, { recursive: true });
      await page.screenshot({
        path: path.join(process.env.FZ_INTERIOR_SCREENSHOTS, name + ".png"),
        timeout: 90000,
      });
    }
    async function at(x, y, z, yaw = Math.PI) {
      await page.evaluate(
        ({ x, y, z, yaw }) => {
          localPlayer.mesh.position.set(
            INTERIOR_BASE.x + x,
            y,
            INTERIOR_BASE.z + z,
          );
          window.cameraMode = "first";
          cameraAngleH = yaw;
          cameraAngleV = 0;
          velocity.y = 0;
          isGrounded = true;
          FZPlay.release();
          checkInteractables();
          FZTouch.update();
        },
        { x, y, z, yaw },
      );
    }
    async function use(command, property, value, touch = false) {
      const selected = await page.evaluate(
        ({ command, property, value }) => {
          const e = interactables.find(
            (item) =>
              item.command50 === command &&
              (!property || item[property] === value),
          );
          if (!e) return null;
          localPlayer.mesh.position.copy(e.position);
          checkInteractables();
          FZTouch.update();
          return { name: e.name, nearest: nearestInteractable?.name };
        },
        { command, property, value },
      );
      assert(selected, "missing action " + command);
      assert.equal(
        selected.nearest,
        selected.name,
        "native nearest action must select the intended object",
      );
      if (touch) {
        await page.locator("#fzTouchUse").tap();
      } else {
        await page.keyboard.press("e");
      }
    }
    async function fits() {
      assert(
        await page.locator(".fz50-card").evaluate((card) => {
          const rect = card.getBoundingClientRect();
          return (
            rect.left >= 0 &&
            rect.right <= innerWidth &&
            card.scrollWidth <= card.clientWidth + 1
          );
        }),
      );
    }
    // Capture and test the common lobby without changing any production account.
    await at(0, 0, 21);
    await screenshot("home-foyer");
    await page.locator('[data-fz50="open-map"]').click();
    await fits();
    const search = page.getByLabel("Поиск помещения");
    await search.fill("спальня");
    assert.equal(await page.locator(".fz50-room-row").count(), 2);
    const beforeTyping = await page.evaluate(() =>
      localPlayer.mesh.position.toArray(),
    );
    await search.fill("");
    await search.pressSequentially("wasd e");
    assert.equal(await search.inputValue(), "wasd e");
    assert.deepEqual(
      await page.evaluate(() => localPlayer.mesh.position.toArray()),
      beforeTyping,
    );
    await search.fill("");
    await page.getByLabel("Этаж на плане").selectOption("1");
    await page.locator('[data-fz50="room-flat-201-bedroom"]').click();
    assert.equal(
      await page.evaluate(() => FZInterior50.info().target),
      "flat-201-bedroom",
    );
    await screenshot("home-plan");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#fzInterior50Panel").count(), 0);
    assert.equal(
      await page.evaluate(() => document.activeElement.dataset.fz50),
      "open-map",
    );
    // Follow the actual native movement and ramp ground, not a scripted y teleport.
    await at(-19, 0, 22.1);
    await page.keyboard.down("w");
    try {
      await page.waitForFunction(
        () => localPlayer.mesh.position.y > 5.15,
        {},
        { timeout: 60000 },
      );
    } finally {
      await page.keyboard.up("w");
    }
    assert.equal(await page.evaluate(() => currentFloor), 1);
    await screenshot("stairs");
    // Call an empty cabin, then board it. Updates after boarding must carry the player.
    await at(20, 5.2, 11.9);
    assert.equal(
      await page.evaluate(() => nearestInteractable?.kind),
      "liftCall",
    );
    await page.keyboard.press("e");
    assert.equal(await page.evaluate(() => FZBuildings.info().lift.to), 1);
    await page
      .waitForFunction(
        () =>
          FZBuildings.info().lift.phase === "open" &&
          Math.abs(FZBuildings.info().lift.y - 5.2) < 0.01,
        {},
        { timeout: 45000 },
      )
      .catch(async (error) => {
        console.log(
          "LIFT DEBUG",
          await page.evaluate(() => ({
            lift: FZBuildings.info()?.lift,
            p: localPlayer.mesh.position.toArray(),
            hidden: document.hidden,
            frames: renderer.info.render.frame,
            stats: renderer.info.render,
            ratio: renderer.getPixelRatio(),
            ground: FZBuildings.ground(),
            nearest: nearestInteractable?.name,
            errors: FZInterior50.info()?.panel,
          })),
        );
        throw error;
      });
    await at(20.7, 5.2, 17.5);
    await page.keyboard.press("e");
    await page.getByRole("button", { name: "Этаж 1", exact: true }).click();
    await page.waitForFunction(
      () =>
        localPlayer.mesh.position.y < 5 && localPlayer.mesh.position.y > 0.1,
      {},
      { timeout: 20000 },
    );
    await page.waitForFunction(
      () =>
        FZBuildings.info().lift.phase === "open" &&
        localPlayer.mesh.position.y < 0.1,
      {},
      { timeout: 45000 },
    );
    assert.equal(await page.evaluate(() => currentFloor), 0);
    // A new appliance is activated through native E and shuts itself off.
    await page.evaluate(() => {
      const e = interactables.find(
        (item) =>
          item.command50 === "device" &&
          item.device50.state.type === "tap" &&
          item.floor === 0,
      );
      localPlayer.mesh.position.copy(e.position);
      checkInteractables();
    });
    await page.keyboard.press("e");
    await page.waitForFunction(() =>
      FZInterior50.info().devices.some(
        (item) => item.type === "tap" && item.on,
      ),
    );
    await page.waitForFunction(
      () => FZInterior50.info().data.completed.includes("water"),
      {},
      { timeout: 90000 },
    );
    assert.equal(
      await page.evaluate(() =>
        FZInterior50.info().devices.some(
          (item) => item.type === "tap" && item.on,
        ),
      ),
      false,
    );
    await screenshot("apartment-kitchen");
    // Open bank from the actual outdoor entrance action using the ordinary input path.
    await page.evaluate(() => {
      _exitBuildingNow();
      const entry =
        interactables.find(
          (e) => !e.interior && (e.destination || e.type) === "bank",
        ) ||
        interactables.find(
          (e) => !e.interior && (e.destination || e.type) === "biz_bank",
        );
      if (!entry) throw Error("no public bank entrance");
      localPlayer.mesh.position.set(
        entry.position.x,
        entry.position.y || 0,
        entry.position.z,
      );
      checkInteractables();
    });
    await page.keyboard.press("e");
    await page.waitForFunction(
      () => ["bank", "biz_bank"].includes(FZInterior50.info()?.type),
      {},
      { timeout: 30000 },
    );
    assert.equal(
      await page.evaluate(() => FZInterior50.info().rooms.length),
      13,
    );
    await at(0, 0, 13);
    await screenshot("bank-hall");
    const balances = await page.evaluate(() => ({
      money: localPlayer.money,
      health: localPlayer.health,
    }));
    await use("queue");
    await page.locator('[data-fz50="ticket-cash"]').click();
    assert.match(await page.locator(".fz50-status").textContent(), /К001/);
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => FZInterior50.info().queue.ticket?.status === "called",
      {},
      { timeout: 20000 },
    );
    await use("teller", "window50", 2);
    assert.match(
      await page.locator(".fz50-description").textContent(),
      /к окну 1/,
    );
    await page.keyboard.press("Escape");
    await use("teller", "window50", 1);
    assert.equal(
      await page.evaluate(() => FZInterior50.info().queue.ticket.status),
      "serving",
    );
    await page.locator('[data-fz50="open-account"]').click();
    assert(await page.locator("#fz7m_bank").isVisible());
    // Close old bank UI by its existing close control; do not execute financial actions.
    await page.evaluate(() => {
      document.getElementById("fz7m_bank")?.remove();
    });
    await use("teller", "window50", 1);
    await page.locator('[data-fz50="finish-ticket"]').click();
    assert.equal(
      await page.evaluate(() => FZInterior50.info().queue.ticket),
      null,
    );
    assert.deepEqual(
      await page.evaluate(() => ({
        money: localPlayer.money,
        health: localPlayer.health,
      })),
      balances,
    );
    await page.keyboard.press("Escape");
    await use("restricted");
    assert.match(
      await page.locator(".fz50-description").textContent(),
      /Прав сотрудника/,
    );
    await page.keyboard.press("Escape");
    // Real mobile viewport and native touch interaction, not a separate mock UI.
    await resize({ width: 390, height: 844 });
    await use("queue", undefined, undefined, true);
    await fits();
    await page.locator('[data-fz50="ticket-consult"]').tap();
    await screenshot("bank-phone-ticket");
    await page.locator('[data-fz50="ticket-route"]').tap();
    await fits();
    assert.equal(
      await page.evaluate(() => FZInterior50.info().target),
      "consult",
    );
    assert(await page.locator('[data-fz50="room-vault"]').isDisabled());
    await screenshot("bank-phone-plan");
    await resize({ width: 844, height: 390 });
    await fits();
    await page.locator('[data-fz50="close"]').focus();
    await page.keyboard.press("Tab");
    assert(
      await page.evaluate(
        () => !!document.activeElement.closest("#fzInterior50Panel"),
      ),
    );
    await page.locator('[data-fz50="close"]').tap();
    await resize({ width: 390, height: 844 });
    await page.locator('[data-fz50="open-map"]').tap();
    await page.locator('[data-fz50="clear-route"]').tap();
    assert.equal(await page.evaluate(() => FZInterior50.info().target), null);
    await page.locator('[data-fz50="close"]').tap();
    // Additional venue layouts reuse the real WebGL owner, without registering accounts.
    await resize({ width: 1100, height: 700 });
    for (const [type, name, count] of [
      ["hospital", "Клиника", 6],
      ["office", "Деловой центр", 6],
      ["office", "Городской суд", 5],
    ]) {
      await page.evaluate(
        ({ type, name }) => {
          _exitBuildingNow();
          enterBuilding(type, name);
        },
        { type, name },
      );
      await page.waitForFunction(() => FZInterior50.info()?.rooms.length > 0);
      assert.equal(
        await page.evaluate(() => FZInterior50.info().rooms.length),
        count,
      );
      assert.equal(
        await page.evaluate(
          () => interactables.filter((e) => e.command50 === "teller").length,
        ),
        0,
      );
      await page.locator('[data-fz50="open-map"]').click();
      await fits();
      await page.keyboard.press("Escape");
      if (type === "office" && name === "Деловой центр") {
        await use("printer");
        await page.locator('[data-fz50="print-start"]').click();
        assert(await page.locator('[data-fz50="print-start"]').isDisabled());
        await page.waitForFunction(
          () => FZInterior50.info().printers.some((p) => p.phase === "ready"),
          {},
          { timeout: 60000 },
        );
        await page.locator('[data-fz50="print-read"]').click();
        assert(
          await page.evaluate(() =>
            FZInterior50.info().data.completed.includes("printed"),
          ),
        );
        await page.keyboard.press("Escape");
      }
    }
    await page.locator('[data-fz50="nearby"]').click();
    assert(
      await page.getByRole("dialog", { name: "Объекты рядом" }).isVisible(),
    );
    await page.evaluate(() => backToServers());
    assert.equal(await page.locator("#fzInterior50Panel").count(), 0);
    assert.equal(await page.locator("#fzInterior50Tools").count(), 0);
    assert.equal(await page.evaluate(() => FZInterior50.info()), null);
    assert.deepEqual(errors, []);
    console.log(
      "PASS interior50: guest launch, real home and bank entrances, native stairs and lift, timed appliance, bank service/account compatibility, map/search/focus, mobile touch/rotation and teardown; PAGE_ERRORS []",
    );
  } finally {
    await browser?.close();
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once("exit", resolve);
    });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
