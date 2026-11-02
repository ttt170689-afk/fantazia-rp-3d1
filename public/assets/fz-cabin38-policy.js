/* Local cabin movement and authored detached-cabin flight. No global input/RAF. */
(function(root){
 'use strict';const C=root.FZCinematic32||(typeof require==='function'?require('./fz-cinematic32.js'):null);
 const bounds={minX:-.76,maxX:.76,minZ:-1.24,maxZ:1.08},wreckOffset={x:10,z:2};
 function allowed(kind,t,paused=false,hidden=false){return kind==='ride'&&t>=16&&t<35.25&&!paused&&!hidden;}
 function walk(s,input,dt){
  let right=input.right||0,forward=input.forward||0,n=Math.hypot(right,forward);if(n>1){right/=n;forward/=n;}
  const step=Math.max(0,Math.min(.05,Number.isFinite(dt)?dt:0))*1.15;
  const x=Math.max(bounds.minX,Math.min(bounds.maxX,s.x+(Math.sin(s.yaw)*forward-Math.cos(s.yaw)*right)*step));
  const z=Math.max(bounds.minZ,Math.min(bounds.maxZ,s.z+(Math.cos(s.yaw)*forward+Math.sin(s.yaw)*right)*step));
  return {...s,x,z,distance:s.distance+Math.hypot(x-s.x,z-s.z)};
 }
 function offset(s,yaw){return [s.x*Math.cos(yaw)+(s.z+.65)*Math.sin(yaw),0,-s.x*Math.sin(yaw)+(s.z+.65)*Math.cos(yaw)];}
 function direction(shot,s){
  const pitch=Math.max(-1.3,Math.min(.8,Math.atan2(shot.look[1]-shot.position[1],Math.hypot(shot.look[0]-shot.position[0],shot.look[2]-shot.position[2]))+s.pitch));
  return [Math.sin(shot.yaw+s.yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(shot.yaw+s.yaw)*Math.cos(pitch)];
 }
 function spot(forest){return {x:forest.x+wreckOffset.x,z:forest.z+wreckOffset.z};}
 function falling(time,start,shot,forest,groundY){
  const u=time-start-.18,q=C.clamp(u/3.65),drift=C.ease(q/.65),site=spot(forest),drop=.15*q+.85*q*q;
  return {position:[shot.cabin[0]+(site.x-shot.cabin[0])*drift,shot.cabin[1]+(groundY-shot.cabin[1])*drop,shot.cabin[2]+(site.z-shot.cabin[2])*drift],rotation:[.12*C.ease(q),shot.yaw+.65*C.ease(q),1.48*C.ease(q)],detached:u>=0,landed:q>=1};
 }
 const api={bounds,wreckOffset,allowed,walk,offset,direction,spot,falling};root.FZCabin38Policy=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
