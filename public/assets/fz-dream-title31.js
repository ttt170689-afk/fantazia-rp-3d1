/* Post-fall title: original letter outlines, genuinely extruded geometry.
 * Same renderer/native frame owner as the story. No DOM type, font download,
 * RAF, timers or fullscreen flashes. Camera passes through the first А counter. */
(function(global){
 'use strict';
 const TEXT='FANTAZIA RP 3D',DEPTH=2.4,C=global.FZCinematic32||(typeof require==='function'?require('./fz-cinematic32.js'):null);
 const clamp=t=>Math.max(0,Math.min(1,t)),smooth=t=>{t=clamp(t);return t*t*(3-2*t);},mix=(a,b,t)=>a+(b-a)*smooth(t);
 function polygon(points){const s=new THREE.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();return s;}
 function hole(points){const s=new THREE.Path();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();return s;}
 function glyph(c){
  if(c==='A')return glyph('А');if(c==='T')return glyph('Т');if(c==='P')return glyph('Р');if(c==='3')return glyph('З');
  if(c==='F')return polygon([[0,0],[0,3],[2,3],[2,2.5],[.48,2.5],[.48,1.78],[1.6,1.78],[1.6,1.28],[.48,1.28],[.48,0]]);
  if(c==='N')return polygon([[0,0],[0,3],[.48,3],[1.52,.95],[1.52,3],[2,3],[2,0],[1.52,0],[.48,2.05],[.48,0]]);
  if(c==='I')return polygon([[.75,0],[.75,3],[1.25,3],[1.25,0]]);
  if(c==='Z')return polygon([[0,3],[2,3],[2,2.5],[.65,.5],[2,.5],[2,0],[0,0],[0,.5],[1.35,2.5],[0,2.5]]);
  if(c==='R')return [glyph('Р'),polygon([[.72,1.5],[1.25,1.5],[2,0],[1.43,0]])];
  if(c==='D'){
   const s=new THREE.Shape();s.moveTo(0,0);s.lineTo(0,3);s.lineTo(1,3);s.bezierCurveTo(2.4,3,2.4,0,1,0);s.closePath();
   const h=new THREE.Path();h.moveTo(.48,.5);h.lineTo(1,.5);h.bezierCurveTo(1.75,.5,1.75,2.5,1,2.5);h.lineTo(.48,2.5);h.closePath();s.holes.push(h);return s;
  }

  if(c==='А'){const s=polygon([[0,0],[.78,3],[1.22,3],[2,0],[1.5,0],[1.3,.85],[.7,.85],[.5,0]]);s.holes.push(hole([[.82,1.4],[1.18,1.4],[1,2.18]]));return s;}
  if(c==='Н')return polygon([[0,0],[0,3],[.45,3],[.45,1.78],[1.55,1.78],[1.55,3],[2,3],[2,0],[1.55,0],[1.55,1.28],[.45,1.28],[.45,0]]);
  if(c==='Т')return polygon([[0,2.5],[0,3],[2,3],[2,2.5],[1.25,2.5],[1.25,0],[.75,0],[.75,2.5]]);
  if(c==='П')return polygon([[0,0],[0,3],[2,3],[2,0],[1.52,0],[1.52,2.5],[.48,2.5],[.48,0]]);
  if(c==='И')return polygon([[0,0],[0,3],[.46,3],[.46,.95],[1.54,3],[2,3],[2,0],[1.54,0],[1.54,2.05],[.46,0]]);
  if(c==='Ф'){
   const s=new THREE.Shape();s.moveTo(.78,3);s.lineTo(1.22,3);s.lineTo(1.22,2.57);s.bezierCurveTo(2.35,2.48,2.35,.52,1.22,.43);s.lineTo(1.22,0);s.lineTo(.78,0);s.lineTo(.78,.43);s.bezierCurveTo(-.35,.52,-.35,2.48,.78,2.57);s.closePath();
   for(const side of [-1,1]){const h=new THREE.Path();h.absellipse(1+side*.40,1.5,.25,.62,0,Math.PI*2,true);s.holes.push(h);}return s;
  }
  if(c==='Р'||c==='Я'){
   const s=new THREE.Shape();s.moveTo(0,0);s.lineTo(0,3);s.lineTo(1.07,3);s.bezierCurveTo(2.38,3,2.38,1.27,1.07,1.27);s.lineTo(.48,1.27);s.lineTo(.48,0);s.closePath();
   const h=new THREE.Path();h.moveTo(.48,1.76);h.lineTo(1.04,1.76);h.bezierCurveTo(1.75,1.76,1.75,2.5,1.04,2.5);h.lineTo(.48,2.5);h.closePath();s.holes.push(h);
   if(c==='Р')return s;
   // Mirror Р and add its diagonal leg, creating the recognisable Cyrillic Я.
   const mirrored=polygon(s.getPoints(16).map(p=>[2-p.x,p.y]));mirrored.holes.push(hole(h.getPoints(16).map(p=>[2-p.x,p.y])));
   return [mirrored,polygon([[0,0],[.59,0],[1.49,1.53],[.98,1.64]])];
  }
  if(c==='З'){
   const s=new THREE.Shape();s.moveTo(.04,2.62);s.bezierCurveTo(.55,3.23,1.98,3.18,1.98,2.28);s.bezierCurveTo(1.98,1.91,1.78,1.64,1.5,1.53);s.bezierCurveTo(2.37,1.15,2.04,-.08,1.03,-.03);s.bezierCurveTo(.54,-.03,.18,.12,0,.4);s.lineTo(.30,.81);s.bezierCurveTo(.77,.27,1.59,.43,1.59,.94);s.bezierCurveTo(1.59,1.28,1.18,1.32,.67,1.3);s.lineTo(.67,1.8);s.bezierCurveTo(1.19,1.77,1.54,1.85,1.54,2.21);s.bezierCurveTo(1.54,2.64,.79,2.74,.32,2.24);s.closePath();return s;
  }
  throw Error('Missing dream-title glyph: '+c);
 }
 function create(resources){
  const own=r=>(resources.add(r),r),world=new THREE.Scene();world.background=new THREE.Color(0x000000);
  const face=own(new THREE.MeshStandardMaterial({color:0xe5f0ff,metalness:.55,roughness:.23,emissive:0x2c578a,emissiveIntensity:.3}));
  const side=own(new THREE.MeshStandardMaterial({color:0x17224d,metalness:.7,roughness:.3}));
  const edge=own(new THREE.LineBasicMaterial({color:0x68cfff,transparent:true,opacity:.3}));
  const group=new THREE.Group();group.name='FANTAZIA RP 3D — extruded title';world.add(group);
  let aperture;const letters=[];
  for(const [row,text] of ['FANTAZIA','RP 3D'].entries()){
   const width=(text.length-1)*2.4+2,start=-width/2,y=row===0?.65:-3.25;
   [...text].forEach((ch,i)=>{if(ch===' ')return;
    const g=own(new THREE.ExtrudeGeometry(glyph(ch),{depth:DEPTH,bevelEnabled:true,bevelSize:.025,bevelThickness:.045,bevelSegments:3,curveSegments:16,steps:1}));g.translate(-1,-1.5,-DEPTH/2);
    const part=new THREE.Group();part.position.set(start+i*2.4+1,y+1.5,0);part.userData.home=part.position.clone();part.userData.order=row*8+i;group.add(part);letters.push(part);
    const mesh=new THREE.Mesh(g,[face,side]);mesh.name=ch;part.add(mesh);
    part.add(new THREE.LineSegments(own(new THREE.EdgesGeometry(g,35)),edge));
    if(row===0&&i===1)aperture=new THREE.Vector3(start+i*2.4+1,y+1.66,0);
   });
  }
  world.add(new THREE.HemisphereLight(0xc9e6ff,0x060717,1.3));
  const key=new THREE.DirectionalLight(0xffffff,2.4);key.position.set(-6,8,15);world.add(key);
  const rim=new THREE.PointLight(0x69aaff,12,45,2);rim.position.set(7,3,5);world.add(rim);
  const bolts=[];
  function discharge(points){
   const path=new THREE.CurvePath();for(let i=1;i<points.length;i++)path.add(new THREE.LineCurve3(points[i-1],points[i]));
   for(const halo of [true,false]){
    const mat=own(new THREE.MeshBasicMaterial({color:halo?0x3c78ff:0xd6f4ff,transparent:true,opacity:0,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending}));
    const bolt=new THREE.Mesh(own(new THREE.TubeGeometry(path,96,halo?.12:.035,6,false)),mat);bolt.userData.halo=halo;world.add(bolt);bolts.push(bolt);
   }
  }
  for(let k=0;k<8;k++){
   const points=[],side=k%2?1:-1;
   for(let i=0;i<=16;i++){const u=i/16,hash=Math.sin(i*78.233+k*45.76)*43758.5453,jitter=(hash-Math.floor(hash)-.5)*1.25;points.push(new THREE.Vector3(side*(3.5+k*.8)+jitter,7-u*(5+k%3),-.8));}
   discharge(points);
   const p=points[9];discharge([p,p.clone().add(new THREE.Vector3(side*.8,-.35,0)),p.clone().add(new THREE.Vector3(side*.45,-.65,0)),p.clone().add(new THREE.Vector3(side*1.5,-1.2,0))]);
  }
  const ribMaterial=own(new THREE.LineBasicMaterial({color:0x77d9ff,transparent:true,opacity:0,blending:THREE.AdditiveBlending,toneMapped:false}));
  for(const depth of [-.9,0,.9]){const g=own(new THREE.BufferGeometry().setFromPoints([[-.18,-.26],[.18,-.26],[0,.52]].map(([x,y])=>new THREE.Vector3(aperture.x+x*.91,aperture.y+y*.91,depth))));world.add(new THREE.LineLoop(g,ribMaterial));}
  const dustGeometry=own(new THREE.BufferGeometry()),dustData=new Float32Array(64*3);dustGeometry.setAttribute('position',new THREE.BufferAttribute(dustData,3));
  const dustMaterial=own(new THREE.PointsMaterial({color:0x85b9ff,size:.035,transparent:true,opacity:.3,depthWrite:false,toneMapped:false}));
  const dust=new THREE.Points(dustGeometry,dustMaterial);dust.frustumCulled=false;world.add(dust);
  let z=0,crossed=false;
  function pose(t,camera,reduced=false){
   for(const part of letters){const i=part.userData.order,k=reduced?1:C.ease((t-i*.04)/1.05);part.position.copy(part.userData.home);part.position.y+=(1-k)*.4;part.position.z-=(1-k)*(1.2+i%3*.4);part.rotation.set(0,(i%2?1:-1)*(1-k)*.16,(i%2?1:-1)*(1-k)*.035);}
   group.updateMatrixWorld(true);
   key.position.x=reduced?-6:C.mix(-10,3,t/2.2);
   ribMaterial.opacity=reduced?0:C.ease((t-3.25)/.6)*(1-C.ease((t-6.1)/.4))*.7;
   dustMaterial.opacity=reduced?.12:.26*(1-C.ease((t-2.8)/.8));
   for(let i=0;i<64;i++){const phase=reduced?0:t;dustData[i*3]=Math.sin(i*78.23)*12+Math.sin(phase*.3+i)*.12;dustData[i*3+1]=Math.cos(i*31.77)*6+phase*.035;dustData[i*3+2]=-2+(i%9)*.45;}dustGeometry.attributes.position.needsUpdate=true;
   const fov=55;camera.fov=fov;camera.updateProjectionMatrix();
   const distance=Math.max(18.85/(2*Math.tan(fov*Math.PI/360)*camera.aspect),7/(2*Math.tan(fov*Math.PI/360)))*1.28+DEPTH;
   const align=reduced?0:smooth((t-2.25)/2.2);
   z=reduced?distance:C.track([[0,distance],[2.25,distance],[4.5,5],[6.6,-4],[7,-4]],t);
   camera.position.set(aperture.x*align,aperture.y*align,z);camera.up.set(0,1,0);camera.lookAt(aperture.x*align,aperture.y*align,-8);camera.updateMatrixWorld(true);
   crossed=crossed||z< -DEPTH/2;
   // Two broad, local pulses, not a rapid or fullscreen strobe.
   const pulse=reduced?.12:Math.max(0,Math.sin(clamp((t-.35)/1.1)*Math.PI),Math.sin(clamp((t-2.0)/1.2)*Math.PI));
   for(const b of bolts)b.material.opacity=(reduced?.12:(.18+pulse*.82)*(1-smooth((t-3.6)/.7)))*(b.userData.halo?.22:1);
   rim.intensity=8+pulse*12;face.emissiveIntensity=.3+pulse*.35;
  }
  return {world,group,aperture,pose,info:()=>({text:TEXT,letter:'A',animatedLetters:letters.length,cameraLocalZ:z,crossed,depth:DEPTH,aperture:aperture.toArray()}),dispose:()=>world.clear()};
 }
 const api={create,glyph,TEXT,DEPTH};global.FZDreamTitle31=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
