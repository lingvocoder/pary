/* Занятия недели: из правил, исключений и разовых пар — кто в каком слоте, следующее занятие,
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
 * Правка одной даты правила. Ключ в state.exceptions: `${ruleId}|${ruleDate}`.
 * @typedef {Object} RuleException
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
 * Сохранённые данные. Имена полей — схема данных в телефоне, их меняют только через миграцию.
 * @typedef {Object} State
 * @property {number} schema
 * @property {Rule[]} rules
 * @property {Object<string, RuleException>} exceptions
 * @property {OneOff[]} oneOffs
 */
/**
 * Занятие в конкретный день — то, что видно в сетке. Вычисляется, в данных не хранится.
 * @typedef {Object} Lesson
 * @property {'rule'|'oneOff'} type
 * @property {string} id            уникален в пределах недели
 * @property {string} [ruleId]
 * @property {string} ruleDate      дата по правилу (до переноса); у разовой — её дата
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

/** Откуда занятие: из повторяющегося правила или разовая пара. */
export const LESSON_KIND = Object.freeze({ RULE: 'rule', ONE_OFF: 'oneOff' });

/** Откуда пара попала в данные. Значения хранятся в телефоне. */
export const SOURCE = Object.freeze({ PDF: 'pdf', MANUAL: 'manual' });

/** Фаза занятия по времени: ещё не началось, идёт, закончилось. */
export const PHASE = Object.freeze({
  FUTURE: 'future',
  ONGOING: 'ongoing',
  PAST: 'past',
});

const KEY_SEPARATOR = '|';

/** Ключ правки одной даты правила в state.exceptions. */
export const ruleExceptionKey = (ruleId, ruleDate) =>
  `${ruleId}${KEY_SEPARATOR}${ruleDate}`;

/** Обратно: ключ → [ruleId, ruleDate]. */
export function splitRuleExceptionKey(key) {
  const separatorIndex = key.indexOf(KEY_SEPARATOR);
  return [key.slice(0, separatorIndex), key.slice(separatorIndex + 1)];
}

/** Действует ли правило в эту дату: в своих границах и в свой день недели. */
export const isRuleActiveOn = (rule, date) =>
  date >= rule.from &&
  (!rule.until || date <= rule.until) &&
  weekday(date) === rule.weekday;

/**
 * Занятие из правила на его дату, с учётом правки этой даты.
 * @param {Rule} rule
 * @param {string} ruleDate
 * @param {RuleException} ruleException  {} — правки нет
 * @returns {Lesson}
 */
function lessonFromRule(rule, ruleDate, ruleException) {
  const patch = ruleException.patch || {};
  const pick = (field) => (field in patch ? patch[field] : rule[field]);
  const moveTo = ruleException.moveTo;
  return {
    type: LESSON_KIND.RULE,
    id: ruleExceptionKey(rule.id, ruleDate),
    ruleId: rule.id,
    ruleDate,
    group: pick('group'),
    course: pick('course'),
    subject: pick('subject'),
    lessonType: pick('lessonType'),
    color: pick('color'),
    room: pick('room'),
    date: moveTo ? moveTo.date : ruleDate,
    slot: moveTo ? moveTo.slot : rule.slot,
    cancelled: !!ruleException.cancelled,
    moved: !!moveTo,
    source: rule.source,
  };
}

/**
 * Все занятия недели, с учётом переносов в неё и из неё.
 * @param {State} state
 * @param {string} weekStartDate  понедельник недели
 * @returns {Lesson[]}
 */
export function weekLessons(state, weekStartDate) {
  const weekEndDate = addDays(weekStartDate, DAYS_PER_WEEK - 1);
  const isInWeek = (date) => date >= weekStartDate && date <= weekEndDate;
  const lessons = [];
  for (const rule of state.rules) {
    const ruleDate = addDays(weekStartDate, rule.weekday);
    if (!isRuleActiveOn(rule, ruleDate)) continue;
    const ruleException =
      state.exceptions[ruleExceptionKey(rule.id, ruleDate)] || {};
    if (!ruleException.deleted && !ruleException.moveTo)
      lessons.push(lessonFromRule(rule, ruleDate, ruleException));
  }
  // перенесённые в эту неделю с других дат
  for (const key in state.exceptions) {
    const ruleException = state.exceptions[key];
    const movedHere =
      ruleException.moveTo &&
      !ruleException.deleted &&
      isInWeek(ruleException.moveTo.date);
    if (!movedHere) continue;
    const [ruleId, ruleDate] = splitRuleExceptionKey(key);
    const rule = state.rules.find((candidate) => candidate.id === ruleId);
    if (rule && isRuleActiveOn(rule, ruleDate))
      lessons.push(lessonFromRule(rule, ruleDate, ruleException));
  }
  for (const oneOff of state.oneOffs)
    if (isInWeek(oneOff.date))
      lessons.push({
        ...oneOff,
        type: LESSON_KIND.ONE_OFF,
        ruleDate: oneOff.date,
        moved: false,
      });
  return lessons;
}

