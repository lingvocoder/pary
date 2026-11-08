// Тесты положения подсказки: js/ui/geometry.js. Запуск: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placePopover } from '../../js/ui/geometry.js';

// Телефон пользователя (Samsung Galaxy A54) и настоящие размеры из Chrome Dev.
const PHONE = { width: 384, height: 694 };
const CARD_HEIGHT = 49; // карточка в сетке
const CARD_WIDTH = 49;
const MAX_POPOVER = { width: 300, height: 306 }; // самая высокая подсказка (0.4.0)

test('подсказка до 306 px на экране 384×694 всегда над или под карточкой и не перекрывает её', () => {
  for (let cardTop = 0; cardTop + CARD_HEIGHT <= PHONE.height; cardTop++) {
    const card = {
      left: 200,
      width: CARD_WIDTH,
      top: cardTop,
      bottom: cardTop + CARD_HEIGHT,
    };
    const { top } = placePopover(card, MAX_POPOVER, PHONE);
    const bottom = top + MAX_POPOVER.height;
    const isOutsideCard = bottom <= card.top || top >= card.bottom;
    assert.ok(isOutsideCard, `карточка сверху на ${cardTop} px: перекрыта`);
    assert.ok(
      top >= 0 && bottom <= PHONE.height,
      `карточка на ${cardTop} px: за экраном`,
    );
  }
});

test('подсказка: под карточкой, если влезает, иначе над ней', () => {
  const card = { left: 100, width: CARD_WIDTH, top: 100, bottom: 149 };
  assert.deepEqual(placePopover(card, MAX_POPOVER, PHONE), {
    left: 16,
    top: 157,
    isBelow: true,
  });
  const lowCard = { ...card, top: 600, bottom: 649 };
  const placed = placePopover(lowCard, MAX_POPOVER, PHONE);
  assert.equal(placed.isBelow, false);
  assert.equal(placed.top, 600 - 8 - 306);
});

test('подсказка по горизонтали: по центру карточки, но не ближе 16 px к краю', () => {
  const size = { width: 200, height: 100 };
  const centered = placePopover(
    { left: 150, width: 50, top: 10, bottom: 59 },
    size,
    PHONE,
  );
  assert.equal(centered.left, 150 + 25 - 100);
  const nearRight = placePopover(
    { left: 330, width: 50, top: 10, bottom: 59 },
    size,
    PHONE,
  );
  assert.equal(nearRight.left, 384 - 200 - 16);
});
