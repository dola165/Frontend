import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import { Expand, Map as MapIcon, Shrink } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import type {MapMarkerDto} from '../pages/MapPage';
import 'leaflet/dist/leaflet.css';

// Colored Soccer Ball pins!
const createSoccerBallIcon = (color: string) => new L.Icon({
    iconUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <circle cx="24" cy="24" r="22" fill="${color}" stroke="#000000" stroke-width="2"/>
  <path d="M24 12 L14 18 L16 30 L32 30 L34 18 Z" fill="#000000"/>
  <path d="M24 2 L24 12 M2 16 L14 18 M8 40 L16 30 M40 40 L32 30 M46 16 L34 18" stroke="#000000" stroke-width="2" stroke-linecap="round"/>
  <circle cx="24" cy="24" r="22" fill="none" stroke="#000000" stroke-width="2"/>
</svg>
    `)}`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
});
const tryoutIcon = createSoccerBallIcon('#f97316'); // Orange

// FIX: This solves the Leaflet "Gray Tiles" bug when a container changes size via CSS!
function MapResizer({ expanded }: { expanded: boolean }) {
    const map = useMap();
    useEffect(() => {
        const timeout = setTimeout(() => {
            map.invalidateSize();
        }, 300); // Wait for CSS transition to finish
        return () => clearTimeout(timeout);
    }, [expanded, map]);
    return null;
}

export function MiniMap() {
    const [expanded, setExpanded] = useState(false);
    const [markers, setMarkers] = useState<MapMarkerDto[]>([]);
    const navigate = useNavigate();
    const center: [number, number] = [41.7151, 44.8271]; // Tbilisi

    useEffect(() => {
        apiClient.get<MapMarkerDto[]>('/map/nearby', {
            params: { lat: center[0], lng: center[1], radius: 25, type: 'TRYOUT' }
        }).then(res => setMarkers(res.data)).catch(console.error);
    }, []);

    return (
        <div className="sticky top-24 relative z-50">
            <h3 className="font-bold text-gray-900 dark:text-white mb-3 px-1">Active Tryouts Nearby</h3>

            <div
                // Restored your exact top-left orientation
                className={`origin-top-left transition-all duration-300 ease-in-out bg-white dark:bg-gray-800 rounded-xl overflow-hidden border-2 border-black ${
                    expanded
                        ? 'absolute top-10 -left-4 w-[400px] h-[550px] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] z-[100]'
                        : 'relative w-full h-64 shadow-sm z-0'
                }`}
            >
                <MapContainer
                    center={center}
                    zoom={11}
                    className="h-full w-full"
                    zoomControl={false}
                    dragging={true} // Restored dragging!
                    scrollWheelZoom={true} // Restored scroll wheel!
                    preferCanvas={true}
                >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                    {/* Crucial for fixing the gray tile glitch */}
                    <MapResizer expanded={expanded} />

                    {markers.map((m) => (
                        <Marker key={m.entityId} position={[m.latitude, m.longitude]} icon={tryoutIcon}>
                            <Popup>
                                <div className="font-bold">{m.title}</div>
                                <div className="text-xs text-gray-600">{m.subtitle}</div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>

                <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/80 to-transparent opacity-0 hover:opacity-100 transition-opacity z-[1000] flex items-end justify-center pb-3 gap-2">
                    <button
                        onClick={() => navigate('/map')}
                        className="bg-white/95 hover:bg-white text-gray-900 px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-colors shadow-sm"
                    >
                        <MapIcon className="w-3 h-3 text-emerald-600" /> Full Map
                    </button>
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="bg-white/95 hover:bg-white text-gray-900 px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-colors shadow-sm"
                    >
                        {expanded ? <Shrink className="w-3 h-3 text-orange-500" /> : <Expand className="w-3 h-3 text-emerald-600" />}
                        {expanded ? 'Collapse' : 'Expand'}
                    </button>
                </div>
            </div>

            {expanded && <div className="w-full h-64" />}
        </div>
    );
}