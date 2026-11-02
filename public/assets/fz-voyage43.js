/* Boats and the existing rocket: one native frame owner, no RAF/timers.
 * Account saves keep the last safe shore/launchpad point while aboard. */
(function(){
 'use strict';
 const C=FZCinematic32,held=new Set(),boats=[];let run=null,port=null,rocket=null,terminal=null,error='';
 const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
 function shape(parent,geo,color,x,y,z,extra={}){const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color,roughness:.65,...extra}));m.position.set(x,y,z);parent.add(m);return m;}
 function box(p,w,h,d,c,x,y,z){return shape(p,new THREE.BoxGeometry(w,h,d),c,x,y,z);}
 function dispose(root){if(!root)return;root.parent?.remove(root);const resources=new Set();root.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){resources.add(m);for(const t of Object.values(m))if(t?.isTexture)resources.add(t);}});resources.forEach(r=>r.dispose());}
 function buildBoats(parent){
  boats.length=0;port=parent;
  for(let i=0;i<2;i++){
   const g=new THREE.Group();g.name='Управляемая моторная лодка '+(i+1);g.position.set(-43,.4,93+i*8);parent.add(g);
   const outline=new THREE.Shape();outline.moveTo(-1.05,-2.1);outline.lineTo(1.05,-2.1);outline.lineTo(1.12,1.2);outline.quadraticCurveTo(.8,2.4,0,2.8);outline.quadraticCurveTo(-.8,2.4,-1.12,1.2);outline.closePath();
   const geo=new THREE.ExtrudeGeometry(outline,{depth:.65,bevelEnabled:true,bevelThickness:.12,bevelSize:.12,bevelSegments:1,steps:1});geo.rotateX(Math.PI/2);
   shape(g,geo,i?0xd0ae68:0x589caf,0,.65,0);box(g,1.75,.12,3.6,0x303c46,0,.72,0);
   for(const z of [-1.2,.5])box(g,1.65,.22,.55,0xebe3cb,0,.92,z);
   box(g,.8,.7,.4,0x526579,0,1.1,1);const wheel=shape(g,new THREE.TorusGeometry(.23,.04,6,16),0x161f2b,0,1.5,.75);wheel.rotation.x=.5;
   box(g,.55,.8,.45,0x292e34,0,.4,-2.4);const prop=shape(g,new THREE.BoxGeometry(.9,.12,.12),0x85929c,0,-.1,-2.5);
   const wake=shape(g,new THREE.PlaneGeometry(2.3,5),0xc9eeef,0,-.32,-4.5,{transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});wake.rotation.x=-Math.PI/2;
   boats.push({g,wheel,prop,wake,home:g.position.clone(),dock:V(5950,2,93+i*8)});
  }
 }
 function attachRocket(model,x,z){rocket=model;terminal={x:x+3,z:z+5};interactables=interactables.filter(e=>e.type!=='orbit43');interactables.push({type:'orbit43',name:'Ракета · полёт на орбиту',range:3.5,position:{x:terminal.x,y:0,z:terminal.z}});}
 function allowed(){return !!localPlayer?.mesh&&FZUI.playing()&&!window.cine&&!window._loadingGate&&!isInsideBuilding&&!isInFactory&&!isInBasement&&!localCar&&!FZSky.active()&&!FZMetro.active()&&!FZForest40.required()&&!FZ8SEA.aboard();}
 function release(){held.clear();FZPlay.release();FZTouch.close();Object.keys(keys).forEach(k=>keys[k]=false);Object.assign(velocity,{x:0,y:0,z:0});}
 function begin(kind){
  if(!allowed())return false;
  FZSave41?.capture();FZUI.close();release();document.exitPointerLock?.();
  run={kind,t:0,phase:kind==='boat'?'sailing':'launch',paused:false,token:{voyage43:true},position:localPlayer.mesh.position.clone(),visible:localPlayer.mesh.visible,near:camera.near,far:camera.far,fov:camera.fov,mask:camera.layers.mask,mode:window.cameraMode,yaw:cameraAngleH,pitch:cameraAngleV,speed:0,heading:Math.PI/2,lookX:0,lookY:0};
  window.cine=run.token;localPlayer.mesh.visible=false;if(ITEMS.vm)ITEMS.vm.visible=false;FZHands30.hide();for(const l of [window._flash,window._flashSpill,window._flashCore42])if(l)l.visible=false;
  camera.layers.set(0);camera.near=.08;camera.far=3000;camera.fov=68;camera.updateProjectionMatrix();document.body.classList.add('fz-voyage43');ui();return true;
 }
 function board(i){const b=boats[i];if(!b||!FZ8SEA.active()||localPlayer.mesh.position.distanceTo(b.dock)>4||!begin('boat'))return false;run.boat=b;run.position.copy(b.dock);b.g.position.copy(b.home);return true;}
 function launch(){if(!rocket||rocket.userData.launch||!terminal||Math.hypot(localPlayer.mesh.position.x-terminal.x,localPlayer.mesh.position.z-terminal.z)>4||!begin('space'))return false;run.rocketHome=rocket.position.clone();run.space=spaceScene();return true;}
 function finish(){
  if(!run)return;const r=run;run=null;
  if(window.cine===r.token)window.cine=null;
  if(r.boat){r.boat.g.position.copy(r.boat.home);r.boat.g.rotation.set(0,0,0);r.boat.wake.material.opacity=0;}
  if(r.rocketHome&&rocket){rocket.position.copy(r.rocketHome);rocket.rotation.z=0;if(rocket.userData.flame)rocket.userData.flame.visible=false;}
  dispose(r.space);r.ui?.remove();document.body.classList.remove('fz-voyage43');localPlayer.mesh.position.copy(r.position);localPlayer.mesh.visible=r.visible;camera.near=r.near;camera.far=r.far;camera.fov=r.fov;camera.layers.mask=r.mask;camera.up.set(0,1,0);camera.updateProjectionMatrix();window.cameraMode=r.mode;cameraAngleH=r.yaw;cameraAngleV=r.pitch;release();isGrounded=true;
 }
 function returnTrip(tow=false){if(!run)return;if(run.kind==='space'){run.phase='return';run.t=0;release();return;}
  const near=run.boat.g.position.distanceTo(run.boat.home)<9&&Math.abs(run.speed)<1.2;
  if(near||tow){finish();if(tow)showNotification('Буксир вернул лодку к причалу.','info');}else showNotification('Вернись к причалу и сбрось скорость. Или вызови буксир.','info');
 }
 function ui(){const el=document.createElement('section');el.id='fzVoyage43';el.innerHTML='<strong></strong><p></p><div><button data-k="KeyA" aria-label="Влево">◀</button><button data-k="KeyW" aria-label="Вперёд">▲</button><button data-k="KeyS" aria-label="Назад">▼</button><button data-k="KeyD" aria-label="Вправо">▶</button></div><button data-pause>Пауза</button><button data-return>Вернуться</button><button data-tow>Вызвать буксир</button>';document.body.append(el);run.ui=el;
  el.querySelector('[data-tow]').hidden=run.kind!=='boat';el.querySelector('[data-tow]').onclick=()=>returnTrip(true);el.querySelector('[data-return]').onclick=()=>returnTrip();el.querySelector('[data-pause]').onclick=()=>{run.paused=!run.paused;release();};
  el.querySelectorAll('[data-k]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);held.add(b.dataset.k);};for(const name of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(name,()=>held.delete(b.dataset.k));});
 }
 function spaceScene(){
  const world=new THREE.Scene();world.background=new THREE.Color(0x02030b);world.add(new THREE.AmbientLight(0x6c83bb,.55));const sun=new THREE.DirectionalLight(0xffefdc,2);sun.position.set(-30,30,25);world.add(sun);
  const cv=document.createElement('canvas');cv.width=1024;cv.height=512;const ctx=cv.getContext('2d');ctx.fillStyle='#155b9d';ctx.fillRect(0,0,1024,512);
  const continents=[[[80,90],[180,70],[268,112],[250,160],[203,177],[160,251],[128,202]],[[220,248],[295,282],[280,357],[238,426],[212,348]],[[448,150],[512,139],[559,176],[581,236],[545,325],[501,356],[469,280]],[[500,118],[585,72],[755,72],[862,124],[788,191],[701,201],[643,279],[602,181]],[[784,335],[869,322],[896,365],[832,389]]];
  for(const poly of continents){ctx.fillStyle='#708a58';ctx.beginPath();poly.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}
  ctx.fillStyle='#e7eef1';ctx.fillRect(0,0,1024,32);ctx.fillRect(0,472,1024,40);ctx.fillStyle='rgba(255,255,255,.23)';for(let i=0;i<600;i++){const x=(i*137.7)%1024,y=70+(i*47.3)%365+Math.sin(x*.016)*12;ctx.beginPath();ctx.ellipse(x,y,7+(i%17),1.5+(i%4),-.25,0,Math.PI*2);ctx.fill();}
  const tex=new THREE.CanvasTexture(cv);tex.encoding=THREE.sRGBEncoding;const earth=shape(world,new THREE.SphereGeometry(23,48,32),0xffffff,0,-18,-65,{map:tex,roughness:1});world.userData.earth=earth;
  shape(world,new THREE.SphereGeometry(23.35,40,24),0x3699ff,0,-18,-65,{transparent:true,opacity:.12,side:THREE.BackSide,emissive:0x3699ff,emissiveIntensity:1,depthWrite:false});
  const stars=[];for(let i=0;i<1000;i++){const a=i*2.399963,b=1-2*(i+.5)/1000,r=Math.sqrt(1-b*b);stars.push(500*r*Math.cos(a),500*b,500*r*Math.sin(a));}const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));world.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0xdde9ff,size:2.1,sizeAttenuation:false,toneMapped:false})));
  const station=new THREE.Group();station.position.set(16,3,-27);station.rotation.x=.55;world.add(station);world.userData.station=station;
  shape(station,new THREE.TorusGeometry(2.2,.35,8,24),0xc7ced4,0,0,0);box(station,3,1.4,1.4,0xc7ced4,0,0,0);box(station,15,.15,.15,0xa6b8c7,0,0,0);
  for(const x of [-6,6]){box(station,4,.08,6,0x194b8b,x,0,0);for(let i=-2;i<=2;i++)box(station,4,.09,.035,0x83c4de,x,0,i);}
  return world;
 }
 function frame(dt){
  if(!run)return false;if(!FZUI.playing()){finish();return false;}
  try{
   const r=run,step=r.paused||document.hidden?0:Math.min(.1,Math.max(0,Number.isFinite(dt)?dt:0));r.t+=step;
   const throttle=(held.has('KeyW')?1:0)-(held.has('KeyS')?1:0),steer=(held.has('KeyA')?1:0)-(held.has('KeyD')?1:0);
   let view=scene;
   if(r.kind==='boat'){
    const b=r.boat;r.speed=Math.max(-3,Math.min(11,r.speed+throttle*6*step));r.speed*=Math.exp(-(throttle?.15:.8)*step);r.heading+=steer*step*1.1*Math.min(1,Math.abs(r.speed)/2)*(r.speed<0?-1:1);
    const x=b.g.position.x+Math.sin(r.heading)*r.speed*step,z=b.g.position.z+Math.cos(r.heading)*r.speed*step;
    if(FZ8SEA.boatWater(x,z)&&!boats.some(other=>other!==b&&Math.hypot(x-other.g.position.x,z-other.g.position.z)<4.5)){b.g.position.x=x;b.g.position.z=z;}else r.speed=0;
    b.g.rotation.set(FZPlay.reducedMotion()?0:Math.sin(r.t*1.7)*.015,r.heading,FZPlay.reducedMotion()?0:-steer*r.speed*.006);b.g.position.y=.4+(FZPlay.reducedMotion()?0:Math.sin(r.t*2)*.045);b.wheel.rotation.z=-steer*.5;b.prop.rotation.z+=step*r.speed*8;b.wake.material.opacity=Math.min(.3,Math.abs(r.speed)*.025);
    const p=b.g.getWorldPosition(V());localPlayer.mesh.position.copy(p);FZ8SEA.update(step);camera.position.copy(p).add(V(-Math.sin(r.heading)*8,4,-Math.cos(r.heading)*8));camera.lookAt(p.clone().add(V(Math.sin(r.heading)*5,.8,Math.cos(r.heading)*5)));
    r.ui.querySelector('strong').textContent='Лодка · '+Math.round(Math.abs(r.speed)*3.6)+' км/ч';r.ui.querySelector('p').textContent='W/S — газ и реверс · A/D — руль · E — сойти у своего причала';
   }else{
    if(r.phase==='launch'&&r.t>=9){r.phase='orbit';r.t=0;}
    if(r.phase==='orbit'){
     view=r.space;r.lookX=Math.max(-.8,Math.min(.8,r.lookX+steer*step*.55));r.lookY=Math.max(-.45,Math.min(.45,r.lookY+throttle*step*.4));camera.position.set(0,3,12);camera.lookAt(Math.sin(r.lookX)*45,-10+r.lookY*50,-55);r.space.userData.earth.rotation.y+=step*.018;r.space.userData.station.rotation.z+=step*.025;
    }else{
     const u=C.ease(r.t/(r.phase==='return'?6:9)),height=r.phase==='return'?700*(1-u):700*u;rocket.position.y=r.rocketHome.y+height;if(rocket.userData.flame)rocket.userData.flame.visible=true;
     const p=rocket.position;camera.position.set(p.x+13,p.y+8,p.z+18);camera.lookAt(p.x,p.y+5,p.z);localPlayer.mesh.position.copy(p);
     if(r.phase==='return'&&r.t>=6){finish();return false;}
    }
    r.ui.querySelector('strong').textContent=r.phase==='orbit'?'Орбита · Земля и станция':r.phase==='return'?'Возвращение на космодром':'Ракета · выход на орбиту';r.ui.querySelector('p').textContent=r.phase==='orbit'?'WASD / стрелки панели — осмотреться. Кнопка «Вернуться» — посадка.':'Рейс с посадкой на исходном космодроме.';
   }
   r.ui.querySelector('[data-pause]').textContent=r.paused?'Продолжить':'Пауза';camera.updateMatrixWorld(true);renderer.render(view,camera);return true;
  }catch(e){error=String(e.stack||e);console.error('Voyage43',e);finish();return false;}
 }
 window.addEventListener('keydown',e=>{if(!run||e.ctrlKey||e.metaKey||e.altKey||e.target?.closest?.('input,textarea,[contenteditable=true]'))return;if(['KeyW','KeyA','KeyS','KeyD','Escape','KeyE'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();if(e.code==='Escape'&&!e.repeat){run.paused=!run.paused;release();}else if(e.code==='KeyE'&&!e.repeat)returnTrip();else held.add(e.code);}},true);
 window.addEventListener('keyup',e=>held.delete(e.code),true);window.addEventListener('blur',()=>{if(run)release();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&run)release();});window.addEventListener('pagehide',finish);
 window.FZVoyage43={buildBoats,attachRocket,board,launch,frame,finish,returnTrip,active:()=>!!run,interact:e=>{if(e?.type==='sea43'){if(allowed()&&Math.hypot(localPlayer.mesh.position.x-e.position.x,localPlayer.mesh.position.z-e.position.z)<3)FZ8SEA.enter();return true;}if(e?.type!=='orbit43')return false;launch();return true;},info:()=>({active:!!run,kind:run?.kind,phase:run?.phase,time:run?.t||0,speed:run?.speed||0,paused:!!run?.paused,terminal,boats:boats.map(b=>b.g.position.toArray()),error})};
})();
