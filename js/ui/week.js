/* Главный экран: следующая пара, заголовок недели, сетка или пустая неделя. */
import {
  CONFIG,
  DAY_SHORT,
  DAY_IN,
  MONTH_GEN,
  MONTH_SHORT,
} from '../config.js';
import {
  toIso,
  fromIso,
  addDays,
  weekday,
  weekStart,
  atTime,
  humanDate,
} from '../dates.js';
import { weekOccurrences, nextPair, isOngoing, countPairs } from '../model.js';
import { getState, getPref, setPref } from '../store.js';
import { $, esc, colorClass, slotOf, plural } from './helpers.js';
import {
  iconEllipsis,
  iconXMark,
  iconCalendarDays,
  iconPlus,
} from './icons.js';
import { ui, thisWeek } from './state.js';
import { closePopover } from './popover.js';
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
  ui.occ = weekOccurrences(getState(), ui.week);
  ui.today = toIso(new Date());
  renderHero();
  renderRange();
  if (ui.occ.length) renderGrid();
  else renderEmpty();
  renderHint();
}

function renderHero() {
  const n = nextPair(getState(), new Date());
  const menu = `<button class="icon-btn" id="menu" aria-label="Меню">${iconEllipsis('icon-btn__icon')}</button>`;
  if (!n) {
    $('#hero').innerHTML =
      `<div class="hero__info"><span class="hero__label">Следующая пара</span><span class="hero__empty">В ближайшие 4 недели пар нет</span></div>${menu}`;
  } else {
    const now = new Date(),
      going = n.start <= now;
    let when;
    if (going) when = `идёт сейчас, до ${slotOf(n.slot).end}`;
    else {
      const mins = Math.round((n.start - now) / 60000),
        today = toIso(now);
      if (n.date === today)
        when =
          mins < 60
            ? `сегодня, через ${mins} мин`
            : `сегодня, через ${Math.floor(mins / 60)} ч ${mins % 60} мин`;
      else if (n.date === addDays(today, 1))
        when = `завтра, ${humanDate(n.date)}`;
      else when = `${DAY_IN[weekday(n.date)]}, ${humanDate(n.date)}`;
    }
    // аудитория — только если указана
    const room = n.room ? `, ауд. ${esc(n.room)}` : '';
    $('#hero').innerHTML =
      `<div class="hero__info"><span class="hero__label">${going ? 'Сейчас' : 'Следующая пара'}</span>
      <div class="hero__main"><span class="hero__time">${slotOf(n.slot).start}</span><span class="chip hero__chip ${colorClass(n)}">${esc(n.group)}</span></div>
      <span class="hero__details">${esc(when)}${room}</span></div>${menu}`;
  }
  $('#menu').onclick = openMenu;
}

function renderRange() {
  const a = fromIso(ui.week),
    b = fromIso(addDays(ui.week, 5));
  $('#range').textContent =
    a.getMonth() === b.getMonth()
      ? `${a.getDate()}–${b.getDate()} ${MONTH_GEN[a.getMonth()]}`
      : `${a.getDate()} ${MONTH_SHORT[a.getMonth()]} – ${b.getDate()} ${MONTH_SHORT[b.getMonth()]}`;
  // пар за неделю — по тем же правилам, что часы за семестр: без отменённых и праздников
  const { total } = countPairs(
    getState(),
    ui.week,
    addDays(ui.week, 5),
    new Date(),
    CONFIG.holidays,
  );
  const summary = $('#weekSummary');
  summary.hidden = !total;
  summary.textContent = `${total} ${plural(total, 'пара', 'пары', 'пар')} · ${total * CONFIG.hoursPerPair} ак. ч`;
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
  `Группа ${o.group}, ${o.subject}${o.cancelled ? ', отменена' : ''}${o.moved ? ', перенесена' : ''}${live ? ', идёт сейчас' : ''}`;

function cardHtml(o) {
  const live = isOngoing(o, new Date());
  const cls = [
    'card',
    colorClass(o),
    o.cancelled ? 'card--cancelled' : '',
    o.moved ? 'card--moved' : '',
  ].join(' ');
  // под номером группы — аудитория, если известна
  const room = o.room ? `<span class="card__room">${esc(o.room)}</span>` : '';
  return `<div class="${cls}" data-id="${esc(o.id)}" role="button" tabindex="0"
    aria-label="${esc(cardLabel(o, live))}">
    <div class="card__body"><b class="card__group">${esc(o.group)}</b>${room}</div>
    ${o.cancelled ? iconXMark('card__mark card__mark--cancelled') : ''}${live ? LIVE_DOT : ''}</div>`;
}

function renderGrid() {
  const now = new Date(),
    today = toIso(now);
  let h = '<div class="week-grid__corner"></div>';
  for (let i = 0; i < 6; i++) {
    const d = addDays(ui.week, i);
    h += `<div class="week-grid__day${d === today ? ' week-grid__day--today' : ''}"><span class="week-grid__day-name">${DAY_SHORT[i]}</span><span class="week-grid__day-num">${fromIso(d).getDate()}</span></div>`;
  }
  CONFIG.slots.forEach((sl, si) => {
    const n = si + 1,
      isLast = n === CONFIG.slots.length;
    h += `<div class="week-grid__time${isLast ? ' week-grid__time--last' : ''}${isNowSlot(n, now) ? ' week-grid__time--now' : ''}" data-slot="${n}"><b class="week-grid__slot-num">${n}</b><span class="week-grid__slot-start">${sl.start}</span></div>`;
    for (let i = 0; i < 6; i++) {
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
    const date = t >= ui.week && t <= addDays(ui.week, 5) ? t : ui.week;
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
    const live = isOngoing(o, now),
      dot = card.querySelector('.card__live');
    if (live && !dot) card.insertAdjacentHTML('beforeend', LIVE_DOT);
    if (!live && dot) dot.remove();
    card.setAttribute('aria-label', cardLabel(o, live));
  });
}
