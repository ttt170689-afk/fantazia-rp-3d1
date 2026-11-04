/* One pickup/animation owner, driven by the native frame; no timers or extra input listeners. */
(function(){
 'use strict';let locked=true,pickup=null,raise=2,press=1,autoOn=false,previous=0,core=null;
 function dispose(g){if(!g)return;g.parent?.remove(g);const all=new Set();g.traverse(o=>{if(o.geometry)all.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)all.add(m);});all.forEach(r=>r.dispose?.());}
 function model(){
  const g=new THREE.Group();g.name='FZ expedition flashlight — sealed optics';
  const metal=new THREE.MeshStandardMaterial({color:0x414b52,metalness:.45,roughness:.36,emissive:0x19222a,emissiveIntensity:.25}),rubber=new THREE.MeshStandardMaterial({color:0x20292c,roughness:.95,emissive:0x141c22,emissiveIntensity:.18}),silver=new THREE.MeshStandardMaterial({color:0xa8b3bb,metalness:.65,roughness:.23});
  function part(geo,mat,x=0,y=0,z=0){const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);g.add(o);return o;}
  const cylinder=(a,b,h)=>new THREE.CylinderGeometry(a,b,h,20);
  part(cylinder(.048,.05,.31),metal);part(cylinder(.052,.052,.22),rubber,0,-.025);
  for(let i=0;i<8;i++)part(cylinder(.055,.055,.008),metal,0,-.12+i*.028);
  part(cylinder(.055,.05,.03),metal,0,-.173);
  part(new THREE.CylinderGeometry(.085,.05,.105,24,1,true),metal,0,.198);
  const reflector=part(new THREE.CylinderGeometry(.073,.025,.06,24,1,true),silver,0,.222);reflector.material.side=THREE.DoubleSide;
  const rim=part(new THREE.TorusGeometry(.076,.009,8,24),silver,0,.254);rim.rotation.x=Math.PI/2;
  const lens=part(cylinder(.067,.067,.008),new THREE.MeshPhysicalMaterial({color:0xb4d4dd,transparent:true,opacity:.25,roughness:.08,metalness:.08,clearcoat:1,depthWrite:false}),0,.252);g.userData.lens=lens;
  const emitter=part(cylinder(.017,.017,.009),new THREE.MeshBasicMaterial({color:0xd8d1b4}),0,.208);g.userData.emitter=emitter;
  const button=part(cylinder(.021,.021,.012),rubber,0,.115,.05);button.rotation.x=Math.PI/2;g.userData.button=button;button.userData.restZ=.05;
  const led=part(new THREE.SphereGeometry(.007,8,6),new THREE.MeshBasicMaterial({color:0x85ffb0}),0,.156,.062);g.userData.led=led;
  part(new THREE.BoxGeometry(.018,.19,.009),silver,.048,-.02,.027);
  const strap=part(new THREE.TorusGeometry(.035,.006,6,16),rubber,0,-.218);strap.scale.y=1.35;
  // Cooling fins, waterproof seals, lens retaining screws and a two-sided clip.
  for(const y of [.16,.18,.20])part(cylinder(.07+(y-.16)*.3,.07+(y-.16)*.3,.007),rubber,0,y);
  for(const y of [-.157,.143])part(cylinder(.052,.052,.008),rubber,0,y);
  const boltGeo=new THREE.SphereGeometry(.006,6,4);for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;part(boltGeo,silver,Math.cos(a)*.075,.262,Math.sin(a)*.075);}
  const guard=part(new THREE.TorusGeometry(.026,.005,6,16),metal,0,.115,.052);g.userData.switchGuard=guard;
  part(new THREE.BoxGeometry(.018,.025,.035),silver,.048,.075,.017);
  return g;
 }
 function clearPickup(){if(pickup){interactables=interactables.filter(i=>i!==pickup);dispose(pickup.mesh);pickup=null;}}
 function reset(needsPickup){light(false);clearPickup();locked=needsPickup;raise=2;press=1;autoOn=false;previous=0;
  if(typeof DLC!=='undefined'){DLC.flashOn=false;DLC.hasFlashlight=!locked;if(DLC.flashMesh){dispose(DLC.flashMesh);DLC.flashMesh=null;}if(ITEMS.slot===2)setHeldItem(1);}
 }
 function place(){
  if(!locked||pickup||!scene)return;
  // Clear ground next to the cabin, towards the player; not behind its collision hull.
  const g=model();g.position.set(-483.8,.13,101);g.rotation.set(Math.PI/2,0,.4);g.userData.fl=g;
  const beacon=new THREE.PointLight(0x9bc6a5,.5,3);beacon.position.set(0,0,.3);beacon.userData.priority=2;g.add(beacon);
  scene.add(g);pickup={position:{x:g.position.x,y:0,z:g.position.z},type:'flashlight',name:'Фонарь у обломков · взять',range:2.6,mesh:g,story40:true};interactables.push(pickup);
 }
 function take(inter){
  if(window.cine||DLC.hasFlashlight||!localPlayer?.mesh)return false;
  if(Math.hypot(localPlayer.mesh.position.x-inter.position.x,localPlayer.mesh.position.z-inter.position.z)>(inter.range||2.6)+.3)return false;
  interactables=interactables.filter(i=>i!==inter);
  if(inter===pickup){dispose(pickup.mesh);pickup=null;}else {inter.mesh.visible=false;inter.mesh.userData.glow&&(inter.mesh.userData.glow.intensity=0);}
  locked=false;DLC.hasFlashlight=true;DLC.flashOn=false;FZProgress40.mark('flash');FZUI.grantLight();setHeldItem(2);
  window.cameraMode='first';raise=0;press=1;autoOn=true;FZSound.effect('cloth');updateFlashHUD();updateHotbar();
  showNotification('Фонарь найден. ЛКМ / F — свет; на телефоне — кнопка фонаря.','success');return true;
 }
 function clicked(){press=0;autoOn=false;}
 function update(){
  const now=performance.now(),dt=previous?Math.min(.15,(now-previous)/1000):0;previous=now;
  if(document.hidden||!FZUI.playing()||window.cine||FZPlay.paused?.())return;
  raise=Math.min(2,raise+dt);press=Math.min(1,press+dt);
  if(autoOn&&raise>.88){autoOn=false;DLC.flashOn=true;press=0;FZSound.effect('flash');updateFlashHUD();}
  const vm=ITEMS.vm;
  if(ITEMS.slot===2&&vm){const u=vm.userData,reduced=FZPlay.reducedMotion(),lift=1-FZStory30Policy.smooth(raise/1.05);
   u.base.x=camera.aspect<.8?.16:.24;u.base.z=-.46;
   u.arm.position.y-=lift*(reduced?.08:.38);u.arm.position.x-=lift*.08;
   if(!reduced){const settle=Math.sin(raise*14)*Math.exp(-raise*4)*(1-lift);u.arm.position.y+=settle*.035;u.arm.position.z+=settle*.018;}
   const thumb=u.thumb44||u.arm.children[3];if(thumb){const push=Math.sin(Math.min(1,press/.32)*Math.PI);if(u.thumb44){thumb.rotation.x=push*.18;thumb.position.y=.018-push*.009;}else{thumb.position.set(-.015,.065-push*.018,-.37-push*.035);thumb.rotation.z=-.5-push*.28;}}
   vm.updateMatrixWorld(true);
  }
  for(const fl of [DLC.flashMesh,ITEMS.slot===2?ITEMS.vmItem:null])if(fl?.userData.lens){
   fl.userData.lens.material.color.setHex(DLC.flashOn?0xffedc5:0x9cb7c5);
   fl.userData.emitter?.material.color.setHex(DLC.flashOn?0xfff2c8:0x827d66);
   if(fl.userData.button)fl.userData.button.position.z=.05-Math.sin(Math.min(1,press/.32)*Math.PI)*.005;
   if(fl.userData.led)fl.userData.led.material.color.setHex(DLC.flashOn?0x8cffaf:0x385c48);
  }
 }
 function light(on,source){
  // v43: one circular spot on actual surfaces, not two concentric beams or a HUD disc.
  if(core)core.visible=false;
  if(window._flashCore42)window._flashCore42.visible=false;
 }
 window.FZFlash40={light,model,reset,place,take,clicked,update,clear:clearPickup,needsPickup:()=>locked,info:()=>({locked,pickup:pickup?.position||null,raise,press,autoOn,core:!!core?.visible})};
})();
