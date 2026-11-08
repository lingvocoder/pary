/* Шторки снизу и вопрос «только эта дата или дальше». */
import { SHEET_CLOSE_MS } from '../config/interface.js';
import { hideToast } from './toast.js';
import { formatThisDateOption, formatFromDateOption } from '../domain/texts.js';
import { LESSON_KIND } from '../domain/lessons.js';
import { SCOPE } from '../domain/changes.js';
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
  scrim.addEventListener('click', (event) => {
    if (event.target === scrim) dismiss();
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

/**
 * Спрашивает «только эта дата или дальше». Разовое занятие — сразу «только эта дата».
 * @returns {Promise<string|null>} одно из SCOPE или null — «Отмена», затемнение, «Назад»
 */
export function askScope(lesson, title, note) {
  if (lesson.type === LESSON_KIND.ONE_OFF)
    return Promise.resolve(SCOPE.THIS_DATE);
  return new Promise((resolve) => {
    let isAnswered = false;
    const finish = (scope) => {
      if (isAnswered) return;
      isAnswered = true;
      close();
      resolve(scope || null);
    };
    const { root, close } = openSheet(
      scopeQuestionView({
        title,
        note: note || '',
        thisDateOption: formatThisDateOption(lesson.ruleDate),
        fromDateOption: formatFromDateOption(lesson.ruleDate),
      }),
      title,
      () => finish(''),
    );
    root.addEventListener('click', (event) => {
      const option = event.target.closest('[data-scope]');
      if (option) finish(option.dataset.scope);
    });
  });
}
