/* Проверка стандарта кода (docs/architecture.md) по папке js/. Запуск: npm run check.
   Без зависимостей: маленький лексер убирает комментарии, строки и текст шаблонов,
   потом по оставшемуся коду ищутся короткие имена, числа без имени и запрещённые импорты.
   Ложное срабатывание по числу гасится пометкой в той же строке: // standard: <почему>. */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve, sep } from 'node:path';

// Двухбуквенные имена, которые являются словами, а не обрывками.
const ALLOWED_SHORT_NAMES = new Set(['id', 'to', 'ok', 'at', 'on', 'of']);
// Счётчики короткого цикла for — единственное исключение для одной буквы.
const LOOP_COUNTERS = new Set(['i', 'j']);
// Обрывки слов длиннее двух букв, которые уже встречались в коде.
const TRUNCATED_NAMES = new Set([
  'occ',
  'sl',
  'si',
  'ws',
  'we',
  'nd',
  'ns',
  'nwd',
  'nr',
  'ph',
  'ui',
  'ex',
  'tpl',
  'el',
  'ev',
  'cb',
  'fn',
  'tmp',
  'obj',
  'idx',
  'cnt',
  'str',
  'num',
  'arr',
  'msg',
  'btn',
  'ctx',
  'res',
  'req',
  'val',
  'hgt',
  'err',
  'opts',
  'prev',
  'cur',
]);
// Числа, которым имя не нужно.
const PLAIN_NUMBERS = new Set(['0', '1']);
// Пометка, которая гасит ложное срабатывание по числу в этой строке.
const NUMBER_WAIVER = '// standard:';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const JS_DIR = join(ROOT, 'js');

/** Все .js-файлы папки, рекурсивно. */
function listJsFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const fullPath = join(directory, name);
    if (statSync(fullPath).isDirectory()) return listJsFiles(fullPath);
    return name.endsWith('.js') ? [fullPath] : [];
  });
}

/**
 * Заменяет комментарии, строки и текст шаблонов пробелами (переводы строк сохраняются,
 * чтобы номера строк не съехали). Код внутри ${…} остаётся.
 */
function stripNonCode(source) {
  let output = '';
  let position = 0;
  const templateDepths = []; // глубина фигурных скобок, на которой открыт каждый ${
  let braceDepth = 0;
  let lastSignificant = '';
  const blank = (text) => text.replace(/[^\n]/g, ' ');
  const regexCanStart = () =>
    lastSignificant === '' || '(,=:[!&|?{};+-*%<>~^'.includes(lastSignificant);

  const readTemplateText = () => {
    // position стоит на первом символе текста шаблона
    let text = '';
    while (position < source.length) {
      const char = source[position];
      if (char === '\\') {
        text += source.slice(position, position + 2);
        position += 2;
      } else if (char === '`') {
        output += blank(text) + ' ';
        position += 1;
        lastSignificant = '`';
        return;
      } else if (char === '$' && source[position + 1] === '{') {
        output += blank(text) + '  ';
        position += 2;
        templateDepths.push(braceDepth);
        braceDepth += 1;
        lastSignificant = '{';
        return;
      } else {
        text += char;
        position += 1;
      }
    }
    output += blank(text);
  };

  while (position < source.length) {
    const char = source[position];
    const next = source[position + 1];
    if (char === '/' && next === '/') {
      const end = source.indexOf('\n', position);
      const stop = end === -1 ? source.length : end;
      output += blank(source.slice(position, stop));
      position = stop;
    } else if (char === '/' && next === '*') {
      const end = source.indexOf('*/', position + 2);
      const stop = end === -1 ? source.length : end + 2;
      output += blank(source.slice(position, stop));
      position = stop;
    } else if (char === "'" || char === '"') {
      let end = position + 1;
      while (end < source.length && source[end] !== char)
        end += source[end] === '\\' ? 2 : 1;
      output += blank(source.slice(position, end + 1));
      position = end + 1;
      lastSignificant = char;
    } else if (char === '`') {
      output += ' ';
      position += 1;
      readTemplateText();
    } else if (char === '/' && regexCanStart()) {
      let end = position + 1;
      let inClass = false;
      while (end < source.length && (inClass || source[end] !== '/')) {
        if (source[end] === '\\') end += 1;
        else if (source[end] === '[') inClass = true;
        else if (source[end] === ']') inClass = false;
        end += 1;
      }
      end += 1;
      while (/[a-z]/i.test(source[end] || '')) end += 1;
      output += blank(source.slice(position, end));
      position = end;
      lastSignificant = '/';
    } else if (
      char === '}' &&
      templateDepths.length &&
      templateDepths.at(-1) === braceDepth - 1
    ) {
      templateDepths.pop();
      braceDepth -= 1;
      output += ' ';
      position += 1;
      readTemplateText();
    } else {
      if (char === '{') braceDepth += 1;
      if (char === '}') braceDepth -= 1;
      if (!/\s/.test(char)) lastSignificant = /[\w$]/.test(char) ? 'w' : char;
      output += char;
      position += 1;
    }
  }
  return output;
}

