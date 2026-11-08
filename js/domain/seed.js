/* Исходное расписание: с него начинается приложение и к нему возвращает «Вернуть исходное расписание». */
import { SCHEMA } from '../config/app.js';
import { SEED_SUBJECT, DEFAULT_LESSON_TYPE } from '../config/university.js';
import { weekday } from './dates.js';

/** Исходное расписание на 29 октября 2026. @returns {State} */
export function seed() {
  const rule = (id, group, course, wd, slot, from, source) => ({
    id,
    group,
    course,
    subject: SEED_SUBJECT,
    lessonType: DEFAULT_LESSON_TYPE,
    color: '',
    room: '',
    weekday: wd,
    slot,
    from,
    until: null,
    teacher: '',
    source,
    importKey:
      source === 'pdf'
        ? `${course}|${group}|${wd}|${slot}|${SEED_SUBJECT}`
        : null,
  });
  return {
    schema: SCHEMA,
    rules: [
      rule('seed-221-tu-1', '221', 2, 1, 1, '2026-09-22', 'pdf'),
      rule('seed-124-tu-2', '124', 1, 1, 2, '2026-09-22', 'pdf'),
      rule('seed-326-we-5', '326', 3, 2, 5, '2026-10-28', 'manual'),
      rule('seed-323-we-6', '323', 3, 2, 6, '2026-09-23', 'pdf'),
      rule('seed-323-we-7', '323', 3, 2, 7, '2026-09-23', 'pdf'),
      rule('seed-326-sa-1', '326', 3, 5, 1, '2026-09-26', 'pdf'),
    ],
    exceptions: {},
    oneOffs: [],
  };
}
