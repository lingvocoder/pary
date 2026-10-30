"""Эталонный разбор PDF расписания факультета (Python + pdfplumber).

Не часть приложения: образец для переноса на JavaScript в версии 0.4.
Описание алгоритма — docs/pdf-parser.md.

Запуск:  pip install pdfplumber && python parse_schedule.py *.pdf > grid.json
"""
import json
import re
import sys

import pdfplumber

DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']


def overlap(a0, a1, b0, b1):
    """Длина пересечения отрезков [a0, a1] и [b0, b1]."""
    return max(0.0, min(a1, b1) - max(a0, b0))


def parse(path):
    with pdfplumber.open(path) as pdf:
        page = pdf.pages[0]

        # 1. Тонкие прямоугольники — это границы ячеек
        vert = [(round(r['x0'], 1), r['top'], r['bottom']) for r in page.rects
                if r['x1'] - r['x0'] < 2 and r['bottom'] - r['top'] > 3]
        horiz = [(round(r['top'], 1), r['x0'], r['x1']) for r in page.rects
                 if r['bottom'] - r['top'] < 2 and r['x1'] - r['x0'] > 3]
        # серые заливки — дни КСРС
        gray = [r for r in page.rects if r['x1'] - r['x0'] > 50 and r['bottom'] - r['top'] > 20
                and isinstance(r.get('non_stroking_color'), (int, float)) and 0.5 < r['non_stroking_color'] < 0.95]
        words = page.extract_words()

        # 2. Колонки: день | № пары | время | группы... | № пары
        xs = sorted(set(x for x, _, _ in vert))
        group_cols = xs[3:-1]
        time_col = (xs[2], xs[3])

        # 3. Строки — горизонтальные границы, накрывающие колонку времени
        row_lines = sorted(set(y for y, x0, x1 in horiz if x0 <= time_col[0] + 2 and x1 >= time_col[1] - 2))

        def text_in(x0, x1, y0, y1):
            """Слова, чей центр внутри прямоугольника, в порядке чтения."""
            inside = [w for w in words
                      if x0 + 0.5 < (w['x0'] + w['x1']) / 2 < x1 - 0.5 and y0 < (w['top'] + w['bottom']) / 2 < y1]
            inside.sort(key=lambda w: (round(w['top'] / 4), w['x0']))
            return ' '.join(w['text'] for w in inside)

        rows = []
        for top, bottom in zip(row_lines, row_lines[1:]):
            m = re.search(r'(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})', text_in(*time_col, top, bottom))
            if m:
                rows.append((top, bottom, m.group(1), m.group(2)))
        assert len(rows) == 54, (path, len(rows))   # 6 дней × 9 пар

        # 4. Номера групп — трёхзначные числа над первой строкой
        candidates = [w for w in words if re.fullmatch(r'\d{3}', w['text']) and w['bottom'] < rows[0][0]]
        groups = []
        for c0, c1 in zip(group_cols, group_cols[1:]):
            found = [w['text'] for w in candidates if c0 < (w['x0'] + w['x1']) / 2 < c1]
            groups.append(found[-1] if found else None)

        # шапка: «1 курс (с 21.09.2026г. по 26.10.2026г.)»
        header = text_in(0, page.width, 0, rows[0][0])
        m = re.search(r'(\d)\s*курс\s*\(с\s*([\d.]+)г?\.?\s*по\s*([\d.]+)г?\.', header)
        meta = dict(course=m.group(1), start=m.group(2), end=m.group(3))

        # 5. Ячейки с учётом объединений
        cells = []
        for day in range(6):
            for pair in range(9):
                top, bottom, t0, t1 = rows[day * 9 + pair]
                if any(g['top'] <= top + 1 and g['bottom'] >= bottom - 1 and g['x0'] <= group_cols[0] + 2 for g in gray):
                    cells.append(dict(day=DAYS[day], pair=pair + 1, t0=t0, t1=t1, groups=groups, text='КСРС', ksrs=True))
                    continue
                # граница есть, если вертикальный отрезок накрывает больше половины высоты строки
                bounds = [group_cols[0]]
                for x in group_cols[1:-1]:
                    if any(abs(vx - x) < 1 and overlap(vy0, vy1, top, bottom) > (bottom - top) * 0.5 for vx, vy0, vy1 in vert):
                        bounds.append(x)
                bounds.append(group_cols[-1])
                for c0, c1 in zip(bounds, bounds[1:]):
                    text = text_in(c0, c1, top, bottom).strip()
                    if text:
                        cells.append(dict(day=DAYS[day], pair=pair + 1, t0=t0, t1=t1,
                                          groups=groups[group_cols.index(c0):group_cols.index(c1)], text=text, ksrs=False))
        return dict(meta=meta, groups=groups, cells=cells)


if __name__ == '__main__':
    result = {}
    for path in sys.argv[1:]:
        parsed = parse(path)
        result[parsed['meta']['course']] = parsed
    print(json.dumps(result, ensure_ascii=False, indent=1))
