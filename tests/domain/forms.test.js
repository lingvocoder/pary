// Тесты решений для формы: js/domain/forms.js. Запуск: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { knownSubjects } from '../../js/domain/forms.js';
import { seed } from '../../js/domain/seed.js';

test('предметы для списка: сначала из настроек, потом из данных по алфавиту', () => {
  const state = seed();
  state.rules[0].subject = 'Практическая фонетика';
  state.rules[1].subject = 'Домашнее чтение';
  state.oneOffs.push({
    ...state.rules[2],
    id: 'x',
    date: '2026-10-30',
    subject: 'Домашнее чтение',
  });
  const base = ['ПК первого ин. яз.', 'ИКТ в лингвистике'];
  assert.deepEqual(knownSubjects(state, base), [
    'ПК первого ин. яз.',
    'ИКТ в лингвистике',
    'Домашнее чтение', // повтор из разовой пары — один раз
    'Практическая фонетика',
  ]);
  assert.deepEqual(knownSubjects(seed(), base), base); // в исходных данных только базовый
});
