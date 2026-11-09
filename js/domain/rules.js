/* Правила: что можно сделать с занятием и что можно поставить в клетку.
   Будущее занятие — план, его можно менять. Начавшееся и прошедшее — факт: по нему
   считаются часы, у него можно только отметить «не состоялась» / «состоялась».
   Интерфейс сам ничего не решает: спрашивает isApplicable(), can(), canPlace() и показывает reason. */
import {
  isPastSlot,
  findOccupant,
  lessonPhase,
  isHoliday,
  PHASE,
} from './lessons.js';

/** Что можно сделать с занятием. */
export const OPERATION = Object.freeze({
  MOVE: 'move',
  CANCEL: 'cancel',
  RESTORE: 'restore',
  NOT_HELD: 'notHeld',
  HELD: 'held',
  EDIT: 'edit', // группа, курс, предмет, цвет, дата, пара
  ROOM: 'room',
  DELETE: 'delete',
  CALENDAR: 'calendar',
});

/** Что ставят в клетку: переносят занятие или добавляют новое. */
export const PLACE_KIND = Object.freeze({
  MOVE: 'move',
  ADD_ONE_OFF: 'addOneOff',
  ADD_RULE: 'addRule',
});

/**
 * Состояние занятия — столбец таблицы правил.
 * CANCELLED — будущее отменённое; NOT_HELD — начавшееся или прошедшее, которое не состоялось;
 * HOLIDAY_DONE — начавшееся или прошедшее в праздник.
 */
export const LESSON_STATE = Object.freeze({
  FUTURE: 'future',
  CANCELLED: 'cancelled',
  HOLIDAY: 'holiday',
  ONGOING: 'ongoing',
  PAST: 'past',
  NOT_HELD: 'notHeld',
  HOLIDAY_DONE: 'holidayDone',
});

const ALLOWED = Object.freeze({ ok: true });
const refuse = (reason) => ({ ok: false, reason });

const REASON_HOLIDAY = 'Праздник — пары нет';
const REASON_ONGOING = 'Пара уже идёт';
const REASON_PAST = 'Пара уже прошла';
const REASON_NOT_STARTED = 'Пара ещё не началась';

/**
 * Состояние занятия: фаза, праздник и отмена вместе.
 * Праздник важнее отмены: занятия в праздник нет, отменено оно или нет.
 * @param {Lesson} lesson
 * @param {Date} now
 * @param {string[]} holidays
 * @returns {string} одно из LESSON_STATE
 */
export function lessonState(lesson, now, holidays) {
  const phase = lessonPhase(lesson, now);
  const isFuture = phase === PHASE.FUTURE;
  if (isHoliday(lesson.date, holidays))
    return isFuture ? LESSON_STATE.HOLIDAY : LESSON_STATE.HOLIDAY_DONE;
  if (isFuture)
    return lesson.cancelled ? LESSON_STATE.CANCELLED : LESSON_STATE.FUTURE;
  if (lesson.cancelled) return LESSON_STATE.NOT_HELD;
  return phase === PHASE.ONGOING ? LESSON_STATE.ONGOING : LESSON_STATE.PAST;
}

/** Строка таблицы правил: одна операция во всех состояниях. */
const row = (cells) => Object.freeze(cells);

/**
 * Таблица правил: операция → состояние → true (можно) или текст, почему нельзя.
 * Для RESTORE и HELD «можно» ещё требует свободного слота — это проверяет can().
 */
