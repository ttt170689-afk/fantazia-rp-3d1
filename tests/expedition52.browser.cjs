"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  { fork } = require("node:child_process"),
  { chromium } = require("playwright-core"),
  chrome = require("@sparticuz/chromium").default;
(async () => {
  const root = path.resolve(__dirname, ".."),
    out = path.join(root, ".cache/expedition52");
  fs.mkdirSync(out, { recursive: true });
  const child = fork(path.join(root, "server.js"), {
    cwd: root,
    env: { ...process.env, PORT: "0", FANTAZIA_RUNTIME_SECRET: "S".repeat(43) },
    execArgv: ["--require", path.join(__dirname, "closed-fixture-hook.cjs")],
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  let browser,
    logs = "";
  child.stdout.on("data", (b) => (logs += b));
  child.stderr.on("data", (b) => (logs += b));
  try {
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error(logs)), 12000);
      child.once("message", (m) => {
        clearTimeout(timer);
        resolve(m.port);
      });
    });
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
        (a) =>
          ![
            "--disable-web-security",
            "--allow-running-insecure-content",
            "--single-process",
          ].includes(a),
      ),
      headless: true,
    });
    const url = "http://127.0.0.1:" + port,
      page = await browser.newPage({
        viewport: { width: 1280, height: 800 },
        reducedMotion: "reduce",
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && /Expedition52/.test(m.text()))
        errors.push(m.text());
    });
    await page.route("**/*", (r) =>
      r.request().url().startsWith(url) ||
      /^(blob|data):/.test(r.request().url())
        ? r.continue()
        : r.abort(),
    );
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => currentUser?.isGuest === true);
    await page.waitForSelector("#fzIntro", {
      state: "detached",
      timeout: 16000,
    });
    await page.locator(".fz-story-choice40 input").check();
    await page.locator(".fz-menu-btn.fz-play").click();
    await page.waitForFunction(
      () =>
        localPlayer?.mesh &&
        renderer?.info.render.frame > 25 &&
        !window._loadingGate &&
        FZUI.playing(),
      {},
      { timeout: 450000 },
    );
    await page.evaluate(() => {
      SETTINGS.renderScale = 0.35;
      SETTINGS.dynRes = false;
      renderer.setPixelRatio(0.35);
      window.beforeExp = {
        position: localPlayer.mesh.position.toArray(),
        health: localPlayer.health,
        money: localPlayer.money,
        inventory: JSON.stringify(localPlayer.inventory),
        camera: [camera.near, camera.far, camera.fov],
        encoding: renderer.outputEncoding,
      };
    });
    await page.evaluate(() => FZUI.open());
    await page.locator("#fzUISearch").fill("Экспедиции");
    await page
      .locator("#fzUIList button")
      .filter({ hasText: "Экспедиции" })
      .click();
    await page.waitForSelector("#fzExpedition52Menu");
    assert(
      await page
        .locator("#fzExpedition52Menu")
        .innerText()
        .then((t) => t.includes("12")),
    );
    await page.screenshot({ path: path.join(out, "menu.png") });
    await page.locator("[data-action=story]").click();
    await page.waitForFunction(() => FZExpedition52.info().phase === "play");
    assert.equal(
      await page.evaluate(() => FZExpedition52.info().animation.fallback),
      false,
    );
    await page.keyboard.down("KeyA");
    await page.waitForFunction(
      () => FZExpedition52.info().position.x < -7.2,
      {},
      { timeout: 45000 },
    );
    await page.keyboard.up("KeyA");
    await page.locator("[data-action=interact]").click();
    await page.waitForFunction(() => FZExpedition52.info().vehicle === "rally");
    const start = await page.evaluate(() => FZExpedition52.info().position.x);
    await page.keyboard.down("KeyW");
    await page.waitForFunction(
      (x) => FZExpedition52.info().position.x > x + 4,
      start,
      { timeout: 45000 },
    );
    await page.keyboard.up("KeyW");
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => FZExpedition52.info().paused), true);
    const paused = await page.evaluate(() => FZExpedition52.info().position);
    await page.waitForTimeout(150);
    assert.deepEqual(
      await page.evaluate(() => FZExpedition52.info().position),
      paused,
    );
    await page.keyboard.press("Escape");
    await page.screenshot({ path: path.join(out, "depot-driving.png") });
    await page.locator("[data-action=exit]").click();
    assert(
      await page.evaluate(
        () =>
          JSON.stringify(localPlayer.mesh.position.toArray()) ===
            JSON.stringify(beforeExp.position) &&
          localPlayer.health === beforeExp.health &&
          localPlayer.money === beforeExp.money &&
          JSON.stringify(localPlayer.inventory) === beforeExp.inventory,
      ),
    );
    // Exercise every real set and GLB mixer, then teardown repeatedly.
    const reports = [];
    for (const map of ["depot", "quarry", "observatory"]) {
      assert(
        await page.evaluate((map) => FZExpedition52.start(map, "story"), map),
      );
      await page.waitForFunction(() => FZExpedition52.info().phase === "play");
      await page.keyboard.down("KeyW");
      await page.waitForFunction(
        () => FZExpedition52.info().animation.clip === "ANIM_Run_Loop",
      );
      await page.keyboard.up("KeyW");
      await page.locator("[data-action=fire]").click();
      await page.waitForFunction(
        () => FZExpedition52.info().animation.clip === "ANIM_Point",
      );
      reports.push(
        await page.evaluate(() => ({
          state: FZExpedition52.info(),
          calls: renderer.info.render.calls,
          memory: { ...renderer.info.memory },
        })),
      );
      await page.screenshot({ path: path.join(out, map + ".png") });
      await page.evaluate(() => FZExpedition52.finish());
      assert.equal(await page.locator("#fzExpedition52").count(), 0);
    }
    assert(
      await page.evaluate(() =>
        FZExpedition52.start("quarry", "race", "coupe"),
      ),
    );
    await page.waitForFunction(() => FZExpedition52.info().phase === "play");
    assert.equal(
      await page.evaluate(() => FZExpedition52.info().vehicle),
      "coupe",
    );
    await page.keyboard.down("KeyW");
    await page.waitForFunction(() => FZExpedition52.info().race.time > 1);
    await page.keyboard.up("KeyW");
    await page.evaluate(() => FZExpedition52.finish());
    // Browser client + second authenticated guest socket: both online modes,
    // remote rig rendering and server-owned termination, without a fake bot.
    const { io } = require("socket.io-client");
    const peer = io(url, { transports: ["websocket"], reconnection: false });
    try {
      await new Promise((resolve, reject) => {
        peer.once("connect", resolve);
        peer.once("connect_error", reject);
      });
      const registration = new Promise((resolve) =>
        peer.once("registered", resolve),
      );
      peer.emit("registerPlayer", {});
      await registration;
      for (const mode of ["duel", "control"]) {
        assert(
          await page.evaluate(
            (mode) => FZExpedition52.start("depot", mode),
            mode,
          ),
        );
        await page.waitForFunction(
          () => FZExpedition52.info().network?.phase === "waiting",
        );
        await page.locator("[data-action=pause]").click();
        const result = await new Promise((resolve) =>
          peer.emit("exp52:join", { map: "depot", mode }, resolve),
        );
        assert(result.ok);
        await page.waitForFunction(
          () =>
            FZExpedition52.info().network?.phase === "active" &&
            FZExpedition52.info().remoteActors === 1,
        );
        await page.screenshot({
          path: path.join(out, "online-" + mode + ".png"),
        });
        peer.emit("exp52:leave");
        await page.waitForFunction(
          () => FZExpedition52.info().network?.phase === "ended",
        );
        await page.evaluate(() => FZExpedition52.finish());
        await page.waitForTimeout(1050);
      }
    } finally {
      peer.close();
    }
    // Portrait/landscape HUD and pointer capture; no forced fullscreen dimensions.
    await page.evaluate(async () => {
      if (document.fullscreenElement) await document.exitFullscreen();
    });
    const session = await page.context().newCDPSession(page),
      win = await session.send("Browser.getWindowForTarget");
    await session.send("Browser.setWindowBounds", {
      windowId: win.windowId,
      bounds: { windowState: "normal" },
    });
    await session.detach();
    for (const size of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(size);
      assert(await page.evaluate(() => FZExpedition52.open()));
      assert(
        await page
          .locator("#fzExpedition52Menu")
          .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      );
      await page.locator("[data-action=observatory]").click();
      await page.locator("[data-action=story]").click();
      await page.waitForFunction(() => FZExpedition52.info().phase === "play");
      assert(
        await page.locator(".exp52-actions").evaluate((el) => {
          const r = el.getBoundingClientRect();
          return r.right <= innerWidth && r.bottom <= innerHeight;
        }),
      );
      const pad = await page.locator("[data-action=KeyW]").boundingBox();
      await page.mouse.move(pad.x + 20, pad.y + 20);
      await page.mouse.down();
      await page
        .locator("[data-action=KeyW]")
        .dispatchEvent("pointercancel", { pointerId: 1 });
      await page.mouse.up();
      await page.screenshot({
        path: path.join(out, "mobile-" + size.width + ".png"),
      });
      await page.evaluate(() => FZExpedition52.finish());
    }
    assert.equal(await page.evaluate(() => FZExpedition52.info().error), "");
    assert(
      await page.evaluate(
        () =>
          !window.cine &&
          renderer.outputEncoding === beforeExp.encoding &&
          JSON.stringify([camera.near, camera.far, camera.fov]) ===
            JSON.stringify(beforeExp.camera),
      ),
    );
    assert.deepEqual(errors, []);
    console.log("REPORTS", JSON.stringify(reports));
    console.log(
      "PASS native WebGL expeditions: menu, three sets, GLB idle/run/point, car drive, pause, race, mobile layout/cancel, city restoration. PAGE_ERRORS []",
    );
  } finally {
    await browser?.close();
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once("exit", resolve);
    });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
