/* Цвет занятия: какой CSS-класс задаёт оттенок карточки, бейджа и подсказки. */
import { COURSES, DEFAULT_COURSE, PALETTE } from '../../config/university.js';

/**
 * Свой цвет «важной» пары (tint-red…) или цвет курса (course-1…4).
 * Курс не из списка — цвет курса по умолчанию.
 * @param {{color?: string, course: number}} lesson
 * @returns {string}
 */
export function lessonColorClass(lesson) {
  const custom = PALETTE.find(
    (paletteColor) => paletteColor.id && paletteColor.id === lesson.color,
  );
  if (custom) return 'tint-' + custom.tint;
  const course = +lesson.course;
  return 'course-' + (COURSES.includes(course) ? course : DEFAULT_COURSE);
}
