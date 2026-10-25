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
    const base = process.env.GAME_URL || "http://127.0.0.1:3000";
    const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
    p.on("pageerror", (e) => errors.push(e.stack));
    await p.route("**/*", (r) =>
      r.request().url().startsWith(base) ||
      /^(blob|data):/.test(r.request().url())
        ? r.continue()
        : r.abort(),
    );
    await p.goto(base, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(
      () => window.FZFront?.info().ready,
      {},
      { timeout: 120000 },
    );
    assert.equal(await p.evaluate(() => FZFront.info().build), 28);
    assert.equal(
      await p.locator(".front-credit-type strong").isVisible(),
      false,
      "the title must be geometry, not an enlarged HTML duplicate",
    );
    await p.evaluate(() => {
      FZFront.finish();
      window.renderer = renderer;
      window.scene = scene;
      window.camera = camera;
      FZ8GFX_update(0.016);
      FZFX.sessionQuality("ultra");
      window.probe = { targets: 0, frames: [], early: [], passes: 0 };
      const setTarget = renderer.setRenderTarget.bind(renderer),
        draw = renderer.render.bind(renderer);
      renderer.setRenderTarget = (target, ...args) => {
        if (target && FZFront.active()) probe.targets++;
        return setTarget(target, ...args);
      };
      renderer.render = (world, cam) => {
        const result = draw(world, cam);
        if (cam.userData.fzOpeningPass) {
          probe.passes++;
          const t = FZFront.info().elapsed;
          if (t < 1.2) probe.early.push(cam.layers.mask);
          if (t > 1.62 && t < 1.84) {
            const gl = renderer.getContext(),
              v = new Uint8Array(4);
            gl.readPixels(
              Math.floor(gl.drawingBufferWidth / 2),
              Math.floor(gl.drawingBufferHeight / 2),
              1,
              1,
              gl.RGBA,
              gl.UNSIGNED_BYTE,
              v,
            );
            probe.frames.push({ mask: cam.layers.mask, pixel: Array.from(v) });
          }
        }
        return result;
      };
      // Deterministic director ticks let software WebGL sample the short A passage.
      // Wall-clock seven-second playback is covered separately, without this shim.
      window.nativeRAF = requestAnimationFrame.bind(window);
      let tick = performance.now();
      window.requestAnimationFrame = (fn) =>
        nativeRAF((now) => fn(fn.name === "frame" ? (tick += 40) : now));
      FZFront.start();
    });
    await p.waitForFunction(
      () => FZFront.info().elapsed > 2.15,
      {},
      { timeout: 60000 },
    );
    const sample = await p.evaluate(() => probe);
    assert(sample.passes > 8);
    assert(
      sample.early.length > 0 && sample.early.every((mask) => mask !== 1),
      "city cannot appear behind the initial credit",
    );
    assert.equal(
      sample.targets,
      0,
      "intro bypasses the compositor even with ultra FX already initialized",
    );
    assert(sample.frames.length >= 2);
    for (let i = 0; i + 1 < sample.frames.length; i += 2) {
      const a = sample.frames[i],
        z = sample.frames[i + 1];
      assert.equal(a.mask, 1);
      assert.equal(z.mask, 2);
      assert(
        a.pixel.slice(0, 3).reduce((a, b) => a + b, 0) > 30,
        "native city is actually rendered",
      );
      assert.deepEqual(
        a.pixel,
        z.pixel,
        "city remains visible through the real hole after the title pass",
      );
    }
    await p.waitForFunction(
      () => FZFront.info().elapsed > 3.4,
      {},
      { timeout: 60000 },
    );
    await p.screenshot({ path: "/home/user/v27-actors.png" });
    await p.waitForFunction(
      () => FZFront.info().elapsed > 4.8,
      {},
      { timeout: 30000 },
    );
    await p.screenshot({ path: "/home/user/v27-handover.png" });
    assert(
      await p.evaluate(() =>
        FZFront.info().cast.every((a) => a.model === "game-player-super-v26"),
      ),
    );
    await p.click("#fzIntroSkip");
    assert.equal(await p.locator("#fzIntro").count(), 0);
    await p.evaluate(() => {
      window.requestAnimationFrame = nativeRAF;
    });
    // A failed font is an explicit static fallback, not fake dissolving typography.
    await p.route("**/fonts/helvetiker_bold.typeface.json", (r) =>
      r.fulfill({ status: 503, body: "unavailable" }),
    );
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(
      () => window.FZFront?.info().failed,
      {},
      { timeout: 60000 },
    );
    assert.equal(
      await p.evaluate(
        () =>
          getComputedStyle(document.querySelector(".front-credit-type"))
            .transform,
      ),
      "none",
    );
    assert(
      (await p.locator(".front-loading").innerText()).includes("недоступна"),
    );
    await p.click("#fzIntroSkip");
    assert.deepEqual(errors, []);
    console.log(
      "PASS opening compositor with v26 game cast: real glyph instead of CSS zoom, build marker, ultra-FX replay preserves city pixels through A, refined cast, font-error fallback and skip; no page errors.",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
