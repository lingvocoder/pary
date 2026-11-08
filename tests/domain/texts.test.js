// Тесты составных текстов: js/domain/texts.js. Запуск: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatLessonCount,
  formatNoUpcoming,
  formatHeroLabel,
  formatHeroDetails,
  formatWeekRange,
  formatWeekSummary,
  formatCardLabel,
  formatLongDate,
  formatGroupTitle,
  formatTimeRange,
  formatCourseAndType,
  formatMovedFrom,
  formatLessonFlag,
  formatRoomLabel,
  formatRoomSaved,
  formatCancelledToast,
  formatNotHeldToast,
  formatEditorInfo,
  formatSlotOption,
  formatCancelSwitchNote,
  formatHolidayDate,
  formatAddedToast,
  formatDeleteQuestion,
  formatDeleteOneOffNote,
  formatDropHint,
  formatMoveQuestion,
  formatMoveNote,
  formatMovedToast,
  formatThisDateOption,
  formatFromDateOption,
  formatCopySummary,
  formatReplaceNote,
  formatHours,
  formatSemesterNote,
  formatCalendarTitle,
  formatVersionLine,
  formatCalendarDetails,
  formatCalendarLocation,
} from '../../js/domain/texts.js';
import { LESSON_STATE } from '../../js/domain/rules.js';
import { SCOPE } from '../../js/domain/changes.js';
import { slotTimes } from '../../js/domain/lessons.js';
import { seed } from '../../js/domain/seed.js';
import { PAIR } from './fixtures.js';

const rule323 = seed().rules.find((rule) => rule.id === 'seed-323-we-6');
const withTimes = (lesson) => ({
  ...lesson,
  ...slotTimes(lesson.date, lesson.slot),
});

test('шапка: идёт, через минуты, через часы, завтра, другой день, аудитория', () => {
  const lesson = withTimes(PAIR); // среда 28.10, 15:40–17:00
  assert.equal(
    formatHeroDetails(lesson, new Date('2026-10-28T16:00:00')),
    'идёт сейчас, до 17:00',
  );
  assert.equal(
    formatHeroDetails(lesson, new Date('2026-10-28T15:00:00')),
    'сегодня, через 40 мин',
  );
  assert.equal(
    formatHeroDetails(lesson, new Date('2026-10-28T14:30:00')),
    'сегодня, через 1 ч 10 мин',
  );
  assert.equal(
    formatHeroDetails(lesson, new Date('2026-10-27T12:00:00')),
    'завтра, 28 октября',
  );
  assert.equal(
    formatHeroDetails(lesson, new Date('2026-10-26T12:00:00')),
    'в среду, 28 октября',
  );
  assert.equal(
    formatHeroDetails(
      { ...lesson, room: '301' },
      new Date('2026-10-27T12:00:00'),
    ),
    'завтра, 28 октября, ауд. 301',
  );
  assert.equal(formatHeroLabel(true), 'Сейчас');
  assert.equal(formatHeroLabel(false), 'Следующая пара');
  assert.equal(formatNoUpcoming(), 'В ближайшие 4 недели пар нет');
});

test('неделя: диапазон в одном месяце и на стыке, итог с часами', () => {
  assert.equal(formatWeekRange('2026-11-02'), '2–7 ноября');
  assert.equal(formatWeekRange('2026-10-26'), '26–31 октября');
  assert.equal(formatWeekRange('2026-11-30'), '30 ноя – 5 дек');
  assert.equal(formatWeekSummary(3), '3 пары · 6 ак. ч');
  assert.equal(formatLessonCount(21), '21 пара');
});

test('карточка: подпись для диктора — праздник важнее отмены', () => {
  assert.equal(
    formatCardLabel(PAIR, { isHoliday: false, isLive: true }),
    'Группа 323, ПК первого ин. яз., идёт сейчас',
  );
  assert.equal(
    formatCardLabel(
      { ...PAIR, cancelled: true, moved: true },
      { isHoliday: false, isLive: false },
    ),
    'Группа 323, ПК первого ин. яз., отменена, перенесена',
  );
  assert.equal(
    formatCardLabel(
      { ...PAIR, cancelled: true },
      { isHoliday: true, isLive: false },
    ),
    'Группа 323, ПК первого ин. яз., праздник',
  );
});

test('подсказка: дата, время, курс, перенос, флаги, аудитория, тосты', () => {
  assert.equal(formatLongDate('2026-10-28'), 'Среда, 28 октября');
  assert.equal(formatGroupTitle('323'), 'Группа 323');
  assert.equal(formatTimeRange(6), '15:40–17:00');
  assert.equal(formatCourseAndType(PAIR), '3 курс · ЛР');
  assert.equal(
    formatMovedFrom({ ...PAIR, date: '2026-10-29', moved: true }, rule323),
    'Перенесена, обычно — ср, 28 октября, 15:40',
  );
  assert.deepEqual(formatLessonFlag(LESSON_STATE.ONGOING, PAIR), {
    text: 'Идёт, до 17:00',
    isLive: true,
  });
  assert.equal(formatLessonFlag(LESSON_STATE.CANCELLED, PAIR).text, 'Отменена');
  assert.equal(
    formatLessonFlag(LESSON_STATE.NOT_HELD, PAIR).text,
    'Не состоялась',
  );
  assert.equal(
    formatLessonFlag(LESSON_STATE.HOLIDAY_DONE, PAIR).text,
    'Праздник — пары нет',
  );
  assert.equal(formatLessonFlag(LESSON_STATE.FUTURE, PAIR), null);
  assert.equal(formatLessonFlag(LESSON_STATE.PAST, PAIR), null);
  assert.equal(formatRoomLabel(''), 'Аудитория не указана');
  assert.equal(formatRoomLabel('301'), 'Аудитория 301');
  assert.equal(
    formatRoomSaved('301', PAIR, SCOPE.FUTURE),
    'Аудитория 301: с 28 октября и дальше',
  );
  assert.equal(formatRoomSaved('301', PAIR, SCOPE.THIS_DATE), 'Аудитория 301');
  assert.equal(formatRoomSaved('', PAIR, SCOPE.FUTURE), 'Аудитория убрана');
  assert.equal(formatCancelledToast(PAIR), 'Отменена: 28 октября');
  assert.equal(formatNotHeldToast(PAIR), 'Отмечено: не состоялась, 28 октября');
});

