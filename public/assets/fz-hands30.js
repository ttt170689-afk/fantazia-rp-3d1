/* Project-owned Fantazia arm skin: two-bone IK + 30 independently posed finger
 * joints. One cached rig, no RAF/timers, used by story and empty-handed gameplay.
 * The existing flashlight/sword grips remain authoritative for their slots. */
(function () {
  'use strict';
  let gaitPhase=0,gaitSpeed=0;
  let task, rig, group, failure = '', lastMode = '', lastCameraQ,pointMesh=null,tipIDs=[],contactError=null,lastPoseTime=null;
  const arms = [], rest = new Map(), owned = new Set();
  const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  function load() {
    if (task) return task;
    task = new Promise((resolve) => {
      new THREE.GLTFLoader().load('assets/models/story-hands30.glb?v=30.1', gltf => {
        rig = gltf.scene;
        group = new THREE.Group(); group.name = 'Fantazia articulated first-person hands';
        group.add(rig); rig.scale.setScalar(.82); rig.position.set(0,-1.30,-.09);
        rig.traverse(o => {
          if (o.isBone) rest.set(o, o.quaternion.clone());
          if (!o.isMesh) return;
          o.frustumCulled = false; o.castShadow = false; o.receiveShadow = false;
          o.layers.enable(2);
          owned.add(o.geometry); owned.add(o.material); if(o.material.map)owned.add(o.material.map);
          o.material.roughness = .75;
          o.material.emissive.setHex(0x555555); o.material.emissiveMap = o.material.map;
        });
        rig.updateMatrixWorld(true);
        for (const [side, sign] of [['Left',-1],['Right',1]]) {
          const upper = rig.getObjectByName(side+'UpperArm'), lower = rig.getObjectByName(side+'LowerArm'), hand = rig.getObjectByName(side+'Hand');
          const p = upper.getWorldPosition(V()), e = lower.getWorldPosition(V()), h = hand.getWorldPosition(V());
          arms.push({side,sign,upper,lower,hand,l1:p.distanceTo(e),l2:e.distanceTo(h),target:V(sign*.25,-.30,-.36)});
        }
        rig.traverse(o=>{if(o.isSkinnedMesh&&o.skeleton.bones.some(b=>b.name==='RightIndexDistal'))pointMesh=o;});
        if(pointMesh){const g=pointMesh.geometry,joint=pointMesh.skeleton.bones.findIndex(b=>b.name==='RightIndexDistal'),a=g.attributes.skinIndex.array,w=g.attributes.skinWeight.array,hand=arms[1].hand.getWorldPosition(V()),candidates=[];
          for(let i=0;i<g.attributes.position.count;i++)if([0,1,2,3].some(k=>a[i*4+k]===joint&&w[i*4+k]>.5)){
            const v=V().fromBufferAttribute(g.attributes.position,i);pointMesh.boneTransform(i,v);pointMesh.localToWorld(v);candidates.push({i,d:v.distanceToSquared(hand)});
          }tipIDs=candidates.sort((a,b)=>b.d-a.d).slice(0,4).map(v=>v.i);
        }
        resolve(true);
      }, undefined, e => { failure = String(e?.message || 'Arm asset unavailable'); resolve(false); });
    });
    return task;
  }
  function turn(bone, from, to) {
    if(from.lengthSq()<1e-8 || to.lengthSq()<1e-8)return;
    const q = new THREE.Quaternion().setFromUnitVectors(from.normalize(),to.normalize());
    const world = bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(q);
    bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));
    group.updateMatrixWorld(true);
  }
  function poseArm(a,target,mode,time,curl) {
    const shoulder=a.upper.getWorldPosition(V());
    const goal=group.localToWorld(target.clone()), direction=goal.clone().sub(shoulder);
    const length=clamp(direction.length(),.08,a.l1+a.l2-.008); direction.normalize();
    goal.copy(shoulder).addScaledVector(direction,length);
    const along=(a.l1*a.l1-a.l2*a.l2+length*length)/(2*length);
    const pole=V(a.sign,-.9,.15).applyQuaternion(group.quaternion);
    pole.addScaledVector(direction,-pole.dot(direction)).normalize();
    const elbow=shoulder.clone().addScaledVector(direction,along).addScaledVector(pole,Math.sqrt(Math.max(0,a.l1*a.l1-along*along)));
    turn(a.upper,a.lower.getWorldPosition(V()).sub(shoulder),elbow.sub(shoulder));
    const p=a.lower.getWorldPosition(V());
    turn(a.lower,a.hand.getWorldPosition(V()).sub(p),goal.sub(p));
    const middle=rig.getObjectByName(a.side+'MiddleProximal');
    const cover=mode==='fall'?FZCinematic32.ease((time-2.35)/.65):0;
    const dir=cover>.5?V(-a.sign*.25,1,.15):mode==='metroFall' ? (time<.55?V(a.sign*.12,.65,-.5):V(a.sign*.16,.08,-1)) : mode==='glass' ? V(0,1,-.08) : mode==='awake' ? V(-a.sign*.12,.8,-.45) : mode==='fall'||mode==='brace'||mode==='metroFall' ? V(a.sign*.18,.96,-.12) : V(-a.sign*.1,.05,-1);
    turn(a.hand,middle.getWorldPosition(V()).sub(a.hand.getWorldPosition(V())),dir.applyQuaternion(group.quaternion));
    // Wrist roll opens the palms for examination/contact, not a rigid arm bob.
    a.hand.rotateY(a.sign*(cover>.5?.35:mode==='metroFall' ? (time<.55?-.85:-.2) : mode==='awake' ? .50 : mode==='glass' ? -1.15 : mode==='brace'||mode==='fall'||mode==='metroFall' ? -1.15 : .18));
    // The thumb opposes the palm, rather than behaving like a fifth parallel
    // finger. Its palm-weighted basal ring stays attached during abduction.
    const thumbSpread=cover>.5?.85:mode==='brace'?.85:mode==='press'?.85:mode==='glass'?.78:mode==='awake'?.90:mode==='fall'?.95:.52;
    for (const [digit,index] of ['Index','Middle','Ring','Little','Thumb'].map((v,i)=>[v,i])) {
      for (const [segment,j] of ['Proximal','Intermediate','Distal'].map((v,i)=>[v,i])) {
        const b=rig.getObjectByName(a.side+digit+segment);
        const breath=(mode==='awake' ? Math.sin(time*2.3+index*.6+a.sign)*.08 : 0);
        if(digit==='Thumb') {
          if(j===0)b.rotateZ(a.sign*thumbSpread);
          b.rotateX((mode==='press'?.25:curl+breath)*(j===0?.20:j===1?.42:.30));
        } else {
          b.rotateX((mode==='press'&&a.sign===1&&digit==='Index'?.025:curl+breath)*(j===0?.65:j===1?.95:.55));
          if(j===0)b.rotateZ(a.sign*(index-1.5)*(mode==='glass'||mode==='fall'||mode==='brace'?.075:.025));
        }
      }
    }
  }
  function visibleTip(){
    if(!pointMesh||!tipIDs.length)return rig.getObjectByName('RightIndexDistal').getWorldPosition(V());
    const sum=V();for(const i of tipIDs){const v=V().fromBufferAttribute(pointMesh.geometry.attributes.position,i);pointMesh.boneTransform(i,v);pointMesh.localToWorld(v);sum.add(v);}return sum.multiplyScalar(1/tipIDs.length);
  }
  function update(owner, cam, mode, time, dt=.016, reduced=false, contact=null) {
    if(!group){load();return false;}
    if(group.parent!==owner){group.parent?.remove(group);owner.add(group);}
    group.visible=true; group.position.copy(cam.position); group.quaternion.copy(cam.quaternion);
    // A paused contact solve must not creep closer to the button on each render.
    if(dt===0&&lastMode===mode&&lastPoseTime===time)return true;
    rest.forEach((q,b)=>b.quaternion.copy(q)); group.updateMatrixWorld(true);
    const blend=lastMode===mode ? 1-Math.exp(-dt*9) : 1-Math.exp(-dt*6);
    const sway=reduced?0:Math.min(.025,(lastCameraQ ? 1-Math.abs(lastCameraQ.dot(cam.quaternion)) : 0)*10);
    if(!lastCameraQ)lastCameraQ=cam.quaternion.clone();else lastCameraQ.copy(cam.quaternion);
    gaitSpeed+=((mode==='run'?10:mode==='walk'?7:0)-gaitSpeed)*(1-Math.exp(-dt*6));gaitPhase+=dt*gaitSpeed;
    const configs=[];
    for(const a of arms){
      let x=a.sign*.24,y=-.34,z=-.36,curl=.28;
      const wave=reduced?0:Math.sin(gaitPhase+a.sign*Math.PI/2);
      if(mode==='run'||mode==='walk'){y+=wave*.055;z+=wave*.075;curl=.5;}
      if(mode==='awake'){const lift=FZStory30Policy.smooth((time-.15)/1.3);x=a.sign*.19;y=-.30+.17*lift+Math.sin(time*1.2+a.sign)*.009;z=-.34-.09*lift;curl=.38-.24*lift;}
      if(mode==='press'&&a.sign===1){const reach=FZStory30Policy.smooth(time/1.7)*(1-FZStory30Policy.smooth((time-2)/.8));x=.04;y=-.34+reach*.29;z=-.36-reach*.10;curl=.95;}
      if(mode==='glass'){x=a.sign*.22;y=-.03;z=-.50;curl=.035;}
      if(mode==='brace'){const q=FZStory30Policy.smooth(time/.32);x=a.sign*(.22+.04*q);y=-.3+q*(a.sign===1?.20:.26);z=-.46-.08*q;curl=.20-.14*q;}
      if(mode==='ride'){const settle=FZStory30Policy.smooth(time/1.2);x=a.sign*(.24+.015*settle);y=-.34+(reduced?0:Math.sin(time*1.4+a.sign)*.006);z=-.38;curl=.18;}
      if(mode==='fall'){
        const k=FZCinematic32,reach=k.envelope(time,a.sign===1?.02:.15,.85),brace=k.ease((time-2.35)/.85);
        const cover=k.ease((time-2.35)/.65),swing=reduced?0:Math.sin(time*8+a.sign*1.7)*.085*(1-cover);
        x=a.sign*(.27-.1*reach)*(1-cover)+a.sign*.085*cover+swing;
        y=(-.14+.18*reach)*(1-cover)+.015*cover+(reduced?0:Math.cos(time*7+a.sign)*.055*(1-cover));
        z=(-.48+.12*reach)*(1-cover)-.18*cover;curl=.08+.18*k.envelope(time,.8,2.3);
      }
      if(mode==='metroFall'){
        const k=FZCinematic32,catchFloor=k.ease((time-.3)/.45),rise=k.ease((time-3.1)/1.7),plant=k.envelope(time,1.45,3.7);
        const flail=reduced?0:k.envelope(time,.05,.72)*Math.sin(time*16+a.sign)*.065;
        x=a.sign*(.24+.055*catchFloor-.045*rise)+flail;y=k.track([[0,-.27],[.22,-.08],[.76,-.2],[1.7,-.2],[2.8,-.3],[4.8,-.34]],time)+(a.sign===1?-.025*plant:.025*plant);z=-.48+.1*rise+(a.sign===1?.06:-.025)*k.envelope(time,.1,.85);curl=.08+.22*rise;
      }
      if(mode==='swim'){const stroke=reduced?0:Math.sin(time*3.2+a.sign*Math.PI/2);x=a.sign*(.26+.08*stroke);y=-.25+stroke*.05;z=-.42-stroke*.1;curl=.12;}
      if(mode==='medicate'){const reach=FZStory30Policy.smooth(time/.8);x=a.sign===1?.06:.20*a.sign;y=a.sign===1?-.32+reach*.16:-.22;z=a.sign===1?-.4+reach*.08:-.35;curl=.4;}
      if(mode==='recover'){const rise=FZStory30Policy.smooth((time-1.2)/2.5);x=a.sign*(.32-.08*rise);y=-.2-.14*rise;z=-.48+.12*rise;curl=.08+.2*rise;}
      a.target.lerp(V(x+sway,y,z),blend);
      configs.push([a,curl]);poseArm(a,a.target,mode,time,curl);
    }
    if(mode==='press'&&contact){
      const reach=Math.max(0,Math.min(1,time/1.6))*(1-Math.max(0,Math.min(1,(time-2)/.8))),right=arms[1];
      for(let pass=0;pass<3;pass++){
        const tip=visibleTip();
        const delta=group.worldToLocal(contact.clone()).sub(group.worldToLocal(tip));
        if(delta.length()>.12)delta.setLength(.12);right.target.addScaledVector(delta,reach);
        rest.forEach((q,b)=>b.quaternion.copy(q));group.updateMatrixWorld(true);
        for(const [a,curl] of configs)poseArm(a,a.target,mode,time,curl);
      }
    }
    contactError=contact?visibleTip().distanceTo(contact):null;
    lastMode=mode;lastPoseTime=time; return true;
  }
  function hide(){if(group)group.visible=false;lastMode='';lastCameraQ=null;lastPoseTime=null;}
  function gameplay(dt){
    const show=window.cameraMode==='first' && !window.cine && !window.elevatorCut && !localCar && localPlayer?.mesh && ITEMS.slot===1 && document.body.classList.contains('game-active');
    if(!show){hide();return;}
    if(window.FZSurvival45?.pose())return;
    update(scene,camera,localPlayer.currentAnimation||'idle',animationTime,dt,!!window.FZPlay?.reducedMotion());
  }
  window.FZHands30={load,update,hide,gameplay,view:()=>group,info:()=>({ready:!!rig,error:failure,arms:arms.length,fingerJoints:[...rest.keys()].filter(b=>/Proximal|Intermediate|Distal/.test(b.name)).length,pose:lastMode,contactError,visible:!!group?.visible})};
})();
