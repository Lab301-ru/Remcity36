/* ─────────────────────────────────────────────────────────────
   РЕМСИТИ·36 — SEO module · APPLICATION layer
   Чистые функции: разрешение значений с наследованием, генерация
   meta/JSON-LD/sitemap/robots, валидация, анализ, скоринг, автоматизация.

   Никакой логики генерации нет в UI-компонентах — они только
   вызывают эти функции и рендерят результат.
─────────────────────────────────────────────────────────────── */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./domain.js'));
  } else {
    root.SeoApp = factory(root.SeoDomain);
  }
})(typeof self !== 'undefined' ? self : this, function (D) {
  'use strict';

  /* ── helpers ─────────────────────────────────────────────── */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function plain(s) {
    return String(s == null ? '' : s)
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Первое непустое значение из списка.
  function first() {
    for (let i = 0; i < arguments.length; i++) {
      const v = arguments[i];
      if (v !== undefined && v !== null && v !== '' &&
          !(Array.isArray(v) && !v.length)) return v;
    }
    return '';
  }

  /* ═══════════════════════════════════════════════════════════
     1. resolveSeo — единая точка наследования
     Приоритет: поле страницы → старое поле поста → site.seoDefaults
     ═══════════════════════════════════════════════════════════ */

  /**
   * Разрешить итоговые SEO-значения страницы с учётом наследования.
   * @param {Object} post — запись из posts.json
   * @param {Object} site — объект site из posts.json
   * @returns {Object} полностью разрешённая модель для рендера
   */
  function resolveSeo(post, site) {
    const seo = Object.assign({}, D.emptyPageSeo(), post.seo || {});
    const def = Object.assign({}, D.emptySiteDefaults(), (site && site.seoDefaults) || {});
    const origin = (site && site.origin) || '';
    const siteName = (site && site.name) || '';

    const abs = p => !p ? '' : (/^https?:/.test(p) ? p : origin + (p[0] === '/' ? '' : '/') + p);

    const url = first(seo.canonicalUrl && abs(seo.canonicalUrl), origin + '/news/' + post.slug);
    const rawTitle = first(seo.seoTitle, plain(post.title));
    // Шаблон применяется только если у страницы нет собственного seoTitle.
    const title = seo.seoTitle
      ? seo.seoTitle
      : applyTitleTemplate(def.titleTemplate, rawTitle, siteName);
    const description = first(seo.metaDescription, plain(post.description), def.metaDescription);
    const cover = first(seo.ogImage, post.cover, def.ogImage);
    const coverAbs = abs(cover);

    const ogTitle = first(seo.ogTitle, rawTitle, title);
    const ogDescription = first(seo.ogDescription, description);
    const twitterImage = first(seo.twitterImage && abs(seo.twitterImage), coverAbs);

    return {
      // базовое
      title, rawTitle, description, url, origin, siteName, abs,
      canonicalUrl: url,
      focusKeyword: seo.focusKeyword,
      additionalKeywords: seo.additionalKeywords || [],
      // robots
      robots: buildRobots(seo, def),
      // Open Graph
      ogTitle, ogDescription, ogImage: coverAbs,
      ogType: first(seo.ogType, def.ogType, 'article'),
      ogLocale: first(seo.ogLocale, def.ogLocale, 'ru_RU'),
      ogUrl: first(seo.ogUrl && abs(seo.ogUrl), url),
      // Twitter
      twitterCard: first(seo.twitterCard, def.twitterCard, 'summary_large_image'),
      twitterTitle: first(seo.twitterTitle, ogTitle),
      twitterDescription: first(seo.twitterDescription, ogDescription),
      twitterImage,
      // структурированные данные
      schemaType: seo.schemaType || 'Article',
      schemaData: seo.schemaData || {},
      breadcrumbs: (seo.breadcrumbsOverride && seo.breadcrumbsOverride.length)
        ? seo.breadcrumbsOverride
        : defaultBreadcrumbs(post, origin),
      // sitemap
      sitemap: {
        include: seo.sitemapInclude !== false && seo.includeInSitemap !== false && seo.robotsIndex !== false,
        priority: seo.sitemapPriority != null ? seo.sitemapPriority : 0.7,
        changefreq: seo.sitemapChangeFreq || 'monthly',
        lastmod: first(seo.sitemapLastMod, seo.updatedAtSeo, post.dateModified, post.date)
      },
      // авторство
      authorName: first(seo.authorName, post.author, siteName),
      publishedAt: first(seo.publishedAt, post.date),
      updatedAtSeo: first(seo.updatedAtSeo, post.dateModified, post.date),
      publisherName: first(seo.publisherName, siteName),
      publisherLogo: abs(first(seo.publisherLogo, '/apple-touch-icon.png')),
      // локальное SEO и соцсети
      localBusiness: seo.localBusiness || {},
      socialLinks: Object.assign({}, def.socialLinks, seo.socialLinksOverride),
      // head
      customMeta: seo.customMeta || [],
      customLinks: seo.customLinks || [],
      customScripts: seo.customScripts || [],
      customJsonLd: seo.customJsonLd || '',
      customCssClass: seo.customCssClass || '',
      // индексация и AI
      includeInSearch: seo.includeInSearch !== false,
      hideFromInternalSearch: !!seo.hideFromInternalSearch,
      aiDirectives: Object.assign({}, def.aiDirectivesDefault, seo.aiDirectives),
      hreflang: seo.hreflang || [],
      images: seo.images || [],
      // сырые данные для анализа
      _seo: seo, _def: def, _post: post
    };
  }

  /** Подставить %pageTitle% / %siteName% в шаблон заголовка. */
  function applyTitleTemplate(tpl, pageTitle, siteName) {
    if (!tpl) return pageTitle;
    return tpl
      .replace(/%pageTitle%/g, pageTitle)
      .replace(/%siteName%/g, siteName)
      .replace(/%sep%/g, '—')
      .trim();
  }

  /** Собрать содержимое meta robots из флагов. */
  function buildRobots(seo, def) {
    const idx = seo.robotsIndex !== false && def.robotsIndex !== false && seo.includeInSearch !== false;
    const fol = seo.robotsFollow !== false && def.robotsFollow !== false;
    const parts = [idx ? 'index' : 'noindex', fol ? 'follow' : 'nofollow'];
    if (seo.robotsNoarchive) parts.push('noarchive');
    if (seo.robotsNosnippet) parts.push('nosnippet');
    if (seo.robotsNoimageindex) parts.push('noimageindex');
    if (seo.robotsMaxSnippet != null && seo.robotsMaxSnippet !== '')
      parts.push('max-snippet:' + seo.robotsMaxSnippet);
    if (seo.robotsMaxImagePreview) parts.push('max-image-preview:' + seo.robotsMaxImagePreview);
    if (seo.robotsMaxVideoPreview != null && seo.robotsMaxVideoPreview !== '')
      parts.push('max-video-preview:' + seo.robotsMaxVideoPreview);
    return parts.join(', ');
  }

  function defaultBreadcrumbs(post, origin) {
    return [
      { label: 'Главная', url: origin + '/' },
      { label: 'Новости', url: origin + '/news' },
      { label: plain(post.title), url: origin + '/news/' + post.slug }
    ];
  }

  /* ═══════════════════════════════════════════════════════════
     2. Генераторы тегов
     ═══════════════════════════════════════════════════════════ */

  function tagMeta(name, content, prop) {
    if (content === '' || content == null) return '';
    return '<meta ' + (prop ? 'property' : 'name') + '="' + esc(name) +
           '" content="' + esc(content) + '">\n';
  }

  /** Базовые meta: title, description, canonical, robots, keywords. */
  function generateMeta(r) {
    let out = '<title>' + esc(r.title) + '</title>\n';
    out += tagMeta('description', r.description);
    out += '<link rel="canonical" href="' + esc(r.canonicalUrl) + '">\n';
    out += tagMeta('robots', r.robots);
    const kw = [r.focusKeyword].concat(r.additionalKeywords).filter(Boolean);
    if (kw.length) out += tagMeta('keywords', kw.join(', '));
    if (r.authorName) out += tagMeta('author', r.authorName);
    return out;
  }

  /** Open Graph теги. */
  function generateOgTags(r) {
    let out = '';
    out += tagMeta('og:type', r.ogType, true);
    out += tagMeta('og:title', r.ogTitle, true);
    out += tagMeta('og:description', r.ogDescription, true);
    out += tagMeta('og:url', r.ogUrl, true);
    out += tagMeta('og:image', r.ogImage, true);
    out += tagMeta('og:site_name', r.siteName, true);
    out += tagMeta('og:locale', r.ogLocale, true);
    if (r.ogType === 'article') {
      out += tagMeta('article:published_time', r.publishedAt, true);
      out += tagMeta('article:modified_time', r.updatedAtSeo, true);
      if (r._post.categoryTag) out += tagMeta('article:section', r._post.categoryTag, true);
    }
    return out;
  }

  /** Twitter Card теги. */
  function generateTwitterTags(r) {
    let out = '';
    out += tagMeta('twitter:card', r.twitterCard);
    out += tagMeta('twitter:title', r.twitterTitle);
    out += tagMeta('twitter:description', r.twitterDescription);
    out += tagMeta('twitter:image', r.twitterImage);
    return out;
  }

  /** hreflang-ссылки для мультиязычности. */
  function generateHreflang(r) {
    if (!r.hreflang || !r.hreflang.length) return '';
    return r.hreflang.filter(h => h.lang && h.url).map(h =>
      '<link rel="alternate" hreflang="' + esc(h.lang) + '" href="' + esc(r.abs(h.url)) + '">\n'
    ).join('');
  }

  /** Мета-директивы для AI-краулеров. */
  function generateAiDirectives(r) {
    const ai = r.aiDirectives || {};
    let out = '';
    D.aiDirectivesRegistry.metaDirectives.forEach(md => {
      if (ai[md.key] === false && md.whenFalse) {
        out += tagMeta(md.whenFalse.name, md.whenFalse.content);
      }
    });
    if (ai.disallowedAiCrawlers && ai.disallowedAiCrawlers.length) {
      ai.disallowedAiCrawlers.forEach(bot => { out += tagMeta(bot, 'noindex'); });
    }
    return out;
  }

  /** Произвольные теги из вкладки Head. */
  function generateCustomHead(r) {
    let out = '';
    (r.customMeta || []).forEach(m => {
      if (m.name && m.content) out += tagMeta(m.name, m.content, m.property === true);
    });
    (r.customLinks || []).forEach(l => {
      if (l.rel && l.href) {
        out += '<link rel="' + esc(l.rel) + '" href="' + esc(l.href) + '"' +
               (l.type ? ' type="' + esc(l.type) + '"' : '') + '>\n';
      }
    });
    (r.customScripts || []).forEach(s => {
      if (s.src) out += '<script src="' + esc(s.src) + '" defer></' + 'script>\n';
      else if (s.inline) out += '<script>' + s.inline + '</' + 'script>\n';
    });
    return out;
  }

  /* ═══════════════════════════════════════════════════════════
     3. JSON-LD
     ═══════════════════════════════════════════════════════════ */

  /** Контекст, передаваемый в build() схем из реестра. */
  function schemaContext(r) {
    return {
      title: r.rawTitle, description: r.description, url: r.url, origin: r.origin,
      siteName: r.siteName, coverAbs: r.ogImage, abs: r.abs,
      date: r.publishedAt, dateModified: r.updatedAtSeo,
      categoryTag: r._post.categoryTag,
      wordCount: countWords(r._post.bodyHtml || ''),
      publisher: {
        '@type': 'Organization', name: r.publisherName, url: r.origin,
        logo: { '@type': 'ImageObject', url: r.publisherLogo }
      }
    };
  }

  /** BreadcrumbList из разрешённых хлебных крошек. */
  function generateBreadcrumbSchema(r) {
    const items = (r.breadcrumbs || []).filter(b => b.label);
    if (!items.length) return null;
    return {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: items.map((b, i) => ({
        '@type': 'ListItem', position: i + 1, name: b.label, item: r.abs(b.url)
      }))
    };
  }

  /**
   * Все JSON-LD блоки страницы: основная схема + хлебные крошки +
   * LocalBusiness (если заполнен) + произвольный JSON-LD.
   * @returns {Array<Object>}
   */
  function generateJsonLd(r) {
    const out = [];
    const ctx = schemaContext(r);

    const entry = D.schemaRegistry[r.schemaType] || D.schemaRegistry.Article;
    const main = entry.build(r.schemaData || {}, ctx);
    if (main) out.push(main);

    const crumbs = generateBreadcrumbSchema(r);
    if (crumbs) out.push(crumbs);

    // LocalBusiness из вкладки «Локальное SEO» — если заполнено и это не основная схема.
    const lb = r.localBusiness || {};
    if (r.schemaType !== 'LocalBusiness' && (lb.city || lb.address || lb.phone)) {
      out.push(D.prune({
        '@context': 'https://schema.org', '@type': 'LocalBusiness',
        name: r.siteName, url: r.origin, telephone: lb.phone, email: lb.email,
        image: r.ogImage,
        address: D.prune({
          '@type': 'PostalAddress', streetAddress: lb.address,
          addressLocality: lb.city, addressRegion: lb.region,
          postalCode: lb.postalCode, addressCountry: lb.country
        }),
        geo: (lb.lat && lb.lng) ? {
          '@type': 'GeoCoordinates', latitude: String(lb.lat), longitude: String(lb.lng)
        } : undefined,
        openingHours: lb.hours
      }));
    }

    // Профили в соцсетях → Organization.sameAs
    const social = Object.keys(r.socialLinks || {}).map(k => r.socialLinks[k]).filter(Boolean);
    if (social.length) {
      out.push({
        '@context': 'https://schema.org', '@type': 'Organization',
        name: r.siteName, url: r.origin, sameAs: social
      });
    }

    if (r.customJsonLd) {
      try {
        const parsed = JSON.parse(r.customJsonLd);
        (Array.isArray(parsed) ? parsed : [parsed]).forEach(x => out.push(x));
      } catch (e) { /* невалидный JSON — валидатор покажет ошибку в UI */ }
    }

    return out.filter(Boolean);
  }

  /** JSON-LD как готовые <script>-теги. */
  function renderJsonLdTags(r) {
    return generateJsonLd(r).map(o =>
      '<script type="application/ld+json">' + JSON.stringify(o) + '</' + 'script>\n'
    ).join('');
  }

  /**
   * Полный блок <head> SEO-тегов для страницы.
   * Именно эта функция вызывается генератором страниц.
   */
  function generateHead(post, site) {
    const r = resolveSeo(post, site);
    return generateMeta(r) + generateOgTags(r) + generateTwitterTags(r) +
           generateHreflang(r) + generateAiDirectives(r) +
           generateCustomHead(r) + renderJsonLdTags(r);
  }

  /* ═══════════════════════════════════════════════════════════
     4. Sitemap + robots.txt
     ═══════════════════════════════════════════════════════════ */

  function sitemapXml(posts, site, extraUrls) {
    const origin = site.origin;
    const today = new Date().toISOString().slice(0, 10);
    const urls = [
      { loc: origin + '/', lastmod: today, changefreq: 'weekly', priority: '1.0' },
      { loc: origin + '/news', lastmod: today, changefreq: 'weekly', priority: '0.8' }
    ].concat(extraUrls || []);

    posts.forEach(p => {
      const r = resolveSeo(p, site);
      if (!r.sitemap.include) return;
      urls.push({
        loc: r.canonicalUrl,
        lastmod: String(r.sitemap.lastmod || today).slice(0, 10),
        changefreq: r.sitemap.changefreq,
        priority: Number(r.sitemap.priority).toFixed(1)
      });
    });

    const body = urls.map(u =>
      '  <url>\n' +
      '    <loc>' + u.loc + '</loc>\n' +
      '    <lastmod>' + u.lastmod + '</lastmod>\n' +
      '    <changefreq>' + u.changefreq + '</changefreq>\n' +
      '    <priority>' + u.priority + '</priority>\n' +
      '  </url>'
    ).join('\n');

    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n' +
      '        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n' +
      '        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9\n' +
      '        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">\n' +
      body + '\n</urlset>\n';
  }

  /**
   * robots.txt с учётом глобальных AI-директив.
   * @param {Object} site
   * @param {Object} aiDefaults — site.seoDefaults.aiDirectivesDefault
   */
  function robotsTxt(site, aiDefaults) {
    const ai = aiDefaults || {};
    let out = 'User-agent: *\nAllow: /\nDisallow: /404.html\nDisallow: /admin/\n';

    const disallowed = new Set(ai.disallowedAiCrawlers || []);
    // Запрет обучения = закрываем краулеры, собирающие датасеты.
    if (ai.allowModelTraining === false) {
      ['GPTBot', 'CCBot', 'Bytespider', 'meta-externalagent', 'Google-Extended',
       'Applebot-Extended', 'ClaudeBot'].forEach(b => disallowed.add(b));
    }
    (ai.allowedAiCrawlers || []).forEach(b => disallowed.delete(b));

    if (disallowed.size) {
      out += '\n# AI-краулеры\n';
      Array.from(disallowed).forEach(bot => {
        out += 'User-agent: ' + bot + '\nDisallow: /\n\n';
      });
    }

    out += '\nSitemap: ' + site.origin + '/sitemap.xml\nHost: ' +
           site.origin.replace(/^https?:\/\//, '') + '\n';
    return out;
  }

  /* ═══════════════════════════════════════════════════════════
     5. Редиректы (статический сайт: meta-refresh + canonical)
     ═══════════════════════════════════════════════════════════ */

  /**
   * HTML страницы-редиректа. На GitHub Pages нет серверных 301,
   * поэтому используется meta refresh + canonical + JS — Google
   * трактует такой мгновенный редирект как постоянный.
   */
  function redirectPageHtml(rule, site) {
    const to = /^https?:/.test(rule.toPath) ? rule.toPath : site.origin + rule.toPath;
    if (String(rule.statusCode) === '410') {
      return '<!DOCTYPE html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n' +
        '<meta name="robots" content="noindex, nofollow">\n' +
        '<title>Страница удалена — ' + esc(site.name) + '</title>\n</head>\n' +
        '<body style="background:#0a0a0a;color:#f0ede4;font-family:sans-serif;padding:40px;text-align:center">\n' +
        '<h1>Страница удалена</h1>\n<p>Этот материал больше не доступен.</p>\n' +
        '<p><a href="/" style="color:#ff5b1f">На главную</a></p>\n</body>\n</html>\n';
    }
    return '<!DOCTYPE html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n' +
      '<title>Переадресация…</title>\n' +
      '<link rel="canonical" href="' + esc(to) + '">\n' +
      '<meta name="robots" content="noindex, follow">\n' +
      '<meta http-equiv="refresh" content="0; url=' + esc(to) + '">\n' +
      '<script>location.replace(' + JSON.stringify(to) + ');</' + 'script>\n' +
      '</head>\n<body>\n<p>Страница переехала: <a href="' + esc(to) + '">' + esc(to) + '</a></p>\n' +
      '</body>\n</html>\n';
  }

  /** Найти цепочки и циклы редиректов. */
  function findRedirectChains(rules) {
    const map = {};
    rules.forEach(r => { map[r.fromPath] = r.toPath; });
    const problems = [];
    rules.forEach(r => {
      const seen = [r.fromPath];
      let cur = r.toPath;
      let depth = 0;
      while (map[cur] && depth < 10) {
        if (seen.indexOf(cur) !== -1) {
          problems.push({ type: 'loop', path: r.fromPath, chain: seen.concat(cur) });
          return;
        }
        seen.push(cur); cur = map[cur]; depth++;
      }
      if (depth > 0) problems.push({ type: 'chain', path: r.fromPath, chain: seen.concat(cur) });
    });
    return problems;
  }

  /* ═══════════════════════════════════════════════════════════
     6. Валидация в реальном времени
     ═══════════════════════════════════════════════════════════ */

  const LIMITS = {
    title: { min: 30, good: 50, max: 60, hard: 70 },
    description: { min: 70, good: 120, max: 160, hard: 200 },
    alt: { max: 125 }
  };

  /** Оценка длины строки: ok | warn | bad + подсказка. */
  function lengthStatus(value, kind) {
    const L = LIMITS[kind];
    const n = (value || '').length;
    if (!n) return { level: 'bad', n, hint: 'Не заполнено' };
    if (n < L.min) return { level: 'warn', n, hint: `Коротко — лучше от ${L.min} символов` };
    if (n <= L.max) return { level: 'ok', n, hint: 'Оптимальная длина' };
    if (n <= L.hard) return { level: 'warn', n, hint: `Длинновато — обрежется после ~${L.max}` };
    return { level: 'bad', n, hint: `Слишком длинно — обрежется после ~${L.max}` };
  }

  /**
   * Проверки заполнения SEO-полей страницы.
   * @returns {Array<{level:'error'|'warn'|'info', field:string, message:string}>}
   */
  function validateSeo(post, site) {
    const r = resolveSeo(post, site);
    const out = [];
    const add = (level, field, message) => out.push({ level, field, message });

    const t = lengthStatus(r.title, 'title');
    if (t.level === 'bad') add('error', 'seoTitle', 'Заголовок: ' + t.hint);
    else if (t.level === 'warn') add('warn', 'seoTitle', 'Заголовок: ' + t.hint);

    const d = lengthStatus(r.description, 'description');
    if (d.level === 'bad') add('error', 'metaDescription', 'Описание: ' + d.hint);
    else if (d.level === 'warn') add('warn', 'metaDescription', 'Описание: ' + d.hint);

    if (!r.ogImage) add('error', 'ogImage', 'Нет изображения для соцсетей (og:image)');
    if (!r.canonicalUrl) add('error', 'canonicalUrl', 'Не задан canonical');

    if (r.focusKeyword) {
      const kw = r.focusKeyword.toLowerCase();
      if (r.title.toLowerCase().indexOf(kw) === -1)
        add('warn', 'focusKeyword', 'Ключевого слова нет в заголовке');
      if (r.description.toLowerCase().indexOf(kw) === -1)
        add('warn', 'focusKeyword', 'Ключевого слова нет в описании');
      if (plain(post.bodyHtml || '').toLowerCase().indexOf(kw) === -1)
        add('warn', 'focusKeyword', 'Ключевого слова нет в тексте страницы');
    } else {
      add('info', 'focusKeyword', 'Не задано фокусное ключевое слово');
    }

    if (r.robots.indexOf('noindex') !== -1)
      add('warn', 'robotsIndex', 'Страница закрыта от индексации (noindex)');
    if (!r.sitemap.include)
      add('info', 'sitemapInclude', 'Страница исключена из sitemap.xml');

    if (r.customJsonLd) {
      const err = D.validators.json(r.customJsonLd);
      if (err !== true) add('error', 'customJsonLd', 'Свой JSON-LD: ' + err);
    }

    // Изображения
    (r.images || []).forEach((im, i) => {
      if (!im.alt) add('warn', 'images', `Изображение №${i + 1}: нет alt-текста`);
      else if (im.alt.length > LIMITS.alt.max)
        add('warn', 'images', `Изображение №${i + 1}: alt длиннее ${LIMITS.alt.max} символов`);
    });

    return out;
  }

  /* ═══════════════════════════════════════════════════════════
     7. SEO-анализ отрендеренной страницы
     ═══════════════════════════════════════════════════════════ */

  function countWords(html) {
    const t = plain(html);
    return t ? t.split(/\s+/).filter(Boolean).length : 0;
  }

  /**
   * Статический анализ страницы: заголовки, alt, ссылки, ключевое слово,
   * дубли title/description по сайту.
   * @param {Object} post
   * @param {Object} site
   * @param {Array} allPosts — для поиска дублей
   * @returns {Object} SeoAnalysisResult
   */
  function analyzeSeo(post, site, allPosts) {
    const r = resolveSeo(post, site);
    const body = post.bodyHtml || '';
    const checks = [];
    const add = (id, label, passed, level, detail) =>
      checks.push({ id, label, passed, level: level || 'warn', detail: detail || '' });

    // --- Контент
    const words = countWords(body);
    add('content-length', 'Объём текста', words >= 300, words >= 150 ? 'warn' : 'error',
      words + ' слов' + (words < 300 ? ' — желательно от 300' : ''));

    const h2 = (body.match(/<h2[\s>]/gi) || []).length;
    const h3 = (body.match(/<h3[\s>]/gi) || []).length;
    add('headings', 'Подзаголовки H2/H3', h2 + h3 >= 2, 'warn',
      `H2: ${h2}, H3: ${h3}` + (h2 + h3 < 2 ? ' — разбейте текст на разделы' : ''));

    add('h1-unique', 'Один H1 на странице', !/<h1[\s>]/i.test(body), 'error',
      /<h1[\s>]/i.test(body) ? 'В теле статьи есть H1 — он должен быть только у заголовка' : 'ОК');

    // --- Изображения
    const imgs = body.match(/<img[^>]*>/gi) || [];
    const noAlt = imgs.filter(t => !/alt\s*=\s*["'][^"']+["']/i.test(t));
    add('img-alt', 'Alt у изображений в тексте', noAlt.length === 0, 'warn',
      imgs.length ? `${imgs.length - noAlt.length} из ${imgs.length} с alt` : 'Изображений нет');

    const lazy = imgs.filter(t => /loading\s*=\s*["']lazy["']/i.test(t));
    add('img-lazy', 'Ленивая загрузка изображений',
      imgs.length === 0 || lazy.length === imgs.length, 'info',
      imgs.length ? `${lazy.length} из ${imgs.length}` : '—');

    add('og-image', 'Изображение для соцсетей', !!r.ogImage, 'error',
      r.ogImage || 'Не задано');

    // --- Ссылки
    const links = body.match(/<a[^>]+href=["']([^"']+)["']/gi) || [];
    const internal = links.filter(l => /href=["']\/(?!\/)/i.test(l)).length;
    const external = links.length - internal;
    add('internal-links', 'Внутренние ссылки', internal >= 1, 'warn',
      `внутренних: ${internal}, внешних: ${external}`);

    // --- Мета
    const t = lengthStatus(r.title, 'title');
    add('title-length', 'Длина заголовка', t.level === 'ok', t.level === 'bad' ? 'error' : 'warn',
      `${t.n} символов — ${t.hint}`);

    const d = lengthStatus(r.description, 'description');
    add('desc-length', 'Длина описания', d.level === 'ok', d.level === 'bad' ? 'error' : 'warn',
      `${d.n} символов — ${d.hint}`);

    add('canonical', 'Canonical URL', !!r.canonicalUrl, 'error', r.canonicalUrl);
    add('indexable', 'Открыта для индексации', r.robots.indexOf('noindex') === -1, 'error', r.robots);
    add('in-sitemap', 'Есть в sitemap.xml', r.sitemap.include, 'warn',
      r.sitemap.include ? 'да' : 'исключена');

    // --- Структурированные данные
    const ld = generateJsonLd(r);
    add('schema', 'Структурированные данные', ld.length > 0, 'warn',
      ld.length ? ld.map(x => x['@type']).join(', ') : 'нет');
    add('breadcrumbs', 'Хлебные крошки в разметке',
      ld.some(x => x['@type'] === 'BreadcrumbList'), 'info', '');

    // --- Ключевое слово
    if (r.focusKeyword) {
      const kw = r.focusKeyword.toLowerCase();
      const text = plain(body).toLowerCase();
      const occurrences = kw ? (text.split(kw).length - 1) : 0;
      const density = words ? (occurrences * kw.split(/\s+/).length / words * 100) : 0;
      add('kw-title', 'Ключевое слово в заголовке',
        r.title.toLowerCase().indexOf(kw) !== -1, 'warn', '');
      add('kw-desc', 'Ключевое слово в описании',
        r.description.toLowerCase().indexOf(kw) !== -1, 'warn', '');
      add('kw-slug', 'Ключевое слово в URL',
        String(post.slug || '').indexOf(kw.replace(/\s+/g, '-')) !== -1, 'info', post.slug);
      add('kw-body', 'Ключевое слово в тексте', occurrences > 0, 'warn',
        `встречается ${occurrences} раз, плотность ${density.toFixed(1)}%`);
      add('kw-density', 'Плотность ключевого слова',
        density >= 0.3 && density <= 3, 'info',
        density > 3 ? 'Переспам — снизьте частоту' : `${density.toFixed(1)}%`);
    } else {
      add('kw-set', 'Задано фокусное ключевое слово', false, 'warn', 'не задано');
    }

    // --- Дубли по сайту
    if (allPosts && allPosts.length) {
      const dupTitle = allPosts.filter(p =>
        p.slug !== post.slug && plain(resolveSeo(p, site).title) === plain(r.title));
      const dupDesc = allPosts.filter(p =>
        p.slug !== post.slug && plain(resolveSeo(p, site).description) === plain(r.description));
      add('dup-title', 'Уникальный заголовок', dupTitle.length === 0, 'error',
        dupTitle.length ? 'дубль с: ' + dupTitle.map(p => p.slug).join(', ') : 'уникален');
      add('dup-desc', 'Уникальное описание', dupDesc.length === 0, 'error',
        dupDesc.length ? 'дубль с: ' + dupDesc.map(p => p.slug).join(', ') : 'уникально');
    }

    return {
      checks,
      words,
      passed: checks.filter(c => c.passed).length,
      total: checks.length
    };
  }

  /* ═══════════════════════════════════════════════════════════
     8. SEO Score (0–100)
     ═══════════════════════════════════════════════════════════ */

  const SCORE_WEIGHT = { error: 3, warn: 2, info: 1 };

  /**
   * Взвешенный балл: критичные проверки весят больше.
   * @returns {{score:number, grade:string, label:string, color:string, failed:Array}}
   */
  function calculateSeoScore(analysis) {
    let max = 0, got = 0;
    analysis.checks.forEach(c => {
      const w = SCORE_WEIGHT[c.level] || 1;
      max += w;
      if (c.passed) got += w;
    });
    const score = max ? Math.round(got / max * 100) : 0;
    let grade, label, color;
    if (score >= 90) { grade = 'excellent'; label = 'Отлично'; color = '#46d369'; }
    else if (score >= 70) { grade = 'good'; label = 'Хорошо'; color = '#9ad34a'; }
    else if (score >= 40) { grade = 'needs-improvement'; label = 'Требует доработки'; color = '#ffb347'; }
    else { grade = 'critical'; label = 'Критично'; color = '#ff5252'; }

    return {
      score, grade, label, color,
      failed: analysis.checks.filter(c => !c.passed)
        .sort((a, b) => (SCORE_WEIGHT[b.level] || 1) - (SCORE_WEIGHT[a.level] || 1))
    };
  }

  /* ═══════════════════════════════════════════════════════════
     9. Автоматизация
     ═══════════════════════════════════════════════════════════ */

  /** Заголовок по шаблону из глобальных настроек. */
  function autoGenerateTitle(post, site) {
    const def = Object.assign({}, D.emptySiteDefaults(), (site && site.seoDefaults) || {});
    return applyTitleTemplate(def.titleTemplate, plain(post.title), site.name || '');
  }

  /**
   * Описание из текста статьи (без ИИ — извлекающая эвристика).
   * Берёт первое содержательное предложение и добирает до ~155 символов.
   */
  function autoGenerateDescription(post) {
    const text = plain(post.bodyHtml || post.description || '');
    if (!text) return '';
    const sentences = text.split(/(?<=[.!?])\s+/);
    let out = '';
    for (const s of sentences) {
      if ((out + ' ' + s).trim().length > LIMITS.description.max) break;
      out = (out + ' ' + s).trim();
      if (out.length >= LIMITS.description.good) break;
    }
    if (!out) out = text.slice(0, LIMITS.description.max);
    return out.length > LIMITS.description.hard
      ? out.slice(0, LIMITS.description.max - 1).trimEnd() + '…'
      : out;
  }

  /**
   * Alt-текст изображения из заголовка страницы и имени файла.
   * Имя файла добавляется только если несёт новую информацию —
   * загруженные из админки файлы названы транслитом заголовка,
   * и приписывать его второй раз бессмысленно.
   */
  function autoGenerateAltText(post, imageUrl) {
    const base = plain(post.title);
    const file = String(imageUrl || '').split('/').pop().replace(/\.[a-z0-9]+$/i, '')
      .replace(/-[a-z0-9]{6,}$/i, '').replace(/[-_]+/g, ' ').trim();
    // Транслит заголовка → имя файла ничего не добавляет.
    const looksLikeSlugOfTitle = file &&
      file.replace(/\s+/g, '').length > 0 &&
      base.length > 0 &&
      file.split(/\s+/).filter(w => w.length > 2).length >= 3;
    const generic = !file || file.length <= 3 || /^(img|photo|image|dsc|scan)\b/i.test(file);
    const alt = (generic || looksLikeSlugOfTitle) ? base : base + ' — ' + file;
    return alt.slice(0, LIMITS.alt.max);
  }

  /** Canonical по slug. */
  function autoGenerateCanonical(post, site) {
    return (site.origin || '') + '/news/' + post.slug;
  }

  /** Хлебные крошки по умолчанию. */
  function autoGenerateBreadcrumbs(post, site) {
    return defaultBreadcrumbs(post, site.origin || '');
  }

  /** Предзаполнить schemaData основной схемы значениями страницы. */
  function autoGenerateSchema(post, site, schemaType) {
    const r = resolveSeo(post, site);
    const type = schemaType || r.schemaType;
    const common = {
      headline: r.rawTitle, name: r.rawTitle,
      description: r.description, image: post.cover || '',
      datePublished: r.publishedAt, dateModified: r.updatedAtSeo,
      author: r.authorName, articleSection: post.categoryTag || ''
    };
    const entry = D.schemaRegistry[type];
    if (!entry) return {};
    const out = {};
    entry.fields.forEach(f => { if (common[f.name] !== undefined) out[f.name] = common[f.name]; });
    return out;
  }

  /** OG-теги из основных полей. */
  function autoGenerateOg(post, site) {
    const r = resolveSeo(post, site);
    return {
      ogTitle: r.rawTitle, ogDescription: r.description,
      ogImage: post.cover || '', ogType: 'article', ogLocale: 'ru_RU', ogUrl: r.url
    };
  }

  function autoGenerateTwitter(post, site) {
    const r = resolveSeo(post, site);
    return {
      twitterCard: 'summary_large_image', twitterTitle: r.rawTitle,
      twitterDescription: r.description, twitterImage: post.cover || ''
    };
  }

  /** Собрать список изображений страницы (обложка + картинки из текста). */
  function collectPageImages(post) {
    const out = [];
    if (post.cover) out.push({ url: post.cover, source: 'cover' });
    const re = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let m;
    while ((m = re.exec(post.bodyHtml || ''))) {
      const tag = m[0];
      const altMatch = tag.match(/alt\s*=\s*["']([^"']*)["']/i);
      out.push({ url: m[1], source: 'body', alt: altMatch ? altMatch[1] : '' });
    }
    return out;
  }

  return {
    // разрешение и генерация
    resolveSeo, generateHead, generateMeta, generateOgTags, generateTwitterTags,
    generateHreflang, generateAiDirectives, generateCustomHead,
    generateJsonLd, generateBreadcrumbSchema, renderJsonLdTags, schemaContext,
    applyTitleTemplate, buildRobots,
    // sitemap / robots / редиректы
    sitemapXml, robotsTxt, redirectPageHtml, findRedirectChains,
    // валидация и анализ
    validateSeo, lengthStatus, LIMITS, analyzeSeo, calculateSeoScore, countWords,
    // автоматизация
    autoGenerateTitle, autoGenerateDescription, autoGenerateAltText,
    autoGenerateCanonical, autoGenerateBreadcrumbs, autoGenerateSchema,
    autoGenerateOg, autoGenerateTwitter, collectPageImages,
    // утилиты
    esc, plain, first
  };
});
