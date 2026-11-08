/* Миграции: приводят сохранённые данные любой версии к текущей схеме. */
import { SCHEMA } from '../config/app.js';
import { SOURCE } from './lessons.js';

// Прототип 0.1 хранил данные по-другому — миграция переводит их в схему 2.
/** Номер схемы, в которую переводит шаг миграции прототипа. Не путать с текущей SCHEMA. */
const SCHEMA_V2 = 2;
/** id пар, которые в прототипе 0.1 пришли из PDF факультета (остальные добавлены вручную). */
const LEGACY_PDF_RULE_IDS = ['t1', 't2', 't4', 't5', 't6'];
/** В прототипе вида занятия не было: все пары считались лабораторными. */
const LEGACY_LESSON_TYPE = 'ЛР';

/** Правило прототипа 0.1 (tpl) → Rule. */
const ruleFromLegacy = (legacyRule) => ({
  id: legacyRule.id,
  group: legacyRule.group,
  course: +legacyRule.course,
  subject: legacyRule.subject,
  lessonType: LEGACY_LESSON_TYPE,
  color: legacyRule.color || '',
  room: '',
  weekday: legacyRule.weekday,
  slot: legacyRule.slot,
  from: legacyRule.from,
  until: legacyRule.until || null,
  teacher: '',
  source: LEGACY_PDF_RULE_IDS.includes(legacyRule.id)
    ? SOURCE.PDF
    : SOURCE.MANUAL,
  importKey: null,
});

/** Разовая пара прототипа 0.1 (one) → OneOff. */
const oneOffFromLegacy = (legacyOneOff) => ({
  id: legacyOneOff.id,
  date: legacyOneOff.date,
  slot: legacyOneOff.slot,
  group: legacyOneOff.group,
  course: +legacyOneOff.course,
  subject: legacyOneOff.subject,
  lessonType: LEGACY_LESSON_TYPE,
  color: legacyOneOff.color || '',
  room: '',
  cancelled: !!legacyOneOff.cancelled,
  teacher: '',
  source: SOURCE.MANUAL,
});

/**
 * Приводит сохранённые данные любой версии к текущей схеме.
 * Сюда добавляется новый шаг каждый раз, когда меняется форма данных.
 * Чужой файл — ошибка: так «Загрузить из копии» узнаёт, что это не копия.
 * @param {Object} saved  данные из хранилища или из файла копии
 * @returns {State}
 */
export function migrate(saved) {
  if (!saved || typeof saved !== 'object') throw new Error('Пустые данные');
  let migrated = saved;
  // v1 (прототип 0.1): tpl / ex / one, без аудитории и источника
  if (!migrated.schema && Array.isArray(migrated.tpl)) {
    migrated = {
      schema: SCHEMA_V2,
      rules: migrated.tpl.map(ruleFromLegacy),
      exceptions: migrated.ex || {},
      oneOffs: (migrated.one || []).map(oneOffFromLegacy),
    };
  }
  const isCurrentShape =
    migrated.schema === SCHEMA &&
    Array.isArray(migrated.rules) &&
    Array.isArray(migrated.oneOffs) &&
    typeof migrated.exceptions === 'object';
  if (!isCurrentShape) throw new Error('Неизвестный формат данных');
  return migrated;
}
