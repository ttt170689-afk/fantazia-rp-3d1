// ═══════════════════════════════════════════════════════════════════════════
//  ЗАХВАТ ЖИВЫХ ОБЪЕКТОВ: NPC, машины, фонари, конфиги день/ночь
//  Тот же приём, что с городом: запускаем настоящий код и снимаем данные.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(__dirname, '..', 'Assets', 'StreamingAssets');

let html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
html = html.replace(/<script[^>]*socket\.io[^>]*><\/script>/g,
  '<script>window.io=function(){return{on(){},emit(){},id:"c",connected:false};};</script>');
html = html.replace(/<script src="([^"]+?)(\?[^"]*)?"><\/script>/g, (m, src) => {
  const f = path.join(ROOT, 'public', src);
  if (!fs.existsSync(f)) return '';
  return '<script>' + fs.readFileSync(f, 'utf8').replace(/<\/script>/g, '<\\/script>') + '</script>';
});
const STUB = `<script>
HTMLCanvasElement.prototype.getContext=function(){return{fillRect(){},clearRect(){},fillText(){},strokeText(){},beginPath(){},roundRect(){},moveTo(){},lineTo(){},stroke(){},fill(){},arc(){},ellipse(){},closePath(){},rect(){},save(){},restore(){},translate(){},rotate(){},scale(){},drawImage(){},clip(){},quadraticCurveTo(){},bezierCurveTo(){},setTransform(){},createLinearGradient(){return{addColorStop(){}}},createRadialGradient(){return{addColorStop(){}}},createPattern(){return null},measureText(){return{width:10}},getImageData(){return{data:new Uint8ClampedArray(4)}},putImageData(){},setLineDash(){},strokeRect(){},toDataURL(){return''}}};
HTMLCanvasElement.prototype.toDataURL=function(){return''};
window.CanvasRenderingContext2D=function(){};
window.AudioContext=window.webkitAudioContext=function(){return{createGain(){return{connect(){},gain:{value:1,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}}}},createOscillator(){return{connect(){},start(){},stop(){},frequency:{value:1,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},type:''}},createBufferSource(){return{connect(){},start(){},stop(){},buffer:null}},createBuffer(){return{getChannelData(){return new Float32Array(100)}}},createBiquadFilter(){return{connect(){},frequency:{value:1,setValueAtTime(){}},Q:{value:1},type:''}},destination:{},currentTime:0,sampleRate:44100,resume(){},state:'running'}};
window.requestAnimationFrame=function(){return 0};window.cancelAnimationFrame=function(){};
window.alert=function(){};window.scrollTo=function(){};
</script>`;
html = html.replace('</head>', STUB + '</head>');

const vc = new VirtualConsole();
vc.on('jsdomError', () => {});
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true,
                              url: 'https://x.test/', virtualConsole: vc });
const w = dom.window;

setTimeout(() => {
  const T = w.THREE;
  try { w.initThreeJS(); } catch (e) {}
  ['buildCity','buildFantaziaCityV3','buildNewCityDistricts'].forEach(b => {
    if (typeof w[b] === 'function') { try { w[b](); } catch (e) {} }
  });
  // NPC и машины спавнятся отдельно
  ['buildNPCPopulation','buildStreetFurniture','spawnCityNPCs','spawnTraffic','spawnCars','initCars'].forEach(f => {
    if (typeof w[f] === 'function') { try { w[f](); } catch (e) {} }
  });
  w.scene.updateMatrixWorld(true);

  // ── NPC ──
  let npcs = [];
  try {
    npcs = JSON.parse(w.eval(
      'JSON.stringify((typeof npcs!=="undefined"?npcs:[]).filter(n=>!n.isInterior).map(n=>({x:n.x,z:n.z,role:n.role||"shopper"})))'
    ));
  } catch (e) { console.log('  npcs:', e.message); }

  // ── МАШИНЫ ──
  let cars = [];
  try {
    cars = JSON.parse(w.eval(
      'JSON.stringify((typeof cars!=="undefined"?cars:[]).map(c=>({x:c.x,z:c.z,type:c.type||"sedan",color:(c.cfg&&c.cfg.color)||0x888888,name:(c.cfg&&c.cfg.name)||""})))'
    ));
  } catch (e) { console.log('  cars:', e.message); }

  // ── ТИПЫ МАШИН (для покупки в игре) ──
  let carTypes = [];
  try {
    carTypes = JSON.parse(w.eval(
      'JSON.stringify((typeof CAR_TYPES!=="undefined"?CAR_TYPES:[]).map(c=>({id:c.id,name:c.name||"",color:c.color||0x888888,price:c.price||0,speed:c.speed||1})))'
    ));
  } catch (e) {}

  // ── ФОНАРИ (включаются ночью) ──
  let lamps = [];
  try {
    const V = new T.Vector3();
    const heads = w._fzLampGlows || [];
    for (let i = 0; i < heads.length; i++) {
      const o = heads[i];
      if (!o || !o.getWorldPosition) continue;
      o.getWorldPosition(V);
      lamps.push({ x:+V.x.toFixed(1), y:+V.y.toFixed(1), z:+V.z.toFixed(1) });
    }
  } catch (e) {}

  // ── РОЛИ NPC: цвета ──
  const npcRoles = {
    shopper:  { skin:0xd4a574, shirt:0xe74c3c },
    guard:    { skin:0xd4a574, shirt:0x1a3a6e },
    clerk:    { skin:0x8e44ad, shirt:0x8e44ad },
    chef:     { skin:0xffffff, shirt:0xffffff },
    merchant: { skin:0xc8a04a, shirt:0xb8860b }
  };

  // ── ДЕНЬ/НОЧЬ ──
  const dayNight = {
    speed: 0.01,
    skyNight: 0x0a0a2a, skyDay: 0x87CEEB,
    sunNight: 0x4444AA, sunDay: 0xFFF5E1,
    sunMin: 0.3, sunMax: 1.0,
    nightThreshold: 0.45
  };

  fs.writeFileSync(path.join(OUT,'npcs.json'), JSON.stringify(npcs));
  fs.writeFileSync(path.join(OUT,'npc_roles.json'), JSON.stringify(npcRoles, null, 1));
  fs.writeFileSync(path.join(OUT,'cars.json'), JSON.stringify(cars, null, 1));
  fs.writeFileSync(path.join(OUT,'car_types.json'), JSON.stringify(carTypes, null, 1));
  fs.writeFileSync(path.join(OUT,'lamps.json'), JSON.stringify(lamps));
  fs.writeFileSync(path.join(OUT,'daynight.json'), JSON.stringify(dayNight, null, 1));

  console.log('ЗАХВАЧЕНО:');
  console.log('  NPC          :', npcs.length);
  console.log('  машин на карте:', cars.length);
  console.log('  типов машин  :', carTypes.length);
  console.log('  фонарей      :', lamps.length);
  process.exit(0);
}, 6000);
