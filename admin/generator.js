/* ─────────────────────────────────────────────────────────────
   РЕМСИТИ·36 — News generator (shared by browser admin & Node build)
   Single source of truth for the HTML of:
     • per-article SEO pages  →  /news/<slug>/index.html
     • the /news listing page  →  /news.html  +  /news/index.html
     • sitemap.xml
   Pure functions, no DOM, no Node APIs → usable everywhere.
─────────────────────────────────────────────────────────────── */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Generator = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ── helpers ─────────────────────────────────────────────── */

  // Escape for use inside an HTML attribute / text node.
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Strip tags & entities → plain text (for <title>, meta, JSON-LD).
  function plain(s) {
    return String(s == null ? '' : s)
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Plain text safe to embed inside a JSON string in <script type=ld+json>.
  function jsonStr(s) {
    return JSON.stringify(plain(s));
  }

  // Transliterate RU → latin slug.
  function slugify(s) {
    var map = {
      а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',
      к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
      х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'
    };
    return plain(s).toLowerCase()
      .replace(/[а-яё]/g, function (c) { return map[c] != null ? map[c] : c; })
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 70) || 'post';
  }

  var FONTS =
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
    '<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,700;12..96,800&family=JetBrains+Mono:wght@400;500;600;700&family=Manrope:wght@300;400;500;600;700&display=swap">\n' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,700;12..96,800&family=JetBrains+Mono:wght@400;500;600;700&family=Manrope:wght@300;400;500;600;700&display=swap" media="print" onload="this.media=\'all\'">\n' +
    '<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,700;12..96,800&family=JetBrains+Mono:wght@400;500;600;700&family=Manrope:wght@300;400;500;600;700&display=swap"></noscript>';

  function statusBar() {
    return (
'<div class="status-bar" role="banner" aria-label="Системный статус">\n' +
'  <div class="wrap">\n' +
'    <span class="live"><span class="dot"></span> станция активна</span>\n' +
'    <span class="sep"></span>\n' +
'    <span class="item meta-extra">журнал · field notes</span>\n' +
'    <span class="sep meta-extra"></span>\n' +
'    <span class="grow"><span class="ticker" aria-hidden="true">' +
'<span>раздел · field journal</span><span class="sgl">+</span>' +
'<span>обновления каждую неделю</span><span class="sgl">+</span>' +
'<span>истории из мастерской</span><span class="sgl">+</span>' +
'<span>советы по технике</span><span class="sgl">+</span>' +
'<span>раздел · field journal</span><span class="sgl">+</span>' +
'<span>обновления каждую неделю</span><span class="sgl">+</span>' +
'<span>истории из мастерской</span><span class="sgl">+</span>' +
'<span>советы по технике</span><span class="sgl">+</span></span></span>\n' +
'    <span class="sep"></span>\n' +
'    <span class="item"><span id="clock">--:--:--</span> MSK</span>\n' +
'  </div>\n' +
'</div>');
  }

  var PHONE_SVG = '<svg class="nav-cta-ico" viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>';

  function nav() {
    return (
'<nav class="main" aria-label="Основная навигация">\n' +
'  <div class="wrap">\n' +
'    <a href="/" class="brand" aria-label="Ремсити36 — на главную">\n' +
'      <span class="brand-mark"><img src="/logo-96.webp" alt="" width="60" height="60"></span>\n' +
'      <span class="brand-text">Ремсити<span class="num">·36</span></span>\n' +
'    </a>\n' +
'    <ul class="nav-links" role="menubar">\n' +
'      <li><a href="/index.html#services">Услуги</a></li>\n' +
'      <li><a href="/index.html#cases">Кейсы</a></li>\n' +
'      <li><a href="/index.html#numbers">Цифры</a></li>\n' +
'      <li><a href="/index.html#process">Процесс</a></li>\n' +
'      <li><a href="/news" class="active">Журнал</a></li>\n' +
'      <li><a href="/index.html#comms">Связь</a></li>\n' +
'    </ul>\n' +
'    <a href="tel:+79952507772" class="nav-cta">' + PHONE_SVG + 'Позвонить</a>\n' +
'    <button class="burger" id="burger" aria-label="Меню" aria-expanded="false"><span></span></button>\n' +
'  </div>\n' +
'</nav>\n\n' +
'<div class="mobile-menu" id="mobileMenu" aria-hidden="true">\n' +
'  <a href="/"><span>Главная</span></a>\n' +
'  <a href="/index.html#services"><span>Услуги</span></a>\n' +
'  <a href="/index.html#cases"><span>Кейсы</span></a>\n' +
'  <a href="/index.html#numbers"><span>Цифры</span></a>\n' +
'  <a href="/index.html#process"><span>Процесс</span></a>\n' +
'  <a href="/news"><span>Журнал</span></a>\n' +
'  <a href="/index.html#comms"><span>Связь</span></a>\n' +
'  <a href="tel:+79952507772" class="m-cta">' + PHONE_SVG.replace('nav-cta-ico','m-cta-ico') + 'Позвонить</a>\n' +
'</div>');
  }

  function footer() {
    return (
'<footer>\n' +
'  <div class="wrap">\n' +
'    <div class="footer-grid">\n' +
'      <div class="foot-col">\n' +
'        <div class="foot-brand">Ремсити<span>·36</span></div>\n' +
'        <p class="foot-tag">Независимая сервисная мастерская в Воронеже. Чиним технику с 2014 года. Рейтинг 5.0, награда «Хорошее место 2026» от Яндекса.</p>\n' +
'      </div>\n' +
'      <div class="foot-col">\n' +
'        <h5>Навигация</h5>\n' +
'        <a href="/">Главная</a>\n' +
'        <a href="/index.html#services">Услуги</a>\n' +
'        <a href="/index.html#cases">Кейсы</a>\n' +
'        <a href="/index.html#numbers">Цифры</a>\n' +
'        <a href="/news">Журнал</a>\n' +
'      </div>\n' +
'      <div class="foot-col">\n' +
'        <h5>Связь</h5>\n' +
'        <a href="tel:+79952507772">+7 (995) 250-77-72</a>\n' +
'        <a href="mailto:remcity36@ya.ru?subject=Заявка%20с%20сайта%20Ремсити36">remcity36@ya.ru</a>\n' +
'        <a href="https://t.me/remcity36" target="_blank" rel="noopener">Telegram → remcity36</a>\n' +
'        <a href="https://wa.me/message/B6YTD4MBBHS2C1" target="_blank" rel="noopener">WhatsApp</a>\n' +
'      </div>\n' +
'      <div class="foot-col">\n' +
'        <h5>Реквизиты</h5>\n' +
'        <span style="display:block;color:var(--text-dim);font-size:14px;padding:7px 0">ул. 9 января, 233/20</span>\n' +
'        <span style="display:block;color:var(--text-dim);font-size:14px;padding:7px 0">Воронеж, 394020</span>\n' +
'        <span style="display:block;color:var(--text-dim);font-size:14px;padding:7px 0">ИНН 312832732477</span>\n' +
'      </div>\n' +
'    </div>\n' +
'    <div class="foot-bot">\n' +
'      <span>© 2026 Ремсити·36 / Все права защищены</span>\n' +
'      <a href="https://lab301.ru" target="_blank" rel="noopener" class="lab301">Сайт создан в LAB301 Digital Studio ↗</a>\n' +
'      <span class="right">\n' +
'        <a href="/">→ Главная</a>\n' +
'        <a href="#top">↑ Наверх</a>\n' +
'      </span>\n' +
'    </div>\n' +
'  </div>\n' +
'</footer>');
  }

  var SCRIPTS = (
'<script>\n' +
'(function(){var el=document.getElementById("clock");if(!el)return;function tick(){var d=new Date();var u=d.getTime()+d.getTimezoneOffset()*60000;var m=new Date(u+3*3600*1000);var p=function(n){return String(n).padStart(2,"0")};el.textContent=p(m.getHours())+":"+p(m.getMinutes())+":"+p(m.getSeconds())}tick();setInterval(tick,1000)})();\n' +
'(function(){var btn=document.getElementById("burger"),menu=document.getElementById("mobileMenu");if(!btn||!menu)return;var close=function(){btn.classList.remove("open");menu.classList.remove("open");btn.setAttribute("aria-expanded","false");document.body.style.overflow=""};btn.addEventListener("click",function(){var o=btn.classList.toggle("open");menu.classList.toggle("open",o);btn.setAttribute("aria-expanded",o);document.body.style.overflow=o?"hidden":""});menu.querySelectorAll("a").forEach(function(a){a.addEventListener("click",close)});document.addEventListener("keydown",function(e){if(e.key==="Escape")close()})})();\n' +
'document.addEventListener("click",function(e){var a=e.target.closest(\'a[href^="#"]\');if(!a)return;var id=a.getAttribute("href").slice(1);if(!id)return;var t=document.getElementById(id);if(!t)return;e.preventDefault();window.scrollTo({top:t.getBoundingClientRect().top+window.pageYOffset-110,behavior:"smooth"});history.pushState(null,"","#"+id)});\n' +
'(function(){if(!("IntersectionObserver" in window)){document.querySelectorAll(".reveal").forEach(function(el){el.classList.add("in")});return}var io=new IntersectionObserver(function(en){en.forEach(function(x){if(x.isIntersecting){x.target.classList.add("in");io.unobserve(x.target)}})},{threshold:0.1,rootMargin:"0px 0px -80px 0px"});document.querySelectorAll(".reveal").forEach(function(el){io.observe(el)})})();\n' +
'</script>');

  var METRIKA = (
'<!-- Yandex.Metrika counter -->\n' +
'<script type="text/javascript">\n' +
'   (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};\n' +
'   m[i].l=1*new Date();\n' +
'   for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}\n' +
'   k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})\n' +
'   (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");\n' +
'   ym(109259330, "init", {clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true});\n' +
'</script>\n' +
'<noscript><div><img src="https://mc.yandex.ru/watch/109259330" style="position:absolute; left:-9999px;" alt="" /></div></noscript>\n' +
'<!-- /Yandex.Metrika counter -->');

  /* ── content fragments ───────────────────────────────────── */

  function renderBlocks(blocks) {
    return (blocks || []).map(function (b) {
      var parts = (b.parts || []).map(function (p) {
        if (p.type === 'ul') {
          return '<ul>' + (p.items || []).map(function (it) {
            return '<li>' + it + '</li>';
          }).join('') + '</ul>';
        }
        return '<p>' + (p.html || '') + '</p>';
      }).join('\n          ');
      return (
'        <div class="section-block">\n' +
'          <h3><span class="n">' + esc(b.n || '') + '</span> ' + (b.h || '') + '</h3>\n' +
'          ' + parts + '\n' +
'        </div>');
    }).join('\n\n');
  }

  function articleAside(post) {
    return (
'      <aside class="article-side">\n' +
'        <span><span class="lbl">DATE</span><br><span class="v">' + esc(post.dateDisplay) + '</span></span>\n' +
'        <hr>\n' +
'        <span><span class="lbl">CAT</span><br><span class="v">/ ' + esc(post.category) + '</span></span>\n' +
'        <hr>\n' +
'        <span><span class="lbl">READ</span><br><span class="v">' + esc(post.readTime) + '</span></span>\n' +
'        <hr>\n' +
'        <span><span class="lbl">AUTHOR</span><br><span class="v">' + esc(post.author || 'STN VRN-36') + '</span></span>\n' +
'        <span class="file">' + esc(post.file || '') + '</span>\n' +
'      </aside>');
  }

  /* ── per-article SEO page ─────────────────────────────────── */

  function articlePage(post, site) {
    var origin = site.origin;
    var url = origin + '/news/' + post.slug;
    var hasCover = !!post.cover;
    var coverAbs = hasCover
      ? (/^https?:/.test(post.cover) ? post.cover : origin + post.cover)
      : origin + '/og-image.jpg';
    var titlePlain = plain(post.title);
    var ld = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: plain(post.title),
      description: plain(post.description),
      image: [coverAbs],
      datePublished: post.date,
      dateModified: post.dateModified || post.date,
      author: { '@type': 'Organization', name: site.name, url: origin },
      publisher: {
        '@type': 'Organization', name: site.name, url: origin,
        logo: { '@type': 'ImageObject', url: origin + '/apple-touch-icon.png' }
      },
      mainEntityOfPage: { '@type': 'WebPage', '@id': url }
    };
    var crumbsLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Главная', item: origin + '/' },
        { '@type': 'ListItem', position: 2, name: 'Журнал', item: origin + '/news' },
        { '@type': 'ListItem', position: 3, name: titlePlain, item: url }
      ]
    };

    return (
'<!DOCTYPE html>\n' +
'<html lang="ru">\n' +
'<head>\n' +
'<meta charset="utf-8">\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
'<title>' + esc(titlePlain) + ' — Ремсити36, Воронеж</title>\n' +
'<meta name="description" content="' + esc(plain(post.description)) + '">\n' +
'<link rel="canonical" href="' + esc(url) + '">\n' +
'<meta name="theme-color" content="#0a0a0a">\n' +
'<meta name="robots" content="index, follow">\n' +
'<meta property="og:type" content="article">\n' +
'<meta property="og:title" content="' + esc(titlePlain) + '">\n' +
'<meta property="og:description" content="' + esc(plain(post.description)) + '">\n' +
'<meta property="og:url" content="' + esc(url) + '">\n' +
'<meta property="og:image" content="' + esc(coverAbs) + '">\n' +
'<meta property="og:site_name" content="Ремсити36">\n' +
'<meta property="og:locale" content="ru_RU">\n' +
'<meta property="article:published_time" content="' + esc(post.date) + '">\n' +
'<meta property="article:section" content="' + esc(post.categoryTag || '') + '">\n' +
'<meta name="twitter:card" content="summary_large_image">\n' +
'<meta name="twitter:title" content="' + esc(titlePlain) + '">\n' +
'<meta name="twitter:description" content="' + esc(plain(post.description)) + '">\n' +
'<meta name="twitter:image" content="' + esc(coverAbs) + '">\n' +
'<link rel="icon" href="/logo-96.webp" type="image/webp">\n' +
'<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n' +
FONTS + '\n' +
'<link rel="stylesheet" href="/assets/journal.css">\n' +
'<script type="application/ld+json">' + JSON.stringify(ld) + '</script>\n' +
'<script type="application/ld+json">' + JSON.stringify(crumbsLd) + '</script>\n' +
'</head>\n' +
'<body class="article-page">\n\n' +
statusBar() + '\n\n' +
nav() + '\n\n' +
'<main>\n\n' +
'<section class="articles">\n' +
'  <div class="wrap">\n\n' +
'    <div class="crumbs reveal" style="margin-bottom:32px">\n' +
'      <a href="/">Ремсити·36</a>\n' +
'      <span class="sl">/</span>\n' +
'      <a href="/news">Журнал</a>\n' +
'      <span class="sl">/</span>\n' +
'      <span class="cur">' + esc(post.categoryTag || '') + '</span>\n' +
'    </div>\n\n' +
'    <article class="article reveal" id="' + esc(post.id || ('post-' + post.num)) + '">\n' +
articleAside(post) + '\n\n' +
'      <div class="article-body">\n' +
'        <div class="article-cat">Field report · ' + String(post.num).padStart(2, '0') + '</div>\n' +
'        <h1>' + (post.titleHtml || esc(post.title)) + '</h1>\n' +
(hasCover ?
'        <div class="article-cover">\n' +
'          <img src="' + esc(post.cover) + '" alt="' + esc(post.coverAlt || titlePlain) + '" width="1200" height="675">\n' +
'          <div class="corner tl">' + (post.corners && post.corners.tl || '') + '</div>\n' +
'          <div class="corner tr">' + (post.corners && post.corners.tr || '') + '</div>\n' +
'          <div class="corner br">' + (post.corners && post.corners.br || '') + '</div>\n' +
'        </div>\n' : '') +
(post.lede ? '        <p class="lede">' + post.lede + '</p>\n\n' : '') +
(post.bodyHtml
  ? '        <div class="article-richtext">\n' + post.bodyHtml + '\n        </div>'
  : renderBlocks(post.blocks)) + '\n\n' +
'        <a class="article-cta" href="' + esc(post.cta && post.cta.href || 'tel:+79952507772') + '">' +
        esc(post.cta && post.cta.text || 'Вызвать мастера') + ' <span class="arr">→</span></a>\n\n' +
'        <a class="back-link" href="/news">← Все материалы журнала</a>\n' +
'      </div>\n' +
'    </article>\n\n' +
'  </div>\n' +
'</section>\n\n' +
ctaStripe() + '\n\n' +
'</main>\n\n' +
footer() + '\n\n' +
SCRIPTS + '\n\n' +
METRIKA + '\n\n' +
'</body>\n</html>\n');
  }

  function ctaStripe() {
    return (
'<section class="cta-stripe">\n' +
'  <div class="wrap">\n' +
'    <h2 class="reveal">Сломалось?<br><em>Напишите нам.</em></h2>\n' +
'    <div class="ctas reveal">\n' +
'      <a href="tel:+79952507772" class="btn btn-primary">+7 (995) 250-77-72 <span class="arr">→</span></a>\n' +
'      <a href="https://t.me/remcity36" target="_blank" rel="noopener" class="btn btn-tg">Telegram <span class="arr">↗</span></a>\n' +
'    </div>\n' +
'  </div>\n' +
'</section>');
  }

  /* ── /news listing page ──────────────────────────────────── */

  function tocRows(posts) {
    return posts.map(function (p) {
      return (
'      <a href="/news/' + esc(p.slug) + '" class="toc-row">\n' +
'        <span class="idx">/ ' + String(p.num).padStart(2, '0') + '</span>\n' +
'        <span class="date">' + esc(p.dateDisplay) + '</span>\n' +
'        <span class="ti">' + (p.tocTitle || esc(p.title)) + '</span>\n' +
'        <span class="cat">' + esc(p.categoryTag || '') + '</span>\n' +
'        <span class="arr">→</span>\n' +
'      </a>');
    }).join('\n');
  }

  function cards(posts) {
    return posts.map(function (p) {
      return (
'      <article class="card' + (p.cover ? '' : ' card-nocover') + ' reveal">\n' +
'        <a class="card-link" href="/news/' + esc(p.slug) + '" aria-label="' + esc(plain(p.title)) + '"></a>\n' +
(p.cover ?
'        <div class="card-cover"><img src="' + esc(p.cover) + '" alt="' + esc(p.coverAlt || plain(p.title)) + '" loading="lazy"><span class="tag">' + esc(p.categoryTag || '') + '</span></div>\n' : '') +
'        <div class="card-body">\n' +
(p.cover ? '' :
'          <span class="tag tag-inline">' + esc(p.categoryTag || '') + '</span>\n') +
'          <div class="card-meta"><span>' + esc(p.dateDisplay) + '</span><span>' + esc(p.readTime) + '</span></div>\n' +
'          <h3>' + esc(plain(p.title)) + '</h3>\n' +
'          <p>' + esc(plain(p.description).slice(0, 150)) + '…</p>\n' +
'          <span class="card-more">Читать материал →</span>\n' +
'        </div>\n' +
'      </article>');
    }).join('\n');
  }

  function newsListingPage(posts, site, opts) {
    opts = opts || {};
    var origin = site.origin;
    var count = posts.length;
    var countStr = String(count).padStart(2, '0');
    var blogLd = {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'Журнал Ремсити36',
      url: origin + '/news',
      description: 'Полевые заметки сервисной мастерской Ремсити36 — о ремонте техники в Воронеже.',
      blogPost: posts.map(function (p) {
        return {
          '@type': 'BlogPosting',
          headline: plain(p.title),
          url: origin + '/news/' + p.slug,
          datePublished: p.date,
          image: (/^https?:/.test(p.cover) ? p.cover : origin + p.cover)
        };
      })
    };

    return (
'<!DOCTYPE html>\n' +
'<html lang="ru">\n' +
'<head>\n' +
'<meta charset="utf-8">\n' +
(opts.asIndex ? '<base href="/">\n' : '') +
'<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
'<title>Журнал — Ремсити36 | Ремонт бытовой техники в Воронеже</title>\n' +
'<meta name="description" content="Полевые заметки сервисной мастерской Ремсити36 — о ремонте телевизоров, стиральных машин, игровых консолей и другой техники в Воронеже.">\n' +
'<meta name="theme-color" content="#0a0a0a">\n' +
'<link rel="icon" href="/logo-96.webp" type="image/webp">\n' +
'<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n' +
'<link rel="canonical" href="' + origin + '/news">\n' +
'<meta property="og:type" content="website">\n' +
'<meta property="og:title" content="Журнал Ремсити36 — заметки из мастерской">\n' +
'<meta property="og:description" content="О ремонте техники в Воронеже: телевизоры, стиральные машины, консоли и другое.">\n' +
'<meta property="og:url" content="' + origin + '/news">\n' +
'<meta property="og:image" content="' + origin + '/og-image.jpg">\n' +
'<meta property="og:site_name" content="Ремсити36">\n' +
FONTS + '\n' +
'<link rel="stylesheet" href="/assets/journal.css">\n' +
'<script type="application/ld+json">' + JSON.stringify(blogLd) + '</script>\n' +
'</head>\n' +
'<body>\n\n' +
statusBar() + '\n\n' +
nav() + '\n\n' +
'<main>\n\n' +
'<section class="page-head" id="top">\n' +
'  <div class="grid-bg" aria-hidden="true"></div>\n' +
'  <div class="wrap">\n' +
'    <div class="crumbs">\n' +
'      <a href="/">Ремсити·36</a>\n' +
'      <span class="sl">/</span>\n' +
'      <span class="cur">Журнал</span>\n' +
'      <span class="sl">/</span>\n' +
'      <span>2026</span>\n' +
'    </div>\n' +
'    <h1 class="reveal"><span class="stroke">Полевой</span><br><em>журнал нашей мастерской</em></h1>\n' +
'    <div class="lead reveal">\n' +
'      <p><b>Заметки из мастерской.</b> Что мы чиним, как мы это делаем, какие неисправности встречаются чаще всего и почему не стоит откладывать ремонт. Без воды — только из практики мастерской.</p>\n' +
'      <div class="meta">\n' +
'        <span>ISSUE&nbsp;: <b>' + countStr + '/26</b></span>\n' +
'        <span>EDITOR&nbsp;: <b>STN&nbsp;VRN-36</b></span>\n' +
'        <span>POSTS&nbsp;: <b>' + countStr + '</b></span>\n' +
'      </div>\n' +
'    </div>\n' +
'  </div>\n' +
'</section>\n\n' +
'<section class="toc">\n' +
'  <div class="wrap">\n' +
'    <h3>Содержание <span>/ ' + countStr + ' материала</span></h3>\n' +
'    <div class="toc-list">\n' +
tocRows(posts) + '\n' +
'    </div>\n' +
'  </div>\n' +
'</section>\n\n' +
'<section class="cards">\n' +
'  <div class="wrap">\n' +
'    <div class="cards-grid">\n' +
cards(posts) + '\n' +
'    </div>\n' +
'  </div>\n' +
'</section>\n\n' +
ctaStripe() + '\n\n' +
'</main>\n\n' +
footer() + '\n\n' +
SCRIPTS + '\n\n' +
METRIKA + '\n\n' +
'</body>\n</html>\n');
  }

  /* ── sitemap.xml ─────────────────────────────────────────── */

  function sitemapXml(posts, site) {
    var origin = site.origin;
    var today = new Date().toISOString().slice(0, 10);
    var urls = [
      { loc: origin + '/', lastmod: today, changefreq: 'weekly', priority: '1.0' },
      { loc: origin + '/news', lastmod: today, changefreq: 'weekly', priority: '0.8' }
    ];
    posts.forEach(function (p) {
      urls.push({ loc: origin + '/news/' + p.slug, lastmod: p.dateModified || p.date, changefreq: 'monthly', priority: '0.7' });
    });
    var body = urls.map(function (u) {
      return (
'  <url>\n' +
'    <loc>' + u.loc + '</loc>\n' +
'    <lastmod>' + u.lastmod + '</lastmod>\n' +
'    <changefreq>' + u.changefreq + '</changefreq>\n' +
'    <priority>' + u.priority + '</priority>\n' +
'  </url>');
    }).join('\n');
    return (
'<?xml version="1.0" encoding="UTF-8"?>\n' +
'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n' +
'        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n' +
'        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9\n' +
'        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">\n' +
body + '\n' +
'</urlset>\n');
  }

  /* ── bump service-worker cache version ───────────────────── */

  function bumpSw(swText) {
    var v = 'remsiti36-static-v' + new Date().toISOString().slice(0, 10).replace(/-/g, '') +
      '-' + Math.random().toString(36).slice(2, 6);
    return swText.replace(/const CACHE_NAME = '[^']*';/, "const CACHE_NAME = '" + v + "';");
  }

  /* ── block → HTML (migrate old posts into the rich editor) ── */

  function blocksToHtml(blocks) {
    return (blocks || []).map(function (b) {
      var parts = (b.parts || []).map(function (p) {
        if (p.type === 'ul') {
          return '<ul>' + (p.items || []).map(function (it) { return '<li>' + it + '</li>'; }).join('') + '</ul>';
        }
        return '<p>' + (p.html || '') + '</p>';
      }).join('');
      return (b.h ? '<h2>' + b.h + '</h2>' : '') + parts;
    }).join('');
  }

  // Rough reading-time estimate from HTML/plain content.
  function estimateReadTime(html) {
    var words = plain(html).split(/\s+/).filter(Boolean).length;
    var min = Math.max(1, Math.round(words / 170));
    return '~' + min + ' мин';
  }

  /* ── validation ──────────────────────────────────────────── */

  function validatePost(p, existingSlugs) {
    var errs = [];
    if (!plain(p.title)) errs.push('Укажите заголовок');
    if (!p.slug) errs.push('Пустой slug (адрес страницы)');
    else if (!/^[a-z0-9-]+$/.test(p.slug)) errs.push('Slug может содержать только латиницу, цифры и дефис');
    else if (existingSlugs && existingSlugs.indexOf(p.slug) !== -1) errs.push('Такой slug уже используется');
    if (!plain(p.description)) errs.push('Добавьте короткое описание (для SEO)');
    if (!p.date) errs.push('Укажите дату');
    return errs;
  }

  return {
    esc: esc, plain: plain, slugify: slugify,
    articlePage: articlePage,
    newsListingPage: newsListingPage,
    sitemapXml: sitemapXml,
    bumpSw: bumpSw,
    validatePost: validatePost,
    renderBlocks: renderBlocks,
    blocksToHtml: blocksToHtml,
    estimateReadTime: estimateReadTime
  };
});
