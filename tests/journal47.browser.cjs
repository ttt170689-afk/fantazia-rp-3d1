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
   await page.goto(url,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>currentUser?.isGuest===true);
   await page.waitForSelector('#fzIntro',{state:'detached',timeout:16000});
   // Seed only an isolated reader fixture. This tests real DOM/accessibility/layout, not world discovery.
   await page.evaluate(()=>{
    FZUI.playing=()=>true;
    FZLore45.hydrate({notes:['return','bench','signal']});
    const opener=document.createElement('button');opener.id='journalTestOpen';opener.textContent='Открыть дневник';
    opener.style.cssText='position:fixed;top:0;left:0;z-index:12000;';opener.onclick=()=>FZLore45.openBag();document.body.append(opener);
   });
   await page.locator('#journalTestOpen').click();
   const dialog=page.getByRole('dialog',{name:'Инвентарь и дневник'});
   assert(await dialog.isVisible());
   assert.equal(await page.locator('[data-note-id]').count(),3);
   assert.equal(await page.locator('[data-note-id="letter"]').count(),0);
   const input=page.getByLabel('Поиск по найденным записям');
   await input.click();await input.pressSequentially('wasd e');assert.equal(await input.inputValue(),'wasd e','game input handler must not consume text');
   await input.fill('квитанция');assert.equal(await page.locator('[data-note-id]').count(),1);
   await page.locator('[data-note-id="return"]').click();
   await page.getByRole('button',{name:'Крупный текст',exact:true}).click();
   assert.equal(await page.locator('#fzLore45 article').getAttribute('data-reader-size'),'large');
   assert.equal(await page.getByRole('button',{name:'← Предыдущая',exact:true}).isDisabled(),true);
   await page.getByRole('button',{name:'Следующая →',exact:true}).click();
   assert.equal(await page.locator('#fzLoreTitle').textContent(),'Место у двери');
   await page.getByRole('button',{name:'Все найденные записи',exact:true}).click();
   assert.equal(await input.inputValue(),'квитанция');
   await page.getByRole('button',{name:'Сбросить поиск',exact:true}).click();
   await page.getByLabel('Место находки').selectOption('Набережная');
   assert.equal(await page.locator('[data-note-id]').count(),1);
   await page.locator('[data-note-id="signal"]').click();
   assert.equal(await page.locator('#fzLore45 article').getAttribute('data-reader-size'),'large');
   const fits=async()=>assert(await page.locator('#fzLore45 article').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&el.scrollWidth<=el.clientWidth+1;}));
   await fits();
   if(mobile){await page.setViewportSize({width:844,height:390});await fits();await page.setViewportSize({width:390,height:844});}
   await page.getByRole('button',{name:'Закрыть',exact:true}).focus();
   await page.keyboard.press('Shift+Tab');assert(await page.evaluate(()=>!!document.activeElement.closest('#fzLore45')));
   await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Закрыть');
   if(process.env.FZ_JOURNAL_SCREENSHOT&&mobile)await page.screenshot({path:process.env.FZ_JOURNAL_SCREENSHOT});
   await page.keyboard.press('Escape');assert.equal(await page.locator('#fzLore45').count(),0);
   assert.equal(await page.evaluate(()=>document.activeElement.id),'journalTestOpen');
   assert.deepEqual(await page.evaluate(()=>FZLore45.snapshot().notes),['bench','return','signal']);
   await page.locator('#journalTestOpen').click();
   await page.evaluate(()=>FZLore45.hydrate({notes:['shift']}));
   assert.equal(await page.locator('#fzLore45').count(),0);
   await page.locator('#journalTestOpen').click();assert.equal(await input.inputValue(),'');assert.equal(await page.locator('[data-note-id]').count(),1);
   assert.deepEqual(errors,[]);await context.close();
   console.log('PASS journal '+(mobile?'mobile':'desktop')+': found-only reader, typed search, filters, paging, large text, narrow/landscape layout, focus trap, Escape and profile reset');
  }
 }finally{await browser?.close();child.kill('SIGTERM');await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);});}
})().catch(e=>{console.error(e);process.exitCode=1;});
