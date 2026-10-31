/* Шторки снизу и вопрос «только эта дата или дальше». */
import { esc, hideToast } from './helpers.js';
import { humanDate } from '../dates.js';

/** Открывает шторку с готовым HTML. Возвращает {root, scrim, close}. */
export function openSheet(html, label) {
  const scrim = document.createElement('div');
  scrim.className = 'sheet';
  scrim.innerHTML = `<section class="sheet__panel" role="dialog" aria-modal="true" aria-label="${esc(label)}"><span class="sheet__grab"></span>${html}</section>`;
  document.body.appendChild(scrim);
  hideToast();
  requestAnimationFrame(() => scrim.classList.add('sheet--open'));
  const close = () => {
    scrim.classList.remove('sheet--open');
    setTimeout(() => scrim.remove(), 180);
  };
  scrim.addEventListener('click', (e) => {
    if (e.target === scrim) close();
  });
  return { root: scrim.querySelector('.sheet__panel'), scrim, close };
}

/** Спрашивает «только эта дата или дальше». Возвращает 'one' | 'future' | null. */
export function askScope(o, title, note) {
  if (o.type === 'once') return Promise.resolve('one');
  return new Promise((resolve) => {
    const { root, scrim, close } = openSheet(
      `<h2 class="sheet__title">${esc(title)}</h2>${note ? `<p class="sheet__note">${esc(note)}</p>` : ''}
      <button class="scope-option" data-v="one"><b class="scope-option__title">Только ${humanDate(o.orig)}</b><small class="scope-option__hint">Остальные недели не меняются</small></button>
      <button class="scope-option" data-v="future"><b class="scope-option__title">${humanDate(o.orig)} и все следующие недели</b><small class="scope-option__hint">Прошлые недели останутся как были</small></button>
      <button class="btn btn--plain" data-v="">Отмена</button>`,
      title,
    );
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      close();
      resolve(v || null);
    };
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (b) finish(b.dataset.v);
    });
    scrim.addEventListener('click', (e) => {
      if (e.target === scrim) finish('');
    });
  });
}
