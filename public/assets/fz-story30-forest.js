/* An expanded, permanent western forest inside the existing western forest.
 * The city, laboratory and roads are untouched. Instanced vegetation stays off
 * roads/buildings and outside the whole walking corridor; trunks have colliders. */
(function(){
 'use strict';
 const origin={x:-490,z:100};
 const route=[[-477,92],[-465,80],[-452,74],[-430,74],[-400,74],[-382,74]];
 let owner,root,moon;const resources=new Set(),colliders=[];
 function distance(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);}
 function onPath(x,z,pad=4){const points=[[origin.x,origin.z],...route];return points.slice(1).some((b,i)=>distance(x,z,points[i],b)<pad);}
 function dispose(){window.FZForest40?.clear();window.FZLift38Wreck?.clear();root?.parent?.remove(root);resources.forEach(r=>r.dispose?.());resources.clear();if(typeof streetColliders!=='undefined')for(const c of colliders){const i=streetColliders.indexOf(c);if(i>=0)streetColliders.splice(i,1);}colliders.length=0;root=null;owner=null;}
 // Connect the last forest waypoint around EXISTING street props, not through them.
 function connectMetro(){
  route.splice(6);const start=[-382,74],goal=[-392,126],key=p=>p.join(','),queue=[start],parents=new Map([[key(start),null]]);
  const obstacles=streetColliders.filter(c=>Number.isFinite(c.x)&&Number.isFinite(c.z)&&c.x>-410&&c.x<-372&&c.z>68&&c.z<136);
  let found=false;
  for(let head=0;head<queue.length;head++){
   const a=queue[head];if(a[0]===goal[0]&&a[1]===goal[1]){found=true;break;}
   for(const [dx,dz] of [[0,1],[-1,0],[1,0],[0,-1]]){const p=[a[0]+dx,a[1]+dz],k=key(p);
    if(p[0]<-404||p[0]>-378||p[1]<74||p[1]>130||parents.has(k))continue;
    if(obstacles.some(c=>Math.hypot(p[0]-c.x,p[1]-c.z)<(c.r||.5)+.9)||!FZRoads.free(p[0],p[1],1.8,1.8))continue;
    parents.set(k,a);queue.push(p);
   }
  }
  if(!found)return;
  const points=[];for(let p=goal;p;p=parents.get(key(p)))points.push(p);points.reverse();
  for(let i=1;i<points.length-1;i++){const a=points[i-1],b=points[i],c=points[i+1];if(b[0]-a[0]!==c[0]-b[0]||b[1]-a[1]!==c[1]-b[1])route.push(b);}
  route.push(goal);
 }
 function build(){
  if(root&&owner===scene)return;dispose();window.FZForest40?.build();connectMetro();owner=scene;root=new THREE.Group();root.name='Western forest — mist and tall conifers';root.position.set(origin.x,0,origin.z);scene.add(root);moon=new THREE.HemisphereLight(0x8caaca,0x34493f,.42);moon.visible=false;moon.userData.forest40=true;root.add(moon);
  const own=r=>(resources.add(r),r),mat=c=>own(new THREE.MeshPhongMaterial({color:c,specular:0x000000,shininess:0}));
  const bark=mat(0x423d33),leaves=mat(0x102d29),fern=mat(0x294638),dirt=mat(0x514b42);
  const points=[[origin.x,origin.z],...route];
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
   const path=new THREE.Mesh(own(new THREE.PlaneGeometry(i>6?1.5:3.6,length+.6)),dirt);path.rotation.x=-Math.PI/2;path.rotation.z=Math.atan2(b[0]-a[0],b[1]-a[1]);path.position.set((a[0]+b[0])/2-origin.x,.035,(a[1]+b[1])/2-origin.z);root.add(path);
  }
  let seed=3017;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const trees=[],wreck=FZCabin38Policy.spot(origin),nearWreck=(x,z)=>Math.hypot(x-wreck.x,z-wreck.z)<5;
  for(let i=0;i<10000&&trees.length<560;i++){
   const a=random()*Math.PI*2,r=7+random()*98,x=origin.x+Math.cos(a)*r,z=origin.z+Math.sin(a)*r;
   if(nearWreck(x,z)||onPath(x,z,4.5)||!FZRoads.free(x,z,10,10))continue;
   if(trees.some(p=>Math.hypot(p.x-x,p.z-z)<2.8))continue;
   trees.push({x,z,h:16+random()*12});const c={x,z,r:.5,story30:true};streetColliders.push(c);colliders.push(c);
  }
  const trunks=new THREE.InstancedMesh(own(new THREE.CylinderGeometry(.16,.42,1,7)),bark,trees.length);
  const crowns=new THREE.InstancedMesh(own(new THREE.ConeGeometry(1,1,9)),leaves,trees.length*3);trunks.frustumCulled=crowns.frustumCulled=false;root.add(trunks,crowns);
  const dummy=new THREE.Object3D();
  trees.forEach((p,i)=>{
   dummy.position.set(p.x-origin.x,p.h*.4,p.z-origin.z);dummy.scale.set(1,p.h*.8,1);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
   for(let k=0;k<3;k++){dummy.position.y=p.h*(.48+k*.18);dummy.scale.set(3.5-k*.7,p.h*.43,3.5-k*.7);dummy.updateMatrix();crowns.setMatrixAt(i*3+k,dummy.matrix);}
  });
  const ferns=new THREE.InstancedMesh(own(new THREE.IcosahedronGeometry(1,1)),fern,1000);ferns.frustumCulled=false;root.add(ferns);
  for(let i=0;i<1000;i++){const a=random()*Math.PI*2,r=5+random()*98,x=origin.x+Math.cos(a)*r,z=origin.z+Math.sin(a)*r;dummy.position.set(x-origin.x,.2,z-origin.z);dummy.scale.set(.8,.3,.8);if(nearWreck(x,z)||onPath(x,z,2.3)||!FZRoads.free(x,z,2,2))dummy.scale.setScalar(0);dummy.updateMatrix();ferns.setMatrixAt(i,dummy.matrix);}
  const cv=document.createElement('canvas');cv.width=512;cv.height=128;const ctx=cv.getContext('2d');ctx.fillStyle='#342e25';ctx.fillRect(0,0,512,128);ctx.fillStyle='#eee5d6';ctx.font='bold 54px Arial';ctx.textAlign='center';ctx.fillText('К МЕТРО →',256,86);
  const texture=own(new THREE.CanvasTexture(cv));texture.encoding=THREE.sRGBEncoding;
  const sign=new THREE.Mesh(own(new THREE.PlaneGeometry(2.6,.65)),own(new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide})));sign.position.set(8,1.9,-1);sign.rotation.y=-Math.PI/2;root.add(sign);
  const post=new THREE.Mesh(own(new THREE.CylinderGeometry(.07,.09,2.3,6)),bark);post.position.set(8,1.15,-1);root.add(post);
 }
 let renderSaved=null;
 const forestFog=new THREE.FogExp2(0x16292d,.019),forestSky=new THREE.Color(0x17272e);
 function beforeRender(){
  if(renderSaved||!window.FZStory30Forest.active())return;
  moon.visible=true;renderSaved={fog:scene.fog,background:scene.background,lights:[],visible:[]};scene.fog=forestFog;scene.background=forestSky;
  for(const o of [window.skyDome,window.sunDisk,window.sunGlow,window.moonMesh,window.moonGlow,window.starField,...(window.clouds||[]),...(window.navTarget?.label==='Тропа в город'?[window._navBeacon]:[])]){if(o){renderSaved.visible.push([o,o.visible]);o.visible=false;}}
  scene.traverse(o=>{if((o.isDirectionalLight||o.isHemisphereLight)&&!o.userData.forest40){renderSaved.lights.push([o,o.intensity]);o.intensity*=.38;}});
 }
 function afterRender(){if(!renderSaved)return;moon.visible=false;scene.fog=renderSaved.fog;scene.background=renderSaved.background;for(const [l,i] of renderSaved.lights)l.intensity=i;for(const [o,v] of renderSaved.visible)o.visible=v;renderSaved=null;}
 function update(){if(root)root.visible=!!localPlayer?.mesh&&Math.hypot(localPlayer.mesh.position.x-origin.x,localPlayer.mesh.position.z-origin.z)<240;}
 window.FZStory30Forest={beforeRender,afterRender,visibleForShot:()=>{if(root)root.visible=true;},build,update,dispose,route,origin,onPath,active:()=>!!root&&!window.FZMetro?.active()&&!!localPlayer?.mesh&&localPlayer.mesh.position.y<25&&Math.hypot(localPlayer.mesh.position.x-origin.x,localPlayer.mesh.position.z-origin.z)<140,info:()=>({built:!!root,trees:colliders.length,metroConnected:route.length>6,resources:resources.size})};
})();
