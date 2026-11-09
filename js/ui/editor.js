/* Редактор занятия: новое или существующее. Что можно и что изменилось, решают
   domain/rules.js и domain/forms.js; здесь — поля, кнопки и порядок шагов. */
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
import { ACTION, SCOPE } from '../domain/changes.js';
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

/** Спросить модель с текущим временем: можно ли сделать операцию с занятием. */
const askRules = (operation, lesson) =>
  can({
    operation,
    lesson,
    now: new Date(),
    state: getState(),
    holidays: HOLIDAYS,
  });

/**
 * Что именно удалить. У повторяющегося — «эта дата или дальше», у разового — подтверждение:
 * вернуть его не получится.
 * @returns {Promise<string|null>} одно из SCOPE или null — передумали
 */
async function askDeleteScope(lesson) {
  if (lesson.type !== LESSON_KIND.ONE_OFF)
    return askScope(lesson, formatDeleteQuestion(lesson));
  const confirmed = await askConfirm(
    'Удалить пару?',
    formatDeleteOneOffNote(lesson),
    'Удалить пару',
  );
  return confirmed ? SCOPE.THIS_DATE : null;
}

/** Данные для представления редактора. */
function editorModel(lesson, values) {
  const isNew = !lesson;
  const state = getState();
  const rule = isNew ? null : findRule(state, lesson.ruleId) || null;
  // предметы: из настроек, затем из данных; текущий — если его нет в списке
  const subjects = knownSubjects(state, SUBJECTS);
  if (values.subject && !subjects.includes(values.subject))
    subjects.push(values.subject);
  const toggle = isNew
    ? {
        title: 'Каждую неделю',
        description: REPEAT_TEXT,
        id: 'editor-weekly',
        isChecked: true,
      }
    : {
        title: 'Отменена',
        description: formatCancelSwitchNote(lesson),
        id: 'editor-cancelled',
        isChecked: values.cancelled,
      };
  return {
    isNew,
    title: isNew ? 'Новая пара' : formatGroupTitle(values.group),
    info: formatEditorInfo(lesson, rule),
    values,
    subjects,
    toggle,
    canAddToCalendar: !isNew && askRules(OPERATION.CALENDAR, lesson).ok,
    rule,
  };
}

/**
 * Группа кнопок «выбери одно» (курс, цвет): нажатая отмечается aria-pressed.
 * @param {Element} group
 * @param {string} dataKey      имя data-атрибута со значением кнопки
 * @param {*} initialValue
 * @returns {function(): *} что выбрано сейчас
 */
function setupChoiceGroup(group, dataKey, initialValue) {
  let selected = initialValue;
  group.onclick = (event) => {
    const button = event.target.closest(`[data-${dataKey}]`);
    if (!button) return;
    selected = button.dataset[dataKey];
    group
      .querySelectorAll(`[data-${dataKey}]`)
      .forEach((candidate) =>
        candidate.setAttribute('aria-pressed', candidate === button),
      );
  };
  return () => selected;
}

/**
 * Календарь по клику в любом месте поля — только при мыши (pointer: fine):
 * в Chrome на компьютере значок скрыт, без showPicker() поле бы не открылось.
 * На сенсорном экране календарь открывает система, второй вызов там не нужен.
 */
function setupDatePicker(dateInput) {
  const hasMouse = matchMedia('(pointer: fine)').matches;
  dateInput.onclick = () => {
    if (!hasMouse || !dateInput.showPicker) return;
    try {
      dateInput.showPicker();
    } catch {
      // выбор уже открыт или браузер против — поле всё равно редактируется
    }
  };
}

/** «Другой…» — под списком появляется поле для названия. Возвращает чтение предмета. */
function setupOtherSubject(root) {
  const subjectSelect = root.querySelector('#editor-subject');
  const otherField = root.querySelector('#editor-other-subject-field');
  const otherInput = root.querySelector('#editor-other-subject');
  subjectSelect.onchange = () => {
    otherField.hidden = subjectSelect.value !== OTHER_SUBJECT_OPTION;
    if (!otherField.hidden) otherInput.focus();
  };
  return () =>
    subjectSelect.value === OTHER_SUBJECT_OPTION
      ? otherInput.value.trim()
      : subjectSelect.value;
}

/**
 * «Каждую неделю»: в начавшейся или прошедшей клетке — выключен и неактивен.
 * Выбор пользователя запоминаем, чтобы вернуть его, если дату сдвинут вперёд.
 */
