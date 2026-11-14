const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),acorn=require('acorn');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const P=require('../public/assets/fz-story30-policy'),S=require('../public/assets/fz-sky-policy'),M=require('../public/assets/fz-metro-policy'),O=require('../public/assets/fz-opening-plan');
assert.equal(O.duration,10);assert.equal(P.lifts.length,5);
// Every cabin is publicly reachable, across the same geometry/server boundaries.
for(const lift of P.lifts){
 const points=[[18,S.deck.z+8.1],[18,S.deck.z+20],[lift.x,S.deck.z+20],[lift.x,lift.z]];
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.1));for(let j=0;j<=n;j++){
  const x=a[0]+(b[0]-a[0])*j/n,z=a[1]+(b[1]-a[1])*j/n;
  assert(!S.blocked(x,z,false),JSON.stringify({x,z}));
  const p={x,y:S.ground(x,z,false),z};assert.deepEqual(S.position(p,S.spawn,false),p);
 }}
 assert(P.canBoard(lift));
}
const time=id=>P.ride.find(s=>s[0]===id)[1];assert(time('clouds')<time('city'));assert(time('city')<time('welcome'));assert(time('welcome')<time('narrated-ride'));assert(time('fall')<time('blackout'));assert(time('blackout')<time('forest'));
const forest=M.stations.findIndex(s=>s.id==='forest');assert(M.storyTrip(forest,true));assert(!M.storyTrip(forest,false));for(let i=0;i<forest;i++)assert(!M.storyTrip(i,true));
assert.deepEqual(M.advance('broken',10,.1),{state:'broken',elapsed:10.1,changed:false});
for(const open of [false,true])assert(!M.escapeBlocked(0,-4,open));assert(M.escapeBlocked(0,-1.7,false));
const route=[[0,-4],[0,1],[55,1],[55,28]];
for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*20);for(let j=0;j<=n;j++)assert(!M.escapeBlocked(a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n,true));}
for(const [x,z] of [[-14,1],[58,1],[40,5],[0,15],[52,28]])assert(M.escapeBlocked(x,z,true));
assert.equal(M.escapeGround(1),-8);assert.equal(M.escapeGround(27),0);let last=-8;for(let z=3;z<29;z+=.1){const y=M.escapeGround(z);assert(y>=last&&y<=0);last=y;}
for(const f of ['fz-humans31','fz-story30','fz-story30-sets','fz-story30-forest','fz-metro','fz-sky','fz-sky-garden']){const code=read('public/assets/'+f+'.js');acorn.parse(code,{ecmaVersion:'latest'});assert(!/requestAnimationFrame|setInterval\s*\(/.test(code));}
assert(!read('public/assets/fz-story30-sets.js').includes('SuperRig'),'funeral never clones gameplay avatars');
assert.match(read('public/assets/licenses/human31-license.txt'),/Lee Perry-Smith.*Creative Commons Attribution 3.0/);
const b=fs.readFileSync(path.join(root,'public/assets/models/human31.glb'));assert.equal(b.readUInt32LE(0),0x46546c67);assert.equal(b.readUInt32LE(8),b.length);
const gltf=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));assert(gltf.accessors[gltf.meshes[0].primitives[0].attributes.POSITION].count>5000,'actual detailed scan, not placeholder boxes');
for(const f of ['human31-color.jpg','human31-normal.jpg'])assert(fs.statSync(path.join(root,'public/assets/models',f)).size>100000);
console.log('PASS cinematic31: 10-second opening, all five public lift routes, ordered city/title/voice phases, licensed detailed human scan, isolated one-shot breakdown, continuous emergency exit/ground and native-loop ownership.');
