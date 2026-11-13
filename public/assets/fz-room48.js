/* Pre-3D playable room. Owns one small 2D canvas/RAF; released before WebGL starts. */
(function(){
 'use strict';const P=FZRoom48Policy;let run=null;
 const preferenceKey='fz_room49_reduced';
 function reducedPreference(){try{const saved=localStorage.getItem(preferenceKey);if(saved==='1'||saved==='0')return saved==='1';}catch{}return !!window.FZPlay?.reducedMotion();}
 const phaseText={boot:'На экране появилась строка: «Ты всё ещё здесь?»',erase:'Комната теряет детали. Сначала вещи. Потом — знакомые очертания.',fracture:'Изображение повторяется, словно испорченная запись. За стенами слышен дождь.',fade:'Экран погас. Дождь остался.'};
 function active(){return !!run;}
 function needed(){return !window.FZSave41?.hasLocation()&&!window.FZProgress40?.has('opening')&&!window.FZProgress40?.has('ride');}
 function sound(name){window.FZSound?.effect(name);}
 function finish(ok){
  if(!run)return;const r=run;run=null;
  cancelAnimationFrame(r.frame);r.listeners.forEach(([el,event,fn,options])=>el.removeEventListener(event,fn,options));
  r.keys.clear();r.touches.clear();r.el.remove();document.body.classList.remove('fz-room-on');
  window.FZSound?.stopEffects();window.FZPlay?.release();
  if(!ok&&r.focus?.isConnected)r.focus.focus();r.resolve(ok);
 }
 function start(){
  if(run)return run.promise;
  let resolve;const promise=new Promise(r=>resolve=r),state=P.create();
  const el=document.createElement('section');el.id='fzRoom48';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-labelledby','fzRoomTitle');
  el.innerHTML='<header><div><small>ПРОЛОГ / ПОСЛЕДНИЙ СЕАНС</small><h2 id="fzRoomTitle">Ещё один вечер дома</h2></div><button type="button" data-pause>Пауза</button></header><div class="fz-room-view"><canvas width="960" height="540" role="img" aria-label="Ночная комната. Персонаж у двери; справа компьютер и настольная лампа, в центре записка. Управление — кнопками ниже или клавиатурой."></canvas><div class="fz-room-pause" hidden><strong>Пауза</strong><p>Время и движение остановлены.</p><button type="button" data-resume>Продолжить</button></div></div><p class="fz-room-caption" role="status" aria-live="polite"></p><div class="fz-room-controls"><div class="fz-room-pad" role="group" aria-label="Движение"><button type="button" data-dir="up" aria-label="Идти вверх">↑</button><button type="button" data-dir="left" aria-label="Идти влево">←</button><button type="button" data-dir="down" aria-label="Идти вниз">↓</button><button type="button" data-dir="right" aria-label="Идти вправо">→</button></div><div class="fz-room-actions"><select data-place aria-label="Куда подойти"><option value="computer">Компьютер</option><option value="lamp">Лампа</option><option value="letter">Записка</option><option value="door">Дверь</option></select><button type="button" data-walk>К компьютеру</button><button type="button" data-act>E · Действие</button></div></div><footer><label><input type="checkbox" data-reduced> Меньше эффектов</label><button type="button" data-skip>Перейти к 3D</button><button type="button" data-exit>В меню</button></footer>';
  const canvas=el.querySelector('canvas');let ctx;try{ctx=canvas.getContext('2d');}catch{}if(!ctx){resolve(true);return promise;}
  run={el,canvas,ctx,state,promise,resolve,focus:document.activeElement,listeners:[],keys:new Set(),touches:new Map(),frame:0,last:0,paused:false,reduced:reducedPreference(),phase:'room',steps:0};
  const r=run;document.body.append(el);document.body.classList.add('fz-room-on');
  window.FZPlay?.release();window.FZSound?.silence();window.FZSound?.tick();
  const on=(target,event,fn,options)=>{target.addEventListener(event,fn,options);r.listeners.push([target,event,fn,options]);};
  const clear=()=>{r.keys.clear();r.touches.clear();r.state.target=null;r.state.targetSpot=null;r.state.moving=false;r.last=0;};
  function pause(on){r.paused=on;clear();el.querySelector('.fz-room-pause').hidden=!on;el.querySelector('[data-pause]').textContent=on?'Продолжить':'Пауза';if(on){window.FZSound?.stopEffects();el.querySelector('[data-resume]').focus();}else el.querySelector(el.querySelector('[data-act]').disabled?'[data-pause]':'[data-act]').focus();}
  function action(id){if(r.paused)return;const result=P.interact(state,id);if(result)sound(result==='computer'?'pc-start48':result==='door'?'click':result==='lamp'?'flash':'paper48');sync();}
  el.querySelector('[data-act]').onclick=()=>action();
  const destination=el.querySelector('[data-place]');
  destination.onchange=()=>{el.querySelector('[data-walk]').textContent=({computer:'К компьютеру',lamp:'К лампе',letter:'К записке',door:'К двери'})[destination.value];};
  el.querySelector('[data-walk]').onclick=()=>{const spot=P.spots.find(p=>p.id===destination.value);if(!r.paused&&spot)P.target(state,spot.x,spot.y);};
  el.querySelector('[data-pause]').onclick=()=>pause(!r.paused);
  el.querySelector('[data-resume]').onclick=()=>pause(false);
  el.querySelector('[data-exit]').onclick=()=>finish(false);
  el.querySelector('[data-skip]').onclick=()=>finish(true);
  const reduce=el.querySelector('[data-reduced]');reduce.checked=r.reduced;reduce.onchange=()=>{r.reduced=reduce.checked;try{localStorage.setItem(preferenceKey,r.reduced?'1':'0');}catch{}};
  for(const button of el.querySelectorAll('[data-dir]')){
   const turn={up:0,right:90,down:180,left:270}[button.dataset.dir];
   button.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22"><path d="M12 20V4M5 11l7-7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="rotate('+turn+' 12 12)"/></svg>';
   on(button,'pointerdown',event=>{if(event.button!==0||r.paused)return;event.preventDefault();r.touches.set(event.pointerId,button.dataset.dir);button.setPointerCapture(event.pointerId);});
   for(const type of ['pointerup','pointercancel','lostpointercapture'])on(button,type,event=>r.touches.delete(event.pointerId));
  }
  function canvasPoint(event){const box=canvas.getBoundingClientRect();return {x:(event.clientX-box.left)*960/box.width,y:(event.clientY-box.top)*540/box.height};}
  on(canvas,'pointerdown',event=>{
   if(event.button!==0||r.paused||state.phase!=='room')return;
   const {x,y}=canvasPoint(event),spot=P.hit(x,y);
   if(spot){
    if(Math.hypot(spot.x-state.x,spot.y-state.y)<52)action(spot.id);
    else P.target(state,spot.x,spot.y);
   }else if(y>=310)P.target(state,x,y);
  });
  on(canvas,'pointermove',event=>{const {x,y}=canvasPoint(event);canvas.style.cursor=!r.paused&&state.phase==='room'&&P.hit(x,y)?'pointer':'default';});
  on(window,'keydown',event=>{
   if(event.code==='Escape'){event.preventDefault();pause(!r.paused);}
   else if(event.key==='Tab'){
    const items=[...el.querySelectorAll('button,input,select')].filter(b=>!b.disabled&&b.getClientRects().length>0),i=items.indexOf(document.activeElement);
    if(items.length){event.preventDefault();items[(i+(event.shiftKey?-1:1)+items.length)%items.length].focus();}
   }else if(event.target?.tagName==='SELECT'){
    // Native selector navigation must not move the character.
   }else if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)){
    event.preventDefault();if(!r.paused)r.keys.add(event.code);
   }else if(event.code==='KeyE'&&!event.repeat){event.preventDefault();action();}
   event.stopImmediatePropagation();
  },true);
  on(window,'keyup',event=>{r.keys.delete(event.code);event.stopImmediatePropagation();},true);
  on(window,'blur',()=>pause(true));on(document,'visibilitychange',clear);on(window,'pagehide',()=>finish(false));
  for(const name of ['pointerdown','mousedown','touchstart','click'])on(el,name,event=>event.stopPropagation());
  function sync(){
   const spot=P.near(state),names={computer:'компьютеру',lamp:'лампе',letter:'записке',door:'двери'};
   const hint=state.time<state.messageUntil?state.message:state.targetSpot&&state.target?.length
    ?'Иду к '+names[state.targetSpot]+'. Рядом нажми E или коснись самого предмета ещё раз.'
    :spot?({computer:'Компьютер ждёт. E или касание экрана — начать сеанс.',lamp:'Лампа: E или касание — '+(state.lampOn?'погасить':'включить')+' свет.',letter:'Записка: E или касание — прочитать.',door:'Дверь: E или касание — прислушаться.'})[spot.id]
    :'Осмотри комнату. WASD / стрелки — идти. Касание предмета издалека — подойти, рядом — действие.';
   const message=r.paused?'Пауза. Продолжи, когда будешь готов.':state.phase==='room'?hint:phaseText[state.phase]||phaseText.fade;
   const caption=el.querySelector('.fz-room-caption');if(caption.textContent!==message)caption.textContent=message;
   const act=el.querySelector('[data-act]');act.textContent=spot?.id==='lamp'?(state.lampOn?'Выключить свет · E':'Включить свет · E'):spot?spot.label:'E · Действие';
   act.disabled=state.phase!=='room';el.querySelector('[data-walk]').disabled=state.phase!=='room';destination.disabled=state.phase!=='room';
   for(const b of el.querySelectorAll('[data-dir]'))b.disabled=state.phase!=='room';
   el.dataset.phase=state.phase;
  }
  function frame(now){
   if(run!==r)return;
   const dt=r.last?Math.max(0,(now-r.last)/1000):0;r.last=now;
   try{
    if(!r.paused&&!document.hidden){
     const dirs=new Set(r.touches.values()),k=r.keys;
     P.step(state,dt,{x:Number(k.has('KeyD')||k.has('ArrowRight')||dirs.has('right'))-Number(k.has('KeyA')||k.has('ArrowLeft')||dirs.has('left')),y:Number(k.has('KeyS')||k.has('ArrowDown')||dirs.has('down'))-Number(k.has('KeyW')||k.has('ArrowUp')||dirs.has('up'))});
     if(state.phase!==r.phase){r.phase=state.phase;if(state.phase==='erase')sound('pc-glitch48');if(state.phase==='fracture')sound('pc-off48');}
     if(state.moving&&state.walk-r.steps>.36){r.steps=state.walk;sound('room-step48');}
    }
    if(state.phase==='done'){finish(true);return;}
    draw(r);sync();r.frame=requestAnimationFrame(frame);
   }catch(error){console.warn('[Room48] falling back to 3D',error);finish(true);}
  }
  try{sync();draw(r);el.querySelector('[data-walk]').focus();r.frame=requestAnimationFrame(frame);}catch(error){console.warn('[Room48] canvas unavailable',error);finish(true);}return promise;
 }
 function draw(r){
  const c=r.ctx,s=r.state,W=960,H=540,erase=s.phase==='erase'?s.time/4:['fracture','fade','done'].includes(s.phase)?1:0;
  const fracture=s.phase==='fracture',reduced=r.reduced;
  const rect=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  const line=(points,color,width=1)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();};
  const text=(value,x,y,size=12,color='#a6c5c7')=>{c.fillStyle=color;c.font=`${size}px monospace`;c.fillText(value,x,y);};
  c.clearRect(0,0,W,H);rect(0,0,W,H,'#060b14');c.save();
  // Bounded displacement, low contrast; no white flashes or actual frame blocking.
  if(fracture&&!reduced)c.translate(Math.sin(Math.floor(s.time*5)*13)*4,0);
  const wall=c.createLinearGradient(0,65,0,325);wall.addColorStop(0,'#263545');wall.addColorStop(1,'#152631');c.fillStyle=wall;c.fillRect(70,64,820,265);
  rect(70,315,820,177,'#25333b');
  for(let y=328;y<494;y+=26)line([[70,y],[890,y]],'#35444a');
  for(let x=70;x<890;x+=102)line([[x,315],[x-90,492]],'#1a2930');
  // Woven rug and soft contact shadows anchor the furniture to the floor.
  if(erase<.25){
   rect(259,380,292,92,'#3b4548');rect(266,386,278,79,'#505554');
   for(let y=391;y<461;y+=8)line([[270,y],[540,y]],'#66655b55');
   for(let x=272;x<540;x+=14)line([[x,386],[x,465]],'#8d82702a');
   c.fillStyle='#060e1860';c.beginPath();c.ellipse(364,367,88,11,0,0,Math.PI*2);c.fill();
  }
  if(s.target?.length&&s.phase==='room'){
   const point=s.target[s.target.length-1];c.strokeStyle='#a8ccc377';c.lineWidth=1.5;c.beginPath();c.ellipse(point[0],point[1],13,5,0,0,Math.PI*2);c.stroke();
  }
  rect(65,62,830,9,'#3c4b58');rect(70,307,820,12,'#101c27');
  if(erase<.72){
   rect(122,119,90,195,'#111d29');rect(130,126,74,185,'#24313a');rect(139,137,56,119,'#2e3e47');rect(190,222,5,7,'#b2a183');
   text('07',160,157,16,'#74828b');
  }
  if(erase<.48){
   rect(335,108,180,125,'#0b1727');rect(343,116,164,109,'#173047');
   for(let i=0;i<12;i++){const x=350+i*13;rect(x,165-(i%3)*15,10,60+(i%3)*15,'#0c1a2b');rect(x+3,175,3,4,i%3?'#53727c':'#d0af75');}
   for(let i=0;i<22;i++){const x=347+(i*29)%154,y=119+(i*31+Math.floor(s.time*26))%100;line([[x,y],[x-3,y+10]],'#719bad55');}
   rect(422,111,6,115,'#41525c');rect(338,169,171,5,'#41525c');rect(328,231,194,8,'#52616a');
   rect(316,99,18,144,'#203944');rect(514,99,17,144,'#203944');
  }
  if(erase<.18){
   rect(288,306,150,62,'#18222e');rect(296,296,134,46,'#536066');rect(305,309,53,27,'#687078');rect(365,309,55,27,'#52616c');rect(292,335,144,18,'#647078');rect(294,355,10,16,'#111c24');rect(421,355,10,16,'#111c24');
   rect(442,361,47,27,'#4b4542');rect(446,386,5,18,'#181c23');rect(481,386,5,18,'#181c23');rect(450,362,25,13,'#d1cab3');line([[454,366],[470,366]],'#7a8180');
   rect(270,148,45,57,'#544d47');rect(276,154,33,45,'#8b8b7d');line([[278,190],[289,173],[305,186]],'#485e63',3);
  }
  if(erase<.33){
   rect(598,128,190,9,'#565650');rect(611,106,13,21,'#a47765');rect(628,98,9,30,'#648488');rect(640,103,16,25,'#b7ac86');rect(660,109,10,19,'#5d6c84');rect(751,110,18,17,'#192c36');
   rect(832,317,33,39,'#796254');for(let i=0;i<6;i++)line([[848,319],[833+Math.sin(i*1.4)*25,273+i*6]],'#527b70',8);
  }
  // The monitor remains after its surroundings have dissolved.
  if(erase<.9){
   rect(590,284,210,14,'#7e7866');rect(602,298,12,45,'#222b33');rect(778,298,12,45,'#222b33');rect(715,302,60,29,'#394650');line([[725,315],[763,315]],'#859094');
   rect(741,265,20,18,'#8b9e9d');rect(761,268,6,10,'#657778');
   line([[775,277],[791,232],[780,206]],'#a3a58f',4);rect(762,199,36,12,s.lampOn?'#d5c69a':'#7e8882');
   rect(640,277,73,7,'#263c48');for(let i=0;i<12;i++)rect(643+i*5.5,279,3,2,'#9aaba6');
   rect(718,278,10,6,'#a3b4ae');line([[723,279],[727,273],[721,270]],'#314d57');
   line([[701,285],[707,298],[704,319],[693,325]],'#0a1422',2);
   if(s.light>.005){
    const warm=c.createRadialGradient(780,225,5,780,225,150);warm.addColorStop(0,'rgba(242,203,128,'+(.2*s.light*(1-erase))+')');warm.addColorStop(1,'rgba(242,203,128,0)');c.fillStyle=warm;c.fillRect(630,75,260,300);
    c.fillStyle='rgba(224,191,126,'+(.075*s.light*(1-erase))+')';c.beginPath();c.moveTo(767,210);c.lineTo(694,352);c.lineTo(854,352);c.lineTo(794,210);c.closePath();c.fill();
   }
  }
  const glow=c.createRadialGradient(681,251,10,681,251,155);glow.addColorStop(0,'#74d1ce28');glow.addColorStop(1,'#74d1ce00');c.fillStyle=glow;c.fillRect(526,96,310,310);
  rect(633,208,101,66,'#0a1421');rect(639,214,89,51,s.phase==='fade'?'#090f18':'#347075');rect(676,273,14,11,'#16232c');rect(657,282,52,4,'#101f29');
  if(s.phase==='room'){text('FANTAZIA',646,234,12,'#d3eee0');text('> ENTER',646,253,11,'#c2d2b5');}
  if(s.phase==='boot'){text('CONNECTED',645,233,11,'#d3eee0');text('WHO ARE YOU?'.slice(0,Math.min(12,Math.floor(s.time*8))),642,253,10,'#b6d4c9');}
  if(erase>0||fracture){for(let i=0;i<5;i++)rect(642,219+i*9,30+((i*17+Math.floor(s.time*3))%48),2,'#b2c6b060');}
  if(erase<.82){rect(635,299,45,29,'#182431');rect(644,294,27,22,'#4b626c');rect(652,324,9,24,'#1b2933');line([[655,345],[638,352],[675,352]],'#121b27',4);}
  if(s.phase!=='fade'){
   const bob=reduced?0:s.moving?Math.sin(s.walk*13)*2:Math.sin(s.time*1.7),x=Math.round(s.x),y=Math.round(s.y),stride=s.moving?Math.sin(s.walk*12)*4:0;
   c.fillStyle='#050b1480';c.beginPath();c.ellipse(x,y+2,18,6,0,0,Math.PI*2);c.fill();
   rect(x-10,y-23+stride,8,24-stride,'#162438');rect(x+3,y-23-stride,8,24+stride,'#1d3041');rect(x-12,y,12,5,'#0a111e');rect(x+2,y,14,5,'#0a111e');
   rect(x-14,y-53+bob,28,32,'#829498');rect(x-17,y-48+bob,6,23,'#667d84');rect(x+12,y-48+bob,6,23,'#526d78');rect(x-4,y-49+bob,5,26,'#455964');
   rect(x-10,y-72+bob,20,21,'#b89b86');rect(x-12,y-77+bob,24,10,'#23252b');rect(x+(s.facing>0?7:-9),y-65+bob,3,3,'#242d33');
  }
  if(s.phase==='room'){
   const spot=P.near(s);if(spot){c.strokeStyle='#b4dcce';c.lineWidth=2;c.strokeRect(spot.x-24,spot.y-9,48,18);text('E',spot.x-4,spot.y-18,14,'#e6e6cf');}
  }
  if(erase>0&&!reduced){for(let i=0;i<18;i++){const x=80+(i*137)%780,y=90+(i*83)%360;if(i/18<erase)rect(x,y,26+(i%4)*19,10,'#0b1420');}}
  if(fracture&&!reduced){for(let i=0;i<7;i++){const y=100+i*50;rect(74,y,812,3,'#80a5ad20');rect(140+(i*113)%600,y+8,55,4,'#71878b55');}text('SIGNAL LOST',411,482,14,'#8fa8af');}
  c.restore();
  const vignette=c.createRadialGradient(480,270,120,480,270,510);vignette.addColorStop(0,'#00000000');vignette.addColorStop(1,'#020711d9');c.fillStyle=vignette;c.fillRect(0,0,W,H);
  if(s.phase==='fade'){c.fillStyle=`rgba(3,7,15,${Math.min(1,s.time/1.15)})`;c.fillRect(0,0,W,H);}
 }
 window.FZRoom48={start,cancel:()=>finish(false),active,needed,info:()=>run?{phase:run.state.phase,time:run.state.time,x:run.state.x,y:run.state.y,paused:run.paused,reduced:run.reduced,lampOn:run.state.lampOn,near:P.near(run.state)?.id||null,moving:run.state.moving,frame:!!run.frame}:null};
})();
