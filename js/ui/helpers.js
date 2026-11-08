/* Мелкие помощники интерфейса: уведомление и сетка звонков. */
import { SLOTS } from '../config/university.js';
import { TOAST_DURATION_MS } from '../config/interface.js';
import { iconCheckCircle, iconXCircle } from './icons.js';
import { $, esc } from './dom.js';

export const slotOf = (n) => SLOTS[n - 1];

let toastTimer;

/** Показывает уведомление; иконка — только если вид указан явно. */
function showToast(msg, kind) {
  const icon =
    kind === 'success'
      ? iconCheckCircle('toast__icon toast__icon--success')
      : kind === 'error'
        ? iconXCircle('toast__icon toast__icon--error')
        : '';
  const t = $('#toast');
  t.innerHTML = `${icon}<span class="toast__text">${esc(msg)}</span>`;
  t.classList.add('toast--visible');
  clearTimeout(toastTimer);
}

/**
 * Короткое уведомление снизу, прячется само.
 * @param {string} msg
 * @param {'success'|'error'} [kind] галочка или крестик; без вида — без иконки,
 *   чтобы галочка не появилась на ошибке случайно
 */
export function toast(msg, kind) {
  showToast(msg, kind);
  toastTimer = setTimeout(hideToast, TOAST_DURATION_MS);
}

/** Уведомление без иконки, которое не прячется само: подсказки во время переноса. */
export function stickyToast(msg) {
  showToast(msg);
}

export const hideToast = () => $('#toast').classList.remove('toast--visible');
