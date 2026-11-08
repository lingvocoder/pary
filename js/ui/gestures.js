/* Касания по сетке:
   тап по паре — подсказка; удержание 280 мс — перетаскивание; тап по пустой клетке — новая пара. */
import { HOLIDAYS } from '../config/university.js';
import {
  LONG_PRESS_MS,
  SCROLL_SLOP_PX,
  MOUSE_SLOP_PX,
  TOUCH_MOUSE_GAP_MS,
  HOLD_VIBRATION_MS,
} from '../config/interface.js';
import { WEEKDAYS_SHORT, WEEKDAYS, WEEKDAYS_TO } from '../lang/ru.js';
import { weekday, humanDate } from '../domain/dates.js';
import { can, canPlace } from '../domain/rules.js';
import { isPastSlot, isHoliday } from '../domain/lessons.js';
import { getState, dispatch } from '../store.js';
import { toast, stickyToast, hideToast, slotOf } from './helpers.js';
import { askScope } from './sheets.js';
import { ui } from './state.js';
import { openPopover, closePopover } from './popover.js';
import { openEditor } from './editor.js';
import { markHintLearned } from './week.js';

// классы, которые читает и переключает перенос
const CELL = '.week-grid__cell';
const CELL_TARGET = 'week-grid__cell--target';
const CELL_BUSY = 'week-grid__cell--busy';
const CELL_PAST = 'week-grid__cell--past';

let drag = null,
  press = null,
  lastTouch = 0;
const occById = (id) => ui.occ.find((o) => o.id === id);
const cellAt = (x, y) => {
  const el = document.elementFromPoint(x, y);
  return el && el.closest(CELL);
};
const openCard = (card) => {
  const o = occById(card.dataset.id);
  if (!o) return;
  openPopover(o, card);
  markHintLearned('tap');
};
const cancelPress = () => {
  if (press) {
    clearTimeout(press.timer);
    press = null;
  }
};

function startDrag(card, x, y) {
  const o = occById(card.dataset.id);
  if (!o) return;
  closePopover();
  markHintLearned('hold');
  // начавшуюся, прошедшую или отменённую пару не переносим: только тост, без вибрации
  const allowed = can('move', o, new Date(), getState(), HOLIDAYS);
  if (!allowed.ok) {
    toast(allowed.reason, 'error');
    return;
  }
  const g = card.cloneNode(true);
  g.classList.add('card--ghost');
  g.classList.remove('card--selected');
  document.body.appendChild(g);
  card.classList.add('card--lifted');
  // прошедшие клетки и дни-праздники заштрихованы, пока идёт перенос
  const now = new Date();
  document.querySelectorAll(CELL).forEach((c) => {
    if (
      isPastSlot(c.dataset.date, +c.dataset.slot, now) ||
      isHoliday(c.dataset.date, HOLIDAYS)
    )
      c.classList.add(CELL_PAST);
  });
  drag = { card, o, ghost: g, target: null };
  moveDrag(x, y);
  if (navigator.vibrate) navigator.vibrate(HOLD_VIBRATION_MS);
}

/** Можно ли перенести пару o в клетку: спрашиваем модель с текущим временем. */
const placeCheck = (date, slot, o) =>
  canPlace('move', date, slot, new Date(), getState(), HOLIDAYS, o.id);

function moveDrag(x, y) {
  drag.ghost.style.left = x + 'px';
  drag.ghost.style.top = y + 'px';
  const c = cellAt(x, y);
  if (c === drag.target) return;
  if (drag.target) drag.target.classList.remove(CELL_TARGET, CELL_BUSY);
  drag.target = c;
  if (!c) {
    stickyToast('Веди к нужной клетке');
    return;
  }
  const date = c.dataset.date,
    slot = +c.dataset.slot;
  c.classList.add(CELL_TARGET);
  // сначала своя клетка, остальное решает модель: праздник → прошлое → занято
  if (date === drag.o.date && slot === drag.o.slot) {
    stickyToast('Отпусти здесь, чтобы ничего не менять');
    return;
  }
  const place = placeCheck(date, slot, drag.o);
  if (!place.ok) {
    c.classList.add(CELL_BUSY); // красная рамка — для любой причины
    stickyToast(place.reason);
    return;
  }
  stickyToast(
    `Отпусти, чтобы перенести ${WEEKDAYS_TO[weekday(date)]}, ${slotOf(slot).start}`,
  );
}

