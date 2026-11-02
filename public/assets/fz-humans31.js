/* Separate funeral cast. Scanned head: Lee Perry-Smith / Infinite, CC BY 3.0.
 * Tailored bodies and animation are original; no gameplay-avatar dependency.
 * Shared scan/textures are cached; per-scene geometry/materials belong to caller. */
(function(){
 'use strict';
 let source=null,promise=null,settled=false,error='';
 const sharedRounds=new WeakMap();
 const profiles=[{width:1,height:1,hair:0x211a18},{width:.94,height:.98,hair:0x433129},{width:1.07,height:1.04,hair:0x77716b},{width:.98,height:1,hair:null},{width:1.03,height:.95,hair:0x292522}];
 function load(){return promise||(promise=Promise.all([
  new Promise((ok,no)=>new THREE.GLTFLoader().load('assets/models/human31.glb',ok,undefined,no)),
  new Promise((ok,no)=>new THREE.TextureLoader().load('assets/models/human31-color.jpg',ok,undefined,no)),
  new Promise((ok,no)=>new THREE.TextureLoader().load('assets/models/human31-normal.jpg',ok,undefined,no))
 ]).then(([g,color,normal])=>{color.encoding=THREE.sRGBEncoding;let head;g.scene.traverse(o=>{if(o.isMesh&&!head)head=o;});const original=head.geometry,position=original.attributes.position,indices=[];
  for(let i=0;i<original.index.count;i+=3){const tri=[original.index.getX(i),original.index.getX(i+1),original.index.getX(i+2)];if(tri.every(k=>position.getY(k)>-1))indices.push(...tri);}
  const cropped=original.clone();cropped.setIndex(indices);const geometry=cropped.toNonIndexed();cropped.dispose();original.dispose();
  source={geometry,color,normal};geometry.computeBoundingBox();}).catch(e=>{error=String(e);console.warn('Funeral scan unavailable:',e);}).finally(()=>{settled=true;}));}
 function create(resources,index){
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
  if(source){const head=new THREE.Mesh(source.geometry,material([0xf2e1d3,0xffeee1,0xe0d7ce,0xf5e5da,0xe9d6c2][index],{map:source.color,normalMap:source.normal,normalScale:new THREE.Vector2(.6,.6),roughness:.68})),b=source.geometry.boundingBox,size=b.getSize(new THREE.Vector3()),center=b.getCenter(new THREE.Vector3()),scale=.32/size.y;head.scale.set(scale*profile.width,scale*profile.height,scale);head.position.set(-center.x*scale,.19-center.y*scale,-center.z*scale);neck.add(head);

  }
  else { // Asset failure remains playable, but diagnostics explicitly report it.
   ellipsoid(neck,0,.20,0,.095,.145,.09,skin);for(const s of [-1,1])ellipsoid(neck,s*.035,.225,.081,.012,.008,.008,shoe);ellipsoid(neck,0,.19,.092,.016,.025,.025,skin);
  }
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
 function animate(actors,t,reduced=false){actors.forEach((a,i)=>{
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
 window.FZHumans31={load,ready:()=>settled,create,animate,info:()=>({loaded:!!source,error})};
})();
