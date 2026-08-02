/* ─────────────────────────────────────────────────────────────
   РЕМСИТИ·36 — SEO module · DOMAIN layer
   Типы, enum-константы и реестры. Без DOM и без Node API —
   файл одинаково грузится в браузере (админка) и в Node (build.js).

   Расширяемость: новый тип Schema.org / канал превью / AI-краулер
   добавляется ОДНОЙ записью в соответствующий реестр, без правок
   существующих компонентов.
─────────────────────────────────────────────────────────────── */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SeoDomain = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
     1. ENUM-константы (аналог TS union-типов)
     ═══════════════════════════════════════════════════════════ */

  /** @typedef {'website'|'article'|'product'|'service'|'profile'|'video'|'book'|'music'} OgType */
  const OG_TYPES = [
    { value: 'website', label: 'Website — обычная страница' },
    { value: 'article', label: 'Article — статья/новость' },
    { value: 'product', label: 'Product — товар' },
    { value: 'service', label: 'Service — услуга' },
    { value: 'profile', label: 'Profile — профиль' },
    { value: 'video', label: 'Video — видео' },
    { value: 'book', label: 'Book — книга' },
    { value: 'music', label: 'Music — музыка' }
  ];

  /** @typedef {'summary'|'summary_large_image'} TwitterCard */
  const TWITTER_CARDS = [
    { value: 'summary_large_image', label: 'Большая картинка (рекомендуется)' },
    { value: 'summary', label: 'Компактная карточка' }
  ];

  /** @typedef {'always'|'hourly'|'daily'|'weekly'|'monthly'|'yearly'|'never'} ChangeFreq */
  const CHANGE_FREQ = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']
    .map(v => ({ value: v, label: v }));

  /** @typedef {'none'|'standard'|'large'} MaxImagePreview */
  const MAX_IMAGE_PREVIEW = [
    { value: '', label: 'По умолчанию' },
    { value: 'large', label: 'large — большое превью' },
    { value: 'standard', label: 'standard — обычное' },
    { value: 'none', label: 'none — без превью' }
  ];

  /** @typedef {301|302|307|308|410} RedirectStatusCode */
  const REDIRECT_CODES = [
    { value: '301', label: '301 — Moved Permanently (передаёт вес)' },
    { value: '302', label: '302 — Found (временный)' },
    { value: '307', label: '307 — Temporary Redirect' },
    { value: '308', label: '308 — Permanent Redirect' },
    { value: '410', label: '410 — Gone (страница удалена навсегда)' }
  ];

  const OG_LOCALES = [
    { value: 'ru_RU', label: 'ru_RU — русский' },
    { value: 'en_US', label: 'en_US — английский' }
  ];

  /* ═══════════════════════════════════════════════════════════
     2. Значения по умолчанию (пустая SEO-модель страницы)
     ═══════════════════════════════════════════════════════════ */

  /**
   * Пустая SEO-модель. Все поля опциональны: пустое поле означает
   * «наследовать из site.seoDefaults» — см. application/resolve*.
   * @returns {Object} PageSeoModel
   */
  function emptyPageSeo() {
    return {
      // 1. Основное SEO
      seoTitle: '', metaDescription: '', canonicalUrl: '',
      focusKeyword: '', additionalKeywords: [],
      robotsIndex: true, robotsFollow: true,
      robotsNoarchive: false, robotsNosnippet: false, robotsNoimageindex: false,
      robotsMaxSnippet: null, robotsMaxImagePreview: '', robotsMaxVideoPreview: null,
      // 3. Open Graph
      ogTitle: '', ogDescription: '', ogImage: '', ogType: '', ogLocale: '', ogUrl: '',
      // 4. Twitter
      twitterTitle: '', twitterDescription: '', twitterImage: '', twitterCard: '',
      // 5. Structured Data
      schemaType: '', schemaData: {},
      // 6. Sitemap
      sitemapInclude: true, sitemapPriority: 0.7,
      sitemapChangeFreq: 'monthly', sitemapLastMod: '',
      // 7. Хлебные крошки
      breadcrumbsOverride: [],
      // 8. Изображения
      images: [],
      // 9. Авторство
      authorName: '', publishedAt: '', updatedAtSeo: '',
      publisherName: '', publisherLogo: '',
      // 10. Локальное SEO
      localBusiness: {},
      // 11. Соцсети (override)
      socialLinksOverride: {},
      // 13. Head
      customMeta: [], customLinks: [], customScripts: [],
      customJsonLd: '', customCssClass: '',
      // 14. Индексация
      includeInSearch: true, includeInSitemap: true, hideFromInternalSearch: false,
      // 15. AI-директивы
      aiDirectives: {
        allowAiOverview: true, allowGenerativeAnswers: true, allowModelTraining: true,
        allowedAiCrawlers: [], disallowedAiCrawlers: []
      },
      // hreflang
      hreflang: []
    };
  }

  /**
   * Глобальные значения по умолчанию (site.seoDefaults).
   * @returns {Object} SiteSeoDefaults
   */
  function emptySiteDefaults() {
    return {
      titleTemplate: '%pageTitle% — %siteName%',
      metaDescription: '',
      ogImage: '/og-image.jpg',
      ogType: 'article',
      ogLocale: 'ru_RU',
      twitterCard: 'summary_large_image',
      robotsIndex: true,
      robotsFollow: true,
      organizationSchema: {},
      socialLinks: {},
      aiDirectivesDefault: {
        allowAiOverview: true, allowGenerativeAnswers: true, allowModelTraining: true,
        allowedAiCrawlers: [], disallowedAiCrawlers: []
      }
    };
  }

  /* ═══════════════════════════════════════════════════════════
     3. Schema.org registry — 16 типов
     Каждый тип: label, поля формы, build(data, ctx) → JSON-LD объект.
     Добавление нового типа = добавление записи здесь.
     ═══════════════════════════════════════════════════════════ */

  // Служебное: убрать пустые значения из JSON-LD, чтобы не отдавать null в разметке.
  function prune(obj) {
    if (Array.isArray(obj)) {
      const arr = obj.map(prune).filter(v => v !== undefined && v !== null && v !== '');
      return arr.length ? arr : undefined;
    }
    if (obj && typeof obj === 'object') {
      const out = {};
      Object.keys(obj).forEach(k => {
        const v = prune(obj[k]);
        if (v !== undefined && v !== null && v !== '') out[k] = v;
      });
      return Object.keys(out).length ? out : undefined;
    }
    return obj;
  }

  // Общие поля-конструкторы для реестра схем
  const F = {
    text: (name, label, hint) => ({ name, label, type: 'text', hint }),
    area: (name, label, hint) => ({ name, label, type: 'textarea', hint }),
    num: (name, label, hint) => ({ name, label, type: 'number', hint }),
    date: (name, label, hint) => ({ name, label, type: 'date', hint }),
    img: (name, label, hint) => ({ name, label, type: 'image', hint }),
    list: (name, label, itemFields, hint) => ({ name, label, type: 'list', itemFields, hint }),
    sel: (name, label, options, hint) => ({ name, label, type: 'select', options, hint })
  };

  const schemaRegistry = {
    Article: {
      label: 'Article — статья',
      hint: 'Универсальный тип для статей. Даёт расширенный сниппет с картинкой и датой.',
      fields: [
        F.text('headline', 'Заголовок', 'До 110 символов'),
        F.area('description', 'Описание'),
        F.img('image', 'Изображение'),
        F.date('datePublished', 'Опубликовано'),
        F.date('dateModified', 'Обновлено'),
        F.text('author', 'Автор'),
        F.text('articleSection', 'Раздел')
      ],
      build: (d, ctx) => prune({
        '@context': 'https://schema.org', '@type': 'Article',
        headline: d.headline || ctx.title,
        description: d.description || ctx.description,
        image: [d.image ? ctx.abs(d.image) : ctx.coverAbs],
        datePublished: d.datePublished || ctx.date,
        dateModified: d.dateModified || ctx.dateModified || ctx.date,
        articleSection: d.articleSection || ctx.categoryTag,
        author: { '@type': 'Organization', name: d.author || ctx.siteName, url: ctx.origin },
        publisher: ctx.publisher,
        mainEntityOfPage: { '@type': 'WebPage', '@id': ctx.url }
      })
    },

    BlogPosting: {
      label: 'BlogPosting — запись блога',
      hint: 'Подтип Article для блога/журнала.',
      fields: [
        F.text('headline', 'Заголовок'), F.area('description', 'Описание'),
        F.img('image', 'Изображение'), F.date('datePublished', 'Опубликовано'),
        F.date('dateModified', 'Обновлено'), F.text('author', 'Автор'),
        F.num('wordCount', 'Количество слов')
      ],
      build: (d, ctx) => prune({
        '@context': 'https://schema.org', '@type': 'BlogPosting',
        headline: d.headline || ctx.title,
        description: d.description || ctx.description,
        image: [d.image ? ctx.abs(d.image) : ctx.coverAbs],
        datePublished: d.datePublished || ctx.date,
        dateModified: d.dateModified || ctx.dateModified || ctx.date,
        wordCount: d.wordCount ? Number(d.wordCount) : ctx.wordCount,
        author: { '@type': 'Organization', name: d.author || ctx.siteName, url: ctx.origin },
        publisher: ctx.publisher,
        mainEntityOfPage: { '@type': 'WebPage', '@id': ctx.url }
      })
    },

    NewsArticle: {
      label: 'NewsArticle — новость',
      hint: 'Для новостных материалов. Может попасть в новостную выдачу.',
      fields: [
        F.text('headline', 'Заголовок'), F.area('description', 'Описание'),
        F.img('image', 'Изображение'), F.date('datePublished', 'Опубликовано'),
        F.date('dateModified', 'Обновлено'), F.text('author', 'Автор'),
        F.text('dateline', 'Место события')
      ],
      build: (d, ctx) => prune({
        '@context': 'https://schema.org', '@type': 'NewsArticle',
        headline: d.headline || ctx.title,
        description: d.description || ctx.description,
        image: [d.image ? ctx.abs(d.image) : ctx.coverAbs],
        datePublished: d.datePublished || ctx.date,
        dateModified: d.dateModified || ctx.dateModified || ctx.date,
        dateline: d.dateline,
        author: { '@type': 'Organization', name: d.author || ctx.siteName, url: ctx.origin },
        publisher: ctx.publisher,
        mainEntityOfPage: { '@type': 'WebPage', '@id': ctx.url }
      })
    },

    FAQPage: {
      label: 'FAQPage — вопросы и ответы',
      hint: 'Даёт раскрывающиеся вопросы прямо в выдаче. Вопросы должны быть на странице.',
      fields: [
        F.list('questions', 'Вопросы', [
          F.text('q', 'Вопрос'), F.area('a', 'Ответ')
        ], 'Минимум 2 вопроса для показа в выдаче')
      ],
      build: (d) => {
        const items = (d.questions || []).filter(x => x.q && x.a);
        if (!items.length) return null;
        return {
          '@context': 'https://schema.org', '@type': 'FAQPage',
          mainEntity: items.map(x => ({
            '@type': 'Question', name: x.q,
            acceptedAnswer: { '@type': 'Answer', text: x.a }
          }))
        };
      }
    },

    HowTo: {
      label: 'HowTo — инструкция',
      hint: 'Пошаговая инструкция. Показывается с нумерованными шагами.',
      fields: [
        F.text('name', 'Название инструкции'), F.area('description', 'Описание'),
        F.text('totalTime', 'Время выполнения', 'ISO 8601, напр. PT30M'),
        F.list('steps', 'Шаги', [F.text('name', 'Название шага'), F.area('text', 'Описание')])
      ],
      build: (d, ctx) => {
        const steps = (d.steps || []).filter(s => s.text || s.name);
        if (!steps.length) return null;
        return prune({
          '@context': 'https://schema.org', '@type': 'HowTo',
          name: d.name || ctx.title, description: d.description || ctx.description,
          totalTime: d.totalTime,
          step: steps.map((s, i) => prune({
            '@type': 'HowToStep', position: i + 1, name: s.name, text: s.text
          }))
        });
      }
    },

    Product: {
      label: 'Product — товар',
      hint: 'Цена, наличие и рейтинг прямо в выдаче.',
      fields: [
        F.text('name', 'Название'), F.area('description', 'Описание'), F.img('image', 'Фото'),
        F.text('brand', 'Бренд'), F.text('sku', 'Артикул'),
        F.num('price', 'Цена'), F.text('priceCurrency', 'Валюта', 'напр. RUB'),
        F.sel('availability', 'Наличие', [
          { value: 'https://schema.org/InStock', label: 'В наличии' },
          { value: 'https://schema.org/OutOfStock', label: 'Нет в наличии' },
          { value: 'https://schema.org/PreOrder', label: 'Предзаказ' }
        ]),
        F.num('ratingValue', 'Рейтинг'), F.num('reviewCount', 'Количество отзывов')
      ],
      build: (d, ctx) => prune({
        '@context': 'https://schema.org', '@type': 'Product',
        name: d.name || ctx.title, description: d.description || ctx.description,
        image: d.image ? ctx.abs(d.image) : ctx.coverAbs,
        sku: d.sku,
        brand: d.brand ? { '@type': 'Brand', name: d.brand } : undefined,
        offers: d.price ? {
          '@type': 'Offer', price: String(d.price),
          priceCurrency: d.priceCurrency || 'RUB',
          availability: d.availability || 'https://schema.org/InStock',
          url: ctx.url
        } : undefined,
        aggregateRating: d.ratingValue ? {
          '@type': 'AggregateRating',
          ratingValue: String(d.ratingValue), reviewCount: String(d.reviewCount || 1)
        } : undefined
      })
    },

    Service: {
      label: 'Service — услуга',
      hint: 'Для страниц услуг: что делаете, где и за сколько.',
      fields: [
        F.text('name', 'Название услуги'), F.area('description', 'Описание'),
        F.text('serviceType', 'Тип услуги'), F.text('areaServed', 'Область обслуживания'),
        F.text('providerName', 'Исполнитель'),
        F.num('priceFrom', 'Цена от'), F.text('priceCurrency', 'Валюта', 'напр. RUB')
      ],
      build: (d, ctx) => prune({
        '@context': 'https://schema.org', '@type': 'Service',
        name: d.name || ctx.title, description: d.description || ctx.description,
        serviceType: d.serviceType, areaServed: d.areaServed,
        provider: { '@type': 'LocalBusiness', name: d.providerName || ctx.siteName, url: ctx.origin },
        offers: d.priceFrom ? {
          '@type': 'Offer', price: String(d.priceFrom),
          priceCurrency: d.priceCurrency || 'RUB', url: ctx.url
        } : undefined
      })
    },

    Organization: {
      label: 'Organization — организация',
      fields: [
        F.text('name', 'Название'), F.area('description', 'Описание'),
        F.img('logo', 'Логотип'), F.text('url', 'Сайт'), F.text('telephone', 'Телефон'),
        F.text('email', 'Email'), F.text('taxID', 'ИНН'),
        F.list('sameAs', 'Профили в соцсетях', [F.text('url', 'Ссылка')])
      ],
      build: (d, ctx) => prune({
        '@context': 'https://schema.org', '@type': 'Organization',
        name: d.name || ctx.siteName, description: d.description,
        url: d.url || ctx.origin,
        logo: d.logo ? ctx.abs(d.logo) : ctx.origin + '/apple-touch-icon.png',
        telephone: d.telephone, email: d.email, taxID: d.taxID,
        sameAs: (d.sameAs || []).map(x => x.url).filter(Boolean)
      })
    },

    LocalBusiness: {
      label: 'LocalBusiness — локальный бизнес',
      hint: 'Адрес, часы работы и телефон в выдаче и на картах.',
      fields: [
        F.text('name', 'Название'), F.area('description', 'Описание'),
        F.img('image', 'Фото'), F.text('telephone', 'Телефон'),
        F.text('streetAddress', 'Улица, дом'), F.text('addressLocality', 'Город'),
        F.text('addressRegion', 'Область'), F.text('postalCode', 'Индекс'),
        F.text('addressCountry', 'Страна', 'Код, напр. RU'),
        F.text('latitude', 'Широта'), F.text('longitude', 'Долгота'),
        F.text('openingHours', 'Часы работы', 'напр. Mo-Su 09:00-21:00'),
        F.text('priceRange', 'Ценовой диапазон', 'напр. ₽₽')
      ],
      build: (d, ctx) => prune({
        '@context': 'https://schema.org', '@type': 'LocalBusiness',
        name: d.name || ctx.siteName, description: d.description, url: ctx.origin,
        image: d.image ? ctx.abs(d.image) : ctx.coverAbs,
        telephone: d.telephone, priceRange: d.priceRange,
        address: (d.streetAddress || d.addressLocality) ? prune({
          '@type': 'PostalAddress',
          streetAddress: d.streetAddress, addressLocality: d.addressLocality,
          addressRegion: d.addressRegion, postalCode: d.postalCode,
          addressCountry: d.addressCountry
        }) : undefined,
        geo: (d.latitude && d.longitude) ? {
          '@type': 'GeoCoordinates', latitude: String(d.latitude), longitude: String(d.longitude)
        } : undefined,
        openingHours: d.openingHours
      })
    },

    Person: {
      label: 'Person — человек',
      fields: [
        F.text('name', 'Имя'), F.text('jobTitle', 'Должность'),
        F.img('image', 'Фото'), F.area('description', 'О себе'),
        F.text('url', 'Сайт'), F.list('sameAs', 'Профили', [F.text('url', 'Ссылка')])
      ],
      build: (d, ctx) => prune({
        '@context': 'https://schema.org', '@type': 'Person',
        name: d.name, jobTitle: d.jobTitle, description: d.description,
        image: d.image ? ctx.abs(d.image) : undefined, url: d.url,
        sameAs: (d.sameAs || []).map(x => x.url).filter(Boolean)
      })
    },

    Review: {
      label: 'Review — отзыв',
      fields: [
        F.text('itemName', 'Что оценивается'), F.text('author', 'Автор отзыва'),
        F.num('ratingValue', 'Оценка'), F.num('bestRating', 'Максимум', 'обычно 5'),
        F.area('reviewBody', 'Текст отзыва'), F.date('datePublished', 'Дата')
      ],
      build: (d, ctx) => {
        if (!d.itemName || !d.ratingValue) return null;
        return prune({
          '@context': 'https://schema.org', '@type': 'Review',
          itemReviewed: { '@type': 'Thing', name: d.itemName },
          author: { '@type': 'Person', name: d.author || 'Аноним' },
          reviewRating: {
            '@type': 'Rating', ratingValue: String(d.ratingValue),
            bestRating: String(d.bestRating || 5)
          },
          reviewBody: d.reviewBody, datePublished: d.datePublished || ctx.date
        });
      }
    },

    Recipe: {
      label: 'Recipe — рецепт',
      fields: [
        F.text('name', 'Название'), F.area('description', 'Описание'), F.img('image', 'Фото'),
        F.text('prepTime', 'Подготовка', 'ISO 8601, напр. PT15M'),
        F.text('cookTime', 'Приготовление', 'напр. PT30M'),
        F.text('recipeYield', 'Выход', 'напр. 4 порции'),
        F.list('ingredients', 'Ингредиенты', [F.text('item', 'Ингредиент')]),
        F.list('steps', 'Шаги', [F.area('text', 'Описание шага')])
      ],
      build: (d, ctx) => prune({
        '@context': 'https://schema.org', '@type': 'Recipe',
        name: d.name || ctx.title, description: d.description || ctx.description,
        image: d.image ? ctx.abs(d.image) : ctx.coverAbs,
        prepTime: d.prepTime, cookTime: d.cookTime, recipeYield: d.recipeYield,
        recipeIngredient: (d.ingredients || []).map(x => x.item).filter(Boolean),
        recipeInstructions: (d.steps || []).filter(s => s.text)
          .map(s => ({ '@type': 'HowToStep', text: s.text }))
      })
    },

    VideoObject: {
      label: 'VideoObject — видео',
      fields: [
        F.text('name', 'Название'), F.area('description', 'Описание'),
        F.img('thumbnailUrl', 'Обложка'), F.text('contentUrl', 'Ссылка на видео'),
        F.text('embedUrl', 'Ссылка для встраивания'),
        F.date('uploadDate', 'Дата загрузки'), F.text('duration', 'Длительность', 'напр. PT2M30S')
      ],
      build: (d, ctx) => {
        if (!d.name) return null;
        return prune({
          '@context': 'https://schema.org', '@type': 'VideoObject',
          name: d.name, description: d.description || ctx.description,
          thumbnailUrl: d.thumbnailUrl ? ctx.abs(d.thumbnailUrl) : ctx.coverAbs,
          contentUrl: d.contentUrl, embedUrl: d.embedUrl,
          uploadDate: d.uploadDate || ctx.date, duration: d.duration
        });
      }
    },

    SoftwareApplication: {
      label: 'SoftwareApplication — приложение',
      fields: [
        F.text('name', 'Название'), F.area('description', 'Описание'),
        F.text('operatingSystem', 'ОС'), F.text('applicationCategory', 'Категория'),
        F.num('price', 'Цена'), F.text('priceCurrency', 'Валюта'),
        F.num('ratingValue', 'Рейтинг'), F.num('ratingCount', 'Количество оценок')
      ],
      build: (d, ctx) => prune({
        '@context': 'https://schema.org', '@type': 'SoftwareApplication',
        name: d.name || ctx.title, description: d.description || ctx.description,
        operatingSystem: d.operatingSystem, applicationCategory: d.applicationCategory,
        offers: d.price !== undefined && d.price !== '' ? {
          '@type': 'Offer', price: String(d.price), priceCurrency: d.priceCurrency || 'RUB'
        } : undefined,
        aggregateRating: d.ratingValue ? {
          '@type': 'AggregateRating', ratingValue: String(d.ratingValue),
          ratingCount: String(d.ratingCount || 1)
        } : undefined
      })
    },

    WebSite: {
      label: 'WebSite — сайт целиком',
      hint: 'Обычно ставится на главную. Включает поле поиска в выдаче.',
      fields: [
        F.text('name', 'Название сайта'), F.area('description', 'Описание'),
        F.text('searchUrl', 'URL поиска', 'напр. /search?q={search_term_string}')
      ],
      build: (d, ctx) => prune({
        '@context': 'https://schema.org', '@type': 'WebSite',
        name: d.name || ctx.siteName, description: d.description, url: ctx.origin,
        potentialAction: d.searchUrl ? {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: ctx.origin + d.searchUrl },
          'query-input': 'required name=search_term_string'
        } : undefined
      })
    },

    WebPage: {
      label: 'WebPage — обычная страница',
      fields: [
        F.text('name', 'Название'), F.area('description', 'Описание'),
        F.date('datePublished', 'Опубликовано'), F.date('dateModified', 'Обновлено')
      ],
      build: (d, ctx) => prune({
        '@context': 'https://schema.org', '@type': 'WebPage',
        name: d.name || ctx.title, description: d.description || ctx.description,
        url: ctx.url,
        datePublished: d.datePublished || ctx.date,
        dateModified: d.dateModified || ctx.dateModified || ctx.date,
        isPartOf: { '@type': 'WebSite', name: ctx.siteName, url: ctx.origin }
      })
    }
  };

  /* ═══════════════════════════════════════════════════════════
     4. Preview channels registry — 9 каналов
     Каждый канал получает нормализованные данные и возвращает
     описание карточки (данные, а не HTML — рендерит UI-слой).
     ═══════════════════════════════════════════════════════════ */

  // Ограничение строки по длине с многоточием.
  function clip(s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
  }

  const previewChannels = {
    googleDesktop: {
      label: 'Google — десктоп', group: 'Поиск',
      render: d => ({
        kind: 'snippet', device: 'desktop',
        breadcrumb: d.breadcrumb, title: clip(d.title, 60),
        description: clip(d.description, 160), url: d.url, date: d.dateDisplay
      })
    },
    googleMobile: {
      label: 'Google — мобильный', group: 'Поиск',
      render: d => ({
        kind: 'snippet', device: 'mobile',
        breadcrumb: d.breadcrumb, title: clip(d.title, 50),
        description: clip(d.description, 120), url: d.url,
        date: d.dateDisplay, image: d.image
      })
    },
    yandex: {
      label: 'Яндекс', group: 'Поиск',
      render: d => ({
        kind: 'snippet', device: 'yandex',
        breadcrumb: d.breadcrumb, title: clip(d.title, 65),
        description: clip(d.description, 170), url: d.url,
        date: d.dateDisplay, image: d.image
      })
    },
    telegram: {
      label: 'Telegram', group: 'Мессенджеры',
      render: d => ({
        kind: 'social', style: 'telegram',
        site: d.siteName, title: clip(d.ogTitle, 80),
        description: clip(d.ogDescription, 200), image: d.ogImage
      })
    },
    whatsapp: {
      label: 'WhatsApp', group: 'Мессенджеры',
      render: d => ({
        kind: 'social', style: 'whatsapp',
        site: d.host, title: clip(d.ogTitle, 65),
        description: clip(d.ogDescription, 120), image: d.ogImage
      })
    },
    facebook: {
      label: 'Facebook', group: 'Соцсети',
      render: d => ({
        kind: 'social', style: 'facebook',
        site: d.host.toUpperCase(), title: clip(d.ogTitle, 88),
        description: clip(d.ogDescription, 110), image: d.ogImage
      })
    },
    vk: {
      label: 'ВКонтакте', group: 'Соцсети',
      render: d => ({
        kind: 'social', style: 'vk',
        site: d.host, title: clip(d.ogTitle, 90),
        description: clip(d.ogDescription, 130), image: d.ogImage
      })
    },
    twitter: {
      label: 'X / Twitter', group: 'Соцсети',
      render: d => ({
        kind: 'social', style: 'twitter',
        site: d.host, title: clip(d.twitterTitle, 70),
        description: clip(d.twitterDescription, 125), image: d.twitterImage,
        large: d.twitterCard !== 'summary'
      })
    },
    discord: {
      label: 'Discord', group: 'Мессенджеры',
      render: d => ({
        kind: 'social', style: 'discord',
        site: d.siteName, title: clip(d.ogTitle, 80),
        description: clip(d.ogDescription, 180), image: d.ogImage
      })
    },
    slack: {
      label: 'Slack', group: 'Мессенджеры',
      render: d => ({
        kind: 'social', style: 'slack',
        site: d.siteName, title: clip(d.ogTitle, 75),
        description: clip(d.ogDescription, 150), image: d.ogImage
      })
    }
  };

  /* ═══════════════════════════════════════════════════════════
     5. AI directives registry
     Новые AI-краулеры добавляются записью здесь — без правок логики.
     ═══════════════════════════════════════════════════════════ */

  const aiDirectivesRegistry = {
    crawlers: [
      { id: 'GPTBot', label: 'GPTBot (OpenAI)', note: 'Обучение моделей OpenAI' },
      { id: 'OAI-SearchBot', label: 'OAI-SearchBot (OpenAI)', note: 'Поиск ChatGPT' },
      { id: 'ChatGPT-User', label: 'ChatGPT-User', note: 'Переходы пользователей ChatGPT' },
      { id: 'ClaudeBot', label: 'ClaudeBot (Anthropic)', note: 'Обучение и поиск Claude' },
      { id: 'Claude-User', label: 'Claude-User (Anthropic)', note: 'Запросы пользователей Claude' },
      { id: 'Claude-SearchBot', label: 'Claude-SearchBot (Anthropic)', note: 'Поисковый индекс Claude' },
      { id: 'Google-Extended', label: 'Google-Extended', note: 'Обучение Gemini / AI Overviews' },
      { id: 'PerplexityBot', label: 'PerplexityBot', note: 'Индекс Perplexity' },
      { id: 'Perplexity-User', label: 'Perplexity-User', note: 'Переходы из Perplexity' },
      { id: 'Applebot-Extended', label: 'Applebot-Extended', note: 'Обучение Apple Intelligence' },
      { id: 'Bytespider', label: 'Bytespider (ByteDance)', note: 'Обучение моделей ByteDance' },
      { id: 'CCBot', label: 'CCBot (Common Crawl)', note: 'Открытый датасет для обучения' },
      { id: 'meta-externalagent', label: 'Meta AI', note: 'Обучение моделей Meta' },
      { id: 'YandexAdditional', label: 'YandexAdditional', note: 'Нейросети Яндекса' }
    ],
    // Мета-директивы, которые кладутся в <head>
    metaDirectives: [
      {
        key: 'allowAiOverview', label: 'Разрешить AI Overviews в поиске',
        hint: 'Показ страницы в AI-обзорах Google/Яндекса. Выключение = noindex для AI-сниппетов.',
        whenFalse: { name: 'robots', content: 'nosnippet' }
      },
      {
        key: 'allowGenerativeAnswers', label: 'Разрешить генеративные ответы',
        hint: 'Использование контента в ответах чат-ботов со ссылкой на источник.',
        whenFalse: { name: 'googlebot', content: 'nosnippet' }
      },
      {
        key: 'allowModelTraining', label: 'Разрешить обучение моделей на контенте',
        hint: 'По умолчанию выключено: контент не отдаётся на обучение ИИ.',
        whenFalse: { name: 'tdm-reservation', content: '1' }
      }
    ]
  };

  /* ═══════════════════════════════════════════════════════════
     6. Мини-валидатор (замена Zod для vanilla-стека)
     ═══════════════════════════════════════════════════════════ */

  const validators = {
    required: v => (v !== '' && v != null) || 'Обязательное поле',
    url: v => !v || /^(https?:\/\/|\/)/.test(v) || 'Должен быть URL или путь от корня',
    absUrl: v => !v || /^https?:\/\//.test(v) || 'Нужен полный URL с https://',
    slug: v => !v || /^[a-z0-9-]+$/.test(v) || 'Только латиница, цифры и дефис',
    date: v => !v || /^\d{4}-\d{2}-\d{2}/.test(v) || 'Формат ГГГГ-ММ-ДД',
    number: v => v === '' || v == null || !isNaN(Number(v)) || 'Должно быть числом',
    range: (min, max) => v => v === '' || v == null ||
      (Number(v) >= min && Number(v) <= max) || `Значение от ${min} до ${max}`,
    maxLen: n => v => !v || String(v).length <= n || `Не более ${n} символов`,
    json: v => {
      if (!v) return true;
      try { JSON.parse(v); return true; } catch (e) { return 'Некорректный JSON: ' + e.message; }
    }
  };

  /**
   * Прогнать значение через список правил.
   * @returns {string|null} текст ошибки или null
   */
  function runValidators(value, rules) {
    for (const rule of (rules || [])) {
      const res = rule(value);
      if (res !== true) return typeof res === 'string' ? res : 'Некорректное значение';
    }
    return null;
  }

  return {
    OG_TYPES, TWITTER_CARDS, CHANGE_FREQ, MAX_IMAGE_PREVIEW, REDIRECT_CODES, OG_LOCALES,
    emptyPageSeo, emptySiteDefaults,
    schemaRegistry, previewChannels, aiDirectivesRegistry,
    validators, runValidators, prune, clip, F
  };
});
