/* Часы за семестр: сколько пар проведено и сколько по расписанию, по группам. */
import { SEMESTER, HOLIDAYS } from '../config/university.js';
import { formatSemesterNote } from '../domain/texts.js';
import { countLessons } from '../domain/hours.js';
import { getState } from '../store/store.js';
import { lessonColorClass } from './views/color.js';
import { openSheet } from './sheets.js';
import { hoursView } from './views/hours.js';

export function openHours() {
  const { from, to } = SEMESTER;
  const r = countLessons({
    state: getState(),
    from: from,
    to: to,
    now: new Date(),
    holidays: HOLIDAYS,
  });
  // бейдж — цвет курса, а не «важный» цвет отдельной пары
  const groups = r.groups.map((g) => ({
    group: g.group,
    colorClass: lessonColorClass({ course: g.course }),
    held: g.held,
    total: g.total,
  }));
  const s = openSheet(
    hoursView({
      semesterNote: formatSemesterNote(SEMESTER),
      groups,
      held: r.held,
      total: r.total,
    }),
    'Часы за семестр',
  );
  s.root.querySelector('#hoursClose').onclick = s.close;
}
