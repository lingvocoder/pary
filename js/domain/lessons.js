/* Занятия недели: из правил, исключений и разовых пар — кто в каком слоте, следующая пара,
   фаза занятия и праздник. Чистые функции: текущее время приходит параметром now. */
import { SLOTS } from '../config/university.js';
import { UPCOMING_WEEKS } from '../config/interface.js';
import {
  toIso,
  addDays,
  weekday,
  weekStart,
  atTime,
  DAYS_PER_WEEK,
} from './dates.js';

/**
 * Повторяющаяся пара: «каждую среду, 5-я пара».
 * @typedef {Object} Rule
 * @property {string} id
 * @property {string} group         номер группы, '326'
 * @property {number} course        1…4
 * @property {string} subject
 * @property {string} lessonType    'ЛР' | 'ПР' | 'ЛК'
 * @property {string} color         id из PALETTE; '' — цвет курса
 * @property {string} room          аудитория; '' — не указана
 * @property {number} weekday       0 = понедельник … 5 = суббота
 * @property {number} slot          номер пары, 1…9
 * @property {string} from          действует с 'YYYY-MM-DD'
 * @property {string|null} until    действует по 'YYYY-MM-DD'; null — без конца
 * @property {string} teacher       '' — это я; для v2 с коллегами
 * @property {'pdf'|'manual'} source
 * @property {string|null} importKey  как узнать эту пару в новом PDF
 */
/**
 * Исключение для одной даты правила. Ключ: `${ruleId}|${date}`.
 * @typedef {Object} Exception
 * @property {boolean} [cancelled]
 * @property {boolean} [deleted]
 * @property {{date:string, slot:number}} [moveTo]
 * @property {Object} [patch]       изменённые поля только на эту дату
 */
/**
 * Разовая пара: замена, консультация.
 * @typedef {Object} OneOff
 * @property {string} id
 * @property {string} date
 * @property {number} slot
 * @property {string} group
 * @property {number} course
 * @property {string} subject
 * @property {string} lessonType
 * @property {string} color
 * @property {string} room
 * @property {boolean} cancelled
 * @property {string} teacher
 * @property {'manual'} source
 */
/**
 * @typedef {Object} State
 * @property {number} schema
 * @property {Rule[]} rules
 * @property {Object<string, Exception>} exceptions
 * @property {OneOff[]} oneOffs
 */
/**
 * Конкретное занятие в конкретный день — то, что видно в сетке.
 * @typedef {Object} Occurrence
 * @property {'rule'|'once'} type
 * @property {string} id            уникален в пределах недели
 * @property {string} [ruleId]
 * @property {string} orig          дата по правилу (до переноса)
 * @property {string} date
 * @property {number} slot
 * @property {string} group
 * @property {number} course
 * @property {string} subject
 * @property {string} lessonType
 * @property {string} color
 * @property {string} room
 * @property {boolean} cancelled
 * @property {boolean} moved
 * @property {'pdf'|'manual'} source
 */

export const exKey = (ruleId, date) => `${ruleId}|${date}`;
export const splitKey = (k) => {
  const i = k.indexOf('|');
  return [k.slice(0, i), k.slice(i + 1)];
};
export const ruleActiveOn = (r, date) =>
  date >= r.from &&
  (!r.until || date <= r.until) &&
  weekday(date) === r.weekday;

/** @returns {Occurrence} */
function occFromRule(r, date, e) {
  const p = e.patch || {};
  const pick = (f) => (f in p ? p[f] : r[f]);
  return {
    type: 'rule',
    id: exKey(r.id, date),
    ruleId: r.id,
    orig: date,
    group: pick('group'),
    course: pick('course'),
    subject: pick('subject'),
    lessonType: pick('lessonType'),
    color: pick('color'),
    room: pick('room'),
    date: e.moveTo ? e.moveTo.date : date,
    slot: e.moveTo ? e.moveTo.slot : r.slot,
    cancelled: !!e.cancelled,
    moved: !!e.moveTo,
    source: r.source,
  };
}

