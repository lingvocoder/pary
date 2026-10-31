/* Мелкие помощники интерфейса: поиск элементов, экранирование, уведомление, форматирование. */
import { CONFIG } from '../config.js';

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
/** 'ПК первого ин. яз.' → 'ПК' — подпись на маленькой карточке. */
export const abbr = (s) => {
  const w =
    String(s || '')
      .trim()
      .split(/\s+/)[0] || '';
  return w.length <= 5 ? w : w.slice(0, 4) + '.';
};
/** CSS-класс цвета пары: свой цвет «важной» пары (tint-red…) или цвет курса (course-1…4). */
export const colorClass = (o) => {
  const custom = CONFIG.palette.find((p) => p.id && p.id === o.color);
  if (custom) return 'tint-' + custom.tint;
  return 'course-' + ([1, 2, 3, 4].includes(+o.course) ? +o.course : 3);
};
export const slotOf = (n) => CONFIG.slots[n - 1];

let toastTimer;
/** Короткое уведомление сверху. sticky — не прятать само (для перетаскивания). */
export function toast(msg, sticky) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('toast--visible');
  clearTimeout(toastTimer);
  if (!sticky)
    toastTimer = setTimeout(() => t.classList.remove('toast--visible'), 2600);
}
export const hideToast = () => $('#toast').classList.remove('toast--visible');
