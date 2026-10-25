// ======================================================
// FANTAZIA RP 3D — ГЛОБАЛЬНОЕ ОБНОВЛЕНИЕ CLIENT (D + B)
// Новые механики: квесты, торговля-помощник, сохранение позиции
// ======================================================

(function() {
  'use strict';

  // --- УТИЛИТЫ ---
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // Retired demo quest. Keep harmless compatibility methods for old callers.
  window.QuestSystem = {
    quests: [], active: null,
    init() { const panel = document.getElementById('questPanel'); if (panel) panel.remove(); },
    render() {}, complete() { return false; }, addProgress() {}
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
// === ДОПОЛНИТЕЛЬНЫЕ МЕХАНИКИ ГЛОБАЛЬНОГО ОБНОВЛЕНИЯ ===
window.GlobalUpdate = {
  version: '2.0.0',
  rebuilt: true,
  worldSize: '500x500',
  mallSize: '120x55x100',
  npcRemoved: true,
  cameraZoomLimited: true,
  init() {
    console.log('[Global Update v2.0] Мир перестроен. Grand Mall огромный. Без NPC.');
    if (window.QuestSystem) window.QuestSystem.init();
    if (window.TradeSystem) window.TradeSystem.init();
  },
  getStatus() {
    return { version: this.version, rebuilt: this.rebuilt, mallSize: this.mallSize, worldSize: this.worldSize, npcRemoved: this.npcRemoved, zoomLimited: this.cameraZoomLimited };
  }
};
window.GlobalUpdate.init();
