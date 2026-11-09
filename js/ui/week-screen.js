/* Главный экран: следующая пара, заголовок недели, сетка или пустая неделя. */
import { SLOTS, WORKDAYS_PER_WEEK, HOLIDAYS } from '../config/university.js';
import { WEEKDAYS_SHORT } from '../lang/ru.js';
import { defaultNewLessonDate } from '../domain/forms.js';
import {
  formatHeroLabel,
  formatHeroDetails,
  formatWeekRange,
  formatWeekSummary,
  formatCardLabel,
  formatSlotStart,
} from '../domain/texts.js';
import { toIso, fromIso, addDays, weekStart } from '../domain/dates.js';
import {
  weekLessons,
  nextLesson,
  isHoliday,
  currentSlot,
} from '../domain/lessons.js';
import {
  LESSON_STATE,
  lessonState,
  isCancelledState,
  isHolidayState,
} from '../domain/rules.js';
import { countLessons } from '../domain/hours.js';
import { getState } from '../store/store.js';
import { getPref, setPref } from '../store/prefs.js';
import { $ } from './dom.js';
import { screenState, currentWeekStart } from './screen-state.js';
import { heroView } from './views/hero.js';
import { liveDotView } from './views/card.js';
import { weekGridView } from './views/week-grid.js';
import { emptyWeekView } from './views/empty-week.js';
import { lessonColorClass } from './views/color.js';
import { closePopover, refreshPopover } from './popover.js';
import { openEditor } from './editor.js';
import { openMenu } from './menu.js';

// Подсказка внизу экрана — пока пользователь не сделал оба жеста: тап по паре и удержание.
// Признаки хранятся в настройках (pary.prefs), поэтому подсказка не вернётся после перезапуска.
/** Жесты, которым учит подсказка. */
export const GESTURE = Object.freeze({ TAP: 'tap', HOLD: 'hold' });
const HINT_PREFS = {
  [GESTURE.TAP]: 'hintTapLearned',
  [GESTURE.HOLD]: 'hintHoldLearned',
};

function renderHint() {
  const learned =
    getPref(HINT_PREFS[GESTURE.TAP], false) &&
    getPref(HINT_PREFS[GESTURE.HOLD], false);
  $('#gesture-hint').hidden = !screenState.lessons.length || learned;
}

/** Отмечает, что жест освоен (одно из GESTURE); когда освоены оба — подсказка прячется. */
export function markHintLearned(gesture) {
  if (getPref(HINT_PREFS[gesture], false)) return;
  setPref(HINT_PREFS[gesture], true);
  renderHint();
}

/** Перерисовать весь экран из текущего состояния. */
export function render() {
  closePopover();
  screenState.lessons = weekLessons(getState(), screenState.weekStartDate);
  screenState.renderedDay = toIso(new Date());
  renderHero();
  renderRange();
  if (screenState.lessons.length) renderGrid();
  else renderEmpty();
  renderHint();
}

/** Данные шапки: следующее занятие и когда оно; null — впереди пар нет. */
function heroModel(now) {
  const lesson = nextLesson(getState(), now, HOLIDAYS);
  if (!lesson) return null;
  return {
    label: formatHeroLabel(lesson.start <= now),
    time: formatSlotStart(lesson.slot),
    group: lesson.group,
    colorClass: lessonColorClass(lesson),
    details: formatHeroDetails(lesson, now),
  };
}

function renderHero() {
  $('#hero').innerHTML = heroView(heroModel(new Date()));
  $('#menu-button').onclick = openMenu;
}

function renderRange() {
  $('#week-range').textContent = formatWeekRange(screenState.weekStartDate);
  // пар за неделю — по тем же правилам, что часы за семестр: без отменённых и праздников
  const { total } = countLessons({
    state: getState(),
    from: screenState.weekStartDate,
    to: addDays(screenState.weekStartDate, WORKDAYS_PER_WEEK - 1),
    now: new Date(),
    holidays: HOLIDAYS,
  });
  const summary = $('#week-summary');
  summary.hidden = !total;
  summary.textContent = formatWeekSummary(total);
  // «Сегодня» видна всегда, чтобы группа кнопок не прыгала; на текущей неделе — неактивна
  $('#week-today').disabled = screenState.weekStartDate === currentWeekStart();
}

