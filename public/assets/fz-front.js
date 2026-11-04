/* v35.1: plain creator credit, then the original logo with its background removed. No opening 3D
 * letters, city borrowing, font/model loads or renderer. World builds on Play. */
(function(){
 'use strict';
 const duration=10,creditEnd=2,image='assets/images/fantazia-logo-cutout.png';
 let intro=false,elapsed=0,last=null,raf=0,phase='menu',oldFocus=null,bootPromise=null,imageFailed=false;
 const motionQuery=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 const ease=n=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
 function reduced(){try{return !!motionQuery?.matches||!!JSON.parse(localStorage.getItem('fz_play_v13'))?.reduceMotion;}catch{return !!motionQuery?.matches;}}
 function paint(el){const u=Math.max(0,elapsed-creditEnd),still=reduced();
  el.style.setProperty('--credit-alpha',String(ease(elapsed/.3)*(1-ease((elapsed-1.65)/.35))));
  el.style.setProperty('--logo-alpha',String(elapsed<creditEnd?0:still?1:ease(u/1.1)*(1-ease((elapsed-9.3)/.7))));
  el.style.setProperty('--logo-scale',String(still?1:.90+.10*ease(u/1.5)+.025*ease((u-1.5)/5.5)));
  el.style.setProperty('--logo-y',(still?0:12*(1-ease(u/1.5)))+'px');
  el.style.setProperty('--logo-glow',(still?0:4*ease(u/1.5))+'px');
 }
 const root=()=>document.getElementById('fzIntro');
 const startMenu=window.START_MENU_BG,stopMenu=window.STOP_MENU_BG;
 function syncMenu(){const el=document.getElementById('serverScreen');
  if(!intro&&!document.hidden&&el&&getComputedStyle(el).display!=='none'&&!document.body.classList.contains('game-active')&&!window._loadingGate)startMenu?.();else stopMenu?.();
 }
 function ensureWorld(){
  if(!bootPromise)bootPromise=Promise.resolve().then(()=>{if(renderer&&cityWorldReady())return;return initThreeJS(true);}).catch(e=>{bootPromise=null;throw e;});
  return bootPromise;
 }
 function frame(now){
  raf=0;if(!intro||document.hidden){last=null;return;}
  if(last!==null)elapsed+=Math.max(0,(now-last)/1000);last=now;
  if(elapsed>=duration){finish();return;}
  const el=root();if(!el){finish();return;}
  phase=elapsed<creditEnd?'credit':'title';el.dataset.phase=phase;paint(el);
  el.querySelector('.fz35-progress i').style.transform='scaleX('+Math.min(1,elapsed/duration)+')';
  raf=requestAnimationFrame(frame);
 }
 function sync(){syncMenu();if(!intro||document.hidden){if(raf)cancelAnimationFrame(raf);raf=0;last=null;}else if(!raf)raf=requestAnimationFrame(frame);}
 function finish(){
  if(!intro&&!root())return;
  intro=false;if(raf)cancelAnimationFrame(raf);raf=0;last=null;phase='menu';root()?.remove();
  document.body.classList.remove('fz-intro-active');
  for(const id of ['authScreen','serverScreen']){const el=document.getElementById(id);if(el)el.inert=false;}
  if(oldFocus?.isConnected)oldFocus.focus();oldFocus=null;syncMenu();
 }
 function start(){
  if(document.body.classList.contains('game-active')||window._loadingGate)return false;if(intro)return true;
  const el=root()||document.createElement('section');el.id='fzIntro';el.dataset.build='35';el.dataset.phase='credit';el.dataset.ready='true';
  el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Заставка Fantazia RP 3D');
  el.innerHTML='<div class="fz35-credit">создано temka_play_official</div><div class="fz35-original"><img alt="FANTAZIA RP — 3D ONLINE" width="927" height="273" draggable="false"><p hidden>FANTAZIA RP 3D</p></div><div class="fz35-progress" aria-hidden="true"><i></i></div>';
  const img=el.querySelector('img');imageFailed=false;
  img.onerror=()=>{if(el!==root())return;imageFailed=true;img.hidden=true;el.querySelector('.fz35-original p').hidden=false;};img.src=image;
  document.body.append(el);oldFocus=document.activeElement;el.tabIndex=-1;
  for(const id of ['authScreen','serverScreen']){const node=document.getElementById(id);if(node)node.inert=true;}
  intro=true;elapsed=0;last=null;phase='credit';paint(el);document.body.classList.add('fz-intro-active');el.focus({preventScroll:true});sync();return true;
 }
 async function prepareGame(){finish();await ensureWorld();if(!renderer||!cityWorldReady()||renderer.getContext().isContextLost())throw Error('Native world did not finish or WebGL is unavailable');}
 window.fzIntroEnd=finish;window.fziClick=finish;
 window.FZFront={start,finish,prepareGame,active:()=>intro,info:()=>({phase,build:'35.1',citySource:'original-logo-transparent',credit:'создано temka_play_official',autoplay:'page-load',duration,elapsed,renderer:false,ready:intro,failed:imageFailed,actors:0,cast:[],portal:null,sceneUUID:typeof scene!=='undefined'?scene?.uuid:null,image})};
 document.addEventListener('visibilitychange',sync);
 window.addEventListener('keydown',e=>{if(!intro)return;if(['Escape','Enter',' '].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();finish();}else if(e.key==='Tab'){e.preventDefault();root()?.focus();}},true);
 window.addEventListener('pagehide',finish);
 const observer=new MutationObserver(sync);observer.observe(document.body,{attributes:true,attributeFilter:['class']});
 for(const id of ['authScreen','serverScreen','playLoadOv']){const el=document.getElementById(id);if(el)observer.observe(el,{attributes:true,attributeFilter:['style','class']});}
 start();
})();
