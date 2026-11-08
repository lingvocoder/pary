/* Времена и размеры интерфейса: касания, тосты, шторки, подсказка, часы на экране. */

// Касания. Проверено на Samsung Galaxy A54 — менять только с проверкой на телефоне.
export const LONG_PRESS_MS = 280; // удержание до начала переноса
export const SCROLL_SLOP_PX = 10; // палец сдвинулся раньше — это прокрутка, а не перенос
export const MOUSE_SLOP_PX = 6; // сдвиг мыши, после которого начинается перенос
export const TOUCH_MOUSE_GAP_MS = 800; // мышиные события сразу после касания игнорируются
export const HOLD_VIBRATION_MS = 12; // короткая вибрация: перенос начался

export const TOAST_DURATION_MS = 2600; // сколько висит уведомление

/* Шторка удаляется, когда погасло затемнение: пара в app.css — transition: opacity 0.18s у .sheet.
   Панель .sheet__panel уезжает за 0.2s, то есть исчезает на 20 мс раньше конца — известный
   рассинхрон, в roadmap на потом. */
export const SHEET_CLOSE_MS = 180;

/** Сколько жить ссылке на файл резервной копии: браузеру хватает, чтобы начать скачивание. */
export const DOWNLOAD_URL_LIFETIME_MS = 2000;

/** Как часто обновлять «через 1 ч 10 мин», текущую пару и точки «идёт сейчас». */
export const CLOCK_REFRESH_MS = 30000;

// Подсказка по тапу. Пары в app.css: --space-2 (8 px) и поля страницы --space-4 (16 px).
export const POPOVER_GAP_PX = 8; // между карточкой и подсказкой
export const SCREEN_EDGE_PX = 16; // от левого и правого края экрана
export const SCREEN_TOP_BOTTOM_GAP_PX = 8; // от верхнего и нижнего края экрана

/** На сколько недель вперёд искать следующую пару для шапки. */
export const UPCOMING_WEEKS = 4;
