'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const THREE=require('three'),acorn=require('acorn');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const motion=require('../public/assets/fz-motion'),policy=require('../public/assets/fz-play-policy');
const near=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
// Constant-time settling must be identical at 30/60/144 Hz, not merely look smoother at high FPS.
for(const fps of [30,60,144]){
 let position=0;for(let i=0;i<fps;i++)position+=(10-position)*motion.blend(.15,1/fps);
 near(position,10*(1-Math.pow(.85,60)));
}
assert.equal(motion.blend(.15,NaN),0);assert.equal(motion.blend(.15,-1),0);
assert(motion.blend(.15,20)<1);
const tiny=new policy.Resolution(.5,30);for(let i=0;i<60;i++)tiny.observeFPS(1);
assert.equal(tiny.ratio,.5,'adaptive quality cannot exceed an explicitly selected 50% maximum');
const invalid=new policy.Resolution(NaN,Infinity);assert.equal(invalid.ratio,1);assert.equal(invalid.target,60);

let now=0;
const context=vm.createContext({THREE,performance:{now:()=>now},localStorage:{getItem:()=>null},
 document:{readyState:'loading',addEventListener(){}},addEventListener(){},setTimeout(){},console});
context.window=context;
vm.runInContext(read('public/assets/superrig-player.js'),context);
const SR=context.SuperRig;SR.face=()=>{};
function character(){
 const ch=new THREE.Group(),mixer=new THREE.AnimationMixer(ch),actions={};
 for(const name of ['ANIM_Idle_Loop','ANIM_Walk_Loop','ANIM_Defeat']) {
  const clip=new THREE.AnimationClip(name,.2,[new THREE.NumberKeyframeTrack('.rotation[x]',[0,.2],[0,.1])]);
  actions[name]=mixer.clipAction(clip);
 }
 ch.userData={mixer,actions,_srPos:{x:0,z:0}};return ch;
}
const ch=character();let finished=0;ch.userData.mixer.addEventListener('finished',()=>finished++);
for(let i=0;i<120;i++){now+=1000/60;SR.animate(ch,'death',1/60);}
assert.equal(finished,1,'a held one-shot is not restarted every time its mixer completes');
near(ch.userData.curAnim.time,.2);
SR.animate(ch,'idle',1/60);for(let i=0;i<30;i++)SR.animate(ch,'death',1/60);
assert.equal(finished,2,'leaving and re-entering a state can play the one-shot again');
const speeds=[];
for(const fps of [30,60,144]){
 const c=character();for(let i=0;i<fps;i++){c.position.x+=3/fps;now+=1000/fps;SR.animate(c,'walk',1/fps);}
 speeds.push(c.userData._srSpeed);
 c.position.x+=1000;SR.animate(c,'walk',1/fps);assert.equal(c.userData._srSpeed,0);
 assert(c.userData._refWalk<4,'teleports must not redefine the walking reference speed');
 let delta;c.userData.mixer.update=d=>{delta=d;};SR.animate(c,'walk',100);assert.equal(delta,.05);
}
near(speeds[0],speeds[1]);near(speeds[1],speeds[2]);

const functions=new Map();
for(const match of read('public/index.html').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)){
 for(const n of acorn.parse(match[1],{ecmaVersion:'latest'}).body)
  if(n.type==='FunctionDeclaration')functions.set(n.id.name,match[1].slice(n.start,n.end));
}
const textures=[new THREE.Texture(),new THREE.Texture(),new THREE.Texture()];
const materials=[{map:textures[0],normalMap:textures[1]},{map:textures[0],roughnessMap:textures[2]}];
const renderer={capabilities:{getMaxAnisotropy:()=>8},domElement:{style:{},parentNode:{replaceChild(){}}},dispose(){}};
const renderContext=vm.createContext({THREE:{...THREE,WebGLRenderer:class{
 constructor(){this.domElement={style:{}};this.shadowMap={};}setSize(){}setPixelRatio(){}
}},window:{innerWidth:800,innerHeight:600},document:{getElementById:()=>null},
 SETTINGS:{aniso:4,texFilter:'linear',toneMap:'none',renderScale:1,shadowQuality:'off',exposure:9},renderer,
 scene:{traverse(fn){fn({material:materials});fn({material:materials[0]});fn({});}}});
vm.runInContext(functions.get('applySetting')+'\n'+functions.get('applyAntialiasing'),renderContext);
renderContext.applySetting('aniso',16);
for(const t of textures){assert.equal(t.anisotropy,8);assert.equal(t.version,1,'shared texture uploaded once');}
renderContext.applySetting('texFilter','nearest');for(const t of textures)assert.equal(t.magFilter,THREE.NearestFilter);
renderContext.applyAntialiasing();assert.equal(renderContext.renderer.toneMapping,THREE.NoToneMapping);
console.log('PASS quality46: real AnimationMixer one-shots, 30/60/144 Hz equivalence, teleport/delta guards, adaptive bounds, multi-material texture filtering and NoToneMapping restoration');
