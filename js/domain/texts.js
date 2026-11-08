/* Составные тексты интерфейса: шапка, неделя, карточка, подсказка, редактор, перенос, копия,
   часы, календарь. Чистые функции: текст не экранирован — это делает представление через esc().
   Тексты отказов («Пара уже идёт», «Слот занят группой N») живут рядом с таблицей правил,
   в rules.js: этот файл сам берёт из rules.js состояния занятия, и обратный импорт дал бы круг. */
import {
  WEEKDAYS,
  WEEKDAYS_SHORT,
  WEEKDAYS_TO,
  WEEKDAYS_IN,
  MONTHS_GENITIVE,
  MONTHS_SHORT,
  plural,
} from '../lang/ru.js';
import {
  SLOTS,
  HOURS_PER_PAIR,
  WORKDAYS_PER_WEEK,
} from '../config/university.js';
import { UPCOMING_WEEKS } from '../config/interface.js';
import {
  addDays,
  fromIso,
  humanDate,
  toIso,
  weekday,
  MINUTES_PER_HOUR,
  MS_PER_MINUTE,
} from './dates.js';
import { LESSON_KIND, SOURCE } from './lessons.js';
import { LESSON_STATE } from './rules.js';
import { SCOPE } from './changes.js';

/** Начало пары с этим номером: «08:00». */
export const formatSlotStart = (slot) => SLOTS[slot - 1].start;
const slotStart = formatSlotStart;
const slotEnd = (slot) => SLOTS[slot - 1].end;
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** «1 пара», «3 пары», «5 пар». */
export const formatLessonCount = (count) =>
  `${count} ${plural(count, 'пара', 'пары', 'пар')}`;

/* ---------- шапка ---------- */

/** Шапка, когда впереди пар нет: «В ближайшие 4 недели пар нет». */
export const formatNoUpcoming = () =>
  `В ближайшие ${UPCOMING_WEEKS} ${plural(UPCOMING_WEEKS, 'неделю', 'недели', 'недель')} пар нет`;

/** Подпись над временем: идёт — «Сейчас», иначе «Следующая пара». */
export const formatHeroLabel = (isGoing) =>
  isGoing ? 'Сейчас' : 'Следующая пара';

/** «через 1 ч 10 мин» или «через 40 мин». */
function formatTimeLeft(minutesLeft) {
  if (minutesLeft < MINUTES_PER_HOUR) return `через ${minutesLeft} мин`;
  const hours = Math.floor(minutesLeft / MINUTES_PER_HOUR);
  return `через ${hours} ч ${minutesLeft % MINUTES_PER_HOUR} мин`;
}

/**
 * Когда следующее занятие: «идёт сейчас, до 17:00», «сегодня, через 1 ч 10 мин»,
 * «завтра, 5 ноября», «в субботу, 7 ноября». Плюс аудитория, если указана.
 * @param {Lesson & {start: Date}} lesson  из nextLesson()
 * @param {Date} now
 * @returns {string}
 */
export function formatHeroDetails(lesson, now) {
  const room = lesson.room ? `, ауд. ${lesson.room}` : '';
  if (lesson.start <= now)
    return `идёт сейчас, до ${slotEnd(lesson.slot)}${room}`;
  const today = toIso(now);
  if (lesson.date === today) {
    const minutesLeft = Math.round((lesson.start - now) / MS_PER_MINUTE);
    return `сегодня, ${formatTimeLeft(minutesLeft)}${room}`;
  }
  const date = humanDate(lesson.date);
  if (lesson.date === addDays(today, 1)) return `завтра, ${date}${room}`;
  return `${WEEKDAYS_IN[weekday(lesson.date)]}, ${date}${room}`;
}

/* ---------- неделя ---------- */

/** «2–7 ноября» или «26 окт – 1 ноя», если неделя на стыке месяцев. */
export function formatWeekRange(weekStartDate) {
  const first = fromIso(weekStartDate);
  const last = fromIso(addDays(weekStartDate, WORKDAYS_PER_WEEK - 1));
  if (first.getMonth() === last.getMonth())
    return `${first.getDate()}–${last.getDate()} ${MONTHS_GENITIVE[first.getMonth()]}`;
  return `${first.getDate()} ${MONTHS_SHORT[first.getMonth()]} – ${last.getDate()} ${MONTHS_SHORT[last.getMonth()]}`;
}

/** «3 пары · 6 ак. ч». */
export const formatWeekSummary = (count) =>
  `${formatLessonCount(count)} · ${count * HOURS_PER_PAIR} ак. ч`;

