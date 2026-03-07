import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents, useMap, Circle, ZoomControl } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import { apiClient } from "../api/axiosConfig";
import { MapPin, Navigation, Phone, Mail, Users, ArrowRight, X, ShieldCheck, ShoppingCart, HeartHandshake, Loader2 } from "lucide-react";
import axios from "axios";

// --- TYPES ---
export type MapMarkerDto = {
    entityId: number;
    entityType: "CLUB" | "USER" | string;
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

// --- CONSTANTS & ICONS ---
const bannerImages = [
    "1518605368461-1ee71161d91a",
    "1574629810360-7efbb6b6923f",
    "1522778119026-d108dc1a0a52",
    "1508098682722-e99c43a406b2",
    "1431324155629-1a610d6e60d5"
];

const soccerBallSvg = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <circle cx="24" cy="24" r="22" fill="#ffffff" stroke="#000000" stroke-width="2"/>
  <path d="M24 12 L14 18 L16 30 L32 30 L34 18 Z" fill="#000000"/>
  <path d="M24 2 L24 12 M2 16 L14 18 M8 40 L16 30 M40 40 L32 30 M46 16 L34 18" stroke="#000000" stroke-width="2" stroke-linecap="round"/>
  <circle cx="24" cy="24" r="22" fill="none" stroke="#000000" stroke-width="2"/>
</svg>
`);

const clubIcon = new L.Icon({
    iconUrl: `data:image/svg+xml,${soccerBallSvg}`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
});

const selectedIcon = new L.Icon({
    iconUrl: `data:image/svg+xml,${soccerBallSvg}`,
    iconSize: [48, 48],
    iconAnchor: [24, 48],
    className: 'drop-shadow-[0_0_15px_rgba(16,185,129,0.8)]'
});

// --- HELPER COMPONENTS (From your original code) ---
function NearbyLoader({ radiusKm, filterType, onMarkers, onLoading }: { radiusKm: number; filterType: "CLUB" | "TRYOUT"; onMarkers: (markers: MapMarkerDto[]) => void; onLoading: (isLoading: boolean) => void; }) {
    const map = useMap();
    const debounceTimerRef = useRef<number | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const getVisibleRadius = useCallback(() => {
        const bounds = map.getBounds();
        const center = map.getCenter();
        const northEast = bounds.getNorthEast();
        const distance = center.distanceTo(northEast) / 1000;
        return Math.max(radiusKm, Math.ceil(distance * 1.2));
    }, [map, radiusKm]);

    const fetchNearby = useCallback(async (lat: number, lng: number, radius: number, type: string) => {
        try {
            onLoading(true);
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            const response = await apiClient.get<MapMarkerDto[]>("/map/nearby", {
                params: { lat, lng, radius, type },
                signal: controller.signal,
            });
            onMarkers(response.data);
            onLoading(false);
        } catch (error) {
            if (axios.isCancel(error)) return;
            if (error instanceof DOMException && error.name === "AbortError") return;
            onLoading(false);
        }
    }, [onMarkers, onLoading]);

    const scheduleFetch = useCallback((lat: number, lng: number) => {
        if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = window.setTimeout(() => {
            fetchNearby(lat, lng, getVisibleRadius(), filterType);
        }, 300);
    }, [fetchNearby, getVisibleRadius, filterType]);

    useMapEvents({
        moveend: () => scheduleFetch(map.getCenter().lat, map.getCenter().lng),
        zoomend: () => scheduleFetch(map.getCenter().lat, map.getCenter().lng),
        click: () => {} // Kept to allow map clicks to close panels via parent
    });

    useEffect(() => {
        fetchNearby(map.getCenter().lat, map.getCenter().lng, getVisibleRadius(), filterType);
    }, [fetchNearby, getVisibleRadius, filterType, map]);

    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
            abortRef.current?.abort();
        };
    }, []);

    return null;
}

function LocateMeControl() {
    const map = useMap();
    const [locating, setLocating] = useState(false);

    const handleLocateClick = () => {
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                map.flyTo([position.coords.latitude, position.coords.longitude], 13, { duration: 1.5 });
                setLocating(false);
            },
            () => { alert("Could not get location."); setLocating(false); }
        );
    };

    return (
        <button onClick={handleLocateClick} disabled={locating} className={`absolute bottom-6 right-14 z-[1000] p-3 rounded-full shadow-lg border-2 border-black transition-all ${locating ? "bg-gray-100 text-gray-400" : "bg-orange-400 text-white hover:bg-orange-500"}`}>
            <Navigation className={`w-5 h-5 ${locating ? "animate-pulse" : ""}`} />
        </button>
    );
}

function RadiusCircle({ radiusKm }: { radiusKm: number }) {
    const map = useMap();
    const [center, setCenter] = useState(map.getCenter());

    useEffect(() => {
        const updateCenter = () => setCenter(map.getCenter());
        map.on('move', updateCenter);
        return () => {
            map.off('move', updateCenter);
        };
    }, [map]);
    return <Circle center={center} radius={radiusKm * 1000} pathOptions={{ fillColor: '#f97316', fillOpacity: 0.1, color: '#f97316', weight: 2, dashArray: '5, 10', interactive: false }} />;
}

// --- MAIN PAGE ---
export function MapPage() {
    const navigate = useNavigate();
    const [markers, setMarkers] = useState<MapMarkerDto[]>([]);
    const [loadingMarkers, setLoadingMarkers] = useState(false);

    // Map Filter State
    const [radiusKm, setRadiusKm] = useState<number>(15);
    const [displayRadius, setDisplayRadius] = useState<number>(15);
    const [filterType, setFilterType] = useState<"CLUB" | "TRYOUT">("CLUB");

    // Side Panel State
    const [selectedMarker, setSelectedMarker] = useState<MapMarkerDto | null>(null);
    const [panelData, setPanelData] = useState<ClubProfile | null>(null);
    const [isPanelLoading, setIsPanelLoading] = useState(false);

    const handleMarkerClick = async (marker: MapMarkerDto) => {
        setSelectedMarker(marker);

        if (marker.entityType === 'CLUB') {
            setIsPanelLoading(true);
            try {
                const res = await apiClient.get(`/clubs/${marker.entityId}`);
                setPanelData(res.data);
            } catch (error) {
                console.error("Failed to load club details", error);
            } finally {
                setIsPanelLoading(false);
            }
        }
    };

    const closePanel = () => {
        setSelectedMarker(null);
        setTimeout(() => setPanelData(null), 300);
    };

    return (
        <div className="flex w-full h-[calc(100vh-72px)] relative overflow-hidden bg-gray-100 dark:bg-gray-900">

            {/* --- SLIDING SIDE PANEL --- */}
            <div className={`absolute top-0 left-0 h-full w-full md:w-[400px] bg-white dark:bg-gray-800 z-[2000] shadow-2xl transition-transform duration-300 ease-in-out flex flex-col ${selectedMarker ? 'translate-x-0' : '-translate-x-full'}`}>

                {isPanelLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-emerald-500">
                        <Loader2 className="w-10 h-10 animate-spin mb-4" />
                        <p className="font-bold tracking-widest uppercase text-sm text-gray-500">Retrieving Intel...</p>
                    </div>
                ) : panelData ? (
                    <>
                        <div className="h-40 relative bg-slate-900 shrink-0">
                            <img src={`https://images.unsplash.com/photo-${bannerImages[panelData.id % bannerImages.length]}?auto=format&fit=crop&q=80&w=600&h=300`} alt="Banner" className="w-full h-full object-cover opacity-70" />
                            <button onClick={closePanel} className="absolute top-4 right-4 bg-black/50 hover:bg-black text-white p-2 rounded-full backdrop-blur-sm transition-colors border border-white/20">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 relative scrollbar-hide">
                            <div className="absolute -top-12 left-6 w-20 h-20 bg-white dark:bg-gray-800 rounded-2xl border-4 border-white dark:border-gray-800 shadow-lg overflow-hidden flex items-center justify-center">
                                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(panelData.name)}&background=10b981&color=fff&bold=true&size=150`} alt={panelData.name} className="w-full h-full object-cover" />
                            </div>

                            <div className="mt-10 mb-6">
                                <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2 leading-none">
                                    {panelData.name} {panelData.isOfficial && <ShieldCheck className="w-6 h-6 text-blue-500" />}
                                </h2>
                                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1.5 uppercase tracking-wider">{panelData.type}</p>
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 flex flex-col gap-4 border border-gray-200 dark:border-gray-700 mb-6 shadow-sm">
                                <div className="flex items-start gap-3">
                                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{panelData.addressText || "Address not provided"}</span>
                                </div>
                                {panelData.phoneNumber && (
                                    <div className="flex items-center gap-3">
                                        <Phone className="w-5 h-5 text-gray-400 shrink-0" />
                                        <a href={`tel:${panelData.phoneNumber}`} className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline">{panelData.phoneNumber}</a>
                                    </div>
                                )}
                                {panelData.email && (
                                    <div className="flex items-center gap-3">
                                        <Mail className="w-5 h-5 text-gray-400 shrink-0" />
                                        <a href={`mailto:${panelData.email}`} className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline">{panelData.email}</a>
                                    </div>
                                )}
                                <div className="flex items-center gap-3">
                                    <Users className="w-5 h-5 text-gray-400 shrink-0" />
                                    <span className="text-sm font-bold text-gray-900 dark:text-white">{panelData.followerCount} <span className="font-medium text-gray-500">Followers</span></span>
                                </div>
                            </div>

                            {(panelData.storeUrl || panelData.gofundmeUrl) && (
                                <div className="flex gap-2 mb-6">
                                    {panelData.storeUrl && (
                                        <a href={panelData.storeUrl} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 py-2.5 rounded-xl text-sm font-bold transition-colors hover:bg-orange-200 border border-orange-200 dark:border-orange-900">
                                            <ShoppingCart className="w-4 h-4" /> Store
                                        </a>
                                    )}
                                    {panelData.gofundmeUrl && (
                                        <a href={panelData.gofundmeUrl} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 py-2.5 rounded-xl text-sm font-bold transition-colors hover:bg-rose-200 border border-rose-200 dark:border-rose-900">
                                            <HeartHandshake className="w-4 h-4" /> Support
                                        </a>
                                    )}
                                </div>
                            )}

                            <div className="mb-6">
                                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">About the Club</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line font-medium">
                                    {panelData.description || "No description provided."}
                                </p>
                            </div>
                        </div>

                        <div className="p-4 bg-white dark:bg-gray-800 border-t-2 border-black shrink-0">
                            <button onClick={() => navigate(`/clubs/${panelData.id}`)} className="w-full flex items-center justify-center gap-2 bg-black hover:bg-gray-800 text-white py-3.5 rounded-xl font-black uppercase tracking-wider transition-colors shadow-[4px_4px_0px_0px_rgba(16,185,129,1)] hover:shadow-none hover:translate-y-1 hover:translate-x-1 border-2 border-black">
                                Full Profile <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </>
                ) : null}
            </div>

            {/* --- MAP AREA --- */}
            <div className="flex-1 h-full relative z-0">

                {/* Loading Indicator */}
                {loadingMarkers && (
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000]">
                        <div className="bg-black text-white px-4 py-2 rounded-full shadow-lg border-2 border-white flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-xs font-black uppercase tracking-widest">Scanning...</span>
                        </div>
                    </div>
                )}

                {/* Floating UI Widget */}
                <div className="absolute top-4 right-4 z-[1000] bg-white/95 backdrop-blur shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] border-4 border-black rounded-xl p-5 w-64 transition-all">
                    <div className="flex bg-gray-100 border-2 border-black p-1 rounded-lg mb-4">
                        <button onClick={() => setFilterType("CLUB")} className={`flex-1 text-[10px] font-black uppercase py-2 rounded-md transition-all ${filterType === "CLUB" ? "bg-white text-emerald-600 shadow-sm border-2 border-black" : "text-gray-500 hover:text-black"}`}>
                            Clubs
                        </button>
                        <button onClick={() => setFilterType("TRYOUT")} className={`flex-1 text-[10px] font-black uppercase py-2 rounded-md transition-all ${filterType === "TRYOUT" ? "bg-white text-orange-500 shadow-sm border-2 border-black" : "text-gray-500 hover:text-black"}`}>
                            Tryouts
                        </button>
                    </div>

                    <div className="flex justify-between items-center mb-3">
                        <span className="font-black italic uppercase text-gray-900 text-xs flex items-center gap-1.5 tracking-tighter">
                            <MapPin className="w-4 h-4 text-orange-500" /> Radius
                        </span>
                        <span className="text-white font-black bg-black border-2 border-black px-2 py-0.5 rounded-md text-xs italic">
                            {displayRadius} km
                        </span>
                    </div>

                    <input type="range" min="1" max="50" step="1" value={displayRadius} onChange={(e) => setDisplayRadius(Number(e.target.value))} onPointerUp={() => setRadiusKm(displayRadius)} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black border border-black" />
                </div>

                <MapContainer center={[41.7151, 44.8271]} zoom={12} className="w-full h-full" zoomControl={false}>
                    <ZoomControl position="bottomright" />
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution='&copy; CartoDB' />

                    <NearbyLoader radiusKm={radiusKm} filterType={filterType} onMarkers={setMarkers} onLoading={setLoadingMarkers} />
                    <RadiusCircle radiusKm={displayRadius} />
                    <LocateMeControl />

                    {markers.filter(m => (m.distanceKm ?? 0) <= radiusKm).map((m) => {
                        const isSelected = selectedMarker?.entityId === m.entityId && selectedMarker?.entityType === m.entityType;
                        return (
                            <Marker key={`${m.entityType}:${m.entityId}`} position={[m.latitude, m.longitude]} icon={isSelected ? selectedIcon : clubIcon} eventHandlers={{ click: () => handleMarkerClick(m) }} />
                        );
                    })}
                </MapContainer>

                {/* Click outside to close panel */}
                {selectedMarker && (
                    <div className="absolute inset-0 bg-black/20 z-[1500] md:hidden backdrop-blur-sm" onClick={closePanel} />
                )}
            </div>
        </div>
    );
}