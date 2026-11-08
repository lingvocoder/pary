/* Главный экран: следующая пара, заголовок недели, сетка или пустая неделя. */
import { SLOTS, WORKDAYS_PER_WEEK, HOLIDAYS } from '../config/university.js';
import { WEEKDAYS_SHORT } from '../lang/ru.js';
import {
  formatNoUpcoming,
  formatHeroLabel,
  formatHeroDetails,
  formatWeekRange,
  formatWeekSummary,
  formatCardLabel,
} from '../domain/texts.js';
import { toIso, fromIso, addDays, weekStart, atTime } from '../domain/dates.js';
import {
  weekLessons,
  nextLesson,
  isOngoing,
  isHoliday,
} from '../domain/lessons.js';
import { countLessons } from '../domain/hours.js';
import { getState, getPref, setPref } from '../store.js';
import { $, esc, colorClass, slotOf } from './helpers.js';
import {
  iconEllipsis,
  iconXMark,
  iconCalendarDays,
  iconPlus,
} from './icons.js';
import { ui, thisWeek } from './state.js';
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

function renderHero() {
  const n = nextLesson(getState(), new Date(), HOLIDAYS);
  const menu = `<button class="icon-btn" id="menu" aria-label="Меню">${iconEllipsis('icon-btn__icon')}</button>`;
  if (!n) {
    $('#hero').innerHTML =
      `<div class="hero__info"><span class="hero__label">${formatHeroLabel(false)}</span><span class="hero__empty">${formatNoUpcoming()}</span></div>${menu}`;
  } else {
    const now = new Date(),
      going = n.start <= now;
    $('#hero').innerHTML =
      `<div class="hero__info"><span class="hero__label">${formatHeroLabel(going)}</span>
      <div class="hero__main"><span class="hero__time">${slotOf(n.slot).start}</span><span class="chip hero__chip ${colorClass(n)}">${esc(n.group)}</span></div>
      <span class="hero__details">${esc(formatHeroDetails(n, now))}</span></div>${menu}`;
  }
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
  const today = toIso(now),
    sl = slotOf(slot);
  return (
    ui.week === weekStart(today) &&
    now >= atTime(today, sl.start) &&
    now < atTime(today, sl.end)
  );
}

// зелёная точка «идёт сейчас» в углу карточки
const LIVE_DOT = '<span class="card__live" aria-hidden="true"></span>';

const cardLabel = (o, live) =>
  formatCardLabel(o, { isHoliday: isHoliday(o.date, HOLIDAYS), isLive: live });

function cardHtml(o) {
  const live = isOngoing(o, new Date(), HOLIDAYS);
  // пара в праздник размыта, как отменённая, но без крестика: её не отменяли
  const holiday = isHoliday(o.date, HOLIDAYS);
  const cancelled = o.cancelled && !holiday;
  const cls = [
    'card',
    colorClass(o),
    holiday ? 'card--holiday' : '',
    cancelled ? 'card--cancelled' : '',
    o.moved ? 'card--moved' : '',
  ].join(' ');
  // под номером группы — аудитория, если известна
  const room = o.room ? `<span class="card__room">${esc(o.room)}</span>` : '';
  return `<div class="${cls}" data-id="${esc(o.id)}" role="button" tabindex="0"
    aria-label="${esc(cardLabel(o, live))}">
    <div class="card__body"><b class="card__group">${esc(o.group)}</b>${room}</div>
    ${cancelled ? iconXMark('card__mark card__mark--cancelled') : ''}${live ? LIVE_DOT : ''}</div>`;
}

function renderGrid() {
  const now = new Date(),
    today = toIso(now);
  let h = '<div class="week-grid__corner"></div>';
  for (let i = 0; i < WORKDAYS_PER_WEEK; i++) {
    const d = addDays(ui.week, i);
    const dayMods = `${d === today ? ' week-grid__day--today' : ''}${isHoliday(d, HOLIDAYS) ? ' week-grid__day--holiday' : ''}`;
    h += `<div class="week-grid__day${dayMods}"><span class="week-grid__day-name">${WEEKDAYS_SHORT[i]}</span><span class="week-grid__day-num">${fromIso(d).getDate()}</span></div>`;
  }
  SLOTS.forEach((sl, si) => {
    const n = si + 1,
      isLast = n === SLOTS.length;
    h += `<div class="week-grid__time${isLast ? ' week-grid__time--last' : ''}${isNowSlot(n, now) ? ' week-grid__time--now' : ''}" data-slot="${n}"><b class="week-grid__slot-num">${n}</b><span class="week-grid__slot-start">${sl.start}</span></div>`;
    for (let i = 0; i < WORKDAYS_PER_WEEK; i++) {
      const d = addDays(ui.week, i);
      const here = ui.occ
        .filter((o) => o.date === d && o.slot === n)
        .sort((a, b) => a.cancelled - b.cancelled);
      h += `<div class="week-grid__cell${d === today ? ' week-grid__cell--today' : ''}${isLast ? ' week-grid__cell--last' : ''}" data-date="${d}" data-slot="${n}">${here.map(cardHtml).join('')}</div>`;
    }
  });
  $('#week').innerHTML = `<div class="week-grid" id="grid">${h}</div>`;
}

function renderEmpty() {
  $('#week').innerHTML = `<div class="empty-week">
    ${iconCalendarDays('empty-week__icon')}
    <h2 class="empty-week__title">На этой неделе пар нет</h2>
    <p class="empty-week__text">Добавь пару вручную или открой соседнюю неделю.</p>
    <button class="btn btn--primary empty-week__button" id="emptyAdd">${iconPlus('btn__icon')}Добавить пару</button></div>`;
  $('#emptyAdd').onclick = () => {
    const t = toIso(new Date());
    const date =
      t >= ui.week && t <= addDays(ui.week, WORKDAYS_PER_WEEK - 1)
        ? t
        : ui.week;
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
  grid.querySelectorAll('.week-grid__time').forEach((el) => {
    el.classList.toggle(
      'week-grid__time--now',
      isNowSlot(+el.dataset.slot, now),
    );
  });
  grid.querySelectorAll('.card').forEach((card) => {
    const o = ui.occ.find((x) => x.id === card.dataset.id);
    if (!o) return;
    const live = isOngoing(o, now, HOLIDAYS),
      dot = card.querySelector('.card__live');
    if (live && !dot) card.insertAdjacentHTML('beforeend', LIVE_DOT);
    if (!live && dot) dot.remove();
    card.setAttribute('aria-label', cardLabel(o, live));
  });
  refreshPopover(now);
}
