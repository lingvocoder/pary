// Тесты модели расписания. Запуск: npm test (или node --test tests/*.test.js)
// Браузер не нужен: модель — чистые функции.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seed, migrate, weekOccurrences, nextPair, busyAt, reduce} from '../js/model.js';

const WEEK = '2026-10-26';           // неделя 26–31 октября
const NEXT = '2026-11-02';
const at = (s, ws, date, slot) => weekOccurrences(s, ws).filter(o => o.date === date && o.slot === slot);
const one = (s, ws, date, slot) => at(s, ws, date, slot)[0];

test('исходное расписание: 6 пар на неделе', () => {
  assert.equal(weekOccurrences(seed(), WEEK).length, 6);
});

test('reduce не меняет исходное состояние', () => {
  const s0 = seed(), copy = JSON.stringify(s0);
  reduce(s0, {type: 'setCancelled', occ: one(s0, WEEK, '2026-10-28', 6), value: true});
  assert.equal(JSON.stringify(s0), copy);
});

test('перенос «только эта дата»: на следующей неделе пара на месте', () => {
  let s = seed();
  s = reduce(s, {type: 'edit', occ: one(s, WEEK, '2026-10-27', 2), changes: {date: '2026-10-29', slot: 3}, scope: 'one'});
  assert.equal(one(s, WEEK, '2026-10-29', 3).group, '124');
  assert.equal(one(s, WEEK, '2026-10-29', 3).moved, true);
  assert.equal(at(s, WEEK, '2026-10-27', 2).length, 0);
  assert.equal(one(s, NEXT, '2026-11-03', 2).group, '124');
});

test('перенос «дальше»: правило делится, прошлые недели не трогаются', () => {
  let s = seed();
  s = reduce(s, {type: 'edit', occ: one(s, WEEK, '2026-10-27', 1), changes: {date: '2026-10-29', slot: 3}, scope: 'future'});
  assert.equal(one(s, WEEK, '2026-10-29', 3).group, '221');
  assert.equal(one(s, NEXT, '2026-11-05', 3).group, '221');
  assert.equal(one(s, '2026-10-19', '2026-10-20', 1).group, '221');      // неделя раньше — по-старому
  const old = s.rules.find(r => r.id === 'seed-221-tu-1');
  assert.equal(old.until, '2026-10-26');
});

test('«дальше» для правила, которое начинается с этой даты: без деления', () => {
  let s = seed();
  const before = s.rules.length;
  s = reduce(s, {type: 'edit', occ: one(s, WEEK, '2026-10-28', 5), changes: {slot: 4}, scope: 'future'});
  assert.equal(s.rules.length, before);
  assert.equal(one(s, NEXT, '2026-11-04', 4).group, '326');
});

test('аудитория «дальше» видна на следующих неделях, но не на прошлых', () => {
  let s = seed();
  s = reduce(s, {type: 'edit', occ: one(s, NEXT, '2026-11-03', 1), changes: {room: '301'}, scope: 'future'});
  assert.equal(one(s, NEXT, '2026-11-03', 1).room, '301');
  assert.equal(one(s, '2026-11-09', '2026-11-10', 1).room, '301');
  assert.equal(one(s, WEEK, '2026-10-27', 1).room, '');
});

test('удаление «только эта дата» и «дальше»', () => {
  let s = seed();
  s = reduce(s, {type: 'delete', occ: one(s, WEEK, '2026-10-31', 1), scope: 'one'});
  assert.equal(at(s, WEEK, '2026-10-31', 1).length, 0);
  assert.equal(at(s, NEXT, '2026-11-07', 1).length, 1);
  s = reduce(s, {type: 'delete', occ: one(s, NEXT, '2026-11-07', 1), scope: 'future'});
  assert.equal(at(s, NEXT, '2026-11-07', 1).length, 0);
  assert.equal(at(s, '2026-10-19', '2026-10-24', 1).length, 1);
});

test('отмена и возврат: исключение исчезает без следа', () => {
  let s = seed();
  s = reduce(s, {type: 'setCancelled', occ: one(s, WEEK, '2026-10-28', 6), value: true});
  assert.equal(one(s, WEEK, '2026-10-28', 6).cancelled, true);
  s = reduce(s, {type: 'setCancelled', occ: one(s, WEEK, '2026-10-28', 6), value: false});
  assert.deepEqual(s.exceptions, {});
});

test('занятый слот: отменённая пара место не занимает', () => {
  let s = seed();
  assert.equal(busyAt(s, '2026-10-28', 6).group, '323');
  s = reduce(s, {type: 'setCancelled', occ: one(s, WEEK, '2026-10-28', 6), value: true});
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
  s = reduce(s, {type: 'add', pair: {group: '421', course: 4, subject: 'ИКТ в лингвистике', color: '', room: '105', date: '2026-10-30', slot: 2, repeat: false}});
  assert.equal(one(s, WEEK, '2026-10-30', 2).room, '105');
  assert.equal(at(s, NEXT, '2026-11-06', 2).length, 0);
});

test('миграция данных прототипа 0.1', () => {
  const v1 = {v: 1, tpl: [{id: 't1', group: '221', course: 2, subject: 'ПК первого ин. яз.', color: '', weekday: 1, slot: 1, from: '2026-09-22', until: null}],
    ex: {'t1|2026-10-27': {cancelled: true}}, one: []};
  const s = migrate(v1);
  assert.equal(s.schema, 2);
  assert.equal(s.rules[0].source, 'pdf');
  assert.equal(s.rules[0].room, '');
  assert.equal(one(s, WEEK, '2026-10-27', 1).cancelled, true);
});

test('миграция отвергает чужой файл', () => {
  assert.throws(() => migrate({hello: 'world'}));
});
