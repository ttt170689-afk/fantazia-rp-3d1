/* Optional reader for collected notes. No discovery, save or economy mutations here. */
(function (root) {
  'use strict';
  const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g, 'е').trim();
  function search(notes, query = '', place = '') {
    const words = normalize(query).slice(0, 120).split(/\s+/).filter(Boolean);
    return notes.filter(note => (!place || note.place === place) &&
      words.every(word => normalize([note.title, note.place, note.text].join(' ')).includes(word)));
  }
  let query = '', place = '', large = false;
  try { large = root.localStorage?.getItem('fz_journal47_large') === '1'; } catch {}
  function el(tag, text, parent) {
    const item = document.createElement(tag);
    item.textContent = text;
    parent.append(item);
    return item;
  }
  function button(text, parent, handler) {
    const b = el('button', text, parent); b.type = 'button'; b.onclick = handler; return b;
  }
  function readerSize(card) {
    card.dataset.readerSize = large ? 'large' : 'normal';
    const b = button('Крупный текст', card, () => {
      large = !large;
      card.dataset.readerSize = large ? 'large' : 'normal';
      b.setAttribute('aria-pressed', String(large));
      try { root.localStorage?.setItem('fz_journal47_large', large ? '1' : '0'); } catch {}
    });
    b.className = 'fz-journal-size'; b.setAttribute('aria-pressed', String(large));
  }
  function list(card, found, onRead) {
    const section = el('section', '', card); section.className = 'fz-journal';
    el('h3', 'Найденные записи', section);
    if (!found.length) {
      el('p', 'Дневник пока пуст. Осматривай столы и записки во время прогулки. Прочитанные находки появятся здесь — их можно перечитать в любой момент.', section);
      return;
    }
    const tools = el('div', '', section); tools.className = 'fz-journal-tools';
    const label = el('label', 'Поиск по найденным записям', tools);
    const input = el('input', '', label); input.type = 'search'; input.maxLength = 120;
    input.placeholder = 'Название, место или слова из текста'; input.value = query;
    input.autocomplete = 'off';
    const locations = [...new Set(found.map(n => n.place))];
    if (!locations.includes(place)) place = '';
    const filterLabel = el('label', 'Место находки', tools);
    const filter = el('select', '', filterLabel);
    el('option', 'Все места', filter).value = '';
    for (const location of locations) el('option', location, filter).value = location;
    filter.value = place;
    const count = el('p', '', section); count.className = 'fz-journal-count'; count.setAttribute('role', 'status');
    const results = el('div', '', section); results.className = 'fz-journal-results';
    function draw() {
      const matches = search(found, query, place);
      count.textContent = 'Показано: ' + matches.length + ' из ' + found.length;
      results.replaceChildren();
      if (!matches.length) el('p', 'Нет совпадений. Попробуй другое слово или сбрось фильтры.', results);
      for (const note of matches) {
        const row = el('div', '', results); row.className = 'fz-journal-entry';
        el('small', note.place, row);
        const open = button(note.title, row, () => onRead(note.id)); open.dataset.noteId = note.id;
        el('p', note.text.slice(0, 100) + (note.text.length > 100 ? '…' : ''), row);
      }
    }
    button('Сбросить поиск', tools, () => { query = place = ''; input.value = ''; filter.value = ''; draw(); input.focus(); });
    input.oninput = () => { query = input.value.slice(0, 120); draw(); };
    filter.onchange = () => { place = filter.value; draw(); };
    draw();
  }
  function reader(card, note, found, onRead, onBack) {
    readerSize(card);
    const index = found.findIndex(n => n.id === note.id);
    if (index < 0) return;
    const nav = el('nav', '', card); nav.className = 'fz-journal-pager'; nav.setAttribute('aria-label', 'Перелистывание найденных записей');
    const prev = button('← Предыдущая', nav, () => { if (index > 0) onRead(found[index - 1].id); }); prev.disabled = index === 0;
    el('span', (index + 1) + ' / ' + found.length, nav);
    const next = button('Следующая →', nav, () => { if (index + 1 < found.length) onRead(found[index + 1].id); }); next.disabled = index === found.length - 1;
    button('Все найденные записи', card, onBack);
  }
  const api = { search, list, reader, reset: () => { query = place = ''; } };
  root.FZJournal47 = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
