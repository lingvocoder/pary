/* Мелкие помощники интерфейса: поиск элементов, экранирование, уведомление, форматирование. */
import {
  SLOTS,
  COURSES,
  DEFAULT_COURSE,
  PALETTE,
} from '../config/university.js';
import { TOAST_DURATION_MS } from '../config/interface.js';
import { iconCheckCircle, iconXCircle } from './icons.js';

export const $ = (sel) => document.querySelector(sel);
/** Экранирует текст перед вставкой в HTML — защита от «сломанной» разметки. */
export const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
/** CSS-класс цвета пары: свой цвет «важной» пары (tint-red…) или цвет курса (course-1…4). */
export const colorClass = (o) => {
  const custom = PALETTE.find((p) => p.id && p.id === o.color);
  if (custom) return 'tint-' + custom.tint;
  return 'course-' + (COURSES.includes(+o.course) ? +o.course : DEFAULT_COURSE);
};
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
