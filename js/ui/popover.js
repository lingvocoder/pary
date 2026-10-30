/* Подсказка по тапу на пару: подробности, аудитория, быстрые действия. */
import {DAY_NAME} from '../config.js';
import {weekday, humanDate} from '../dates.js';
import {findAt} from '../model.js';
import {getState, dispatch} from '../store.js';
import {esc, toast, userHex, courseClass, slotOf} from './helpers.js';
import {openEditor} from './editor.js';
import {gcalUrl} from './calendar.js';

let pop = null;

export function closePopover() {
  if (!pop) return;
  pop.catcher.remove(); pop.el.remove();
  document.querySelectorAll('.card--selected').forEach(c => c.classList.remove('card--selected'));
  pop = null;
}

export function openPopover(o, card) {
  closePopover();
  const hex = userHex(o), sl = slotOf(o.slot);
  const catcher = document.createElement('div'); catcher.className = 'pop-catch';   // ловит тап мимо подсказки
  const el = document.createElement('section');
  el.className = 'popover'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', `Группа ${o.group}`);
  el.innerHTML = `<span class="tip"></span>
    <div class="head"><span class="chip ${courseClass(o.course)}${hex ? ' chip--custom-color' : ''}"${hex ? ` style="--cc:${hex}"` : ''}>${esc(o.group)}</span><span>${o.course} курс, ${esc(o.lessonType)}</span></div>
    <div><div class="when">${DAY_NAME[weekday(o.date)].replace(/^./, c => c.toUpperCase())}, ${humanDate(o.date)}, ${sl.start}–${sl.end}</div>
      <div class="subj">${esc(o.subject)}</div>
      ${o.cancelled ? '<div class="flag">Отменена</div>' : ''}${o.moved ? `<div class="subj" style="font-size:13px;color:var(--mute)">↪ перенесена разово</div>` : ''}</div>
    <div class="room" id="pRoom"></div>
    <button class="btn btn--primary btn--compact" id="pEdit">Изменить</button>
    <div class="button-pair"><button class="btn btn--compact btn--danger-outline" id="pCancel">${o.cancelled ? 'Вернуть пару' : 'Отменить пару'}</button><button class="btn btn--compact btn--outline" id="pCal">В календарь</button></div>`;
  document.body.append(catcher, el);
  card.classList.add('card--selected');
  pop = {el, catcher, o};

  // строка аудитории: показ ↔ ввод
  const roomRow = el.querySelector('#pRoom');
  const showRoom = () => {
    roomRow.innerHTML = `<span>${o.room ? 'Аудитория ' + esc(o.room) : 'Аудитория не указана'}</span><button>${o.room ? 'Изменить' : 'Указать'}</button>`;
    roomRow.querySelector('button').onclick = editRoom;
  };
  const editRoom = () => {
    roomRow.innerHTML = `<input type="text" aria-label="Аудитория" placeholder="например, 301" value="${esc(o.room)}" autocomplete="off"><button>Готово</button>`;
    const input = roomRow.querySelector('input');
    const done = () => {
      const room = input.value.trim();
      if (room === o.room) { showRoom(); return; }
      dispatch({type: 'edit', occ: o, changes: {room}, scope: o.type === 'rule' ? 'future' : 'one'});
      toast(!room ? 'Аудитория убрана' : o.type === 'rule' ? `Аудитория ${room}: с ${humanDate(o.orig)} и дальше` : `Аудитория ${room}`);
      const again = findAt(getState(), o.date, o.slot), c = again && document.querySelector(`.card[data-id="${CSS.escape(again.id)}"]`);
      if (c) openPopover(again, c);
    };
    roomRow.querySelector('button').onclick = done;
    input.onkeydown = e => { if (e.key === 'Enter') done(); };
    input.focus();
  };
  showRoom();

  el.querySelector('#pEdit').onclick = () => { closePopover(); openEditor(o); };
  el.querySelector('#pCancel').onclick = () => {
    closePopover();
    dispatch({type: 'setCancelled', occ: o, value: !o.cancelled});
    toast(o.cancelled ? 'Пара возвращена' : `Отменена: ${humanDate(o.orig)}`);
  };
  el.querySelector('#pCal').onclick = () => window.open(gcalUrl(o), '_blank', 'noopener');
  catcher.addEventListener('click', closePopover);
  catcher.addEventListener('touchstart', e => { e.preventDefault(); closePopover(); }, {passive: false});

  // положение: под карточкой, а если не помещается — над ней
  const r = card.getBoundingClientRect(), w = el.offsetWidth, hgt = el.offsetHeight, gap = 10;
  const left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), window.innerWidth - w - 12);
  const below = r.bottom + gap + hgt <= window.innerHeight - 8;
  el.style.left = left + 'px';
  el.style.top = (below ? r.bottom + gap : Math.max(8, r.top - gap - hgt)) + 'px';
  const tip = el.querySelector('.tip');
  tip.classList.add(below ? 'up' : 'down');
  tip.style.left = Math.min(Math.max(16, r.left + r.width / 2 - left - 7), w - 30) + 'px';
}