function setupWeeklyToggle(root, dateInput) {
  const weekly = root.querySelector('#editor-weekly');
  const weeklyNote = weekly
    .closest('.toggle')
    .querySelector('.toggle__description');
  const slotSelect = root.querySelector('#editor-slot');
  let isWeeklyWanted = weekly.checked;
  weekly.onchange = () => (isWeeklyWanted = weekly.checked);
  const updateWeekly = () => {
    const isPast =
      !!dateInput.value &&
      isPastSlot(dateInput.value, +slotSelect.value, new Date());
    weekly.disabled = isPast;
    weekly.checked = isPast ? false : isWeeklyWanted;
    weeklyNote.textContent = isPast ? REPEAT_PAST_TEXT : REPEAT_TEXT;
  };
  dateInput.addEventListener('change', updateWeekly);
  slotSelect.addEventListener('change', updateWeekly);
  updateWeekly();
}

/** Можно ли поставить занятие в клетку; нельзя — тост, про праздник — с датой. */
function isPlaceAllowed(kind, form, exceptLessonId) {
  const answer = canPlace({
    kind,
    date: form.date,
    slot: form.slot,
    now: new Date(),
    state: getState(),
    holidays: HOLIDAYS,
    exceptLessonId,
  });
  if (answer.ok) return true;
  const reason = isHoliday(form.date, HOLIDAYS)
    ? formatHolidayDate(form.date)
    : answer.reason;
  toast(reason, TOAST_KIND.ERROR);
  return false;
}

/** Новое занятие: проверить клетку и добавить. */
function saveNewLesson(form, close) {
  const kind = form.isWeekly ? PLACE_KIND.ADD_RULE : PLACE_KIND.ADD_ONE_OFF;
  if (!isPlaceAllowed(kind, form)) return;
  close();
  dispatch({ type: ACTION.ADD, newLesson: form });
  toast(formatAddedToast(form), TOAST_KIND.SUCCESS);
}

/** Переключатель «Отменена» поменяли: это «Вернуть» или «Отменить» — спросить модель. */
function isCancelSwitchAllowed(lesson, isCancelled, isPlaceChanged) {
  // вернуть в занятый слот нельзя; при переносе свободу нового слота уже проверил canPlace
  const isRestore = !isCancelled && lesson.cancelled && !isPlaceChanged;
  const isCancel = isCancelled && !lesson.cancelled;
  if (!isRestore && !isCancel) return true;
  const operation = isRestore ? OPERATION.RESTORE : OPERATION.CANCEL;
  const answer = askRules(operation, lesson);
  if (!answer.ok) toast(answer.reason, TOAST_KIND.ERROR);
  return answer.ok;
}

/**
 * Записать правку. Если и переключатель «Отменена» меняли — отметить занятие
 * на новом месте: после переноса старого места у него уже нет.
 */
function dispatchEdit({ lesson, changes, scope, form, isCancelled }) {
  dispatch({ type: ACTION.EDIT, lesson, changes, scope });
  if (isCancelled === lesson.cancelled) return;
  const movedLesson = findLessonAt(getState(), form.date, form.slot);
  if (movedLesson)
    dispatch({ type: ACTION.SET_CANCELLED, lesson: movedLesson, isCancelled });
}

/**
 * Правка существующего занятия. Порядок шагов — как в 0.4.0.
 * @param {OpenedEditor} editor
 * @param {Object} form          поля формы
 * @param {boolean} isCancelled  положение переключателя «Отменена»
 */
async function saveLessonChanges(editor, form, isCancelled) {
  const { lesson, stillAllowed, close } = editor;
  const changes = diffLessonChanges(lesson, form);
  if (!stillAllowed(OPERATION.EDIT)) return;
  // праздник, прошлое и занятость — только если занятие ставят на новое место
  const isPlaceChanged = 'date' in changes || 'slot' in changes;
  if (isPlaceChanged && !isPlaceAllowed(PLACE_KIND.MOVE, form, lesson.id))
    return;
  if (!isCancelSwitchAllowed(lesson, isCancelled, isPlaceChanged)) return;
  const hasChanges = Object.keys(changes).length > 0;
  const isCancelChanged = isCancelled !== lesson.cancelled;
  // ничего не меняли — просто закрыть: сохранять нечего, и тост был бы неправдой
  if (!hasChanges && !isCancelChanged) {
    close();
    return;
  }
  if (hasChanges) {
    const scope = await askScope(lesson, 'Сохранить изменения?');
    if (!scope || !stillAllowed(OPERATION.EDIT)) return;
    close();
    dispatchEdit({ lesson, changes, scope, form, isCancelled });
  } else {
    close();
    dispatch({ type: ACTION.SET_CANCELLED, lesson, isCancelled });
  }
  toast('Сохранено', TOAST_KIND.SUCCESS);
}

