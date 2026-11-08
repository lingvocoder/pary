// Тесты подсчёта часов: js/domain/hours.js. Запуск: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reduce } from '../../js/domain/changes.js';
import { countPairs } from '../../js/domain/hours.js';
import { seed } from '../../js/domain/seed.js';
import { WEEK, NEXT, one } from './fixtures.js';

const LATER = new Date('2027-01-01T00:00:00'); // всё уже прошло

test('часы: неделя без исключений — 6 пар, группы по курсу и номеру', () => {
  const r = countPairs(seed(), WEEK, '2026-10-31', LATER);
  assert.equal(r.total, 6);
  assert.deepEqual(
    r.groups.map((g) => `${g.course}/${g.group}:${g.total}`),
    ['1/124:1', '2/221:1', '3/323:2', '3/326:2'],
  );
});

test('часы: праздник не считается', () => {
  // 4 ноября — среда: 326 (5-я), 323 (6-я и 7-я)
  const r = countPairs(seed(), NEXT, '2026-11-07', LATER, ['2026-11-04']);
  assert.equal(r.total, 3);
});

test('часы: отменённая не считается', () => {
  const s0 = seed();
  const s = reduce(s0, {
    type: 'setCancelled',
    occ: one(s0, WEEK, '2026-10-27', 1),
    value: true,
  });
  assert.equal(countPairs(s, WEEK, '2026-10-31', LATER).total, 5);
});

test('часы: перенесённая считается в новый день и один раз', () => {
  const s0 = seed();
  // 323 из среды 28.10 (7-я) — на понедельник 2.11 (1-я): в другую неделю
  const s = reduce(s0, {
    type: 'edit',
    occ: one(s0, WEEK, '2026-10-28', 7),
    changes: { date: '2026-11-02', slot: 1 },
    scope: 'one',
  });
  assert.equal(countPairs(s, WEEK, '2026-10-31', LATER).total, 5);
  assert.equal(countPairs(s, NEXT, '2026-11-07', LATER).total, 7);
  assert.equal(countPairs(s, WEEK, '2026-11-07', LATER).total, 12);
});

test('часы: границы периода включаются', () => {
  // вторник 27.10 (2 пары) и среда 28.10 (3 пары)
  assert.equal(countPairs(seed(), '2026-10-27', '2026-10-28', LATER).total, 5);
});

test('часы: проведено — только закончившиеся пары', () => {
  const now = new Date('2026-10-28T15:50:00'); // среда, идёт 6-я пара
  const r = countPairs(seed(), WEEK, '2026-10-31', now);
  assert.equal(r.total, 6);
  assert.equal(r.held, 3); // вторник 1-я и 2-я, среда 5-я; 6-я ещё идёт
  const g323 = r.groups.find((g) => g.group === '323');
  assert.deepEqual([g323.held, g323.total], [0, 2]);
});
