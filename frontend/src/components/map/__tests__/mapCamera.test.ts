import { describe, expect, it } from 'vitest';
import { mapCameraPadding, mapSelectionTarget } from '../mapCamera';

describe('camera framing inside phone bars and map sheets', () => {
    it.each([[360, 430], [800, 240], [320, 180], [390, 650]])('leaves visible map space on a %i × %i canvas', (width, height) => {
        const padding = mapCameraPadding(width, height, height * .62);
        expect(height - padding.top - padding.bottom).toBeGreaterThanOrEqual(100);
        expect(padding.left + padding.right).toBeLessThan(width);
    });
    it('frames above a sheet when space allows', () => {
        expect(mapCameraPadding(390, 650, 350).bottom).toBe(366);
    });
});

describe('selection camera location anchor', () => {
    it('includes the chosen location and nearby club even when already zoomed in', () => {
        expect(mapSelectionTarget([44.8, 41.72], [44.77, 41.71], 18)).toMatchObject({
            bounds: [[44.77, 41.71], [44.8, 41.72]], zoom: 18
        });
    });
    it('keeps the existing club zoom without a chosen location', () => {
        expect(mapSelectionTarget([44.8, 41.72], null, 11)).toEqual({ center: [41.72, 44.8], zoom: 14 });
        expect(mapSelectionTarget([44.8, 41.72], null, 17)).toEqual({ center: [41.72, 44.8], zoom: 17 });
    });
    it.each([99.99, 100, 100.01])('only keeps the origin below 100 km (%s km)', km => {
        const latitude = km / 6371 * 180 / Math.PI;
        const target = mapSelectionTarget([0, latitude], [0, 0], 11);
        expect(Boolean(target.bounds)).toBe(km < 100);
    });
    it('handles a club at the chosen location', () => {
        expect(mapSelectionTarget([44, 41], [44, 41], 11)).toMatchObject({ bounds: [[44, 41], [44, 41]], zoom: 14 });
    });
    it('frames nearby clubs across the date line without zooming out around the world', () => {
        const { bounds } = mapSelectionTarget([-179.9, 0], [179.9, 0], 11);
        expect(bounds![1][0] - bounds![0][0]).toBeCloseTo(.2);
    });
});
