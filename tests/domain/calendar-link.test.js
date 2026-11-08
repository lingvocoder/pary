// Тесты ссылки в Google Календарь: js/domain/calendar-link.js. Запуск: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarLink } from '../../js/domain/calendar-link.js';
import { findRule } from '../../js/domain/lessons.js';
import { seed } from '../../js/domain/seed.js';
import { PAIR } from './fixtures.js';

const paramsOf = (link) => new URL(link).searchParams;
const rule = findRule(seed(), PAIR.ruleId);

test('календарь: время, часовой пояс, название и описание', () => {
  const params = paramsOf(calendarLink(PAIR, rule));
  assert.equal(params.get('action'), 'TEMPLATE');
  assert.equal(params.get('dates'), '20261028T154000/20261028T170000');
  assert.equal(params.get('ctz'), 'Europe/Moscow');
  assert.equal(params.get('text'), 'Гр. 323, ПК первого ин. яз.');
  assert.equal(params.get('details'), '3 курс, 6-я пара');
  assert.equal(params.get('location'), null);
});

test('календарь: повторяющаяся — каждую неделю, до конца правила по Москве', () => {
  assert.equal(
    paramsOf(calendarLink(PAIR, rule)).get('recur'),
    'RRULE:FREQ=WEEKLY',
  );
  assert.equal(
    paramsOf(calendarLink(PAIR, { ...rule, until: '2026-12-31' })).get('recur'),
    'RRULE:FREQ=WEEKLY;UNTIL=20261231T205959Z',
  );
});

test('календарь: перенесённая и разовая — без повтора, аудитория — в месте', () => {
  assert.equal(
    paramsOf(calendarLink({ ...PAIR, moved: true }, rule)).get('recur'),
    null,
  );
  const oneOff = { ...PAIR, type: 'oneOff', room: '301' };
  const params = paramsOf(calendarLink(oneOff));
  assert.equal(params.get('recur'), null);
  assert.equal(params.get('location'), 'ауд. 301');
});
