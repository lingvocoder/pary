/* Часы за семестр: сколько пар проведено и сколько по расписанию, по группам. */
import { SEMESTER, HOLIDAYS } from '../config/university.js';
import { formatSemesterNote } from '../domain/texts.js';
import { countLessons } from '../domain/hours.js';
import { getState } from '../store/store.js';
import { lessonColorClass } from './views/color.js';
import { openSheet } from './sheets.js';
import { hoursView } from './views/hours.js';

export function openHours() {
  const report = countLessons({
    state: getState(),
    from: SEMESTER.from,
    to: SEMESTER.to,
    now: new Date(),
    holidays: HOLIDAYS,
  });
  // бейдж — цвет курса, а не «важный» цвет отдельного занятия
  const groups = report.groups.map((groupCount) => ({
    group: groupCount.group,
    colorClass: lessonColorClass({ course: groupCount.course }),
    held: groupCount.held,
    total: groupCount.total,
  }));
  const sheet = openSheet(
    hoursView({
      semesterNote: formatSemesterNote(SEMESTER),
      groups,
      held: report.held,
      total: report.total,
    }),
    'Часы за семестр',
  );
  sheet.root.querySelector('#hours-close').onclick = sheet.close;
}
