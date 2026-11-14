'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),express=require('express'),http=require('node:http');
const {installPublicAccess,COOKIE,GUEST_COOKIE}=require('../server/public-access.cjs');
const {cookieCodec,MainAccess}=require('../server/closed-runtime.cjs');
const secret='S'.repeat(43),uid='11111111-1111-4111-8111-111111111111';
test('public MAIN login never queries approvals; owner role still comes from server',async()=>{
 let owner=false;const calls=[];const a=new MainAccess({requireApproval:false,fetchImpl:async url=>{calls.push(url);assert(!url.endsWith('beta_status'));return Response.json(url.endsWith('/user')?{id:uid,email_confirmed_at:'now'}:url.endsWith('/my_profile')?[{id:uid,username:'temka_play_official'}]:owner);}});
 assert.equal((await a.check({access_token:'fixture'})).isOwner,false);owner=true;assert.equal((await a.check({access_token:'fixture'},{fresh:true})).isOwner,true);assert(!calls.some(x=>x.includes('beta_status')));
});
test('public pages survive account-store outage; private APIs fail closed and guest data is never durable',async()=>{
 const app=express();app.use(express.json());let calls=0,saves=0;const accounts={},store={failed:true},io={use:fn=>io.guard=fn,on(){}};
 const access={check:async()=>{calls++;throw Error('offline');}};
 installPublicAccess({app,io,accounts,commit:async()=>{saves++;},store,secret,access});app.get('/',(_q,r)=>r.send('WORLD'));app.get('/assets/model',(_q,r)=>r.send('MODEL'));app.get('/api/admin/accounts',(_q,r)=>r.json({private:true}));
 const server=http.createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  for(const p of ['/','/assets/model'])assert.equal((await fetch(base+p)).status,200);
  const r=await fetch(base+'/api/session/me');const g=await r.json();assert(g.guest);assert.equal(g.token,null);assert.equal(g.isAdmin,false);assert.equal(calls,0);assert.equal(saves,0);assert.deepEqual(accounts,{});
  const c=COOKIE+'='+cookieCodec(secret).seal({access_token:'old'});assert.equal((await fetch(base+'/api/admin/accounts',{headers:{Cookie:c}})).status,503);
  let err;const socket={request:{headers:{}},data:{}};await io.guard(socket,e=>err=e);assert.equal(err,undefined);assert.equal(socket.data.boundAccount.mainUid,null);
  const forged={request:{headers:{cookie:GUEST_COOKIE+'=admin'}},data:{}};await io.guard(forged,e=>err=e);assert.equal(forged.data.boundAccount.role,'user');assert.equal(saves,0);
  const cross={request:{headers:{origin:'https://evil.invalid',host:'fantazia.example',cookie:c}},data:{}};await io.guard(cross,e=>err=e);assert(err);
 }finally{await new Promise(r=>server.close(r));}
});
test('owner socket privilege is rechecked before privileged commands',async()=>{
 const app=express();let owner=true,connectCallback;const io={use:fn=>io.guard=fn,on:(_name,fn)=>connectCallback=fn};
 const access={check:async()=>({id:uid,username:'owner',isOwner:owner})};
 installPublicAccess({app,io,accounts:{},commit:async()=>true,store:{failed:false},secret,access});
 let middleware,cleanup,disconnected=false,nextCalled=false;
 const s={request:{headers:{cookie:COOKIE+'='+cookieCodec(secret).seal({access_token:'fixture'})}},data:{},use:fn=>middleware=fn,once:(_n,fn)=>cleanup=fn,disconnect:()=>{disconnected=true;cleanup?.();},emit(){}};
 await io.guard(s,e=>assert.equal(e,undefined));connectCallback(s);owner=false;await middleware(['adminCommand',{}],()=>nextCalled=true);assert(disconnected);assert(!nextCalled);
});
