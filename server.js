const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// ======================================================
// FANTAZIA RP 3D SERVER
// ======================================================

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ======================================================
// EXPRESS
// ======================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Проверка сервера
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    name: 'Fantazia RP 3D',
    online: Object.keys(players).length,
    uptime: process.uptime()
  });
});

app.get('/api/players', (req, res) => {
  const list = Object.values(players).map(p => ({
    id: p.id,
    name: p.name,
    job: p.job,
    level: p.level,
    money: p.money,
    health: p.health,
    joinedAt: p.joinedAt
  }));
  res.json({ ok: true, players: list, online: list.length });
});

// ======================================================
// ADMIN API
// ======================================================

const ADMIN_PASSWORD = 'fnfpoppy567765';
const ADMIN_EMAIL    = 'ttt170689@gmail.com';

function checkAdmin(req, res) {
  const pwd = req.body?.adminPassword || req.query?.adminPassword;
  if (pwd !== ADMIN_PASSWORD) {
    res.status(403).json({ error: 'Неверный пароль администратора' });
    return false;
  }
  return true;
}

// Получить список банов
app.get('/api/admin/bans', (req, res) => {
  if (!checkAdmin(req, res)) return;
  res.json({ ok: true, bans: Object.values(bans) });
});

// Забанить игрока
app.post('/api/admin/ban', (req, res) => {
  if (!checkAdmin(req, res)) return;

  const { playerName, reason, durationHours, adminName } = req.body;
  if (!playerName) return res.status(400).json({ error: 'Не указано имя игрока' });

  // Найти игрока онлайн и кикнуть его
  const target = Object.values(players).find(
    p => p.name.toLowerCase() === playerName.toLowerCase()
  );

  const hours = Number(durationHours) || 0;
  const expiresAt = hours > 0 ? Date.now() + hours * 3600000 : null;

  bans[playerName.toLowerCase()] = {
    playerName,
    reason: reason || 'Нарушение правил',
    durationHours: hours,
    bannedAt: new Date().toISOString(),
    bannedBy: adminName || 'Admin',
    expiresAt
  };

  if (target) {
    notify(target.id, `🔨 Вы забанены. Причина: ${reason || 'Нарушение правил'}`, 'error');
    setTimeout(() => {
      io.to(target.id).emit('forceDisconnect', { reason: `Бан: ${reason || 'Нарушение правил'}` });
      io.sockets.sockets.get(target.id)?.disconnect(true);
    }, 2000);
    console.log(`[BAN] ${playerName} забанен администратором ${adminName}`);
  }

  res.json({ ok: true, message: `${playerName} забанен${target ? ' и кикнут' : ''}` });
});

// Разбанить игрока
app.post('/api/admin/unban', (req, res) => {
  if (!checkAdmin(req, res)) return;

  const { playerName } = req.body;
  if (!playerName) return res.status(400).json({ error: 'Не указано имя игрока' });

  const key = playerName.toLowerCase();
  if (!bans[key]) {
    return res.status(404).json({ error: 'Игрок не найден в списке банов' });
  }

  delete bans[key];
  console.log(`[UNBAN] ${playerName} разбанен`);
  res.json({ ok: true, message: `${playerName} разбанен` });
});

// Кикнуть игрока
app.post('/api/admin/kick', (req, res) => {
  if (!checkAdmin(req, res)) return;

  const { playerName, reason, adminName } = req.body;
  if (!playerName) return res.status(400).json({ error: 'Не указано имя игрока' });

  const target = Object.values(players).find(
    p => p.name.toLowerCase() === playerName.toLowerCase()
  );

  if (!target) {
    return res.status(404).json({ error: 'Игрок не в сети' });
  }

  notify(target.id, `👟 Вы кикнуты. Причина: ${reason || 'Без причины'}`, 'error');
  setTimeout(() => {
    io.to(target.id).emit('forceDisconnect', { reason: `Кик: ${reason || 'Без причины'}` });
    io.sockets.sockets.get(target.id)?.disconnect(true);
  }, 2000);

  console.log(`[KICK] ${playerName} кикнут администратором ${adminName}`);
  res.json({ ok: true, message: `${playerName} кикнут` });
});

// ── Дать / забрать деньги ─────────────────────────────
app.post('/api/admin/givemoney', (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { playerName, amount } = req.body;
  if (!playerName) return res.status(400).json({ error: 'Не указан игрок' });
  const amt = Number(amount) || 0;
  if (playerName.toLowerCase() === 'all') {
    Object.values(players).forEach(p => {
      p.money = Math.max(0, p.money + amt);
      updateMoney(p.id);
      notify(p.id, `💰 ${amt >= 0 ? '+' : ''}${amt}$ (от Admin)`, 'money');
    });
    return res.json({ ok: true, message: `Все игроки: ${amt >= 0 ? '+' : ''}${amt}$` });
  }
  const target = Object.values(players).find(p => p.name.toLowerCase() === playerName.toLowerCase());
  if (!target) return res.status(404).json({ error: 'Игрок не в сети' });
  target.money = Math.max(0, target.money + amt);
  updateMoney(target.id);
  notify(target.id, `💰 ${amt >= 0 ? '+' : ''}${amt}$ (от Admin)`, 'money');
  res.json({ ok: true, message: `${playerName}: ${amt >= 0 ? '+' : ''}${amt}$ → теперь ${target.money}$` });
});

