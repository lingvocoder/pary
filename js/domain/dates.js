/* Даты — строки 'YYYY-MM-DD' без часовых поясов. Чистые функции. */
import { MONTHS_GENITIVE } from '../lang/ru.js';

// Законы календаря: это не настройки, их не меняют.
export const DAYS_PER_WEEK = 7;
/** Номер воскресенья в weekday(): неделя у нас с понедельника, он — 0. */
export const SUNDAY = 6;
export const MINUTES_PER_HOUR = 60;
export const MS_PER_MINUTE = 60 * 1000;
const DATE_PART_DIGITS = 2; // «03» в '2026-11-03'

export const pad = (n) => String(n).padStart(DATE_PART_DIGITS, '0');
export const toIso = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromIso = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (s, n) => {
  const d = fromIso(s);
  d.setDate(d.getDate() + n);
  return toIso(d);
};
/** 0 = понедельник … 6 = воскресенье */
// getDay() считает с воскресенья (0); сдвиг на SUNDAY делает нулём понедельник
export const weekday = (s) => (fromIso(s).getDay() + SUNDAY) % DAYS_PER_WEEK;
/** Понедельник недели, в которую попадает дата. */
export const weekStart = (s) => addDays(s, -weekday(s));
/** Дата + время 'HH:MM' → объект Date. */
export const atTime = (date, hm) => {
  const d = fromIso(date);
  const [h, m] = hm.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
};
/** '2026-10-28' → '28 октября' */
export const humanDate = (s) => {
  const d = fromIso(s);
  return `${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]}`;
};
