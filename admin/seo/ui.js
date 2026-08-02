/* ─────────────────────────────────────────────────────────────
   РЕМСИТИ·36 — SEO module · UI core
   Контейнер панели с табами, единое состояние формы, автосохранение
   с debounce и универсальный рендерер полей по декларации из fields.js.

   Компоненты не содержат логики генерации meta/JSON-LD — только
   вызывают чистые функции из application.js.
─────────────────────────────────────────────────────────────── */
(function (root) {
  'use strict';

  const D = root.SeoDomain, A = root.SeoApp, F = root.SeoFields;

  /* ── DOM-хелперы ─────────────────────────────────────────── */

  /** Создать элемент: el('div.cls#id', {attrs}, children…) */
  function el(spec, attrs, ...kids) {
    const m = String(spec).match(/^([a-z0-9]+)?([.#][^\s]*)?$/i) || [];
    const tag = m[1] || 'div';
    const node = document.createElement(tag);
    const sel = m[2] || '';
    sel.replace(/([.#])([^.#]+)/g, (_, t, v) => {
      if (t === '.') node.classList.add(v); else node.id = v;
      return '';
    });
    if (attrs) Object.keys(attrs).forEach(k => {
      const v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') node.className += ' ' + v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else node.setAttribute(k, v === true ? '' : v);
    });
    kids.flat(9).forEach(k => {
      if (k == null || k === false) return;
      node.appendChild(typeof k === 'object' ? k : document.createTextNode(String(k)));
    });
    return node;
  }

  const clear = n => { while (n.firstChild) n.removeChild(n.firstChild); return n; };

  /* ── Стор панели ─────────────────────────────────────────── */

  /**
   * Единое состояние формы. Все вкладки читают и пишут через него;
   * напрямую друг о друге они не знают.
   */
  function createStore(opts) {
    const listeners = [];
    const state = {
      post: opts.post,
      site: opts.site,
      seo: JSON.parse(JSON.stringify(
        Object.assign({}, D.emptyPageSeo(), opts.post.seo || {}))),
      dirtyFields: new Set(),
      saveState: 'idle'   // idle | saving | saved | error
    };

    let timer = null;

    function notify(reason) { listeners.forEach(fn => fn(state, reason)); }

    function scheduleSave() {
      clearTimeout(timer);
      setSaveState('idle');
      timer = setTimeout(() => {
        setSaveState('saving');
        Promise.resolve(opts.onSave(state.seo, Array.from(state.dirtyFields)))
          .then(() => { state.dirtyFields.clear(); setSaveState('saved'); })
          .catch(err => { setSaveState('error', err && err.message); });
      }, opts.debounce || 800);
    }

    function setSaveState(s, msg) {
      state.saveState = s; state.saveMessage = msg || '';
      notify('savestate');
    }

    return {
      state,
      get: path => F.getPath(state.seo, path),
      set(path, value) {
        const before = F.getPath(state.seo, path);
        if (JSON.stringify(before) === JSON.stringify(value)) return;
        F.setPath(state.seo, path, value);
        state.dirtyFields.add(path);
        if (opts.onFieldChange) opts.onFieldChange(path, before, value);
        notify('field:' + path);
        scheduleSave();
      },
      /** Пакетная запись (автоматизация) — одно уведомление и одно сохранение. */
      patch(obj) {
        let changed = false;
        Object.keys(obj).forEach(p => {
          const before = F.getPath(state.seo, p);
          if (JSON.stringify(before) === JSON.stringify(obj[p])) return;
          F.setPath(state.seo, p, obj[p]);
          state.dirtyFields.add(p);
          if (opts.onFieldChange) opts.onFieldChange(p, before, obj[p]);
          changed = true;
        });
        if (changed) { notify('patch'); scheduleSave(); }
        return changed;
      },
      /** Разрешённая модель — то, что реально попадёт в <head>. */
      resolved() {
        return A.resolveSeo(Object.assign({}, state.post, { seo: state.seo }), state.site);
      },
      postWithSeo() {
        return Object.assign({}, state.post, { seo: state.seo });
      },
      subscribe(fn) { listeners.push(fn); return () => {
        const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1);
      }; },
      notify, saveNow: () => { clearTimeout(timer); scheduleSave(); }
    };
  }

  /* ── Компоненты полей ────────────────────────────────────── */

  /** Подпись с раскрывающейся подсказкой (FieldWithHint). */
  function labelWithHint(field) {
    const wrap = el('div.seo-label', null, el('span', { text: field.label }));
    if (!field.hint && !field.example) return { node: wrap, hintBox: null };

    const box = el('div.seo-hint-box', { style: { display: 'none' } });
    box.innerHTML = (field.hint || '') +
      (field.example ? '<br><b>Пример:</b> <code>' + A.esc(field.example) + '</code>' : '');

    const btn = el('button.seo-hint-btn', {
      type: 'button', text: '?', title: 'Подсказка',
      onClick: () => { box.style.display = box.style.display === 'none' ? 'block' : 'none'; }
    });
    wrap.appendChild(btn);
    return { node: wrap, hintBox: box };
  }

  /** Счётчик символов с цветовой индикацией (CharacterCounter). */
  function characterCounter(kind) {
    const bar = el('i');
    const num = el('span.num');
    const txt = el('span.txt');
    const node = el('div.seo-counter', null, el('span.bar', null, bar), num, txt);
    const L = A.LIMITS[kind];

    return {
      node,
      update(value) {
        const st = A.lengthStatus(value, kind);
        node.className = 'seo-counter ' + st.level;
        num.textContent = st.n + ' / ' + L.max;
        txt.textContent = st.hint;
        const pct = Math.min(100, st.n / L.max * 100);
        bar.style.width = pct + '%';
        bar.style.background = st.level === 'ok' ? 'var(--s-ok)'
          : st.level === 'warn' ? 'var(--s-warn)' : 'var(--s-err)';
      }
    };
  }

  /**
   * Универсальный рендерер поля по декларации.
   * Возвращает DOM-узел; изменения пишутся в стор автоматически.
   */
  function renderField(field, store, ctx) {
    const wrap = el('div.seo-field');
    const val = () => {
      const v = ctx && ctx.get ? ctx.get(field.path) : store.get(field.path);
      return v === undefined ? '' : v;
    };
    const put = v => (ctx && ctx.set ? ctx.set(field.path, v) : store.set(field.path, v));

    const { node: lbl, hintBox } = labelWithHint(field);
    const errBox = el('div.seo-error', { style: { display: 'none' } });

    function validate(v) {
      const msg = D.runValidators(v, field.validate);
      errBox.style.display = msg ? 'block' : 'none';
      errBox.textContent = msg || '';
      return !msg;
    }

    let input, counter;

    switch (field.type) {
      case 'switch': {
        const cb = el('input', { type: 'checkbox' });
        cb.checked = val() !== false;
        cb.addEventListener('change', () => put(cb.checked));
        const sw = el('label.seo-switch', null,
          cb, el('span.track'), el('span.sw-label', { text: field.label }));
        wrap.appendChild(sw);
        if (field.hint) {
          const b = el('div.seo-hint-box', { html: field.hint });
          b.style.marginTop = '8px';
          wrap.appendChild(b);
        }
        return wrap;
      }

      case 'textarea': {
        input = el('textarea', {
          rows: field.rows || 3, placeholder: field.placeholder || '',
          class: field.mono ? 'mono' : ''
        });
        input.value = val();
        break;
      }

      case 'select': {
        input = el('select');
        const opts = field.options || [];
        if (!opts.some(o => o.value === '')) {
          input.appendChild(el('option', { value: '', text: '— по умолчанию —' }));
        }
        opts.forEach(o => input.appendChild(
          el('option', { value: o.value, text: o.label })));
        input.value = val() || '';
        break;
      }

      case 'number':
        input = el('input', { type: 'number', placeholder: field.placeholder || '' });
        input.value = val() === null ? '' : val();
        break;

      case 'date':
        input = el('input', { type: 'date' });
        input.value = String(val() || '').slice(0, 10);
        break;

      case 'range': {
        const r = el('input', {
          type: 'range', min: field.min, max: field.max, step: field.step
        });
        r.value = val() != null ? val() : field.min;
        const out = el('span.val', { text: r.value });
        r.addEventListener('input', () => {
          out.textContent = r.value; put(Number(r.value));
        });
        wrap.append(lbl, el('div.seo-range', null, r, out));
        if (hintBox) wrap.appendChild(hintBox);
        return wrap;
      }

      case 'tags': {
        const box = el('div.seo-tags');
        const inp = el('input', { type: 'text', placeholder: 'Добавить и нажать Enter' });

        const redraw = () => {
          clear(box);
          (val() || []).forEach((tg, i) => box.appendChild(
            el('span.seo-tag', null, tg,
              el('button', {
                type: 'button', text: '×', title: 'Удалить',
                onClick: () => {
                  const arr = (val() || []).slice(); arr.splice(i, 1); put(arr); redraw();
                }
              }))));
          box.appendChild(inp);
        };

        inp.addEventListener('keydown', e => {
          if (e.key !== 'Enter' && e.key !== ',') return;
          e.preventDefault();
          const v = inp.value.trim();
          if (!v) return;
          const arr = (val() || []).slice();
          if (arr.indexOf(v) === -1) { arr.push(v); put(arr); }
          inp.value = ''; redraw(); inp.focus();
        });

        redraw();
        wrap.append(lbl, box);
        if (hintBox) wrap.appendChild(hintBox);
        return wrap;
      }

      case 'image': {
        const prev = el('img.prev', { alt: '' });
        const tx = el('input', { type: 'text', placeholder: field.placeholder || '/assets/…' });
        const file = el('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });

        const sync = () => {
          const v = val();
          tx.value = v || '';
          if (v) { prev.src = v; prev.style.display = 'block'; }
          else prev.style.display = 'none';
        };

        tx.addEventListener('input', () => { put(tx.value.trim()); sync(); });

        const pick = el('button.seo-btn.sm', {
          type: 'button', text: '↑ Загрузить', onClick: () => file.click()
        });
        file.addEventListener('change', async () => {
          const f = file.files[0];
          if (!f || !ctx || !ctx.uploadImage) return;
          pick.disabled = true; pick.textContent = 'Загрузка…';
          try {
            const url = await ctx.uploadImage(f);
            put(url); sync();
          } catch (e) {
            errBox.style.display = 'block';
            errBox.textContent = 'Ошибка загрузки: ' + e.message;
          } finally { pick.disabled = false; pick.textContent = '↑ Загрузить'; }
        });

        const clr = el('button.seo-btn.sm', {
          type: 'button', text: 'Очистить', onClick: () => { put(''); sync(); }
        });

        sync();
        wrap.append(lbl, el('div.seo-image-field', null,
          prev,
          el('div.ctl', null, tx, el('div.row', null, pick, clr, file))));
        if (hintBox) wrap.appendChild(hintBox);
        return wrap;
      }

      case 'list': {
        const holder = el('div');
        const redraw = () => {
          clear(holder);
          const arr = val() || [];
          if (!arr.length) holder.appendChild(el('div.seo-list-empty', { text: 'Пока пусто' }));
          arr.forEach((item, i) => {
            const card = el('div.seo-list-item', null,
              el('button.del', {
                type: 'button', text: '×', title: 'Удалить',
                onClick: () => {
                  const next = (val() || []).slice(); next.splice(i, 1); put(next); redraw();
                }
              }));
            (field.itemFields || []).forEach(sub => {
              card.appendChild(renderField(
                Object.assign({}, sub, { path: sub.name || sub.path }),
                store,
                {
                  get: p => (val() || [])[i] ? (val() || [])[i][p] : '',
                  set: (p, v) => {
                    const next = (val() || []).map(x => Object.assign({}, x));
                    next[i] = Object.assign({}, next[i]); next[i][p] = v;
                    put(next);
                  },
                  uploadImage: ctx && ctx.uploadImage
                }));
            });
            holder.appendChild(card);
          });
          holder.appendChild(el('button.seo-list-add', {
            type: 'button', text: field.addLabel || '+ Добавить',
            onClick: () => { put((val() || []).concat([{}])); redraw(); }
          }));
        };
        redraw();
        wrap.append(lbl, holder);
        if (hintBox) wrap.appendChild(hintBox);
        return wrap;
      }

      default:
        input = el('input', { type: 'text', placeholder: field.placeholder || '' });
        input.value = val();
    }

    // Общая обработка для text / textarea / select / number / date
    const commit = () => {
      let v = input.value;
      if (field.type === 'number') v = v === '' ? null : Number(v);
      if (typeof v === 'string') v = v.trim();
      if (validate(v)) put(v);
      if (counter) counter.update(input.value);
    };
    input.addEventListener('input', () => {
      if (counter) counter.update(input.value);
      if (field.type !== 'select') commit();
    });
    input.addEventListener('change', commit);

    wrap.append(lbl, input);
    if (field.counter) {
      counter = characterCounter(field.counter);
      wrap.appendChild(counter.node);
      counter.update(input.value);
    }
    wrap.appendChild(errBox);
    if (hintBox) wrap.appendChild(hintBox);
    validate(val());
    return wrap;
  }

  /* ── Сворачиваемая секция ────────────────────────────────── */

  const LS_SECTIONS = 'rc36_seo_sections';

  function loadSectionState() {
    try { return JSON.parse(localStorage.getItem(LS_SECTIONS) || '{}'); }
    catch (e) { return {}; }
  }
  function saveSectionState(key, collapsed) {
    const s = loadSectionState(); s[key] = collapsed;
    try { localStorage.setItem(LS_SECTIONS, JSON.stringify(s)); } catch (e) {}
  }

  function collapsibleSection(key, title, bodyNode, defaultCollapsed) {
    const saved = loadSectionState()[key];
    const collapsed = saved !== undefined ? saved : !!defaultCollapsed;
    const sec = el('section.seo-section' + (collapsed ? '.collapsed' : ''));
    const head = el('div.seo-section-head', {
      onClick: () => {
        sec.classList.toggle('collapsed');
        saveSectionState(key, sec.classList.contains('collapsed'));
      }
    }, el('h4', { text: title }), el('span.chev', { text: '▾' }));
    sec.append(head, el('div.seo-section-body', null, bodyNode));
    return sec;
  }

  /* ── Панель ──────────────────────────────────────────────── */

  const widgets = {};   // заполняется из widgets.js

  /** Кольцевой индикатор SEO-оценки. */
  function scoreRing(score, color, size) {
    const ring = el('div.seo-score-ring', { text: String(score) });
    ring.style.background =
      `conic-gradient(${color} ${score * 3.6}deg, var(--s-line) 0deg)`;
    if (size) { ring.style.width = ring.style.height = size + 'px'; }
    return ring;
  }

  /**
   * Смонтировать SEO-панель.
   * @param {HTMLElement} container
   * @param {Object} opts — {post, site, onSave, onFieldChange, uploadImage,
   *                         getAllPosts, redirects, history, ...}
   */
  function mount(container, opts) {
    const store = createStore(opts);
    const ctx = Object.assign({}, opts, { store, el, clear, renderField, widgets, scoreRing });

    const panel = el('div.seo-panel');
    const saveState = el('span.seo-save-state', null,
      el('span.seo-save-dot'), el('span', { text: 'Готово' }));
    const badgeHolder = el('span');

    const head = el('div.seo-head', null,
      el('h3', { text: 'SEO' }),
      badgeHolder,
      el('span.grow'),
      saveState);

    const tabsBar = el('div.seo-tabs');
    const body = el('div.seo-body');
    panel.append(head, tabsBar, body);

    let activeId = (localStorage.getItem('rc36_seo_tab') || 'basic');
    if (!F.tabs.some(t => t.id === activeId)) activeId = 'basic';

    // Виджет-секции текущей вкладки — обновляются на каждое изменение поля.
    const liveSections = [];

    /* Табы, сгруппированные по разделам */
    function renderTabs() {
      clear(tabsBar);
      F.groups().forEach(g => {
        const grp = el('div.seo-tab-group');
        F.tabs.filter(t => t.group === g).forEach(tab => {
          const btn = el('button.seo-tab' + (tab.id === activeId ? '.active' : ''), {
            type: 'button', title: tab.hint || tab.label,
            onClick: () => { activeId = tab.id; localStorage.setItem('rc36_seo_tab', tab.id); render(); }
          }, el('span.ico', { text: tab.icon || '•' }), el('span', { text: tab.label }));
          grp.appendChild(btn);
        });
        tabsBar.appendChild(grp);
      });
    }

    /* Тело активной вкладки */
    function renderBody() {
      clear(body);
      const tab = F.tabs.find(t => t.id === activeId);
      if (!tab) return;

      if (tab.hint) body.appendChild(el('p.seo-tab-hint', { text: tab.hint }));

      // Вкладка целиком рисуется виджетом
      if (tab.custom) {
        const w = widgets[tab.custom];
        body.appendChild(w
          ? w(store, ctx)
          : el('div.seo-empty', { text: 'Виджет «' + tab.custom + '» не подключён' }));
        return;
      }

      liveSections.length = 0;
      (tab.sections || []).forEach((sec, i) => {
        const inner = el('div');
        if (sec.custom) {
          const w = widgets[sec.custom];
          inner.appendChild(w ? w(store, ctx)
            : el('div.seo-empty', { text: 'Нет виджета: ' + sec.custom }));
          // Секция-виджет зависит от значений полей — обновляем её отдельно,
          // чтобы не перерисовывать поля и не терять фокус ввода.
          liveSections.push({ node: inner, widget: sec.custom });
        } else {
          (sec.fields || []).forEach(f => inner.appendChild(renderField(f, store, ctx)));
        }
        body.appendChild(collapsibleSection(
          tab.id + ':' + i, sec.title, inner, sec.collapsed));
      });
    }

    /** Перерисовать только виджет-секции текущей вкладки. */
    function refreshLiveSections() {
      liveSections.forEach(s => {
        const w = widgets[s.widget];
        if (!w) return;
        clear(s.node).appendChild(w(store, ctx));
      });
    }

    /* Бейдж оценки в шапке */
    function renderBadge() {
      clear(badgeHolder);
      const all = opts.getAllPosts ? opts.getAllPosts() : [];
      const an = A.analyzeSeo(store.postWithSeo(), store.state.site, all);
      const sc = A.calculateSeoScore(an);
      badgeHolder.appendChild(el('span.seo-score-badge', {
        title: 'SEO-оценка: ' + sc.label + ' (' + sc.score + '/100)'
      }, scoreRing(sc.score, sc.color), el('span', { text: sc.label })));
    }

    function renderSaveState() {
      const s = store.state.saveState;
      saveState.className = 'seo-save-state ' + s;
      const txt = { idle: 'Черновик', saving: 'Сохранение…', saved: 'Сохранено', error: 'Ошибка' }[s];
      saveState.lastChild.textContent =
        s === 'error' && store.state.saveMessage ? txt + ': ' + store.state.saveMessage : txt;
    }

    function render() { renderTabs(); renderBody(); renderBadge(); renderSaveState(); }

    // Перерисовка по изменениям: точечно, чтобы не терять фокус в полях
    store.subscribe((st, reason) => {
      if (reason === 'savestate') { renderSaveState(); return; }
      renderBadge();
      const tab = F.tabs.find(t => t.id === activeId);
      // Пакетное изменение (автоматизация, откат) — перерисовываем всё:
      // поля тоже изменились, а фокуса в них в этот момент нет.
      if (reason === 'patch') { renderBody(); return; }
      // Вкладка целиком из виджета — обновляем её, кроме тех, что
      // держат собственное состояние ввода (редиректы, история).
      if (tab && tab.custom) {
        if (tab.custom !== 'redirects' && tab.custom !== 'seoHistory' &&
            tab.custom !== 'coreWebVitals') renderBody();
        return;
      }
      // Обычная вкладка — освежаем только её виджет-секции.
      refreshLiveSections();
    });

    clear(container).appendChild(panel);
    render();

    return {
      store,
      refresh: render,
      destroy() { clear(container); }
    };
  }

  root.SeoUI = {
    mount, el, clear, renderField, collapsibleSection,
    characterCounter, labelWithHint, widgets, scoreRing, createStore
  };
})(typeof self !== 'undefined' ? self : this);
