/* Подсказка по тапу на пару: подробности, аудитория, быстрые действия. */
import { DAY_NAME, DAY_SHORT } from '../config.js';
import { weekday, humanDate } from '../dates.js';
import { findAt } from '../model.js';
import { getState, dispatch } from '../store.js';
import { esc, toast, colorClass, slotOf } from './helpers.js';
import { iconCalendar, iconMapPin } from './icons.js';
import { openEditor } from './editor.js';
import { gcalUrl } from './calendar.js';

let pop = null;

/** «Перенесена, обычно — вт, 27 октября, 08:00»: исходные день, дата и время пары по правилу. */
function movedFrom(o) {
  const rule = getState().rules.find((r) => r.id === o.ruleId);
  const day = DAY_SHORT[weekday(o.orig)].toLowerCase();
  return `Перенесена, обычно — ${day}, ${humanDate(o.orig)}, ${slotOf(rule.slot).start}`;
}

export function closePopover() {
  if (!pop) return;
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
  // «Вернуть пару» ничего не разрушает — обычная вторичная кнопка, без красного
  const cancelBtn = o.cancelled
    ? '<button class="btn btn--secondary" id="pCancel">Вернуть пару</button>'
    : '<button class="btn btn--danger-outline" id="pCancel">Отменить пару</button>';
  el.innerHTML = `<div class="popover__head"><span class="chip popover__chip ${colorClass(o)}">${esc(o.group)}</span><span class="popover__meta">${o.course} курс · ${esc(o.lessonType)}</span></div>
    <div class="popover__details">
      <div class="popover__date">${day}, ${humanDate(o.date)}</div>
      <div class="popover__time">${sl.start}–${sl.end}</div>
      <div class="popover__subject">${esc(o.subject)}</div>
      ${o.cancelled ? '<div class="popover__flag">Отменена</div>' : ''}${o.moved ? `<div class="popover__moved">${movedFrom(o)}</div>` : ''}
    </div>
    <div class="popover__room" id="pRoom"></div>
    <div class="popover__actions">
      <button class="btn btn--primary" id="pEdit">Изменить</button>
      ${cancelBtn}
      <button class="btn" id="pCal">${iconCalendar('btn__icon')}В календарь</button>
    </div>`;
  document.body.append(catcher, el);
  card.classList.add('card--selected');
  pop = { el, catcher, o };

  // строка аудитории: показ ↔ ввод
  const roomRow = el.querySelector('#pRoom');
  const showRoom = () => {
    roomRow.innerHTML = `${iconMapPin('popover__room-icon')}<span class="popover__room-label">${o.room ? 'Аудитория ' + esc(o.room) : 'Аудитория не указана'}</span><button class="popover__room-link">${o.room ? 'Изменить' : 'Указать'}</button>`;
    roomRow.querySelector('button').onclick = editRoom;
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

  el.querySelector('#pEdit').onclick = () => {
    closePopover();
    openEditor(o);
  };
  el.querySelector('#pCancel').onclick = () => {
    closePopover();
    dispatch({ type: 'setCancelled', occ: o, value: !o.cancelled });
    toast(
      o.cancelled ? 'Пара возвращена' : `Отменена: ${humanDate(o.orig)}`,
      'success',
    );
  };
  el.querySelector('#pCal').onclick = () =>
    window.open(gcalUrl(o), '_blank', 'noopener');
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
