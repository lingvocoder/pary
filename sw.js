// Офлайн-режим: страница — сначала из сети (чтобы обновления приходили сразу),
// остальные файлы — из кэша. При новой версии меняется имя кэша.
// ВАЖНО: каждый новый файл приложения нужно добавить в FILES, иначе без интернета он не загрузится.
const CACHE = 'pary-v0.3';
const FILES = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/main.js', './js/config.js', './js/dates.js', './js/model.js', './js/store.js',
  './js/ui/helpers.js', './js/ui/state.js', './js/ui/sheets.js', './js/ui/calendar.js',
  './js/ui/editor.js', './js/ui/popover.js', './js/ui/menu.js', './js/ui/week.js', './js/ui/gestures.js',
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
