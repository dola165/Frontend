import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import MapGL, { Layer, Source, GeolocateControl, NavigationControl, useMap, type MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapGeoJSONFeature, MapMouseEvent, StyleSpecification } from 'maplibre-gl';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
    ArrowLeft,
    Building2,
    Check,
    ChevronLeft,
    Clock,
    ExternalLink,
    Loader2,
    LocateFixed,
    MapPin,
    Menu,
    Navigation,
    RefreshCw,
    Search,
    ShieldCheck,
    Users,
    X
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiClient, API_ORIGIN } from '../api/axiosConfig';
import { fetchNearbyMap, geocodePlace, type MapMarkerDto } from '../api/map';
import { applyToTryout } from '../api/tryouts';
import { MapHelpHint } from '../components/map/MapHelpHint';
import { MapModeControl } from '../components/map/MapModeControl';
import { MapLegend } from '../components/map/MapLegend';
import { MapFilterSidebar, defaultMapFilters, type MapEntityType, type MapFilters } from '../components/map/MapFilterSidebar';
import { SimpleMapFilters } from '../components/map/SimpleMapFilters';
import { VisibleClubsRail, type VisibleClubListItem } from '../components/map/VisibleClubsRail';
import { hasFullMapAccess } from '../components/map/mapAccess';
import {
    LAYER_CLUSTER_COUNT,
    LAYER_CLUSTERS,
    LAYER_POINT_HALO,
    LAYER_POINTS,
    MAP_CLUSTER_IMAGE,
    MAP_SELECTED_PIN_IMAGE,
    MAP_PIN_ASSETS,
    MAP_POINTS_SOURCE_ID,
    MAP_STYLE_DEFAULT,
    buildPointsFeatureCollection,
    withDarkPaints,
    withVividPaints
} from '../components/map/mapLayers';
import { useAuth } from '../context/AuthContext';
import { fetchMyClubMembershipContext } from '../features/clubs/api';
import { isLeadershipRole } from '../features/clubs/domain';
import { createScheduleChallenge, type ScheduleEventOccurrence } from '../features/schedule/api';
import { extractApiErrorMessage } from '../utils/apiError';
import { usePersistedState } from '../utils/usePersistedState';
import { findIsoCountry } from '../data/isoCountries';

// Map v2 (WEB_APP_MASTER_PLAN.md §3): three user-selectable modes. Wave 1 of
// the redesign renders the point data as GPU cluster layers over the
// dark-matter basemap; TILTED still mirrors Android's MapTiler streets + tilt.
const STYLE_TILTED = (key: string) => `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}`;
const MAPTILER_API_KEY = import.meta.env.VITE_MAPTILER_API_KEY as string | undefined;

// Vivid positron: fetch the stock style ONCE, recolor it with withVividPaints,
// and memoize the style OBJECT at module level so remounts and mode switches
// never refetch. On any fetch/transform failure the caller falls back to the
// plain positron URL string — the map must never go blank.
let vividStylePromise: Promise<StyleSpecification> | null = null;
const getVividStyle = (): Promise<StyleSpecification> => {
    if (!vividStylePromise) {
        vividStylePromise = fetch(MAP_STYLE_DEFAULT)
            .then((response) => {
                if (!response.ok) throw new Error(`positron fetch failed: ${response.status}`);
                return response.json() as Promise<Record<string, unknown>>;
            })
            .then((style) => withVividPaints(style) as StyleSpecification)
            .catch((styleError: unknown) => {
                vividStylePromise = null; // allow a fresh attempt on the next mount
                throw styleError;
            });
    }
    return vividStylePromise;
};

export type MapMode = 'flat' | 'globe' | 'tilted';

type DerivedGender = 'Boys' | 'Girls' | 'Men' | 'Women' | 'Mixed';
type DerivedLevel = 'Youth' | 'Academy' | 'Amateur' | 'Grassroots';
type DerivedTravelPreference = 'HOME_ONLY' | 'WILL_TRAVEL' | 'NEUTRAL' | 'FLEXIBLE';
type DerivedLocationState = 'PINNED' | 'OPEN_VENUE';
type DerivedMatchState = 'OPEN' | 'PENDING' | 'CONFIRMED';

interface ClubDirectoryRecord {
    id: number;
    name: string;
    description: string;
    type: string;
    isOfficial: boolean;
    statusLabel?: string | null;
    followerCount: number;
    memberCount: number;
    addressText?: string | null;
    cityName?: string | null;
    countryName?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    logoUrl?: string | null;
    joinPolicy?: string | null;
}

interface ClubProfileSummary extends ClubDirectoryRecord {
    bannerUrl?: string | null;
    whatsappNumber?: string | null;
    facebookMessengerUrl?: string | null;
    preferredCommunicationMethod?: string | null;
    trustedByClubs?: Array<{ clubId: number; clubName: string }>;
    honours?: Array<{ id: number; title: string; yearWon: number; description?: string | null }>;
    opportunities?: Array<{ id: number; type: string; title: string; externalLink?: string | null }>;
}

interface DiscoveryRecord {
    key: string;
    entityType: MapEntityType;
    source: 'CLUB' | 'SCHEDULE';
    title: string;
    subtitle: string | null;
    description: string | null;
    clubId: number | null;
    clubName: string | null;
    startsAt: string | null;
    endsAt: string | null;
    locationName: string | null;
    latitude: number | null;
    longitude: number | null;
    official: boolean;
    followerCount: number;
    memberCount: number;
    distanceKm: number | null;
    typeLabel: string | null;
    statusLabel: string | null;
    matchSubtype: 'FRIENDLY' | 'COMPETITIVE' | null;
    challengeState: DerivedMatchState | null;
    locationState: DerivedLocationState;
    ageGroups: string[];
    genders: DerivedGender[];
    level: DerivedLevel | null;
    travelPreference: DerivedTravelPreference | null;
    city: string | null;
    country: string | null;
    searchText: string;
    joinPolicy: string | null;
    rawEvent?: ScheduleEventOccurrence;
    rawMapMarker?: MapMarkerDto;
}

interface SearchSuggestion {
    id: string;
    label: string;
    meta: string;
    center: [number, number] | null;
    recordKey?: string;
}

const DEFAULT_CENTER: [number, number] = [41.7151, 44.8271]; // Tbilisi — primary launch/demo market
const ALL_MAP_TYPES: MapEntityType[] = ['CLUB', 'MATCH', 'TOURNAMENT'];
const CLUB_QUERY_LIMIT = 8;

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
});

const normalizeText = (value?: string | null) => (value ?? '').trim().toLowerCase();

const formatDateTime = (value?: string | null) => {
    if (!value) {
        return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }
    return dateTimeFormatter.format(parsed);
};

const toIsoWindow = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

const getTimeWindow = (value?: string | null) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    const hour = parsed.getHours();
    if (hour < 12) return 'Morning';
    if (hour < 18) return 'Afternoon';
    return 'Evening';
};

const buildMapMarkerRecord = (marker: MapMarkerDto): DiscoveryRecord => {
    const entityType = marker.entityType as DiscoveryRecord['entityType'];
    const matchSubtype = marker.eventSubtype === 'FRIENDLY' ? 'FRIENDLY' as const :
        marker.eventSubtype === 'COMPETITIVE' ? 'COMPETITIVE' as const : null;
    const challengeState = marker.status === 'OPEN' ? 'OPEN' as const :
        marker.status === 'PENDING' ? 'PENDING' as const : null;
    const city = marker.cityName || null;
    const country = marker.countryName || null;

    return {
        key: `${marker.entityType.toLowerCase()}:${marker.entityId}`,
        entityType,
        source: marker.entityType === 'CLUB' ? 'CLUB' : 'SCHEDULE',
        title: marker.title,
        subtitle: marker.subtitle || null,
        description: marker.addressText || null,
        clubId: marker.clubId ?? null,
        clubName: marker.clubName || null,
        startsAt: marker.date || null,
        endsAt: null,
        locationName: marker.addressText || null,
        latitude: marker.latitude,
        longitude: marker.longitude,
        official: marker.verified,
        followerCount: marker.followers ?? 0,
        memberCount: marker.members ?? 0,
        distanceKm: marker.distanceKm ?? null,
        typeLabel: marker.entityType === 'CLUB' ? marker.subtitle : marker.entityType,
        statusLabel: marker.status || null,
        matchSubtype,
        challengeState,
        locationState: marker.latitude != null && marker.longitude != null ? 'PINNED' : 'OPEN_VENUE',
        ageGroups: marker.ageGroup ? [marker.ageGroup] : [],
        genders: [],
        level: null,
        travelPreference: null,
        city: city || null,
        country: country || null,
        searchText: [marker.title, marker.subtitle, marker.clubName, marker.addressText, marker.ageGroup].filter(Boolean).join(' ').toLowerCase(),
        joinPolicy: marker.joinPolicy ?? null,
        rawMapMarker: marker
    };
};

const getRecordTypeLabel = (record: DiscoveryRecord) => {
    switch (record.entityType) {
        case 'CLUB': return 'Club';
        case 'TRYOUT': return 'Tryout';
        case 'MATCH': return record.matchSubtype === 'FRIENDLY' ? 'Friendly' : 'Match';
        case 'TOURNAMENT': return 'Tournament';
        case 'CLUB_NEED': return 'Club Need';
        default: return 'Match';
    }
};

