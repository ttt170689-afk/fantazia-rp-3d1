'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

// Exercise the actual monolithic client's socket lifecycle, not a reimplementation.
// Rendering/audio are stubs: this is not a full-world browser or performance test.
test('reconnect reuses player mesh/position/health and maintains one non-buffered position sender',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 const start=html.indexOf('let positionSyncTimer = null;');
 const end=html.indexOf('// =================== ГОЛОСОВОЙ ЧАТ',start);
 assert(start>0&&end>start);
 const timers=new Map(),sockets=[];let nextTimer=0,meshCreations=0;
 const scene={add(){throw Error('reconnect must not add a replacement mesh');}};
 const mesh={parent:scene,position:{x:15,y:2,z:-40},rotation:{y:.5}};
 function makeSocket(){
  const listeners=new Map();
  const socket={connected:false,sent:[],
   on(event,fn){if(!listeners.has(event))listeners.set(event,[]);listeners.get(event).push(fn);},
   emit(event,data){this.sent.push({event,data,volatile:false});},
   fire(event,data){for(const fn of listeners.get(event)||[])fn(data);},
   removeAllListeners(){listeners.clear();},disconnect(){this.connected=false;this.fire('disconnect');},
   listenerCount(){return [...listeners.values()].reduce((n,a)=>n+a.length,0);}};
  socket.volatile={emit(event,data){socket.sent.push({event,data,volatile:true});}};
  sockets.push(socket);return socket;
 }
 const ctx=vm.createContext({
  socket:null,io:makeSocket,localPlayer:{mesh,health:64,currentAnimation:'walk'},scene,
  gameData:null,currentUser:{isGuest:true,token:null,displayName:'Guest'},localCoins:50,selectedHair:0,
  document:{getElementById:()=>({value:'#ffffff',textContent:''})},
  window:{FZReleaseUI:{watch(){},stop(){}},cine:{progress:12}},
  console:{log(){}},localStorage:{setItem(){}},_cosGet:()=>({hat:'existing'}),
  createCharacter(){meshCreations++;throw Error('unexpected replacement mesh');},
  showNotification(){},addChatMessage(){throw Error('chat history must not duplicate');},
  setInterval(fn){const id=++nextTimer;timers.set(id,fn);return id;},clearInterval(id){timers.delete(id);},
  setTimeout(){},CONFIG:{SEND_RATE:50}
 });
 vm.runInContext(html.slice(start,end),ctx);
 const tick=()=>{for(const fn of timers.values())fn();};
 const register=()=>ctx.socket.fire('registered',{player:{appearance:{cosmetics:{}},health:100},chatHistory:[{text:'old'}],isAdmin:false});
 ctx.initSocket('Guest');assert.equal(timers.size,1);
 tick();assert.equal(ctx.socket.sent.length,0);
 ctx.socket.connected=true;ctx.socket.fire('connect');
 tick();assert.equal(ctx.socket.sent.filter(e=>e.event==='updatePosition').length,0,'wait for registration');
 register();assert.equal(ctx.localPlayer.mesh,mesh);assert.equal(ctx.localPlayer.health,64);
 assert.deepEqual(mesh.position,{x:15,y:2,z:-40});assert.equal(ctx.window.cine.progress,12);
 tick();let moves=ctx.socket.sent.filter(e=>e.event==='updatePosition');assert.equal(moves.length,1);assert(moves[0].volatile);
 ctx.socket.disconnect();for(let i=0;i<100;i++)tick();
 assert.equal(ctx.socket.sent.filter(e=>e.event==='updatePosition').length,1,'no offline buffer growth');
 ctx.socket.connected=true;ctx.socket.fire('connect');tick();
 assert.equal(ctx.socket.sent.filter(e=>e.event==='updatePosition').length,1,'still waiting for re-registration');
 register();tick();assert.equal(ctx.socket.sent.filter(e=>e.event==='updatePosition').length,2);
 ctx.initSocket('Guest');assert.equal(timers.size,1);assert.equal(sockets[0].listenerCount(),0);
 ctx.socket.connected=true;register();tick();
 assert.equal(ctx.socket.sent.filter(e=>e.event==='updatePosition').length,1);
 assert.equal(ctx.localPlayer.mesh,mesh);assert.equal(meshCreations,0);
});

test('session timeout covers stalled JSON bodies and clears its timer on malformed replies',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../public/assets/fz-release-ui.js'),'utf8');
 const timers=new Map();let next=0,signal;
 const ctx=vm.createContext({AbortController,Error,
  window:{addEventListener(){}},
  setTimeout(fn){const id=++next;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);},
  fetch:async(url,opts)=>{signal=opts.signal;return {ok:true,json:()=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))))};}
 });
 vm.runInContext(source,ctx);
 const pending=ctx.window.FZReleaseUI.session();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(timers.size,1);for(const fn of timers.values())fn();
 await assert.rejects(pending,/aborted/);assert.equal(timers.size,0);
 ctx.fetch=async()=>({ok:true,json:async()=>({ok:true,guest:true})});
 await assert.rejects(ctx.window.FZReleaseUI.session(),/invalid session/);assert.equal(timers.size,0);
 ctx.fetch=async()=>({ok:true,json:async()=>({ok:true,guest:true,username:'Guest'})});
 assert.equal((await ctx.window.FZReleaseUI.session()).guest,true);assert.equal(timers.size,0);
});
