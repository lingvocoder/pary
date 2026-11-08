/* Миграции: приводят сохранённые данные любой версии к текущей схеме. */
import { SCHEMA } from '../config/app.js';
import { weekday } from './dates.js';

// Прототип 0.1 хранил данные по-другому — миграция переводит их в схему 2.
/** Номер схемы, в которую переводит шаг миграции прототипа. Не путать с текущей SCHEMA. */
const SCHEMA_V2 = 2;
/** id пар, которые в прототипе 0.1 пришли из PDF факультета (остальные добавлены вручную). */
const LEGACY_PDF_RULE_IDS = ['t1', 't2', 't4', 't5', 't6'];
/** В прототипе вида занятия не было: все пары считались лабораторными. */
const LEGACY_LESSON_TYPE = 'ЛР';

/**
 * Приводит сохранённые данные любой версии к текущей схеме.
 * Сюда добавляется новый шаг каждый раз, когда меняется форма данных.
 * @returns {State}
 */
export function migrate(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Пустые данные');
  let s = raw;
  // v1 (прототип 0.1): tpl / ex / one, без аудитории и источника
  if (!s.schema && Array.isArray(s.tpl)) {
    s = {
      schema: SCHEMA_V2,
      rules: s.tpl.map((t) => ({
        id: t.id,
        group: t.group,
        course: +t.course,
        subject: t.subject,
        lessonType: LEGACY_LESSON_TYPE,
        color: t.color || '',
        room: '',
        weekday: t.weekday,
        slot: t.slot,
        from: t.from,
        until: t.until || null,
        teacher: '',
        source: LEGACY_PDF_RULE_IDS.includes(t.id) ? 'pdf' : 'manual',
        importKey: null,
      })),
      exceptions: s.ex || {},
      oneOffs: (s.one || []).map((o) => ({
        id: o.id,
        date: o.date,
        slot: o.slot,
        group: o.group,
        course: +o.course,
        subject: o.subject,
        lessonType: LEGACY_LESSON_TYPE,
        color: o.color || '',
        room: '',
        cancelled: !!o.cancelled,
        teacher: '',
        source: 'manual',
      })),
    };
  }
  if (
    s.schema !== SCHEMA ||
    !Array.isArray(s.rules) ||
    !Array.isArray(s.oneOffs) ||
    typeof s.exceptions !== 'object'
  ) {
    throw new Error('Неизвестный формат данных');
  }
  return s;
}
