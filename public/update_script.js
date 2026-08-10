// ======================================================
// FANTAZIA RP 3D — ГЛОБАЛЬНОЕ ОБНОВЛЕНИЕ CLIENT (D + B)
// Новые механики: квесты, торговля-помощник, сохранение позиции
// ======================================================

(function() {
  'use strict';

  // --- УТИЛИТЫ ---
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // --- СИСТЕМА КВЕСТОВ (D) ---
  window.QuestSystem = {
    quests: [],
    active: null,
    init() {
      // Можно подгружать с сервера через /api/quests
      // Для демо добавляем 3 квеста
      this.quests = [
        { id: 'q1', title: 'Ночной стражник', desc: 'Победи 3 врагов в городе', reward: 250, progress: 0, max: 3, completed: false },
        { id: 'q2', title: 'Сбор кристаллов', desc: 'Найди 5 магических камней', reward: 400, progress: 2, max: 5, completed: false },
        { id: 'q3', title: 'Торговец', desc: 'Продай предмет кому-либо', reward: 150, progress: 0, max: 1, completed: false }
      ];
      this.render();
      console.log('[Update] QuestSystem готов. Квестов:', this.quests.length);
    },
    render() {
      let panel = $('#questPanel');
      if (!panel) {
        // Создаём панель, если её нет в HTML
        panel = document.createElement('div');
        panel.id = 'questPanel';
        panel.className = 'quest-panel';
        panel.style.position = 'fixed';
        panel.style.top = '14px';
        panel.style.right = '14px';
        panel.style.zIndex = '100';
        panel.style.maxWidth = '300px';
        document.body.appendChild(panel);
      }
      const active = this.quests.find(q => !q.completed && q.id === 'q1'); // просто показываем первый
      if (active) {
        const pct = Math.round((active.progress / active.max) * 100);
        panel.innerHTML = `
          <h3 style="margin:0 0 6px 0;color:#dcd3ff;font-family:'Orbitron',sans-serif;font-size:15px;letter-spacing:1px;">⚡ КВЕСТЫ</h3>
          <div style="margin-bottom:8px;color:#ccc;font-size:13px;"><strong style="color:#fff;">${active.title}</strong><br><span style="opacity:0.9;">${active.desc}</span></div>
          <div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:6px 10px;margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;color:#aaa;margin-bottom:4px;"><span>Прогресс</span><span>${active.progress}/${active.max}</span></div>
            <div style="width:100%;height:10px;background:rgba(255,255,255,0.1);border-radius:999px;overflow:hidden;"><div class="quest-progress-bar" style="width:${pct}%;"></div></div>
          </div>
          <button onclick="window.QuestSystem.complete('q1')" class="quest-btn" style="width:100%;padding:8px;border:none;border-radius:12px;cursor:pointer;font-size:13px;">Завершить квест (+${active.reward})</button>
        `;
      } else {
        panel.innerHTML = `<h3 style="margin:0;color:#dcd3ff;font-family:'Orbitron',sans-serif;font-size:15px;">✅ Все квесты выполнены!</h3>`;
      }
    },
    complete(id) {
      const q = this.quests.find(x => x.id === id);
      if (q && !q.completed) {
        q.completed = true;
        q.progress = q.max;
        console.log('[Update] Квест завершён:', q.title, 'Награда:', q.reward);
        // Уведомление
        if (window.showNotification) window.showNotification('Квест выполнен! +'+q.reward, 'success');
        else alert('Квест выполнен! +' + q.reward + ' монет');
        this.render();
      }
    },
    addProgress(id, amount = 1) {
      const q = this.quests.find(x => x.id === id && !x.completed);
      if (q) {
        q.progress = Math.min(q.max, q.progress + amount);
        this.render();
      }
    }
  };

  // --- СИСТЕМА ТОРГОВЛИ (D) ---
  window.TradeSystem = {
    offers: [],
    init() {
      console.log('[Update] TradeSystem готов. Торговля улучшена.');
    },
    createOffer(fromPlayer, itemId, price) {
      this.offers.push({ fromPlayer, itemId, price, accepted: false, time: Date.now() });
      console.log('[Update] Новое предложение торговли:', itemId, 'за', price);
      if (window.showNotification) window.showNotification('Новое торговое предложение!', 'info');
    },
    acceptOffer(id) {
      const offer = this.offers.find(o => o.id === id || o === id);
      if (offer) {
        offer.accepted = true;
        console.log('[Update] Торговля принята:', offer.itemId);
        if (window.showNotification) window.showNotification('Торговля успешно завершена!', 'success');
      }
    }
  };

  // --- СУПЕР-ПЛАВНЫЕ АНИМАЦИИ ДЛЯ ИНТЕРАКТИВОВ (B) ---
  window.animateBtn = function(btn) {
    btn.style.transform = 'scale(0.95)';
    setTimeout(() => btn.style.transform = '', 120);
  };

  // --- Сохранение позиции игрока (D) ---
  window.savePlayerPosition = function(x, y, z) {
    const data = { x, y, z, timestamp: Date.now() };
    try {
      localStorage.setItem('fantazia_pos', JSON.stringify(data));
      console.log('[Update] Позиция сохранена:', data);
    } catch(e) { console.warn('[Update] Не удалось сохранить позицию'); }
  };
  window.loadPlayerPosition = function() {
    try {
      const raw = localStorage.getItem('fantazia_pos');
      if (raw) return JSON.parse(raw);
    } catch(e) {}
    return null;
  };

  // --- ИНИЦИАЛИЗАЦИЯ ---
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    window.QuestSystem.init();
    window.TradeSystem.init();
    // Авто-โหลด позиции (если есть)
    const pos = window.loadPlayerPosition();
    if (pos) console.log('[Update] Загружена сохранённая позиция:', pos);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      window.QuestSystem.init();
      window.TradeSystem.init();
    });
  }

})();
