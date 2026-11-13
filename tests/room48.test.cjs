'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {JSDOM}=require('jsdom'),P=require('../public/assets/fz-room48-policy');
const root=path.resolve(__dirname,'..');
for(const fps of [30,60,144]){
 const s=P.create();P.target(s,684,360);for(let i=0;i<fps*7;i++)P.step(s,1/fps);
 assert(Math.hypot(s.x-684,s.y-360)<8);assert.equal(P.interact(s),'computer');
 for(let i=0;i<fps*12;i++)P.step(s,1/fps);assert.equal(s.phase,'done');
}
const s=P.create();assert.equal(P.interact(s),false);assert.equal(s.phase,'room');
for(let i=0;i<200;i++)P.step(s,.1,{x:-1,y:1});assert.equal(s.x,P.bounds.left);assert.equal(s.y,P.bounds.bottom);
s.x=660;s.y=354;P.step(s,.1,{y:-1});assert(s.y>=345,'cannot walk through desk');
assert.equal(P.interact(s),'computer');P.step(s,2);P.step(s,2);assert.equal(s.phase,'erase');assert(Math.abs(s.time-1)<1e-9,'cutscene time is not slowed down at low rendering frequency');
const invalid=P.create();P.target(invalid,NaN,10);P.step(invalid,NaN);assert.equal(invalid.x,198);
(async()=>{
 const dom=new JSDOM('<body><button id="before">Play</button></body>',{url:'https://game.test',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 const noop=()=>{},gradient={addColorStop:noop},ctx=new Proxy({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},{get:(o,k)=>k in o?o[k]:noop,set:(o,k,v)=>(o[k]=v,true)});
 w.HTMLCanvasElement.prototype.getContext=()=>ctx;
 const frames=new Map();let frameID=0,now=1000,location=false,seen=false;
 Object.assign(w,{FZRoom48Policy:P,FZSave41:{hasLocation:()=>location},FZProgress40:{has:()=>seen},FZPlay:{release:noop,reducedMotion:()=>false},FZSound:{effect:noop,silence:noop,tick:noop,stopEffects:noop},
 requestAnimationFrame:fn=>{frames.set(++frameID,fn);return frameID;},cancelAnimationFrame:id=>frames.delete(id)});
 vm.runInContext(fs.readFileSync(path.join(root,'public/assets/fz-room48.js'),'utf8'),dom.getInternalVMContext());
 const api=w.FZRoom48;assert(api.needed());location=true;assert(!api.needed());location=false;seen=true;assert(!api.needed());seen=false;
 w.document.getElementById('before').focus();const pending=api.start();assert.equal(api.start(),pending);assert.equal(frames.size,1);assert(api.active());
 const tick=ms=>{now+=ms;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(now));};
 const initial=api.info().x;
 w.dispatchEvent(new w.KeyboardEvent('keydown',{code:'KeyD',bubbles:true,cancelable:true}));tick(16);tick(100);assert(api.info().x>initial);
 w.dispatchEvent(new w.KeyboardEvent('keydown',{code:'Escape',bubbles:true,cancelable:true}));const paused=api.info().x;tick(1000);assert.equal(api.info().x,paused);assert(api.info().paused);
 api.cancel();assert.equal(await pending,false);assert.equal(frames.size,0);assert(!api.active());assert.equal(w.document.querySelector('#fzRoom48'),null);assert.equal(w.document.activeElement.id,'before');
 let passed=false;w.document.addEventListener('keydown',()=>passed=true);w.document.body.dispatchEvent(new w.KeyboardEvent('keydown',{code:'KeyD',bubbles:true}));assert(passed,'input listeners removed on cancellation');
 const skipped=api.start();w.document.querySelector('[data-skip]').click();assert.equal(await skipped,true);assert.equal(frames.size,0);
 const hidden=api.start();Object.defineProperty(w.document,'hidden',{configurable:true,value:true});w.document.dispatchEvent(new w.Event('visibilitychange'));tick(2000);assert.equal(api.info().x,198);api.cancel();await hidden;
 w.HTMLCanvasElement.prototype.getContext=()=>{throw Error('disabled canvas');};assert.equal(await api.start(),true);assert(!api.active());
 // Execute the actual launch function: late async completion must not revive a cancelled start.
 const acorn=require('acorn'),html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');let launch;
 for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))for(const node of acorn.parse(match[1],{ecmaVersion:'latest'}).body)
  if(node.type==='FunctionDeclaration'&&node.id.name==='startGameDirect')launch=match[1].slice(node.start,node.end);
 assert(launch);let releaseSave,releaseRoom,roomStarts=0;
 const game=vm.createContext({_gameStarted:false,_gameStartTicket:0,window:{FZSave41:{prepare:()=>new Promise(r=>releaseSave=r)},FZRoom48:{needed:()=>true,start:()=>{roomStarts++;return new Promise(r=>releaseRoom=r);}}}});
 game.FZRoom48=game.window.FZRoom48;vm.runInContext(launch,game);
 const lateSave=game.startGameDirect();game._gameStarted=false;game._gameStartTicket++;releaseSave();await lateSave;assert.equal(roomStarts,0);
 game.window.FZSave41.prepare=async()=>{};
 const lateRoom=game.startGameDirect();await new Promise(r=>setImmediate(r));assert.equal(roomStarts,1);
 game._gameStartTicket++;game._gameStarted=true;releaseRoom(true);await lateRoom;assert.equal(game._gameStarted,true,'old launch must not alter a newer request');
 dom.window.close();console.log('PASS room48: playable path/collision, 30/60/144 Hz, bounded transition, resume/seen bypass, one RAF, pause/hidden/cancel/skip, input disposal and canvas fallback');
})().catch(e=>{console.error(e);process.exitCode=1;});
