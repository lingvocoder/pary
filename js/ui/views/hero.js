/* Шапка: время и группа следующего занятия, когда оно, и кнопка меню. */
import { esc } from '../dom.js';
import { iconEllipsis } from '../icons.js';
import { formatHeroLabel, formatNoUpcoming } from '../../domain/texts.js';

const menuButtonView = () =>
  `<button class="icon-btn" id="menu" aria-label="Меню">${iconEllipsis('icon-btn__icon')}</button>`;

/**
 * @param {{label: string, time: string, group: string, colorClass: string, details: string}|null} hero
 *   null — впереди пар нет
 * @returns {string} HTML
 */
export function heroView(hero) {
  if (!hero)
    return `<div class="hero__info"><span class="hero__label">${formatHeroLabel(false)}</span><span class="hero__empty">${formatNoUpcoming()}</span></div>${menuButtonView()}`;
  return `<div class="hero__info"><span class="hero__label">${hero.label}</span>
      <div class="hero__main"><span class="hero__time">${hero.time}</span><span class="chip hero__chip ${hero.colorClass}">${esc(hero.group)}</span></div>
      <span class="hero__details">${esc(hero.details)}</span></div>${menuButtonView()}`;
}