/**
 * Ближайшее неотменённое занятие не в праздник, которое ещё не закончилось.
 * Ищет на UPCOMING_WEEKS недель вперёд.
 * @param {State} state
 * @param {Date} now
 * @param {string[]} [holidays]
 * @returns {(Lesson & {start: Date, end: Date})|null}
 */
export function nextLesson(state, now, holidays = []) {
  const thisWeekStart = weekStart(toIso(now));
  for (let weekOffset = 0; weekOffset < UPCOMING_WEEKS; weekOffset++) {
    const weekStartDate = addDays(thisWeekStart, DAYS_PER_WEEK * weekOffset);
    const upcoming = weekLessons(state, weekStartDate)
      .filter(
        (lesson) => !lesson.cancelled && !isHoliday(lesson.date, holidays),
      )
      .map((lesson) => ({ ...lesson, ...slotTimes(lesson.date, lesson.slot) }))
      .filter((lesson) => lesson.end > now)
      .sort((first, second) => first.start - second.start);
    if (upcoming.length) return upcoming[0];
  }
  return null;
}

/**
 * Начало и конец пары с этим номером в эту дату.
 * @returns {{start: Date, end: Date}}
 */
export function slotTimes(date, slot) {
  const bell = SLOTS[slot - 1];
  return { start: atTime(date, bell.start), end: atTime(date, bell.end) };
}

/** Идёт ли занятие прямо сейчас: не отменено, не в праздник и начало ≤ now < конец. */
export function isOngoing(lesson, now, holidays = []) {
  if (lesson.cancelled || isHoliday(lesson.date, holidays)) return false;
  const { start, end } = slotTimes(lesson.date, lesson.slot);
  return start <= now && now < end;
}

/** Слот уже в прошлом: его начало ≤ now. Значит, и занятие, которое идёт сейчас, — прошлое. */
export function isPastSlot(date, slot, now) {
  return slotTimes(date, slot).start <= now;
}

/**
 * Кто уже занимает слот. Отменённое занятие и занятие в праздник слот не держат.
 * @param {Object} where
 * @param {State} where.state
 * @param {string} where.date
 * @param {number} where.slot
 * @param {string} [where.exceptLessonId]  занятие, которое переносят: свой слот оно не занимает
 * @param {string[]} [where.holidays]
 * @returns {Lesson|null}
 */
export function findOccupant({
  state,
  date,
  slot,
  exceptLessonId,
  holidays = [],
}) {
  const occupant = weekLessons(state, weekStart(date)).find(
    (lesson) =>
      lesson.date === date &&
      lesson.slot === slot &&
      !lesson.cancelled &&
      !isHoliday(lesson.date, holidays) &&
      lesson.id !== exceptLessonId,
  );
  return occupant || null;
}

/**
 * Фаза занятия по его фактическому месту (уже после переноса).
 * @param {Lesson} lesson
 * @param {Date} now
 * @returns {string} одно из PHASE
 */
export function lessonPhase(lesson, now) {
  const { start, end } = slotTimes(lesson.date, lesson.slot);
  if (now < start) return PHASE.FUTURE;
  return now < end ? PHASE.ONGOING : PHASE.PAST;
}

/** Праздник ли эта дата: список праздников приходит параметром (HOLIDAYS). */
export function isHoliday(date, holidays) {
  return holidays.includes(date);
}

/** Правило по id; undefined — такого нет (или у занятия ruleId не задан: разовая пара). */
export const findRule = (state, ruleId) =>
  state.rules.find((rule) => rule.id === ruleId);

/**
 * Номер пары, которая идёт сейчас по сетке звонков; null — перемена или вне сетки.
 * @param {Date} now
 * @returns {number|null}
 */
export function currentSlot(now) {
  const today = toIso(now);
  for (let slot = 1; slot <= SLOTS.length; slot++) {
    const { start, end } = slotTimes(today, slot);
    if (start <= now && now < end) return slot;
  }
  return null;
}

/** Занятие в слоте: сначала неотменённое, иначе любое. */
export function findLessonAt(state, date, slot) {
  const inSlot = weekLessons(state, weekStart(date)).filter(
    (lesson) => lesson.date === date && lesson.slot === slot,
  );
  return inSlot.find((lesson) => !lesson.cancelled) || inSlot[0] || null;
}
