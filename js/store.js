/* Хранилище. Состояние живёт в одной переменной и меняется только через dispatch.
   Кто хочет знать об изменениях — подписывается через subscribe (так же устроен React). */
import { STORAGE_KEY, LEGACY_KEY, PREFS_KEY } from './config.js';
import { seed, migrate, reduce } from './model.js';

let storageOk = true;
const listeners = new Set();
let saveErrorHandler = () => {};

function loadState() {
  for (const key of [STORAGE_KEY, LEGACY_KEY]) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return migrate(JSON.parse(raw));
    } catch (e) {
      if (e instanceof DOMException) storageOk = false;
    }
  }
  return seed();
}

function saveState(s) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch (e) {
    if (storageOk) {
      storageOk = false;
      saveErrorHandler();
    }
  }
}

let state = loadState();
if (navigator.storage && navigator.storage.persist)
  navigator.storage.persist().catch(() => {});

export const getState = () => state;
export const isStorageOk = () => storageOk;
/** Что делать, если сохранить не получилось (показывает интерфейс). */
export const onSaveError = (fn) => {
  saveErrorHandler = fn;
};

/** Подписка на изменения. Возвращает функцию отписки. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Единственный способ изменить данные. */
export function dispatch(action) {
  state = reduce(state, action);
  saveState(state);
  listeners.forEach((fn) => fn(state));
}

/* Настройки интерфейса (например, «подсказку уже видели»).
   Отдельный ключ PREFS_KEY, вне State: схема данных и резервная копия их не касаются. */

/** Читает все настройки. Битый JSON или недоступное хранилище — пустые настройки. */
function readPrefs() {
  try {
    const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    return prefs && typeof prefs === 'object' && !Array.isArray(prefs)
      ? prefs
      : {};
  } catch (_) {
    return {};
  }
}

/** Значение настройки или fallback, если её ещё нет. */
export function getPref(name, fallback) {
  const prefs = readPrefs();
  return name in prefs ? prefs[name] : fallback;
}

/** Сохраняет одну настройку. Если хранилище недоступно — молча, это не данные. */
export function setPref(name, value) {
  const prefs = readPrefs();
  prefs[name] = value;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (_) {
    // настройка просто не запомнится
  }
}
