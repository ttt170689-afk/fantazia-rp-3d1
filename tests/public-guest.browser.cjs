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
   const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:800},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[];
   // An optional third-party SDK that never resolves must not hold up guest entry.
   await page.addInitScript(()=>{window.YaGames={init:()=>new Promise(()=>{})};});
   page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith(url)||/^(blob|data):/.test(r.request().url())?r.continue():r.abort());
   await page.goto(url,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>typeof currentUser!=='undefined'&&currentUser?.isGuest===true,{},{timeout:20000});
   await page.waitForSelector('#fzIntro',{state:'detached',timeout:16000});
   assert.equal(await page.locator('#authScreen').isVisible(),false);assert(await page.locator('#serverScreen').isVisible());assert(await page.locator('.fz-menu-btn.fz-play').isVisible());
   await page.locator('.fz-menu-btn.fz-play').click({trial:true});
   assert(await page.locator('#publicAccessNote').innerText().then(t=>t.includes('без регистрации')));
   const helpButton=page.locator('.fz-menu-nav button').filter({hasText:'Как играть'});
   await helpButton.click();
   assert(await page.locator('#fzQuickHelp').isVisible());
   assert.match(await page.locator('#fzQuickHelp').innerText(),/Фонарь у обломков/);
   assert.match(await page.locator('#fzQuickHelp').innerText(),/Гостевой прогресс автоматически в аккаунт не переносится/);
   const checkWidth=async selector=>assert(await page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&el.scrollWidth<=el.clientWidth+1;}),selector+' fits viewport');
   await checkWidth('#fzQuickHelp');
   if(mobile){await page.setViewportSize({width:844,height:390});await checkWidth('#fzQuickHelp');await page.setViewportSize({width:390,height:844});}
   await page.keyboard.press('Escape');assert.equal(await page.locator('#fzQuickHelp').isVisible(),false);
   assert(await helpButton.evaluate(el=>el===document.activeElement));
   await page.locator('.fz-menu-btn.fz-play').click({trial:true});
   await checkWidth('#publicAccessNote');
   assert.equal(await page.evaluate(()=>currentUser.token),null);assert.equal(await page.evaluate(()=>currentUser.isAdmin),false);
   await page.evaluate(()=>logoutUser());await page.waitForFunction(()=>currentUser?.isGuest===true);assert.equal(await page.locator('#authScreen').isVisible(),false);
   // Session outage, bounded waiting (including the response body), retry and stale identity clearing.
   await page.route('**/api/session/me',r=>r.fulfill({status:503,body:'unavailable'}));
   await page.evaluate(()=>initAuth());
   assert.equal(await page.evaluate(()=>currentUser),null);
   assert.equal(await page.locator('#serverScreen').isVisible(),false);
   assert.equal(await page.locator('#publicConnectionError').getAttribute('data-state'),'error');
   await checkWidth('#publicConnectionError > div');
   await page.unroute('**/api/session/me');
   let heldRequests=0;
   await page.route('**/api/session/me',()=>{heldRequests++;});
   await page.locator('#publicConnectionError button').click();
   await page.waitForFunction(()=>document.getElementById('publicConnectionError')?.dataset.state==='pending');
   await page.evaluate(()=>{void initAuth();void initAuth();}); // Deduplicated while waiting.
   await page.waitForFunction(()=>document.getElementById('publicConnectionError')?.dataset.state==='error',{},{timeout:15000});
   assert.equal(heldRequests,1);
   await page.unroute('**/api/session/me');
   await page.locator('#publicConnectionError button').click();
   await page.waitForFunction(()=>currentUser?.isGuest===true);
   assert.equal(await page.locator('#publicConnectionError').count(),0);
   await page.locator('.fz-menu-btn.fz-play').click({trial:true});

   // Socket feedback lifecycle without constructing the heavy 3D world.
   await page.evaluate(()=>{
    const handlers=new Map();
    const s=window.testSocket={connected:false,calls:0,
     on(n,fn){if(!handlers.has(n))handlers.set(n,new Set());handlers.get(n).add(fn);},
     off(n,fn){handlers.get(n)?.delete(fn);},
     fire(n){for(const fn of handlers.get(n)||[])fn();},
     connect(){this.calls++;},disconnect(){this.connected=false;this.fire('disconnect');},
     count(n){return handlers.get(n)?.size||0;}};
    FZReleaseUI.watch(s);FZReleaseUI.watch(s);
   });
   assert.equal(await page.evaluate(()=>testSocket.count('registered')),1);
   assert(await page.locator('#fzConnectionStatus').isVisible());
   await page.evaluate(()=>{testSocket.connected=true;testSocket.fire('registered');});
   assert.equal(await page.locator('#fzConnectionStatus').isVisible(),false);
   await ctx.setOffline(true);
   await page.waitForFunction(()=>document.querySelector('#fzConnectionStatus button').disabled);
   assert.match(await page.locator('#fzConnectionStatus').innerText(),/Нет интернета/);
   await page.evaluate(()=>testSocket.disconnect());
   await ctx.setOffline(false);
   await page.waitForFunction(()=>testSocket.calls===1);
   await page.evaluate(()=>testSocket.fire('connect_error'));
   await page.locator('#fzConnectionStatus button').click();
   assert.equal(await page.evaluate(()=>testSocket.calls),2);
   await page.evaluate(()=>{testSocket.connected=true;testSocket.fire('connect');});
   assert(await page.locator('#fzConnectionStatus').isVisible()); // Transport alone is not registration.
   await page.evaluate(()=>testSocket.fire('registered'));
   assert.equal(await page.locator('#fzConnectionStatus').isVisible(),false);
   await page.evaluate(()=>{FZReleaseUI.stop();testSocket.fire('disconnect');});
   assert.equal(await page.evaluate(()=>testSocket.count('disconnect')),0);
   assert.equal(await page.locator('#fzConnectionStatus').isVisible(),false);
   assert.deepEqual(errors,[]);await ctx.close();console.log('PASS '+(mobile?'mobile':'desktop')+': guest menu/logout, hung SDK, help, offline/reconnect feedback, 12s session timeout and retry');
  }
 }finally{await browser?.close();child.kill('SIGTERM');await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);});}
})().catch(e=>{console.error(e);process.exitCode=1;});
