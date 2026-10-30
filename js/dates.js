/* Даты — строки 'YYYY-MM-DD' без часовых поясов. Чистые функции. */
import {MONTH_GEN} from './config.js';

export const pad = n => String(n).padStart(2, '0');
export const toIso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = fromIso(s); d.setDate(d.getDate() + n); return toIso(d); };
/** 0 = понедельник … 6 = воскресенье */
export const weekday = s => (fromIso(s).getDay() + 6) % 7;
/** Понедельник недели, в которую попадает дата. */
export const weekStart = s => addDays(s, -weekday(s));
/** Дата + время 'HH:MM' → объект Date. */
export const atTime = (date, hm) => { const d = fromIso(date); const [h, m] = hm.split(':').map(Number); d.setHours(h, m, 0, 0); return d; };
/** '2026-10-28' → '28 октября' */
export const humanDate = s => { const d = fromIso(s); return `${d.getDate()} ${MONTH_GEN[d.getMonth()]}`; };
