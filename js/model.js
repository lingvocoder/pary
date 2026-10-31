/* Модель расписания.
   Чистые функции: получают данные, возвращают данные.
   Ни одна не трогает страницу (document) и не сохраняет сама —
   поэтому модель проверяется тестами без браузера (tests/model.test.js)
   и переедет в TypeScript и React без изменений. */
import { CONFIG, SCHEMA } from './config.js';
import { toIso, addDays, weekday, weekStart, atTime } from './dates.js';

/**
 * Повторяющаяся пара: «каждую среду, 5-я пара».
 * @typedef {Object} Rule
 * @property {string} id
 * @property {string} group         номер группы, '326'
 * @property {number} course        1…4
 * @property {string} subject
 * @property {string} lessonType    'ЛР' | 'ПР' | 'ЛК'
 * @property {string} color         id из CONFIG.palette; '' — цвет курса
 * @property {string} room          аудитория; '' — не указана
 * @property {number} weekday       0 = понедельник … 5 = суббота
 * @property {number} slot          номер пары, 1…9
 * @property {string} from          действует с 'YYYY-MM-DD'
 * @property {string|null} until    действует по 'YYYY-MM-DD'; null — без конца
 * @property {string} teacher       '' — это я; для v2 с коллегами
 * @property {'pdf'|'manual'} source
 * @property {string|null} importKey  как узнать эту пару в новом PDF
 */
/**
 * Исключение для одной даты правила. Ключ: `${ruleId}|${date}`.
 * @typedef {Object} Exception
 * @property {boolean} [cancelled]
 * @property {boolean} [deleted]
 * @property {{date:string, slot:number}} [moveTo]
 * @property {Object} [patch]       изменённые поля только на эту дату
 */
/**
 * Разовая пара: замена, консультация.
 * @typedef {Object} OneOff
 * @property {string} id
 * @property {string} date
 * @property {number} slot
 * @property {string} group
 * @property {number} course
 * @property {string} subject
 * @property {string} lessonType
 * @property {string} color
 * @property {string} room
 * @property {boolean} cancelled
 * @property {string} teacher
 * @property {'manual'} source
 */
/**
 * @typedef {Object} State
 * @property {number} schema
 * @property {Rule[]} rules
 * @property {Object<string, Exception>} exceptions
 * @property {OneOff[]} oneOffs
 */
/**
 * Конкретное занятие в конкретный день — то, что видно в сетке.
 * @typedef {Object} Occurrence
 * @property {'rule'|'once'} type
 * @property {string} id            уникален в пределах недели
 * @property {string} [ruleId]
 * @property {string} orig          дата по правилу (до переноса)
 * @property {string} date
 * @property {number} slot
 * @property {string} group
 * @property {number} course
 * @property {string} subject
 * @property {string} lessonType
 * @property {string} color
 * @property {string} room
 * @property {boolean} cancelled
 * @property {boolean} moved
 * @property {'pdf'|'manual'} source
 */

const newId = () =>
  globalThis.crypto && crypto.randomUUID
    ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2);

const EDITABLE = ['group', 'course', 'subject', 'lessonType', 'color', 'room'];

