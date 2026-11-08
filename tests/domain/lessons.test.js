// Тесты занятий недели: js/domain/lessons.js. Запуск: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nextLesson,
  isOngoing,
  isPastSlot,
  findOccupant,
  lessonPhase,
  isHoliday,
} from '../../js/domain/lessons.js';
import { ACTION, reduce } from '../../js/domain/changes.js';
import { seed } from '../../js/domain/seed.js';
import { WEEK, lessonAt, PAIR, AFTER } from './fixtures.js';

test('занятый слот: отменённая пара место не занимает', () => {
  let state = seed();
  assert.equal(
    findOccupant({ state, date: '2026-10-28', slot: 6 }).group,
    '323',
  );
  state = reduce(state, {
    type: ACTION.SET_CANCELLED,
    lesson: lessonAt(state, WEEK, '2026-10-28', 6),
    isCancelled: true,
  });
  assert.equal(findOccupant({ state, date: '2026-10-28', slot: 6 }), null);
});

test('следующая пара в четверг вечером — суббота, 08:00, 326', () => {
  const next = nextLesson(seed(), new Date(2026, 9, 29, 19, 40));
  assert.equal(next.date, '2026-10-31');
  assert.equal(next.slot, 1);
  assert.equal(next.group, '326');
});

test('идёт сейчас: начало ≤ now < конец, отменённая — нет', () => {
  // 323, среда 28.10, 6-я пара: 15:40–17:00
  const lesson = lessonAt(seed(), WEEK, '2026-10-28', 6);
  assert.equal(isOngoing(lesson, new Date('2026-10-28T15:39:59')), false);
  assert.equal(isOngoing(lesson, new Date('2026-10-28T15:40:00')), true);
  assert.equal(isOngoing(lesson, new Date('2026-10-28T16:30:00')), true);
  assert.equal(isOngoing(lesson, new Date('2026-10-28T17:00:00')), false);
  assert.equal(isOngoing(lesson, new Date('2026-10-29T15:50:00')), false); // другой день
  assert.equal(
    isOngoing({ ...lesson, cancelled: true }, new Date('2026-10-28T15:50:00')),
    false,
  );
});

test('идёт сейчас: в праздник — нет', () => {
  const lesson = lessonAt(seed(), WEEK, '2026-10-28', 6);
  const now = new Date('2026-10-28T16:00:00');
  assert.equal(isOngoing(lesson, now, ['2026-10-28']), false);
  assert.equal(isOngoing(lesson, now, ['2026-10-29']), true);
});

test('прошедший слот: вчера, сегодня уже началась, сегодня впереди, идёт сейчас', () => {
  const now = new Date('2026-10-28T15:50:00'); // среда, идёт 6-я пара (15:40–17:00)
  assert.equal(isPastSlot('2026-10-27', 9, now), true); // вчера, даже последняя пара
  assert.equal(isPastSlot('2026-10-28', 5, now), true); // сегодня, уже закончилась
  assert.equal(isPastSlot('2026-10-28', 6, now), true); // идёт сейчас — тоже прошлое
  assert.equal(isPastSlot('2026-10-28', 7, now), false); // сегодня, впереди
  assert.equal(isPastSlot('2026-10-29', 1, now), false); // завтра
  assert.equal(
    isPastSlot('2026-10-28', 6, new Date('2026-10-28T15:40:00')),
    true,
  ); // ровно в начало
});

test('фаза: граница начала и конца', () => {
  assert.equal(lessonPhase(PAIR, new Date('2026-10-28T15:39:59')), 'future');
  assert.equal(lessonPhase(PAIR, new Date('2026-10-28T15:40:00')), 'ongoing');
  assert.equal(lessonPhase(PAIR, new Date('2026-10-28T16:59:59')), 'ongoing');
  assert.equal(lessonPhase(PAIR, new Date('2026-10-28T17:00:00')), 'past');
});

test('фаза — по фактическому месту, после переноса', () => {
  const moved = { ...PAIR, date: '2026-10-29', slot: 1, moved: true };
  assert.equal(lessonPhase(moved, AFTER), 'future');
});

test('праздник: дата в списке или нет', () => {
  assert.equal(isHoliday('2026-11-04', ['2026-11-04']), true);
  assert.equal(isHoliday('2026-11-05', ['2026-11-04']), false);
});

test('следующая пара: праздник пропускается', () => {
  // четверг вечером; суббота 31.10 — праздник, значит следующая — вторник 3.11
  const next = nextLesson(seed(), new Date(2026, 9, 29, 19, 40), [
    '2026-10-31',
  ]);
  assert.equal(next.date, '2026-11-03');
  assert.equal(next.slot, 1);
  assert.equal(next.group, '221');
});

test('занятый слот: пара в праздник место не занимает', () => {
  assert.equal(
    findOccupant({
      state: seed(),
      date: '2026-10-28',
      slot: 6,
      holidays: ['2026-10-28'],
    }),
    null,
  );
  assert.equal(
    findOccupant({
      state: seed(),
      date: '2026-10-28',
      slot: 6,
      holidays: [],
    }).group,
    '323',
  );
});
