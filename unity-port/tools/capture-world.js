// ═══════════════════════════════════════════════════════════════════════════
//  ЗАХВАТ ГЕОМЕТРИИ МИРА ИЗ ЖИВОЙ ИГРЫ
//
//  Вместо ручного перевода тысяч строк генерации города — запускаем
//  НАСТОЯЩИЙ код игры в jsdom с three.js и записываем КАЖДЫЙ созданный
//  меш: позицию, поворот, масштаб, тип примитива и цвет.
//  На выходе JSON, по которому Unity воссоздаёт мир ОДИН В ОДИН.
//
//  Почему так, а не переписывать buildCity() руками: там 409 функций,
//  ручной перевод занял бы недели и внёс бы сотни расхождений.
//  Здесь источник истины — сам работающий код.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(__dirname, '..', 'Assets', 'StreamingAssets');
fs.mkdirSync(OUT, { recursive: true });

let html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');

// заглушка socket.io — сеть при захвате не нужна
html = html.replace(/<script[^>]*socket\.io[^>]*><\/script>/g,
  '<script>window.io=function(){return{on(){},emit(){},id:"cap",connected:false};};</script>');

// инлайним локальные скрипты
html = html.replace(/<script src="([^"]+?)(\?[^"]*)?"><\/script>/g, (m, src) => {
  const f = path.join(ROOT, 'public', src);
  if (!fs.existsSync(f)) return '<!-- нет ' + src + ' -->';
  return '<script>' + fs.readFileSync(f, 'utf8').replace(/<\/script>/g, '<\\/script>') + '</script>';
});

const STUB = `<script>
HTMLCanvasElement.prototype.getContext=function(){return{fillRect(){},clearRect(){},fillText(){},strokeText(){},beginPath(){},roundRect(){},moveTo(){},lineTo(){},stroke(){},fill(){},arc(){},ellipse(){},closePath(){},rect(){},save(){},restore(){},translate(){},rotate(){},scale(){},drawImage(){},clip(){},quadraticCurveTo(){},bezierCurveTo(){},setTransform(){},createLinearGradient(){return{addColorStop(){}}},createRadialGradient(){return{addColorStop(){}}},createPattern(){return null},measureText(){return{width:10}},getImageData(){return{data:new Uint8ClampedArray(4)}},putImageData(){},setLineDash(){},strokeRect(){},toDataURL(){return''}}};
HTMLCanvasElement.prototype.toDataURL=function(){return''};
window.AudioContext=window.webkitAudioContext=function(){return{createGain(){return{connect(){},gain:{value:1,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}}}},createOscillator(){return{connect(){},start(){},stop(){},frequency:{value:1,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},type:''}},createBufferSource(){return{connect(){},start(){},stop(){},buffer:null}},createBuffer(){return{getChannelData(){return new Float32Array(100)}}},createBiquadFilter(){return{connect(){},frequency:{value:1,setValueAtTime(){}},Q:{value:1},type:''}},destination:{},currentTime:0,sampleRate:44100,resume(){},state:'running'}};
window.requestAnimationFrame=function(){return 0};window.cancelAnimationFrame=function(){};
window.alert=function(){};window.scrollTo=function(){};
</script>`;
html = html.replace('</head>', STUB + '</head>');

const vc = new VirtualConsole();
vc.on('jsdomError', e => { if (!/getParameter|WebGL/.test(e.message)) console.log('  ! ' + e.message); });

const dom = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true,
  url: 'https://x.test/', virtualConsole: vc
});
const w = dom.window;

