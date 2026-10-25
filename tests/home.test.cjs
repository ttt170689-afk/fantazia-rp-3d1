// Tests use the actual native enter/build/changeFloor/exit/collision functions,
// with real Three.js geometry and persistent lexical globals (not window mocks).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom'),THREE=require('three'),acorn=require('acorn');
const index=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
const wanted=['enterBuilding','buildInterior','changeFloor','_exitBuildingNow','exitBuilding','checkCollision'];
const funcs={};
for(const m of index.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
  if(!m[1].trim())continue;
  const ast=acorn.parse(m[1],{ecmaVersion:'latest'});
  for(const n of ast.body) if(n.type==='FunctionDeclaration'&&wanted.includes(n.id.name)) funcs[n.id.name]=m[1].slice(n.start,n.end);
}
assert.equal(Object.keys(funcs).length,wanted.length);
const dom=new JSDOM('<body>'+['interiorHUD','buildingLabel','floorIndicator','mallMapBtn'].map(id=>`<div id="${id}"></div>`).join('')+'</body>',{url:'https://fantazia.test',runScripts:'outside-only'});
const w=dom.window,context=dom.getInternalVMContext(); w.THREE=THREE;
w.HTMLCanvasElement.prototype.getContext=function(){return new Proxy({},{get:()=>()=>{}})};
const run=s=>vm.runInContext(s,context);
run(`
const scene=new THREE.Scene(),INTERIOR_BASE={x:2000,z:2000};
let isInsideBuilding=false,currentBuildingType=null,currentBuildingName='',currentFloor=0,maxFloors=0;
let outsidePos={x:0,y:0,z:0},interiorObjects=[],interiorColliders=[],interiorBounds=null,interactables=[],nearestInteractable=null,npcs=[];
let localPlayer={mesh:new THREE.Object3D(),money:10000},velocity={x:0,y:0,z:0};
let isInFactory=false,isInBasement=false,buildings=[],streetColliders=[],basementColliders=[];
const CONFIG={WORLD_SIZE:1200},BASEMENT_BASE={x:0,z:0},FACTORY_BASE={x:0,z:0};
const INTERIOR_CONFIGS={school:{name:'Школа',floors:3},house:{name:'Особняк',floors:2},apartment:{name:'Квартира',floors:3}};
const logs=[];
function showNotification(t){logs.push(t)}
function doorCine(fn){fn()}
localPlayer.mesh.position.set(3020,0,180);
`);
for(const f of wanted)run(funcs[f]);
const code=fs.readFileSync(path.join(__dirname,'../public/assets/fz-v8home.js'),'utf8');
run(code);
const api=w.FZ8B;
function tick(seconds){for(let i=0;i<Math.ceil(seconds/.05);i++)api.update(.05);}
function at(spot){run(`localPlayer.mesh.position.set(${spot.position.x},${spot.position.y},${spot.position.z})`);}
function spots(){return run('interactables.filter(i=>i.fz8b && i.interior)');}
function find(action){return spots().find(s=>s.action===action);}
function use(action){const spot=find(action);assert(spot,action);at(spot);assert.equal(api.interact(spot),true);return spot;}
function blocked(x,z){return run(`checkCollision(${x+2000},${z+2000})`);}
function assertFinite(root){root.traverse(o=>{if(o.isMesh){assert(o.material&&o.material.isMaterial,o.name+' has valid material');for(const v of [...o.position.toArray(),...o.scale.toArray()])assert(Number.isFinite(v));if(o.isInstancedMesh)for(const v of o.instanceMatrix.array)assert(Number.isFinite(v));}});}
function reachable(){
  const bounds=run('interiorBounds'),step=.4,queue=[[0,0]],seen=new Set(['0,0']);let n=0;
  while(n<queue.length){const [ix,iz]=queue[n++];for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=ix+dx,nz=iz+dz,key=nx+','+nz;if(seen.has(key)||Math.abs(nx*step)>bounds.W||Math.abs(nz*step)>bounds.D||blocked(nx*step,nz*step))continue;seen.add(key);queue.push([nx,nz]);}}
  return {step,seen};
}
const report=[];
for(const [type,floors] of [['school',3],['house',2],['apartment',3]]) {
  assert.equal(api.visit(type),true);
  for(let f=0;f<floors;f++) {
    if(f)run('changeFloor(1)');
    const info=api.info();assert.equal(info.floor,f);assert.equal(info.type,type);
    assert.equal(run('interiorObjects.length'),1);assert(!blocked(0,0),'spawn clear');
    assertFinite(run('interiorObjects[0]'));
    const {seen,step}=reachable();
    for(const spot of spots()) {
      const x=spot.position.x-2000,z=spot.position.z-2000;
      assert(!blocked(x,z),`${type}/${f}: blocked action ${spot.action} at ${x},${z}`);
      assert([...seen].some(k=>{const [ix,iz]=k.split(',').map(Number);return Math.hypot(ix*step-x,iz*step-z)<.65;}),`${type}/${f}: unreachable ${spot.name}`);
    }
    let draws=0;run('interiorObjects[0]').traverse(o=>{if(o.isMesh)draws++;});
    report.push({type,floor:f+1,rooms:info.rooms.length,instances:info.instances,draws,colliders:run('interiorColliders.length')});
    // Door blocking, animation, and reopening.
    const door=find('door');at(door);api.interact(door);tick(1);
    assert(blocked(door.position.x-2000,door.position.z>2000?3:-3),'closed door blocks');
    api.interact(door);tick(1);assert(!blocked(door.position.x-2000,door.position.z>2000?3:-3),'open door clear');
  }
  run('_exitBuildingNow()');assert.equal(api.info(),null);assert.equal(run('interiorObjects.length'),0);assert.equal(spots().length,0);assert.equal(run('scene.children.length'),0);
}
// Camera clipping must respect partitions, while the doorway stays open.
api.visit('house');
const testCamera=new THREE.PerspectiveCamera();testCamera.position.set(2004,1.8,1995);
api.constrainCamera(testCamera,new THREE.Vector3(2004,0,2000));
assert(testCamera.position.z>1997,'camera stays in front of corridor wall');
run('_exitBuildingNow()');
// Household tasks: real completion, cancellation, cooldown, persistence.
api.visit('house');
w.FZ8L={S:{vit:{water:40,food:40,energy:40}},save:()=>{}};
use('tea');tick(5.1);assert.equal(api.state().tea,1);assert.equal(w.FZ8L.S.vit.water,40,'optional tea no longer modifies removed needs');
use('tea');tick(5.1);assert.equal(api.state().tea,1,'cooldown prevents spam');
use('bath');tick(6.1);assert.equal(api.state().baths,1);
use('cook');tick(1);run('localPlayer.mesh.position.set(2000,0,2000)');tick(10);assert.equal(api.state().cooked,0,'walking away cancels cooking');
use('wash');tick(1);run('changeFloor(1)');tick(10);assert.equal(api.state().laundry,0,'floor switch cancels task');
use('rest');tick(5.1);assert.equal(api.state().rests,1);
run('_exitBuildingNow()');
assert(JSON.parse(w.localStorage.getItem('fz8home_v1')).tea===1);
// Answer a lesson exactly once. Detached callback cannot award a grade twice.
api.visit('school');const lesson=use('lesson');assert.equal(w.document.getElementById('fz8bPanel').hidden,false);
const answer=w.document.querySelectorAll('#fz8bBody button')[1];answer.click();answer.click();assert.equal(api.state().grades.math.length,1);assert.equal(api.state().grades.math[0],5);
w.document.querySelector('[data-close]').click();use('lesson');assert(w.document.getElementById('fz8bPanel').hidden,'lesson cooldown');
// A task started from afar must do nothing.
const lunch=find('lunch');run('localPlayer.mesh.position.set(2000,0,2000)');api.interact(lunch);assert.equal(api.info().task,null);
run('_exitBuildingNow()');
// Repeated enter/leave does not accumulate scene nodes or interaction closures.
for(let i=0;i<8;i++){api.visit(i%2?'apartment':'house');run('changeFloor(1)');run('_exitBuildingNow()');assert.equal(run('scene.children.length'),0);assert.equal(spots().length,0);}
// Existing-city entrances: free grid only, no duplicate creation, collision before voxel grid.
w.NEWCITY={loaded:true,spawnX:3000,spawnZ:180,grid:{ox:2524,oz:-476,W:476,D:476,CELL:2,grid:new Uint8Array(476*476)}};
tick(4);assert.equal(api.entrances().length,3);const count=run('scene.children.length');tick(10);assert.equal(run('scene.children.length'),count);
for(const e of api.entrances()){assert.equal(api.outsideBlocked(e.x,e.z),true);assert.equal(api.outsideBlocked(e.x,e.z+5.7),false);}
// Storage validation on a fresh module evaluation (no active interior).
w.localStorage.setItem('fz8home_v1',JSON.stringify({tea:'NaN',baths:-1,grades:{math:[5,99,'oops']},visited:null}));
run(code);assert.equal(w.FZ8B.state().tea,0);assert.equal(w.FZ8B.state().baths,0);assert.deepEqual(JSON.parse(JSON.stringify(w.FZ8B.state().grades.math)),[5]);
console.table(report);console.log('PASS: native lifecycle, all 8 floors, finite meshes, walkable actions, doors, tasks, lessons, cooldowns, storage, exterior collision.');
dom.window.close();
