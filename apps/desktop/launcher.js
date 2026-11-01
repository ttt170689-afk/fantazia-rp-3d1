'use strict';
const form=document.getElementById('connection'),input=document.getElementById('server'),connect=document.getElementById('connect'),cancel=document.getElementById('cancel'),status=document.getElementById('status');
let request=0;
function message(text,error=false){status.textContent=text;status.classList.toggle('error',error);}
function busy(value){input.disabled=connect.disabled=value;cancel.hidden=!value;form.setAttribute('aria-busy',String(value));}
async function init(){
  if(!window.fantazia){message('Этот экран запускается через приложение Fantazia RP, а не двойным щелчком по HTML.',true);connect.disabled=true;return;}
  try{const saved=await window.fantazia.read();input.value=saved.url||'';document.getElementById('version').textContent='v'+saved.version;input.focus();}catch{message('Не удалось прочитать настройки приложения.',true);}
  window.fantazia.onStatus(text=>{request++;busy(false);message(text,!!text);input.focus();});
}
form.addEventListener('submit',async e=>{e.preventDefault();if(connect.disabled)return;const id=++request;busy(true);message('Проверяем сервер…');try{const result=await window.fantazia.connect(input.value);if(id!==request)return;message(result.ok?'Игра открыта в отдельном окне.':result.error,!result.ok);}catch{if(id===request)message('Подключение прервано. Попробуй ещё раз.',true);}finally{if(id===request)busy(false);}});
cancel.addEventListener('click',async()=>{request++;await window.fantazia.cancel();busy(false);message('Подключение отменено.');input.focus();});
init();
