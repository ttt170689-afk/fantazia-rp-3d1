const {test}=require('node:test'),assert=require('node:assert/strict'),express=require('express'),http=require('node:http');
const {installClosedBeta,COOKIE}=require('../server/closed-beta.cjs');const {cookieCodec}=require('../server/closed-runtime.cjs');
const secret='S'.repeat(43),uid='11111111-1111-4111-8111-111111111111';
test('real HTTP middleware hides game assets/players and binds MAIN identity; owner nick alone gives no admin',async()=>{
 const app=express();app.use(express.json());app.use(express.urlencoded({extended:false}));let permitted=true,owner=false,saves=0;
 const io={use:fn=>{io.guard=fn;},on:()=>{}},accounts={},store={failed:false};
 const access={check:async session=>{if(!session)throw Error('login_required');if(!permitted)throw Error('approval_required');return {id:uid,username:'temka_play_official',isOwner:owner};},login:async()=>({access_token:'synthetic'}),refresh:async()=>{throw Error('no');}};
 installClosedBeta({app,io,accounts,commit:async()=>{saves++;return true;},store,secret,access});app.get('/',(_q,r)=>r.send('PRIVATE WORLD'));app.get('/world/asset',(_q,r)=>r.send('PRIVATE ASSET'));app.get('/api/players',(_q,r)=>r.json(['PRIVATE PLAYER']));app.get('/api/admin/accounts',(_q,r)=>r.json({secret:'OWNER ONLY'}));
 const server=http.createServer(app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port,cookie=COOKIE+'='+cookieCodec(secret).seal({access_token:'synthetic'});
 try{
 let r=await fetch(origin+'/',{redirect:'manual'});assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/closed/login');
 for(const p of ['/world/asset','/api/players']){r=await fetch(origin+p);assert.equal(r.status,403);assert(!(await r.text()).includes('PRIVATE'));}
 r=await fetch(origin+'/api/health');assert.equal((await r.json()).closedBeta,true);
 r=await fetch(origin+'/api/closed/me',{headers:{cookie}});let me=await r.json();assert.equal(me.username,'temka_play_official');assert.equal(me.isAdmin,false);assert.equal(accounts[uid].mainUid,uid);assert.equal(saves,1);
 r=await fetch(origin+'/api/admin/accounts',{headers:{cookie}});assert.equal(r.status,403);owner=true;r=await fetch(origin+'/api/closed/me',{headers:{cookie}});assert.equal((await r.json()).isAdmin,true);
 r=await fetch(origin+'/api/auth/register',{method:'POST',headers:{cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username:'pretend',password:'do-not-create'})});assert.equal(r.status,410);assert(!Object.values(accounts).some(a=>a.username==='pretend'));
 r=await fetch(origin+'/api/auth/verify',{method:'POST',headers:{cookie,Origin:'https://attacker.invalid','Content-Type':'application/json'},body:'{}'});assert.equal(r.status,403);
 permitted=false;r=await fetch(origin+'/world/asset',{headers:{cookie}});assert.equal(r.status,403);
 let result;await io.guard({request:{headers:{cookie}},data:{}},e=>{result=e;});assert(result);store.failed=true;r=await fetch(origin+'/',{headers:{cookie},redirect:'manual'});assert.equal(r.status,503);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
