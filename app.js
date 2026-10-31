/* Каталог промтов — клиент без зависимостей и сборки.
   Работает с file:// (данные подключены как <script>, не через fetch). */

(function () {
  'use strict';

  var ITEMS = (window.PROMPTS || []).concat(window.LEAKS || []);
  var byId = new Map();
  ITEMS.forEach(function (it, i) {
    it._i = i;
    it.hay = (it.title + ' ' + it.note_ru + ' ' + it.vendor + ' ' + it.collection +
              ' ' + it.category_label + ' ' + it.preview + ' ' + (it.prompt || ''))
      .toLowerCase();
    byId.set(it.id, it);
  });

  var STATUS_ORDER = ['official', 'archived', 'community', 'leak'];
  var STATUS_HUE = {
    official: 'var(--gold)', archived: 'var(--sage)',
    community: 'var(--slate)', leak: 'var(--rust)'
  };

  var state = {
    q: '', statuses: new Set(), vendors: new Set(), cats: new Set(),
    sort: 'default', shown: 150, id: null, moreVendors: false
  };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var el = function (tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  /* ---------------- data helpers ---------------- */

  function countBy(key) {
    var m = new Map();
    ITEMS.forEach(function (it) { m.set(it[key], (m.get(it[key]) || 0) + 1); });
    return m;
  }

  function fmt(n) {
    return n.toLocaleString('ru-RU').replace(/\u00a0/g, ' ');
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var terms = q ? q.split(/\s+/) : [];
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
                 a.vendor.localeCompare(b.vendor, 'ru') ||
                 a._i - b._i;
      }
    });
  }

  /* ---------------- rail ---------------- */

  function facet(label, count, pressed, onClick, hue) {
    var b = el('button', 'facet');
    b.type = 'button';
    b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    if (hue) {
      var dot = el('span', 'facet-dot');
      dot.style.background = hue;
      b.appendChild(dot);
    }
    b.appendChild(el('span', 'facet-name', label));
    b.appendChild(el('span', 'facet-count', fmt(count)));
    b.addEventListener('click', onClick);
    return b;
  }

  function renderRail() {
    var rail = $('#rail');
    rail.innerHTML = '';

    /* тип записи */
    var g1 = el('div', 'rail-group');
    g1.appendChild(el('p', 'rail-title', 'Тип записи'));
    var stCount = countBy('status');
    STATUS_ORDER.forEach(function (s) {
      if (!stCount.get(s)) return;
      g1.appendChild(facet(
        byId.size && ITEMS.filter(function (x) { return x.status === s; })[0].status_label,
        stCount.get(s),
        state.statuses.has(s),
        function () { toggle(state.statuses, s); },
        STATUS_HUE[s]
      ));
    });
    rail.appendChild(g1);

    /* вендоры */
    var g2 = el('div', 'rail-group');
    g2.appendChild(el('p', 'rail-title', 'Вендоры'));
    var vCount = countBy('vendor');
    var vendors = Array.from(vCount.entries())
      .sort(function (a, b) { return b[1] - a[1] || a[0].localeCompare(b[0], 'ru'); });
    var limit = state.moreVendors ? vendors.length : 10;
    vendors.slice(0, limit).forEach(function (entry) {
      g2.appendChild(facet(entry[0], entry[1], state.vendors.has(entry[0]),
        function () { toggle(state.vendors, entry[0]); }));
    });
    if (vendors.length > 10) {
      var moreBtn = el('button', 'facet-more',
        state.moreVendors ? 'свернуть список' : 'ещё ' + (vendors.length - 10) + ' вендоров');
      moreBtn.type = 'button';
      moreBtn.addEventListener('click', function () {
        state.moreVendors = !state.moreVendors;
        renderRail();
      });
      g2.appendChild(moreBtn);
    }
    rail.appendChild(g2);

    /* категории */
    var g3 = el('div', 'rail-group');
    g3.appendChild(el('p', 'rail-title', 'Категории'));
    var cCount = countBy('category_label');
    var order = Array.from(cCount.entries())
      .sort(function (a, b) { return b[1] - a[1]; });
    order.forEach(function (entry) {
      g3.appendChild(facet(entry[0], entry[1], state.cats.has(entry[0]),
        function () { toggle(state.cats, entry[0]); }));
    });
    rail.appendChild(g3);
  }

  function toggle(set, value) {
    if (set.has(value)) set.delete(value); else set.add(value);
    state.shown = 150;
    render();
  }

  /* ---------------- list ---------------- */

  function renderList() {
    var items = filtered();
    var list = $('#list');
    var empty = $('#empty');
    var more = $('#more');

    list.innerHTML = '';
    more.innerHTML = '';
    empty.hidden = items.length > 0;

    var title = 'Все промты';
    if (state.q.trim()) title = 'Поиск: ' + state.q.trim();
    else if (state.vendors.size === 1) title = Array.from(state.vendors)[0];
    else if (state.cats.size === 1) title = Array.from(state.cats)[0];
    else if (state.statuses.size === 1) {
      var s = Array.from(state.statuses)[0];
      title = { official: 'Официальные промты', archived: 'Архив вендора',
                community: 'Microsoft PnP', leak: 'Утечки и слитые промты' }[s];
    }
    $('#list-title').textContent = title;

    var slice = items.slice(0, state.shown);
    var frag = document.createDocumentFragment();

    slice.forEach(function (it) {
      var li = el('li', 'row');
      var btn = el('button', 'row-btn');
      btn.type = 'button';

      var left = el('div');
      left.appendChild(el('span', 'row-title', it.title));

      var meta = el('div', 'row-meta');
      meta.appendChild(el('span', null, it.vendor));
      meta.appendChild(el('span', null, it.collection));
      if (it.collection.indexOf(it.category_label) === -1) {
        meta.appendChild(el('span', null, it.category_label));
      }
      left.appendChild(meta);

      var right = el('div', 'row-right');
      right.appendChild(el('span', 'row-size', fmt(it.chars) + ' зн.'));
      var badge = el('span', 'badge', it.status_label);
      badge.dataset.status = it.status;
      right.appendChild(badge);

      btn.appendChild(left);
      btn.appendChild(right);
      btn.addEventListener('click', function () { openDetail(it.id); });

      li.appendChild(btn);
      frag.appendChild(li);
    });

    list.appendChild(frag);

    if (items.length > state.shown) {
      var b = el('button', null, 'Показать ещё ' + fmt(Math.min(150, items.length - state.shown)) +
        ' из ' + fmt(items.length - state.shown) + ' оставшихся');
      b.type = 'button';
      b.addEventListener('click', function () { state.shown += 150; renderList(); });
      more.appendChild(b);
    }

    $('#tally').textContent = fmt(items.length) + ' из ' + fmt(ITEMS.length) + ' записей';
  }

  /* ---------------- detail ---------------- */

  var leaksPromise = null;

  function ensureLeaks() {
    if (window.LEAK_TEXTS) return Promise.resolve();
    if (leaksPromise) return leaksPromise;
    leaksPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'data/leaks-text.js';
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('leaks-text.js не загрузился')); };
      document.head.appendChild(s);
    });
    return leaksPromise;
  }

  function openDetail(id) {
    state.id = id;
    if (location.hash !== '#/p/' + id) {
      history.pushState({ id: id }, '', '#/p/' + id);
    }
    renderDetail();
  }

  function closeDetail() {
    state.id = null;
    history.pushState({}, '', location.pathname + location.search);
    renderDetail();
  }

  function renderDetail() {
    var detail = $('#detail');
    var list = $('#list');
    var head = $('.list-head');
    var more = $('#more');
    var empty = $('#empty');

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

    list.hidden = true;
    head.hidden = true;
    more.innerHTML = '';
    empty.hidden = true;
    detail.hidden = false;

    detail.innerHTML = '';

    var back = el('button', 'back', '← ко всем промтам');
    back.type = 'button';
    back.addEventListener('click', closeDetail);
    detail.appendChild(back);

    detail.appendChild(el('p', 'detail-kicker', it.vendor + ' · ' + it.collection));
    detail.appendChild(el('h1', 'detail-title', it.title));

    var meta = el('div', 'detail-meta');
    var badge = el('span', 'badge', it.status_label);
    badge.dataset.status = it.status;
    meta.appendChild(badge);
    meta.appendChild(el('span', null, it.category_label));
    meta.appendChild(el('span', null, fmt(it.chars) + ' знаков'));
    meta.appendChild(el('span', null, it.source_label || ''));
    if (it.archived) meta.appendChild(el('span', null, 'восстановлено из веб-архива'));
    detail.appendChild(meta);

    detail.appendChild(el('p', 'detail-note', it.note_ru));

    var plate = el('div', 'plate');
    var head2 = el('div', 'plate-head');
    head2.appendChild(el('span', null, 'текст промта · дословно'));
    var actions = el('div', 'plate-actions');
    var copy = el('button', 'copy', 'Копировать');
    copy.type = 'button';
    actions.appendChild(copy);
    head2.appendChild(actions);
    plate.appendChild(head2);

    var pre = el('pre');
    var pending = el('span', null, 'загружаем текст…');
    pre.appendChild(pending);
    plate.appendChild(pre);

    var foot = el('div', 'plate-foot');
    var src = el('a', null, 'источник: ' + (it.source_label || 'ссылка'));
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
    plate.appendChild(foot);
    detail.appendChild(plate);

    if (it.status === 'leak') {
      detail.appendChild(el('p', 'warn',
        'Этот текст вендор не публиковал. Он извлечён из продукта и лежит в публичном репозитории — ' +
        'может быть устаревшим, неполным или искажённым. Для работы опирайтесь на официальные источники.'));
    }

    function showText(text) {
      pre.textContent = text;
      copy.addEventListener('click', function () {
        copyText(text).then(function () {
          copy.dataset.done = 'true';
          copy.textContent = 'Скопировано';
          setTimeout(function () {
            copy.dataset.done = 'false';
            copy.textContent = 'Копировать';
          }, 1800);
        });
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

    document.title = it.title + ' — Каталог промтов';
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
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

  /* ---------------- wiring ---------------- */

  var queryTimer = null;
  $('#q').addEventListener('input', function (e) {
    clearTimeout(queryTimer);
    var v = e.target.value;
    queryTimer = setTimeout(function () {
      state.q = v;
      state.shown = 150;
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
      if (state.id) { closeDetail(); }
      else if (document.activeElement === $('#q')) { $('#q').blur(); }
    }
  });

  window.addEventListener('popstate', function () {
    var m = location.hash.match(/^#\/p\/([\w-]+)$/);
    state.id = m ? m[1] : null;
    renderDetail();
  });

  var totalChars = ITEMS.reduce(function (s, i) { return s + i.chars; }, 0);
  $('#colophon-meta').textContent =
    fmt(ITEMS.length) + ' записей · ' + (totalChars / 1e6).toFixed(1).replace('.', ',') +
    ' млн знаков · собрано 31 октября 2026';

  function render() {
    renderRail();
    if (state.id) renderDetail(); else renderList();
  }

  var initial = location.hash.match(/^#\/p\/([\w-]+)$/);
  if (initial && byId.has(initial[1])) state.id = initial[1];
  render();
})();
