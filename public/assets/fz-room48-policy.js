/* Pure, bounded prologue simulation. Cosmetic glitches never stall the browser. */
(function(root){
 'use strict';
 const bounds={left:92,right:868,top:322,bottom:468};
 const objects=[{x:288,y:302,w:150,h:68},{x:590,y:272,w:208,h:65},{x:824,y:304,w:46,h:56}];
 const spots=[{id:'computer',x:684,y:360,label:'Компьютер · E'},{id:'letter',x:462,y:390,label:'Записка · E'},{id:'door',x:157,y:337,label:'Дверь · E'}];
 const durations={boot:3,erase:4,fracture:3,fade:1.4};
 const next={boot:'erase',erase:'fracture',fracture:'fade',fade:'done'};
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function create(){return {x:198,y:432,phase:'room',time:0,walk:0,moving:false,facing:1,target:null,message:'Подойди к светящемуся компьютеру. WASD / стрелки или касание пола — идти. E — действие.'};}
 function blocked(x,y){return objects.some(o=>x>o.x-10&&x<o.x+o.w+10&&y>o.y-8&&y<o.y+o.h+8);}
 function near(s){return spots.find(p=>Math.hypot(p.x-s.x,p.y-s.y)<52)||null;}
 function interact(s){
  if(s.phase!=='room')return false;
  const spot=near(s);if(!spot){s.message='Подойди ближе к компьютеру, записке или двери.';return false;}
  if(spot.id==='computer'){s.phase='boot';s.time=0;s.target=null;s.moving=false;s.message='На экране появилась строка: «Ты всё ещё здесь?»';}
  if(spot.id==='letter')s.message='Записка: «Если экран погаснет, не ищи выключатель. Ищи дорогу домой». Почерк похож на твой.';
  if(spot.id==='door')s.message='За дверью слышен дождь. Сначала нужно разобраться с компьютером.';
  return spot.id;
 }
 function target(s,x,y){if(s.phase!=='room'||!Number.isFinite(x)||!Number.isFinite(y))return;
  // Clicking a prop leads through the clear lower aisle, not through furniture.
  const spot=spots.find(p=>Math.hypot(p.x-x,p.y-y)<95);
  s.target=spot?[[s.x,414],[spot.x,414],[spot.x,spot.y]]:[[clamp(x,bounds.left,bounds.right),clamp(y,bounds.top,bounds.bottom)]];
 }
 function step(s,dt,input={}){
  dt=Number.isFinite(dt)?clamp(dt,0,2):0;
  if(s.phase==='done')return;
  if(s.phase!=='room'){
   s.time+=dt;
   while(s.phase!=='done'&&s.time>=durations[s.phase]){s.time-=durations[s.phase];s.phase=next[s.phase];}
   return;
  }
  dt=Math.min(.1,dt);s.time+=dt;
  let x=Number(input.x)||0,y=Number(input.y)||0;
  if(x||y)s.target=null;
  else if(s.target?.length){const p=s.target[0],dx=p[0]-s.x,dy=p[1]-s.y,d=Math.hypot(dx,dy);if(d<4){s.target.shift();}else{x=dx/d;y=dy/d;}}
  const length=Math.hypot(x,y);if(length>1){x/=length;y/=length;}
  const speed=145,px=s.x,py=s.y,nx=clamp(s.x+x*dt*speed,bounds.left,bounds.right),ny=clamp(s.y+y*dt*speed,bounds.top,bounds.bottom);
  if(!blocked(nx,s.y))s.x=nx;if(!blocked(s.x,ny))s.y=ny;
  s.moving=Math.hypot(s.x-px,s.y-py)>.01;
  if(s.moving){s.walk+=dt;if(x)s.facing=x>0?1:-1;}
 }
 const api={bounds,objects,spots,durations,create,near,target,step,interact};root.FZRoom48Policy=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
