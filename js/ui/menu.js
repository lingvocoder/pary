/* Меню: резервная копия, загрузка из копии, сброс. */
import { APP_VERSION } from '../config.js';
import { toIso } from '../dates.js';
import { getState, dispatch, isStorageOk } from '../store.js';
import { $, toast } from './helpers.js';
import { openSheet } from './sheets.js';
import { iconArrowDownTray, iconArrowUpTray, iconArrowPath } from './icons.js';

/** Пункт меню: иконка, название и пояснение. */
const item = (action, icon, title, hint) =>
  `<button class="menu-item" data-a="${action}">${icon}<span class="menu-item__text"><span class="menu-item__title">${title}</span><span class="menu-item__hint">${hint}</span></span></button>`;

export function openMenu() {
  const { root, close } = openSheet(
    `<div class="sheet__header"><h2 class="sheet__title">Меню</h2></div>
    <div class="menu-list">
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
    if (a === 'export') {
      const blob = new Blob([JSON.stringify(getState(), null, 1)], {
        type: 'application/json',
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `pary-${toIso(new Date())}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 2000);
      close();
      toast('Копия скачана', 'success');
    } else if (a === 'import') {
      close();
      $('#file').click();
    } else if (a === 'reset') {
      close();
      const ok = await new Promise((res) => {
        const s = openSheet(
          `<div class="sheet__header"><h2 class="sheet__title">Вернуть исходное расписание?</h2><p class="sheet__note">Все правки пропадут. Сначала можно скачать резервную копию.</p></div>
          <div class="sheet__actions"><button class="btn btn--danger" data-v="1">Да, сбросить правки</button><button class="btn btn--plain" data-v="">Отмена</button></div>`,
          'Сброс',
        );
        s.root.onclick = (ev) => {
          const x = ev.target.closest('[data-v]');
          if (x) {
            s.close();
            res(!!x.dataset.v);
          }
        };
      });
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
    try {
      dispatch({ type: 'load', data: JSON.parse(await f.text()) });
      toast('Расписание загружено', 'success');
    } catch (_) {
      toast('Это не файл резервной копии расписания', 'error');
    }
  };
}
