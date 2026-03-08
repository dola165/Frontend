import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents, useMap, Circle, ZoomControl } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import { apiClient } from "../api/axiosConfig";
import { MapPin, Navigation, Phone, Mail, Users, ArrowRight, X, ShieldCheck, Loader2, Swords, Calendar } from "lucide-react";
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
    "1508098682722-e99c43a406b2",
    "1431324155629-1a610d6e60d5"
];

// --- CUSTOM SHARP ICONS ---
const createSvgIcon = (fillColor: string) => encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 48 48">
  <circle cx="24" cy="24" r="22" fill="${fillColor}" stroke="#0f172a" stroke-width="3"/>
  <path d="M24 12 L14 18 L16 30 L32 30 L34 18 Z" fill="#0f172a"/>
  <path d="M24 2 L24 12 M2 16 L14 18 M8 40 L16 30 M40 40 L32 30 M46 16 L34 18" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/>
</svg>
`);

const clubIcon = new L.Icon({ iconUrl: `data:image/svg+xml,${createSvgIcon('#10b981')}`, iconSize: [32, 32], iconAnchor: [16, 32] });
const tryoutIcon = new L.Icon({ iconUrl: `data:image/svg+xml,${createSvgIcon('#f97316')}`, iconSize: [32, 32], iconAnchor: [16, 32] });
const matchIcon = new L.Icon({ iconUrl: `data:image/svg+xml,${createSvgIcon('#3b82f6')}`, iconSize: [32, 32], iconAnchor: [16, 32] });

const selectedIcon = new L.Icon({
    iconUrl: `data:image/svg+xml,${createSvgIcon('#ffffff')}`,
    iconSize: [44, 44],
    iconAnchor: [22, 44],
    className: 'drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]'
});

// --- HELPER COMPONENTS ---
function NearbyLoader({ radiusKm, filterType, onMarkers, onLoading }: { radiusKm: number; filterType: string; onMarkers: (markers: MapMarkerDto[]) => void; onLoading: (isLoading: boolean) => void; }) {
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
        click: () => {}
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
        <button onClick={handleLocateClick} disabled={locating} className={`absolute bottom-6 right-14 z-[1000] p-2.5 rounded-sm shadow-[2px_2px_0px_0px_#0f172a] border-2 border-slate-900 transition-all ${locating ? "bg-slate-200 text-slate-400" : "bg-white text-slate-700 hover:bg-slate-100 active:translate-y-0.5 active:shadow-none"}`}>
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
        return () => { map.off('move', updateCenter); };
    }, [map]);
    return <Circle center={center} radius={radiusKm * 1000} pathOptions={{ fillColor: '#10b981', fillOpacity: 0.1, color: '#10b981', weight: 2, dashArray: '5, 10', interactive: false }} />;
}

