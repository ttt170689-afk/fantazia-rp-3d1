/* Shared deterministic animation curves. Seconds, not frame counters. No DOM,
 * renderer, random state, timers or allocations of scene resources. */
(function(root){
 'use strict';
 const clamp=n=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
 const ease=n=>{const t=clamp(n);return t*t*t*(t*(t*6-15)+10);};
 const mix=(a,b,t)=>a+(b-a)*ease(t);
 // C1-continuous, monotone cubic interpolation: no stop at an interior key,
 // no overshoot through a floor/wall. Zero slope at a hold or direction change.
 function track(keys,time){
  if(!Number.isFinite(time))time=keys[0][0];
  if(time<=keys[0][0])return keys[0][1];if(time>=keys.at(-1)[0])return keys.at(-1)[1];
  let i=0;while(time>keys[i+1][0])i++;
  const slope=j=>(keys[j+1][1]-keys[j][1])/(keys[j+1][0]-keys[j][0]);
  const tangent=j=>{if(j===0||j===keys.length-1)return 0;const a=slope(j-1),b=slope(j);if(a*b<=0)return 0;const h0=keys[j][0]-keys[j-1][0],h1=keys[j+1][0]-keys[j][0],w0=2*h1+h0,w1=h1+2*h0;return (w0+w1)/(w0/a+w1/b);};
  const h=keys[i+1][0]-keys[i][0],u=(time-keys[i][0])/h,u2=u*u,u3=u2*u;
  const value=(2*u3-3*u2+1)*keys[i][1]+(u3-2*u2+u)*h*tangent(i)+(-2*u3+3*u2)*keys[i+1][1]+(u3-u2)*h*tangent(i+1);
  return Math.max(Math.min(keys[i][1],keys[i+1][1]),Math.min(Math.max(keys[i][1],keys[i+1][1]),value));
 }
 function path(keys,time){return [0,1,2].map(axis=>track(keys.map(k=>[k[0],k[1][axis]]),time));}
 const impulse=(t,amplitude=.03,decay=4,frequency=13)=>t<0?0:amplitude*Math.exp(-decay*t)*Math.sin(frequency*t);
 const envelope=(t,start,end)=>{const u=clamp((t-start)/(end-start));return Math.sin(u*Math.PI)**2;};
 function handheld(t,amplitude=1){const a=Math.max(0,Math.min(.14,amplitude));return [Math.sin(t*11.3)+.35*Math.sin(t*23.1),Math.sin(t*14.7+.7)*.7,Math.sin(t*9.1+1.2)*.4].map(v=>v*a*.5);}
 function travel(t,influenceIn=1,influenceOut=1){const u=clamp(t),m0=(1-clamp(influenceIn))*1.4,m1=(1-clamp(influenceOut))*1.4;return (-2*u*u*u+3*u*u)+(u*u*u-2*u*u+u)*m0+(u*u*u-u*u)*m1;}
 function funeral(t,reduced=false){
  const position=path([[0,[5.3,2.65,4.7]],[1.8,[4.8,2.35,3.9]],[3.8,[3.55,1.84,1.3]],[5.7,[3.05,1.69,-.2]],[6,[3.05,1.69,-.2]]],t);
  const look=path([[0,[0,.65,0]],[1.8,[.2,.75,0]],[3.8,[1.9,1.48,-1.4]],[5.4,[2.1,1.57,-1.6]],[6,[2.1,1.57,-1.6]]],t);
  if(!reduced)position[0]+=.2*envelope(t,0,5.7);
  return {position,look,fov:mix(64,48,(t-2)/3.7),roll:reduced?0:.008*envelope(t,1,5)};
 }
 function recovery(t){return {height:track([[0,.35],[.9,.4],[1.8,.72],[2.7,1.13],[4.35,1.62],[5,1.62]],t),support:1-ease((t-1.2)/2.4),blink:.72*envelope(t,.65,1.05)};}
 function shard(t,index,home){const r=Math.hypot(home[0],home[2]),u=Math.max(0,t-24.4-r*.13-(index%3)*.025);return {u,position:[home[0]+(home[0]*.5+Math.sin(index*7.1)*.17)*u,home[1]+.25*u-4.9*u*u,home[2]+(home[2]*.4+Math.cos(index*4.7)*.17)*u],rotation:[u*(.7+index%3)*.6,u*Math.sin(index)*.6,u*(index%2?1:-1)*1.1],crack:ease((t-23.65-r*.15)/.35)*(1-ease((t-25.6)/.7))};}
 const api={clamp,ease,mix,track,path,impulse,envelope,handheld,travel,funeral,recovery,shard};
 root.FZCinematic32=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
