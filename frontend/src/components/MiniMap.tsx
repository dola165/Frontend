import { useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import { Expand, Map as MapIcon, Shrink } from 'lucide-react';

const soccerBallSvg = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <circle cx="24" cy="24" r="22" fill="#ffffff" stroke="#000000" stroke-width="2"/>
  <path d="M24 12 L14 18 L16 30 L32 30 L34 18 Z" fill="#000000"/>
  <path d="M24 2 L24 12 M2 16 L14 18 M8 40 L16 30 M40 40 L32 30 M46 16 L34 18" stroke="#000000" stroke-width="2" stroke-linecap="round"/>
  <circle cx="24" cy="24" r="22" fill="none" stroke="#000000" stroke-width="2"/>
</svg>
`);

const soccerIcon = new L.Icon({
    iconUrl: `data:image/svg+xml,${soccerBallSvg}`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
});

export function MiniMap() {
    const [expanded, setExpanded] = useState(false);
    const navigate = useNavigate();
    const center: [number, number] = [41.7151, 44.8271]; // Tbilisi

    return (
        <div className="sticky top-24 relative z-50">
            <h3 className="font-bold text-gray-900 dark:text-white mb-3 px-1">Explore Nearby</h3>

            <div
                // We changed the origin to "left" and positioned it so it pushes into the right-side gutter!
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
                    dragging={true}
                    scrollWheelZoom={true}
                    preferCanvas={true}
                >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
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
                        {expanded ? <Shrink className="w-3 h-3" /> : <Expand className="w-3 h-3" />}
                        {expanded ? 'Collapse' : 'Expand'}
                    </button>
                </div>
            </div>

            {expanded && <div className="w-full h-64" />}
        </div>
    );
}