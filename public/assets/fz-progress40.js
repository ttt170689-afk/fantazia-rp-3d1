/* Local checkpoint cache; FZSave41 synchronizes it with the account server.
 * Old welcome flags are not proof
 * that the entire new story was watched. An explicit lobby choice migrates old players. */
(function(root){
 'use strict';const fields=['opening','ride','metro','flash'];
 function clean(raw){return Object.fromEntries(fields.map(k=>[k,raw?.[k]===true]));}
 function key(name){return 'fz_story40:'+encodeURIComponent(String(name||'guest').toLowerCase());}
 if(typeof module!=='undefined'&&module.exports){module.exports={clean,key};return;}
 let owner='',state=clean(),storageOK=true,homePending=false,choice=null;
 const identity=()=>typeof currentUser!=='undefined'?currentUser?.username||'guest':'guest';
 function load(){const name=identity();if(owner===name)return;owner=name;try{state=clean(JSON.parse(localStorage.getItem(key(name))||'{}'));storageOK=true;}catch{state=clean();storageOK=false;}}
 function mark(field){load();if(!fields.includes(field))return;state[field]=true;save();}
 function save(notify=true){if(notify)window.FZSave41?.changed();try{localStorage.setItem(key(owner),JSON.stringify(state));storageOK=true;}catch{storageOK=false;}}
 function syncChoice(){
  const play=document.querySelector('#serverScreen .fz-play');if(!play)return;
  if(!choice){const label=document.createElement('label');label.className='fz-story-choice40';label.innerHTML='<input type="checkbox"> <span>Сюжет уже видел — не повторять сцены</span>';play.parentElement.append(label);const status=document.createElement("small");status.id="fzSaveState41";status.setAttribute("role","status");status.style.cssText="max-width:330px;color:#c8c4df;font:11px/1.4 Arial";status.textContent="Автосохранение на аккаунте · вход с последнего места";play.parentElement.append(status);choice=label.querySelector('input');choice.onchange=()=>{load();state={...state,opening:choice.checked,ride:choice.checked,metro:choice.checked};if(choice.checked)state.flash=true;save(false);window.FZSave41?.changed(!choice.checked);};}
  load();if(document.activeElement!==choice)choice.checked=state.ride;
 }
 function arm(){load();homePending=state.ride&&!window.FZSave41?.hasLocation();window.FZFlash40?.reset(!(state.flash||homePending));return {...state};}
 function spawnHome(){
  if(!homePending||!localPlayer?.mesh||window._loadingGate||!FZUI.playing()||window.cine)return false;
  const entry=interactables.find(e=>!e.interior&&(e.destination||e.type)==='house')||interactables.find(e=>!e.interior&&(e.destination||e.type)==='apartment');
  if(!entry)return false;
  window.FZForest40?.end();FZSky.suspendVisual();clearNavTarget();
  const p=localPlayer.mesh.position;p.set(entry.position.x,0,entry.position.z);FZSky.update();
  enterBuilding(entry.destination||entry.type,entry.name||'Дом');
  if(!FZBuildings.active())return false;
  // Existing furnished bedroom, not a disconnected replacement interior.
  const options=[[-14,-16],[-15,-16],[-13,-15],[-16,-14]];
  const safe=options.find(([x,z])=>!FZBuildings.collision(INTERIOR_BASE.x+x,INTERIOR_BASE.z+z));
  if(safe)p.set(INTERIOR_BASE.x+safe[0],.01,INTERIOR_BASE.z+safe[1]);
  window.cameraMode='first';cameraAngleH=Math.atan2(-4,-2);cameraAngleV=.12;window._spawnFixed=true;window._introDone=true;isGrounded=true;
  homePending=false;mark('flash');FZPlay.release();FZUI.grantLight();return true;
 }
 root.FZProgress40={apply:s=>{load();state=clean(s);save(false);},clean,key,arm,mark,has:k=>(load(),!!state[k]),syncChoice,frame:spawnHome,cancel:()=>{homePending=false;},info:()=>({owner,...state,storageOK,homePending})};
})(typeof window==='undefined'?globalThis:window);
