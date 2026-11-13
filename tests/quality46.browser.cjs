'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{fork}=require('node:child_process');
const {chromium}=require('playwright-core'),chrome=require('@sparticuz/chromium').default;
(async()=>{
 const root=path.resolve(__dirname,'..'),child=fork(path.join(root,'server.js'),{cwd:root,env:{...process.env,PORT:'0',FANTAZIA_RUNTIME_SECRET:'S'.repeat(43)},execArgv:['--require',path.join(root,'tests/closed-fixture-hook.cjs')],stdio:['ignore','pipe','pipe','ipc']});let browser,logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
 try{
  let timer;const port=await Promise.race([new Promise((resolve,reject)=>{child.once('message',m=>resolve(m.port));child.once('exit',()=>reject(Error(logs)));}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('startup timeout')),12000);})]).finally(()=>clearTimeout(timer));
  if(process.platform==='linux'){const pkg=require('@sparticuz/chromium');await pkg.inflate(path.join(path.dirname(require.resolve('@sparticuz/chromium')),'../bin/al2023.tar.br'));pkg.setupLambdaEnvironment(path.join(require('node:os').tmpdir(),'al2023/lib'));}
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||await chrome.executablePath(),args:chrome.args.filter(a=>!['--disable-web-security','--allow-running-insecure-content','--single-process'].includes(a)),headless:true});const url='http://127.0.0.1:'+port;
  const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url().startsWith(url)||/^(blob|data):/.test(r.request().url())?r.continue():r.abort());
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>currentUser?.isGuest===true);
  await page.waitForSelector('#fzIntro',{state:'detached',timeout:16000});
  await page.locator('.fz-menu-btn.fz-play').click();
  await page.waitForFunction(()=>localPlayer?.mesh && renderer?.info.render.frame>30 && !window._loadingGate,{},{timeout:120000});
  await page.waitForSelector('#playLoadOv',{state:'hidden',timeout:30000});
  await page.waitForFunction(()=>FZStory30.info().active,{},{timeout:30000});
  console.log(JSON.stringify(await page.evaluate(()=>({player:!!localPlayer?.mesh,rig:!!localPlayer?.mesh?.userData?.isSuperRig,frames:renderer.info.render.frame,drawCalls:renderer.info.render.calls,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,story:FZStory30.info(),connection:socket?.connected})),null,2));
  await page.evaluate(()=>{FZStory30.pause(true);window.beforeReconnect={mesh:localPlayer.mesh.uuid,position:localPlayer.mesh.position.toArray(),health:localPlayer.health,elapsed:FZStory30.info().elapsed,id:socket.id};socket.io.engine.close();});
  await page.waitForFunction(()=>socket.connected&&socket.id!==beforeReconnect.id&&document.getElementById('fzConnectionStatus').hidden,{},{timeout:20000});
  assert(await page.evaluate(()=>localPlayer.mesh.uuid===beforeReconnect.mesh));
  assert(await page.evaluate(()=>localPlayer.health===beforeReconnect.health));
  assert(await page.evaluate(()=>FZStory30.info().elapsed===beforeReconnect.elapsed));
  assert(await page.evaluate(()=>localPlayer.mesh.position.toArray().every((v,i)=>Math.abs(v-beforeReconnect.position[i])<.001)));
  const placedNotes=await page.evaluate(()=>{FZLore45.build();return interactables.filter(e=>e.lore45&&e.action==='note').map(e=>e.id).sort();});
  assert.deepEqual(placedNotes,[...require('../public/assets/fz-adventure45-policy').ids].sort(),'every journal entry must have a physical note in the generated world');
  if(process.env.FZ_SCREENSHOT_PATH)await page.screenshot({path:process.env.FZ_SCREENSHOT_PATH});
  console.log('PASS real WebGL launch, loaded animated GLB, first story scene and Socket.IO reconnect preserving mesh/position/health/story time');
  console.log('PAGE_ERRORS',JSON.stringify(errors));
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();child.kill('SIGTERM');await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);});}
})().catch(e=>{console.error(e);process.exitCode=1;});