app.post('/api/admin/setmoney', (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { playerName, amount } = req.body;
  if (!playerName) return res.status(400).json({ error: 'Не указан игрок' });
  const target = Object.values(players).find(p => p.name.toLowerCase() === playerName.toLowerCase());
  if (!target) return res.status(404).json({ error: 'Игрок не в сети' });
  target.money = Math.max(0, Number(amount) || 0);
  updateMoney(target.id);
  notify(target.id, `💰 Баланс установлен: ${target.money}$ (Admin)`, 'money');
  res.json({ ok: true, message: `${playerName} → ${target.money}$` });
});

app.post('/api/admin/broadcast', (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { title, description, eventType } = req.body;
  if (!title) return res.status(400).json({ error: 'Не указан заголовок' });
  const ev = { title, description: description || '', type: eventType || 'info', createdAt: new Date().toISOString() };
  io.emit('worldEvent', ev);
  broadcastSystemMessage(`[СОБЫТИЕ] ${title}`);
  worldEvents.push(ev);
  if (worldEvents.length > 100) worldEvents.shift();
  res.json({ ok: true, message: 'Событие отправлено всем' });
});

app.get('/api/admin/worldevents', (req, res) => {
  if (!checkAdmin(req, res)) return;
  res.json({ ok: true, events: worldEvents.slice(-50) });
});

app.post('/api/admin/setworld', (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { weather, time } = req.body;
  if (weather) worldState.weather = weather;
  if (time)    worldState.time    = time;
  io.emit('worldUpdate', worldState);
  res.json({ ok: true, message: `Мир: погода=${worldState.weather}, время=${worldState.time}` });
});

app.get('/api/admin/npcs', (req, res) => {
  if (!checkAdmin(req, res)) return;
  res.json({ ok: true, npcs: Object.values(npcs) });
});

app.post('/api/admin/spawnNPC', (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { name, x, z, npcType } = req.body;
  const npc = { id: generateId(), name: sanitizeText(name) || 'NPC', x: Number(x) || 0, z: Number(z) || 0, type: npcType || 'citizen', createdAt: new Date().toISOString() };
  npcs[npc.id] = npc;
  io.emit('spawnNPC', npc);
  res.json({ ok: true, message: `NPC "${npc.name}" создан`, npc });
});

app.post('/api/admin/removeNPC', (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { npcId } = req.body;
  if (!npcs[npcId]) return res.status(404).json({ error: 'NPC не найден' });
  delete npcs[npcId];
  io.emit('removeNPC', { id: npcId });
  res.json({ ok: true, message: 'NPC удалён' });
});

app.get('/api/admin/portals', (req, res) => {
  if (!checkAdmin(req, res)) return;
  res.json({ ok: true, portals: Object.values(portals) });
});

app.post('/api/admin/addPortal', (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { name, fromX, fromZ, toX, toZ } = req.body;
  const portal = { id: generateId(), name: sanitizeText(name) || 'Портал', fromX: Number(fromX) || 0, fromZ: Number(fromZ) || 0, toX: Number(toX) || 0, toZ: Number(toZ) || 0, createdAt: new Date().toISOString() };
  portals[portal.id] = portal;
  io.emit('addPortal', portal);
  res.json({ ok: true, message: `Портал "${portal.name}" создан`, portal });
});

app.post('/api/admin/removePortal', (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { portalId } = req.body;
  if (!portals[portalId]) return res.status(404).json({ error: 'Портал не найден' });
  delete portals[portalId];
  io.emit('removePortal', { id: portalId });
  res.json({ ok: true, message: 'Портал удалён' });
});

app.post('/api/admin/teleport', (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { playerName, x, z } = req.body;
  if (!playerName) return res.status(400).json({ error: 'Не указан игрок' });
  const target = Object.values(players).find(p => p.name.toLowerCase() === playerName.toLowerCase());
  if (!target) return res.status(404).json({ error: 'Игрок не в сети' });
  io.to(target.id).emit('adminTeleport', { x: Number(x) || 0, z: Number(z) || 0 });
  res.json({ ok: true, message: `${playerName} телепортирован` });
});

// Отправить сообщение игроку
app.post('/api/admin/message', (req, res) => {
  if (!checkAdmin(req, res)) return;

  const { playerName, message, adminName } = req.body;
  if (!playerName || !message) return res.status(400).json({ error: 'Не указан игрок или сообщение' });

  const target = Object.values(players).find(
    p => p.name.toLowerCase() === playerName.toLowerCase()
  );

  if (!target) {
    return res.status(404).json({ error: 'Игрок не в сети' });
  }

  const msg = {
    id: generateId(),
    sender: `[ADMIN] ${adminName || 'Admin'}`,
    text: message,
    type: 'admin',
    time: Date.now()
  };

  io.to(target.id).emit('chatMessage', msg);
  notify(target.id, `📢 Сообщение от администратора: ${message}`, 'info');

  console.log(`[MSG] Сообщение для ${playerName} от ${adminName}: ${message}`);
  res.json({ ok: true, message: 'Сообщение отправлено' });
});

