'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require('jsdom'),THREE=require('three');
const P=require('../public/assets/fz-adventure45-policy'),Save=require('../public/assets/fz-save41-policy'),J=require('../public/assets/fz-journal47');
const root=path.resolve(__dirname,'..'),source=name=>fs.readFileSync(path.join(root,'public/assets',name),'utf8');
const added=['return','bench','signal'],legacy=P.ids.filter(id=>!added.includes(id));
assert.equal(P.notes.length,15);assert.equal(new Set(P.ids).size,15);
assert(P.notes.every(n=>n.text.length>200));
const original={notes:legacy,looted:['archive-box'],tablets:6,kits:2,relay:true};
const cleaned=P.clean(original);assert.equal(cleaned.notes.length,12);assert.deepEqual(cleaned.looted,original.looted);assert.equal(cleaned.tablets,6);
assert(!added.some(id=>cleaned.notes.includes(id)),'old saves must not auto-discover new content');
const snapshot=Save.clean({version:1,story:{opening:true,ride:true,metro:true,flash:true},adventure45:{...original,notes:[...legacy,...added,'unknown'],money:999}});
assert.equal(snapshot.adventure45.notes.length,15);assert.equal(snapshot.adventure45.kits,2);assert(!('money' in snapshot.adventure45));
assert.equal(J.search([{title:'ТЁПЛЫЙ БЕРЕГ',text:'Ночная смена',place:'Архив'}],'  теплый  смена ','Архив').length,1);
assert.equal(J.search(P.notes,'квитанция','Лечебный корпус').length,0);
assert.equal(J.search(P.notes,'квитанция','Архив')[0].id,'return');

const dom=new JSDOM('<!doctype html><body><button id="opener">Дневник</button></body>',{url:'https://game.test',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
w.HTMLCanvasElement.prototype.getContext=()=>({fillStyle:'',font:'',textAlign:'',fillRect(){},fillText(){},measureText:t=>({width:t.length*14})});
let changes=0,playing=true;
Object.assign(w,{THREE,FZAdventure45Policy:P,scene:new THREE.Scene(),localPlayer:{mesh:new THREE.Group(),health:80},interactables:[],
 isInsideBuilding:false,isInFactory:false,isInBasement:false,cityWorldReady:()=>true,
 FZUI:{playing:()=>playing,close(){}},FZPlay:{release(){}},FZForest40:{required:()=>false},FZSky:{active:()=>false},
 FZRoads:{props:[],find:(x,z)=>({x,z}),rect:(x,z,width,depth)=>({x,z,width,depth})},
 FZSave41:{changed:()=>changes++},FZSound:{effect(){}},setNavTarget(){},showNotification(){},togglePanel(){}});
for(const name of ['fz-cinematic32.js','fz-journal47.js','fz-lore45.js'])vm.runInContext(source(name),dom.getInternalVMContext());
const L=w.FZLore45,opener=w.document.getElementById('opener');
function click(text){const b=[...w.document.querySelectorAll('#fzLore45 button')].find(b=>b.textContent===text);assert(b,text);b.click();return b;}
function collect(id){const note=w.interactables.find(e=>e.action==='note'&&e.id===id);assert(note);w.localPlayer.mesh.position.set(note.position.x,note.position.y,note.position.z+1);assert(L.interact(note));assert(L.snapshot().notes.includes(id));L.close();}
L.build();assert.equal(w.interactables.filter(e=>e.action==='note').length,15);const resources=L.info().resources;
L.build();assert.equal(L.info().resources,resources);
L.openBag();assert.match(w.document.querySelector('.fz-journal').textContent,/Дневник пока пуст/);assert.equal(w.document.querySelectorAll('[data-note-id]').length,0);L.close();
collect('return');collect('bench');collect('signal');assert.equal(changes,3);
// Discovery still requires proximity; reading from a distant console/UI cannot collect a note.
const distant=w.interactables.find(e=>e.id==='letter');w.localPlayer.mesh.position.set(0,0,0);L.interact(distant);assert(!L.snapshot().notes.includes('letter'));
opener.focus();L.openBag();assert.equal(w.document.querySelectorAll('[data-note-id]').length,3);
assert(!w.document.querySelector('#fzLore45').textContent.includes(P.notes.find(n=>n.id==='letter').title));
const input=w.document.querySelector('input[type=search]');input.focus();
let leaked=0;w.document.addEventListener('keydown',()=>leaked++);
const typed=new w.KeyboardEvent('keydown',{key:'w',code:'KeyW',bubbles:true,cancelable:true});input.dispatchEvent(typed);assert.equal(typed.defaultPrevented,false);assert.equal(leaked,0);
input.value='квитанция';input.dispatchEvent(new w.Event('input'));assert.equal(w.document.querySelectorAll('[data-note-id]').length,1);
w.document.querySelector('[data-note-id="return"]').click();
assert.equal(w.document.querySelector('.fz-lore-body').textContent,P.notes.find(n=>n.id==='return').text);
assert.equal(w.document.querySelector('.fz-journal-pager button').disabled,true);
click('Крупный текст');assert.equal(w.localStorage.getItem('fz_journal47_large'),'1');
click('Следующая →');assert.equal(w.document.querySelector('#fzLoreTitle').textContent,P.notes.find(n=>n.id==='bench').title);
assert.equal(w.document.querySelector('article').dataset.readerSize,'large');
click('Все найденные записи');assert.equal(w.document.querySelector('input').value,'квитанция');assert.equal(w.document.querySelectorAll('[data-note-id]').length,1);
click('Сбросить поиск');const select=w.document.querySelector('select');select.value='Набережная';select.dispatchEvent(new w.Event('change'));
assert.equal(w.document.querySelectorAll('[data-note-id]').length,1);assert.equal(w.document.querySelector('[data-note-id]').dataset.noteId,'signal');
const before=JSON.stringify(L.snapshot());
const first=w.document.querySelector('#fzLore45 button');first.focus();first.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Tab',code:'Tab',shiftKey:true,bubbles:true,cancelable:true}));
assert(w.document.activeElement.closest('#fzLore45'));assert.notEqual(w.document.activeElement,first);
w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true}));assert.equal(w.document.querySelector('#fzLore45'),null);assert.equal(w.document.activeElement,opener);
assert.equal(JSON.stringify(L.snapshot()),before,'search, paging and reader preferences never change progress');assert.equal(changes,3);
L.openBag();L.hydrate({notes:['shift']});assert.equal(w.document.querySelector('#fzLore45'),null);L.openBag();assert.equal(w.document.querySelector('input').value,'');assert.equal(w.document.querySelectorAll('[data-note-id]').length,1);L.close();
playing=false;L.openBag();assert.equal(w.document.querySelector('#fzLore45'),null);
L.dispose();assert.equal(L.info().resources,0);assert.equal(w.interactables.filter(e=>e.lore45).length,0);dom.window.close();
console.log('PASS journal47: 15 physical notes, legacy-save preservation, discovery bounds, found-only search/filter/paging, persistent text size, keyboard containment/focus, account reset and resource cleanup');
