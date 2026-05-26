import { useEffect, useMemo, useState } from 'react';
import Map, { Marker, useMap } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Expand, Map as MapIcon, Shrink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MapHelpHint } from './map/MapHelpHint';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

type MapPoint = [number, number];

export interface MiniMapProps {
    mode?: 'preview' | 'picker';
    title?: string;
    selectedLocation?: { lat?: number | null; lng?: number | null } | null;
    onSelectLocation?: (coords: { lat: number; lng: number }) => void;
    initialCenter?: MapPoint;
    className?: string;
}

const DEFAULT_CENTER: MapPoint = [41.7151, 44.8271];

function MiniMapFocusController({ target }: { target: MapPoint | null }) {
    const { current: map } = useMap();

    useEffect(() => {
        if (!target || !map) {
            return;
        }
        map.flyTo({ center: [target[1], target[0]], zoom: Math.max(map.getZoom(), 13), duration: 350 });
    }, [map, target]);

    return null;
}

export function MiniMap({
    mode = 'preview',
    title,
    selectedLocation,
    onSelectLocation,
    initialCenter = DEFAULT_CENTER,
    className = ''
}: MiniMapProps) {
    const [expanded, setExpanded] = useState(false);
    const navigate = useNavigate();

    const selectedPoint = useMemo<MapPoint | null>(() => {
        if (selectedLocation?.lat == null || selectedLocation?.lng == null) {
            return null;
        }
        return [selectedLocation.lat, selectedLocation.lng];
    }, [selectedLocation?.lat, selectedLocation?.lng]);

    const center = selectedPoint ?? initialCenter;
    const previewTitle = title ?? (mode === 'picker' ? 'Venue Picker' : 'Explore Nearby');
    const pickerEnabled = mode === 'picker' && Boolean(onSelectLocation);

    return (
        <div className={mode === 'picker' ? `relative ${className}`.trim() : `sticky top-24 relative z-50 ${className}`.trim()}>
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
                <div className="flex min-w-0 items-center gap-2">
                    <h3 className="truncate text-xs font-black uppercase tracking-[0.18em] text-primary">{previewTitle}</h3>
                    {mode === 'picker' ? (
                        <MapHelpHint
                            text={selectedPoint ? 'Click a new spot to move the venue pin.' : 'Click anywhere on the map to place the venue pin.'}
                            align="right"
                        />
                    ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    {mode === 'preview' ? (
                        <button
                            type="button"
                            onClick={() => navigate('/map')}
                            className="inline-flex h-8 items-center gap-1 rounded-[4px] border border-subtle bg-surface px-2.5 text-[10px] font-black uppercase tracking-[0.16em] text-primary transition-colors hover:bg-elevated"
                        >
                            <MapIcon className="h-3.5 w-3.5" />
                            Full Map
                        </button>
                    ) : null}

                    <button
                        type="button"
                        onClick={() => setExpanded((current) => !current)}
                        className="inline-flex h-8 items-center gap-1 rounded-[4px] border border-subtle bg-surface px-2.5 text-[10px] font-black uppercase tracking-[0.16em] text-primary transition-colors hover:bg-elevated"
                    >
                        {expanded ? <Shrink className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />}
                        {expanded ? 'Collapse' : 'Expand'}
                    </button>
                </div>
            </div>

            <div
                className={`theme-surface theme-border relative overflow-hidden border shadow-sm transition-[height] duration-200 ${
                    expanded ? 'h-[320px]' : mode === 'picker' ? 'h-[220px]' : 'h-64'
                }`}
            >
                <Map
                    mapboxAccessToken={MAPBOX_TOKEN}
                    initialViewState={{
                        latitude: center[0],
                        longitude: center[1],
                        zoom: selectedPoint ? 13 : 11
                    }}
                    style={{ width: '100%', height: '100%' }}
                    mapStyle="mapbox://styles/mapbox/dark-v11"
                    dragPan={true}
                    scrollZoom={true}
                    cursor={pickerEnabled ? 'crosshair' : undefined}
                    onClick={(evt) => {
                        if (!pickerEnabled) return;
                        onSelectLocation?.({
                            lat: Number(evt.lngLat.lat.toFixed(6)),
                            lng: Number(evt.lngLat.lng.toFixed(6))
                        });
                    }}
                >
                    <MiniMapFocusController target={selectedPoint} />
                    {selectedPoint ? (
                        <Marker
                            longitude={selectedPoint[1]}
                            latitude={selectedPoint[0]}
                            anchor="bottom"
                        >
                            <div className="talanti-map-marker talanti-map-marker--club">
                                <div className="talanti-map-marker__blip" />
                            </div>
                        </Marker>
                    ) : null}
                </Map>
            </div>
        </div>
    );
}