/**
 * Все занятия недели, с учётом переносов в неё и из неё.
 * @param {State} s
 * @param {string} ws  понедельник недели
 * @returns {Occurrence[]}
 */
export function weekOccurrences(s, ws) {
  const we = addDays(ws, DAYS_PER_WEEK - 1),
    inWeek = (d) => d >= ws && d <= we,
    out = [];
  for (const r of s.rules) {
    const date = addDays(ws, r.weekday);
    if (!ruleActiveOn(r, date)) continue;
    const e = s.exceptions[exKey(r.id, date)] || {};
    if (!e.deleted && !e.moveTo) out.push(occFromRule(r, date, e));
  }
  for (const k in s.exceptions) {
    // перенесённые сюда с других дат
    const e = s.exceptions[k];
    if (!e.moveTo || e.deleted || !inWeek(e.moveTo.date)) continue;
    const [id, date] = splitKey(k),
      r = s.rules.find((x) => x.id === id);
    if (r && ruleActiveOn(r, date)) out.push(occFromRule(r, date, e));
  }
  for (const o of s.oneOffs)
    if (inWeek(o.date))
      out.push({ ...o, type: 'once', orig: o.date, moved: false });
  return out;
}

/** Ближайшая неотменённая пара не в праздник, которая ещё не закончилась. */
export function nextPair(s, now, holidays = []) {
  const today = toIso(now);
  for (let w = 0; w < UPCOMING_WEEKS; w++) {
    const list = weekOccurrences(
      s,
      addDays(weekStart(today), DAYS_PER_WEEK * w),
    )
      .filter((o) => !o.cancelled && !isHoliday(o.date, holidays))
      .map((o) => ({
        ...o,
        start: atTime(o.date, SLOTS[o.slot - 1].start),
        end: atTime(o.date, SLOTS[o.slot - 1].end),
      }))
      .filter((o) => o.end > now)
      .sort((a, b) => a.start - b.start);
    if (list.length) return list[0];
  }
  return null;
}

/** Начало и конец слота в эту дату — объекты Date. */
export const slotTimes = (date, slot) => ({
  start: atTime(date, SLOTS[slot - 1].start),
  end: atTime(date, SLOTS[slot - 1].end),
});

/** Идёт ли пара прямо сейчас: не отменена, не в праздник и начало ≤ now < конец. */
export function isOngoing(o, now, holidays = []) {
  if (o.cancelled || isHoliday(o.date, holidays)) return false;
  const { start, end } = slotTimes(o.date, o.slot);
  return start <= now && now < end;
}

/** Слот уже в прошлом: его начало ≤ now. Значит, и пара, которая идёт сейчас, — прошлое. */
export function isPastSlot(date, slot, now) {
  return slotTimes(date, slot).start <= now;
}

/** Кто уже занимает слот. Отменённая пара и пара в праздник слот не держат. */
export function busyAt(s, date, slot, exceptId, holidays = []) {
  return (
    weekOccurrences(s, weekStart(date)).find(
      (o) =>
        o.date === date &&
        o.slot === slot &&
        !o.cancelled &&
        !isHoliday(o.date, holidays) &&
        o.id !== exceptId,
    ) || null
  );
}

/**
 * Фаза пары по её фактическому месту (уже после переноса).
 * @param {Occurrence} o
 * @param {Date} now
 * @returns {'future'|'ongoing'|'past'}
 */
export function phase(o, now) {
  const { start, end } = slotTimes(o.date, o.slot);
  if (now < start) return 'future';
  return now < end ? 'ongoing' : 'past';
}

/** Праздник ли эта дата: список праздников приходит параметром (HOLIDAYS). */
export function isHoliday(date, holidays) {
  return holidays.includes(date);
}

/** Занятие в слоте: сначала неотменённое, иначе любое. */
export function findAt(s, date, slot) {
  const list = weekOccurrences(s, weekStart(date)).filter(
    (o) => o.date === date && o.slot === slot,
  );
  return list.find((o) => !o.cancelled) || list[0] || null;
}
