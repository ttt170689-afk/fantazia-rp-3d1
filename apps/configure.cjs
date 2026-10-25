'use strict';
const fs=require('node:fs'),path=require('node:path');
function validate(value){
 if(!value)throw new Error('Set FANTAZIA_GAME_URL to the permanent HTTPS game address before building.');
 const u=new URL(value);
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||['localhost','127.0.0.1','0.0.0.0','[::1]'].includes(u.hostname))throw new Error('Use a public HTTPS URL without credentials, query or fragment.');
 return u.href;
}
function configure(){
 const url=validate(process.env.FANTAZIA_GAME_URL),base=__dirname;
 fs.writeFileSync(path.join(base,'game-config.json'),JSON.stringify({url},null,2)+'\n');
 fs.writeFileSync(path.join(base,'capacitor.config.json'),JSON.stringify({appId:'org.fantazia.rp3d',appName:'Fantazia RP 3D',webDir:'shell',server:{url,cleartext:false},android:{allowMixedContent:false,webContentsDebuggingEnabled:false},backgroundColor:'#172435'},null,2)+'\n');
 console.log('Shell configuration written. This does not build or publish an APK/EXE.');
}
if(require.main===module)configure();module.exports={validate};
