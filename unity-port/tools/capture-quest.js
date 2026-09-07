// ═══════════════════════════════════════════════════════════════════════════
//  ЗАХВАТ КВЕСТОВОЙ ЛИНИИ И ОСТАВШИХСЯ ДАННЫХ
//  6 записок с текстами, топор, босс, работы, квартиры, питомцы, звуки.
// ═══════════════════════════════════════════════════════════════════════════
const fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..','..');
const OUT=path.join(__dirname,'..','Assets','StreamingAssets');
const html=fs.readFileSync(path.join(ROOT,'public','index.html'),'utf8');
const srv=fs.readFileSync(path.join(ROOT,'server.js'),'utf8');

function block(text,start,open,close){
  const i=text.indexOf(start); if(i<0)return null;
  let d=0,j=text.indexOf(open,i); const from=j;
  for(;j<text.length;j++){
    if(text[j]===open)d++;
    else if(text[j]===close){d--;if(d===0)return text.slice(from,j+1);}
  }
  return null;
}
function ev(t){ try{ return new Function('return '+t)(); }catch(e){ return null; } }
function save(n,o){
  fs.writeFileSync(path.join(OUT,n),JSON.stringify(o,null,1));
  const c=Array.isArray(o)?o.length:Object.keys(o).length;
  console.log('  '+n.padEnd(24)+c+' записей');
}

// ── КВЕСТ: записки ──
const texts = ev(block(html,'const FZ_NOTE_TEXTS','[',']')) || [];
const spots = ev(block(html,'const FZ_NOTE_SPOTS','[',']')) || [];
const notes = spots.map((s,i)=>({
  index:i, x:s.x, z:s.z,
  text: texts[i] ? texts[i].t : ('Записка ' + (i+1))
}));
save('quest_notes.json', notes);

// ── КВЕСТ: ключевые точки ──
save('quest_config.json', {
  totalNotes: notes.length,
  axeHint: 'Офисный центр, кабинет директора на последнем этаже, сейф за картиной',
  bossHint: 'Заколоченный проход — 1 этаж GRAND MALL, спуск в подвал',
  // координаты из fzServiceDoor / fzBossDoorway (относительно кармана интерьера)
  serviceDoor: { x: 8.4, z: -10.4 },
  bossDoor:    { x: 18.6, z: 3.0 },
  boardsCount: 4
});

// ── РАБОТЫ ──
const jobs = ev(block(srv,'const jobDefinitions','{','}')) || {};
save('jobs.json', jobs);

// ── ТОВАРЫ ──
const shop = ev(block(srv,'const shopItems','{','}')) || {};
save('shop.json', shop);

// ── КВАРТИРЫ ──
// Квартиры на сервере генерируются циклом (server.js:471), а не лежат
// готовым списком. Повторяем ту же формулу: 30 квартир, этаж = i/5,
// цена растёт с этажом.
const apts = [];
for (let i = 1; i <= 30; i++) {
  apts.push({
    id: 'apt_' + i, number: i,
    floor: Math.ceil(i / 5),
    price: 600 + Math.floor(i / 5) * 200
  });
}
save('apartments.json', apts);

// ── ПИТОМЦЫ ──
let pets = ev(block(srv,'const petTypes','[',']')) || [];
save('pets.json', pets);

// ── ЗВУКИ: параметры процедурных сигналов ──
// В вебе звук синтезируется на WebAudio без файлов. Переносим параметры,
// чтобы в Unity сгенерировать те же тона.
save('sounds.json', {
  elevatorBeep:  { freq: 880, dur: 0.12, type: 'sine',   vol: 0.25 },
  elevatorDing:  { freq: 1320, dur: 0.35, type: 'sine',  vol: 0.3 },
  buttonClick:   { freq: 660, dur: 0.05, type: 'square', vol: 0.15 },
  coinPickup:    { freq: 1046, dur: 0.18, type: 'triangle', vol: 0.2 },
  questComplete: { freq: 784, dur: 0.5,  type: 'sine',  vol: 0.28 },
  doorOpen:      { freq: 220, dur: 0.4,  type: 'sawtooth', vol: 0.18 },
  carEngine:     { freq: 90,  dur: 0.0,  type: 'sawtooth', vol: 0.12 },
  footstep:      { freq: 160, dur: 0.06, type: 'triangle', vol: 0.1 }
});

console.log('\nГотово.');
