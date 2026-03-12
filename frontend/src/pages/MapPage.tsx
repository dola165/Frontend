import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents, useMap, Circle, ZoomControl } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import { apiClient } from "../api/axiosConfig";
import {
    MapPin,
    Navigation,
    Phone,
    Mail,
    ArrowRight,
    X,
    ShieldCheck,
    Loader2,
    Swords,
    Calendar,
    Search
} from "lucide-react";
import axios from "axios";

// --- TYPES ---
export type MapMarkerDto = {
    entityId: number;
    entityType: "CLUB" | "TRYOUT" | "MATCH_REQUEST" | string;
    title: string;
    subtitle?: string | null;
    latitude: number;
    longitude: number;
    distanceKm?: number | null;
};

interface ClubProfile {
    id: number;
    name: string;
    description: string;
    type: string;
    isOfficial: boolean;
    followerCount: number;
    memberCount: number;
    isFollowedByMe: boolean;
    addressText?: string;
    storeUrl?: string;
    gofundmeUrl?: string;
    phoneNumber?: string;
    email?: string;
}

const bannerImages = [
    "1518605368461-1ee71161d91a",
    "1574629810360-7efbb6b6923f",
    "1522778119026-d108dc1a0a52",
    "1508098682722-e99c43a406b2"
];

// --- CUSTOM BALL ICONS ---
const getPinIcon = () => {
    return L.divIcon({
        className: "custom-pin bg-transparent border-0",
        html: `<img src="/markers/ball.png" class="w-8 h-8 drop-shadow-[0_4px_4px_rgba(0,0,0,0.4)] transition-transform hover:scale-110" alt="pin" />`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });
};

const selectedIcon = L.divIcon({
    className: "custom-pin bg-transparent border-0",
    html: `
        <div class="relative flex flex-col items-center justify-center">
            <img src="/markers/ball.png" class="w-12 h-12 drop-shadow-[0_8px_8px_rgba(0,0,0,0.6)] animate-bounce" alt="selected" />
            <div class="w-6 h-1.5 bg-black/40 blur-[2px] rounded-[100%] absolute -bottom-1"></div>
        </div>
    `,
    iconSize: [48, 56],
    iconAnchor: [24, 48]
});

// --- HELPER COMPONENTS ---
function MapRecenter({ coords }: { coords: [number, number] }) {
    const map = useMap();
    useEffect(() => {
        map.setView(coords, map.getZoom(), { animate: true });
    }, [coords, map]);
    return null;
}

function LocateMeControl() {
    const map = useMap();
    const handleLocate = () => {
        map.locate().on("locationfound", function (e) {
            map.flyTo(e.latlng, 14);
        });
    };
    return (
        <div className="leaflet-bottom leaflet-left mb-6 ml-4 z-[1000] absolute">
            <button onClick={handleLocate} className="bg-white dark:bg-slate-800 p-3 rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617] border-2 border-slate-200 dark:border-slate-700 hover:text-emerald-500 transition-colors">
                <Navigation className="w-5 h-5" />
            </button>
        </div>
    );
}

function RadiusCircle({ radiusKm }: { radiusKm: number }) {
    const map = useMap();
    const center = map.getCenter();
    return (
        <Circle
            center={center}
            radius={radiusKm * 1000}
            pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.05, weight: 2, dashArray: '5, 10' }}
        />
    );
}

function NearbyLoader({ radiusKm, filterType, onMarkers, onLoading }: { radiusKm: number, filterType: string, onMarkers: (m: MapMarkerDto[]) => void, onLoading: (l: boolean) => void }) {
    const map = useMapEvents({
        moveend: () => fetchPoints(),
        zoomend: () => fetchPoints()
    });

    const cancelTokenRef = useRef<any>(null);

    const fetchPoints = useCallback(async () => {
        onLoading(true);
        const center = map.getCenter();

        if (cancelTokenRef.current) {
            cancelTokenRef.current.cancel("New request triggered");
        }
        cancelTokenRef.current = axios.CancelToken.source();

        try {
            const res = await apiClient.get<MapMarkerDto[]>('/map/nearby', {
                params: { lat: center.lat, lng: center.lng, radius: radiusKm, type: filterType },
                cancelToken: cancelTokenRef.current.token
            });
            onMarkers(res.data);
        } catch (err) {
            if (!axios.isCancel(err)) console.error("Map fetch failed", err);
        } finally {
            onLoading(false);
        }
    }, [map, radiusKm, filterType, onMarkers, onLoading]);

    useEffect(() => { fetchPoints(); }, [fetchPoints]);
    return null;
}

