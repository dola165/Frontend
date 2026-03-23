import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents, ZoomControl } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import { apiClient } from "../api/axiosConfig";
import { Navigation, Filter, ChevronLeft, ChevronRight, X, ShieldCheck, Swords, Calendar, Users, Trophy, ArrowLeft, ArrowRight, Search, Loader2, MapPin } from "lucide-react";
import { MapFilterSidebar, type MapEntityType, type MapFilters } from "../components/map/MapFilterSidebar";
import "leaflet/dist/leaflet.css";

type MapMarkerDto = {
    entityId: number;
    entityType: MapEntityType | string;
    title: string;
    subtitle?: string | null;
    clubName?: string | null;
    latitude: number;
    longitude: number;
    distanceKm?: number | null;
    members?: number;
    followers?: number;
    verified?: boolean;
    date?: string | null;
    fee?: string | null;
    addressText?: string | null;
    ageGroup?: string | null;
    status?: string | null;
};

const DEFAULT_CENTER: [number, number] = [41.7151, 44.8271];
const LOCATION_GROUP_DISTANCE_METERS = 35;
const EVENT_MARKER_TYPES = new Set(["TRYOUT", "MATCH", "FRIENDLY"]);
const markerIconCache = new Map<string, L.DivIcon>();

type MarkerPanelState =
    | { mode: "detail"; marker: MapMarkerDto; fromLocationGroup: boolean }
    | { mode: "location-list"; anchor: MapMarkerDto; markers: MapMarkerDto[] };

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
});

const markerKey = (marker: Pick<MapMarkerDto, "entityId" | "entityType">) => `${marker.entityType}-${marker.entityId}`;

const isSameMarker = (left: Pick<MapMarkerDto, "entityId" | "entityType">, right: Pick<MapMarkerDto, "entityId" | "entityType">) =>
    left.entityId === right.entityId && left.entityType === right.entityType;

const isEventMarker = (marker: Pick<MapMarkerDto, "entityType">) => EVENT_MARKER_TYPES.has(marker.entityType);

const formatMarkerDate = (value?: string | null) => {
    if (!value) return null;

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    return dateTimeFormatter.format(parsed);
};

const getMarkerTypeTone = (entityType: string) => {
    switch (entityType) {
        case "TRYOUT":
            return "bg-orange-500/15 text-orange-300 border-orange-500/30";
        case "MATCH":
            return "bg-blue-500/15 text-blue-300 border-blue-500/30";
        case "FRIENDLY":
            return "bg-violet-500/15 text-violet-300 border-violet-500/30";
        case "CLUB":
        default:
            return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    }
};

const getMarkerTypeLabel = (marker: Pick<MapMarkerDto, "entityType">) => {
    switch (marker.entityType) {
        case "TRYOUT":
            return "Tryout";
        case "MATCH":
            return "Match";
        case "FRIENDLY":
            return "Friendly";
        default:
            return "Club";
    }
};

