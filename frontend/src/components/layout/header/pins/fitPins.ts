/** Pins shown as tabs at most; the rest wait in "more" (the product model's "around five"). */
export const VISIBLE_PINS = 5;
/** The search icon, which takes the field's place when the header is crowded. */
export const SEARCH_TOGGLE = 44;
/** Room to spare before showing more than now (a pin, or the search field): a pixel of rounding never flips it back. */
const MARGIN = 8;

/**
 * Widths in pixels: the room the pins have with the search field shown (`available`) and with search as an icon
 * (`collapsed`), each pin, the "more" button, the "+" button, the gap and the search field.
 */
export interface Space { available: number; collapsed: number; pins: number[]; more: number; plus: number; gap: number; searchField: number }

/**
 * How many pins fit, and whether the search field should give way. Pins come first: the field only collapses when
 * the pins would not fit beside it. The room for each state is measured apart from the state the header is in, so
 * showing or hiding a pin never changes the answer (the tabs used to shake between a pin and "1 pin").
 */
export function fitPins({ available, collapsed, pins, more, plus, gap, searchField }: Space, now = { fit: 0, crowded: false }) {
    const reachable = pins.slice(0, VISIBLE_PINS);
    const overflowing = pins.length > VISIBLE_PINS;
    const total = (count: number) => reachable.slice(0, count).reduce((sum, width) => sum + width + gap, 0);
    const need = total(reachable.length) + (overflowing ? more + gap : 0);
    const crowded = searchField > 0 && need > available - plus - (now.crowded ? MARGIN : 0);
    const room = (crowded ? collapsed : available) - plus;
    let fit = 0;
    for (let count = 1; count <= reachable.length; count += 1) {
        const rest = count < pins.length ? more + gap : 0;
        if (total(count) + rest > room - (count > now.fit ? MARGIN : 0)) break;
        fit = count;
    }
    return { fit, crowded };
}
