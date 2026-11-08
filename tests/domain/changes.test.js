// Тесты изменений данных (reduce): js/domain/changes.js. Запуск: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reduce } from '../../js/domain/changes.js';
import { seed } from '../../js/domain/seed.js';
import { WEEK, NEXT, at, one, PAIR } from './fixtures.js';

test('reduce не меняет исходное состояние', () => {
  const s0 = seed(),
    copy = JSON.stringify(s0);
  reduce(s0, {
    type: 'setCancelled',
    occ: one(s0, WEEK, '2026-10-28', 6),
    value: true,
  });
  assert.equal(JSON.stringify(s0), copy);
});

test('перенос «только эта дата»: на следующей неделе пара на месте', () => {
  let s = seed();
  s = reduce(s, {
    type: 'edit',
    occ: one(s, WEEK, '2026-10-27', 2),
    changes: { date: '2026-10-29', slot: 3 },
    scope: 'one',
  });
  assert.equal(one(s, WEEK, '2026-10-29', 3).group, '124');
  assert.equal(one(s, WEEK, '2026-10-29', 3).moved, true);
  assert.equal(at(s, WEEK, '2026-10-27', 2).length, 0);
  assert.equal(one(s, NEXT, '2026-11-03', 2).group, '124');
});

test('перенос «дальше»: правило делится, прошлые недели не трогаются', () => {
  let s = seed();
  s = reduce(s, {
    type: 'edit',
    occ: one(s, WEEK, '2026-10-27', 1),
    changes: { date: '2026-10-29', slot: 3 },
    scope: 'future',
  });
  assert.equal(one(s, WEEK, '2026-10-29', 3).group, '221');
  assert.equal(one(s, NEXT, '2026-11-05', 3).group, '221');
  assert.equal(one(s, '2026-10-19', '2026-10-20', 1).group, '221'); // неделя раньше — по-старому
  const old = s.rules.find((r) => r.id === 'seed-221-tu-1');
  assert.equal(old.until, '2026-10-26');
});

test('«дальше» для правила, которое начинается с этой даты: без деления', () => {
  let s = seed();
  const before = s.rules.length;
  s = reduce(s, {
    type: 'edit',
    occ: one(s, WEEK, '2026-10-28', 5),
    changes: { slot: 4 },
    scope: 'future',
  });
  assert.equal(s.rules.length, before);
  assert.equal(one(s, NEXT, '2026-11-04', 4).group, '326');
});

test('аудитория «дальше» видна на следующих неделях, но не на прошлых', () => {
  let s = seed();
  s = reduce(s, {
    type: 'edit',
    occ: one(s, NEXT, '2026-11-03', 1),
    changes: { room: '301' },
    scope: 'future',
  });
  assert.equal(one(s, NEXT, '2026-11-03', 1).room, '301');
  assert.equal(one(s, '2026-11-09', '2026-11-10', 1).room, '301');
  assert.equal(one(s, WEEK, '2026-10-27', 1).room, '');
});

test('удаление «только эта дата» и «дальше»', () => {
  let s = seed();
  s = reduce(s, {
    type: 'delete',
    occ: one(s, WEEK, '2026-10-31', 1),
    scope: 'one',
  });
  assert.equal(at(s, WEEK, '2026-10-31', 1).length, 0);
  assert.equal(at(s, NEXT, '2026-11-07', 1).length, 1);
  s = reduce(s, {
    type: 'delete',
    occ: one(s, NEXT, '2026-11-07', 1),
    scope: 'future',
  });
  assert.equal(at(s, NEXT, '2026-11-07', 1).length, 0);
  assert.equal(at(s, '2026-10-19', '2026-10-24', 1).length, 1);
});

test('отмена и возврат: исключение исчезает без следа', () => {
  let s = seed();
  s = reduce(s, {
    type: 'setCancelled',
    occ: one(s, WEEK, '2026-10-28', 6),
    value: true,
  });
  assert.equal(one(s, WEEK, '2026-10-28', 6).cancelled, true);
  s = reduce(s, {
    type: 'setCancelled',
    occ: one(s, WEEK, '2026-10-28', 6),
    value: false,
  });
  assert.deepEqual(s.exceptions, {});
});

test('разовая пара: добавляется только на свою дату', () => {
  let s = seed();
  s = reduce(s, {
    type: 'add',
    pair: {
      group: '421',
      course: 4,
      subject: 'ИКТ в лингвистике',
      color: '',
      room: '105',
      date: '2026-10-30',
      slot: 2,
      repeat: false,
    },
  });
  assert.equal(one(s, WEEK, '2026-10-30', 2).room, '105');
  assert.equal(at(s, NEXT, '2026-11-06', 2).length, 0);
});

test('возврат отменённой пары в занятый слот ничего не меняет', () => {
  let s = seed();
  s = reduce(s, { type: 'setCancelled', occ: PAIR, value: true });
  s = reduce(s, {
    type: 'add',
    pair: {
      group: '999',
      course: 1,
      subject: 'ИКТ в лингвистике',
      color: '',
      room: '',
      date: '2026-10-28',
      slot: 6,
      repeat: false,
    },
  });
  const before = JSON.stringify(s);
  const cancelled = at(s, WEEK, '2026-10-28', 6).find((x) => x.cancelled);
  s = reduce(s, { type: 'setCancelled', occ: cancelled, value: false });
  assert.equal(JSON.stringify(s), before);
});
