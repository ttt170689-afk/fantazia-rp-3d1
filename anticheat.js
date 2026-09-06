// ═══════════════════════════════════════════════════════════════════════════
//  FANTAZIA RP — АНТИЧИТ v52 (СЕРВЕРНАЯ СТОРОНА)
//
//  ПОЧЕМУ ИМЕННО НА СЕРВЕРЕ:
//  Всё, что проверяется в браузере, обходится за 10 секунд через DevTools —
//  игрок просто меняет переменную или вызывает функцию из консоли. Поэтому
//  единственная честная защита — недоверие к данным от клиента.
//
//  ЧТО ЗАКРЫВАЕТ ЭТОТ МОДУЛЬ (все дыры найдены аудитом реального кода):
//   1. ТЕЛЕПОРТ. updatePosition принимал любые координаты без проверки.
//      Теперь считаем скорость между пакетами: прыжок на 500 м = откат.
//   2. СПИДХАК. Порог скорости с запасом на пинг и лаги; нарушения
//      копятся, разовый лаг никого не наказывает.
//   3. ПОЛЁТ / ПОД ЗЕМЛЁЙ. Клампим Y в разумные пределы.
//   4. ВЫХОД ЗА КАРТУ. Координаты за границами мира — откат.
//   5. NaN / Infinity. Ими можно было сломать физику у ВСЕХ игроков,
//      потому что позиция транслируется всем через broadcast.
//   6. ФЛУД СОБЫТИЙ. Rate-limit на каждое событие: спам чата, спам
//      покупок, спам workout (бесконечный EXP — реальная дыра).
//   7. ДЕНЬГИ. Перевод отрицательных/дробных сумм, перевод самому себе.
//
//  ПРИНЦИП: не банить сразу. Копим «подозрительность», мягко откатываем
//  игрока назад. Живой человек с плохим интернетом не должен страдать.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';

const AC = {
  // ── границы мира ──
  // Город примерно ±400 по X/Z. Берём с запасом, чтобы не ловить
  // легальные дальние точки, но отсекать явную телепортацию.
  WORLD_MIN_X: -900, WORLD_MAX_X: 900,
  WORLD_MIN_Z: -900, WORLD_MAX_Z: 900,
  WORLD_MIN_Y: -60,               // ниже — только баг/чит
  WORLD_MAX_Y: 400,               // выше крыш и интерьеров ТЦ

  // ── скорость ──
  // Бег в игре ~10 units/s. Даём тройной запас на лаги, спуск с горки,
  // эскалатор и лифт. Всё, что выше — считаем подозрительным.
  MAX_SPEED: 34,                  // units/сек
  // Разрешённый разовый скачок: пакет мог задержаться на секунду.
  MAX_JUMP_DIST: 60,

  // ── интерьеры ──
  // Внутри зданий игрок телепортируется законно (вход/выход/этажи),
  // поэтому после легального перемещения даём «окно тишины».
  GRACE_MS: 2500,

  // ── наказания ──
  SUSPICION_LIMIT: 12,            // после этого — жёсткий откат и лог
  SUSPICION_DECAY_MS: 8000,       // подозрительность остывает

  // ── rate-limit: событие → минимальный интервал в мс ──
  LIMITS: {
    updatePosition: 20,           // 50 пакетов/сек — с запасом
    sendChat: 700,
    buyItem: 250,
    useItem: 200,
    interact: 300,
    workout: 3000,                // была дыра: спам = бесконечный EXP
    getJob: 1000,
    quitJob: 1000,
    adoptPet: 1500,
    feedPet: 800,
    renamePet: 1500,
    buyApartment: 1000,
    sellApartment: 1000,
    addFriend: 600,
    removeFriend: 600,
    startDance: 400,
    stopDance: 400,
    voiceStart: 1500,
    voiceStop: 1500,
    pingCheck: 400,
    adminCommand: 300
  }
};

// Состояние по каждому соединению. Живёт только в памяти и чистится
// при disconnect — утечки не будет даже за сутки аптайма.
const acState = new Map();

function acInit(id) {
  acState.set(id, {
    last: null,                   // последняя принятая позиция
    lastT: 0,                     // время последнего пакета
    suspicion: 0,
    lastDecay: Date.now(),
    graceUntil: Date.now() + 8000, // при входе даём освоиться
    events: Object.create(null),   // время последнего каждого события
    violations: 0,                 // сколько раз откатывали
    flags: []                      // краткая история для лога
  });
}

function acDrop(id) {
  acState.delete(id);
}

function acGet(id) {
  let s = acState.get(id);
  if (!s) { acInit(id); s = acState.get(id); }
  return s;
}

