const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),acorn=require('acorn');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const P=require('../public/assets/fz-story30-policy'),S=require('../public/assets/fz-sky-policy');
for(const kind of ['opening','ride']){
 const phases=P[kind];assert.equal(phases[0][1],0);assert.equal(phases.at(-1)[2],P.duration(kind));
 for(let i=1;i<phases.length;i++)assert.equal(phases[i-1][2],phases[i][1]);
 for(let t=0;t<P.duration(kind);t+=.017){const p=P.at(kind,t);assert(t>=p[1]&&t<p[2]);}
}
assert.deepEqual(P.opening.map(p=>p[0]),['rain','crossing','impact','funeral','awakening']);
assert.deepEqual(P.ride.map(p=>p[0]),['press','doors','clouds','city','welcome','narrated-ride','collapse','fall','blackout','dream-title','forest']);
for(const lift of P.lifts){
 assert(P.canBoard(lift));assert(!S.blocked(lift.x,lift.z,false));assert.equal(S.ground(lift.x,lift.z,false),lift.y);
 assert.deepEqual(S.position(lift,S.spawn,false),lift,'public server position remains legal');
 assert(!P.canBoard({...lift,y:lift.y+1}));
}
for(const invalid of [null,{},P.forest,S.spawn,{x:NaN,y:358,z:-1379.8},{x:18,y:358,z:-1379.8}])assert(!P.canBoard(invalid));
assert(S.blocked(12.3,-1371.3,false),'cabin side wall blocks crossing between cabins');
assert(S.blocked(11.2,-1369.2,false),'rear glass is solid');
assert(S.blocked(0,-1417,false));assert(!S.blocked(0,-1417,true),'stage-only admin policy preserved');
for(let z=-1391.9;z<-1382.5;z+=.1){assert(!S.blocked(18,z,false));assert(S.ground(18,z,false)<=360&&S.ground(18,z,false)>=358);}
assert.equal(P.smooth(NaN),0);assert.equal(P.smooth(-1),0);assert.equal(P.smooth(2),1);
for(const file of ['fz-story30-policy','fz-hands30','fz-story30-sets','fz-story30-forest','fz-story30']){
 const code=read('public/assets/'+file+'.js');acorn.parse(code,{ecmaVersion:'latest'});
 assert(!/requestAnimationFrame|setInterval\s*\(/.test(code),'no competing loops: '+file);
}
const html=read('public/index.html'),story=read('public/assets/fz-story30.js'),sky=read('public/assets/fz-sky.js');
assert(!html.includes('id="welcomeOverlay"'));assert(!html.includes('startWelcomeAnim('));
assert(html.includes('window.FZStory30?.arm()'));assert(html.includes('window.FZStory30?.frame(delta)'));
assert(!sky.includes('fzSkyWhite'));assert(sky.includes('FZStory30?.board(onArrival)'));
assert(story.includes("voice('awakening','Где я?..')"));assert(story.includes("voice('elevator-welcome','Добро пожаловать в Фантазию РП!')"));
assert(story.includes("resources.forEach(r=>r.dispose?.())"));assert(story.includes("document.addEventListener('visibilitychange',()=>{clearWalk();soundFrame();})"));
assert(!story.includes('localStorage'),'story is not silently bypassed by old account flags');
assert(read('public/assets/fz-front.js').includes('fantazia-logo-cutout.png'),'original user splash replaces pre-login 3D opening');
const bytes=fs.readFileSync(path.join(root,'public/assets/models/story-hands30.glb'));
assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(8),bytes.length);
const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
assert.equal(gltf.asset.extras.fingerJoints,30);assert.equal(gltf.asset.extras.triangles,352,'body/accessory/sword triangles excluded');
assert.equal(gltf.nodes.filter(n=>/Proximal|Intermediate|Distal/.test(n.name)).length,30);
assert(!gltf.meshes[0].primitives[0].targets,'no facial/accessory morph work in view model');
for(const f of ['awakening','elevator-welcome'])assert(fs.statSync(path.join(root,'public/audio/story30/'+f+'.mp3')).size>1000);
console.log('PASS story30: timeline boundaries, public boarding/proximity, shared stair/cabin walls and ground, stage access retained, 30-joint/352-triangle hands without gear, voice assets, single native loop, retired welcome and explicit resource lifecycle.');
