/*!
 * ============================================================
 * FANTAZIA RP 3D — НОВАЯ МОДЕЛЬ ИГРОКА v2.2 "DELUXE"
 * ------------------------------------------------------------
 * Стильный процедурный 3D-персонаж для Three.js.
 * Красивое чистое лицо: большие глаза с ресничками • взгляд за камерой •
 * 9 причёсок с глянцевыми прядями • аксессуары • 8 анимаций •
 * золотая цепь • пальцы • дыхание
 *
 * Подключение (ПОСЛЕ Three.js):
 *   <script src="assets/fantazia-player.js"></script>
 *
 * Использование:
 *   var model = new FantaziaPlayerModel({ castShadow: true });
 *   model.setAppearance({ skinColor:'#FFD1A4', shirtColor:'#3498DB',
 *     pantsColor:'#2C3E50', hairColor:'#4A2F1B', hairStyle:0 });
 *   model.setNameTag('Ник');
 *   scene.add(model.group);
 *   // в игровом цикле:
 *   model.update(dt, camera.position);  // 2-й аргумент — следит взглядом (необязательно)
 *   model.setMoving(isMoving, isRunning);
 *
 * Модель смотрит вдоль +Z при group.rotation.y = 0.
 * Поворот к направлению движения:
 *   model.group.rotation.y = Math.atan2(dirX, dirZ);
 * ============================================================
 */