const getTravelPreferenceLabel = (value: DerivedTravelPreference | null) => {
    if (!value) return null;
    return value
        .split('_')
        .map((part) => `${part.slice(0, 1)}${part.slice(1).toLowerCase()}`)
        .join(' ');
};

const getJoinPolicyLabel = (value?: string | null) => {
    switch (value) {
        case 'OPEN_TRIAL': return 'Open trials';
        case 'APPLICATION_REQUIRED': return 'Applications open';
        case 'INVITE_ONLY': return 'Invite only';
        default: return null;
    }
};

// Great-circle distance in km — drives the fetch-on-move drift check.
const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
};

function MapFocusController({ target, onSettled }: { target: { center: [number, number]; zoom?: number } | null; onSettled: () => void }) {
    const { current: map } = useMap();

    useEffect(() => {
        if (!target || !map) return;
        map.flyTo({ center: [target.center[1], target.center[0]], zoom: target.zoom, duration: 350 });
        onSettled();
    }, [map, onSettled, target]);

    return null;
}

function MapSizeGuard({ layoutSignature }: { layoutSignature: string }) {
    const { current: map } = useMap();

    useLayoutEffect(() => {
        if (!map) return;
        let frame = 0;
        const invalidate = () => {
            cancelAnimationFrame(frame);
            frame = window.requestAnimationFrame(() => map.resize());
        };

        invalidate();
        const container = map.getContainer();
        const resizeObserver = new ResizeObserver(() => invalidate());
        let current: HTMLElement | null = container;
        let depth = 0;
        while (current && depth < 4) {
            resizeObserver.observe(current);
            current = current.parentElement;
            depth += 1;
        }

        window.addEventListener('resize', invalidate);
        return () => {
            cancelAnimationFrame(frame);
            resizeObserver.disconnect();
            window.removeEventListener('resize', invalidate);
        };
    }, [layoutSignature, map]);

    return null;
}

function MapPinAssetController({ onReady }: { onReady: (ready: boolean) => void }) {
    const { current: map } = useMap();

    useEffect(() => {
        if (!map) return;
        let active = true;
        let installing = false;

        const installAssets = async () => {
            if (installing || !map.isStyleLoaded()) return;
            installing = true;
            try {
                const missingAssets = MAP_PIN_ASSETS.filter((asset) => !map.hasImage(asset.id));
                if (missingAssets.length > 0) onReady(false);
                for (const asset of missingAssets) {
                    if (map.hasImage(asset.id)) continue;
                    const response = await map.loadImage(asset.url);
                    if (active && !map.hasImage(asset.id)) {
                        map.addImage(asset.id, response.data);
                    }
                }
                if (active && MAP_PIN_ASSETS.every((asset) => map.hasImage(asset.id))) {
                    onReady(true);
                }
            } catch (assetError) {
                console.warn('Football map pin assets could not be loaded', assetError);
            } finally {
                installing = false;
            }
        };

        const onStyleData = () => void installAssets();
        void installAssets();
        map.on('styledata', onStyleData);
        map.on('load', onStyleData);
        map.on('idle', onStyleData);
        return () => {
            active = false;
            map.off('styledata', onStyleData);
            map.off('load', onStyleData);
            map.off('idle', onStyleData);
        };
    }, [map, onReady]);

    return null;
}

// GPU-layer click handling (Wave 1): binds the map 'click' event once and reads
// the handlers through refs so they stay fresh without rebinding on re-render.
function MapClickController({
    onPointClick,
    onClusterClick
}: {
    onPointClick: (recordKey: string) => void;
    onClusterClick: (feature: MapGeoJSONFeature) => void;
}) {
    const { current: map } = useMap();
    const onPointClickRef = useRef(onPointClick);
    const onClusterClickRef = useRef(onClusterClick);

    useEffect(() => {
        onPointClickRef.current = onPointClick;
        onClusterClickRef.current = onClusterClick;
    }, [onClusterClick, onPointClick]);

    useEffect(() => {
        if (!map) return;
        const onClick = (event: MapMouseEvent) => {
            // Layers can be briefly missing mid-style-switch — never query then.
            if (!map.getLayer(LAYER_POINTS) || !map.getLayer(LAYER_CLUSTERS)) return;
            const features = map.queryRenderedFeatures(event.point, { layers: [LAYER_POINTS, LAYER_CLUSTERS] });
            if (features.length === 0) return;
            const feature = features[0];
            if (feature.properties?.cluster) {
                onClusterClickRef.current(feature);
            } else {
                const recordKey = feature.properties?.key;
                if (typeof recordKey === 'string') {
                    onPointClickRef.current(recordKey);
                }
            }
        };
        map.on('click', onClick);
        return () => {
            map.off('click', onClick);
        };
    }, [map]);

    return null;
}

