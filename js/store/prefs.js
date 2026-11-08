/* Настройки интерфейса (например, «подсказку уже видели»).
   Отдельный ключ PREFS_KEY, вне State: схема данных и резервная копия их не касаются. */
import { PREFS_KEY } from '../config/app.js';

/** Читает все настройки. Битый JSON или недоступное хранилище — пустые настройки. */
function readPrefs() {
  try {
    const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    const isPlainObject =
      prefs && typeof prefs === 'object' && !Array.isArray(prefs);
    return isPlainObject ? prefs : {};
  } catch {
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
  } catch {
    // настройка просто не запомнится
  }
}
