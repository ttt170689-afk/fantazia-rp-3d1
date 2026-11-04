/* Native metro decoration owner. No RAF, timers, colliders or extra renderer.
 * All props stay at the wall/ceiling; the green pedestrian route remains free. */
(function(){
 'use strict';
 function create(parent){
  const root=new THREE.Group();root.name='Service tunnel — pipes, water and rats';parent.add(root);
  const owned=new Set(),rats=[],ripples=[],drops=[],V=(x,y,z)=>new THREE.Vector3(x,y,z),own=r=>(owned.add(r),r);
  let time=0,lastDrip=-10,lastRat=-10;
  const mat=(color,extra={})=>own(new THREE.MeshStandardMaterial({color,roughness:.8,...extra}));
  const rust=mat(0x805b42,{metalness:.35}),iron=mat(0x3b4b4c,{metalness:.55}),red=mat(0x8a332b),fur=mat(0x534c42),skin=mat(0x98796d),black=mat(0x161b1a),eye=mat(0x302c20,{roughness:.12});
  const ball=own(new THREE.SphereGeometry(1,10,7)),cylinder=own(new THREE.CylinderGeometry(1,1,1,10)),cube=own(new THREE.BoxGeometry(1,1,1));
  function mesh(g,m,p,s,parent=root){const o=new THREE.Mesh(g,m);o.position.set(...p);o.scale.set(...s);parent.add(o);return o;}
  function pipe(a,b,r=.12,m=rust){const start=V(...a),end=V(...b),o=mesh(cylinder,m,start.clone().add(end).multiplyScalar(.5).toArray(),[r,start.distanceTo(end),r]);o.quaternion.setFromUnitVectors(V(0,1,0),end.sub(start).normalize());return o;}
  for(const y of [1.1,2.45,3.45]){
   pipe([-12,y,3],[51,y,3],y===3.45?.18:.105,y===1.1?iron:rust);
   for(let x=-10;x<52;x+=6){const ring=mesh(cylinder,iron,[x,y,3],[.15,.08,.15]);ring.rotation.z=Math.PI/2;mesh(cube,iron,[x,y,3.13],[.08,.48,.08]);}
  }
  const wheelGeo=own(new THREE.TorusGeometry(.21,.025,6,16));
  for(const x of [5,23,41]){
   pipe([x,.3,3],[x,3.45,3]);pipe([x,3.45,3],[x,3.45,-1.3]);
   const wheel=mesh(wheelGeo,red,[x,1.6,2.77],[1,1,1]);
   for(const a of [0,Math.PI/2]){const spoke=mesh(cube,red,[0,0,0],[.36,.025,.025],wheel);spoke.rotation.z=a;}
   mesh(cube,iron,[x,1.6,2.9],[.17,.18,.24]);
  }
  // Cable trays and drainage grates, outside the traversable centre.
  mesh(cube,black,[20,3.85,-1.15],[65,.15,.4]);
  for(let x=-10;x<52;x+=2){mesh(cube,iron,[x,.018,2.72],[1.6,.025,.25]);for(let i=0;i<4;i++)mesh(cube,black,[x-.6+i*.4,.035,2.72],[.16,.008,.22]);}
  const water=mat(0x416364,{transparent:true,opacity:.58,roughness:.12,metalness:.3,depthWrite:false,side:THREE.DoubleSide}),circle=own(new THREE.CircleGeometry(1,24)),ringGeo=own(new THREE.RingGeometry(.93,1,24));
  const wet=[3,17,32,46];
  for(const [i,x] of wet.entries()){
   pipe([x,3.45,3],[x,3.45,1.75],.055,iron);pipe([x,3.45,1.75],[x,3.25,1.75],.055,iron);
   const puddle=mesh(circle,water,[x,.012,1.75],[1.25+i%2*.4,.6,1]);puddle.rotation.x=-Math.PI/2;
   const streak=mesh(cube,mat(0x263a32,{transparent:true,opacity:.7}),[x,1.8,3.105],[.5+i*.13,3.5,.012]);streak.name='Old damp streak';
   const ring=mesh(ringGeo,own(new THREE.MeshBasicMaterial({color:0x9cb9b6,transparent:true,opacity:.2,depthWrite:false,side:THREE.DoubleSide})),[x,.022,1.75],[.2,.2,.2]);ring.rotation.x=-Math.PI/2;ripples.push(ring);
   drops.push([x,1.75]);
  }
  const droplets=new THREE.InstancedMesh(own(new THREE.CylinderGeometry(.012,.008,.08,5)),mat(0x99bbc1,{transparent:true,opacity:.55}),16),dummy=new THREE.Object3D();droplets.frustumCulled=false;root.add(droplets);
  for(let i=0;i<4;i++){
   const rat=new THREE.Group();rat.name='Tunnel rat '+(i+1);root.add(rat);rat.position.set(7+i*12,0,2.5);
   mesh(ball,fur,[0,.13,0],[.13,.105,.25],rat);mesh(ball,fur,[0,.14,.22],[.095,.085,.12],rat);mesh(ball,skin,[0,.115,.32],[.035,.028,.05],rat);
   for(const side of [-1,1]){mesh(ball,skin,[side*.075,.22,.23],[.045,.05,.018],rat);mesh(ball,eye,[side*.07,.165,.28],[.018,.018,.018],rat);}
   const legs=[];for(const side of [-1,1])for(const z of [-.14,.13])legs.push(mesh(ball,skin,[side*.095,.035,z],[.037,.025,.075],rat));
   const tail=new THREE.Group();tail.position.set(0,.09,-.18);rat.add(tail);
   const curve=new THREE.CatmullRomCurve3([V(0,0,0),V(.04,-.03,-.16),V(.13,-.05,-.32),V(.18,-.05,-.45)]);
   mesh(own(new THREE.TubeGeometry(curve,10,.016,5,false)),skin,[0,0,0],[1,1,1],tail);
   rats.push({root:rat,legs,tail,x:7+i*12,direction:i%2?1:-1,home:7+i*12,scared:0});
  }
  root.traverse(o=>o.layers.set(3));
  function update(dt,player,reduced=false){
   if(!Number.isFinite(dt)||dt<=0)return;const step=Math.min(.1,dt);time+=step;
   for(const [i,r] of rats.entries()){
    const near=Math.hypot(player.x-r.x,player.z-2.55)<2.8;
    if(near&&r.scared<=0){r.scared=1.2;r.direction=player.x<r.x?1:-1;if(time-lastRat>5){window.FZSound?.effect('rat42');lastRat=time;}}
    r.scared=Math.max(0,r.scared-step);r.x+=r.direction*step*(r.scared>0?2.1:.32);
    if(r.x>r.home+4){r.x=r.home+4;r.direction=-1;}if(r.x<r.home-4){r.x=r.home-4;r.direction=1;}
    r.root.position.set(r.x,reduced?0:Math.abs(Math.sin(time*(r.scared>0?24:9)+i))*.008,2.5+Math.sin(time*.5+i)*.1);r.root.rotation.y=r.direction*Math.PI/2;
    r.tail.rotation.y=reduced?0:Math.sin(time*7+i)*.12;r.legs.forEach((leg,j)=>leg.rotation.x=reduced?0:Math.sin(time*(r.scared>0?24:9)+j*Math.PI)*.35);
   }
   for(let i=0;i<16;i++){const site=drops[i%4],h=3.4-((time*1.7+i*.37)%3.35);dummy.position.set(site[0],h,site[1]);dummy.updateMatrix();droplets.setMatrixAt(i,dummy.matrix);}droplets.instanceMatrix.needsUpdate=true;
   ripples.forEach((r,i)=>{const phase=(time*.65+i*.23)%1;r.scale.setScalar(.06+phase*.55);r.material.opacity=reduced?.12:(1-phase)*.23;});
   if(time-lastDrip>1.6&&drops.some(([x,z])=>Math.hypot(player.x-x,player.z-z)<7)){window.FZSound?.effect('drip42');lastDrip=time;}
  }
  function dispose(){root.parent?.remove(root);owned.forEach(r=>r.dispose?.());owned.clear();rats.length=0;}
  return {update,dispose,info:()=>({rats:rats.length,puddles:wet.length,resources:owned.size,time,positions:rats.map(r=>r.root.position.toArray())})};
 }
 window.FZEscape42={create};
})();
