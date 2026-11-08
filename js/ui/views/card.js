/* Карточка занятия в сетке. */
import { esc } from '../dom.js';
import { iconXMark } from '../icons.js';

/** Зелёная точка «идёт сейчас» в углу карточки. */
export const liveDotView = () =>
  '<span class="card__live" aria-hidden="true"></span>';

/**
 * @param {Object} card
 * @param {string} card.id
 * @param {string} card.group
 * @param {string} card.room
 * @param {string} card.colorClass
 * @param {boolean} card.isHoliday    размыта, без крестика: её не отменяли
 * @param {boolean} card.isCancelled  размыта, с крестиком
 * @param {boolean} card.isMoved
 * @param {boolean} card.isLive
 * @param {string} card.label         подпись для экранного диктора
 * @returns {string} HTML
 */
export function cardView(card) {
  const classes = [
    'card',
    card.colorClass,
    card.isHoliday ? 'card--holiday' : '',
    card.isCancelled ? 'card--cancelled' : '',
    card.isMoved ? 'card--moved' : '',
  ].join(' ');
  // под номером группы — аудитория, если известна
  const room = card.room
    ? `<span class="card__room">${esc(card.room)}</span>`
    : '';
  const mark = card.isCancelled
    ? iconXMark('card__mark card__mark--cancelled')
    : '';
  return `<div class="${classes}" data-id="${esc(card.id)}" role="button" tabindex="0"
    aria-label="${esc(card.label)}">
    <div class="card__body"><b class="card__group">${esc(card.group)}</b>${room}</div>
    ${mark}${card.isLive ? liveDotView() : ''}</div>`;
}
