import { useEffect, useLayoutEffect, useState, type ReactNode, type RefObject } from 'react';
import MapGL, { useMap, type MapLayerMouseEvent, type MapRef, type ViewStateChangeEvent } from 'react-map-gl/maplibre';
import { maplibreWorkerUrl } from '../../../../components/map/maplibreWorker';
import type { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { isAndroidApp } from '../../../../android/bridge';
import { prefersLightMapRendering } from '../../../../components/map/mapPerformance';
import { Button } from '../../../../design/primitives';
import { useAppTheme, useBasemapStyle } from './useMapTheme';
import './canvas.css';

export interface MapView { latitude: number; longitude: number; zoom: number }

/** Resizing clears the drawing buffer; repaint in the same frame so panel transitions never blank the map. */
function SizeGuard() {
    const { current: map } = useMap();
    useLayoutEffect(() => {
        if (!map) return;
        let frame = 0, last = '';
        const container = map.getContainer();
        const observer = new ResizeObserver(() => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                const size = `${container.clientWidth}:${container.clientHeight}`;
                if (size === last || !container.clientWidth || !container.clientHeight) return;
                last = size;
                map.resize();
                map.getMap().redraw();
            });
        });
        observer.observe(container);
        return () => { cancelAnimationFrame(frame); observer.disconnect(); };
    }, [map]);
    return null;
}

/**
 * The World map canvas: the themed basemap, sized to its container, with an honest fallback
 * when the map cannot load. Layers, markers and controls are passed as children.
 */
export function MapCanvas({ mapRef, initialView, children, overlay, cursor, embedded = false, onLoad, onMoveEnd, onClick, onMouseMove, onMouseOut, onUnavailable, label }: {
    mapRef: RefObject<MapRef | null>; initialView: MapView; children?: ReactNode; overlay?: ReactNode; cursor?: string; embedded?: boolean; label: string;
    onLoad?: (map: MapLibreMap) => void; onMoveEnd?: (event: ViewStateChangeEvent) => void; onClick?: (event: MapLayerMouseEvent) => void;
    onMouseMove?: (event: MapLayerMouseEvent) => void; onMouseOut?: () => void; onUnavailable?: (unavailable: boolean) => void;
}) {
    const theme = useAppTheme();
    const style = useBasemapStyle(theme);
    const [attempt, setAttempt] = useState(0);
    const [unavailable, setUnavailable] = useState(false);
    useEffect(() => { onUnavailable?.(unavailable); }, [unavailable, onUnavailable]);
    const light = prefersLightMapRendering();
    return (
        <div className="gk-map-canvas" data-theme={theme} role="region" aria-label={label}>
            {!style && <div className="gk-map-canvas__waiting" aria-hidden="true" />}
            {style && !unavailable && (
                <MapGL
                    workerUrl={maplibreWorkerUrl}
                    key={attempt}
                    ref={mapRef}
                    initialViewState={initialView}
                    mapStyle={style}
                    style={{ width: '100%', height: '100%' }}
                    attributionControl={{ compact: true }}
                    pixelRatio={light ? Math.min(window.devicePixelRatio || 1, 1.5) : undefined}
                    scrollZoom={!embedded}
                    dragRotate={!embedded}
                    cursor={cursor}
                    onError={event => { if (!event.target.getStyle()?.layers?.length) setUnavailable(true); }}
                    onLoad={event => {
                        if (isAndroidApp || embedded || window.innerWidth < 700) {
                            // Keep attribution behind its standard toggle so it never covers controls on first load.
                            const attribution = event.target.getContainer().querySelector<HTMLDetailsElement>('.maplibregl-ctrl-attrib');
                            if (attribution?.open) attribution.querySelector<HTMLElement>('summary')?.click();
                        }
                        onLoad?.(event.target);
                    }}
                    onMoveEnd={onMoveEnd}
                    onClick={onClick}
                    onMouseMove={onMouseMove}
                    onMouseOut={onMouseOut}
                >
                    <SizeGuard />
                    {children}
                </MapGL>
            )}
            {unavailable && (
                <div className="gk-map-canvas__failed" role="status">
                    <p>The map could not load. The list still works.</p>
                    <Button size="sm" onClick={() => { setUnavailable(false); setAttempt(value => value + 1); }}>Retry map</Button>
                </div>
            )}
            {overlay}
        </div>
    );
}
