/* Решения для формы редактора: черновик новой пары, проверка полей, что изменилось,
   какие предметы предложить и на какую дату ставить новую пару по умолчанию. */
import {
  DEFAULT_COURSE,
  SUBJECTS,
  WORKDAYS_PER_WEEK,
} from '../config/university.js';
import { LOCALE } from '../lang/ru.js';
import { addDays, weekday, SUNDAY } from './dates.js';

/** Поле формы, которое нужно подсветить фокусом, когда проверка не прошла. */
export const FORM_FIELD = Object.freeze({
  GROUP: 'group',
  SUBJECT: 'subject',
  DATE: 'date',
});

/** Поля, которые редактор сравнивает со старым занятием (дата и пара — отдельно). */
const COMPARED_FIELDS = ['group', 'course', 'subject', 'room', 'color'];

/**
 * Что стоит в полях пустого редактора.
 * @param {{date: string, slot: number}} place  клетка, по которой тапнули
 */
export const newLessonDraft = ({ date, slot }) => ({
  group: '',
  course: DEFAULT_COURSE,
  subject: SUBJECTS[0],
  room: '',
  color: '',
  date,
  slot,
  cancelled: false,
});

/**
 * Проверка заполненной формы — по порядку полей, первая же ошибка.
 * @param {{group: string, subject: string, date: string}} form
 * @returns {{ok: true}|{ok: false, reason: string, field: string}}  field — одно из FORM_FIELD
 */
export function validateLessonForm(form) {
  if (!form.group)
    return { ok: false, reason: 'Укажи номер группы', field: FORM_FIELD.GROUP };
  if (!form.subject)
    return { ok: false, reason: 'Укажи предмет', field: FORM_FIELD.SUBJECT };
  if (!form.date)
    return { ok: false, reason: 'Выбери дату', field: FORM_FIELD.DATE };
  if (weekday(form.date) === SUNDAY)
    return {
      ok: false,
      reason: 'В воскресенье пар нет, выбери другой день',
      field: FORM_FIELD.DATE,
    };
  return { ok: true };
}

/**
 * Что изменилось в форме по сравнению с занятием: только отличающиеся поля.
 * @param {Lesson} lesson
 * @param {Object} form
 * @returns {Object} изменения для действия ACTION.EDIT
 */
export function diffLessonChanges(lesson, form) {
  const changes = {};
  for (const field of COMPARED_FIELDS)
    if (String(form[field]) !== String(lesson[field] ?? ''))
      changes[field] = form[field];
  if (form.date !== lesson.date) changes.date = form.date;
  if (form.slot !== lesson.slot) changes.slot = form.slot;
  return changes;
}

/**
 * Дата новой пары с пустой недели: сегодня, если сегодня на этой неделе, иначе понедельник.
 * @param {string} weekStartDate
 * @param {string} today
 */
export function defaultNewLessonDate(weekStartDate, today) {
  const weekEndDate = addDays(weekStartDate, WORKDAYS_PER_WEEK - 1);
  const isTodayInWeek = today >= weekStartDate && today <= weekEndDate;
  return isTodayInWeek ? today : weekStartDate;
}

/**
 * Предметы для списка в редакторе: сначала baseSubjects (из настроек) в их порядке,
 * затем предметы из правил и разовых пар — без повторов, по алфавиту.
 * @param {State} state
 * @param {string[]} baseSubjects
 * @returns {string[]}
 */
export function knownSubjects(state, baseSubjects) {
  const seen = new Set(baseSubjects);
  const extra = [...state.rules, ...state.oneOffs]
    .map((lessonSource) => (lessonSource.subject || '').trim())
    .filter((subject) => subject && !seen.has(subject));
  const sorted = [...new Set(extra)].sort((first, second) =>
    first.localeCompare(second, LOCALE),
  );
  return [...baseSubjects, ...sorted];
}
