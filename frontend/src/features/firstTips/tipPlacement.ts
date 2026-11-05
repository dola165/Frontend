/**
 * Where the tip card sits. Beside Agent Dola's header button, to its left with the pointer aimed at the button (as
 * drawn on the header); below the button when there is no room on the left (narrow screens, phones); in the bottom
 * left corner when nothing in the header can be pointed at (a World drawer covers the header and fills the right side,
 * so the corner keeps the card off the form being opened).
 */
export interface TipBox { width: number; height: number }
export interface TipAnchor { top: number; left: number; right: number; bottom: number }
export interface TipPlacement {
    top: number;
    left: number;
    side: 'left' | 'below' | 'corner';
    /** Where the pointer meets the card: px from the card's top (left side) or from its left edge (below). */
    pointer: number;
}

export const TIP_MARGIN = 12;
export const TIP_GAP = 14;
/** The pointer keeps clear of the card's rounded corners. */
const POINTER_INSET = 22;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

export function placeTip(anchor: TipAnchor | null, card: TipBox, viewport: TipBox, bottomBar = 0): TipPlacement {
    if (!anchor) {
        return { side: 'corner', pointer: 0, left: TIP_MARGIN, top: Math.max(TIP_MARGIN, viewport.height - bottomBar - card.height - TIP_MARGIN) };
    }
    const middleY = (anchor.top + anchor.bottom) / 2, middleX = (anchor.left + anchor.right) / 2;
    if (anchor.left - TIP_GAP - card.width >= TIP_MARGIN) {
        const top = clamp(anchor.top - 6, TIP_MARGIN, viewport.height - card.height - TIP_MARGIN);
        return { side: 'left', top, left: anchor.left - TIP_GAP - card.width, pointer: clamp(middleY - top, POINTER_INSET, card.height - POINTER_INSET) };
    }
    const left = clamp(anchor.right - card.width + 8, TIP_MARGIN, viewport.width - card.width - TIP_MARGIN);
    return { side: 'below', top: anchor.bottom + TIP_GAP, left, pointer: clamp(middleX - left, POINTER_INSET, card.width - POINTER_INSET) };
}
