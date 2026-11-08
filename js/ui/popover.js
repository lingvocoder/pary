/* Подсказка по тапу на пару: подробности, аудитория, быстрые действия. */
import { HOLIDAYS } from '../config/university.js';
import {
  POPOVER_GAP_PX,
  SCREEN_EDGE_PX,
  SCREEN_TOP_BOTTOM_GAP_PX,
} from '../config/interface.js';
import {
  formatLongDate,
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
  LESSON_KIND,
  lessonPhase,
  isHoliday,
  findLessonAt,
} from '../domain/lessons.js';
import { OPERATION, can, lessonState } from '../domain/rules.js';
import { ACTION, SCOPE } from '../domain/changes.js';
import { getState, dispatch } from '../store.js';
import { esc, toast, colorClass } from './helpers.js';
import { iconCalendar, iconMapPin } from './icons.js';
import { openEditor } from './editor.js';
import { gcalUrl } from './calendar.js';
import { addLayer, removeLayer } from './layers.js';

let pop = null;

/** «Перенесена, обычно — вт, 27 октября, 08:00»: исходные день, дата и время пары по правилу. */
function movedFrom(o) {
  const rule = getState().rules.find((r) => r.id === o.ruleId);
  return formatMovedFrom(o, rule);
}

/**
 * Строка-флаг под предметом: что с парой сейчас. Только показ — решает модель.
 * @returns {string} HTML или ''
 */
function flagHtml(flag) {
  if (!flag) return '';
  const liveModifier = flag.isLive ? ' popover__flag--live' : '';
  return `<div class="popover__flag${liveModifier}">${flag.text}</div>`;
}

/**
 * Кнопки в один ряд — только те, что разрешает модель.
 * «Вернуть» видна у любой будущей отменённой пары: если слот занят,
 * по нажатию модель ответит почему.
 */
function actionsHtml(o, allow, ph, holiday) {
  const buttons = [];
  if (allow(OPERATION.EDIT))
    buttons.push(
      '<button class="btn btn--primary popover__action" id="pEdit">Изменить</button>',
    );
  if (allow(OPERATION.CANCEL))
    buttons.push(
      '<button class="btn btn--danger-outline popover__action" id="pCancel">Отменить</button>',
    );
  // «Вернуть» ничего не разрушает — обычная вторичная кнопка, без красного
  if (o.cancelled && ph === 'future' && !holiday)
    buttons.push(
      '<button class="btn btn--secondary popover__action" id="pRestore">Вернуть</button>',
    );
  // факт: у начавшейся и прошедшей пары — только отметка, состоялась ли она
  if (allow(OPERATION.NOT_HELD))
    buttons.push(
      '<button class="btn btn--danger-outline popover__action" id="pNotHeld">Не состоялась</button>',
    );
  if (allow(OPERATION.HELD))
    buttons.push(
      '<button class="btn btn--secondary popover__action" id="pHeld">Состоялась</button>',
    );
  if (allow(OPERATION.CALENDAR))
    buttons.push(
      `<button class="btn btn--secondary popover__icon-action" id="pCal" aria-label="В календарь">${iconCalendar('btn__icon')}</button>`,
    );
  return buttons.length
    ? `<div class="popover__actions">${buttons.join('')}</div>`
    : '';
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
  el.setAttribute('aria-label', `Группа ${o.group}`);
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
  el.innerHTML = `<div class="popover__head"><span class="chip popover__chip ${colorClass(o)}">${esc(o.group)}</span><span class="popover__meta">${esc(formatCourseAndType(o))}</span></div>
    <div class="popover__details">
      <div class="popover__date">${formatLongDate(o.date)}</div>
      <div class="popover__time">${formatTimeRange(o.slot)}</div>
      <div class="popover__subject">${esc(o.subject)}</div>
      ${flagHtml(formatLessonFlag(lessonState(o, now, HOLIDAYS), o))}${o.moved ? `<div class="popover__moved">${movedFrom(o)}</div>` : ''}
    </div>
    <div class="popover__room" id="pRoom"></div>
    ${actionsHtml(o, allow, ph, holiday)}`;
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
    const link = allow(OPERATION.ROOM)
      ? `<button class="popover__room-link">${o.room ? 'Изменить' : 'Указать'}</button>`
      : '';
    roomRow.innerHTML = `${iconMapPin('popover__room-icon')}<span class="popover__room-label">${esc(formatRoomLabel(o.room))}</span>${link}`;
    const b = roomRow.querySelector('button');
    if (b) b.onclick = editRoom;
  };
  const editRoom = () => {
    roomRow.innerHTML = `<input class="popover__room-input" type="text" aria-label="Аудитория" placeholder="например, 301" value="${esc(o.room)}" autocomplete="off"><button class="popover__room-link">Готово</button>`;
    const input = roomRow.querySelector('input');
    const done = () => {
      const room = input.value.trim();
      if (room === o.room) {
        showRoom();
        return;
      }
      if (!guard(OPERATION.ROOM)) return;
      const scope =
        o.type === LESSON_KIND.RULE ? SCOPE.FUTURE : SCOPE.THIS_DATE;
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
    window.open(gcalUrl(o), '_blank', 'noopener');
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

  // положение: под карточкой, а если не помещается — над ней;
  // от краёв экрана — те же 16 px, что поля страницы
  const r = card.getBoundingClientRect(),
    w = el.offsetWidth,
    hgt = el.offsetHeight,
    gap = POPOVER_GAP_PX,
    edge = SCREEN_EDGE_PX;
  const left = Math.min(
    Math.max(edge, r.left + r.width / 2 - w / 2),
    window.innerWidth - w - edge,
  );
  const below =
    r.bottom + gap + hgt <= window.innerHeight - SCREEN_TOP_BOTTOM_GAP_PX;
  el.style.left = left + 'px';
  el.style.top =
    (below
      ? r.bottom + gap
      : Math.max(SCREEN_TOP_BOTTOM_GAP_PX, r.top - gap - hgt)) + 'px';
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
