'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{fork}=require('node:child_process');
const {chromium}=require('playwright-core'),chrome=require('@sparticuz/chromium').default;
(async()=>{
 const root=path.resolve(__dirname,'..'),child=fork(path.join(root,'server.js'),{cwd:root,env:{...process.env,PORT:'0',FANTAZIA_RUNTIME_SECRET:'S'.repeat(43)},execArgv:['--require',path.join(__dirname,'closed-fixture-hook.cjs')],stdio:['ignore','pipe','pipe','ipc']});let browser,logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
 try{
  let timer;const port=await Promise.race([new Promise((resolve,reject)=>{child.once('message',m=>resolve(m.port));child.once('exit',()=>reject(Error(logs)));}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('startup timeout')),12000);})]).finally(()=>clearTimeout(timer));
  if(process.platform==='linux'){const pkg=require('@sparticuz/chromium');await pkg.inflate(path.join(path.dirname(require.resolve('@sparticuz/chromium')),'../bin/al2023.tar.br'));pkg.setupLambdaEnvironment(path.join(require('node:os').tmpdir(),'al2023/lib'));}
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||await chrome.executablePath(),args:chrome.args.filter(a=>!['--disable-web-security','--allow-running-insecure-content','--single-process'].includes(a)),headless:true});const url='http://127.0.0.1:'+port;
  for(const mobile of [false,true]){
   const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:800},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',r=>r.request().url().startsWith(url)||/^(blob|data):/.test(r.request().url())?r.continue():r.abort());
   await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>currentUser?.isGuest===true);
   await page.waitForSelector('#fzIntro',{state:'detached',timeout:16000});
   await page.locator('.fz-play').click();await page.waitForSelector('#fzRoom48');
   assert.equal(await page.evaluate(()=>document.body.classList.contains('game-active')),false);
   assert.equal(await page.evaluate(()=>FZRoom48.info().reduced),true);
   await page.evaluate(()=>{void startGameDirect();});assert.equal(await page.locator('#fzRoom48').count(),1);
   assert.equal(await page.evaluate(()=>FZFront.start()),false,'old intro must not steal the prologue');
   const fits=async()=>assert(await page.locator('#fzRoom48').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
   await fits();assert.equal(await page.locator('#fzRoom48 [data-dir] svg path').count(),4);
   if(mobile){
    const pad=await page.locator('#fzRoom48 [data-dir=right]').boundingBox(),touch=await context.newCDPSession(page);
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:pad.x+pad.width/2,y:pad.y+pad.height/2}]});
    await page.waitForFunction(()=>FZRoom48.info().x>210);
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.detach();
    await page.setViewportSize({width:844,height:390});await fits();await page.setViewportSize({width:390,height:844});
    const box=await page.locator('#fzRoom48 canvas').boundingBox();
    await page.touchscreen.tap(box.x+box.width*684/960,box.y+box.height*240/540);
   }else{
    await page.keyboard.down('d');await page.waitForFunction(()=>FZRoom48.info().x>210);await page.keyboard.up('d');
    await page.locator('#fzRoom48 [data-walk]').click();
   }
   await page.waitForFunction(()=>{const s=FZRoom48.info();return s&&Math.hypot(s.x-684,s.y-360)<8;},{},{timeout:15000});
   if(process.env.FZ_ROOM_SCREENSHOT)await page.screenshot({path:process.env.FZ_ROOM_SCREENSHOT.replace('.png',mobile?'-phone.png':'-desktop.png')});
   if(mobile)await page.locator('#fzRoom48 [data-act]').click();else await page.keyboard.press('e');await page.waitForFunction(()=>FZRoom48.info().phase==='boot');
   await page.keyboard.press('Escape');const paused=await page.evaluate(()=>FZRoom48.info());assert(paused.paused);
   await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>FZRoom48.info().time),paused.time);
   await page.locator('#fzRoom48 [data-resume]').click();await page.waitForFunction(()=>FZRoom48.info().time>0);
   await page.locator('#fzRoom48 [data-exit]').click();await page.waitForSelector('#fzRoom48',{state:'detached'});
   assert(await page.locator('#serverScreen').isVisible());assert.equal(await page.evaluate(()=>_gameStarted),false);
   assert.equal(await page.evaluate(()=>FZProgress40.has('opening')),false,'2D exit must not mark the 3D story seen');
   await page.locator('.fz-play').click();await page.waitForSelector('#fzRoom48');
   await page.evaluate(()=>backToServers());await page.waitForSelector('#fzRoom48',{state:'detached'});
   assert.equal(await page.evaluate(()=>document.body.classList.contains('game-active')),false);
   assert.equal(await page.evaluate(()=>FZRoom48.active()),false);
   assert.deepEqual(errors,[]);await context.close();
   console.log('PASS room '+(mobile?'mobile touch':'desktop keyboard')+': Play gate, computer path/interaction, reduced motion, portrait/landscape, pause, menu/re-entry and external cancellation');
  }
 }finally{await browser?.close();child.kill('SIGTERM');await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);});}
})().catch(e=>{console.error(e);process.exitCode=1;});
