// Run after `node tests/preview.cjs`. Optional browser dependencies, see README.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium:pw}=require('playwright-core');
(async()=>{
  let executable=process.env.CHROMIUM_EXECUTABLE,args=['--no-sandbox'];
  if(!executable){const chromium=require('@sparticuz/chromium');executable=await chromium.executablePath();args=chromium.args;}
  const browser=await pw.launch({headless:true,executablePath:executable,args});
  try {
    const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.env.REVIEW_URL||'http://127.0.0.1:3001');
    await page.waitForFunction(()=>window.FZ8B&&FZ8B.info());
    const dest=path.join(__dirname,'reports');fs.mkdirSync(dest,{recursive:true});
    for(const [name,type,floor,room] of [['classroom','school',0,0],['kitchen','house',0,0],['bathroom','house',0,3],['bedroom','apartment',1,2],['library','school',1,3]]) {
      await page.evaluate(a=>reviewView(...a),[type,floor,room]);
      await page.waitForFunction(()=>renderer.info.render.calls>0);
      await page.screenshot({path:path.join(dest,name+'.png')});
      const stats=await page.evaluate(()=>({draws:renderer.info.render.calls,geometry:renderer.info.memory.geometries}));
      assert(stats.draws>0&&stats.draws<250); console.log(name,stats);
    }
    await page.setViewportSize({width:390,height:844});await page.locator('#menu').click();
    assert(await page.locator('#fz8bPanel').isVisible());
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert(!overflow);
    await page.screenshot({path:path.join(dest,'mobile.png')});await page.keyboard.press('Escape');assert(await page.locator('#fz8bPanel').isHidden());
    assert.deepEqual(errors,[]);console.log('PASS: WebGL views, mobile layout, dialog Escape; no page errors.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
