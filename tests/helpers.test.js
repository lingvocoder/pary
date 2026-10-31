// Тесты помощников интерфейса, которые не трогают страницу. Запуск: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plural } from '../js/ui/helpers.js';

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
