/* Часы за семестр: сколько пар проведено и сколько по расписанию, по группам. */
import { SEMESTER, HOLIDAYS } from '../config/university.js';
import {
  formatLessonCount,
  formatHours,
  formatSemesterNote,
} from '../domain/texts.js';
import { countLessons } from '../domain/hours.js';
import { getState } from '../store/store.js';
import { esc, colorClass } from './helpers.js';
import { iconClock } from './icons.js';
import { openSheet } from './sheets.js';

/** Клетка таблицы: часы крупно, под ними — сколько это пар. */
const amountCell = (pairs) =>
  `<td class="hours-table__cell hours-table__cell--num"><span class="hours-table__value">${formatHours(pairs)}</span><span class="hours-table__count">${formatLessonCount(pairs)}</span></td>`;

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
  const rows = r.groups
    .map(
      (g) =>
        `<tr><th class="hours-table__cell" scope="row"><span class="chip hours-table__chip ${colorClass({ course: g.course })}">${esc(g.group)}</span></th>${amountCell(g.held)}${amountCell(g.total)}</tr>`,
    )
    .join('');
  const s = openSheet(
    `<div class="sheet__header">
      <h2 class="sheet__title sheet__title--with-icon">${iconClock('sheet__title-icon')}Часы за семестр</h2>
      <p class="sheet__note">${formatSemesterNote(SEMESTER)}</p>
    </div>
    <table class="hours-table">
      <thead><tr>
        <th class="hours-table__head" scope="col">Группа</th>
        <th class="hours-table__head hours-table__head--num" scope="col">Проведено</th>
        <th class="hours-table__head hours-table__head--num" scope="col">По расписанию</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr>
        <th class="hours-table__cell hours-table__cell--total" scope="row">Итого</th>
        <td class="hours-table__cell hours-table__cell--total hours-table__cell--num">${formatHours(r.held)}</td>
        <td class="hours-table__cell hours-table__cell--total hours-table__cell--num">${formatHours(r.total)}</td>
      </tr></tfoot>
    </table>
    <p class="sheet__note">Проведено — пары, которые уже закончились. Отменённые и праздники не считаются.</p>
    <div class="sheet__actions"><button class="btn btn--secondary" id="hoursClose">Закрыть</button></div>`,
    'Часы за семестр',
  );
  s.root.querySelector('#hoursClose').onclick = s.close;
}
