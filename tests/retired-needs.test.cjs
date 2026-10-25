// Regression: legacy empty needs cannot damage/slow players or resurrect UI.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom'),THREE=require('three'),acorn=require('acorn');
const dom=new JSDOM('<body><div id="fzStory">old story</div></body>',{url:'https://fantazia.test',runScripts:'outside-only'}),w=dom.window,ctx=dom.getInternalVMContext();
const run=s=>vm.runInContext(s,ctx),logs=[];
w.THREE=THREE;w.setTimeout=()=>0;w.setInterval=()=>0;
w.localPlayer={mesh:new THREE.Object3D(),health:73,money:1000};
w.showNotification=t=>logs.push(t);w.damagePlayer=n=>w.localPlayer.health-=n;
w.localStorage.setItem('fz8_life',JSON.stringify({vit:{food:0,water:0,energy:0},res:{metal:17},seen:true}));
run(fs.readFileSync(path.join(__dirname,'../public/assets/fz-v8life.js'),'utf8'));
assert.equal(w.FZ8L.S.res.metal,17,'save is preserved');
assert.equal(w.document.getElementById('fz8Hud'),null);assert(w.document.getElementById('fz8Race'),'race HUD retained');
assert(!('stamina' in w.FZ8L.skills));
const speed=w.FZ8_speedMul();
w.FZ8L.S.vit.food=0;w.FZ8L.S.vit.water=0;w.FZ8L.S.vit.energy=0;
for(let i=0;i<4000;i++)w.FZ8L_update(.1);
assert.equal(w._fz8LifeErr,undefined);assert.equal(w.FZ8_speedMul(),speed);assert.equal(w.localPlayer.health,73);
assert.deepEqual(JSON.parse(JSON.stringify(w.FZ8L.vitals())),{food:100,water:100,energy:100});
assert(!logs.some(t=>/на исходе|сытост|жажд|силы низк|система жизни/.test(t)));
w.FZ8L.panel('skills');assert(!w.document.getElementById('fz8PanelLife').textContent.includes('Выносливость'));
w.FZ8L.rest(60);w.FZ8L.eat('meal');assert.equal(w.localPlayer.health,73);
// Extract the actual retired story functions from the native inline script.
const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8'),wanted=new Set(['loadStory','saveStory','renderStory','completeChapter','storyUpdate']);
run('const FZ={story:null}; let awarded=0; function addMoney(n){awarded+=n} function addCoins(n){awarded+=n}');
let found=0;
function walk(n,source){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&wanted.has(n.id.name)){run(source.slice(n.start,n.end));found++;}for(const value of Object.values(n))if(Array.isArray(value))value.forEach(v=>walk(v,source));else if(value&&typeof value==='object')walk(value,source);}
for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))if(m[1].trim())walk(acorn.parse(m[1],{ecmaVersion:'latest'}),m[1]);
assert.equal(found,wanted.size);
const saved=JSON.stringify({ch:4,walked:300,done:false});w.localStorage.setItem('fz_story_v1',saved);
run('loadStory(); renderStory(); storyUpdate(); completeChapter(); saveStory();');
assert(run('FZ.story.disabled && FZ.story.done'));assert.equal(run('awarded'),0);assert.equal(w.document.getElementById('fzStory'),null);assert.equal(w.localStorage.getItem('fz_story_v1'),saved);
assert(!html.includes('📖 НОВАЯ ЖИЗНЬ'));
console.log('PASS retired needs: old saves, no drain/damage/slowdowns/HUD/warnings; story has no tracker, progress or rewards.');w.close();
