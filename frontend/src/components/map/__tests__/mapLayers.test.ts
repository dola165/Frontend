import { describe, expect, it } from 'vitest';
import {
    MAP_LOCATION_PIN_IMAGE,
    buildPointsFeatureCollection,
    withDarkPaints,
    withHeritagePaints
} from '../mapLayers';

describe('map layer styling', () => {
    it('keeps real relief and woods available at world zoom without recoloring water or mutating the source', () => {
        const original = { version: 8, sources: { openmaptiles: { type: 'vector' } }, layers: [
            { id: 'background', type: 'background', paint: { 'background-color': '#eee' } },
            { id: 'water', type: 'fill', paint: { 'fill-color': '#aaa' } },
            { id: 'landcover_wood', type: 'fill', minzoom: 10, paint: { 'fill-opacity': 0 } },
            { id: 'landcover_glacier', type: 'fill', paint: { 'fill-color': '#fff' } }
        ] };
        const result = withHeritagePaints(original);
        expect(result.layers.find(l => l.id === 'landcover_wood')?.minzoom).toBe(0);
        expect(result.layers.find(l => l.id === 'landcover_glacier')?.paint['fill-color']).toBe('#fffef8');
        expect(result.layers.findIndex(l => l.id === 'atlas-hillshade')).toBeLessThan(result.layers.findIndex(l => l.id === 'water'));
        expect(result.sources).toHaveProperty('atlas-elevation.encoding', 'terrarium');
        expect(original.layers[2].minzoom).toBe(10);
        expect(original.sources).not.toHaveProperty('atlas-elevation');
    });
    it('uses the normal football pin for unselected point features', () => {
        const collection = buildPointsFeatureCollection([{
            key: 'CLUB:1',
            entityType: 'CLUB',
            latitude: 41.7,
            longitude: 44.8,
            title: 'Test club'
        }]);

        expect(collection.features[0].properties.icon).toBe(MAP_LOCATION_PIN_IMAGE);
    });

    it('creates a true dark style without mutating the light style', () => {
        const light = {
            version: 8,
            layers: [
                { id: 'background', type: 'background', paint: { 'background-color': '#ffffff' } },
                { id: 'water', type: 'fill', paint: { 'fill-color': '#b7dce8' } },
                { id: 'place-label', type: 'symbol', paint: { 'text-color': '#111827', 'text-halo-color': '#ffffff', 'text-halo-width': 1 } }
            ]
        };

        const dark = withDarkPaints(light);

        expect(dark.layers[0].paint['background-color']).toBe('#11171d');
        expect(dark.layers[1].paint['fill-color']).toBe('#173c4b');
        expect(dark.layers[2].paint['text-color']).toBe('#dbe2e8');
        expect(light.layers[0].paint['background-color']).toBe('#ffffff');
    });
});
