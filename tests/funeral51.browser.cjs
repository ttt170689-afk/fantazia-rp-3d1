'use strict';
// Isolated real-WebGL test, using the SAME pinned Three/GLTF loader, cast,
// camera tracks and prologue geometry as the production game, not mocks.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const express=require('express'),{chromium}=require('playwright-core'),chrome=require('@sparticuz/chromium').default;
(async()=>{
 const root=path.resolve(__dirname,'..'),out=path.join(root,'.cache/funeral51');fs.mkdirSync(out,{recursive:true});
 const index=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
 const start=index.indexOf('( function () {',index.indexOf('vendor/three-r128'));
 const end=index.indexOf('</script>',index.indexOf('THREE.SkeletonUtils =',start));
 const loader=index.slice(start,end).replace(/<\/?script>/g,'');
 const app=express();
 app.get('/test-loader.js',(_,res)=>res.type('js').send(loader));
 app.get('/test',(_,res)=>res.type('html').send(`<!doctype html><html><head><style>body{margin:0;background:#111}canvas{display:block}</style></head><body><script src="vendor/three-r128.min.js"></script><script src="test-loader.js"></script><script src="assets/fz-cinematic32.js"></script><script src="assets/fz-humans31.js"></script><script src="assets/fz-story30-sets.js"></script></body></html>`));
 app.use(express.static(path.join(root,'public')));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});let browser;
 try{
  if(process.platform==='linux'){const pkg=require('@sparticuz/chromium');await pkg.inflate(path.join(path.dirname(require.resolve('@sparticuz/chromium')),'../bin/al2023.tar.br'));pkg.setupLambdaEnvironment(path.join(require('node:os').tmpdir(),'al2023/lib'));}
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||await chrome.executablePath(),args:chrome.args.filter(a=>!['--disable-web-security','--allow-running-insecure-content','--single-process'].includes(a)),headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:'+server.address().port+'/test');
  await page.evaluate(async()=>{
   await FZHumans31.load();window.owned=new Set();window.set=FZStory30Sets.prologue(owned);
   set.street.visible=false;set.funeral.visible=true;set.rain.visible=false;
   set.world.background.setHex(0x35424a);set.world.fog.color.setHex(0x35424a);set.world.fog.near=7;set.world.fog.far=45;set.hemi.intensity=1;
   window.r=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setSize(1280,900);r.setPixelRatio(1);r.outputEncoding=THREE.sRGBEncoding;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1;document.body.append(r.domElement);
   window.cam=new THREE.PerspectiveCamera(45,1280/900,.04,100);window.draw=t=>{FZHumans31.animate(set.actors,t,false);const shot=FZCinematic32.funeral(t);cam.position.fromArray(shot.position);cam.lookAt(new THREE.Vector3().fromArray(shot.look));cam.fov=shot.fov;cam.updateProjectionMatrix();r.render(set.world,cam);};draw(0);
  });
  assert.equal(await page.evaluate(()=>FZHumans31.info().loaded),true);
  for(const t of [0,2.9,5.5]){await page.evaluate(t=>draw(t),t);await page.screenshot({path:path.join(out,'scene-'+t+'.png')});}
  const acting=await page.evaluate(()=>{
   function footPoints(a){a.updateMatrixWorld(true);const points=[];a.traverse(o=>{if(!o.isSkinnedMesh||!o.name.startsWith('shoes'))return;o.skeleton.update();const p=o.geometry.attributes.position;for(let i=0;i<p.count;i+=37){const v=new THREE.Vector3().fromBufferAttribute(p,i);if(v.y>.12)continue;o.boneTransform(i,v);points.push(v.applyMatrix4(o.matrixWorld));}});return points;}
   FZHumans31.animate(set.actors,0);const feet=set.actors.map(footPoints);let drift=0,finite=true;
   for(let t=0;t<=6;t+=.1){FZHumans31.animate(set.actors,t);set.actors.forEach((a,i)=>{footPoints(a).forEach((p,j)=>drift=Math.max(drift,p.distanceTo(feet[i][j])));a.traverse(o=>{finite=finite&&o.matrixWorld.elements.every(Number.isFinite);});});}
   FZHumans31.animate(set.actors,2.9);const leads=set.actors[3].userData.neck.rotation.y>set.actors[3].userData.torso.rotation.y;
   function pose(){return set.actors.map(a=>{a.updateMatrixWorld(true);return Object.values(a.userData.bones).flatMap(b=>b.matrixWorld.elements);});}
   FZHumans31.animate(set.actors,1.2);const a=JSON.stringify(pose());FZHumans31.animate(set.actors,1.2);const deterministic=a===JSON.stringify(pose());
   FZHumans31.animate(set.actors,0,true);const low=JSON.stringify(pose());FZHumans31.animate(set.actors,2,true);const reducedStatic=low===JSON.stringify(pose());
   return {drift,finite,leads,deterministic,reducedStatic,footSamples:feet.map(f=>f.length)};
  });
  assert(acting.footSamples.every(n=>n>10));assert(acting.drift<1e-5,JSON.stringify(acting));assert(acting.finite&&acting.leads&&acting.deterministic&&acting.reducedStatic,JSON.stringify(acting));
  // Render/dispose repeated clones: cached GPU geometry/maps must remain valid,
  // cloned bones must never alias another scene, and bone textures must not leak.
  const lifecycle=await page.evaluate(()=>{
   draw(0);const before={...r.info.memory};let isolated=true;
   for(let pass=0;pass<4;pass++){
    const temporary=new THREE.Group(),actors=Array.from({length:5},(_,i)=>FZHumans31.create(new Set(),i));
    set.funeral.visible=false;set.world.add(temporary);
    actors.forEach((a,i)=>{a.position.copy(set.actors[i].position);a.userData.restYaw=set.actors[i].userData.restYaw;temporary.add(a);isolated=isolated&&a.userData.neck!==set.actors[i].userData.neck;});
    FZHumans31.animate(actors,3);r.render(set.world,cam);
    for(const a of actors)a.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});set.world.remove(temporary);set.funeral.visible=true;draw(0);
   }
   return {isolated,before,after:{...r.info.memory},glError:r.getContext().getError()};
  });
  assert(lifecycle.isolated);assert.deepEqual(lifecycle.after,lifecycle.before);assert.equal(lifecycle.glError,0);
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{r.setSize(390,844);cam.aspect=390/844;draw(0);});
  await page.screenshot({path:path.join(out,'mobile.png')});
  await page.setViewportSize({width:1280,height:900});await page.evaluate(()=>{r.setSize(1280,900);cam.aspect=1280/900;});
  // Neutral frontal lineup to inspect anatomy, clothing, fingers, hair and feet.
  await page.evaluate(()=>{
   window.lineup=new THREE.Scene();lineup.background=new THREE.Color(0x28303d);lineup.add(new THREE.HemisphereLight(0xf0f3ff,0x606070,1.1));let key=new THREE.DirectionalLight(0xffe8d5,1.8);key.position.set(2,5,5);lineup.add(key);
   set.actors.forEach((a,i)=>{lineup.add(a);a.position.set((i-2)*.85,0,0);a.userData.restYaw=0;});
   FZHumans31.animate(set.actors,0,true);cam.position.set(0,1,6);cam.lookAt(0,.96,0);cam.fov=30;cam.updateProjectionMatrix();r.render(lineup,cam);
  });
  await page.screenshot({path:path.join(out,'cast.png')});
  if(process.env.FZ_DEBUG_FACE){
   await page.evaluate(()=>{set.actors.forEach((a,i)=>a.visible=i===3);cam.position.set(.85,1.64,.65);cam.lookAt(.85,1.62,0);cam.fov=30;cam.updateProjectionMatrix();r.render(lineup,cam);});
   await page.screenshot({path:path.join(out,'face.png')});
   await page.evaluate(()=>{set.actors[3].traverse(o=>{if(o.isMesh&&o.name!=='Eyes')o.visible=false;});r.render(lineup,cam);});
   await page.screenshot({path:path.join(out,'eyes.png')});
  }
  const stats=await page.evaluate(()=>({info:FZHumans31.info(),calls:r.info.render.calls,triangles:r.info.render.triangles,geometries:r.info.memory.geometries,textures:r.info.memory.textures,actors:set.actors.map(a=>{let skinned=0;a.traverse(o=>{if(o.isSkinnedMesh)skinned++;});return {name:a.name,skinned,bones:Object.keys(a.userData.bones).length};})}));
  assert.equal(stats.calls,process.env.FZ_DEBUG_FACE?1:25);assert(stats.triangles<180000);assert(stats.actors.every(a=>a.skinned===5&&a.bones===163));
  const failure=await browser.newPage();const failureErrors=[];failure.on('pageerror',e=>failureErrors.push(e.message));
  await failure.route('**/funeral51/father.glb',route=>route.fulfill({status:200,contentType:'model/gltf-binary',body:'broken GLB'}));
  await failure.goto('http://127.0.0.1:'+server.address().port+'/test');
  const degraded=await failure.evaluate(async()=>{await FZHumans31.load();const owned=new Set(),actors=Array.from({length:5},(_,i)=>FZHumans31.create(owned,i));FZHumans31.animate(actors,3);return {ready:FZHumans31.ready(),count:FZHumans31.info().loadedCount,fallback:actors.map(a=>!!a.userData.fallback51)};});
  assert.deepEqual(degraded,{ready:true,count:4,fallback:[true,false,false,false,false]});assert.deepEqual(failureErrors,[]);await failure.close();
  console.log(JSON.stringify({stats,acting,lifecycle,degraded},null,2));assert.deepEqual(errors,[]);
  console.log('PASS funeral51 real WebGL: all five skinned people, planted shoe vertices, deterministic/reduced poses, head-led turn, isolated clones, bounded GPU lifecycle, portrait viewport and per-file corrupt-asset fallback. PAGE_ERRORS []');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
