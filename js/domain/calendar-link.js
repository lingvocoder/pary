/* Ссылка «Добавить в Google Календарь» для одного занятия. Чистая функция: правило — параметром. */
import { SLOTS, TIMEZONE } from '../config/university.js';
import { LESSON_KIND } from './lessons.js';
import {
  formatCalendarTitle,
  formatCalendarDetails,
  formatCalendarLocation,
} from './texts.js';

const CALENDAR_URL = 'https://calendar.google.com/calendar/render?';
/* Конец последнего дня повтора: 23:59:59 по Москве (TIMEZONE, UTC+3) — это 20:59:59 UTC.
   Сменится часовой пояс вуза — поменять и это время. */
const UNTIL_END_OF_DAY_UTC = 'T205959Z';

const compactDate = (isoDate) => isoDate.replace(/-/g, '');
const compactTime = (time) => time.replace(':', '') + '00';

/**
 * @param {Lesson} lesson
 * @param {Rule} [rule]  правило занятия: у повторяющегося на своём месте событие повторяется
 * @returns {string} адрес страницы создания события
 */
export function calendarLink(lesson, rule) {
  const bell = SLOTS[lesson.slot - 1];
  const day = compactDate(lesson.date);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: formatCalendarTitle(lesson),
    dates: `${day}T${compactTime(bell.start)}/${day}T${compactTime(bell.end)}`,
    ctz: TIMEZONE,
    details: formatCalendarDetails(lesson),
  });
  if (lesson.room) params.set('location', formatCalendarLocation(lesson.room));
  // повторяющаяся на своём месте — с повтором каждую неделю; перенесённая — разовое событие
  if (lesson.type === LESSON_KIND.RULE && !lesson.moved) {
    const until = rule.until
      ? `;UNTIL=${compactDate(rule.until)}${UNTIL_END_OF_DAY_UTC}`
      : '';
    params.set('recur', 'RRULE:FREQ=WEEKLY' + until);
  }
  return CALENDAR_URL + params.toString();
}