const getDistanceMeters = (left: Pick<MapMarkerDto, "latitude" | "longitude">, right: Pick<MapMarkerDto, "latitude" | "longitude">) => {
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const earthRadiusMeters = 6371000;
    const latDelta = toRadians(right.latitude - left.latitude);
    const lngDelta = toRadians(right.longitude - left.longitude);
    const a =
        Math.sin(latDelta / 2) ** 2 +
        Math.cos(toRadians(left.latitude)) * Math.cos(toRadians(right.latitude)) * Math.sin(lngDelta / 2) ** 2;

    return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const isSameLocation = (anchor: MapMarkerDto, candidate: MapMarkerDto) => {
    const sameAddress =
        anchor.addressText &&
        candidate.addressText &&
        anchor.addressText.trim().toLowerCase() === candidate.addressText.trim().toLowerCase();

    const distanceMeters = getDistanceMeters(anchor, candidate);
    return distanceMeters <= LOCATION_GROUP_DISTANCE_METERS || (Boolean(sameAddress) && distanceMeters <= LOCATION_GROUP_DISTANCE_METERS * 2);
};

const compareLocationMarkers = (left: MapMarkerDto, right: MapMarkerDto) => {
    const leftDate = left.date ? new Date(left.date).getTime() : Number.MAX_SAFE_INTEGER;
    const rightDate = right.date ? new Date(right.date).getTime() : Number.MAX_SAFE_INTEGER;

    if (leftDate !== rightDate) {
        return leftDate - rightDate;
    }

    return left.title.localeCompare(right.title);
};

const getLocationGroupForMarker = (anchor: MapMarkerDto, markers: MapMarkerDto[]) => {
    if (!isEventMarker(anchor)) {
        return [anchor];
    }

    return markers
        .filter((candidate) => isEventMarker(candidate) && isSameLocation(anchor, candidate))
        .sort(compareLocationMarkers);
};

const areMarkerListsEqual = (left: MapMarkerDto[], right: MapMarkerDto[]) =>
    left.length === right.length && left.every((marker, index) => isSameMarker(marker, right[index]));

const createBallIcon = (isSelected = false, type = "CLUB") => {
    const cacheKey = `${type}:${isSelected}`;
    const cachedIcon = markerIconCache.get(cacheKey);
    if (cachedIcon) {
        return cachedIcon;
    }

    const getGlowClass = () => {
        switch (type) {
            case "TRYOUT":
                return isSelected ? "drop-shadow-[0_8px_8px_rgba(249,115,22,0.8)]" : "drop-shadow-[0_4px_4px_rgba(249,115,22,0.8)]";
            case "MATCH":
                return isSelected ? "drop-shadow-[0_8px_8px_rgba(59,130,246,0.8)]" : "drop-shadow-[0_4px_4px_rgba(59,130,246,0.8)]";
            case "FRIENDLY":
                return isSelected ? "drop-shadow-[0_8px_8px_rgba(168,85,247,0.8)]" : "drop-shadow-[0_4px_4px_rgba(168,85,247,0.8)]";
            case "CLUB":
            default:
                return isSelected ? "drop-shadow-[0_8px_8px_rgba(16,185,129,0.8)]" : "drop-shadow-[0_4px_4px_rgba(16,185,129,0.8)]";
        }
    };

    const icon = L.divIcon({
        className: "custom-ball-marker bg-transparent border-0",
        html: `
            <div class="relative flex flex-col items-center cursor-pointer transition-all duration-300 ${isSelected ? "scale-125" : "hover:-translate-y-1 hover:scale-110"}">
                <img src="/markers/ball.png"
                     class="w-10 h-10 ${isSelected ? "animate-bounce" : ""} ${getGlowClass()}"
                     alt="pin" />
                ${isSelected ? `<div class="w-5 h-1 bg-black/40 blur-[2px] rounded-[100%] absolute -bottom-1"></div>` : ""}
            </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
    });

    markerIconCache.set(cacheKey, icon);
    return icon;
};

function MapViewportSync({ onViewportChange }: { onViewportChange: (coords: [number, number]) => void }) {
    useMapEvents({
        moveend(event) {
            const center = event.target.getCenter();
            onViewportChange([Number(center.lat.toFixed(6)), Number(center.lng.toFixed(6))]);
        }
    });

    return null;
}

function MapFocusController({ target, onSettled }: { target: [number, number] | null; onSettled: () => void }) {
    const map = useMap();

    useEffect(() => {
        if (!target) return;

        map.flyTo(target, map.getZoom(), {
            animate: true,
            duration: 0.35,
        });

        onSettled();
    }, [map, onSettled, target]);

    return null;
}

function MapSizeGuard({ layoutSignature }: { layoutSignature: string }) {
    const map = useMap();

    useLayoutEffect(() => {
        const container = map.getContainer();
        let animationFrame = 0;
        let followUpFrame = 0;

        const invalidate = () => {
            cancelAnimationFrame(animationFrame);
            cancelAnimationFrame(followUpFrame);
            animationFrame = window.requestAnimationFrame(() => {
                map.invalidateSize({ pan: false, debounceMoveend: true });
                followUpFrame = window.requestAnimationFrame(() => {
                    map.invalidateSize({ pan: false, debounceMoveend: true });
                });
            });
        };

        invalidate();

        const resizeObserver = new ResizeObserver(() => invalidate());
        let current: HTMLElement | null = container;
        let depth = 0;
        while (current && depth < 4) {
            resizeObserver.observe(current);
            current = current.parentElement;
            depth += 1;
        }

        window.addEventListener("resize", invalidate);
        window.addEventListener("orientationchange", invalidate);

        return () => {
            cancelAnimationFrame(animationFrame);
            cancelAnimationFrame(followUpFrame);
            resizeObserver.disconnect();
            window.removeEventListener("resize", invalidate);
            window.removeEventListener("orientationchange", invalidate);
        };
    }, [layoutSignature, map]);

    return null;
}

function MarkerDetailsCard({
    marker,
    onClose,
    onOpenClub,
    onBackToLocationList,
}: {
    marker: MapMarkerDto;
    onClose: () => void;
    onOpenClub: () => void;
    onBackToLocationList?: () => void;
}) {
    const formattedDate = formatMarkerDate(marker.date);

    return (
        <div className="theme-surface-strong h-full border-l-2 theme-border-strong shadow-2xl flex flex-col">
            <div className="relative h-44 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900 shrink-0 overflow-hidden border-b-2 border-slate-300 dark:border-black">
                <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-[color:var(--theme-surface-strong)] via-transparent to-transparent opacity-90"></div>
                {onBackToLocationList && (
                    <button
                        onClick={onBackToLocationList}
                        className="absolute top-4 left-4 p-2 bg-white/80 dark:theme-overlay hover:bg-white dark:hover:bg-slate-700 backdrop-blur-sm text-slate-900 dark:text-white rounded-lg transition-colors border border-slate-300 dark:border-transparent z-10 shadow-sm"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                )}
                <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/80 dark:theme-overlay hover:bg-white dark:hover:bg-rose-500 backdrop-blur-sm text-slate-900 dark:text-white rounded-lg transition-colors border border-slate-300 dark:border-transparent z-10 shadow-sm">
                    <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-5 left-5 flex items-end gap-3 z-10">
                    <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl border-4 border-white dark:border-[#0f172a] shadow-lg flex items-center justify-center overflow-hidden">
                        <span className="text-2xl font-black text-white">{marker.title.substring(0, 2).toUpperCase()}</span>
                    </div>
                </div>
                <div className="absolute top-4 left-4">
                    <div className={`px-3 py-1.5 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md flex items-center gap-1.5 ${
                        marker.entityType === "CLUB" ? "bg-emerald-600" :
                            marker.entityType === "TRYOUT" ? "bg-orange-500" :
                                marker.entityType === "FRIENDLY" ? "bg-violet-600" : "bg-blue-600"
                    }`}>
                        {marker.entityType === "CLUB" ? <ShieldCheck className="w-3.5 h-3.5" /> :
                            marker.entityType === "TRYOUT" ? <Calendar className="w-3.5 h-3.5" /> : <Swords className="w-3.5 h-3.5" />}
                        {marker.entityType.replace("_", " ")}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-1">{marker.title}</h2>
                    {marker.clubName && marker.entityType !== "CLUB" && (
                        <p className="text-sm font-black text-slate-500 uppercase tracking-widest">{marker.clubName}</p>
                    )}
                    {marker.subtitle && <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">{marker.subtitle}</p>}
                    {formattedDate && <p className="text-sm font-black text-emerald-600 dark:text-emerald-500 mt-2">{formattedDate}</p>}
                </div>

                {marker.entityType === "CLUB" && (
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50">
                            <div className="flex items-center gap-1.5 mb-1"><Users className="w-3.5 h-3.5 text-emerald-500" /><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Followers</p></div>
                            <p className="text-xl font-black text-slate-900 dark:text-white">{marker.followers || 0}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50">
                            <div className="flex items-center gap-1.5 mb-1"><Trophy className="w-3.5 h-3.5 text-emerald-500" /><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</p></div>
                            <p className="text-xl font-black text-blue-500">{marker.verified ? "Official" : "Unverified"}</p>
                        </div>
                    </div>
                )}

                <div className="space-y-3">
                    {marker.addressText && (
                        <div className="flex gap-3 text-slate-700 dark:text-slate-300 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-700/30">
                            <MapPin className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Location</p>
                                <span className="text-sm font-bold">{marker.addressText}</span>
                            </div>
                        </div>
                    )}
                    {(marker.ageGroup || marker.status) && (
                        <div className="flex flex-wrap gap-2">
                            {marker.ageGroup && (
                                <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-orange-500">
                                    {marker.ageGroup}
                                </span>
                            )}
                            {marker.status && (
                                <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-500">
                                    {marker.status}
                                </span>
                            )}
                        </div>
                    )}
                    <div className="flex gap-3 text-slate-700 dark:text-slate-300 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-700/30">
                        <Navigation className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Coordinates</p>
                            <span className="text-sm font-bold">{marker.latitude.toFixed(4)}, {marker.longitude.toFixed(4)}</span>
                        </div>
                    </div>
                    {marker.distanceKm != null && (
                        <div className="flex gap-3 text-slate-700 dark:text-slate-300 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-700/30">
                            <Filter className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Distance</p>
                                <span className="text-sm font-bold">{marker.distanceKm.toFixed(1)} km from current map center</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="theme-surface-strong p-5 border-t-2 theme-border shrink-0">
                {marker.entityType === "CLUB" ? (
                    <button onClick={onOpenClub} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-xs py-4 rounded-lg shadow-[4px_4px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-2 border-2 border-slate-900">
                        Access Headquarters <ArrowRight className="w-4 h-4" />
                    </button>
                ) : (
                    <div className="w-full rounded-lg border-2 border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/70 px-4 py-3 text-left">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Event Discovery</p>
                        <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200">
                            Event markers are read-only for now. Open the related club profile for supported actions.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

function MarkerLocationListCard({
    anchor,
    markers,
    onClose,
    onSelectMarker,
}: {
    anchor: MapMarkerDto;
    markers: MapMarkerDto[];
    onClose: () => void;
    onSelectMarker: (marker: MapMarkerDto) => void;
}) {
    return (
        <div className="theme-surface-strong h-full border-l-2 theme-border-strong shadow-2xl flex flex-col">
            <div className="theme-surface-strong shrink-0 border-b-2 theme-border px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-600 dark:text-emerald-500">
                            Event Cluster
                        </p>
                        <h2 className="mt-1 text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">
                            Events At This Location
                        </h2>
                        <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                            {markers.length} result{markers.length === 1 ? "" : "s"}
                        </p>
                        {anchor.addressText && (
                            <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">{anchor.addressText}</p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg border border-slate-300 bg-white p-2 text-slate-500 shadow-sm transition-colors hover:text-rose-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {markers.map((marker) => {
                        const formattedDate = formatMarkerDate(marker.date);
                        return (
                            <button
                                key={markerKey(marker)}
                                onClick={() => onSelectMarker(marker)}
                                className="grid w-full grid-cols-[auto,1fr,auto] gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/60"
                            >
                                <div className={`mt-0.5 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${getMarkerTypeTone(marker.entityType)}`}>
                                    {getMarkerTypeLabel(marker)}
                                </div>

                                <div className="min-w-0">
                                    <p className="truncate text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">
                                        {marker.title}
                                    </p>
                                    <p className="mt-1 truncate text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                        {marker.clubName || marker.subtitle || "Club event"}
                                    </p>
                                    {(marker.ageGroup || marker.status) && (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {marker.ageGroup && (
                                                <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">
                                                    {marker.ageGroup}
                                                </span>
                                            )}
                                            {marker.status && (
                                                <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">
                                                    {marker.status}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="flex min-w-[92px] flex-col items-end justify-between gap-3">
                                    <div className="text-right">
                                        {formattedDate && (
                                            <p className="text-xs font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-500">
                                                {formattedDate}
                                            </p>
                                        )}
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-slate-400" />
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export const MapPage = () => {
    const navigate = useNavigate();
    const [isFilterOpen, setIsFilterOpen] = useState(() => window.innerWidth >= 1280);
    const [searchQuery, setSearchQuery] = useState("");
    const deferredSearchQuery = useDeferredValue(searchQuery.trim());

    const [viewportCenter, setViewportCenter] = useState<[number, number]>(DEFAULT_CENTER);
    const [focusTarget, setFocusTarget] = useState<[number, number] | null>(null);
    const [activeFilters, setActiveFilters] = useState<MapFilters>({
        entityType: "CLUB",
        distance: 15,
        ageGroups: [],
    });
    const [markers, setMarkers] = useState<MapMarkerDto[]>([]);
    const [panelState, setPanelState] = useState<MarkerPanelState | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    const selectedMarker = useMemo(() => {
        if (!panelState) return null;
        return panelState.mode === "detail" ? panelState.marker : panelState.anchor;
    }, [panelState]);

    const requestUrl = useMemo(() => {
        const params = new URLSearchParams();
        params.set("lat", String(viewportCenter[0]));
        params.set("lng", String(viewportCenter[1]));
        params.set("radius", String(activeFilters.distance));
        params.set("type", activeFilters.entityType);

        activeFilters.ageGroups.forEach((age) => params.append("ageGroups", age));

        if (deferredSearchQuery) {
            params.set("query", deferredSearchQuery);
        }

        return `/map/nearby?${params.toString()}`;
    }, [activeFilters.ageGroups, activeFilters.distance, activeFilters.entityType, deferredSearchQuery, viewportCenter]);

    const layoutSignature = `${isFilterOpen}-${Boolean(panelState)}`;

    const handleViewportChange = useCallback((nextCenter: [number, number]) => {
        setViewportCenter((current) => {
            const isSameCenter = Math.abs(current[0] - nextCenter[0]) < 0.0001 && Math.abs(current[1] - nextCenter[1]) < 0.0001;
            return isSameCenter ? current : nextCenter;
        });
    }, []);

    const handleMarkerClick = useCallback((marker: MapMarkerDto) => {
        const locationGroup = getLocationGroupForMarker(marker, markers);

        if (isEventMarker(marker) && locationGroup.length > 1) {
            setPanelState({
                mode: "location-list",
                anchor: marker,
                markers: locationGroup,
            });
        } else {
            setPanelState({
                mode: "detail",
                marker,
                fromLocationGroup: false,
            });
        }

        setFocusTarget([marker.latitude, marker.longitude]);
    }, [markers]);

    const handleLocationMarkerOpen = useCallback((marker: MapMarkerDto) => {
        setPanelState({
            mode: "detail",
            marker,
            fromLocationGroup: true,
        });
    }, []);

    const clearFocusTarget = useCallback(() => {
        setFocusTarget(null);
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            setIsLoading(true);
            setLoadError(null);

            try {
                const response = await apiClient.get<MapMarkerDto[]>(requestUrl, {
                    signal: controller.signal,
                });
                setMarkers(response.data);
            } catch (error: any) {
                if (error?.code === "ERR_CANCELED" || error?.name === "CanceledError") {
                    return;
                }
                console.error("Failed to load map pins", error);
                setLoadError("Unable to load map results right now.");
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        }, 180);

        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [requestUrl]);

    useEffect(() => {
        if (!panelState) return;

        if (panelState.mode === "detail") {
            const refreshedMarker = markers.find((marker) => isSameMarker(marker, panelState.marker));

            if (!refreshedMarker) {
                setPanelState(null);
                return;
            }

            if (refreshedMarker !== panelState.marker) {
                setPanelState({
                    mode: "detail",
                    marker: refreshedMarker,
                    fromLocationGroup: panelState.fromLocationGroup,
                });
            }
            return;
        }

        const survivingGroupMarkers = panelState.markers
            .map((groupMarker) => markers.find((marker) => isSameMarker(marker, groupMarker)))
            .filter((marker): marker is MapMarkerDto => Boolean(marker));

        const refreshedAnchor = markers.find((marker) => isSameMarker(marker, panelState.anchor)) ?? survivingGroupMarkers[0];

        if (!refreshedAnchor) {
            setPanelState(null);
            return;
        }

        const refreshedGroup = getLocationGroupForMarker(refreshedAnchor, markers);

        if (refreshedGroup.length <= 1) {
            setPanelState({
                mode: "detail",
                marker: refreshedAnchor,
                fromLocationGroup: false,
            });
            return;
        }

        if (
            refreshedAnchor !== panelState.anchor ||
            !areMarkerListsEqual(refreshedGroup, panelState.markers)
        ) {
            setPanelState({
                mode: "location-list",
                anchor: refreshedAnchor,
                markers: refreshedGroup,
            });
        }
    }, [markers, panelState]);

    const openSelectedClub = useCallback(() => {
        if (selectedMarker?.entityType === "CLUB") {
            navigate(`/clubs/${selectedMarker.entityId}`);
        }
    }, [navigate, selectedMarker]);

    const handleBackToLocationList = useCallback(() => {
        if (!panelState || panelState.mode !== "detail" || !isEventMarker(panelState.marker)) {
            return;
        }

        const locationGroup = getLocationGroupForMarker(panelState.marker, markers);
        if (locationGroup.length <= 1) {
            return;
        }

        setPanelState({
            mode: "location-list",
            anchor: panelState.marker,
            markers: locationGroup,
        });
    }, [markers, panelState]);

    const showBackToLocationList =
        panelState?.mode === "detail" &&
        panelState.fromLocationGroup &&
        isEventMarker(panelState.marker) &&
        getLocationGroupForMarker(panelState.marker, markers).length > 1;

    return (
        <div className="theme-surface-muted h-full min-h-0 w-full overflow-hidden">
            <div className="flex h-full min-h-0 w-full">
                <MapFilterSidebar
                    isVisible={isFilterOpen}
                    onClose={() => setIsFilterOpen(false)}
                    onFiltersChange={setActiveFilters}
                />

                <div className="flex-1 min-w-0 min-h-0 flex">
                    <section className="relative flex-1 min-w-0 min-h-0">
                        <div className="absolute top-4 left-4 right-4 z-[900] pointer-events-none flex flex-col gap-3">
                            <div className="flex gap-3 pointer-events-auto max-w-3xl">
                                <button
                                    onClick={() => setIsFilterOpen((current) => !current)}
                                    className={`shrink-0 p-3.5 rounded-xl border-2 border-slate-900 shadow-[4px_4px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none transition-all ${
                                        isFilterOpen ? "bg-emerald-600 text-white" : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-emerald-500"
                                    }`}
                                >
                                    {isFilterOpen ? <ChevronLeft className="w-5 h-5" /> : <Filter className="w-5 h-5" />}
                                </button>

                                <div className="flex-1 bg-white dark:bg-slate-800 border-2 border-slate-900 rounded-xl shadow-[4px_4px_0px_0px_#020617] flex items-center px-4 py-1 group">
                                    <Search className="w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search clubs, tryouts, or saved locations..."
                                        className="flex-1 bg-transparent border-none outline-none text-slate-900 dark:text-white placeholder:text-slate-400 font-bold text-sm ml-3 w-full"
                                    />
                                    {searchQuery && (
                                        <button onClick={() => setSearchQuery("")} className="p-1 text-slate-400 hover:text-rose-500">
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <MapContainer
                            center={DEFAULT_CENTER}
                            zoom={13}
                            zoomControl={false}
                            preferCanvas={true}
                            className="h-full w-full z-0"
                        >
                            <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                            <ZoomControl position="bottomright" />
                            <MapViewportSync onViewportChange={handleViewportChange} />
                            <MapFocusController target={focusTarget} onSettled={clearFocusTarget} />
                            <MapSizeGuard layoutSignature={layoutSignature} />

                            <Circle
                                center={viewportCenter}
                                radius={activeFilters.distance * 1000}
                                pathOptions={{ color: "#10b981", fillColor: "#10b981", fillOpacity: 0.08, weight: 2, dashArray: "10, 10" }}
                            />

                            {markers.map((marker) => (
                                <Marker
                                    key={`${marker.entityType}-${marker.entityId}`}
                                    position={[marker.latitude, marker.longitude]}
                                    icon={createBallIcon(
                                        selectedMarker?.entityId === marker.entityId && selectedMarker?.entityType === marker.entityType,
                                        marker.entityType
                                    )}
                                    eventHandlers={{ click: () => handleMarkerClick(marker) }}
                                />
                            ))}
                        </MapContainer>

                        <button
                            onClick={() => {
                                setPanelState(null);
                                setFocusTarget(DEFAULT_CENTER);
                            }}
                            className="absolute bottom-6 left-6 z-[900] p-3.5 bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-500 rounded-xl border-2 border-slate-300 dark:border-slate-700 shadow-[4px_4px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none transition-all group"
                        >
                            <Navigation className="w-5 h-5 group-hover:rotate-45 transition-transform duration-300" />
                        </button>

                        <div className="absolute bottom-6 right-6 z-[900] flex flex-col items-end gap-2">
                                <div className="theme-surface-strong rounded-xl border border-slate-300/80 dark:border-slate-700 backdrop-blur-sm px-4 py-2 shadow-lg">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Viewport Center</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">
                                    {viewportCenter[0].toFixed(3)}, {viewportCenter[1].toFixed(3)}
                                </p>
                            </div>
                            <div className="theme-surface-strong rounded-xl border border-slate-300/80 dark:border-slate-700 backdrop-blur-sm px-4 py-2 shadow-lg">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Results</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">
                                    {isLoading ? "Updating..." : `${markers.length} marker${markers.length === 1 ? "" : "s"}`}
                                </p>
                            </div>
                        </div>

                        {isLoading && (
                            <div className="absolute inset-x-4 top-24 z-[900] flex justify-center pointer-events-none">
                                <div className="theme-surface-strong rounded-xl border border-slate-300 dark:border-slate-700 backdrop-blur-sm px-4 py-2 shadow-lg flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                                    <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                                    Refreshing map results
                                </div>
                            </div>
                        )}

                        {loadError && (
                            <div className="absolute inset-x-4 top-24 z-[900] flex justify-center">
                                <div className="rounded-xl border border-rose-300/70 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 backdrop-blur-sm px-4 py-3 shadow-lg text-sm font-bold text-rose-600 dark:text-rose-400">
                                    {loadError}
                                </div>
                            </div>
                        )}

                        {!isLoading && !loadError && markers.length === 0 && (
                            <div className="absolute inset-x-4 top-24 z-[900] flex justify-center pointer-events-none">
                                <div className="theme-surface-strong rounded-xl border border-slate-300 dark:border-slate-700 backdrop-blur-sm px-4 py-3 shadow-lg max-w-md text-center">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">No Results</p>
                                    <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200">
                                        No map markers match the current radius, search, and filter combination.
                                    </p>
                                </div>
                            </div>
                        )}

                        {panelState && (
                            <div className="xl:hidden absolute inset-x-4 bottom-4 top-auto max-h-[60%] z-[1000] overflow-hidden rounded-2xl shadow-2xl">
                                {panelState.mode === "location-list" ? (
                                    <MarkerLocationListCard
                                        anchor={panelState.anchor}
                                        markers={panelState.markers}
                                        onClose={() => setPanelState(null)}
                                        onSelectMarker={handleLocationMarkerOpen}
                                    />
                                ) : (
                                    <MarkerDetailsCard
                                        marker={panelState.marker}
                                        onClose={() => setPanelState(null)}
                                        onOpenClub={openSelectedClub}
                                        onBackToLocationList={showBackToLocationList ? handleBackToLocationList : undefined}
                                    />
                                )}
                            </div>
                        )}
                    </section>

                    {panelState && (
                        <aside className="hidden xl:block w-[380px] shrink-0 h-full">
                            {panelState.mode === "location-list" ? (
                                <MarkerLocationListCard
                                    anchor={panelState.anchor}
                                    markers={panelState.markers}
                                    onClose={() => setPanelState(null)}
                                    onSelectMarker={handleLocationMarkerOpen}
                                />
                            ) : (
                                <MarkerDetailsCard
                                    marker={panelState.marker}
                                    onClose={() => setPanelState(null)}
                                    onOpenClub={openSelectedClub}
                                    onBackToLocationList={showBackToLocationList ? handleBackToLocationList : undefined}
                                />
                            )}
                        </aside>
                    )}
                </div>
            </div>
        </div>
    );
};
