/* Подсказка по тапу на занятие: подробности, аудитория, быстрые действия. */
import { HOLIDAYS } from '../config/university.js';
import { calendarLink } from '../domain/calendar-link.js';
import {
  formatLongDate,
  formatGroupTitle,
  formatTimeRange,
  formatCourseAndType,
  formatMovedFrom,
  formatLessonFlag,
  formatRoomLabel,
  formatRoomSaved,
  formatCancelledToast,
  formatNotHeldToast,
} from '../domain/texts.js';
import { lessonPhase, findLessonAt, findRule } from '../domain/lessons.js';
import { OPERATION, can, lessonState, isApplicable } from '../domain/rules.js';
import { ACTION, roomChangeScope } from '../domain/changes.js';
import { getState, dispatch } from '../store/store.js';
import { toast, TOAST_KIND } from './toast.js';
import { lessonColorClass } from './views/color.js';
import { openEditor } from './editor.js';
import { addLayer, removeLayer } from './layers.js';
import { placePopover } from './geometry.js';
import { popoverView, roomView, roomInputView } from './views/popover.js';

/** Открытая подсказка: её элементы, занятие и фаза на момент открытия. */
let openedPopover = null;

/** Кнопки отметки: операция, что записать в cancelled и какой тост показать.
    «Не состоялась» — тот же флаг cancelled, что у отмены: часы такое занятие не считают. */
const CANCELLED_TOGGLES = [
  {
    buttonId: 'popover-cancel',
    operation: OPERATION.CANCEL,
    isCancelled: true,
    toastText: formatCancelledToast,
  },
  {
    buttonId: 'popover-restore',
    operation: OPERATION.RESTORE,
    isCancelled: false,
    toastText: () => 'Пара возвращена',
  },
  {
    buttonId: 'popover-not-held',
    operation: OPERATION.NOT_HELD,
    isCancelled: true,
    toastText: formatNotHeldToast,
  },
  {
    buttonId: 'popover-held',
    operation: OPERATION.HELD,
    isCancelled: false,
    toastText: () => 'Отмечено: состоялась',
  },
];

/** Спросить модель: можно ли сделать операцию с занятием в момент now. */
const askRules = (operation, lesson, now) =>
  can({ operation, lesson, now, state: getState(), holidays: HOLIDAYS });

/** Данные подсказки: тексты, флаг и какие кнопки показать. */
function popoverModel(lesson, now) {
  const currentState = lessonState(lesson, now, HOLIDAYS);
  const isAllowed = (operation) => askRules(operation, lesson, now).ok;
  const rule = findRule(getState(), lesson.ruleId);
  return {
    group: lesson.group,
    colorClass: lessonColorClass(lesson),
    meta: formatCourseAndType(lesson),
    date: formatLongDate(lesson.date),
    time: formatTimeRange(lesson.slot),
    subject: lesson.subject,
    flag: formatLessonFlag(currentState, lesson),
    movedFrom: lesson.moved ? formatMovedFrom(lesson, rule) : '',
    actions: {
      edit: isAllowed(OPERATION.EDIT),
      cancel: isAllowed(OPERATION.CANCEL),
      // «Вернуть» видна и при занятом слоте: почему нельзя, скажет can() по нажатию
      restore: isApplicable(OPERATION.RESTORE, currentState),
      notHeld: isAllowed(OPERATION.NOT_HELD),
      held: isAllowed(OPERATION.HELD),
      calendar: isAllowed(OPERATION.CALENDAR),
    },
  };
}

/** Перед действием — проверка заново: занятие могло начаться, пока подсказка открыта. */
function isStillAllowed(operation, lesson) {
  const answer = askRules(operation, lesson, new Date());
  if (answer.ok) return true;
  closePopover();
  toast(answer.reason, TOAST_KIND.ERROR);
  return false;
}

/** Ссылка в строке аудитории: «Указать» / «Изменить»; у прошедшего занятия — никакой. */
function roomLinkText(lesson, now) {
  if (!askRules(OPERATION.ROOM, lesson, now).ok) return null;
  return lesson.room ? 'Изменить' : 'Указать';
}

/** После правки аудитории — та же подсказка у обновлённой карточки. */
function reopenAt(date, slot) {
  const lesson = findLessonAt(getState(), date, slot);
  const card =
    lesson &&
    document.querySelector(`.card[data-id="${CSS.escape(lesson.id)}"]`);
  if (card) openPopover(lesson, card);
}

