/* Пустая неделя: иконка, одна фраза и главная кнопка. */
import { iconCalendarDays, iconPlus } from '../icons.js';

/** @returns {string} HTML */
export const emptyWeekView = () => `<div class="empty-week">
    ${iconCalendarDays('empty-week__icon')}
    <h2 class="empty-week__title">На этой неделе пар нет</h2>
    <p class="empty-week__text">Добавь пару вручную или открой соседнюю неделю.</p>
    <button class="btn btn--primary empty-week__button" id="empty-week-add">${iconPlus('btn__icon')}Добавить пару</button></div>`;
