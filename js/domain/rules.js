/* Правила: что можно сделать с занятием и что можно поставить в клетку. */
import { isPastSlot, busyAt, phase, isHoliday } from './lessons.js';

/* ---------- Правила: что можно сделать с парой и что можно поставить в клетку ----------
   Будущая пара — план, её можно менять. Начавшаяся и прошедшая — факт: по ней
   считаются часы, у неё можно только отметить «не состоялась» / «состоялась».
   Интерфейс сам ничего не решает: он спрашивает can() и canPlace() и показывает reason. */

const OK = { ok: true };
const no = (reason) => ({ ok: false, reason });

const HOLIDAY_PAIR = 'Праздник — пары нет';
const ONGOING = 'Пара уже идёт';
const PAST = 'Пара уже прошла';
const NOT_STARTED = 'Пара ещё не началась';

/**
 * Состояние пары — столбец таблицы правил.
 * Праздник важнее отмены: пары в праздник нет, отменена она или нет.
 * @returns {'future'|'cancelled'|'holiday'|'ongoing'|'past'|'notHeld'|'holidayDone'}
 */
function pairState(o, now, holidays) {
  const ph = phase(o, now);
  if (isHoliday(o.date, holidays))
    return ph === 'future' ? 'holiday' : 'holidayDone';
  if (ph === 'future') return o.cancelled ? 'cancelled' : 'future';
  return o.cancelled ? 'notHeld' : ph;
}

/**
 * Таблица правил: операция → состояние → true (можно) или текст, почему нельзя.
 * cancelled — будущая отменённая, notHeld — начавшаяся или прошедшая, которая
 * не состоялась, holidayDone — начавшаяся или прошедшая в праздник.
 */
const RULES = {
  move: {
    future: true,
    cancelled: 'Сначала верни пару',
    holiday: true, // отработка: с праздника переносить можно
    ongoing: ONGOING,
    past: PAST,
    notHeld: PAST,
    holidayDone: HOLIDAY_PAIR,
  },
  cancel: {
    future: true,
    cancelled: 'Пара уже отменена',
    holiday: HOLIDAY_PAIR,
    ongoing: ONGOING,
    past: PAST,
    notHeld: PAST,
    holidayDone: HOLIDAY_PAIR,
  },
  restore: {
    future: 'Пара не отменена',
    cancelled: true, // и ещё слот должен быть свободен — см. can()
    holiday: HOLIDAY_PAIR,
    ongoing: ONGOING,
    past: PAST,
    notHeld: PAST,
    holidayDone: HOLIDAY_PAIR,
  },
  notHeld: {
    future: NOT_STARTED,
    cancelled: NOT_STARTED,
    holiday: HOLIDAY_PAIR,
    ongoing: true,
    past: true,
    notHeld: 'Уже отмечено: не состоялась',
    holidayDone: HOLIDAY_PAIR,
  },
  held: {
    future: NOT_STARTED,
    cancelled: NOT_STARTED,
    holiday: HOLIDAY_PAIR,
    ongoing: 'Уже отмечено: состоялась',
    past: 'Уже отмечено: состоялась',
    notHeld: true, // и ещё слот должен быть свободен — см. can()
    holidayDone: HOLIDAY_PAIR,
  },
  // группа, курс, предмет, цвет, дата, пара
  edit: {
    future: true,
    cancelled: true,
    holiday: true,
    ongoing: ONGOING,
    past: PAST,
    notHeld: PAST,
    holidayDone: HOLIDAY_PAIR,
  },
  room: {
    future: true,
    cancelled: true,
    holiday: true,
    ongoing: true,
    past: PAST,
    notHeld: PAST,
    holidayDone: HOLIDAY_PAIR,
  },
  delete: {
    future: true,
    cancelled: true,
    holiday: true,
    ongoing: ONGOING,
    past: PAST,
    notHeld: PAST,
    holidayDone: HOLIDAY_PAIR,
  },
  calendar: {
    future: true,
    cancelled: 'Пара отменена',
    holiday: HOLIDAY_PAIR,
    ongoing: ONGOING,
    past: PAST,
    notHeld: PAST,
    holidayDone: HOLIDAY_PAIR,
  },
};

/**
 * Можно ли сделать операцию с парой.
 * @param {'move'|'cancel'|'restore'|'notHeld'|'held'|'edit'|'room'|'delete'|'calendar'} op
 * @param {Occurrence} o
 * @param {Date} now
 * @param {State} s
 * @param {string[]} holidays
 * @returns {{ok:true}|{ok:false, reason:string}}
 */
export function can(op, o, now, s, holidays) {
  if (!RULES[op]) throw new Error('Неизвестная операция: ' + op);
  const rule = RULES[op][pairState(o, now, holidays)];
  if (rule !== true) return no(rule);
  // вернуть пару в сетку можно, только если её слот никто не занял
  if (op === 'restore' || op === 'held') {
    const b = busyAt(s, o.date, o.slot, o.id, holidays);
    if (b) return no(`Слот занят группой ${b.group}`);
  }
  return OK;
}

/**
 * Можно ли поставить пару в клетку.
 * Порядок проверок: праздник → прошлое → занято.
 * @param {'move'|'addOnce'|'addRepeat'} kind
 * @param {string} date
 * @param {number} slot
 * @param {Date} now
 * @param {State} s
 * @param {string[]} holidays
 * @param {string} [exceptId]  пара, которую переносят: свой слот она не занимает
 * @returns {{ok:true}|{ok:false, reason:string}}
 */
export function canPlace(kind, date, slot, now, s, holidays, exceptId) {
  if (!['move', 'addOnce', 'addRepeat'].includes(kind))
    throw new Error('Неизвестный вид: ' + kind);
  if (isHoliday(date, holidays)) return no('Праздник — пар нет');
  // разовую пару в начавшийся слот добавить можно: это запись факта (замена)
  if (isPastSlot(date, slot, now)) {
    if (kind === 'move') return no('Прошедшее время — сюда нельзя');
    if (kind === 'addRepeat')
      return no('Повторяющуюся пару нельзя начать в прошлом');
  }
  const b = busyAt(s, date, slot, exceptId, holidays);
  if (b)
    return no(
      kind === 'move'
        ? `Слот занят группой ${b.group}`
        : `В этом слоте уже группа ${b.group}`,
    );
  return OK;
}
