/* Хранилище. Состояние живёт в одной переменной и меняется только через dispatch.
   Кто хочет знать об изменениях — подписывается через subscribe (так же устроен React). */
import {STORAGE_KEY, LEGACY_KEY} from './config.js';
import {seed, migrate, reduce} from './model.js';

let storageOk = true;
const listeners = new Set();
let saveErrorHandler = () => {};

function loadState() {
  for (const key of [STORAGE_KEY, LEGACY_KEY]) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return migrate(JSON.parse(raw));
    } catch (e) { if (e instanceof DOMException) storageOk = false; }
  }
  return seed();
}

function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }
  catch (e) { if (storageOk) { storageOk = false; saveErrorHandler(); } }
}

let state = loadState();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

export const getState = () => state;
export const isStorageOk = () => storageOk;
/** Что делать, если сохранить не получилось (показывает интерфейс). */
export const onSaveError = fn => { saveErrorHandler = fn; };

/** Подписка на изменения. Возвращает функцию отписки. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Единственный способ изменить данные. */
export function dispatch(action) {
  state = reduce(state, action);
  saveState(state);
  listeners.forEach(fn => fn(state));
}