/**
 * Подпись карточки для экранного диктора: «Группа 323, ПК первого ин. яз., отменена, идёт сейчас».
 * @param {Lesson} lesson
 * @param {{isHoliday: boolean, isLive: boolean}} marks
 */
export function formatCardLabel(lesson, { isHoliday, isLive }) {
  const parts = [`Группа ${lesson.group}`, lesson.subject];
  if (isHoliday) parts.push('праздник');
  else if (lesson.cancelled) parts.push('отменена');
  if (lesson.moved) parts.push('перенесена');
  if (isLive) parts.push('идёт сейчас');
  return parts.join(', ');
}

/* ---------- подсказка ---------- */

/** «Группа 323»: заголовок подсказки и редактора. */
export const formatGroupTitle = (group) => `Группа ${group}`;

/** «Среда, 28 октября». */
export const formatLongDate = (date) =>
  `${capitalize(WEEKDAYS[weekday(date)])}, ${humanDate(date)}`;

/** «15:40–17:00». */
export const formatTimeRange = (slot) => `${slotStart(slot)}–${slotEnd(slot)}`;

/** «3 курс · ЛР». */
export const formatCourseAndType = (lesson) =>
  `${lesson.course} курс · ${lesson.lessonType}`;

/** «Перенесена, обычно — вт, 27 октября, 08:00»: день, дата и время по правилу. */
export function formatMovedFrom(lesson, rule) {
  const day = WEEKDAYS_SHORT[weekday(lesson.ruleDate)].toLowerCase();
  return `Перенесена, обычно — ${day}, ${humanDate(lesson.ruleDate)}, ${slotStart(rule.slot)}`;
}

/**
 * Строка-флаг под предметом по состоянию занятия; null — флага нет.
 * @param {string} state  одно из LESSON_STATE
 * @param {Lesson} lesson
 * @returns {{text: string, isLive: boolean}|null}
 */
export function formatLessonFlag(state, lesson) {
  switch (state) {
    case LESSON_STATE.HOLIDAY:
    case LESSON_STATE.HOLIDAY_DONE:
      return { text: 'Праздник — пары нет', isLive: false };
    case LESSON_STATE.CANCELLED:
      return { text: 'Отменена', isLive: false };
    case LESSON_STATE.NOT_HELD:
      return { text: 'Не состоялась', isLive: false };
    case LESSON_STATE.ONGOING:
      return { text: `Идёт, до ${slotEnd(lesson.slot)}`, isLive: true };
    default:
      return null;
  }
}

/** «Аудитория 301» или «Аудитория не указана». */
export const formatRoomLabel = (room) =>
  room ? `Аудитория ${room}` : 'Аудитория не указана';

/** Тост после правки аудитории: «Аудитория 301: с 28 октября и дальше», «Аудитория убрана». */
export function formatRoomSaved(room, lesson, scope) {
  if (!room) return 'Аудитория убрана';
  if (scope === SCOPE.FUTURE)
    return `Аудитория ${room}: с ${humanDate(lesson.ruleDate)} и дальше`;
  return `Аудитория ${room}`;
}

/** «Отменена: 28 октября». */
export const formatCancelledToast = (lesson) =>
  `Отменена: ${humanDate(lesson.ruleDate)}`;

/** «Отмечено: не состоялась, 28 октября». */
export const formatNotHeldToast = (lesson) =>
  `Отмечено: не состоялась, ${humanDate(lesson.date)}`;

/* ---------- редактор ---------- */

/**
 * Пояснение под заголовком редактора: откуда пара и где она обычно стоит.
 * @param {Lesson|null} lesson  null — новая пара
 * @param {Rule|null} rule
 */
export function formatEditorInfo(lesson, rule) {
  if (!lesson) return '';
  if (!rule) return 'Разовая пара.';
  const origin =
    rule.source === SOURCE.PDF ? 'Из PDF факультета.' : 'Добавлена вручную.';
  const usual = lesson.moved
    ? ` На этой неделе перенесена, обычно ${WEEKDAYS[rule.weekday]}, ${slotStart(rule.slot)}.`
    : '';
  return `Повторяется каждую неделю. ${origin}${usual}`;
}

/** Пункт списка «Пара»: «4-я, 12:40». */
export const formatSlotOption = (slot) => `${slot}-я, ${slotStart(slot)}`;

