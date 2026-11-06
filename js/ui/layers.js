/* Слои поверх экрана — подсказка и шторки — и кнопка «Назад» на Android.

   Каждому открытому слою соответствует одна запись в истории браузера: «Назад»
   убирает запись, а popstate закрывает слой. Здесь только сверка «сколько слоёв
   открыто» и «сколько записей в истории»; кто и чем закрыт, этот файл не знает. */

/** Открытые слои снизу вверх. @type {{dismiss: function(): void}[]} */
const openLayers = [];
let historyDepth = 0; // сколько наших записей сейчас в истории
let historyMoving = false; // ждём popstate: пока он не пришёл, историю трогать нельзя
let syncPlanned = false;

/** Приводит число записей в истории к числу открытых слоёв. */
function syncHistory() {
  syncPlanned = false;
  if (historyMoving) return; // допроверим, когда придёт popstate
  while (historyDepth < openLayers.length) {
    historyDepth += 1;
    history.pushState({ layerDepth: historyDepth }, '');
  }
  if (historyDepth > openLayers.length) {
    historyMoving = true;
    history.go(openLayers.length - historyDepth);
  }
}

/**
 * Сверка — отложенно, а не сразу. Если один слой сменяет другой в том же действии
 * («Изменить» в подсказке открывает редактор), число слоёв не меняется и запись
 * остаётся та же: ни новой записи, ни лишнего шага назад.
 */
function planSync() {
  if (syncPlanned) return;
  syncPlanned = true;
  setTimeout(syncHistory, 0);
}

/**
 * Регистрирует открытый слой.
 * @param {function(): void} dismiss  что сделать по «Назад» или Esc — как «Отмена»
 * @returns {Object} слой: его потом передают в removeLayer
 */
export function addLayer(dismiss) {
  const layer = { dismiss };
  openLayers.push(layer);
  planSync();
  return layer;
}

/** Слой закрыли: из интерфейса или через dismiss. Второй вызов ничего не делает. */
export function removeLayer(layer) {
  const index = openLayers.indexOf(layer);
  if (index === -1) return;
  openLayers.splice(index, 1);
  planSync();
}

/** Подключает «Назад» и Esc. Вызывается один раз при запуске. */
export function initLayers() {
  window.addEventListener('popstate', (event) => {
    historyMoving = false;
    historyDepth = event.state?.layerDepth ?? 0;
    // history.go() из syncHistory приходит сюда же: слоёв выше этой глубины уже нет
    while (openLayers.length > historyDepth) openLayers.pop().dismiss();
    syncHistory();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !openLayers.length) return;
    openLayers.pop().dismiss();
    planSync(); // слой уже снят со стека, removeLayer сверку не запустит
  });
  // Страницу перезагрузили при открытом слое (например, пришло обновление):
  // слоя больше нет, а запись осталась. Уходим с неё, иначе «Назад» сработает вхолостую.
  const staleDepth = history.state?.layerDepth ?? 0;
  if (staleDepth) {
    historyMoving = true;
    history.go(-staleDepth);
  }
}