setTimeout(() => {
  const T = w.THREE;
  if (!T) { console.log('THREE не загрузился'); process.exit(1); }

  try { w.initThreeJS(); } catch (e) { console.log('initThreeJS:', e.message); }

  // строим город целиком
  const builders = ['buildCity', 'buildFantaziaCityV3', 'buildNewCityDistricts'];
  for (const b of builders) {
    if (typeof w[b] === 'function') {
      try { w[b](); console.log('  собрано:', b); }
      catch (e) { console.log('  ' + b + ' →', e.message); }
    }
  }

  w.scene.updateMatrixWorld(true);

  // ── ОБХОД СЦЕНЫ: записываем каждый видимый меш ──
  const objs = [];
  const V = new T.Vector3(), Q = new T.Quaternion(), S = new T.Vector3();
  let skipped = 0;

  w.scene.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    let vis = o.visible, p = o.parent;
    while (vis && p) { if (p.visible === false) vis = false; p = p.parent; }
    if (!vis) { skipped++; return; }

    o.matrixWorld.decompose(V, Q, S);
    const g = o.geometry;
    const par = g.parameters || {};
    let kind = 'box', dim = {};

    switch (g.type) {
      case 'BoxGeometry':
        kind = 'box';
        dim = { x: (par.width||1)*S.x, y: (par.height||1)*S.y, z: (par.depth||1)*S.z };
        break;
      case 'SphereGeometry':
        kind = 'sphere';
        dim = { x: (par.radius||1)*2*S.x, y: (par.radius||1)*2*S.y, z: (par.radius||1)*2*S.z };
        break;
      case 'CylinderGeometry':
        kind = 'cylinder';
        dim = { x: (par.radiusTop||par.radiusBottom||1)*2*S.x,
                y: (par.height||1)*S.y,
                z: (par.radiusBottom||par.radiusTop||1)*2*S.z };
        break;
      case 'ConeGeometry':
        kind = 'cone';
        dim = { x: (par.radius||1)*2*S.x, y: (par.height||1)*S.y, z: (par.radius||1)*2*S.z };
        break;
      case 'PlaneGeometry':
        kind = 'plane';
        dim = { x: (par.width||1)*S.x, y: 0.02, z: (par.height||1)*S.z };
        break;
      case 'TorusGeometry':
        kind = 'torus';
        dim = { x: (par.radius||1)*2*S.x, y: (par.tube||0.1)*2*S.y, z: (par.radius||1)*2*S.z };
        break;
      default:
        kind = 'box';
        dim = { x: S.x, y: S.y, z: S.z };
    }

    // слишком мелкое или гигантское — пропускаем (мусор/подложки)
    const vol = Math.abs(dim.x * dim.y * dim.z);
    if (vol < 0.002) { skipped++; return; }

    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    let color = 0xcccccc, emissive = 0, opacity = 1, glow = 0;
    if (m) {
      if (m.color) color = m.color.getHex();
      if (m.emissive) { emissive = m.emissive.getHex(); glow = m.emissiveIntensity || 0; }
      if (m.transparent && m.opacity !== undefined) opacity = m.opacity;
    }

    const e = new T.Euler().setFromQuaternion(Q, 'YXZ');
    objs.push({
      k: kind,
      x: +V.x.toFixed(2), y: +V.y.toFixed(2), z: +V.z.toFixed(2),
      sx: +Math.abs(dim.x).toFixed(2), sy: +Math.abs(dim.y).toFixed(2), sz: +Math.abs(dim.z).toFixed(2),
      rx: +(e.x * 180 / Math.PI).toFixed(1),
      ry: +(e.y * 180 / Math.PI).toFixed(1),
      rz: +(e.z * 180 / Math.PI).toFixed(1),
      c: color, e: emissive, g: +glow.toFixed(2), o: +opacity.toFixed(2)
    });
  });

  // ── КОЛЛАЙДЕРЫ ЗДАНИЙ (для физики в Unity) ──
  // buildings/interactables объявлены через let — на window их НЕТ,
  // достаём через eval внутри страницы
  let colliders = [];
  try {
    const raw = w.eval('JSON.stringify((typeof buildings!=="undefined"?buildings:[]).map(b=>({x:b.x,z:b.z,w:b.w,h:b.h,d:b.d,name:b.name||"",type:b.type||""})))');
    colliders = JSON.parse(raw).map(b => ({
      x: +(+b.x).toFixed(2), z: +(+b.z).toFixed(2),
      w: +(+b.w).toFixed(2), h: +(+b.h).toFixed(2), d: +(+b.d).toFixed(2),
      name: b.name || '', type: b.type || ''
    }));
  } catch (e) { console.log('  buildings:', e.message); }

  // ── ТОЧКИ ВЗАИМОДЕЙСТВИЯ ──
  let inter = [];
  try {
    const raw2 = w.eval('JSON.stringify((typeof interactables!=="undefined"?interactables:[]).filter(i=>!i.interior&&i.position).map(i=>({x:i.position.x,y:i.position.y,z:i.position.z,type:i.type||"",name:i.name||"",range:i.range||3})))');
    inter = JSON.parse(raw2).map(i => ({
      x: +(+i.x).toFixed(2), y: +(+i.y).toFixed(2), z: +(+i.z).toFixed(2),
      type: i.type, name: i.name, range: i.range
    }));
  } catch (e) { console.log('  interactables:', e.message); }

  console.log('\nЗАХВАЧЕНО:');
  console.log('  мешей города :', objs.length, '(пропущено мелких:', skipped + ')');
  console.log('  зданий       :', colliders.length);
  console.log('  интерактивных:', inter.length);

  // разбиваем на части: один файл на 8000 объектов, иначе JsonUtility давится
  const CHUNK = 8000;
  const parts = Math.ceil(objs.length / CHUNK);
  for (let i = 0; i < parts; i++) {
    fs.writeFileSync(path.join(OUT, `city_part${i}.json`),
      JSON.stringify(objs.slice(i * CHUNK, (i + 1) * CHUNK)));
  }
  fs.writeFileSync(path.join(OUT, 'city_index.json'),
    JSON.stringify({ parts: parts, total: objs.length }, null, 2));
  fs.writeFileSync(path.join(OUT, 'city_colliders.json'), JSON.stringify(colliders, null, 1));
  fs.writeFileSync(path.join(OUT, 'city_interactables.json'), JSON.stringify(inter, null, 1));

  console.log('  файлов города:', parts);
  console.log('\nГотово →', path.relative(ROOT, OUT));
  process.exit(0);
}, 6000);
