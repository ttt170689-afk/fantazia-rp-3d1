/* v30: one owner of the post-Play story; driven ONLY by the native animate loop.
 * No second renderer/RAF. All transient GPU/audio/DOM ownership is released on
 * skip, completion, logout or failure. Arrival plaza, forest and the landed cabin stay playable. */
(function(){
  'use strict';
  const P=FZStory30Policy,C=FZCinematic32,F=FZLift34Policy,I=FZImpact35Policy,W=FZCabin38Policy;
  let pending=false,run=null,lastError='',completedOpening=false,completedRide=false,route=-1,metroPending=false;
  const resources=new Set(),clips=new Map();
  const path=FZStory30Forest.route;
  const lerp=(a,b,t)=>a+(b-a)*P.smooth(t);
  const V=(x,y,z)=>new THREE.Vector3(x,y,z);
  function arm(){cancel();const saved=window.FZProgress40?.arm()||{};completedOpening=!!saved.opening;completedRide=!!saved.ride;pending=!completedOpening&&!completedRide;FZHands30.load();FZHumans31.load();}
  function locked(){return !!run;}
  function reduced(){return !!window.FZPlay?.reducedMotion();}
  function controls(){
    window.FZPlay?.release();window.FZUI?.close();window.FZGuide?.close();window.FZTouch?.close();
    if(document.pointerLockElement)document.exitPointerLock();
    Object.keys(keys).forEach(k=>keys[k]=false);Object.assign(velocity,{x:0,y:0,z:0});
  }
  function ui(kind){
    const el=document.createElement('section');el.id='fzStory30';el.setAttribute('aria-label','Сюжет Fantazia RP');
    el.innerHTML='<div class="fz-story-vignette"></div><div class="fz-story-interference" aria-hidden="true"><canvas width="160" height="90"></canvas><i></i></div><div class="fz-story-fade"></div><div class="fz-story-heading"><small></small><h1></h1><p></p></div><div class="fz-story-caption" role="status" aria-live="polite"></div><div class="fz-radio39" hidden><span>РАДИО · ДИСПЕТЧЕР</span><i aria-hidden="true">▂ ▆ ▃ ▇ ▂</i></div><div class="fz-story-pause39" hidden>Пауза · Esc — продолжить</div>';
    const owner=run;
    const walking=document.createElement('div');walking.className='fz-cabin-walk';walking.hidden=true;
    walking.innerHTML='<div class="fz-cabin-look" aria-hidden="true"></div><p>WASD / стрелки — ходить · потяни экран — осмотреться</p><div class="fz-cabin-pad" aria-label="Ходьба в кабине"><button type="button" data-move="forward" aria-label="Вперёд">↑</button><button type="button" data-move="left" aria-label="Влево">←</button><button type="button" data-move="back" aria-label="Назад">↓</button><button type="button" data-move="right" aria-label="Вправо">→</button></div>';
    el.append(walking);
    for(const b of walking.querySelectorAll('[data-move]')){
      b.onpointerdown=e=>{if(run!==owner||!canWalk())return;e.preventDefault();run.walkTouches.set(e.pointerId,b.dataset.move);b.setPointerCapture(e.pointerId);};
      const release=e=>{if(run===owner)run.walkTouches.delete(e.pointerId);};
      b.onpointerup=b.onpointercancel=b.onlostpointercapture=release;
    }
    const look=walking.querySelector('.fz-cabin-look');
    look.onpointerdown=e=>{if(run!==owner||!canWalk()||e.button!==0)return;e.preventDefault();run.lookPointer={id:e.pointerId,x:e.clientX,y:e.clientY};look.setPointerCapture(e.pointerId);};
    look.onpointermove=e=>{const p=run?.lookPointer;if(run!==owner||!canWalk()||p?.id!==e.pointerId)return;run.walk.yaw-=Math.max(-.2,Math.min(.2,(e.clientX-p.x)*.004));run.walk.pitch=Math.max(-.8,Math.min(1,run.walk.pitch-(e.clientY-p.y)*.004));p.x=e.clientX;p.y=e.clientY;};
    look.onpointerup=look.onpointercancel=look.onlostpointercapture=e=>{if(run===owner&&run.lookPointer?.id===e.pointerId)run.lookPointer=null;};
    for(const name of ['pointerdown','pointerup','click'])el.addEventListener(name,e=>{if(e.target.closest('button'))e.stopPropagation();});
    document.body.append(el);el.tabIndex=-1;el.focus({preventScroll:true});return el;
  }
  function syncSound(){
    if(!run)return;const badge=run.ui.querySelector('.fz-radio39');
    badge.hidden=!(run.kind==='ride'&&run.t>=16.2&&run.t<F.collapseStart);
    const level=run.audio?FZSound.radioLevel?.(run.audio)||0:0;
    badge.style.setProperty('--radio-level',String(reduced()?0:level));
    badge.dataset.receiving=String(!!run.audio&&!run.audio.paused&&!run.paused);
  }
  function heading(kicker,title,sub=''){
    if(!run)return;const key=kicker+'|'+title+'|'+sub;if(run.headingKey===key)return;run.headingKey=key;
    const h=run.ui.querySelector('.fz-story-heading');h.querySelector('small').textContent=kicker;h.querySelector('h1').textContent=title;h.querySelector('p').textContent=sub;
  }
  function caption(text){if(run){const el=run.ui.querySelector('.fz-story-caption');if(el.textContent!==text)el.textContent=text;}}
  function fade(value){if(run)run.ui.querySelector('.fz-story-fade').style.opacity=String(P.clamp(value));}
  function voice(name,text){
    caption(text);if(!FZSound.audible()||!FZSound.info().prefs.voice)return;
    let audio=clips.get(name);if(!audio){audio=new Audio('audio/story30/'+name+'.mp3');audio.preload='auto';FZSound.pipeVoice(audio,{radio:name!=='awakening'});clips.set(name,audio);}
    stopVoice();audio.currentTime=0;run.audio=audio;run.audioBlocked=false;const owner=run;audio.play().catch(error=>{if(run===owner&&run.audio===audio&&error.name!=='AbortError')run.audioBlocked=true;});
  }
  function stopVoice(){for(const a of clips.values()){a.pause();a.currentTime=0;}if(run){run.audio=null;run.resumeAudio=false;}}
  function bed(kind){
    stopBed();if(!run)return;
    try{
      const ctx=getAudioCtx(),buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=buffer.getChannelData(0);
      let last=0;for(let i=0;i<data.length;i++){last=(last+Math.random()*.04-.02)/1.015;data[i]=kind==='rain'?Math.random()*2-1:last*6;}
      const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();src.buffer=buffer;src.loop=true;filter.type=kind==='rain'?'highpass':'lowpass';filter.frequency.value=kind==='rain'?1000:450;gain.gain.value=0;
      src.connect(filter);filter.connect(gain);gain.connect(FZSound.bus('ambience'));src.start();run.bed={src,filter,gain,ctx,volume:kind==='rain'?.055:.12};
    }catch(e){/* Captions and timeline remain usable when browser audio is blocked. */}
  }
  function stopBed(){if(!run?.bed)return;const b=run.bed;try{b.src.stop();b.src.disconnect();b.filter.disconnect();b.gain.disconnect();}catch(e){}run.bed=null;}
  function soundFrame(){
    if(!run)return;const silent=run.paused||document.hidden||!FZSound.audible();
    if(run.bed)run.bed.gain.gain.setTargetAtTime(silent?0:run.bed.volume,run.bed.ctx.currentTime,.08);
    if(run.audio&&silent&&!run.audio.paused){run.resumeAudio=true;run.audio.pause();}
    if(!silent&&run.resumeAudio&&run.audio){run.resumeAudio=false;run.audio.play().catch(()=>{});}
    syncSound();
  }
  function pause(on){if(!run)return;clearWalk();run.paused=!!on;if(on)FZSound.stopEffects();run.ui.querySelector('.fz-story-pause39').hidden=!on;soundFrame();}
  function cue(id,fn){if(run&&!run.cues.has(id)){run.cues.add(id);fn();}}
  function begin(kind,onArrival){
    if(run||window.cine||!localPlayer?.mesh)return false;
    pending=false;FZStory30Forest.build();controls();FZSky.suspendVisual();FZSound.stopVoice();if(typeof _musicStop==='function')_musicStop();
    const token={story30:true};
    run={kind,t:0,phase:'',cues:new Set(),token,onArrival,paused:false,near:camera.near,far:camera.far,fov:camera.fov,mask:camera.layers.mask,visibility:localPlayer.mesh.visible,focus:document.activeElement};
    run.walk={x:0,z:-.65,yaw:0,pitch:0,distance:0};run.walkKeys=new Set();run.walkTouches=new Map();
    for(const l of [window._flash,window._flashSpill])if(l)l.visible=false;window.FZFlash40?.light(false);
    window.cine=token;window.elevatorCut={phase:'cine',story30:true};window._introDone=true;window._spawnFixed=true;
    document.body.classList.add('fz-story-on');localPlayer.mesh.visible=false;ITEMS.vm&&(ITEMS.vm.visible=false);
    camera.layers.set(0);camera.near=.04;camera.far=1500;camera.fov=68;camera.updateProjectionMatrix();
    run.ui=ui(kind);run.set=kind==='ride'?FZStory30Sets.ride(resources):FZStory30Sets.prologue(resources);
    if(kind==='ride'){scene.add(run.set.lift.root,run.set.guides);for(const puff of run.set.puffs)scene.add(puff);run.clouds=run.set.puffs;const mall=buildings.find(b=>b.type==='mall');run.mall={x:mall.x,z:mall.z,uuid:mall.mesh.uuid};run.cabinGroundY=FZLift38Wreck.groundHeight(run.set.lift.root,F.sample(0,run.mall,P.forest).yaw);run.set.debris=new THREE.Group();run.set.debris.name="Falling floor fragments";scene.add(run.set.debris);}
    bed(kind==='ride'?'wind':'rain');return true;
  }
  function board(onArrival){
    if(run||pending||!FZUI.playing()||!FZSky.active()||window.cine||window._loadingGate)return false;
    if(!P.canBoard(localPlayer.mesh.position)){
      setNavTarget(18,-1376,'Зал пяти лифтов');showNotification('Спустись по лестнице и войди в любую стеклянную кабину. Затем нажми действие.','info');return false;
    }
    clearNavTarget();return begin('ride',typeof onArrival==='function'?onArrival:null);
  }
  function point(pos,look,roll=0){camera.position.set(...pos);camera.up.set(0,1,0);camera.lookAt(...look);if(!reduced())camera.rotateZ(roll);camera.updateMatrixWorld(true);}
  function hands(owner,mode,t,dt,contact){FZHands30.update(owner,camera,mode,t,dt,reduced(),contact);}
  function drawWorld(){FZSky.update();FZSky.beforeRender();localPlayer.mesh.visible=false;renderer.render(scene,camera);}
  function opening(dt){
    const t=run.t,set=run.set,phase=P.at('opening',t)[0];run.phase=phase;
    if(t<8){
      const shot=I.sample(t,reduced());
      point(shot.position,shot.look,shot.roll);camera.fov=shot.fov;camera.updateProjectionMatrix();
      set.moon.intensity=1.1+(t>2.2&&t<2.65&&!reduced()?Math.sin((t-2.2)/.45*Math.PI)*.9:0);
      set.car.position.set(shot.carX,0,.7); // bumper meets the walking player at t=6, 108 km/h
      for(const w of set.wheels)w.rotation.y=-(set.car.position.x+52)/.38;
      set.car.rotation.x=reduced()?0:C.impulse(t-6,.025,3,9);
      const spray=set.spray.geometry.attributes.position;
      for(let i=0;i<spray.count;i++){const u=((t*2+i*.618)%1+1)%1; spray.setXYZ(i,set.car.position.x-2-u*4,.1+Math.sin(u*Math.PI)*(.3+i%5*.1),.7+(i%2?1:-1)*(.75+u*.8));}spray.needsUpdate=true;set.spray.visible=t>5.2&&t<6.2;
      heading(t<3?'ПОСЛЕ РАБОТЫ':'','','');caption(t<4.2?'Поздний вечер. Возвращаюсь с работы.':'');
      hands(set.world,shot.reaction?'brace':'walk',shot.reaction?t-I.contact:t,dt);
      if(t>2.35)cue('thunder',()=>SFX.noise(2.5,.12,180));
      if(shot.reaction){
        fade(shot.black);cue('impact',()=>{SFX.thud();SFX.noise(.18,.10,320);stopBed();});
        if(t>6.02)cue('brake',()=>SFX.noise(.35,.055,2300));
      }else fade(t<.65?1-t/.65:0);
    }else if(t<14){
      set.street.visible=false;set.funeral.visible=true;FZHands30.hide();
      set.world.background.setHex(0x35424a);set.world.fog.color.setHex(0x35424a);set.world.fog.near=7;set.world.fog.far=45;set.hemi.intensity=1;
      const shot=C.funeral(t-8,reduced());point(shot.position,shot.look,shot.roll);camera.fov=shot.fov;camera.updateProjectionMatrix();FZHumans31.animate(set.actors,t-8,reduced());
      heading('ПОЗЖЕ','');caption('');fade(Math.max(0,1-(t-8)/.35));
      cue('funeral-rain',()=>bed('rain'));
    }else{
      cue('awaken',()=>{stopBed();heading('','');FZSky.update();});
      const p=localPlayer.mesh.position,k=C.ease((t-14)/3.8);camera.fov=68;camera.updateProjectionMatrix();
      point([p.x,p.y+.65+.97*k,p.z],[p.x+1+6*k,p.y+.4+.8*k,p.z-1],reduced()?0:C.impulse(t-14,.025,1.6,4));
      fade(0);if(t>15.7)cue('where',()=>voice('awakening','Где я?..'));
      if(t>18.2)caption('Лестница справа ведёт к стеклянным лифтам.');
      hands(scene,'awake',t-14,dt);drawWorld();return;
    }
    const pos=set.rain.geometry.attributes.position;
    for(let i=0;i<pos.count;i+=2){const y=((i/2%97)/97*11-t*12+240)%12-1;pos.setY(i,y);pos.setY(i+1,y-.32);}pos.needsUpdate=true;
    set.rain.position.copy(camera.position);set.rain.position.y=0;
    renderer.render(set.world,camera);
  }
  function landPosition(){
    const p=localPlayer.mesh.position;p.set(P.forest.x,P.forest.y,P.forest.z);
    // Stay on the existing path, never silently relocate to the city spawn.
    if(checkCollision(p.x,p.z))for(let i=1;i<=10;i++){const x=P.forest.x+i*.5,z=P.forest.z-i*.23;if(!checkCollision(x,z)){p.set(x,P.forest.y,z);break;}}
    return p;
  }
  function canWalk(){return !!run&&W.allowed(run.kind,run.t,run.paused,document.hidden);}
  function clearWalk(){if(run){run.walkKeys?.clear();run.walkTouches?.clear();run.lookPointer=null;}}
  const moveKeys={KeyW:'forward',ArrowUp:'forward',KeyS:'back',ArrowDown:'back',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'};
  function walkFrame(dt){
    if(!canWalk()){clearWalk();return;}
    const actions=new Set([...run.walkKeys].map(k=>moveKeys[k]).concat([...run.walkTouches.values()]));
    run.walk=W.walk(run.walk,{right:Number(actions.has('right'))-Number(actions.has('left')),forward:Number(actions.has('forward'))-Number(actions.has('back'))},dt);
  }
  function walkingPoint(shot){const pos=V(...shot.position).add(V(...W.offset(run.walk,shot.yaw)));point(pos.toArray(),pos.clone().addScaledVector(V(...W.direction(shot,run.walk)),5).toArray(),shot.roll);}
  function noiseFrame(t){
    const el=run.ui.querySelector('.fz-story-interference'),alpha=F.interference(t,reduced());el.style.opacity=String(alpha);
    const tick=Math.floor(t*12);if(!alpha||run.noiseTick===tick)return;run.noiseTick=tick;
    el.style.setProperty('--noise-y',Math.sin(tick*31)*36+'px');
    const cv=el.querySelector('canvas'),ctx=cv.getContext('2d'),image=run.noiseImage||(run.noiseImage=ctx.createImageData(160,90));let seed=tick+38;
    for(let i=0;i<image.data.length;i+=4){seed=Math.imul(seed,1664525)+1013904223|0;const n=(seed>>>24)*.55;image.data[i]=n;image.data[i+1]=n;image.data[i+2]=n+20;image.data[i+3]=200;}ctx.putImageData(image,0,0);
  }
  function descent(dt){
    setDNTime(23);updateDayNight(dt);
    const t=run.t,set=run.set;run.phase=P.at('ride',t)[0];
    const lift=set.lift,mall=run.mall,origin=P.forest;
    const cabin=F.sample(Math.min(t,F.collapseStart),mall,origin,reduced()),height=cabin.cabin[1];
    const wreck=W.falling(t,F.fallStart,cabin,origin,run.cabinGroundY);
    lift.root.position.set(...wreck.position);lift.root.rotation.set(...wreck.rotation);lift.root.visible=t<F.blackoutStart||t>=F.forestStart;
    set.guides.position.set(cabin.cabin[0],0,cabin.cabin[2]);set.guides.rotation.y=cabin.yaw;set.guides.visible=t<F.blackoutStart;
    run.ui.querySelector('.fz-cabin-walk').hidden=!canWalk();noiseFrame(t);
    set.debris.visible=t<F.blackoutStart+.8;
    for(const [i,shard] of lift.shards.entries()){
      const motion=F.shard(Math.min(t,F.blackoutStart+.8),i,shard.userData.home);
      if(t>=F.fallStart){
        if(shard.parent===lift.root)set.debris.add(shard);
        const p=V(...motion.position).applyAxisAngle(V(0,1,0),cabin.yaw).add(V(...cabin.cabin));p.y=Math.max(.07,p.y);
        shard.position.copy(p);shard.rotation.set(...motion.rotation);shard.rotateY(cabin.yaw);
      }else{shard.position.set(...motion.position);shard.rotation.set(...motion.rotation);}
      shard.userData.crack.opacity=motion.crack;shard.userData.crackLine.visible=motion.crack>.001;
    }
    if(wreck.detached)cue('cabin-detach',()=>{SFX.noise(.45,.13,430);SFX.tone(65,.4,'triangle',.055,-25);});
    if(wreck.landed)cue('cabin-impact',()=>{SFX.thud();SFX.noise(.8,.12,240);FZLift38Wreck.adopt(lift.root,resources);run.wreckAdopted=true;});
    lift.root.updateMatrixWorld(true);
    const local=(x,y,z)=>lift.root.localToWorld(V(x,y,z)).toArray();
    for(const d of lift.doors)d.root.position.x=d.side*(C.mix(1.57,.54,(t-3)/1.6)+(reduced()?0:C.impulse(t-4.6,.008,7,19)));
    for(const [i,p] of set.puffs.entries()){
      p.position.set(lift.root.position.x+Math.cos(i*2.39996)*(12+i%4*9),height+((p.userData.y+t*7+70)%70)-35,lift.root.position.z+Math.sin(i*2.39996)*(12+i%4*9));p.visible=t<14&&Math.abs(p.position.y-height)<28;
    }
    lift.button.material.emissiveIntensity=t>=F.collapseStart?1.1:t>1.7?2:.5;
    lift.button.material.emissive.setHex(t>=F.collapseStart?0xff753d:0xa7caff);
    lift.button.position.x=-1.065-.008*C.ease((t-1.45)/.25)*(1-C.ease((t-2)/.25));
    if(t>1.7)cue('button',()=>SFX.tone(740,.13,'sine',.045));
    if(t>4.2)cue('doors',()=>SFX.door());
    if(t<F.flightStart){
      const turn=C.ease((t-2.3)/1.5),city=C.ease((t-11)/3);
      const position=local(-.65*(1-turn),1.62+(reduced()?0:C.impulse(t-5,-.035,2.7,8)),-.25-.4*turn);
      const view=local(-1.065*(1-turn),1.34+.11*turn,-.1+5.1*turn);
      const eye=V(...position),cityLook=V(mall.x,18,mall.z).sub(eye).normalize().multiplyScalar(5).add(eye).toArray();
      point(position,view.map((n,i)=>n+(cityLook[i]-n)*city));camera.fov=68-25*city;camera.updateProjectionMatrix();
      if(t>=16)walkingPoint(F.sample(t,mall,origin,reduced()));
      hands(scene,t<3?'press':'idle',t,dt,t<3?lift.button.getWorldPosition(V()):null);
      if(t<3){heading('','');caption('Нажимаю кнопку спуска.');fade(1-t/.4);}
      else if(t<5){heading('','');caption('Двери закрываются.');fade(0);}
      else if(t<12){heading('','');caption('');fade(0);}
      else if(t<16){heading('ГОРОД ПОД ОБЛАКАМИ','','GRAND MALL');caption('');fade(0);}
      else{heading('','','');if(t>16.2)cue('welcome',()=>voice('elevator-welcome','Добро пожаловать в Фантазию РП!'));}
    }else if(t<F.collapseStart){
      const shot=F.sample(t,mall,origin,reduced());
      walkingPoint(shot);camera.fov=shot.fov;camera.updateProjectionMatrix();
      hands(scene,'ride',t-F.flightStart,dt);heading('','','');fade(0);
      for(const line of F.narration)if(t>=line.start)cue(line.id,()=>voice(line.id,line.text));
      caption(F.caption(t));
    }else if(t<F.fallStart){
      const shot=F.sample(F.collapseStart,mall,origin,reduced()),motion=F.collapse(t,reduced());
      const pos=V(...shot.position).add(V(...W.offset(run.walk,shot.yaw)));pos.y-=motion.dip;
      const forward=V(...W.direction(shot,run.walk));
      const down=V(.85*Math.sin(shot.yaw),-3.8,.85*Math.cos(shot.yaw)).normalize();
      forward.lerp(down,motion.lookDown).normalize();
      point(pos.toArray(),pos.clone().addScaledVector(forward,5).toArray(),motion.roll);
      camera.fov=64;camera.updateProjectionMatrix();hands(scene,'brace',t-F.collapseStart,dt);
      heading('','','');caption('');fade(0);
      cue('floor-crack',()=>{stopVoice();SFX.noise(.18,.035,1700);SFX.noise(.28,.06,2600);SFX.tone(95,.35,'triangle',.035,-45);});
      if(t>F.collapseStart+1.4)cue('floor-break',()=>SFX.noise(.6,.095,3400));
    }else if(t<F.blackoutStart){
      cue('sudden-fall',()=>{FZSound.effect('fall');stopVoice();SFX.noise(.45,.10,700);});
      const u=t-F.fallStart,pos=V(...F.fall(t,origin)),last=F.sample(F.collapseStart,mall,origin,reduced());
      pos.add(V(...W.offset(run.walk,last.yaw)));
      const aim=V(.85*Math.sin(last.yaw),-3.8,.85*Math.cos(last.yaw)).normalize(),spin=F.tumble(t,reduced());
      camera.fov=spin.fov;camera.updateProjectionMatrix();
      point(pos.toArray(),pos.clone().addScaledVector(aim,10).toArray());
      camera.rotateX(spin.pitch);camera.rotateZ(spin.roll);camera.updateMatrixWorld(true);
      hands(scene,'fall',u,dt);heading('','');caption('');fade(0);
    }else if(t<F.titleStart){
      fade(1);FZHands30.hide();cue('unconscious',()=>{FZSound.effect('body-impact');stopBed();stopVoice();SFX.noise(.22,.07,250);});
    }else if(t<F.forestStart){
      FZHands30.hide();heading('','','');caption('');cue('dream-quiet',stopVoice);
      if(!run.dream)run.dream=FZNeon36Title.create(run.ui);
      run.dream.pose(t-F.titleStart,camera,reduced());fade(0);return;
    }else{
      if(run.dream){run.dream.dispose();run.dream=null;}
      camera.fov=68;camera.updateProjectionMatrix();
      cue('forest',()=>{landPosition();FZStory30Forest.update();FZSky.update();});
      const u=t-F.forestStart,p=localPlayer.mesh.position,recovery=C.recovery(u);
      if(u>1.2)cue('forest-rise',()=>FZSound.effect('stand'));
      if(u>3.7)cue('forest-cloth',()=>FZSound.effect('cloth'));
      point([p.x,p.y+recovery.height,p.z],[p.x+8,p.y+C.mix(.15,1.1,u/4.35),p.z-3.7],reduced()?0:C.impulse(u,.065,1.2,3.2));
      fade(Math.max(1-u/1.2,reduced()?0:recovery.blink));hands(scene,'recover',u,dt);
      if(u>2.3)caption('Рядом с обломками лежит фонарь. Тропа ведёт к старой станции «Лесная».');
    }
    FZStory30Forest.visibleForShot();
    const fog=scene.fog,bg=scene.background,cloudVisibility=(window.clouds||[]).map(o=>[o,o.visible]);
    for(const [o] of cloudVisibility)o.visible=false;
    if(t<14){scene.fog=new THREE.Fog(0xc4d1df,5,lerp(30,1100,(t-11)/3));scene.background=new THREE.Color(0xc4d1df);}
    else if(t<F.blackoutStart){scene.fog=new THREE.Fog(0x0c1425,160,1600);scene.background=new THREE.Color(0x080f20);}
    else FZStory30Forest.beforeRender();
    try{renderer.render(scene,camera);}finally{FZStory30Forest.afterRender();scene.fog=fog;scene.background=bg;for(const [o,v] of cloudVisibility)o.visible=v;}
  }
  function cleanup(){
    FZSound.stopEffects();
    if(!run)return null;const old=run;
    stopVoice();stopBed();FZHands30.hide();
    old.dream?.dispose();
    clearWalk();
    if(!old.wreckAdopted)old.set?.lift?.root.parent?.remove(old.set.lift.root);else old.set.lift.root.visible=true;
    old.set?.debris?.parent?.remove(old.set.debris);
    old.set?.guides?.parent?.remove(old.set.guides);
    for(const puff of old.clouds||[])puff.parent?.remove(puff);
    if(window.cine===old.token)window.cine=null;
    if(window.elevatorCut?.story30)window.elevatorCut=null;
    FZSky.suspendVisual();
    camera.near=old.near;camera.far=old.far;camera.fov=old.fov;camera.layers.mask=old.mask;camera.up.set(0,1,0);camera.updateProjectionMatrix();
    if(localPlayer?.mesh)localPlayer.mesh.visible=old.visibility;
    old.ui?.remove();document.body.classList.remove('fz-story-on');
    // Actor skins borrow original geometry, but own their cloned skeleton textures.
    for(const a of old.set?.actors||[])a.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});
    resources.forEach(r=>r.dispose?.());resources.clear();
    run=null;controls();if(old.focus?.isConnected)old.focus.focus({preventScroll:true});return old;
  }
  function finish(record=true){
    if(!run)return false;const kind=run.kind,callback=run.onArrival;
    cleanup();window.cameraMode='first';localPlayer.currentAnimation='idle';
    if(kind==='opening'){
      completedOpening=true;if(record)window.FZProgress40?.mark('opening');FZSky.spawn(localPlayer.mesh);window.cameraMode='first';cameraAngleH=Math.PI/2;cameraAngleV=.04;
      setNavTarget(18,-1392,'Стеклянные лифты',true);
    }else{
      completedRide=true;if(record)window.FZProgress40?.mark('ride');metroPending=!window.FZProgress40?.has('metro');landPosition();window.FZForest40?.begin();cameraAngleH=Math.atan2(13,-8);cameraAngleV=.06;route=0;
      setNavTarget(path[0][0],path[0][1],'Тропа в город',true);
    }
    isGrounded=true;FZSky.update();if(callback&&FZUI.playing())callback();return true;
  }
  function cancel(){window.FZFlash40?.light(false);window.FZProgress40?.cancel();window.FZFlash40?.clear();window.FZForest40?.end();pending=false;metroPending=false;if(route>=0&&window.navTarget?.label==='Тропа в город')clearNavTarget();route=-1;if(run)cleanup();FZLift38Wreck.clear();FZHands30.hide();}
  function followPath(){
    if(route<0||!localPlayer?.mesh)return;
    if(window.navTarget?.label!=='Тропа в город'){route=-1;return;}
    const p=localPlayer.mesh.position,target=path[route];
    if(Math.hypot(p.x-target[0],p.z-target[1])<4){route++;if(route>=path.length){route=-1;const e=FZMetro.info().stations?.find(e=>e.id==='forest');if(e)setNavTarget(e.x,e.z+4,'Метро · Лесная',true);else clearNavTarget();}else setNavTarget(path[route][0],path[route][1],'Тропа в город',true);}
  }
  function frame(dt){
    try{
      window.FZSave41?.frame();
      window.FZProgress40?.frame();
      if(pending&&FZHumans31.ready()&&!window._loadingGate&&FZUI.playing()&&!window.cine)begin('opening');
      if(!run){FZLift38Wreck.update();FZStory30Forest.update();followPath();return false;}
      soundFrame();
      if(!run.paused&&!document.hidden){
        const step=Math.min(run.kind==='ride'?F.stepLimit(run.t):.05,Math.max(0,Number.isFinite(dt)?dt:0));let next=run.t+step;
        if(run.kind==='ride'){
          const boundary=[F.narration[1].start,F.collapseStart].find(b=>run.t<b&&next>=b);
          const prefs=FZSound.info().prefs;
          if(boundary&&F.waitForVoice(run.audio,FZSound.audible()&&prefs.voice,run.audioBlocked,run.voiceWait||0)){
            run.voiceWait=(run.voiceWait||0)+step;next=boundary-.00001;
          }else run.voiceWait=0;
        }
        walkFrame(step);run.t=next;
      }
      if(run.t>=P.duration(run.kind)){finish();return false;}
      if(run.kind==='opening')opening(run.paused?0:dt);else descent(run.paused?0:dt);
      return true;
    }catch(error){lastError=String(error?.stack||error);console.error('Fantazia story:',error);if(run)finish(false);else pending=false;return false;}
  }
  window.addEventListener('keydown',e=>{
    if(!run)return;
    if(moveKeys[e.code]){e.preventDefault();if(canWalk())run.walkKeys.add(e.code);}
    else if(e.code==='Escape'){e.preventDefault();pause(!run.paused);}
    else if(e.code==='Tab'){
      const buttons=[...run.ui.querySelectorAll('button')].filter(b=>!b.closest('[hidden]')&&!b.disabled),i=buttons.indexOf(document.activeElement);e.preventDefault();if(buttons.length)buttons[(i+(e.shiftKey?-1:1)+buttons.length)%buttons.length].focus();else run.ui.focus();
    }else if(e.code==='Enter'||e.code==='Space'){
      if(document.activeElement?.matches('#fzStory30 button')){e.preventDefault();if(!e.repeat)document.activeElement.click();}
    }
    e.stopImmediatePropagation();
  },true);
  window.addEventListener('keyup',e=>{if(run&&moveKeys[e.code]){run.walkKeys.delete(e.code);e.preventDefault();e.stopImmediatePropagation();}},true);
  window.addEventListener('blur',clearWalk);
  document.addEventListener('visibilitychange',()=>{clearWalk();soundFrame();});
  window.addEventListener('pagehide',cancel);
  function restoreForest(){
    FZStory30Forest.build();FZForest40.begin();metroPending=!FZProgress40.has('metro');route=-1;
    const owned=new Set(),set=FZStory30Sets.ride(owned),cabin=set.lift.root,forest=FZStory30Forest.origin,mall=buildings.find(b=>b.type==='mall')||{x:131,z:-129};
    for(const shard of set.lift.shards)cabin.remove(shard);
    const yaw=Math.atan2(mall.x-forest.x,mall.z-forest.z),ground=FZLift38Wreck.groundHeight(cabin,yaw);
    cabin.rotation.order='YXZ';cabin.rotation.set(.12,yaw+.65,1.48);cabin.position.set(-480,ground,102);scene.add(cabin);FZLift38Wreck.adopt(cabin,owned);owned.forEach(r=>r.dispose?.());
    const e=FZMetro.info().stations.find(e=>e.id==='forest');if(e)setNavTarget(e.x,e.z+4,'Метро · Лесная',true);
  }
  window.FZStory30={restoreForest,night:()=>run?.kind==='ride',metroBreakPending:()=>metroPending,metroBreakTaken:()=>{metroPending=false;},arm,board,frame,cancel,finish,locked,pause,buildSky:FZStory30Sets.sky,
    info:()=>({pending,active:!!run,kind:run?.kind||'',phase:run?.phase||'',elapsed:run?.t||0,paused:!!run?.paused,completedOpening,completedRide,metroPending,cityMall:run?.mall||null,walk:run?.walk?{...run.walk}:null,walking:canWalk(),wreck:FZLift38Wreck.info(),dream:run?.dream?.info()||null,route,resources:resources.size,audioBlocked:!!run?.audioBlocked,cabinVisible:!!run?.set?.lift?.root.visible,cabinPosition:run?.set?.lift?.root.position.toArray()||null,cabinYaw:run?.set?.lift?.root.rotation.y??null,voiceWaiting:(run?.voiceWait||0)>0,voiceClip:run?.audio?.src.split('/').at(-1)||'',narrationCues:run?F.narration.filter(n=>run.cues.has(n.id)).map(n=>n.id):[],error:lastError})};
})();
