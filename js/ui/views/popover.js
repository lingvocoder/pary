/* Подсказка по тапу на занятие: группа, когда, предмет, флаг, аудитория и кнопки. */
import { esc } from '../dom.js';
import { iconCalendar, iconMapPin } from '../icons.js';

/** Строка-флаг под предметом: «Отменена», «Идёт, до 17:00»… */
const flagView = (flag) => {
  if (!flag) return '';
  const liveModifier = flag.isLive ? ' popover__flag--live' : '';
  return `<div class="popover__flag${liveModifier}">${flag.text}</div>`;
};

const movedView = (movedFrom) =>
  movedFrom ? `<div class="popover__moved">${movedFrom}</div>` : '';

/**
 * Кнопки в один ряд — только те, что пришли в actions.
 * @param {{edit: boolean, cancel: boolean, restore: boolean, notHeld: boolean,
 *   held: boolean, calendar: boolean}} actions
 */
function actionsView(actions) {
  const buttons = [];
  if (actions.edit)
    buttons.push(
      '<button class="btn btn--primary popover__action" id="pEdit">Изменить</button>',
    );
  if (actions.cancel)
    buttons.push(
      '<button class="btn btn--danger-outline popover__action" id="pCancel">Отменить</button>',
    );
  // «Вернуть» ничего не разрушает — обычная вторичная кнопка, без красного
  if (actions.restore)
    buttons.push(
      '<button class="btn btn--secondary popover__action" id="pRestore">Вернуть</button>',
    );
  // факт: у начавшегося и прошедшего занятия — только отметка, состоялось ли оно
  if (actions.notHeld)
    buttons.push(
      '<button class="btn btn--danger-outline popover__action" id="pNotHeld">Не состоялась</button>',
    );
  if (actions.held)
    buttons.push(
      '<button class="btn btn--secondary popover__action" id="pHeld">Состоялась</button>',
    );
  if (actions.calendar)
    buttons.push(
      `<button class="btn btn--secondary popover__icon-action" id="pCal" aria-label="В календарь">${iconCalendar('btn__icon')}</button>`,
    );
  return buttons.length
    ? `<div class="popover__actions">${buttons.join('')}</div>`
    : '';
}

/**
 * Содержимое подсказки. Строка аудитории заполняется отдельно: roomView / roomInputView.
 * @param {Object} popover
 * @param {string} popover.group
 * @param {string} popover.colorClass
 * @param {string} popover.meta        «3 курс · ЛР»
 * @param {string} popover.date        «Среда, 28 октября»
 * @param {string} popover.time        «15:40–17:00»
 * @param {string} popover.subject
 * @param {{text: string, isLive: boolean}|null} popover.flag
 * @param {string} popover.movedFrom   '' — не перенесена
 * @param {Object} popover.actions     какие кнопки показать
 * @returns {string} HTML
 */
export function popoverView(popover) {
  return `<div class="popover__head"><span class="chip popover__chip ${popover.colorClass}">${esc(popover.group)}</span><span class="popover__meta">${esc(popover.meta)}</span></div>
    <div class="popover__details">
      <div class="popover__date">${popover.date}</div>
      <div class="popover__time">${popover.time}</div>
      <div class="popover__subject">${esc(popover.subject)}</div>
      ${flagView(popover.flag)}${movedView(popover.movedFrom)}
    </div>
    <div class="popover__room" id="pRoom"></div>
    ${actionsView(popover.actions)}`;
}

/**
 * Строка аудитории: значок, текст и ссылка «Указать» / «Изменить».
 * @param {{label: string, linkText: string|null}} room  linkText null — только текст
 */
export function roomView(room) {
  const link = room.linkText
    ? `<button class="popover__room-link">${room.linkText}</button>`
    : '';
  return `${iconMapPin('popover__room-icon')}<span class="popover__room-label">${esc(room.label)}</span>${link}`;
}

/** Строка аудитории в режиме ввода: поле и «Готово». */
export const roomInputView = (room) =>
  `<input class="popover__room-input" type="text" aria-label="Аудитория" placeholder="например, 301" value="${esc(room)}" autocomplete="off"><button class="popover__room-link">Готово</button>`;
