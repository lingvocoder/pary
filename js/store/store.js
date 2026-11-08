/* Хранилище. Состояние живёт в одной переменной и меняется только через dispatch.
   Кто хочет знать об изменениях — подписывается через subscribe (так же устроен React). */
import { STORAGE_KEY, LEGACY_STORAGE_KEY } from '../config/app.js';
import { reduce } from '../domain/changes.js';
import { seed } from '../domain/seed.js';
import { migrate } from '../domain/migrate.js';

let storageOk = true;
const listeners = new Set();
let onSaveFailure = () => {};

/** Данные из телефона: сначала текущий ключ, потом ключ прототипа; ничего нет — исходное расписание. */
function loadState() {
  for (const key of [STORAGE_KEY, LEGACY_STORAGE_KEY]) {
    try {
      const savedText = localStorage.getItem(key);
      if (savedText) return migrate(JSON.parse(savedText));
    } catch (error) {
      // хранилище недоступно (приватный режим) — дальше без сохранения
      if (error instanceof DOMException) storageOk = false;
    }
  }
  return seed();
}

function saveState(nextState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  } catch {
    if (storageOk) {
      storageOk = false;
      onSaveFailure();
    }
  }
}

let state = loadState();
// просим браузер не стирать данные при нехватке места
if (navigator.storage && navigator.storage.persist)
  navigator.storage.persist().catch(() => {});

export const getState = () => state;
export const isStorageOk = () => storageOk;

/** Что делать, если сохранить не получилось (показывает интерфейс). */
export const onSaveError = (handler) => {
  onSaveFailure = handler;
};

/** Подписка на изменения. Возвращает функцию отписки. */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Единственный способ изменить данные. */
export function dispatch(action) {
  state = reduce(state, action);
  saveState(state);
  listeners.forEach((listener) => listener(state));
}