const RULES = Object.freeze({
  [OPERATION.MOVE]: row({
    [LESSON_STATE.FUTURE]: true,
    [LESSON_STATE.CANCELLED]: 'Сначала верни пару',
    [LESSON_STATE.HOLIDAY]: true, // отработка: с праздника переносить можно
    [LESSON_STATE.ONGOING]: REASON_ONGOING,
    [LESSON_STATE.PAST]: REASON_PAST,
    [LESSON_STATE.NOT_HELD]: REASON_PAST,
    [LESSON_STATE.HOLIDAY_DONE]: REASON_HOLIDAY,
  }),
  [OPERATION.CANCEL]: row({
    [LESSON_STATE.FUTURE]: true,
    [LESSON_STATE.CANCELLED]: 'Пара уже отменена',
    [LESSON_STATE.HOLIDAY]: REASON_HOLIDAY,
    [LESSON_STATE.ONGOING]: REASON_ONGOING,
    [LESSON_STATE.PAST]: REASON_PAST,
    [LESSON_STATE.NOT_HELD]: REASON_PAST,
    [LESSON_STATE.HOLIDAY_DONE]: REASON_HOLIDAY,
  }),
  [OPERATION.RESTORE]: row({
    [LESSON_STATE.FUTURE]: 'Пара не отменена',
    [LESSON_STATE.CANCELLED]: true,
    [LESSON_STATE.HOLIDAY]: REASON_HOLIDAY,
    [LESSON_STATE.ONGOING]: REASON_ONGOING,
    [LESSON_STATE.PAST]: REASON_PAST,
    [LESSON_STATE.NOT_HELD]: REASON_PAST,
    [LESSON_STATE.HOLIDAY_DONE]: REASON_HOLIDAY,
  }),
  [OPERATION.NOT_HELD]: row({
    [LESSON_STATE.FUTURE]: REASON_NOT_STARTED,
    [LESSON_STATE.CANCELLED]: REASON_NOT_STARTED,
    [LESSON_STATE.HOLIDAY]: REASON_HOLIDAY,
    [LESSON_STATE.ONGOING]: true,
    [LESSON_STATE.PAST]: true,
    [LESSON_STATE.NOT_HELD]: 'Уже отмечено: не состоялась',
    [LESSON_STATE.HOLIDAY_DONE]: REASON_HOLIDAY,
  }),
  [OPERATION.HELD]: row({
    [LESSON_STATE.FUTURE]: REASON_NOT_STARTED,
    [LESSON_STATE.CANCELLED]: REASON_NOT_STARTED,
    [LESSON_STATE.HOLIDAY]: REASON_HOLIDAY,
    [LESSON_STATE.ONGOING]: 'Уже отмечено: состоялась',
    [LESSON_STATE.PAST]: 'Уже отмечено: состоялась',
    [LESSON_STATE.NOT_HELD]: true,
    [LESSON_STATE.HOLIDAY_DONE]: REASON_HOLIDAY,
  }),
  [OPERATION.EDIT]: row({
    [LESSON_STATE.FUTURE]: true,
    [LESSON_STATE.CANCELLED]: true,
    [LESSON_STATE.HOLIDAY]: true,
    [LESSON_STATE.ONGOING]: REASON_ONGOING,
    [LESSON_STATE.PAST]: REASON_PAST,
    [LESSON_STATE.NOT_HELD]: REASON_PAST,
    [LESSON_STATE.HOLIDAY_DONE]: REASON_HOLIDAY,
  }),
  [OPERATION.ROOM]: row({
    [LESSON_STATE.FUTURE]: true,
    [LESSON_STATE.CANCELLED]: true,
    [LESSON_STATE.HOLIDAY]: true,
    [LESSON_STATE.ONGOING]: true,
    [LESSON_STATE.PAST]: REASON_PAST,
    [LESSON_STATE.NOT_HELD]: REASON_PAST,
    [LESSON_STATE.HOLIDAY_DONE]: REASON_HOLIDAY,
  }),
  [OPERATION.DELETE]: row({
    [LESSON_STATE.FUTURE]: true,
    [LESSON_STATE.CANCELLED]: true,
    [LESSON_STATE.HOLIDAY]: true,
    [LESSON_STATE.ONGOING]: REASON_ONGOING,
    [LESSON_STATE.PAST]: REASON_PAST,
    [LESSON_STATE.NOT_HELD]: REASON_PAST,
    [LESSON_STATE.HOLIDAY_DONE]: REASON_HOLIDAY,
  }),
  [OPERATION.CALENDAR]: row({
    [LESSON_STATE.FUTURE]: true,
    [LESSON_STATE.CANCELLED]: 'Пара отменена',
    [LESSON_STATE.HOLIDAY]: REASON_HOLIDAY,
    [LESSON_STATE.ONGOING]: REASON_ONGOING,
    [LESSON_STATE.PAST]: REASON_PAST,
    [LESSON_STATE.NOT_HELD]: REASON_PAST,
    [LESSON_STATE.HOLIDAY_DONE]: REASON_HOLIDAY,
  }),
});

