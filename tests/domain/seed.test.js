// Тесты исходного расписания: js/domain/seed.js. Запуск: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekLessons } from '../../js/domain/lessons.js';
import { seed } from '../../js/domain/seed.js';
import { WEEK } from './fixtures.js';

test('исходное расписание: 6 пар на неделе', () => {
  assert.equal(weekLessons(seed(), WEEK).length, 6);
});
