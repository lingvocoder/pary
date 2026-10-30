/* Состояние экрана (не данные!): какая неделя открыта и что на ней сейчас нарисовано. */
import {toIso, addDays, weekday, weekStart} from '../dates.js';

/** Неделя «сейчас»; в воскресенье — уже следующая. */
export const thisWeek = () => { const t = toIso(new Date()); return weekday(t) === 6 ? addDays(weekStart(t), 7) : weekStart(t); };

export const ui = {
  week: thisWeek(),   // понедельник открытой недели
  occ: []             // занятия, которые сейчас в сетке
};
