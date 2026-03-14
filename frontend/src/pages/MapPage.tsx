import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, Circle, ZoomControl } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import { apiClient } from "../api/axiosConfig";
import { MapPin, Search, Navigation, Filter, ChevronLeft, X, ShieldCheck, Swords, Calendar, Users, Trophy, ArrowRight } from "lucide-react";
import { MapFilterSidebar } from "../components/map/MapFilterSidebar";
import "leaflet/dist/leaflet.css";

// --- TYPES ---
export type MapMarkerDto = {
    entityId: number;
    entityType: "CLUB" | "TRYOUT" | "MATCH_REQUEST" | string;
    title: string;
    subtitle?: string | null;
    latitude: number;
    longitude: number;
    distanceKm?: number | null;
    members?: number;
    followers?: number;
    verified?: boolean;
    date?: string;
    fee?: string;
};

// --- CUSTOM BALL MARKER ---
const createBallIcon = (isSelected = false, type = 'CLUB') => {
    // We use drop shadows to create a glowing ring around the exact shape of your PNG!
    const glowColors = {
        CLUB: 'rgba(16, 185, 129, 0.8)', // Emerald
        TRYOUT: 'rgba(249, 115, 22, 0.8)', // Orange
        MATCH_REQUEST: 'rgba(59, 130, 246, 0.8)', // Blue
        FRIENDLY: 'rgba(168, 85, 247, 0.8)' // Purple
    };
    const glow = glowColors[type as keyof typeof glowColors] || glowColors.CLUB;

    return L.divIcon({
        className: 'custom-ball-marker bg-transparent border-0',
        html: `
            <div class="relative flex flex-col items-center cursor-pointer">
                <img src="/markers/ball.png" 
                     class="w-10 h-10 transition-all duration-300 ${isSelected ? '-translate-y-3 scale-125' : 'hover:-translate-y-1 hover:scale-110'}" 
                     style="filter: drop-shadow(0 ${isSelected ? '8px 8px' : '4px 4px'} ${glow});" 
                     alt="pin" />
            </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
    });
};

function MapRecenter({ coords }: { coords: [number, number] }) {
    const map = useMap();
    useEffect(() => { map.setView(coords, map.getZoom(), { animate: true }); }, [coords, map]);
    return null;
}

export const MapPage = () => {
    const navigate = useNavigate();

    // UI State
    const [isFilterOpen, setIsFilterOpen] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Map State
    const [mapCenter, setMapCenter] = useState<[number, number]>([41.7151, 44.8271]);

    // Filters State from Sidebar
    const [activeFilters, setActiveFilters] = useState<Record<string, any>>({
        entityType: 'CLUB', distance: 15
    });

    // Data State
    const [markers, setMarkers] = useState<MapMarkerDto[]>([]);
    const [selectedMarker, setSelectedMarker] = useState<MapMarkerDto | null>(null);

    // FETCH DATA
    useEffect(() => {
        const fetchPins = async () => {
            try {
                let url = `/map/nearby?lat=${mapCenter[0]}&lng=${mapCenter[1]}&radius=${activeFilters.distance || 15}&type=${activeFilters.entityType || 'CLUB'}`;

                if (activeFilters.gender && activeFilters.gender.length > 0) url += `&gender=${activeFilters.gender.join(',')}`;
                if (activeFilters.ageGroups && activeFilters.ageGroups.length > 0) url += `&ageGroups=${activeFilters.ageGroups.join(',')}`;
                if (activeFilters.cities && activeFilters.cities.length > 0) url += `&cities=${activeFilters.cities.join(',')}`;
                if (activeFilters.countries && activeFilters.countries.length > 0) url += `&countries=${activeFilters.countries.join(',')}`;

                const res = await apiClient.get(url);
                setMarkers(res.data);
            } catch (err) {
                console.error("Failed to load map pins", err);
            }
        };

        const timer = setTimeout(() => { fetchPins(); }, 300);
        return () => clearTimeout(timer);
    }, [mapCenter[0], mapCenter[1], activeFilters]);

    const handleMarkerClick = (marker: MapMarkerDto) => {
        setSelectedMarker(marker);
        setMapCenter([marker.latitude, marker.longitude]);
    };

    return (
        <div className="absolute inset-0 flex flex-row bg-slate-100 dark:bg-[#0f172a] overflow-hidden">

            <MapFilterSidebar
                isVisible={isFilterOpen}
                onClose={() => setIsFilterOpen(false)}
                onFiltersChange={setActiveFilters}
            />

            <div className="flex-1 relative h-full z-0 flex flex-col">

                {/* FLOATING SEARCH BAR & TOGGLE (Aligned to the Map's Top-Left) */}
                <div className="absolute top-6 left-6 right-6 z-[900] pointer-events-none flex flex-col gap-3">
                    <div className="flex gap-3 pointer-events-auto max-w-3xl">
                        {/* Always visible toggle button */}
                        <button onClick={() => setIsFilterOpen(!isFilterOpen)} className={`shrink-0 p-3.5 rounded-xl border-2 border-slate-900 shadow-[4px_4px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none transition-all ${isFilterOpen ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-emerald-500'}`}>
                            {isFilterOpen ? <ChevronLeft className="w-5 h-5" /> : <Filter className="w-5 h-5" />}
                        </button>

                        <div className="flex-1 bg-white dark:bg-slate-800 border-2 border-slate-900 rounded-xl shadow-[4px_4px_0px_0px_#020617] flex items-center px-4 py-1 group">
                            <Search className="w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                            <input
                                type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by club name or location..."
                                className="flex-1 bg-transparent border-none outline-none text-slate-900 dark:text-white placeholder:text-slate-400 font-bold text-sm ml-3 w-full"
                            />
                            {searchQuery && <button onClick={() => setSearchQuery('')} className="p-1 text-slate-400 hover:text-rose-500"><X className="w-4 h-4" /></button>}
                        </div>
                    </div>
                </div>

                <div className={`flex-1 relative transition-all duration-300 ${selectedMarker ? 'pr-[400px]' : ''}`}>
                    <MapContainer center={mapCenter} zoom={13} zoomControl={false} className="w-full h-full z-0">
                        <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                        <ZoomControl position="bottomright" />
                        <MapRecenter coords={mapCenter} />

                        <Circle center={mapCenter} radius={(activeFilters.distance || 15) * 1000} pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.08, weight: 2, dashArray: '10, 10' }} />

                        {markers.map((marker) => (
                            <Marker
                                key={`${marker.entityType}-${marker.entityId}`}
                                position={[marker.latitude, marker.longitude]}
                                icon={createBallIcon(selectedMarker?.entityId === marker.entityId, marker.entityType)}
                                eventHandlers={{ click: () => handleMarkerClick(marker) }}
                            />
                        ))}
                    </MapContainer>

                    <button onClick={() => setMapCenter([41.7151, 44.8271])} className="absolute bottom-6 left-6 z-[900] p-3.5 bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-500 rounded-xl border-2 border-slate-300 dark:border-slate-700 shadow-[4px_4px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none transition-all group">
                        <Navigation className="w-5 h-5 group-hover:rotate-45 transition-transform duration-300" />
                    </button>
                </div>

                {/* RIGHT SIDE DETAILS PANEL */}
                {selectedMarker && (
                    <div className="absolute inset-y-0 right-0 w-[400px] bg-white dark:bg-[#0f172a] border-l-2 border-slate-300 dark:border-black shadow-2xl z-[1000] flex flex-col animate-in slide-in-from-right duration-300">
                        <div className="relative h-48 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900 shrink-0 overflow-hidden border-b-2 border-slate-300 dark:border-black">
                            <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-[#0f172a] via-transparent to-transparent opacity-90"></div>
                            <button onClick={() => setSelectedMarker(null)} className="absolute top-4 right-4 p-2 bg-white/80 dark:bg-black/40 hover:bg-white dark:hover:bg-rose-500 backdrop-blur-sm text-slate-900 dark:text-white rounded-lg transition-colors border border-slate-300 dark:border-transparent z-10 shadow-sm">
                                <X className="w-4 h-4" />
                            </button>
                            <div className="absolute bottom-5 left-5 flex items-end gap-3 z-10">
                                <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl border-4 border-white dark:border-[#0f172a] shadow-lg flex items-center justify-center relative overflow-hidden group">
                                    <span className="text-2xl font-black text-white">{selectedMarker.title.substring(0, 2).toUpperCase()}</span>
                                </div>
                            </div>
                            <div className="absolute top-4 left-4">
                                <div className={`px-3 py-1.5 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md flex items-center gap-1.5 ${
                                    selectedMarker.entityType === 'CLUB' ? 'bg-emerald-600' :
                                        selectedMarker.entityType === 'TRYOUT' ? 'bg-orange-500' : 'bg-blue-600'
                                }`}>
                                    {selectedMarker.entityType === 'CLUB' ? <ShieldCheck className="w-3.5 h-3.5" /> :
                                        selectedMarker.entityType === 'TRYOUT' ? <Calendar className="w-3.5 h-3.5" /> : <Swords className="w-3.5 h-3.5" />}
                                    {selectedMarker.entityType.replace('_', ' ')}
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-1">{selectedMarker.title}</h2>
                                {selectedMarker.subtitle && <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{selectedMarker.subtitle}</p>}
                                {selectedMarker.date && <p className="text-sm font-black text-emerald-600 dark:text-emerald-500 mt-2">{selectedMarker.date}</p>}
                            </div>

                            {selectedMarker.entityType === 'CLUB' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50">
                                        <div className="flex items-center gap-1.5 mb-1"><Users className="w-3.5 h-3.5 text-emerald-500" /><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Network</p></div>
                                        <p className="text-xl font-black text-slate-900 dark:text-white">{selectedMarker.followers || 0}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50">
                                        <div className="flex items-center gap-1.5 mb-1"><Trophy className="w-3.5 h-3.5 text-emerald-500" /><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Verified</p></div>
                                        <p className="text-xl font-black text-blue-500">{selectedMarker.verified ? 'Official' : 'Unverified'}</p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                <div className="flex gap-3 text-slate-700 dark:text-slate-300 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-700/30">
                                    <MapPin className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Coordinates</p>
                                        <span className="text-sm font-bold">{selectedMarker.latitude.toFixed(4)}, {selectedMarker.longitude.toFixed(4)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 border-t-2 border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-[#0b141a] shrink-0">
                            {selectedMarker.entityType === 'CLUB' ? (
                                <button onClick={() => navigate(`/clubs/${selectedMarker.entityId}`)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-xs py-4 rounded-lg shadow-[4px_4px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-2 border-2 border-slate-900">
                                    Access Headquarters <ArrowRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <button onClick={() => alert("Event Details routing coming soon")} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-black uppercase tracking-widest text-xs py-4 rounded-lg shadow-[4px_4px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-2 border-2 border-slate-900">
                                    View Event Details <ArrowRight className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};