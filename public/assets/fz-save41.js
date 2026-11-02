/* Account autosave: one in-flight write, revision conflict protection, local
 * outbox and bounded fetches. No position is sampled from a cinematic or vehicle. */
(function(){
 'use strict';let owner='',record=null,revision=0,loaded=false,canSync=false,pending=false,busy=false,dirty=false,last=0,status='Ещё не загружено',intent=null,epoch=0,flight=null;
 const user=()=>typeof currentUser!=='undefined'?currentUser:null;
 const key=name=>'fz_save41:'+encodeURIComponent(name);
 function state(text){status=text;const el=document.getElementById('fzSaveState41');if(el)el.textContent='Автосохранение: '+text;}
 function cache(){try{localStorage.setItem(key(owner),JSON.stringify({revision,snapshot:record,dirty}));}catch{state('нет доступа к памяти браузера');}}
 async function request(route,body,keepalive=false){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const r=await fetch('/api/session/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal,keepalive});const data=await r.json();if(!r.ok||!data.ok)throw Object.assign(Error(data.error||'Ошибка сохранения'),{status:r.status});return data;}finally{clearTimeout(timer);}}
 function story(){const s=FZProgress40.info();return FZProgress40.clean(s);}
 async function prepare(){
  if(flight)await flight;
  const name=user()?.username||'guest',ticket=++epoch;owner=name;loaded=false;canSync=false;pending=false;record=null;revision=0;dirty=false;last=performance.now();state('загрузка…');
  const localIntent=intent?.owner===name?intent:null;intent=null;
  try{const saved=JSON.parse(localStorage.getItem(key(name))||'null');if(FZSave41Policy.clean(saved?.snapshot)){record=FZSave41Policy.clean(saved.snapshot);revision=Number.isSafeInteger(saved.revision)?saved.revision:0;dirty=!!saved.dirty;}}catch{}
  const token=user()?.token;
  if(token)try{const remote=await request('load',{token});if(ticket!==epoch||user()?.username!==name)return;
   // A newer server revision always wins over a stale local cache.
   if(remote.revision!==revision||!dirty){record=remote.snapshot;revision=remote.revision;dirty=false;}canSync=true;state(remote.snapshot?'загружено с аккаунта':'новое сохранение');
  }catch(e){if(ticket!==epoch)return;state(e.status===401?'сеанс истёк — войди заново':'нет связи — локальная копия');}
  else state('локально — нужен вход на сервер');
  if(ticket!==epoch||user()?.username!==name)return;
  if(record)FZProgress40.apply(record.story);
  if(localIntent){FZProgress40.apply(localIntent.story);if(record){record.story=localIntent.story;if(localIntent.replay)record.location=null;}dirty=true;}
  window.FZLore45?.hydrate(record?.adventure45);
  pending=!!record?.location;loaded=true;cache();
 }
 function changed(replay=false){
  const name=user()?.username||'guest';if(!loaded||owner!==name||!document.body.classList.contains('game-active')){intent={owner:name,story:story(),replay};return;}
  if(record&&replay){record.location=null;pending=false;}dirty=true;
 }
 function location(){
  if(!localPlayer?.mesh||!FZUI.playing()||window._loadingGate||window.cine||localPlayer.health<=0)return null;
  if(window.FZSurvival45?.busy()||localCar||window.FZ8SEA?.aboard()||window.FZ8SEA?.active()||window.FZCranes?.active()||window.FZ8L?.drive?.())return null;
  const p=localPlayer.mesh.position,q={x:p.x,y:p.y,z:p.z};let l=null;
  if(FZMetro.active()){
   const i=FZMetro.info(),entry=i.stations.find(s=>s.index===i.index);if(entry)l={kind:'outdoor',position:{x:entry.x,y:0,z:entry.z+5}};
  }else if(FZBuildings.active()){
   // Moving lifts and stairs use the last stable floor point.
   if(FZBuildingPolicy.liftInside(q.x-INTERIOR_BASE.x,q.z-INTERIOR_BASE.z))return null;
   const g=FZBuildings.ground();if(!isGrounded||Math.abs(q.y-g)>.12||Math.abs(g/5.2-Math.round(g/5.2))>.02)return null;
   l={kind:'building',building:currentBuildingType,position:q,outside:{...outsidePos}};
  }else if(isInsideBuilding||isInFactory||isInBasement)return null;
  else if(FZSky.active()) {if(isGrounded)l={kind:'sky',position:q};}
  else if(isGrounded&&Math.abs(q.y)<.2&&Math.abs(q.x)<598&&Math.abs(q.z)<598)l={kind:'outdoor',position:{x:q.x,y:0,z:q.z}};
  if(l){l.yaw=cameraAngleH;l.pitch=cameraAngleV;}return l;
 }
 function capture(){
  if(!loaded||pending||owner!==user()?.username||FZProgress40.info().homePending||FZStory30.info().pending)return false;
  const l=location(),old=record;const s=story();
  record={version:1,adventure45:window.FZLore45?.snapshot()||record?.adventure45,story:s,location:l||old?.location||null,health:localPlayer?.health>0?Math.min(100,localPlayer.health):old?.health||100,flashOn:!!DLC.flashOn,slot:ITEMS.slot===2?2:1,forest:!!FZForest40.required()};
  if(JSON.stringify(record)!==JSON.stringify(old)){dirty=true;cache();}return true;
 }
 function flush(keepalive=false){
  if(flight){capture();return flight;}
  flight=write(keepalive);const task=flight;task.finally(()=>{if(flight===task)flight=null;});return task;
 }
 async function write(keepalive=false){
  if(!capture())return false;if(!loaded||!dirty||busy||owner!==user()?.username)return false;
  const token=user()?.token,ticket=epoch,name=owner;if(!token){cache();state('сохранено только в браузере');return false;}
  busy=true;const payload=JSON.stringify(record),base=revision;
  try{
   if(!canSync){const remote=await request('load',{token},keepalive);if(ticket!==epoch||owner!==name)return false;if(remote.revision!==base){
    // A write may have reached disk even when its acknowledgement was lost.
    if(JSON.stringify(remote.snapshot)===JSON.stringify(FZSave41Policy.clean(record))){revision=remote.revision;canSync=true;dirty=false;cache();state('сохранено на аккаунте');return true;}
    throw Object.assign(Error('Другой сеанс изменил сохранение — перезайди'),{status:409});
   }}
   const r=await request('save',{token,revision:base,snapshot:JSON.parse(payload)},keepalive);
   if(ticket!==epoch||owner!==name)return false;revision=r.revision;canSync=true;dirty=JSON.stringify(record)!==payload;cache();state('сохранено на аккаунте');return true;
  }catch(e){if(ticket===epoch){canSync=false;state(e.status===409?'конфликт сеансов — перезайди':e.status===401?'сеанс истёк — войди заново':'нет связи — сохранено локально');cache();}return false;}
  finally{busy=false;}
 }
 function safePoint(l){
  const p=localPlayer.mesh.position;const offsets=[[0,0],[.6,0],[-.6,0],[0,.6],[0,-.6],[1.5,0],[-1.5,0],[0,1.5],[0,-1.5],[3,0],[-3,0],[0,3],[0,-3]];
  for(const [x,z] of offsets){p.set(l.position.x+x,l.position.y,l.position.z+z);if(!checkCollision(p.x,p.z))return true;}return false;
 }
 function restore(){
  if(!pending||!loaded||!localPlayer?.mesh||!FZUI.playing()||window._loadingGate||window.cine)return false;
  const l=record.location;pending=false;FZForest40.end();FZSky.suspendVisual();clearNavTarget();const p=localPlayer.mesh.position;
  if(l.kind==='building'){
   p.set(l.outside.x,0,l.outside.z);FZSky.update();const entry=interactables.filter(e=>!e.interior&&(e.destination||e.type)===l.building&&e.position).sort((a,b)=>Math.hypot(a.position.x-l.outside.x,a.position.z-l.outside.z)-Math.hypot(b.position.x-l.outside.x,b.position.z-l.outside.z))[0];enterBuilding(l.building,entry?.name||'Сохранённое здание');
   if(FZBuildings.active()) {
    const position={...l.position,y:Math.max(0,Math.min((FZBuildings.info().floors-1)*5.2,Math.round(l.position.y/5.2)*5.2))};
    if(FZBuildingPolicy.liftInside(position.x-INTERIOR_BASE.x,position.z-INTERIOR_BASE.z)){position.x=INTERIOR_BASE.x;position.z=INTERIOR_BASE.z+8;}
    if(!safePoint({...l,position}))p.set(INTERIOR_BASE.x,.01,INTERIOR_BASE.z+21);
   }
  }else{
   if(l.kind==='sky')FZSky.spawn(localPlayer.mesh);
   else {p.set(l.position.x,0,l.position.z);FZSky.update();if(record.forest)FZStory30.restoreForest();}
   if(!safePoint(l)){if(l.kind==='sky')FZSky.spawn(localPlayer.mesh);else {safePoint({position:record.forest?{x:-490,y:0,z:100}:{x:SPAWN_POINT.x,y:0,z:SPAWN_POINT.z}});}}
  }
  localPlayer.health=record.health||100;updateHealthBar();window.cameraMode='first';cameraAngleH=l.yaw||0;cameraAngleV=l.pitch||0;isGrounded=true;Object.assign(velocity,{x:0,y:0,z:0});window._spawnFixed=true;window._introDone=true;
  if(record.story.flash){FZUI.grantLight();setHeldItem(record.slot===2?2:1);DLC.flashOn=!!record.flashOn;}FZPlay.release();return true;
 }
 function frame(){restore();if(!loaded||pending||!FZUI.playing())return;const now=performance.now();if(now-last>10000||(dirty&&now-last>1000)){if(now-last>10000)dirty=true;last=now;flush();}}
 window.addEventListener('pagehide',()=>flush(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)flush(true);});
 window.FZSave41={prepare,changed,capture,flush,frame,hasLocation:()=>pending,info:()=>({owner,loaded,pending,revision,dirty,busy,status,location:record?.location||null})};
})();
