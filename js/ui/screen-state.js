/* Состояние экрана (не данные!): какая неделя открыта и что на ней сейчас нарисовано. */
import { toIso, weekToShow } from '../domain/dates.js';

/** Понедельник недели, которую показывать сейчас; в воскресенье — уже следующей. */
export const currentWeekStart = () => weekToShow(toIso(new Date()));

export const screenState = {
  weekStartDate: currentWeekStart(), // понедельник открытой недели
  lessons: [], // занятия, которые сейчас в сетке
  renderedDay: '', // дата последней полной перерисовки: сменилась — значит, прошла полночь
};
