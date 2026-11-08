/* Изменения данных: reduce() — единственная точка, через которую меняется состояние.
   Остальные функции файла меняют переданную им копию состояния; снаружи их вызывает только reduce(). */
import { DEFAULT_LESSON_TYPE } from '../config/university.js';
import { addDays, weekday } from './dates.js';
import {
  ruleExceptionKey,
  splitRuleExceptionKey,
  findOccupant,
  findRule,
  LESSON_KIND,
  SOURCE,
} from './lessons.js';
import { seed } from './seed.js';
import { migrate } from './migrate.js';

/** Типы действий. Действие — простой объект: в v2 действия станут очередью синхронизации. */
export const ACTION = Object.freeze({
  ADD: 'add',
  EDIT: 'edit',
  DELETE: 'delete',
  SET_CANCELLED: 'setCancelled',
  RESET: 'reset',
  LOAD: 'load',
});

/** Что меняет правка повторяющегося занятия: только эту дату или эту и все следующие. */
export const SCOPE = Object.freeze({ THIS_DATE: 'one', FUTURE: 'future' });

/**
 * Аудитория повторяющегося занятия меняется с этой даты и дальше: аудитория обычно
 * закреплена за группой. У разовой — только эта дата.
 * @param {Lesson} lesson
 * @returns {string} одно из SCOPE
 */
export const roomChangeScope = (lesson) =>
  lesson.type === LESSON_KIND.RULE ? SCOPE.FUTURE : SCOPE.THIS_DATE;

/** Поля занятия, которые меняет правка (дата и пара — отдельно, это перенос). */
const EDITABLE_FIELDS = [
  'group',
  'course',
  'subject',
  'lessonType',
  'color',
  'room',
];

const findOneOff = (state, id) =>
  state.oneOffs.find((oneOff) => oneOff.id === id);
const isExceptionOfRule = (key, ruleId) =>
  splitRuleExceptionKey(key)[0] === ruleId;

/** Убирает из правки пустые поля, а пустую правку — целиком. */
function dropEmptyRuleException(state, key) {
  const ruleException = state.exceptions[key];
  if (!ruleException) return;
  if (ruleException.patch && !Object.keys(ruleException.patch).length)
    delete ruleException.patch;
  if (!ruleException.cancelled) delete ruleException.cancelled;
  if (!ruleException.deleted) delete ruleException.deleted;
  if (!Object.keys(ruleException).length) delete state.exceptions[key];
}

/** Только эта дата: правка пишется в исключение правила. */
function editThisDate(state, rule, lesson, changes) {
  const key = ruleExceptionKey(rule.id, lesson.ruleDate);
  const ruleException = state.exceptions[key] || (state.exceptions[key] = {});
  const patch = { ...(ruleException.patch || {}) };
  for (const field of EDITABLE_FIELDS) {
    if (!(field in changes)) continue;
    // совпало с правилом — правка этого поля больше не нужна
    if (changes[field] === rule[field]) delete patch[field];
    else patch[field] = changes[field];
  }
  ruleException.patch = patch;
  if ('date' in changes || 'slot' in changes) {
    const newDate = changes.date ?? lesson.date;
    const newSlot = changes.slot ?? lesson.slot;
    const isBackHome = newDate === lesson.ruleDate && newSlot === rule.slot;
    if (isBackHome) delete ruleException.moveTo;
    else ruleException.moveTo = { date: newDate, slot: newSlot };
  }
  dropEmptyRuleException(state, key);
}

/** Правило начинается с этой даты — меняем его целиком, без деления. */
function rewriteRule(state, rule, lesson, { fields, newDate, newSlot }) {
  const key = ruleExceptionKey(rule.id, lesson.ruleDate);
  const wasCancelled = state.exceptions[key] && state.exceptions[key].cancelled;
  delete state.exceptions[key];
  const newWeekday = weekday(newDate);
  // день недели сменился — правки старых дат больше ни к чему не относятся
  if (newWeekday !== rule.weekday)
    for (const otherKey of Object.keys(state.exceptions))
      if (isExceptionOfRule(otherKey, rule.id))
        delete state.exceptions[otherKey];
  Object.assign(rule, fields, {
    weekday: newWeekday,
    slot: newSlot,
    from: newDate,
  });
  if (wasCancelled)
    state.exceptions[ruleExceptionKey(rule.id, newDate)] = { cancelled: true };
}

/** Правило делится: старое заканчивается накануне, новое начинается с этой даты. */
function splitRule(state, rule, lesson, { fields, newDate, newSlot }) {
  const newWeekday = weekday(newDate);
  const newRule = {
    ...rule,
    ...fields,
    id: crypto.randomUUID(),
    weekday: newWeekday,
    slot: newSlot,
    from: newDate,
    until: rule.until,
    source: SOURCE.MANUAL,
  };
  for (const key of Object.keys(state.exceptions)) {
    const [ruleId, ruleDate] = splitRuleExceptionKey(key);
    if (ruleId !== rule.id || ruleDate < lesson.ruleDate) continue;
    // будущие правки переезжают к новому правилу, если день недели тот же
    if (newWeekday === rule.weekday && ruleDate !== lesson.ruleDate)
      state.exceptions[ruleExceptionKey(newRule.id, ruleDate)] =
        state.exceptions[key];
    delete state.exceptions[key];
  }
  rule.until = addDays(lesson.ruleDate, -1);
  state.rules.push(newRule);
}

