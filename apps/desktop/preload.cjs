'use strict';
const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('fantazia', Object.freeze({
  read:()=>ipcRenderer.invoke('desktop:read'),
  connect:url=>ipcRenderer.invoke('desktop:connect',url),
  cancel:()=>ipcRenderer.invoke('desktop:cancel'),
  onStatus:callback=>{const listener=(_event,message)=>callback(String(message));ipcRenderer.on('desktop:status',listener);return ()=>ipcRenderer.removeListener('desktop:status',listener);}
}));
