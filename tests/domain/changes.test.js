// Тесты изменений данных (reduce): js/domain/changes.js. Запуск: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTION, reduce } from '../../js/domain/changes.js';
import { seed } from '../../js/domain/seed.js';
import { WEEK, NEXT, lessonsAt, lessonAt, PAIR } from './fixtures.js';

test('reduce не меняет исходное состояние', () => {
  const s0 = seed(),
    copy = JSON.stringify(s0);
  reduce(s0, {
    type: ACTION.SET_CANCELLED,
    lesson: lessonAt(s0, WEEK, '2026-10-28', 6),
    isCancelled: true,
  });
  assert.equal(JSON.stringify(s0), copy);
});

test('перенос «только эта дата»: на следующей неделе пара на месте', () => {
  let state = seed();
  state = reduce(state, {
    type: ACTION.EDIT,
    lesson: lessonAt(state, WEEK, '2026-10-27', 2),
    changes: { date: '2026-10-29', slot: 3 },
    scope: 'one',
  });
  assert.equal(lessonAt(state, WEEK, '2026-10-29', 3).group, '124');
  assert.equal(lessonAt(state, WEEK, '2026-10-29', 3).moved, true);
  assert.equal(lessonsAt(state, WEEK, '2026-10-27', 2).length, 0);
  assert.equal(lessonAt(state, NEXT, '2026-11-03', 2).group, '124');
});

test('перенос «дальше»: правило делится, прошлые недели не трогаются', () => {
  let state = seed();
  state = reduce(state, {
    type: ACTION.EDIT,
    lesson: lessonAt(state, WEEK, '2026-10-27', 1),
    changes: { date: '2026-10-29', slot: 3 },
    scope: 'future',
  });
  assert.equal(lessonAt(state, WEEK, '2026-10-29', 3).group, '221');
  assert.equal(lessonAt(state, NEXT, '2026-11-05', 3).group, '221');
  assert.equal(lessonAt(state, '2026-10-19', '2026-10-20', 1).group, '221'); // неделя раньше — по-старому
  const old = state.rules.find((rule) => rule.id === 'seed-221-tu-1');
  assert.equal(old.until, '2026-10-26');
});

test('«дальше» для правила, которое начинается с этой даты: без деления', () => {
  let state = seed();
  const before = state.rules.length;
  state = reduce(state, {
    type: ACTION.EDIT,
    lesson: lessonAt(state, WEEK, '2026-10-28', 5),
    changes: { slot: 4 },
    scope: 'future',
  });
  assert.equal(state.rules.length, before);
  assert.equal(lessonAt(state, NEXT, '2026-11-04', 4).group, '326');
});

test('аудитория «дальше» видна на следующих неделях, но не на прошлых', () => {
  let state = seed();
  state = reduce(state, {
    type: ACTION.EDIT,
    lesson: lessonAt(state, NEXT, '2026-11-03', 1),
    changes: { room: '301' },
    scope: 'future',
  });
  assert.equal(lessonAt(state, NEXT, '2026-11-03', 1).room, '301');
  assert.equal(lessonAt(state, '2026-11-09', '2026-11-10', 1).room, '301');
  assert.equal(lessonAt(state, WEEK, '2026-10-27', 1).room, '');
});

test('удаление «только эта дата» и «дальше»', () => {
  let state = seed();
  state = reduce(state, {
    type: ACTION.DELETE,
    lesson: lessonAt(state, WEEK, '2026-10-31', 1),
    scope: 'one',
  });
  assert.equal(lessonsAt(state, WEEK, '2026-10-31', 1).length, 0);
  assert.equal(lessonsAt(state, NEXT, '2026-11-07', 1).length, 1);
  state = reduce(state, {
    type: ACTION.DELETE,
    lesson: lessonAt(state, NEXT, '2026-11-07', 1),
    scope: 'future',
  });
  assert.equal(lessonsAt(state, NEXT, '2026-11-07', 1).length, 0);
  assert.equal(lessonsAt(state, '2026-10-19', '2026-10-24', 1).length, 1);
});

test('отмена и возврат: исключение исчезает без следа', () => {
  let state = seed();
  state = reduce(state, {
    type: ACTION.SET_CANCELLED,
    lesson: lessonAt(state, WEEK, '2026-10-28', 6),
    isCancelled: true,
  });
  assert.equal(lessonAt(state, WEEK, '2026-10-28', 6).cancelled, true);
  state = reduce(state, {
    type: ACTION.SET_CANCELLED,
    lesson: lessonAt(state, WEEK, '2026-10-28', 6),
    isCancelled: false,
  });
  assert.deepEqual(state.exceptions, {});
});

test('разовая пара: добавляется только на свою дату', () => {
  let state = seed();
  state = reduce(state, {
    type: ACTION.ADD,
    newLesson: {
      group: '421',
      course: 4,
      subject: 'ИКТ в лингвистике',
      color: '',
      room: '105',
      date: '2026-10-30',
      slot: 2,
      isWeekly: false,
    },
  });
  assert.equal(lessonAt(state, WEEK, '2026-10-30', 2).room, '105');
  assert.equal(lessonsAt(state, NEXT, '2026-11-06', 2).length, 0);
});

test('возврат отменённой пары в занятый слот ничего не меняет', () => {
  let state = seed();
  state = reduce(state, {
    type: ACTION.SET_CANCELLED,
    lesson: PAIR,
    isCancelled: true,
  });
  state = reduce(state, {
    type: ACTION.ADD,
    newLesson: {
      group: '999',
      course: 1,
      subject: 'ИКТ в лингвистике',
      color: '',
      room: '',
      date: '2026-10-28',
      slot: 6,
      isWeekly: false,
    },
  });
  const before = JSON.stringify(state);
  const cancelled = lessonsAt(state, WEEK, '2026-10-28', 6).find(
    (candidate) => candidate.cancelled,
  );
  state = reduce(state, {
    type: ACTION.SET_CANCELLED,
    lesson: cancelled,
    isCancelled: false,
  });
  assert.equal(JSON.stringify(state), before);
});
