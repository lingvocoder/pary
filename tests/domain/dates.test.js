// Тесты дат: js/domain/dates.js. Запуск: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  weekday,
  weekStart,
  weekToShow,
  humanDate,
  atTime,
} from '../../js/domain/dates.js';

test('даты: сдвиг через месяц, день недели с понедельника, начало недели', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-11-01', -1), '2026-10-31');
  assert.equal(weekday('2026-10-26'), 0); // понедельник
  assert.equal(weekday('2026-11-01'), 6); // воскресенье
  assert.equal(weekStart('2026-11-01'), '2026-10-26');
  assert.equal(humanDate('2026-11-04'), '4 ноября');
  assert.equal(atTime('2026-10-28', '15:40').getHours(), 15);
});

test('какую неделю показывать: в будни — эту, в воскресенье — следующую', () => {
  assert.equal(weekToShow('2026-10-28'), '2026-10-26');
  assert.equal(weekToShow('2026-10-31'), '2026-10-26');
  assert.equal(weekToShow('2026-11-01'), '2026-11-02');
});