/** Эта и все следующие недели: правило меняется целиком или делится на «до» и «после». */
function editFromThisDate(state, rule, lesson, changes) {
  const fields = {};
  for (const field of EDITABLE_FIELDS)
    if (field in changes) fields[field] = changes[field];
  const change = {
    fields,
    newDate: changes.date ?? lesson.ruleDate,
    newSlot: changes.slot ?? rule.slot,
  };
  if (rule.from >= lesson.ruleDate) rewriteRule(state, rule, lesson, change);
  else splitRule(state, rule, lesson, change);
}

function editLesson(state, lesson, changes, scope) {
  if (lesson.type === LESSON_KIND.ONE_OFF) {
    Object.assign(findOneOff(state, lesson.id), changes);
    return;
  }
  const rule = findRule(state, lesson.ruleId);
  if (scope === SCOPE.THIS_DATE) editThisDate(state, rule, lesson, changes);
  else editFromThisDate(state, rule, lesson, changes);
}

function deleteLesson(state, lesson, scope) {
  if (lesson.type === LESSON_KIND.ONE_OFF) {
    state.oneOffs = state.oneOffs.filter((oneOff) => oneOff.id !== lesson.id);
    return;
  }
  const rule = findRule(state, lesson.ruleId);
  if (scope === SCOPE.THIS_DATE) {
    (state.exceptions[ruleExceptionKey(rule.id, lesson.ruleDate)] ||=
      {}).deleted = true;
    return;
  }
  if (rule.from >= lesson.ruleDate) {
    // правило начинается с этой даты — удаляется целиком
    state.rules = state.rules.filter((candidate) => candidate !== rule);
    for (const key of Object.keys(state.exceptions))
      if (isExceptionOfRule(key, rule.id)) delete state.exceptions[key];
    return;
  }
  rule.until = addDays(lesson.ruleDate, -1);
  for (const key of Object.keys(state.exceptions)) {
    const [ruleId, ruleDate] = splitRuleExceptionKey(key);
    if (ruleId === rule.id && ruleDate >= lesson.ruleDate)
      delete state.exceptions[key];
  }
}

function setCancelled(state, lesson, isCancelled) {
  // вернуть в занятый слот нельзя: двух занятий в одной клетке не бывает
  const isSlotTaken = () =>
    findOccupant({
      state,
      date: lesson.date,
      slot: lesson.slot,
      exceptLessonId: lesson.id,
    }) !== null;
  if (!isCancelled && isSlotTaken()) return;
  if (lesson.type === LESSON_KIND.ONE_OFF) {
    findOneOff(state, lesson.id).cancelled = isCancelled;
    return;
  }
  const key = ruleExceptionKey(lesson.ruleId, lesson.ruleDate);
  (state.exceptions[key] ||= {}).cancelled = isCancelled;
  dropEmptyRuleException(state, key);
}

/**
 * Новое занятие: повторяющееся — правило, иначе разовая пара.
 * @param {State} state
 * @param {{group:string, course:number, subject:string, color:string, room:string,
 *   date:string, slot:number, isWeekly:boolean}} newLesson
 */
function addLesson(state, newLesson) {
  const common = {
    group: newLesson.group,
    course: newLesson.course,
    subject: newLesson.subject,
    lessonType: DEFAULT_LESSON_TYPE,
    color: newLesson.color,
    room: newLesson.room || '',
    teacher: '',
  };
  if (newLesson.isWeekly)
    state.rules.push({
      id: crypto.randomUUID(),
      ...common,
      weekday: weekday(newLesson.date),
      slot: newLesson.slot,
      from: newLesson.date,
      until: null,
      source: SOURCE.MANUAL,
      importKey: null,
    });
  else
    state.oneOffs.push({
      id: crypto.randomUUID(),
      ...common,
      date: newLesson.date,
      slot: newLesson.slot,
      cancelled: false,
      source: SOURCE.MANUAL,
    });
}

/**
 * Единственная точка изменения данных. Возвращает НОВОЕ состояние, старое не трогает.
 * @param {State} state
 * @param {{type:string}} action  одно из ACTION и его поля
 * @returns {State}
 */
export function reduce(state, action) {
  const nextState = structuredClone(state);
  switch (action.type) {
    case ACTION.ADD:
      addLesson(nextState, action.newLesson);
      break;
    case ACTION.EDIT:
      editLesson(nextState, action.lesson, action.changes, action.scope);
      break;
    case ACTION.DELETE:
      deleteLesson(nextState, action.lesson, action.scope);
      break;
    case ACTION.SET_CANCELLED:
      setCancelled(nextState, action.lesson, action.isCancelled);
      break;
    case ACTION.RESET:
      return seed();
    case ACTION.LOAD:
      return migrate(action.backup);
    default:
      throw new Error('Неизвестное действие: ' + action.type);
  }
  return nextState;
}
