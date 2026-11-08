// Тесты помощников интерфейса, которые не трогают страницу. Запуск: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyWeekSummary } from '../js/ui/helpers.js';

test('вопрос перед заменой: сколько пар в копии на этой неделе', () => {
  assert.equal(copyWeekSummary(0), 'В копии на этой неделе пар нет');
  assert.equal(copyWeekSummary(1), 'В копии на этой неделе — 1 пара');
  assert.equal(copyWeekSummary(2), 'В копии на этой неделе — 2 пары');
  assert.equal(copyWeekSummary(5), 'В копии на этой неделе — 5 пар');
  assert.equal(copyWeekSummary(21), 'В копии на этой неделе — 21 пара');
});
