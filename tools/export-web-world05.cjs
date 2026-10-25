// Maintainer-only: capture the current browser scene, not the legacy GLB.
// Dependencies live outside the repository (PORT05_NODE_MODULES).
const fs=require('fs'), path=require('path'), http=require('http');
const deps=process.env.PORT05_NODE_MODULES || '/home/user/.cache/port05/node_modules';
const {chromium}=require(path.join(deps,'playwright-core'));
const chrome=require(path.join(deps,'@sparticuz/chromium/build/index.js')).default;
const root=path.resolve(__dirname,'..'), out=process.env.PORT05_OUT || '/home/user/.cache/port05/export';
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.json':'application/json'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/exporter.js'){res.setHeader('content-type','application/javascript');return fs.createReadStream(path.join(deps,'three/examples/js/exporters/GLTFExporter.js')).pipe(res);}
 if(url.pathname.startsWith('/socket.io')){res.setHeader('content-type','application/javascript');return res.end('window.io=function(){return {on(){return this},off(){return this},emit(){return this},disconnect(){},connected:false,timeout(){return this}}}');}
 const target=path.resolve(root,'public','.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
 if(!target.startsWith(path.join(root,'public')+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.statusCode=404;return res.end();}
 res.setHeader('content-type',mime[path.extname(target)]||'application/octet-stream');fs.createReadStream(target).pipe(res);
});
(async()=>{
 await new Promise(r=>server.listen(0,'0.0.0.0',r));
 const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:await chrome.executablePath(),args:chrome.args,headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1100,height:720}});
 page.on('pageerror',e=>console.log('PAGE_ERROR',e.message));
 await page.route('**/*',r=>r.request().url().startsWith(url)||/^(data|blob):/.test(r.request().url())?r.continue():r.abort());
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof cityWorldReady==='function' && cityWorldReady(),{},{timeout:120000});
 if(await page.locator('#fzIntroSkip').count()) await page.locator('#fzIntroSkip').click({force:true}).catch(()=>{});
 await page.evaluate(()=>{
 window.requestAnimationFrame=()=>0;
 localPlayer={mesh:new THREE.Object3D()}; localPlayer.mesh.position.set(131,0,-30);
 document.body.classList.add('game-active');window.cine=null;window._loadingGate=false;
 window.FZSky.build();window.FZ8SEA.build();window.FZMetro.update(0);
 for(const root of scene.children) if(root.name==='Fantazia cloud arrival'||root.name==='fz8sea_coast')root.visible=true;
});
 const data=await page.evaluate(()=>{
  scene.updateMatrixWorld(true);
  return {buildings:buildings.map(({name,type,x,z,w,h,d,bounds})=>({name,type,x,z,w,h,d,bounds})),
  stations:FZMetro.info().stations,sky:FZSkyPolicy.spawn,citySpawn:FZRoads.spawn,
  sea:FZ8SEA.locations(),meshes:(()=>{let n=0;scene.traverse(o=>{if(o.isMesh)n++});return n})(),
  nodes:scene.children.map(o=>({name:o.name,type:o.type,pos:o.position.toArray(),children:o.children.length}))};
 });
 fs.writeFileSync(path.join(out,'world.json'),JSON.stringify(data,null,2));console.log('WORLD_METADATA',data.meshes,data.buildings.length);
 await page.addScriptTag({url:url+'/exporter.js'});
 await page.exposeFunction('saveSector',(name,b64)=>{fs.writeFileSync(path.join(out,name+'.glb'),Buffer.from(b64,'base64'));console.log('SAVED',name);});
 await page.evaluate(async()=>{
  // Only scene geometry, not gameplay accounts or browser UI. Spatial sectors avoid one giant import.
  const groups={city:new THREE.Group(),sky:new THREE.Group(),sea:new THREE.Group()};
  scene.updateMatrixWorld(true);
  scene.traverse(o=>{
   if(!o.isMesh || !o.geometry?.attributes.position || o.isSkinnedMesh) return;
   if(o.material?.isShaderMaterial || o.name.toLowerCase().includes('grass')) return;
   const visible=(()=>{let n=o;while(n){if(!n.visible)return false;n=n.parent}return true})();
   if(!visible)return;
   const add=(matrix)=>{
    const p=new THREE.Vector3().setFromMatrixPosition(matrix);
    const sector=p.x>4000?'sea':p.y>250?'sky':Math.abs(p.x)<1300&&Math.abs(p.z)<1300?'city':null;
    if(!sector)return;
    const mesh=new THREE.Mesh(o.geometry,o.material);mesh.name=o.name;mesh.matrixAutoUpdate=false;mesh.matrix.copy(matrix);groups[sector].add(mesh);
   };
   if(o.isInstancedMesh){const m=new THREE.Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);add(new THREE.Matrix4().multiplyMatrices(o.matrixWorld,m));}}
   else add(o.matrixWorld);
  });
  for(const [name,group] of Object.entries(groups)){
   group.updateMatrixWorld(true);
   const blob=await new Promise((resolve,reject)=>new THREE.GLTFExporter().parse(group,resolve,{binary:true,onlyVisible:true,truncateDrawRange:true}));
   const b64=await new Promise(r=>{const reader=new FileReader();reader.onload=()=>r(reader.result.split(',')[1]);reader.readAsDataURL(new Blob([blob]));});
   await window.saveSector(name,b64);
  }
 });
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
