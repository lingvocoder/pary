/* Страница: поиск элемента и экранирование текста перед вставкой в HTML. */

/** Первый элемент по CSS-селектору. */
export const $ = (selector) => document.querySelector(selector);

const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Экранирует текст перед вставкой в HTML — защита от «сломанной» разметки. */
export const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);