/** Исходное расписание на 29 октября 2026. @returns {State} */
export function seed() {
  const P = 'ПК первого ин. яз.';
  const rule = (id, group, course, wd, slot, from, source) => ({
    id,
    group,
    course,
    subject: P,
    lessonType: 'ЛР',
    color: '',
    room: '',
    weekday: wd,
    slot,
    from,
    until: null,
    teacher: '',
    source,
    importKey:
      source === 'pdf' ? `${course}|${group}|${wd}|${slot}|${P}` : null,
  });
  return {
    schema: SCHEMA,
    rules: [
      rule('seed-221-tu-1', '221', 2, 1, 1, '2026-09-22', 'pdf'),
      rule('seed-124-tu-2', '124', 1, 1, 2, '2026-09-22', 'pdf'),
      rule('seed-326-we-5', '326', 3, 2, 5, '2026-10-28', 'manual'),
      rule('seed-323-we-6', '323', 3, 2, 6, '2026-09-23', 'pdf'),
      rule('seed-323-we-7', '323', 3, 2, 7, '2026-09-23', 'pdf'),
      rule('seed-326-sa-1', '326', 3, 5, 1, '2026-09-26', 'pdf'),
    ],
    exceptions: {},
    oneOffs: [],
  };
}

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
    const fromPdf = ['t1', 't2', 't4', 't5', 't6'];
    s = {
      schema: 2,
      rules: s.tpl.map((t) => ({
        id: t.id,
        group: t.group,
        course: +t.course,
        subject: t.subject,
        lessonType: 'ЛР',
        color: t.color || '',
        room: '',
        weekday: t.weekday,
        slot: t.slot,
        from: t.from,
        until: t.until || null,
        teacher: '',
        source: fromPdf.includes(t.id) ? 'pdf' : 'manual',
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
        lessonType: 'ЛР',
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

const exKey = (ruleId, date) => `${ruleId}|${date}`;
const splitKey = (k) => {
  const i = k.indexOf('|');
  return [k.slice(0, i), k.slice(i + 1)];
};
const ruleActiveOn = (r, date) =>
  date >= r.from &&
  (!r.until || date <= r.until) &&
  weekday(date) === r.weekday;

/** @returns {Occurrence} */
function occFromRule(r, date, e) {
  const p = e.patch || {};
  const pick = (f) => (f in p ? p[f] : r[f]);
  return {
    type: 'rule',
    id: exKey(r.id, date),
    ruleId: r.id,
    orig: date,
    group: pick('group'),
    course: pick('course'),
    subject: pick('subject'),
    lessonType: pick('lessonType'),
    color: pick('color'),
    room: pick('room'),
    date: e.moveTo ? e.moveTo.date : date,
    slot: e.moveTo ? e.moveTo.slot : r.slot,
    cancelled: !!e.cancelled,
    moved: !!e.moveTo,
    source: r.source,
  };
}

/**
 * Все занятия недели, с учётом переносов в неё и из неё.
 * @param {State} s
 * @param {string} ws  понедельник недели
 * @returns {Occurrence[]}
 */
export function weekOccurrences(s, ws) {
  const we = addDays(ws, 6),
    inWeek = (d) => d >= ws && d <= we,
    out = [];
  for (const r of s.rules) {
    const date = addDays(ws, r.weekday);
    if (!ruleActiveOn(r, date)) continue;
    const e = s.exceptions[exKey(r.id, date)] || {};
    if (!e.deleted && !e.moveTo) out.push(occFromRule(r, date, e));
  }
  for (const k in s.exceptions) {
    // перенесённые сюда с других дат
    const e = s.exceptions[k];
    if (!e.moveTo || e.deleted || !inWeek(e.moveTo.date)) continue;
    const [id, date] = splitKey(k),
      r = s.rules.find((x) => x.id === id);
    if (r && ruleActiveOn(r, date)) out.push(occFromRule(r, date, e));
  }
  for (const o of s.oneOffs)
    if (inWeek(o.date))
      out.push({ ...o, type: 'once', orig: o.date, moved: false });
  return out;
}

/** Ближайшая неотменённая пара, которая ещё не закончилась. */
export function nextPair(s, now) {
  const today = toIso(now);
  for (let w = 0; w < 4; w++) {
    const list = weekOccurrences(s, addDays(weekStart(today), 7 * w))
      .filter((o) => !o.cancelled)
      .map((o) => ({
        ...o,
        start: atTime(o.date, CONFIG.slots[o.slot - 1].start),
        end: atTime(o.date, CONFIG.slots[o.slot - 1].end),
      }))
      .filter((o) => o.end > now)
      .sort((a, b) => a.start - b.start);
    if (list.length) return list[0];
  }
  return null;
}

/** Начало и конец слота в эту дату — объекты Date. */
const slotTimes = (date, slot) => ({
  start: atTime(date, CONFIG.slots[slot - 1].start),
  end: atTime(date, CONFIG.slots[slot - 1].end),
});

/** Идёт ли пара прямо сейчас: не отменена и начало ≤ now < конец. */
export function isOngoing(o, now) {
  if (o.cancelled) return false;
  const { start, end } = slotTimes(o.date, o.slot);
  return start <= now && now < end;
}

/** Слот уже в прошлом: его начало ≤ now. Значит, и пара, которая идёт сейчас, — прошлое. */
export function isPastSlot(date, slot, now) {
  return slotTimes(date, slot).start <= now;
}

/** Кто уже занимает слот (отменённые не считаются). */
export function busyAt(s, date, slot, exceptId) {
  return (
    weekOccurrences(s, weekStart(date)).find(
      (o) =>
        o.date === date && o.slot === slot && !o.cancelled && o.id !== exceptId,
    ) || null
  );
}

/** Занятие в слоте: сначала неотменённое, иначе любое. */
export function findAt(s, date, slot) {
  const list = weekOccurrences(s, weekStart(date)).filter(
    (o) => o.date === date && o.slot === slot,
  );
  return list.find((o) => !o.cancelled) || list[0] || null;
}

function cleanException(s, k) {
  const e = s.exceptions[k];
  if (!e) return;
  if (e.patch && !Object.keys(e.patch).length) delete e.patch;
  if (!e.cancelled) delete e.cancelled;
  if (!e.deleted) delete e.deleted;
  if (!Object.keys(e).length) delete s.exceptions[k];
}

/* Ниже — изменения. Они меняют переданную копию s; снаружи их вызывает только reduce(). */

function applyChange(s, o, changes, scope) {
  if (o.type === 'once') {
    Object.assign(
      s.oneOffs.find((x) => x.id === o.id),
      changes,
    );
    return;
  }
  const r = s.rules.find((x) => x.id === o.ruleId);
  if (scope === 'one') {
    // только эта дата: исключение
    const k = exKey(r.id, o.orig),
      e = s.exceptions[k] || (s.exceptions[k] = {}),
      p = { ...(e.patch || {}) };
    for (const f of EDITABLE)
      if (f in changes) {
        if (changes[f] === r[f]) delete p[f];
        else p[f] = changes[f];
      }
    e.patch = p;
    if ('date' in changes || 'slot' in changes) {
      const nd = changes.date ?? o.date,
        ns = changes.slot ?? o.slot;
      if (nd === o.orig && ns === r.slot) delete e.moveTo;
      else e.moveTo = { date: nd, slot: ns };
    }
    cleanException(s, k);
    return;
  }
  // эта и все следующие: правило делится на «до» и «после»
  const nd = changes.date ?? o.orig,
    ns = changes.slot ?? r.slot,
    fields = {};
  for (const f of EDITABLE) if (f in changes) fields[f] = changes[f];
  const nwd = weekday(nd);
  if (r.from >= o.orig) {
    // правило начинается с этой даты — меняем его целиком
    const k = exKey(r.id, o.orig),
      keepCancel = s.exceptions[k] && s.exceptions[k].cancelled;
    delete s.exceptions[k];
    if (nwd !== r.weekday)
      for (const kk of Object.keys(s.exceptions))
        if (kk.startsWith(r.id + '|')) delete s.exceptions[kk];
    Object.assign(r, fields, { weekday: nwd, slot: ns, from: nd });
    if (keepCancel) s.exceptions[exKey(r.id, nd)] = { cancelled: true };
  } else {
    const nr = {
      ...r,
      ...fields,
      id: newId(),
      weekday: nwd,
      slot: ns,
      from: nd,
      until: r.until,
      source: 'manual',
    };
    for (const k of Object.keys(s.exceptions)) {
      const [id, d] = splitKey(k);
      if (id !== r.id || d < o.orig) continue;
      if (nwd === r.weekday && d !== o.orig)
        s.exceptions[exKey(nr.id, d)] = s.exceptions[k];
      delete s.exceptions[k];
    }
    r.until = addDays(o.orig, -1);
    s.rules.push(nr);
  }
}

function removeOccurrence(s, o, scope) {
  if (o.type === 'once') {
    s.oneOffs = s.oneOffs.filter((x) => x.id !== o.id);
    return;
  }
  const r = s.rules.find((x) => x.id === o.ruleId);
  if (scope === 'one') {
    (s.exceptions[exKey(r.id, o.orig)] ||= {}).deleted = true;
    return;
  }
  if (r.from >= o.orig) {
    s.rules = s.rules.filter((x) => x !== r);
    for (const k of Object.keys(s.exceptions))
      if (k.startsWith(r.id + '|')) delete s.exceptions[k];
  } else {
    r.until = addDays(o.orig, -1);
    for (const k of Object.keys(s.exceptions)) {
      const [id, d] = splitKey(k);
      if (id === r.id && d >= o.orig) delete s.exceptions[k];
    }
  }
}

function setCancelled(s, o, value) {
  if (o.type === 'once') {
    s.oneOffs.find((x) => x.id === o.id).cancelled = value;
    return;
  }
  const k = exKey(o.ruleId, o.orig);
  (s.exceptions[k] ||= {}).cancelled = value;
  cleanException(s, k);
}

function addPair(s, f) {
  const base = {
    group: f.group,
    course: f.course,
    subject: f.subject,
    lessonType: 'ЛР',
    color: f.color,
    room: f.room || '',
    teacher: '',
  };
  if (f.repeat)
    s.rules.push({
      id: newId(),
      ...base,
      weekday: weekday(f.date),
      slot: f.slot,
      from: f.date,
      until: null,
      source: 'manual',
      importKey: null,
    });
  else
    s.oneOffs.push({
      id: newId(),
      ...base,
      date: f.date,
      slot: f.slot,
      cancelled: false,
      source: 'manual',
    });
}

/**
 * Единственная точка изменения данных. Возвращает НОВОЕ состояние.
 * Каждое действие — обычный объект, его можно сохранить в очередь
 * и потом отправить на сервер (v2).
 * @param {State} state
 * @param {{type:string}} action
 * @returns {State}
 */
export function reduce(state, action) {
  const s = structuredClone(state);
  switch (action.type) {
    case 'add':
      addPair(s, action.pair);
      break;
    case 'edit':
      applyChange(s, action.occ, action.changes, action.scope);
      break;
    case 'delete':
      removeOccurrence(s, action.occ, action.scope);
      break;
    case 'setCancelled':
      setCancelled(s, action.occ, action.value);
      break;
    case 'reset':
      return seed();
    case 'load':
      return migrate(action.data);
    default:
      throw new Error('Неизвестное действие: ' + action.type);
  }
  return s;
}
