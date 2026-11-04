/* Bounded native metro motion; no scene ownership or competing clock. */
(function(root){
 'use strict';const clamp=n=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0)),ease=n=>{const t=clamp(n);return clamp(t*t*t*(t*(t*6-15)+10));};
 function door(open,sign,base){const u=ease(open);return {x:base+sign*1.12*u,z:-3.88+.075*Math.sin(Math.PI*u)};}
 function arrival(elapsed,duration){return 65*(1-ease(elapsed/duration));}
 function label(w,h){return {width:1024,height:Math.max(32,Math.round(1024*h/w))};}
 const api={ease,door,arrival,label};root.FZMetro36Motion=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
