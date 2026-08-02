/* ─────────────────────────────────────────────────────────────
   РЕМСИТИ·36 — SEO module · TAB REGISTRY
   Декларативное описание всех 21 вкладки SEO-панели.

   Добавить поле = добавить запись в массив fields. Ни один
   компонент при этом не меняется — рендерер универсальный.

   Типы полей: text | textarea | number | select | switch | date
               image | tags | list | json | range | custom
   `path` — путь внутри post.seo (поддерживает вложенность через точку).
   `custom` — вкладка/поле рисуется спец-виджетом из ui.js по ключу `widget`.
─────────────────────────────────────────────────────────────── */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./domain.js'));
  } else {
    root.SeoFields = factory(root.SeoDomain);
  }
})(typeof self !== 'undefined' ? self : this, function (D) {
  'use strict';

  const V = D.validators;

  /* Краткие конструкторы полей */
  const t = (path, label, o) => Object.assign({ path, label, type: 'text' }, o);
  const area = (path, label, o) => Object.assign({ path, label, type: 'textarea' }, o);
  const num = (path, label, o) => Object.assign({ path, label, type: 'number' }, o);
  const sw = (path, label, o) => Object.assign({ path, label, type: 'switch' }, o);
  const sel = (path, label, options, o) => Object.assign({ path, label, type: 'select', options }, o);
  const date = (path, label, o) => Object.assign({ path, label, type: 'date' }, o);
  const img = (path, label, o) => Object.assign({ path, label, type: 'image' }, o);
  const tags = (path, label, o) => Object.assign({ path, label, type: 'tags' }, o);
  const list = (path, label, itemFields, o) =>
    Object.assign({ path, label, type: 'list', itemFields }, o);

  /* ═══════════════════════════════════════════════════════════
     Реестр вкладок — порядок соответствует разделам ТЗ 1–21
     ═══════════════════════════════════════════════════════════ */

  const tabs = [
    /* ── 1. Основное SEO ──────────────────────────────────── */
    {
      id: 'basic', label: 'Основное', icon: '◎', group: 'Контент',
      sections: [
        {
          title: 'Заголовок и описание',
          fields: [
            t('seoTitle', 'SEO-заголовок', {
              hint: 'Заголовок в результатах поиска. Если пусто — берётся заголовок статьи ' +
                    'и подставляется в шаблон из глобальных настроек.',
              counter: 'title', placeholder: 'Оставьте пустым для автоподстановки',
              example: 'Ремонт холодильников в Воронеже — выезд за 1 час'
            }),
            area('metaDescription', 'Meta Description', {
              hint: 'Текст под заголовком в выдаче. Влияет на кликабельность. ' +
                    'Не участвует в ранжировании напрямую, но сильно влияет на CTR.',
              counter: 'description', rows: 3,
              example: 'Чиним холодильники всех марок на дому. Диагностика 0 ₽, гарантия 12 месяцев.'
            }),
            t('canonicalUrl', 'Canonical URL', {
              hint: 'Основной адрес страницы. Заполняйте, только если контент дублируется ' +
                    'по нескольким адресам. Пусто = адрес страницы.',
              validate: [V.url], placeholder: 'Автоматически'
            })
          ]
        },
        {
          title: 'Ключевые слова',
          fields: [
            t('focusKeyword', 'Фокусное ключевое слово', {
              hint: 'Главный запрос страницы. По нему считается SEO-анализ: наличие в заголовке, ' +
                    'описании, URL и тексте.',
              example: 'ремонт холодильников воронеж'
            }),
            tags('additionalKeywords', 'Дополнительные ключевые слова', {
              hint: 'Второстепенные запросы. Enter — добавить.'
            })
          ]
        },
        {
          title: 'Индексация (Meta Robots)',
          collapsed: true,
          fields: [
            sw('robotsIndex', 'Индексировать страницу', {
              hint: 'Выключите, чтобы убрать страницу из поиска (noindex).'
            }),
            sw('robotsFollow', 'Переходить по ссылкам', {
              hint: 'Выключение (nofollow) запрещает роботу переходить по ссылкам со страницы.'
            }),
            sw('robotsNoarchive', 'Запретить сохранённую копию', {
              hint: 'noarchive — поисковик не покажет кэш страницы.'
            }),
            sw('robotsNosnippet', 'Запретить сниппет', {
              hint: 'nosnippet — в выдаче не будет описания и превью.'
            }),
            sw('robotsNoimageindex', 'Запретить индексацию изображений', {
              hint: 'noimageindex — картинки не попадут в поиск по картинкам.'
            }),
            num('robotsMaxSnippet', 'Максимум символов в сниппете', {
              hint: '-1 — без ограничений, 0 — без сниппета.', validate: [V.number]
            }),
            sel('robotsMaxImagePreview', 'Размер превью изображения', D.MAX_IMAGE_PREVIEW, {
              hint: 'Насколько крупное изображение можно показывать в выдаче.'
            }),
            num('robotsMaxVideoPreview', 'Максимум секунд видео-превью', { validate: [V.number] })
          ]
        }
      ]
    },

    /* ── 2. Google Preview ────────────────────────────────── */
    {
      id: 'google-preview', label: 'Превью в поиске', icon: '⌕', group: 'Контент',
      custom: 'googlePreview',
      hint: 'Так страница выглядит в результатах поиска. Обновляется на лету.'
    },

    /* ── 3. Open Graph ────────────────────────────────────── */
    {
      id: 'og', label: 'Open Graph', icon: '◫', group: 'Соцсети',
      hint: 'Как страница выглядит при отправке ссылки в Telegram, VK, Facebook, WhatsApp.',
      sections: [
        {
          title: 'Карточка для соцсетей',
          fields: [
            t('ogTitle', 'OG Title', {
              hint: 'Заголовок карточки. Пусто = SEO-заголовок.', counter: 'title'
            }),
            area('ogDescription', 'OG Description', {
              hint: 'Описание в карточке. Пусто = Meta Description.', counter: 'description', rows: 3
            }),
            img('ogImage', 'OG Image', {
              hint: 'Картинка карточки. Оптимально 1200×630. Пусто = обложка статьи.'
            }),
            sel('ogType', 'OG Type', D.OG_TYPES, {
              hint: 'Тип контента. Для новостей — article.'
            }),
            sel('ogLocale', 'Язык (og:locale)', D.OG_LOCALES),
            t('ogUrl', 'OG URL', { hint: 'Пусто = canonical.', validate: [V.url] })
          ]
        },
        { title: 'Предпросмотр', custom: 'ogPreview' }
      ]
    },

    /* ── 4. Twitter Card ──────────────────────────────────── */
    {
      id: 'twitter', label: 'Twitter Card', icon: '𝕏', group: 'Соцсети',
      sections: [
        {
          title: 'Карточка X / Twitter',
          fields: [
            sel('twitterCard', 'Тип карточки', D.TWITTER_CARDS, {
              hint: 'Большая картинка заметнее в ленте.'
            }),
            t('twitterTitle', 'Twitter Title', { hint: 'Пусто = OG Title.', counter: 'title' }),
            area('twitterDescription', 'Twitter Description', {
              hint: 'Пусто = OG Description.', counter: 'description', rows: 3
            }),
            img('twitterImage', 'Twitter Image', { hint: 'Пусто = OG Image.' })
          ]
        },
        { title: 'Предпросмотр', custom: 'twitterPreview' }
      ]
    },

    /* ── 5. Structured Data ───────────────────────────────── */
    {
      id: 'schema', label: 'Микроразметка', icon: '⌘', group: 'Разметка',
      custom: 'structuredData',
      hint: 'Schema.org разметка: расширенные сниппеты в выдаче (рейтинг, цена, FAQ, шаги).'
    },

    /* ── 6. Sitemap ───────────────────────────────────────── */
    {
      id: 'sitemap', label: 'Sitemap', icon: '☰', group: 'Разметка',
      sections: [
        {
          title: 'Карта сайта',
          fields: [
            sw('sitemapInclude', 'Включить в sitemap.xml', {
              hint: 'Страница попадёт в карту сайта, которую читают поисковики.'
            }),
            Object.assign(num('sitemapPriority', 'Приоритет'), {
              type: 'range', min: 0, max: 1, step: 0.1,
              hint: 'Относительная важность страницы: 0.0–1.0. Главная обычно 1.0, новости 0.7.'
            }),
            sel('sitemapChangeFreq', 'Частота обновления', D.CHANGE_FREQ, {
              hint: 'Как часто меняется содержимое. Подсказка для робота, не гарантия.'
            }),
            date('sitemapLastMod', 'Дата последнего изменения', {
              hint: 'Пусто = дата обновления страницы.'
            })
          ]
        }
      ]
    },

    /* ── 7. Хлебные крошки ────────────────────────────────── */
    {
      id: 'breadcrumbs', label: 'Хлебные крошки', icon: '⤳', group: 'Разметка',
      hint: 'Путь до страницы. Показывается в выдаче вместо длинного URL.',
      sections: [
        {
          title: 'Своя цепочка',
          fields: [
            list('breadcrumbsOverride', 'Крошки', [
              t('label', 'Название'), t('url', 'Ссылка', { validate: [V.url] })
            ], {
              hint: 'Пусто = автоматическая цепочка Главная → Новости → Заголовок.',
              addLabel: '+ Уровень'
            })
          ]
        },
        { title: 'Предпросмотр разметки', custom: 'breadcrumbsPreview' }
      ]
    },

    /* ── 8. Изображения ───────────────────────────────────── */
    {
      id: 'images', label: 'Изображения', icon: '▣', group: 'Контент',
      custom: 'imagesSeo',
      hint: 'Alt и подписи для всех изображений страницы. Влияет на поиск по картинкам и доступность.'
    },

    /* ── 9. Авторство ─────────────────────────────────────── */
    {
      id: 'authorship', label: 'Авторство', icon: '✎', group: 'Организация',
      sections: [
        {
          title: 'Автор и даты',
          fields: [
            t('authorName', 'Автор', { hint: 'Пусто = название организации.' }),
            date('publishedAt', 'Дата публикации', { hint: 'Пусто = дата статьи.' }),
            date('updatedAtSeo', 'Дата обновления', {
              hint: 'Свежая дата обновления улучшает позиции по актуальным запросам.'
            })
          ]
        },
        {
          title: 'Издатель',
          fields: [
            t('publisherName', 'Название издателя', { hint: 'Пусто = название сайта.' }),
            img('publisherLogo', 'Логотип издателя', {
              hint: 'Используется в разметке Article. Рекомендуется 600×60.'
            })
          ]
        }
      ]
    },

    /* ── 10. Локальное SEO ────────────────────────────────── */
    {
      id: 'local', label: 'Локальное SEO', icon: '⌖', group: 'Организация',
      hint: 'Адрес и контакты для разметки LocalBusiness — влияет на выдачу по гео-запросам и карты.',
      sections: [
        {
          title: 'Адрес',
          fields: [
            t('localBusiness.country', 'Страна', { placeholder: 'RU' }),
            t('localBusiness.region', 'Область', { placeholder: 'Воронежская область' }),
            t('localBusiness.city', 'Город', { placeholder: 'Воронеж' }),
            t('localBusiness.address', 'Улица, дом', { placeholder: 'ул. 9 января, 233/20' }),
            t('localBusiness.postalCode', 'Индекс', { placeholder: '394020' })
          ]
        },
        {
          title: 'Контакты и координаты',
          fields: [
            t('localBusiness.phone', 'Телефон', { placeholder: '+7 (995) 250-77-72' }),
            t('localBusiness.email', 'Email'),
            t('localBusiness.lat', 'Широта', { hint: 'Например 51.6720' }),
            t('localBusiness.lng', 'Долгота', { hint: 'Например 39.1843' }),
            t('localBusiness.hours', 'Часы работы', {
              hint: 'Формат Schema.org: Mo-Su 09:00-21:00', placeholder: 'Mo-Su 09:00-21:00'
            })
          ]
        }
      ]
    },

    /* ── 11. Соцсети ──────────────────────────────────────── */
    {
      id: 'social', label: 'Соцсети', icon: '⚯', group: 'Организация',
      hint: 'Профили организации. Попадают в разметку Organization.sameAs — помогают связать бренд.',
      sections: [
        {
          title: 'Профили (переопределяют глобальные)',
          fields: [
            t('socialLinksOverride.telegram', 'Telegram', { validate: [V.absUrl] }),
            t('socialLinksOverride.vk', 'ВКонтакте', { validate: [V.absUrl] }),
            t('socialLinksOverride.youtube', 'YouTube', { validate: [V.absUrl] }),
            t('socialLinksOverride.instagram', 'Instagram', { validate: [V.absUrl] }),
            t('socialLinksOverride.facebook', 'Facebook', { validate: [V.absUrl] }),
            t('socialLinksOverride.whatsapp', 'WhatsApp', { validate: [V.absUrl] }),
            t('socialLinksOverride.odnoklassniki', 'Одноклассники', { validate: [V.absUrl] })
          ]
        }
      ]
    },

    /* ── 12. Редиректы ────────────────────────────────────── */
    {
      id: 'redirects', label: 'Редиректы', icon: '⇢', group: 'Технические',
      custom: 'redirects',
      hint: 'Переадресация со старых адресов. Создаётся автоматически при смене slug.'
    },

    /* ── 13. Head ─────────────────────────────────────────── */
    {
      id: 'custom-head', label: 'Свой Head', icon: '⟨⟩', group: 'Технические',
      hint: 'Произвольные теги в <head>. Для верификации сервисов, счётчиков, доп. разметки.',
      sections: [
        {
          title: 'Meta-теги',
          fields: [
            list('customMeta', 'Свои meta', [
              t('name', 'name / property'), t('content', 'content')
            ], { addLabel: '+ Meta' })
          ]
        },
        {
          title: 'Ссылки',
          collapsed: true,
          fields: [
            list('customLinks', 'Свои link', [
              t('rel', 'rel'), t('href', 'href'), t('type', 'type')
            ], { addLabel: '+ Link' })
          ]
        },
        {
          title: 'Скрипты',
          collapsed: true,
          fields: [
            list('customScripts', 'Свои скрипты', [
              t('src', 'src (внешний)'), area('inline', 'или код')
            ], {
              hint: 'Скрипты подключаются с defer. Не вставляйте сюда код из непроверенных источников.',
              addLabel: '+ Скрипт'
            })
          ]
        },
        {
          title: 'Дополнительно',
          collapsed: true,
          fields: [
            area('customJsonLd', 'Свой JSON-LD', {
              hint: 'Произвольная разметка Schema.org. Объект или массив объектов.',
              rows: 6, mono: true, validate: [V.json]
            }),
            t('customCssClass', 'CSS-класс для <body>', {
              hint: 'Позволяет стилизовать конкретную страницу.'
            })
          ]
        },
        {
          title: 'Мультиязычность (hreflang)',
          collapsed: true,
          fields: [
            list('hreflang', 'Языковые версии', [
              t('lang', 'Код языка', { placeholder: 'en, ru, x-default' }),
              t('url', 'URL версии')
            ], { addLabel: '+ Язык' })
          ]
        }
      ]
    },

    /* ── 14. Индексация ───────────────────────────────────── */
    {
      id: 'indexation', label: 'Индексация', icon: '⊙', group: 'Технические',
      sections: [
        {
          title: 'Видимость страницы',
          fields: [
            sw('includeInSearch', 'Показывать в поиске', {
              hint: 'Общий выключатель: снимает страницу с индексации во всех поисковиках.'
            }),
            sw('includeInSitemap', 'Включать в карту сайта', {
              hint: 'Дублирует настройку из вкладки Sitemap.'
            }),
            sw('hideFromInternalSearch', 'Скрыть из поиска по сайту', {
              hint: 'Страница останется в Google/Яндексе, но не будет находиться внутренним поиском.'
            })
          ]
        },
        { title: 'Итоговые директивы', custom: 'indexationSummary' }
      ]
    },

    /* ── 15. AI-директивы ─────────────────────────────────── */
    {
      id: 'ai', label: 'AI и нейросети', icon: '✳', group: 'Технические',
      custom: 'aiDirectives',
      hint: 'Управление доступом ИИ-краулеров: обучение моделей, AI-обзоры, генеративные ответы.'
    },

    /* ── 16. SEO-анализ ───────────────────────────────────── */
    {
      id: 'analysis', label: 'SEO-анализ', icon: '⌗', group: 'Аналитика',
      custom: 'seoAnalysis',
      hint: 'Полная проверка страницы: контент, заголовки, ссылки, разметка, дубли.'
    },

    /* ── 17. SEO Score ────────────────────────────────────── */
    {
      id: 'score', label: 'SEO-оценка', icon: '◍', group: 'Аналитика',
      custom: 'seoScore',
      hint: 'Итоговый балл 0–100 и список того, что стоит починить в первую очередь.'
    },

    /* ── 18. Core Web Vitals ──────────────────────────────── */
    {
      id: 'cwv', label: 'Core Web Vitals', icon: '◷', group: 'Аналитика',
      custom: 'coreWebVitals',
      hint: 'Скорость и стабильность страницы по данным Google PageSpeed Insights.'
    },

    /* ── 19. Preview (все каналы) ─────────────────────────── */
    {
      id: 'preview', label: 'Предпросмотр', icon: '◳', group: 'Аналитика',
      custom: 'allPreviews',
      hint: 'Как ссылка выглядит во всех каналах: поиск, мессенджеры, соцсети.'
    },

    /* ── 20. История ──────────────────────────────────────── */
    {
      id: 'history', label: 'История', icon: '⟲', group: 'Аналитика',
      custom: 'seoHistory',
      hint: 'Кто и когда менял SEO-поля. Можно откатить любое изменение.'
    },

    /* ── 21. Автоматизация ────────────────────────────────── */
    {
      id: 'automation', label: 'Автоматизация', icon: '⚙', group: 'Аналитика',
      custom: 'automation',
      hint: 'Заполнить поля автоматически: заголовок, описание, alt, разметка, OG, canonical.'
    }
  ];

  /* ═══════════════════════════════════════════════════════════
     Глобальные настройки сайта (site.seoDefaults)
     ═══════════════════════════════════════════════════════════ */

  const siteDefaultsSections = [
    {
      title: 'Шаблоны по умолчанию',
      fields: [
        t('titleTemplate', 'Шаблон заголовка', {
          hint: 'Переменные: %pageTitle% — заголовок страницы, %siteName% — название сайта.',
          example: '%pageTitle% — %siteName%'
        }),
        area('metaDescription', 'Описание по умолчанию', {
          hint: 'Используется, если у страницы нет своего описания.', counter: 'description', rows: 3
        }),
        img('ogImage', 'Картинка по умолчанию', {
          hint: 'Показывается в соцсетях, если у страницы нет обложки.'
        }),
        sel('ogType', 'Тип OG по умолчанию', D.OG_TYPES),
        sel('ogLocale', 'Язык по умолчанию', D.OG_LOCALES),
        sel('twitterCard', 'Тип Twitter-карточки', D.TWITTER_CARDS)
      ]
    },
    {
      title: 'Индексация по умолчанию',
      fields: [
        sw('robotsIndex', 'Индексировать сайт', {
          hint: 'Глобальный выключатель. Выключение закроет от поиска ВЕСЬ сайт.'
        }),
        sw('robotsFollow', 'Переходить по ссылкам')
      ]
    },
    {
      title: 'Профили в соцсетях',
      collapsed: true,
      fields: [
        t('socialLinks.telegram', 'Telegram', { validate: [V.absUrl] }),
        t('socialLinks.vk', 'ВКонтакте', { validate: [V.absUrl] }),
        t('socialLinks.youtube', 'YouTube', { validate: [V.absUrl] }),
        t('socialLinks.instagram', 'Instagram', { validate: [V.absUrl] }),
        t('socialLinks.facebook', 'Facebook', { validate: [V.absUrl] }),
        t('socialLinks.whatsapp', 'WhatsApp', { validate: [V.absUrl] })
      ]
    }
  ];

  /* ── утилиты доступа по пути ─────────────────────────────── */

  /** Прочитать значение по пути «a.b.c». */
  function getPath(obj, path) {
    return String(path).split('.').reduce(
      (o, k) => (o == null ? undefined : o[k]), obj);
  }

  /** Записать значение по пути «a.b.c», создавая промежуточные объекты. */
  function setPath(obj, path, value) {
    const keys = String(path).split('.');
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (cur[keys[i]] == null || typeof cur[keys[i]] !== 'object') cur[keys[i]] = {};
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
    return obj;
  }

  /** Все поля всех вкладок плоским списком (для валидации и истории). */
  function allFields() {
    const out = [];
    tabs.forEach(tab => (tab.sections || []).forEach(sec =>
      (sec.fields || []).forEach(f => out.push(Object.assign({ tabId: tab.id }, f)))));
    return out;
  }

  /** Человекочитаемое название поля по пути — для истории изменений. */
  function fieldLabel(path) {
    const f = allFields().find(x => x.path === path);
    return f ? f.label : path;
  }

  /** Уникальные группы вкладок в порядке появления. */
  function groups() {
    const seen = [];
    tabs.forEach(t2 => { if (seen.indexOf(t2.group) === -1) seen.push(t2.group); });
    return seen;
  }

  return { tabs, siteDefaultsSections, getPath, setPath, allFields, fieldLabel, groups };
});
