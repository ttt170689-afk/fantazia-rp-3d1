'use strict';
// Public play is anonymous. MAIN is optional and is still mandatory for durable
// account data and owner privileges. Guests are never inserted into the store.
const crypto=require('node:crypto');
const {cookieCodec,MainAccess}=require('./closed-runtime.cjs');
const COOKIE='__Host-fantazia_beta'; // Read existing MAIN sessions without a forced logout.
const GUEST_COOKIE='__Host-fantazia_guest';
function cookie(header,name){return String(header||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1);}
function ownOrigin(req){try{const u=new URL(req.headers.origin);return ['https:','http:'].includes(u.protocol)&&u.host===req.headers.host;}catch{return false;}}
const LOGIN=`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="referrer" content="same-origin"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fantazia — необязательный вход</title><style>body{font:16px system-ui;background:#10101a;color:#eee;max-width:480px;margin:6vh auto;padding:20px}input,button{box-sizing:border-box;width:100%;padding:14px;margin:8px 0}a{color:#bda7ff}p{line-height:1.6}</style><h1>Fantazia открыта всем</h1><p><a href="/">Играть без регистрации →</a></p><p>Вход в существующий MAIN-аккаунт необязателен. Он нужен для серверных сохранений и подтверждения прав владельца. Одобрение и ключ доступа не требуются.</p><form method="post" action="/account/send-code"><label>Почта существующего аккаунта<input type="email" name="email" required maxlength="254" autocomplete="email"></label><button>Получить код из письма</button></form><form method="post" action="/account/verify-code"><input type="email" name="email" placeholder="Та же почта" required maxlength="254" autocomplete="email"><input name="token" placeholder="Код из письма" required pattern="[0-9]{6,8}" inputmode="numeric" maxlength="8" autocomplete="one-time-code"><button>Войти в аккаунт</button></form><details><summary>Войти паролем MAIN</summary><form method="post" action="/account/login"><input type="email" name="email" placeholder="Почта MAIN" required maxlength="254" autocomplete="username"><input type="password" name="password" placeholder="Пароль MAIN" required maxlength="256" autocomplete="current-password"><button>Войти</button></form></details></html>`;
function installPublicAccess({app,io,accounts,commit,store,secret,access=new MainAccess({requireApproval:false}),now=Date.now}){
 const codec=cookieCodec(secret),attempts=new Map();let queue=Promise.resolve();
 const setCookie=(res,name,data,maxAge)=>res.append('Set-Cookie',`${name}=${codec.seal(data)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`);
 const setMain=(res,s)=>setCookie(res,COOKIE,s,604800);
 function guest(req,res){
  let g=codec.read(cookie(req.headers.cookie,GUEST_COOKIE));
  if(!g||!/^g_[0-9a-f]{32}$/.test(g.id)||!Number.isFinite(g.expires)||g.expires<=now()){
   g={id:'g_'+crypto.randomBytes(16).toString('hex'),expires:now()+30*86400000};
   if(res)setCookie(res,GUEST_COOKIE,g,30*86400);
  }
  return {guestId:g.id,isGuest:true,mainUid:null,username:'Гость_'+g.id.slice(2,12),role:'user',token:null,money:1000,level:1,exp:0,inventory:[],appearance:{skinColor:'#FFD1A4',shirtColor:'#3498DB',pantsColor:'#2C3E50',hairColor:'#4A2F1B',hairStyle:0}};
 }
 async function identity(req,res,fresh=false){
  let session=codec.read(cookie(req.headers.cookie,COOKIE));
  try{return {who:await access.check(session,{fresh}),session};}
  catch(e){if(e.status!==401)throw e;session=await access.refresh(session);const who=await access.check(session,{fresh});if(res)setMain(res,session);return {who,session};}
 }
 async function ensureAccount(who){
  const job=queue.then(async()=>{
   if(store.failed)throw Error('store_unavailable');
   let a=accounts[who.id],before=a?JSON.stringify(a):null;
   if(!a){a={mainUid:who.id,username:who.username,role:'user',token:crypto.randomBytes(32).toString('hex'),createdAt:now(),money:1000,level:1,exp:0,inventory:[],appearance:{}};accounts[who.id]=a;}
   a.username=who.username;a.role=who.isOwner?'admin':'user';
   if(JSON.stringify(a)!==before)try{if(await commit()===false)throw Error('store_unavailable');}catch(e){if(before)accounts[who.id]=JSON.parse(before);else delete accounts[who.id];throw e;}
   return a;
  });queue=job.catch(()=>{});return job;
 }
 const result=a=>({ok:true,guest:a.isGuest===true,username:a.username,token:a.token,isAdmin:!!a.mainUid&&a.role==='admin',data:{money:a.money,level:a.level,exp:a.exp,inventory:a.inventory,appearance:a.appearance}});
 app.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Content-Type-Options','nosniff');next();});
 app.get('/account/login',(_req,res)=>{res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");res.type('html').send(LOGIN);});
 app.get('/closed/login',(_req,res)=>res.redirect(303,'/'));
 app.use('/closed',(req,res,next)=>req.path==='/login'?next():res.status(410).json({ok:false,error:'Вход из лаунчера больше не требуется. Открой главную страницу и играй.'}));
 function limit(req,res){const t=now();for(const[k,v]of attempts)if(t-v.since>300000)attempts.delete(k);const key=req.ip;if(!attempts.has(key)&&attempts.size>=500){res.sendStatus(429);return true;}const v=attempts.get(key)||{since:t,n:0};v.n++;attempts.set(key,v);if(v.n>8){res.status(429).send('Слишком много попыток. Подожди пять минут.');return true;}return false;}
 for(const action of ['login','send-code','verify-code'])app.post('/account/'+action,async(req,res)=>{
  if(!ownOrigin(req))return res.status(403).send('origin_denied');if(limit(req,res))return;
  try{if(action==='send-code'){await access.sendCode(req.body?.email);return res.type('text').send('Если существующий аккаунт доступен, код отправлен. Вернись назад и введи его. Играть можно и без входа.');}
   const s=action==='login'?await access.login(req.body?.email,req.body?.password):await access.verifyCode(req.body?.email,req.body?.token);setMain(res,s);res.redirect(303,'/');
  }catch{res.status(403).send('Вход не подтверждён. Проверь существующий MAIN-аккаунт. Для игры вход не нужен.');}
 });
 app.post('/account/logout',(req,res)=>{if(!ownOrigin(req))return res.sendStatus(403);res.append('Set-Cookie',`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);res.json({ok:true});});
 app.get('/api/health',(_req,res)=>res.json({ok:true,name:'Fantazia RP 3D',closedBeta:false,guestAccess:true,persistentAccounts:!store.failed}));
 app.get(['/api/session/me','/api/closed/me'],async(req,res)=>{
  if(cookie(req.headers.cookie,COOKIE)&&!store.failed)try{const auth=await identity(req,res);return res.json(result(await ensureAccount(auth.who)));}catch{}
  res.json(result(guest(req,res)));
 });
 app.post(['/api/auth/register','/api/auth/login'],(_req,res)=>res.status(410).json({ok:false,error:'Регистрация не нужна. Играй как гость или войди в существующий аккаунт на /account/login.'}));
 app.use(async(req,res,next)=>{
  const p=req.path.toLowerCase();
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&!ownOrigin(req))return res.status(403).json({ok:false,error:'origin_denied'});
  if(!p.startsWith('/api/')&&!p.startsWith('/shop/'))return next();
  if(['GET','HEAD'].includes(req.method)&&['/api/players','/api/quests','/shop/api/catalog','/shop/api/packs','/shop/api/config'].includes(p))return next();
  if(req.method==='POST'&&['/api/quest/complete','/api/trade/offer'].includes(p))return next();
  const owner=p.startsWith('/api/admin/')||p.startsWith('/shop/api/admin/');
  if(!cookie(req.headers.cookie,COOKIE))return res.status(owner?403:401).json({ok:false,error:owner?'owner_required':'account_required'});
  if(store.failed)return res.status(503).json({ok:false,error:'account_store_unavailable'});
  try{const auth=await identity(req,res,owner);if(owner&&!auth.who.isOwner)return res.status(403).json({ok:false,error:'owner_required'});
   req.fantaziaIdentity=auth.who;req.fantaziaAccount=await ensureAccount(auth.who);
   if(req.body)req.body.token=req.fantaziaAccount.token;
   next();
  }catch{res.status(owner?403:401).json({ok:false,error:owner?'owner_required':'account_required'});}
 });
 app.post('/api/auth/verify',(req,res)=>res.json(result(req.fantaziaAccount)));
 io.use(async(socket,next)=>{
  if(socket.request.headers.origin&&!ownOrigin(socket.request))return next(Error('origin_denied'));
  if(cookie(socket.request.headers.cookie,COOKIE)&&!store.failed)try{
   const auth=await identity(socket.request);socket.data.mainSession=auth.session;socket.data.mainIdentity=auth.who;socket.data.boundAccount=await ensureAccount(auth.who);return next();
  }catch{}
  socket.data.boundAccount=guest(socket.request);socket.data.mainIdentity=null;next();
 });
 io.on('connection',socket=>{
  if(!socket.data.mainSession)return;
  async function recheck(fresh=false){const who=await access.check(socket.data.mainSession,{fresh});if(store.failed||who.id!==socket.data.mainIdentity.id||who.isOwner!==socket.data.mainIdentity.isOwner)throw Error('identity_changed');socket.data.boundAccount=await ensureAccount(who);socket.data.mainIdentity=who;}
  const timer=setInterval(()=>recheck().catch(()=>{socket.emit('accountSessionExpired');socket.disconnect(true);}),11000);timer.unref?.();socket.once('disconnect',()=>clearInterval(timer));
  socket.use(async(packet,next)=>{if(['adminCommand','sky:stage'].includes(packet[0]))try{await recheck(true);}catch{socket.disconnect(true);return;}if(store.failed)return next(Error('store_unavailable'));next();});
 });
 return {guest,identity,ensureAccount};
}
module.exports={installPublicAccess,COOKIE,GUEST_COOKIE,LOGIN};
