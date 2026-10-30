/* Касания по сетке:
   тап по паре — подсказка; удержание 280 мс — перетаскивание; тап по пустой клетке — новая пара. */
import {DAY_SHORT, DAY_NAME, DAY_TO} from '../config.js';
import {weekday, humanDate} from '../dates.js';
import {busyAt} from '../model.js';
import {getState, dispatch} from '../store.js';
import {toast, hideToast, slotOf} from './helpers.js';
import {askScope} from './sheets.js';
import {ui} from './state.js';
import {openPopover, closePopover} from './popover.js';
import {openEditor} from './editor.js';

const LONG_PRESS = 280;   // мс удержания до начала переноса
const SLOP = 10;          // px: если палец сдвинулся раньше — это прокрутка, а не перенос

let drag = null, press = null, lastTouch = 0;
const occById = id => ui.occ.find(o => o.id === id);
const cellAt = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest('.cell'); };
const openCard = card => { const o = occById(card.dataset.id); if (o) openPopover(o, card); };
const cancelPress = () => { if (press) { clearTimeout(press.timer); press = null; } };

function startDrag(card, x, y) {
  const o = occById(card.dataset.id); if (!o) return;
  closePopover();
  const g = card.cloneNode(true); g.classList.add('ghost'); g.classList.remove('sel');
  document.body.appendChild(g); card.classList.add('lift');
  drag = {card, o, ghost: g, target: null};
  moveDrag(x, y);
  if (navigator.vibrate) navigator.vibrate(12);
}

function moveDrag(x, y) {
  drag.ghost.style.left = x + 'px'; drag.ghost.style.top = y + 'px';
  const c = cellAt(x, y);
  if (c === drag.target) return;
  if (drag.target) drag.target.classList.remove('target', 'busy');
  drag.target = c;
  if (!c) { toast('Веди к нужной клетке', true); return; }
  const date = c.dataset.date, slot = +c.dataset.slot, b = busyAt(getState(), date, slot, drag.o.id);
  c.classList.add('target');
  if (b) { c.classList.add('busy'); toast(`Слот занят группой ${b.group}`, true); }
  else if (date === drag.o.date && slot === drag.o.slot) toast('Отпусти здесь, чтобы ничего не менять', true);
  else toast(`Отпусти, чтобы перенести ${DAY_TO[weekday(date)]}, ${slotOf(slot).start}`, true);
}

async function endDrag() {
  const {o, ghost, card, target} = drag; drag = null;
  ghost.remove(); card.classList.remove('lift'); hideToast();
  if (!target) return;
  target.classList.remove('target', 'busy');
  const date = target.dataset.date, slot = +target.dataset.slot;
  if (date === o.date && slot === o.slot) return;
  const b = busyAt(getState(), date, slot, o.id);
  if (b) { toast(`Слот занят группой ${b.group}`); return; }
  const rule = o.type === 'rule' && getState().rules.find(r => r.id === o.ruleId);
  const scope = await askScope(o, `Перенести ${DAY_TO[weekday(date)]}, ${slotOf(slot).start}?`,
    rule ? `Группа ${o.group}, обычно ${DAY_NAME[rule.weekday]}, ${slotOf(rule.slot).start}` : `Группа ${o.group}`);
  if (!scope) return;
  dispatch({type: 'edit', occ: o, changes: {date, slot}, scope});
  toast(`Перенесено: ${DAY_SHORT[weekday(date)]} ${humanDate(date)}, ${slotOf(slot).start}`);
}

/** Подключает все обработчики к контейнеру недели. */
export function initGestures(week) {
  week.addEventListener('touchstart', e => {
    lastTouch = Date.now();
    const card = e.target.closest('.card'); if (!card || e.touches.length > 1) return;
    const t = e.touches[0];
    press = {card, x: t.clientX, y: t.clientY, timer: setTimeout(() => { if (press) { const p = press; press = null; startDrag(p.card, p.x, p.y); } }, LONG_PRESS)};
  }, {passive: true});
  document.addEventListener('touchmove', e => {
    lastTouch = Date.now();
    if (drag) { e.preventDefault(); const t = e.touches[0]; moveDrag(t.clientX, t.clientY); return; }   // во время переноса страница не прокручивается
    if (press) { const t = e.touches[0]; if (Math.hypot(t.clientX - press.x, t.clientY - press.y) > SLOP) cancelPress(); }
  }, {passive: false});
  document.addEventListener('touchend', e => {
    lastTouch = Date.now();
    if (drag) { e.preventDefault(); endDrag(); return; }
    if (press) { const card = press.card; cancelPress(); e.preventDefault(); openCard(card); }
  }, {passive: false});
  document.addEventListener('touchcancel', () => { cancelPress(); if (drag) { drag.target = null; endDrag(); } });
  week.addEventListener('contextmenu', e => { if (e.target.closest('.card')) e.preventDefault(); });

  // мышь — чтобы проверять на компьютере
  week.addEventListener('mousedown', e => {
    if (Date.now() - lastTouch < 800 || e.button !== 0) return;
    const card = e.target.closest('.card'); if (!card) return;
    press = {card, x: e.clientX, y: e.clientY, mouse: true, timer: setTimeout(() => { if (press) { const p = press; press = null; startDrag(p.card, p.x, p.y); } }, LONG_PRESS)};
  });
  document.addEventListener('mousemove', e => {
    if (Date.now() - lastTouch < 800) return;
    if (drag) { moveDrag(e.clientX, e.clientY); return; }
    if (press && press.mouse && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 6) { const p = press; cancelPress(); startDrag(p.card, e.clientX, e.clientY); }
  });
  document.addEventListener('mouseup', () => {
    if (Date.now() - lastTouch < 800) return;
    if (drag) { endDrag(); return; }
    if (press && press.mouse) { const card = press.card; cancelPress(); openCard(card); }
  });
  week.addEventListener('click', e => {
    if (e.target.closest('.card')) return;
    const c = e.target.closest('.cell'); if (!c) return;
    openEditor(null, {date: c.dataset.date, slot: +c.dataset.slot});
  });
  week.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('card')) { e.preventDefault(); openCard(e.target); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePopover(); });
}
