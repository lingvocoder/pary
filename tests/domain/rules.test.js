// Тесты правил состояний занятия: js/domain/rules.js. Запуск: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  can,
  canPlace,
  lessonState,
  isApplicable,
  LESSON_STATE,
  OPERATION,
} from '../../js/domain/rules.js';
import { ACTION, reduce } from '../../js/domain/changes.js';
import { seed } from '../../js/domain/seed.js';
import { WEEK, lessonsAt, PAIR, BEFORE, DURING, AFTER } from './fixtures.js';

// Состояния пары — столбцы таблицы «Пара: что с ней можно сделать»

const PAIR_STATES = {
  будущая: { lesson: PAIR, now: BEFORE, holidays: [] },
  'будущая, отменена': {
    lesson: { ...PAIR, cancelled: true },
    now: BEFORE,
    holidays: [],
  },
  идёт: { lesson: PAIR, now: DURING, holidays: [] },
  прошла: { lesson: PAIR, now: AFTER, holidays: [] },
  'прошла, не состоялась': {
    lesson: { ...PAIR, cancelled: true },
    now: AFTER,
    holidays: [],
  },
  'будущая, праздник': { lesson: PAIR, now: BEFORE, holidays: ['2026-10-28'] },
};

// [операция, состояние, ожидание]: true — можно, строка — точный текст отказа,
// false — нельзя (в таблице «✗» без текста или «—»)

const PAIR_CASES = [
  ['move', 'будущая', true],
  ['move', 'будущая, отменена', 'Сначала верни пару'],
  ['move', 'идёт', 'Пара уже идёт'],
  ['move', 'прошла', 'Пара уже прошла'],
  ['move', 'прошла, не состоялась', 'Пара уже прошла'],
  ['move', 'будущая, праздник', true],

  ['cancel', 'будущая', true],
  ['cancel', 'будущая, отменена', false],
  ['cancel', 'идёт', false],
  ['cancel', 'прошла', false],
  ['cancel', 'прошла, не состоялась', false],
  ['cancel', 'будущая, праздник', false],

  ['restore', 'будущая', false],
  ['restore', 'будущая, отменена', true],
  ['restore', 'идёт', false],
  ['restore', 'прошла', false],
  ['restore', 'прошла, не состоялась', false],
  ['restore', 'будущая, праздник', false],

  ['notHeld', 'будущая', false],
  ['notHeld', 'будущая, отменена', false],
  ['notHeld', 'идёт', true],
  ['notHeld', 'прошла', true],
  ['notHeld', 'прошла, не состоялась', false],
  ['notHeld', 'будущая, праздник', false],

  ['held', 'будущая', false],
  ['held', 'будущая, отменена', false],
  ['held', 'идёт', false],
  ['held', 'прошла', false],
  ['held', 'прошла, не состоялась', true],
  ['held', 'будущая, праздник', false],

  ['edit', 'будущая', true],
  ['edit', 'будущая, отменена', true],
  ['edit', 'идёт', false],
  ['edit', 'прошла', false],
  ['edit', 'прошла, не состоялась', false],
  ['edit', 'будущая, праздник', true],

  ['room', 'будущая', true],
  ['room', 'будущая, отменена', true],
  ['room', 'идёт', true],
  ['room', 'прошла', false],
  ['room', 'прошла, не состоялась', false],
  ['room', 'будущая, праздник', true],

  ['delete', 'будущая', true],
  ['delete', 'будущая, отменена', true],
  ['delete', 'идёт', false],
  ['delete', 'прошла', false],
  ['delete', 'прошла, не состоялась', false],
  ['delete', 'будущая, праздник', true],

  ['calendar', 'будущая', true],
  ['calendar', 'будущая, отменена', false],
  ['calendar', 'идёт', false],
  ['calendar', 'прошла', false],
  ['calendar', 'прошла, не состоялась', false],
  ['calendar', 'будущая, праздник', false],
];

/** Сверяет ответ правила с ожиданием из таблицы. */

function assertRule(got, want) {
  if (want === true) return assert.deepEqual(got, { ok: true });
  assert.equal(got.ok, false);
  if (typeof want === 'string') assert.equal(got.reason, want);
  else assert.ok(got.reason, 'у отказа должен быть текст');
}

for (const [operation, name, want] of PAIR_CASES) {
  test(`пара: ${operation}, ${name} → ${want}`, () => {
    const { lesson, now, holidays } = PAIR_STATES[name];
    assertRule(
      can({
        operation,
        lesson,
        now,
        state: seed(),
        holidays,
      }),
      want,
    );
  });
}

test('пара: restore в занятый слот — «Слот занят группой N»', () => {
  // пока пара отменена, в её слот поставили разовую
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
  const lesson = lessonsAt(state, WEEK, '2026-10-28', 6).find(
    (candidate) => candidate.cancelled,
  );
  assertRule(
    can({
      operation: 'restore',
      lesson,
      now: BEFORE,
      state,
      holidays: [],
    }),
    'Слот занят группой 999',
  );
});

test('пара в праздник, который начался или прошёл: всё нельзя', () => {
  const ops = [
    'move',
    'cancel',
    'restore',
    'notHeld',
    'held',
    'edit',
    'room',
    'delete',
    'calendar',
  ];
  for (const operation of ops)
    for (const now of [DURING, AFTER])
      assertRule(
        can({
          operation,
          lesson: PAIR,
          now,
          state: seed(),
          holidays: ['2026-10-28'],
        }),
        'Праздник — пары нет',
      );
});