async function endDrag() {
  const { o, ghost, card, target } = drag;
  drag = null;
  ghost.remove();
  card.classList.remove('card--lifted');
  document
    .querySelectorAll('.' + CELL_PAST)
    .forEach((c) => c.classList.remove(CELL_PAST));
  hideToast();
  if (!target) return;
  target.classList.remove(CELL_TARGET, CELL_BUSY);
  const date = target.dataset.date,
    slot = +target.dataset.slot;
  if (date === o.date && slot === o.slot) return;
  // отпустили там, куда нельзя, — карточка остаётся на месте
  const place = placeCheck(date, slot, o);
  if (!place.ok) {
    toast(place.reason, 'error');
    return;
  }
  const rule =
    o.type === 'rule' && getState().rules.find((r) => r.id === o.ruleId);
  const scope = await askScope(
    o,
    `Перенести ${WEEKDAYS_TO[weekday(date)]}, ${slotOf(slot).start}?`,
    rule
      ? `Группа ${o.group}, обычно ${WEEKDAYS[rule.weekday]}, ${slotOf(rule.slot).start}`
      : `Группа ${o.group}`,
  );
  if (!scope) return;
  dispatch({ type: 'edit', occ: o, changes: { date, slot }, scope });
  toast(
    `Перенесено: ${WEEKDAYS_SHORT[weekday(date)]} ${humanDate(date)}, ${slotOf(slot).start}`,
    'success',
  );
}

/** Подключает все обработчики к контейнеру недели. */
export function initGestures(week) {
  week.addEventListener(
    'touchstart',
    (e) => {
      lastTouch = Date.now();
      const card = e.target.closest('.card');
      if (!card || e.touches.length > 1) return;
      const t = e.touches[0];
      press = {
        card,
        x: t.clientX,
        y: t.clientY,
        timer: setTimeout(() => {
          if (press) {
            const p = press;
            press = null;
            startDrag(p.card, p.x, p.y);
          }
        }, LONG_PRESS_MS),
      };
    },
    { passive: true },
  );
  document.addEventListener(
    'touchmove',
    (e) => {
      lastTouch = Date.now();
      if (drag) {
        e.preventDefault();
        const t = e.touches[0];
        moveDrag(t.clientX, t.clientY);
        return;
      } // во время переноса страница не прокручивается
      if (press) {
        const t = e.touches[0];
        if (
          Math.hypot(t.clientX - press.x, t.clientY - press.y) > SCROLL_SLOP_PX
        )
          cancelPress();
      }
    },
    { passive: false },
  );
  document.addEventListener(
    'touchend',
    (e) => {
      lastTouch = Date.now();
      if (drag) {
        e.preventDefault();
        endDrag();
        return;
      }
      if (press) {
        const card = press.card;
        cancelPress();
        e.preventDefault();
        openCard(card);
      }
    },
    { passive: false },
  );
  document.addEventListener('touchcancel', () => {
    cancelPress();
    if (drag) {
      drag.target = null;
      endDrag();
    }
  });
  week.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.card')) e.preventDefault();
  });

  // мышь — чтобы проверять на компьютере
  week.addEventListener('mousedown', (e) => {
    if (Date.now() - lastTouch < TOUCH_MOUSE_GAP_MS || e.button !== 0) return;
    const card = e.target.closest('.card');
    if (!card) return;
    press = {
      card,
      x: e.clientX,
      y: e.clientY,
      mouse: true,
      timer: setTimeout(() => {
        if (press) {
          const p = press;
          press = null;
          startDrag(p.card, p.x, p.y);
        }
      }, LONG_PRESS_MS),
    };
  });
  document.addEventListener('mousemove', (e) => {
    if (Date.now() - lastTouch < TOUCH_MOUSE_GAP_MS) return;
    if (drag) {
      moveDrag(e.clientX, e.clientY);
      return;
    }
    if (
      press &&
      press.mouse &&
      Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOUSE_SLOP_PX
    ) {
      const p = press;
      cancelPress();
      startDrag(p.card, e.clientX, e.clientY);
    }
  });
  document.addEventListener('mouseup', () => {
    if (Date.now() - lastTouch < TOUCH_MOUSE_GAP_MS) return;
    if (drag) {
      endDrag();
      return;
    }
    if (press && press.mouse) {
      const card = press.card;
      cancelPress();
      openCard(card);
    }
  });
  week.addEventListener('click', (e) => {
    if (e.target.closest('.card')) return;
    const c = e.target.closest(CELL);
    if (!c) return;
    const date = c.dataset.date,
      slot = +c.dataset.slot;
    // куда добавить нельзя (праздник) — редактор не открываем, модель говорит почему
    const place = canPlace(
      'addOnce',
      date,
      slot,
      new Date(),
      getState(),
      HOLIDAYS,
    );
    if (!place.ok) {
      toast(place.reason, 'error');
      return;
    }
    openEditor(null, { date, slot });
  });
  week.addEventListener('keydown', (e) => {
    if (
      (e.key === 'Enter' || e.key === ' ') &&
      e.target.classList.contains('card')
    ) {
      e.preventDefault();
      openCard(e.target);
    }
  });
}
