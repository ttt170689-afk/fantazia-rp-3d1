/* Real-city aerial tour, sampled in story seconds. Anchors come from the existing
 * mall mesh; the endpoint is the existing western forest, not a replacement map. */
(function(root){
 'use strict';
 const C=root.FZCinematic32||(typeof require==='function'?require('./fz-cinematic32.js'):null);
 const flightStart=19,fallStart=37,blackoutStart=39.6,titleStart=40.8,forestStart=47.8,end=52.8;
 const narration=[
  {id:'city-flight-a',start:19.15,end:27.8,text:'Перед тобой Фантазия — город новой жизни. Внизу шумят улицы, светится Гранд Молл, а поезда связывают районы.'},
  {id:'city-flight-b',start:28.2,end:36.3,text:'Здесь можно найти работу, друзей и собственный дом. Но что привело сюда именно тебя?'}
 ];
 const captions=[
  [19.15,22.15,'Перед тобой Фантазия — город новой жизни.'],
  [22.15,27.8,'Внизу шумят улицы, светится Гранд Молл, а поезда связывают районы.'],
  [28.2,32.3,'Здесь можно найти работу, друзей и собственный дом.'],
  [32.3,36.3,'Но что привело сюда именно тебя?']
 ];
 function start(mall){const yaw=Math.atan2(85,-160);return [mall.x-85-.65*Math.sin(yaw),121.62,mall.z+160-.65*Math.cos(yaw)];}
 function sample(time,mall,forest,reduced=false){
  const t=Math.max(0,Math.min(18,time-flightStart));
  const position=C.path([[0,start(mall)],[4.5,[mall.x+80,155,mall.z+210]],[9.5,[mall.x-85,170,mall.z+285]],[14,[forest.x+220,155,forest.z+35]],[18,[forest.x,140,forest.z]]],t);
  const look=C.path([[0,[mall.x,18,mall.z]],[4.5,[mall.x,22,mall.z]],[9.5,[mall.x,12,mall.z+85]],[14,[mall.x-60,20,mall.z+140]],[18,[mall.x,22,mall.z]]],t);
  return {position,look,fov:43+15*C.ease(t/3.5),roll:reduced?0:Math.sin(t*Math.PI/9)*.018};
 }
 function fall(time,forest){
  const seconds=Math.max(0,Math.min(2.6,time-fallStart));
  const speed=(130-4.905*2.6*2.6)/2.6;
  return [forest.x,140-speed*seconds-4.905*seconds*seconds,forest.z];
 }
 const api={flightStart,fallStart,blackoutStart,titleStart,forestStart,end,narration,start,sample,fall,caption:t=>captions.find(c=>t>=c[0]&&t<c[1])?.[2]||''};
 root.FZFlight33Policy=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
