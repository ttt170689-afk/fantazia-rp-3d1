const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
(async()=>{const db=new PGlite();let checks=0;const ok=(a)=>{assert(a);checks++;};try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid primary key);CREATE TABLE public.creator_roles(user_id uuid,role text);CREATE TABLE public.beta_access(id uuid primary key default gen_random_uuid(),user_id uuid,game_id text,code_id uuid NOT NULL,state text,updated_at timestamptz default now(),UNIQUE(user_id,game_id));CREATE TABLE public.beta_audit(actor uuid,action text,subject uuid);CREATE FUNCTION public._beta_user() RETURNS uuid LANGUAGE plpgsql AS $$ BEGIN IF current_setting('fixture.uid',true) IS NULL OR current_setting('fixture.uid',true)='' THEN RAISE EXCEPTION 'login required';END IF;RETURN current_setting('fixture.uid')::uuid;END;$$;CREATE FUNCTION public.beta_status(p_game text) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('game_id',p_game,'state',state,'request_id',id,'updated_at',updated_at) FROM public.beta_access WHERE user_id=public._beta_user() AND game_id=p_game;$$;`);
 await db.exec(fs.readFileSync(path.join(__dirname,'../backend/requests.sql'),'utf8'));
 let denied=false;try{await db.query("select public.beta_request('fantazia')");}catch{denied=true;}ok(denied);
 await db.exec("SET fixture.uid='11111111-1111-4111-8111-111111111111';SET ROLE authenticated;");
 let r=await db.query("select public.beta_request('fantazia') as x");ok(r.rows[0].x.status.state==='pending');r=await db.query("select public.beta_request('fantazia') as x");ok(r.rows[0].x.status.state==='pending');await db.exec('RESET ROLE');ok((await db.query('select count(*)::int as n from public.beta_audit')).rows[0].n===1);
 for(const state of ['approved','rejected','revoked']){await db.query('update public.beta_access set state=$1',[state]);r=await db.query("select public.beta_request('fantazia') as x");ok(r.rows[0].x.status.state===state);}
 await db.exec(fs.readFileSync(path.join(__dirname,'../backend/storage.sql'),'utf8'));await db.exec('SET ROLE anon');
 denied=false;try{await db.query("select public.fantazia_runtime_read('wrong')");}catch{denied=true;}ok(denied);
 denied=false;try{await db.query('select * from fantazia_internal.runtime_state');}catch{denied=true;}ok(denied);
 await db.exec('RESET ROLE');const secret='T'.repeat(43);await db.query("update fantazia_internal.runtime_state set secret_hash=decode($1,'hex')",[crypto.createHash('sha256').update(secret).digest('hex')]);await db.exec('SET ROLE anon');
 r=await db.query('select public.fantazia_runtime_read($1) as x',[secret]);ok(r.rows[0].x.revision===0);
 await db.query('select public.fantazia_runtime_write($1,0,$2::jsonb)',[secret,JSON.stringify({accounts:{one:{level:7}}})]);r=await db.query('select public.fantazia_runtime_read($1) as x',[secret]);ok(r.rows[0].x.payload.accounts.one.level===7&&r.rows[0].x.revision===1);
 denied=false;try{await db.query('select public.fantazia_runtime_write($1,0,$2::jsonb)',[secret,'{"accounts":{}}']);}catch{denied=true;}ok(denied);
 console.log('PASS embedded PostgreSQL',checks,'checks: pending/idempotence/never-reset approvals, anon denied, private state secret and CAS durability.');
 }finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