/** Операции, которые возвращают занятие в сетку: им нужен свободный слот. */
const NEEDS_FREE_SLOT = [OPERATION.RESTORE, OPERATION.HELD];

function rowOf(operation) {
  const operationRow = RULES[operation];
  if (!operationRow) throw new Error('Неизвестная операция: ' + operation);
  return operationRow;
}

/**
 * Применима ли операция в этом состоянии — только по таблице, без проверки слота.
 * Для показа кнопки: «Вернуть» видна и при занятом слоте, а почему нельзя — скажет can().
 * @param {string} operation       одно из OPERATION
 * @param {string} currentState    одно из LESSON_STATE, из lessonState()
 * @returns {boolean}
 */
export function isApplicable(operation, currentState) {
  return rowOf(operation)[currentState] === true;
}

/**
 * Можно ли сделать операцию с занятием прямо сейчас: таблица плюс свободный слот.
 * @param {Object} request
 * @param {string} request.operation  одно из OPERATION
 * @param {Lesson} request.lesson
 * @param {Date} request.now
 * @param {State} request.state
 * @param {string[]} request.holidays
 * @returns {{ok:true}|{ok:false, reason:string}}
 */
export function can({ operation, lesson, now, state, holidays }) {
  const verdict = rowOf(operation)[lessonState(lesson, now, holidays)];
  if (verdict !== true) return refuse(verdict);
  if (NEEDS_FREE_SLOT.includes(operation)) {
    const occupant = findOccupant({
      state,
      date: lesson.date,
      slot: lesson.slot,
      exceptLessonId: lesson.id,
      holidays,
    });
    if (occupant) return refuse(`Слот занят группой ${occupant.group}`);
  }
  return ALLOWED;
}

/**
 * Можно ли поставить занятие в клетку. Порядок проверок: праздник → прошлое → занято.
 * @param {Object} request
 * @param {string} request.kind       одно из PLACE_KIND
 * @param {string} request.date
 * @param {number} request.slot
 * @param {Date} request.now
 * @param {State} request.state
 * @param {string[]} request.holidays
 * @param {string} [request.exceptLessonId]  занятие, которое переносят: свой слот оно не занимает
 * @returns {{ok:true}|{ok:false, reason:string}}
 */
export function canPlace({
  kind,
  date,
  slot,
  now,
  state,
  holidays,
  exceptLessonId,
}) {
  if (!Object.values(PLACE_KIND).includes(kind))
    throw new Error('Неизвестный вид: ' + kind);
  if (isHoliday(date, holidays)) return refuse('Праздник — пар нет');
  // разовое занятие в начавшийся слот добавить можно: это запись факта (замена)
  if (isPastSlot(date, slot, now)) {
    if (kind === PLACE_KIND.MOVE)
      return refuse('Прошедшее время — сюда нельзя');
    if (kind === PLACE_KIND.ADD_RULE)
      return refuse('Повторяющуюся пару нельзя начать в прошлом');
  }
  const occupant = findOccupant({
    state,
    date,
    slot,
    exceptLessonId,
    holidays,
  });
  if (!occupant) return ALLOWED;
  if (kind === PLACE_KIND.MOVE)
    return refuse(`Слот занят группой ${occupant.group}`);
  return refuse(`В этом слоте уже группа ${occupant.group}`);
}