/** Пояснение к переключателю «Отменена». */
export function formatCancelSwitchNote(lesson) {
  const onlyDate =
    lesson.type === LESSON_KIND.RULE
      ? `Только ${humanDate(lesson.ruleDate)}. `
      : '';
  return `${onlyDate}Пара останется в сетке размытой.`;
}

/** «4 ноября — праздник, пар нет». */
export const formatHolidayDate = (date) =>
  `${humanDate(date)} — праздник, пар нет`;

/** «Добавлено: в пятницу, 14:10, каждую неделю» или «Добавлено: 30 октября, 09:30». */
export function formatAddedToast({ date, slot, isWeekly }) {
  if (isWeekly)
    return `Добавлено: ${WEEKDAYS_IN[weekday(date)]}, ${slotStart(slot)}, каждую неделю`;
  return `Добавлено: ${humanDate(date)}, ${slotStart(slot)}`;
}

/** Вопрос перед удалением повторяющейся: «Удалить группу 323?». */
export const formatDeleteQuestion = (lesson) =>
  `Удалить группу ${lesson.group}?`;

/** Пояснение перед удалением разовой: «Группа 555, пятница, 30 октября, 09:30. Разовая — вернуть не получится.» */
export const formatDeleteOneOffNote = (lesson) =>
  `Группа ${lesson.group}, ${WEEKDAYS[weekday(lesson.date)]}, ${humanDate(lesson.date)}, ${slotStart(lesson.slot)}. Разовая — вернуть не получится.`;

/* ---------- перенос и «эта дата / дальше» ---------- */

const formatWhereTo = (date, slot) =>
  `${WEEKDAYS_TO[weekday(date)]}, ${slotStart(slot)}`;

/** Подсказка, пока палец над свободной клеткой. */
export const formatDropHint = (date, slot) =>
  `Отпусти, чтобы перенести ${formatWhereTo(date, slot)}`;

/** Вопрос после отпускания: «Перенести на четверг, 12:40?». */
export const formatMoveQuestion = (date, slot) =>
  `Перенести ${formatWhereTo(date, slot)}?`;

/** Пояснение к вопросу о переносе: «Группа 326, обычно суббота, 08:00». */
export function formatMoveNote(lesson, rule) {
  if (!rule) return `Группа ${lesson.group}`;
  return `Группа ${lesson.group}, обычно ${WEEKDAYS[rule.weekday]}, ${slotStart(rule.slot)}`;
}

/** «Перенесено: Чт 29 октября, 12:40». */
export const formatMovedToast = (date, slot) =>
  `Перенесено: ${WEEKDAYS_SHORT[weekday(date)]} ${humanDate(date)}, ${slotStart(slot)}`;

/** Вариант «только эта дата». */
export const formatThisDateOption = (ruleDate) =>
  `Только ${humanDate(ruleDate)}`;

/** Вариант «эта и все следующие». */
export const formatFromDateOption = (ruleDate) =>
  `${humanDate(ruleDate)} и все следующие недели`;

/* ---------- резервная копия ---------- */

/** «В копии на этой неделе — 6 пар» или «В копии на этой неделе пар нет». */
export function formatCopySummary(count) {
  if (!count) return 'В копии на этой неделе пар нет';
  return `В копии на этой неделе — ${formatLessonCount(count)}`;
}

/** Пояснение в вопросе «Заменить расписание?». */
export const formatReplaceNote = (count) =>
  `${formatCopySummary(count)}. Текущее расписание и все правки пропадут. Сначала можно скачать резервную копию.`;

/* ---------- часы ---------- */

/** «6 ч»: часы за столько-то пар. */
export const formatHours = (count) => `${count * HOURS_PER_PAIR} ч`;

/** «1 сентября – 31 декабря 2026 · 1 пара = 2 ак. ч». */
export const formatSemesterNote = ({ from, to }) =>
  `${humanDate(from)} – ${humanDate(to)} ${fromIso(to).getFullYear()} · 1 пара = ${HOURS_PER_PAIR} ак. ч`;

/* ---------- Google Календарь ---------- */

/** Название события: «Гр. 323, ПК первого ин. яз.». */
export const formatCalendarTitle = (lesson) =>
  `Гр. ${lesson.group}, ${lesson.subject}`;

/** Описание события: «3 курс, 6-я пара». */
export const formatCalendarDetails = (lesson) =>
  `${lesson.course} курс, ${lesson.slot}-я пара`;

/** Место события: «ауд. 301». */
export const formatCalendarLocation = (room) => `ауд. ${room}`;