// ======================================================
// ДАННЫЕ
// ======================================================

const players = {};
const bans = {};
const friendships = {};
const npcs = {};
const portals = {};
const worldEvents = [];
const chatHistory = [];
const MAX_CHAT_HISTORY = 100;

const worldState = {
  weather: 'sunny',
  time: 'day'
};

const jobDefinitions = {
  taxi: { title: 'Таксист', salary: 100, color: '#f1c40f' },
  police: { title: 'Полицейский', salary: 150, color: '#3498db' },
  doctor: { title: 'Доктор', salary: 170, color: '#e74c3c' },
  mechanic: { title: 'Механик', salary: 130, color: '#7f8c8d' },
  seller: { title: 'Продавец', salary: 90, color: '#2ecc71' },
  dj: { title: 'DJ', salary: 120, color: '#9b59b6' },
  trainer: { title: 'Тренер', salary: 110, color: '#e67e22' }
};

const shopItems = {
  clothing: [
    { id: 'shirt_red', name: 'Красная футболка', price: 50, type: 'shirt', color: '#ff0000' },
    { id: 'shirt_blue', name: 'Синяя футболка', price: 50, type: 'shirt', color: '#3498db' },
    { id: 'pants_black', name: 'Чёрные штаны', price: 60, type: 'pants', color: '#111111' },
    { id: 'pants_white', name: 'Белые штаны', price: 60, type: 'pants', color: '#eeeeee' },
    { id: 'hat_gold', name: 'Золотая шляпа', price: 120, type: 'hat', color: '#f1c40f' }
  ],
  food: [
    { id: 'pizza', name: 'Пицца', price: 15, heal: 20 },
    { id: 'burger', name: 'Бургер', price: 12, heal: 15 },
    { id: 'cola', name: 'Кола', price: 8, heal: 5 },
    { id: 'steak', name: 'Стейк', price: 25, heal: 35 }
  ],
  petfood: [
    { id: 'dog_food', name: 'Корм для собак', price: 8, petHeal: 25 },
    { id: 'cat_food', name: 'Корм для кошек', price: 8, petHeal: 25 },
    { id: 'bird_food', name: 'Корм для птиц', price: 6, petHeal: 20 },
    { id: 'premium_pet_food', name: 'Премиум корм', price: 16, petHeal: 45 }
  ]
};

const petTypes = [
  { type: 'dog', name: 'Собака', price: 200, color: '#8b5a2b' },
  { type: 'cat', name: 'Кошка', price: 180, color: '#d35400' },
  { type: 'parrot', name: 'Попугай', price: 250, color: '#2ecc71' },
  { type: 'rabbit', name: 'Кролик', price: 160, color: '#ffffff' },
  { type: 'hamster', name: 'Хомяк', price: 120, color: '#f5cba7' }
];

const apartments = {};
for (let i = 1; i <= 30; i++) {
  apartments[`apt_${i}`] = {
    id: `apt_${i}`,
    number: i,
    floor: Math.ceil(i / 5),
    price: 600 + Math.floor(i / 5) * 200,
    owner: null,
    locked: true,
    furniture: []
  };
}

// ======================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ======================================================

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  const dx = (a.x || 0) - (b.x || 0);
  const dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt(dx * dx + dz * dz);
}

function sanitizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text.trim().replace(/\s+/g, ' ').slice(0, 200);
}

function createSystemMessage(text) {
  return {
    id: generateId(),
    sender: 'СИСТЕМА',
    text,
    type: 'system',
    time: Date.now()
  };
}

function pushChatMessage(msg) {
  chatHistory.push(msg);
  if (chatHistory.length > MAX_CHAT_HISTORY) {
    chatHistory.shift();
  }
}

function broadcastSystemMessage(text) {
  const msg = createSystemMessage(text);
  pushChatMessage(msg);
  io.emit('chatMessage', msg);
}

function getSafePlayerData(player) {
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    rotation: player.rotation,
    appearance: player.appearance,
    job: player.job,
    dance: player.dance,
    animation: player.animation,
    money: player.money,
    level: player.level,
    exp: player.exp,
    health: player.health,
    maxHealth: player.maxHealth,
    apartment: player.apartment,
    pet: player.pet ? {
      type: player.pet.type,
      name: player.pet.name,
      customName: player.pet.customName,
      color: player.pet.color,
      hunger: player.pet.hunger,
      happiness: player.pet.happiness,
      level: player.pet.level
    } : null,
    isTalking: !!player.isTalking
  };
}

function sendPlayerLists() {
  const list = Object.values(players).map(getSafePlayerData);
  io.emit('playerList', list);
}

function notify(socketId, text, type = 'info') {
  io.to(socketId).emit('notification', { text, type });
}

