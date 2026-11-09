/* Слова русского языка: дни недели, месяцы, склонение после числа. */

/** Язык сравнения строк: сортировка групп и предметов по-русски. */
export const LOCALE = 'ru';

/** Дни недели с понедельника, как в weekday(): 0 = понедельник. */
export const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const WEEKDAYS = [
  'понедельник',
  'вторник',
  'среда',
  'четверг',
  'пятница',
  'суббота',
  'воскресенье',
];
/** «Перенести на понедельник». */
export const WEEKDAYS_TO = [
  'на понедельник',
  'на вторник',
  'на среду',
  'на четверг',
  'на пятницу',
  'на субботу',
  'на воскресенье',
];
/** «Добавлено: в понедельник». */
export const WEEKDAYS_IN = [
  'в понедельник',
  'во вторник',
  'в среду',
  'в четверг',
  'в пятницу',
  'в субботу',
  'в воскресенье',
];
/** «28 октября». */
export const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];
/** «26 окт – 1 ноя». */
export const MONTHS_SHORT = [
  'янв',
  'фев',
  'мар',
  'апр',
  'мая',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
];

// Склонение после числа: смотрим на последнюю цифру, а 11–14 — исключение.
const DECIMAL_BASE = 10;
const LAST_TWO_DIGITS_BASE = 100;
const TEENS_FIRST = 11; // 11–14: «пар», хотя кончаются на 1–4
const TEENS_LAST = 14;
const FEW_FIRST = 2; // 2–4: «пары»
const FEW_LAST = 4;

/**
 * Склонение после числа: plural(1, 'пара', 'пары', 'пар') → 'пара'.
 * 1, 21, 31… — one; 2–4, 22–24… — few; остальное и 11–14 — many.
 * @param {number} count
 * @param {string} one
 * @param {string} few
 * @param {string} many
 * @returns {string}
 */
// standard: три формы слова подряд, как в словаре, — объект здесь читается хуже
export function plural(count, one, few, many) {
  const lastDigit = count % DECIMAL_BASE,
    lastTwoDigits = count % LAST_TWO_DIGITS_BASE;
  if (lastTwoDigits >= TEENS_FIRST && lastTwoDigits <= TEENS_LAST) return many;
  if (lastDigit === 1) return one;
  if (lastDigit >= FEW_FIRST && lastDigit <= FEW_LAST) return few;
  return many;
}
