/* Forward-only walk home. The bumper reaches the pedestrian at t=6 exactly;
 * reaction starts AFTER contact. No warning turn, run or anticipatory hands. */
(function(root){
 'use strict';const C=root.FZCinematic32||(typeof require==='function'?require('./fz-cinematic32.js'):null);
 const contact=6,speed=30,bumper=2.275;
 function sample(time,reduced=false){
  const t=Math.max(0,Number.isFinite(time)?time:0),u=Math.max(0,t-contact),walk=Math.min(t,contact),strike=C.ease(u/.16);
  const sway=reduced?0:Math.sin(walk*7)*.008,bob=reduced?0:(1-Math.cos(walk*14))*.009;
  const position=[sway+(reduced?0:.13*strike),1.66+bob-(reduced?0:.22*strike),8.5-1.3*walk+(reduced?0:.28*strike)];
  const look=[position[0]+(reduced?0:1.8*strike),1.35-(reduced?0:1.4*strike),position[2]-12];
  return {position,look,carX:-bumper+speed*(t-contact),roll:reduced?0:Math.sin(walk*7)*.002-.07*strike,fov:68+(reduced?0:5*strike),black:C.clamp((t-contact-.015)/.105),reaction:t>=contact};
 }
 const api={contact,speed,bumper,sample};root.FZImpact35Policy=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
