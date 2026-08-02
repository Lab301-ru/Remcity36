/* ─────────────────────────────────────────────────────────────
   РЕМСИТИ·36 — SEO module · WIDGETS
   Кастомные вкладки: превью, микроразметка, изображения, редиректы,
   AI-директивы, анализ, оценка, Core Web Vitals, история, автоматизация.

   Каждый виджет — чистая функция (store, ctx) → DOM-узел.
   Данные берутся только из application.js, разметка — здесь.
─────────────────────────────────────────────────────────────── */
(function (root) {
  'use strict';

  const D = root.SeoDomain, A = root.SeoApp, F = root.SeoFields, U = root.SeoUI;
  const el = U.el, clear = U.clear, W = U.widgets;

  /* ── Общие данные для всех каналов превью ────────────────── */

  function previewData(store) {
    const r = store.resolved();
    const host = String(r.origin).replace(/^https?:\/\//, '');
    const p = store.state.post;
    return {
      title: r.title, description: r.description, url: r.canonicalUrl,
      host, siteName: r.siteName,
      breadcrumb: (r.breadcrumbs || []).map(b => b.label).slice(0, 2).join(' › '),
      dateDisplay: p.dateDisplay || p.date || '',
      image: r.ogImage,
      ogTitle: r.ogTitle, ogDescription: r.ogDescription, ogImage: r.ogImage,
      twitterTitle: r.twitterTitle, twitterDescription: r.twitterDescription,
      twitterImage: r.twitterImage, twitterCard: r.twitterCard
    };
  }

  /** Отрисовать карточку канала по его описанию из реестра. */
  function renderCard(channelKey, data) {
    const ch = D.previewChannels[channelKey];
    if (!ch) return el('div.seo-empty', { text: 'Канал не найден: ' + channelKey });
    const c = ch.render(data);

    if (c.kind === 'snippet') {
      const cls = 'snippet' + (c.device === 'mobile' ? ' mobile' : '') +
                  (c.device === 'yandex' ? ' yandex' : '');
      const main = el('div', null,
        el('div.crumb', null,
          el('span.host', { text: data.host }),
          c.breadcrumb ? ' › ' + c.breadcrumb : ''),
        el('h5', { text: c.title || '(нет заголовка)' }),
        el('p', null,
          c.date ? el('span.date', { text: c.date + ' — ' }) : null,
          c.description || '(нет описания)'));

      const inner = (c.image && c.device !== 'desktop')
        ? el('div.snippet-row', null,
            main, el('img.thumb', { src: c.image, alt: '', onerror: e => e.target.remove() }))
        : main;
      return el('div', { class: cls }, inner);
    }

    // Социальная карточка
    const card = el('div', { class: 'social-card ' + c.style });
    if (c.image && c.large !== false) {
      card.appendChild(el('img', {
        src: c.image, alt: '', onerror: e => e.target.remove()
      }));
    }
    card.appendChild(el('div.body', null,
      el('div.site', { text: c.site || '' }),
      el('div.ttl', { text: c.title || '(нет заголовка)' }),
      el('div.desc', { text: c.description || '(нет описания)' })));
    return card;
  }

  function previewBlock(label, node) {
    return el('div', null, el('div.snippet-label', { text: label }), node);
  }

  /* ═══ 1. Превью в поиске ═══════════════════════════════════ */

  W.googlePreview = function (store) {
    const d = previewData(store);
    const wrap = el('div.seo-preview-wrap');
    ['googleDesktop', 'googleMobile', 'yandex'].forEach(k => {
      wrap.appendChild(previewBlock(D.previewChannels[k].label, renderCard(k, d)));
    });

    // Подсказки по длине прямо под превью
    const t = A.lengthStatus(d.title, 'title');
    const ds = A.lengthStatus(d.description, 'description');
    if (t.level !== 'ok' || ds.level !== 'ok') {
      wrap.appendChild(el('div.seo-note' + (t.level === 'bad' || ds.level === 'bad' ? '.warn' : ''),
        { html: '<b>Рекомендации:</b><br>' +
          'Заголовок — ' + t.n + ' симв., ' + t.hint + '<br>' +
          'Описание — ' + ds.n + ' симв., ' + ds.hint }));
    }
    return wrap;
  };

  W.ogPreview = function (store) {
    const d = previewData(store);
    const wrap = el('div.seo-preview-wrap');
    ['telegram', 'vk', 'facebook', 'whatsapp'].forEach(k => {
      wrap.appendChild(previewBlock(D.previewChannels[k].label, renderCard(k, d)));
    });
    return wrap;
  };

  W.twitterPreview = function (store) {
    return previewBlock('X / Twitter', renderCard('twitter', previewData(store)));
  };

  W.allPreviews = function (store) {
    const d = previewData(store);
    const wrap = el('div');
    const byGroup = {};
    Object.keys(D.previewChannels).forEach(k => {
      const g = D.previewChannels[k].group || 'Прочее';
      (byGroup[g] = byGroup[g] || []).push(k);
    });
    Object.keys(byGroup).forEach((g, i) => {
      const inner = el('div.seo-preview-wrap');
      byGroup[g].forEach(k =>
        inner.appendChild(previewBlock(D.previewChannels[k].label, renderCard(k, d))));
      wrap.appendChild(U.collapsibleSection('preview:' + g, g, inner, i > 0));
    });
    return wrap;
  };

  /* ═══ 2. Микроразметка (Structured Data) ═══════════════════ */

  W.structuredData = function (store, ctx) {
    const wrap = el('div');

    const typeSel = el('select');
    typeSel.appendChild(el('option', { value: '', text: '— не задано (Article по умолчанию) —' }));
    Object.keys(D.schemaRegistry).forEach(k =>
      typeSel.appendChild(el('option', { value: k, text: D.schemaRegistry[k].label })));
    typeSel.value = store.get('schemaType') || '';
    typeSel.addEventListener('change', () => {
      store.set('schemaType', typeSel.value);
      store.set('schemaData', {});
      ctx.store.notify('patch');
    });

    const typeField = el('div.seo-field', null,
      el('div.seo-label', null, el('span', { text: 'Тип разметки Schema.org' })), typeSel);

    const entry = D.schemaRegistry[store.get('schemaType')] || D.schemaRegistry.Article;
    if (entry.hint) typeField.appendChild(el('div.seo-hint-box', { html: entry.hint }));
    wrap.appendChild(U.collapsibleSection('schema:type', 'Тип разметки', typeField));

    // Динамическая форма полей выбранного типа
    const form = el('div');
    entry.fields.forEach(f => {
      form.appendChild(U.renderField(
        Object.assign({}, f, { path: f.name }),
        store,
        {
          get: p => (store.get('schemaData') || {})[p],
          set: (p, v) => {
            const next = Object.assign({}, store.get('schemaData') || {});
            next[p] = v; store.set('schemaData', next);
          },
          uploadImage: ctx.uploadImage
        }));
    });

    const fillBtn = el('button.seo-btn.sm', {
      type: 'button', text: '✦ Заполнить из полей страницы',
      onClick: () => {
        store.set('schemaData', A.autoGenerateSchema(
          store.state.post, store.state.site, store.get('schemaType') || 'Article'));
        ctx.store.notify('patch');
      }
    });
    form.appendChild(el('div.seo-btn-row', { style: { marginTop: '10px' } }, fillBtn));
    wrap.appendChild(U.collapsibleSection('schema:fields', 'Поля разметки', form));

    // Результирующий JSON-LD
    const ld = A.generateJsonLd(store.resolved());
    const code = el('pre.seo-code', { text: JSON.stringify(ld, null, 2) });
    const out = el('div', null,
      el('div.seo-note', {
        html: 'Будет добавлено на страницу: <b>' +
              (ld.map(x => x['@type']).join(', ') || 'ничего') + '</b>. ' +
              'Проверить можно в <a href="https://search.google.com/test/rich-results" ' +
              'target="_blank" rel="noopener">Rich Results Test</a>.'
      }), code);
    wrap.appendChild(U.collapsibleSection('schema:json', 'Итоговый JSON-LD', out, true));

    return wrap;
  };

  W.breadcrumbsPreview = function (store) {
    const r = store.resolved();
    const crumbs = r.breadcrumbs || [];
    const line = el('div.snippet', null,
      el('div.crumb', { text: crumbs.map(c => c.label).join(' › ') }));
    const schema = A.generateBreadcrumbSchema(r);
    return el('div', null, line,
      el('pre.seo-code', {
        text: schema ? JSON.stringify(schema, null, 2) : 'Крошки не заданы',
        style: { marginTop: '12px' }
      }));
  };

  /* ═══ 3. Изображения ══════════════════════════════════════ */

  W.imagesSeo = function (store, ctx) {
    const wrap = el('div');
    const found = A.collectPageImages(store.state.post);
    const saved = store.get('images') || [];

    if (!found.length) {
      return el('div.seo-empty', { text: 'На странице нет изображений' });
    }

    // Дубли alt в пределах страницы
    const altCounts = {};
    saved.forEach(im => { if (im.alt) altCounts[im.alt] = (altCounts[im.alt] || 0) + 1; });

    found.forEach((im, i) => {
      const rec = saved.find(s => s.url === im.url) || { url: im.url, alt: im.alt || '' };
      const idx = saved.findIndex(s => s.url === im.url);

      const update = (key, value) => {
        const next = (store.get('images') || []).map(x => Object.assign({}, x));
        const at = next.findIndex(x => x.url === im.url);
        if (at === -1) next.push(Object.assign({ url: im.url }, { [key]: value }));
        else next[at][key] = value;
        store.set('images', next);
      };

      const body = el('div');
      body.appendChild(el('div.seo-image-field', null,
        el('img.prev', { src: im.url, alt: '', onerror: e => (e.target.style.opacity = .25) }),
        el('div.ctl', null,
          el('div.seo-hint-box', {
            html: '<b>' + (im.source === 'cover' ? 'Обложка' : 'В тексте') + '</b><br>' +
                  '<code>' + A.esc(im.url) + '</code>'
          }))));

      [
        { key: 'alt', label: 'Alt-текст', hint: 'Описание для поиска по картинкам и незрячих пользователей. До 125 символов.' },
        { key: 'title', label: 'Title', hint: 'Всплывающая подсказка при наведении.' },
        { key: 'caption', label: 'Подпись', hint: 'Видимая подпись под изображением.' }
      ].forEach(f => {
        body.appendChild(U.renderField(
          { path: f.key, label: f.label, type: f.key === 'alt' ? 'textarea' : 'text', hint: f.hint, rows: 2 },
          store,
          {
            get: () => (idx >= 0 ? saved[idx][f.key] : rec[f.key]) || '',
            set: (_, v) => update(f.key, v)
          }));
      });

      // Предупреждения
      const warns = [];
      if (!rec.alt) warns.push('Нет alt-текста — изображение не попадёт в поиск по картинкам');
      else {
        if (rec.alt.length > 125) warns.push('Alt длиннее 125 символов — будет обрезан');
        if (altCounts[rec.alt] > 1) warns.push('Такой же alt уже используется на этой странице');
      }
      if (warns.length) {
        body.appendChild(el('div.seo-note.warn', { html: warns.join('<br>') }));
      }

      body.appendChild(el('div.seo-btn-row', null,
        el('button.seo-btn.sm', {
          type: 'button', text: '✦ Сгенерировать alt',
          onClick: () => { update('alt', A.autoGenerateAltText(store.state.post, im.url)); ctx.store.notify('patch'); }
        })));

      wrap.appendChild(U.collapsibleSection(
        'img:' + i, 'Изображение ' + (i + 1) + (im.source === 'cover' ? ' — обложка' : ''),
        body, i > 0));
    });

    return wrap;
  };

  /* ═══ 4. Редиректы ════════════════════════════════════════ */

  W.redirects = function (store, ctx) {
    const wrap = el('div');
    const rules = (ctx.getRedirects ? ctx.getRedirects() : []) || [];

    wrap.appendChild(el('div.seo-note', {
      html: 'Сайт статический, поэтому редирект — это страница с мгновенной переадресацией ' +
            '(<code>meta refresh</code> + <code>canonical</code>). Поисковики трактуют её как постоянный ' +
            'редирект и переносят вес на новый адрес.'
    }));

    const listBox = el('div');

    function redraw() {
      clear(listBox);
      const cur = (ctx.getRedirects ? ctx.getRedirects() : []) || [];
      if (!cur.length) {
        listBox.appendChild(el('div.seo-empty', { text: 'Редиректов пока нет' }));
      }
      cur.forEach((rule, i) => {
        const card = el('div.seo-list-item', null,
          el('button.del', {
            type: 'button', text: '×', title: 'Удалить',
            onClick: () => {
              const next = cur.slice(); next.splice(i, 1);
              ctx.onSaveRedirects(next); redraw();
            }
          }),
          el('div.seo-kv', null,
            el('dt', { text: 'Откуда' }), el('dd', { text: rule.fromPath }),
            el('dt', { text: 'Куда' }), el('dd', { text: rule.toPath }),
            el('dt', { text: 'Код' }), el('dd', { text: rule.statusCode }),
            el('dt', { text: 'Создан' }), el('dd', { text: (rule.createdAt || '').slice(0, 10) })));
        listBox.appendChild(card);
      });

      // Проверка цепочек и циклов
      const problems = A.findRedirectChains(cur);
      if (problems.length) {
        listBox.appendChild(el('div.seo-note.warn', {
          html: '<b>Проблемы:</b><br>' + problems.map(p =>
            (p.type === 'loop' ? '⟲ Цикл: ' : '⇢ Цепочка: ') + p.chain.join(' → ') +
            (p.type === 'chain' ? ' — замените на прямой редирект' : '')
          ).join('<br>')
        }));
      }
    }
    redraw();
    wrap.appendChild(U.collapsibleSection('redir:list', 'Текущие редиректы', listBox));

    // Добавление вручную
    const from = el('input', { type: 'text', placeholder: '/news/staryy-adres' });
    const to = el('input', { type: 'text', placeholder: '/news/novyy-adres' });
    const code = el('select');
    D.REDIRECT_CODES.forEach(c => code.appendChild(el('option', { value: c.value, text: c.label })));

    const addBox = el('div', null,
      el('div.seo-field', null, el('div.seo-label', null, el('span', { text: 'Откуда (старый путь)' })), from),
      el('div.seo-field', null, el('div.seo-label', null, el('span', { text: 'Куда (новый путь)' })), to),
      el('div.seo-field', null, el('div.seo-label', null, el('span', { text: 'Код ответа' })), code),
      el('div.seo-btn-row', null, el('button.seo-btn.primary', {
        type: 'button', text: '+ Добавить редирект',
        onClick: () => {
          const f = from.value.trim(), t2 = to.value.trim();
          if (!f) return;
          const cur = (ctx.getRedirects ? ctx.getRedirects() : []) || [];
          if (cur.some(r => r.fromPath === f)) { alert('Такой редирект уже есть'); return; }
          ctx.onSaveRedirects(cur.concat([{
            fromPath: f, toPath: t2 || '/', statusCode: code.value,
            createdAt: new Date().toISOString()
          }]));
          from.value = to.value = ''; redraw();
        }
      })));

    wrap.appendChild(U.collapsibleSection('redir:add', 'Добавить редирект', addBox, true));
    return wrap;
  };

  /* ═══ 5. Индексация — сводка ══════════════════════════════ */

  W.indexationSummary = function (store) {
    const r = store.resolved();
    const rows = [
      ['meta robots', r.robots],
      ['canonical', r.canonicalUrl],
      ['В sitemap.xml', r.sitemap.include ? 'да' : 'нет'],
      ['Приоритет в sitemap', String(r.sitemap.priority)],
      ['Частота обновления', r.sitemap.changefreq],
      ['Поиск по сайту', r.hideFromInternalSearch ? 'скрыта' : 'доступна']
    ];
    const dl = el('dl.seo-kv');
    rows.forEach(([k, v]) => { dl.append(el('dt', { text: k }), el('dd', { text: v })); });

    const warn = r.robots.indexOf('noindex') !== -1
      ? el('div.seo-note.warn', {
          html: '<b>Внимание:</b> страница закрыта от индексации — она пропадёт из поиска.' })
      : null;
    return el('div', null, warn, dl);
  };

  /* ═══ 6. AI-директивы ═════════════════════════════════════ */

  W.aiDirectives = function (store, ctx) {
    const wrap = el('div');
    const reg = D.aiDirectivesRegistry;

    const mainBox = el('div');
    reg.metaDirectives.forEach(md => {
      mainBox.appendChild(U.renderField(
        { path: 'aiDirectives.' + md.key, label: md.label, type: 'switch', hint: md.hint },
        store, ctx));
    });
    wrap.appendChild(U.collapsibleSection('ai:main', 'Общие правила для ИИ', mainBox));

    // Поимённый список краулеров
    const listBox = el('div');
    listBox.appendChild(el('div.seo-note', {
      html: 'Отметьте краулеров, которым <b>запрещён</b> доступ. Запреты попадут в ' +
            '<code>robots.txt</code> и meta-теги страницы.'
    }));

    reg.crawlers.forEach(bot => {
      const blocked = (store.get('aiDirectives.disallowedAiCrawlers') || []).indexOf(bot.id) !== -1;
      const cb = el('input', { type: 'checkbox' });
      cb.checked = blocked;
      cb.addEventListener('change', () => {
        const cur = (store.get('aiDirectives.disallowedAiCrawlers') || []).slice();
        const at = cur.indexOf(bot.id);
        if (cb.checked && at === -1) cur.push(bot.id);
        if (!cb.checked && at !== -1) cur.splice(at, 1);
        store.set('aiDirectives.disallowedAiCrawlers', cur);
      });
      listBox.appendChild(el('div.seo-field', null,
        el('label.seo-switch', null, cb, el('span.track'),
          el('span.sw-label', null,
            el('b', { text: 'Блокировать ' + bot.label }),
            el('div', {
              text: bot.note,
              style: { fontSize: '12px', color: 'var(--s-muted)', marginTop: '2px' }
            })))));
    });
    wrap.appendChild(U.collapsibleSection('ai:crawlers', 'Доступ ИИ-краулеров', listBox, true));

    // Предпросмотр robots.txt
    const site = store.state.site;
    const merged = Object.assign({},
      (site.seoDefaults || {}).aiDirectivesDefault, store.get('aiDirectives'));
    wrap.appendChild(U.collapsibleSection('ai:robots', 'Итоговый robots.txt',
      el('pre.seo-code', { text: A.robotsTxt(site, merged) }), true));

    return wrap;
  };

  /* ═══ 7. SEO-анализ ═══════════════════════════════════════ */

  W.seoAnalysis = function (store, ctx) {
    const all = ctx.getAllPosts ? ctx.getAllPosts() : [];
    const an = A.analyzeSeo(store.postWithSeo(), store.state.site, all);
    const wrap = el('div');

    wrap.appendChild(el('div.seo-stat-row', null,
      el('div.seo-stat', null,
        el('div.v', { text: an.passed + '/' + an.total }), el('div.k', { text: 'Проверок пройдено' })),
      el('div.seo-stat', null,
        el('div.v', { text: String(an.words) }), el('div.k', { text: 'Слов в тексте' })),
      el('div.seo-stat', null,
        el('div.v', { text: String(an.checks.filter(c => !c.passed && c.level === 'error').length) }),
        el('div.k', { text: 'Критичных проблем' }))));

    const failed = an.checks.filter(c => !c.passed);
    const passed = an.checks.filter(c => c.passed);

    function checkNode(c) {
      const cls = c.passed ? 'pass' : 'fail-' + c.level;
      return el('div.seo-check.' + cls, null,
        el('span.mark', { text: c.passed ? '✓' : (c.level === 'error' ? '!' : '·') }),
        el('span.txt', null, el('b', { text: c.label }), el('span', { text: c.detail || '' })));
    }

    if (failed.length) {
      const box = el('div');
      failed.forEach(c => box.appendChild(checkNode(c)));
      wrap.appendChild(U.collapsibleSection('an:fail', 'Требуют внимания (' + failed.length + ')', box));
    }
    const okBox = el('div');
    passed.forEach(c => okBox.appendChild(checkNode(c)));
    wrap.appendChild(U.collapsibleSection('an:ok', 'Пройдено (' + passed.length + ')', okBox, true));

    return wrap;
  };

  /* ═══ 8. SEO Score ════════════════════════════════════════ */

  W.seoScore = function (store, ctx) {
    const all = ctx.getAllPosts ? ctx.getAllPosts() : [];
    const an = A.analyzeSeo(store.postWithSeo(), store.state.site, all);
    const sc = A.calculateSeoScore(an);
    const wrap = el('div');

    const circle = el('div.seo-score-circle', null,
      el('div.inner', null,
        el('div.n', { text: String(sc.score), style: { color: sc.color } }),
        el('div.of', { text: 'из 100' })));
    circle.style.background = `conic-gradient(${sc.color} ${sc.score * 3.6}deg, var(--s-line) 0deg)`;

    wrap.appendChild(el('div.seo-score-big', null, circle,
      el('div.seo-score-meta', null,
        el('h4', { text: sc.label, style: { color: sc.color } }),
        el('p', {
          text: sc.score >= 90 ? 'Страница отлично оптимизирована.'
            : sc.score >= 70 ? 'Хороший результат. Исправьте оставшееся — и будет отлично.'
            : sc.score >= 40 ? 'Есть заметные пробелы. Начните с критичных пунктов ниже.'
            : 'Много критичных проблем — страница плохо видна поиску.'
        }))));

    if (sc.failed.length) {
      const box = el('div');
      sc.failed.forEach(c => box.appendChild(
        el('div.seo-check.fail-' + c.level, null,
          el('span.mark', { text: c.level === 'error' ? '!' : '·' }),
          el('span.txt', null, el('b', { text: c.label }), el('span', { text: c.detail || '' })))));
      wrap.appendChild(U.collapsibleSection('sc:todo', 'Что улучшить — по важности', box));
    } else {
      wrap.appendChild(el('div.seo-note', { html: '<b>Все проверки пройдены.</b>' }));
    }

    // Шкала градаций
    wrap.appendChild(el('div.seo-hint-box', {
      html: '<b>Шкала:</b> 90–100 — отлично · 70–89 — хорошо · ' +
            '40–69 — требует доработки · 0–39 — критично.<br>' +
            'Критичные проверки весят больше, чем рекомендательные.'
    }));
    return wrap;
  };

  /* ═══ 9. Core Web Vitals ══════════════════════════════════ */

  const LS_PSI_KEY = 'rc36_psi_key';

  W.coreWebVitals = function (store) {
    const wrap = el('div');
    const url = store.resolved().canonicalUrl;

    const keyInput = el('input', {
      type: 'password', placeholder: 'Необязательно — без ключа лимит запросов ниже'
    });
    keyInput.value = localStorage.getItem(LS_PSI_KEY) || '';
    keyInput.addEventListener('change', () =>
      localStorage.setItem(LS_PSI_KEY, keyInput.value.trim()));

    const result = el('div');
    const runBtn = el('button.seo-btn.primary', { type: 'button', text: '▸ Проверить скорость' });

    runBtn.addEventListener('click', async () => {
      runBtn.disabled = true; runBtn.textContent = 'Измеряем… (до 30 сек)';
      clear(result);
      try {
        const key = keyInput.value.trim();
        const api = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed' +
          '?url=' + encodeURIComponent(url) + '&strategy=mobile' +
          '&category=performance&category=seo&category=accessibility' +
          (key ? '&key=' + encodeURIComponent(key) : '');
        const res = await fetch(api);
        if (!res.ok) throw new Error('PageSpeed вернул ' + res.status +
          (res.status === 429 ? ' — превышен лимит, добавьте API-ключ' : ''));
        const json = await res.json();
        result.appendChild(renderCwv(json));
      } catch (e) {
        result.appendChild(el('div.seo-note.warn', {
          html: '<b>Не удалось измерить:</b> ' + A.esc(e.message) +
                '<br>Страница должна быть опубликована и доступна публично.'
        }));
      } finally { runBtn.disabled = false; runBtn.textContent = '▸ Проверить скорость'; }
    });

    wrap.appendChild(el('div.seo-note', {
      html: 'Измерение идёт через <b>Google PageSpeed Insights</b> для опубликованной страницы: ' +
            '<code>' + A.esc(url) + '</code>'
    }));
    wrap.appendChild(el('div.seo-field', null,
      el('div.seo-label', null, el('span', { text: 'API-ключ PageSpeed (необязательно)' })),
      keyInput,
      el('div.seo-hint-box', {
        html: 'Без ключа Google жёстко ограничивает частоту запросов. ' +
              'Ключ создаётся бесплатно в Google Cloud Console → PageSpeed Insights API. ' +
              'Хранится только в этом браузере.'
      })));
    wrap.appendChild(el('div.seo-btn-row', null, runBtn));
    wrap.appendChild(result);
    return wrap;
  };

  function renderCwv(json) {
    const lh = json.lighthouseResult || {};
    const audits = lh.audits || {};
    const cats = lh.categories || {};
    const box = el('div');

    // Категории
    const catRow = el('div.seo-stat-row');
    [['performance', 'Скорость'], ['seo', 'SEO'], ['accessibility', 'Доступность']]
      .forEach(([k, label]) => {
        const c = cats[k];
        if (!c) return;
        const score = Math.round((c.score || 0) * 100);
        const color = score >= 90 ? 'var(--s-ok)' : score >= 50 ? 'var(--s-warn)' : 'var(--s-err)';
        catRow.appendChild(el('div.seo-stat', null,
          el('div.v', { text: String(score), style: { color } }),
          el('div.k', { text: label })));
      });
    box.appendChild(catRow);

    // Метрики Core Web Vitals
    const metrics = [
      { id: 'largest-contentful-paint', name: 'LCP', desc: 'Отрисовка основного контента. Хорошо < 2.5 с' },
      { id: 'cumulative-layout-shift', name: 'CLS', desc: 'Сдвиг вёрстки. Хорошо < 0.1' },
      { id: 'total-blocking-time', name: 'TBT', desc: 'Блокировка отклика. Хорошо < 200 мс' },
      { id: 'first-contentful-paint', name: 'FCP', desc: 'Первая отрисовка. Хорошо < 1.8 с' },
      { id: 'speed-index', name: 'Speed Index', desc: 'Скорость наполнения экрана' },
      { id: 'interactive', name: 'TTI', desc: 'Готовность к взаимодействию' }
    ];
    const grid = el('div.cwv-grid');
    metrics.forEach(m => {
      const a = audits[m.id];
      if (!a) return;
      const s = a.score == null ? null : a.score;
      const cls = s == null ? '' : s >= 0.9 ? 'good' : s >= 0.5 ? 'avg' : 'poor';
      grid.appendChild(el('div', { class: 'cwv-card ' + cls },
        el('div.name', { text: m.name }),
        el('div.val', { text: a.displayValue || '—' }),
        el('div.desc', { text: m.desc })));
    });
    box.appendChild(grid);

    // Главные рекомендации
    const opps = Object.keys(audits)
      .map(k => audits[k])
      .filter(a => a.details && a.details.type === 'opportunity' &&
                   a.numericValue > 100 && a.score != null && a.score < 0.9)
      .sort((a, b) => (b.numericValue || 0) - (a.numericValue || 0))
      .slice(0, 5);
    if (opps.length) {
      const list = el('div');
      opps.forEach(a => list.appendChild(el('div.seo-check.fail-warn', null,
        el('span.mark', { text: '·' }),
        el('span.txt', null, el('b', { text: a.title }),
          el('span', { text: a.displayValue || '' })))));
      box.appendChild(U.collapsibleSection('cwv:opps', 'Что ускорит загрузку', list));
    }
    return box;
  }

  /* ═══ 10. История изменений ═══════════════════════════════ */

  W.seoHistory = function (store, ctx) {
    const wrap = el('div');
    const entries = (ctx.getHistory ? ctx.getHistory() : []) || [];
    const mine = entries.filter(e => e.slug === store.state.post.slug)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    if (!mine.length) {
      return el('div.seo-empty', { text: 'Изменений SEO-полей пока не было' });
    }

    const fmt = v => {
      if (v === null || v === undefined || v === '') return '(пусто)';
      return typeof v === 'object' ? JSON.stringify(v) : String(v);
    };

    mine.slice(0, 100).forEach(e => {
      const card = el('div.seo-hist', null,
        el('div.top', null,
          el('span.fld', { text: F.fieldLabel(e.field) }),
          e.ai ? el('span.seo-badge-ai', { text: 'ИИ' }) : null,
          el('span.grow'),
          el('span.who', { text: e.user || '—' }),
          el('span.when', { text: String(e.createdAt || '').replace('T', ' ').slice(0, 16) })),
        el('div.seo-diff', null,
          el('div.old', { text: fmt(e.oldValue) }),
          el('div.new', { text: fmt(e.newValue) })),
        el('div.seo-btn-row', { style: { marginTop: '10px' } },
          el('button.seo-btn.sm', {
            type: 'button', text: '⟲ Вернуть прежнее значение',
            onClick: () => {
              // Откат — это новое изменение, история не переписывается.
              store.set(e.field, e.oldValue === undefined ? '' : e.oldValue);
              ctx.store.notify('patch');
            }
          })));
      wrap.appendChild(card);
    });

    wrap.appendChild(el('div.seo-hint-box', {
      html: 'Откат записывается как новое изменение — история никогда не удаляется.'
    }));
    return wrap;
  };

  /* ═══ 11. Автоматизация ═══════════════════════════════════ */

  W.automation = function (store, ctx) {
    const wrap = el('div');
    const post = store.state.post, site = store.state.site;

    const log = el('div');
    const report = msg => {
      log.insertBefore(el('div.seo-note', { html: msg }), log.firstChild);
    };

    const actions = [
      {
        label: '✦ Заголовок по шаблону',
        hint: 'Подставит заголовок статьи в шаблон из глобальных настроек.',
        run: () => {
          const v = A.autoGenerateTitle(post, site);
          store.patch({ seoTitle: v });
          return 'Заголовок: <b>' + A.esc(v) + '</b>';
        }
      },
      {
        label: '✦ Описание из текста',
        hint: 'Соберёт описание из первых предложений статьи, уложившись в 160 символов.',
        run: () => {
          const v = A.autoGenerateDescription(post);
          if (!v) return 'В статье нет текста — описание не сгенерировано';
          store.patch({ metaDescription: v });
          return 'Описание: <b>' + A.esc(v) + '</b>';
        }
      },
      {
        label: '✦ Alt для всех изображений',
        hint: 'Заполнит пустые alt-тексты на основе заголовка страницы.',
        run: () => {
          const imgs = A.collectPageImages(post);
          if (!imgs.length) return 'Изображений на странице нет';
          const cur = (store.get('images') || []).map(x => Object.assign({}, x));
          let n = 0;
          imgs.forEach(im => {
            const at = cur.findIndex(x => x.url === im.url);
            const existing = at >= 0 ? cur[at].alt : im.alt;
            if (existing) return;
            const alt = A.autoGenerateAltText(post, im.url);
            if (at >= 0) cur[at].alt = alt; else cur.push({ url: im.url, alt });
            n++;
          });
          if (!n) return 'У всех изображений уже есть alt';
          store.patch({ images: cur });
          return 'Заполнено alt: <b>' + n + '</b>';
        }
      },
      {
        label: '✦ Open Graph',
        hint: 'Заполнит карточку для соцсетей из основных полей страницы.',
        run: () => { store.patch(A.autoGenerateOg(post, site)); return 'Open Graph заполнен'; }
      },
      {
        label: '✦ Twitter Card',
        hint: 'Заполнит карточку X/Twitter.',
        run: () => { store.patch(A.autoGenerateTwitter(post, site)); return 'Twitter Card заполнен'; }
      },
      {
        label: '✦ Микроразметка',
        hint: 'Предзаполнит поля выбранного типа Schema.org данными страницы.',
        run: () => {
          const type = store.get('schemaType') || 'Article';
          store.patch({ schemaType: type, schemaData: A.autoGenerateSchema(post, site, type) });
          return 'Разметка <b>' + type + '</b> заполнена';
        }
      },
      {
        label: '✦ Хлебные крошки',
        hint: 'Построит цепочку Главная → Новости → Заголовок.',
        run: () => {
          store.patch({ breadcrumbsOverride: A.autoGenerateBreadcrumbs(post, site) });
          return 'Хлебные крошки заполнены';
        }
      },
      {
        label: '✦ Canonical',
        hint: 'Проставит канонический адрес по slug страницы.',
        run: () => {
          const v = A.autoGenerateCanonical(post, site);
          store.patch({ canonicalUrl: v });
          return 'Canonical: <b>' + A.esc(v) + '</b>';
        }
      }
    ];

    const grid = el('div');
    actions.forEach(a => {
      grid.appendChild(el('div.seo-field', null,
        el('div.seo-btn-row', null,
          el('button.seo-btn', {
            type: 'button', text: a.label,
            onClick: () => { report(a.run()); ctx.store.notify('patch'); }
          })),
        el('div.seo-hint-box', { html: a.hint })));
    });
    wrap.appendChild(U.collapsibleSection('auto:one', 'Отдельные действия', grid));

    // Заполнить всё сразу
    const allBtn = el('button.seo-btn.primary', {
      type: 'button', text: '✦✦ Заполнить всё пустое',
      onClick: () => {
        const before = JSON.stringify(store.state.seo);
        const patch = {};
        if (!store.get('seoTitle')) patch.seoTitle = A.autoGenerateTitle(post, site);
        if (!store.get('metaDescription')) {
          const d = A.autoGenerateDescription(post);
          if (d) patch.metaDescription = d;
        }
        if (!store.get('canonicalUrl')) patch.canonicalUrl = A.autoGenerateCanonical(post, site);
        if (!store.get('ogTitle')) Object.assign(patch, A.autoGenerateOg(post, site));
        if (!store.get('twitterTitle')) Object.assign(patch, A.autoGenerateTwitter(post, site));
        if (!store.get('schemaType')) {
          patch.schemaType = 'Article';
          patch.schemaData = A.autoGenerateSchema(post, site, 'Article');
        }
        if (!(store.get('breadcrumbsOverride') || []).length) {
          patch.breadcrumbsOverride = A.autoGenerateBreadcrumbs(post, site);
        }
        // alt для изображений без описания
        const imgs = A.collectPageImages(post);
        if (imgs.length) {
          const cur = (store.get('images') || []).map(x => Object.assign({}, x));
          imgs.forEach(im => {
            const at = cur.findIndex(x => x.url === im.url);
            const existing = at >= 0 ? cur[at].alt : im.alt;
            if (existing) return;
            const alt = A.autoGenerateAltText(post, im.url);
            if (at >= 0) cur[at].alt = alt; else cur.push({ url: im.url, alt });
          });
          patch.images = cur;
        }
        store.patch(patch);
        report(JSON.stringify(store.state.seo) === before
          ? 'Всё уже заполнено — менять нечего'
          : '<b>Готово.</b> Пустые SEO-поля заполнены. Проверьте вкладку «Превью в поиске».');
        ctx.store.notify('patch');
      }
    });

    wrap.appendChild(U.collapsibleSection('auto:all', 'Заполнить всё сразу',
      el('div', null,
        el('div.seo-note', {
          html: 'Заполняются <b>только пустые</b> поля — то, что вы вписали руками, не тронется.'
        }),
        el('div.seo-btn-row', null, allBtn))));

    wrap.appendChild(log);

    // Генерация описания через ИИ — честно о состоянии интеграции
    wrap.appendChild(U.collapsibleSection('auto:ai', 'Описание через ИИ',
      el('div.seo-note.warn', {
        html: '<b>Не подключено.</b> В проекте нет серверной части, а обращаться к API ' +
              'нейросети напрямую из браузера нельзя — ключ попал бы в общедоступный код сайта. ' +
              'Кнопка «Описание из текста» выше решает ту же задачу без ключей и работает офлайн.'
      }), true));

    return wrap;
  };

})(typeof self !== 'undefined' ? self : this);
