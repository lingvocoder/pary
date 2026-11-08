/* Чистые расчёты положения на экране: где поставить подсказку. Без document и window —
   размеры приходят параметрами, поэтому расчёт проверяется тестом без браузера. */
import {
  POPOVER_GAP_PX,
  SCREEN_EDGE_PX,
  SCREEN_TOP_BOTTOM_GAP_PX,
} from '../config/interface.js';

const half = (size) => size / 2; // standard: середина — половина размера

/**
 * Где поставить подсказку: под карточкой, а если не помещается — над ней.
 * По горизонтали — по центру карточки, но не ближе SCREEN_EDGE_PX к краю экрана.
 * @param {{left: number, top: number, bottom: number, width: number}} cardRect
 * @param {{width: number, height: number}} popoverSize
 * @param {{width: number, height: number}} viewport
 * @returns {{left: number, top: number, isBelow: boolean}}
 */
export function placePopover(cardRect, popoverSize, viewport) {
  const centeredLeft =
    cardRect.left + half(cardRect.width) - half(popoverSize.width);
  const left = Math.min(
    Math.max(SCREEN_EDGE_PX, centeredLeft),
    viewport.width - popoverSize.width - SCREEN_EDGE_PX,
  );
  const isBelow =
    cardRect.bottom + POPOVER_GAP_PX + popoverSize.height <=
    viewport.height - SCREEN_TOP_BOTTOM_GAP_PX;
  const top = isBelow
    ? cardRect.bottom + POPOVER_GAP_PX
    : Math.max(
        SCREEN_TOP_BOTTOM_GAP_PX,
        cardRect.top - POPOVER_GAP_PX - popoverSize.height,
      );
  return { left, top, isBelow };
}
