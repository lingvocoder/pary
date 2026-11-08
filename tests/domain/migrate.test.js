// Тесты миграций: js/domain/migrate.js. Запуск: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrate } from '../../js/domain/migrate.js';
import { weekday } from '../../js/domain/dates.js';
import { WEEK, lessonAt } from './fixtures.js';

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
  const state = migrate(v1);
  assert.equal(state.schema, 2);
  assert.equal(state.rules[0].source, 'pdf');
  assert.equal(state.rules[0].room, '');
  assert.equal(lessonAt(state, WEEK, '2026-10-27', 1).cancelled, true);
});

test('миграция отвергает чужой файл', () => {
  assert.throws(() => migrate({ hello: 'world' }));
});
