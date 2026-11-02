'use strict';
// Deliberately separate from client economy data: never accept money, roles or inventory here.
const {clean}=require('../public/assets/fz-save41-policy');
function attach(app,{accounts,commit,players,sockets}){
 const account=req=>{const t=req.body?.token;return typeof t==='string'&&t.length>=32?Object.values(accounts).find(a=>a.token===t):null;};
 app.post('/api/session/load',(req,res)=>{res.set('Cache-Control','no-store');const a=account(req);if(!a)return res.status(401).json({ok:false,error:'Войди в аккаунт заново'});res.json({ok:true,revision:a.resume41?.revision||0,snapshot:a.resume41?.snapshot||null,savedAt:a.resume41?.savedAt||null});});
 app.post('/api/session/save',(req,res)=>{
  const a=account(req);if(!a)return res.status(401).json({ok:false,error:'Войди в аккаунт заново'});
  const snapshot=clean(req.body.snapshot);if(!snapshot)return res.status(400).json({ok:false,error:'Некорректная точка сохранения'});
  const revision=a.resume41?.revision||0;if(req.body.revision!==revision)return res.status(409).json({ok:false,error:'Сохранение изменено другим сеансом. Перезайди в игру.',revision});
  const before={...a};a.resume41={revision:revision+1,snapshot,savedAt:Date.now()};
  // Economy remains authoritative in the connected server player, not the POST body.
  const active=Object.values(players()).find(p=>{const sock=sockets().get(p.id);return sock?.data.accountToken===req.body.token&&sock.data.accountKey===a.username.toLowerCase();});
  if(active)for(const k of ['money','level','exp','inventory','appearance','job'])a[k]=active[k];
  if(!commit()){Object.keys(a).forEach(k=>delete a[k]);Object.assign(a,before);return res.status(503).json({ok:false,error:'Сервер не смог записать сохранение'});}
  res.json({ok:true,revision:a.resume41.revision,savedAt:a.resume41.savedAt});
 });
}
module.exports={clean,attach};