const MatchResponseModal = ({
    record,
    clubName,
    note,
    error,
    submitting,
    onChangeNote,
    onClose,
    onSubmit
}: {
    record: DiscoveryRecord;
    clubName: string | null;
    note: string;
    error: string | null;
    submitting: boolean;
    onChangeNote: (value: string) => void;
    onClose: () => void;
    onSubmit: () => void;
}) => (
    <div className="theme-overlay-strong dark:bg-black/60 fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="map-modal-shell w-full max-w-2xl overflow-hidden">
            <div className="map-panel-header">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div>
                            <p className="map-eyebrow">Match response</p>
                            <h2 className="mt-2 text-xl font-bold text-slate-800 dark:text-slate-100">Respond to match need</h2>
                        </div>
                        <MapHelpHint
                            text="You are replying to the existing published request. This does not rewrite the original post."
                            align="right"
                            className="mt-5"
                        />
                    </div>
                    <button type="button" onClick={onClose} className="map-icon-button">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <div className="space-y-5 px-5 py-5">
                <section className="map-section-card">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="map-pill map-pill--accent">Published need</span>
                        {record.matchSubtype && <span className="map-pill">{record.matchSubtype === 'FRIENDLY' ? 'Friendly' : 'Competitive'}</span>}
                        {record.challengeState && <span className="map-pill">{record.challengeState === 'OPEN' ? 'Open challenge' : record.challengeState}</span>}
                    </div>
                    <p className="mt-3 text-lg font-bold text-slate-800 dark:text-slate-100">{record.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {record.clubName} · {record.locationName ?? 'Venue still open'} · {formatDateTime(record.startsAt) ?? 'Schedule timing pending'}
                    </p>
                </section>

                <section className="space-y-2">
                    <label className="map-field-label">Responding club</label>
                    <div className="map-static-field">
                        {clubName ?? 'My club'}
                    </div>
                </section>

                <section className="space-y-2">
                    <div className="flex items-center gap-2">
                        <label className="map-field-label">Note</label>
                        <MapHelpHint
                            text="Use this only for details not already covered in the published request."
                            align="left"
                        />
                    </div>
                    <textarea
                        rows={5}
                        value={note}
                        onChange={(event) => onChangeNote(event.target.value)}
                        maxLength={500}
                        className="map-textarea"
                        placeholder="Optional note"
                    />
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span />
                        <span>{note.length}/500</span>
                    </div>
                </section>

                {error && (
                    <div className="border px-3 py-3 text-sm" style={{ borderColor: 'var(--state-danger)', backgroundColor: 'var(--state-danger-soft)', color: 'var(--state-danger)' }}>
                        {error}
                    </div>
                )}
            </div>

            <div className="map-panel-footer">
                <button type="button" onClick={onClose} className="map-secondary-button">
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={onSubmit}
                    disabled={submitting}
                    className="map-primary-button disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Respond to need
                </button>
            </div>
        </div>
    </div>
);

const resolveMediaUrl = (path?: string | null) => {
    if (!path) return undefined;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return `${API_ORIGIN}${path}`;
};

const buildGoogleMapsDirectionsUrl = (lat?: number | null, lng?: number | null) => {
    if (lat == null || lng == null) return undefined;
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
};

const buildWhatsAppUrl = (number?: string | null) => {
    if (!number) return undefined;
    const cleaned = number.replace(/[^+\d]/g, '');
    return `https://wa.me/${cleaned}`;
};

// ── Collapsible info section ─────────────────────────────────────────

const InfoSection = ({
    title,
    expanded,
    onToggle,
    children,
}: {
    title: string;
    expanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) => (
    <div className="border-t border-[var(--map-panel-border)]">
        <button
            type="button"
            onClick={onToggle}
            className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-100/70 dark:hover:bg-[#16181d]/50 transition-colors"
        >
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</span>
            <ChevronLeft className={`h-4 w-4 text-muted transition-transform duration-200 ${expanded ? '-rotate-90' : 'rotate-90'}`} />
        </button>
        {expanded && <div className="px-5 pb-4 space-y-3 border-t border-[var(--map-panel-border)] pt-3 mx-5">{children}</div>}
    </div>
);

// ── Main detail panel ────────────────────────────────────────────────

const DiscoveryDetailPanel = ({
    record,
    clubProfile,
    canRespond,
    onRespond,
    onOpenClub,
    onClose
}: {
    record: DiscoveryRecord;
    clubProfile: ClubProfileSummary | null;
    canRespond: boolean;
    onRespond: () => void;
    onOpenClub: () => void;
    onClose: () => void;
}) => {
    const [detailsOpen, setDetailsOpen] = useState(false);
    const { t } = useTranslation();
    const [applyState, setApplyState] = useState<'idle' | 'applying' | 'applied'>('idle');
    const [applyError, setApplyError] = useState<string | null>(null);

    // W2 — tryout self-service apply. The backend enforces the club's join
    // policy: INVITE_ONLY clubs answer 409 (ConflictException) and we surface
    // the server message verbatim ("This club only accepts invited players.").
    const handleApply = async () => {
        const tryoutId = record.rawMapMarker?.entityId;
        if (!tryoutId || applyState === 'applying' || applyState === 'applied') {
            return;
        }
        setApplyState('applying');
        setApplyError(null);
        try {
            await applyToTryout(tryoutId);
            setApplyState('applied');
        } catch (requestError) {
            console.error('Failed to apply to tryout', requestError);
            setApplyState('idle');
            setApplyError(extractApiErrorMessage(requestError, t('map.tryouts.applyFailed')));
        }
    };

    const directionsUrl = buildGoogleMapsDirectionsUrl(record.latitude, record.longitude);
    const bannerUrl = resolveMediaUrl(clubProfile?.bannerUrl);
    const logoUrl = resolveMediaUrl(clubProfile?.logoUrl);

    const contactUrl = buildWhatsAppUrl(clubProfile?.whatsappNumber)
        || clubProfile?.facebookMessengerUrl
        || clubProfile?.opportunities?.find(o => o.externalLink)?.externalLink
        || undefined;

    const contactLabel = clubProfile?.whatsappNumber ? 'WhatsApp'
        : clubProfile?.facebookMessengerUrl ? 'Messenger'
        : contactUrl ? 'Website'
        : undefined;

    const handleShare = () => {
        const url = window.location.href;
        navigator.share?.({ title: record.title, url })
            .catch(() => { /* user cancelled */ });
    };

    const addressLine = record.locationName
        || clubProfile?.addressText
        || [clubProfile?.cityName, clubProfile?.countryName].filter(Boolean).join(', ')
        || undefined;

    const typeSubtitle = record.entityType === 'CLUB'
        ? clubProfile?.type || 'Club'
        : getRecordTypeLabel(record);

    const description = clubProfile?.description || record.description || undefined;
    const joinPolicyLabel = getJoinPolicyLabel(record.joinPolicy || clubProfile?.joinPolicy);
    const tryoutPosition = record.entityType === 'TRYOUT'
        ? record.subtitle?.split(' - ').at(-1) || null
        : null;

    const hasNonClubDetails = record.entityType !== 'CLUB' && (
        record.matchSubtype || record.challengeState || record.level
        || record.travelPreference || record.ageGroups.length > 0
        || record.genders.length > 0
    );

    const secondaryActions = [
        directionsUrl && { icon: <Navigation className="h-4 w-4" />, label: 'Directions', href: directionsUrl },
        contactUrl && contactLabel && { icon: <ExternalLink className="h-4 w-4" />, label: contactLabel, href: contactUrl },
        ('share' in navigator) && { icon: (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
            </svg>
        ), label: 'Share', onClick: handleShare },
    ].filter(Boolean) as Array<{ icon: React.ReactNode; label: string; href?: string; onClick?: () => void }>;

    return (
    <div className="map-details-panel flex h-full flex-col" style={{ backgroundColor: 'var(--map-panel-bg)' }}>
        {/* ── Banner with translucent overlay + overlapping logo ── */}
        <div className="relative shrink-0">
            {bannerUrl ? (
                <div className="relative h-40 w-full overflow-hidden bg-slate-200 dark:bg-[#16181d]">
                    <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/55" />
                </div>
            ) : (
                <div className="relative h-28 w-full overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-950">
                    <div className="absolute inset-4 rounded-[50%] border border-white/20" />
                    <div className="absolute bottom-0 left-1/2 top-0 w-px bg-white/20" />
                    <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
                </div>
            )}

            <span className="absolute left-4 top-4 inline-flex items-center rounded-full border border-white/25 bg-black/45 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-white backdrop-blur-md">
                {getRecordTypeLabel(record)}
            </span>
            <button type="button" onClick={onClose} className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur-md transition-colors hover:bg-black/65" aria-label="Close details">
                <X className="h-4 w-4" />
            </button>

            {/* Logo — upper half sits inside the banner zone, lower half below */}
            {logoUrl && (
                <div className="absolute left-5 bottom-0 translate-y-1/2">
                    <div className="h-[84px] w-[84px] overflow-hidden rounded-xl bg-slate-200 dark:bg-[#16181d]">
                        <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                </div>
            )}
        </div>

        {/* ── Header: name + type (left-padded to make room for overlapping logo) ── */}
        <div className={`shrink-0 px-5 pt-4 pb-3 ${logoUrl ? 'pl-[120px]' : ''}`}>
            <h2 className="text-[18px] font-bold text-slate-800 dark:text-slate-100 leading-tight line-clamp-2">
                {record.title}
            </h2>
            <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">{typeSubtitle}</p>
            {record.clubName && record.entityType !== 'CLUB' && (
                <p className="mt-0.5 text-[13px] font-medium text-slate-500 dark:text-slate-400 truncate">{record.clubName}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
                {(clubProfile?.isOfficial ?? record.official) && <span className="map-pill map-pill--accent"><ShieldCheck className="mr-1 h-3 w-3" />Verified</span>}
                {joinPolicyLabel && <span className="map-pill">{joinPolicyLabel}</span>}
                {tryoutPosition && <span className="map-pill">{tryoutPosition}</span>}
                {record.entityType === 'TRYOUT' && record.ageGroups.map((ageGroup) => <span key={ageGroup} className="map-pill">{ageGroup}</span>)}
            </div>
        </div>

        {/* ── Info rows ───────────────────────────── */}
        <div className="min-h-0 flex-1 overflow-y-auto">
            {/* Quick stats strip */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-[13px] text-slate-500 dark:text-slate-400">
                {(clubProfile?.memberCount != null || clubProfile?.followerCount != null) && (
                    <>
                        <Users className="h-3.5 w-3.5 text-muted" />
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{clubProfile?.memberCount ?? record.memberCount}</span>
                        <span>members</span>
                        <span className="text-muted">·</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{clubProfile?.followerCount ?? record.followerCount}</span>
                        <span>followers</span>
                    </>
                )}
                {(clubProfile?.isOfficial ?? record.official) && (
                    <>
                        <span className="text-muted">·</span>
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                        <span>Official</span>
                    </>
                )}
            </div>

            {addressLine && (
                <div className="flex items-start gap-3 px-5 py-2.5 border-t border-[var(--map-panel-border)]">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                    <p className="text-[14px] leading-5 text-slate-500 dark:text-slate-400">{addressLine}</p>
                </div>
            )}

            {record.startsAt && (
                <div className={`flex items-center gap-3 px-5 py-2 ${!addressLine ? 'border-t border-[var(--map-panel-border)]' : ''}`}>
                    <Clock className="h-4 w-4 shrink-0 text-muted" />
                    <p className="text-[14px] text-slate-500 dark:text-slate-400">
                        {formatDateTime(record.startsAt)}
                        {record.endsAt && <span className="text-muted"> — {formatDateTime(record.endsAt)}</span>}
                    </p>
                </div>
            )}

            {record.distanceKm != null && (
                <div className={`flex items-center gap-3 px-5 py-2 ${!addressLine && !record.startsAt ? 'border-t border-[var(--map-panel-border)]' : ''}`}>
                    <Navigation className="h-4 w-4 shrink-0 text-muted" />
                    <p className="text-[14px] text-slate-500 dark:text-slate-400">
                        {record.distanceKm < 1
                            ? `${Math.round(record.distanceKm * 1000)} m away`
                            : `${record.distanceKm.toFixed(1)} km away`}
                    </p>
                </div>
            )}

            {/* ── Description — always visible ──────── */}
            {description && (
                <div className="px-5 pt-3 mt-1 border-t border-[var(--map-panel-border)]">
                    <p className="text-[14px] leading-6 text-slate-500 dark:text-slate-400 line-clamp-3">
                        {description}
                    </p>
                </div>
            )}

            {/* ── Trusted by ────────────────────────── */}
            {clubProfile?.trustedByClubs && clubProfile.trustedByClubs.length > 0 && (
                <div className="px-5 pt-3 mt-1 border-t border-[var(--map-panel-border)]">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">Trusted by</p>
                    <div className="flex flex-wrap gap-1.5">
                        {clubProfile.trustedByClubs.map(tc => (
                            <span key={tc.clubId} className="map-pill text-[12px]">{tc.clubName}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Match/Tryout details (collapsible) ── */}
            {hasNonClubDetails && (
                <div className="mt-3">
                    <InfoSection
                        title={record.entityType === 'TRYOUT' ? 'Tryout details' : 'Match details'}
                        expanded={detailsOpen}
                        onToggle={() => setDetailsOpen(v => !v)}
                    >
                        <div className="flex flex-wrap gap-1.5">
                            {record.matchSubtype && (
                                <span className="map-pill text-[12px]">{record.matchSubtype === 'FRIENDLY' ? 'Friendly' : 'Competitive'}</span>
                            )}
                            {record.challengeState && (
                                <span className="map-pill text-[12px]">{record.challengeState}</span>
                            )}
                            <span className="map-pill text-[12px]">{record.locationState === 'PINNED' ? 'Venue set' : 'Venue open'}</span>
                            {record.level && <span className="map-pill text-[12px]">{record.level}</span>}
                            {record.travelPreference && <span className="map-pill text-[12px]">{getTravelPreferenceLabel(record.travelPreference)}</span>}
                        </div>
                        {record.ageGroups.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold text-muted mb-1.5">Age groups</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {record.ageGroups.map(ag => <span key={ag} className="map-pill text-[12px]">{ag}</span>)}
                                </div>
                            </div>
                        )}
                        {record.genders.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold text-muted mb-1.5">Gender</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {record.genders.map(g => <span key={g} className="map-pill text-[12px]">{g}</span>)}
                                </div>
                            </div>
                        )}
                    </InfoSection>
                </div>
            )}

            <div className="h-3" />
        </div>

        {/* ── Footer: secondary then primary ───────── */}
        <div className="shrink-0 border-t border-[var(--map-panel-border)] px-4 py-3.5 space-y-2.5">
            {/* Secondary action chips */}
            {secondaryActions.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-2">
                    {secondaryActions.map(action =>
                        action.href ? (
                            <a
                                key={action.label}
                                href={action.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--map-panel-border)] px-4 py-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:border-emerald-700 hover:text-emerald-700 dark:text-slate-400 dark:hover:border-emerald-400 dark:hover:text-emerald-400"
                            >
                                {action.icon}
                                {action.label}
                            </a>
                        ) : (
                            <button
                                key={action.label}
                                type="button"
                                onClick={action.onClick}
                                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--map-panel-border)] px-4 py-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:border-emerald-700 hover:text-emerald-700 dark:text-slate-400 dark:hover:border-emerald-400 dark:hover:text-emerald-400"
                            >
                                {action.icon}
                                {action.label}
                            </button>
                        )
                    )}
                </div>
            )}

            {/* Primary button */}
            <button
                type="button"
                onClick={onOpenClub}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--map-panel-border)] px-4 py-2.5 text-[14px] font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#16181d] transition-colors"
            >
                <Building2 className="h-4 w-4" />
                View full profile
            </button>

            {record.entityType === 'MATCH' && canRespond && (
                <button
                    type="button"
                    onClick={onRespond}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 py-2.5 text-[14px] font-bold text-white transition-opacity hover:opacity-90"
                >
                    Respond
                </button>
            )}

            {record.entityType === 'TRYOUT' && (
                <button
                    type="button"
                    onClick={() => void handleApply()}
                    disabled={applyState === 'applying' || applyState === 'applied'}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 py-2.5 text-[14px] font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {applyState === 'applying' ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t('map.tryouts.applying')}
                        </>
                    ) : applyState === 'applied' ? (
                        <>
                            <Check className="h-4 w-4" />
                            {t('map.tryouts.applied')}
                        </>
                    ) : (
                        t('map.tryouts.apply')
                    )}
                </button>
            )}

            {applyError && (
                <p className="text-center text-[13px] font-medium" style={{ color: 'var(--state-danger)' }}>
                    {applyError}
                </p>
            )}
        </div>
    </div>
    );
};

