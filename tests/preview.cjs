// Isolated WebGL review scene using the game's real interior lifecycle.
// npm ci --prefix tests && node tests/preview.cjs
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),acorn=require('acorn');
const root=path.join(__dirname,'..');
function fixture(seaMode=false){
  const index=fs.readFileSync(path.join(root,'public/index.html'),'utf8'),functions=[];
  const names=['enterBuilding','buildInterior','changeFloor','_exitBuildingNow','exitBuilding','checkCollision','_fzGroundY'];
  for(const m of index.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){
    if(!m[1].trim())continue;
    for(const n of acorn.parse(m[1],{ecmaVersion:'latest'}).body)
      if(n.type==='FunctionDeclaration'&&names.includes(n.id.name))functions.push(m[1].slice(n.start,n.end));
  }
  let html = `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>FANTAZIA — Школа и жильё</title>
<style>*{box-sizing:border-box}body{margin:0;background:#18343a;color:#fff2da;font:14px Arial}canvas{display:block}header{position:fixed;top:0;left:0;right:0;z-index:200;background:#16393def;border-bottom:1px solid #8fa59b;padding:12px 20px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}header b{font:700 18px Arial;letter-spacing:2px;margin-right:auto}button,select{font:14px Arial;background:#e9ddc5;color:#244147;border:0;border-radius:7px;padding:9px;cursor:pointer}footer{position:fixed;bottom:0;left:0;right:0;padding:14px 20px;background:#16393de8;color:#c6d4c5;z-index:10}#interiorHUD{position:fixed;left:16px;top:92px;z-index:100;background:#173d42cc;padding:12px;border-radius:8px}#floorIndicator{color:#bfcebe;margin-top:5px}#toast{position:fixed;bottom:90px;left:50%;transform:translateX(-50%);padding:12px;background:#f2e5cb;color:#244147;border-radius:8px;z-index:13000;max-width:80%}#toast:empty{display:none}#cross{position:fixed;left:50%;top:50%;font:20px Arial;pointer-events:none;color:#fff9}#pad{position:fixed;bottom:64px;left:16px;z-index:200;display:flex;gap:5px}#pad button{touch-action:none;background:#315e61bb;color:#fff2da}#fz8bHud{top:95px!important}#note{font-size:11px;color:#b4c9bf}@media(max-width:600px){header{padding:8px;gap:5px}header b{font-size:14px}select,button{font-size:12px}#interiorHUD{top:115px;max-width:160px;font-size:11px}footer{font-size:10px}#fz8bHud{top:115px!important}}</style>
<header><b>FANTAZIA <span id="note">v8.5 / ПРОСМОТР ИНТЕРЬЕРОВ</span></b><select id="place"><option value="school">🏫 Школа</option><option value="house">🏡 Особняк</option><option value="apartment">🏢 Квартиры</option></select><button id="down">↓ Этаж</button><button id="up">↑ Этаж</button><button id="menu">План</button></header>
<div id="interiorHUD"><div id="buildingLabel"></div><div id="floorIndicator"></div></div><div id="mallMapBtn" hidden></div><div id="toast"></div><div id="cross">+</div>
<div id="pad"><button data-move="KeyW">▲</button><button data-move="KeyA">◀</button><button data-move="KeyS">▼</button><button data-move="KeyD">▶</button><button data-turn="1">↶</button><button data-turn="-1">↷</button></div>
<footer>WASD / стрелки — идти · мышь с зажатой кнопкой — смотреть · E — взаимодействовать · осмотр без регистрации; изменения встроены и в основную игру.</footer>
<script src="/three.js"></script><script>
const scene=new THREE.Scene(),INTERIOR_BASE={x:2000,z:2000};
let isInsideBuilding=false,currentBuildingType=null,currentBuildingName='',currentFloor=0,maxFloors=0;
let outsidePos={x:0,y:0,z:0},interiorObjects=[],interiorColliders=[],interiorBounds=null,interactables=[],nearestInteractable=null,npcs=[];
let localPlayer={mesh:new THREE.Object3D(),money:10000},velocity={x:0,y:0,z:0},keys={};
let isInFactory=false,isInBasement=false,buildings=[],streetColliders=[],basementColliders=[];
const CONFIG={WORLD_SIZE:1200},BASEMENT_BASE={x:0,z:0},FACTORY_BASE={x:0,z:0};
const INTERIOR_CONFIGS={school:{name:'Школа №1',floors:3},house:{name:'Особняк «Закат»',floors:2},apartment:{name:'Жилой дом «Липы»',floors:3}};
let toastTime=0;function showNotification(t){document.getElementById('toast').textContent=t;toastTime=4;}
function doorCine(fn){fn()}
${functions.join('\n')}
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(1.5,devicePixelRatio));renderer.setSize(innerWidth,innerHeight);renderer.outputEncoding=THREE.sRGBEncoding;document.body.appendChild(renderer.domElement);
const camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.05,100);scene.background=new THREE.Color(0x8aa5ab);
let yaw=0,pitch=0,last=0,drag=false,turn=0;
window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()});
window.addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='KeyE')useNearest()});window.addEventListener('keyup',e=>keys[e.code]=false);window.addEventListener('blur',()=>keys={});
renderer.domElement.addEventListener('pointerdown',e=>{drag=true;renderer.domElement.setPointerCapture(e.pointerId)});renderer.domElement.addEventListener('pointerup',()=>drag=false);renderer.domElement.addEventListener('pointermove',e=>{if(drag){yaw-=e.movementX*.004;pitch=Math.max(-1.15,Math.min(1.15,pitch-e.movementY*.004))}});
function useNearest(){const p=localPlayer.mesh.position;const s=interactables.filter(s=>s.interior&&Math.hypot(p.x-s.position.x,p.z-s.position.z)<s.range).sort((a,b)=>Math.hypot(p.x-a.position.x,p.z-a.position.z)-Math.hypot(p.x-b.position.x,p.z-b.position.z))[0];if(s)FZ8B.interact(s)}
for(const b of document.querySelectorAll('[data-move]')){b.onpointerdown=e=>{keys[b.dataset.move]=true;b.setPointerCapture(e.pointerId)};b.onpointerup=b.onpointercancel=()=>keys[b.dataset.move]=false}
for(const b of document.querySelectorAll('[data-turn]')){b.onpointerdown=e=>{turn=Number(b.dataset.turn);b.setPointerCapture(e.pointerId)};b.onpointerup=b.onpointercancel=()=>turn=0}
</script><script src="/assets/fz-v8home.js"></script><script>
FZ8B.visit('school');
document.getElementById('place').onchange=e=>{_exitBuildingNow();FZ8B.visit(e.target.value);yaw=0;pitch=0};document.getElementById('up').onclick=()=>changeFloor(1);document.getElementById('down').onclick=()=>changeFloor(-1);document.getElementById('menu').onclick=()=>document.getElementById('fz8bPlan').click();
window.reviewView=(type,floor,room,angle)=>{if(isInsideBuilding)_exitBuildingNow();FZ8B.visit(type);if(floor)changeFloor(floor);const r=FZ8B.info().rooms[room];localPlayer.mesh.position.set(2000+r.x,3.5*floor,2000+r.z+(r.z<0?4:-4));yaw=angle===undefined?(r.z<0?0:Math.PI):angle;pitch=-.08;};
function frame(t){requestAnimationFrame(frame);const dt=Math.min(.05,(t-last)/1000||.016);last=t;const p=localPlayer.mesh.position;
if(document.getElementById('fz8bPanel').hidden){yaw+=turn*dt*1.7;let f=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0),s=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0);const norm=Math.hypot(f,s)||1;f/=norm;s/=norm;const dx=(-Math.sin(yaw)*f+Math.cos(yaw)*s)*dt*3.8,dz=(-Math.cos(yaw)*f-Math.sin(yaw)*s)*dt*3.8;if(!checkCollision(p.x+dx,p.z))p.x+=dx;if(!checkCollision(p.x,p.z+dz))p.z+=dz;}
camera.position.set(p.x,p.y+1.65,p.z);camera.rotation.order='YXZ';camera.rotation.set(pitch,yaw,0);FZ8B.update(dt);renderer.render(scene,camera);if(toastTime>0){toastTime-=dt;if(toastTime<=0)document.getElementById('toast').textContent=''}
}requestAnimationFrame(frame);
</script></html>`;
  if(seaMode){
    html=html.replace('FANTAZIA — Школа и жильё','FANTAZIA — Морской район').replace('v8.5 / ПРОСМОТР ИНТЕРЬЕРОВ','v8.6 / МОРСКОЙ РАЙОН');
    html=html.replace('</style>','body.sea-view #interiorHUD{display:none!important}body.sea-view #down,body.sea-view #up{display:none}#fzSeaHud{top:100px}</style>');
    html=html.replace('<option value="school">','<option value="sea">Морской район</option><option value="school">');
    html=html.replace('<script src="/assets/fz-v8home.js"></script>', '<script src="/assets/fz-v8home.js"></script><script src="/assets/fz-v8sea.js"></script>');
    html=html.replace("FZ8B.visit('school');", "FZ8SEA.enter();yaw=-Math.PI/2;scene.add(new THREE.HemisphereLight(0xdaeef1,0x8c896d,.35));const sun=new THREE.DirectionalLight(0xffefcf,.85);sun.position.set(-80,140,70);scene.add(sun);");
    html=html.replace("_exitBuildingNow();FZ8B.visit(e.target.value);yaw=0;pitch=0", "if(FZ8SEA.aboard()&&!FZ8SEA.disembark()){e.target.value='sea';return;}if(isInsideBuilding)_exitBuildingNow();if(FZ8SEA.active())FZ8SEA.leave();if(e.target.value==='sea')FZ8SEA.enter();else FZ8B.visit(e.target.value);yaw=0;pitch=0");
    html=html.replace("document.getElementById('fz8bPlan').click()", "(FZ8SEA.active()?FZ8SEA.map():document.getElementById('fz8bPlan').click())");
    html=html.replace('s.interior&&Math.hypot', '(s.interior||(s.fz8sea&&FZ8SEA.visibleSpot(s)))&&Math.hypot');
    html=html.replace('if(s)FZ8B.interact(s)', 'if(s){if(s.fz8sea)FZ8SEA.interact(s);else FZ8B.interact(s)}');
    html=html.replace("if(document.getElementById('fz8bPanel').hidden){", "if(document.getElementById('fz8bPanel').hidden&&!FZ8SEA.modalOpen()){");
    html=html.replace("camera.position.set(p.x,p.y+1.65,p.z);", "FZ8SEA.update(dt);document.body.classList.toggle('sea-view',FZ8SEA.active());const seaY=FZ8SEA.ground();if(seaY!==null)p.y=seaY;camera.position.set(p.x,p.y+1.65,p.z);");
    html=html.replace('window.reviewView=', "window.seaView=(x,z,heading=0,look=0)=>{if(!FZ8SEA.active())FZ8SEA.enter();localPlayer.mesh.position.set(6000+x,2,z);const y=FZ8SEA.ground();if(y!==null)localPlayer.mesh.position.y=y;yaw=heading;pitch=look;};window.reviewView=");
  }
  return html;
}
http.createServer((req,res)=>{
  if(req.url==='/three.js'){res.setHeader('content-type','application/javascript');return fs.createReadStream(require.resolve('three/build/three.js')).pipe(res)}
  if(req.url==='/assets/fz-v8sea.js'){res.setHeader('content-type','application/javascript');return fs.createReadStream(path.join(root,'public/assets/fz-v8sea.js')).pipe(res)}
  if(req.url==='/sea'){res.setHeader('content-type','text/html; charset=utf-8');return res.end(fixture(true))}
  if(req.url==='/assets/fz-v8home.js'){res.setHeader('content-type','application/javascript');return fs.createReadStream(path.join(root,'public/assets/fz-v8home.js')).pipe(res)}
  if(req.url==='/'||req.url==='/index.html'){res.setHeader('content-type','text/html; charset=utf-8');return res.end(fixture(process.env.SEA_PREVIEW==='1'))}
  res.statusCode=404;res.end('Not found');
}).listen(Number(process.env.PORT)||3001,'0.0.0.0',()=>console.log('Interior review: http://0.0.0.0:'+(process.env.PORT||3001)));
