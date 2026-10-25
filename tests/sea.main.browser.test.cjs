// Native-game integration test. Requires the real game server on port 3000.
// External SDKs are blocked; Three.js CDN is fulfilled with the pinned local r128.
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const { chromium: pw } = require('playwright-core');
(async () => {
  let executable = process.env.CHROMIUM_EXECUTABLE,
    args = ['--no-sandbox'];
  if (!executable) {
    const c = require('@sparticuz/chromium');
    executable = await c.executablePath();
    args = c.args;
  }
  const b = await pw.launch({ headless: true, executablePath: executable, args });
  try {
    const page = await b.newPage({ viewport: { width: 900, height: 650 } }),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.stack));
    const url = process.env.GAME_URL || 'http://127.0.0.1:3000';
    await page.route('**/*', (route) => {
      const u = route.request().url();
      if (u.startsWith(url) || u.startsWith('blob:') || u.startsWith('data:')) return route.continue();
      if (u === 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js')
        return route.fulfill({
          body: fs.readFileSync(require.resolve('three/build/three.min.js')),
          contentType: 'application/javascript',
        });
      return route.abort();
    });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.FZ8SEA);
    await page.evaluate(() => {
      sessionStorage.setItem('fz_nc_auto', '1');
      window._fallIntroDone = true;
      window._introDone = true;
      window.FZFront?.finish();
      startGameDirect();
    });
    await page.waitForFunction(
      () => typeof localPlayer !== 'undefined' && localPlayer && localPlayer.mesh && cityWorldReady(),
      {},
      { timeout: 60000 },
    );
    await page.waitForFunction(() => !window._loadingGate && window.FZSky?.active());
    await page.evaluate(() => FZSky.descend());
    await page.evaluate(() => document.getElementById('cityIntroSkip').click()); // This harness seeds the session rather than using the auth UI.
    await page.waitForFunction(() => !window.cine);
    // Bypass cinematics, not native movement or scene lifecycle.
    const start = await page.evaluate(() => {
      window._loadingGate = false;
      window.cine = null;
      window._fallIntroDone = true;
      const p = localPlayer.mesh.position;
      return { x: p.x, y: p.y, z: p.z };
    });
    assert.equal(await page.evaluate(() => FZ8SEA.enter()), true);
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => _fzGroundY()), 2);
    const movement = await page.evaluate(() => {
      const p = localPlayer.mesh.position;
      return !checkCollision(p.x + 1, p.z) && checkCollision(6000, 0);
    });
    assert(movement);
    await page.evaluate(() => {
      localPlayer.mesh.position.set(6000, 6, -49);
    });
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => _fzGroundY()), 6);
    await page.evaluate(() => {
      const s = interactables.find((s) => s.id === 'west' && s.fz8sea);
      localPlayer.mesh.position.set(s.position.x, s.position.y, s.position.z);
      while (FZ8SEA.info().state !== 'dwell' || FZ8SEA.info().port !== 0 || FZ8SEA.info().wait < 2)
        FZ8SEA.update(0.1);
      nearestInteractable = s;
      handleInteraction();
    });
    assert.equal(await page.evaluate(() => FZ8SEA.info().aboard), 'ferry');
    await page.evaluate(() => {
      enterBuilding('house', 'Blocked aboard');
    });
    assert.equal(await page.evaluate(() => isInsideBuilding), false);
    await page.evaluate(() => {
      for (let i = 0; i < 2000; i++) {
        FZ8SEA.update(0.05);
        if (FZ8SEA.info().state === 'dwell' && FZ8SEA.info().port === 1) break;
      }
    });
    assert.equal(await page.evaluate(() => FZ8SEA.disembark()), true);
    assert.equal(await page.evaluate(() => FZ8SEA.info().stats.voyages), 1);
    assert.equal(await page.evaluate(() => FZ8SEA.leave()), true);
    const end = await page.evaluate(() => ({
      x: localPlayer.mesh.position.x,
      z: localPlayer.mesh.position.z,
    }));
    assert(Math.abs(end.x - start.x) < 0.1 && Math.abs(end.z - start.z) < 0.1);
    // Older interiors still work after the complete trip.
    await page.evaluate(() => FZ8B.visit('school'));
    assert.equal(await page.evaluate(() => FZ8B.info().rooms.length), 6);
    await page.evaluate(() => changeFloor(1));
    assert.equal(await page.evaluate(() => _fzGroundY()), 3.5);
    await page.evaluate(() => _exitBuildingNow());
    assert.deepEqual(errors, []);
    console.log(
      'PASS native game: original city, sea travel, bridge ground, E boarding, deck-entry guard, ferry crossing, exact return and school regression.',
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
