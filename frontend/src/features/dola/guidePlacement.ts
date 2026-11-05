/** Geometry of Agent Dola's guide: the frame around the field to fill, and where its step card goes beside it. */

/** Room between the field and its frame, in pixels. */
export const PAD = 10;
/** Between the frame and the card, and between the card and the window's edge. */
const GAP = 12;
const EDGE = 16;

type Box = { left: number; top: number; right: number; bottom: number; width: number; height: number };
export type CardPlace = { side: 'bottom' | 'top' | 'right' | 'left'; x: number; y: number; arrow: number };
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(value, Math.max(low, high)));

/**
 * Where the step card goes so it pops out of the framed field: under it, else over it, else beside it, never over it.
 * `arrow` is where along the card's edge its pointer sits, aimed at the field's label end. `null` when it fits nowhere
 * (a field taller than the window); the card then waits in its corner.
 */
export function placeCard(field: Box, card: { width: number; height: number }, view: { width: number; height: number }): CardPlace | null {
    const frame = { left: field.left - PAD, top: field.top - PAD, right: field.right + PAD, bottom: field.bottom + PAD };
    const x = clamp(frame.left, EDGE, view.width - card.width - EDGE);
    const y = clamp(frame.top, EDGE, view.height - card.height - EDGE);
    const across = (start: number) => clamp(Math.min(field.left + field.width / 2, field.left + 40) - start, 20, card.width - 20);
    const down = (start: number) => clamp(Math.min(field.top + field.height / 2, field.top + 24) - start, 20, card.height - 20);
    if (frame.bottom + GAP + card.height <= view.height - EDGE) return { side: 'bottom', x, y: frame.bottom + GAP, arrow: across(x) };
    if (frame.top - GAP - card.height >= EDGE) return { side: 'top', x, y: frame.top - GAP - card.height, arrow: across(x) };
    if (frame.right + GAP + card.width <= view.width - EDGE) return { side: 'right', x: frame.right + GAP, y, arrow: down(y) };
    if (frame.left - GAP - card.width >= EDGE) return { side: 'left', x: frame.left - GAP - card.width, y, arrow: down(y) };
    return null;
}
