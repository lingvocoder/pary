// Тесты правил состояний занятия: js/domain/rules.js. Запуск: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { can, canPlace } from '../../js/domain/rules.js';
import { reduce } from '../../js/domain/changes.js';
import { seed } from '../../js/domain/seed.js';
import { WEEK, at, PAIR, BEFORE, DURING, AFTER } from './fixtures.js';

// Состояния пары — столбцы таблицы «Пара: что с ней можно сделать»

const PAIR_STATES = {
  будущая: { o: PAIR, now: BEFORE, holidays: [] },
  'будущая, отменена': {
    o: { ...PAIR, cancelled: true },
    now: BEFORE,
    holidays: [],
  },
  идёт: { o: PAIR, now: DURING, holidays: [] },
  прошла: { o: PAIR, now: AFTER, holidays: [] },
  'прошла, не состоялась': {
    o: { ...PAIR, cancelled: true },
    now: AFTER,
    holidays: [],
  },
  'будущая, праздник': { o: PAIR, now: BEFORE, holidays: ['2026-10-28'] },
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

for (const [op, name, want] of PAIR_CASES) {
  test(`пара: ${op}, ${name} → ${want}`, () => {
    const { o, now, holidays } = PAIR_STATES[name];
    assertRule(can(op, o, now, seed(), holidays), want);
  });
}

test('пара: restore в занятый слот — «Слот занят группой N»', () => {
  // пока пара отменена, в её слот поставили разовую
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
  const o = at(s, WEEK, '2026-10-28', 6).find((x) => x.cancelled);
  assertRule(can('restore', o, BEFORE, s, []), 'Слот занят группой 999');
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
  for (const op of ops)
    for (const now of [DURING, AFTER])
      assertRule(
        can(op, PAIR, now, seed(), ['2026-10-28']),
        'Праздник — пары нет',
      );
});

test('пара: неизвестная операция — ошибка', () => {
  assert.throws(() => can('fly', PAIR, BEFORE, seed(), []));
});

// Клетки таблицы «Клетка: что в неё можно поставить». Сейчас — среда 28.10, 12:00,
// идёт 3-я пара (11:10–12:30); в среду в seed заняты только 5, 6 и 7-я.

const NOON = new Date('2026-10-28T12:00:00');

const cancelledSeed = () =>
  reduce(seed(), { type: 'setCancelled', occ: PAIR, value: true });

const CELLS = {
  'будущая, свободна': { s: seed, date: '2026-10-29', slot: 3, holidays: [] },
  'будущая, там отменённая': {
    s: cancelledSeed,
    date: '2026-10-28',
    slot: 6,
    holidays: [],
  },
  'будущая, занята': { s: seed, date: '2026-10-28', slot: 6, holidays: [] },
  идёт: { s: seed, date: '2026-10-28', slot: 3, holidays: [] },
  прошла: { s: seed, date: '2026-10-28', slot: 1, holidays: [] },
  праздник: {
    s: seed,
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

  ['addOnce', 'будущая, свободна', true],
  ['addOnce', 'будущая, там отменённая', true],
  ['addOnce', 'будущая, занята', 'В этом слоте уже группа 323'],
  ['addOnce', 'идёт', true],
  ['addOnce', 'прошла', true],
  ['addOnce', 'праздник', 'Праздник — пар нет'],

  ['addRepeat', 'будущая, свободна', true],
  ['addRepeat', 'будущая, там отменённая', true],
  ['addRepeat', 'будущая, занята', false],
  ['addRepeat', 'идёт', 'Повторяющуюся пару нельзя начать в прошлом'],
  ['addRepeat', 'прошла', 'Повторяющуюся пару нельзя начать в прошлом'],
  ['addRepeat', 'праздник', false],
];

for (const [kind, name, want] of CELL_CASES) {
  test(`клетка: ${kind}, ${name} → ${want}`, () => {
    const { s, date, slot, holidays } = CELLS[name];
    assertRule(canPlace(kind, date, slot, NOON, s(), holidays), want);
  });
}

test('клетка: перенос в свой же слот — не занятость', () => {
  assertRule(
    canPlace('move', '2026-10-28', 6, NOON, seed(), [], PAIR.id),
    true,
  );
});

test('клетка: неизвестный вид — ошибка', () => {
  assert.throws(() => canPlace('fly', '2026-10-29', 3, NOON, seed(), []));
});

test('пара: held, если в слот уже поставили замену, — «Слот занят группой N»', () => {
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
  const o = at(s, WEEK, '2026-10-28', 6).find((x) => x.cancelled);
  assertRule(can('held', o, AFTER, s, []), 'Слот занят группой 999');
});
