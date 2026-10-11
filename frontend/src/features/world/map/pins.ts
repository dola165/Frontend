import { wt } from '../copy';
import type { WorldMapPoint } from './WorldMap';

/** What a pin says to a screen reader: its name, its detail, and where it is placed when not at its own place. */
export const pinLabel = (point: WorldMapPoint) =>
    [point.label, point.meta, point.approximate === 'club' ? wt('placed at its club') : point.approximate === 'ground' ? wt('placed at its competition’s ground') : ''].filter(Boolean).join(', ');

/** Pointer and keyboard focus on a pin light its results. */
export const pinHover = (id: string, onHover?: (id?: string) => void) => onHover && {
    onMouseEnter: () => onHover(id), onMouseLeave: () => onHover(undefined), onFocus: () => onHover(id), onBlur: () => onHover(undefined),
};
