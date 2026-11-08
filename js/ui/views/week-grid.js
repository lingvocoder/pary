/* Сетка недели: дни сверху, номера пар слева, в клетках — карточки. */
import { cardView } from './card.js';

const dayView = (day) => {
  const modifiers = `${day.isToday ? ' week-grid__day--today' : ''}${day.isHoliday ? ' week-grid__day--holiday' : ''}`;
  return `<div class="week-grid__day${modifiers}"><span class="week-grid__day-name">${day.name}</span><span class="week-grid__day-num">${day.number}</span></div>`;
};

const timeView = (row) =>
  `<div class="week-grid__time${row.isLast ? ' week-grid__time--last' : ''}${row.isNow ? ' week-grid__time--now' : ''}" data-slot="${row.slot}"><b class="week-grid__slot-num">${row.slot}</b><span class="week-grid__slot-start">${row.start}</span></div>`;

const cellView = (cell, row) =>
  `<div class="week-grid__cell${cell.isToday ? ' week-grid__cell--today' : ''}${row.isLast ? ' week-grid__cell--last' : ''}" data-date="${cell.date}" data-slot="${row.slot}">${cell.cards.map(cardView).join('')}</div>`;

/**
 * @param {Object} grid
 * @param {{name: string, number: number, isToday: boolean, isHoliday: boolean}[]} grid.days
 * @param {{slot: number, start: string, isLast: boolean, isNow: boolean,
 *   cells: {date: string, isToday: boolean, cards: Object[]}[]}[]} grid.rows
 * @returns {string} HTML
 */
export function weekGridView(grid) {
  const header = grid.days.map(dayView).join('');
  const rows = grid.rows
    .map(
      (row) =>
        timeView(row) + row.cells.map((cell) => cellView(cell, row)).join(''),
    )
    .join('');
  return `<div class="week-grid" id="week-grid"><div class="week-grid__corner"></div>${header}${rows}</div>`;
}
