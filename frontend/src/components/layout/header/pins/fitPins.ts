/** Pins shown as tabs at most; the rest wait in "more" (the product model's "around five"). */
export const VISIBLE_PINS = 5;
const SEARCH_TOGGLE = 44;

/** Widths in pixels: the room the pins have, each pin, the "more" button, the "+" button, the gap and the search field. */
export interface Space { available: number; pins: number[]; more: number; plus: number; gap: number; searchField: number }

/**
 * How many pins fit, and whether the search field should give way. Pins come first: the field only collapses
 * when the pins would not fit beside it, and that is judged with the field shown, so the answer never flips back.
 */
export function fitPins({ available, pins, more, plus, gap, searchField }: Space, crowdedNow: boolean) {
    const reachable = pins.slice(0, VISIBLE_PINS);
    const overflowing = pins.length > VISIBLE_PINS;
    const total = (count: number) => reachable.slice(0, count).reduce((sum, width) => sum + width + gap, 0);
    const room = available - plus;
    const withField = room - (crowdedNow && searchField ? searchField - SEARCH_TOGGLE : 0);
    const crowded = searchField > 0 && total(reachable.length) + (overflowing ? more + gap : 0) > withField;
    let fit = 0;
    for (let count = 1; count <= reachable.length; count += 1) {
        const rest = count < pins.length ? more + gap : 0;
        if (total(count) + rest > room) break;
        fit = count;
    }
    return { fit, crowded };
}
