'use strict';
const crypto=require('node:crypto');
const {cookieCodec,MainAccess}=require('./closed-runtime.cjs');
const COOKIE='__Host-fantazia_beta';
function ownOrigin(req){try{return !!req.headers.origin&&new URL(req.headers.origin).host===req.headers.host;}catch{return false;}}
function html(value){return String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function loginHTML({email='',notice='',error=''}={}){
 const e=html(typeof email==='string'?email.trim().slice(0,254):'');
 return `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="referrer" content="same-origin"><meta name="viewport" content="width=device-width"><title>Fantazia · вход в основной аккаунт</title><style>*{box-sizing:border-box}body{background:#10101a;color:#eee;font:16px system-ui;max-width:480px;margin:4vh auto;padding:20px}input,button{width:100%;padding:14px;margin:7px 0;background:#242038;color:white;border:1px solid #686077;border-radius:10px}button{background:#6542ad;cursor:pointer}p{line-height:1.55}small{color:#bbb}details{margin-top:28px;border-top:1px solid #454050;padding-top:18px}summary{cursor:pointer}a{color:#bda7ff}.notice{padding:12px;background:#19382c;border-radius:10px}.error{padding:12px;background:#482635;border-radius:10px}label{display:block;margin-top:14px}</style><h1>Fantazia · основной аккаунт</h1><p>Используй ту же <strong>онлайн-почту MAIN</strong>, что и в TemkaLauncher. Новый игровой аккаунт не нужен. Пароль можно не вспоминать — войди по коду из письма.</p>${notice?`<p class="notice" role="status">${html(notice)}</p>`:''}${error?`<p class="error" role="alert">${html(error)}</p>`:''}<h2>1. Получить код</h2><form method="post" action="/closed/send-code"><label>Почта основного онлайн-аккаунта<input type="email" name="email" value="${e}" placeholder="Почта MAIN, как в лаунчере" required maxlength="254" autocomplete="email"></label><button>Получить код входа</button></form><h2>2. Войти по коду</h2><form method="post" action="/closed/verify-code"><label>Та же онлайн-почта<input type="email" name="email" value="${e}" placeholder="Та же почта" required maxlength="254" autocomplete="email"></label><label>Последний код из письма<input name="token" placeholder="Код из письма" inputmode="numeric" pattern="[0-9]{6,8}" required maxlength="8" autocomplete="one-time-code"></label><button>Войти в основной аккаунт</button></form><small>Это код входа в MAIN, не бета-ключ и не код из другого лаунчера. Отдельная «локальная почта» в профиле может отличаться. Не создавай второй аккаунт.</small><details><summary>Войти по паролю MAIN, если он задан</summary><form method="post" action="/closed/login"><input type="email" name="email" value="${e}" placeholder="Почта основного аккаунта" required maxlength="254" autocomplete="username"><input type="password" name="password" placeholder="Пароль MAIN, не старый пароль игры" required maxlength="256" autocomplete="current-password"><button>Войти по паролю</button></form></details><p>Для тестера нужен действующий допуск Fantazia. Права автора проверяются по подтверждённому MAIN-аккаунту, не по нику. После входа сессия запоминается.</p><a href="/closed/login">Начать вход заново</a></html>`;
}
const LOGIN=loginHTML();
function parseCookie(header){return String(header||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);}
function installClosedBeta({app,io,accounts,commit,store,secret,access=new MainAccess(),now=Date.now}){
 const codec=cookieCodec(secret),attempts=new Map();let accountQueue=Promise.resolve();
 const setCookie=(res,s)=>res.setHeader('Set-Cookie',`${COOKIE}=${codec.seal(s)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`);
 async function identity(req,res){let session=codec.read(parseCookie(req.headers.cookie));try{return {who:await access.check(session),session};}catch(e){if(e.status!==401)throw e;session=await access.refresh(session);const who=await access.check(session);if(res)setCookie(res,session);return {who,session};}}
 async function ensureAccount(who){const job=accountQueue.then(async()=>{let a=accounts[who.id];const before=a?JSON.stringify(a):null;
 if(!a){a={mainUid:who.id,username:who.username,role:who.isOwner?'admin':'user',token:crypto.randomBytes(32).toString('hex'),createdAt:now(),money:1000,level:1,exp:0,inventory:[],appearance:{skinColor:'#FFD1A4',shirtColor:'#3498DB',pantsColor:'#2C3E50',hairColor:'#4A2F1B',hairStyle:0}};accounts[who.id]=a;}
 a.username=who.username;a.role=who.isOwner?'admin':'user';
 if(JSON.stringify(a)!==before){try{await commit();}catch(error){if(before)accounts[who.id]=JSON.parse(before);else delete accounts[who.id];throw error;}}
 return a;});accountQueue=job.catch(()=>{});return job;}
 const accountResult=a=>({ok:true,username:a.username,token:a.token,isAdmin:a.role==='admin',data:{money:a.money,level:a.level,exp:a.exp,inventory:a.inventory,appearance:a.appearance}});
 app.use((req,res,next)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');next();});
 // All interactive login responses keep a working Origin and stay HTTP200 on
 // expected user errors: the accepted Android client treats main-frame4xx as fatal.
 // HTTP200 here only renders login UI; it NEVER grants access or sets auth cookies.
 function showLogin(res,options={}){res.setHeader('Referrer-Policy','same-origin');res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");return res.status(200).type('html').send(loginHTML(options));}
 app.get('/closed/login',(_req,res)=>showLogin(res));
 app.post('/closed/login',async(req,res)=>{
  if(!ownOrigin(req))return res.status(403).send('Origin denied');
  const k=req.ip,t=now();for(const [key,a]of attempts)if(t-a.since>300000)attempts.delete(key);const a=attempts.get(k)||{since:t,count:0};a.count++;attempts.set(k,a);if(a.count>12||attempts.size>500)return showLogin(res,{email:req.body?.email,error:'Слишком много попыток. Подожди пять минут.'});
  try{const session=await access.login(req.body?.email,req.body?.password);setCookie(res,session);return res.redirect(303,'/');}catch{return showLogin(res,{email:req.body?.email,error:'Вход или допуск не подтверждён. Если пароль MAIN не помнишь или не задавал — используй код из письма выше. Новый игровой аккаунт не нужен.'});}
 });
 const codeWindows=new Map();
 app.post('/closed/send-code',async(req,res)=>{
  if(!ownOrigin(req))return res.status(403).send('origin_denied');const t=now(),key=req.ip;for(const [k,v]of codeWindows)if(t-v>300000)codeWindows.delete(k);
  if(codeWindows.has(key)||codeWindows.size>500)return showLogin(res,{email:req.body?.email,error:'Код уже запрашивали. Проверь почту и введи последний код ниже. Повторный запрос возможен через пять минут.'});
  codeWindows.set(key,t);try{await access.sendCode(req.body?.email);return showLogin(res,{email:req.body?.email,notice:'Если существующий MAIN-аккаунт доступен, код отправлен. Проверь почту и «Спам», затем введи код в форме ниже. Возвращаться назад не нужно.'});}catch{return showLogin(res,{email:req.body?.email,error:'Не удалось запросить код. Проверь почту именно основного онлайн-аккаунта и подключение. Не регистрируй новый аккаунт.'});}
 });
 app.post('/closed/verify-code',async(req,res)=>{
  if(!ownOrigin(req))return res.status(403).send('origin_denied');const k='verify:'+req.ip,t=now(),a=attempts.get(k)||{since:t,count:0};if(t-a.since>300000){a.since=t;a.count=0;}a.count++;attempts.set(k,a);
  if(a.count>8||attempts.size>500)return showLogin(res,{email:req.body?.email,error:'Слишком много проверок кода. Подожди пять минут.'});
  try{const session=await access.verifyCode(req.body?.email,req.body?.token);setCookie(res,session);return res.redirect(303,'/');}catch{return showLogin(res,{email:req.body?.email,error:'Код входа или допуск не подтверждён. Используй последний код и ту же онлайн-почту, что в лаунчере. Аккаунт заново создавать не нужно.'});}
 });
 app.get('/api/health',(_req,res)=>res.json({ok:!store.failed,name:'Fantazia RP 3D',closedBeta:true,persistentAccounts:true}));
 app.use(async(req,res,next)=>{
  if(store.failed)return res.status(503).json({ok:false,error:'Хранилище недоступно. Игра закрыта до восстановления связи.'});
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&!ownOrigin(req))return res.status(403).json({ok:false,error:'origin_denied'});
  try{const auth=await identity(req,res);req.fantaziaIdentity=auth.who;req.fantaziaAccount=await ensureAccount(auth.who);
   if((req.path.startsWith('/api/admin/')||req.path.startsWith('/shop/api/admin/'))&&!auth.who.isOwner)return res.status(403).json({ok:false,error:'owner_required'});
   next();
  }catch(error){const unavailable=error.status>=500||!['login_required','approval_required','confirmed_main_required','profile_required'].includes(error.message)&&!error.status;const status=unavailable?503:403;
   if(req.path==='/'&&!unavailable)return res.redirect(303,'/closed/login');res.status(status).json({ok:false,error:unavailable?'Не удалось проверить допуск. Доступ закрыт.':'Вход или заявка не подтверждены.'});}
 });
 app.get('/api/closed/me',(req,res)=>res.json(accountResult(req.fantaziaAccount)));
 app.post(['/api/auth/login','/api/auth/register'],(_req,res)=>res.status(410).json({ok:false,error:'Отдельная игровая регистрация отключена. Войди в основной аккаунт.'}));
 app.post('/api/auth/verify',(req,res)=>res.json(accountResult(req.fantaziaAccount)));
 // Legacy gameplay APIs may carry a token, but it is always bound to the verified
 // MAIN cookie account, never accepted as an alternative identity.
 app.use((req,_res,next)=>{if(req.body&&Object.hasOwn(req.body,'token'))req.body.token=req.fantaziaAccount.token;next();});
 io.use(async(socket,next)=>{try{const auth=await identity(socket.request);socket.data.mainSession=auth.session;socket.data.mainIdentity=auth.who;socket.data.boundAccount=await ensureAccount(auth.who);next();}catch{next(Error('closed_beta_denied'));}});
 io.on('connection',socket=>{
  const timer=setInterval(async()=>{try{const who=await access.check(socket.data.mainSession);if(who.isOwner!==socket.data.mainIdentity.isOwner)throw Error('owner_role_changed');socket.data.boundAccount=await ensureAccount(who);socket.data.mainIdentity=who;if(store.failed)throw Error('store unavailable');}catch{socket.emit('closedBetaDenied');socket.disconnect(true);}},11000);timer.unref?.();socket.once('disconnect',()=>clearInterval(timer));
  socket.use((_packet,next)=>{if(store.failed)return next(Error('store_unavailable'));next();});
 });
 return {ensureAccount,identity};
}
module.exports={COOKIE,LOGIN,parseCookie,installClosedBeta};
