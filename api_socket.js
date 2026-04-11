// api/socket.js
// Vercel serverless — Socket.IO через HTTP polling (без WebSocket)
const { Server } = require('socket.io');

// Глобальное состояние (живёт пока функция не остыла)
const players = {};
const chatHistory = [];

const JOB_DEFINITIONS = {
  police:   { title: '👮 Полицейский', salary: 120 },
  doctor:   { title: '🩺 Врач',         salary: 150 },
  taxi:     { title: '🚕 Таксист',      salary: 80  },
  mechanic: { title: '🔧 Механик',      salary: 100 },
};

let io;

function getIO() {
  if (io) return io;

  io = new Server({
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['polling'],   // ← только polling, WebSocket Vercel не держит
    allowEIO3: true,
  });

  io.on('connection', (socket) => {
    console.log('[+] CONNECT:', socket.id);

    socket.on('registerPlayer', (data) => {
      const player = {
        id: socket.id,
        name: data.name || 'Игрок',
        appearance: data,
        position: { x: (Math.random()-0.5)*20, y: 0, z: (Math.random()-0.5)*20 },
        rotation: { y: 0 },
        health: 100, money: 500, level: 1, xp: 0,
        job: null, inventory: [], friends: [], apartment: null, pet: null, animation: 'idle',
      };
      players[socket.id] = player;

      socket.emit('registered', {
        player,
        chatHistory: chatHistory.slice(-50),
        jobDefinitions: JOB_DEFINITIONS,
      });

      io.emit('playerList', Object.values(players));

      const msg = { sender: 'Сервер', text: `${player.name} вошёл в игру!`, type: 'system' };
      chatHistory.push(msg);
      io.emit('chatMessage', msg);
    });

    socket.on('updatePosition', (data) => {
      if (players[socket.id]) {
        players[socket.id].position  = data.position;
        players[socket.id].rotation  = data.rotation;
        players[socket.id].animation = data.animation;
      }
      socket.broadcast.emit('playerMoved', { id: socket.id, ...data });
    });

    socket.on('sendChat', (data) => {
      const p = players[socket.id];
      if (!p) return;
      const msg = { sender: p.name, text: data.text, type: data.type || 'global' };
      chatHistory.push(msg);
      if (chatHistory.length > 100) chatHistory.shift();
      io.emit('chatMessage', msg);
    });

    socket.on('startDance', (data) => {
      socket.broadcast.emit('playerDance', { id: socket.id, dance: data.type });
    });
    socket.on('stopDance', () => {
      socket.broadcast.emit('playerDance', { id: socket.id, dance: null });
    });

    socket.on('getJob', (jobId) => {
      if (players[socket.id]) {
        players[socket.id].job = jobId;
        socket.emit('jobUpdate', { job: jobId });
      }
    });
    socket.on('quitJob', () => {
      if (players[socket.id]) {
        players[socket.id].job = null;
        socket.emit('jobUpdate', { job: null });
      }
    });

    socket.on('buyItem', (data) => {
      const p = players[socket.id];
      if (!p) return;
      const cost = 100;
      if (p.money >= cost) {
        p.money -= cost;
        p.inventory.push({ ...data, uid: Date.now().toString(36) });
        socket.emit('moneyUpdate', p.money);
        socket.emit('inventoryUpdate', p.inventory);
      } else {
        socket.emit('notification', { text: '❌ Недостаточно денег!', type: 'error' });
      }
    });

    socket.on('useItem', (uid) => {
      const p = players[socket.id];
      if (!p) return;
      const idx = p.inventory.findIndex(i => i.uid === uid);
      if (idx !== -1) {
        p.inventory.splice(idx, 1);
        p.health = Math.min(100, (p.health || 100) + 20);
        socket.emit('healthUpdate', p.health);
        socket.emit('inventoryUpdate', p.inventory);
      }
    });

    socket.on('adoptPet', (type) => {
      if (players[socket.id]) {
        players[socket.id].pet = { type, name: type, level: 1 };
        socket.emit('petUpdate', players[socket.id].pet);
      }
    });

    socket.on('addFriend',    (id) => { const p = players[socket.id]; if (p && !p.friends.includes(id)) { p.friends.push(id); socket.emit('friendsUpdate', p.friends); } });
    socket.on('removeFriend', (id) => { const p = players[socket.id]; if (p) { p.friends = p.friends.filter(f => f !== id); socket.emit('friendsUpdate', p.friends); } });

    socket.on('updateAppearance', (data) => {
      const p = players[socket.id];
      if (p) {
        p.appearance = { ...p.appearance, ...data };
        socket.emit('appearanceUpdate', p.appearance);
        io.emit('playerList', Object.values(players));
      }
    });

    // WebRTC голос (сигнализация)
    socket.on('voiceOffer',        (d) => socket.broadcast.emit('voiceOffer',        { senderId: socket.id, offer:     d.offer     }));
    socket.on('voiceAnswer',       (d) => socket.broadcast.emit('voiceAnswer',       { senderId: socket.id, answer:    d.answer    }));
    socket.on('voiceIceCandidate', (d) => socket.broadcast.emit('voiceIceCandidate', { senderId: socket.id, candidate: d.candidate }));
    socket.on('voiceStart',        ()  => socket.broadcast.emit('playerTalking', { id: socket.id, talking: true  }));
    socket.on('voiceStop',         ()  => socket.broadcast.emit('playerTalking', { id: socket.id, talking: false }));

    socket.on('interact', (data) => {
      const p = players[socket.id];
      if (data.type === 'wave' && p) io.emit('notification', { text: `👋 ${p.name} машет рукой!`, type: 'info' });
    });

    socket.on('disconnect', () => {
      const p = players[socket.id];
      if (p) {
        const msg = { sender: 'Сервер', text: `${p.name} вышел.`, type: 'system' };
        delete players[socket.id];
        io.emit('chatMessage', msg);
        io.emit('playerList', Object.values(players));
      }
      console.log('[-] disconnect:', socket.id);
    });
  });

  return io;
}

module.exports = (req, res) => {
  getIO().handleRequest(req, res);
};
