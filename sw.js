const CACHE_NAME = 'remsiti36-static-v20260526-1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
  '/logo-96.webp',
  '/og-image.jpg',
  '/hero_cover.webp',
  '/news.html',
  '/IMG_5824.webp',
  '/IMG_5825.webp',
  '/IMG_5829.webp',
  '/IMG_5833.webp',
  '/IMG_5834.webp',
  '/IMG_5837.webp',
  '/IMG_5873.webp',
  '/IMG_5882.webp',
  '/IMG_5883.webp'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        return response;
      });
    })
  );
});
