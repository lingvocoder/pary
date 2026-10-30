/* Шторки снизу и вопрос «только эта дата или дальше». */
import {esc, hideToast} from './helpers.js';
import {humanDate} from '../dates.js';

/** Открывает шторку с готовым HTML. Возвращает {root, scrim, close}. */
export function openSheet(html, label) {
  const scrim = document.createElement('div'); scrim.className = 'scrim';
  scrim.innerHTML = `<section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}"><span class="grab"></span>${html}</section>`;
  document.body.appendChild(scrim);
  hideToast();
  requestAnimationFrame(() => scrim.classList.add('open'));
  const close = () => { scrim.classList.remove('open'); setTimeout(() => scrim.remove(), 180); };
  scrim.addEventListener('click', e => { if (e.target === scrim) close(); });
  return {root: scrim.querySelector('.sheet'), scrim, close};
}

/** Спрашивает «только эта дата или дальше». Возвращает 'one' | 'future' | null. */
export function askScope(o, title, note) {
  if (o.type === 'once') return Promise.resolve('one');
  return new Promise(resolve => {
    const {root, scrim, close} = openSheet(`<h2>${esc(title)}</h2>${note ? `<p class="note">${esc(note)}</p>` : ''}
      <button class="opt" data-v="one"><b>Только ${humanDate(o.orig)}</b><small>Остальные недели не меняются</small></button>
      <button class="opt" data-v="future"><b>${humanDate(o.orig)} и все следующие недели</b><small>Прошлые недели останутся как были</small></button>
      <button class="btn plain" data-v="">Отмена</button>`, title);
    let done = false;
    const finish = v => { if (done) return; done = true; close(); resolve(v || null); };
    root.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) finish(b.dataset.v); });
    scrim.addEventListener('click', e => { if (e.target === scrim) finish(''); });
  });
}
