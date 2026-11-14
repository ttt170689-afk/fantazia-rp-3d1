/* Shared simulation: browser expeditions and authoritative opt-in PvP.
 * No DOM, renderer, account balance, inventory or ambient world mutation. */
(function (root) {
  "use strict";
  const clamp = (n, a, b) =>
    Math.max(a, Math.min(b, Number.isFinite(n) ? n : 0));
  const maps = [
    {
      id: "depot",
      name: "Депо «Последняя смена»",
      tag: "Рельсы / мастерские / радиорубка",
      color: 0x24343c,
      accent: 0xe3b06b,
      intro:
        "На закрытой ветке снова горит сигнал. Найди три реле и выясни, кто отправляет пустые поезда.",
      outro:
        "На линии не было машиниста. Автоматика повторяла маршрут эвакуации, пока последний пассажир не доберётся домой.",
      blocks: [
        [-20, -16, 12, 8],
        [20, -16, 12, 8],
        [-20, 12, 12, 12],
        [20, 12, 12, 12],
        [-5, -5, 3, 10],
        [7, 5, 3, 10],
        [-4, 24, 7, 4],
        [5, -26, 8, 4],
      ],
      relays: [
        [-20, -9],
        [20, -9],
        [20, 20],
      ],
      notes: [
        [-4, 30],
        [-25, 20],
        [25, 20],
        [0, -30],
      ],
      mobs: [
        [-18, -3, "hound"],
        [18, 2, "listener"],
        [10, -22, "warden"],
      ],
      checkpoints: [
        [32, 32],
        [32, -32],
        [0, -32],
        [-32, -32],
        [-32, 32],
        [0, 32],
      ],
    },
    {
      id: "quarry",
      name: "Карьер «Нулевая отметка»",
      tag: "Вода / насосная / затонувший пост",
      color: 0x263d3d,
      accent: 0x80d7cc,
      intro:
        "Вода поднялась, но насосная всё ещё отвечает на вызовы. Не сходи с сухой дороги в тёмные чаши карьера.",
      outro:
        "Насосы включились. Под водой нашли не секретную лабораторию, а старый приёмник: кто-то каждый вечер проверял, слышен ли берег.",
      blocks: [
        [-18, -16, 12, 16],
        [19, 12, 14, 16],
        [-19, 18, 10, 8],
        [19, -20, 10, 10],
        [-3, 2, 5, 6],
      ],
      relays: [
        [-18, -6],
        [19, -13],
        [-19, 24],
      ],
      notes: [
        [-4, 30],
        [25, -12],
        [-25, 24],
        [0, -29],
      ],
      mobs: [
        [-15, 0, "listener"],
        [18, -5, "hound"],
        [-12, 27, "warden"],
      ],
      checkpoints: [
        [32, 32],
        [32, -32],
        [0, -32],
        [-32, -32],
        [-32, 32],
        [0, 32],
      ],
    },
    {
      id: "observatory",
      name: "Обсерватория «Тихая частота»",
      tag: "Купол / антенны / архив сигналов",
      color: 0x292d43,
      accent: 0xc7b3f4,
      intro:
        "Сигнал из депо привёл к старому куполу. Три антенны смотрят не в небо, а на город. Собери последние записи.",
      outro:
        "Антенны передавали один и тот же ответ: «Лампу оставили». Наблюдатели искали не звёзды. Они помогали тем, кто потерял дорогу.",
      blocks: [
        [-18, -16, 14, 10],
        [19, -16, 12, 10],
        [-20, 15, 10, 14],
        [20, 15, 10, 14],
        [-5, 0, 3, 9],
        [6, 3, 3, 9],
        [0, 25, 8, 5],
      ],
      relays: [
        [-18, -9],
        [19, -9],
        [-20, 24],
      ],
      notes: [
        [-4, 30],
        [25, -9],
        [-26, 24],
        [0, -30],
      ],
      mobs: [
        [-15, 1, "warden"],
        [17, 0, "listener"],
        [-13, 25, "hound"],
      ],
      checkpoints: [
        [32, 32],
        [32, -32],
        [0, -32],
        [-32, -32],
        [-32, 32],
        [0, 32],
      ],
    },
  ];
  const stories = [
    [
      "Ночная заявка",
      "«Оставьте ключи под табличкой. Если поезд придёт пустым, не выключайте платформу». В заявке нет номера состава, только знакомая подпись Лиды из архивной смены.",
    ],
    [
      "Неисправность не найдена",
      "Техник трижды проверял тормоза и двери. Система исправна. Пустые рейсы повторяют маршрут последней эвакуации — словно ждут ещё одного пассажира.",
    ],
    [
      "Голос в мастерской",
      "Сторож записал: «На звук молотка отвечает что-то за стеной. Стою тихо — оно тоже молчит». На полу нарисованы круги: места, где нельзя шуметь.",
    ],
    [
      "Билет без станции",
      "На обороте билета — частота насосной карьера. Рядом фраза: «Не ищите нас в списке пропавших. Мы на другой стороне линии».",
    ],
    [
      "Уровень воды",
      "«Нулевая отметка» оказалась не глубиной. Так называли первый вечер, когда никто не вышел на связь. Каждый следующий уровень отмечали на косяке двери.",
    ],
    [
      "Насос номер два",
      "Механик оставил насос в ручном режиме. Он боялся затопить кабель, по которому ещё приходили ответы из города. Схема переключения лежит у реле.",
    ],
    [
      "Слушатели",
      "Существо не идёт на свет, но приближается, когда слышит двигатель. В дневнике советуют выйти из машины и переждать. Перед броском его венец вспыхивает.",
    ],
    [
      "На северный купол",
      "Вода отступила на сантиметр. Под слоем ила виден жетон обсерватории. На нём выгравировано: «Не путать тишину с отсутствием ответа».",
    ],
    [
      "Архив наблюдений",
      "Вместо координат звёзд здесь записаны окна: лечебный корпус, мастерская, квартира над магазином. Сотрудники отмечали, где по вечерам зажигался свет.",
    ],
    [
      "Три антенны",
      "Первая слушает станции, вторая — берег, третья — дома. Антенны не вызывают катастрофу. Это старая сеть помощи, которую забыли отключить.",
    ],
    [
      "Сторож купола",
      "Тяжёлое существо держится рядом с реле. Его движения повторяются с одинаковым интервалом. Это не охранник с приказом — это эхо последней незаконченной смены.",
    ],
    [
      "Ответ получен",
      "«Если ты читаешь это, сигнал дошёл. Не оставайся здесь ради нас. Вернись в город и оставь свет для следующего». Подпись сделана той же рукой, что и записка в депо.",
    ],
  ];
  const notes = maps.flatMap((m, i) =>
    m.notes.map((p, j) => ({
      id: m.id + "-" + j,
      map: m.id,
      x: p[0],
      z: p[1],
      title: stories[i * 4 + j][0],
      text: stories[i * 4 + j][1],
    })),
  );
  const cars = [
    {
      id: "rally",
      name: "Ралли",
      max: 22,
      accel: 11,
      brake: 20,
      turn: 1.5,
      color: 0xb74737,
    },
    {
      id: "rover",
      name: "Вездеход",
      max: 15,
      accel: 8,
      brake: 17,
      turn: 1.15,
      color: 0x677a55,
    },
    {
      id: "coupe",
      name: "Купе",
      max: 28,
      accel: 13,
      brake: 23,
      turn: 1.65,
      color: 0x507ba6,
    },
  ];
  const monsters = {
    hound: {
      name: "Гончая",
      speed: 3.9,
      hp: 60,
      range: 1.8,
      windup: 0.75,
      damage: 16,
    },
    listener: {
      name: "Слушатель",
      speed: 2.3,
      hp: 80,
      range: 2.3,
      windup: 1.05,
      damage: 22,
    },
    warden: {
      name: "Сторож",
      speed: 1.65,
      hp: 120,
      range: 2.8,
      windup: 1.4,
      damage: 30,
    },
  };
  const map = (id) => maps.find((m) => m.id === id),
    car = (id) => cars.find((c) => c.id === id);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  function blocked(m, x, z, r = 0.45) {
    return (
      !m ||
      !Number.isFinite(x) ||
      !Number.isFinite(z) ||
      Math.abs(x) > 39 - r ||
      Math.abs(z) > 39 - r ||
      m.blocks.some(
        ([bx, bz, w, d]) =>
          Math.abs(x - bx) < w / 2 + r && Math.abs(z - bz) < d / 2 + r,
      )
    );
  }
  function move(m, p, dx, dz, r = 0.45) {
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.18));
    if (n > 200 || !Number.isFinite(n)) return false;
    let hit = false;
    for (let i = 0; i < n; i++) {
      if (!blocked(m, p.x + dx / n, p.z, r)) p.x += dx / n;
      else hit = true;
      if (!blocked(m, p.x, p.z + dz / n, r)) p.z += dz / n;
      else hit = true;
    }
    return hit;
  }
  function clear(m, a, b) {
    const n = Math.ceil(dist(a, b) / 0.25);
    if (!Number.isFinite(n) || n > 1000) return false;
    for (let i = 1; i < n; i++)
      if (
        blocked(
          m,
          a.x + ((b.x - a.x) * i) / n,
          a.z + ((b.z - a.z) * i) / n,
          0.08,
        )
      )
        return false;
    return true;
  }
  function input(raw) {
    return {
      forward: clamp(raw?.forward, -1, 1),
      side: clamp(raw?.side, -1, 1),
      yaw: Number.isFinite(raw?.yaw)
        ? Math.atan2(Math.sin(raw.yaw), Math.cos(raw.yaw))
        : 0,
    };
  }
  function walk(m, p, raw, dt, speed = 5) {
    const i = input(raw),
      d = clamp(dt, 0, 0.1),
      n = Math.max(1, Math.hypot(i.forward, i.side));
    p.yaw = i.yaw;
    move(
      m,
      p,
      ((Math.sin(i.yaw) * i.forward - Math.cos(i.yaw) * i.side) / n) *
        speed *
        d,
      ((Math.cos(i.yaw) * i.forward + Math.sin(i.yaw) * i.side) / n) *
        speed *
        d,
    );
  }
  function drive(m, p, raw, dt, type) {
    const c = car(type) || cars[0],
      d = clamp(dt, 0, 0.1),
      throttle = clamp(raw?.forward, -1, 1),
      steer = clamp(raw?.side, -1, 1);
    p.speed = Number.isFinite(p.speed) ? p.speed : 0;
    p.yaw = Number.isFinite(p.yaw) ? p.yaw : 0;
    if (throttle === 0) p.speed *= Math.exp(-1.3 * d);
    else
      p.speed +=
        throttle *
        (Math.sign(throttle) !== Math.sign(p.speed) && Math.abs(p.speed) > 1
          ? c.brake
          : c.accel) *
        d;
    p.speed = clamp(p.speed, -c.max * 0.35, c.max);
    p.yaw -=
      steer *
      c.turn *
      d *
      Math.min(1, Math.abs(p.speed) / 5) *
      Math.sign(p.speed);
    const hit = move(
      m,
      p,
      Math.sin(p.yaw) * p.speed * d,
      Math.cos(p.yaw) * p.speed * d,
      2.25,
    );
    if (hit) p.speed *= -0.15;
    return hit;
  }
  function exitPoint(m, p) {
    for (const side of [-1, 1]) {
      const q = {
        x: p.x + Math.cos(p.yaw) * side * 2.2,
        z: p.z - Math.sin(p.yaw) * side * 2.2,
        yaw: p.yaw,
      };
      if (!blocked(m, q.x, q.z)) return q;
    }
    return null;
  }
  function rayHit(m, from, targets, range = 32) {
    const fx = Math.sin(from.yaw),
      fz = Math.cos(from.yaw);
    let best = null,
      nearest = range;
    for (const t of targets) {
      if (t.hp <= 0) continue;
      const dx = t.x - from.x,
        dz = t.z - from.z,
        along = dx * fx + dz * fz,
        across = Math.abs(dx * fz - dz * fx);
      if (along > 0.2 && along < nearest && across < 0.7 && clear(m, from, t)) {
        nearest = along;
        best = t;
      }
    }
    return best;
  }
  function createMission(id) {
    const m = map(id);
    if (!m) return null;
    return {
      map: id,
      hp: 100,
      time: 0,
      relays: [],
      notes: [],
      done: false,
      failed: false,
      cooldown: 0,
      shot: 0,
      mobs: m.mobs.map(([x, z, type], i) => ({
        id: i,
        type,
        x,
        z,
        homeX: x,
        homeZ: z,
        hp: monsters[type].hp,
        state: "patrol",
        timer: 0,
        yaw: 0,
        phase: i * 1.8,
      })),
    };
  }
  function missionStep(s, p, dt, noise = false) {
    const d = clamp(dt, 0, 0.1),
      m = map(s.map);
    if (s.done || s.failed) return;
    s.time += d;
    s.cooldown = Math.max(0, s.cooldown - d);
    for (const e of s.mobs) {
      if (e.hp <= 0) {
        e.state = "down";
        continue;
      }
      const kind = monsters[e.type];
      e.timer = Math.max(0, e.timer - d);
      if (e.state === "stunned") {
        if (e.timer === 0) e.state = "chase";
        continue;
      }
      if (e.state === "windup") {
        if (e.timer === 0) {
          if (dist(e, p) < kind.range + 0.5 && clear(m, e, p))
            s.hp = Math.max(0, s.hp - kind.damage);
          e.state = "recover";
          e.timer = 1.5;
        }
        continue;
      }
      if (e.state === "recover") {
        if (e.timer === 0) e.state = "patrol";
        continue;
      }
      const sees = dist(e, p) < (noise ? 24 : 14) && clear(m, e, p),
        target = sees
          ? p
          : {
              x: e.homeX + Math.sin(s.time * 0.25 + e.phase) * 2,
              z: e.homeZ + Math.cos(s.time * 0.25 + e.phase) * 2,
            };
      e.state = sees ? "chase" : "patrol";
      const dx = target.x - e.x,
        dz = target.z - e.z,
        length = Math.hypot(dx, dz);
      e.yaw = Math.atan2(dx, dz);
      if (sees && length < kind.range) {
        e.state = "windup";
        e.timer = kind.windup;
      } else if (length > 0.15)
        move(
          m,
          e,
          (dx / length) * kind.speed * d * (sees ? 1 : 0.35),
          (dz / length) * kind.speed * d * (sees ? 1 : 0.35),
          0.55,
        );
    }
    if (s.hp === 0) s.failed = true;
  }
  function pulse(s, p) {
    if (s.done || s.failed || s.cooldown > 0) return false;
    s.cooldown = 0.42;
    s.shot++;
    const e = rayHit(map(s.map), p, s.mobs);
    if (e) {
      e.hp = Math.max(0, e.hp - 25);
      e.state = e.hp ? "stunned" : "down";
      e.timer = 0.7;
    }
    return true;
  }
  function interact(s, p) {
    if (s.failed || s.done) return null;
    const m = map(s.map);
    for (const n of notes.filter((n) => n.map === s.map)) {
      if (!s.notes.includes(n.id) && dist(n, p) < 2.5 && clear(m, p, n)) {
        s.notes.push(n.id);
        return { type: "note", id: n.id };
      }
    }
    for (let i = 0; i < m.relays.length; i++) {
      const [x, z] = m.relays[i];
      if (
        !s.relays.includes(i) &&
        dist(p, { x, z }) < 2.8 &&
        clear(m, p, { x, z })
      ) {
        s.relays.push(i);
        return { type: "relay", id: i };
      }
    }
    if (dist(p, { x: 0, z: 32 }) < 3) {
      if (s.relays.length === 3) {
        s.done = true;
        return { type: "complete" };
      }
      return { type: "locked" };
    }
    return null;
  }
  function clean(raw) {
    return {
      notes: [
        ...new Set(
          Array.isArray(raw?.notes)
            ? raw.notes.filter((id) => notes.some((n) => n.id === id))
            : [],
        ),
      ],
      completed: maps
        .filter(
          (m) => Array.isArray(raw?.completed) && raw.completed.includes(m.id),
        )
        .map((m) => m.id),
      best: Object.fromEntries(
        maps
          .filter(
            (m) =>
              Number.isFinite(raw?.best?.[m.id]) &&
              raw.best[m.id] > 5 &&
              raw.best[m.id] < 3600,
          )
          .map((m) => [m.id, raw.best[m.id]]),
      ),
    };
  }
  const api = {
    maps,
    notes,
    cars,
    monsters,
    map,
    car,
    dist,
    clamp,
    blocked,
    move,
    clear,
    input,
    walk,
    drive,
    exitPoint,
    rayHit,
    createMission,
    missionStep,
    pulse,
    interact,
    clean,
  };
  root.FZExpedition52Policy = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
