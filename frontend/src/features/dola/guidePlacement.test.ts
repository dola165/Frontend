import { expect, it } from 'vitest';
import { placeCard } from './guidePlacement';

const box = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height });
const CARD = { width: 360, height: 200 };
const VIEW = { width: 1600, height: 900 };

it('pops the card out under the field, its pointer at the field’s label end', () => {
    const spot = placeCard(box(1100, 300, 220, 70), CARD, VIEW);
    expect(spot).toEqual({ side: 'bottom', x: 1090, y: 392, arrow: 50 });
});

it('goes over the field when there is no room under it', () => {
    expect(placeCard(box(1100, 650, 220, 70), CARD, VIEW)?.side).toBe('top');
    expect(placeCard(box(1100, 650, 220, 70), CARD, VIEW)?.y).toBe(650 - 10 - 12 - 200);
});

it('stays inside the window by the field’s right edge, still pointing at the field', () => {
    const spot = placeCard(box(1450, 300, 120, 40), CARD, VIEW)!;
    expect(spot.x).toBe(1600 - 360 - 16);
    expect(spot.arrow).toBe(1450 + 40 - spot.x);
});

it('goes beside a tall field, and waits in its corner when it fits nowhere', () => {
    expect(placeCard(box(200, 100, 400, 700), CARD, VIEW)?.side).toBe('right');
    expect(placeCard(box(20, 20, 1560, 860), CARD, VIEW)).toBeNull();
});
