/* Редактор пары: новая или существующая. */
import {
  SLOTS,
  COURSES,
  DEFAULT_COURSE,
  SUBJECTS,
  PALETTE,
  HOLIDAYS,
} from '../config/university.js';
import {
  formatEditorInfo,
  formatSlotOption,
  formatCancelSwitchNote,
  formatHolidayDate,
  formatAddedToast,
  formatDeleteQuestion,
  formatDeleteOneOffNote,
} from '../domain/texts.js';
import { weekday, SUNDAY } from '../domain/dates.js';
import {
  LESSON_KIND,
  isPastSlot,
  isHoliday,
  findLessonAt,
} from '../domain/lessons.js';
import { OPERATION, PLACE_KIND, can, canPlace } from '../domain/rules.js';
import { ACTION } from '../domain/changes.js';
import { knownSubjects } from '../domain/forms.js';
import { getState, dispatch } from '../store.js';
import { esc, toast } from './helpers.js';
import { openSheet, askScope, askConfirm } from './sheets.js';
import { gcalUrl } from './calendar.js';
import { iconCalendar, iconChevronDown } from './icons.js';

// значение пункта «Другой…» в списке предметов — не название предмета
const OTHER_SUBJECT = '__other__';

const REPEAT_TEXT = 'Иначе пара будет только в эту дату';
const REPEAT_PAST_TEXT = 'Задним числом — только разовая';

/**
 * Что именно удалить. У повторяющейся — «эта дата или дальше», у разовой — подтверждение:
 * вернуть её не получится.
 * @returns {Promise<'one'|'future'|null>}
 */
async function askDeleteScope(o) {
  if (o.type !== LESSON_KIND.ONE_OFF)
    return askScope(o, formatDeleteQuestion(o));
  const confirmed = await askConfirm(
    'Удалить пару?',
    formatDeleteOneOffNote(o),
    'Удалить пару',
  );
  return confirmed ? 'one' : null;
}

/**
 * @param {Object|null} o       занятие или null для новой пары
 * @param {{date:string, slot:number}} [preset]  куда добавить новую
 */
