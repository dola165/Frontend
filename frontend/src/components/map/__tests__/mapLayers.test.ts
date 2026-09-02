import { describe, expect, it } from 'vitest';
import {
    MAP_LOCATION_PIN_IMAGE,
    buildPointsFeatureCollection,
    withDarkPaints
} from '../mapLayers';

describe('map layer styling', () => {
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
