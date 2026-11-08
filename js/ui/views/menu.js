/* Меню: часы, резервная копия, загрузка, сброс и строка версии. */
import {
  iconArrowDownTray,
  iconArrowUpTray,
  iconArrowPath,
  iconClock,
} from '../icons.js';

/** Пункт меню: иконка, название и пояснение. */
const menuItemView = (action, icon, title, hint) =>
  `<button class="menu-item" data-a="${action}">${icon}<span class="menu-item__text"><span class="menu-item__title">${title}</span><span class="menu-item__hint">${hint}</span></span></button>`;

/**
 * @param {{versionLine: string}} menu
 * @returns {string} HTML
 */
export const menuView = (
  menu,
) => `<div class="sheet__header"><h2 class="sheet__title">Меню</h2></div>
    <div class="menu-list">
      ${menuItemView('hours', iconClock('menu-item__icon'), 'Часы за семестр', 'Проведено и по расписанию, по группам')}
      ${menuItemView('export', iconArrowDownTray('menu-item__icon'), 'Скачать резервную копию', 'Файл со всем расписанием и правками')}
      ${menuItemView('import', iconArrowUpTray('menu-item__icon'), 'Загрузить из копии', 'Заменит текущее расписание')}
      ${menuItemView('reset', iconArrowPath('menu-item__icon'), 'Вернуть исходное расписание', 'Шесть пар на 29 октября, все правки пропадут')}
    </div>
    <p class="app-version">${menu.versionLine}</p>`;
