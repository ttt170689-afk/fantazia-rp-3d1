/* One native-frame owner for a braking impact, fall onto the carriage floor,
 * and getting back up. No teleport to another world, no second RAF/renderer. */
(function(root){
 'use strict';
 const C=root.FZCinematic32||(typeof require==='function'?require('./fz-cinematic32.js'):null),duration=4.8;
 function sample(t,reduced=false){return {
  height:C.track([[0,1.62],[.12,1.66],[.26,1.42],[.62,.52],[.76,.34],[.94,.385],[1.16,.34],[1.7,.34],[2.25,.58],[2.85,.9],[3.2,1.05],[3.5,.98],[duration,1.62]],t),
  slide:C.track([[0,0],[.2,.08],[.76,.55],[1.1,.51],[1.7,.55],[duration,.55]],t),yaw:reduced?0:C.track([[0,0],[.2,-.1],[.65,.2],[1.4,.13],[2.5,-.07],[duration,0]],t),pitch:C.track([[0,0],[.12,.16],[.45,-.3],[.78,-.7],[1.7,-.5],[2.4,-.4],[3.3,-.2],[duration,0]],t),
  roll:reduced?0:C.track([[0,0],[.25,.18],[.78,.58],[1.05,.43],[1.55,.48],[2.6,.2],[3.4,.1],[duration,0]],t),black:reduced?0:.48*C.envelope(t,.73,1.12),fov:reduced?0:4*C.envelope(t,.25,1.4)
 };}
 if(typeof module!=='undefined'&&module.exports){module.exports={sample,duration};return;}
 let run=null,lastError='';
 function release(){window.FZPlay?.release();window.FZUI?.close();window.FZTouch?.close();Object.keys(keys).forEach(k=>keys[k]=false);Object.assign(velocity,{x:0,y:0,z:0});if(document.pointerLockElement)document.exitPointerLock();}
 function begin(){
  if(run||window.cine||!localPlayer?.mesh)return false;
  if(sittingOn?.spot.metro)standUpFromSeat();release();
  const o=FZMetro.info().origin,p=localPlayer.mesh.position;
  p.x=Math.max(o.x-11,Math.min(o.x+11,p.x));p.z=Math.max(o.z-5.4,Math.min(o.z-2.8,p.z));p.y=o.y;
  const token={metro39:true};run={t:0,paused:false,token,position:p.clone(),aisleZ:Math.max(o.z-4.3,Math.min(o.z-3.7,p.z)),direction:new THREE.Vector3(Math.sin(cameraAngleH),0,Math.cos(cameraAngleH)),fov:camera.fov,near:camera.near,mask:camera.layers.mask,visible:localPlayer.mesh.visible};
    for(const l of [window._flash,window._flashSpill])if(l)l.visible=false;window.FZFlash40?.light(false);
  window.cine=token;window.cameraMode='first';camera.near=.04;camera.updateProjectionMatrix();
  const el=document.createElement('section');el.id='fzMetroFall39';el.setAttribute('aria-label','Авария в метро');el.innerHTML='<div class="metro-black"></div><p role="status"></p>';document.body.append(el);run.ui=el;
  document.body.classList.add('fz-metro-fall');SFX.noise(.65,.1,250);FZHands30.load();return true;
 }
 function cancel(){
  FZSound.stopEffects();
  if(!run)return;const old=run;run=null;if(window.cine===old.token)window.cine=null;
  old.ui.remove();document.body.classList.remove('fz-metro-fall');FZHands30.hide();camera.fov=old.fov;camera.near=old.near;camera.layers.mask=old.mask;camera.up.set(0,1,0);camera.updateProjectionMatrix();
  if(localPlayer?.mesh)localPlayer.mesh.visible=old.visible;release();
 }
 function frame(dt){
  if(!run)return false;
  if(!FZMetro.active()||!document.body.classList.contains('game-active')){cancel();return false;}
  try{
    const step=run.paused||document.hidden?0:Math.min(.1,Math.max(0,Number.isFinite(dt)?dt:0));run.t+=step;FZMetro.update(step);
    if(run.t>=.72&&!run.impact40){run.impact40=true;FZSound.effect('body-impact');}
    if(run.t>=2.1&&!run.stand40){run.stand40=true;FZSound.effect('stand');}
    const s=sample(run.t,!!window.FZPlay?.reducedMotion()),p=localPlayer.mesh.position;p.copy(run.position);p.x+=s.slide;p.z+=(run.aisleZ-run.position.z)*C.ease(run.t/.65);
    camera.fov=run.fov+s.fov;camera.updateProjectionMatrix();
    camera.position.set(p.x,p.y+s.height,p.z);camera.up.set(0,1,0);const look=camera.position.clone().add(run.direction);look.y+=s.pitch;camera.lookAt(look);camera.rotateY(s.yaw);camera.rotateZ(s.roll);camera.updateMatrixWorld(true);
    localPlayer.mesh.visible=false;if(ITEMS.vm)ITEMS.vm.visible=false;
    FZHands30.update(scene,camera,'metroFall',run.t,step,!!window.FZPlay?.reducedMotion());
    if(run.t>2.8&&!run.knee42){run.knee42=true;FZSound.effect('cloth');}
    run.ui.style.setProperty('--black',String(s.black));run.ui.querySelector('p').textContent=run.paused?'Пауза · Esc — продолжить':run.t<1.3?'':run.t<3?'Меня сбило с ног…':'Нужно выбраться. Зелёная линия ведёт к выходу.';
    if(run.t>.72&&!run.hit){run.hit=true;SFX.thud();}
    FZMetro.beforeRender();renderer.render(scene,camera);
    if(run.t>=duration){cameraAngleH=Math.atan2(run.direction.x,run.direction.z);cameraAngleV=0;isGrounded=true;cancel();return false;}
    return true;
  }catch(e){lastError=String(e.stack||e);console.error('Metro fall:',e);cancel();return false;}
 }
 window.addEventListener('keydown',e=>{if(!run)return;if(e.code==='Escape'){run.paused=!run.paused;if(run.paused)FZSound.stopEffects();release();}e.preventDefault();e.stopImmediatePropagation();},true);
 window.addEventListener('pagehide',cancel);
 root.FZMetro39Fall={begin,frame,cancel,active:()=>!!run,sample,duration,info:()=>({active:!!run,elapsed:run?.t||0,paused:!!run?.paused,error:lastError})};
})(typeof window==='undefined'?globalThis:window);
