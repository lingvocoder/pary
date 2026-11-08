/* Подсказка по тапу на пару: подробности, аудитория, быстрые действия. */
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
import {
  lessonPhase,
  isHoliday,
  findLessonAt,
  findRule,
} from '../domain/lessons.js';
import { OPERATION, can, lessonState } from '../domain/rules.js';
import { ACTION, roomChangeScope } from '../domain/changes.js';
import { getState, dispatch } from '../store/store.js';
import { toast } from './helpers.js';
import { lessonColorClass } from './views/color.js';
import { openEditor } from './editor.js';
import { addLayer, removeLayer } from './layers.js';
import { placePopover } from './geometry.js';
import { popoverView, roomView, roomInputView } from './views/popover.js';

let pop = null;

/** «Перенесена, обычно — вт, 27 октября, 08:00»: исходные день, дата и время пары по правилу. */
function movedFrom(o) {
  const rule = findRule(getState(), o.ruleId);
  return formatMovedFrom(o, rule);
}

export function closePopover() {
  if (!pop) return;
  removeLayer(pop.layer);
  pop.catcher.remove();
  pop.el.remove();
  document
    .querySelectorAll('.card--selected')
    .forEach((c) => c.classList.remove('card--selected'));
  pop = null;
}

export function openPopover(o, card) {
  closePopover();
  const catcher = document.createElement('div');
  catcher.className = 'popover-catcher'; // ловит тап мимо подсказки
  const el = document.createElement('section');
  el.className = 'popover';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', formatGroupTitle(o.group));
  const now = new Date(),
    ph = lessonPhase(o, now),
    holiday = isHoliday(o.date, HOLIDAYS);
  // спрашиваем модель с тем временем, которое сейчас
  const check = (op) =>
    can({
      operation: op,
      lesson: o,
      now: new Date(),
      state: getState(),
      holidays: HOLIDAYS,
    });
  const allow = (op) =>
    can({
      operation: op,
      lesson: o,
      now: now,
      state: getState(),
      holidays: HOLIDAYS,
    }).ok;
  el.innerHTML = popoverView({
    group: o.group,
    colorClass: lessonColorClass(o),
    meta: formatCourseAndType(o),
    date: formatLongDate(o.date),
    time: formatTimeRange(o.slot),
    subject: o.subject,
    flag: formatLessonFlag(lessonState(o, now, HOLIDAYS), o),
    movedFrom: o.moved ? movedFrom(o) : '',
    actions: {
      edit: allow(OPERATION.EDIT),
      cancel: allow(OPERATION.CANCEL),
      // «Вернуть» видна у любой будущей отменённой пары: если слот занят,
      // по нажатию модель ответит почему
      restore: o.cancelled && ph === 'future' && !holiday,
      notHeld: allow(OPERATION.NOT_HELD),
      held: allow(OPERATION.HELD),
      calendar: allow(OPERATION.CALENDAR),
    },
  });
  document.body.append(catcher, el);
  card.classList.add('card--selected');
  pop = { el, catcher, o, phase: ph, layer: addLayer(closePopover) };

  /** Перед действием — проверка заново: пара могла начаться, пока подсказка открыта. */
  const guard = (op) => {
    const r = check(op);
    if (r.ok) return true;
    closePopover();
    toast(r.reason, 'error');
    return false;
  };
  const onClick = (id, handler) => {
    const b = el.querySelector('#' + id);
    if (b) b.onclick = handler;
  };

  // строка аудитории: показ ↔ ввод
  const roomRow = el.querySelector('#pRoom');
  // у прошедшей пары аудитория — только текст, без «Указать»
  const showRoom = () => {
    roomRow.innerHTML = roomView({
      label: formatRoomLabel(o.room),
      linkText: allow(OPERATION.ROOM)
        ? o.room
          ? 'Изменить'
          : 'Указать'
        : null,
    });
    const b = roomRow.querySelector('button');
    if (b) b.onclick = editRoom;
  };
  const editRoom = () => {
    roomRow.innerHTML = roomInputView(o.room);
    const input = roomRow.querySelector('input');
    const done = () => {
      const room = input.value.trim();
      if (room === o.room) {
        showRoom();
        return;
      }
      if (!guard(OPERATION.ROOM)) return;
      const scope = roomChangeScope(o);
      dispatch({ type: ACTION.EDIT, lesson: o, changes: { room }, scope });
      toast(formatRoomSaved(room, o, scope), 'success');
      const again = findLessonAt(getState(), o.date, o.slot),
        c =
          again &&
          document.querySelector(`.card[data-id="${CSS.escape(again.id)}"]`);
      if (c) openPopover(again, c);
    };
    roomRow.querySelector('button').onclick = done;
    input.onkeydown = (e) => {
      if (e.key === 'Enter') done();
    };
    input.focus();
  };
  showRoom();

  onClick('pEdit', () => {
    closePopover();
    openEditor(o);
  });
  onClick('pCancel', () => {
    if (!guard(OPERATION.CANCEL)) return;
    closePopover();
    dispatch({ type: ACTION.SET_CANCELLED, lesson: o, isCancelled: true });
    toast(formatCancelledToast(o), 'success');
  });
  onClick('pRestore', () => {
    if (!guard(OPERATION.RESTORE)) return;
    closePopover();
    dispatch({ type: ACTION.SET_CANCELLED, lesson: o, isCancelled: false });
    toast('Пара возвращена', 'success');
  });
  // тот же флаг cancelled, что у отмены: часы такую пару уже не считают
  onClick('pNotHeld', () => {
    if (!guard(OPERATION.NOT_HELD)) return;
    closePopover();
    dispatch({ type: ACTION.SET_CANCELLED, lesson: o, isCancelled: true });
    toast(formatNotHeldToast(o), 'success');
  });
  onClick('pHeld', () => {
    if (!guard(OPERATION.HELD)) return;
    closePopover();
    dispatch({ type: ACTION.SET_CANCELLED, lesson: o, isCancelled: false });
    toast('Отмечено: состоялась', 'success');
  });
  onClick('pCal', () => {
    if (!guard(OPERATION.CALENDAR)) return;
    window.open(
      calendarLink(o, findRule(getState(), o.ruleId)),
      '_blank',
      'noopener',
    );
  });
  catcher.addEventListener('click', closePopover);
  catcher.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      closePopover();
    },
    { passive: false },
  );

  // под карточкой, а если не помещается — над ней: расчёт в geometry.js
  const { left, top } = placePopover(
    card.getBoundingClientRect(),
    { width: el.offsetWidth, height: el.offsetHeight },
    { width: window.innerWidth, height: window.innerHeight },
  );
  el.style.left = left + 'px';
  el.style.top = top + 'px';
}

/**
 * Подсказка открыта, а фаза пары сменилась (началась или закончилась):
 * переоткрыть, чтобы перестроились флаг, кнопки и аудитория.
 * Вызывается из refreshNow().
 */
export function refreshPopover(now) {
  if (!pop || lessonPhase(pop.o, now) === pop.phase) return;
  const o = pop.o,
    card = document.querySelector(`.card[data-id="${CSS.escape(o.id)}"]`);
  if (card) openPopover(o, card);
  else closePopover();
}
