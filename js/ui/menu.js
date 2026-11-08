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
import { toast, TOAST_KIND } from './toast.js';
import { openSheet, askConfirm } from './sheets.js';
import { openHours } from './hours.js';
import { menuView, MENU_ACTION } from './views/menu.js';
import { currentWeekStart } from './screen-state.js';

const BACKUP_MIME_TYPE = 'application/json';

/** «Скачать резервную копию»: всё состояние — в файл pary-ГГГГ-ММ-ДД.json. */
function downloadBackup() {
  const blob = new Blob([JSON.stringify(getState(), null, 1)], {
    type: BACKUP_MIME_TYPE,
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${BACKUP_FILE_PREFIX}${toIso(new Date())}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), DOWNLOAD_URL_LIFETIME_MS);
}

async function resetSchedule() {
  const isConfirmed = await askConfirm(
    'Вернуть исходное расписание?',
    'Все правки пропадут. Сначала можно скачать резервную копию.',
    'Да, сбросить правки',
  );
  if (!isConfirmed) return;
  dispatch({ type: ACTION.RESET });
  toast('Расписание сброшено', TOAST_KIND.SUCCESS);
}

/** Что делает каждый пункт меню. Меню закрывается до действия. */
const MENU_HANDLERS = {
  [MENU_ACTION.HOURS]: openHours,
  [MENU_ACTION.EXPORT]: () => {
    downloadBackup();
    toast('Копия скачана', TOAST_KIND.SUCCESS);
  },
  [MENU_ACTION.IMPORT]: () => $('#backup-file').click(),
  [MENU_ACTION.RESET]: resetSchedule,
};

export function openMenu() {
  const { root, close } = openSheet(
    menuView({ versionLine: formatVersionLine(APP_VERSION, isStorageOk()) }),
    'Меню',
  );
  root.onclick = (event) => {
    const item = event.target.closest('[data-action]');
    if (!item) return;
    close();
    MENU_HANDLERS[item.dataset.action]();
  };
}

/** Резервная копия из файла: сначала проверка, потом вопрос, потом замена. */
async function loadBackup(file) {
  // чужой файл — ошибка, и никакого вопроса
  let backup, backupWeekCount;
  try {
    backup = migrate(JSON.parse(await file.text()));
    backupWeekCount = weekLessons(backup, currentWeekStart()).length;
  } catch {
    toast('Это не файл резервной копии расписания', TOAST_KIND.ERROR);
    return;
  }
  const isConfirmed = await askConfirm(
    'Заменить расписание?',
    formatReplaceNote(backupWeekCount),
    'Да, заменить',
  );
  if (!isConfirmed) return;
  dispatch({ type: ACTION.LOAD, backup });
  toast('Расписание загружено', TOAST_KIND.SUCCESS);
}

/** Скрытое поле выбора файла для «Загрузить из копии». */
export function initBackupInput() {
  $('#backup-file').onchange = (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (file) loadBackup(file);
  };
}
