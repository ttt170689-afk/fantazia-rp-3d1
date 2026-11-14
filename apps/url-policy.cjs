'use strict';
const net = require('node:net');
function validate(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048) throw Error('Укажи HTTPS-адрес игрового сервера.');
  let u; try { u = new URL(value.trim()); } catch { throw Error('Нужен полный адрес, например https://game.example.org/'); }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash) throw Error('Нужен HTTPS-адрес без пароля, токена, параметров и #.');
  if (!host.includes('.') || host.endsWith('.') || host.endsWith('.localhost') || host.endsWith('.local') || host === 'localhost' || host.startsWith('[') || net.isIP(host)) throw Error('Укажи публичное доменное имя сервера, не локальный IP-адрес.');
  if (!['/', '/index.html'].includes(u.pathname)) throw Error('Укажи корневой адрес сервера без пути к странице.');
  return u.origin + '/';
}
function sameOrigin(value, server) { try { return new URL(value).origin === new URL(server).origin && new URL(value).protocol === 'https:'; } catch { return false; } }
function microphoneRequest(permission, details) { return permission === 'media' && Array.isArray(details?.mediaTypes) && details.mediaTypes.length === 1 && details.mediaTypes[0] === 'audio'; }
async function readHealth(response) {
 if(!response.ok || !response.body)throw Error('Сервер ответил ошибкой.');
 const reader=response.body.getReader();let length=0;const chunks=[];
 try {while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>16384)throw Error('Неверный ответ сервера.');chunks.push(value);}} finally {await reader.cancel().catch(()=>{});}
 const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(value.ok!==true||value.name!=='Fantazia RP 3D')throw Error('По этому адресу не найден сервер Fantazia RP 3D.');return value;
}
module.exports = { validate, sameOrigin, microphoneRequest, readHealth };
