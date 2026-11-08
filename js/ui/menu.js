/* Меню: резервная копия, загрузка из копии, сброс. */
import { APP_VERSION, BACKUP_FILE_PREFIX } from '../config/app.js';
import { DOWNLOAD_URL_LIFETIME_MS } from '../config/interface.js';
import { formatReplaceNote, formatVersionLine } from '../domain/texts.js';
import { toIso } from '../domain/dates.js';
import { weekLessons } from '../domain/lessons.js';
import { ACTION } from '../domain/changes.js';
import { migrate } from '../domain/migrate.js';
import { getState, dispatch, isStorageOk } from '../store/store.js';
import { $ } from './dom.js';
import { toast } from './helpers.js';
import { openSheet, askConfirm } from './sheets.js';
import { openHours } from './hours.js';
import { menuView } from './views/menu.js';
import { thisWeek } from './state.js';

export function openMenu() {
  const { root, close } = openSheet(
    menuView({ versionLine: formatVersionLine(APP_VERSION, isStorageOk()) }),
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
        dispatch({ type: ACTION.RESET });
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
    let copy, copyWeekCount;
    try {
      copy = migrate(JSON.parse(await f.text()));
      copyWeekCount = weekLessons(copy, thisWeek()).length;
    } catch (_) {
      toast('Это не файл резервной копии расписания', 'error');
      return;
    }
    const ok = await askConfirm(
      'Заменить расписание?',
      formatReplaceNote(copyWeekCount),
      'Да, заменить',
    );
    if (!ok) return;
    dispatch({ type: ACTION.LOAD, backup: copy });
    toast('Расписание загружено', 'success');
  };
}
