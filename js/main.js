/* Точка входа: связывает хранилище, отрисовку и обработчики. */
import {addDays} from './dates.js';
import {subscribe, onSaveError} from './store.js';
import {$, toast} from './ui/helpers.js';
import {ui, thisWeek} from './ui/state.js';
import {render, renderHero} from './ui/week.js';
import {initGestures} from './ui/gestures.js';
import {initBackupInput} from './ui/menu.js';

subscribe(render);                       // любое изменение данных → перерисовка
onSaveError(() => toast('Не получается сохранить: правки пропадут после закрытия'));

initGestures($('#week'));
initBackupInput();

$('#prev').onclick = () => { ui.week = addDays(ui.week, -7); render(); };
$('#next').onclick = () => { ui.week = addDays(ui.week, 7); render(); };
$('#tod').onclick = () => { ui.week = thisWeek(); render(); };
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderHero(); });
setInterval(renderHero, 30000);          // «через 1 ч 10 мин» обновляется само

render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
