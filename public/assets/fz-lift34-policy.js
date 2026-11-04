/* v38: fixed vertical shaft. No horizontal tour or moving city waypoints.
 * All motion is sampled in scene seconds; audio barriers live in the owner. */
(function(root){
 'use strict';
 const C=root.FZCinematic32||(typeof require==='function'?require('./fz-cinematic32.js'):null);
 const Tour=root.FZFlight33Policy||(typeof require==='function'?require('./fz-flight33-policy.js'):null);
 const flightStart=19,collapseStart=35.25,fallStart=37.25,blackoutStart=40.75,titleStart=41.95,forestStart=48.95,end=53.95;
 const narration=Tour.narration.map(n=>({...n,end:Math.min(n.end,collapseStart)}));
 function height(time){
  const u=Math.max(0,Math.min(collapseStart,Number.isFinite(time)?time:0)-5);
  return 358-2.65*(u<2?u*u*u/4-u*u*u*u/16:u-1);
 }
 function sample(time,mall,forest,reduced=false){
  const yaw=Math.atan2(mall.x-forest.x,mall.z-forest.z);
  return {position:[forest.x,height(time)+1.62,forest.z],
   cabin:[forest.x+.65*Math.sin(yaw),height(time),forest.z+.65*Math.cos(yaw)],
   yaw,look:[mall.x,18,mall.z],fov:43+21*C.ease((time-flightStart)/2.2),roll:0};
 }
 function collapse(time,reduced=false){const u=Math.max(0,time-collapseStart);return {dip:.12*C.ease((u-1.3)/.7),lookDown:C.ease(u/1.8),roll:reduced?0:C.impulse(u,.018,3,19)};}
 function fall(time,forest){
  const q=C.clamp((time-fallStart)/(blackoutStart-fallStart)),top=height(collapseStart)+1.5;
  return [forest.x,top-(top-10)*(.15*q+.85*q*q),forest.z];
 }
 function tumble(time,reduced=false){
  const u=Math.max(0,time-fallStart),q=C.clamp(u/(blackoutStart-fallStart));
  const turn=C.track([[0,0],[.12,.03],[.28,.2],[.52,.72],[.74,1],[1,1]],q);
  return {pitch:reduced?0:Math.PI*2*turn,roll:reduced?0:Math.PI*C.track([[0,0],[.2,.12],[.48,.43],[.74,0],[1,0]],q),fov:reduced?64:64+15*C.ease(u/.5)+7*C.envelope(u,.7,3.45)};
 }
 function interference(time,reduced=false){
  if(reduced||time<=collapseStart||time>=fallStart)return 0;
  const u=time-collapseStart;
  // Two separated, low-contrast bursts, not fullscreen rapid white flashes.
  return Math.max(.62*C.envelope(u,.05,.90),.68*C.envelope(u,1.02,1.95));
 }
 function shard(time,index,home){const u=time-collapseStart;return C.shard(23.65+(u<1.35?u*.6/1.35:.6+(u-1.35)*2),index,home);}
 // Ended/error/blocked/muted audio never deadlocks a ride; stalled downloads
 // have a bounded 12 scene-second grace period. Pause freezes that allowance.
 function waitForVoice(audio,enabled,blocked,wait){return !!(audio&&enabled&&!blocked&&!audio.ended&&!audio.error&&wait<12);}
 const api={flightStart,collapseStart,fallStart,blackoutStart,titleStart,forestStart,end,narration,height,sample,collapse,fall,tumble,interference,shard,waitForVoice,stepLimit:t=>t>=fallStart&&t<blackoutStart?.25:.05,caption:t=>t<collapseStart?Tour.caption(t):''};
 root.FZLift34Policy=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