/** Слой файла по его пути внутри js/. */
function layerOf(relativePath) {
  const parts = relativePath.split(sep);
  if (parts.length === 1) return parts[0] === 'main.js' ? 'main' : 'вне слоёв';
  if (parts[0] === 'ui' && parts[1] === 'views') return 'views';
  if (['config', 'lang', 'domain', 'store', 'ui'].includes(parts[0]))
    return parts[0];
  return 'вне слоёв';
}

// Кого может импортировать каждый слой (docs/architecture.md, «Кто кого может импортировать»).
const ALLOWED_IMPORTS = {
  config: [],
  lang: [],
  domain: ['config', 'lang', 'domain'],
  store: ['config', 'domain', 'store'],
  views: ['config', 'lang', 'domain', 'views'],
  ui: ['config', 'lang', 'domain', 'store', 'views', 'ui'],
  main: ['config', 'lang', 'domain', 'store', 'views', 'ui'],
};
// Файлы ui/, которые представлениям тоже можно: иконки и экранирование.
const VIEW_HELPERS = ['ui/icons.js', 'ui/dom.js'];

// Что запрещено писать в коде слоя.
const FORBIDDEN_CALLS = {
  domain: [
    /\bdocument\b/,
    /\bwindow\b/,
    /\blocalStorage\b/,
    /\bgetState\(/,
    /new Date\(\)/,
    /Date\.now\(/,
  ],
  views: [
    /\bdocument\b/,
    /\bwindow\b/,
    /\bgetState\(/,
    /\bdispatch\(/,
    /\bcan\(/,
    /\bcanPlace\(/,
    /new Date\(\)/,
    /Date\.now\(/,
  ],
};

/** Имена, которые объявляет строка кода: переменные, параметры функций и стрелок, catch. */
function declaredNames(line) {
  const names = [];
  for (const match of line.matchAll(/\b(?:const|let|var)\s+([\w$]+)/g))
    names.push(match[1]);
  for (const match of line.matchAll(
    /\b(?:const|let|var)\s+[\w$]+\s*=[^,;]*?,\s*([\w$]+)\s*=/g,
  ))
    names.push(match[1]);
  for (const match of line.matchAll(/^\s*([\w$]+)\s*=(?!=)/g))
    names.push(match[1]);
  for (const match of line.matchAll(/function\s*[\w$]*\s*\(([^)]*)\)/g))
    names.push(...splitParams(match[1]));
  for (const match of line.matchAll(/\(([^()]*)\)\s*=>/g))
    names.push(...splitParams(match[1]));
  for (const match of line.matchAll(/(?:^|[^\w$.])([\w$]+)\s*=>/g))
    names.push(match[1]);
  for (const match of line.matchAll(/catch\s*\(\s*([\w$]+)/g))
    names.push(match[1]);
  return names;
}
function splitParams(list) {
  return list
    .split(',')
    .map((param) => param.replace(/=.*$/, '').replace(/[{}[\]\s.]/g, ''))
    .filter(Boolean);
}

const problems = [];
const report = (file, lineNumber, message) =>
  problems.push(`${relative(ROOT, file)}:${lineNumber}: ${message}`);

for (const file of listJsFiles(JS_DIR)) {
  const relativePath = relative(JS_DIR, file);
  const layer = layerOf(relativePath);
  const source = readFileSync(file, 'utf8');
  const sourceLines = source.split('\n');
  const codeLines = stripNonCode(source).split('\n');
  const isConfig = layer === 'config';

  if (layer === 'вне слоёв')
    report(file, 1, 'файл вне слоёв из docs/architecture.md');

  // Внутри именованной константы-таблицы (const SEED_RULES = [ … ]) числа уже имеют имя.
  let namedConstantDepth = 0;
  const bracketBalance = (code) =>
    (code.match(/[[({]/g) || []).length - (code.match(/[\])}]/g) || []).length;

  codeLines.forEach((code, index) => {
    const lineNumber = index + 1;
    const original = sourceLines[index];
    const startsNamedConstant =
      /^\s*(?:export\s+)?const\s+[A-Z][A-Z0-9_]*\s*=/.test(code);
    const isInsideNamedConstant = namedConstantDepth > 0;
    if (startsNamedConstant || isInsideNamedConstant)
      namedConstantDepth = Math.max(
        0,
        namedConstantDepth + bracketBalance(code),
      );

    for (const name of declaredNames(code)) {
      if (name === '$') continue;
      const isLoopCounter = LOOP_COUNTERS.has(name) && /\bfor\s*\(/.test(code);
      if (
        name.length <= 2 &&
        !ALLOWED_SHORT_NAMES.has(name.toLowerCase()) &&
        !isLoopCounter
      )
        report(file, lineNumber, `короткое имя «${name}»`);
      else if (TRUNCATED_NAMES.has(name))
        report(file, lineNumber, `обрывок слова «${name}»`);
    }

    // числа: в config/ и в именованной константе (вместе с её таблицей) — можно
    const isNamedConstant = startsNamedConstant || isInsideNamedConstant;
    if (!isConfig && !isNamedConstant && !original.includes(NUMBER_WAIVER)) {
      for (const match of code.matchAll(/(?<![\w$.])(\d+(?:\.\d+)?)(?![\w$])/g))
        if (!PLAIN_NUMBERS.has(match[1]))
          report(file, lineNumber, `число без имени ${match[1]}`);
    }

    for (const pattern of FORBIDDEN_CALLS[layer] || [])
      if (pattern.test(code))
        report(
          file,
          lineNumber,
          `в слое ${layer} нельзя: ${pattern.source.replace(/\\/g, '')}`,
        );
  });

  // импорты против направления слоёв
  for (const match of source.matchAll(/^import[\s\S]*?from\s+'([^']+)'/gm)) {
    if (!match[1].startsWith('.')) continue;
    const target = relative(JS_DIR, resolve(dirname(file), match[1]));
    const targetLayer = layerOf(target);
    const lineNumber = source.slice(0, match.index).split('\n').length;
    const allowed = ALLOWED_IMPORTS[layer];
    const isViewHelper =
      layer === 'views' && VIEW_HELPERS.includes(target.split(sep).join('/'));
    if (allowed && !allowed.includes(targetLayer) && !isViewHelper)
      report(
        file,
        lineNumber,
        `импорт против слоёв: ${layer} → ${targetLayer} (${target})`,
      );
  }
}

// FILES в sw.js против настоящей папки js/
const serviceWorker = readFileSync(join(ROOT, 'sw.js'), 'utf8');
const cachedFiles = [...serviceWorker.matchAll(/'\.\/([^']*)'/g)].map(
  (match) => match[1],
);
for (const file of listJsFiles(JS_DIR)) {
  const path = relative(ROOT, file).split(sep).join('/');
  if (!cachedFiles.includes(path))
    problems.push(`sw.js: ${path} нет в FILES — без интернета не загрузится`);
}
for (const path of cachedFiles) {
  if (!path) continue;
  try {
    statSync(join(ROOT, path));
  } catch {
    problems.push(`sw.js: в FILES есть ${path}, а файла нет`);
  }
}

if (problems.length) {
  console.log(problems.join('\n'));
  console.log(`\nНарушений стандарта: ${problems.length}`);
  process.exit(1);
}
console.log('Стандарт соблюдён: нарушений нет.');
