/* Funeral cast v51. Five fully dressed, independently shaped skinned humans.
 * Assets/licenses: licenses/funeral51-source.md. No gameplay-avatar dependency.
 * Immutable GLB geometry/materials/textures are cached once per page; each scene
 * owns only cloned bones/skeletons. The story's teardown disposes those skeletons.
 * Old geometry-only figures are an explicit per-file network-failure fallback. */
(function(){
 'use strict';
 const ids=['father','mother','friend','brother','sister'];
 const models=new Array(5).fill(null),errors=new Array(5).fill('');
 let promise=null,settled=false;
 function disposeAsset(scene){
  const owned=new Set();scene?.traverse(o=>{if(o.geometry)owned.add(o.geometry);if(o.skeleton)owned.add(o.skeleton);
   for(const m of [].concat(o.material||[])){owned.add(m);for(const v of Object.values(m))if(v?.isTexture)owned.add(v);}
  });owned.forEach(o=>o.dispose?.());
 }
 async function loadOne(id,index){
  const controller=new AbortController();let expired=false;
  // Fetch can be aborted; parse callbacks may still finish after the deadline.
  // Such late assets are disposed rather than replacing an in-flight scene.
  let timer;
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;controller.abort();reject(Error('Loading deadline exceeded'));},18000);});
  const work=(async()=>{
   const response=await fetch('assets/models/funeral51/'+id+'.glb',{signal:controller.signal});
   if(!response.ok)throw Error('HTTP '+response.status);
   const bytes=await response.arrayBuffer();
   return new Promise((resolve,reject)=>new THREE.GLTFLoader().parse(bytes,'',g=>{
    if(expired){disposeAsset(g.scene);resolve(null);return;}
    let meshes=0;g.scene.traverse(o=>{if(o.isSkinnedMesh){meshes++;o.frustumCulled=false;o.castShadow=true;o.receiveShadow=true;}});
    if(!meshes){disposeAsset(g.scene);reject(Error('Missing skinned anatomy'));return;}
    resolve(g.scene);
   },reject));
  })();
  try{models[index]=await Promise.race([work,deadline]);}
  catch(e){errors[index]=id+': '+String(e.message||e);console.warn('Funeral model fallback:',errors[index]);}
  finally{clearTimeout(timer);}
 }
 function load(){return promise||(promise=Promise.all(ids.map(loadOne)).finally(()=>{settled=true;}));}
 function create(resources,index){
  index=((Math.trunc(index)||0)%5+5)%5;
  if(!models[index]){const actor=fallbackCreate(resources,index);actor.userData.castIndex=index;actor.userData.fallback51=true;return actor;}
  const root=THREE.SkeletonUtils.clone(models[index]),bones={};let skeleton=null;
  root.name='Funeral51 / '+ids[index];
  root.traverse(o=>{
   if(o.isBone)bones[o.name]=o;
   if(o.isSkinnedMesh){
    // SkeletonUtils clones per mesh; these GLBs deliberately use one skin.
    // Share only WITHIN this actor, never with the cache or another scene.
    if(!skeleton)skeleton=o.skeleton;
    else if(o.skeleton.bones.every((bone,i)=>bone===skeleton.bones[i])){o.skeleton.dispose();o.skeleton=skeleton;}
   }
  });
  root.userData={...root.userData,castIndex:index,bones,restYaw:0,profile:ids[index],neck:bones.head,torso:bones.spine02};
  animate([root],0,true);
  return root;
 }
 const ease=n=>{const t=Math.max(0,Math.min(1,n));return t*t*t*(t*(t*6-15)+10);};
 // Two-bone reach: wrists meet the authored target without stretching anatomy.
 // Poles keep elbows outside the jacket. All scratch storage is per actor.
 function reach(a,side,target,pole){
  const u=a.userData,b=u.bones,upper=b['upperarm01_'+side],lower=b['lowerarm01_'+side],wrist=b['wrist_'+side];
  const s=u.ik||(u.ik={v:Array.from({length:10},()=>new THREE.Vector3()),q:Array.from({length:3},()=>new THREE.Quaternion())});
  const [shoulder,elbow,hand,goal,bend,axis,offset,want,from,to]=s.v,[delta,world,parent]=s.q;
  a.updateMatrixWorld(true);upper.getWorldPosition(shoulder);lower.getWorldPosition(elbow);wrist.getWorldPosition(hand);
  goal.fromArray(target);a.localToWorld(goal);bend.fromArray(pole);a.localToWorld(bend);
  const l1=shoulder.distanceTo(elbow),l2=elbow.distanceTo(hand),d=Math.max(.001,Math.min(l1+l2-.001,shoulder.distanceTo(goal)));
  axis.copy(goal).sub(shoulder).normalize();goal.copy(shoulder).addScaledVector(axis,d);
  offset.copy(bend).sub(shoulder);offset.addScaledVector(axis,-offset.dot(axis)).normalize();
  const along=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along));
  want.copy(shoulder).addScaledVector(axis,along).addScaledVector(offset,height);
  function aim(bone,start,oldEnd,end){
   from.copy(oldEnd).sub(start).normalize();to.copy(end).sub(start).normalize();delta.setFromUnitVectors(from,to);
   bone.getWorldQuaternion(world);bone.parent.getWorldQuaternion(parent).invert();
   bone.quaternion.copy(parent.multiply(delta).multiply(world));a.updateMatrixWorld(true);
  }
  aim(upper,shoulder,elbow,want);lower.getWorldPosition(elbow);wrist.getWorldPosition(hand);aim(lower,elbow,hand,goal);
 }
 function aimHand(a,side,direction){
  const b=a.userData.bones,w=b['wrist_'+side],finger=b['finger3-1_'+side],s=a.userData.ik;
  const [p,f,d,origin]=s.v,[delta,q,parent]=s.q;
  a.updateMatrixWorld(true);w.getWorldPosition(p);finger.getWorldPosition(f);f.sub(p).normalize();
  origin.set(0,0,0);a.localToWorld(origin);d.fromArray(direction);a.localToWorld(d);d.sub(origin).normalize();
  delta.setFromUnitVectors(f,d);w.getWorldQuaternion(q);w.parent.getWorldQuaternion(parent).invert();
  w.quaternion.copy(parent.multiply(delta).multiply(q));
 }
 function animate(actors,time,reduced=false){
  const t=Number.isFinite(time)?Math.max(0,time):0;
  for(const a of actors){
   if(!a.userData.bones){fallbackAnimate([a],t,reduced);continue;}
   const i=a.userData.castIndex,b=a.userData.bones;
   const turn=i===3?ease((t-2.55)/1.4):0,shoulders=i===3?ease((t-2.95)/1.65):0;
   const breath=reduced?0:Math.sin(t*1.45+i*1.7)*.006;
   const set=(n,x=0,y=0,z=0)=>{if(b[n])b[n].rotation.set(x,y,z);};
   a.rotation.y=a.userData.restYaw;
   // Hip/leg/foot bind transforms never change. The acting is above the waist.
   set('spine02',.018+breath,shoulders*.52,i===1?-.018:0);
   set('spine01',.012+breath*.5,shoulders*.12,0);
   set('neck01',.035,turn*.12,0);
   set('head',.13-turn*.1,turn*.96,(reduced?0:Math.sin(t*.43+i)*.009)+(i===1?.055:0));
   for(const side of ['L','R']){
    const s=side==='L'?1:-1;
    // Rest model is A-posed. Lower sleeves and articulated hands together.
    set('upperarm01_'+side,.04,0,-s*.62);
    set('lowerarm01_'+side,.32,0,0);
    set('wrist_'+side,0,0,s*.03);
    for(let f=2;f<=5;f++)for(let j=1;j<=3;j++)set('finger'+f+'-'+j+'_'+side,.12+j*.035,0,0);
    set('finger1-1_'+side,0,s*.12,-s*.12);
   }
   // Different restrained grief poses, authored rather than phase-shifted clones.
   const height=[1.79,1.66,1.86,1.76,1.70][i];
   if(i===0||i===2||i===4){
    for(const side of ['L','R']){const s=side==='L'?1:-1;
     reach(a,side,[s*.047,height*(i===4?.57:.55)+(side==='L'?.018:0),.235],[s*.35,height*.57,.12]);
     aimHand(a,side,[-s*.09,-.045,.008]);
    }
   }
   if(i===1){
    reach(a,'R',[-.065,height-.24,.185],[-.32,height*.62,.32]);
    aimHand(a,'R',[.025,.08,-.025]);
   }
  }
 }
 // Emergency-only old silhouettes: kept independent of GLTF/SkeletonUtils so
 // a missing/corrupt asset never blocks the public opening or creates nude bodies.
 const sharedRounds=new WeakMap();
 const profiles=[{width:1,height:1,hair:0x211a18},{width:.94,height:.98,hair:0x433129},{width:1.07,height:1.04,hair:0x77716b},{width:.98,height:1,hair:null},{width:1.03,height:.95,hair:0x292522}];
 function fallbackCreate(resources,index){
  const root=new THREE.Group();root.name='Human mourner '+(index+1);
  const own=r=>(resources.add(r),r),material=(color,extra={})=>own(new THREE.MeshStandardMaterial({color,roughness:.83,...extra}));
  const profile=profiles[index%5];
  const skin=material([0x86614f,0x98735d,0x7e6250,0x896452,0x7d5847][index]),cloth=material([0x171b25,0x292a30,0x202b30,0x26212a,0x353239][index]),shirt=material([0xc6c5bc,0x85828a,0x50565f,0x282a31,0xb4b2ae][index]),shoe=material(0x121319);
  let round=sharedRounds.get(resources);if(!round||!resources.has(round)){round=own(new THREE.SphereGeometry(1,20,14));sharedRounds.set(resources,round);}
  function ellipsoid(parent,x,y,z,sx,sy,sz,m){const mesh=new THREE.Mesh(round,m);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);parent.add(mesh);return mesh;}
  // Continuous elliptical tailoring, not stacked boxes.
  function tailored(profile,m,parent=root){const vertices=[],indices=[],n=24;profile.forEach(([y,rx,rz])=>{for(let i=0;i<n;i++){const a=i/n*Math.PI*2;vertices.push(Math.cos(a)*rx,y,Math.sin(a)*rz);}});for(let j=0;j<profile.length-1;j++)for(let i=0;i<n;i++){const a=j*n+i,b=j*n+(i+1)%n,c=a+n,d=b+n;indices.push(a,c,b,b,c,d);}const g=own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();const mesh=new THREE.Mesh(g,m);parent.add(mesh);return mesh;}
  const upper=[];upper.push(tailored([[.79,.21,.12],[.88,.21,.14],[1.03,.18,.125],[1.23,.22,.145],[1.34,.23,.135],[1.39,.17,.10],[1.43,.078,.07]],cloth));
  upper.push(tailored([[1.405,.078,.074],[1.445,.070,.067]],shirt));
  const collar=own(new THREE.BufferGeometry());collar.setAttribute('position',new THREE.Float32BufferAttribute([-.08,1.425,.101,0,1.19,.147,.08,1.425,.101],3));collar.computeVertexNormals();shirt.side=THREE.DoubleSide;const shirtMesh=new THREE.Mesh(collar,shirt);root.add(shirtMesh);upper.push(shirtMesh);
  const tie=ellipsoid(root,0,1.30,.144,.022,.1,.012,shoe);tie.rotation.z=.05;upper.push(tie);
  const arms=[];
  for(const s of [-1,1]){
   const leg=new THREE.Group();leg.position.x=s*.105;root.add(leg);tailored([[.08,.065,.07],[.36,.075,.074],[.48,.08,.078],[.75,.095,.10],[.86,.09,.10]],cloth,leg);ellipsoid(root,s*.105,.06,.067,.085,.065,.145,shoe);
   const arm=new THREE.Group();arm.position.set(s*.235,1.34,0);arm.rotation.z=s*.08;root.add(arm);arms.push(arm);upper.push(arm);
   tailored([[-.28,.059,.06],[-.17,.069,.07],[-.05,.078,.077],[.035,.06,.06]],cloth,arm);
   ellipsoid(arm,0,.01,0,.065,.055,.065,cloth);
   const elbow=new THREE.Group();elbow.position.y=-.28;arm.add(elbow);arm.userData.elbow=elbow;ellipsoid(arm,0,-.28,0,.059,.059,.06,cloth);
   tailored([[-.25,.043,.046],[-.18,.05,.05],[-.04,.058,.06],[0,.059,.06]],cloth,elbow);
   tailored([[-.272,.044,.046],[-.25,.044,.046]],shirt,elbow);
   const wrist=new THREE.Group();wrist.position.y=-.275;elbow.add(wrist);arm.userData.wrist=wrist;
   ellipsoid(wrist,0,-.027,0,.039,.057,.023,skin);
   for(let f=0;f<4;f++){const finger=ellipsoid(wrist,(f-1.5)*.017,-.082+Math.abs(f-1.5)*.007,.008,.009,.033,.011,skin);finger.rotation.x=-.28;}
   const thumb=ellipsoid(wrist,s*-.033,-.027,.021,.014,.033,.014,skin);thumb.rotation.z=s*-.4;

  }
  const neck=new THREE.Group();neck.position.y=1.43;root.add(neck);upper.push(neck);ellipsoid(neck,0,.04,0,.065,.1,.066,skin);
  ellipsoid(neck,0,.20,0,.095,.145,.09,skin);for(const s of [-1,1])ellipsoid(neck,s*.035,.225,.081,.012,.008,.008,shoe);ellipsoid(neck,0,.19,.092,.016,.025,.025,skin);
  if(profile.hair!==null){
   const hair=new THREE.Mesh(own(new THREE.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI*.46)),material(profile.hair));hair.position.set(0,.20,-.024);hair.scale.set(.115*profile.width,.165*profile.height,.143);neck.add(hair);
   for(const side of [-1,1])ellipsoid(neck,side*.101,.20,-.04,.012,.055,.065,hair.material);
  }
  if(index===2){
   const frame=material(0x36312e,{metalness:.4});
   for(const side of [-1,1]){const rim=new THREE.Mesh(own(new THREE.TorusGeometry(.026,.0022,5,20)),frame);rim.position.set(side*.034,.195,.130);rim.scale.y=.75;neck.add(rim);}
   ellipsoid(neck,0,.195,.132,.01,.002,.003,frame);
  }
  const lapel=material(0x30313a),stitch=material(0x0f1118);
  for(const side of [-1,1]){
   const g=own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute([side*.09,1.42,.103,side*.17,1.35,.125,side*.045,1.06,.138,side*.09,1.42,.103,side*.045,1.06,.138,side*.04,1.30,.15],3));g.computeVertexNormals();lapel.side=THREE.DoubleSide;const panel=new THREE.Mesh(g,lapel);root.add(panel);upper.push(panel);
   const pocket=ellipsoid(root,side*.14,1.03,.13,.055,.006,.007,stitch);upper.push(pocket);
  }
  for(const y of [1.10,1.01,.92])upper.push(ellipsoid(root,.022,y,.143,.007,.007,.004,shoe));
  const torso=new THREE.Group();torso.position.y=.83;root.add(torso);
  for(const part of upper){part.position.y-=.83;torso.add(part);}
  root.userData.profile=profile;root.userData.torso=torso;root.userData.arms=arms;
  root.scale.set(1+(index%2)*.08,[1,.96,1.06,.94,1.02][index],1);root.userData.neck=neck;root.userData.restYaw=0;
  return root;
 }
 function fallbackAnimate(actors,t,reduced=false){actors.forEach((a)=>{
  const i=a.userData.castIndex||0;
  const C=FZCinematic32,lead=i===3?C.ease((t-2.55)/1.4):0,body=i===3?C.ease((t-2.95)/1.65):0;
  a.rotation.y=a.userData.restYaw; // Feet stay planted: head leads shoulders, not a rigid whole-body spin.
  const torso=a.userData.torso,neck=a.userData.neck;
  torso.position.y=.83+(reduced?0:Math.sin(t*1.55+i*.9)*.0025);
  torso.rotation.set(reduced?0:Math.sin(t*.65+i)*.008,body*.88,reduced?0:Math.sin(t*.8+i)*.007);
  neck.rotation.set(.11-lead*.095,lead*.94,reduced?0:Math.sin(t*.7+i)*.009);
  a.userData.arms.forEach((arm,j)=>{
   const side=j===0?-1:1,clasp=i===0||i===2||i===4,grief=i===1&&j===1;
   const breathe=reduced?0:Math.sin(t*1.2+i+j)*.008;
   arm.position.y=.51+(grief?.035:0);
   arm.rotation.set(grief?-1.3:clasp?.12:.04+breathe,0,grief?-.22:clasp?-side*.28:side*.06);
   const elbow=arm.userData.elbow;elbow.rotation.set(grief?-2.3:clasp?-1.25:-.18+breathe,0,grief?-.5:clasp?-side*.28:0);
   arm.userData.wrist.rotation.set(grief?.2:clasp?-.25:0,side*.08,clasp?side*.25:0);
  });
 });}
 window.FZHumans31={load,ready:()=>settled,create,animate,info:()=>({version:51,loaded:models.every(Boolean),loadedCount:models.filter(Boolean).length,error:errors.filter(Boolean).join('; '),profiles:ids.slice()})};
})();
