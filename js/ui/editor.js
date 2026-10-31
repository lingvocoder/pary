/* Редактор пары: новая или существующая. */
import { CONFIG, DAY_NAME, DAY_IN } from '../config.js';
import { weekday, humanDate } from '../dates.js';
import { busyAt, findAt } from '../model.js';
import { getState, dispatch } from '../store.js';
import { esc, toast, slotOf } from './helpers.js';
import { openSheet, askScope } from './sheets.js';
import { gcalUrl } from './calendar.js';

/**
 * @param {Object|null} o       занятие или null для новой пары
 * @param {{date:string, slot:number}} [preset]  куда добавить новую
 */
export function openEditor(o, preset) {
  const state = getState();
  const isNew = !o;
  const v = isNew
    ? {
        group: '',
        course: 3,
        subject: CONFIG.subjects[0],
        room: '',
        color: '',
        date: preset.date,
        slot: preset.slot,
        cancelled: false,
      }
    : { ...o };
  const rule =
    !isNew && o.type === 'rule'
      ? state.rules.find((r) => r.id === o.ruleId)
      : null;
  let info = '';
  if (rule) {
    info = `Повторяется каждую неделю. ${rule.source === 'pdf' ? 'Из PDF факультета.' : 'Добавлена вручную.'}`;
    if (o.moved)
      info += ` На этой неделе перенесена, обычно ${DAY_NAME[rule.weekday]}, ${slotOf(rule.slot).start}.`;
  } else if (!isNew) info = 'Разовая пара.';
  const slots = CONFIG.slots
    .map(
      (s, i) =>
        `<option value="${i + 1}"${v.slot === i + 1 ? ' selected' : ''}>${i + 1}-я, ${s.start}</option>`,
    )
    .join('');
  const { root, close } = openSheet(
    `
    <h2 class="sheet__title">${isNew ? 'Новая пара' : 'Группа ' + esc(v.group)}</h2>
    ${info ? `<p class="sheet__info">${esc(info)}</p>` : ''}
    <div class="form-row form-row--group-course">
      <div class="field"><label class="field__label" for="eg">Группа</label><input class="field__input" type="text" id="eg" inputmode="numeric" autocomplete="off" value="${esc(v.group)}" placeholder="326"></div>
      <div class="field"><span class="field__label">Курс</span><div class="course-picker" id="ec">${[1, 2, 3, 4].map((c) => `<button class="course-picker__button" data-c="${c}" aria-pressed="${+v.course === c}">${c}</button>`).join('')}</div></div>
    </div>
    <div class="form-row">
      <div class="field"><label class="field__label" for="es">Предмет</label><input class="field__input" type="text" id="es" list="subjects" value="${esc(v.subject)}"><datalist id="subjects">${CONFIG.subjects.map((s) => `<option value="${esc(s)}">`).join('')}</datalist></div>
      <div class="field"><label class="field__label" for="er">Аудитория</label><input class="field__input" type="text" id="er" autocomplete="off" value="${esc(v.room)}" placeholder="например, 301"></div>
    </div>
    <div class="form-row form-row--date-slot">
      <div class="field"><label class="field__label" for="ed">Дата</label><input class="field__input" type="date" id="ed" value="${v.date}"></div>
      <div class="field"><label class="field__label" for="ep">Пара</label><select class="field__input" id="ep">${slots}</select></div>
    </div>
    <div class="field"><span class="field__label">Цвет</span><div class="color-picker" id="ecol">${CONFIG.palette.map((p) => `<button class="color-picker__swatch${p.id ? '' : ' color-picker__swatch--default'}" data-col="${p.id}" style="--sw:${p.hex || 'transparent'}" aria-label="${p.name}" aria-pressed="${(v.color || '') === p.id}"></button>`).join('')}</div></div>
    ${
      isNew
        ? `<label class="toggle"><span><span class="toggle__title">Каждую неделю</span><span class="toggle__description">Иначе пара будет только в эту дату</span></span><input class="toggle__input" type="checkbox" id="erep" checked></label>`
        : `<label class="toggle"><span><span class="toggle__title">Отменена</span><span class="toggle__description">${rule ? `Только ${humanDate(o.orig)}. ` : ''}Пара останется в сетке размытой.</span></span><input class="toggle__input" type="checkbox" id="eoff"${v.cancelled ? ' checked' : ''}></label>`
    }
    <button class="btn btn--primary" id="esave">${isNew ? 'Добавить' : 'Сохранить'}</button>
    ${isNew ? '' : '<div class="button-pair"><button class="btn btn--secondary" id="ecal">В Google Календарь</button><button class="btn btn--danger-text" id="edel">Удалить пару</button></div>'}`,
    isNew ? 'Новая пара' : 'Группа ' + v.group,
  );

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
  const read = () => ({
    group: root.querySelector('#eg').value.trim(),
    course,
    subject: root.querySelector('#es').value.trim(),
    room: root.querySelector('#er').value.trim(),
    color,
    date: root.querySelector('#ed').value,
    slot: +root.querySelector('#ep').value,
  });

  root.querySelector('#esave').onclick = async () => {
    const f = read();
    if (!f.group) {
      toast('Укажи номер группы');
      root.querySelector('#eg').focus();
      return;
    }
    if (!f.date) {
      toast('Выбери дату');
      return;
    }
    if (weekday(f.date) === 6) {
      toast('В воскресенье пар нет, выбери другой день');
      return;
    }
    if (isNew) {
      const b = busyAt(getState(), f.date, f.slot);
      if (b) {
        toast(`В этом слоте уже группа ${b.group}`);
        return;
      }
      f.repeat = root.querySelector('#erep').checked;
      close();
      dispatch({ type: 'add', pair: f });
      toast(
        f.repeat
          ? `Добавлено: ${DAY_IN[weekday(f.date)]}, ${slotOf(f.slot).start}, каждую неделю`
          : `Добавлено: ${humanDate(f.date)}, ${slotOf(f.slot).start}`,
      );
      return;
    }
    const changes = {};
    for (const k of ['group', 'course', 'subject', 'room', 'color'])
      if (String(f[k]) !== String(o[k] ?? '')) changes[k] = f[k];
    if (f.date !== o.date) changes.date = f.date;
    if (f.slot !== o.slot) changes.slot = f.slot;
    if ('date' in changes || 'slot' in changes) {
      const b = busyAt(getState(), f.date, f.slot, o.id);
      if (b) {
        toast(`В этом слоте уже группа ${b.group}`);
        return;
      }
    }
    const off = root.querySelector('#eoff').checked;
    if (Object.keys(changes).length) {
      const scope = await askScope(o, 'Сохранить изменения?');
      if (!scope) return;
      close();
      dispatch({ type: 'edit', occ: o, changes, scope });
      if (off !== o.cancelled) {
        const after = findAt(getState(), f.date, f.slot);
        if (after) dispatch({ type: 'setCancelled', occ: after, value: off });
      }
    } else {
      close();
      if (off !== o.cancelled)
        dispatch({ type: 'setCancelled', occ: o, value: off });
    }
    toast('Сохранено');
  };
  if (!isNew) {
    root.querySelector('#edel').onclick = async () => {
      const scope = await askScope(o, `Удалить группу ${o.group}?`);
      if (!scope) return;
      close();
      dispatch({ type: 'delete', occ: o, scope });
      toast('Пара удалена');
    };
    root.querySelector('#ecal').onclick = () =>
      window.open(gcalUrl(o), '_blank', 'noopener');
  }
}
