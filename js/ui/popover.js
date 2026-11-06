/* Подсказка по тапу на пару: подробности, аудитория, быстрые действия. */
import { CONFIG, DAY_NAME, DAY_SHORT } from '../config.js';
import { weekday, humanDate } from '../dates.js';
import { findAt, can, phase, isHoliday } from '../model.js';
import { getState, dispatch } from '../store.js';
import { esc, toast, colorClass, slotOf } from './helpers.js';
import { iconCalendar, iconMapPin } from './icons.js';
import { openEditor } from './editor.js';
import { gcalUrl } from './calendar.js';
import { addLayer, removeLayer } from './layers.js';

let pop = null;

/** «Перенесена, обычно — вт, 27 октября, 08:00»: исходные день, дата и время пары по правилу. */
function movedFrom(o) {
  const rule = getState().rules.find((r) => r.id === o.ruleId);
  const day = DAY_SHORT[weekday(o.orig)].toLowerCase();
  return `Перенесена, обычно — ${day}, ${humanDate(o.orig)}, ${slotOf(rule.slot).start}`;
}

/**
 * Строка-флаг под предметом: что с парой сейчас. Только показ — решает модель.
 * @returns {string} HTML или ''
 */
function flagHtml(o, ph, holiday) {
  const flag = (text, mod = '') =>
    `<div class="popover__flag${mod}">${text}</div>`;
  if (holiday) return flag('Праздник — пары нет');
  if (ph === 'future') return o.cancelled ? flag('Отменена') : '';
  if (o.cancelled) return flag('Не состоялась');
  if (ph === 'ongoing')
    return flag(`Идёт, до ${slotOf(o.slot).end}`, ' popover__flag--live');
  return '';
}

/**
 * Кнопки в один ряд — только те, что разрешает модель.
 * «Вернуть» видна у любой будущей отменённой пары: если слот занят,
 * по нажатию модель ответит почему.
 */
function actionsHtml(o, allow, ph, holiday) {
  const buttons = [];
  if (allow('edit'))
    buttons.push(
      '<button class="btn btn--primary popover__action" id="pEdit">Изменить</button>',
    );
  if (allow('cancel'))
    buttons.push(
      '<button class="btn btn--danger-outline popover__action" id="pCancel">Отменить</button>',
    );
  // «Вернуть» ничего не разрушает — обычная вторичная кнопка, без красного
  if (o.cancelled && ph === 'future' && !holiday)
    buttons.push(
      '<button class="btn btn--secondary popover__action" id="pRestore">Вернуть</button>',
    );
  // факт: у начавшейся и прошедшей пары — только отметка, состоялась ли она
  if (allow('notHeld'))
    buttons.push(
      '<button class="btn btn--danger-outline popover__action" id="pNotHeld">Не состоялась</button>',
    );
  if (allow('held'))
    buttons.push(
      '<button class="btn btn--secondary popover__action" id="pHeld">Состоялась</button>',
    );
  if (allow('calendar'))
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
  const sl = slotOf(o.slot);
  const catcher = document.createElement('div');
  catcher.className = 'popover-catcher'; // ловит тап мимо подсказки
  const el = document.createElement('section');
  el.className = 'popover';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', `Группа ${o.group}`);
  const day = DAY_NAME[weekday(o.date)].replace(/^./, (c) => c.toUpperCase());
  const now = new Date(),
    ph = phase(o, now),
    holiday = isHoliday(o.date, CONFIG.holidays);
  // спрашиваем модель с тем временем, которое сейчас
  const check = (op) => can(op, o, new Date(), getState(), CONFIG.holidays);
  const allow = (op) => can(op, o, now, getState(), CONFIG.holidays).ok;
  el.innerHTML = `<div class="popover__head"><span class="chip popover__chip ${colorClass(o)}">${esc(o.group)}</span><span class="popover__meta">${o.course} курс · ${esc(o.lessonType)}</span></div>
    <div class="popover__details">
      <div class="popover__date">${day}, ${humanDate(o.date)}</div>
      <div class="popover__time">${sl.start}–${sl.end}</div>
      <div class="popover__subject">${esc(o.subject)}</div>
      ${flagHtml(o, ph, holiday)}${o.moved ? `<div class="popover__moved">${movedFrom(o)}</div>` : ''}
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
    const link = allow('room')
      ? `<button class="popover__room-link">${o.room ? 'Изменить' : 'Указать'}</button>`
      : '';
    roomRow.innerHTML = `${iconMapPin('popover__room-icon')}<span class="popover__room-label">${o.room ? 'Аудитория ' + esc(o.room) : 'Аудитория не указана'}</span>${link}`;
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
      if (!guard('room')) return;
      dispatch({
        type: 'edit',
        occ: o,
        changes: { room },
        scope: o.type === 'rule' ? 'future' : 'one',
      });
      toast(
        !room
          ? 'Аудитория убрана'
          : o.type === 'rule'
            ? `Аудитория ${room}: с ${humanDate(o.orig)} и дальше`
            : `Аудитория ${room}`,
        'success',
      );
      const again = findAt(getState(), o.date, o.slot),
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
    if (!guard('cancel')) return;
    closePopover();
    dispatch({ type: 'setCancelled', occ: o, value: true });
    toast(`Отменена: ${humanDate(o.orig)}`, 'success');
  });
  onClick('pRestore', () => {
    if (!guard('restore')) return;
    closePopover();
    dispatch({ type: 'setCancelled', occ: o, value: false });
    toast('Пара возвращена', 'success');
  });
  // тот же флаг cancelled, что у отмены: часы такую пару уже не считают
  onClick('pNotHeld', () => {
    if (!guard('notHeld')) return;
    closePopover();
    dispatch({ type: 'setCancelled', occ: o, value: true });
    toast(`Отмечено: не состоялась, ${humanDate(o.date)}`, 'success');
  });
  onClick('pHeld', () => {
    if (!guard('held')) return;
    closePopover();
    dispatch({ type: 'setCancelled', occ: o, value: false });
    toast('Отмечено: состоялась', 'success');
  });
  onClick('pCal', () => {
    if (!guard('calendar')) return;
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
    gap = 8,
    edge = 16;
  const left = Math.min(
    Math.max(edge, r.left + r.width / 2 - w / 2),
    window.innerWidth - w - edge,
  );
  const below = r.bottom + gap + hgt <= window.innerHeight - 8;
  el.style.left = left + 'px';
  el.style.top =
    (below ? r.bottom + gap : Math.max(8, r.top - gap - hgt)) + 'px';
}

/**
 * Подсказка открыта, а фаза пары сменилась (началась или закончилась):
 * переоткрыть, чтобы перестроились флаг, кнопки и аудитория.
 * Вызывается из refreshNow().
 */
export function refreshPopover(now) {
  if (!pop || phase(pop.o, now) === pop.phase) return;
  const o = pop.o,
    card = document.querySelector(`.card[data-id="${CSS.escape(o.id)}"]`);
  if (card) openPopover(o, card);
  else closePopover();
}
