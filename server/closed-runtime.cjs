'use strict';
const crypto=require('node:crypto');
const MAIN='https://jubsgthkahxxexmibdwn.supabase.co';
const API_KEY='sb_publishable_OMO42E66umWFmfOic4QD3w_T64EWPXS';
class RuntimeStore {
 constructor(secret,{fetchImpl=fetch}={}){if(typeof secret!=='string'||!/^[A-Za-z0-9_-]{43,}$/.test(secret))throw Error('FANTAZIA_RUNTIME_SECRET is required; refusing public/local-file mode');this.secret=secret;this.fetch=fetchImpl;this.revision=null;this.queue=Promise.resolve();this.failed=false;}
 async rpc(name,body){const r=await this.fetch(MAIN+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:API_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_secret:this.secret,...body}),redirect:'error',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Permanent game store unavailable ('+r.status+')');return r.json();}
 async open(){const d=await this.rpc('fantazia_runtime_read',{});if(!Number.isSafeInteger(d.revision)||!d.payload?.accounts||typeof d.payload.accounts!=='object'||Array.isArray(d.payload.accounts))throw Error('Invalid durable game state');this.revision=d.revision;return d.payload.accounts;}
 save(accounts){const snapshot=JSON.parse(JSON.stringify({accounts}));const operation=this.queue.then(async()=>{if(this.failed)throw Error('Store is in fail-closed state');const r=await this.rpc('fantazia_runtime_write',{p_revision:this.revision,p_payload:snapshot});if(r.revision!==this.revision+1)throw Error('Invalid durable revision');this.revision=r.revision;return true;});this.queue=operation.catch(()=>{this.failed=true;});return operation;}
}
function cookieCodec(secret){const key=crypto.createHash('sha256').update('fantazia-cookie-v1\0'+secret).digest();return {
 seal(data){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key,iv);const text=Buffer.concat([c.update(JSON.stringify(data)),c.final()]);return Buffer.concat([iv,c.getAuthTag(),text]).toString('base64url');},
 read(value){try{if(typeof value!=='string'||value.length>6000)return null;const b=Buffer.from(value,'base64url');const d=crypto.createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return JSON.parse(Buffer.concat([d.update(b.subarray(28)),d.final()]).toString());}catch{return null;}}
};}
class MainAccess {
 constructor({fetchImpl=fetch,now=Date.now}={}){this.fetch=fetchImpl;this.now=now;this.cache=new Map();}
 async call(route,token,body){const r=await this.fetch(MAIN+route,{method:body===undefined?'GET':'POST',headers:{apikey:API_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Object.assign(Error('MAIN authorization unavailable'),{status:r.status});return r.json();}
 async check(session,{fresh=false}={}){if(!session||typeof session.access_token!=='string'||session.access_token.length>5000)throw Error('login_required');const key=crypto.createHash('sha256').update(session.access_token).digest('hex'),cached=this.cache.get(key);if(!fresh&&cached&&cached.until>this.now())return cached.identity;
 const user=await this.call('/auth/v1/user',session.access_token);if(!user.id||!user.email_confirmed_at)throw Error('confirmed_main_required');
 const rows=await this.call('/rest/v1/rpc/my_profile',session.access_token,{}),profile=Array.isArray(rows)?rows[0]:rows;
 if(!profile||profile.id!==user.id||typeof profile.username!=='string')throw Error('profile_required');
 const beta=await this.call('/rest/v1/rpc/beta_status',session.access_token,{p_game:'fantazia'});
 const owner=await this.call('/rest/v1/rpc/fantazia_owner_status',session.access_token,{})===true;
 if(!owner&&!(beta.game_id==='fantazia'&&beta.state==='approved'&&/^[0-9a-f-]{36}$/i.test(beta.request_id||'')&&Number.isFinite(Date.parse(beta.updated_at||''))))throw Error('approval_required');
 const identity={id:user.id,username:profile.username,isOwner:owner};
 if(this.cache.size>500)this.cache.clear();this.cache.set(key,{until:this.now()+10000,identity});return identity;
 }
 async login(email,password){if(typeof email!=='string'||email.length>254||typeof password!=='string'||password.length>256)throw Error('invalid_login');const r=await this.fetch(MAIN+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:API_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password}),redirect:'error',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Неверный вход в основной аккаунт. Новая регистрация в игре не нужна.');const s=await r.json();await this.check(s);return {access_token:s.access_token,refresh_token:s.refresh_token};}
 async sendCode(email){if(typeof email!=='string'||email.length>254||!email.includes('@'))throw Error('invalid_email');const r=await this.fetch(MAIN+'/auth/v1/otp',{method:'POST',headers:{apikey:API_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,create_user:false}),redirect:'error',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('code_failed');}
 async verifyCode(email,token){if(typeof email!=='string'||email.length>254||typeof token!=='string'||!/^\d{6,8}$/.test(token))throw Error('invalid_code');const r=await this.fetch(MAIN+'/auth/v1/verify',{method:'POST',headers:{apikey:API_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,token,type:'email'}),redirect:'error',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('invalid_code');const s=await r.json();await this.check(s);return {access_token:s.access_token,refresh_token:s.refresh_token};}
 async refresh(session){if(!session?.refresh_token)throw Error('login_required');const r=await this.fetch(MAIN+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:API_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token}),redirect:'error',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('login_required');const s=await r.json();await this.check(s);return {access_token:s.access_token,refresh_token:s.refresh_token};}
}
module.exports={MAIN,API_KEY,RuntimeStore,cookieCodec,MainAccess};
