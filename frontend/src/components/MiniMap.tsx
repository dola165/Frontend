import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Expand, Map as MapIcon, Shrink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MapHelpHint } from './map/MapHelpHint';

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

function MiniMapPickerEvents({
    enabled,
    onSelect
}: {
    enabled: boolean;
    onSelect: (coords: { lat: number; lng: number }) => void;
}) {
    useMapEvents({
        click(event) {
            if (!enabled) {
                return;
            }
            onSelect({
                lat: Number(event.latlng.lat.toFixed(6)),
                lng: Number(event.latlng.lng.toFixed(6))
            });
        }
    });

    return null;
}

function MiniMapFocusController({ target }: { target: MapPoint | null }) {
    const map = useMap();

    useEffect(() => {
        if (!target) {
            return;
        }
        map.flyTo(target, Math.max(map.getZoom(), 13), { animate: true, duration: 0.35 });
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
                <MapContainer
                    center={center}
                    zoom={selectedPoint ? 13 : 11}
                    className="h-full w-full"
                    zoomControl={false}
                    dragging={true}
                    scrollWheelZoom={true}
                    preferCanvas={true}
                >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <MiniMapFocusController target={selectedPoint} />
                    <MiniMapPickerEvents enabled={mode === 'picker' && Boolean(onSelectLocation)} onSelect={onSelectLocation ?? (() => undefined)} />
                    {selectedPoint ? (
                        <CircleMarker
                            center={selectedPoint}
                            radius={10}
                            pathOptions={{
                                color: 'var(--accent-primary)',
                                fillColor: 'var(--accent-primary)',
                                fillOpacity: 0.28,
                                weight: 2
                            }}
                        />
                    ) : null}
                </MapContainer>
            </div>
        </div>
    );
}
