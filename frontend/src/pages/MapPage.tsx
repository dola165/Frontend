import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMapEvents, useMap } from "react-leaflet";
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
  <circle cx="24" cy="24" r="20" fill="white" stroke="black" stroke-width="2"/>
  <polygon points="24,14 18,19 20,26 28,26 30,19" fill="black"/>
  <path d="M18 19 L12 16 L10 24 L16 28" fill="none" stroke="black" stroke-width="2"/>
  <path d="M30 19 L36 16 L38 24 L32 28" fill="none" stroke="black" stroke-width="2"/>
  <path d="M20 26 L16 28 L18 36 L24 34" fill="none" stroke="black" stroke-width="2"/>
  <path d="M28 26 L32 28 L30 36 L24 34" fill="none" stroke="black" stroke-width="2"/>
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
                          filterType, // NEW: Added filterType prop
                          onMarkers,
                      }: {
    radiusKm: number;
    filterType: "CLUB" | "TRYOUT"; // NEW: Type definition
    onMarkers: (markers: MapMarkerDto[]) => void;
}) {
    const map = useMap();
    const debounceTimerRef = useRef<number | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const fetchNearby = useCallback(
        async (lat: number, lng: number, radius: number, type: string) => {
            try {
                abortRef.current?.abort();
                const controller = new AbortController();
                abortRef.current = controller;

                const response = await apiClient.get<MapMarkerDto[]>("/map/nearby", {
                    params: { lat, lng, radius, type }, // NEW: Passing the dynamic type
                    signal: controller.signal,
                });

                onMarkers(response.data);
            } catch (error) {
                if (axios.isCancel(error)) return;
                if (error instanceof DOMException && error.name === "AbortError") return;

                console.error("Failed to load nearby map pins", error);
            }
        },
        [onMarkers]
    );

    const scheduleFetch = useCallback(
        (lat: number, lng: number) => {
            if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);

            debounceTimerRef.current = window.setTimeout(() => {
                fetchNearby(lat, lng, radiusKm, filterType); // Passed filterType
            }, 300);
        },
        [fetchNearby, radiusKm, filterType] // Added filterType to dependencies
    );

    useMapEvents({
        moveend: () => {
            const c = map.getCenter();
            scheduleFetch(c.lat, c.lng);
        },
    });

    // Re-fetch when radius OR filterType changes
    useEffect(() => {
        const c = map.getCenter();
        fetchNearby(c.lat, c.lng, radiusKm, filterType);
    }, [fetchNearby, map, radiusKm, filterType]); // Added filterType to dependencies

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
                locating ? "bg-gray-100 text-gray-400" : "bg-white text-blue-600 hover:bg-blue-50"
            }`}
            aria-label="Use my current location"
        >
            <Navigation className={`w-6 h-6 ${locating ? "animate-pulse" : ""}`} />
        </button>
    );
}

// 4. The Main Component
export function MapPage() {
    const navigate = useNavigate();
    const [markers, setMarkers] = useState<MapMarkerDto[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);

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

            {/* The Floating Filter UI */}
            <div className="absolute top-4 right-4 z-[1000] bg-white/95 backdrop-blur shadow-lg border border-gray-100 rounded-xl p-4 w-64 md:w-72 transition-all">

                {/* NEW: Toggle Switch */}
                <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
                    <button
                        onClick={() => setFilterType("CLUB")}
                        className={`flex-1 text-sm font-semibold py-1.5 rounded-md transition-all ${filterType === "CLUB" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"}`}
                    >
                        All Clubs
                    </button>
                    <button
                        onClick={() => setFilterType("TRYOUT")}
                        className={`flex-1 text-sm font-semibold py-1.5 rounded-md transition-all ${filterType === "TRYOUT" ? "bg-white text-red-600 shadow-sm" : "text-gray-500"}`}
                    >
                        Active Tryouts
                    </button>
                </div>

                <div className="flex justify-between items-center mb-3">
                    <span className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-blue-600" />
                        Search Radius
                    </span>
                    <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md text-sm">
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
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
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
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />

                {/* NEW: Passed filterType to the Loader */}
                <NearbyLoader radiusKm={radiusKm} filterType={filterType} onMarkers={setMarkers} />

                <LocateMeControl />

                {markers.map((m) => (
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
                                    <div className="text-xs text-blue-600 font-semibold mt-1">
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
                <div className="absolute bottom-6 left-0 right-0 mx-auto max-w-md bg-white rounded-xl shadow-2xl border border-gray-100 p-5 z-[1000] animate-in slide-in-from-bottom-5">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="font-extrabold text-xl text-gray-900">{selected.title}</h3>
                            <p className="text-sm text-gray-500 font-medium">{selected.subtitle ?? "Club"}</p>
                        </div>
                        <button
                            onClick={() => setSelectedId(null)}
                            className="text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center font-bold"
                            aria-label="Close club preview"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="flex gap-3 mt-5">
                        <button
                            className="flex-1 bg-gray-900 text-white font-semibold py-2.5 rounded-lg hover:bg-gray-800 transition-colors"
                            onClick={() => navigate(`/clubs/${selected.entityId}`)}
                        >
                            View Profile
                        </button>
                        <button
                            className="flex-1 bg-blue-50 text-blue-700 font-semibold py-2.5 rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors"
                            onClick={() => alert("Apply to trial feature coming soon!")}
                        >
                            Apply
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}