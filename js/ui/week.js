/* Главный экран: следующая пара, заголовок недели, сетка или пустая неделя. */
import {CONFIG, DAY_SHORT, DAY_IN, MONTH_GEN, MONTH_SHORT} from '../config.js';
import {toIso, fromIso, addDays, weekday, weekStart, atTime, humanDate} from '../dates.js';
import {weekOccurrences, nextPair} from '../model.js';
import {getState} from '../store.js';
import {$, esc, abbr, userHex, courseClass, slotOf} from './helpers.js';
import {ui, thisWeek} from './state.js';
import {closePopover} from './popover.js';
import {openEditor} from './editor.js';
import {openMenu} from './menu.js';

/** Перерисовать весь экран из текущего состояния. */
export function render() {
  closePopover();
  ui.occ = weekOccurrences(getState(), ui.week);
  renderHero();
  renderRange();
  if (ui.occ.length) renderGrid(); else renderEmpty();
  $('#hint').hidden = !ui.occ.length;
}

export function renderHero() {
  const n = nextPair(getState(), new Date());
  const menu = `<button class="icon-btn" id="menu" aria-label="Меню"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button>`;
  if (!n) {
    $('#hero').innerHTML = `<div class="hero__info"><span class="hero__label">Следующая пара</span><span class="hero__empty">В ближайшие 4 недели пар нет</span></div>${menu}`;
  } else {
    const now = new Date(), going = n.start <= now, hex = userHex(n);
    let when;
    if (going) when = `идёт сейчас, до ${slotOf(n.slot).end}`;
    else {
      const mins = Math.round((n.start - now) / 60000), today = toIso(now);
      if (n.date === today) when = mins < 60 ? `сегодня, через ${mins} мин` : `сегодня, через ${Math.floor(mins / 60)} ч ${mins % 60} мин`;
      else if (n.date === addDays(today, 1)) when = `завтра, ${humanDate(n.date)}`;
      else when = `${DAY_IN[weekday(n.date)]}, ${humanDate(n.date)}`;
    }
    const room = n.room ? `ауд. ${esc(n.room)}` : 'ауд. не указана';
    $('#hero').innerHTML = `<div class="hero__info"><span class="hero__label">${going ? 'Сейчас' : 'Следующая пара'}</span>
      <div class="hero__main"><span class="hero__time">${slotOf(n.slot).start}</span><span class="chip hero__chip ${courseClass(n.course)}${hex ? ' chip--custom-color' : ''}"${hex ? ` style="--cc:${hex}"` : ''}>${esc(n.group)}</span></div>
      <span class="hero__details">${esc(when)}, ${room}<br>${esc(n.subject)}, ${n.course} курс, ${n.slot}-я пара</span></div>${menu}`;
  }
  $('#menu').onclick = openMenu;
}

function renderRange() {
  const a = fromIso(ui.week), b = fromIso(addDays(ui.week, 5));
  $('#range').textContent = a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${MONTH_GEN[a.getMonth()]}`
    : `${a.getDate()} ${MONTH_SHORT[a.getMonth()]} – ${b.getDate()} ${MONTH_SHORT[b.getMonth()]}`;
  $('#tod').classList.toggle('week-nav__today--visible', ui.week !== thisWeek());
}

function cardHtml(o) {
  const hex = userHex(o);
  const cls = ['card', courseClass(o.course), hex ? 'card--custom-color' : '', o.cancelled ? 'card--cancelled' : ''].join(' ');
  return `<div class="${cls}" data-id="${esc(o.id)}"${hex ? ` style="--hl:${hex}"` : ''} role="button" tabindex="0"
    aria-label="Группа ${esc(o.group)}, ${esc(o.subject)}${o.cancelled ? ', отменена' : ''}">
    <div class="card__body"><b class="card__group">${esc(o.group)}</b><span class="card__subject">${esc(abbr(o.subject))}</span></div>
    ${o.cancelled ? '<i class="card__mark card__mark--cancelled" aria-hidden="true">✕</i>' : ''}${o.moved ? '<i class="card__mark card__mark--moved" aria-hidden="true">↪</i>' : ''}</div>`;
}

function renderGrid() {
  const today = toIso(new Date()), now = new Date();
  let h = '<div class="week-grid__corner"></div>';
  for (let i = 0; i < 6; i++) {
    const d = addDays(ui.week, i);
    h += `<div class="week-grid__day${d === today ? ' week-grid__day--today' : ''}"><span class="week-grid__day-name">${DAY_SHORT[i]}</span><span class="week-grid__day-num">${fromIso(d).getDate()}</span></div>`;
  }
  CONFIG.slots.forEach((sl, si) => {
    const n = si + 1, isLast = n === CONFIG.slots.length;
    const nowSlot = ui.week === weekStart(today) && now >= atTime(today, sl.start) && now < atTime(today, sl.end);
    h += `<div class="week-grid__time${isLast ? ' week-grid__time--last' : ''}${nowSlot ? ' week-grid__time--now' : ''}"><b class="week-grid__slot-num">${n}</b><span class="week-grid__slot-start">${sl.start}</span></div>`;
    for (let i = 0; i < 6; i++) {
      const d = addDays(ui.week, i);
      const here = ui.occ.filter(o => o.date === d && o.slot === n).sort((a, b) => a.cancelled - b.cancelled);
      h += `<div class="week-grid__cell${d === today ? ' week-grid__cell--today' : ''}${isLast ? ' week-grid__cell--last' : ''}" data-date="${d}" data-slot="${n}">${here.map(cardHtml).join('')}</div>`;
    }
  });
  $('#week').innerHTML = `<div class="week-grid" id="grid">${h}</div>`;
}

function renderEmpty() {
  $('#week').innerHTML = `<div class="empty-week"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color:var(--mute)"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>
    <h2 class="empty-week__title">На этой неделе пар нет</h2><p class="empty-week__text">Добавь пару вручную или открой соседнюю неделю.</p>
    <button class="btn btn--primary" id="emptyAdd" style="padding:0 20px">Добавить пару</button></div>`;
  $('#emptyAdd').onclick = () => {
    const t = toIso(new Date());
    const date = t >= ui.week && t <= addDays(ui.week, 5) ? t : ui.week;
    openEditor(null, {date, slot: 1});
  };
}
