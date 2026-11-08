/* Редактор пары: новая или существующая. */
import { SUBJECTS, HOLIDAYS } from '../config/university.js';
import { calendarLink } from '../domain/calendar-link.js';
import {
  formatEditorInfo,
  formatGroupTitle,
  formatCancelSwitchNote,
  formatHolidayDate,
  formatAddedToast,
  formatDeleteQuestion,
  formatDeleteOneOffNote,
} from '../domain/texts.js';
import {
  LESSON_KIND,
  isPastSlot,
  isHoliday,
  findLessonAt,
  findRule,
} from '../domain/lessons.js';
import { OPERATION, PLACE_KIND, can, canPlace } from '../domain/rules.js';
import { ACTION } from '../domain/changes.js';
import {
  knownSubjects,
  newLessonDraft,
  validateLessonForm,
  diffLessonChanges,
  FORM_FIELD,
} from '../domain/forms.js';
import { getState, dispatch } from '../store/store.js';
import { toast, TOAST_KIND } from './toast.js';
import { openSheet, askScope, askConfirm } from './sheets.js';
import { editorView, OTHER_SUBJECT_OPTION } from './views/editor.js';

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
      toast(r.reason, TOAST_KIND.ERROR);
      return;
    }
  }
  const v = isNew ? newLessonDraft(preset) : { ...o };
  const rule = isNew ? null : findRule(state, o.ruleId) || null;
  const info = formatEditorInfo(isNew ? null : o, rule);
  // предметы: из настроек, затем из данных; текущий — если его нет в списке
  const subjects = knownSubjects(state, SUBJECTS);
  if (v.subject && !subjects.includes(v.subject)) subjects.push(v.subject);
  const title = isNew ? 'Новая пара' : formatGroupTitle(v.group);
  const toggle = isNew
    ? {
        title: 'Каждую неделю',
        description: REPEAT_TEXT,
        id: 'erep',
        isChecked: true,
      }
    : {
        title: 'Отменена',
        description: formatCancelSwitchNote(o),
        id: 'eoff',
        isChecked: v.cancelled,
      };
  const canAddToCalendar =
    !isNew &&
    can({
      operation: OPERATION.CALENDAR,
      lesson: o,
      now: new Date(),
      state,
      holidays,
    }).ok;
  const { root, close } = openSheet(
    editorView({
      isNew,
      title,
      info,
      values: v,
      subjects,
      toggle,
      canAddToCalendar,
    }),
    title,
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
    otherField.hidden = subjectSelect.value !== OTHER_SUBJECT_OPTION;
    if (!otherField.hidden) otherInput.focus();
  };
  const readSubject = () =>
    subjectSelect.value === OTHER_SUBJECT_OPTION
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
    toast(r.reason, TOAST_KIND.ERROR);
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
      TOAST_KIND.ERROR,
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
    const validation = validateLessonForm(f);
    if (!validation.ok) {
      toast(validation.reason, TOAST_KIND.ERROR);
      if (validation.field === FORM_FIELD.GROUP)
        root.querySelector('#eg').focus();
      if (validation.field === FORM_FIELD.SUBJECT) otherInput.focus();
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
      toast(formatAddedToast(f), TOAST_KIND.SUCCESS);
      return;
    }
    const changes = diffLessonChanges(o, f);
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
        toast(r.reason, TOAST_KIND.ERROR);
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
        toast(r.reason, TOAST_KIND.ERROR);
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
    toast('Сохранено', TOAST_KIND.SUCCESS);
  };
  if (!isNew) {
    root.querySelector('#edel').onclick = async () => {
      if (!stillAllowed(OPERATION.DELETE)) return;
      const scope = await askDeleteScope(o);
      if (!scope || !stillAllowed(OPERATION.DELETE)) return;
      close();
      dispatch({ type: ACTION.DELETE, lesson: o, scope });
      toast('Пара удалена', TOAST_KIND.SUCCESS);
    };
    const calendarButton = root.querySelector('#ecal');
    if (calendarButton)
      calendarButton.onclick = () =>
        window.open(calendarLink(o, rule), '_blank', 'noopener');
  }
}
