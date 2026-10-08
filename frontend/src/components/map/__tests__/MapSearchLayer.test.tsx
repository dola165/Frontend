import { render, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateStyleMin, type StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { WalkingRoute } from '../walkingGraph';
const captured = vi.hoisted(() => ({ layers: [] as Record<string, unknown>[], sources: {} as Record<string, unknown> }));
vi.mock('react-map-gl/maplibre', async () => {
    const React = await import('react');
    const SourceId = React.createContext('');
    return {
        useMap: () => ({ current: { getLayer: () => undefined } }),
        Source: ({ id, children, ...source }: { id: string; children: React.ReactNode }) => {
            captured.sources[id] = { type: 'geojson', ...source };
            return <SourceId.Provider value={id}>{children}</SourceId.Provider>;
        },
        Layer: (layer: Record<string, unknown>) => {
            const source = React.useContext(SourceId);
            const { beforeId: _placement, ...style } = layer;
            captured.layers.push({ ...style, source });
            return null;
        },
        Marker: () => null,
    };
});
vi.mock('../../../android/bridge', () => ({ isAndroidApp: false }));
import { MapSearchLayer } from '../MapSearchLayer';
const route: WalkingRoute = { coordinates: [[44.770, 41.727], [44.775, 41.727]], branches: [],
    distanceKm: .4, minutes: 5, startOffsetM: 3, endOffsetM: 3, steps: [] };
afterEach(() => { cleanup(); captured.layers = []; captured.sources = {}; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('real walking layer style validity', () => {
    it.each([false, true])('renders valid cartographic route paints with reduced motion=%s', reduced => {
        vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: reduced } as MediaQueryList));
        render(<MapSearchLayer sequence={1} origin={[44.770, 41.727]} destination={[44.775, 41.727]}
            targets={[]} route={route} showOrigin={false} onOriginChange={() => {}} />);
        // Validate the real Layer/Source declarations using MapLibre's own parser.
        const layers = [...new Map(captured.layers.map(l => [l.id, l])).values()];
        const style = { version: 8, sources: captured.sources, layers } as unknown as StyleSpecification;
        expect(validateStyleMin(style).map(e => e.message)).toEqual([]);
        expect(layers.filter(l => String(l.id).startsWith('atlas-route-')).length).toBeGreaterThanOrEqual(3);
        const data = (captured.sources['atlas-walking-route'] as { data: { features: { geometry: { coordinates: number[][] } }[] } }).data;
        expect(data.features[0].geometry.coordinates).toEqual(route.coordinates);
    });
});
