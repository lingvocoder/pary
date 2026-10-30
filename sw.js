// Офлайн-режим: страница — сначала из сети (чтобы обновления приходили сразу),
// остальные файлы — из кэша. При новой версии меняется только имя кэша.
const CACHE = 'pary-v0.2';
const FILES = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png',
  './fonts/golos-text-cyrillic-400-normal.woff2', './fonts/golos-text-cyrillic-600-normal.woff2',
  './fonts/golos-text-cyrillic-700-normal.woff2', './fonts/golos-text-cyrillic-800-normal.woff2',
  './fonts/golos-text-latin-400-normal.woff2', './fonts/golos-text-latin-600-normal.woff2',
  './fonts/golos-text-latin-700-normal.woff2', './fonts/golos-text-latin-800-normal.woff2'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r)
      .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); return res; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(r).then(hit => hit || fetch(r)));
});
