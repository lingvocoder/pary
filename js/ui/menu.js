/* Меню: резервная копия, загрузка из копии, сброс. */
import { APP_VERSION, BACKUP_FILE_PREFIX } from '../config/app.js';
import { DOWNLOAD_URL_LIFETIME_MS } from '../config/interface.js';
import { toIso } from '../domain/dates.js';
import { migrate } from '../domain/migrate.js';
import { weekOccurrences } from '../domain/lessons.js';
import { getState, dispatch, isStorageOk } from '../store.js';
import { $, toast, copyWeekSummary } from './helpers.js';
import { openSheet, askConfirm } from './sheets.js';
import {
  iconArrowDownTray,
  iconArrowUpTray,
  iconArrowPath,
  iconClock,
} from './icons.js';
import { openHours } from './hours.js';
import { thisWeek } from './state.js';

/** Пункт меню: иконка, название и пояснение. */
const item = (action, icon, title, hint) =>
  `<button class="menu-item" data-a="${action}">${icon}<span class="menu-item__text"><span class="menu-item__title">${title}</span><span class="menu-item__hint">${hint}</span></span></button>`;

export function openMenu() {
  const { root, close } = openSheet(
    `<div class="sheet__header"><h2 class="sheet__title">Меню</h2></div>
    <div class="menu-list">
      ${item('hours', iconClock('menu-item__icon'), 'Часы за семестр', 'Проведено и по расписанию, по группам')}
      ${item('export', iconArrowDownTray('menu-item__icon'), 'Скачать резервную копию', 'Файл со всем расписанием и правками')}
      ${item('import', iconArrowUpTray('menu-item__icon'), 'Загрузить из копии', 'Заменит текущее расписание')}
      ${item('reset', iconArrowPath('menu-item__icon'), 'Вернуть исходное расписание', 'Шесть пар на 29 октября, все правки пропадут')}
    </div>
    <p class="app-version">Версия ${APP_VERSION}${isStorageOk() ? '' : '. Сохранение недоступно в этом режиме браузера'}</p>`,
    'Меню',
  );
  root.onclick = async (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a;
    if (a === 'hours') {
      close();
      openHours();
    } else if (a === 'export') {
      const blob = new Blob([JSON.stringify(getState(), null, 1)], {
        type: 'application/json',
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${BACKUP_FILE_PREFIX}${toIso(new Date())}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(
        () => URL.revokeObjectURL(link.href),
        DOWNLOAD_URL_LIFETIME_MS,
      );
      close();
      toast('Копия скачана', 'success');
    } else if (a === 'import') {
      close();
      $('#file').click();
    } else if (a === 'reset') {
      close();
      const ok = await askConfirm(
        'Вернуть исходное расписание?',
        'Все правки пропадут. Сначала можно скачать резервную копию.',
        'Да, сбросить правки',
      );
      if (ok) {
        dispatch({ type: 'reset' });
        toast('Расписание сброшено', 'success');
      }
    }
  };
}

/** Скрытое поле выбора файла для «Загрузить из копии». */
export function initBackupInput() {
  $('#file').onchange = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    // сначала проверка: чужой файл — ошибка, и никакого вопроса
    let copy, summary;
    try {
      copy = migrate(JSON.parse(await f.text()));
      summary = copyWeekSummary(weekOccurrences(copy, thisWeek()).length);
    } catch (_) {
      toast('Это не файл резервной копии расписания', 'error');
      return;
    }
    const ok = await askConfirm(
      'Заменить расписание?',
      `${summary}. Текущее расписание и все правки пропадут. Сначала можно скачать резервную копию.`,
      'Да, заменить',
    );
    if (!ok) return;
    dispatch({ type: 'load', data: copy });
    toast('Расписание загружено', 'success');
  };
}
