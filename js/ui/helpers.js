/* Мелкие помощники интерфейса: поиск элементов, экранирование, уведомление, форматирование. */
import {CONFIG} from '../config.js';

export const $ = sel => document.querySelector(sel);
/** Экранирует текст перед вставкой в HTML — защита от «сломанной» разметки. */
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
/** 'ПК первого ин. яз.' → 'ПК' — подпись на маленькой карточке. */
export const abbr = s => { const w = String(s || '').trim().split(/\s+/)[0] || ''; return w.length <= 5 ? w : w.slice(0, 4) + '.'; };
/** Цвет «важной» пары или null, если цвет — как у курса. */
export const userHex = o => (CONFIG.palette.find(p => p.id === o.color) || {}).hex || null;
/** CSS-класс цвета курса: course-1…course-4. */
export const courseClass = c => 'course-' + ([1, 2, 3, 4].includes(+c) ? +c : 3);
export const slotOf = n => CONFIG.slots[n - 1];

let toastTimer;
/** Короткое уведомление сверху. sticky — не прятать само (для перетаскивания). */
export function toast(msg, sticky) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('toast--visible'); clearTimeout(toastTimer);
  if (!sticky) toastTimer = setTimeout(() => t.classList.remove('toast--visible'), 2600);
}
export const hideToast = () => $('#toast').classList.remove('toast--visible');
