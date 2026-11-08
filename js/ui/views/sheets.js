/* Шторки: панель, подтверждение необратимого действия, вопрос «только эта дата или дальше». */
import { esc } from '../dom.js';

/** Панель шторки с ручкой сверху. */
export const sheetPanelView = (label, content) =>
  `<section class="sheet__panel" role="dialog" aria-modal="true" aria-label="${esc(label)}"><span class="sheet__grab"></span>${content}</section>`;

/**
 * Подтверждение: заголовок, пояснение, красная кнопка и «Отмена».
 * @param {{title: string, note: string, confirmText: string}} confirm
 */
export const confirmView = (confirm) =>
  `<div class="sheet__header"><h2 class="sheet__title">${esc(confirm.title)}</h2><p class="sheet__note">${esc(confirm.note)}</p></div>
      <div class="sheet__actions"><button class="btn btn--danger" data-confirm>${esc(confirm.confirmText)}</button><button class="btn btn--plain" data-cancel>Отмена</button></div>`;

/**
 * Вопрос «только эта дата или дальше».
 * @param {{title: string, note: string, thisDateOption: string, fromDateOption: string}} question
 *   note '' — без пояснения
 */
export const scopeQuestionView = (question) =>
  `<div class="sheet__header"><h2 class="sheet__title">${esc(question.title)}</h2>${question.note ? `<p class="sheet__note">${esc(question.note)}</p>` : ''}</div>
      <button class="scope-option" data-v="one"><b class="scope-option__title">${question.thisDateOption}</b><small class="scope-option__hint">Остальные недели не меняются</small></button>
      <button class="scope-option" data-v="future"><b class="scope-option__title">${question.fromDateOption}</b><small class="scope-option__hint">Прошлые недели останутся как были</small></button>
      <button class="btn btn--plain" data-v="">Отмена</button>`;
