// Тесты решений для формы: js/domain/forms.js. Запуск: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../../js/domain/seed.js';
import { knownSubjects } from '../../js/domain/forms.js';

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