export const MapPage = ({ darkMode }: { darkMode: boolean }) => {
    const navigate = useNavigate();
    const { status, user } = useAuth();
    const { t } = useTranslation();
    // Draft vs committed split (MAP_SEARCH_AND_CLUB_JOBS_PLAN.md item 4): every
    // control writes to the draft only; a single Apply commits the draft and
    // triggers exactly one fetch. Typing in the toolbar is equally draft-only.
    const [committedFilters, setCommittedFilters] = useState<MapFilters>(defaultMapFilters);
    const [draftFilters, setDraftFilters] = useState<MapFilters>(defaultMapFilters);
    const [draftSearch, setDraftSearch] = useState('');
    const [committedSearch, setCommittedSearch] = useState('');
    const [placeSearch, setPlaceSearch] = useState('');
    const [filterMode, setFilterMode] = useState<'simple' | 'advanced'>('simple');
    const [isFilterOpen, setIsFilterOpen] = useState(() => window.innerWidth >= 1440);
    const [isClubRailOpen, setIsClubRailOpen] = useState(false);
    const [viewportCenter, setViewportCenter] = useState<[number, number]>(DEFAULT_CENTER);

    useEffect(() => {
        let wasWide = window.innerWidth >= 1440;
        const handleResize = () => {
            const isWide = window.innerWidth >= 1440;
            if (isWide === wasWide) return;
            wasWide = isWide;
            setIsFilterOpen(isWide);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    // The anchor the last fetch used — a geocoded place when one was resolved,
    // otherwise the viewport center at Apply time.
    const [queryCenter, setQueryCenter] = useState<[number, number]>(DEFAULT_CENTER);
    const [focusTarget, setFocusTarget] = useState<{ center: [number, number]; zoom?: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [initialLoad, setInitialLoad] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mapMarkers, setMapMarkers] = useState<MapMarkerDto[]>([]);
    const [resultCount, setResultCount] = useState<number | null>(null);
    const [membership, setMembership] = useState<{ clubId?: number | null; clubName?: string | null; myRole?: string | null } | null>(null);
    const [mapMode, setMapMode] = usePersistedState<MapMode>('map.mapMode', 'flat');
    // FLAT/GLOBE render the recolored positron OBJECT; while it loads (or if the
    // fetch/transform fails) this stays null and we pass the plain URL instead.
    const [vividStyle, setVividStyle] = useState<StyleSpecification | null>(null);
    useEffect(() => {
        if (mapMode === 'tilted') return;
        let active = true;
        getVividStyle()
            .then((style) => {
                if (active) setVividStyle(style);
            })
            .catch((styleError: unknown) => {
                console.warn('Vivid positron style unavailable — falling back to plain positron URL', styleError);
            });
        return () => {
            active = false;
        };
    }, [mapMode]);
    const darkMapStyle = useMemo(
        () => vividStyle ? withDarkPaints(vividStyle) as StyleSpecification : null,
        [vividStyle]
    );

    const [modeWarningDismissed, setModeWarningDismissed] = usePersistedState<boolean>('map.modeWarningDismissed', false);
    const [pendingMode, setPendingMode] = useState<MapMode | null>(null);
    // Raw maplibre instance (cluster zoom-in) + fetch-on-move debounce timer.
    const mapRef = useRef<MapRef | null>(null);
    const [pinAssetsReady, setPinAssetsReady] = useState(false);
    const queryCenterTimerRef = useRef<number | null>(null);
    useEffect(() => () => {
        if (queryCenterTimerRef.current != null) {
            window.clearTimeout(queryCenterTimerRef.current);
        }
    }, []);

    // Restricted viewers (anonymous, PLAYER, FAN) only get CLUB.
    // Staff account roles and club staff memberships additionally get MATCH +
    // TOURNAMENT. Account-level COACH access must not depend on the optional
    // membership-context request succeeding. The backend re-clamps server-side.
    const hasStaffMapAccess = useMemo(
        () => hasFullMapAccess(user?.role, membership?.myRole),
        [user?.role, membership?.myRole]
    );
    const viewerAllowedTypes = useMemo<MapEntityType[]>(() => {
        return hasStaffMapAccess ? ALL_MAP_TYPES : ['CLUB'];
    }, [hasStaffMapAccess]);

    useEffect(() => {
        const clamp = (current: MapFilters): MapFilters => {
            const clamped = current.entityType.filter((t) => viewerAllowedTypes.includes(t));
            const next = clamped.length > 0 ? clamped : viewerAllowedTypes;
            if (next.length === current.entityType.length && next.every((t, i) => t === current.entityType[i])) {
                return current;
            }
            return { ...current, entityType: next };
        };
        setDraftFilters(clamp);
        setCommittedFilters((current) => {
            const next = clamp(current);
            return next === current ? current : next;
        });
    }, [viewerAllowedTypes]);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [clubProfiles, setClubProfiles] = useState<Record<number, ClubProfileSummary>>({});
    const [responseModalRecord, setResponseModalRecord] = useState<DiscoveryRecord | null>(null);
    const [responseNote, setResponseNote] = useState('');
    const [responseError, setResponseError] = useState<string | null>(null);
    const [responseSubmitting, setResponseSubmitting] = useState(false);

    useEffect(() => {
        let active = true;

        const load = async () => {
            setLoading(true);
            setError(null);

            try {
                const membershipPromise =
                    status === 'authenticated'
                        ? fetchMyClubMembershipContext().catch(() => null)
                        : Promise.resolve(null);

                // One spatial call for every selected type — clubs included. The
                // server applies ST_DWithin radius + filters; nothing is refetched
                // until the committed inputs change (Apply / amber button / clamp).
                const types = committedFilters.entityType;
                const isTryoutSelected = types.includes('TRYOUT');
                const isMatchSelected = types.includes('MATCH');
                const activeDateWindow = isTryoutSelected ? committedFilters.tryouts.dateWindow :
                    isMatchSelected ? committedFilters.matches.dateWindow : null;
                let dateFrom: string | undefined;
                let dateTo: string | undefined;
                if (activeDateWindow && activeDateWindow !== 'ANY' && types.length > 0) {
                    const now = new Date();
                    dateFrom = toIsoWindow(now);
                    const days = activeDateWindow === 'NEXT_7_DAYS' ? 7 : activeDateWindow === 'NEXT_30_DAYS' ? 30 : 90;
                    dateTo = toIsoWindow(new Date(now.getTime() + days * 24 * 60 * 60 * 1000));
                }

                // Club attribute filters (plan doc item 2): union the club-section
                // values with the tryout/match values. Club gender chips are mapped
                // to the stored squads tokens (Boys/Men→MALE, Girls/Women→FEMALE,
                // Mixed→MIXED); the server canonicalizes the rest.
                const clubGenderTokens = committedFilters.clubs.genders.map((g) => {
                    switch (g) {
                        case 'Boys':
                        case 'Men': return 'MALE';
                        case 'Girls':
                        case 'Women': return 'FEMALE';
                        case 'Mixed': return 'MIXED';
                    }
                });
                const serverAgeGroups = [
                    ...(isTryoutSelected ? committedFilters.tryouts.ageGroups : []),
                    ...(isMatchSelected ? committedFilters.matches.ageGroups : []),
                    ...(types.includes('CLUB') ? committedFilters.clubs.ageGroups : [])
                ];
                const serverGender = [
                    ...(isTryoutSelected ? committedFilters.tryouts.genders : []),
                    ...(isMatchSelected ? committedFilters.matches.genders : []),
                    ...clubGenderTokens
                ];
                const serverLevel = [
                    ...(isMatchSelected ? committedFilters.matches.levels : []),
                    ...(types.includes('CLUB') ? committedFilters.clubs.levels : [])
                ];
                const serverCategories = types.includes('CLUB') && committedFilters.clubs.categories.length > 0
                    ? committedFilters.clubs.categories : undefined;

                const cities = [
                    ...(types.includes('CLUB') && committedFilters.clubs.city ? [committedFilters.clubs.city] : []),
                    ...(types.includes('TRYOUT') && committedFilters.tryouts.city ? [committedFilters.tryouts.city] : []),
                    ...(types.includes('MATCH') && committedFilters.matches.city ? [committedFilters.matches.city] : [])
                ];
                const countries = [
                    ...(types.includes('CLUB') && committedFilters.clubs.country ? [committedFilters.clubs.country] : []),
                    ...(types.includes('TRYOUT') && committedFilters.tryouts.country ? [committedFilters.tryouts.country] : []),
                    ...(types.includes('MATCH') && committedFilters.matches.country ? [committedFilters.matches.country] : [])
                ];

                const mapPromise = fetchNearbyMap({
                    lat: queryCenter[0],
                    lng: queryCenter[1],
                    radius: committedFilters.distanceKm,
                    type: types,
                    cities: cities.length > 0 ? [...new Set(cities)] : undefined,
                    countries: countries.length > 0 ? [...new Set(countries)] : undefined,
                    query: committedSearch || undefined,
                    dateFrom,
                    dateTo,
                    ageGroups: serverAgeGroups.length > 0 ? serverAgeGroups : undefined,
                    gender: serverGender.length > 0 ? serverGender : undefined,
                    level: serverLevel.length > 0 ? serverLevel : undefined,
                    category: serverCategories,
                    positions: committedFilters.positions.length > 0 ? committedFilters.positions : undefined,
                    page: 0,
                    size: 100
                });

                const [membershipContext, mapData] = await Promise.all([
                    membershipPromise,
                    mapPromise
                ]);

                if (!active) return;

                setMapMarkers(mapData.content);
                setResultCount(mapData.totalElements);
                setMembership(membershipContext);
                setInitialLoad(false);
            } catch (requestError) {
                if (!active) return;
                console.error('Failed to load map discovery data', requestError);
                setError('Unable to load map discovery data.');
            } finally {
                if (active) setLoading(false);
            }
        };

        void load();
        return () => {
            active = false;
        };
    }, [status, committedFilters, committedSearch, queryCenter]);

    const allRecords = useMemo(
        () => mapMarkers.map(buildMapMarkerRecord),
        [mapMarkers]
    );

    const suggestions = useMemo(() => {
        const query = normalizeText(draftSearch);
        if (!query) {
            return [] as SearchSuggestion[];
        }

        const deduped = new Map<string, SearchSuggestion>();
        for (const record of allRecords) {
            if (!record.searchText.includes(query)) {
                continue;
            }

            const label = record.locationName ?? record.title;
            const suggestion: SearchSuggestion = {
                id: record.key,
                label,
                meta: record.entityType === 'CLUB' ? 'Club location' : `${record.clubName ?? 'Club'} · ${record.entityType === 'TRYOUT' ? 'Tryout' : record.matchSubtype === 'FRIENDLY' ? 'Friendly' : 'Match'}`,
                center: record.latitude != null && record.longitude != null ? [record.latitude, record.longitude] : null,
                recordKey: record.key
            };

            if (!deduped.has(label.toLowerCase())) {
                deduped.set(label.toLowerCase(), suggestion);
            }

            if (deduped.size >= CLUB_QUERY_LIMIT) {
                break;
            }
        }

        return Array.from(deduped.values()).slice(0, 6);
    }, [allRecords, draftSearch]);

    const filteredRecords = useMemo(() => {
        const query = normalizeText(committedSearch);

        return allRecords.filter((record) => {
            // Type filtering handled server-side; client only filters what server can't
            if (query && !record.searchText.includes(query)) return false;

            if (record.entityType === 'CLUB') {
                if (committedFilters.clubs.officialOnly && !record.official) return false;
                if (committedFilters.clubs.openTryoutsOnly && record.joinPolicy === 'INVITE_ONLY') return false;
                return true;
            }

            // Time-of-day filter (server doesn't handle this)
            const timeWindows = record.entityType === 'TRYOUT' ? committedFilters.tryouts.timeWindows : committedFilters.matches.timeWindows;
            if (timeWindows.length > 0) {
                const window = getTimeWindow(record.startsAt);
                if (!window || !timeWindows.includes(window)) return false;
            }

            // Age/level/gender from extracted text (server doesn't extract these)
            const selectedGenders = record.entityType === 'TRYOUT' ? committedFilters.tryouts.genders : committedFilters.matches.genders;
            if (selectedGenders.length > 0 && !record.genders.some((gender) => selectedGenders.includes(gender))) return false;

            // Level filter only applies to matches (tryouts don't have a level dimension)
            if (record.entityType === 'MATCH' && committedFilters.matches.levels.length > 0
                && (!record.level || !committedFilters.matches.levels.includes(record.level))) return false;

            const selectedAges = record.entityType === 'TRYOUT' ? committedFilters.tryouts.ageGroups : committedFilters.matches.ageGroups;
            if (selectedAges.length > 0 && !record.ageGroups.some((ageGroup) => selectedAges.includes(ageGroup))) return false;

            if (record.entityType === 'MATCH') {
                if (record.matchSubtype && committedFilters.matches.subtypes.length > 0 && !committedFilters.matches.subtypes.includes(record.matchSubtype)) return false;
            }

            // Server already filtered by gender/age/level/date for MATCH and TRYOUT
            return true;
        });
    }, [allRecords, committedSearch, committedFilters]);

    const sortedRecords = useMemo(() => {
        const records = [...filteredRecords];
        // Server-computed geodesic distance from the query center (ST_Distance).
        const distanceFor = (record: DiscoveryRecord) => record.distanceKm ?? Number.POSITIVE_INFINITY;
        const timestampFor = (record: DiscoveryRecord) => {
            if (!record.startsAt) return Number.MAX_SAFE_INTEGER;
            const parsed = new Date(record.startsAt).getTime();
            return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
        };

        const compareBySort = (left: DiscoveryRecord, right: DiscoveryRecord) => {
            if (committedFilters.sortBy === 'DISTANCE') {
                return distanceFor(left) - distanceFor(right) || left.title.localeCompare(right.title);
            }
            if (committedFilters.sortBy === 'SOONEST') {
                return timestampFor(left) - timestampFor(right) || left.title.localeCompare(right.title);
            }
            if (committedFilters.sortBy === 'NAME') {
                return left.title.localeCompare(right.title);
            }

            const leftScore = Number(left.official) + Number(left.challengeState === 'OPEN');
            const rightScore = Number(right.official) + Number(right.challengeState === 'OPEN');
            return rightScore - leftScore || timestampFor(left) - timestampFor(right) || distanceFor(left) - distanceFor(right);
        };

        return records.sort(compareBySort);
    }, [filteredRecords, committedFilters.sortBy]);

    // Server-side ST_DWithin already applied the committed radius — keep only the
    // lat/lng guard here (markers without a pin never render).
    const mapRecords = useMemo(
        () => sortedRecords.filter((record) => record.latitude != null && record.longitude != null),
        [sortedRecords]
    );

    // Wave 1: one GeoJSON source feeds the GPU cluster layers (replaces the DOM
    // <Marker> tree that used to re-mount on every pan/zoom).
    const pointsFeatureCollection = useMemo(
        () => buildPointsFeatureCollection(mapRecords.filter((record) => record.key !== selectedKey).map((record) => ({
            key: record.key,
            entityType: record.entityType,
            latitude: record.latitude as number,
            longitude: record.longitude as number,
            title: record.title
        }))),
        [mapRecords, selectedKey]
    );

    const radiusVignette = useMemo(() => {
        const maxRadius = 400;
        if (committedFilters.distanceKm >= maxRadius) return null;

        // Anchored to the query center (the place the last fetch resolved against),
        // not the live viewport — the vignette must match the fetched data.
        const center = queryCenter;
        const distanceKm = committedFilters.distanceKm;
        const numPoints = 72;
        const R = 6371;

        const lat1 = (center[0] * Math.PI) / 180;
        const lon1 = (center[1] * Math.PI) / 180;
        const angularDist = distanceKm / R;

        const holeCoords: [number, number][] = [];
        for (let i = 0; i <= numPoints; i++) {
            const bearing = ((i * 360) / numPoints) * (Math.PI / 180);
            const lat2 = Math.asin(
                Math.sin(lat1) * Math.cos(angularDist) +
                    Math.cos(lat1) * Math.sin(angularDist) * Math.cos(bearing)
            );
            const lon2 =
                lon1 +
                Math.atan2(
                    Math.sin(bearing) * Math.sin(angularDist) * Math.cos(lat1),
                    Math.cos(angularDist) - Math.sin(lat1) * Math.sin(lat2)
                );
            holeCoords.push([lon2 * (180 / Math.PI), lat2 * (180 / Math.PI)]);
        }

        return {
            type: 'Feature' as const,
            properties: {},
            geometry: {
                type: 'Polygon' as const,
                coordinates: [
                    [
                        [-360, -180],
                        [360, -180],
                        [360, 180],
                        [-360, 180],
                        [-360, -180],
                    ],
                    holeCoords,
                ],
            },
        };
    }, [committedFilters.distanceKm, queryCenter]);

    const selectedRecord = useMemo(() => sortedRecords.find((record) => record.key === selectedKey) ?? null, [sortedRecords, selectedKey]);
    // Selection ring source: a single-point collection (or an empty one) built
    // from the selected record's pin — the ring layer draws around it.
    const selectedFeatureCollection = useMemo(
        () => buildPointsFeatureCollection(
            selectedRecord && selectedRecord.latitude != null && selectedRecord.longitude != null
                ? [{
                    key: selectedRecord.key,
                    entityType: selectedRecord.entityType,
                    latitude: selectedRecord.latitude,
                    longitude: selectedRecord.longitude,
                    title: selectedRecord.title
                }]
                : []
        ),
        [selectedRecord]
    );
    const layoutSignature = `${selectedRecord?.entityType ?? 'none'}:${isFilterOpen}:${filterMode}:${isClubRailOpen}`;

    useEffect(() => {
        if (selectedRecord?.clubId == null || clubProfiles[selectedRecord.clubId]) {
            return;
        }

        let active = true;
        void apiClient
            .get<ClubProfileSummary>(`/clubs/${selectedRecord.clubId}`)
            .then((response) => {
                if (!active) return;
                setClubProfiles((current) => ({ ...current, [selectedRecord.clubId as number]: response.data }));
            })
            .catch(() => undefined);

        return () => {
            active = false;
        };
    }, [clubProfiles, selectedRecord]);

    useEffect(() => {
        if (selectedKey && !sortedRecords.some((record) => record.key === selectedKey)) {
            setSelectedKey(null);
        }
    }, [sortedRecords, selectedKey]);

    const handleFocusSettled = useCallback(() => setFocusTarget(null), []);

    const selectRecord = useCallback((record: DiscoveryRecord) => {
        setSelectedKey(record.key);
        if (record.latitude != null && record.longitude != null) {
            setFocusTarget({ center: [record.latitude, record.longitude] });
        }
    }, []);

    // The click controller binds map events once, so point clicks resolve the
    // record through a ref instead of closing over a changing list.
    const allRecordsRef = useRef(allRecords);
    useEffect(() => {
        allRecordsRef.current = allRecords;
    }, [allRecords]);

    const handleMapPointClick = useCallback((recordKey: string) => {
        const record = allRecordsRef.current.find((entry) => entry.key === recordKey);
        if (record) {
            selectRecord(record);
        }
    }, [selectRecord]);

    const handleMapClusterClick = useCallback((feature: MapGeoJSONFeature) => {
        const map = mapRef.current?.getMap();
        if (!map || feature.geometry.type !== 'Point') return;
        const [longitude, latitude] = feature.geometry.coordinates;
        map.easeTo({ center: [longitude, latitude], zoom: Math.min(map.getZoom() + 2, 17) });
    }, []);

    const openClubProfile = useCallback(
        (record: DiscoveryRecord | null) => {
            if (record?.clubId) {
                navigate(`/clubs/${record.clubId}`);
            }
        },
        [navigate]
    );

    const canRespondToSelectedMatch = Boolean(
        selectedRecord?.entityType === 'MATCH' &&
        selectedRecord.rawMapMarker?.scheduleEventId &&
        selectedRecord.clubId &&
        membership?.clubId &&
        membership.clubId !== selectedRecord.clubId &&
        isLeadershipRole(membership?.myRole) &&
        selectedRecord.challengeState === 'OPEN'
    );

    const handleSuggestionPick = (suggestion: SearchSuggestion) => {
        // Commit the picked text — the fetch effect refires on committedSearch
        // and narrows results server-side; the client filter follows.
        setDraftSearch(suggestion.label);
        setCommittedSearch(suggestion.label);
        if (suggestion.center) {
            setViewportCenter(suggestion.center);
            setFocusTarget({ center: suggestion.center });
        }
        if (suggestion.recordKey) {
            const record = allRecords.find((entry) => entry.key === suggestion.recordKey);
            if (record) {
                selectRecord(record);
            }
        }
    };

    // W7b — zero-results empty state: widen the committed radius to the slider
    // max and refetch in place (the fetch effect refires on committedFilters).
    const widenRadius = useCallback(() => {
        setDraftFilters((current) => ({ ...current, distanceKm: 400 }));
        setCommittedFilters((current) => ({ ...current, distanceKm: 400 }));
    }, []);

    // Single commit path (plan items 1+4): geocode the place text when present
    // (empty/error aborts the whole commit and leaves the draft intact), then
    // commit the draft — the fetch effect refires on the committed inputs.
    const commitAndFetch = useCallback(
        async (opts: { center?: [number, number]; zoom?: number; fly?: boolean } = {}) => {
            let center = opts.center ?? viewportCenter;
            let zoom = opts.zoom;

            const selectedCountry = draftFilters.clubs.country.trim();
            const selectedCity = draftFilters.clubs.city.trim();
            const place = selectedCity || selectedCountry || placeSearch.trim();
            if (place) {
                try {
                    const countryCode = findIsoCountry(selectedCountry)?.code;
                    const results = await geocodePlace(place, {
                        countryCode,
                        type: selectedCity ? 'CITY' : selectedCountry ? 'COUNTRY' : undefined
                    });
                    if (results.length === 0) {
                        toast.error(`No place found for "${place}"`);
                        return;
                    }
                    const top = results[0];
                    center = [top.latitude, top.longitude];
                    zoom = top.type === 'CITY' ? 11.5 : 5.5;
                    toast.success(`Flew to ${top.name}`);
                } catch (placeError) {
                    toast.error(extractApiErrorMessage(placeError, 'Could not resolve that place.'));
                    return;
                }
            }

            setCommittedFilters(draftFilters);
            setCommittedSearch(draftSearch.trim());
            setQueryCenter(center);
            if (opts.fly || zoom != null) {
                setFocusTarget({ center, zoom });
            }
        },
        [draftFilters, draftSearch, placeSearch, viewportCenter]
    );

    const submitResponse = async () => {
        const scheduleEventId = responseModalRecord?.rawMapMarker?.scheduleEventId;
        if (!scheduleEventId || !responseModalRecord.clubId || !membership?.clubId) {
            return;
        }

        setResponseSubmitting(true);
        setResponseError(null);

        try {
            await createScheduleChallenge(scheduleEventId, {
                challengerClubId: membership.clubId,
                targetClubId: responseModalRecord.clubId,
                note: responseNote.trim() || undefined
            });

            // Map data will refresh on next viewport change — the challenge response is persisted server-side
            setResponseModalRecord(null);
            setResponseNote('');
        } catch (requestError) {
            console.error('Failed to respond to published match need', requestError);
            setResponseError('The match response could not be submitted right now.');
        } finally {
            setResponseSubmitting(false);
        }
    };

    const panelContent = selectedRecord ? (
        <DiscoveryDetailPanel
            record={selectedRecord}
            clubProfile={selectedRecord.clubId ? clubProfiles[selectedRecord.clubId] ?? null : null}
            canRespond={canRespondToSelectedMatch}
            onRespond={() => {
                setResponseModalRecord(selectedRecord);
                setResponseNote('');
                setResponseError(null);
            }}
            onOpenClub={() => openClubProfile(selectedRecord)}
            onClose={() => setSelectedKey(null)}
        />
    ) : null;

    const hasSelectedResult = Boolean(selectedRecord && (selectedRecord.entityType !== 'CLUB' || !isClubRailOpen));
    const visibleClubs = useMemo<VisibleClubListItem[]>(() => mapRecords
        .filter((record) => record.entityType === 'CLUB' && record.clubId != null)
        .map((record) => ({
            key: record.key,
            clubId: record.clubId as number,
            name: record.title,
            logoUrl: record.rawMapMarker?.logoUrl ?? null,
            typeLabel: record.typeLabel,
            city: record.city,
            country: record.country,
            address: record.locationName ?? record.description,
            official: record.official,
            memberCount: record.memberCount,
            distanceKm: record.distanceKm,
            ageGroups: record.ageGroups,
            level: record.level
        })), [mapRecords]);
    const toolbarCount = `${mapRecords.length} visible`;

    return (
        <div className={`map-page-shell club-page-shell map-workspace h-full min-h-0 w-full overflow-hidden map-design-futuristic relative ${darkMode ? 'map-force-dark' : 'map-force-light'} ${(isClubRailOpen && !hasSelectedResult) || hasSelectedResult ? 'map-right-rail-visible' : ''}`}>
            {!initialLoad && !error && (
                <div className="map-canvas-frame absolute inset-0 z-0 overflow-hidden border-0 rounded-none">
                    <MapGL
                        ref={mapRef}
                        initialViewState={{
                            latitude: DEFAULT_CENTER[0],
                            longitude: DEFAULT_CENTER[1],
                            zoom: 11,
                            pitch: mapMode === 'tilted' ? 45 : 0,
                            bearing: mapMode === 'tilted' ? -17 : 0
                        }}
                        style={{ width: '100%', height: '100%' }}
                        attributionControl={{ compact: true }}
                        // TILTED keeps the keyed MapTiler style; FLAT/GLOBE use the
                        // vivid-recolored positron OBJECT (plain URL until it loads or
                        // on failure). Dark appearance uses a separately repainted
                        // style so pins and labels retain their intended colours.
                        mapStyle={mapMode === 'tilted' && MAPTILER_API_KEY
                            ? STYLE_TILTED(MAPTILER_API_KEY)
                            : darkMode
                                ? darkMapStyle ?? vividStyle ?? MAP_STYLE_DEFAULT
                                : vividStyle ?? MAP_STYLE_DEFAULT}
                        onLoad={(evt) => {
                            // MapLibre v5: drive the projection imperatively (react-map-gl 8
                            // does not forward a projection prop).
                            try {
                                evt.target.setProjection({ type: mapMode === 'globe' ? 'globe' : 'mercator' });
                            } catch {
                                /* projection unsupported — stay mercator */
                            }
                            if (mapMode === 'tilted') {
                                evt.target.easeTo({ pitch: 45, bearing: -17, duration: 400 });
                            } else {
                                evt.target.easeTo({ pitch: 0, bearing: 0, duration: 400 });
                            }
                        }}
                        onMoveEnd={(evt) => {
                            const center = evt.target.getCenter();
                            const nextCenter: [number, number] = [Number(center.lat.toFixed(6)), Number(center.lng.toFixed(6))];
                            setViewportCenter(nextCenter);

                            // Fetch-on-move (Wave 1): panning beyond 40% of the committed
                            // radius silently re-anchors the query center after a short
                            // debounce — committed filters stay untouched, so this is the
                            // same fetch path as "Search this area" without the button.
                            const driftKm = haversineKm(nextCenter[0], nextCenter[1], queryCenter[0], queryCenter[1]);
                            if (driftKm > committedFilters.distanceKm * 0.4) {
                                if (queryCenterTimerRef.current != null) {
                                    window.clearTimeout(queryCenterTimerRef.current);
                                }
                                queryCenterTimerRef.current = window.setTimeout(() => {
                                    queryCenterTimerRef.current = null;
                                    setQueryCenter(nextCenter);
                                }, 600);
                            }
                        }}
                    >
                        <MapFocusController target={focusTarget} onSettled={handleFocusSettled} />
                        <MapSizeGuard layoutSignature={layoutSignature} />
                        <MapPinAssetController onReady={setPinAssetsReady} />
                        <MapClickController
                            onPointClick={handleMapPointClick}
                            onClusterClick={handleMapClusterClick}
                        />
                        {radiusVignette && (
                            <Source id="radius-vignette" type="geojson" data={radiusVignette}>
                                <Layer
                                    id="radius-vignette-fill"
                                    type="fill"
                                    paint={{
                                        'fill-color': '#0f172a',
                                        'fill-opacity': 0.06,
                                        'fill-opacity-transition': { duration: 400 },
                                        'fill-antialias': true,
                                    }}
                                />
                            </Source>
                        )}
                        <NavigationControl position="bottom-right" />
                        <MapLegend types={viewerAllowedTypes} />
                        <GeolocateControl
                            position="bottom-right"
                            positionOptions={{ enableHighAccuracy: true }}
                            trackUserLocation={true}
                        />
                        {pinAssetsReady && <Source
                            id={MAP_POINTS_SOURCE_ID}
                            type="geojson"
                            data={pointsFeatureCollection}
                            cluster
                            clusterMaxZoom={14}
                            clusterRadius={50}
                        >
                            <Layer
                                id={LAYER_CLUSTERS}
                                type="symbol"
                                filter={['has', 'point_count']}
                                layout={{
                                    'icon-image': MAP_CLUSTER_IMAGE,
                                    'icon-size': ['step', ['get', 'point_count'], 0.105, 10, 0.125, 30, 0.145],
                                    'icon-allow-overlap': true,
                                    'icon-ignore-placement': true
                                }}
                            />
                            <Layer
                                id={LAYER_CLUSTER_COUNT}
                                type="symbol"
                                filter={['has', 'point_count']}
                                layout={{ 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12 }}
                                paint={{
                                    'text-color': '#111827',
                                    'text-halo-color': '#ffffff',
                                    'text-halo-width': 1
                                }}
                            />
                            <Layer
                                id={LAYER_POINT_HALO}
                                type="circle"
                                filter={['!', ['has', 'point_count']]}
                                paint={{
                                    'circle-color': darkMode ? '#e2e8f0' : '#111827',
                                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 7, 12, 10],
                                    'circle-opacity': darkMode ? 0.42 : 0.22,
                                    'circle-blur': 0.55
                                }}
                            />
                            <Layer
                                id={LAYER_POINTS}
                                type="symbol"
                                filter={['!', ['has', 'point_count']]}
                                layout={{
                                    'icon-image': ['get', 'icon'],
                                    'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.075, 12, 0.11],
                                    'icon-anchor': 'bottom',
                                    'icon-allow-overlap': true,
                                    'icon-ignore-placement': true
                                }}
                            />
                        </Source>}
                        <Source id="selected-point" type="geojson" data={selectedFeatureCollection}>
                            {pinAssetsReady && <Layer
                                id="selected-point-pin"
                                type="symbol"
                                layout={{
                                    'icon-image': MAP_SELECTED_PIN_IMAGE,
                                    'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.09, 12, 0.14],
                                    'icon-anchor': 'bottom',
                                    'icon-allow-overlap': true,
                                    'icon-ignore-placement': true
                                }}
                            />}
                        </Source>
                    </MapGL>
                </div>
            )}
            {/* Mode switcher: rendered OUTSIDE <MapGL> (it needs no map context) so it
                stays visible through loading/error states and can shift right of the
                open filter drawer at xl — mirroring the command bar offset. */}
            <div
                className={`pointer-events-none absolute bottom-4 left-4 z-[600] transition-all duration-200 ${
                    isFilterOpen ? 'xl:left-[calc(var(--map-filter-w,380px)_+_16px)]' : 'xl:left-4'
                }`}
            >
                <div className="pointer-events-auto">
                    <MapModeControl
                        mode={mapMode}
                        tiltedAvailable={Boolean(MAPTILER_API_KEY)}
                        pendingMode={pendingMode}
                        onRequestMode={(next) => {
                            if (next === 'flat' || modeWarningDismissed) {
                                setPendingMode(null);
                                setMapMode(next);
                                return;
                            }
                            setPendingMode(next);
                        }}
                        onConfirmMode={() => {
                            if (pendingMode) setMapMode(pendingMode);
                            setPendingMode(null);
                        }}
                        onDismissWarning={(dismissed) => setModeWarningDismissed(dismissed)}
                        onCancelWarning={() => setPendingMode(null)}
                    />
                </div>
            </div>
            {initialLoad && (
                <div className="absolute inset-0 z-[5] flex items-center justify-center bg-[var(--map-workspace-bg)]">
                    <div className="flex flex-col items-center gap-3 text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
                        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Loading map...</p>
                    </div>
                </div>
            )}
            {loading && !initialLoad && (
                <div className="map-loading-with-rail absolute top-4 right-4 z-[700] pointer-events-none transition-[right]">
                    <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-[#0d1016]/95">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-700 dark:text-emerald-400" />
                        <span className="text-xs text-slate-600 dark:text-slate-400">Updating...</span>
                    </div>
                </div>
            )}
            {error && (
                <div className="absolute inset-0 z-[5] flex items-center justify-center bg-[var(--map-workspace-bg)] px-6">
                    <div className="max-w-md rounded-2xl border border-slate-200 bg-white px-6 py-6 text-center text-sm leading-6 text-slate-600 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-[#0d1016]/95 dark:text-slate-400">{error}</div>
                </div>
            )}
            {!initialLoad && !loading && !error && mapRecords.length === 0 && (
                <div className="pointer-events-none absolute left-1/2 top-24 z-[700] w-[min(88vw,430px)] -translate-x-1/2">
                    <div className="flex items-center gap-3 border-l-2 border-emerald-700 bg-transparent px-3 py-1.5 text-left [filter:drop-shadow(0_1px_1px_rgba(255,255,255,0.95))] dark:border-emerald-400 dark:[filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.9))]">
                        <MapPin className="h-5 w-5 shrink-0 text-emerald-800 dark:text-emerald-300" />
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-black text-slate-900 dark:text-white">{t('map.empty.title')}</p>
                            <p className="mt-0.5 text-xs leading-4 text-slate-700 dark:text-slate-200">{t('map.empty.subtitle')}</p>
                        </div>
                        <button
                            type="button"
                            onClick={widenRadius}
                            className="pointer-events-auto inline-flex shrink-0 items-center gap-1.5 border-b-2 border-emerald-700 px-1 py-1 text-xs font-black text-emerald-900 transition-colors hover:border-emerald-950 hover:text-emerald-950 dark:border-emerald-400 dark:text-emerald-200 dark:hover:border-emerald-200 dark:hover:text-white"
                        >
                            <LocateFixed className="h-3.5 w-3.5" />
                            {t('map.empty.widenCta')}
                        </button>
                    </div>
                </div>
            )}
            <div className="pointer-events-none flex h-full min-h-0">
                {filterMode === 'simple' ? (
                    <SimpleMapFilters
                        isVisible={isFilterOpen}
                        draftFilters={draftFilters}
                        appliedFilters={committedFilters}
                        onDraftChange={setDraftFilters}
                        onApply={() => void commitAndFetch({ fly: true })}
                        onReset={() => {
                            setDraftFilters({ ...defaultMapFilters, entityType: [...viewerAllowedTypes] });
                            setDraftSearch('');
                            setPlaceSearch('');
                        }}
                        applying={loading}
                        resultCount={resultCount}
                        searchValue={draftSearch}
                        onSearchChange={setDraftSearch}
                        onPlaceSearchChange={setPlaceSearch}
                        allowedEntityTypes={viewerAllowedTypes}
                        viewerMode={hasStaffMapAccess ? 'staff' : 'player'}
                        onOpenAdvanced={() => setFilterMode('advanced')}
                        onClose={() => setIsFilterOpen(false)}
                    />
                ) : (
                    <MapFilterSidebar
                        isVisible={isFilterOpen}
                        draftFilters={draftFilters}
                        appliedFilters={committedFilters}
                        onDraftChange={setDraftFilters}
                        onApply={() => void commitAndFetch({ fly: true })}
                        onResetAll={() => {
                            setDraftFilters({ ...defaultMapFilters, entityType: [...viewerAllowedTypes] });
                            setDraftSearch('');
                            setPlaceSearch('');
                        }}
                        applying={loading}
                        resultCount={resultCount}
                        placeSearch={placeSearch}
                        onPlaceSearchChange={setPlaceSearch}
                        allowedEntityTypes={viewerAllowedTypes}
                        viewerMode={hasStaffMapAccess ? 'staff' : 'player'}
                        onClose={() => setIsFilterOpen(false)}
                        onBackToSimple={() => setFilterMode('simple')}
                    />
                )}

                <VisibleClubsRail
                    isVisible={isClubRailOpen && !hasSelectedResult}
                    clubs={visibleClubs}
                    selectedKey={selectedKey}
                    loading={loading}
                    clubsEnabled={committedFilters.entityType.includes('CLUB')}
                    radiusKm={committedFilters.distanceKm}
                    onSelect={(key) => {
                        const record = allRecordsRef.current.find((entry) => entry.key === key);
                        if (record) selectRecord(record);
                    }}
                    onClose={() => setIsClubRailOpen(false)}
                />

                <div className="map-main-column flex min-w-0 flex-1 flex-col">
                    <div className="flex min-h-0 flex-1">
                        <section className="pointer-events-none relative min-h-0 min-w-0 flex-1">
                            <div
                                className={`pointer-events-none absolute top-4 z-[650] left-4 transition-[left] duration-200 ${
                                    isFilterOpen ? 'xl:left-[calc(var(--map-filter-w,380px)_+_16px)]' : 'xl:left-4'
                                }`}
                            >
                                <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-2 py-1.5 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-[#0d1016]/95">
                                    <button
                                        type="button"
                                        onClick={() => navigate(-1)}
                                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-100"
                                        aria-label="Back"
                                        title="Back"
                                    >
                                        <ArrowLeft className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsFilterOpen((current) => {
                                            const next = !current;
                                            if (next && window.innerWidth < 1440) setIsClubRailOpen(false);
                                            return next;
                                        })}
                                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-100"
                                        aria-label="Toggle filters"
                                    >
                                        <Menu className="h-4 w-4" />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedKey(null);
                                            setIsClubRailOpen((current) => {
                                                const next = !current;
                                                if (next && window.innerWidth < 1440) setIsFilterOpen(false);
                                                return next;
                                            });
                                        }}
                                        className={`inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-full px-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-100 ${isClubRailOpen ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]' : ''}`}
                                        aria-label="Toggle visible clubs"
                                    >
                                        <Building2 className="h-4 w-4" />
                                        <span className="hidden sm:inline text-[11px] font-bold">Browse area</span>
                                    </button>

                                    <div className="relative w-[150px] sm:w-[240px]">
                                        <div className="flex min-h-[34px] items-center gap-2 rounded-full border border-slate-200 bg-white px-3 transition-colors focus-within:border-emerald-700 dark:border-white/10 dark:bg-white/5 dark:focus-within:border-emerald-400">
                                            <Search className="h-3.5 w-3.5 text-slate-400 shrink-0 dark:text-slate-500" />
                                            <input
                                                type="text"
                                                value={draftSearch}
                                                onChange={(event) => setDraftSearch(event.target.value)}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' && suggestions[0]) {
                                                        handleSuggestionPick(suggestions[0]);
                                                    }
                                                }}
                                                placeholder="Search..."
                                                className="w-full border-0 bg-transparent text-xs font-semibold text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                                            />
                                            {draftSearch && (
                                                <button type="button" onClick={() => setDraftSearch('')} className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-slate-200">
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>

                                        {suggestions.length > 0 && (
                                            <div className="absolute inset-x-0 top-[calc(100%+10px)] z-[1200] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#0d1016]/95">
                                                {suggestions.map((suggestion) => (
                                                    <button
                                                        key={suggestion.id}
                                                        type="button"
                                                        onClick={() => handleSuggestionPick(suggestion)}
                                                        className="flex w-full items-center justify-between gap-2.5 border-b border-slate-100 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5"
                                                    >
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{suggestion.label}</p>
                                                            <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{suggestion.meta}</p>
                                                        </div>
                                                        <LocateFixed className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <span className="hidden min-h-[28px] shrink-0 items-center justify-center rounded-full bg-slate-100 px-2.5 text-[11px] font-bold text-slate-600 dark:bg-white/10 dark:text-slate-400 sm:inline-flex">{toolbarCount}</span>

                                    <button
                                        type="button"
                                        onClick={() => void commitAndFetch({ center: viewportCenter })}
                                        className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-emerald-700 hover:text-emerald-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-emerald-400 dark:hover:text-emerald-400"
                                        title="Search this area"
                                    >
                                        <RefreshCw className={`h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400 ${loading ? 'animate-spin' : ''}`} />
                                        <span className="hidden sm:inline">Search this area</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setViewportCenter(DEFAULT_CENTER);
                                            setQueryCenter(DEFAULT_CENTER);
                                            setFocusTarget({ center: DEFAULT_CENTER });
                                            setSelectedKey(null);
                                        }}
                                        className="hidden shrink-0 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:border-white/20 dark:hover:text-slate-100 sm:inline-flex"
                                    >
                                        <Navigation className="h-3.5 w-3.5" />
                                        <span className="hidden sm:inline">Reset view</span>
                                    </button>
                                </div>
                            </div>

                            {hasSelectedResult && (
                                <aside className="pointer-events-auto absolute inset-y-0 right-0 z-[620] hidden w-[400px] overflow-hidden border-l border-slate-200 bg-white dark:border-white/10 dark:bg-[#0d1016] xl:block">
                                    {panelContent}
                                </aside>
                            )}
                        </section>
                    </div>
                </div>
            </div>

            {selectedRecord && hasSelectedResult && (
                <div className="pointer-events-auto fixed inset-x-4 bottom-4 top-auto z-[1200] max-h-[72vh] overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-[#0d1016]/95 xl:hidden">
                    {panelContent}
                </div>
            )}

            {responseModalRecord && (
                <MatchResponseModal
                    record={responseModalRecord}
                    clubName={membership?.clubName ?? null}
                    note={responseNote}
                    error={responseError}
                    submitting={responseSubmitting}
                    onChangeNote={setResponseNote}
                    onClose={() => {
                        setResponseModalRecord(null);
                        setResponseNote('');
                        setResponseError(null);
                    }}
                    onSubmit={submitResponse}
                />
            )}
        </div>
    );
};
