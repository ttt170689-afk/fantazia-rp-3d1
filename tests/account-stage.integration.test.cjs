// Exercise the real server with isolated accounts, never the preview's user data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),net=require('node:net');
const {spawn}=require('node:child_process'),{once}=require('node:events'),{io}=require('socket.io-client');
(async()=>{
 const repo=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'fz-stage-test-')),clients=[];
 let child;
 try{
  for(const file of ['server.js','server/sky-access.js','public/assets/fz-sky-policy.js']){fs.mkdirSync(path.dirname(path.join(dir,file)),{recursive:true});fs.copyFileSync(path.join(repo,file),path.join(dir,file));}
  fs.symlinkSync(path.join(repo,'node_modules'),path.join(dir,'node_modules'),'dir');
  const password=crypto.randomBytes(24).toString('hex'),oldToken=crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(path.join(dir,'accounts.json'),JSON.stringify({stage_owner_test:{username:'stage_owner_test',role:'admin',token:oldToken,password:crypto.createHash('sha256').update(password+'fantazia_salt_2026').digest('hex'),inventory:[],appearance:{},money:1000,level:1,exp:0}}));
  const listener=net.createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');const port=listener.address().port;await new Promise(r=>listener.close(r));
  child=spawn(process.execPath,['server.js'],{cwd:dir,env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('test server startup timeout')),10000);child.once('exit',code=>{clearTimeout(timer);reject(Error('test server exited '+code));});child.stdout.on('data',data=>{if(String(data).includes('Сервер запущен')){clearTimeout(timer);resolve();}});});
  const base='http://127.0.0.1:'+port;
  const post=async(route,body)=>(await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).json();
  const account=await post('/api/auth/register',{username:'stage_guest',password,role:'admin',isAdmin:true});assert(account.ok);
  assert.equal((await post('/api/auth/register',{username:'temka_play_official',password})).ok,false,'protected admin name cannot be self-registered');
  assert.equal((await post('/api/auth/login',{username:'stage_owner_test',password:'incorrect'})).ok,false);
  const login=await post('/api/auth/login',{username:'stage_owner_test',password});assert(login.ok&&login.isAdmin);
  async function player(data){const socket=io(base,{transports:['websocket'],autoConnect:false});clients.push(socket);const registered=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('registration timeout')),5000);socket.once('registered',result=>{clearTimeout(timer);resolve(result);});});socket.on('connect',()=>socket.emit('registerPlayer',data));socket.connect();const result=await registered;return{socket,result};}
  const ack=(socket,event,data={})=>new Promise((resolve,reject)=>socket.timeout(3000).emit(event,data,(e,r)=>e?reject(e):resolve(r)));
  const forged=await player({name:'temka_play_official',email:'ttt170689@gmail.com',isAdmin:true,isAdminClient:true});
  assert.equal(forged.result.isAdmin,false);assert.equal((await ack(forged.socket,'sky:stage')).ok,false);
  const guest=await player({name:'admin',token:account.token,isAdminClient:true});assert.equal(guest.result.isAdmin,false);assert.equal((await ack(guest.socket,'sky:status')).allowed,false);
  const expired=await player({name:'stage_owner_test',token:oldToken});assert.equal(expired.result.isAdmin,false);
  const owner=await player({name:'ignored',token:login.token});assert.equal(owner.result.isAdmin,true);assert.equal(owner.result.stageAllowed,true);
  assert.equal((await ack(owner.socket,'sky:stage')).ok,true,'real ordinary account login grants stage access with no key');
  const renewed=await post('/api/auth/login',{username:'stage_owner_test',password});assert(renewed.ok);
  assert.equal((await ack(owner.socket,'sky:status')).allowed,false,'stale account session loses capability');
  assert.equal((await ack(owner.socket,'sky:stage')).ok,false);
  const again=await player({token:renewed.token});assert.equal((await ack(again.socket,'sky:stage')).ok,true);
  console.log('PASS real account/server stage flow: login, reserved names, role-injection denial, forged admin/email denial, verified admin entry, token rotation and reauthentication; isolated data');
 }finally{
  clients.forEach(s=>s.disconnect());
  if(child&&child.exitCode===null){child.kill('SIGTERM');await once(child,'exit');}
  fs.rmSync(dir,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1});
