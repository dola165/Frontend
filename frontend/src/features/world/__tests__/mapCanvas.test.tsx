import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import { describe, expect, it, vi } from 'vitest';
import { MapCanvas } from '../map/canvas/MapCanvas';

// react-map-gl reports a map that could not be created (MapLibre 6 without WebGL2) as an error with no target.
vi.mock('react-map-gl/maplibre', async () => {
    const { useEffect } = await import('react');
    function FailingMap({ onError }: { onError: (event: { type: 'error'; target: null; error: Error }) => void }) {
        useEffect(() => { onError({ type: 'error', target: null, error: new Error('WebGL2 is not available') }); }, [onError]);
        return null;
    }
    return { default: FailingMap, useMap: () => ({ current: undefined }) };
});
vi.mock('../map/canvas/useMapTheme', () => ({ useAppTheme: () => 'dark', useBasemapStyle: () => ({ version: 8, sources: {}, layers: [] }) }));

describe('World map canvas', () => {
    it('offers the list and a retry when the map cannot be created', async () => {
        render(<MapCanvas mapRef={createRef<MapRef>()} initialView={{ latitude: 41.7, longitude: 44.8, zoom: 11 }} label="World map" />);
        expect(await screen.findByText('The map could not load. The list still works.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Retry map' })).toBeInTheDocument();
    });
});
