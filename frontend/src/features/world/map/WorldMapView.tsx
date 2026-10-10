import { useRef } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import { useSearchParams } from 'react-router-dom';
import { MapCanvas } from './canvas/MapCanvas';
import { MapControls } from './canvas/MapControls';
import { useAppTheme, usePalette } from './canvas/useMapTheme';
import { useElementSize } from './canvas/viewport';
import { ExploreLayers } from './explore/ExploreLayers';
import { ExplorePanel } from './explore/ExplorePanel';
import { LAYERS, type LayerId } from './explore/exploreQuery';
import { useExplore } from './explore/useExplore';
import { usePhoneLayout } from './sheet/usePhoneLayout';
import './map-view.css';


/**
 * The World map: a full-height canvas with search, results and the selected place beside it
 * (a bottom sheet on phones). `embedded` is the contained guest version used on the landing page.
 */
export function WorldMapView({ signedIn, embedded = false, allowed = LAYERS.map(layer => layer.id) }: { signedIn: boolean; embedded?: boolean; allowed?: LayerId[] }) {
    const mapRef = useRef<MapRef | null>(null);
    const phone = usePhoneLayout();
    const theme = useAppTheme();
    const palette = usePalette(theme);
    const [params] = useSearchParams();
    const planning = signedIn && !embedded && params.has('plans');
    const stage = useRef<HTMLDivElement>(null);
    const viewSize = useElementSize(stage);
    const zoom = embedded ? 11 : 11.5;
    const explore = useExplore({ mapRef, active: !planning, allowed, signedIn: signedIn && !embedded, phone, viewSize, zoom, embedded });
    const { query, walking } = explore;
    const planHref = signedIn && !embedded ? '/world/map?plans=staff' : undefined;

    return (
        <div ref={stage} className="gk-mapview" data-mode={planning ? 'plan' : 'explore'} data-embedded={embedded || undefined}>
            {!explore.centerReady && <div className="gk-map-canvas"><div className="gk-map-canvas__waiting" /></div>}
            {explore.centerReady && <MapCanvas mapRef={mapRef} initialView={{ latitude: explore.center[0], longitude: explore.center[1], zoom }} embedded={embedded} label="World map"
                cursor={walking.picking ? 'crosshair' : undefined}
                onLoad={map => {
                    const shared = query.coverage.kind === 'area' ? query.coverage.bounds : null;
                    if (shared) map.fitBounds([[shared.west, shared.south], [shared.east, shared.north]], { duration: 0 });
                    explore.setMapReady(true);
                }}
                onMoveEnd={event => { if (event.originalEvent) explore.setMoved(true); }}
                onClick={event => { if (walking.picking) walking.chooseOrigin([event.lngLat.lng, event.lngLat.lat]); }}>
                {palette && <ExploreLayers explore={explore} palette={palette} />}
                <div className="gk-map-controls-slot"><MapControls onLocate={explore.locate} locating={walking.locating} showView={!embedded} /></div>
            </MapCanvas>}
            <ExplorePanel explore={explore} phone={phone} allowed={allowed} planHref={planHref} embedded={embedded} />
        </div>
    );
}