function updateMoney(socketId) {
  if (!players[socketId]) return;
  io.to(socketId).emit('moneyUpdate', players[socketId].money);
}

function updateStats(socketId) {
  if (!players[socketId]) return;
  const p = players[socketId];
  io.to(socketId).emit('statsUpdate', {
    level: p.level,
    exp: p.exp,
    health: p.health,
    maxHealth: p.maxHealth
  });
}

function updateInventory(socketId) {
  if (!players[socketId]) return;
  io.to(socketId).emit('inventoryUpdate', players[socketId].inventory);
}

function updatePet(socketId) {
  if (!players[socketId]) return;
  io.to(socketId).emit('petUpdate', players[socketId].pet);
}

function updateApartment(socketId) {
  if (!players[socketId]) return;
  const aptId = players[socketId].apartment;
  io.to(socketId).emit('apartmentUpdate', {
    apartment: aptId,
    info: aptId ? apartments[aptId] : null
  });
}

function updateFriends(socketId) {
  const friendIds = friendships[socketId] || [];
  const mapped = friendIds.map(fid => ({
    id: fid,
    name: players[fid]?.name || 'Unknown',
    online: !!players[fid]
  }));
  io.to(socketId).emit('friendsUpdate', mapped);
}

function addExp(socketId, amount) {
  const player = players[socketId];
  if (!player) return;

  player.exp += amount;

  const need = player.level * 100;
  if (player.exp >= need) {
    player.exp -= need;
    player.level += 1;
    player.maxHealth += 10;
    player.health = player.maxHealth;
    notify(socketId, `🎉 Новый уровень: ${player.level}!`, 'levelup');
  }

  updateStats(socketId);
}

// ======================================================
// ТАЙМЕРЫ
// ======================================================

// Зарплата каждые 60 секунд
setInterval(() => {
  Object.values(players).forEach(player => {
    if (!player.job) return;
    const job = jobDefinitions[player.job];
    if (!job) return;

    player.money += job.salary;
    updateMoney(player.id);
    notify(player.id, `💰 Зарплата: +${job.salary}$`, 'money');
  });
}, 60000);

// Голод питомцев каждые 30 секунд
setInterval(() => {
  Object.values(players).forEach(player => {
    if (!player.pet) return;

    player.pet.hunger = clamp(player.pet.hunger - 5, 0, 100);

    if (player.pet.hunger <= 20) {
      player.pet.happiness = clamp(player.pet.happiness - 8, 0, 100);
    } else {
      player.pet.happiness = clamp(player.pet.happiness - 2, 0, 100);
    }

    updatePet(player.id);
  });
}, 30000);

// Смена времени мира
setInterval(() => {
  worldState.time = worldState.time === 'day' ? 'night' : 'day';
  io.emit('worldUpdate', worldState);
}, 300000);

// Смена погоды
setInterval(() => {
  const weathers = ['sunny', 'cloudy', 'rainy'];
  worldState.weather = weathers[Math.floor(Math.random() * weathers.length)];
  io.emit('worldUpdate', worldState);
}, 420000);

// Очистка истёкших банов каждые 10 минут
setInterval(() => {
  const now = Date.now();
  Object.keys(bans).forEach(key => {
    const ban = bans[key];
    if (ban.expiresAt && ban.expiresAt <= now) {
      delete bans[key];
      console.log(`[BAN] Бан игрока ${ban.playerName} истёк — автоматически снят`);
    }
  });
}, 600000);

// ======================================================
// SOCKET.IO
// ======================================================

