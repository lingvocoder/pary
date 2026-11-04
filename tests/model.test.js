// Тесты модели расписания. Запуск: npm test (или node --test tests/*.test.js)
// Браузер не нужен: модель — чистые функции.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  seed,
  migrate,
  weekOccurrences,
  nextPair,
  busyAt,
  reduce,
  isOngoing,
  isPastSlot,
  knownSubjects,
  countPairs,
  phase,
  isHoliday,
  can,
  canPlace,
} from '../js/model.js';

const WEEK = '2026-10-26'; // неделя 26–31 октября
const NEXT = '2026-11-02';
const at = (s, ws, date, slot) =>
  weekOccurrences(s, ws).filter((o) => o.date === date && o.slot === slot);
const one = (s, ws, date, slot) => at(s, ws, date, slot)[0];

test('исходное расписание: 6 пар на неделе', () => {
  assert.equal(weekOccurrences(seed(), WEEK).length, 6);
});

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

test('занятый слот: отменённая пара место не занимает', () => {
  let s = seed();
  assert.equal(busyAt(s, '2026-10-28', 6).group, '323');
  s = reduce(s, {
    type: 'setCancelled',
    occ: one(s, WEEK, '2026-10-28', 6),
    value: true,
  });
  assert.equal(busyAt(s, '2026-10-28', 6), null);
});

test('следующая пара в четверг вечером — суббота, 08:00, 326', () => {
  const n = nextPair(seed(), new Date(2026, 9, 29, 19, 40));
  assert.equal(n.date, '2026-10-31');
  assert.equal(n.slot, 1);
  assert.equal(n.group, '326');
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

test('миграция данных прототипа 0.1', () => {
  const v1 = {
    v: 1,
    tpl: [
      {
        id: 't1',
        group: '221',
        course: 2,
        subject: 'ПК первого ин. яз.',
        color: '',
        weekday: 1,
        slot: 1,
        from: '2026-09-22',
        until: null,
      },
    ],
    ex: { 't1|2026-10-27': { cancelled: true } },
    one: [],
  };
  const s = migrate(v1);
  assert.equal(s.schema, 2);
  assert.equal(s.rules[0].source, 'pdf');
  assert.equal(s.rules[0].room, '');
  assert.equal(one(s, WEEK, '2026-10-27', 1).cancelled, true);
});

test('миграция отвергает чужой файл', () => {
  assert.throws(() => migrate({ hello: 'world' }));
});

test('идёт сейчас: начало ≤ now < конец, отменённая — нет', () => {
  // 323, среда 28.10, 6-я пара: 15:40–17:00
  const o = one(seed(), WEEK, '2026-10-28', 6);
  assert.equal(isOngoing(o, new Date('2026-10-28T15:39:59')), false);
  assert.equal(isOngoing(o, new Date('2026-10-28T15:40:00')), true);
  assert.equal(isOngoing(o, new Date('2026-10-28T16:30:00')), true);
  assert.equal(isOngoing(o, new Date('2026-10-28T17:00:00')), false);
  assert.equal(isOngoing(o, new Date('2026-10-29T15:50:00')), false); // другой день
  assert.equal(
    isOngoing({ ...o, cancelled: true }, new Date('2026-10-28T15:50:00')),
    false,
  );
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

test('предметы для списка: сначала из настроек, потом из данных по алфавиту', () => {
  const s = seed();
  s.rules[0].subject = 'Практическая фонетика';
  s.rules[1].subject = 'Домашнее чтение';
  s.oneOffs.push({
    ...s.rules[2],
    id: 'x',
    date: '2026-10-30',
    subject: 'Домашнее чтение',
  });
  const base = ['ПК первого ин. яз.', 'ИКТ в лингвистике'];
  assert.deepEqual(knownSubjects(s, base), [
    'ПК первого ин. яз.',
    'ИКТ в лингвистике',
    'Домашнее чтение', // повтор из разовой пары — один раз
    'Практическая фонетика',
  ]);
  assert.deepEqual(knownSubjects(seed(), base), base); // в исходных данных только базовый
});

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

/* ---------- Правила состояний пары (0.4.0) ---------- */

// 323, среда 28.10, 6-я пара: 15:40–17:00
const PAIR = one(seed(), WEEK, '2026-10-28', 6);
const BEFORE = new Date('2026-10-28T10:00:00');
const DURING = new Date('2026-10-28T16:00:00');
const AFTER = new Date('2026-10-28T18:00:00');

test('фаза: граница начала и конца', () => {
  assert.equal(phase(PAIR, new Date('2026-10-28T15:39:59')), 'future');
  assert.equal(phase(PAIR, new Date('2026-10-28T15:40:00')), 'ongoing');
  assert.equal(phase(PAIR, new Date('2026-10-28T16:59:59')), 'ongoing');
  assert.equal(phase(PAIR, new Date('2026-10-28T17:00:00')), 'past');
});

test('фаза — по фактическому месту, после переноса', () => {
  const moved = { ...PAIR, date: '2026-10-29', slot: 1, moved: true };
  assert.equal(phase(moved, AFTER), 'future');
});

test('праздник: дата в списке или нет', () => {
  assert.equal(isHoliday('2026-11-04', ['2026-11-04']), true);
  assert.equal(isHoliday('2026-11-05', ['2026-11-04']), false);
});

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

test('следующая пара: праздник пропускается', () => {
  // четверг вечером; суббота 31.10 — праздник, значит следующая — вторник 3.11
  const n = nextPair(seed(), new Date(2026, 9, 29, 19, 40), ['2026-10-31']);
  assert.equal(n.date, '2026-11-03');
  assert.equal(n.slot, 1);
  assert.equal(n.group, '221');
});

test('занятый слот: пара в праздник место не занимает', () => {
  assert.equal(busyAt(seed(), '2026-10-28', 6, null, ['2026-10-28']), null);
  assert.equal(busyAt(seed(), '2026-10-28', 6, null, []).group, '323');
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
