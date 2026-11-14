const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),acorn=require('acorn'),THREE=require('three');
const C=require('../public/assets/fz-cinematic32');
const keys=[[0,30],[2.25,30],[4.5,5],[6.6,-4],[7,-4]];
let last=Infinity;
for(let t=-1;t<8;t+=.005){const z=C.track(keys,t);assert(Number.isFinite(z));assert(z<=last+1e-10&&z>=-4&&z<=30);last=z;}
for(const t of [2.25,4.5,6.6]){const e=1e-5,left=(C.track(keys,t)-C.track(keys,t-e))/e,right=(C.track(keys,t+e)-C.track(keys,t))/e;assert(Math.abs(left-right)<.002,'continuous velocity at '+t);}
assert(C.track(keys,4.49)>C.track(keys,4.51),'no artificial stop at the letter approach');
for(const a of [0,.45,1])for(const b of [0,.45,1])for(let t=0;t<=1;t+=.01){const n=C.travel(t,a,b);assert(n>=-1e-10&&n<=1+1e-10);}
assert.equal(C.impulse(-1),0);assert(Math.abs(C.impulse(5))<1e-8);
for(let t=0;t<6;t+=.01){const shot=C.funeral(t);assert([...shot.position,...shot.look,shot.roll,shot.fov].every(Number.isFinite));assert.equal(C.funeral(t,true).roll,0);assert(C.recovery(t).height>=.35&&C.recovery(t).height<=1.62);}
// Actual cabin geometry: thick fragments cover the complete original floor,
// individual pivots are their own centroids, cracks precede ballistic separation.
const context={THREE,console,FZCinematic32:C,document:{createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},fillText(){}})})}};
context.window=context;vm.createContext(context);
vm.runInContext(fs.readFileSync('../public/assets/fz-story30-sets.js','utf8'),context);
const resources=new Set(),scene=new THREE.Scene(),lift=context.FZStory30Sets.cabin(scene,resources);
assert.equal(lift.shards.length,24);let area=0;
for(const [i,s] of lift.shards.entries()){
 assert.equal(s.userData.crackLine.visible,false,'hidden crack lines do not draw in parked cabins');
 const g=s.geometry,p=g.attributes.position,n=g.attributes.normal,idx=g.index?.array||Array.from({length:p.count},(_,i)=>i);
 for(let j=0;j<idx.length;j+=3){const ids=[idx[j],idx[j+1],idx[j+2]];if(ids.every(i=>n.getY(i)>.99)){const [a,b,c]=ids.map(i=>[p.getX(i),p.getZ(i)]);area+=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;}}
 const h=Array.from(s.userData.home);assert.deepEqual(s.position.toArray(),h);assert.deepEqual(C.shard(23,i,h).position,h);
 assert(C.shard(26,i,h).position[1]<h[1]);assert(C.shard(24.3,i,h).crack>0);assert.equal(C.shard(23,i,h).crack,0);
}
assert(Math.abs(area-2.2*3.2)<1e-5,'no missing patches or overlapping floor panels');
resources.forEach(r=>r.dispose());
// Real actor hierarchy, with a geometry-only fallback face in this unit test.
vm.runInContext(fs.readFileSync('../public/assets/fz-humans31.js','utf8'),context);
const owned=new Set(),actors=Array.from({length:5},(_,i)=>context.FZHumans31.create(owned,i));
actors.forEach(a=>{a.rotation.y=a.userData.restYaw=-Math.PI/2;a.updateMatrixWorld(true);});
const footObjects=actors.map(a=>a.children.filter(o=>o.isMesh&&Math.abs(o.position.y-.06)<1e-9));
const feet=footObjects.map(list=>list.map(o=>o.getWorldPosition(new THREE.Vector3())));
for(let t=0;t<=6;t+=.05){context.FZHumans31.animate(actors,t);actors.forEach((a,i)=>{a.updateMatrixWorld(true);footObjects[i].forEach((o,j)=>assert(o.getWorldPosition(new THREE.Vector3()).distanceTo(feet[i][j])<1e-10,'planted funeral feet'));});}
context.FZHumans31.animate(actors,2.9);assert(actors[3].userData.neck.rotation.y>actors[3].userData.torso.rotation.y,'head leads shoulder turn');owned.forEach(r=>r.dispose());
// Execute the real shared legacy updateCine, not a duplicate implementation.
const html=fs.readFileSync('../public/index.html','utf8');
function fn(name){const a=html.indexOf('function '+name+'('),tail=html.slice(a,html.indexOf('</script>',a)),node=acorn.parse(tail,{ecmaVersion:'latest'}).body[0];return tail.slice(0,node.end);}
const legacy=fn('_cv')+'\n'+fn('updateCine');assert(!legacy.includes('Math.random()'),'no per-frame random camera jitter');
function run(fps,reduced=false){
 let now=0;const camera=new THREE.PerspectiveCamera(68,1.6,.1,1000);
 const ctx={THREE,FZCinematic32:C,camera,localPlayer:null,keys:{},performance:{now:()=>now},document:{getElementById:()=>({style:{}})},FZPlay:{reducedMotion:()=>reduced},updateDoorTween(){},_cineSetText(){}};
 ctx.window=ctx;ctx.cine={steps:[{pos:[4,3,1],look:[0,1,0],dur:2.5,drift:.5}],i:0,t:0,last:0,shake:.06,fovBase:68,from:{pos:new THREE.Vector3(0,2,8),look:new THREE.Vector3(0,1,0)}};vm.createContext(ctx);vm.runInContext(legacy,ctx);
 for(let i=1;i<=fps*1.5;i++){now=i/fps*1000;ctx.updateCine();}
 const point=camera.position.clone();ctx.updateCine();assert(camera.position.distanceTo(point)<1e-12,'zero-delta frame does not jitter');return point;
}
assert(run(60).distanceTo(run(60))<1e-12,'deterministic authored cinematics');assert(run(30).distanceTo(run(60))<.05,'bounded frame-rate sensitivity');run(60,true);
console.log('PASS cinematic32: continuous bounded tracks, real shard coverage/pivots, cracks before gravity, planted feet/head-led acting, deterministic shared legacy camera, pause and 30/60-Hz checks.');
