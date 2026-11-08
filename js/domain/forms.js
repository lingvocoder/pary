/* Решения для формы редактора: какие предметы предложить в списке. */

/**
 * Предметы для списка в редакторе: сначала base (из настроек) в их порядке,
 * затем предметы из правил и разовых пар — без повторов, по алфавиту.
 * @param {State} s
 * @param {string[]} base
 * @returns {string[]}
 */
export function knownSubjects(s, base) {
  const seen = new Set(base);
  const extra = [...s.rules, ...s.oneOffs]
    .map((x) => (x.subject || '').trim())
    .filter((name) => name && !seen.has(name));
  const sorted = [...new Set(extra)].sort((a, b) => a.localeCompare(b, 'ru'));
  return [...base, ...sorted];
}
