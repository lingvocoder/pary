/* Точка входа: связывает хранилище, отрисовку и обработчики. */
import { CLOCK_REFRESH_MS } from './config/interface.js';
import { addDays, DAYS_PER_WEEK } from './domain/dates.js';
import { subscribe, onSaveError } from './store/store.js';
import { $ } from './ui/dom.js';
import { toast, TOAST_KIND } from './ui/toast.js';
import { screenState, currentWeekStart } from './ui/screen-state.js';
import { render, refreshNow } from './ui/week-screen.js';
import { initGestures } from './ui/gestures.js';
import { initLayers } from './ui/layers.js';
import { initBackupInput } from './ui/menu.js';

subscribe(render); // любое изменение данных → перерисовка
onSaveError(() =>
  toast(
    'Не получается сохранить: правки пропадут после закрытия',
    TOAST_KIND.ERROR,
  ),
);

initGestures($('#week'));
initLayers();
initBackupInput();

$('#week-prev').onclick = () => {
  screenState.weekStartDate = addDays(
    screenState.weekStartDate,
    -DAYS_PER_WEEK,
  );
  render();
};
$('#week-next').onclick = () => {
  screenState.weekStartDate = addDays(screenState.weekStartDate, DAYS_PER_WEEK);
  render();
};
$('#week-today').onclick = () => {
  screenState.weekStartDate = currentWeekStart();
  render();
};
// Пустой обработчик нужен ради :active: без него мобильный браузер может не показать
// нажатое состояние, пока палец держит кнопку. passive — прокрутку он не тормозит.
document.addEventListener('touchstart', () => {}, { passive: true });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshNow();
});
setInterval(refreshNow, CLOCK_REFRESH_MS); // «через 1 ч 10 мин», текущая пара и точки обновляются сами

render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  // Первый запуск после обновления обслуживает ещё старый service worker: HTML приходит
  // из сети новый, а CSS и JS — из старого кэша. Когда новый worker берёт страницу
  // под контроль, перезагружаем её один раз, чтобы все файлы были из одной версии.
  // При первой установке контроллера ещё не было — тогда перезагружать незачем.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
