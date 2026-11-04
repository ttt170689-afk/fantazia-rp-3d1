/* Post-fall identity uses the same original transparent logo as the opening.
 * Owned by the story UI; no separate renderer, timers or font geometry. */
(function(root){
 'use strict';
 function create(host){
  const el=document.createElement('div');el.className='fz-neon36-title';el.setAttribute('aria-label','FANTAZIA RP 3D');
  const img=document.createElement('img');img.alt='FANTAZIA RP — 3D ONLINE';img.width=927;img.height=273;img.draggable=false;
  const fallback=document.createElement('p');fallback.textContent='FANTAZIA RP 3D';fallback.hidden=true;
  img.onerror=()=>{img.hidden=true;fallback.hidden=false;};img.src='assets/images/fantazia-logo-cutout.png';
  el.append(img,fallback);host.append(el);
  let time=0;const ease=n=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
  return {
   pose(t,camera,reduced=false){time=t;el.style.setProperty('--neon-alpha',String(ease(t/.7)*(1-ease((t-6.3)/.7))));el.style.setProperty('--neon-scale',String(reduced?1:.94+.075*ease(t/6)));el.style.setProperty('--neon-glow',(reduced?5:9+3*Math.sin(t*1.5))+'px');},
   info:()=>({text:'FANTAZIA RP 3D',style:'original-neon',image:img.getAttribute('src'),elapsed:time,crossed:false}),
   dispose(){img.onerror=null;el.remove();}
  };
 }
 root.FZNeon36Title={create};
})(typeof window==='undefined'?globalThis:window);
