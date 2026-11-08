/* Даты — строки 'YYYY-MM-DD' без часовых поясов. Чистые функции. */
import { MONTHS_GENITIVE } from '../lang/ru.js';

// Законы календаря: это не настройки, их не меняют.
export const DAYS_PER_WEEK = 7;
/** Номер воскресенья в weekday(): неделя у нас с понедельника, он — 0. */
export const SUNDAY = 6;
export const MINUTES_PER_HOUR = 60;
export const MS_PER_MINUTE = 60 * 1000;
const DATE_PART_DIGITS = 2; // «03» в '2026-11-03'

/** Число с ведущим нулём: 3 → '03'. */
export const pad = (number) => String(number).padStart(DATE_PART_DIGITS, '0');

/** Объект Date → 'YYYY-MM-DD' по местному времени. */
export const toIso = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** 'YYYY-MM-DD' → объект Date на полночь по местному времени. */
export function fromIso(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Дата через days дней (days < 0 — назад). */
export function addDays(isoDate, days) {
  const date = fromIso(isoDate);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

/** День недели: 0 = понедельник … 6 = воскресенье. */
// getDay() считает с воскресенья (0); сдвиг на SUNDAY делает нулём понедельник
export const weekday = (isoDate) =>
  (fromIso(isoDate).getDay() + SUNDAY) % DAYS_PER_WEEK;

/** Понедельник недели, в которую попадает дата. */
export const weekStart = (isoDate) => addDays(isoDate, -weekday(isoDate));

/** Дата + время 'HH:MM' → объект Date. */
export function atTime(isoDate, time) {
  const date = fromIso(isoDate);
  const [hours, minutes] = time.split(':').map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/** '2026-10-28' → '28 октября' */
export function humanDate(isoDate) {
  const date = fromIso(isoDate);
  return `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`;
}
