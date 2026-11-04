/* Deterministic story timing and boarding gates. No account flags, random skips,
 * permissions, timers, renderer or storage. The pre-login credits are separate. */
(function(root){
  'use strict';
  const opening=[['rain',0,4],['crossing',4,6],['impact',6,8],['funeral',8,14],['awakening',14,20]];
  const ride=[['press',0,3],['doors',3,5],['clouds',5,12],['city',12,16],['welcome',16,19],['narrated-ride',19,35.25],['collapse',35.25,37.25],['fall',37.25,40.75],['blackout',40.75,41.95],['dream-title',41.95,48.95],['forest',48.95,53.95]];
  const lifts=Array.from({length:5},(_,i)=>({x:11.2+i*3.4,y:358,z:-1371.3}));
  const forest={x:-490,y:.05,z:100}, exit={x:-382,y:0,z:74};
  const clamp=n=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
  const smooth=n=>{const t=clamp(n);return t*t*(3-2*t);};
  function at(kind,t){const list=kind==='ride'?ride:opening;return list.find(p=>t<p[2])||list[list.length-1];}
  function canBoard(p){return !!p&&['x','y','z'].every(k=>Number.isFinite(p[k]))&&lifts.some(l=>Math.abs(p.y-l.y)<.8&&Math.abs(p.x-l.x)<.8&&Math.abs(p.z-l.z)<1.5);}
  const api={opening,ride,lifts,forest,exit,clamp,smooth,at,canBoard,duration:kind=>kind==='ride'?53.95:20};
  root.FZStory30Policy=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
