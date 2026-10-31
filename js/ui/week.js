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
import { weekOccurrences, nextPair } from '../model.js';
import { getState } from '../store.js';
import { $, esc, colorClass, slotOf } from './helpers.js';
import {
  iconEllipsis,
  iconXMark,
  iconUturnRight,
  iconCalendarDays,
  iconPlus,
} from './icons.js';
import { ui, thisWeek } from './state.js';
import { closePopover } from './popover.js';
import { openEditor } from './editor.js';
import { openMenu } from './menu.js';

/** Перерисовать весь экран из текущего состояния. */
export function render() {
  closePopover();
  ui.occ = weekOccurrences(getState(), ui.week);
  renderHero();
  renderRange();
  if (ui.occ.length) renderGrid();
  else renderEmpty();
  $('#hint').hidden = !ui.occ.length;
}

export function renderHero() {
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
  // «Сегодня» видна всегда, чтобы группа кнопок не прыгала; на текущей неделе — неактивна
  $('#tod').disabled = ui.week === thisWeek();
}

function cardHtml(o) {
  const cls = [
    'card',
    colorClass(o),
    o.cancelled ? 'card--cancelled' : '',
  ].join(' ');
  // под номером группы — аудитория, если известна
  const room = o.room ? `<span class="card__room">${esc(o.room)}</span>` : '';
  return `<div class="${cls}" data-id="${esc(o.id)}" role="button" tabindex="0"
    aria-label="Группа ${esc(o.group)}, ${esc(o.subject)}${o.cancelled ? ', отменена' : ''}">
    <div class="card__body"><b class="card__group">${esc(o.group)}</b>${room}</div>
    ${o.cancelled ? iconXMark('card__mark card__mark--cancelled') : ''}${o.moved ? iconUturnRight('card__mark card__mark--moved') : ''}</div>`;
}

function renderGrid() {
  const today = toIso(new Date()),
    now = new Date();
  let h = '<div class="week-grid__corner"></div>';
  for (let i = 0; i < 6; i++) {
    const d = addDays(ui.week, i);
    h += `<div class="week-grid__day${d === today ? ' week-grid__day--today' : ''}"><span class="week-grid__day-name">${DAY_SHORT[i]}</span><span class="week-grid__day-num">${fromIso(d).getDate()}</span></div>`;
  }
  CONFIG.slots.forEach((sl, si) => {
    const n = si + 1,
      isLast = n === CONFIG.slots.length;
    const nowSlot =
      ui.week === weekStart(today) &&
      now >= atTime(today, sl.start) &&
      now < atTime(today, sl.end);
    h += `<div class="week-grid__time${isLast ? ' week-grid__time--last' : ''}${nowSlot ? ' week-grid__time--now' : ''}"><b class="week-grid__slot-num">${n}</b><span class="week-grid__slot-start">${sl.start}</span></div>`;
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
