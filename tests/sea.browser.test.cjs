// Start: SEA_PREVIEW=1 PORT=3002 node tests/preview.cjs
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { chromium: pw } = require('playwright-core');
(async () => {
  let executable = process.env.CHROMIUM_EXECUTABLE,
    args = ['--no-sandbox'];
  if (!executable) {
    const chromium = require('@sparticuz/chromium');
    executable = await chromium.executablePath();
    args = chromium.args;
  }
  const browser = await pw.launch({ headless: true, executablePath: executable, args });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto(process.env.REVIEW_URL || 'http://127.0.0.1:3002');
    await page.waitForFunction(() => window.FZ8SEA && FZ8SEA.info().built);
    const dest = path.join(__dirname, 'reports');
    fs.mkdirSync(dest, { recursive: true });
    for (const [name, x, z, yaw, pitch] of [
      ['port', -91, 12, -Math.PI / 2, -0.02],
      ['bridge', -59, -49, -Math.PI / 2, 0.1],
      ['ships', -65, -118, -Math.PI / 2, 0.04],
      ['beach', -95, 74, -Math.PI * 0.7, -0.05],
      ['lighthouse', 116, 90, Math.PI, 0.16],
    ]) {
      await page.evaluate((args) => seaView(...args), [x, z, yaw, pitch]);
      await page.waitForTimeout(220);
      await page.screenshot({ path: path.join(dest, 'sea-' + name + '.png') });
      console.log(
        name,
        await page.evaluate(() => ({
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          textures: renderer.info.memory.textures,
        })),
      );
    }
    await page.evaluate(() => {
      seaView(-47, 32);
      const s = interactables.find((s) => s.id === 'west' && s.fz8sea);
      while (FZ8SEA.info().state !== 'dwell' || FZ8SEA.info().port !== 0 || FZ8SEA.info().wait < 2)
        FZ8SEA.update(0.1);
      FZ8SEA.interact(s);
    });
    assert.equal(await page.evaluate(() => FZ8SEA.info().aboard), 'ferry');
    await page.evaluate(() => {
      yaw = 0;
      pitch = 0.04;
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(dest, 'sea-ferry.png') });
    // Cycle several crossings and verify bounded rendering resources.
    const baseline = await page.evaluate(() => ({
      geo: renderer.info.memory.geometries,
      tex: renderer.info.memory.textures,
    }));
    await page.evaluate(() => {
      for (let i = 0; i < 2200; i++) FZ8SEA.update(0.1);
    });
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => ({
      geo: renderer.info.memory.geometries,
      tex: renderer.info.memory.textures,
    }));
    assert(after.geo <= baseline.geo + 3 && after.tex <= baseline.tex + 4);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#menu').click();
    assert(await page.locator('#fzSeaModal').isVisible());
    assert(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
    await page.screenshot({ path: path.join(dest, 'sea-mobile.png') });
    await page.keyboard.press('Escape');
    assert(await page.locator('#fzSeaModal').isHidden());
    assert.deepEqual(errors, []);
    console.log(
      'PASS sea WebGL: water shader, five views, ferry boarding, bounded resources, mobile map and Escape.',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
