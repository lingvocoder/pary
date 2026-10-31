/* Меню: резервная копия, загрузка из копии, сброс. */
import { APP_VERSION } from '../config.js';
import { toIso } from '../dates.js';
import { getState, dispatch, isStorageOk } from '../store.js';
import { $, toast } from './helpers.js';
import { openSheet } from './sheets.js';

const ico = (d) =>
  `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export function openMenu() {
  const { root, close } = openSheet(
    `<h2 class="sheet__title">Меню</h2>
    <button class="menu-item" disabled>${ico('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 12v6M9 15l3 3 3-3"/>')}<span><b class="menu-item__title">Импорт расписания из PDF</b><small class="menu-item__hint">Появится в следующей версии</small></span></button>
    <button class="menu-item" data-a="export">${ico('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>')}<span><b class="menu-item__title">Скачать резервную копию</b><small class="menu-item__hint">Файл со всем расписанием и правками</small></span></button>
    <button class="menu-item" data-a="import">${ico('<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>')}<span><b class="menu-item__title">Загрузить из копии</b><small class="menu-item__hint">Заменит текущее расписание</small></span></button>
    <button class="menu-item menu-item--danger" data-a="reset">${ico('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>')}<span><b class="menu-item__title">Вернуть исходное расписание</b><small class="menu-item__hint">Шесть пар на 29 октября, все правки пропадут</small></span></button>
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
      toast('Копия скачана');
    } else if (a === 'import') {
      close();
      $('#file').click();
    } else if (a === 'reset') {
      close();
      const ok = await new Promise((res) => {
        const s = openSheet(
          `<h2 class="sheet__title">Вернуть исходное расписание?</h2><p class="sheet__note">Все правки пропадут. Сначала можно скачать резервную копию.</p>
          <button class="btn btn--danger" data-v="1">Да, сбросить правки</button><button class="btn btn--plain" data-v="">Отмена</button>`,
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
        toast('Расписание сброшено');
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
      toast('Расписание загружено');
    } catch (_) {
      toast('Это не файл резервной копии расписания');
    }
  };
}
