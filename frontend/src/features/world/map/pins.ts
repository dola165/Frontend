import { wt } from '../copy';
import type { WorldMapPoint } from './WorldMap';

/** What a pin says to a screen reader: its name, its detail, and where it is placed when not at its own place. */
export const pinLabel = (point: WorldMapPoint) =>
    [point.label, point.chip, point.meta, point.approximate === 'club' ? wt('placed at its club') : point.approximate === 'ground' ? wt('placed at its competition’s ground') : point.approximate === 'area' ? wt('counted at a city') : ''].filter(Boolean).join(', ');

/** The data attributes that draw a pin (its kind, whether it is lit, its number, its ring, its crest). */
export const pinData = (point: WorldMapPoint, lit: boolean) => ({
    'data-tone': point.tone, 'data-selected': lit || undefined, 'data-count': shownCount(point), 'data-approx': point.approximate || undefined, 'data-crest': point.crest ? true : undefined, 'data-chip': point.chip ? true : undefined,
});

/** A pin shows its number when it holds several results, or when it is a place results are counted at ("Rustavi · 1"). */
export const shownCount = (point: WorldMapPoint) => point.count != null && (point.count > 1 || Boolean(point.approximate)) ? point.count : undefined;

/** Pointer and keyboard focus on a pin light its results. */
export const pinHover = (id: string, onHover?: (id?: string) => void) => onHover && {
    onMouseEnter: () => onHover(id), onMouseLeave: () => onHover(undefined), onFocus: () => onHover(id), onBlur: () => onHover(undefined),
};
