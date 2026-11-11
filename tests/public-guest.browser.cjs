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
   page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith(url)||/^(blob|data):/.test(r.request().url())?r.continue():r.abort());
   await page.goto(url,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>typeof currentUser!=='undefined'&&currentUser?.isGuest===true,{},{timeout:20000});
   await page.waitForSelector('#fzIntro',{state:'detached',timeout:16000});
   assert.equal(await page.locator('#authScreen').isVisible(),false);assert(await page.locator('#serverScreen').isVisible());assert(await page.locator('.fz-menu-btn.fz-play').isVisible());
   await page.locator('.fz-menu-btn.fz-play').click({trial:true});
   assert(await page.locator('#publicAccessNote').innerText().then(t=>t.includes('без регистрации')));
   assert.equal(await page.evaluate(()=>currentUser.token),null);assert.equal(await page.evaluate(()=>currentUser.isAdmin),false);
   await page.evaluate(()=>logoutUser());await page.waitForFunction(()=>currentUser?.isGuest===true);assert.equal(await page.locator('#authScreen').isVisible(),false);
   assert.deepEqual(errors,[]);await ctx.close();console.log('PASS anonymous '+(mobile?'mobile':'desktop')+' menu, Play button, no registration and return to guest after logout');
  }
 }finally{await browser?.close();child.kill('SIGTERM');await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);});}
})().catch(e=>{console.error(e);process.exitCode=1;});
