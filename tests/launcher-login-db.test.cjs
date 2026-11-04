'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
const uid='11111111-1111-4111-8111-111111111111',owner='22222222-2222-4222-8222-222222222222';
const secret='Q'.repeat(43),cipher='encrypted-fixture-'.repeat(5),hash=i=>crypto.createHash('sha256').update(String(i)).digest('hex');
test('PostgreSQL code storage: permissions, cooldown, atomic consume, expiry, revocation and owner access',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;
   CREATE TABLE auth.users(id uuid PRIMARY KEY,email_confirmed_at timestamptz);
   CREATE TABLE public.player_profiles(id uuid PRIMARY KEY,username text);
   CREATE TABLE public.creator_roles(user_id uuid,role text);
   CREATE TABLE public.beta_access(user_id uuid,game_id text,state text);
   INSERT INTO auth.users VALUES('${uid}',now()),('${owner}',now());
   INSERT INTO public.player_profiles VALUES('${uid}','tester'),('${owner}','owner');
   INSERT INTO public.beta_access VALUES('${uid}','fantazia','approved');
   INSERT INTO public.creator_roles VALUES('${owner}','creator_admin');`);
  await db.exec(fs.readFileSync(path.join(__dirname,'../backend/storage.sql'),'utf8'));
  await db.query('update fantazia_internal.runtime_state set secret_hash=decode($1,\'hex\')',[crypto.createHash('sha256').update(secret).digest('hex')]);
  const sql=fs.readFileSync(path.join(__dirname,'../backend/launcher-login.sql'),'utf8');await db.exec(sql);await db.exec(sql); // replay-safe
  const issue=async(id,h=hash(1),key=secret)=> (await db.query('select public.fantazia_launcher_code_issue($1,$2,$3,$4) as x',[key,id,h,cipher])).rows[0].x;
  const consume=async(h=hash(1),key=secret)=>(await db.query('select public.fantazia_launcher_code_consume($1,$2) as x',[key,h])).rows[0].x;
  await db.exec('SET ROLE anon');
  await assert.rejects(db.query('select * from fantazia_internal.launcher_login_codes'));
  await assert.rejects(issue(uid,hash(1),'wrong'));await assert.rejects(consume(hash(1),'wrong'));
  let r=await issue(uid);assert(Number.isFinite(Date.parse(r.expires_at)));await assert.rejects(issue(uid,hash(2)),/cooldown/);
  const results=await Promise.all([consume(),consume()]);assert.equal(results.filter(Boolean).length,1);assert.equal(results.find(Boolean).main_uid,uid);assert.equal(await consume(),null);
  await issue(uid,hash(2));await db.exec('RESET ROLE');
  await db.exec("update fantazia_internal.launcher_login_codes set issued_at=issued_at-interval '31 seconds', expires_at=expires_at-interval '31 seconds'");
  await db.exec('SET ROLE anon');await issue(uid,hash(3));assert.equal(await consume(hash(2)),null);assert.equal((await consume(hash(3))).main_uid,uid);
  await issue(uid,hash(4));await db.exec('RESET ROLE');
  await db.exec("update fantazia_internal.launcher_login_codes set issued_at=issued_at-interval '3 minutes', expires_at=expires_at-interval '3 minutes'");
  await db.exec('SET ROLE anon');assert.equal(await consume(hash(4)),null);
  await issue(uid,hash(5));await db.exec('RESET ROLE');await db.exec("update public.beta_access set state='revoked'");await db.exec('SET ROLE anon');
  assert.equal(await consume(hash(5)),null);await assert.rejects(issue(uid,hash(6)),/access_denied/);
  await issue(owner,hash(7));assert.equal((await consume(hash(7))).main_uid,owner);
  await db.exec('RESET ROLE');await db.exec("update public.beta_access set state='approved'");await db.exec('SET ROLE anon');assert.equal(await consume(hash(5)),null);
  await db.exec('RESET ROLE');await db.exec('update auth.users set email_confirmed_at=null');await db.exec('SET ROLE anon');await assert.rejects(issue(owner,hash(8)),/access_denied/);
  await db.exec('RESET ROLE');await db.exec('SET ROLE authenticated');await assert.rejects(db.query('select * from fantazia_internal.launcher_login_codes'));await assert.rejects(issue(uid,hash(9),'wrong'));
  await db.exec('RESET ROLE');assert.equal((await db.query('select count(*)::int as n from auth.users')).rows[0].n,2);assert.equal((await db.query('select count(*)::int as n from public.player_profiles')).rows[0].n,2);
  const state=(await db.query('select revision,payload from fantazia_internal.runtime_state')).rows[0];assert.equal(Number(state.revision),0);assert.deepEqual(state.payload,{accounts:{}});
 }finally{await db.close();}
});
