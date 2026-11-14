'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const THREE=require('three'),root=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'public/assets/fz-humans31.js'),'utf8');
const manifest=require('../public/assets/models/funeral51/manifest.json');
function glb(id){const bytes=fs.readFileSync(path.join(root,'public/assets/models/funeral51',id+'.glb'));assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(8),bytes.length);const length=bytes.readUInt32LE(12);return {bytes,json:JSON.parse(bytes.subarray(20,20+length)),bin:bytes.subarray(28+length)};}
function values(g,id){const a=g.json.accessors[id],v=g.json.bufferViews[a.bufferView],start=(v.byteOffset||0)+(a.byteOffset||0),n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],size={5126:4,5125:4,5123:2}[a.componentType],out=[];for(let i=0;i<a.count*n;i++)out.push(a.componentType===5126?g.bin.readFloatLE(start+i*size):a.componentType===5125?g.bin.readUInt32LE(start+i*size):g.bin.readUInt16LE(start+i*size));return out;}
for(const profile of manifest.cast)test('complete dressed GLB / '+profile.id,()=>{
 const g=glb(profile.id),j=g.json;assert.equal(g.bytes.length,profile.bytes);assert.equal(j.meshes.length,5);assert.equal(j.skins[0].joints.length,163);
 assert(j.materials.some(m=>m.name.includes('elegantsuit')));assert(j.materials.some(m=>m.name.includes('shoes')));
 const eye=j.materials.find(m=>m.name==='Eyes');assert.equal(eye.alphaMode,'MASK','transparent corneal shell must not hide iris');
 const names=j.nodes.map(n=>n.name);for(const n of ['head','spine02','upperarm01_L','finger5-3_R','foot_L'])assert(names.includes(n));
 // Every joint reachable exactly once; non-topological source bone order is safe.
 const seen=new Set();function walk(i){assert(!seen.has(i),'node duplicated/cycle');seen.add(i);for(const child of j.nodes[i].children||[])walk(child);}for(const node of j.scenes[0].nodes)walk(node);assert.equal(seen.size,j.nodes.length);
 let triangles=0;
 for(const mesh of j.meshes){const p=mesh.primitives[0],pos=values(g,p.attributes.POSITION),normal=values(g,p.attributes.NORMAL),w=values(g,p.attributes.WEIGHTS_0),joint=values(g,p.attributes.JOINTS_0),idx=values(g,p.indices);assert(pos.every(Number.isFinite));assert(normal.every(Number.isFinite));assert(idx.every(v=>v<pos.length/3));assert(joint.every(v=>v<163));assert(w.every(v=>v>=0&&v<=1));for(let i=0;i<w.length;i+=4)assert(Math.abs(w[i]+w[i+1]+w[i+2]+w[i+3]-1)<1e-5);triangles+=idx.length/3;}
 assert.equal(triangles,profile.triangles);assert(triangles<45000);
 // GLBs embed their own textures: no CDN, credential or cross-origin dependency.
 for(const image of j.images){assert.equal(image.mimeType,'image/png');assert.equal(image.uri,undefined);}
});
test('five different anatomies, bounded transfer budget and retained original asset',()=>{
 const hashes=manifest.cast.map(p=>{const g=glb(p.id),a=g.json.meshes[0].primitives[0].attributes.POSITION;return crypto.createHash('sha256').update(JSON.stringify(values(g,a))).digest('hex');});assert.equal(new Set(hashes).size,5);assert(manifest.cast.reduce((n,p)=>n+p.bytes,0)<15e6);assert(fs.existsSync(path.join(root,'public/assets/models/human31.glb')));
});
function sandbox(fetch,Loader){const timers=new Map();let id=0;const c={THREE:{...THREE,GLTFLoader:Loader},fetch,AbortController,console:{warn(){}},setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:n=>timers.delete(n),FZCinematic32:require('../public/assets/fz-cinematic32')};c.window=c;vm.createContext(c);vm.runInContext(code,c);return {api:c.FZHumans31,timers};}
function sample(){const scene=new THREE.Group();scene.add(new THREE.SkinnedMesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial()));return scene;}
test('single-flight preload; five local files; no player-avatar or old scan fetch',async()=>{
 const urls=[];const {api,timers}=sandbox(async url=>{urls.push(url);return {ok:true,arrayBuffer:async()=>new ArrayBuffer(0)};},class{parse(b,p,ok){ok({scene:sample()});}});
 const first=api.load();assert.equal(first,api.load());assert.equal(api.ready(),false);await first;assert.equal(api.ready(),true);assert.equal(api.info().loadedCount,5);assert.equal(urls.length,5);assert(urls.every(u=>/^assets\/models\/funeral51\/[a-z]+\.glb$/.test(u)));assert.equal(timers.size,0);
});
test('HTTP/corrupt failures settle and keep fallback fully dressed',async()=>{
 const {api,timers}=sandbox(async url=>({ok:!url.includes('father'),status:404,arrayBuffer:async()=>new ArrayBuffer(0)}),class{parse(b,p,ok,no){no(Error('invalid GLB'));}});await api.load();assert(api.ready());assert.equal(api.info().loadedCount,0);assert.match(api.info().error,/HTTP 404/);const owned=new Set(),a=api.create(owned,0);assert(a.userData.fallback51);assert(owned.size>5);api.animate([a],1);owned.forEach(o=>o.dispose());assert.equal(timers.size,0);
});
test('deadline unblocks opening; late parse releases assets and does not hot-swap actors',async()=>{
 const callbacks=[];let disposed=0;const {api,timers}=sandbox(async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(0)}),class{parse(b,p,ok){callbacks.push(ok);}});const promise=api.load();await new Promise(resolve=>setImmediate(resolve));assert.equal(callbacks.length,5);for(const fn of [...timers.values()])fn();await promise;assert(api.ready());assert.equal(api.info().loaded,false);
 for(const cb of callbacks){const scene=sample();scene.traverse(o=>{if(o.geometry)o.geometry.addEventListener('dispose',()=>disposed++);if(o.material)o.material.addEventListener('dispose',()=>disposed++);});cb({scene});}
 await Promise.resolve();assert.equal(disposed,10);assert.equal(api.info().loadedCount,0);
});
test('no private render loop; staging changes retain coffin and timeline entry points',()=>{
 assert(!/requestAnimationFrame|setInterval\s*\(/.test(code));const sets=fs.readFileSync(path.join(root,'public/assets/fz-story30-sets.js'),'utf8');assert(!sets.includes('SuperRig'));assert.match(sets,/FZHumans31.create\(resources,i\)/);assert.match(sets,/contact\(actor.position.x/);
});
test('editable source archive matches every input digest and current builder',()=>{
 const source=path.join(root,'public/assets/licenses'),tar=require('node:zlib').gunzipSync(fs.readFileSync(path.join(source,'funeral51-source.tar.gz'))),entries=new Map();
 for(let p=0;p+512<tar.length;){const name=tar.subarray(p,p+100).toString().replace(/\0.*$/s,'');if(!name)break;assert(!name.includes('..')&&!name.startsWith('/'));const size=parseInt(tar.subarray(p+124,p+136).toString().replace(/\0/g,'').trim(),8);entries.set(name,tar.subarray(p+512,p+512+size));p+=512+Math.ceil(size/512)*512;}
 const inputs=JSON.parse(fs.readFileSync(path.join(source,'funeral51-inputs.json'),'utf8'));
 for(const input of inputs){const data=entries.get(input.path);assert(data,input.path);assert.equal(data.length,input.bytes);assert.equal(crypto.createHash('sha256').update(data).digest('hex'),input.sha256);}
 assert(entries.get('tools/build-funeral51.py').equals(fs.readFileSync(path.join(root,'tools/build-funeral51.py'))));
 assert.match(entries.get('assets/LICENSE').toString(),/GNU AFFERO GENERAL PUBLIC LICENSE/);assert.match(entries.get('core/LICENSE.ASSETS.md').toString(),/CC0/);
});
test('native preload finishes before CPU-heavy city construction; seen stories bypass it',async()=>{
 const front=fs.readFileSync(path.join(root,'public/assets/fz-front.js'),'utf8'),a=front.indexOf(' async function prepareGame(){'),b=front.indexOf('\n window.fzIntroEnd',a);
 for(const pending of [true,false]){
  let resolve,loads=0,builds=0;const ready=new Promise(r=>resolve=r),c={finish(){},ensureWorld:async()=>{builds++;},renderer:{getContext:()=>({isContextLost:()=>false})},cityWorldReady:()=>true,FZStory30:{info:()=>({pending})},FZHumans31:{load:()=>{loads++;return ready;}}};c.window=c;vm.createContext(c);vm.runInContext(front.slice(a,b),c);const result=c.prepareGame();await Promise.resolve();assert.equal(loads,pending?1:0);assert.equal(builds,pending?0:1);resolve();await result;assert.equal(builds,1);
 }
});
test('funeral color output is sRGB only for its pass and restored even on renderer failure',()=>{
 const c={THREE};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'public/assets/fz-story30-sets.js'),'utf8'),c);
 for(const throws of [false,true]){const r={outputEncoding:THREE.LinearEncoding,render(){assert.equal(this.outputEncoding,THREE.sRGBEncoding);if(throws)throw Error('GPU lost');}};
  if(throws)assert.throws(()=>c.FZStory30Sets.renderFuneral(r,{},{}),/GPU lost/);else c.FZStory30Sets.renderFuneral(r,{},{});assert.equal(r.outputEncoding,THREE.LinearEncoding);
 }
});
