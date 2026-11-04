// Test-only preload: production has NO fixture flag or network fallback.
const http=require('node:http');const original=http.createServer;
http.createServer=function(...a){const server=original.apply(this,a);server.once('listening',()=>process.send?.({port:server.address().port}));return server;};
let revision=0,payload={accounts:{}};
global.fetch=async(url,o={})=>{if(!String(url).startsWith('https://jubsgthkahxxexmibdwn.supabase.co/'))throw Error('Unexpected external test network');const name=String(url).split('/').pop();let b={};try{b=JSON.parse(o.body||'{}');}catch{};const owner=o.headers?.Authorization==='Bearer owner.jwt.token',id=owner?'22222222-2222-4222-8222-222222222222':'11111111-1111-4111-8111-111111111111';let answer;
 if(name==='fantazia_runtime_read')answer={revision,payload};else if(name==='fantazia_runtime_write'){if(b.p_revision!==revision)return new Response('{}',{status:409});payload=b.p_payload;answer={revision:++revision};}
 else if(name==='user')answer={id,email_confirmed_at:'2026-11-03T00:00:00Z'};
 else if(name==='my_profile')answer=[{id,username:owner?'owner_fixture':'tester_fixture',is_creator:owner}];
 else if(name==='fantazia_owner_status')answer=owner;
 else if(name==='beta_status')answer={game_id:'fantazia',state:process.env.FIXTURE_BETA_FILE&&require('node:fs').readFileSync(process.env.FIXTURE_BETA_FILE,'utf8').trim()==='revoked'?'revoked':'approved',request_id:id,updated_at:'2026-11-03T00:00:00Z'};
 else return new Response('{}',{status:503});return new Response(JSON.stringify(answer));};
