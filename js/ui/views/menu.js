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

/** Пункты меню по порядку: data-action, иконка, название и пояснение. */
const MENU_ITEMS = [
  {
    action: MENU_ACTION.HOURS,
    icon: iconClock,
    title: 'Часы за семестр',
    hint: 'Проведено и по расписанию, по группам',
  },
  {
    action: MENU_ACTION.EXPORT,
    icon: iconArrowDownTray,
    title: 'Скачать резервную копию',
    hint: 'Файл со всем расписанием и правками',
  },
  {
    action: MENU_ACTION.IMPORT,
    icon: iconArrowUpTray,
    title: 'Загрузить из копии',
    hint: 'Заменит текущее расписание',
  },
  {
    action: MENU_ACTION.RESET,
    icon: iconArrowPath,
    title: 'Вернуть исходное расписание',
    hint: 'Шесть пар на 29 октября, все правки пропадут',
  },
];

/** Пункт меню: иконка, название и пояснение. */
const menuItemView = ({ action, icon, title, hint }) =>
  `<button class="menu-item" data-action="${action}">${icon('menu-item__icon')}<span class="menu-item__text"><span class="menu-item__title">${title}</span><span class="menu-item__hint">${hint}</span></span></button>`;

/**
 * @param {{versionLine: string}} menu
 * @returns {string} HTML
 */
export const menuView = (menu) =>
  `<div class="sheet__header"><h2 class="sheet__title">Меню</h2></div>
    <div class="menu-list">${MENU_ITEMS.map(menuItemView).join('')}</div>
    <p class="app-version">${menu.versionLine}</p>`;