export function openEditor(o, preset) {
  const state = getState();
  const isNew = !o;
  const holidays = HOLIDAYS;
  // начавшуюся и прошедшую пару не редактируем: это факт
  if (!isNew) {
    const r = can({
      operation: OPERATION.EDIT,
      lesson: o,
      now: new Date(),
      state: state,
      holidays: holidays,
    });
    if (!r.ok) {
      toast(r.reason, 'error');
      return;
    }
  }
  const v = isNew
    ? {
        group: '',
        course: DEFAULT_COURSE,
        subject: SUBJECTS[0],
        room: '',
        color: '',
        date: preset.date,
        slot: preset.slot,
        cancelled: false,
      }
    : { ...o };
  const rule =
    !isNew && o.type === LESSON_KIND.RULE
      ? state.rules.find((r) => r.id === o.ruleId)
      : null;
  const info = formatEditorInfo(isNew ? null : o, rule);
  const slots = SLOTS.map(
    (s, i) =>
      `<option value="${i + 1}"${v.slot === i + 1 ? ' selected' : ''}>${formatSlotOption(i + 1)}</option>`,
  ).join('');
  // предметы: из настроек, затем из данных; текущий — если его нет в списке; последним — «Другой…»
  const subjects = knownSubjects(state, SUBJECTS);
  if (v.subject && !subjects.includes(v.subject)) subjects.push(v.subject);
  const subjectOptions =
    subjects
      .map(
        (s) =>
          `<option value="${esc(s)}"${s === v.subject ? ' selected' : ''}>${esc(s)}</option>`,
      )
      .join('') + `<option value="${OTHER_SUBJECT}">Другой…</option>`;
  // поле, которое открывает системный выбор (список или календарь):
  // значок браузера скрыт, вместо него chevron-down справа — одинаково у всех трёх
  const picker = (control) =>
    `<div class="field__picker">${control}${iconChevronDown('field__chevron')}</div>`;
  const select = (id, options) =>
    picker(`<select class="field__input" id="${id}">${options}</select>`);
  // переключатель: <input role="switch"> внутри label — касание по всей строке
  const switchRow = (title, description, id, checked) =>
    `<label class="toggle"><span class="toggle__text"><span class="toggle__title">${title}</span><span class="toggle__description">${description}</span></span><span class="switch"><input class="switch__input" type="checkbox" role="switch" id="${id}"${checked ? ' checked' : ''}><span class="switch__knob" aria-hidden="true"></span></span></label>`;
  const { root, close } = openSheet(
    `
    <div class="sheet__header">
      <h2 class="sheet__title">${isNew ? 'Новая пара' : 'Группа ' + esc(v.group)}</h2>
      ${info ? `<p class="sheet__note">${esc(info)}</p>` : ''}
    </div>
    <div class="form-row">
      <div class="field"><label class="field__label" for="eg">Группа</label><input class="field__input" type="text" id="eg" inputmode="numeric" autocomplete="off" value="${esc(v.group)}" placeholder="326"></div>
      <div class="field"><span class="field__label">Курс</span><div class="course-picker" id="ec">${COURSES.map((c) => `<button class="course-picker__button" data-c="${c}" aria-pressed="${+v.course === c}">${c}</button>`).join('')}</div></div>
    </div>
    <div class="form-row">
      <div class="field"><label class="field__label" for="es">Предмет</label>${select('es', subjectOptions)}</div>
      <div class="field"><label class="field__label" for="er">Аудитория</label><input class="field__input" type="text" id="er" autocomplete="off" value="${esc(v.room)}" placeholder="например, 301"></div>
    </div>
    <div class="field" id="esOtherField" hidden><label class="field__label" for="esOther">Название предмета</label><input class="field__input" type="text" id="esOther" autocomplete="off"></div>
    <div class="form-row">
      <div class="field"><label class="field__label" for="ed">Дата</label>${picker(`<input class="field__input" type="date" id="ed" value="${v.date}">`)}</div>
      <div class="field"><label class="field__label" for="ep">Пара</label>${select('ep', slots)}</div>
    </div>
    <div class="field"><span class="field__label">Цвет</span><div class="color-picker" id="ecol">${PALETTE.map((p) => `<button class="color-picker__swatch ${p.tint ? 'tint-' + p.tint : 'color-picker__swatch--default'}" data-col="${p.id}" aria-label="${p.name}" aria-pressed="${(v.color || '') === p.id}"></button>`).join('')}</div></div>
    ${
      isNew
        ? switchRow('Каждую неделю', REPEAT_TEXT, 'erep', true)
        : switchRow('Отменена', formatCancelSwitchNote(o), 'eoff', v.cancelled)
    }
    ${isNew ? '' : `<div class="button-pair">${can({ operation: OPERATION.CALENDAR, lesson: o, now: new Date(), state: state, holidays: holidays }).ok ? `<button class="btn btn--secondary" id="ecal">${iconCalendar('btn__icon')}В календарь</button>` : ''}<button class="btn btn--danger-text" id="edel">Удалить пару</button></div>`}
    <div class="sheet__footer"><button class="btn btn--primary" id="esave">${isNew ? 'Добавить' : 'Сохранить'}</button></div>`,
    isNew ? 'Новая пара' : 'Группа ' + v.group,
  );

  // «Сохранить» закреплена внизу панели: нижний отступ даёт сама полоса с кнопкой
  root.classList.add('sheet__panel--with-footer');

  let course = +v.course,
    color = v.color || '';
  root.querySelector('#ec').onclick = (e) => {
    const b = e.target.closest('[data-c]');
    if (!b) return;
    course = +b.dataset.c;
    root
      .querySelectorAll('.course-picker__button')
      .forEach((x) => x.setAttribute('aria-pressed', x === b));
  };
  root.querySelector('#ecol').onclick = (e) => {
    const b = e.target.closest('[data-col]');
    if (!b) return;
    color = b.dataset.col;
    root
      .querySelectorAll('.color-picker__swatch')
      .forEach((x) => x.setAttribute('aria-pressed', x === b));
  };
  // Календарь по клику в любом месте поля — только при мыши (pointer: fine):
  // в Chrome на компьютере значок скрыт, без showPicker() поле бы не открылось.
  // На сенсорном экране календарь открывает система, второй вызов там не нужен.
  // try: showPicker() бросает ошибку, если выбор уже открыт или браузер против.
  const dateInput = root.querySelector('#ed');
  const hasMouse = matchMedia('(pointer: fine)').matches;
  dateInput.onclick = () => {
    if (!hasMouse || !dateInput.showPicker) return;
    try {
      dateInput.showPicker();
    } catch {
      // браузер откроет календарь сам или не откроет — поле всё равно редактируется
    }
  };
  // «Другой…» — под списком появляется поле для названия
  const subjectSelect = root.querySelector('#es'),
    otherField = root.querySelector('#esOtherField'),
    otherInput = root.querySelector('#esOther');
  subjectSelect.onchange = () => {
    otherField.hidden = subjectSelect.value !== OTHER_SUBJECT;
    if (!otherField.hidden) otherInput.focus();
  };
  const readSubject = () =>
    subjectSelect.value === OTHER_SUBJECT
      ? otherInput.value.trim()
      : subjectSelect.value;
  // «Каждую неделю»: в начавшейся или прошедшей клетке — выключен и неактивен.
  // Выбор пользователя запоминаем, чтобы вернуть его, если дату сдвинут вперёд.
  if (isNew) {
    const repeat = root.querySelector('#erep'),
      repeatText = repeat
        .closest('.toggle')
        .querySelector('.toggle__description'),
      slotSelect = root.querySelector('#ep');
    let repeatWanted = repeat.checked;
    repeat.onchange = () => (repeatWanted = repeat.checked);
    const updateRepeat = () => {
      const past =
        !!dateInput.value &&
        isPastSlot(dateInput.value, +slotSelect.value, new Date());
      repeat.disabled = past;
      repeat.checked = past ? false : repeatWanted;
      repeatText.textContent = past ? REPEAT_PAST_TEXT : REPEAT_TEXT;
    };
    dateInput.addEventListener('change', updateRepeat);
    slotSelect.addEventListener('change', updateRepeat);
    updateRepeat();
  }

  /** Перед сохранением и удалением — проверка заново: пара могла начаться,
      пока шторка была открыта. Нельзя — тост, шторка закрывается, данные не меняются. */
  const stillAllowed = (op) => {
    const r = can({
      operation: op,
      lesson: o,
      now: new Date(),
      state: getState(),
      holidays: holidays,
    });
    if (r.ok) return true;
    close();
    toast(r.reason, 'error');
    return false;
  };
  /** Можно ли поставить пару в клетку; про праздник — с датой в тексте. */
  const placeAllowed = (kind, f, exceptId) => {
    const r = canPlace({
      kind: kind,
      date: f.date,
      slot: f.slot,
      now: new Date(),
      state: getState(),
      holidays: holidays,
      exceptLessonId: exceptId,
    });
    if (r.ok) return true;
    toast(
      isHoliday(f.date, holidays) ? formatHolidayDate(f.date) : r.reason,
      'error',
    );
    return false;
  };

  const read = () => ({
    group: root.querySelector('#eg').value.trim(),
    course,
    subject: readSubject(),
    room: root.querySelector('#er').value.trim(),
    color,
    date: dateInput.value,
    slot: +root.querySelector('#ep').value,
  });

  root.querySelector('#esave').onclick = async () => {
    const f = read();
    if (!f.group) {
      toast('Укажи номер группы', 'error');
      root.querySelector('#eg').focus();
      return;
    }
    if (!f.subject) {
      toast('Укажи предмет', 'error');
      otherInput.focus();
      return;
    }
    if (!f.date) {
      toast('Выбери дату', 'error');
      return;
    }
    if (weekday(f.date) === SUNDAY) {
      toast('В воскресенье пар нет, выбери другой день', 'error');
      return;
    }
    if (isNew) {
      f.isWeekly = root.querySelector('#erep').checked;
      if (
        !placeAllowed(
          f.isWeekly ? PLACE_KIND.ADD_RULE : PLACE_KIND.ADD_ONE_OFF,
          f,
        )
      )
        return;
      close();
      dispatch({ type: ACTION.ADD, newLesson: f });
      toast(formatAddedToast(f), 'success');
      return;
    }
    const changes = {};
    for (const k of ['group', 'course', 'subject', 'room', 'color'])
      if (String(f[k]) !== String(o[k] ?? '')) changes[k] = f[k];
    if (f.date !== o.date) changes.date = f.date;
    if (f.slot !== o.slot) changes.slot = f.slot;
    if (!stillAllowed(OPERATION.EDIT)) return;
    // праздник, прошлое и занятость — только если пару ставят на новое место
    const placeChanged = 'date' in changes || 'slot' in changes;
    if (placeChanged && !placeAllowed(PLACE_KIND.MOVE, f, o.id)) return;
    const off = root.querySelector('#eoff').checked;
    // «Отменена» выключили — это «Вернуть»: в занятый слот нельзя.
    // При переносе свободу нового слота уже проверил canPlace.
    if (!off && o.cancelled && !placeChanged) {
      const r = can({
        operation: OPERATION.RESTORE,
        lesson: o,
        now: new Date(),
        state: getState(),
        holidays: holidays,
      });
      if (!r.ok) {
        toast(r.reason, 'error');
        return;
      }
    }
    if (off && !o.cancelled) {
      const r = can({
        operation: OPERATION.CANCEL,
        lesson: o,
        now: new Date(),
        state: getState(),
        holidays: holidays,
      });
      if (!r.ok) {
        toast(r.reason, 'error');
        return;
      }
    }
    // ничего не меняли — просто закрыть: сохранять нечего, и тост был бы неправдой
    if (!Object.keys(changes).length && off === o.cancelled) {
      close();
      return;
    }
    if (Object.keys(changes).length) {
      const scope = await askScope(o, 'Сохранить изменения?');
      if (!scope || !stillAllowed(OPERATION.EDIT)) return;
      close();
      dispatch({ type: ACTION.EDIT, lesson: o, changes, scope });
      if (off !== o.cancelled) {
        const after = findLessonAt(getState(), f.date, f.slot);
        if (after)
          dispatch({
            type: ACTION.SET_CANCELLED,
            lesson: after,
            isCancelled: off,
          });
      }
    } else {
      close();
      if (off !== o.cancelled)
        dispatch({ type: ACTION.SET_CANCELLED, lesson: o, isCancelled: off });
    }
    toast('Сохранено', 'success');
  };
  if (!isNew) {
    root.querySelector('#edel').onclick = async () => {
      if (!stillAllowed(OPERATION.DELETE)) return;
      const scope = await askDeleteScope(o);
      if (!scope || !stillAllowed(OPERATION.DELETE)) return;
      close();
      dispatch({ type: ACTION.DELETE, lesson: o, scope });
      toast('Пара удалена', 'success');
    };
    const calendarButton = root.querySelector('#ecal');
    if (calendarButton)
      calendarButton.onclick = () =>
        window.open(gcalUrl(o), '_blank', 'noopener');
  }
}
