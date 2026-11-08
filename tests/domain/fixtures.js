/* Общие заготовки тестов домена: неделя, занятие 323 в среду и моменты вокруг него.
   Имя без .test.js — отдельным тестом не запускается. */
import { weekOccurrences } from '../../js/domain/lessons.js';
import { seed } from '../../js/domain/seed.js';

export const WEEK = '2026-10-26'; // неделя 26–31 октября

export const NEXT = '2026-11-02';

export const at = (s, ws, date, slot) =>
  weekOccurrences(s, ws).filter((o) => o.date === date && o.slot === slot);

export const one = (s, ws, date, slot) => at(s, ws, date, slot)[0];

// 323, среда 28.10, 6-я пара: 15:40–17:00

export const PAIR = one(seed(), WEEK, '2026-10-28', 6);

export const BEFORE = new Date('2026-10-28T10:00:00');

export const DURING = new Date('2026-10-28T16:00:00');

export const AFTER = new Date('2026-10-28T18:00:00');