test('редактор: пояснение, пункт пары, отмена, праздник, добавлено, удаление', () => {
  assert.equal(formatEditorInfo(null, null), '');
  assert.equal(formatEditorInfo(PAIR, null), 'Разовая пара.');
  assert.equal(
    formatEditorInfo(PAIR, rule323),
    'Повторяется каждую неделю. Из PDF факультета.',
  );
  assert.equal(
    formatEditorInfo(
      { ...PAIR, moved: true },
      { ...rule323, source: 'manual' },
    ),
    'Повторяется каждую неделю. Добавлена вручную. На этой неделе перенесена, обычно среда, 15:40.',
  );
  assert.equal(formatSlotOption(4), '4-я, 12:40');
  assert.equal(
    formatCancelSwitchNote(PAIR),
    'Только 28 октября. Пара останется в сетке размытой.',
  );
  assert.equal(
    formatCancelSwitchNote({ ...PAIR, type: 'oneOff' }),
    'Пара останется в сетке размытой.',
  );
  assert.equal(formatHolidayDate('2026-11-04'), '4 ноября — праздник, пар нет');
  assert.equal(
    formatAddedToast({ date: '2026-10-30', slot: 5, isWeekly: true }),
    'Добавлено: в пятницу, 14:10, каждую неделю',
  );
  assert.equal(
    formatAddedToast({ date: '2026-10-30', slot: 2, isWeekly: false }),
    'Добавлено: 30 октября, 09:30',
  );
  assert.equal(formatDeleteQuestion(PAIR), 'Удалить группу 323?');
  assert.equal(
    formatDeleteOneOffNote({
      ...PAIR,
      group: '555',
      date: '2026-10-30',
      slot: 2,
    }),
    'Группа 555, пятница, 30 октября, 09:30. Разовая — вернуть не получится.',
  );
});

test('перенос и «эта дата / дальше»', () => {
  assert.equal(
    formatDropHint('2026-10-29', 4),
    'Отпусти, чтобы перенести на четверг, 12:40',
  );
  assert.equal(
    formatMoveQuestion('2026-10-29', 4),
    'Перенести на четверг, 12:40?',
  );
  assert.equal(
    formatMoveNote(PAIR, rule323),
    'Группа 323, обычно среда, 15:40',
  );
  assert.equal(formatMoveNote(PAIR, null), 'Группа 323');
  assert.equal(
    formatMovedToast('2026-10-29', 4),
    'Перенесено: Чт 29 октября, 12:40',
  );
  assert.equal(formatThisDateOption('2026-10-28'), 'Только 28 октября');
  assert.equal(
    formatFromDateOption('2026-10-28'),
    '28 октября и все следующие недели',
  );
});

test('копия: сколько пар на этой неделе — склонение на 0, 1, 2, 5, 21', () => {
  assert.equal(formatCopySummary(0), 'В копии на этой неделе пар нет');
  assert.equal(formatCopySummary(1), 'В копии на этой неделе — 1 пара');
  assert.equal(formatCopySummary(2), 'В копии на этой неделе — 2 пары');
  assert.equal(formatCopySummary(5), 'В копии на этой неделе — 5 пар');
  assert.equal(formatCopySummary(21), 'В копии на этой неделе — 21 пара');
  assert.equal(
    formatReplaceNote(6),
    'В копии на этой неделе — 6 пар. Текущее расписание и все правки пропадут. Сначала можно скачать резервную копию.',
  );
});

test('часы и календарь', () => {
  assert.equal(formatHours(3), '6 ч');
  assert.equal(
    formatSemesterNote({ from: '2026-09-01', to: '2026-12-31' }),
    '1 сентября – 31 декабря 2026 · 1 пара = 2 ак. ч',
  );
  assert.equal(formatCalendarTitle(PAIR), 'Гр. 323, ПК первого ин. яз.');
  assert.equal(formatCalendarDetails(PAIR), '3 курс, 6-я пара');
  assert.equal(formatCalendarLocation('301'), 'ауд. 301');
});

test('меню: строка версии и предупреждение о хранилище', () => {
  assert.equal(formatVersionLine('0.5.0', true), 'Версия 0.5.0');
  assert.equal(
    formatVersionLine('0.5.0', false),
    'Версия 0.5.0. Сохранение недоступно в этом режиме браузера',
  );
});
