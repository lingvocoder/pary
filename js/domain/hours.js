/* Подсчёт часов: сколько пар проведено и сколько по расписанию. */
import { addDays, weekStart, DAYS_PER_WEEK } from './dates.js';
import { weekOccurrences, slotTimes } from './lessons.js';

/**
 * Сколько пар за период [from, to] — всего и уже проведённых, по группам.
 * Отменённые и праздники не считаются; перенесённая пара считается в новый день.
 * Проведена — пара, которая уже закончилась (конец ≤ now).
 * @param {State} s
 * @param {string} from  первая дата периода
 * @param {string} to    последняя дата периода
 * @param {Date} now
 * @param {string[]} holidays  даты-праздники
 * @returns {{groups: {group:string, course:number, held:number, total:number}[], held:number, total:number}}
 */
export function countPairs(s, from, to, now, holidays = []) {
  const byGroup = new Map();
  let held = 0,
    total = 0;
  // неделя за неделей: weekOccurrences уже учитывает переносы между неделями
  for (let ws = weekStart(from); ws <= to; ws = addDays(ws, DAYS_PER_WEEK)) {
    for (const o of weekOccurrences(s, ws)) {
      if (o.date < from || o.date > to) continue;
      if (o.cancelled || holidays.includes(o.date)) continue;
      const key = `${o.course}|${o.group}`;
      if (!byGroup.has(key))
        byGroup.set(key, {
          group: o.group,
          course: o.course,
          held: 0,
          total: 0,
        });
      const g = byGroup.get(key);
      const done = slotTimes(o.date, o.slot).end <= now;
      g.total++;
      total++;
      if (done) {
        g.held++;
        held++;
      }
    }
  }
  // по курсу, затем по номеру группы
  const groups = [...byGroup.values()].sort(
    (a, b) =>
      a.course - b.course ||
      a.group.localeCompare(b.group, 'ru', { numeric: true }),
  );
  return { groups, held, total };
}
