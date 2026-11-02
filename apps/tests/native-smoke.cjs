'use strict';
/* Runs on the Windows build runner with the real Electron runtime. Fake HTTPS
 * responses are test-only session handlers; no certificate bypass ships. */
const {app,session}=require('electron'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{once}=require('node:events');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'fantazia-desktop-test-'));app.setPath('userData',temp);
(async()=>{await app.whenReady();
 const handler=async request=>new Response(new URL(request.url).pathname==='/api/health'?JSON.stringify({ok:true,name:'Fantazia RP 3D'}):'<!doctype html><html><body><h1>Windows online test</h1><canvas></canvas></body></html>',{headers:{'content-type':new URL(request.url).pathname==='/api/health'?'application/json':'text/html'}});
 await session.defaultSession.protocol.handle('https',handler);await session.fromPartition('persist:fantazia-online-v1').protocol.handle('https',handler);
 fs.writeFileSync(path.join(temp,'server.json'),JSON.stringify({url:'https://old-preview.example.org/'}));
 const {createDesktop,DEFAULT_SERVER,CONNECTION_TIMEOUT_MS}=require('../desktop/main.cjs');
 assert.equal(DEFAULT_SERVER,'https://fantazia-rp-3d1.onrender.com/');assert.equal(CONNECTION_TIMEOUT_MS,120000);
 const desktop=createDesktop();const launcher=desktop.launcher;await once(launcher.webContents,'did-finish-load');
 const local=await launcher.webContents.executeJavaScript('({bridge:typeof window.fantazia,require:typeof require,process:typeof process})');assert.equal(local.bridge,'object');assert.equal(local.require,'undefined');assert.equal(local.process,'undefined');
 const deadline=Date.now()+15000;
 while(!desktop.game || desktop.game.webContents.isLoading() || desktop.game.webContents.getURL()!==DEFAULT_SERVER){
  if(Date.now()>deadline)throw new Error('Automatic production connection did not open the game');
  await new Promise(resolve=>setTimeout(resolve,50));
 }
 assert.equal(JSON.parse(fs.readFileSync(path.join(temp,'server.json'),'utf8')).url,DEFAULT_SERVER);
 await desktop.changeServer();
 const invalid=await launcher.webContents.executeJavaScript("window.fantazia.connect('file:///secret')");assert(!invalid.ok);assert.equal(desktop.game,null);
 fs.mkdirSync(path.join(__dirname,'reports'),{recursive:true});fs.writeFileSync(path.join(__dirname,'reports/launcher-windows.png'),(await launcher.webContents.capturePage()).toPNG());
 const result=await launcher.webContents.executeJavaScript("window.fantazia.connect('https://desktop.example.org/')");assert(result.ok,JSON.stringify(result));assert(desktop.game);
 const remote=await desktop.game.webContents.executeJavaScript('({bridge:typeof window.fantazia,require:typeof require,process:typeof process})');assert.deepEqual(remote,{bridge:'undefined',require:'undefined',process:'undefined'});assert.equal(JSON.parse(fs.readFileSync(path.join(temp,'server.json'),'utf8')).url,'https://desktop.example.org/');
 const prefs=desktop.game.webContents.getLastWebPreferences();assert(prefs.sandbox&&prefs.contextIsolation&&!prefs.nodeIntegration&&!prefs.preload);
 let blocked=false;const closed=once(desktop.game,'closed');desktop.game.webContents.emit('will-navigate',{preventDefault(){blocked=true;}},'https://other.example.org/');assert(blocked);await closed;assert.equal(desktop.game,null);
 const saved=await launcher.webContents.executeJavaScript('window.fantazia.read()');assert.equal(saved.url,'https://desktop.example.org/');
 console.log('PASS Windows Electron: automatic production connection overrides saved preview, launcher/preload IPC, URL rejection, health handshake, isolated online renderer, blocked cross-origin navigation, server preference persistence and return to launcher.');await desktop.quit();
})().catch(error=>{console.error(error);app.exit(1);});