(function (global) {
'use strict';
var THREE = global.THREE;
if (!THREE) {
console.error('[FantaziaPlayerModel] THREE не найден! Подключи Three.js ПЕРЕД fantazia-player.js');
return;
}
/* ============================================================
   FANTAZIA RP 3D — НОВАЯ МОДЕЛЬ ИГРОКА v2.1 "DELUXE"
   Стильный процедурный 3D-персонаж для Three.js
   ------------------------------------------------------------
   • Реалистичные пропорции (рост 1.8), скульптурное лицо
   • Живые глаза: веки, ресницы, зрачки следят за камерой
   • Моргание, румянец, пухлые губы, дыхание
   • 9 причёсок с глянцевыми прядями + аксессуары
   • Одежда: куртка с лацканами, карманами и золотой цепью
   • 8 анимаций: idle / walk / run / jump / wave / dance / sit / crouch
   • API совместим с сервером Fantazia RP:
     { skinColor, shirtColor, pantsColor, hairColor, hairStyle }
   ============================================================ */


var VERSION = '2.2.0';

var CHANNELS = [
  'hipsPosY', 'hipsRotX', 'hipsRotY', 'hipsRotZ',
  'torsoRotX', 'torsoRotY', 'torsoRotZ',
  'headRotX', 'headRotY', 'headRotZ',
  'armLRotX', 'armLRotZ', 'armRRotX', 'armRRotZ',
  'elbowLRotX', 'elbowRRotX',
  'legLRotX', 'legRRotX', 'kneeLRotX', 'kneeRRotX'
];

function _zeroPose() {
  var p = {};
  for (var i = 0; i < CHANNELS.length; i++) p[CHANNELS[i]] = 0;
  return p;
}

/* затемнение/осветление HEX-цвета */
function _shade(hex, dl) {
  try {
    var c = new THREE.Color(hex);
    var hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    c.setHSL(hsl.h, Math.min(1, hsl.s * (dl < 0 ? 1.15 : 0.9)), Math.max(0, Math.min(1, hsl.l + dl)));
    return c;
  } catch (e) {
    return new THREE.Color('#333333');
  }
}

function FantaziaPlayerModel(options) {
  options = options || {};
  this.version = VERSION;

  this.appearance = Object.assign({
    skinColor: '#FFD1A4',
    shirtColor: '#3498DB',
    pantsColor: '#2C3E50',
    hairColor: '#4A2F1B',
    hairStyle: 0,
    accessory: 0,
    eyeColor: '#3d6bd6',
    accentColor: '#6c5ce7'
  }, options.appearance || {});

  this.state = 'idle';
  this._time = 0;
  this._pose = _zeroPose();
  this._blinkTimer = 1.5;
  this._blinkState = 0;
  this._lookYaw = 0;
  this._lookPitch = 0;
  this._breath = 0;

  this._geometries = [];
  this._materials = [];

  this.group = new THREE.Group();
  this.group.name = 'FantaziaPlayer';

  this._buildMaterials();
  this._buildBody();
  this._buildHair();
  this._buildAccessories();

  this.setAppearance(this.appearance);
  this.setHairStyle(this.appearance.hairStyle || 0);
  this.setAccessory(this.appearance.accessory || 0);

  if (options.castShadow) {
    this.group.traverse(function (m) {
      if (m.isMesh) { m.castShadow = true; }
    });
  }
}

/* статические описатели — для UI */
FantaziaPlayerModel.HAIR_STYLES = ['Классика', 'Ёжик', 'Кок', 'Боб', 'Хвост', 'Ирокез', 'Бритая', 'Кудри', 'Длинные'];
FantaziaPlayerModel.ACCESSORIES = ['Нет', 'Очки', 'Кепка', 'Наушники'];
FantaziaPlayerModel.ANIM_STATES = ['idle', 'walk', 'run', 'jump', 'wave', 'dance', 'sit', 'crouch'];
FantaziaPlayerModel.STATE_LABELS = {
  idle: 'Стою', walk: 'Иду', run: 'Бегу', jump: 'Прыжок',
  wave: 'Привет!', dance: 'Танцую', sit: 'Сижу (авто)', crouch: 'Присел'
};

/* ---------- служебное ---------- */

FantaziaPlayerModel.prototype._mat = function (params) {
  var m = new THREE.MeshPhysicalMaterial(params);
  this._materials.push(m);
  return m;
};

FantaziaPlayerModel.prototype._geo = function (g) {
  this._geometries.push(g);
  return g;
};

FantaziaPlayerModel.prototype._sphere = function (r, mat, sx, sy, sz) {
  var mesh = new THREE.Mesh(this._geo(new THREE.SphereGeometry(r, 24, 18)), mat);
  mesh.scale.set(sx || 1, sy || 1, sz || 1);
  return mesh;
};

FantaziaPlayerModel.prototype._capsule = function (r, jointDist, mat) {
  var cylLen = Math.max(0.02, jointDist - r * 1.15);
  var mesh = new THREE.Mesh(this._geo(new THREE.CapsuleGeometry(r, cylLen, 6, 14)), mat);
  mesh.position.y = -jointDist / 2;
  return mesh;
};

/* глянцевая прядь волос */
FantaziaPlayerModel.prototype._strand = function (g, len, x, y, z, rx, ry, rz) {
  var s = new THREE.Mesh(this._geo(new THREE.CapsuleGeometry(0.0062, len, 4, 8)), this.hairHiMat);
  s.position.set(x, y, z);
  s.rotation.set(rx || 0, ry || 0, rz || 0);
  g.add(s);
  return s;
};

/* ---------- материалы ---------- */

FantaziaPlayerModel.prototype._buildMaterials = function () {
  this.skinMat = this._mat({ color: this.appearance.skinColor, roughness: 0.55, sheen: 0.3, sheenColor: new THREE.Color('#ffd9c2'), clearcoat: 0.06 });
  this.skinDarkMat = this._mat({ color: '#d8a377', roughness: 0.6 });
  this.shirtMat = this._mat({ color: this.appearance.shirtColor, roughness: 0.82 });
  this.shirtCollarMat = this._mat({ color: '#2a7bb0', roughness: 0.8 });
  this.jacketMat = this._mat({ color: '#22304a', roughness: 0.62, sheen: 0.55, sheenColor: new THREE.Color('#8fa3d9') });
  this.jacketDarkMat = this._mat({ color: '#1a2540', roughness: 0.6, sheen: 0.5, sheenColor: new THREE.Color('#8fa3d9') });
  this.pantsMat = this._mat({ color: this.appearance.pantsColor, roughness: 0.8 });
  this.hairMat = this._mat({ color: this.appearance.hairColor, roughness: 0.42, clearcoat: 0.65, clearcoatRoughness: 0.3, sheen: 0.35, sheenColor: new THREE.Color('#ffffff') });
  this.hairHiMat = this._mat({ color: '#8a6a4a', roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  this.lashMat = this._mat({ color: '#241812', roughness: 0.4 });
  this.shoeMat = this._mat({ color: '#1c1c26', roughness: 0.38, clearcoat: 0.35, clearcoatRoughness: 0.25 });
  this.soleMat = this._mat({ color: '#e8e8ec', roughness: 0.45 });
  this.beltMat = this._mat({ color: '#191922', roughness: 0.55 });
  this.goldMat = this._mat({ color: '#d9a441', roughness: 0.22, metalness: 0.88 });
  this.eyeWhiteMat = this._mat({ color: '#ffffff', roughness: 0.1 });
  this.irisMat = this._mat({ color: this.appearance.eyeColor, roughness: 0.15, clearcoat: 0.5, clearcoatRoughness: 0.1 });
  this.pupilMat = this._mat({ color: '#0d0d14', roughness: 0.1 });
  this.highlightMat = this._mat({ color: '#ffffff', roughness: 0.02, emissive: '#ffffff', emissiveIntensity: 0.55 });
  this.mouthMat = this._mat({ color: '#332838', roughness: 0.5 });
  this.darkMat = this._mat({ color: '#15151d', roughness: 0.35, metalness: 0.2 });
  this.accentMat = this._mat({ color: this.appearance.accentColor, roughness: 0.3, emissive: this.appearance.accentColor, emissiveIntensity: 1.4 });
};

/* ---------- тело ---------- */

FantaziaPlayerModel.prototype._buildBody = function () {
  var self = this;

  /* бёдра (корень тела) */
  this.hips = new THREE.Group();
  this.hips.position.y = 0.96;
  this.group.add(this.hips);

  /* таз */
  var pelvis = this._sphere(0.16, this.pantsMat, 1.0, 0.78, 0.8);
  pelvis.position.set(0, -0.02, 0);
  this.hips.add(pelvis);

  /* ремень + пряжка */
  var belt = new THREE.Mesh(this._geo(new THREE.CylinderGeometry(0.157, 0.157, 0.05, 24)), this.beltMat);
  belt.scale.z = 0.82;
  belt.position.y = 0.1;
  this.hips.add(belt);
  var buckle = new THREE.Mesh(this._geo(new THREE.BoxGeometry(0.052, 0.038, 0.015)), this.goldMat);
  buckle.position.set(0, 0.1, 0.132);
  this.hips.add(buckle);

  /* ---- торс ---- */
  this.torso = new THREE.Group();
  this.hips.add(this.torso);

  var torsoPts = [
    new THREE.Vector2(0.132, -0.1),
    new THREE.Vector2(0.15, 0.0),
    new THREE.Vector2(0.138, 0.1),
    new THREE.Vector2(0.156, 0.2),
    new THREE.Vector2(0.176, 0.28),
    new THREE.Vector2(0.181, 0.34),
    new THREE.Vector2(0.163, 0.42),
    new THREE.Vector2(0.112, 0.48),
    new THREE.Vector2(0.072, 0.52)
  ];
  var chest = new THREE.Mesh(this._geo(new THREE.LatheGeometry(torsoPts, 26)), this.shirtMat);
  chest.scale.z = 0.74;
  this.torso.add(chest);
  this._chestMesh = chest;

  /* открытая куртка: задняя полуоболочка */
  var jacketPts = [
    new THREE.Vector2(0.14, -0.12),
    new THREE.Vector2(0.158, 0.02),
    new THREE.Vector2(0.146, 0.12),
    new THREE.Vector2(0.166, 0.22),
    new THREE.Vector2(0.186, 0.3),
    new THREE.Vector2(0.19, 0.35),
    new THREE.Vector2(0.172, 0.43),
    new THREE.Vector2(0.12, 0.48)
  ];
  var jacket = new THREE.Mesh(this._geo(new THREE.LatheGeometry(jacketPts, 24, Math.PI * 0.33, Math.PI * 1.34)), this.jacketMat);
  jacket.scale.z = 0.78;
  this.torso.add(jacket);

  /* передние полы куртки (открыты спереди, видна футболка) */
  var panelPts = jacketPts.map(function (p) { return new THREE.Vector2(p.x * 1.016, p.y); });
  var panelL = new THREE.Mesh(this._geo(new THREE.LatheGeometry(panelPts, 10, 0.5, 0.62)), this.jacketMat);
  panelL.scale.z = 0.79;
  this.torso.add(panelL);
  var panelR = new THREE.Mesh(this._geo(new THREE.LatheGeometry(panelPts, 10, -1.12, 0.62)), this.jacketMat);
  panelR.scale.z = 0.79;
  this.torso.add(panelR);

  /* лацканы */
  var lapelGeo = this._geo(new THREE.BoxGeometry(0.078, 0.17, 0.014));
  var lapelL = new THREE.Mesh(lapelGeo, this.jacketDarkMat);
  lapelL.position.set(0.105, 0.37, 0.128);
  lapelL.rotation.set(0, 0.47, -0.12);
  this.torso.add(lapelL);
  var lapelR = new THREE.Mesh(lapelGeo, this.jacketDarkMat);
  lapelR.position.set(-0.105, 0.37, 0.128);
  lapelR.rotation.set(0, -0.47, 0.12);
  this.torso.add(lapelR);

  /* нагрудный карман + боковые карманы */
  var pocket = new THREE.Mesh(this._geo(new THREE.BoxGeometry(0.055, 0.05, 0.012)), this.jacketDarkMat);
  pocket.position.set(0.128, 0.26, 0.108);
  pocket.rotation.y = 0.47;
  this.torso.add(pocket);
  var pocketGeo = this._geo(new THREE.BoxGeometry(0.055, 0.075, 0.014));
  var pokL = new THREE.Mesh(pocketGeo, this.jacketDarkMat);
  pokL.position.set(0.142, 0.03, 0.05);
  pokL.rotation.y = -0.18;
  this.torso.add(pokL);
  var pokR = new THREE.Mesh(pocketGeo, this.jacketDarkMat);
  pokR.position.set(-0.142, 0.03, 0.05);
  pokR.rotation.y = 0.18;
  this.torso.add(pokR);

  /* золотые пуговицы */
  var jb1 = this._sphere(0.012, this.goldMat);
  jb1.position.set(-0.11, 0.32, 0.126);
  this.torso.add(jb1);
  var jb2 = this._sphere(0.012, this.goldMat);
  jb2.position.set(-0.113, 0.21, 0.105);
  this.torso.add(jb2);

  /* воротник куртки */
  var collar = new THREE.Mesh(this._geo(new THREE.LatheGeometry([
    new THREE.Vector2(0.075, 0.0),
    new THREE.Vector2(0.1, 0.06)
  ], 18, Math.PI * 0.5, Math.PI)), this.jacketMat);
  collar.position.y = 0.5;
  this.torso.add(collar);

  /* воротник футболки */
  var tcollar = new THREE.Mesh(this._geo(new THREE.TorusGeometry(0.077, 0.013, 10, 26)), this.shirtCollarMat);
  tcollar.position.y = 0.525;
  tcollar.rotation.x = Math.PI / 2;
  tcollar.scale.z = 0.85;
  this.torso.add(tcollar);

  /* золотая цепь с кулоном */
  var chain = new THREE.Mesh(this._geo(new THREE.TorusGeometry(0.079, 0.0065, 8, 34)), this.goldMat);
  chain.position.set(0, 0.495, 0.04);
  chain.rotation.x = 0.62;
  this.torso.add(chain);
  var pendant = new THREE.Mesh(this._geo(new THREE.OctahedronGeometry(0.02, 0)), this.goldMat);
  pendant.position.set(0, 0.432, 0.108);
  pendant.rotation.y = 0.5;
  this.torso.add(pendant);

  /* молния футболки (вдоль фигуры) */
  var vneck = new THREE.Mesh(this._geo(new THREE.CylinderGeometry(0.006, 0.006, 0.1, 8)), this.darkMat);
  vneck.position.set(0, 0.45, 0.1);
  vneck.rotation.x = -0.48;
  this.torso.add(vneck);

  /* шея */
  var neck = new THREE.Mesh(this._geo(new THREE.CylinderGeometry(0.055, 0.062, 0.1, 16)), this.skinMat);
  neck.position.y = 0.54;
  this.torso.add(neck);

  /* ---- голова ---- */
  this.head = new THREE.Group();
  this.head.position.y = 0.58;
  this.torso.add(this.head);

  /* череп — чистая яйцевидная форма */
  var skull = this._sphere(0.148, this.skinMat, 0.97, 1.04, 0.93);
  skull.position.set(0, 0.125, 0);
  this.head.add(skull);

  /* уши */
  var earGeo = this._geo(new THREE.SphereGeometry(0.03, 18, 14));
  var earL = new THREE.Mesh(earGeo, this.skinMat);
  earL.scale.set(0.5, 1.0, 0.72);
  earL.position.set(0.142, 0.115, 0.005);
  this.head.add(earL);
  var earR = new THREE.Mesh(earGeo, this.skinMat);
  earR.scale.set(0.5, 1.0, 0.72);
  earR.position.set(-0.142, 0.115, 0.005);
  this.head.add(earR);

  /* носик — миниатюрный */
  var nose = this._sphere(0.017, this.skinMat, 0.85, 0.8, 0.7);
  nose.position.set(0, 0.072, 0.126);
  this.head.add(nose);

  /* добрая открытая улыбка */
  var smile = new THREE.Mesh(this._geo(new THREE.TorusGeometry(0.046, 0.008, 8, 20, Math.PI * 0.75)), this.mouthMat);
  smile.position.set(0, 0.048, 0.114);
  smile.rotation.z = Math.PI + (Math.PI - Math.PI * 0.75) / 2;
  smile.scale.y = 0.5;
  this.head.add(smile);

  /* глаза — большие, чистые, с линиями-ресницами */
  this._pupils = [];
  function buildEye(sign) {
    var eye = new THREE.Group();
    eye.position.set(0.062 * sign, 0.128, 0.112);
    var white = self._sphere(0.048, self.eyeWhiteMat, 1.08, 1.12, 0.45);
    eye.add(white);
    var iris = self._sphere(0.032, self.irisMat, 1.0, 1.12, 0.4);
    iris.position.z = 0.008;
    eye.add(iris);
    var pupil = self._sphere(0.016, self.pupilMat, 1.0, 1.12, 0.4);
    pupil.position.z = 0.017;
    eye.add(pupil);
    self._pupils.push(pupil);
    var hl1 = self._sphere(0.008, self.highlightMat);
    hl1.position.set(0.012 * sign, 0.013, 0.023);
    eye.add(hl1);
    var hl2 = self._sphere(0.0045, self.highlightMat);
    hl2.position.set(-0.01 * sign, -0.008, 0.025);
    eye.add(hl2);
    /* линия ресниц сверху (как нарисованная) */
    var lash = new THREE.Mesh(self._geo(new THREE.TorusGeometry(0.049, 0.0042, 6, 18, Math.PI * 0.8)), self.lashMat);
    lash.position.set(0, 0.004, 0.018);
    lash.rotation.z = (Math.PI - Math.PI * 0.8) / 2;
    lash.scale.set(1.1, 1.05, 1);
    eye.add(lash);
    /* нижняя линия глаза */
    var lowLine = new THREE.Mesh(self._geo(new THREE.TorusGeometry(0.045, 0.0025, 6, 16, Math.PI * 0.55)), self.lashMat);
    lowLine.position.set(0, -0.008, 0.012);
    lowLine.rotation.z = Math.PI + (Math.PI - Math.PI * 0.55) / 2;
    lowLine.scale.set(1.06, 1.0, 1);
    eye.add(lowLine);
    return eye;
  }
  this.eyeL = buildEye(1);
  this.eyeR = buildEye(-1);
  this.head.add(this.eyeL);
  this.head.add(this.eyeR);

  /* ---- руки ---- */
  function buildArm(sign) {
    var shoulder = new THREE.Group();
    shoulder.position.set(0.245 * sign, 0.43, 0);
    self.torso.add(shoulder);

    /* плечо-рукав */
    var pad = self._sphere(0.08, self.jacketMat, 1.05, 0.9, 1);
    pad.position.y = -0.01;
    shoulder.add(pad);

    var upper = self._capsule(0.062, 0.3, self.jacketMat);
    shoulder.add(upper);

    var elbow = new THREE.Group();
    elbow.position.y = -0.3;
    shoulder.add(elbow);

    var fore = self._capsule(0.05, 0.28, self.skinMat);
    elbow.add(fore);

    /* манжета */
    var cuff = new THREE.Mesh(self._geo(new THREE.CylinderGeometry(0.056, 0.056, 0.03, 14)), self.jacketMat);
    cuff.position.y = -0.27;
    elbow.add(cuff);

    /* часы на левой руке */
    if (sign > 0) {
      var strap = new THREE.Mesh(self._geo(new THREE.TorusGeometry(0.054, 0.011, 8, 18)), self.darkMat);
      strap.rotation.x = Math.PI / 2;
      strap.position.y = -0.26;
      elbow.add(strap);
      var face = new THREE.Mesh(self._geo(new THREE.BoxGeometry(0.034, 0.014, 0.034)), self.goldMat);
      face.position.set(0, -0.26, 0.03);
      elbow.add(face);
    }

    /* кисть: ладонь + пальцы + большой палец */
    var palm = self._sphere(0.046, self.skinMat, 1.0, 1.05, 0.8);
    palm.position.set(0, -0.33, 0);
    elbow.add(palm);
    var fingerGeo = self._geo(new THREE.CapsuleGeometry(0.0105, 0.032, 4, 8));
    for (var fi = 0; fi < 4; fi++) {
      var finger = new THREE.Mesh(fingerGeo, self.skinMat);
      finger.position.set((fi - 1.5) * 0.021, -0.376, 0.008);
      finger.rotation.x = -0.12;
      elbow.add(finger);
    }
    var thumb = new THREE.Mesh(self._geo(new THREE.CapsuleGeometry(0.0125, 0.026, 4, 8)), self.skinMat);
    thumb.position.set(-0.044 * sign, -0.345, 0.018);
    thumb.rotation.set(-0.25, 0, 0.75);
    elbow.add(thumb);

    return { shoulder: shoulder, elbow: elbow };
  }
  var armL = buildArm(1);
  var armR = buildArm(-1);
  this.armL = armL.shoulder; this.elbowL = armL.elbow;
  this.armR = armR.shoulder; this.elbowR = armR.elbow;

  /* ---- ноги ---- */
  function buildLeg(sign) {
    var hip = new THREE.Group();
    hip.position.set(0.105 * sign, -0.04, 0);
    self.hips.add(hip);

    var thigh = self._capsule(0.083, 0.44, self.pantsMat);
    hip.add(thigh);

    var knee = new THREE.Group();
    knee.position.y = -0.44;
    hip.add(knee);

    var shin = self._capsule(0.062, 0.4, self.pantsMat);
    knee.add(shin);

    /* кроссовок */
    var shoe = new THREE.Group();
    shoe.position.set(0, -0.4, 0.015);
    knee.add(shoe);

    /* подошва в 2 слоя */
    var outsole = new THREE.Mesh(self._geo(new THREE.BoxGeometry(0.118, 0.016, 0.285)), self.darkMat);
    outsole.position.set(0, -0.072, 0.03);
    shoe.add(outsole);
    var midsole = new THREE.Mesh(self._geo(new THREE.BoxGeometry(0.115, 0.02, 0.28)), self.soleMat);
    midsole.position.set(0, -0.054, 0.03);
    shoe.add(midsole);

    /* носок + пятка */
    var body = self._sphere(0.077, self.shoeMat, 0.78, 0.62, 1.65);
    body.position.set(0, -0.008, 0.045);
    shoe.add(body);
    var toeCap = self._sphere(0.045, self.soleMat, 1.15, 0.55, 0.85);
    toeCap.position.set(0, -0.032, 0.158);
    shoe.add(toeCap);
    var heel = self._sphere(0.052, self.shoeMat, 0.82, 0.95, 0.75);
    heel.position.set(0, -0.015, -0.085);
    shoe.add(heel);

    /* боковые полоски + язычок + шнурки */
    var stripeGeo = self._geo(new THREE.BoxGeometry(0.004, 0.02, 0.1));
    var stripeL = new THREE.Mesh(stripeGeo, self.soleMat);
    stripeL.position.set(0.061, -0.012, 0.05);
    stripeL.rotation.y = -0.18;
    shoe.add(stripeL);
    var stripeR = new THREE.Mesh(stripeGeo, self.soleMat);
    stripeR.position.set(-0.061, -0.012, 0.05);
    stripeR.rotation.y = 0.18;
    shoe.add(stripeR);
    /* язычок кроссовка */
    var tongue = new THREE.Mesh(self._geo(new THREE.BoxGeometry(0.054, 0.012, 0.1)), self.soleMat);
    tongue.position.set(0, 0.042, 0.09);
    tongue.rotation.x = 0.4;
    shoe.add(tongue);
    var laceGeo = self._geo(new THREE.BoxGeometry(0.068, 0.008, 0.012));
    var laceY = [0.036, 0.042, 0.048, 0.054];
    var laceZ = [0.112, 0.096, 0.08, 0.064];
    for (var li = 0; li < 4; li++) {
      var lace = new THREE.Mesh(laceGeo, self.soleMat);
      lace.position.set(0, laceY[li], laceZ[li]);
      lace.rotation.x = 0.45;
      shoe.add(lace);
    }

    return { hip: hip, knee: knee };
  }
  var legL = buildLeg(1);
  var legR = buildLeg(-1);
  this.legL = legL.hip; this.kneeL = legL.knee;
  this.legR = legR.hip; this.kneeR = legR.knee;
};

/* ---------- причёски ---------- */

FantaziaPlayerModel.prototype._buildHair = function () {
  var self = this;
  this._hairGroups = [];

  function mk() {
    var g = new THREE.Group();
    g.visible = false;
    self.head.add(g);
    self._hairGroups.push(g);
    return g;
  }

  /* 0 — Классика */
  (function () {
    var g = mk();
    var cap = new THREE.Mesh(self._geo(new THREE.SphereGeometry(0.156, 28, 18, 0, Math.PI * 2, 0, 1.52)), self.hairMat);
    cap.position.set(0, 0.128, -0.006);
    g.add(cap);
    var fringe = self._sphere(0.075, self.hairMat, 1.35, 0.42, 0.75);
    fringe.position.set(0, 0.196, 0.076);
    g.add(fringe);
    self._strand(g, 0.07, 0.03, 0.222, 0.026, 0.35, 0.4, -0.55);
    self._strand(g, 0.065, -0.038, 0.22, 0.0, -0.25, -0.5, 0.45);
  })();

  /* 1 — Ёжик */
  (function () {
    var g = mk();
    var base = new THREE.Mesh(self._geo(new THREE.SphereGeometry(0.155, 28, 18, 0, Math.PI * 2, 0, 1.36)), self.hairMat);
    base.position.set(0, 0.128, -0.006);
    g.add(base);
    var spikeGeo = self._geo(new THREE.ConeGeometry(0.015, 0.05, 7));
    for (var i = 0; i < 10; i++) {
      var phi = (i / 10) * Math.PI * 2;
      var theta = 0.35 + (i % 3) * 0.2;
      var dir = new THREE.Vector3(
        Math.sin(theta) * Math.cos(phi),
        Math.cos(theta),
        Math.sin(theta) * Math.sin(phi)
      );
      var spike = new THREE.Mesh(spikeGeo, self.hairMat);
      spike.position.copy(dir.clone().multiplyScalar(0.142)).add(new THREE.Vector3(0, 0.128, -0.006));
      spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      g.add(spike);
    }
  })();

  /* 2 — Кок (помпадур) */
  (function () {
    var g = mk();
    var cap = new THREE.Mesh(self._geo(new THREE.SphereGeometry(0.156, 28, 18, 0, Math.PI * 2, 0, 1.5)), self.hairMat);
    cap.position.set(0, 0.128, -0.006);
    g.add(cap);
    var quiff = self._sphere(0.08, self.hairMat, 0.8, 0.45, 1.1);
    quiff.position.set(0, 0.212, 0.054);
    g.add(quiff);
    self._strand(g, 0.08, 0, 0.244, 0.088, -0.55, 0, 0);
  })();

  /* 3 — Боб */
  (function () {
    var g = mk();
    var cap = new THREE.Mesh(self._geo(new THREE.SphereGeometry(0.158, 28, 18, 0, Math.PI * 2, 0, 1.92)), self.hairMat);
    cap.position.set(0, 0.126, -0.008);
    g.add(cap);
    var bangs = self._sphere(0.078, self.hairMat, 1.35, 0.34, 0.55);
    bangs.position.set(0, 0.19, 0.092);
    g.add(bangs);
    self._strand(g, 0.075, 0.035, 0.21, 0.08, 0.4, 0.2, -0.5);
  })();

  /* 4 — Хвост */
  (function () {
    var g = mk();
    var cap = new THREE.Mesh(self._geo(new THREE.SphereGeometry(0.156, 28, 18, 0, Math.PI * 2, 0, 1.5)), self.hairMat);
    cap.position.set(0, 0.128, -0.006);
    g.add(cap);
    var tie = new THREE.Mesh(self._geo(new THREE.TorusGeometry(0.028, 0.009, 8, 16)), self.darkMat);
    tie.position.set(0, 0.11, -0.142);
    tie.rotation.x = Math.PI / 2;
    g.add(tie);
    var t1 = self._sphere(0.042, self.hairMat);
    t1.position.set(0, 0.095, -0.148);
    g.add(t1);
    var t2 = self._sphere(0.035, self.hairMat);
    t2.position.set(0, 0.02, -0.155);
    g.add(t2);
    var t3 = self._sphere(0.027, self.hairMat);
    t3.position.set(0, -0.04, -0.145);
    g.add(t3);
    self._strand(g, 0.07, 0.028, 0.222, 0.026, 0.3, 0.4, -0.5);
  })();

  /* 5 — Ирокез */
  (function () {
    var g = mk();
    var base = new THREE.Mesh(self._geo(new THREE.SphereGeometry(0.154, 28, 18, 0, Math.PI * 2, 0, 1.2)), self.hairMat);
    base.position.set(0, 0.128, -0.006);
    g.add(base);
    var fin = new THREE.Mesh(self._geo(new THREE.CapsuleGeometry(0.028, 0.16, 6, 12)), self.hairMat);
    fin.rotation.x = Math.PI / 2;
    fin.position.set(0, 0.262, -0.012);
    g.add(fin);
    var finHi = new THREE.Mesh(self._geo(new THREE.CapsuleGeometry(0.014, 0.14, 4, 10)), self.hairHiMat);
    finHi.rotation.x = Math.PI / 2;
    finHi.position.set(0, 0.276, -0.012);
    g.add(finHi);
  })();

  /* 6 — Бритая */
  (function () {
    var g = mk();
    var cap = new THREE.Mesh(self._geo(new THREE.SphereGeometry(0.155, 28, 18, 0, Math.PI * 2, 0, 1.6)), self.hairMat);
    cap.position.set(0, 0.128, -0.006);
    g.add(cap);
  })();

  /* 7 — Кудри */
  (function () {
    var g = mk();
    var ringGeo = self._geo(new THREE.SphereGeometry(0.048, 18, 14));
    var n = 9;
    for (var i = 0; i < n; i++) {
      var phi = (i / n) * Math.PI * 2;
      var c = new THREE.Mesh(ringGeo, self.hairMat);
      c.position.set(Math.cos(phi) * 0.09, 0.19 + 0.038 * Math.sin(i * 2.1), Math.sin(phi) * 0.09 - 0.008);
      g.add(c);
    }
    var top = self._sphere(0.056, self.hairMat);
    top.position.set(0, 0.242, -0.005);
    g.add(top);
    var sideL = self._sphere(0.044, self.hairMat);
    sideL.position.set(0.104, 0.135, -0.008);
    g.add(sideL);
    var sideR = self._sphere(0.044, self.hairMat);
    sideR.position.set(-0.104, 0.135, -0.008);
    g.add(sideR);
    var hi = self._sphere(0.024, self.hairHiMat);
    hi.position.set(0.026, 0.258, 0.015);
    g.add(hi);
  })();

  /* 8 — Длинные */
  (function () {
    var g = mk();
    var cap = new THREE.Mesh(self._geo(new THREE.SphereGeometry(0.157, 28, 18, 0, Math.PI * 2, 0, 1.78)), self.hairMat);
    cap.position.set(0, 0.127, -0.008);
    g.add(cap);
    var back = self._sphere(0.098, self.hairMat, 1.1, 1.3, 0.5);
    back.position.set(0, 0.012, -0.106);
    g.add(back);
    var sL = new THREE.Mesh(self._geo(new THREE.CapsuleGeometry(0.026, 0.12, 6, 12)), self.hairMat);
    sL.position.set(0.124, 0.035, 0.01);
    g.add(sL);
    var sR = new THREE.Mesh(self._geo(new THREE.CapsuleGeometry(0.026, 0.12, 6, 12)), self.hairMat);
    sR.position.set(-0.124, 0.035, 0.01);
    g.add(sR);
    var bangs = self._sphere(0.072, self.hairMat, 1.35, 0.36, 0.55);
    bangs.position.set(0, 0.19, 0.095);
    g.add(bangs);
    self._strand(g, 0.1, 0.04, -0.012, -0.152, 0.08, 0, 0.06);
    self._strand(g, 0.1, -0.04, -0.012, -0.152, 0.08, 0, -0.06);
    self._strand(g, 0.075, 0.034, 0.202, 0.086, 0.35, 0.2, -0.5);
  })();
};

/* ---------- аксессуары ---------- */

FantaziaPlayerModel.prototype._buildAccessories = function () {
  var self = this;
  this._accGroups = [];

  function mk() {
    var g = new THREE.Group();
    g.visible = false;
    self.head.add(g);
    self._accGroups.push(g);
    return g;
  }

  /* 0 — нет */
  mk();

  /* 1 — очки */
  (function () {
    var g = mk();
    var lensGeo = self._geo(new THREE.TorusGeometry(0.049, 0.008, 8, 22));
    var l1 = new THREE.Mesh(lensGeo, self.darkMat);
    l1.position.set(0.062, 0.128, 0.14);
    g.add(l1);
    var l2 = new THREE.Mesh(lensGeo, self.darkMat);
    l2.position.set(-0.062, 0.128, 0.14);
    g.add(l2);
    var bridge = new THREE.Mesh(self._geo(new THREE.CylinderGeometry(0.007, 0.007, 0.035, 8)), self.goldMat);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.135, 0.142);
    g.add(bridge);
    var tempGeo = self._geo(new THREE.CylinderGeometry(0.005, 0.005, 0.12, 8));
    var t1 = new THREE.Mesh(tempGeo, self.darkMat);
    t1.rotation.x = Math.PI / 2;
    t1.position.set(0.108, 0.14, 0.075);
    g.add(t1);
    var t2 = new THREE.Mesh(tempGeo, self.darkMat);
    t2.rotation.x = Math.PI / 2;
    t2.position.set(-0.108, 0.14, 0.075);
    g.add(t2);
  })();

  /* 2 — кепка */
  (function () {
    var g = mk();
    var dome = new THREE.Mesh(self._geo(new THREE.SphereGeometry(0.162, 24, 14, 0, Math.PI * 2, 0, 1.15)), self.jacketMat);
    dome.position.set(0, 0.135, 0);
    g.add(dome);
    var brim = new THREE.Mesh(self._geo(new THREE.CylinderGeometry(0.132, 0.132, 0.017, 20, 1, false, -Math.PI / 2, Math.PI)), self.jacketDarkMat);
    brim.scale.z = 1.5;
    brim.position.set(0, 0.196, 0.02);
    g.add(brim);
    var btn = self._sphere(0.015, self.goldMat);
    btn.position.set(0, 0.296, 0);
    g.add(btn);
  })();

  /* 3 — наушники */
  (function () {
    var g = mk();
    var band = new THREE.Mesh(self._geo(new THREE.TorusGeometry(0.168, 0.016, 10, 26, Math.PI)), self.darkMat);
    band.position.set(0, 0.128, 0);
    g.add(band);
    var padGeo = self._geo(new THREE.CylinderGeometry(0.055, 0.055, 0.034, 18));
    var p1 = new THREE.Mesh(padGeo, self.accentMat);
    p1.rotation.z = Math.PI / 2;
    p1.position.set(0.158, 0.115, 0);
    g.add(p1);
    var p2 = new THREE.Mesh(padGeo, self.accentMat);
    p2.rotation.z = Math.PI / 2;
    p2.position.set(-0.158, 0.115, 0);
    g.add(p2);
    var dotGeo = self._geo(new THREE.SphereGeometry(0.012, 10, 8));
    var d1 = new THREE.Mesh(dotGeo, self.goldMat);
    d1.position.set(0.186, 0.115, 0);
    g.add(d1);
    var d2 = new THREE.Mesh(dotGeo, self.goldMat);
    d2.position.set(-0.186, 0.115, 0);
    g.add(d2);
  })();
};

/* ================= ПУБЛИЧНОЕ API ================= */

FantaziaPlayerModel.prototype.setAppearance = function (a) {
  a = a || {};
  this.appearance = Object.assign(this.appearance, a);
  var ap = this.appearance;

  this.skinMat.color.set(ap.skinColor);
  this.skinDarkMat.color.copy(_shade(ap.skinColor, -0.24));
  this.shirtMat.color.set(ap.shirtColor);
  this.shirtCollarMat.color.copy(_shade(ap.shirtColor, -0.14));
  this.pantsMat.color.set(ap.pantsColor);
  this.hairMat.color.set(ap.hairColor);
  this.hairHiMat.color.copy(_shade(ap.hairColor, 0.22));
  this.lashMat.color.copy(_shade(ap.hairColor, -0.3));

  var jacketC = _shade(ap.shirtColor, -0.16);
  this.jacketMat.color.copy(jacketC);
  this.jacketDarkMat.color.copy(_shade('#' + jacketC.getHexString(), -0.12));
  this.shoeMat.color.copy(_shade(ap.pantsColor, -0.14));

  if (ap.eyeColor) this.irisMat.color.set(ap.eyeColor);
  if (ap.accentColor) {
    this.accentMat.color.set(ap.accentColor);
    this.accentMat.emissive.set(ap.accentColor);
  }
  if (a.hairStyle !== undefined) this.setHairStyle(a.hairStyle);
  if (a.accessory !== undefined) this.setAccessory(a.accessory);
};

FantaziaPlayerModel.prototype.setHairStyle = function (i) {
  i = Math.max(0, Math.min(this._hairGroups.length - 1, i | 0));
  this.appearance.hairStyle = i;
  for (var g = 0; g < this._hairGroups.length; g++) {
    this._hairGroups[g].visible = (g === i);
  }
};

FantaziaPlayerModel.prototype.setAccessory = function (i) {
  i = Math.max(0, Math.min(this._accGroups.length - 1, i | 0));
  this.appearance.accessory = i;
  for (var g = 0; g < this._accGroups.length; g++) {
    this._accGroups[g].visible = (g === i);
  }
};

FantaziaPlayerModel.prototype.setState = function (s) {
  if (FantaziaPlayerModel.ANIM_STATES.indexOf(s) !== -1) this.state = s;
};

FantaziaPlayerModel.prototype.setMoving = function (moving, running) {
  if (!moving) this.setState('idle');
  else this.setState(running ? 'run' : 'walk');
};

FantaziaPlayerModel.prototype.getState = function () { return this.state; };

/* ник над головой */
FantaziaPlayerModel.prototype.setNameTag = function (text) {
  if (!text) {
    if (this._tag) this._tag.visible = false;
    return;
  }
  if (!this._tag) {
    var canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    this._tagCanvas = canvas;
    this._tagTexture = new THREE.CanvasTexture(canvas);
    this._tagTexture.anisotropy = 4;
    var sm = new THREE.SpriteMaterial({ map: this._tagTexture, transparent: true, depthTest: true });
    this._tag = new THREE.Sprite(sm);
    this._tag.scale.set(1.15, 0.29, 1);
    this._tag.position.y = 2.06;
    this.group.add(this._tag);
    this._materials.push(sm);
  }
  var ctx = this._tagCanvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 128);
  ctx.fillStyle = 'rgba(8,10,22,0.78)';
  ctx.strokeStyle = 'rgba(108,92,231,0.9)';
  ctx.lineWidth = 5;
  var r = 30, x = 6, y = 6, w = 500, h = 116;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.font = '700 54px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(String(text).substring(0, 14), 256, 68);
  this._tagTexture.needsUpdate = true;
  this._tag.visible = true;
};

/* ================= АНИМАЦИЯ ================= */

FantaziaPlayerModel.prototype._poseIdle = function (t) {
  var b = Math.sin(t * 1.6);
  var w = Math.sin(t * 0.5);
  return {
    hipsPosY: 0.004 * b, hipsRotX: 0.012, hipsRotY: 0, hipsRotZ: 0.018 * w,
    torsoRotX: 0.022 + 0.012 * b, torsoRotY: 0.035 * Math.sin(t * 0.42), torsoRotZ: -0.02 * w,
    headRotX: 0.02 + 0.02 * Math.sin(t * 0.9), headRotY: 0.14 * Math.sin(t * 0.33), headRotZ: 0.028 * w,
    armLRotX: 0.045 * b + 0.03, armLRotZ: 0.085, armRRotX: -0.045 * b + 0.03, armRRotZ: -0.085,
    elbowLRotX: -0.16, elbowRRotX: -0.16,
    legLRotX: 0, legRRotX: 0, kneeLRotX: 0.02, kneeRRotX: 0.02
  };
};

FantaziaPlayerModel.prototype._poseWalk = function (t) {
  var w = 5.2, s = Math.sin(t * w), c = Math.cos(t * w);
  return {
    hipsPosY: 0.024 * Math.abs(c), hipsRotX: 0.03, hipsRotY: 0.07 * s, hipsRotZ: 0.03 * s,
    torsoRotX: 0.07, torsoRotY: -0.09 * s, torsoRotZ: -0.035 * s,
    headRotX: -0.02, headRotY: 0.05 * s, headRotZ: -0.02 * s,
    armLRotX: 0.42 * s, armLRotZ: 0.09, armRRotX: -0.42 * s, armRRotZ: -0.09,
    elbowLRotX: -0.22 - 0.22 * Math.abs(s), elbowRRotX: -0.22 - 0.22 * Math.abs(s),
    legLRotX: -0.52 * s, legRRotX: 0.52 * s,
    kneeLRotX: 0.72 * Math.max(0, Math.sin(t * w - 0.95)),
    kneeRRotX: 0.72 * Math.max(0, Math.sin(t * w - 0.95 + Math.PI))
  };
};

FantaziaPlayerModel.prototype._poseRun = function (t) {
  var w = 8.6, s = Math.sin(t * w), c = Math.cos(t * w);
  return {
    hipsPosY: 0.05 * Math.abs(c), hipsRotX: 0.08, hipsRotY: 0.1 * s, hipsRotZ: 0.04 * s,
    torsoRotX: 0.22, torsoRotY: -0.13 * s, torsoRotZ: -0.04 * s,
    headRotX: -0.1, headRotY: 0.04 * s, headRotZ: 0,
    armLRotX: 0.78 * s, armLRotZ: 0.16, armRRotX: -0.78 * s, armRRotZ: -0.16,
    elbowLRotX: -1.15, elbowRRotX: -1.15,
    legLRotX: -0.85 * s, legRRotX: 0.85 * s,
    kneeLRotX: 1.2 * Math.max(0, Math.sin(t * w - 0.8)),
    kneeRRotX: 1.2 * Math.max(0, Math.sin(t * w - 0.8 + Math.PI))
  };
};

FantaziaPlayerModel.prototype._poseJump = function (t) {
  var ph = (t * 2.4) % 1;
  var crouch = ph < 0.42;
  var air = crouch ? 0 : Math.sin(Math.PI * Math.min(1, (ph - 0.42) / 0.58));
  var k = crouch ? ph / 0.42 : 0;
  return {
    hipsPosY: (crouch ? -0.14 * k : 0.34 * air), hipsRotX: crouch ? 0.2 * k : -0.05, hipsRotY: 0, hipsRotZ: 0,
    torsoRotX: crouch ? 0.3 * k : -0.08, torsoRotY: 0, torsoRotZ: 0,
    headRotX: crouch ? -0.1 * k : 0.06, headRotY: 0, headRotZ: 0,
    armLRotX: crouch ? 0.55 * k : -0.35, armLRotZ: crouch ? 0.15 : 2.1,
    armRRotX: crouch ? 0.55 * k : -0.35, armRRotZ: crouch ? -0.15 : -2.1,
    elbowLRotX: crouch ? -0.25 * k : -0.35, elbowRRotX: crouch ? -0.25 * k : -0.35,
    legLRotX: crouch ? -0.75 * k : -0.25 * air, legRRotX: crouch ? -0.75 * k : -0.25 * air,
    kneeLRotX: crouch ? 1.15 * k : 0.75 * air, kneeRRotX: crouch ? 1.15 * k : 0.75 * air
  };
};

FantaziaPlayerModel.prototype._poseWave = function (t) {
  var wv = Math.sin(t * 7);
  return {
    hipsPosY: 0.004, hipsRotX: 0.01, hipsRotY: -0.06, hipsRotZ: 0,
    torsoRotX: 0.02, torsoRotY: -0.08, torsoRotZ: 0.02,
    headRotX: 0.03, headRotY: -0.18, headRotZ: 0.09,
    armLRotX: 0.05, armLRotZ: 0.1, armRRotX: 0.1, armRRotZ: -2.55,
    elbowLRotX: -0.18, elbowRRotX: -0.35 + 0.38 * wv,
    legLRotX: 0, legRRotX: 0, kneeLRotX: 0.02, kneeRRotX: 0.02
  };
};

FantaziaPlayerModel.prototype._poseDance = function (t) {
  var b = Math.sin(t * 4.3), b2 = Math.sin(t * 2.15), bs = Math.abs(Math.sin(t * 4.3));
  return {
    hipsPosY: 0.05 * bs, hipsRotX: 0.04, hipsRotY: 0.16 * b2, hipsRotZ: 0.13 * b2,
    torsoRotX: 0.05, torsoRotY: -0.13 * b2, torsoRotZ: -0.11 * b2,
    headRotX: 0.04 * b, headRotY: 0.08 * b2, headRotZ: 0.13 * b2,
    armLRotX: -0.3, armLRotZ: 0.55 + 0.75 * b, armRRotX: -0.3, armRRotZ: -0.55 - 0.75 * b,
    elbowLRotX: -0.85 - 0.3 * b, elbowRRotX: -0.85 + 0.3 * b,
    legLRotX: -0.16 * b, legRRotX: 0.16 * b,
    kneeLRotX: 0.28 + 0.22 * b, kneeRRotX: 0.28 - 0.22 * b
  };
};

FantaziaPlayerModel.prototype._poseSit = function (t) {
  var sw = Math.sin(t * 1.1) * 0.02;
  return {
    hipsPosY: -0.3, hipsRotX: 0.02, hipsRotY: 0, hipsRotZ: 0,
    torsoRotX: -0.06 + sw, torsoRotY: 0.03 * Math.sin(t * 0.7), torsoRotZ: 0,
    headRotX: 0.05, headRotY: 0.06 * Math.sin(t * 0.5), headRotZ: 0,
    armLRotX: -0.55, armLRotZ: 0.12, armRRotX: -0.55, armRRotZ: -0.12,
    elbowLRotX: -0.95, elbowRRotX: -0.95,
    legLRotX: -1.32, legRRotX: -1.32, kneeLRotX: 1.28, kneeRRotX: 1.28
  };
};

FantaziaPlayerModel.prototype._poseCrouch = function () {
  return {
    hipsPosY: -0.33, hipsRotX: 0.1, hipsRotY: 0, hipsRotZ: 0,
    torsoRotX: 0.46, torsoRotY: 0, torsoRotZ: 0,
    headRotX: -0.32, headRotY: 0, headRotZ: 0,
    armLRotX: -0.35, armLRotZ: 0.14, armRRotX: -0.35, armRRotZ: -0.14,
    elbowLRotX: -0.55, elbowRRotX: -0.55,
    legLRotX: -0.98, legRRotX: -0.98, kneeLRotX: 1.5, kneeRRotX: 1.5
  };
};

FantaziaPlayerModel.prototype._poseFns = {
  idle: FantaziaPlayerModel.prototype._poseIdle,
  walk: FantaziaPlayerModel.prototype._poseWalk,
  run: FantaziaPlayerModel.prototype._poseRun,
  jump: FantaziaPlayerModel.prototype._poseJump,
  wave: FantaziaPlayerModel.prototype._poseWave,
  dance: FantaziaPlayerModel.prototype._poseDance,
  sit: FantaziaPlayerModel.prototype._poseSit,
  crouch: FantaziaPlayerModel.prototype._poseCrouch
};

FantaziaPlayerModel.prototype._applyPose = function () {
  var p = this._pose;
  this.hips.position.y = 0.96 + p.hipsPosY;
  this.hips.rotation.set(p.hipsRotX, p.hipsRotY, p.hipsRotZ);
  this.torso.rotation.set(p.torsoRotX, p.torsoRotY, p.torsoRotZ);
  this.head.rotation.set(p.headRotX, p.headRotY, p.headRotZ);
  this.armL.rotation.set(p.armLRotX, 0, p.armLRotZ);
  this.armR.rotation.set(p.armRRotX, 0, p.armRRotZ);
  this.elbowL.rotation.set(p.elbowLRotX, 0, 0);
  this.elbowR.rotation.set(p.elbowRRotX, 0, 0);
  this.legL.rotation.set(p.legLRotX, 0, 0);
  this.legR.rotation.set(p.legRRotX, 0, 0);
  this.kneeL.rotation.set(p.kneeLRotX, 0, 0);
  this.kneeR.rotation.set(p.kneeRRotX, 0, 0);
};

/* главный метод — вызывать каждый кадр.
   lookTarget (необязательно): THREE.Vector3 — точка, за которой следит взгляд
   (например, camera.position — персонаж смотрит на камеру) */
FantaziaPlayerModel.prototype.update = function (dt, lookTarget) {
  if (dt === undefined) dt = 0.016;
  if (dt > 0.06) dt = 0.06;
  this._time += dt;

  var fn = this._poseFns[this.state] || this._poseFns.idle;
  var target = fn.call(this, this._time);
  var k = 1 - Math.exp(-10 * dt);

  for (var i = 0; i < CHANNELS.length; i++) {
    var ch = CHANNELS[i];
    this._pose[ch] += ((target[ch] || 0) - this._pose[ch]) * k;
  }
  this._applyPose();

  /* --- взгляд за целью (камерой) --- */
  var yaw = 0, pitch = 0;
  if (lookTarget) {
    this.group.updateWorldMatrix(true, false);
    var local = this.group.worldToLocal(lookTarget.clone());
    var dx = local.x, dz = local.z, dy = local.y - 1.62;
    yaw = Math.atan2(dx, dz);
    var dist = Math.sqrt(dx * dx + dz * dz);
    pitch = Math.atan2(dy, dist);
    yaw = Math.max(-0.62, Math.min(0.62, yaw));
    pitch = Math.max(-0.5, Math.min(0.5, pitch));
  }
  var lk = 1 - Math.exp(-7 * dt);
  this._lookYaw += (yaw - this._lookYaw) * lk;
  this._lookPitch += (pitch - this._lookPitch) * lk;
  this.head.rotation.y += this._lookYaw * 0.55;
  this.head.rotation.x -= this._lookPitch * 0.45;

  /* зрачки слегка следят за взглядом */
  for (var pi = 0; pi < this._pupils.length; pi++) {
    this._pupils[pi].position.x = this._lookYaw * 0.013;
    this._pupils[pi].position.y = this._lookPitch * 0.011;
  }

  /* --- дыхание (грудь) --- */
  this._breath += dt;
  var br = 1 + Math.sin(this._breath * 1.6) * 0.02;
  this._chestMesh.scale.set(br, 1, 0.74 * br);

  /* --- моргание --- */
  this._blinkTimer -= dt;
  if (this._blinkTimer <= 0 && this._blinkState === 0) {
    this._blinkState = 1;
    this._blinkTimer = 0.12;
  } else if (this._blinkState === 1 && this._blinkTimer <= 0) {
    this._blinkState = 0;
    this._blinkTimer = 1.6 + Math.random() * 3.4;
  }
  var eyeTarget = this._blinkState === 1 ? 0.06 : 1;
  var ek = 1 - Math.exp(-30 * dt);
  var sy = this.eyeL.scale.y + (eyeTarget - this.eyeL.scale.y) * ek;
  this.eyeL.scale.y = sy;
  this.eyeR.scale.y = sy;
};

/* очистка ресурсов */
FantaziaPlayerModel.prototype.dispose = function () {
  for (var i = 0; i < this._geometries.length; i++) this._geometries[i].dispose();
  for (var j = 0; j < this._materials.length; j++) this._materials[j].dispose();
  if (this._tagTexture) this._tagTexture.dispose();
  this.group.clear();
};


global.FantaziaPlayerModel = FantaziaPlayerModel;
console.log('[FantaziaPlayerModel] v' + VERSION + ' готов к работе');
})(typeof window !== "undefined" ? window : globalThis);
