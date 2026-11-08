/* Уведомление снизу экрана: короткое с иконкой или «липкое» — подсказка во время переноса. */
import { TOAST_DURATION_MS } from '../config/interface.js';
import { $, esc } from './dom.js';
import { iconCheckCircle, iconXCircle } from './icons.js';

/** Вид уведомления: галочка или крестик. */
export const TOAST_KIND = Object.freeze({ SUCCESS: 'success', ERROR: 'error' });

let hideTimer;

/** Иконка вида: только если вид указан явно. */
function kindIcon(kind) {
  if (kind === TOAST_KIND.SUCCESS)
    return iconCheckCircle('toast__icon toast__icon--success');
  if (kind === TOAST_KIND.ERROR)
    return iconXCircle('toast__icon toast__icon--error');
  return '';
}

function showToast(message, kind) {
  const toastElement = $('#toast');
  toastElement.innerHTML = `${kindIcon(kind)}<span class="toast__text">${esc(message)}</span>`;
  toastElement.classList.add('toast--visible');
  clearTimeout(hideTimer);
}

/**
 * Короткое уведомление снизу, прячется само.
 * @param {string} message
 * @param {string} [kind] одно из TOAST_KIND; без вида — без иконки,
 *   чтобы галочка не появилась на ошибке случайно
 */
export function toast(message, kind) {
  showToast(message, kind);
  hideTimer = setTimeout(hideToast, TOAST_DURATION_MS);
}

/** Уведомление без иконки, которое не прячется само: подсказки во время переноса. */
export function stickyToast(message) {
  showToast(message);
}

export const hideToast = () => $('#toast').classList.remove('toast--visible');
