'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const express=require('express'),http=require('node:http');
const {Server}=require('socket.io'),{io:clientIO}=require('socket.io-client');
const {LauncherCodes,normalizeCode}=require('../server/launcher-login.cjs');
const {cookieCodec,MainAccess}=require('../server/closed-runtime.cjs');
const {installClosedBeta,COOKIE}=require('../server/closed-beta.cjs');
const secret='Q'.repeat(43),uid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
function fixture(){
 let t=Date.now(),allowed=true,owner=false,identity=uid,dead=false;const records=new Map(),calls=[];
 const access={check:async(s,o)=>{calls.push({s,o});if(!s||s.access_token!=='main.fixture.token'||dead)throw Error('login_required');if(!allowed&&!owner)throw Error('approval_required');return {id:identity,username:'existing-main-profile',isOwner:owner};},refresh:async()=>{throw Error('login_required');}};
 const store={failed:false,rpc:async(name,b)=>{if(store.failed)throw Error('unavailable');if(name.endsWith('_issue')){records.clear();records.set(b.p_code_hash,{main_uid:b.p_main_uid,sealed_session:b.p_sealed_session,expiry:t+120000});return {expires_at:new Date(t+120000).toISOString()};}const row=records.get(b.p_code_hash);records.delete(b.p_code_hash);return row&&row.expiry>t&&allowed?row:null;}};
 const codes=new LauncherCodes({store,access,secret});
 return {codes,store,access,records,calls,now:()=>t,advance:n=>t+=n,allow:v=>allowed=v,owner:v=>owner=v,identity:v=>identity=v,dead:v=>dead=v};
}
test('MAIN-verified code is short-lived, opaque, UID-bound and carries no refresh token',async()=>{
 const f=fixture(),r=await f.codes.issue('main.fixture.token');assert.match(r.code,/^FZ-([A-HJ-NP-Z2-9]{4}-){3}[A-HJ-NP-Z2-9]{4}$/);assert.equal(r.expires_in,120);
 assert.equal(f.calls[0].o.fresh,true);const [hash,row]=[...f.records][0];assert.equal(hash.length,64);assert(!row.sealed_session.includes('main.fixture.token'));assert(!hash.includes(r.code));
 const session=await f.codes.redeem(r.code.toLowerCase().replaceAll('-',' '));assert.deepEqual(session,{access_token:'main.fixture.token'});assert.equal(f.calls.at(-1).o.fresh,true);await assert.rejects(f.codes.redeem(r.code));
});
test('replay race has exactly one winner; new code invalidates old code',async()=>{
 const f=fixture(),a=await f.codes.issue('main.fixture.token'),b=await f.codes.issue('main.fixture.token');assert.notEqual(a.code,b.code);await assert.rejects(f.codes.redeem(a.code));
 const r=await Promise.allSettled([f.codes.redeem(b.code),f.codes.redeem(b.code)]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);
});
test('expired, revoked, invalid MAIN and swapped UID fail closed',async()=>{
 for(const mutate of [f=>f.advance(120001),f=>f.allow(false),f=>f.dead(true),f=>f.identity(other),f=>f.store.failed=true]){
  const f=fixture(),r=await f.codes.issue('main.fixture.token');mutate(f);await assert.rejects(f.codes.redeem(r.code));
 }
 for(const bad of [null,'','123456','BETA-TEST','FZ-AAAA-AAAA-AAAA-AAA0','x'.repeat(65)])assert.throws(()=>normalizeCode(bad));
 const f=fixture();f.allow(false);await assert.rejects(f.codes.issue('main.fixture.token'));f.owner(true);assert((await f.codes.issue('main.fixture.token')).code);await assert.rejects(f.codes.issue('local-user'));assert.equal(f.records.size,1);
});
test('fresh MAIN check bypasses the normal ten-second permission cache',async()=>{
 let approved=true,calls=0;const access=new MainAccess({fetchImpl:async url=>{calls++;return Response.json(url.endsWith('/user')?{id:uid,email_confirmed_at:'now'}:url.endsWith('/my_profile')?[{id:uid,username:'tester'}]:url.endsWith('/fantazia_owner_status')?false:{game_id:'fantazia',state:approved?'approved':'revoked',request_id:uid,updated_at:'2026-11-04T00:00:00Z'});}});
 await access.check({access_token:'main.fixture.token'});const count=calls;approved=false;
 await access.check({access_token:'main.fixture.token'});assert.equal(calls,count);
 await assert.rejects(access.check({access_token:'main.fixture.token'},{fresh:true}),/approval_required/);assert(calls>count);
});
test('HTTP code flow keeps private HTTP/API/Socket.IO gated; no new accounts at issue/redeem',async()=>{
 const f=fixture(),app=express();app.set('trust proxy',false);app.use(express.json());app.use(express.urlencoded({extended:false}));
 const server=http.createServer(app),io=new Server(server);const accounts={};let saves=0;
 installClosedBeta({app,io,accounts,commit:async()=>{saves++;},store:f.store,secret,access:f.access,now:f.now});
 app.get('/',(_q,r)=>r.send('PRIVATE GAME'));app.get('/assets/private',(_q,r)=>r.send('PRIVATE ASSET'));app.get('/api/players',(_q,r)=>r.json(['PRIVATE']));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const post=(path,body,headers={})=>fetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body),redirect:'manual'});
 const socket=(cookie)=>clientIO(origin,{transports:['websocket'],extraHeaders:cookie?{Cookie:cookie}:{},reconnection:false,timeout:2000});
 try{
  const page=await fetch(origin+'/closed/login');assert.equal(page.status,200);const html=await page.text();assert(html.includes('/closed/launcher-login'));assert(html.includes('код из лаунчера'));assert(!html.includes('action="/closed/send-code"'));assert(page.headers.get('content-security-policy').includes("form-action 'self'"));
  const opt=await fetch(origin+'/closed/launcher-code',{method:'OPTIONS',headers:{Origin:'https://launcher.example'}});assert.equal(opt.status,204);assert.equal(opt.headers.get('access-control-allow-origin'),'*');assert.equal(opt.headers.get('access-control-allow-credentials'),null);
  let r=await post('/closed/launcher-code',{}, {Cookie:COOKIE+'='+cookieCodec(secret).seal({access_token:'main.fixture.token'})});assert.equal(r.status,401);
  r=await post('/closed/launcher-code',{user_id:other,role:'owner'},{Authorization:'Bearer main.fixture.token',Origin:'null'});assert.equal(r.status,200);const issued=await r.json();assert.equal([...f.records.values()][0].main_uid,uid);assert.equal(saves,0);assert.deepEqual(accounts,{});
  r=await post('/closed/launcher-login',{code:issued.code},{Origin:'https://attacker.example'});assert.equal(r.status,403);assert.equal(f.records.size,1);
  r=await post('/closed/launcher-login',{code:issued.code});assert.equal(r.status,303);const cookie=r.headers.get('set-cookie');assert(cookie.includes('HttpOnly; Secure; SameSite=Strict'));assert(!cookie.includes('main.fixture.token'));assert.equal(saves,0);assert.deepEqual(accounts,{});
  r=await post('/closed/launcher-login',{code:issued.code});assert.equal(r.status,403);assert.equal(r.headers.get('set-cookie'),null);
  for(const path of ['/assets/private','/api/players'])assert.equal((await fetch(origin+path)).status,403);
  const header=cookie.split(';')[0];assert.equal((await fetch(origin+'/',{headers:{Cookie:header}})).status,200);assert.equal(accounts[uid].mainUid,uid);assert.equal(saves,1);
  assert.equal((await post('/api/auth/register',{username:'new'},{Cookie:header})).status,410);assert.equal(Object.keys(accounts).length,1);
  assert.equal((await fetch(origin+'/api/admin/accounts',{headers:{Cookie:header}})).status,403);
  const guest=socket();try{await new Promise((resolve,reject)=>{guest.once('connect_error',resolve);guest.once('connect',()=>reject(Error('anonymous socket admitted')));});}finally{guest.close();}
  const valid=socket(header);try{await new Promise((resolve,reject)=>{valid.once('connect',resolve);valid.once('connect_error',reject);});assert.equal([...io.sockets.sockets.values()][0].data.mainIdentity.id,uid);}finally{valid.close();}
  f.allow(false);assert.equal((await fetch(origin+'/api/players',{headers:{Cookie:header}})).status,403);
  f.store.failed=true;assert.equal((await fetch(origin+'/assets/private',{headers:{Cookie:header}})).status,503);
 }finally{await new Promise(r=>io.close(r));if(server.listening)await new Promise(r=>server.close(r));}
});
test('redemption attempts are rate-limited and no secret/code leaks in error responses',async()=>{
 const f=fixture(),app=express();app.use(express.json());const io={use(){},on(){}};
 installClosedBeta({app,io,accounts:{},commit:async()=>{},store:f.store,secret,access:f.access,now:f.now});const server=http.createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 try{for(let n=0;n<9;n++){const r=await fetch(origin+'/closed/launcher-login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({code:'bad-'+secret})});assert.equal(r.status,n<8?403:429);assert(!(await r.text()).includes(secret));}f.advance(300001);assert.equal((await fetch(origin+'/closed/launcher-login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'})).status,403);}finally{await new Promise(r=>server.close(r));}
});
