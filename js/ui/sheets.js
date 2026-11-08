/* Шторки снизу и вопрос «только эта дата или дальше». */
import { SHEET_CLOSE_MS } from '../config/interface.js';
import { hideToast } from './toast.js';
import { formatThisDateOption, formatFromDateOption } from '../domain/texts.js';
import { LESSON_KIND } from '../domain/lessons.js';
import { addLayer, removeLayer } from './layers.js';
import {
  sheetPanelView,
  confirmView,
  scopeQuestionView,
} from './views/sheets.js';

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
  scrim.innerHTML = sheetPanelView(label, html);
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
      confirmView({ title, note, confirmText }),
      title,
      () => finish(false),
    );
    root.querySelector('[data-confirm]').onclick = () => finish(true);
    root.querySelector('[data-cancel]').onclick = () => finish(false);
  });
}

/** Спрашивает «только эта дата или дальше». Возвращает 'one' | 'future' | null. */
export function askScope(o, title, note) {
  if (o.type === LESSON_KIND.ONE_OFF) return Promise.resolve('one');
  return new Promise((resolve) => {
    const { root, close } = openSheet(
      scopeQuestionView({
        title,
        note: note || '',
        thisDateOption: formatThisDateOption(o.ruleDate),
        fromDateOption: formatFromDateOption(o.ruleDate),
      }),
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
