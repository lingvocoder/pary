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
  isOngoing,
  isHoliday,
  currentSlot,
} from '../domain/lessons.js';
import { countLessons } from '../domain/hours.js';
import { getState } from '../store/store.js';
import { getPref, setPref } from '../store/prefs.js';
import { $ } from './dom.js';
import { ui, thisWeek } from './state.js';
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
const HINT_PREFS = { tap: 'hintTapLearned', hold: 'hintHoldLearned' };

function renderHint() {
  const learned =
    getPref(HINT_PREFS.tap, false) && getPref(HINT_PREFS.hold, false);
  $('#hint').hidden = !ui.occ.length || learned;
}

/** Отмечает, что жест освоен ('tap' или 'hold'); когда освоены оба — подсказка прячется. */
export function markHintLearned(gesture) {
  if (getPref(HINT_PREFS[gesture], false)) return;
  setPref(HINT_PREFS[gesture], true);
  renderHint();
}

/** Перерисовать весь экран из текущего состояния. */
export function render() {
  closePopover();
  ui.occ = weekLessons(getState(), ui.week);
  ui.today = toIso(new Date());
  renderHero();
  renderRange();
  if (ui.occ.length) renderGrid();
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
  $('#menu').onclick = openMenu;
}

function renderRange() {
  $('#range').textContent = formatWeekRange(ui.week);
  // пар за неделю — по тем же правилам, что часы за семестр: без отменённых и праздников
  const { total } = countLessons({
    state: getState(),
    from: ui.week,
    to: addDays(ui.week, WORKDAYS_PER_WEEK - 1),
    now: new Date(),
    holidays: HOLIDAYS,
  });
  const summary = $('#weekSummary');
  summary.hidden = !total;
  summary.textContent = formatWeekSummary(total);
  // «Сегодня» видна всегда, чтобы группа кнопок не прыгала; на текущей неделе — неактивна
  $('#tod').disabled = ui.week === thisWeek();
}

/** Номер пары, которая идёт сейчас, — только на текущей неделе. */
function isNowSlot(slot, now) {
  return ui.week === weekStart(toIso(now)) && currentSlot(now) === slot;
}

const cardLabel = (lesson, isLive) =>
  formatCardLabel(lesson, {
    isHoliday: isHoliday(lesson.date, HOLIDAYS),
    isLive,
  });

/** Данные карточки. Занятие в праздник размыто, как отменённое, но без крестика. */
function cardModel(lesson, now) {
  const isLive = isOngoing(lesson, now, HOLIDAYS);
  const isHolidayLesson = isHoliday(lesson.date, HOLIDAYS);
  return {
    id: lesson.id,
    group: lesson.group,
    room: lesson.room,
    colorClass: lessonColorClass(lesson),
    isHoliday: isHolidayLesson,
    isCancelled: lesson.cancelled && !isHolidayLesson,
    isMoved: lesson.moved,
    isLive,
    label: cardLabel(lesson, isLive),
  };
}

/** Данные сетки: дни недели и строки пар с карточками в клетках. */
function gridModel(now) {
  const today = toIso(now);
  const dates = [];
  for (let i = 0; i < WORKDAYS_PER_WEEK; i++) dates.push(addDays(ui.week, i));
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
        cards: ui.occ
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
  $('#emptyAdd').onclick = () => {
    const date = defaultNewLessonDate(ui.week, toIso(new Date()));
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
  if (toIso(now) !== ui.today) {
    render();
    return;
  }
  renderHero();
  const grid = $('#grid');
  if (!grid) return;
  grid.querySelectorAll('.week-grid__time').forEach((timeCell) => {
    timeCell.classList.toggle(
      'week-grid__time--now',
      isNowSlot(+timeCell.dataset.slot, now),
    );
  });
  grid.querySelectorAll('.card').forEach((card) => {
    const lesson = ui.occ.find((candidate) => candidate.id === card.dataset.id);
    if (!lesson) return;
    const isLive = isOngoing(lesson, now, HOLIDAYS);
    const dot = card.querySelector('.card__live');
    if (isLive && !dot) card.insertAdjacentHTML('beforeend', liveDotView());
    if (!isLive && dot) dot.remove();
    card.setAttribute('aria-label', cardLabel(lesson, isLive));
  });
  refreshPopover(now);
}