/** Кнопки существующего занятия: «Удалить пару» и «В календарь». */
function setupLessonButtons(editor) {
  const { root, lesson, rule, stillAllowed, close } = editor;
  root.querySelector('#editor-delete').onclick = async () => {
    if (!stillAllowed(OPERATION.DELETE)) return;
    const scope = await askDeleteScope(lesson);
    if (!scope || !stillAllowed(OPERATION.DELETE)) return;
    close();
    dispatch({ type: ACTION.DELETE, lesson, scope });
    toast('Пара удалена', TOAST_KIND.SUCCESS);
  };
  const calendarButton = root.querySelector('#editor-calendar');
  if (calendarButton)
    calendarButton.onclick = () =>
      window.open(calendarLink(lesson, rule), '_blank', 'noopener');
}

/**
 * Поля формы: курс, цвет, дата, «Другой…», «Каждую неделю».
 * @returns {function(): Object} чтение формы
 */
function setupForm(root, values, isNew) {
  const readCourse = setupChoiceGroup(
    root.querySelector('#editor-course'),
    'course',
    +values.course,
  );
  const readColor = setupChoiceGroup(
    root.querySelector('#editor-color'),
    'color',
    values.color || '',
  );
  const dateInput = root.querySelector('#editor-date');
  setupDatePicker(dateInput);
  const readSubject = setupOtherSubject(root);
  if (isNew) setupWeeklyToggle(root, dateInput);
  return () => ({
    group: root.querySelector('#editor-group').value.trim(),
    course: +readCourse(),
    subject: readSubject(),
    room: root.querySelector('#editor-room').value.trim(),
    color: readColor(),
    date: dateInput.value,
    slot: +root.querySelector('#editor-slot').value,
  });
}

/** Неверное поле: тост с причиной и фокус в это поле. */
function showValidationError(root, validation) {
  toast(validation.reason, TOAST_KIND.ERROR);
  if (validation.field === FORM_FIELD.GROUP)
    root.querySelector('#editor-group').focus();
  if (validation.field === FORM_FIELD.SUBJECT)
    root.querySelector('#editor-other-subject').focus();
}

/** «Добавить» / «Сохранить»: проверить форму и сохранить новое или изменённое занятие. */
function setupSaveButton(editor, readForm) {
  const { root, lesson, close } = editor;
  root.querySelector('#editor-save').onclick = () => {
    const form = readForm();
    const validation = validateLessonForm(form);
    if (!validation.ok) {
      showValidationError(root, validation);
      return;
    }
    if (!lesson) {
      form.isWeekly = root.querySelector('#editor-weekly').checked;
      saveNewLesson(form, close);
      return;
    }
    const isCancelled = root.querySelector('#editor-cancelled').checked;
    saveLessonChanges(editor, form, isCancelled);
  };
}

/**
 * Перед сохранением и удалением — проверка заново: занятие могло начаться,
 * пока шторка была открыта. Нельзя — тост, шторка закрывается, данные не меняются.
 */
const createStillAllowed = (lesson, close) => (operation) => {
  const answer = askRules(operation, lesson);
  if (answer.ok) return true;
  close();
  toast(answer.reason, TOAST_KIND.ERROR);
  return false;
};

/**
 * Открытый редактор — его получают все шаги сохранения и удаления.
 * @typedef {Object} OpenedEditor
 * @property {Element} root               панель шторки
 * @property {function(): void} close
 * @property {Lesson|null} lesson         null — новое занятие
 * @property {Rule|null} rule             правило повторяющегося занятия
 * @property {function(string): boolean} stillAllowed  можно ли операцию прямо сейчас
 */

/**
 * @param {Lesson|null} lesson  занятие или null — новое
 * @param {{date: string, slot: number}} [place]  куда добавить новое
 */
export function openEditor(lesson, place) {
  // начавшееся и прошедшее занятие не редактируем: это факт
  if (lesson) {
    const answer = askRules(OPERATION.EDIT, lesson);
    if (!answer.ok) {
      toast(answer.reason, TOAST_KIND.ERROR);
      return;
    }
  }
  const values = lesson ? { ...lesson } : newLessonDraft(place);
  const model = editorModel(lesson, values);
  const { root, close } = openSheet(editorView(model), model.title);
  // «Сохранить» закреплена внизу панели: нижний отступ даёт сама полоса с кнопкой
  root.classList.add('sheet__panel--with-footer');
  const stillAllowed = createStillAllowed(lesson, close);
  const editor = { root, close, lesson, rule: model.rule, stillAllowed };
  setupSaveButton(editor, setupForm(root, values, model.isNew));
  if (!model.isNew) setupLessonButtons(editor);
}
