/* Состояние экрана (не данные!): какая неделя открыта и что на ней сейчас нарисовано. */
import {
  toIso,
  addDays,
  weekday,
  weekStart,
  DAYS_PER_WEEK,
  SUNDAY,
} from '../domain/dates.js';

/** Неделя «сейчас»; в воскресенье — уже следующая. */
export const thisWeek = () => {
  const t = toIso(new Date());
  return weekday(t) === SUNDAY
    ? addDays(weekStart(t), DAYS_PER_WEEK)
    : weekStart(t);
};

export const ui = {
  week: thisWeek(), // понедельник открытой недели
  occ: [], // занятия, которые сейчас в сетке
  today: '', // дата последней полной перерисовки: сменилась — значит, прошла полночь
};
