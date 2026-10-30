/* Ссылка «Добавить в Google Календарь» для одного занятия. */
import {CONFIG} from '../config.js';
import {slotOf} from './helpers.js';
import {getState} from '../store.js';

export function gcalUrl(o) {
  const sl = slotOf(o.slot), d = o.date.replace(/-/g, '');
  const p = new URLSearchParams({
    action: 'TEMPLATE', text: `Гр. ${o.group}, ${o.subject}`,
    dates: `${d}T${sl.start.replace(':', '')}00/${d}T${sl.end.replace(':', '')}00`, ctz: CONFIG.timezone,
    details: `${o.course} курс, ${o.slot}-я пара`
  });
  if (o.room) p.set('location', `ауд. ${o.room}`);
  if (o.type === 'rule' && !o.moved) {                       // повторяющаяся — с повтором каждую неделю
    const r = getState().rules.find(x => x.id === o.ruleId);
    p.set('recur', 'RRULE:FREQ=WEEKLY' + (r.until ? `;UNTIL=${r.until.replace(/-/g, '')}T205959Z` : ''));
  }
  return 'https://calendar.google.com/calendar/render?' + p.toString();
}
