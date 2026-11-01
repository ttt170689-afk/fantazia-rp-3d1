'use strict';
const { app, BrowserWindow, Menu, ipcMain, dialog, session, net, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { validate, sameOrigin, microphoneRequest, readHealth } = require('../url-policy.cjs');
const launcherFile = path.join(__dirname, 'launcher.html');
const launcherURL = pathToFileURL(launcherFile).href;

function createDesktop() {
  let launcher, game, currentURL = '', pending = null, generation = 0, quitting = false, micGranted = false;
  const dataFile = path.join(app.getPath('userData'), 'server.json');
  const gameSession = session.fromPartition('persist:fantazia-online-v1');
  session.defaultSession.setPermissionCheckHandler(()=>false);
  session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  function lastURL() { try { return validate(JSON.parse(fs.readFileSync(dataFile, 'utf8')).url); } catch { return ''; } }
  function saveURL(url) { fs.mkdirSync(path.dirname(dataFile), {recursive:true}); fs.writeFileSync(dataFile + '.tmp', JSON.stringify({version:1,url}) + '\n', {mode:0o600}); fs.renameSync(dataFile + '.tmp', dataFile); }
  const validIPC = e => launcher && !launcher.isDestroyed() && e.sender === launcher.webContents && e.senderFrame === launcher.webContents.mainFrame && e.senderFrame.url === launcherURL;
  function cancel() { generation++; pending?.abort(); pending = null; }
  function status(message) { if (launcher && !launcher.isDestroyed()) launcher.webContents.send('desktop:status', message); }
  function showLauncher(message = '') { if (quitting) return; launcher.show(); launcher.focus(); status(message); }
  async function closeGame() {
    if (!game || game.isDestroyed()) return;
    const w = game; game = null;
    try { await Promise.race([w.webContents.executeJavaScript('Promise.resolve(window.FZSave41?.flush(true)).catch(()=>false)'), new Promise(r=>setTimeout(r,1500))]); } catch {}
    if (!w.isDestroyed()) w.destroy();
    micGranted = false;
  }
  async function changeServer() { cancel(); await closeGame(); showLauncher(); }
  async function quit() { if (quitting) return; quitting = true; cancel(); await closeGame(); app.quit(); }
  function fail(message, w) { if (w !== game) return; cancel(); closeGame().then(()=>showLauncher(message)); }
  function secureGame(w, url) {
    const allowed = target => sameOrigin(target, url);
    w.webContents.setWindowOpenHandler(() => ({action:'deny'}));
    for (const name of ['will-navigate','will-redirect']) w.webContents.on(name,(e,target)=>{ if (!allowed(target)) { e.preventDefault(); fail('Сервер попытался перейти на другой адрес. Подключение остановлено.',w); } });
    w.webContents.on('will-frame-navigate',(e)=>{ if (!allowed(e.url)) e.preventDefault(); });
    w.webContents.on('will-attach-webview', e=>e.preventDefault());
    w.webContents.on('did-fail-load',(_e,code,_description,_url,main)=>{ if(main && code!==-3)fail('Не удалось открыть игру. Проверь интернет, сертификат HTTPS и доступность сервера.',w); });
    w.webContents.on('render-process-gone',()=>fail('Окно игры остановилось. Можно подключиться снова.',w));
    w.webContents.on('unresponsive',()=>status('Игра долго не отвечает. F10 возвращает к подключению.'));
    w.on('close',e=>{ if(!quitting && game===w){e.preventDefault();changeServer();} });
    w.on('closed',()=>{if(game===w){game=null;showLauncher();}});
  }
  gameSession.setPermissionCheckHandler((wc,permission,origin)=>wc===game?.webContents && sameOrigin(origin,currentURL) && (['fullscreen','pointerLock'].includes(permission)||(permission==='media'&&micGranted)));
  gameSession.setPermissionRequestHandler(async(wc,permission,callback,details)=>{
    if(wc!==game?.webContents || !sameOrigin(details.requestingUrl || wc.getURL(),currentURL) || details.isMainFrame===false) return callback(false);
    if(['fullscreen','pointerLock'].includes(permission)) return callback(true);
    if(!microphoneRequest(permission,details)) return callback(false);
    if(micGranted) return callback(true);
    const requestingGame=game;
    try { const result=await dialog.showMessageBox(requestingGame,{type:'question',title:'Голосовой чат',message:'Разрешить этому серверу доступ к микрофону?',detail:new URL(currentURL).hostname,buttons:['Не разрешать','Разрешить'],defaultId:0,cancelId:0}); micGranted=result.response===1&&game===requestingGame;callback(micGranted); } catch {callback(false);}
  });
  gameSession.setDevicePermissionHandler(()=>false);
  gameSession.on('will-download',(e,item,wc)=>{
    if(wc!==game?.webContents || !/^image\/(png|jpeg|webp)$/.test(item.getMimeType()) || !/\.(png|jpe?g|webp)$/i.test(item.getFilename()))return e.preventDefault();
    item.setSaveDialogOptions({title:'Сохранить фото из игры',defaultPath:path.join(app.getPath('pictures'),path.basename(item.getFilename()))});
  });
  async function connect(raw) {
    let url; try {url=validate(raw);}catch(e){return {ok:false,error:e.message};}
    if(game && !game.isDestroyed())return {ok:false,error:'Сначала закрой текущее окно игры.'};
    cancel(); const id=generation,controller=new AbortController();pending=controller;
    const timer=setTimeout(()=>controller.abort(),15000);
    try {
      const response=await net.fetch(new URL('/api/health',url).href,{signal:controller.signal,redirect:'error',credentials:'omit'});
      await readHealth(response);
      if(id!==generation || quitting)return {ok:false,error:'Подключение отменено.'};
      saveURL(url);currentURL=url;micGranted=false;
      const w=new BrowserWindow({width:1280,height:800,minWidth:800,minHeight:600,title:'Fantazia RP 3D',backgroundColor:'#080b12',show:false,icon:path.join(__dirname,'assets/icon.png'),webPreferences:{partition:'persist:fantazia-online-v1',contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true,allowRunningInsecureContent:false}});
      game=w;secureGame(w,url);
      w.once('ready-to-show',()=>{if(game===w&&!quitting){w.show();launcher.hide();}});
      try {await w.loadURL(url);}catch {if(game===w)fail('Игра не загрузилась. Проверь доступность сервера.',w);return {ok:false,error:'Не удалось открыть игру.'};}
      return id===generation?{ok:true,url}:{ok:false,error:'Подключение отменено.'};
    }catch(e){return {ok:false,error:controller.signal.aborted?'Сервер не ответил или подключение отменено.':/^По этому адресу/.test(e.message)?e.message:'Не удалось подключиться. Проверь адрес, интернет и HTTPS-сертификат сервера.'};}
    finally{clearTimeout(timer);if(pending===controller)pending=null;}
  }
  launcher=new BrowserWindow({width:980,height:740,minWidth:660,minHeight:620,title:'Fantazia RP — подключение',backgroundColor:'#080b12',show:false,icon:path.join(__dirname,'assets/icon.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true}});
  launcher.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  launcher.webContents.on('will-navigate',e=>e.preventDefault());
  launcher.webContents.on('will-attach-webview',e=>e.preventDefault());
  launcher.on('close',e=>{if(!quitting){e.preventDefault();quit();}});
  launcher.once('ready-to-show',()=>launcher.show());
  ipcMain.handle('desktop:read',e=>validIPC(e)?{url:lastURL(),version:app.getVersion()}:{url:'',version:''});
  ipcMain.handle('desktop:connect',(e,url)=>validIPC(e)?connect(url):{ok:false,error:'Доступ запрещён.'});
  ipcMain.handle('desktop:cancel',async e=>{if(validIPC(e)){cancel();await closeGame();showLauncher();}});
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label:'Игра',submenu:[{label:'Сменить сервер',accelerator:'F10',click:changeServer},{label:'Перезагрузить игру',accelerator:'CmdOrCtrl+R',click:()=>game?.webContents.reload()},{label:'Открыть сервер в браузере',click:()=>{if(currentURL)shell.openExternal(currentURL);}},{type:'separator'},{label:'Выход',accelerator:'Alt+F4',click:quit}]},
    {label:'Вид',submenu:[{label:'Полный экран',accelerator:'F11',click:()=>{const w=game||launcher;w.setFullScreen(!w.isFullScreen());}},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'}]},
    {label:'Справка',submenu:[{label:'О приложении',click:()=>dialog.showMessageBox(game||launcher,{type:'info',title:'Fantazia RP',message:'Fantazia RP — онлайн-клиент '+app.getVersion(),detail:'Игра и аккаунты находятся на выбранном сервере.\nF10 — подключение · F11 — полный экран.\nУстановщик не размещает игровой сервер и не переносит игру на другой движок.'})}]}
  ]));
  launcher.loadFile(launcherFile);
  app.on('before-quit',e=>{if(!quitting){e.preventDefault();quit();}});
  return {get launcher(){return launcher;},get game(){return game;},connect,changeServer,quit};
}
function start(){
  app.setName('Fantazia RP 3D');
  if(!app.requestSingleInstanceLock()){app.quit();return;}
  let desktop;app.on('second-instance',()=>{const w=desktop?.game||desktop?.launcher;if(w){if(w.isMinimized())w.restore();w.show();w.focus();}});
  app.whenReady().then(()=>{desktop=createDesktop();});app.on('window-all-closed',()=>app.quit());
}
if(require.main===module)start();
module.exports={createDesktop};
