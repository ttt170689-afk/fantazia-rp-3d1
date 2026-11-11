const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{fork,spawnSync}=require('node:child_process');
const {COOKIE,GUEST_COOKIE}=require('../server/public-access.cjs'),{cookieCodec}=require('../server/closed-runtime.cjs');
test('actual public server: guest play, no signup or approval, private saves/admin/stage stay protected',async()=>{
 const fs=require('node:fs'),os=require('node:os'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'fantazia-public-process-')),control=path.join(dir,'beta');fs.writeFileSync(control,'revoked');
 const root=path.resolve(__dirname,'..'),env={...process.env,PORT:'0'};delete env.FANTAZIA_RUNTIME_SECRET;
 const no=spawnSync(process.execPath,[path.join(root,'server.js')],{cwd:root,env,encoding:'utf8',timeout:10000});assert.equal(no.status,1);assert(no.stderr.includes('FANTAZIA_RUNTIME_SECRET'));
 env.FANTAZIA_RUNTIME_SECRET='S'.repeat(43);env.FIXTURE_BETA_FILE=control;
 const child=fork(path.join(root,'server.js'),{cwd:root,env,execArgv:['--require',path.join(__dirname,'closed-fixture-hook.cjs')],stdio:['ignore','pipe','pipe','ipc']});let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
 const sockets=[];
 try{
  let timer;const port=await Promise.race([new Promise((resolve,reject)=>{child.once('message',m=>resolve(m.port));child.once('exit',()=>reject(Error(logs)));}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('startup timeout '+logs)),12000);})]).finally(()=>clearTimeout(timer));
  const origin='http://127.0.0.1:'+port,post=(p,b,h={})=>fetch(origin+p,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...h},body:JSON.stringify(b),redirect:'manual'});
  let r=await fetch(origin+'/api/health'),health=await r.json();assert.equal(health.closedBeta,false);assert.equal(health.guestAccess,true);
  for(const p of ['/','/world/fantazia_city.glb','/assets/fz-sky-policy.js','/api/players']){r=await fetch(origin+p,{redirect:'manual'});assert.equal(r.status,200,p);await r.arrayBuffer();}
  r=await fetch(origin+'/api/session/me');const guestCookie=r.headers.get('set-cookie').split(';')[0],guest=await r.json();assert(guestCookie.startsWith(GUEST_COOKIE+'='));assert.equal(guest.guest,true);assert.equal(guest.isAdmin,false);assert.equal(guest.token,null);
  const same=await (await fetch(origin+'/api/session/me',{headers:{Cookie:guestCookie}})).json();assert.equal(same.username,guest.username);
  const second=await (await fetch(origin+'/api/session/me')).json();assert.notEqual(second.username,guest.username);
  assert.equal((await post('/api/auth/register',{username:'anything'})).status,410);
  for(const p of ['/api/admin/accounts','/API/ADMIN/accounts','/shop/api/admin/give'])assert([401,403].includes((await fetch(origin+p,{headers:{Cookie:guestCookie}})).status));
  for(const p of ['/api/session/load','/api/session/save','/api/auth/save'])assert.equal((await post(p,{token:'stolen.token',money:999999},{Cookie:guestCookie})).status,401);
  assert.equal((await post('/shop/api/user/owner_fixture/spend',{amount:1},{Cookie:guestCookie})).status,401);
  assert.equal((await fetch(origin+'/closed/login',{redirect:'manual'})).headers.get('location'),'/');
  assert.equal((await post('/closed/launcher-login',{code:'FZ-FAKE'})).status,410);
  const html=await(await fetch(origin+'/')).text();assert(html.includes("fetch('/api/session/me'"));assert(!html.includes("location.replace('/closed/login')"));
  const testerCookie=COOKIE+'='+cookieCodec(env.FANTAZIA_RUNTIME_SECRET).seal({access_token:'tester.jwt.token'});
  r=await fetch(origin+'/api/session/me',{headers:{Cookie:testerCookie}});const tester=await r.json();assert.equal(tester.guest,false);assert.equal(tester.isAdmin,false);assert.equal(tester.username,'tester_fixture');assert.equal((await fetch(origin+'/api/admin/accounts',{headers:{Cookie:testerCookie}})).status,403);
  const ownerCookie=COOKIE+'='+cookieCodec(env.FANTAZIA_RUNTIME_SECRET).seal({access_token:'owner.jwt.token'});
  r=await fetch(origin+'/api/session/me',{headers:{Cookie:ownerCookie}});assert.equal((await r.json()).isAdmin,true);
  const before=await(await fetch(origin+'/api/admin/accounts',{headers:{Cookie:ownerCookie}})).json();assert.equal(before.total,2);assert(!before.accounts.some(x=>x.username.startsWith('Гость_')));
  const {io}=require('socket.io-client');
  async function connect(cookie){const s=io(origin,{transports:['websocket'],extraHeaders:cookie?{Cookie:cookie}:{},reconnection:false,timeout:3000});sockets.push(s);await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);});return s;}
  async function register(s,name){const pending=new Promise(resolve=>s.once('registered',resolve));s.emit('registerPlayer',{name,token:'stolen-or-local',isAdmin:true,role:'admin'});return pending;}
  const g=await connect(guestCookie),registered=await register(g,'temka_play_official');assert.equal(registered.isAdmin,false);assert.equal(registered.player.name,guest.username);assert.equal(registered.player.hasAccount,false);
  const stage=await new Promise(resolve=>g.emit('sky:stage',{},resolve));assert.equal(stage.ok,false);
  const money=registered.player.money;g.emit('adminCommand',{cmd:'giveMoney',amount:1000000,target:'all'});
  const denied=await new Promise(resolve=>{const timeout=setTimeout(()=>resolve(true),200);g.once('moneyUpdate',d=>{clearTimeout(timeout);resolve(d.money===money);});});assert(denied);
  const o=await connect(ownerCookie),owner=await register(o,'pretend');assert.equal(owner.isAdmin,true);assert.equal(owner.player.name,'owner_fixture');
  const allowed=await new Promise(resolve=>o.emit('sky:stage',{},resolve));assert.equal(allowed.ok,true);
  const anonymous=await connect();const anon=await register(anonymous,'ttt170689');assert.equal(anon.isAdmin,false);
  const after=await(await fetch(origin+'/api/admin/accounts',{headers:{Cookie:ownerCookie}})).json();assert.equal(after.total,2);
 }finally{sockets.forEach(s=>s.close());child.kill('SIGTERM');await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);});fs.rmSync(dir,{recursive:true,force:true});}
});
