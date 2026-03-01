import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMapEvents, useMap, Circle } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import { apiClient } from "../api/axiosConfig";
import { MapPin, Navigation } from "lucide-react";
import axios from "axios";

// 1. The Types
export type MapMarkerDto = {
    entityId: number;
    entityType: "CLUB" | "USER" | string;
    title: string;
    subtitle?: string | null;
    latitude: number;
    longitude: number;
    distanceKm?: number | null;
};

// 2. The Custom Marker
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
    popupAnchor: [0, -34],
});

// 3. The Map Event Listener
function NearbyLoader({
                          radiusKm,
                          filterType,
                          onMarkers,
                          onLoading, // NEW: Added loading callback
                      }: {
    radiusKm: number;
    filterType: "CLUB" | "TRYOUT";
    onMarkers: (markers: MapMarkerDto[]) => void;
    onLoading: (isLoading: boolean) => void; // NEW
}) {
    const map = useMap();
    const debounceTimerRef = useRef<number | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    // Calculate current visible radius based on map bounds
    const getVisibleRadius = useCallback(() => {
        const bounds = map.getBounds();
        const center = map.getCenter();
        const northEast = bounds.getNorthEast();
        // Distance in KM from center to corner
        const distance = center.distanceTo(northEast) / 1000;
        // Add 20% buffer to avoid markers popping in/out at the very edge
        return Math.max(radiusKm, Math.ceil(distance * 1.2));
    }, [map, radiusKm]);

    const fetchNearby = useCallback(
        async (lat: number, lng: number, radius: number, type: string) => {
            try {
                onLoading(true); // START LOADING
                abortRef.current?.abort();
                const controller = new AbortController();
                abortRef.current = controller;

                const response = await apiClient.get<MapMarkerDto[]>("/map/nearby", {
                    params: { lat, lng, radius, type },
                    signal: controller.signal,
                });

                onMarkers(response.data);
                onLoading(false); // END LOADING
            } catch (error) {
                if (axios.isCancel(error)) return;
                if (error instanceof DOMException && error.name === "AbortError") return;

                console.error("Failed to load nearby map pins", error);
                onLoading(false); // END LOADING ON ERROR
            }
        },
        [onMarkers, onLoading]
    );

    const scheduleFetch = useCallback(
        (lat: number, lng: number) => {
            if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);

            debounceTimerRef.current = window.setTimeout(() => {
                const dynamicRadius = getVisibleRadius();
                fetchNearby(lat, lng, dynamicRadius, filterType);
            }, 300);
        },
        [fetchNearby, getVisibleRadius, filterType]
    );

    useMapEvents({
        moveend: () => {
            const c = map.getCenter();
            scheduleFetch(c.lat, c.lng);
        },
        zoomend: () => {
            const c = map.getCenter();
            scheduleFetch(c.lat, c.lng);
        }
    });

    // Re-fetch when radius OR filterType changes
    useEffect(() => {
        const c = map.getCenter();
        const dynamicRadius = getVisibleRadius();
        fetchNearby(c.lat, c.lng, dynamicRadius, filterType);
    }, [fetchNearby, getVisibleRadius, filterType]);

    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
            abortRef.current?.abort();
        };
    }, []);

    return null;
}

// Locate Me Button Component
function LocateMeControl() {
    const map = useMap();
    const [locating, setLocating] = useState(false);

    const handleLocateClick = () => {
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                map.flyTo([latitude, longitude], 13, { duration: 1.5 });
                setLocating(false);
            },
            (error) => {
                console.error("Geolocation error:", error);
                alert("Could not get your location. Please check your browser permissions.");
                setLocating(false);
            }
        );
    };

    return (
        <button
            onClick={handleLocateClick}
            disabled={locating}
            className={`absolute bottom-6 right-4 z-[1000] p-3 rounded-full shadow-lg border border-gray-100 transition-all ${
                locating ? "bg-gray-100 text-gray-400" : "bg-white text-emerald-600 hover:bg-emerald-50"
            }`}
            aria-label="Use my current location"
        >
            <Navigation className={`w-6 h-6 ${locating ? "animate-pulse" : ""}`} />
        </button>
    );
}

// Radius Visualizer Circle Component
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

    return (
        <Circle
            center={center}
            radius={radiusKm * 1000}
            pathOptions={{
                fillColor: '#10b981',
                fillOpacity: 0.1,
                color: '#10b981',
                weight: 2,
                dashArray: '5, 10',
                interactive: false
            }}
        />
    );
}