/** Строка аудитории: показ ↔ ввод. */
function setupRoomRow(roomRow, lesson, now) {
  const showRoom = () => {
    roomRow.innerHTML = roomView({
      label: formatRoomLabel(lesson.room),
      linkText: roomLinkText(lesson, now),
    });
    const link = roomRow.querySelector('button');
    if (link) link.onclick = editRoom;
  };
  const saveRoom = (input) => {
    const room = input.value.trim();
    if (room === lesson.room) {
      showRoom();
      return;
    }
    if (!isStillAllowed(OPERATION.ROOM, lesson)) return;
    const scope = roomChangeScope(lesson);
    dispatch({ type: ACTION.EDIT, lesson, changes: { room }, scope });
    toast(formatRoomSaved(room, lesson, scope), TOAST_KIND.SUCCESS);
    reopenAt(lesson.date, lesson.slot);
  };
  const editRoom = () => {
    roomRow.innerHTML = roomInputView(lesson.room);
    const input = roomRow.querySelector('input');
    roomRow.querySelector('button').onclick = () => saveRoom(input);
    input.onkeydown = (event) => {
      if (event.key === 'Enter') saveRoom(input);
    };
    input.focus();
  };
  showRoom();
}

/** Кнопки действий: «Изменить», отметки, «В календарь». */
function setupActions(popoverElement, lesson) {
  const onButton = (buttonId, handler) => {
    const button = popoverElement.querySelector('#' + buttonId);
    if (button) button.onclick = handler;
  };
  onButton('popover-edit', () => {
    closePopover();
    openEditor(lesson);
  });
  for (const toggle of CANCELLED_TOGGLES)
    onButton(toggle.buttonId, () => {
      if (!isStillAllowed(toggle.operation, lesson)) return;
      closePopover();
      const isCancelled = toggle.isCancelled;
      dispatch({ type: ACTION.SET_CANCELLED, lesson, isCancelled });
      toast(toggle.toastText(lesson), TOAST_KIND.SUCCESS);
    });
  onButton('popover-calendar', () => {
    if (!isStillAllowed(OPERATION.CALENDAR, lesson)) return;
    const rule = findRule(getState(), lesson.ruleId);
    window.open(calendarLink(lesson, rule), '_blank', 'noopener');
  });
}

export function closePopover() {
  if (!openedPopover) return;
  removeLayer(openedPopover.layer);
  openedPopover.catcher.remove();
  openedPopover.element.remove();
  document
    .querySelectorAll('.card--selected')
    .forEach((card) => card.classList.remove('card--selected'));
  openedPopover = null;
}

/** Слой, который ловит тап мимо подсказки и закрывает её. */
function createCatcher() {
  const catcher = document.createElement('div');
  catcher.className = 'popover-catcher';
  catcher.addEventListener('click', closePopover);
  catcher.addEventListener(
    'touchstart',
    (event) => {
      event.preventDefault();
      closePopover();
    },
    { passive: false },
  );
  return catcher;
}

export function openPopover(lesson, card) {
  closePopover();
  const now = new Date();
  const element = document.createElement('section');
  element.className = 'popover';
  element.setAttribute('role', 'dialog');
  element.setAttribute('aria-label', formatGroupTitle(lesson.group));
  element.innerHTML = popoverView(popoverModel(lesson, now));
  const catcher = createCatcher();
  document.body.append(catcher, element);
  card.classList.add('card--selected');
  openedPopover = {
    element,
    catcher,
    lesson,
    phase: lessonPhase(lesson, now),
    layer: addLayer(closePopover),
  };
  setupRoomRow(element.querySelector('#popover-room'), lesson, now);
  setupActions(element, lesson);
  // под карточкой, а если не помещается — над ней: расчёт в geometry.js
  const { left, top } = placePopover(
    card.getBoundingClientRect(),
    { width: element.offsetWidth, height: element.offsetHeight },
    { width: window.innerWidth, height: window.innerHeight },
  );
  element.style.left = left + 'px';
  element.style.top = top + 'px';
}

/**
 * Подсказка открыта, а фаза занятия сменилась (началось или закончилось):
 * переоткрыть, чтобы перестроились флаг, кнопки и аудитория.
 * Вызывается из refreshNow().
 */
export function refreshPopover(now) {
  if (!openedPopover) return;
  const { lesson, phase } = openedPopover;
  if (lessonPhase(lesson, now) === phase) return;
  const card = document.querySelector(
    `.card[data-id="${CSS.escape(lesson.id)}"]`,
  );
  if (card) openPopover(lesson, card);
  else closePopover();
}
