// Офлайн-режим: страница — сначала из сети (чтобы обновления приходили сразу),
// остальные файлы — из кэша. При новой версии меняется имя кэша.
// ВАЖНО: каждый новый файл приложения нужно добавить в FILES, иначе без интернета он не загрузится.
const CACHE = 'pary-v0.5.0';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/main.js',
  './js/config/app.js',
  './js/config/university.js',
  './js/config/interface.js',
  './js/lang/ru.js',
  './js/domain/dates.js',
  './js/domain/lessons.js',
  './js/domain/rules.js',
  './js/domain/changes.js',
  './js/domain/hours.js',
  './js/domain/seed.js',
  './js/domain/migrate.js',
  './js/domain/forms.js',
  './js/domain/texts.js',
  './js/domain/calendar-link.js',
  './js/store/store.js',
  './js/store/prefs.js',
  './js/ui/dom.js',
  './js/ui/toast.js',
  './js/ui/views/color.js',
  './js/ui/views/hero.js',
  './js/ui/views/card.js',
  './js/ui/views/week-grid.js',
  './js/ui/views/empty-week.js',
  './js/ui/views/popover.js',
  './js/ui/views/editor.js',
  './js/ui/views/sheets.js',
  './js/ui/views/menu.js',
  './js/ui/views/hours.js',
  './js/ui/hours.js',
  './js/ui/geometry.js',
  './js/ui/icons.js',
  './js/ui/layers.js',
  './js/ui/screen-state.js',
  './js/ui/sheets.js',
  './js/ui/editor.js',
  './js/ui/popover.js',
  './js/ui/menu.js',
  './js/ui/week-screen.js',
  './js/ui/gestures.js',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './fonts/golos-text-cyrillic-400-normal.woff2',
  './fonts/golos-text-cyrillic-500-normal.woff2',
  './fonts/golos-text-cyrillic-600-normal.woff2',
  './fonts/golos-text-latin-400-normal.woff2',
  './fonts/golos-text-latin-500-normal.woff2',
  './fonts/golos-text-latin-600-normal.woff2',
];
self.addEventListener('install', (e) => {
  // cache: 'reload' — брать файлы с сервера мимо HTTP-кэша браузера. Иначе в новый кэш
  // может попасть старая копия файла, и приложение застрянет на ней до следующей версии.
  const fresh = FILES.map((f) => new Request(f, { cache: 'reload' }));
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(fresh))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  if (r.mode === 'navigate') {
    e.respondWith(
      fetch(r)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }
  e.respondWith(caches.match(r).then((hit) => hit || fetch(r)));
});
