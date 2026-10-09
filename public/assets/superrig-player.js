/*!
 * ============================================================
 * FANTAZIA RP 3D — АНИМАЦИИ ИГРОКА ИЗ ПАКА SuperRig 3.2
 * ------------------------------------------------------------
 * Подключает настоящий скелетный персонаж из exports/player_super.glb
 * (20 анимаций + 7 поз) вместо процедурной «коробочной» анимации.
 *
 * Работает так же, как уже сделанный в игре SuperRig-монстр:
 *   • GLB не загрузился → всё остаётся как было (процедурный персонаж);
 *   • GLB загрузился → у игрока и у всех remote-игроков настоящие анимации.
 *
 * Ничего в index.html не переписывается — файл только оборачивает
 * существующие функции createCharacter / animateCharacter /
 * animateRemoteCharacter.
 *
 * Выключить/включить на лету (сохраняется в localStorage):
 *   SuperRig.off()   SuperRig.on()   SuperRig.list()
 * ============================================================
 */
(function (global) {
'use strict';

var SR = global.SuperRig = {
  ready: false,
  // ключ намеренно новый: если в браузере остался старый флаг fz_superrig=0
  // (от прошлых сессий), он больше НЕ выключает новые анимации
  enabled: localStorage.getItem('fz_superrig2') !== '0',
  url: 'exports/player_super.glb',
  // клипы «держит фонарик / меч» и «подбирает» (сделаны в Blender: tools/blender/build_hold_anims.py)
  holdUrl: 'exports/player_hold.glb',
  holdClips: [],
  src: null,
  clips: []
};

// --- какая игровая анимация каким клипом рига играется ---
var MAP = {
  idle:      'ANIM_Idle_Loop',
  walk:      'ANIM_Walk_Loop',
  run:       'ANIM_Run_Loop',
  sprint:    'ANIM_Run_Loop',
  crouch:    'ANIM_Crouch_Walk_Loop',
  crouchIdle:'POSE_Crouch',
  sneak:     'ANIM_Sneak_Loop',
  jump:      'ANIM_Jump',
  land:      'ANIM_Jump',
  attack:    'ANIM_Punch',
  hit:       'ANIM_Punch',
  hurt:      'ANIM_Hurt_Reaction',
  death:     'ANIM_Defeat',
  die:       'ANIM_Defeat',
  victory:   'ANIM_Victory',
  dance:     'ANIM_Dance_Loop',
  disco:     'ANIM_Dance_Loop',
  dab:       'ANIM_Dance_Loop',
  headbang:  'ANIM_Dance_Loop',
  robot:     'ANIM_Dance_Loop',
  spin:      'ANIM_Dance_Loop',
  sit:       'ANIM_Sit_Down',
  wave:      'ANIM_Wave_Loop',
  point:     'ANIM_Point',
  pickup:    'ANIM_Point',
  repair:    'ANIM_Explain_Loop',
  talk:      'ANIM_Talk_Casual_Loop',
  talkSerious:'ANIM_Talk_Serious_Loop',
  talkExcited:'ANIM_Talk_Excited_Loop',
  listen:    'ANIM_Listen_Loop',
  look:      'ANIM_Look_Around',
  // предметы в руках (клипы из player_hold.glb)
  hold_flash:'HOLD_FLASH',
  hold_sword:'HOLD_SWORD',
  pick_flash:'PICK_FLASH',
  pick_sword:'PICK_SWORD',
  finish_sword:'FINISH_SWORD'
};
// одноразовые (проигрываются один раз и замирают на последнем кадре)
var ONCE = { jump: 1, land: 1, attack: 1, hit: 1, hurt: 1, victory: 1, point: 1, pickup: 1, sit: 1, death: 1, die: 1, look: 1, pick_flash: 1, pick_sword: 1, finish_sword: 1 };
// подбор предмета: после окончания клипа персонаж переходит в позу удержания, а не повторяет подбор
var PICKS = { pick_flash: 1, pick_sword: 1, finish_sword: 1 };

// --- 16 эмоций из меню «Танцы» -> клипы пака 3.2 ---
// clip  — что играть, speed — скорость клипа,
// once  — проиграть один раз, hold — в какую позу встать после этого
var EMOTES = {
  wave:      { clip: 'ANIM_Wave_Loop' },
  disco:     { clip: 'ANIM_Dance_Loop', speed: 1.00 },
  latina:    { clip: 'ANIM_Dance_Loop', speed: 0.85 },
  floss:     { clip: 'ANIM_Dance_Loop', speed: 1.35 },
  headbang:  { clip: 'ANIM_Dance_Loop', speed: 1.60 },
  robot:     { clip: 'ANIM_Dance_Loop', speed: 0.60 },
  spin:      { clip: 'ANIM_Dance_Loop', speed: 1.80 },
  acrobatic: { clip: 'ANIM_Dance_Loop', speed: 1.25 },
  rap:       { clip: 'ANIM_Talk_Excited_Loop', speed: 1.15 },
  laugh:     { clip: 'ANIM_Talk_Excited_Loop', speed: 1.30 },
  dab:       { clip: 'ANIM_Victory', once: true, hold: 'POSE_Hero' },
  fistbump:  { clip: 'ANIM_Punch',   once: true, hold: 'POSE_Guard' },
  jump:      { clip: 'ANIM_Jump',    once: true },
  sit:       { clip: 'ANIM_Sit_Down', once: true, hold: 'POSE_Sit' },
  meditate:  { clip: 'ANIM_Sit_Down', once: true, hold: 'POSE_Sit', speed: 0.7 },
  duck:      { clip: 'POSE_Crouch' }
};
// «скучающий» игрок иногда осматривается — разбавляет стояние на месте
var IDLE_BREAKS = ['ANIM_Look_Around'];

// --- кости рига названы так же, как части процедурного персонажа ---
var BONES = {
  head: 'head', body: 'spine', hips: 'hips',
  leftArm: 'leftArm', rightArm: 'rightArm',
  leftElbow: 'leftElbow', rightElbow: 'rightElbow',
  leftLeg: 'leftLeg', rightLeg: 'rightLeg',
  leftKnee: 'leftKnee', rightKnee: 'rightKnee',
  leftEye: 'leftEye', rightEye: 'rightEye', mouth: 'mouth', hair: 'hair'
};

// --- материалы рига под внешность из редактора персонажа ---
var SKIN  = ['Skin_Face', 'Skin_Hands'];
var SHIRT = ['Hoodie_Blue', 'Accent_Cyan'];
var PANTS = ['Pants_Navy', 'Shoes_Charcoal'];
var HAIR  = ['Hair_Brown', 'Eyebrow_L', 'Eyebrow_R'];

function tint(model, appearance) {
  if (!appearance) return;
  model.traverse(function (o) {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    var mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach(function (m, i) {
      if (!m || !m.name) return;
      var c = null;
      if (SKIN.indexOf(m.name) >= 0 && appearance.skinColor) c = appearance.skinColor;
      else if (SHIRT.indexOf(m.name) >= 0 && appearance.shirtColor) c = appearance.shirtColor;
      else if (PANTS.indexOf(m.name) >= 0 && appearance.pantsColor) c = appearance.pantsColor;
      else if (HAIR.indexOf(m.name) >= 0 && appearance.hairColor) c = appearance.hairColor;
      if (!c) return;
      var nm = m.clone();
      nm.color = new THREE.Color(c);
      if (m.name === 'Accent_Cyan' || m.name === 'Shoes_Charcoal') nm.color.multiplyScalar(0.72);
      if (m.name === 'Eyebrow_L' || m.name === 'Eyebrow_R') nm.color.multiplyScalar(0.6);
      if (Array.isArray(o.material)) o.material[i] = nm; else o.material = nm;
    });
  });
}

// плавное переключение клипа (как у SuperRig-монстра в игре)
// какой предмет в руке у ЛОКАЛЬНОГО игрока: 2 — фонарик, 3 — меч (слоты хотбара).
// Заодно включает/выключает меч на модели. У других игроков предметов не видно (не синхронизируются).
function heldClipName(ch) {
  var ud = ch && ch.userData;
  if (!ud) return null;
  var local = typeof localPlayer !== 'undefined' && !!localPlayer && localPlayer.mesh === ch;
  var slot = (local && typeof ITEMS !== 'undefined') ? ITEMS.slot : 0;
  var hasF = (typeof DLC !== 'undefined') && !!DLC.hasFlashlight;
  var hasS = (typeof DLC !== 'undefined') && !!DLC.hasSword;
  if (ud._swordMesh) ud._swordMesh.visible = !!(slot === 3 && hasS);
  if (slot === 2 && hasF && ud.actions && ud.actions.HOLD_FLASH) return 'hold_flash';
  if (slot === 3 && hasS && ud.actions && ud.actions.HOLD_SWORD) return 'hold_sword';
  return null;
}

function playClip(ud, clipName, once, fade) {
  var a = ud.actions[clipName];
  if (!a) return;
  if (ud.curAnim === a) {
    if (once && !a.isRunning()) { a.reset(); a.play(); }
    return;
  }
  a.reset();
  a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
  a.clampWhenFinished = !!once;
  a.setEffectiveWeight(1);
  a.fadeIn(fade === undefined ? 0.2 : fade);
  if (ud.curAnim) ud.curAnim.fadeOut(fade === undefined ? 0.2 : fade);
  a.play();
  ud.curAnim = a;
}

// ------------------------------------------------------------
// сборка персонажа: процедурный остаётся (имя над головой,
// аксессуары, инвентарь), но меши прячутся, а вместо них —
// скелетная модель из GLB
// ------------------------------------------------------------
SR.build = function (base, appearance) {
  var model = THREE.SkeletonUtils.clone(SR.src.scene);
  var ud = base.userData;

  // СТАРЫЙ «коробочный» персонаж физически снимается с игрока:
  // меши вынимаются из сцены в отдельный отцепленный контейнер,
  // чтобы старая процедурная анимация больше ничего не рисовала.
  var junk = ud._procJunk || (ud._procJunk = new THREE.Group());   // в сцену НЕ добавляется
  var old = [];
  base.traverse(function (o) { if (o.isMesh && !o.userData._srPart) old.push(o); });
  old.forEach(function (o) {
    o.visible = false;
    o.userData._procBox = true;
    junk.add(o);               // отцепляем от персонажа
  });

  model.traverse(function (o) {
    if (o.isMesh || o.isSkinnedMesh) { o.castShadow = true; o.frustumCulled = false; }
  });
  tint(model, appearance);
  base.add(model);

  // найти кости и подменить ссылки, которыми пользуется остальная игра
  var found = {};
  model.traverse(function (o) {
    if (!o.name) return;
    if (!found[o.name]) found[o.name] = o;
    // GLTFLoader убирает точки из имён: pupil.L -> pupilL
    var alt = o.name.replace(/[.\s:]/g, '');
    if (!found[alt]) found[alt] = o;
  });
  Object.keys(BONES).forEach(function (k) { if (found[BONES[k]]) ud[k] = found[BONES[k]]; });

  // ---------- ЛИЦО ----------
  // ВАЖНО: игра двигает брови/зрачки АБСОЛЮТНЫМИ координатами процедурной
  // коробки (brow.position.y = 0.19 и т.п.). У костей рига свои координаты,
  // поэтому от таких записей брови улетали с лица.
  // Решение: игре подсовываем пустышки (она пишет в них — визуально ничего),
  // а настоящее лицо анимируем сами, ОТНОСИТЕЛЬНО исходной позы кости.
  var realFace = {
    eyeL: found['leftEye'], eyeR: found['rightEye'],
    pupL: found['pupilL'] || found['pupil.L'], pupR: found['pupilR'] || found['pupil.R'],
    browL: found['browL'] || found['brow.L'], browR: found['browR'] || found['brow.R'],
    mouth: found['mouth']
  };
  var faceOk = Object.keys(realFace).every(function (k) { return !!realFace[k]; });

  function stub() { return new THREE.Object3D(); }   // пустышка для старого кода игры
  ud.face = { eyeL: stub(), eyeR: stub(), pupL: stub(), pupR: stub(), browL: stub(), browR: stub(), mouth: stub() };
  ud.leftEye = ud.face.eyeL; ud.rightEye = ud.face.eyeR; ud.mouth = ud.face.mouth;

  if (faceOk) {
    // запоминаем исходную (правильную) позу костей лица
    var rest = {};
    Object.keys(realFace).forEach(function (k) {
      var o = realFace[k];
      rest[k] = {
        px: o.position.x, py: o.position.y, pz: o.position.z,
        rz: o.rotation.z, sx: o.scale.x, sy: o.scale.y, sz: o.scale.z
      };
    });
    ud.srFace = realFace;
    ud.srFaceRest = rest;
    ud._blinkT = 1 + Math.random() * 3;
  } else {
    console.warn('[SuperRig] кости лица не найдены — мимика отключена');
  }
  if (found['head'] && ud.accGroup) found['head'].add(ud.accGroup); // шапки/очки — на голову

  ud.isSuperRig = true;
  ud.srModel = model;
  ud.mixer = new THREE.AnimationMixer(model);
  ud.actions = {};
  SR.src.animations.forEach(function (c) { ud.actions[c.name] = ud.mixer.clipAction(c); });
  (SR.holdClips || []).forEach(function (c) { ud.actions[c.name] = ud.mixer.clipAction(c); });
  // меч в правой руке (видим только когда он выбран в слоте 3 у локального игрока)
  try {
    var swHand = model.getObjectByName('rightHand');
    if (swHand && typeof makeSwordModel === 'function') {
      var sw = makeSwordModel();
      sw.position.set(0, 0.02, 0.03);
      sw.rotation.set(Math.PI / 2, 0, 0);   // клинок вперёд от кисти (локальная Z кости = вперёд)
      sw.visible = false;
      swHand.add(sw);
      ud._swordMesh = sw;
    }
  } catch (e) { console.warn('[SuperRig] меч не прикреплён:', e); }
  ud.curAnim = null;
  ud._srLast = 0;
  playClip(ud, 'ANIM_Idle_Loop', false, 0);
  SR.last = base;          // для отладки: SuperRig.now()
  return base;
};

// ------------------------------------------------------------
// проигрывание: имя игровой анимации -> клип рига
// ------------------------------------------------------------
SR.animate = function (ch, animation, delta, emote) {
  var ud = ch.userData;
  if (!ud || !ud.mixer) return false;
  if (emote) ud._srEmote = emote;

  // remote-игроки зовут animateCharacter с delta = 0 — считаем сами
  var now = performance.now();
  if (!delta || delta <= 0) {
    delta = ud._srLast ? Math.min(0.05, (now - ud._srLast) / 1000) : 0.016;
  }
  ud._srLast = now;

  var name = animation || 'idle';
  ud._srReq = name;                 // что просит игра (для отладки: SuperRig.now())
  var heldName = heldClipName(ch);  // фонарик/меч в руке у локального игрока (и видимость меча)
  // персонаж пишет в чат — каждый раз новая разговорная анимация из пака 3.2
  if ((name === 'idle' || name === 'talk') && ud.mood === 'talk') {
    if (ud._talkPrev !== 'talk') ud._talkKind = ['talk', 'talkSerious', 'talkExcited'][(Math.random() * 3) | 0];
    name = ud._talkKind || 'talk';
  } else if (name === 'idle' && SR._listenUntil && performance.now() < SR._listenUntil) {
    name = 'listen';                // рядом кто-то написал в чат — персонаж слушает
  }
  ud._talkPrev = ud.mood;

  // подбор предмета: клип играется один раз, после него персонаж держит предмет
  if (PICKS[name]) {
    if (!ud.actions[MAP[name]]) name = name === 'finish_sword' ? 'attack' : 'pickup';   // клипа нет (GLB не загрузился) — старая анимация
    else if (ud._pickDone === name) name = 'idle';
    else {
      var pk = ud.actions[MAP[name]];
      if (ud.curAnim === pk && pk.time >= pk.getClip().duration - 0.05) { ud._pickDone = name; name = 'idle'; }
    }
  } else {
    ud._pickDone = null;
  }
  // в руке предмет — в покое стоим с ним (ходьба пока обычная)
  if (name === 'idle' && heldName) name = heldName;

  // ----- реальная скорость персонажа (единиц в секунду) -----
  var pos = ch.position, moved = 0;
  if (ud._srPos) moved = Math.sqrt((pos.x - ud._srPos.x) * (pos.x - ud._srPos.x) +
                                   (pos.z - ud._srPos.z) * (pos.z - ud._srPos.z));
  ud._srPos = { x: pos.x, z: pos.z };
  var inst = delta > 0 ? moved / delta : 0;
  ud._srSpeed = (ud._srSpeed || 0) * 0.75 + inst * 0.25;   // сглаженная скорость
  var spd = ud._srSpeed;

  // присед: стоим на месте — статичная поза, идём — ходьба в присяде
  if (name === 'crouch' && spd < 0.25 && ud.actions['POSE_Crouch']) name = 'crouchIdle';

  // ----- эмоции из меню «Танцы»: у каждой свой клип -----
  var em = null;
  if (name === 'dance') {
    em = EMOTES[ud._srEmote || SR.emote] || { clip: 'ANIM_Dance_Loop' };
    if (em.once && ud._srHold === em.clip && em.hold && ud.actions[em.hold]) {
      playClip(ud, em.hold, false, 0.25);          // поза после одноразового клипа
    } else {
      playClip(ud, em.clip, !!em.once, 0.25);
      if (em.once) {
        var a0 = ud.actions[em.clip];
        if (a0 && a0.time >= a0.getClip().duration - 0.06) ud._srHold = em.clip;
        else if (ud._srHold !== em.clip) ud._srHold = null;
      }
    }
  } else {
    ud._srHold = null;

    // ----- пауза в покое: персонаж осматривается, а не «стоит столбом» -----
    if (name === 'idle' && spd < 0.1) {
      ud._idleT = (ud._idleT || 0) + delta;
      if (ud._idleBreak) {
        var ab = ud.actions[ud._idleBreak];
        if (!ab || !ab.isRunning() || ab.time >= ab.getClip().duration - 0.05) { ud._idleBreak = null; ud._idleT = 0; }
        else name = '__break';
      } else if (ud._idleT > (ud._idleNext || (ud._idleNext = 12 + Math.random() * 10))) {
        ud._idleBreak = IDLE_BREAKS[(Math.random() * IDLE_BREAKS.length) | 0];
        ud._idleNext = 12 + Math.random() * 10;
        ud._idleT = 0;
        name = '__break';
      }
    } else { ud._idleT = 0; ud._idleBreak = null; }

    if (name === '__break') playClip(ud, ud._idleBreak, true, 0.3);
    else playClip(ud, MAP[name] || MAP.idle, !!ONCE[name], 0.2);
  }

  // ----- скорость клипа подгоняется под реальную скорость персонажа -----
  if (ud.curAnim) {
    var ts = 1;
    if (em) {
      ts = em.speed || 1;
    } else if (name === 'walk' || name === 'run' || name === 'sprint' || name === 'crouch' || name === 'sneak') {
      // САМОКАЛИБРОВКА: эталон — максимальная скорость, которую персонаж
      // развивал в этом состоянии. На полном ходу клип идёт 1:1,
      // при замедлении (подъём, упор в стену) ноги перебирают медленнее.
      var key = (name === 'run' || name === 'sprint') ? '_refRun' : (name === 'walk' ? '_refWalk' : '_refSlow');
      var ref = ud[key] || 0.01;
      if (spd > ref) ref = spd; else ref *= 0.9995;   // медленно «забывает» рекорд
      ud[key] = ref;
      ts = ref > 0.02 ? spd / ref : 1;
      ts = Math.max(0.55, Math.min(1.45, ts));
    }
    ud.curAnim.setEffectiveTimeScale(ts);
  }
  ud.mixer.update(delta);
  SR.face(ch, delta);        // мимика поверх клипа (брови/глаза/рот)
  return true;
};

// ------------------------------------------------------------
// мимика рига: моргание, рот при разговоре, брови под настроение.
// Всё считается ОТ ИСХОДНОЙ ПОЗЫ КОСТИ (rest) и с маленькими
// смещениями — поэтому брови физически не могут «улететь» с лица.
// ------------------------------------------------------------
var MOODS = {
  normal:  { eye: 1.00, brow:  0.00, browY:  0.000, mouthY: 1.00, mouthX: 1.00 },
  talk:    { eye: 1.02, brow:  0.05, browY:  0.004, mouthY: null, mouthX: 0.92 },
  scared:  { eye: 1.35, brow:  0.30, browY:  0.008, mouthY: 2.00, mouthX: 0.75 },
  happy:   { eye: 0.72, brow: -0.16, browY:  0.002, mouthY: 0.90, mouthX: 1.45 },
  tired:   { eye: 0.82, brow: -0.10, browY: -0.004, mouthY: 1.40, mouthX: 0.85 },
  angry:   { eye: 0.90, brow:  0.34, browY: -0.006, mouthY: 1.10, mouthX: 0.90 }
};

SR.face = function (ch, delta) {
  var ud = ch.userData, F = ud.srFace, R = ud.srFaceRest;
  if (!F || !R) return;
  var t = performance.now() / 1000;
  var M = MOODS[ud.mood] || MOODS.normal;

  // моргание
  ud._blinkT -= delta;
  var blink = false;
  if (ud._blinkT <= 0) {
    if (ud._blinkT < -0.11) ud._blinkT = 2 + Math.random() * 4;
    else blink = true;
  }
  // микродвижения зрачков
  ud._sacT = (ud._sacT === undefined ? 1 : ud._sacT - delta);
  if (ud._sacT <= 0) {
    ud._sacT = 0.9 + Math.random() * 2.6;
    ud._sacX = (Math.random() - 0.5) * 0.016;
    ud._sacY = (Math.random() - 0.5) * 0.010;
  }
  if (ud.mood === 'talk' || ud.mood === 'scared') { ud._sacX = 0; ud._sacY = 0; }

  var k = 1 - Math.exp(-9 * delta), kp = 1 - Math.exp(-14 * delta);
  var eyeT = blink ? 0.08 : M.eye;

  ['eyeL', 'eyeR'].forEach(function (n) {
    var o = F[n], r = R[n];
    o.scale.y += (r.sy * eyeT - o.scale.y) * (blink ? 1 : k);
    o.scale.x += (r.sx * Math.max(1, M.eye * 0.95) - o.scale.x) * k;
  });
  [['browL', -1], ['browR', 1]].forEach(function (p) {
    var o = F[p[0]], r = R[p[0]];
    // ЖЁСТКАЯ СТРАХОВКА: если чужой код сдвинул бровь далеко от исходной точки
    // (или там NaN) — мгновенно возвращаем её на место, без плавного перехода.
    if (!isFinite(o.position.x) || !isFinite(o.position.y) || !isFinite(o.position.z) ||
        Math.abs(o.position.x - r.px) > 0.03 ||
        Math.abs(o.position.y - r.py) > 0.03 ||
        Math.abs(o.position.z - r.pz) > 0.03) {
      o.position.set(r.px, r.py, r.pz);
    }
    // только поворот + КРОХОТНОЕ смещение от исходной точки
    o.rotation.z += ((r.rz + p[1] * M.brow) - o.rotation.z) * k;
    o.position.y += ((r.py + M.browY) - o.position.y) * k;
    o.position.x += (r.px - o.position.x) * k;   // держим на месте по X/Z
    o.position.z += (r.pz - o.position.z) * k;
  });
  ['pupL', 'pupR'].forEach(function (n) {
    var o = F[n], r = R[n];
    o.position.x += ((r.px + (ud._sacX || 0)) - o.position.x) * kp;
    o.position.y += ((r.py + (ud._sacY || 0)) - o.position.y) * kp;
  });
  var mo = F.mouth, mr = R.mouth;
  var mY = M.mouthY === null ? (1 + Math.abs(Math.sin(t * 11)) * 1.7) : M.mouthY;
  mo.scale.y += (mr.sy * mY - mo.scale.y) * k;
  mo.scale.x += (mr.sx * M.mouthX - mo.scale.x) * k;
};

// сбросить «застывшую позу» у всех собранных персонажей при смене эмоции
SR._clearHold = function () {
  if (SR.last && SR.last.userData) { SR.last.userData._srHold = null; SR.last.userData._srEmote = SR.emote; }
};

SR.list = function () {
  return SR.clips.slice();
};
// какой клип играет прямо сейчас у последнего собранного персонажа
SR.now = function () {
  var ud = SR.last && SR.last.userData;
  if (!ud) return null;
  return (ud._srReq || '?') + ' -> ' + (ud.curAnim ? ud.curAnim.getClip().name : '-');
};
SR.on = function () { localStorage.setItem('fz_superrig2', '1'); location.reload(); };
SR.off = function () { localStorage.setItem('fz_superrig2', '0'); location.reload(); };

// ------------------------------------------------------------
// ИНДИКАТОР (левый нижний угол): видно, какие анимации работают
// и какой клип играет прямо сейчас. Скрыть/показать — клавиша F9.
// ------------------------------------------------------------
SR.badge = function () {
  if (SR._badgeEl) return SR._badgeEl;
  var d = document.createElement('div');
  d.id = 'srBadge';
  d.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:99999;font:11px/1.45 ui-monospace,Consolas,monospace;' +
    'background:rgba(8,10,16,.82);color:#9ff5b5;border:1px solid rgba(90,255,150,.35);border-radius:8px;' +
    'padding:6px 9px;pointer-events:none;white-space:pre;backdrop-filter:blur(4px);max-width:46vw';
  document.body.appendChild(d);
  SR._badgeEl = d;
  setInterval(function () {
    var el = SR._badgeEl; if (!el || el.style.display === 'none') return;
    if (!SR.ready) {
      el.style.color = '#ff9a9a'; el.style.borderColor = 'rgba(255,120,120,.45)';
      el.textContent = 'АНИМАЦИИ: СТАРЫЕ (процедурные)\n' +
        (SR.enabled ? 'exports/player_super.glb не загрузился' : 'SuperRig выключен: SuperRig.on()');
      return;
    }
    var ud = SR.last && SR.last.userData;
    el.style.color = '#9ff5b5'; el.style.borderColor = 'rgba(90,255,150,.35)';
    el.textContent = 'АНИМАЦИИ: НОВЫЕ · пак SuperRig 3.2 · ' + SR.clips.length + ' клипов\n' +
      'сейчас: ' + (ud && ud._srReq ? ud._srReq : '—') + ' -> ' +
      (ud && ud.curAnim ? ud.curAnim.getClip().name : '—') +
      (ud && ud.curAnim ? '  x' + ud.curAnim.getEffectiveTimeScale().toFixed(2) : '') +
      (ud && ud._srSpeed !== undefined ? '\nскорость: ' + ud._srSpeed.toFixed(2) : '') +
      '\n[F9] скрыть';
  }, 250);
  return d;
};
addEventListener('keydown', function (e) {
  if (e.code === 'F9') {
    var el = SR.badge();
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
  }
});

// ------------------------------------------------------------
// подмена функций игры (ничего не переписываем — только оборачиваем)
// ------------------------------------------------------------
function hook() {
  if (SR._hooked) return;
  if (typeof global.createCharacter !== 'function' || typeof global.animateCharacter !== 'function') return;
  SR._hooked = true;

  var origCreate = global.createCharacter;
  global.createCharacter = function (appearance, isLocal) {
    var base = origCreate.apply(this, arguments);
    try {
      if (SR.ready && SR.enabled && base) return SR.build(base, appearance);
    } catch (e) { console.warn('[SuperRig] не удалось собрать персонажа:', e); }
    return base;
  };

  var origAnim = global.animateCharacter;
  global.animateCharacter = function (character, animation, time, delta) {
    if (character && character.userData && character.userData.isSuperRig) {
      if (SR.animate(character, animation, delta)) return;
    }
    return origAnim.apply(this, arguments);
  };

  if (typeof global.animateRemoteCharacter === 'function') {
    var origRemote = global.animateRemoteCharacter;
    global.animateRemoteCharacter = function (character, animation, dance, t) {
      if (character && character.userData && character.userData.isSuperRig) {
        // dance — это тип эмоции («wave», «disco», «sit»…), передаём его в риг
        if (SR.animate(character, dance ? 'dance' : animation, 0, dance || null)) return;
      }
      return origRemote.apply(this, arguments);
    };
  }

  // чужое сообщение в чате — персонаж «слушает» (ANIM_Listen_Loop)
  if (typeof global.addChatMessage === 'function') {
    var origChat = global.addChatMessage;
    global.addChatMessage = function (msg) {
      try {
        var mine = SR.last && SR.last.userData && SR.last.userData.mood === 'talk';
        if (!mine) SR._listenUntil = performance.now() + 4200;
      } catch (e) {}
      return origChat.apply(this, arguments);
    };
  }

  // какая именно эмоция включена у локального игрока
  SR.emote = null;
  if (typeof global.doDance === 'function') {
    var origDance = global.doDance;
    global.doDance = function (type) { SR.emote = type; SR._clearHold(); return origDance.apply(this, arguments); };
  }
  if (typeof global.stopDance === 'function') {
    var origStop = global.stopDance;
    global.stopDance = function () { SR.emote = null; SR._clearHold(); return origStop.apply(this, arguments); };
  }
  if (typeof global.sitOnBench === 'function') {     // лавочки сидят через систему танцев
    var origSit = global.sitOnBench;
    global.sitOnBench = function () { SR.emote = 'sit'; SR._clearHold(); return origSit.apply(this, arguments); };
  }

  // старая процедурная «дискотека» не должна трогать кости рига
  if (typeof global.applyDance === 'function') {
    var origApply = global.applyDance;
    global.applyDance = function (character, danceType, t) {
      if (character && character.userData && character.userData.isSuperRig) {
        SR.animate(character, 'dance', 0, danceType || null);
        return;
      }
      return origApply.apply(this, arguments);
    };
  }

  // если персонаж уже успел появиться до загрузки GLB — пересобрать
  try {
    if (global.localPlayer && global.localPlayer.mesh && !global.localPlayer.mesh.userData.isSuperRig) {
      SR.build(global.localPlayer.mesh, global.localPlayer.appearance);
    }
    if (global.remotePlayers) {
      Object.keys(global.remotePlayers).forEach(function (id) {
        var rp = global.remotePlayers[id];
        if (rp && rp.mesh && !rp.mesh.userData.isSuperRig) SR.build(rp.mesh, rp.appearance);
      });
    }
  } catch (e) { /* не критично */ }

  console.log('[SuperRig] анимации игрока подключены: ' + SR.clips.length + ' клипов');
}

function loadHold(done) {
  new THREE.GLTFLoader().load(SR.holdUrl, function (h) {
    SR.holdClips = h.animations;
    console.log('[SuperRig] player_hold.glb загружен: ' + h.animations.map(function (c) { return c.name; }).join(', '));
    done();
  }, undefined, function (err) {
    console.warn('[SuperRig] player_hold.glb не загрузился — фонарик/меч без своих поз', err && err.message ? err.message : '');
    done();
  });
}

function load() {
  if (!SR.enabled) { console.log('[SuperRig] выключен (SuperRig.on() — включить)'); return; }
  if (!global.THREE || !THREE.GLTFLoader || !THREE.SkeletonUtils) { setTimeout(load, 250); return; }
  new THREE.GLTFLoader().load(SR.url, function (g) {
    SR.src = g;
    SR.clips = g.animations.map(function (c) { return c.name; });
    // второй файл — клипы с предметами; если его нет, игра работает без них
    loadHold(function () {
      SR.ready = true;
      SR._tries = 0;
      console.log('[SuperRig] player_super.glb загружен: ' + g.animations.length + ' анимаций');
      hook();
      var iv = setInterval(function () { hook(); if (SR._hooked) clearInterval(iv); }, 300);
    });
  }, undefined, function (err) {
    // не сдаёмся с первого раза: сеть/прокси могли моргнуть
    SR._tries = (SR._tries || 0) + 1;
    console.warn('[SuperRig] попытка ' + SR._tries + ': ' + SR.url + ' не загрузился', err && err.message ? err.message : '');
    if (SR._tries < 4) setTimeout(load, 1200 * SR._tries);
    else console.error('[SuperRig] ФАЙЛ АНИМАЦИЙ НЕ НАЙДЕН: ' + SR.url +
      ' — положи player_super.glb в public/exports/, иначе игра играет старые процедурные анимации');
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
else load();

// Индикатор по умолчанию СКРЫТ. Показать/скрыть — клавиша F9
// (или вручную из консоли: SuperRig.badge()).

})(window);
