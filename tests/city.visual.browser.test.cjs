// GPU smoke of the real streamed-city asset; local Three r128, no external SDK.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { chromium: pw } = require("playwright-core");
(async () => {
  const c = require("@sparticuz/chromium"),
    browser = await pw.launch({
      headless: true,
      executablePath:
        process.env.CHROMIUM_EXECUTABLE || (await c.executablePath()),
      args: c.args,
    });
  try {
    const page = await browser.newPage({
        viewport: { width: 1100, height: 720 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.stack));
    page.on("console", (msg) => {
      if (
        msg.type() === "error" &&
        /WebGLProgram|shader error|VALIDATE_STATUS/.test(msg.text())
      )
        errors.push(msg.text());
    });
    const asset = fs.readFileSync(
      path.join(__dirname, "../public/assets/fz-city-stream.js"),
      "utf8",
    );
    await page.setContent(
      '<html><body style="margin:0"><script>' +
        fs.readFileSync(require.resolve("three/build/three.min.js"), "utf8") +
        "</script></body></html>",
    );
    await page.addScriptTag({
      content: `
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.1,900);
 let localPlayer={mesh:new THREE.Object3D()},interactables=[],velocity={x:0,y:0,z:0},keys={},localCar=null,isInsideBuilding=false,isInFactory=false,isInBasement=false;
 window.NEWCITY={x:3000,z:0,spawnX:3000,spawnZ:180,loaded:true};window.FZUI={playing:()=>true};window.FZ8SEA={active:()=>false,aboard:()=>false};window.FZDN={nightF:0};
 const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(innerWidth,innerHeight);renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;document.body.appendChild(renderer.domElement);
 const hemi=new THREE.HemisphereLight(0xd9e9ed,0x9c947c,.8),sun=new THREE.DirectionalLight(0xffedd2,1.1);sun.position.set(-80,140,40);scene.add(hemi,sun);
 scene.background=new THREE.Color(0xb3c8cd);scene.fog=new THREE.Fog(0xb3c8cd,200,700);
 localPlayer.mesh.position.set(4436,0,28);
 `,
    });
    await page.addScriptTag({
      content: fs.readFileSync(
        path.join(__dirname, "../public/assets/fz-city-spaces.js"),
        "utf8",
      ),
    });
    await page.addScriptTag({
      content: fs.readFileSync(
        path.join(__dirname, "../public/assets/fz-city-urban.js"),
        "utf8",
      ),
    });
    await page.addScriptTag({ content: asset });
    await page.addScriptTag({
      content: `
 window.view=(id,night=false)=>{FZCITY.travel(id);for(let n=0;n<15;n++)FZCITY.update();const p=localPlayer.mesh.position;const x=3000+Math.floor((p.x-3000)/238)*238,z=Math.floor(p.z/238)*238;camera.position.set(x+91,12,z+202);camera.lookAt(x+124,20,z+70);FZDN.nightF=night?1:0;sun.intensity=night?.08:1.1;hemi.intensity=night?.25:.8;scene.background.setHex(night?0x182c42:0xb3c8cd);scene.fog.color.copy(scene.background);};
 function frame(){requestAnimationFrame(frame);FZCITY.update();renderer.render(scene,camera);}frame();
 `,
    });
    const metrics = [];
    for (const id of [
      "heart",
      "east",
      "west",
      "campus",
      "works",
      "heights",
      "gardens",
    ]) {
      await page.evaluate((id) => view(id), id);
      await page.waitForTimeout(450);
      await page.screenshot({ path: "/home/user/city-" + id + "-v10.png" });
      metrics.push(
        await page.evaluate(() => ({
          info: FZCITY.info(),
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          textures: renderer.info.memory.textures,
        })),
      );
    }
    await page.evaluate(() => view("east", true));
    await page.waitForTimeout(400);
    await page.screenshot({ path: "/home/user/city-night-v10.png" });
    assert(
      await page.evaluate(() => {
        let lit = false;
        scene.traverse((o) => {
          if (
            o.material?.userData.cityWindows &&
            o.material.emissiveIntensity > 0.5
          )
            lit = true;
        });
        return lit;
      }),
    );
    const baseline = await page.evaluate(() => renderer.info.memory.textures);
    for (let i = 0; i < 5; i++) {
      await page.evaluate((i) => view(i % 2 ? "east" : "west"), i);
      await page.waitForTimeout(100);
    }
    assert(
      await page.evaluate(
        (n) => renderer.info.memory.textures <= n + 4,
        baseline,
      ),
    );
    assert(
      metrics.every(
        (m) =>
          m.info.chunks <= 25 &&
          m.info.geometries <= 7 &&
          m.calls < 500 &&
          m.triangles < 300000,
      ),
    );
    await page.evaluate(() => view("east"));
    for (const kind of ["park", "court", "market", "terrace"]) {
      assert(
        await page.evaluate((kind) => {
          const p = FZCITY.places().find((p) => p.kind === kind);
          if (!p) return false;
          camera.position.set(p.x + 25, 8, p.z + 27);
          camera.lookAt(p.x, 2, p.z - 20);
          return true;
        }, kind),
      );
      await page.waitForTimeout(150);
      await page.screenshot({
        path: "/home/user/city-space-" + kind + "-v10.png",
      });
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS real WebGL city styles, night windows, bounded textures and repeated streaming:",
      JSON.stringify(metrics),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
