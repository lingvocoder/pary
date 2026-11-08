/* Подсчёт часов: сколько занятий проведено и сколько по расписанию. */
import { LOCALE } from '../lang/ru.js';
import { addDays, weekStart, DAYS_PER_WEEK } from './dates.js';
import { weekLessons, slotTimes, isHoliday } from './lessons.js';

/** По курсу, затем по номеру группы (числа в номере — как числа: 99 < 100). */
const byCourseThenGroup = (first, second) =>
  first.course - second.course ||
  first.group.localeCompare(second.group, LOCALE, { numeric: true });

/**
 * Сколько занятий за период [from, to] — всего и уже проведённых, по группам.
 * Отменённые и праздники не считаются; перенесённое занятие считается в новый день.
 * Проведено — занятие, которое уже закончилось (конец ≤ now).
 * @param {Object} period
 * @param {State} period.state
 * @param {string} period.from  первая дата периода
 * @param {string} period.to    последняя дата периода
 * @param {Date} period.now
 * @param {string[]} [period.holidays]
 * @returns {{groups: {group:string, course:number, held:number, total:number}[], held:number, total:number}}
 */
export function countLessons({ state, from, to, now, holidays = [] }) {
  const byGroup = new Map();
  let held = 0,
    total = 0;
  // неделя за неделей: weekLessons уже учитывает переносы между неделями
  for (
    let weekStartDate = weekStart(from);
    weekStartDate <= to;
    weekStartDate = addDays(weekStartDate, DAYS_PER_WEEK)
  ) {
    for (const lesson of weekLessons(state, weekStartDate)) {
      const isInPeriod = lesson.date >= from && lesson.date <= to;
      if (!isInPeriod || lesson.cancelled || isHoliday(lesson.date, holidays))
        continue;
      const key = `${lesson.course}|${lesson.group}`;
      if (!byGroup.has(key))
        byGroup.set(key, {
          group: lesson.group,
          course: lesson.course,
          held: 0,
          total: 0,
        });
      const groupCount = byGroup.get(key);
      const isDone = slotTimes(lesson.date, lesson.slot).end <= now;
      groupCount.total++;
      total++;
      if (isDone) {
        groupCount.held++;
        held++;
      }
    }
  }
  const groups = [...byGroup.values()].sort(byCourseThenGroup);
  return { groups, held, total };
}