// --- MAIN PAGE ---
export function MapPage() {
    const navigate = useNavigate();
    const [markers, setMarkers] = useState<MapMarkerDto[]>([]);
    const [loadingMarkers, setLoadingMarkers] = useState(false);

    const [radiusKm, setRadiusKm] = useState<number>(15);
    const [displayRadius, setDisplayRadius] = useState<number>(15);

    // THE NEW MATCH_REQUEST FILTER
    const [filterType, setFilterType] = useState<"CLUB" | "TRYOUT" | "MATCH_REQUEST">("CLUB");

    const [selectedMarker, setSelectedMarker] = useState<MapMarkerDto | null>(null);
    const [panelData, setPanelData] = useState<ClubProfile | null>(null);
    const [isPanelLoading, setIsPanelLoading] = useState(false);

    const handleMarkerClick = async (marker: MapMarkerDto) => {
        setSelectedMarker(marker);

        // We only need to fetch deep data if it's a Club.
        // For Matches and Tryouts, the basic MapMarkerDto has enough info!
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
        } else {
            setPanelData(null);
        }
    };

    const closePanel = () => {
        setSelectedMarker(null);
        setTimeout(() => setPanelData(null), 300);
    };

    // Determine the active pin icon based on the filter
    const getPinIcon = (type: string) => {
        if (type === 'TRYOUT') return tryoutIcon;
        if (type === 'MATCH_REQUEST') return matchIcon;
        return clubIcon;
    };

    return (
        <div className="flex w-full h-[calc(100vh-56px)] relative overflow-hidden bg-slate-100 dark:bg-[#0f172a] font-sans">

            {/* --- SHARP SLIDING SIDE PANEL --- */}
            <div className={`absolute top-0 left-0 h-full w-full md:w-[400px] bg-white dark:bg-[#1e293b] z-[2000] border-r-2 border-slate-300 dark:border-slate-800 shadow-[4px_0px_15px_rgba(0,0,0,0.1)] dark:shadow-none transition-transform duration-300 ease-in-out flex flex-col ${selectedMarker ? 'translate-x-0' : '-translate-x-full'}`}>

                {isPanelLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-emerald-600 dark:text-emerald-500">
                        <Loader2 className="w-10 h-10 animate-spin mb-4" />
                        <p className="font-bold tracking-widest uppercase text-sm text-slate-500">Retrieving Intel...</p>
                    </div>
                ) : selectedMarker?.entityType === 'MATCH_REQUEST' ? (

                    /* --- MATCH REQUEST PANEL --- */
                    <div className="flex flex-col h-full relative">
                        <div className="h-32 bg-blue-600 border-b-2 border-slate-900 flex items-center justify-center relative shrink-0">
                            <Swords className="w-12 h-12 text-white opacity-50" />
                            <button onClick={closePanel} className="absolute top-4 right-4 bg-slate-900/50 hover:bg-slate-900 text-white p-1.5 rounded-sm transition-colors border border-white/20">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto">
                            <div className="w-16 h-16 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 shadow-sm rounded-sm flex items-center justify-center -mt-12 mb-4 relative z-10 text-xl font-black text-blue-500">
                                {selectedMarker.title.substring(0,2).toUpperCase()}
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{selectedMarker.title}</h2>
                            <p className="text-blue-500 font-bold uppercase tracking-widest text-xs mt-1">Open Match Request</p>

                            <div className="bg-slate-50 dark:bg-[#0f172a] p-4 rounded-sm border border-slate-200 dark:border-slate-800 mt-6 shadow-inner">
                                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold flex items-center gap-1.5 mb-1"><MapPin className="w-3.5 h-3.5"/> Logistics</span>
                                <p className="text-slate-900 dark:text-white font-bold text-sm uppercase">{selectedMarker.subtitle?.replace('_', ' ')}</p>
                            </div>
                        </div>
                        <div className="p-6 shrink-0 bg-slate-50 dark:bg-[#0f172a] border-t border-slate-200 dark:border-slate-800">
                            <button onClick={() => alert("Match coordination workflow coming soon!")} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-sm uppercase tracking-widest text-sm shadow-[2px_2px_0px_0px_#020617] border border-transparent active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-2">
                                <Swords className="w-4 h-4" /> Send Challenge
                            </button>
                        </div>
                    </div>

                ) : selectedMarker?.entityType === 'TRYOUT' ? (

                    /* --- TRYOUT PANEL --- */
                    <div className="flex flex-col h-full relative">
                        <div className="h-32 bg-orange-500 border-b-2 border-slate-900 flex items-center justify-center relative shrink-0">
                            <Calendar className="w-12 h-12 text-white opacity-50" />
                            <button onClick={closePanel} className="absolute top-4 right-4 bg-slate-900/50 hover:bg-slate-900 text-white p-1.5 rounded-sm transition-colors border border-white/20">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto">
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mt-2">{selectedMarker.title}</h2>
                            <p className="text-orange-500 font-bold uppercase tracking-widest text-xs mt-1 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5"/> Hosted By: {selectedMarker.subtitle}</p>

                            <div className="bg-slate-50 dark:bg-[#0f172a] p-4 rounded-sm border border-slate-200 dark:border-slate-800 mt-6 shadow-inner">
                                <p className="text-slate-600 dark:text-slate-400 font-medium text-sm">This club is actively scouting for players. Apply below to submit your profile and highlight reel to the coaching staff.</p>
                            </div>
                        </div>
                        <div className="p-6 shrink-0 bg-slate-50 dark:bg-[#0f172a] border-t border-slate-200 dark:border-slate-800">
                            <button onClick={() => alert("Tryout Application workflow coming soon!")} className="w-full bg-orange-500 hover:bg-orange-400 text-slate-900 font-black py-3 rounded-sm uppercase tracking-widest text-sm shadow-[2px_2px_0px_0px_#020617] border border-transparent active:translate-y-0.5 active:shadow-none transition-all">
                                Apply for Tryout
                            </button>
                        </div>
                    </div>

                ) : panelData ? (

                    /* --- FULL CLUB PANEL --- */
                    <>
                        <div className="h-32 relative bg-slate-900 shrink-0 border-b border-slate-800">
                            <img src={`https://images.unsplash.com/photo-${bannerImages[panelData.id % bannerImages.length]}?auto=format&fit=crop&q=80&w=600&h=300`} alt="Banner" className="w-full h-full object-cover opacity-60" />
                            <button onClick={closePanel} className="absolute top-4 right-4 bg-slate-900/50 hover:bg-slate-900 text-white p-1.5 rounded-sm backdrop-blur-sm transition-colors border border-white/20">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 relative scrollbar-hide">
                            <div className="absolute -top-10 left-6 w-16 h-16 bg-white dark:bg-[#1e293b] rounded-sm border-2 border-slate-300 dark:border-slate-700 shadow-sm overflow-hidden flex items-center justify-center">
                                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(panelData.name)}&background=10b981&color=fff&bold=true&size=150`} alt={panelData.name} className="w-full h-full object-cover" />
                            </div>

                            <div className="mt-8 mb-6">
                                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2 leading-none">
                                    {panelData.name} {panelData.isOfficial && <ShieldCheck className="w-5 h-5 text-blue-500" />}
                                </h2>
                                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-500 mt-1 uppercase tracking-widest">{panelData.type}</p>
                            </div>

                            <div className="bg-slate-50 dark:bg-[#0f172a] rounded-sm p-4 flex flex-col gap-3 border border-slate-200 dark:border-slate-800 mb-6 shadow-inner">
                                <div className="flex items-start gap-3">
                                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{panelData.addressText || "Address not provided"}</span>
                                </div>
                                {panelData.phoneNumber && (
                                    <div className="flex items-center gap-3">
                                        <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                                        <a href={`tel:${panelData.phoneNumber}`} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">{panelData.phoneNumber}</a>
                                    </div>
                                )}
                                {panelData.email && (
                                    <div className="flex items-center gap-3">
                                        <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                                        <a href={`mailto:${panelData.email}`} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">{panelData.email}</a>
                                    </div>
                                )}
                                <div className="flex items-center gap-3">
                                    <Users className="w-4 h-4 text-slate-400 shrink-0" />
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">{panelData.followerCount} <span className="font-medium text-slate-500">Followers</span></span>
                                </div>
                            </div>

                            <div className="mb-6">
                                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 pb-1 border-b border-slate-200 dark:border-slate-800">Database Intel</h3>
                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line font-medium">
                                    {panelData.description || "No official directives have been published by this organization."}
                                </p>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-[#0f172a] border-t border-slate-200 dark:border-slate-800 shrink-0">
                            <button onClick={() => navigate(`/clubs/${panelData.id}`)} className="w-full flex items-center justify-center gap-2 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 py-3 rounded-sm font-bold uppercase tracking-widest text-xs transition-colors shadow-[2px_2px_0px_0px_#10b981] active:translate-y-0.5 active:shadow-none border border-transparent">
                                Access Full Profile <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </>
                ) : null}
            </div>

            {/* --- MAP AREA --- */}
            <div className="flex-1 h-full relative z-0">

                {/* Scanning Indicator */}
                {loadingMarkers && (
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000]">
                        <div className="bg-slate-900 text-white px-4 py-2 rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] border border-slate-700 flex items-center gap-2">
                            <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-[10px] font-bold uppercase tracking-widest">Scanning Grid...</span>
                        </div>
                    </div>
                )}

                {/* Sharp Floating UI Widget */}
                <div className="absolute top-4 right-4 z-[1000] bg-white dark:bg-[#1e293b] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617] border border-slate-200 dark:border-slate-700 rounded-sm p-4 w-72 transition-colors">

                    {/* Filter Toggles */}
                    <div className="flex gap-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-sm mb-4">
                        <button onClick={() => setFilterType("CLUB")} className={`flex-1 text-[10px] font-bold uppercase py-2 rounded-sm transition-all ${filterType === "CLUB" ? "bg-white dark:bg-[#1e293b] text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200 dark:border-slate-700" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}>
                            Clubs
                        </button>
                        <button onClick={() => setFilterType("TRYOUT")} className={`flex-1 text-[10px] font-bold uppercase py-2 rounded-sm transition-all ${filterType === "TRYOUT" ? "bg-white dark:bg-[#1e293b] text-orange-500 shadow-sm border border-slate-200 dark:border-slate-700" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}>
                            Tryouts
                        </button>
                        <button onClick={() => setFilterType("MATCH_REQUEST")} className={`flex-1 text-[10px] font-bold uppercase py-2 rounded-sm transition-all ${filterType === "MATCH_REQUEST" ? "bg-white dark:bg-[#1e293b] text-blue-500 shadow-sm border border-slate-200 dark:border-slate-700" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}>
                            Matches
                        </button>
                    </div>

                    <div className="flex justify-between items-center mb-3">
                        <span className="font-bold uppercase text-slate-700 dark:text-slate-300 text-[10px] flex items-center gap-1.5 tracking-widest">
                            <MapPin className="w-3.5 h-3.5 text-slate-500" /> Search Radius
                        </span>
                        <span className="text-slate-900 dark:text-white font-black bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-sm text-xs">
                            {displayRadius} km
                        </span>
                    </div>

                    <input type="range" min="1" max="50" step="1" value={displayRadius} onChange={(e) => setDisplayRadius(Number(e.target.value))} onPointerUp={() => setRadiusKm(displayRadius)} className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-sm appearance-none cursor-pointer accent-emerald-500" />
                </div>

                <MapContainer center={[41.7151, 44.8271]} zoom={12} className="w-full h-full" zoomControl={false}>
                    <ZoomControl position="bottomright" />
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution='&copy; CartoDB' />

                    <NearbyLoader radiusKm={radiusKm} filterType={filterType} onMarkers={setMarkers} onLoading={setLoadingMarkers} />
                    <RadiusCircle radiusKm={displayRadius} />
                    <LocateMeControl />

                    {markers.filter(m => (m.distanceKm ?? 0) <= radiusKm).map((m) => {
                        const isSelected = selectedMarker?.entityId === m.entityId && selectedMarker?.entityType === m.entityType;
                        const icon = isSelected ? selectedIcon : getPinIcon(m.entityType);

                        return (
                            <Marker key={`${m.entityType}:${m.entityId}`} position={[m.latitude, m.longitude]} icon={icon} eventHandlers={{ click: () => handleMarkerClick(m) }} />
                        );
                    })}
                </MapContainer>

                {/* Mobile overlay to close panel */}
                {selectedMarker && (
                    <div className="absolute inset-0 bg-slate-900/20 z-[1500] md:hidden backdrop-blur-sm" onClick={closePanel} />
                )}
            </div>
        </div>
    );
}