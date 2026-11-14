const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),{JSDOM}=require('jsdom');
const I=require('../public/assets/fz-impact35-policy');
for(const reduced of [false,true])for(let t=0;t<6;t+=.005){const s=I.sample(t,reduced);assert.equal(s.look[0],s.position[0],'no look to either side before impact');assert.equal(s.reaction,false);assert.equal(s.black,0);assert([...s.position,...s.look,s.carX,s.roll,s.fov].every(Number.isFinite));}
assert(Math.abs(I.sample(6).position[2]-.7)<1e-9);assert.equal(I.sample(6).carX+I.bumper,0);assert(I.sample(6).reaction);assert(I.sample(6.06).black>0);assert.equal(I.sample(6.13).black,1);
assert.equal(I.sample(6.1,true).roll,0);assert.equal(I.sample(6.1,true).fov,68);
const hash=crypto.createHash('sha256').update(fs.readFileSync('../public/assets/images/fantazia-original.png')).digest('hex');assert.equal(hash,'d6543503d56570ee966b2508ccae8a760382ff5065ffc1b6c7dde3399bffd6f6','original supplied image, byte-for-byte');
const png=fs.readFileSync('../public/assets/images/fantazia-logo-cutout.png');assert.equal(png.readUInt32BE(16),927);assert.equal(png.readUInt32BE(20),273);assert.equal(png[25],6,'RGBA PNG, not a purple rectangle');
const code=fs.readFileSync('../public/assets/fz-front.js','utf8'),html=fs.readFileSync('../public/index.html','utf8');
assert(!/FZLetterPortal|FZOpeningCast|FZOpeningAvatar|THREE\./.test(code));assert(!/src="assets\/fz-(letter-portal|opening-cast|opening-avatar)\.js/.test(html));
(async()=>{
 const dom=new JSDOM('<body><div id="authScreen"><input id="focus"></div><div id="serverScreen" style="display:none"></div><section id="fzIntro"></section></body>',{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;let cb,builds=0,ready=false;
 w.requestAnimationFrame=fn=>(cb=fn,1);w.cancelAnimationFrame=()=>{cb=null;};w.renderer=null;w.cityWorldReady=()=>ready;w.initThreeJS=async()=>{builds++;ready=true;w.renderer={getContext:()=>({isContextLost:()=>false})};};
 w.document.querySelector('#focus').focus();w.eval(code);
 assert.equal(builds,0);assert.equal(w.document.querySelector('.fz35-credit').textContent,'создано temka_play_official');assert(w.document.getElementById('authScreen').inert);
 cb(0);cb(2100);assert.equal(w.FZFront.info().phase,'title');
 const el=w.document.getElementById('fzIntro');const scale=parseFloat(el.style.getPropertyValue('--logo-scale'));assert(scale>.9&&scale<1);cb(4500);assert(parseFloat(el.style.getPropertyValue('--logo-scale'))>scale);
 w.localStorage.setItem('fz_play_v13',JSON.stringify({reduceMotion:true}));cb(4600);assert.equal(el.style.getPropertyValue('--logo-scale'),'1');assert.equal(el.style.getPropertyValue('--logo-y'),'0px');
 cb(10001);assert.equal(w.FZFront.active(),false);assert(!w.document.getElementById('fzIntro'));assert.equal(w.document.activeElement.id,'focus');assert.equal(builds,0);
 w.FZFront.start();w.document.querySelector('img').dispatchEvent(new w.Event('error'));assert(w.FZFront.info().failed);assert(!w.document.querySelector('.fz35-original p').hidden);assert.equal(w.document.querySelector('#fzIntroSkip'),null);w.FZFront.finish();
 assert.equal(w.document.getElementById('authScreen').inert,false);
 await w.FZFront.prepareGame();await w.FZFront.prepareGame();assert.equal(builds,1,'native world is built on Play, not on the image splash');
 await new Promise(r=>setImmediate(r));dom.window.close();
 console.log('PASS intro35: original-image hash, plain credit/image timing, no 3D opening loads, image fallback, replay/skip/focus, deferred native world; forward-only walk and exact sudden contact.');
})().catch(e=>{console.error(e);process.exitCode=1;});
