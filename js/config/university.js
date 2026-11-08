/* Настройки. Всё, что зависит от вуза и факультета, живёт здесь. */

/** Сетка звонков. У другого факультета — своя. Номер пары (slot) — позиция в списке, с 1. */
export const SLOTS = [
  { start: '08:00', end: '09:20' },
  { start: '09:30', end: '10:50' },
  { start: '11:10', end: '12:30' },
  { start: '12:40', end: '14:00' },
  { start: '14:10', end: '15:30' },
  { start: '15:40', end: '17:00' },
  { start: '17:10', end: '18:30' },
  { start: '18:40', end: '20:00' },
  { start: '20:10', end: '21:30' },
];

/** Учебная неделя — шестидневка: пары с понедельника по субботу. */
export const WORKDAYS_PER_WEEK = 6;

export const COURSES = [1, 2, 3, 4];
/** Курс новой пары и запасной цвет, если курс в данных не из списка. */
export const DEFAULT_COURSE = 3;

export const SUBJECTS = ['ПК первого ин. яз.', 'ИКТ в лингвистике'];
/** Предмет пар исходного расписания (кнопка «Вернуть исходное расписание»). */
export const SEED_SUBJECT = SUBJECTS[0];
/** Вид занятия новой пары. */
export const DEFAULT_LESSON_TYPE = 'ЛР';

/**
 * Цвета для важных пар. id хранится в данных пользователя и не меняется
 * (иначе нужна миграция). tint — оттенок палитры Tailwind, CSS-класс tint-<tint>.
 */
export const PALETTE = [
  { id: '', name: 'Как у курса' },
  { id: 'red', name: 'Красный', tint: 'red' },
  { id: 'amber', name: 'Оранжевый', tint: 'orange' },
  { id: 'green', name: 'Зелёный', tint: 'green' },
  { id: 'blue', name: 'Синий', tint: 'blue' },
  { id: 'violet', name: 'Фиолетовый', tint: 'violet' },
  { id: 'slate', name: 'Серый', tint: 'gray' },
];

export const TIMEZONE = 'Europe/Moscow';

/** Семестр для подсчёта часов. Временно — позже даты из графика КубГУ. */
export const SEMESTER = { from: '2026-09-01', to: '2026-12-31' };

/** Праздники: пары в эти дни не считаются. По производственному календарю
    на шестидневку — сверить с графиком вуза. */
export const HOLIDAYS = ['2026-11-04', '2026-12-31'];

/** Академических часов в одной паре. */
export const HOURS_PER_PAIR = 2;
