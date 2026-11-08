/* Решения для формы редактора: какие предметы предложить в списке. */
import { LOCALE } from '../lang/ru.js';

/**
 * Предметы для списка в редакторе: сначала baseSubjects (из настроек) в их порядке,
 * затем предметы из правил и разовых пар — без повторов, по алфавиту.
 * @param {State} state
 * @param {string[]} baseSubjects
 * @returns {string[]}
 */
export function knownSubjects(state, baseSubjects) {
  const seen = new Set(baseSubjects);
  const extra = [...state.rules, ...state.oneOffs]
    .map((lessonSource) => (lessonSource.subject || '').trim())
    .filter((subject) => subject && !seen.has(subject));
  const sorted = [...new Set(extra)].sort((first, second) =>
    first.localeCompare(second, LOCALE),
  );
  return [...baseSubjects, ...sorted];
}
