'use strict';
const {app,BrowserWindow,dialog,shell}=require('electron');
const {validate}=require('../configure.cjs');
const url=validate(require('../game-config.json').url),origin=new URL(url).origin;
let win;
const sameSite=value=>{try{return new URL(value).origin===origin;}catch{return false;}};
function open(){
 win=new BrowserWindow({width:1280,height:800,minWidth:360,minHeight:440,backgroundColor:'#172435',title:'Fantazia RP 3D',autoHideMenuBar:true,webPreferences:{contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true}});
 win.webContents.setWindowOpenHandler(({url:target})=>{try{if(new URL(target).protocol==='https:')shell.openExternal(target);}catch{}return {action:'deny'};});
 win.webContents.on('will-navigate',(e,target)=>{if(!sameSite(target))e.preventDefault();});
 win.webContents.on('will-attach-webview',e=>e.preventDefault());
 win.webContents.session.setPermissionCheckHandler((wc,permission,requestingOrigin)=>wc===win.webContents&&sameSite(requestingOrigin)&&['fullscreen','media'].includes(permission));
 win.webContents.session.setPermissionRequestHandler(async(wc,permission,callback,details)=>{
  if(wc!==win.webContents||!sameSite(details.requestingUrl||wc.getURL()))return callback(false);
  if(permission==='fullscreen')return callback(true);
  if(permission!=='media'||details.mediaTypes?.includes('video'))return callback(false);
  const answer=await dialog.showMessageBox(win,{type:'question',message:'Разрешить микрофон для голосового чата Fantazia?',buttons:['Не разрешать','Разрешить'],defaultId:0,cancelId:0});callback(answer.response===1);
 });
 win.webContents.on('did-fail-load',async(e,code,description,failedUrl,isMainFrame)=>{
  if(!isMainFrame||code===-3)return;
  const {response}=await dialog.showMessageBox(win,{type:'warning',message:'Не удалось загрузить Fantazia. Проверь интернет и доступность игрового сервера.',buttons:['Повторить','Закрыть'],defaultId:0});
  if(response===0)win.loadURL(url);else win.close();
 });
 win.loadURL(url);
}
app.whenReady().then(open);app.on('window-all-closed',()=>app.quit());
