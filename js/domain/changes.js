/* Изменения данных: reduce() — единственная точка, через которую меняется состояние. */
import { DEFAULT_LESSON_TYPE } from '../config/university.js';
import { addDays, weekday } from './dates.js';
import { exKey, splitKey, busyAt } from './lessons.js';
import { seed } from './seed.js';
import { migrate } from './migrate.js';

const newId = () =>
  globalThis.crypto && crypto.randomUUID
    ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2);

const EDITABLE = ['group', 'course', 'subject', 'lessonType', 'color', 'room'];

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
  // вернуть в занятый слот нельзя: двух пар в одной клетке не бывает
  if (!value && busyAt(s, o.date, o.slot, o.id)) return;
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
    lessonType: DEFAULT_LESSON_TYPE,
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
