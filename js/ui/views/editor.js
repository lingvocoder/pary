/* Редактор занятия: заголовок, поля формы, переключатель, кнопки. Собран из маленьких частей. */
import { COURSES, PALETTE, SLOTS } from '../../config/university.js';
import { formatSlotOption } from '../../domain/texts.js';
import { esc } from '../dom.js';
import { iconCalendar, iconChevronDown } from '../icons.js';

/* Значение пункта «Другой…» в списке предметов. Пустая строка не совпадёт ни с одним
   предметом: предмет без названия невозможен — форма его не пропустит («Укажи предмет»),
   а список предметов пустые названия отбрасывает. */
export const OTHER_SUBJECT_OPTION = '';

/** Поле, которое открывает системный выбор (список или календарь): значок браузера скрыт,
    вместо него chevron-down справа — одинаково у всех трёх. */
const pickerView = (control) =>
  `<div class="field__picker">${control}${iconChevronDown('field__chevron')}</div>`;

const selectView = (id, options) =>
  pickerView(`<select class="field__input" id="${id}">${options}</select>`);

/** Переключатель: <input role="switch"> внутри label — касание по всей строке. */
const switchRowView = ({ title, description, id, isChecked }) =>
  `<label class="toggle"><span class="toggle__text"><span class="toggle__title">${title}</span><span class="toggle__description">${description}</span></span><span class="switch"><input class="switch__input" type="checkbox" role="switch" id="${id}"${isChecked ? ' checked' : ''}><span class="switch__knob" aria-hidden="true"></span></span></label>`;

const slotOptionsView = (selectedSlot) =>
  SLOTS.map((bell, slotIndex) => {
    const slot = slotIndex + 1;
    return `<option value="${slot}"${selectedSlot === slot ? ' selected' : ''}>${formatSlotOption(slot)}</option>`;
  }).join('');

const subjectOptionsView = (subjects, selectedSubject) =>
  subjects
    .map(
      (subject) =>
        `<option value="${esc(subject)}"${subject === selectedSubject ? ' selected' : ''}>${esc(subject)}</option>`,
    )
    .join('') + `<option value="${OTHER_SUBJECT_OPTION}">Другой…</option>`;

const courseButtonsView = (selectedCourse) =>
  COURSES.map(
    (course) =>
      `<button class="course-picker__button" data-c="${course}" aria-pressed="${selectedCourse === course}">${course}</button>`,
  ).join('');

const colorSwatchesView = (selectedColor) =>
  PALETTE.map(
    (paletteColor) =>
      `<button class="color-picker__swatch ${paletteColor.tint ? 'tint-' + paletteColor.tint : 'color-picker__swatch--default'}" data-col="${paletteColor.id}" aria-label="${paletteColor.name}" aria-pressed="${selectedColor === paletteColor.id}"></button>`,
  ).join('');

const headerView = (title, info) => `
    <div class="sheet__header">
      <h2 class="sheet__title">${esc(title)}</h2>
      ${info ? `<p class="sheet__note">${esc(info)}</p>` : ''}
    </div>`;

/** Кнопки существующего занятия: «В календарь» (если можно) и «Удалить пару». */
const lessonButtonsView = (canAddToCalendar) =>
  `<div class="button-pair">${canAddToCalendar ? `<button class="btn btn--secondary" id="ecal">${iconCalendar('btn__icon')}В календарь</button>` : ''}<button class="btn btn--danger-text" id="edel">Удалить пару</button></div>`;

/**
 * @param {Object} editor
 * @param {boolean} editor.isNew
 * @param {string} editor.title           «Новая пара» или «Группа 323»
 * @param {string} editor.info            пояснение под заголовком; '' — нет
 * @param {{group: string, course: number, subject: string, room: string, date: string,
 *   slot: number, color: string, cancelled: boolean}} editor.values
 * @param {string[]} editor.subjects      пункты списка предметов
 * @param {{title: string, description: string, id: string, isChecked: boolean}} editor.toggle
 * @param {boolean} editor.canAddToCalendar
 * @returns {string} HTML
 */
export function editorView(editor) {
  const { values } = editor;
  return `${headerView(editor.title, editor.info)}
    <div class="form-row">
      <div class="field"><label class="field__label" for="eg">Группа</label><input class="field__input" type="text" id="eg" inputmode="numeric" autocomplete="off" value="${esc(values.group)}" placeholder="326"></div>
      <div class="field"><span class="field__label">Курс</span><div class="course-picker" id="ec">${courseButtonsView(+values.course)}</div></div>
    </div>
    <div class="form-row">
      <div class="field"><label class="field__label" for="es">Предмет</label>${selectView('es', subjectOptionsView(editor.subjects, values.subject))}</div>
      <div class="field"><label class="field__label" for="er">Аудитория</label><input class="field__input" type="text" id="er" autocomplete="off" value="${esc(values.room)}" placeholder="например, 301"></div>
    </div>
    <div class="field" id="esOtherField" hidden><label class="field__label" for="esOther">Название предмета</label><input class="field__input" type="text" id="esOther" autocomplete="off"></div>
    <div class="form-row">
      <div class="field"><label class="field__label" for="ed">Дата</label>${pickerView(`<input class="field__input" type="date" id="ed" value="${values.date}">`)}</div>
      <div class="field"><label class="field__label" for="ep">Пара</label>${selectView('ep', slotOptionsView(values.slot))}</div>
    </div>
    <div class="field"><span class="field__label">Цвет</span><div class="color-picker" id="ecol">${colorSwatchesView(values.color || '')}</div></div>
    ${switchRowView(editor.toggle)}
    ${editor.isNew ? '' : lessonButtonsView(editor.canAddToCalendar)}
    <div class="sheet__footer"><button class="btn btn--primary" id="esave">${editor.isNew ? 'Добавить' : 'Сохранить'}</button></div>`;
}
