/* Исходное расписание: с него начинается приложение и к нему возвращает «Вернуть исходное расписание». */
import { SCHEMA } from '../config/app.js';
import { SEED_SUBJECT, DEFAULT_LESSON_TYPE } from '../config/university.js';
import { weekday } from './dates.js';
import { SOURCE } from './lessons.js';

/**
 * Правило исходного расписания. День недели берётся из даты начала.
 * @returns {Rule}
 */
function seedRule({ id, group, course, slot, from, source }) {
  const ruleWeekday = weekday(from);
  return {
    id,
    group,
    course,
    subject: SEED_SUBJECT,
    lessonType: DEFAULT_LESSON_TYPE,
    color: '',
    room: '',
    weekday: ruleWeekday,
    slot,
    from,
    until: null,
    teacher: '',
    source,
    // как узнать эту пару в новом PDF факультета
    importKey:
      source === SOURCE.PDF
        ? `${course}|${group}|${ruleWeekday}|${slot}|${SEED_SUBJECT}`
        : null,
  };
}

/** Пары исходного расписания: правило на каждую строку. День недели — из даты начала. */
const SEED_RULES = [
  {
    id: 'seed-221-tu-1',
    group: '221',
    course: 2,
    slot: 1,
    from: '2026-09-22',
    source: SOURCE.PDF,
  },
  {
    id: 'seed-124-tu-2',
    group: '124',
    course: 1,
    slot: 2,
    from: '2026-09-22',
    source: SOURCE.PDF,
  },
  {
    id: 'seed-326-we-5',
    group: '326',
    course: 3,
    slot: 5,
    from: '2026-10-28',
    source: SOURCE.MANUAL,
  },
  {
    id: 'seed-323-we-6',
    group: '323',
    course: 3,
    slot: 6,
    from: '2026-09-23',
    source: SOURCE.PDF,
  },
  {
    id: 'seed-323-we-7',
    group: '323',
    course: 3,
    slot: 7,
    from: '2026-09-23',
    source: SOURCE.PDF,
  },
  {
    id: 'seed-326-sa-1',
    group: '326',
    course: 3,
    slot: 1,
    from: '2026-09-26',
    source: SOURCE.PDF,
  },
];

/** Исходное расписание на 29 октября 2026. @returns {State} */
export function seed() {
  return {
    schema: SCHEMA,
    rules: SEED_RULES.map(seedRule),
    exceptions: {},
    oneOffs: [],
  };
}
