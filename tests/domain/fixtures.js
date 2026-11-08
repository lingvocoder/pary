/* Общие заготовки тестов домена: неделя, занятие 323 в среду и моменты вокруг него.
   Имя без .test.js — отдельным тестом не запускается. */
import { weekLessons } from '../../js/domain/lessons.js';
import { seed } from '../../js/domain/seed.js';

export const WEEK = '2026-10-26'; // неделя 26–31 октября

export const NEXT = '2026-11-02';

export const lessonsAt = (state, weekStartDate, date, slot) =>
  weekLessons(state, weekStartDate).filter(
    (lesson) => lesson.date === date && lesson.slot === slot,
  );

export const lessonAt = (state, weekStartDate, date, slot) =>
  lessonsAt(state, weekStartDate, date, slot)[0];

// 323, среда 28.10, 6-я пара: 15:40–17:00

export const PAIR = lessonAt(seed(), WEEK, '2026-10-28', 6);

export const BEFORE = new Date('2026-10-28T10:00:00');

export const DURING = new Date('2026-10-28T16:00:00');

export const AFTER = new Date('2026-10-28T18:00:00');
