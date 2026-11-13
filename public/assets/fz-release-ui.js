/* Launch and connection feedback only: never grants identity, restores saves or restarts the world. */
(function () {
  'use strict';
  let watched = null, detach = () => {}, registrationTimer;
  function node(tag, text, parent) {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    parent?.appendChild(el);
    return el;
  }
  async function session() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch('/api/session/me', {
        credentials: 'same-origin', cache: 'no-store', signal: controller.signal
      });
      if (!response.ok) throw Error('session unavailable');
      const account = await response.json();
      if (!account.ok || typeof account.username !== 'string' || !account.username ||
          (account.guest !== true && !account.token)) throw Error('invalid session');
      return account;
    } finally { clearTimeout(timer); }
  }
  function launch(state) {
    document.getElementById('publicConnectionError')?.remove();
    if (state === 'ready') return;
    const panel = node('section', '', document.body);
    panel.id = 'publicConnectionError';
    const card = node('div', '', panel);
    node('h2', state === 'pending' ? 'Подключаемся к FANTAZIA' : 'Нет связи с сервером', card);
    const message = node('p', state === 'pending'
      ? 'Открываем гостевой вход. Регистрация не нужна. Ожидание — до 12 секунд.'
      : navigator.onLine === false
        ? 'Устройство не в сети. Проверь Wi-Fi или мобильный интернет и повтори попытку.'
        : 'Сервер не ответил вовремя или временно недоступен. Подожди немного и повтори попытку. Регистрация не нужна.', card);
    message.setAttribute('role', 'status');
    panel.dataset.state = state;
    if (state === 'error') {
      node('p', 'Не очищай данные браузера: там могут храниться гостевые сохранения.', card);
      const retry = node('button', 'Повторить подключение', card);
      retry.type = 'button';
      retry.onclick = () => void initAuth();
      retry.focus();
    }
  }
  function banner(message) {
    let panel = document.getElementById('fzConnectionStatus');
    if (!message) { if (panel) panel.hidden = true; return; }
    if (!panel) {
      panel = node('aside', '', document.body); panel.id = 'fzConnectionStatus';
      const text = node('p', '', panel); text.setAttribute('role', 'status');
      const retry = node('button', 'Подключиться снова', panel); retry.type = 'button';
      retry.onclick = () => {
        if (!watched || navigator.onLine === false) return;
        watched.disconnect(); watched.connect(); waiting();
      };
    }
    panel.querySelector('p').textContent = message;
    panel.querySelector('button').disabled = navigator.onLine === false;
    panel.hidden = false;
  }
  function lost() {
    clearTimeout(registrationTimer);
    banner(navigator.onLine === false
      ? 'Нет интернета. Онлайн-функции недоступны. Подключение возобновится после восстановления сети.'
      : 'Связь с сервером потеряна. Онлайн-функции недоступны. Пробуем подключиться снова…');
  }
  function waiting() {
    clearTimeout(registrationTimer);
    banner('Подключаемся к игровому серверу…');
    registrationTimer = setTimeout(() => banner('Сервер долго не отвечает. Можно повторить подключение без перезагрузки страницы.'), 12000);
  }
  function stop() {
    detach(); detach = () => {}; watched = null;
    clearTimeout(registrationTimer); banner(null);
  }
  function watch(socket) {
    stop(); watched = socket;
    const ready = () => { clearTimeout(registrationTimer); banner(null); };
    socket.on('connect', waiting);
    socket.on('registered', ready);
    socket.on('disconnect', lost);
    socket.on('connect_error', lost);
    detach = () => {
      socket.off('connect', waiting); socket.off('registered', ready);
      socket.off('disconnect', lost); socket.off('connect_error', lost);
    };
    if (navigator.onLine === false) lost(); else waiting();
  }
  window.addEventListener('offline', () => { if (watched) lost(); });
  window.addEventListener('online', () => {
    if (watched && !watched.connected) { watched.connect(); waiting(); }
    if (document.getElementById('publicConnectionError')?.dataset.state === 'error') void initAuth();
  });

  let help;
  function openHelp() {
    if (!help) {
      help = node('dialog', '', document.body); help.id = 'fzQuickHelp';
      help.setAttribute('role', 'dialog');
      help.setAttribute('aria-labelledby', 'fzQuickHelpTitle');
      node('h2', 'Как играть', help).id = 'fzQuickHelpTitle';
      const close = node('button', 'Закрыть справку', help); close.type = 'button';
      close.onclick = () => help.close();
      node('h3', 'На компьютере', help);
      node('p', 'WASD — движение · мышь — обзор · Shift — бег · пробел — прыжок · E — взаимодействие · M — меню · F — фонарь.', help);
      node('h3', 'На телефоне', help);
      node('p', 'Левый джойстик — движение. Проводи пальцем справа для обзора. Используй экранные кнопки взаимодействия, прыжка, меню и фонаря.', help);
      node('h3', 'Где фонарь?', help);
      node('p', 'После падения в лесу осмотри землю рядом с обломками кабины. Подойди к фонарю до появления подсказки «Фонарь у обломков · взять» и нажми E или кнопку взаимодействия. После подбора: F или ЛКМ с фонарём в руке; на телефоне — кнопка фонаря.', help);
      node('h3', 'Сохранения', help);
      node('p', 'Гость: прогресс хранится только в этом браузере. Не очищай данные сайта; в приватном режиме они могут исчезнуть при закрытии окна. Для сохранений аккаунта войди в существующий MAIN-аккаунт. Гостевой прогресс автоматически в аккаунт не переносится.', help);
      node('h3', 'Если игра тормозит', help);
      node('p', 'В настройках выбери «Низкий» пресет графики и лимит 30 FPS. Это снижает нагрузку и расход батареи.', help);
      // Native dialog handles focus trapping and Escape; do not leak keys to game listeners.
      for (const type of ['keydown', 'keyup']) window.addEventListener(type, event => {
        if (help.open) event.stopImmediatePropagation();
      }, true);
    }
    window.FZPlay?.release();
    if (typeof keys !== 'undefined') Object.keys(keys).forEach(k => keys[k] = false);
    if (document.pointerLockElement) document.exitPointerLock();
    if (!help.open) help.showModal();
  }
  window.FZReleaseUI = { session, launch, watch, stop, openHelp };
})();