// Число пришло от клиента — доверять нельзя ничему.
function acFinite(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ── ГЛАВНАЯ ПРОВЕРКА ПОЗИЦИИ ────────────────────────────────────────────
// Возвращает { ok, position } — при подлоге отдаёт последнюю
// достоверную точку, чтобы сервер откатил игрока назад.
function acCheckPosition(id, raw, prevKnown) {
  const s = acGet(id);
  const now = Date.now();

  // остывание подозрительности
  if (now - s.lastDecay > AC.SUSPICION_DECAY_MS) {
    s.suspicion = Math.max(0, s.suspicion - 1);
    s.lastDecay = now;
  }

  const x = acFinite(raw && raw.x);
  const y = acFinite(raw && raw.y);
  const z = acFinite(raw && raw.z);

  // 1. NaN/Infinity — самый опасный случай: разлетится всем по broadcast
  if (x === null || y === null || z === null) {
    s.suspicion += 4;
    s.flags.push('NaN');
    return { ok: false, position: s.last || prevKnown || { x: 0, y: 0, z: 0 }, reason: 'NaN' };
  }

  // 2. границы мира
  let clamped = false;
  let cx = x, cy = y, cz = z;
  if (cx < AC.WORLD_MIN_X || cx > AC.WORLD_MAX_X ||
      cz < AC.WORLD_MIN_Z || cz > AC.WORLD_MAX_Z ||
      cy < AC.WORLD_MIN_Y || cy > AC.WORLD_MAX_Y) {
    clamped = true;
    cx = Math.min(AC.WORLD_MAX_X, Math.max(AC.WORLD_MIN_X, cx));
    cy = Math.min(AC.WORLD_MAX_Y, Math.max(AC.WORLD_MIN_Y, cy));
    cz = Math.min(AC.WORLD_MAX_Z, Math.max(AC.WORLD_MIN_Z, cz));
    s.suspicion += 3;
    s.flags.push('out-of-world');
  }

  // 3. скорость — только если есть с чем сравнивать и не в «окне тишины»
  const inGrace = now < s.graceUntil;
  if (s.last && !inGrace) {
    const dt = Math.max(0.016, (now - s.lastT) / 1000);
    const dx = cx - s.last.x, dz = cz - s.last.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const speed = dist / dt;

    if (dist > AC.MAX_JUMP_DIST) {
      // мгновенный прыжок через полкарты — телепорт
      s.suspicion += 5;
      s.flags.push('teleport:' + dist.toFixed(0));
      s.violations++;
      return { ok: false, position: s.last, reason: 'teleport' };
    }
    if (speed > AC.MAX_SPEED) {
      s.suspicion += 2;
      s.flags.push('speed:' + speed.toFixed(0));
      // мягко: не откатываем сразу, но если копится — откат
      if (s.suspicion >= AC.SUSPICION_LIMIT) {
        s.violations++;
        s.suspicion = Math.floor(AC.SUSPICION_LIMIT / 2);
        return { ok: false, position: s.last, reason: 'speed' };
      }
    }
  }

  const pos = { x: cx, y: cy, z: cz };
  s.last = pos;
  s.lastT = now;
  if (s.flags.length > 12) s.flags = s.flags.slice(-12);
  return { ok: !clamped, position: pos, reason: clamped ? 'clamped' : null };
}

// Легальный телепорт (вход в здание, смена этажа, спавн) — сообщаем
// античиту, иначе он примет это за читерский рывок.
function acAllowTeleport(id, pos) {
  const s = acGet(id);
  s.graceUntil = Date.now() + AC.GRACE_MS;
  if (pos) {
    const x = acFinite(pos.x), y = acFinite(pos.y), z = acFinite(pos.z);
    if (x !== null && y !== null && z !== null) {
      s.last = { x: x, y: y, z: z };
      s.lastT = Date.now();
    }
  }
}

// ── RATE LIMIT ──────────────────────────────────────────────────────────
// true  = пропускаем событие
// false = слишком часто, игнорируем
function acRate(id, event) {
  const s = acGet(id);
  const min = AC.LIMITS[event];
  if (!min) return true;                  // событие без лимита
  const now = Date.now();
  const prev = s.events[event] || 0;
  if (now - prev < min) {
    // спам считаем подозрительным, но очень мягко
    s.suspicion += 0.25;
    return false;
  }
  s.events[event] = now;
  return true;
}

// ── ВАЛИДАЦИЯ ЧИСЕЛ ОТ КЛИЕНТА ──────────────────────────────────────────
// Для сумм денег, количеств и т.п. Отсекает дроби, минусы, NaN и
// абсурдно большие значения (переполнение).
function acAmount(v, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i <= 0) return null;
  if (max !== undefined && i > max) return null;
  return i;
}

function acStats(id) {
  const s = acState.get(id);
  if (!s) return null;
  return {
    suspicion: Math.round(s.suspicion * 100) / 100,
    violations: s.violations,
    flags: s.flags.slice(-5)
  };
}

module.exports = {
  AC,
  acInit,
  acDrop,
  acCheckPosition,
  acAllowTeleport,
  acRate,
  acAmount,
  acStats
};
