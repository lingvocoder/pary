// Тесты решений для формы: js/domain/forms.js. Запуск: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  knownSubjects,
  newLessonDraft,
  validateLessonForm,
  diffLessonChanges,
  defaultNewLessonDate,
  FORM_FIELD,
} from '../../js/domain/forms.js';
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

test('черновик новой пары: курс и предмет по умолчанию, место — из клетки', () => {
  assert.deepEqual(newLessonDraft({ date: '2026-10-29', slot: 4 }), {
    group: '',
    course: 3,
    subject: 'ПК первого ин. яз.',
    room: '',
    color: '',
    date: '2026-10-29',
    slot: 4,
    cancelled: false,
  });
});

test('проверка формы: группа → предмет → дата → воскресенье', () => {
  const filled = { group: '326', subject: 'ИКТ', date: '2026-10-29' };
  assert.deepEqual(validateLessonForm(filled), { ok: true });
  assert.equal(
    validateLessonForm({ ...filled, group: '', subject: '' }).field,
    FORM_FIELD.GROUP,
  );
  assert.equal(
    validateLessonForm({ ...filled, subject: '' }).reason,
    'Укажи предмет',
  );
  assert.equal(
    validateLessonForm({ ...filled, date: '' }).reason,
    'Выбери дату',
  );
  assert.equal(
    validateLessonForm({ ...filled, date: '2026-11-01' }).reason,
    'В воскресенье пар нет, выбери другой день',
  );
});

test('что изменилось: только отличающиеся поля, пустая аудитория = нет аудитории', () => {
  const lesson = {
    group: '323',
    course: 3,
    subject: 'ИКТ',
    room: '',
    color: '',
    date: '2026-10-28',
    slot: 6,
  };
  assert.deepEqual(diffLessonChanges(lesson, { ...lesson }), {});
  assert.deepEqual(
    diffLessonChanges(lesson, { ...lesson, course: '3', room: '301', slot: 7 }),
    { room: '301', slot: 7 },
  );
});

test('дата новой пары с пустой недели: сегодня, если оно на этой неделе', () => {
  assert.equal(defaultNewLessonDate('2026-10-26', '2026-10-28'), '2026-10-28');
  assert.equal(defaultNewLessonDate('2026-11-02', '2026-10-28'), '2026-11-02');
  assert.equal(defaultNewLessonDate('2026-10-26', '2026-11-01'), '2026-10-26');
});
