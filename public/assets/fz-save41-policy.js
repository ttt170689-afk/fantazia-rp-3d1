(function(root){'use strict';
const Adventure=root.FZAdventure45Policy||(typeof require==='function'?require('./fz-adventure45-policy'):null);
function clean(raw) {
 if(!raw||raw.version!==1)return null;
 const s=raw.story;if(!s||['opening','ride','metro','flash'].some(k=>typeof s[k]!=='boolean'))return null;
 const story=Object.fromEntries(['opening','ride','metro','flash'].map(k=>[k,s[k]]));
 const point=(p,xz,y0,y1)=>p&&['x','y','z'].every(k=>Number.isFinite(p[k]))&&Math.abs(p.x)<=xz&&Math.abs(p.z)<=xz&&p.y>=y0&&p.y<=y1;
 let location=null;const l=raw.location;
 if(l){
  if(l.kind==='outdoor'&&point(l.position,598,-.2,1))location={kind:l.kind,position:{x:l.position.x,y:0,z:l.position.z}};
  if(l.kind==='sky'&&point(l.position,1500,345,365)&&Math.abs(l.position.x)<=100&&Math.abs(l.position.z+1400)<=100)location={kind:l.kind,position:{...l.position}};
  if(l.kind==='building'&&['house','apartment','office','bank','biz_bank','court','cinema','hospital'].includes(l.building)&&point(l.position,2100,0,80)&&Math.abs(l.position.x-2000)<26&&Math.abs(l.position.z-2000)<26&&point(l.outside,598,-.2,1))location={kind:l.kind,building:l.building,position:{...l.position},outside:{x:l.outside.x,y:0,z:l.outside.z}};
  if(!location)return null;
  location.yaw=Number.isFinite(l.yaw)?Math.atan2(Math.sin(l.yaw),Math.cos(l.yaw)):0;
  location.pitch=Number.isFinite(l.pitch)?Math.max(-1.2,Math.min(1.2,l.pitch)):0;
 }
 return {version:1,adventure45:Adventure.clean(raw.adventure45),story,location,health:Number.isFinite(raw.health)?Math.max(1,Math.min(100,raw.health)):100,flashOn:raw.flashOn===true&&story.flash,slot:raw.slot===2&&story.flash?2:1,forest:raw.forest===true&&location?.kind==='outdoor'&&location.position.x>=-590&&location.position.x<=-372&&location.position.z>=-4&&location.position.z<=200};
}

root.FZSave41Policy={clean};if(typeof module!=='undefined'&&module.exports)module.exports={clean};})(typeof window==='undefined'?globalThis:window);
