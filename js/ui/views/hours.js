/* Часы за семестр: таблица по группам, итог и пояснение. */
import { formatHours, formatLessonCount } from '../../domain/texts.js';
import { esc } from '../dom.js';
import { iconClock } from '../icons.js';

/** Клетка таблицы: часы крупно, под ними — сколько это пар. */
const amountCellView = (lessonCount) =>
  `<td class="hours-table__cell hours-table__cell--num"><span class="hours-table__value">${formatHours(lessonCount)}</span><span class="hours-table__count">${formatLessonCount(lessonCount)}</span></td>`;

const groupRowView = (group) =>
  `<tr><th class="hours-table__cell" scope="row"><span class="chip hours-table__chip ${group.colorClass}">${esc(group.group)}</span></th>${amountCellView(group.held)}${amountCellView(group.total)}</tr>`;

/**
 * @param {Object} hours
 * @param {string} hours.semesterNote
 * @param {{group: string, colorClass: string, held: number, total: number}[]} hours.groups
 * @param {number} hours.held
 * @param {number} hours.total
 * @returns {string} HTML
 */
export const hoursView = (hours) => `<div class="sheet__header">
      <h2 class="sheet__title sheet__title--with-icon">${iconClock('sheet__title-icon')}Часы за семестр</h2>
      <p class="sheet__note">${hours.semesterNote}</p>
    </div>
    <table class="hours-table">
      <thead><tr>
        <th class="hours-table__head" scope="col">Группа</th>
        <th class="hours-table__head hours-table__head--num" scope="col">Проведено</th>
        <th class="hours-table__head hours-table__head--num" scope="col">По расписанию</th>
      </tr></thead>
      <tbody>${hours.groups.map(groupRowView).join('')}</tbody>
      <tfoot><tr>
        <th class="hours-table__cell hours-table__cell--total" scope="row">Итого</th>
        <td class="hours-table__cell hours-table__cell--total hours-table__cell--num">${formatHours(hours.held)}</td>
        <td class="hours-table__cell hours-table__cell--total hours-table__cell--num">${formatHours(hours.total)}</td>
      </tr></tfoot>
    </table>
    <p class="sheet__note">Проведено — пары, которые уже закончились. Отменённые и праздники не считаются.</p>
    <div class="sheet__actions"><button class="btn btn--secondary" id="hoursClose">Закрыть</button></div>`;
