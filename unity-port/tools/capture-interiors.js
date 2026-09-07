// ═══════════════════════════════════════════════════════════════════════════
//  ЗАХВАТ ИНТЕРЬЕРОВ: все 8 этажей ТЦ + прочие здания
//  Тот же приём — запускаем настоящий buildInterior() и пишем геометрию.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(__dirname, '..', 'Assets', 'StreamingAssets');
fs.mkdirSync(OUT, { recursive: true });

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
vc.on('jsdomError', e => {});
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true,
                              url: 'https://x.test/', virtualConsole: vc });
const w = dom.window;

setTimeout(() => {
  const T = w.THREE;
  try { w.initThreeJS(); } catch (e) {}
  w.eval("localPlayer = { x:0,y:0,z:0,name:'C',id:'c',health:100,money:0, mesh:new THREE.Object3D() }; scene.add(localPlayer.mesh);");

  const V = new T.Vector3(), Q = new T.Quaternion(), S = new T.Vector3();

  function grab() {
    const out = [];
    const objs = w.eval('interiorObjects');
    w.scene.updateMatrixWorld(true);
    for (let i = 0; i < objs.length; i++) {
      const root = objs[i];
      if (!root || !root.traverse) continue;
      root.traverse(o => {
        if (!o.isMesh || !o.geometry) return;
        let vis = o.visible, p = o.parent;
        while (vis && p) { if (p.visible === false) vis = false; p = p.parent; }
        if (!vis) return;
        o.matrixWorld.decompose(V, Q, S);
        const g = o.geometry, par = g.parameters || {};
        let kind = 'box', dim = {};
        switch (g.type) {
          case 'BoxGeometry': kind='box';
            dim={x:(par.width||1)*S.x,y:(par.height||1)*S.y,z:(par.depth||1)*S.z}; break;
          case 'SphereGeometry': kind='sphere';
            dim={x:(par.radius||1)*2*S.x,y:(par.radius||1)*2*S.y,z:(par.radius||1)*2*S.z}; break;
          case 'CylinderGeometry': kind='cylinder';
            dim={x:(par.radiusTop||par.radiusBottom||1)*2*S.x,y:(par.height||1)*S.y,
                 z:(par.radiusBottom||par.radiusTop||1)*2*S.z}; break;
          case 'ConeGeometry': kind='cone';
            dim={x:(par.radius||1)*2*S.x,y:(par.height||1)*S.y,z:(par.radius||1)*2*S.z}; break;
          case 'PlaneGeometry': kind='plane';
            // вертикальна в three.js: высота по Y, а не по Z
            dim={x:(par.width||1)*S.x,y:(par.height||1)*S.y,z:0.04}; break;
          case 'TorusGeometry': kind='torus';
            dim={x:(par.radius||1)*2*S.x,y:(par.tube||0.1)*2*S.y,z:(par.radius||1)*2*S.z}; break;
          default: kind='box'; dim={x:S.x,y:S.y,z:S.z};
        }
        if (Math.abs(dim.x*dim.y*dim.z) < 1e-7) return;   // берём даже мелкие детали
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        let c=0xcccccc, em=0, op=1, gl=0;
        if (m) {
          if (m.color) c = m.color.getHex();
          if (m.emissive) { em = m.emissive.getHex(); gl = m.emissiveIntensity||0; }
          if (m.transparent && m.opacity !== undefined) op = m.opacity;
        }
        const e = new T.Euler().setFromQuaternion(Q,'YXZ');
        // координаты ОТНОСИТЕЛЬНО кармана интерьера (2000,2000)
        out.push({ k:kind,
          x:+(V.x-2000).toFixed(2), y:+V.y.toFixed(2), z:+(V.z-2000).toFixed(2),
          sx:+Math.abs(dim.x).toFixed(2), sy:+Math.abs(dim.y).toFixed(2), sz:+Math.abs(dim.z).toFixed(2),
          rx:+(e.x*180/Math.PI).toFixed(1), ry:+(e.y*180/Math.PI).toFixed(1), rz:+(e.z*180/Math.PI).toFixed(1),
          c:c, e:em, g:+gl.toFixed(2), o:+op.toFixed(2) });
      });
    }
    return out;
  }

  function grabColliders() {
    try {
      const raw = w.eval('JSON.stringify(interiorColliders.map(c=>({a:c.minX-2000,b:c.maxX-2000,cc:c.minZ-2000,d:c.maxZ-2000})))');
      return JSON.parse(raw).map(c => ({
        minX:+c.a.toFixed(2), maxX:+c.b.toFixed(2),
        minZ:+c.cc.toFixed(2), maxZ:+c.d.toFixed(2) }));
    } catch (e) { return []; }
  }

  function grabInter() {
    try {
      const raw = w.eval('JSON.stringify(interactables.filter(i=>i.interior&&i.position).map(i=>({x:i.position.x-2000,y:i.position.y,z:i.position.z-2000,type:i.type||"",name:i.name||"",range:i.range||3})))');
      return JSON.parse(raw).map(i => ({
        x:+(+i.x).toFixed(2), y:+(+i.y).toFixed(2), z:+(+i.z).toFixed(2),
        type:i.type, name:i.name, range:i.range }));
    } catch (e) { return []; }
  }

  console.log('\nЗАХВАТ ИНТЕРЬЕРОВ ТЦ:');
  const names = ['B5','B4','B3','B2','B1','1','2','3'];
  const floors = [];
  let totalMesh = 0;

  for (let fl = 0; fl < 8; fl++) {
    try {
      w.eval('currentFloor=' + fl + '; currentBuildingType="mall"; isInsideBuilding=true;');
      w.eval('fzDisposeInterior && fzDisposeInterior(); interiorObjects.length=0; interiorColliders.length=0; interactables.length=0;');
      w.eval('buildInterior("mall")');
      const meshes = grab();
      const cols = grabColliders();
      const ints = grabInter();
      totalMesh += meshes.length;
      fs.writeFileSync(path.join(OUT, `mall_floor${fl}.json`), JSON.stringify(meshes));
      floors.push({ index: fl, label: names[fl], meshes: meshes.length,
                    colliders: cols, interactables: ints });
      console.log(`  ${names[fl].padEnd(2)} → мешей ${String(meshes.length).padStart(4)}, коллайдеров ${cols.length}, точек ${ints.length}`);
    } catch (e) {
      console.log('  этаж ' + names[fl] + ' ошибка:', e.message);
      floors.push({ index: fl, label: names[fl], meshes: 0, colliders: [], interactables: [] });
    }
  }

  fs.writeFileSync(path.join(OUT, 'mall_index.json'), JSON.stringify({ floors: floors }, null, 1));

  // прочие интерьеры
  console.log('\nДРУГИЕ ЗДАНИЯ:');
  const types = ['house','office','shop','club','bank','hospital','police'];
  const others = [];
  for (const t of types) {
    try {
      w.eval('currentFloor=0; currentBuildingType="' + t + '"; isInsideBuilding=true;');
      w.eval('fzDisposeInterior && fzDisposeInterior(); interiorObjects.length=0; interiorColliders.length=0; interactables.length=0;');
      w.eval('buildInterior("' + t + '")');
      const meshes = grab();
      if (!meshes.length) continue;
      fs.writeFileSync(path.join(OUT, `interior_${t}.json`), JSON.stringify(meshes));
      others.push({ type: t, meshes: meshes.length, colliders: grabColliders(), interactables: grabInter() });
      console.log(`  ${t.padEnd(9)} → мешей ${meshes.length}`);
    } catch (e) {}
  }
  fs.writeFileSync(path.join(OUT, 'interiors_index.json'), JSON.stringify({ list: others }, null, 1));

  console.log('\nИТОГО мешей в интерьерах ТЦ:', totalMesh);
  process.exit(0);
}, 6000);
