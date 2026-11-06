// Тесты помощников интерфейса, которые не трогают страницу. Запуск: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plural, copyWeekSummary } from '../js/ui/helpers.js';

const pairs = (n) => `${n} ${plural(n, 'пара', 'пары', 'пар')}`;

test('склонение: 1 пара, 2–4 пары, 5+ пар, 11–14 пар', () => {
  assert.equal(pairs(1), '1 пара');
  assert.equal(pairs(2), '2 пары');
  assert.equal(pairs(4), '4 пары');
  assert.equal(pairs(5), '5 пар');
  assert.equal(pairs(0), '0 пар');
  assert.equal(pairs(11), '11 пар');
  assert.equal(pairs(12), '12 пар');
  assert.equal(pairs(14), '14 пар');
  assert.equal(pairs(21), '21 пара');
  assert.equal(pairs(22), '22 пары');
  assert.equal(pairs(111), '111 пар');
});

test('вопрос перед заменой: сколько пар в копии на этой неделе', () => {
  assert.equal(copyWeekSummary(0), 'В копии на этой неделе пар нет');
  assert.equal(copyWeekSummary(1), 'В копии на этой неделе — 1 пара');
  assert.equal(copyWeekSummary(2), 'В копии на этой неделе — 2 пары');
  assert.equal(copyWeekSummary(5), 'В копии на этой неделе — 5 пар');
  assert.equal(copyWeekSummary(21), 'В копии на этой неделе — 21 пара');
});