// 4. The Main Component
export function MapPage() {
    const navigate = useNavigate();
    const [markers, setMarkers] = useState<MapMarkerDto[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [loadingMarkers, setLoadingMarkers] = useState(false);

    const [radiusKm, setRadiusKm] = useState<number>(15);
    const [displayRadius, setDisplayRadius] = useState<number>(15);

    // NEW: Map Filter State
    const [filterType, setFilterType] = useState<"CLUB" | "TRYOUT">("CLUB");

    const defaultCenter: [number, number] = [41.7151, 44.8271];

    const selected = useMemo(
        () => markers.find((m) => m.entityId === selectedId) ?? null,
        [markers, selectedId]
    );

    return (
        <div className="relative h-[calc(100vh-72px)] w-full overflow-hidden">

            {/* Loading Indicator */}
            {loadingMarkers && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[2000]">
                    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur px-4 py-2 rounded-full shadow-lg border border-gray-100 dark:border-gray-700 flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Updating markers...</span>
                    </div>
                </div>
            )}

            {/* The Floating Filter UI */}
            <div className="absolute top-4 right-4 z-[1000] bg-white/95 backdrop-blur shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] border-4 border-black rounded-xl p-5 w-64 md:w-72 transition-all">

                {/* NEW: Toggle Switch */}
                <div className="flex bg-gray-100 border-2 border-black p-1 rounded-lg mb-4">
                    <button
                        onClick={() => setFilterType("CLUB")}
                        className={`flex-1 text-xs font-black uppercase italic py-1.5 rounded-md transition-all ${filterType === "CLUB" ? "bg-white text-emerald-600 shadow-sm border border-black" : "text-gray-500"}`}
                    >
                        All Clubs
                    </button>
                    <button
                        onClick={() => setFilterType("TRYOUT")}
                        className={`flex-1 text-xs font-black uppercase italic py-1.5 rounded-md transition-all ${filterType === "TRYOUT" ? "bg-white text-orange-500 shadow-sm border border-black" : "text-gray-500"}`}
                    >
                        Active Tryouts
                    </button>
                </div>

                <div className="flex justify-between items-center mb-3">
                    <span className="font-black italic uppercase text-gray-900 text-xs flex items-center gap-1.5 tracking-tighter">
                        <MapPin className="w-4 h-4 text-orange-500" />
                        Search Radius
                    </span>
                    <span className="text-white font-black bg-orange-500 border-2 border-black px-2 py-0.5 rounded-md text-xs italic">
                        {displayRadius} km
                    </span>
                </div>

                <input
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={displayRadius}
                    onChange={(e) => setDisplayRadius(Number(e.target.value))}
                    onPointerUp={() => setRadiusKm(displayRadius)}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500 border border-black"
                    aria-label="Search radius in kilometers"
                />

                <div className="flex justify-between text-xs text-gray-400 mt-2 font-medium">
                    <span>1 km</span>
                    <span>50 km</span>
                </div>
            </div>

            {/* The Map */}
            <MapContainer
                center={defaultCenter}
                zoom={12}
                className="h-full w-full z-0"
                preferCanvas={true}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />

                {/* NEW: Passed filterType to the Loader */}
                <NearbyLoader radiusKm={radiusKm} filterType={filterType} onMarkers={setMarkers} onLoading={setLoadingMarkers} />

                <RadiusCircle radiusKm={displayRadius} />

                <LocateMeControl />

                {markers
                    .filter(m => (m.distanceKm ?? 0) <= radiusKm)
                    .map((m) => (
                    <Marker
                        key={`${m.entityType}:${m.entityId}`}
                        position={[m.latitude, m.longitude]}
                        icon={clubIcon}
                        eventHandlers={{
                            click: () => setSelectedId(m.entityId),
                        }}
                    >
                        <Popup>
                            <div className="min-w-[180px]">
                                <div className="font-bold text-gray-900">{m.title}</div>
                                {m.subtitle && <div className="text-xs text-gray-600">{m.subtitle}</div>}
                                {typeof m.distanceKm === "number" && (
                                    <div className="text-xs text-emerald-600 font-semibold mt-1">
                                        {m.distanceKm.toFixed(1)} km away
                                    </div>
                                )}
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>

            {/* Bottom Sheet Drawer UI */}
            {selected && (
                <div className="absolute bottom-6 left-0 right-0 mx-auto max-w-md bg-white rounded-xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] border-4 border-black p-5 z-[1000] animate-in slide-in-from-bottom-5">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="font-black italic uppercase text-xl text-gray-900 tracking-tighter underline decoration-orange-500 decoration-4">{selected.title}</h3>
                            <p className="text-xs text-gray-600 font-black italic uppercase tracking-widest mt-1">{selected.subtitle ?? "Club"}</p>
                        </div>
                        <button
                            onClick={() => setSelectedId(null)}
                            className="text-white bg-black hover:bg-gray-800 rounded-full w-8 h-8 flex items-center justify-center font-black"
                            aria-label="Close club preview"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="flex gap-3 mt-6">
                        <button
                            className="flex-1 bg-black text-white font-black italic uppercase py-3 rounded-lg hover:bg-gray-800 transition-colors border-2 border-black tracking-tighter"
                            onClick={() => navigate(`/clubs/${selected.entityId}`)}
                        >
                            View Profile
                        </button>
                        <button
                            className="flex-1 bg-orange-500 text-white font-black italic uppercase py-3 rounded-lg hover:bg-orange-600 border-2 border-black transition-colors tracking-tighter"
                            onClick={() => alert("Apply to trial feature coming soon!")}
                        >
                            Apply Now
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}