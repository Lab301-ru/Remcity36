#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────
   РЕМСИТИ·36 — static news build
   Regenerates every news artefact from news/posts.json:
     • /news/<slug>/index.html   (per-article SEO pages)
     • /news.html  +  /news/index.html   (listing)
     • /sitemap.xml
     • bumps /sw.js cache version
   Run:  node admin/build.js
─────────────────────────────────────────────────────────────── */
'use strict';

const fs = require('fs');
const path = require('path');
const G = require('./generator.js');

const ROOT = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'news', 'posts.json'), 'utf8'));
const site = data.site;
const posts = (data.posts || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));

function write(rel, content) {
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  console.log('  ✓', rel);
}

console.log('Building news from news/posts.json …');

// Per-article pages
posts.forEach((p) => write(path.join('news', p.slug, 'index.html'), G.articlePage(p, site)));

// Listing pages (news.html at root + news/index.html with <base>)
write('news.html', G.newsListingPage(posts, site, { asIndex: false }));
write(path.join('news', 'index.html'), G.newsListingPage(posts, site, { asIndex: true }));

// sitemap
write('sitemap.xml', G.sitemapXml(posts, site));

// bump service worker cache
const swPath = path.join(ROOT, 'sw.js');
if (fs.existsSync(swPath)) {
  write('sw.js', G.bumpSw(fs.readFileSync(swPath, 'utf8')));
}

console.log('Done. ' + posts.length + ' article(s).');