test('пара: неизвестная операция — ошибка', () => {
  assert.throws(() =>
    can({
      operation: 'fly',
      lesson: PAIR,
      now: BEFORE,
      state: seed(),
      holidays: [],
    }),
  );
});

// Клетки таблицы «Клетка: что в неё можно поставить». Сейчас — среда 28.10, 12:00,
// идёт 3-я пара (11:10–12:30); в среду в seed заняты только 5, 6 и 7-я.

const NOON = new Date('2026-10-28T12:00:00');

const cancelledSeed = () =>
  reduce(seed(), {
    type: ACTION.SET_CANCELLED,
    lesson: PAIR,
    isCancelled: true,
  });

const CELLS = {
  'будущая, свободна': {
    makeState: seed,
    date: '2026-10-29',
    slot: 3,
    holidays: [],
  },
  'будущая, там отменённая': {
    makeState: cancelledSeed,
    date: '2026-10-28',
    slot: 6,
    holidays: [],
  },
  'будущая, занята': {
    makeState: seed,
    date: '2026-10-28',
    slot: 6,
    holidays: [],
  },
  идёт: { makeState: seed, date: '2026-10-28', slot: 3, holidays: [] },
  прошла: { makeState: seed, date: '2026-10-28', slot: 1, holidays: [] },
  праздник: {
    makeState: seed,
    date: '2026-10-29',
    slot: 3,
    holidays: ['2026-10-29'],
  },
};

const CELL_CASES = [
  ['move', 'будущая, свободна', true],
  ['move', 'будущая, там отменённая', true],
  ['move', 'будущая, занята', 'Слот занят группой 323'],
  ['move', 'идёт', 'Прошедшее время — сюда нельзя'],
  ['move', 'прошла', 'Прошедшее время — сюда нельзя'],
  ['move', 'праздник', 'Праздник — пар нет'],

  ['addOneOff', 'будущая, свободна', true],
  ['addOneOff', 'будущая, там отменённая', true],
  ['addOneOff', 'будущая, занята', 'В этом слоте уже группа 323'],
  ['addOneOff', 'идёт', true],
  ['addOneOff', 'прошла', true],
  ['addOneOff', 'праздник', 'Праздник — пар нет'],

  ['addRule', 'будущая, свободна', true],
  ['addRule', 'будущая, там отменённая', true],
  ['addRule', 'будущая, занята', false],
  ['addRule', 'идёт', 'Повторяющуюся пару нельзя начать в прошлом'],
  ['addRule', 'прошла', 'Повторяющуюся пару нельзя начать в прошлом'],
  ['addRule', 'праздник', false],
];

for (const [kind, name, want] of CELL_CASES) {
  test(`клетка: ${kind}, ${name} → ${want}`, () => {
    const { makeState, date, slot, holidays } = CELLS[name];
    assertRule(
      canPlace({
        kind,
        date,
        slot,
        now: NOON,
        state: makeState(),
        holidays,
      }),
      want,
    );
  });
}

test('клетка: перенос в свой же слот — не занятость', () => {
  assertRule(
    canPlace({
      kind: 'move',
      date: '2026-10-28',
      slot: 6,
      now: NOON,
      state: seed(),
      holidays: [],
      exceptLessonId: PAIR.id,
    }),
    true,
  );
});

test('клетка: неизвестный вид — ошибка', () => {
  assert.throws(() =>
    canPlace({
      kind: 'fly',
      date: '2026-10-29',
      slot: 3,
      now: NOON,
      state: seed(),
      holidays: [],
    }),
  );
});

test('пара: held, если в слот уже поставили замену, — «Слот занят группой N»', () => {
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
  const lesson = lessonsAt(state, WEEK, '2026-10-28', 6).find(
    (candidate) => candidate.cancelled,
  );
  assertRule(
    can({
      operation: 'held',
      lesson,
      now: AFTER,
      state,
      holidays: [],
    }),
    'Слот занят группой 999',
  );
});

test('состояние занятия: шесть столбцов таблицы и праздник, который уже прошёл', () => {
  const expected = {
    будущая: LESSON_STATE.FUTURE,
    'будущая, отменена': LESSON_STATE.CANCELLED,
    идёт: LESSON_STATE.ONGOING,
    прошла: LESSON_STATE.PAST,
    'прошла, не состоялась': LESSON_STATE.NOT_HELD,
    'будущая, праздник': LESSON_STATE.HOLIDAY,
  };
  for (const [name, state] of Object.entries(expected)) {
    const { lesson, now, holidays } = PAIR_STATES[name];
    assert.equal(lessonState(lesson, now, holidays), state, name);
  }
  assert.equal(
    lessonState(PAIR, AFTER, ['2026-10-28']),
    LESSON_STATE.HOLIDAY_DONE,
  );
});

test('применимость: «Вернуть» видна и при занятом слоте — почему нельзя, скажет can()', () => {
  assert.equal(isApplicable(OPERATION.RESTORE, LESSON_STATE.CANCELLED), true);
  assert.equal(isApplicable(OPERATION.RESTORE, LESSON_STATE.FUTURE), false);
  assert.equal(isApplicable(OPERATION.HELD, LESSON_STATE.NOT_HELD), true);
  assert.equal(isApplicable(OPERATION.MOVE, LESSON_STATE.HOLIDAY), true);
  assert.equal(isApplicable(OPERATION.EDIT, LESSON_STATE.ONGOING), false);
  assert.throws(() => isApplicable('fly', LESSON_STATE.FUTURE));
});
