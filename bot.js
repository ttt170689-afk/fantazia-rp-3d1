// ============================================================
// 🤖 FANTAZIA TESTER-BOT — напарник для тестов
// Запуск: node bot.js
// Ходит по городу, отвечает в чате, танцует по команде,
// приходит к игроку по команде "бот иди"
// ============================================================
const { io } = require('socket.io-client');

const URL = process.env.BOT_URL || 'http://localhost:3000';
const NAME = process.env.BOT_NAME || '🤖 Тестер-Бот';

console.log('[BOT] Подключаюсь к', URL);
const socket = io(URL, { transports: ['websocket'], reconnection: true });

let me = { x: 12, y: 0, z: 12, ry: 0 };
let mode = 'patrol';           // patrol | follow | idle
let followId = null;
let danceUntil = 0;
let target = null;
let angle = 0;
let lastChat = 0;

function dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

socket.on('connect', () => {
  console.log('[BOT] Подключён, регистрируюсь как', NAME);
  socket.emit('registerPlayer', {
    name: NAME,
    skinColor: '#F2C09A',
    shirtColor: '#00B894',
    pantsColor: '#2D3436',
    hairColor: '#182030',
    hairStyle: 4
  });
});

socket.on('registered', (data) => {
  console.log('[BOT] Зарегистрирован! Игроков на сервере: подключаюсь к списку');
});

// Список игроков — ищем, к кому идти
socket.on('playerList', (list) => {
  try {
    const others = (Array.isArray(list) ? list : (list.players || [])).filter(p => p.id !== socket.id);
    if (mode === 'follow' && followId) {
      const t = others.find(p => p.id === followId);
      if (t && t.position) target = { x: t.position.x, z: t.position.z };
    }
  } catch (e) {}
});

// Чат: команды и приветствия
socket.on('chatMessage', (msg) => {
  try {
    if (!msg || !msg.text || msg.senderId === socket.id) return;
    if (Date.now() - lastChat < 1500) return; // не спамим
    const text = String(msg.text).toLowerCase();
    const reply = (t) => {
      lastChat = Date.now();
      socket.emit('sendChat', { text: t, type: 'global' });
    };

    if (/бот.*иди|иди.*бот|follow/.test(text)) {
      followId = msg.senderId; mode = 'follow';
      reply('Иду к тебе! 🏃 (остановить: «бот стоп»)');
    } else if (/бот.*стоп|стоп.*бот|unfollow/.test(text)) {
      mode = 'patrol'; followId = null; target = null;
      reply('Остановился, гуляю дальше 🚶');
    } else if (/бот.*танц|танцуй/.test(text)) {
      danceUntil = Date.now() + 10000;
      socket.emit('startDance', 'disco');
      reply('Смотри, как умею! 💃 (это новая модель игрока)');
    } else if (/привет|здравств|хай|hello/.test(text)) {
      reply('Привет! Я бот-тестер 🤖 Скажи «бот иди» — приду к тебе, «бот танцуй» — станцую');
    } else if (/помощь|help|бот\?/.test(text)) {
      reply('Команды: «бот иди», «бот стоп», «бот танцуй»');
    }
  } catch (e) {}
});

socket.on('disconnect', () => console.log('[BOT] Отключён, переподключаюсь...'));

// ── Игровой цикл бота ──
setInterval(() => {
  try {
    if (!socket.connected) return;

    // Танцуем, если надо
    if (danceUntil && Date.now() > danceUntil) {
      danceUntil = 0;
      socket.emit('stopDance');
    }
    if (danceUntil) {
      socket.emit('updatePosition', {
        position: { x: +me.x.toFixed(2), y: 0, z: +me.z.toFixed(2) },
        rotation: { y: +me.ry.toFixed(2) },
        animation: 'dance'
      });
      return;
    }

    let speed = 0.09, anim = 'walk';

    if (mode === 'follow' && target) {
      const dx = target.x - me.x, dz = target.z - me.z;
      const d = Math.hypot(dx, dz);
      if (d < 2.5) {
        anim = 'idle'; speed = 0;
        me.ry = Math.atan2(dx, dz);
      } else {
        me.x += (dx / d) * 0.09;
        me.z += (dz / d) * 0.09;
        me.ry = Math.atan2(dx, dz);
      }
    } else {
      // Патруль: круг с меняющимся радиусом вокруг центра
      angle += 0.007;
      const r = 6 + Math.sin(angle * 0.3) * 3; // круг по центральной площади
      const nx = Math.sin(angle) * r + 12;
      const nz = Math.cos(angle) * r + 12;
      me.ry = Math.atan2(nx - me.x, nz - me.z);
      me.x = nx; me.z = nz;
    }

    socket.emit('updatePosition', {
      position: { x: +me.x.toFixed(2), y: 0, z: +me.z.toFixed(2) },
      rotation: { y: +me.ry.toFixed(2) },
      animation: anim
    });
  } catch (e) {}
}, 100);

// Пинг-жизнь
setInterval(() => console.log('[BOT] жив:', new Date().toLocaleTimeString(), '| режим:', mode, '| x=' + me.x.toFixed(0), 'z=' + me.z.toFixed(0)), 60000);
