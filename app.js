/* «Указатель промтов» — клиент без зависимостей и сборки.
   Данные подключены как <script>, поэтому работает и по file://. */

(function () {
  'use strict';

  var ITEMS = (window.PROMPTS || []).concat(window.LEAKS || []);
  var byId = new Map();

  ITEMS.forEach(function (it, i) {
    it._i = i;
    it.hay = [
      it.title, it.title_src, it.note_ru, it.vendor, it.collection,
      it.collection_src, it.category_label, it.code, it.preview, it.prompt || ''
    ].join(' ').toLowerCase();
    byId.set(it.id, it);
  });

  var STATUS_ORDER = ['official', 'community', 'leak'];

  var state = {
    q: '', statuses: new Set(), vendors: new Set(), cats: new Set(),
    sort: 'default', shown: 150, id: null, moreVendors: false
  };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function fmt(n) {
    return n.toLocaleString('ru-RU').replace(/\u00a0/g, '\u2009');
  }

  function lower(s) {
    return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
  }

  function countBy(key) {
    var m = new Map();
    ITEMS.forEach(function (it) { m.set(it[key], (m.get(it[key]) || 0) + 1); });
    return m;
  }

  /* ---------------- фильтрация ---------------- */

  function filtered() {
    var terms = state.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return ITEMS.filter(function (it) {
      if (state.statuses.size && !state.statuses.has(it.status)) return false;
      if (state.vendors.size && !state.vendors.has(it.vendor)) return false;
      if (state.cats.size && !state.cats.has(it.category)) return false;
      for (var i = 0; i < terms.length; i++) {
        if (it.hay.indexOf(terms[i]) === -1) return false;
      }
      return true;
    }).sort(function (a, b) {
      switch (state.sort) {
        case 'long': return b.chars - a.chars;
        case 'short': return a.chars - b.chars;
        case 'alpha': return a.title.localeCompare(b.title, 'ru');
        default:
          return (STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)) ||
                 a.vendor.localeCompare(b.vendor, 'ru') || a._i - b._i;
      }
    });
  }

  /* ---------------- оглавление ---------------- */

  function facet(label, count, pressed, onClick) {
    var b = el('button', 'facet');
    b.type = 'button';
    b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    b.appendChild(el('span', 'facet-name', label));
    b.appendChild(el('span', 'facet-leader'));
    b.appendChild(el('span', 'facet-count', fmt(count)));
    b.addEventListener('click', onClick);
    return b;
  }

  function toggle(set, value) {
    if (set.has(value)) set.delete(value); else set.add(value);
    state.shown = 150;
    render();
  }

  function renderRail() {
    var rail = $('#rail');
    rail.innerHTML = '';

    var g1 = el('div', 'rail-group');
    g1.appendChild(el('p', 'rail-head', 'Раздел'));
    var stCount = countBy('status');
    STATUS_ORDER.forEach(function (s) {
      if (!stCount.get(s)) return;
      var sample = ITEMS.filter(function (x) { return x.status === s; })[0];
      g1.appendChild(facet(lower(sample.status_label), stCount.get(s), state.statuses.has(s),
        function () { toggle(state.statuses, s); }));
    });
    rail.appendChild(g1);

    var g2 = el('div', 'rail-group');
    g2.appendChild(el('p', 'rail-head', 'Вендоры'));
    var vendors = Array.from(countBy('vendor').entries())
      .sort(function (a, b) { return b[1] - a[1] || a[0].localeCompare(b[0], 'ru'); });
    var limit = state.moreVendors ? vendors.length : 10;
    vendors.slice(0, limit).forEach(function (entry) {
      g2.appendChild(facet(entry[0], entry[1], state.vendors.has(entry[0]),
        function () { toggle(state.vendors, entry[0]); }));
    });
    if (vendors.length > 10) {
      var more = el('button', 'facet-more',
        state.moreVendors ? 'свернуть' : 'ещё ' + (vendors.length - 10));
      more.type = 'button';
      more.addEventListener('click', function () {
        state.moreVendors = !state.moreVendors;
        renderRail();
      });
      g2.appendChild(more);
    }
    rail.appendChild(g2);

    var g3 = el('div', 'rail-group');
    g3.appendChild(el('p', 'rail-head', 'Темы'));
    Array.from(countBy('category_label').entries())
      .sort(function (a, b) { return b[1] - a[1]; })
      .forEach(function (entry) {
        g3.appendChild(facet(entry[0], entry[1], state.cats.has(entry[0]),
          function () { toggle(state.cats, entry[0]); }));
      });
    rail.appendChild(g3);
  }

  /* ---------------- указатель ---------------- */

  function listTitle(items) {
    if (state.q.trim()) return 'Поиск: ' + state.q.trim();
    if (state.vendors.size === 1) return Array.from(state.vendors)[0];
    if (state.cats.size === 1) return Array.from(state.cats)[0];
    if (state.statuses.size === 1) {
      return {
        official: 'Официальные промты',
        community: 'Сэмплы Microsoft PnP',
        leak: 'Утечки'
      }[Array.from(state.statuses)[0]];
    }
    return 'Все промты';
  }

  function renderList() {
    var items = filtered();
    var list = $('#list');
    var more = $('#more');
    var empty = $('#empty');

    list.innerHTML = '';
    more.innerHTML = '';
    empty.hidden = items.length > 0;

    $('#list-title').textContent = listTitle(items);

    var intro = $('#intro');
    if (intro) {
      intro.hidden = !!(state.q.trim() || state.statuses.size || state.vendors.size || state.cats.size);
    }

    var frag = document.createDocumentFragment();
    items.slice(0, state.shown).forEach(function (it) {
      var li = el('li', 'row');
      var btn = el('button', 'row-btn');
      btn.type = 'button';
      btn.appendChild(el('span', 'code', it.code));

      var main = el('span', 'row-main');
      var line = el('span', 'head-line');
      line.appendChild(el('span', 'row-title', it.title));
      line.appendChild(el('span', 'leader'));

      var status = el('span', 'mark-status', lower(it.status_label));
      status.dataset.status = it.status;

      var right = el('span', 'row-size', fmt(it.chars) + ' зн.');
      line.appendChild(right);
      main.appendChild(line);

      var under = el('span', 'under');
      under.appendChild(el('span', 'under-left', it.vendor + ' · ' + it.collection));
      under.appendChild(status);
      main.appendChild(under);

      btn.appendChild(main);
      btn.addEventListener('click', function () { openDetail(it.id); });
      li.appendChild(btn);
      frag.appendChild(li);
    });
    list.appendChild(frag);

    if (items.length > state.shown) {
      var b = el('button', 'stamp-btn', 'Показать ещё ' + fmt(Math.min(150, items.length - state.shown)));
      b.type = 'button';
      b.addEventListener('click', function () { state.shown += 150; renderList(); });
      more.appendChild(b);
    }

    $('#tally').textContent = fmt(items.length) + ' из ' + fmt(ITEMS.length);
    $('#folio').textContent = items.length
      ? 'показано ' + fmt(Math.min(state.shown, items.length)) + ' из ' + fmt(items.length)
      : '';
  }

  /* ---------------- лист ---------------- */

  var leaksPromise = null;

  function ensureLeaks() {
    if (window.LEAK_TEXTS) return Promise.resolve();
    if (leaksPromise) return leaksPromise;
    leaksPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'data/leaks-text.js';
      s.onload = resolve;
      s.onerror = function () { reject(new Error('текст не загрузился')); };
      document.head.appendChild(s);
    });
    return leaksPromise;
  }

  function openDetail(id) {
    state.id = id;
    if (location.hash !== '#/p/' + id) history.pushState({ id: id }, '', '#/p/' + id);
    renderDetail();
  }

  function closeDetail() {
    state.id = null;
    history.pushState({}, '', location.pathname + location.search);
    renderDetail();
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy') ? resolve() : reject(new Error('copy failed'));
      } catch (e) {
        reject(e);
      } finally {
        document.body.removeChild(ta);
      }
    });
  }

  function stamp(btn, doneText, idleText) {
    btn.dataset.done = 'true';
    btn.textContent = doneText;
    setTimeout(function () {
      btn.dataset.done = 'false';
      btn.textContent = idleText;
    }, 1900);
  }

  function renderDetail() {
    var detail = $('#detail');
    var list = $('#list');
    var head = $('.pane-head');
    var more = $('#more');
    var empty = $('#empty');
    var folio = $('#folio');
    var intro = $('#intro');

    if (!state.id) {
      detail.hidden = true;
      detail.innerHTML = '';
      list.hidden = false;
      head.hidden = false;
      renderList();
      return;
    }

    var it = byId.get(state.id);
    if (!it) { closeDetail(); return; }

    if (intro) intro.hidden = true;
    list.hidden = true;
    head.hidden = true;
    more.innerHTML = '';
    empty.hidden = true;
    folio.textContent = '';
    detail.hidden = false;
    detail.innerHTML = '';

    var back = el('button', 'back', '← к указателю');
    back.type = 'button';
    back.addEventListener('click', closeDetail);
    detail.appendChild(back);

    var sheet = el('div', 'sheet');
    var headBox = el('div', 'sheet-head');

    headBox.appendChild(el('p', 'sheet-code', it.code + ' · ' + it.vendor));

    var title = el('h1', 'sheet-title', it.title);
    headBox.appendChild(title);

    if (it.title_src && it.title_src !== it.title) {
      headBox.appendChild(el('p', 'sheet-orig', 'в источнике: ' + it.title_src));
    }

    var meta = el('p', 'sheet-meta');
    var status = el('span', 'mark-status', lower(it.status_label));
    status.dataset.status = it.status;
    meta.appendChild(status);
    meta.appendChild(el('span', null, it.category_label));
    meta.appendChild(el('span', null, fmt(it.chars) + ' знаков'));
    if (it.collection) meta.appendChild(el('span', null, it.collection));
    headBox.appendChild(meta);

    headBox.appendChild(el('p', 'sheet-note', it.note_ru));
    sheet.appendChild(headBox);

    var frame = el('div', 'prompt-frame');
    var phead = el('div', 'prompt-head');
    phead.appendChild(el('span', null, 'текст промта · дословно'));
    var actions = el('div', 'prompt-actions');
    var copy = el('button', 'stamp-btn', 'Копировать');
    copy.type = 'button';
    actions.appendChild(copy);
    phead.appendChild(actions);
    frame.appendChild(phead);

    var pre = el('pre');
    pre.textContent = it.prompt ? '' : 'загружаем текст…';
    frame.appendChild(pre);
    sheet.appendChild(frame);

    var foot = el('div', 'sheet-foot');
    var src = el('a', null, it.source_label || 'источник');
    src.href = it.source_url;
    src.target = '_blank';
    src.rel = 'noopener noreferrer';
    foot.appendChild(src);
    if (it.archive_url) {
      var arc = el('a', null, 'веб-архив');
      arc.href = it.archive_url;
      arc.target = '_blank';
      arc.rel = 'noopener noreferrer';
      foot.appendChild(arc);
    }
    var link = el('button', 'stamp-btn push-right', 'Ссылка на карточку');
    link.type = 'button';
    link.addEventListener('click', function () {
      copyText(location.href).then(function () { stamp(link, 'Ссылка скопирована', 'Ссылка на карточку'); });
    });
    foot.appendChild(link);
    sheet.appendChild(foot);

    detail.appendChild(sheet);

    if (it.status === 'leak') {
      detail.appendChild(el('p', 'warn',
        'Этот текст вендор не публиковал: он извлечён из продукта и лежит в публичном репозитории. ' +
        'Текст может быть устаревшим, неполным или искажённым — для работы опирайтесь на официальные источники.'));
    }

    function showText(text) {
      pre.textContent = text;
      copy.addEventListener('click', function () {
        copyText(text).then(function () { stamp(copy, 'Скопировано', 'Копировать'); });
      });
    }

    if (it.prompt) {
      showText(it.prompt);
    } else if (it.lazy) {
      ensureLeaks().then(function () {
        showText((window.LEAK_TEXTS && window.LEAK_TEXTS[it.id]) || 'текст недоступен');
      }).catch(function (err) {
        pre.textContent = 'Не удалось загрузить текст: ' + err.message;
      });
    } else {
      pre.textContent = 'текст отсутствует';
    }

    document.title = it.title + ' — указатель промтов';
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  /* ---------------- события ---------------- */

  var timer = null;
  $('#q').addEventListener('input', function (e) {
    clearTimeout(timer);
    var v = e.target.value;
    timer = setTimeout(function () {
      state.q = v;
      state.shown = 150;
      syncQuery();
      render();
    }, 110);
  });

  $('#sort').addEventListener('change', function (e) {
    state.sort = e.target.value;
    renderList();
  });

  $('#reset').addEventListener('click', function () {
    state.q = ''; $('#q').value = '';
    state.statuses.clear(); state.vendors.clear(); state.cats.clear();
    state.shown = 150;
    render();
  });

  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    var typing = tag === 'input' || tag === 'textarea' || tag === 'select';
    if (e.key === '/' && !typing) {
      e.preventDefault();
      $('#q').focus();
    } else if (e.key === 'Escape') {
      if (state.id) closeDetail();
      else if (document.activeElement === $('#q')) $('#q').blur();
    }
  });

  window.addEventListener('popstate', function () {
    var m = location.hash.match(/^#\/p\/([\w-]+)$/);
    state.id = m ? m[1] : null;
    renderDetail();
  });

  function syncQuery() {
    var url = location.pathname +
      (state.q.trim() ? '?q=' + encodeURIComponent(state.q.trim()) : '') + location.hash;
    history.replaceState(history.state || {}, '', url);
  }

  function render() {
    renderRail();
    if (state.id) renderDetail(); else renderList();
  }

  /* ---------------- старт ---------------- */

  var params = new URLSearchParams(location.search);
  if (params.get('q')) {
    state.q = params.get('q');
    $('#q').value = state.q;
  }

  var totalChars = ITEMS.reduce(function (s, i) { return s + i.chars; }, 0);
  var ic = $('#intro-count');
  if (ic) ic.textContent = fmt(ITEMS.length);
  $('#colophon-meta').textContent =
    fmt(ITEMS.length) + ' записей · ' + (totalChars / 1e6).toFixed(1).replace('.', ',') +
    ' млн знаков · собрано 31 октября 2026';

  var initial = location.hash.match(/^#\/p\/([\w-]+)$/);
  if (initial && byId.has(initial[1])) state.id = initial[1];
  render();
})();
