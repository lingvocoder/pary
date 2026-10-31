// Тесты настроек интерфейса (getPref/setPref). Запуск: npm test.
// store.js при импорте сразу читает localStorage, поэтому подмена ставится до import().
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/** Хранилище в памяти с тем же интерфейсом, что у localStorage. */
const memory = new Map();
const fakeStorage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
  clear: () => memory.clear(),
};
Object.defineProperty(globalThis, 'localStorage', {
  value: fakeStorage,
  configurable: true,
  writable: true,
});

const { getPref, setPref, getState } = await import('../js/store.js');
const { PREFS_KEY, STORAGE_KEY } = await import('../js/config.js');

beforeEach(() => memory.clear());

test('настройки: без записи возвращается значение по умолчанию', () => {
  assert.equal(getPref('hintTapLearned', false), false);
  assert.equal(getPref('нет такой', 'по умолчанию'), 'по умолчанию');
});

test('настройки: запись сохраняется в отдельный ключ pary.prefs', () => {
  setPref('hintTapLearned', true);
  assert.equal(getPref('hintTapLearned', false), true);
  assert.deepEqual(JSON.parse(memory.get(PREFS_KEY)), {
    hintTapLearned: true,
  });
  // данные расписания не тронуты: в State настроек нет, его ключ не записан
  assert.equal(memory.has(STORAGE_KEY), false);
  assert.equal('hintTapLearned' in getState(), false);
});

test('настройки: вторая запись не стирает первую', () => {
  setPref('hintTapLearned', true);
  setPref('hintHoldLearned', true);
  assert.equal(getPref('hintTapLearned', false), true);
  assert.equal(getPref('hintHoldLearned', false), true);
});

test('настройки: битый JSON в pary.prefs не роняет приложение', () => {
  memory.set(PREFS_KEY, '{битый json');
  assert.equal(getPref('hintTapLearned', false), false);
  // запись поверх битого значения работает и чинит его
  setPref('hintTapLearned', true);
  assert.equal(getPref('hintTapLearned', false), true);
});

test('настройки: не объект в pary.prefs — как пустые настройки', () => {
  memory.set(PREFS_KEY, '[1, 2, 3]');
  assert.equal(getPref('hintTapLearned', false), false);
});