export const MapPage = () => {
    const navigate = useNavigate();

    // Context & Filters
    const [mapCenter, setMapCenter] = useState<[number, number]>([41.7151, 44.8271]); // Tbilisi
    const [radiusKm, setRadiusKm] = useState<number>(15);
    const [filterType, setFilterType] = useState<string>("ALL");

    // Data
    const [markers, setMarkers] = useState<MapMarkerDto[]>([]);
    const [loadingMarkers, setLoadingMarkers] = useState(false);

    // Selected State
    const [selectedMarker, setSelectedMarker] = useState<MapMarkerDto | null>(null);
    const [panelData, setPanelData] = useState<ClubProfile | null>(null);
    const [loadingPanel, setLoadingPanel] = useState(false);
    const [bannerError, setBannerError] = useState(false);

    // UI State
    const [displayRadius, setDisplayRadius] = useState<number>(15);

    // Filter Logic
    const toggleFilter = (type: string) => {
        setFilterType(prev => prev === type ? "ALL" : type);
        setSelectedMarker(null);
    };

    // Marker Click Handler
    const handleMarkerClick = async (marker: MapMarkerDto) => {
        setSelectedMarker(marker);
        setMapCenter([marker.latitude, marker.longitude]);
        setBannerError(false);

        if (marker.entityType === 'CLUB') {
            setLoadingPanel(true);
            try {
                const res = await apiClient.get(`/clubs/${marker.entityId}`);
                setPanelData(res.data);
            } catch (err) {
                console.error(err);
                setPanelData(null);
            } finally {
                setLoadingPanel(false);
            }
        } else {
            setPanelData(null);
        }
    };

    const closePanel = () => {
        setSelectedMarker(null);
        setPanelData(null);
    };

    const handleRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDisplayRadius(Number(e.target.value));
    };

    const handleRadiusCommit = () => {
        setRadiusKm(displayRadius);
    };

    const randomBannerId = bannerImages[(selectedMarker?.entityId || 0) % bannerImages.length];
    const bannerUrl = `https://images.unsplash.com/photo-${randomBannerId}?auto=format&fit=crop&q=80&w=600&h=300`;

    return (
        <div className="w-full h-full bg-[#0f172a] flex font-sans text-slate-300 relative overflow-hidden">
            {/* === MAIN MAP AREA === */}
            <div className="flex-1 relative z-0">
                <MapContainer center={mapCenter} zoom={13} className="w-full h-full" zoomControl={false}>
                    <ZoomControl position="bottomright" />

                    {/* CARTODB VOYAGER TILELAYER */}
                    <TileLayer
                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                        attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
                    />

                    <NearbyLoader radiusKm={radiusKm} filterType={filterType} onMarkers={setMarkers} onLoading={setLoadingMarkers} />
                    <RadiusCircle radiusKm={displayRadius} />
                    <MapRecenter coords={mapCenter} />
                    <LocateMeControl />

                    {markers.filter(m => (m.distanceKm ?? 0) <= radiusKm).map((m) => {
                        const isSelected = selectedMarker?.entityId === m.entityId && selectedMarker?.entityType === m.entityType;
                        const icon = isSelected ? selectedIcon : getPinIcon();

                        return (
                            <Marker key={`${m.entityType}:${m.entityId}`} position={[m.latitude, m.longitude]} icon={icon} eventHandlers={{ click: () => handleMarkerClick(m) }} />
                        );
                    })}
                </MapContainer>

                {/* Search & Filter Overlay (Top Left) */}
                <div className="absolute top-4 left-4 right-4 md:right-auto md:w-96 z-[1000] flex flex-col gap-2">
                    <div className="bg-white dark:bg-[#1e293b] p-1 rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617] border-2 border-slate-300 dark:border-slate-800 flex items-center">
                        <div className="p-2 text-slate-400"><Search className="w-5 h-5" /></div>
                        <input type="text" placeholder="Search grid..." className="w-full bg-transparent border-none outline-none text-base text-slate-900 dark:text-white font-bold px-2 placeholder-slate-400 dark:placeholder-slate-300" />
                        {loadingMarkers && <Loader2 className="w-4 h-4 mr-3 animate-spin text-emerald-500" />}
                    </div>

                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        <button onClick={() => toggleFilter('CLUB')} className={`shrink-0 px-4 py-2 rounded-sm text-xs font-black uppercase tracking-widest border-2 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[2px_2px_0px_0px_#020617] flex items-center gap-1.5 ${filterType === 'CLUB' || filterType === 'ALL' ? 'bg-emerald-600/95 text-white border-emerald-800' : 'bg-white text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600'}`}>
                            <ShieldCheck className="w-3.5 h-3.5" /> Clubs
                        </button>
                        <button onClick={() => toggleFilter('TRYOUT')} className={`shrink-0 px-4 py-2 rounded-sm text-xs font-black uppercase tracking-widest border-2 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[2px_2px_0px_0px_#020617] flex items-center gap-1.5 ${filterType === 'TRYOUT' || filterType === 'ALL' ? 'bg-orange-500/95 text-white border-orange-700' : 'bg-white text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600'}`}>
                            <Calendar className="w-3.5 h-3.5" /> Tryouts
                        </button>
                        <button onClick={() => toggleFilter('MATCH_REQUEST')} className={`shrink-0 px-4 py-2 rounded-sm text-xs font-black uppercase tracking-widest border-2 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[2px_2px_0px_0px_#020617] flex items-center gap-1.5 ${filterType === 'MATCH_REQUEST' || filterType === 'ALL' ? 'bg-blue-600/95 text-white border-blue-800' : 'bg-white text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600'}`}>
                            <Swords className="w-3.5 h-3.5" /> Matches
                        </button>
                    </div>

                    <div className="bg-white/95 dark:bg-[#1e293b]/95 p-3 rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617] border-2 border-slate-300 dark:border-slate-800 mt-1">
                        <div className="flex justify-between text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 mb-2">
                            <span>Scan Radius</span>
                            <span className="text-emerald-500">{displayRadius} km</span>
                        </div>
                        <input
                            type="range" min="1" max="100" value={displayRadius}
                            onChange={handleRadiusChange} onMouseUp={handleRadiusCommit} onTouchEnd={handleRadiusCommit}
                            className="w-full h-1.5 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                    </div>
                </div>
            </div>

            {/* === NEO-BRUTALIST SIDE PANEL === */}
            {selectedMarker && (
                <div className="absolute inset-y-0 right-0 w-full md:w-96 bg-white dark:bg-[#1e293b] border-l-4 border-slate-300 dark:border-slate-800 shadow-[-8px_0px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[-8px_0px_0px_0px_#020617] z-[2000] flex flex-col animate-in slide-in-from-right duration-300">

                    {loadingPanel ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-emerald-500">
                            <Loader2 className="w-8 h-8 animate-spin mb-4" />
                            <span className="text-xs font-black uppercase tracking-widest">Decrypting Intel...</span>
                        </div>
                    ) : selectedMarker.entityType === 'CLUB' && panelData ? (
                        <>
                            <div className="h-48 relative bg-slate-900 shrink-0">
                                {!bannerError ? (
                                    <img src={bannerUrl} alt="Banner" onError={() => setBannerError(true)} className="w-full h-full object-cover opacity-70" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-emerald-900 to-slate-900 opacity-80" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-[#1e293b] to-transparent" />
                                <button onClick={closePanel} className="absolute top-4 right-4 p-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded-sm transition-colors">
                                    <X className="w-5 h-5" />
                                </button>

                                <div className="absolute -bottom-6 left-6 flex items-end gap-4">
                                    <div className="w-20 h-20 bg-emerald-600 rounded-sm border-4 border-[#1e293b] flex items-center justify-center text-2xl font-black text-white shadow-sm">
                                        {panelData.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    {panelData.isOfficial && (
                                        <div className="mb-2 bg-blue-500 text-white p-1 rounded-sm shadow-sm" title="Verified Organization">
                                            <ShieldCheck className="w-4 h-4" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pt-10">
                                <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none mb-1">{panelData.name}</h2>
                                <p className="text-emerald-600 dark:text-emerald-500 font-bold text-xs uppercase tracking-widest mb-6">{panelData.type}</p>

                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-sm border border-slate-200 dark:border-slate-700">
                                        <p className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest mb-1">Network</p>
                                        <p className="font-black text-slate-900 dark:text-white text-xl">{panelData.followerCount}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-sm border border-slate-200 dark:border-slate-700">
                                        <p className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest mb-1">Roster</p>
                                        <p className="font-black text-slate-900 dark:text-white text-xl">{panelData.memberCount}</p>
                                    </div>
                                </div>

                                <div className="space-y-4 mb-8">
                                    <div className="flex gap-3 text-base text-slate-700 dark:text-slate-200 font-medium">
                                        <MapPin className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                        <span>{panelData.addressText || "Location undisclosed"}</span>
                                    </div>
                                    {panelData.phoneNumber && (
                                        <div className="flex gap-3 text-base text-slate-700 dark:text-slate-200 font-medium">
                                            <Phone className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                            <span>{panelData.phoneNumber}</span>
                                        </div>
                                    )}
                                    {panelData.email && (
                                        <div className="flex gap-3 text-base text-slate-700 dark:text-slate-200 font-medium">
                                            <Mail className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                            <span className="truncate">{panelData.email}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-slate-50 dark:bg-[#0f172a] p-4 rounded-sm border-l-2 border-emerald-500 mb-6">
                                    <h4 className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest mb-2">Official Charter</h4>
                                    <p className="text-sm text-slate-800 dark:text-slate-200 font-medium leading-relaxed italic">
                                        "{panelData.description || "No information provided."}"
                                    </p>
                                </div>
                            </div>

                            <div className="p-4 border-t-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0">
                                <button
                                    onClick={() => navigate(`/clubs/${panelData.id}`)}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-sm py-3.5 rounded-sm shadow-[4px_4px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-2"
                                >
                                    Access Full Terminal <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="p-6 h-full flex flex-col">
                            <div className="flex justify-between items-center mb-8 border-b-2 border-slate-800 pb-4">
                                <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
                                    {selectedMarker.entityType === 'TRYOUT' ? <Calendar className="w-5 h-5 text-orange-500" /> : <Swords className="w-5 h-5 text-blue-500" />}
                                    Intel Log
                                </h2>
                                <button onClick={closePanel} className="text-slate-400 hover:text-rose-500 transition-colors"><X className="w-5 h-5"/></button>
                            </div>

                            <div className="flex-1 flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 bg-slate-800 rounded-sm flex items-center justify-center mb-4 border-2 border-slate-700">
                                    <MapPin className="w-8 h-8 text-emerald-500" />
                                </div>
                                <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">{selectedMarker.title}</h3>
                                <p className="text-base text-slate-300 font-bold mb-8">{selectedMarker.subtitle || "Coordinates Locked."}</p>

                                <button onClick={() => navigate(`/clubs/${selectedMarker.entityId}`)} className="bg-slate-800 hover:bg-slate-700 text-white font-black uppercase tracking-widest text-xs py-3 px-6 rounded-sm border-2 border-slate-600 transition-colors flex items-center gap-2">
                                    View Host Organization <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};