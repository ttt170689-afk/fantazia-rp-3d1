/* Owned, bounded 3D sets for the human-life vignette and glass cabin. The sky
 * plaza and forest are the existing playable world, never a replacement city. */
(function(){
  'use strict';
  function kit(parent,resources){
    const own=r=>(resources.add(r),r);
    const geom=own(new THREE.BoxGeometry(1,1,1));
    const mat=(c,extra={})=>own(new THREE.MeshStandardMaterial({color:c,roughness:.65,...extra}));
    const box=(w,h,d,x,y,z,m)=>{const o=new THREE.Mesh(geom,m);o.scale.set(w,h,d);o.position.set(x,y,z);parent.add(o);return o;};
    const label=(text,x,y,z,w,h,fg='#e5eef9',bg='#142239')=>{
      const cv=document.createElement('canvas');cv.width=1024;cv.height=256;const c=cv.getContext('2d');
      if(bg){c.fillStyle=bg;c.fillRect(0,0,1024,256);}c.textAlign='center';c.textBaseline='middle';c.font='600 66px Arial';c.fillStyle=fg;c.fillText(text,512,128,950);
      const map=own(new THREE.CanvasTexture(cv));map.encoding=THREE.sRGBEncoding;
      const m=own(new THREE.MeshBasicMaterial({map,transparent:true,side:THREE.DoubleSide,toneMapped:false}));
      const o=new THREE.Mesh(own(new THREE.PlaneGeometry(w,h)),m);o.position.set(x,y,z);o.rotation.y=Math.PI;parent.add(o);return o;
    };
    return {own,mat,box,label};
  }
  function cabin(parent,resources,open=true){
    const root=new THREE.Group();root.name='Glass elevator';parent.add(root);
    const {own,mat,box,label}=kit(root,resources);
    const metal=mat(0x627080,{metalness:.65,roughness:.25}),black=mat(0x111a28),light=mat(0xdceeff,{emissive:0xa7caff,emissiveIntensity:1.1});
    const glass=mat(0xb2d4ea,{transparent:true,opacity:.13,roughness:.08,metalness:.15,depthWrite:false,side:THREE.DoubleSide});
    const floor=[],shards=[],grid=[];
    for(let row=0;row<=4;row++){grid[row]=[];for(let col=0;col<=3;col++)grid[row][col]=[-1.1+col*2.2/3+(col>0&&col<3&&row>0&&row<4?Math.sin(row*11+col*7)*.13:0),-1.6+row*.8+(row>0&&row<4&&col>0&&col<3?Math.cos(row*7+col*11)*.10:0)];}
    for(let row=0;row<4;row++)for(let col=0;col<3;col++)for(let half=0;half<2;half++){
      const a=grid[row][col],b=grid[row][col+1],c=grid[row+1][col+1],d=grid[row+1][col],points=half?[a,c,d]:[a,b,c];
      const cx=points.reduce((n,p)=>n+p[0],0)/3,cz=points.reduce((n,p)=>n+p[1],0)/3;
      const shape=new THREE.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x-cx,-z+cz):shape.moveTo(x-cx,-z+cz));shape.closePath();
      const g=own(new THREE.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:false,steps:1}));g.rotateX(-Math.PI/2);
      const shard=new THREE.Mesh(g,glass);shard.position.set(cx,.035,cz);shard.userData.home=[cx,.035,cz];root.add(shard);shards.push(shard);
      const cm=own(new THREE.LineBasicMaterial({color:0xe5f4ff,transparent:true,opacity:0,depthWrite:false}));
      const crackLine=new THREE.LineSegments(own(new THREE.EdgesGeometry(g,30)),cm);crackLine.visible=false;shard.add(crackLine);shard.userData.crack=cm;shard.userData.crackLine=crackLine;
    }
    for(const side of [-1,1]){
      box(.07,.12,3.2,side*1.1,0,0,metal);
      box(.025,2.72,3.2,side*1.1,1.38,0,glass);
      box(.06,.06,3.2,side*1.07,1.02,0,metal);
      for(const z of [-1.6,1.6])box(.08,2.86,.08,side*1.1,1.4,z,metal);
    }
    box(2.2,2.72,.025,0,1.38,1.43,glass);box(2.2,.025,.035,0,1.98,1.42,metal);box(2.2,.04,.05,0,1.02,1.42,metal);box(2.3,.12,3.3,0,2.83,0,metal);
    box(1.9,.035,2.9,0,2.75,0,black);box(1.6,.018,.12,0,2.71,.6,light);
    const doors=[];
    for(const s of [-1,1]){const d=new THREE.Group();root.add(d);const g=new THREE.Mesh(own(new THREE.BoxGeometry(1.06,2.65,.035)),glass);d.add(g);const edge=new THREE.Mesh(own(new THREE.BoxGeometry(.055,2.65,.05)),metal);edge.position.x=-s*.51;d.add(edge);d.position.set(s*(open?1.57:.54),1.36,-1.6);doors.push({root:d,side:s});}
    label('FANTAZIA  /  01',0,2.35,1.55,1.55,.28);
    box(.3,.52,.05,.82,1.48,1.54,black);box(.08,.08,.025,.82,1.48,1.50,light);
    for(let i=0;i<6;i++)box(.24,.016,.025,.82,2.12+i*.035,1.52,metal);
    const button=box(.025,.09,.09,-1.065,1.34,-.1,light);
    box(.035,.42,.26,-1.085,1.34,-.1,black);
    root.userData.floor=floor;root.userData.doors=doors;
    return {root,floor,doors,shards,button};
  }
  function sky(root,resources){
    const landing=new THREE.Group();root.add(landing);landing.name='Public glass-lift landing';
    const {mat,box,label}=kit(landing,resources);
    const stone=mat(0x3b4355),wall=mat(0x9298a8),trim=mat(0x202b3c),light=mat(0xc9e7ff,{emissive:0x7baeff,emissiveIntensity:.6});
    box(18.8,.18,13.6,18,-2.1,24.3,stone);
    box(18.8,.18,13.6,18,2.05,24.3,trim);
    for(const x of [8.6,27.4])box(.18,4.2,13.6,x,0,24.3,wall);
    box(18.8,4.2,.18,18,0,31.1,wall);
    for(const x of [12.05,23.95])box(6.7,4.2,.18,x,0,17.5,wall);
    for(let i=0;i<5;i++){
      const x=11.2+i*3.4,c=cabin(landing,resources);c.root.position.set(x,-2,28.7);c.root.name='Public glass elevator '+(i+1);
      label('0'+(i+1)+'  /  ГОРОД',x,1.18,27.01,2.2,.32);
      box(.9,2.9,.18,x+1.65,-.5,27.05,trim);
      box(2.4,.045,.12,x,.85,26.8,light);
      box(.12,.02,6,x,-1.98,23.6,light);
    }
    for(const z of [20,24,28])box(14.8,.035,.12,18,1.93,z,light);
    label('ВЫБЕРИТЕ ЛЮБОЙ ЛИФТ',18,.6,17.65,4.8,.36);
    return landing;
  }
  function mist(parent,resources,count=28){
    const cv=document.createElement('canvas');cv.width=cv.height=128;const c=cv.getContext('2d');
    const g=c.createRadialGradient(64,64,3,64,64,62);g.addColorStop(0,'rgba(235,245,255,.75)');g.addColorStop(.45,'rgba(210,228,246,.48)');g.addColorStop(1,'rgba(180,215,240,0)');c.fillStyle=g;c.fillRect(0,0,128,128);
    const map=new THREE.CanvasTexture(cv);resources.add(map);
    const cloudMap=typeof scene!=='undefined'?scene.getObjectByName('sky_cloud_bank')?.material?.map:null;
    const m=new THREE.SpriteMaterial({map:cloudMap||map,color:0xf0f5ff,transparent:true,opacity:.88,depthWrite:false,fog:false});resources.add(m);
    const puffs=[];
    for(let i=0;i<count;i++){const p=new THREE.Sprite(m),a=i*2.39996,r=15+i%4*9;p.position.set(Math.cos(a)*r,-15+i*1.8,Math.sin(a)*r);p.scale.set(10+i%3*6,7+i%4*2,1);p.userData.y=p.position.y;parent.add(p);puffs.push(p);}
    return puffs;
  }
  function ride(resources){
    const world=new THREE.Scene();world.background=new THREE.Color(0x7597bf);world.fog=new THREE.Fog(0x9fb8d7,25,110);
    world.add(new THREE.HemisphereLight(0xe5efff,0x526481,1.15));const sun=new THREE.DirectionalLight(0xffe6c7,.9);sun.position.set(-4,8,2);world.add(sun);
    const lift=cabin(world,resources,false),puffs=mist(world,resources,matchMedia('(pointer:coarse)').matches?20:32);
    const guides=new THREE.Group();guides.name='Fixed lift guide rails';
    const {mat,box}=kit(guides,resources),steel=mat(0x47536c,{metalness:.65,roughness:.3});
    for(const x of [-1.3,1.3])for(const z of [-1.76,1.76])box(.07,380,.07,x,180,z,steel);
    for(const y of [-9,369])box(2.8,.18,3.65,0,y,0,steel);
    return {world,lift,puffs,guides};
  }
  function prologue(resources){
    const world=new THREE.Scene();world.background=new THREE.Color(0x162132);world.fog=new THREE.Fog(0x162132,12,72);
    const hemi=new THREE.HemisphereLight(0x8297b7,0x252538,.85);world.add(hemi);
    const moon=new THREE.DirectionalLight(0xb2c8e2,1.1);moon.position.set(-5,12,-7);world.add(moon);
    const street=new THREE.Group(),funeral=new THREE.Group();world.add(street,funeral);funeral.visible=false;
    const {own,mat,box,label}=kit(street,resources);
    const asphalt=mat(0x141d29,{roughness:.19,metalness:.25}),pavement=mat(0x53566b),paint=mat(0xc6ced7,{roughness:.32}),glow=mat(0xffbd79,{emissive:0xff994c,emissiveIntensity:1.5});
    box(90,.1,12,0,-.07,0,asphalt);
    for(const z of [-8,8]){box(90,.24,4,0,0,z,pavement);box(90,.08,.2,0,.16,z-Math.sign(z)*1.8,paint);}
    for(let i=0;i<12;i++)box(3,.012,.52,0,.006,-5.3+i*.95,paint);
    for(let i=-6;i<=6;i++)if(Math.abs(i)>0)box(2.8,.015,.08,i*6,.02,0,paint);
    const dark=mat(0x1b2332),windowMat=mat(0x968474,{emissive:0xffbd79,emissiveIntensity:.3});
    for(const side of [-1,1])for(let i=-4;i<=4;i++){
      const h=8+(i*i%4)*3,x=i*10,z=side*19;box(8.5,h,10,x,h/2,z,dark);
      for(let row=0;row<Math.floor(h/2.5);row++)for(let col=0;col<3;col++)box(1.05,1.35,.03,x-2.7+col*2.7,1.7+row*2.5,z-side*5.02,(row+col+i)%3?windowMat:asphalt);
    }
    for(const x of [-17,-5,8,23])for(const z of [-7,7]){
      box(.12,5,.12,x,2.5,z,paint);box(.8,.14,.45,x,5,z,glow);
      const l=new THREE.PointLight(0xffbb75,1.5,14,2);l.position.set(x,4.7,z);street.add(l);
      // Wet-road light pools: no screen-space reflection / extra render pass.
      const m=own(new THREE.MeshBasicMaterial({color:0xe8a869,transparent:true,opacity:.07,depthWrite:false}));
      const pool=new THREE.Mesh(own(new THREE.CircleGeometry(2.6,24)),m);pool.rotation.x=-Math.PI/2;pool.scale.y=1.8;pool.position.set(x,.025,z*.65);street.add(pool);
    }
    for(const z of [-6.5,6.5]){box(.1,2.8,.1,2,1.4,z,paint);box(.5,.85,.22,2,2.3,z,dark);box(.15,.15,.025,2,2.5,z-Math.sign(z)*.13,mat(0x7be0ba,{emissive:0x4bdba6,emissiveIntensity:1.3}));}
    label('ПЕШЕХОДНЫЙ ПЕРЕХОД',-3,2.7,6.5,3,.4);
    const car=new THREE.Group();car.name='Story collision car';street.add(car);car.rotation.y=Math.PI/2;
    const ck=kit(car,resources),body=ck.mat(0x293b59,{metalness:.55,roughness:.24}),rubber=ck.mat(0x10121a),glass=ck.mat(0x27384a,{metalness:.5,roughness:.12});
    ck.box(1.85,.62,4.3,0,.65,0,body);ck.box(1.6,.62,2.1,0,1.25,-.2,glass);ck.box(1.72,.12,2.2,0,1.6,-.2,body);
    ck.box(1.9,.2,.15,0,.55,2.2,paint);
    for(const x of [-.68,.68]){ck.box(.44,.24,.05,x,.91,2.19,glow);const l=new THREE.SpotLight(0xffedcb,3.2,34,.3,.6,1);l.position.set(x,.95,2.2);l.target.position.set(x,.1,28);car.add(l,l.target);}
    // Body details stay in the same owned set, with no external model/load.
    ck.box(1.64,.10,1.2,0,1.02,1.52,body); // hood
    for(const x of [-1,1]){
      ck.box(.23,.14,.3,x,1.25,.65,body); // mirrors
      ck.box(.035,.06,.23,x*.94,.93,-.45,paint);
    }
    const screen=ck.box(1.48,.5,.055,0,1.3,.86,glass);screen.rotation.x=-.32;
    for(let i=-3;i<=3;i++)ck.box(.12,.17,.03,i*.17,.63,2.285,rubber);
    ck.box(.52,.12,.035,0,.44,2.29,paint);
    const wheels=[];
    for(const x of [-.94,.94])for(const z of [-1.35,1.35]){
      const axle=new THREE.Group();axle.position.set(x,.38,z);axle.rotation.z=Math.PI/2;car.add(axle);
      const spin=new THREE.Group();axle.add(spin);wheels.push(spin);
      spin.add(new THREE.Mesh(own(new THREE.CylinderGeometry(.38,.38,.22,20)),rubber));
      for(let i=0;i<5;i++){const spoke=new THREE.Mesh(own(new THREE.BoxGeometry(.56,.24,.035)),paint);spoke.rotation.y=i*Math.PI/5;spin.add(spoke);}
    }
    const sprayGeometry=own(new THREE.BufferGeometry()),sprayPositions=new Float32Array(96*3);sprayGeometry.setAttribute('position',new THREE.BufferAttribute(sprayPositions,3));
    const spray=new THREE.Points(sprayGeometry,own(new THREE.PointsMaterial({color:0xa4c5da,size:.065,transparent:true,opacity:.45,depthWrite:false})));spray.frustumCulled=false;street.add(spray);

    const fk=kit(funeral,resources),soil=fk.mat(0x242c2b),stone=fk.mat(0x667078),wood=fk.mat(0x30232b,{roughness:.4}),white=fk.mat(0xe8e0df);
    fk.box(160,.15,160,0,-.13,0,soil);fk.box(1.55,.18,2.9,0,.02,0,stone);
    const outline=new THREE.Shape();[[-.34,-1.1],[.34,-1.1],[.5,-.65],[.40,1.1],[-.40,1.1],[-.5,-.65]].forEach(([x,y],i)=>i?outline.lineTo(x,y):outline.moveTo(x,y));outline.closePath();
    for(const [depth,y] of [[.42,.12],[.055,.56]]){const casket=new THREE.Mesh(own(new THREE.ExtrudeGeometry(outline,{depth,bevelEnabled:true,bevelThickness:.018,bevelSize:.018,bevelSegments:2,steps:1})),wood);casket.rotation.x=-Math.PI/2;casket.position.y=y;funeral.add(casket);}
    const faceLight=new THREE.DirectionalLight(0xd2dae0,.8);faceLight.position.set(3,5,6);funeral.add(faceLight);
    const treeBark=fk.mat(0x252c2e),treeLeaves=fk.mat(0x172b29);
    for(let i=0;i<30;i++){const a=i*2.39996,r=11+i%4*4,x=Math.cos(a)*r,z=Math.sin(a)*r,h=7+i%5;
      const trunk=new THREE.Mesh(own(new THREE.CylinderGeometry(.16,.28,h,7)),treeBark);trunk.position.set(x,h/2,z);funeral.add(trunk);
      for(let k=0;k<3;k++){const crown=new THREE.Mesh(own(new THREE.ConeGeometry(2.1-k*.4,4,9)),treeLeaves);crown.position.set(x,h-2+k*1.2,z);funeral.add(crown);}
    }
    for(const z of [-.65,.65])for(const x of [-.47,.47])fk.box(.04,.04,.3,x,.34,z,glow);
    for(let i=0;i<13;i++){const flower=new THREE.Mesh(own(new THREE.SphereGeometry(.065,6,5)),i%3?white:fk.mat(0xa9495b));flower.position.set(Math.sin(i*2.4)*.27,.68,Math.cos(i*2.4)*.65);funeral.add(flower);}
    for(let i=0;i<9;i++){const x=(i%3-1)*5,z=5+Math.floor(i/3)*5;fk.box(.9,1.25,.2,x,.6,z,stone);fk.box(1.3,.12,.65,x,.02,z,stone);}
    const actors=[];
    for(let i=0;i<5;i++){
      const actor=FZHumans31.create(resources,i);
      actor.position.set(i<3?-2.1:2.1,0,(i%3-1)*1.6);
      actor.rotation.y=i<3?Math.PI/2:i===3?-1.25:-Math.PI/2;actor.userData.restYaw=actor.rotation.y;
      funeral.add(actor);actors.push(actor);
    }
    const count=matchMedia('(pointer:coarse)').matches?280:550,positions=new Float32Array(count*6);
    for(let i=0;i<count;i++){const x=Math.sin(i*78.233)*18,z=Math.sin(i*31.571)*18,y=(i%97)/97*11;positions.set([x,y,z,x-.035,y-.32,z],i*6);}
    const rg=own(new THREE.BufferGeometry());rg.setAttribute('position',new THREE.BufferAttribute(positions,3));const rain=new THREE.LineSegments(rg,own(new THREE.LineBasicMaterial({color:0xa5c4e3,transparent:true,opacity:.32})));world.add(rain);
    return {world,street,funeral,car,rain,hemi,moon,actors,wheels,spray};
  }
  window.FZStory30Sets={sky,ride,prologue,cabin};
})();
