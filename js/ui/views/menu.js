/* Меню: часы, резервная копия, загрузка, сброс и строка версии. */
import {
  iconArrowDownTray,
  iconArrowUpTray,
  iconArrowPath,
  iconClock,
} from '../icons.js';

/** Пункты меню: значение data-action у кнопки. */
export const MENU_ACTION = Object.freeze({
  HOURS: 'hours',
  EXPORT: 'export',
  IMPORT: 'import',
  RESET: 'reset',
});

/** Пункт меню: иконка, название и пояснение. */
const menuItemView = (action, icon, title, hint) =>
  `<button class="menu-item" data-action="${action}">${icon}<span class="menu-item__text"><span class="menu-item__title">${title}</span><span class="menu-item__hint">${hint}</span></span></button>`;

/**
 * @param {{versionLine: string}} menu
 * @returns {string} HTML
 */
export const menuView = (
  menu,
) => `<div class="sheet__header"><h2 class="sheet__title">Меню</h2></div>
    <div class="menu-list">
      ${menuItemView(MENU_ACTION.HOURS, iconClock('menu-item__icon'), 'Часы за семестр', 'Проведено и по расписанию, по группам')}
      ${menuItemView(MENU_ACTION.EXPORT, iconArrowDownTray('menu-item__icon'), 'Скачать резервную копию', 'Файл со всем расписанием и правками')}
      ${menuItemView(MENU_ACTION.IMPORT, iconArrowUpTray('menu-item__icon'), 'Загрузить из копии', 'Заменит текущее расписание')}
      ${menuItemView(MENU_ACTION.RESET, iconArrowPath('menu-item__icon'), 'Вернуть исходное расписание', 'Шесть пар на 29 октября, все правки пропадут')}
    </div>
    <p class="app-version">${menu.versionLine}</p>`;