io.on('connection', (socket) => {
  console.log(`[+] CONNECT: ${socket.id}`);

  // ----------------------------------------------------
  // Регистрация игрока
  // ----------------------------------------------------
  socket.on('registerPlayer', (data = {}) => {
    try {
      const playerName = sanitizeText(data.name) || `Player_${socket.id.slice(0, 4)}`;

      // ── Проверка бана ──────────────────────────────
      const banRecord = bans[playerName.toLowerCase()];
      if (banRecord) {
        const expired = banRecord.expiresAt && banRecord.expiresAt <= Date.now();
        if (expired) {
          delete bans[playerName.toLowerCase()];
        } else {
          const until = banRecord.expiresAt
            ? `до ${new Date(banRecord.expiresAt).toLocaleString('ru-RU')}`
            : 'навсегда';
          socket.emit('banned', {
            reason: banRecord.reason,
            until,
            bannedBy: banRecord.bannedBy
          });
          socket.disconnect(true);
          console.log(`[BAN] ${playerName} попытался зайти — заблокирован`);
          return;
        }
      }
      // ───────────────────────────────────────────────

      const player = {
        id: socket.id,
        socketId: socket.id,
        name: playerName,
        position: { x: 0, y: 0, z: 0 },
        rotation: { y: 0 },
        appearance: {
          skinColor: data.skinColor || '#FFD1A4',
          shirtColor: data.shirtColor || '#3498DB',
          pantsColor: data.pantsColor || '#2C3E50',
          hairColor: data.hairColor || '#4A2F1B',
          hairStyle: Number.isInteger(data.hairStyle) ? data.hairStyle : 0
        },
        job: null,
        dance: null,
        animation: 'idle',
        isTalking: false,
        money: 1000,
        level: 1,
        exp: 0,
        health: 100,
        maxHealth: 100,
        apartment: null,
        pet: null,
        inventory: [],
        online: true,
        joinedAt: Date.now(),
        isAdmin: (data.email || '') === ADMIN_EMAIL,
        email: data.email || ''
      };

      players[socket.id] = player;
      if (!friendships[socket.id]) friendships[socket.id] = [];

      socket.emit('registered', {
        player,
        shopItems,
        jobDefinitions,
        petTypes,
        apartments,
        worldState,
        chatHistory: chatHistory.slice(-50),
        isAdmin: player.isAdmin,
        npcs: Object.values(npcs),
        portals: Object.values(portals)
      });

      broadcastSystemMessage(`${player.name} присоединился к игре!`);
      sendPlayerLists();
      updateMoney(socket.id);
      updateStats(socket.id);
      updateFriends(socket.id);

    } catch (err) {
      console.error('registerPlayer error:', err);
      notify(socket.id, 'Ошибка регистрации игрока', 'error');
    }
  });

  // ----------------------------------------------------
  // Позиция игрока
  // ----------------------------------------------------
  socket.on('updatePosition', (data = {}) => {
    const player = players[socket.id];
    if (!player) return;

    const pos = data.position || {};
    const rot = data.rotation || {};

    player.position = {
      x: Number(pos.x) || 0,
      y: Number(pos.y) || 0,
      z: Number(pos.z) || 0
    };

    player.rotation = {
      y: Number(rot.y) || 0
    };

    player.animation = data.animation || 'idle';

    socket.broadcast.emit('playerMoved', {
      id: socket.id,
      position: player.position,
      rotation: player.rotation,
      animation: player.animation
    });
  });

  // ----------------------------------------------------
  // ЧАТ
  // ----------------------------------------------------
  socket.on('sendChat', (data = {}) => {
    const player = players[socket.id];
    if (!player) return;

    const text = sanitizeText(data.text);
    if (!text) return;

    const msg = {
      id: generateId(),
      sender: player.name,
      senderId: player.id,
      text,
      type: data.type || 'global',
      time: Date.now()
    };

    if (msg.type === 'local') {
      Object.values(players).forEach(target => {
        if (distance(player.position, target.position) <= 30) {
          io.to(target.id).emit('chatMessage', msg);
        }
      });
    } else if (msg.type === 'private' && data.targetId && players[data.targetId]) {
      msg.targetId = data.targetId;
      msg.targetName = players[data.targetId].name;
      io.to(socket.id).emit('chatMessage', msg);
      io.to(data.targetId).emit('chatMessage', msg);
    } else {
      msg.type = 'global';
      io.emit('chatMessage', msg);
    }

    pushChatMessage(msg);
  });

  // ----------------------------------------------------
  // ТАНЦЫ / АНИМАЦИИ
  // ----------------------------------------------------
  socket.on('startDance', (danceType) => {
    const player = players[socket.id];
    if (!player) return;

    player.dance = danceType || 'dance';
    player.animation = 'dance';

    io.emit('playerDance', {
      id: socket.id,
      dance: player.dance
    });
  });

  socket.on('stopDance', () => {
    const player = players[socket.id];
    if (!player) return;

    player.dance = null;
    player.animation = 'idle';

    io.emit('playerDance', {
      id: socket.id,
      dance: null
    });
  });

  // ----------------------------------------------------
  // РАБОТЫ
  // ----------------------------------------------------
  socket.on('getJob', (jobId) => {
    const player = players[socket.id];
    if (!player) return;

    if (!jobDefinitions[jobId]) {
      notify(socket.id, 'Работа не найдена', 'error');
      return;
    }

    player.job = jobId;

    socket.emit('jobUpdate', {
      job: jobId,
      info: jobDefinitions[jobId]
    });

    notify(socket.id, `Вы устроились на работу: ${jobDefinitions[jobId].title}`, 'success');
    sendPlayerLists();
  });

  socket.on('quitJob', () => {
    const player = players[socket.id];
    if (!player) return;

    if (!player.job) {
      notify(socket.id, 'У вас нет работы', 'error');
      return;
    }

    const oldJob = player.job;
    player.job = null;

    socket.emit('jobUpdate', { job: null });
    notify(socket.id, `Вы уволились с работы: ${jobDefinitions[oldJob].title}`, 'info');
    sendPlayerLists();
  });

  // ----------------------------------------------------
  // МАГАЗИН / ИНВЕНТАРЬ
  // ----------------------------------------------------
  socket.on('buyItem', (data = {}) => {
    const player = players[socket.id];
    if (!player) return;

    const shopType = data.shopType;
    const itemId = data.itemId;

    if (!shopItems[shopType]) {
      notify(socket.id, 'Магазин не найден', 'error');
      return;
    }

    const item = shopItems[shopType].find(i => i.id === itemId);
    if (!item) {
      notify(socket.id, 'Товар не найден', 'error');
      return;
    }

    if (player.money < item.price) {
      notify(socket.id, 'Недостаточно денег', 'error');
      return;
    }

    player.money -= item.price;
    player.inventory.push({
      ...item,
      uid: generateId()
    });

    updateMoney(socket.id);
    updateInventory(socket.id);
    notify(socket.id, `Куплено: ${item.name}`, 'success');
  });

  socket.on('useItem', (uid) => {
    const player = players[socket.id];
    if (!player) return;

    const index = player.inventory.findIndex(i => i.uid === uid);
    if (index === -1) {
      notify(socket.id, 'Предмет не найден', 'error');
      return;
    }

    const item = player.inventory[index];

    if (item.heal) {
      player.health = clamp(player.health + item.heal, 0, player.maxHealth);
      player.inventory.splice(index, 1);
      updateStats(socket.id);
      updateInventory(socket.id);
      socket.emit('healthUpdate', player.health);
      notify(socket.id, `Здоровье восстановлено на ${item.heal}`, 'success');
      return;
    }

    if (item.type === 'shirt') {
      player.appearance.shirtColor = item.color;
      socket.emit('appearanceUpdate', player.appearance);
      notify(socket.id, `Надето: ${item.name}`, 'success');
      sendPlayerLists();
      return;
    }

    if (item.type === 'pants') {
      player.appearance.pantsColor = item.color;
      socket.emit('appearanceUpdate', player.appearance);
      notify(socket.id, `Надето: ${item.name}`, 'success');
      sendPlayerLists();
      return;
    }

    if (item.type === 'hat') {
      socket.emit('appearanceUpdate', player.appearance);
      notify(socket.id, `Вы использовали: ${item.name}`, 'success');
      return;
    }

    notify(socket.id, 'Этот предмет пока нельзя использовать', 'info');
  });

  // ----------------------------------------------------
  // ПИТОМЦЫ
  // ----------------------------------------------------
  socket.on('adoptPet', (petType) => {
    const player = players[socket.id];
    if (!player) return;

    const pet = petTypes.find(p => p.type === petType);
    if (!pet) {
      notify(socket.id, 'Питомец не найден', 'error');
      return;
    }

    if (player.pet) {
      notify(socket.id, 'У вас уже есть питомец', 'error');
      return;
    }

    if (player.money < pet.price) {
      notify(socket.id, 'Недостаточно денег', 'error');
      return;
    }

    player.money -= pet.price;
    player.pet = {
      type: pet.type,
      name: pet.name,
      customName: pet.name,
      color: pet.color,
      hunger: 100,
      happiness: 100,
      level: 1
    };

    updateMoney(socket.id);
    updatePet(socket.id);
    notify(socket.id, `Вы завели питомца: ${pet.name}`, 'success');
    sendPlayerLists();
  });

  socket.on('feedPet', (foodId) => {
    const player = players[socket.id];
    if (!player || !player.pet) return;

    const invIndex = player.inventory.findIndex(i => i.id === foodId);
    if (invIndex === -1) {
      notify(socket.id, 'У вас нет такого корма', 'error');
      return;
    }

    const item = player.inventory[invIndex];
    if (!item.petHeal) {
      notify(socket.id, 'Это не корм для питомца', 'error');
      return;
    }

    player.pet.hunger = clamp(player.pet.hunger + item.petHeal, 0, 100);
    player.pet.happiness = clamp(player.pet.happiness + 10, 0, 100);

    player.inventory.splice(invIndex, 1);

    updatePet(socket.id);
    updateInventory(socket.id);
    notify(socket.id, `${player.pet.customName} покормлен`, 'success');
  });

  socket.on('renamePet', (newName) => {
    const player = players[socket.id];
    if (!player || !player.pet) return;

    const safeName = sanitizeText(newName).slice(0, 20);
    if (!safeName) {
      notify(socket.id, 'Имя питомца пустое', 'error');
      return;
    }

    player.pet.customName = safeName;
    updatePet(socket.id);
    notify(socket.id, `Питомец теперь зовётся: ${safeName}`, 'success');
  });

  // ----------------------------------------------------
  // КВАРТИРЫ
  // ----------------------------------------------------
  socket.on('buyApartment', (aptId) => {
    const player = players[socket.id];
    if (!player) return;

    const apt = apartments[aptId];
    if (!apt) {
      notify(socket.id, 'Квартира не найдена', 'error');
      return;
    }

    if (player.apartment) {
      notify(socket.id, 'У вас уже есть квартира', 'error');
      return;
    }

    if (apt.owner) {
      notify(socket.id, 'Квартира уже занята', 'error');
      return;
    }

    if (player.money < apt.price) {
      notify(socket.id, 'Недостаточно денег', 'error');
      return;
    }

    player.money -= apt.price;
    player.apartment = apt.id;
    apt.owner = socket.id;

    updateMoney(socket.id);
    updateApartment(socket.id);
    notify(socket.id, `Квартира #${apt.number} куплена`, 'success');
  });

  socket.on('sellApartment', () => {
    const player = players[socket.id];
    if (!player || !player.apartment) {
      notify(socket.id, 'У вас нет квартиры', 'error');
      return;
    }

    const apt = apartments[player.apartment];
    if (!apt) return;

    const sellPrice = Math.floor(apt.price * 0.7);
    player.money += sellPrice;

    apt.owner = null;
    apt.furniture = [];
    player.apartment = null;

    updateMoney(socket.id);
    updateApartment(socket.id);
    notify(socket.id, `Квартира продана за ${sellPrice}$`, 'info');
  });

  // ----------------------------------------------------
  // ДРУЗЬЯ
  // ----------------------------------------------------
  socket.on('addFriend', (targetId) => {
    if (!players[socket.id] || !players[targetId]) {
      notify(socket.id, 'Игрок не найден', 'error');
      return;
    }

    if (targetId === socket.id) {
      notify(socket.id, 'Нельзя добавить себя', 'error');
      return;
    }

    if (!friendships[socket.id]) friendships[socket.id] = [];
    if (!friendships[targetId]) friendships[targetId] = [];

    if (friendships[socket.id].includes(targetId)) {
      notify(socket.id, 'Этот игрок уже в друзьях', 'info');
      return;
    }

    friendships[socket.id].push(targetId);
    friendships[targetId].push(socket.id);

    updateFriends(socket.id);
    updateFriends(targetId);

    notify(socket.id, `${players[targetId].name} добавлен в друзья`, 'success');
    notify(targetId, `${players[socket.id].name} добавил вас в друзья`, 'success');
  });

  socket.on('removeFriend', (targetId) => {
    if (!friendships[socket.id]) return;

    friendships[socket.id] = friendships[socket.id].filter(id => id !== targetId);

    if (friendships[targetId]) {
      friendships[targetId] = friendships[targetId].filter(id => id !== socket.id);
      updateFriends(targetId);
    }

    updateFriends(socket.id);
    notify(socket.id, 'Друг удалён', 'info');
  });

  // ----------------------------------------------------
  // ВЗАИМОДЕЙСТВИЯ
  // ----------------------------------------------------
  socket.on('interact', (data = {}) => {
    const player = players[socket.id];
    if (!player) return;

    if (data.type === 'wave' && data.targetId && players[data.targetId]) {
      notify(data.targetId, `${player.name} помахал вам 👋`, 'info');
      return;
    }

    if (data.type === 'giveMoney' && data.targetId && players[data.targetId]) {
      const amount = Number(data.amount) || 0;
      if (amount <= 0) {
        notify(socket.id, 'Неверная сумма', 'error');
        return;
      }

      if (player.money < amount) {
        notify(socket.id, 'Недостаточно денег', 'error');
        return;
      }

      player.money -= amount;
      players[data.targetId].money += amount;

      updateMoney(socket.id);
      updateMoney(data.targetId);

      notify(socket.id, `Вы передали ${amount}$ игроку ${players[data.targetId].name}`, 'info');
      notify(data.targetId, `${player.name} передал вам ${amount}$`, 'money');
    }
  });

  // ----------------------------------------------------
  // СПОРТЗАЛ / ОПЫТ
  // ----------------------------------------------------
  socket.on('workout', () => {
    const player = players[socket.id];
    if (!player) return;

    addExp(socket.id, 10);
    notify(socket.id, 'Тренировка завершена! +10 EXP', 'success');
  });

  // ----------------------------------------------------
  // ГОЛОСОВОЙ ЧАТ (SIGNALING)
  // ----------------------------------------------------
  socket.on('voiceOffer', (data = {}) => {
    if (!data.targetId) return;
    io.to(data.targetId).emit('voiceOffer', {
      senderId: socket.id,
      offer: data.offer
    });
  });

  socket.on('voiceAnswer', (data = {}) => {
    if (!data.targetId) return;
    io.to(data.targetId).emit('voiceAnswer', {
      senderId: socket.id,
      answer: data.answer
    });
  });

  socket.on('voiceIceCandidate', (data = {}) => {
    if (!data.targetId) return;
    io.to(data.targetId).emit('voiceIceCandidate', {
      senderId: socket.id,
      candidate: data.candidate
    });
  });

  socket.on('voiceStart', () => {
    const player = players[socket.id];
    if (!player) return;

    player.isTalking = true;
    socket.broadcast.emit('playerTalking', {
      id: socket.id,
      talking: true
    });
  });

  socket.on('voiceStop', () => {
    const player = players[socket.id];
    if (!player) return;

    player.isTalking = false;
    socket.broadcast.emit('playerTalking', {
      id: socket.id,
      talking: false
    });
  });

  // ----------------------------------------------------
  // PING
  // ----------------------------------------------------
  socket.on('pingCheck', () => {
    socket.emit('pongCheck', { time: Date.now() });
  });

  // ----------------------------------------------------
  // ADMIN IN-GAME COMMANDS (только для аккаунта temka)
  // ----------------------------------------------------
  socket.on('adminCommand', (data = {}) => {
    const player = players[socket.id];
    if (!player || !player.isAdmin) {
      notify(socket.id, '⛔ Нет прав администратора', 'error');
      return;
    }
    switch (data.cmd) {
      case 'giveMoney': {
        const amt = Number(data.amount) || 0;
        const tName = (data.target || '').toLowerCase();
        const targets = tName === 'all'
          ? Object.values(players)
          : [Object.values(players).find(p => p.name.toLowerCase() === tName) || player];
        targets.filter(Boolean).forEach(t => {
          t.money = Math.max(0, t.money + amt);
          updateMoney(t.id);
          if (t.id !== socket.id)
            notify(t.id, `💰 ${amt >= 0 ? '+' : ''}${amt}$ (Admin)`, 'money');
        });
        notify(socket.id, `✅ Деньги выданы (${amt >= 0 ? '+' : ''}${amt}$)`, 'success');
        break;
      }
      case 'broadcast': {
        const ev = { title: data.title || '📢 Событие', description: data.description || '', type: data.eventType || 'info', createdAt: new Date().toISOString() };
        io.emit('worldEvent', ev);
        broadcastSystemMessage(`[СОБЫТИЕ] ${ev.title}`);
        worldEvents.push(ev);
        if (worldEvents.length > 100) worldEvents.shift();
        break;
      }
      case 'setWeather': {
        worldState.weather = data.weather || 'sunny';
        io.emit('worldUpdate', worldState);
        notify(socket.id, `☁️ Погода: ${worldState.weather}`, 'success');
        break;
      }
      case 'setTime': {
        worldState.time = data.time || 'day';
        io.emit('worldUpdate', worldState);
        notify(socket.id, `🕐 Время: ${worldState.time}`, 'success');
        break;
      }
      case 'spawnNPC': {
        const npc = { id: generateId(), name: sanitizeText(data.name) || 'NPC', x: Number(data.x) || 0, z: Number(data.z) || 0, type: data.npcType || 'citizen', createdAt: new Date().toISOString() };
        npcs[npc.id] = npc;
        io.emit('spawnNPC', npc);
        notify(socket.id, `🧑 NPC "${npc.name}" создан`, 'success');
        break;
      }
      case 'removeNPC': {
        if (npcs[data.npcId]) {
          delete npcs[data.npcId];
          io.emit('removeNPC', { id: data.npcId });
          notify(socket.id, '🗑 NPC удалён', 'info');
        }
        break;
      }
      case 'addPortal': {
        const portal = { id: generateId(), name: sanitizeText(data.name) || 'Портал', fromX: Number(data.fromX) || 0, fromZ: Number(data.fromZ) || 0, toX: Number(data.toX) || 0, toZ: Number(data.toZ) || 0, createdAt: new Date().toISOString() };
        portals[portal.id] = portal;
        io.emit('addPortal', portal);
        notify(socket.id, `🌀 Портал "${portal.name}" создан`, 'success');
        break;
      }
      case 'removePortal': {
        if (portals[data.portalId]) {
          delete portals[data.portalId];
          io.emit('removePortal', { id: data.portalId });
          notify(socket.id, '🗑 Портал удалён', 'info');
        }
        break;
      }
      case 'setHealth': {
        player.health = Math.max(0, Math.min(player.maxHealth, Number(data.amount) || 100));
        updateStats(socket.id);
        notify(socket.id, `❤️ HP установлено: ${player.health}`, 'success');
        break;
      }
      case 'setLevel': {
        player.level = Math.max(1, Number(data.amount) || 1);
        updateStats(socket.id);
        notify(socket.id, `⭐ Уровень: ${player.level}`, 'success');
        break;
      }
    }
  });

  // ----------------------------------------------------
  // ОТКЛЮЧЕНИЕ
  // ----------------------------------------------------
  socket.on('disconnect', () => {
    const player = players[socket.id];

    if (player) {
      broadcastSystemMessage(`${player.name} покинул игру`);

      if (player.apartment && apartments[player.apartment]) {
        apartments[player.apartment].owner = null;
      }

      Object.keys(friendships).forEach(ownerId => {
        friendships[ownerId] = (friendships[ownerId] || []).filter(fid => fid !== socket.id);
        if (players[ownerId]) {
          updateFriends(ownerId);
        }
      });

      delete players[socket.id];
      delete friendships[socket.id];
    }

    sendPlayerLists();
    console.log(`[-] DISCONNECT: ${socket.id}`);
  });
});

// ======================================================
// ОБРАБОТКА ОШИБОК
// ======================================================

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
});

// ======================================================
// ЗАПУСК
// ======================================================

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════╗
║            🎮 FANTAZIA RP 3D SERVER         ║
║                                              ║
║   Сервер запущен на порту: ${PORT}                ║
║   Railway mode: ${process.env.RAILWAY_ENVIRONMENT ? 'ON' : 'OFF'}                     ║
║                                              ║
║   Главная страница: /                        ║
║   Health API: /api/health                    ║
║   Admin API:  /api/admin/*                   ║
╚══════════════════════════════════════════════╝
  `);
});