/** Номер пары, которая идёт сейчас, — только на текущей неделе. */
function isNowSlot(slot, now) {
  return (
    screenState.weekStartDate === weekStart(toIso(now)) &&
    currentSlot(now) === slot
  );
}

/** Данные карточки. Как она выглядит, решает состояние занятия из domain/rules.js:
    в праздник размыта без крестика, отменённая — с крестиком, идущая — с точкой. */
function cardModel(lesson, now) {
  const state = lessonState(lesson, now, HOLIDAYS);
  return {
    id: lesson.id,
    group: lesson.group,
    room: lesson.room,
    colorClass: lessonColorClass(lesson),
    isHoliday: isHolidayState(state),
    isCancelled: isCancelledState(state),
    isMoved: lesson.moved,
    isLive: state === LESSON_STATE.ONGOING,
    label: formatCardLabel(lesson, state),
  };
}

/** Данные сетки: дни недели и строки пар с карточками в клетках. */
function gridModel(now) {
  const today = toIso(now);
  const dates = [];
  for (let i = 0; i < WORKDAYS_PER_WEEK; i++)
    dates.push(addDays(screenState.weekStartDate, i));
  const days = dates.map((date, dayIndex) => ({
    name: WEEKDAYS_SHORT[dayIndex],
    number: fromIso(date).getDate(),
    isToday: date === today,
    isHoliday: isHoliday(date, HOLIDAYS),
  }));
  const rows = SLOTS.map((bell, slotIndex) => {
    const slot = slotIndex + 1;
    return {
      slot,
      start: bell.start,
      isLast: slot === SLOTS.length,
      isNow: isNowSlot(slot, now),
      cells: dates.map((date) => ({
        date,
        isToday: date === today,
        // отменённые — после неотменённых: сверху та, что идёт
        cards: screenState.lessons
          .filter((lesson) => lesson.date === date && lesson.slot === slot)
          .sort((first, second) => first.cancelled - second.cancelled)
          .map((lesson) => cardModel(lesson, now)),
      })),
    };
  });
  return { days, rows };
}

function renderGrid() {
  $('#week').innerHTML = weekGridView(gridModel(new Date()));
}

function renderEmpty() {
  $('#week').innerHTML = emptyWeekView();
  $('#empty-week-add').onclick = () => {
    const date = defaultNewLessonDate(
      screenState.weekStartDate,
      toIso(new Date()),
    );
    openEditor(null, { date, slot: 1 });
  };
}

/**
 * Обновляет всё, что зависит от времени: шапку, номер текущей пары, точки «идёт сейчас».
 * Точечно, без render(): иначе закроется открытая подсказка по тапу.
 * Если прошла полночь — полная перерисовка: сменился день «сегодня».
 */
export function refreshNow() {
  const now = new Date();
  if (toIso(now) !== screenState.renderedDay) {
    render();
    return;
  }
  renderHero();
  const grid = $('#week-grid');
  if (!grid) return;
  grid.querySelectorAll('.week-grid__time').forEach((timeCell) => {
    timeCell.classList.toggle(
      'week-grid__time--now',
      isNowSlot(+timeCell.dataset.slot, now),
    );
  });
  grid.querySelectorAll('.card').forEach((card) => {
    const lesson = screenState.lessons.find(
      (candidate) => candidate.id === card.dataset.id,
    );
    if (!lesson) return;
    const state = lessonState(lesson, now, HOLIDAYS);
    const isLive = state === LESSON_STATE.ONGOING;
    const dot = card.querySelector('.card__live');
    if (isLive && !dot) card.insertAdjacentHTML('beforeend', liveDotView());
    if (!isLive && dot) dot.remove();
    card.setAttribute('aria-label', formatCardLabel(lesson, state));
  });
  refreshPopover(now);
}
