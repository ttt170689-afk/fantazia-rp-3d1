"use strict";
// Accelerated session fixture with real production Three.js, GLB, scene builder,
// controller and WebGL. No production debug/teleport API is added. Objective
// boundary setup uses captured policy references; native input is tested separately.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  express = require("express"),
  { chromium } = require("playwright-core"),
  chrome = require("@sparticuz/chromium").default;
(async () => {
  const root = path.resolve(__dirname, ".."),
    out = path.join(root, ".cache/expedition52");
  fs.mkdirSync(out, { recursive: true });
  const html = fs.readFileSync(path.join(root, "public/index.html"), "utf8"),
    begin = html.indexOf("( function () {", html.indexOf("vendor/three-r128")),
    end = html.indexOf(
      "</script>",
      html.indexOf("THREE.SkeletonUtils =", begin),
    );
  const app = express();
  app.get("/loader52.js", (_, res) =>
    res.type("js").send(html.slice(begin, end).replace(/<\/?script>/g, "")),
  );
  app.get("/fixture52", (_, res) =>
    res
      .type("html")
      .send(
        '<!doctype html><html id="htmlRoot"><head><link rel="stylesheet" href="styles/fz-expedition52.css"><style>body{margin:0;background:#111}canvas{display:block}</style></head><body><script src="vendor/three-r128.min.js"></script><script src="loader52.js"></script><script src="assets/fz-expedition52-policy.js"></script><script src="assets/fz-expedition52-world.js"></script><script src="assets/fz-expedition52.js"></script></body></html>',
      ),
  );
  app.use(express.static(path.join(root, "public")));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "0.0.0.0", () => resolve(s));
  });
  let browser;
  try {
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
    const page = await browser.newPage({
        viewport: { width: 1280, height: 800 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.text().startsWith("CAMERA_HITS")) console.log(m.text());
    });
    await page.goto("http://127.0.0.1:" + server.address().port + "/fixture52");
    await page.evaluate(async () => {
      window.SuperRig = {
        src: await new THREE.GLTFLoader().loadAsync("exports/player_super.glb"),
      };
      ((window.currentUser = { username: "fixture52" }),
        (window.localPlayer = {
          mesh: new THREE.Group(),
          health: 73,
          money: 1234,
        }));
      localPlayer.mesh.position.set(17, 2, 8);
      ((window.FZUI = { playing: () => true, close() {} }),
        (window.FZPlay = {
          release() {},
          reducedMotion: () => window.reduce === true,
        }));
      window.showNotification = () => {};
      window.renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
      });
      renderer.setSize(1280, 800);
      renderer.domElement.id = "gameCanvas";
      document.body.prepend(renderer.domElement);
      const build = FZExpedition52World.build;
      FZExpedition52World.build = (id) => (window.testSet = build(id));
      const mission = FZExpedition52Policy.createMission;
      FZExpedition52Policy.createMission = (id) =>
        (window.testMission = mission(id));
      const step = FZExpedition52Policy.missionStep;
      FZExpedition52Policy.missionStep = (s, p, ...args) => {
        window.testPosition = p;
        step(s, p, ...args);
      };
      const render = renderer.render.bind(renderer);
      window.draw = (s, c) => {
        const before = renderer.outputEncoding;
        try {
          renderer.outputEncoding = THREE.sRGBEncoding;
          render(s, c);
        } finally {
          renderer.outputEncoding = before;
        }
      };
      renderer.render = (s, c) => {
        window.testCamera = c;
        if (!window.suppressDraw) draw(s, c);
      };
      window.frames = (n) => {
        for (let i = 0; i < n; i++) {
          window.suppressDraw = i < n - 1;
          FZExpedition52.frame(0.05);
        }
        window.suppressDraw = false;
      };
      window.key = (code, down) =>
        window.dispatchEvent(
          new KeyboardEvent(down ? "keydown" : "keyup", {
            code,
            bubbles: true,
          }),
        );
    });
    assert(await page.evaluate(() => FZExpedition52.start("depot", "story")));
    await page.evaluate(() => frames(25));
    const shotA = await page.evaluate(() => testCamera.position.toArray());
    await page.screenshot({ path: path.join(out, "cutscene-intro.png") });
    await page.evaluate(() => frames(20));
    assert.notDeepEqual(
      await page.evaluate(() => testCamera.position.toArray()),
      shotA,
    );
    await page.evaluate(() => frames(30));
    assert.equal(
      await page.evaluate(() => FZExpedition52.info().phase),
      "play",
    );
    assert(
      await page.evaluate(() => {
        const target = new THREE.Vector3(0, 1.3, 34),
          delta = target.clone().sub(testCamera.position);
        testSet.world.updateMatrixWorld(true);
        const ray = new THREE.Raycaster(
          testCamera.position,
          delta.clone().normalize(),
          0.05,
          delta.length() - 0.8,
        );
        const hits = ray.intersectObjects(testSet.world.children, true);
        if (hits.length)
          console.log(
            "CAMERA_HITS",
            JSON.stringify({
              camera: testCamera.position.toArray(),
              hits: hits.map((h) => ({
                distance: h.distance,
                point: h.point.toArray(),
                type: h.object.type,
                name: h.object.name,
                position: h.object.position.toArray(),
                scale: h.object.scale.toArray(),
                geometry: h.object.geometry.type,
                instance: h.instanceId,
              })),
            }),
          );
        return hits.length === 0;
      }),
      "start camera must stay clear of signs and light posts",
    );
    // Walk to the first note through real input; reader freezes the complete scene.
    await page.evaluate(() => {
      key("KeyA", true);
      key("KeyW", true);
      frames(16);
      key("KeyA", false);
      key("KeyW", false);
      FZExpedition52.act();
    });
    assert(await page.evaluate(() => FZExpedition52.info().reader));
    const paused = await page.evaluate(() => testMission.time);
    await page.evaluate(() => frames(8));
    assert.equal(await page.evaluate(() => testMission.time), paused);
    await page.locator("[data-action=reader-close]").click();
    assert.deepEqual(await page.evaluate(() => FZExpedition52.info().notes), [
      "depot-0",
    ]);
    // Boundary setup: ordered objective completion then actual outro camera/mixer.
    await page.evaluate(() => {
      testMission.mobs.forEach((e) => (e.hp = 0));
      for (const [x, z] of FZExpedition52Policy.map("depot").relays) {
        Object.assign(testPosition, { x, z });
        FZExpedition52.act();
      }
      Object.assign(testPosition, { x: 0, z: 32 });
      FZExpedition52.act();
      frames(15);
    });
    assert.equal(
      await page.evaluate(() => FZExpedition52.info().phase),
      "outro",
    );
    assert.equal(
      await page.evaluate(() => FZExpedition52.info().animation.clip),
      "ANIM_Victory",
    );
    const outA = await page.evaluate(() => testCamera.position.toArray());
    await page.evaluate(() => frames(25));
    assert.notDeepEqual(
      await page.evaluate(() => testCamera.position.toArray()),
      outA,
    );
    await page.screenshot({ path: path.join(out, "cutscene-outro.png") });
    const story = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("fz_expedition52:fixture52")),
    );
    assert.deepEqual(story.completed, ["depot"]);
    await page.evaluate(() => FZExpedition52.finish());
    // Race must finish only when all six checkpoints are visited in order.
    const race = await page.evaluate(() => {
      window.reduce = true;
      FZExpedition52.start("quarry", "race", "rover");
      frames(15);
      const v = testSet.vehicles.find((v) => v.id === "rover"),
        route = FZExpedition52Policy.map("quarry").checkpoints;
      Object.assign(v, { x: route[5][0], z: route[5][1] });
      frames(1);
      const skipped = FZExpedition52.info().race.index;
      frames(110);
      for (const [x, z] of route) {
        Object.assign(v, { x, z, speed: 0 });
        frames(1);
      }
      return {
        skipped,
        race: FZExpedition52.info().race,
        best: JSON.parse(localStorage.getItem("fz_expedition52:fixture52"))
          .best,
      };
    });
    assert.equal(race.skipped, 0);
    assert(race.race.done);
    assert(race.best.quarry > 5);
    await page.evaluate(() => FZExpedition52.finish());
    // Actual articulated monster and vehicle transforms, all action clips, finite
    // skinning, independent clones, stable GPU allocations across six lifecycles.
    const visual = await page.evaluate(() => {
      const W = FZExpedition52World,
        P = FZExpedition52Policy,
        set = W.build("observatory"),
        state = P.createMission("observatory"),
        a = W.actor(),
        b = W.actor();
      set.world.add(a.root, b.root);
      b.root.position.x = 2;
      const cam = new THREE.PerspectiveCamera(55, 1280 / 800, 0.05, 160);
      cam.position.set(14, 22, 36);
      cam.lookAt(0, 0, 0);
      const bone = (o) => {
        let result;
        o.traverse((n) => {
          if (n.isBone && !result) result = n;
        });
        return result;
      };
      const isolated = bone(a.root) !== bone(b.root);
      let finite = true;
      for (const pose of ["idle", "walk", "run", "attack", "down", "win"]) {
        for (let i = 0; i < 12; i++) {
          a.update(0.05, pose);
          a.root.updateMatrixWorld(true);
          a.root.traverse((o) => {
            finite = finite && o.matrixWorld.elements.every(Number.isFinite);
          });
        }
        if (a.info().fallback) throw Error("GLB fallback");
      }
      state.mobs[0].state = "windup";
      W.animate(set, state, 1, 0.05);
      const warning = set.monsters.get(0).warning.visible;
      state.mobs[0].state = "chase";
      W.animate(set, state, 1, 0.05);
      const leg = set.monsters.get(0).legs[0].rotation.x;
      W.animate(set, state, 1.4, 0.05);
      const legMoves = leg !== set.monsters.get(0).legs[0].rotation.x;
      W.animate(set, state, 1.4, 0.05, true);
      const reduced = set.monsters.get(0).legs.every((l) => l.rotation.x === 0);
      const v = set.vehicles[0];
      v.speed = 5;
      v.door = 1;
      W.animate(set, state, 2, 0.05);
      const wheel = v.wheels[0].rotation.x;
      W.animate(set, state, 2.1, 0.05);
      const wheels = v.wheels[0].rotation.x !== wheel,
        doors = v.doors.every((d) => Math.abs(d.rotation.y) === 1);
      draw(set.world, cam);
      const before = { ...renderer.info.memory };
      for (let i = 0; i < 6; i++) {
        const temp = W.build(P.maps[i % 3].id),
          actor = W.actor();
        temp.world.add(actor.root);
        actor.update(0.05, "run");
        draw(temp.world, cam);
        actor.dispose();
        temp.dispose();
        draw(set.world, cam);
      }
      const after = { ...renderer.info.memory };
      window.visualSet = set;
      window.visualCamera = cam;
      return {
        isolated,
        finite,
        warning,
        legMoves,
        reduced,
        wheels,
        doors,
        before,
        after,
        glError: renderer.getContext().getError(),
      };
    });
    for (const k of [
      "isolated",
      "finite",
      "warning",
      "legMoves",
      "reduced",
      "wheels",
      "doors",
    ])
      assert(visual[k], k);
    assert.deepEqual(visual.after, visual.before);
    assert.equal(visual.glError, 0);
    await page.screenshot({ path: path.join(out, "observatory-overview.png") });
    // Show each distinct owned set at full resolution, not the software native
    // test's reduced framebuffer. These are real renderer output, not mockups.
    for (const id of ["depot", "quarry"]) {
      await page.evaluate((id) => {
        const s = FZExpedition52World.build(id);
        FZExpedition52World.animate(
          s,
          FZExpedition52Policy.createMission(id),
          1,
          0.05,
        );
        draw(s.world, visualCamera);
        window.nextSet = s;
      }, id);
      await page.screenshot({ path: path.join(out, id + "-overview.png") });
      await page.evaluate(() => nextSet.dispose());
    }
    // Reduced camera is still; failed mission uses the defeat clip and allows retry.
    const recovery = await page.evaluate(() => {
      FZExpedition52.start("observatory", "story");
      frames(1);
      const a = testCamera.position.toArray();
      frames(6);
      const still =
        JSON.stringify(a) === JSON.stringify(testCamera.position.toArray());
      frames(8);
      testMission.hp = 0;
      testMission.failed = true;
      frames(6);
      return { still, clip: FZExpedition52.info().animation.clip };
    });
    assert(recovery.still);
    assert.equal(recovery.clip, "ANIM_Defeat");
    await page.locator("[data-action=retry]").click();
    assert.equal(await page.evaluate(() => FZExpedition52.info().health), 100);
    await page.evaluate(() => {
      FZExpedition52.finish();
      window.currentUser = { username: "other52" };
      FZExpedition52.open();
    });
    assert.deepEqual(
      await page.evaluate(() => FZExpedition52.info().notes),
      [],
    );
    await page.evaluate(() => FZExpedition52.finish());
    assert.deepEqual(
      await page.evaluate(() => ({
        position: localPlayer.mesh.position.toArray(),
        health: localPlayer.health,
        money: localPlayer.money,
        encoding: renderer.outputEncoding,
        cine: window.cine,
      })),
      {
        position: [17, 2, 8],
        health: 73,
        money: 1234,
        encoding: 3000,
        cine: null,
      },
    );
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ story, race, visual, recovery }));
    console.log(
      "PASS WebGL session fixture: note reader, ordered completion/outro, ordered race, animation transforms, reduced motion, retry, per-user journal, disposal. PAGE_ERRORS []",
    );
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
