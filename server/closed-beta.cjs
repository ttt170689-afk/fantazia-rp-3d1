'use strict';
const crypto=require('node:crypto');
const {cookieCodec,MainAccess}=require('./closed-runtime.cjs');
const {LauncherCodes,installLauncherLogin}=require('./launcher-login.cjs');
const COOKIE='__Host-fantazia_beta';
function ownOrigin(req){try{return !!req.headers.origin&&new URL(req.headers.origin).host===req.headers.host;}catch{return false;}}
const LOGIN=`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="referrer" content="same-origin"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fantazia · вход из TemkaLauncher</title><style>body{background:#10101a;color:#eee;font:16px system-ui;max-width:480px;margin:8vh auto;padding:24px}input,button{box-sizing:border-box;width:100%;padding:14px;margin:8px 0;background:#242038;color:white;border:1px solid #686077;border-radius:10px}button{background:#6542ad;cursor:pointer}p{line-height:1.6}#launcher-code{font:600 20px monospace;letter-spacing:1px;text-transform:uppercase}small{color:#b5afc5}details{margin-top:28px}label{display:block;margin-top:16px}</style><h1>Вход в Fantazia</h1><p>Открой <strong>TemkaLauncher → Fantazia → Свойства → Бета-тест → Код входа на сайт</strong>. Получи код в своём основном онлайн-аккаунте и введи его здесь.</p><form method="post" action="/closed/launcher-login"><label for="launcher-code">Одноразовый код из лаунчера</label><input id="launcher-code" name="code" placeholder="FZ-XXXX-XXXX-XXXX-XXXX" required maxlength="64" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" aria-describedby="code-help"><button>Войти по коду</button><small id="code-help">Код действует 2 минуты и используется один раз. Это не бета-ключ и не код из письма. Никому его не передавай.</small></form><p>Нужен одобренный доступ Fantazia либо роль владельца. Вход привязан к основному аккаунту: отдельная регистрация не нужна.</p><details><summary>Войти паролем основного аккаунта</summary><form method="post" action="/closed/login"><label for="main-email">Почта MAIN</label><input id="main-email" type="email" name="email" required maxlength="254" autocomplete="username"><label for="main-password">Пароль MAIN</label><input id="main-password" type="password" name="password" required maxlength="256" autocomplete="current-password"><button>Войти</button></form></details></html>`;
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
 // no-referrer makes normal Chromium form POSTs carry Origin:null. Preserve
 // same-origin form headers without accepting null or cross-site origins.
 app.get('/closed/login',(_req,res)=>{res.setHeader('Referrer-Policy','same-origin');res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");res.type('html').send(LOGIN);});
 app.post('/closed/login',async(req,res)=>{
  if(!ownOrigin(req))return res.status(403).send('Origin denied');
  const k=req.ip,t=now();for(const [key,a]of attempts)if(t-a.since>300000)attempts.delete(key);const a=attempts.get(k)||{since:t,count:0};a.count++;attempts.set(k,a);if(a.count>12||attempts.size>500)return res.status(429).send('Слишком много попыток. Подожди.');
  try{const s=await access.login(req.body?.email,req.body?.password);setCookie(res,s);res.redirect(303,'/');}catch{res.status(403).type('text').send('Вход или допуск не подтверждён. Используй основной аккаунт и одобренную заявку в лаунчере. Новая игровая регистрация не нужна.');}
 });
 const codeWindows=new Map();
 app.post('/closed/send-code',async(req,res)=>{if(!ownOrigin(req))return res.status(403).send('origin_denied');const t=now(),key=req.ip;for(const [k,v]of codeWindows)if(t-v>300000)codeWindows.delete(k);if(codeWindows.has(key)||codeWindows.size>500)return res.status(429).send('Повтори через пять минут.');codeWindows.set(key,t);try{await access.sendCode(req.body?.email);res.type('text').send('Если существующий аккаунт доступен, код отправлен. Вернись назад и введи его в форме входа.');}catch{res.status(400).send('Не удалось запросить код. Проверь почту существующего основного аккаунта.');}});
 app.post('/closed/verify-code',async(req,res)=>{if(!ownOrigin(req))return res.status(403).send('origin_denied');const k='verify:'+req.ip,t=now(),a=attempts.get(k)||{since:t,count:0};if(t-a.since>300000){a.since=t;a.count=0;}a.count++;attempts.set(k,a);if(a.count>8||attempts.size>500)return res.status(429).send('Слишком много попыток.');try{const session=await access.verifyCode(req.body?.email,req.body?.token);setCookie(res,session);res.redirect(303,'/');}catch{res.status(403).send('Код входа или допуск не подтверждён. Новая регистрация в игре не нужна.');}});
 installLauncherLogin({app,codes:new LauncherCodes({store,access,secret}),ownOrigin,setCookie,now});
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
