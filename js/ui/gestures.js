/* Касания по сетке:
   тап по занятию — подсказка; удержание 280 мс — перетаскивание; тап по пустой клетке — новое занятие. */
import { HOLIDAYS } from '../config/university.js';
import {
  LONG_PRESS_MS,
  SCROLL_SLOP_PX,
  MOUSE_SLOP_PX,
  TOUCH_MOUSE_GAP_MS,
  HOLD_VIBRATION_MS,
} from '../config/interface.js';
import {
  formatDropHint,
  formatMoveQuestion,
  formatMoveNote,
  formatMovedToast,
} from '../domain/texts.js';
import { isPastSlot, isHoliday, findRule } from '../domain/lessons.js';
import { OPERATION, PLACE_KIND, can, canPlace } from '../domain/rules.js';
import { ACTION } from '../domain/changes.js';
import { getState, dispatch } from '../store/store.js';
import { toast, stickyToast, hideToast, TOAST_KIND } from './toast.js';
import { askScope } from './sheets.js';
import { screenState } from './screen-state.js';
import { openPopover, closePopover } from './popover.js';
import { openEditor } from './editor.js';
import { markHintLearned, GESTURE } from './week-screen.js';

// классы, которые читает и переключает перенос
const CELL = '.week-grid__cell';
const CELL_TARGET = 'week-grid__cell--target';
const CELL_BUSY = 'week-grid__cell--busy';
const CELL_PAST = 'week-grid__cell--past';

/** Идёт перенос: какая карточка, какое занятие, её «призрак» под пальцем и клетка под ним. */
let drag = null;
/** Палец или мышь нажаты на карточке, но перенос ещё не начался. */
let press = null;
/** Когда было последнее касание: мышиные события сразу после него — эхо касания. */
let lastTouchTime = 0;

const lessonById = (id) =>
  screenState.lessons.find((lesson) => lesson.id === id);

const cellAt = (pointerX, pointerY) => {
  const element = document.elementFromPoint(pointerX, pointerY);
  return element && element.closest(CELL);
};

const isEchoOfTouch = () => Date.now() - lastTouchTime < TOUCH_MOUSE_GAP_MS;

const openCard = (card) => {
  const lesson = lessonById(card.dataset.id);
  if (!lesson) return;
  openPopover(lesson, card);
  markHintLearned(GESTURE.TAP);
};

const cancelPress = () => {
  if (!press) return;
  clearTimeout(press.timer);
  press = null;
};

/** Нажатие на карточку: через LONG_PRESS_MS без сдвига начинается перенос. Палец и мышь — одинаково. */
function startPress(card, pointerX, pointerY, isMouse) {
  press = {
    card,
    pointerX,
    pointerY,
    isMouse,
    timer: setTimeout(() => {
      if (!press) return;
      const startedPress = press;
      press = null;
      startDrag(
        startedPress.card,
        startedPress.pointerX,
        startedPress.pointerY,
      );
    }, LONG_PRESS_MS),
  };
}

/** Можно ли перенести занятие в клетку: спрашиваем модель с текущим временем. */
const checkPlace = (date, slot, lesson) =>
  canPlace({
    kind: PLACE_KIND.MOVE,
    date,
    slot,
    now: new Date(),
    state: getState(),
    holidays: HOLIDAYS,
    exceptLessonId: lesson.id,
  });

/** Прошедшие клетки и дни-праздники заштрихованы, пока идёт перенос. */
function markUnavailableCells(now) {
  document.querySelectorAll(CELL).forEach((cell) => {
    const date = cell.dataset.date;
    if (isPastSlot(date, +cell.dataset.slot, now) || isHoliday(date, HOLIDAYS))
      cell.classList.add(CELL_PAST);
  });
}

function startDrag(card, pointerX, pointerY) {
  const lesson = lessonById(card.dataset.id);
  if (!lesson) return;
  closePopover();
  markHintLearned(GESTURE.HOLD);
  // начавшееся, прошедшее или отменённое занятие не переносим: только тост, без вибрации
  const answer = can({
    operation: OPERATION.MOVE,
    lesson,
    now: new Date(),
    state: getState(),
    holidays: HOLIDAYS,
  });
  if (!answer.ok) {
    toast(answer.reason, TOAST_KIND.ERROR);
    return;
  }
  const ghost = card.cloneNode(true);
  ghost.classList.add('card--ghost');
  ghost.classList.remove('card--selected');
  document.body.appendChild(ghost);
  card.classList.add('card--lifted');
  markUnavailableCells(new Date());
  drag = { card, lesson, ghost, target: null };
  moveDrag(pointerX, pointerY);
  if (navigator.vibrate) navigator.vibrate(HOLD_VIBRATION_MS);
}

function moveDrag(pointerX, pointerY) {
  drag.ghost.style.left = pointerX + 'px';
  drag.ghost.style.top = pointerY + 'px';
  const cell = cellAt(pointerX, pointerY);
  if (cell === drag.target) return;
  if (drag.target) drag.target.classList.remove(CELL_TARGET, CELL_BUSY);
  drag.target = cell;
  if (!cell) {
    stickyToast('Веди к нужной клетке');
    return;
  }
  const date = cell.dataset.date;
  const slot = +cell.dataset.slot;
  cell.classList.add(CELL_TARGET);
  // сначала своя клетка, остальное решает модель: праздник → прошлое → занято
  if (date === drag.lesson.date && slot === drag.lesson.slot) {
    stickyToast('Отпусти здесь, чтобы ничего не менять');
    return;
  }
  const place = checkPlace(date, slot, drag.lesson);
  if (!place.ok) {
    cell.classList.add(CELL_BUSY); // красная рамка — для любой причины
    stickyToast(place.reason);
    return;
  }
  stickyToast(formatDropHint(date, slot));
}

