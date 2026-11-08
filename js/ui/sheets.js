/* Шторки снизу и вопрос «только эта дата или дальше». */
import { SHEET_CLOSE_MS } from '../config/interface.js';
import { esc, hideToast } from './helpers.js';
import { humanDate } from '../dates.js';
import { addLayer, removeLayer } from './layers.js';

/**
 * Открывает шторку с готовым HTML. Возвращает {root, scrim, close}.
 * @param {string} html
 * @param {string} label
 * @param {function(): void} [onDismiss]  что делать при тапе по затемнению, «Назад»
 *   и Esc, если просто закрыть мало: например, ответить «Отмена» тому, кто ждёт
 */
export function openSheet(html, label, onDismiss) {
  const scrim = document.createElement('div');
  scrim.className = 'sheet';
  scrim.innerHTML = `<section class="sheet__panel" role="dialog" aria-modal="true" aria-label="${esc(label)}"><span class="sheet__grab"></span>${html}</section>`;
  document.body.appendChild(scrim);
  hideToast();
  requestAnimationFrame(() => scrim.classList.add('sheet--open'));
  const close = () => {
    removeLayer(layer);
    scrim.classList.remove('sheet--open');
    setTimeout(() => scrim.remove(), SHEET_CLOSE_MS);
  };
  const dismiss = onDismiss || close;
  const layer = addLayer(dismiss);
  scrim.addEventListener('click', (e) => {
    if (e.target === scrim) dismiss();
  });
  return { root: scrim.querySelector('.sheet__panel'), scrim, close };
}

/**
 * Подтверждение необратимого действия: красная кнопка и «Отмена».
 * Затемнение, «Назад» и Esc работают как «Отмена».
 * @param {string} title
 * @param {string} note
 * @param {string} confirmText  текст красной кнопки
 * @returns {Promise<boolean>} true — подтвердили
 */
export function askConfirm(title, note, confirmText) {
  return new Promise((resolve) => {
    const finish = (answer) => {
      close();
      resolve(answer);
    };
    const { root, close } = openSheet(
      `<div class="sheet__header"><h2 class="sheet__title">${esc(title)}</h2><p class="sheet__note">${esc(note)}</p></div>
      <div class="sheet__actions"><button class="btn btn--danger" data-confirm>${esc(confirmText)}</button><button class="btn btn--plain" data-cancel>Отмена</button></div>`,
      title,
      () => finish(false),
    );
    root.querySelector('[data-confirm]').onclick = () => finish(true);
    root.querySelector('[data-cancel]').onclick = () => finish(false);
  });
}

/** Спрашивает «только эта дата или дальше». Возвращает 'one' | 'future' | null. */
export function askScope(o, title, note) {
  if (o.type === 'once') return Promise.resolve('one');
  return new Promise((resolve) => {
    const { root, close } = openSheet(
      `<div class="sheet__header"><h2 class="sheet__title">${esc(title)}</h2>${note ? `<p class="sheet__note">${esc(note)}</p>` : ''}</div>
      <button class="scope-option" data-v="one"><b class="scope-option__title">Только ${humanDate(o.orig)}</b><small class="scope-option__hint">Остальные недели не меняются</small></button>
      <button class="scope-option" data-v="future"><b class="scope-option__title">${humanDate(o.orig)} и все следующие недели</b><small class="scope-option__hint">Прошлые недели останутся как были</small></button>
      <button class="btn btn--plain" data-v="">Отмена</button>`,
      title,
      () => finish(''),
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
  });
}
