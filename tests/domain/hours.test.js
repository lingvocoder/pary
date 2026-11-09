// Тесты подсчёта часов: js/domain/hours.js. Запуск: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTION, SCOPE, reduce } from '../../js/domain/changes.js';
import { countLessons } from '../../js/domain/hours.js';
import { seed } from '../../js/domain/seed.js';
import { WEEK, NEXT, lessonAt } from './fixtures.js';

const LATER = new Date('2027-01-01T00:00:00'); // всё уже прошло

test('часы: неделя без исключений — 6 пар, группы по курсу и номеру', () => {
  const report = countLessons({
    state: seed(),
    from: WEEK,
    to: '2026-10-31',
    now: LATER,
  });
  assert.equal(report.total, 6);
  assert.deepEqual(
    report.groups.map(
      (groupCount) =>
        `${groupCount.course}/${groupCount.group}:${groupCount.total}`,
    ),
    ['1/124:1', '2/221:1', '3/323:2', '3/326:2'],
  );
});

test('часы: праздник не считается', () => {
  // 4 ноября — среда: 326 (5-я), 323 (6-я и 7-я)
  const report = countLessons({
    state: seed(),
    from: NEXT,
    to: '2026-11-07',
    now: LATER,
    holidays: ['2026-11-04'],
  });
  assert.equal(report.total, 3);
});

test('часы: отменённая не считается', () => {
  const s0 = seed();
  const state = reduce(s0, {
    type: ACTION.SET_CANCELLED,
    lesson: lessonAt(s0, WEEK, '2026-10-27', 1),
    isCancelled: true,
  });
  assert.equal(
    countLessons({ state, from: WEEK, to: '2026-10-31', now: LATER }).total,
    5,
  );
});

test('часы: перенесённая считается в новый день и один раз', () => {
  const s0 = seed();
  // 323 из среды 28.10 (7-я) — на понедельник 2.11 (1-я): в другую неделю
  const state = reduce(s0, {
    type: ACTION.EDIT,
    lesson: lessonAt(s0, WEEK, '2026-10-28', 7),
    changes: { date: '2026-11-02', slot: 1 },
    scope: SCOPE.THIS_DATE,
  });
  assert.equal(
    countLessons({ state, from: WEEK, to: '2026-10-31', now: LATER }).total,
    5,
  );
  assert.equal(
    countLessons({ state, from: NEXT, to: '2026-11-07', now: LATER }).total,
    7,
  );
  assert.equal(
    countLessons({ state, from: WEEK, to: '2026-11-07', now: LATER }).total,
    12,
  );
});

test('часы: границы периода включаются', () => {
  // вторник 27.10 (2 пары) и среда 28.10 (3 пары)
  assert.equal(
    countLessons({
      state: seed(),
      from: '2026-10-27',
      to: '2026-10-28',
      now: LATER,
    }).total,
    5,
  );
});

test('часы: проведено — только закончившиеся пары', () => {
  const now = new Date('2026-10-28T15:50:00'); // среда, идёт 6-я пара
  const report = countLessons({
    state: seed(),
    from: WEEK,
    to: '2026-10-31',
    now,
  });
  assert.equal(report.total, 6);
  assert.equal(report.held, 3); // вторник 1-я и 2-я, среда 5-я; 6-я ещё идёт
  const g323 = report.groups.find((groupCount) => groupCount.group === '323');
  assert.deepEqual([g323.held, g323.total], [0, 2]);
});