async function endDrag() {
  const { lesson, ghost, card, target } = drag;
  drag = null;
  ghost.remove();
  card.classList.remove('card--lifted');
  document
    .querySelectorAll('.' + CELL_PAST)
    .forEach((cell) => cell.classList.remove(CELL_PAST));
  hideToast();
  if (!target) return;
  target.classList.remove(CELL_TARGET, CELL_BUSY);
  const date = target.dataset.date;
  const slot = +target.dataset.slot;
  if (date === lesson.date && slot === lesson.slot) return;
  // отпустили там, куда нельзя, — карточка остаётся на месте
  const place = checkPlace(date, slot, lesson);
  if (!place.ok) {
    toast(place.reason, TOAST_KIND.ERROR);
    return;
  }
  const rule = findRule(getState(), lesson.ruleId) || null;
  const scope = await askScope(
    lesson,
    formatMoveQuestion(date, slot),
    formatMoveNote(lesson, rule),
  );
  if (!scope) return;
  dispatch({ type: ACTION.EDIT, lesson, changes: { date, slot }, scope });
  toast(formatMovedToast(date, slot), TOAST_KIND.SUCCESS);
}

/** Палец: удержание, сдвиг (прокрутка или перенос), отпускание. */
function initTouch(week) {
  week.addEventListener(
    'touchstart',
    (event) => {
      lastTouchTime = Date.now();
      const card = event.target.closest('.card');
      if (!card || event.touches.length > 1) return;
      const touch = event.touches[0];
      startPress(card, touch.clientX, touch.clientY, false);
    },
    { passive: true },
  );
  document.addEventListener(
    'touchmove',
    (event) => {
      lastTouchTime = Date.now();
      const touch = event.touches[0];
      // во время переноса страница не прокручивается
      if (drag) {
        event.preventDefault();
        moveDrag(touch.clientX, touch.clientY);
        return;
      }
      if (!press) return;
      const distance = Math.hypot(
        touch.clientX - press.pointerX,
        touch.clientY - press.pointerY,
      );
      if (distance > SCROLL_SLOP_PX) cancelPress();
    },
    { passive: false },
  );
  document.addEventListener(
    'touchend',
    (event) => {
      lastTouchTime = Date.now();
      if (drag) {
        event.preventDefault();
        endDrag();
        return;
      }
      if (!press) return;
      const card = press.card;
      cancelPress();
      event.preventDefault();
      openCard(card);
    },
    { passive: false },
  );
  document.addEventListener('touchcancel', () => {
    cancelPress();
    if (!drag) return;
    drag.target = null;
    endDrag();
  });
  week.addEventListener('contextmenu', (event) => {
    if (event.target.closest('.card')) event.preventDefault();
  });
}

/** Мышь — чтобы проверять на компьютере. */
function initMouse(week) {
  week.addEventListener('mousedown', (event) => {
    if (isEchoOfTouch() || event.button !== 0) return;
    const card = event.target.closest('.card');
    if (card) startPress(card, event.clientX, event.clientY, true);
  });
  document.addEventListener('mousemove', (event) => {
    if (isEchoOfTouch()) return;
    if (drag) {
      moveDrag(event.clientX, event.clientY);
      return;
    }
    if (!press || !press.isMouse) return;
    const distance = Math.hypot(
      event.clientX - press.pointerX,
      event.clientY - press.pointerY,
    );
    if (distance <= MOUSE_SLOP_PX) return;
    const card = press.card;
    cancelPress();
    startDrag(card, event.clientX, event.clientY);
  });
  document.addEventListener('mouseup', () => {
    if (isEchoOfTouch()) return;
    if (drag) {
      endDrag();
      return;
    }
    if (!press || !press.isMouse) return;
    const card = press.card;
    cancelPress();
    openCard(card);
  });
}

/** Тап по пустой клетке — новое занятие; Enter или пробел на карточке — подсказка. */
function initTaps(week) {
  week.addEventListener('click', (event) => {
    if (event.target.closest('.card')) return;
    const cell = event.target.closest(CELL);
    if (!cell) return;
    const date = cell.dataset.date;
    const slot = +cell.dataset.slot;
    // куда добавить нельзя (праздник) — редактор не открываем, модель говорит почему
    const place = canPlace({
      kind: PLACE_KIND.ADD_ONE_OFF,
      date,
      slot,
      now: new Date(),
      state: getState(),
      holidays: HOLIDAYS,
    });
    if (!place.ok) {
      toast(place.reason, TOAST_KIND.ERROR);
      return;
    }
    openEditor(null, { date, slot });
  });
  week.addEventListener('keydown', (event) => {
    const isActivationKey = event.key === 'Enter' || event.key === ' ';
    if (!isActivationKey || !event.target.classList.contains('card')) return;
    event.preventDefault();
    openCard(event.target);
  });
}

/** Подключает все обработчики к контейнеру недели. */
export function initGestures(week) {
  initTouch(week);
  initMouse(week);
  initTaps(week);
}
