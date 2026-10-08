import { visualColors } from '../../styles/visualColors';
import { JourneyMapLayer } from '../../features/mapPlanning/JourneyMapLayer';
import type { JourneyMapState } from '../../features/mapPlanning/journeyModel';
import { getHeritageStyle } from './heritageStyle';
import { prefersLightMapRendering } from './mapPerformance';
import type { PlanPlace } from '../../features/mapPlanning/api';
import './map-atlas.css';
import './map-motion.css';
import { useAndroidMapState } from '../../android/useAndroidMapState';
import { isAndroidApp } from '../../android/bridge';
import { linkedVenueId } from '../../features/venues/venueMapLink';
import { useVenueMapTarget } from '../../features/venues/useVenueMapTarget';
import { MapCommandBar } from './MapCommandBar';
import { EmbeddedMapFilterDialog } from './EmbeddedMapFilterDialog';
import { MapSearchLayer } from './MapSearchLayer';
import { MapWalkingPanel } from './MapWalkingPanel';
import { MapViewControls } from './MapViewControls';
import { MapFootballMarkers, FOOTBALL_IMAGE } from './MapFootballMarkers';
import { loadWalkingRoute } from './walkingRoutes';
import { mapCameraPadding, mapSelectionTarget, type MapFocusTarget } from './mapCamera';
import { containsPoint, searchRank, coverageBounds, coverageLabel, type SearchCoverage, type MapBounds } from './areaSearch';
import type { Coordinate, WalkingRoute } from './walkingGraph';
import { distanceKm as geographicDistanceKm } from './walkingGraph';
import { MediaImage } from '../ui/MediaImage';
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import MapGL, { Layer, Source, Popup, NavigationControl, useMap, type MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapGeoJSONFeature, MapMouseEvent, StyleSpecification } from 'maplibre-gl';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchOpportunity, searchOpportunities } from '../../features/admissions/api';
import type { Opportunity } from '../../features/admissions/types';
import { matchesOpportunity } from '../../features/admissions/applicant/mapMatching';
import { MapAdmissionControls } from '../../features/admissions/applicant/MapAdmissionControls';
import { admissionMapQuery } from '../../features/admissions/applicant/discoveryQuery';
import { OpportunityCard } from '../../features/admissions/applicant/OpportunityCard';
import { playerPath } from '../../features/parents/playerSelection';
import { useJourneyCopy } from '../../features/squadCommunication/journeyCopy';
import '../../features/admissions/applicant/applicant.css';
import { toast } from 'sonner';
import {
    Building2,
    ClipboardList,
    BookmarkPlus,
    ChevronLeft,
    Clock,
    ExternalLink,
    Footprints,
    Crosshair,
    Loader2,
    LocateFixed,
    MapPin,
    Navigation,
    Search,
    ShieldCheck,
    SlidersHorizontal,
    Users,
    X
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../api/axiosConfig';
import { fetchMapDiscovery, fetchNearbyMap, geocodePlace, type NearbyMapParams, type MapMarkerDto } from '../../api/map';
import { TryoutEntry } from '../../features/recruitment/TryoutEntry';
import { MapHelpHint } from './MapHelpHint';
import { MapModeControl } from './MapModeControl';
import { MapLegend } from './MapLegend';
import { MapFilterSidebar, defaultMapFilters, type MapEntityType, type MapFilters } from './MapFilterSidebar';
import { SimpleMapFilters } from './SimpleMapFilters';
import { MapResultsList } from './MapResultsList';

import {
    LAYER_CLUSTER_COUNT,
    LAYER_CLUSTERS,
    LAYER_POINT_HALO,
    LAYER_POINTS,
    MAP_POINTS_SOURCE_ID,
    MAP_STYLE_DEFAULT,
    buildPointsFeatureCollection
} from './mapLayers';
import { useAuth } from '../../context/AuthContext';
import { fetchMyClubMembershipContext } from '../../features/clubs/api';
import { profileKindLabel, type ClubPresentation } from '../../features/clubs/presentation';
import { isLeadershipRole } from '../../features/clubs/domain';
import { createScheduleChallenge, type ScheduleEventOccurrence } from '../../features/schedule/api';
import { extractApiErrorMessage } from '../../utils/apiError';
import { usePersistedState } from '../../utils/usePersistedState';
import { findIsoCountry } from '../../data/isoCountries';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';

// All projection modes share the warm, unsaturated basemap.

const MAPTILER_API_KEY = import.meta.env.VITE_MAPTILER_API_KEY as string | undefined;
import { setMapPlanning } from '../../context/mapWorkspaceChrome';
import { roleForPlace, locationRoles, type PickTarget } from '../../features/mapPlanning/mapPlanning';
import { recoverPlan } from '../../features/mapPlanning/draftRecovery';
import type { PanelWidths } from '../../features/mapPlanning/PlanningPanels';

const MapPlanWorkspace = lazy(() => import('../../features/mapPlanning/MapPlanWorkspace'));

export type MapMode = 'flat' | 'globe' | 'tilted';

/**
 * Rendering context for the shared map surface. The authenticated route keeps
 * membership-based action controls; public discovery is the same for guests.
 * The landing composition can explicitly narrow its types.
 */
export type MapExperienceContext = 'authenticated' | 'guest';

export interface MapExperienceProps {
    darkMode: boolean;
    context?: MapExperienceContext;
    /** Keep the map and its drawers contained within a parent surface (used on the landing page). */
    embedded?: boolean;
    /** Floating, compact controls for the landing page's edge-to-edge map. */
    compactControls?: boolean;
    /** Position the simple filter surface beside the map, over it, or outside it. */
    filterLayout?: 'side' | 'top' | 'external';
    /** Optional narrower product surface, such as the club-only landing preview. */
    allowedEntityTypes?: MapEntityType[];
    /** World Map stays light independently of the app's appearance preference. */
    mapTheme?: 'light';
    /** Guest maps hide controls that depend on an authenticated account. */
    showAdvancedFilters?: boolean;
    showModeControl?: boolean;
    showBackControl?: boolean;
}

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
    presentation?: ClubPresentation | null;
    bannerUrl?: string | null;
    whatsappNumber?: string | null;
    facebookMessengerUrl?: string | null;
    preferredCommunicationMethod?: string | null;
    trustedByClubs?: Array<{ clubId: number; clubName: string }>;
    honours?: Array<{ id: number; title: string; yearWon: number; description?: string | null }>;
    opportunities?: Array<{ id: number; type: string; title: string; externalLink?: string | null }>;
}

interface DiscoveryRecord {
    opportunity?: Opportunity;
    applicantPlayerId?: number;
    matchingOpportunities?: Opportunity[];
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

interface ExternalMapFilterToolbarProps {
    compact?: boolean;
    draftSearch: string;
    suggestions: SearchSuggestion[];
    toolbarCount: string;
    isFilterOpen: boolean;
    hasActiveFilters: boolean;
    onSearchChange: (value: string) => void;
    onSuggestionPick: (suggestion: SearchSuggestion) => void;
    onToggleFilters: () => void;
}

const ExternalMapFilterToolbar = ({
    compact = false,
    draftSearch,
    suggestions,
    toolbarCount,
    isFilterOpen,
    hasActiveFilters,
    onSearchChange,
    onSuggestionPick,
    onToggleFilters
}: ExternalMapFilterToolbarProps) => {
    const { t } = useTranslation();

    return (
        <section aria-label={t('map.searchAndFilters')} className={`atlas-external-toolbar ${compact ? 'atlas-toolbar-compact' : ''} relative z-[1400] shrink-0 border-b border-[var(--map-panel-border)] bg-[var(--map-panel-bg)] px-4 py-3 sm:px-5`}>
            <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-2.5">
                <div className="relative min-w-0 flex-1 basis-[18rem]">
                    <div className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--map-panel-border)] bg-[var(--map-card-bg)] px-3 transition-colors focus-within:border-[var(--accent-primary)]">
                        <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                        <input
                            type="text"
                            aria-label={t('map.searchLabel')}
                            value={draftSearch}
                            onChange={(event) => onSearchChange(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && suggestions[0]) onSuggestionPick(suggestions[0]);
                            }}
                            placeholder={t('map.searchPlaceholder')}
                            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                        />
                        {draftSearch && (
                            <button type="button" onClick={() => onSearchChange('')} aria-label={t('map.clearSearch')} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--map-card-muted)] hover:text-[var(--text-primary)]">
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    {suggestions.length > 0 && (
                        <div className="absolute inset-x-0 top-[calc(100%+8px)] z-[1500] overflow-hidden rounded-xl border border-[var(--map-panel-border)] bg-[var(--map-panel-bg)] shadow-[var(--map-shadow-strong)]">
                            {suggestions.map((suggestion) => (
                                <button key={suggestion.id} type="button" onClick={() => onSuggestionPick(suggestion)} className="flex w-full items-center justify-between gap-3 border-b border-[var(--map-panel-border)] px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-[var(--map-card-muted)]">
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-bold text-[var(--text-primary)]">{suggestion.label}</span>
                                        <span className="mt-0.5 block truncate text-xs text-[var(--text-secondary)]">{suggestion.meta}</span>
                                    </span>
                                    <LocateFixed className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <button
                    type="button"
                    aria-expanded={isFilterOpen}
                    aria-label={isFilterOpen ? t('map.closeFilters') : t('map.openFilters')}
                    title={isFilterOpen ? t('map.closeFilters') : t('map.openFilters')}
                    aria-controls="landing-map-filter-panel"
                    onClick={onToggleFilters}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] px-4 py-2 text-sm font-bold text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-primary-soft)]"
                >
                    <SlidersHorizontal className="h-4 w-4" />
                    {!compact && (isFilterOpen ? t('map.closeFilters') : t('map.openFilters'))}
                    {!compact && hasActiveFilters && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent-primary)] px-1 text-[10px] text-[color:var(--color-on-accent)]">!</span>}
                </button>

                {!compact && <span className="ml-auto text-xs font-bold text-[var(--text-secondary)]">{toolbarCount}</span>}
            </div>
        </section>
    );
};

const DEFAULT_CENTER: [number, number] = [41.7151, 44.8271]; // Tbilisi — primary launch/demo market
const ALL_MAP_TYPES: MapEntityType[] = ['CLUB', 'STADIUM', 'MATCH', 'TOURNAMENT'];
const CLUB_QUERY_LIMIT = 8;

export interface MapExperienceResolvedOptions {
    context: MapExperienceContext;
    mapDarkMode: boolean;
    showAdvancedFilters: boolean;
    showModeControl: boolean;
    showBackControl: boolean;
}

/**
 * Resolve the safety defaults in one place so a future public map cannot
 * accidentally inherit authenticated chrome or the app's shell theme.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const resolveMapExperienceOptions = ({
    context = 'authenticated',
    showAdvancedFilters,
    showModeControl,
    showBackControl
}: Pick<MapExperienceProps, 'darkMode' | 'context' | 'mapTheme' | 'showAdvancedFilters' | 'showModeControl' | 'showBackControl'>): MapExperienceResolvedOptions => ({
    context,
    mapDarkMode: false,
    showAdvancedFilters: context === 'guest' ? false : showAdvancedFilters ?? true,
    showModeControl: context === 'guest' ? false : showModeControl ?? true,
    showBackControl: context === 'guest' ? false : showBackControl ?? true
});

// eslint-disable-next-line react-refresh/only-export-components
export const resolveMapExperienceEntityTypes = ({
    allowedEntityTypes
}: {
    allowedEntityTypes?: MapEntityType[];
}): MapEntityType[] => allowedEntityTypes === undefined
    ? ALL_MAP_TYPES
    : ALL_MAP_TYPES.filter(type => allowedEntityTypes.includes(type));

// Initial load applies only the Club type; MATCH/TOURNAMENT are opt-in via the
// filter chips. Reset still restores every viewer-allowed type.
const initialMapFilters: MapFilters = { ...defaultMapFilters, entityType: ['CLUB', 'STADIUM'] };

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
        marker.eventSubtype === 'MATCH' || marker.eventSubtype === 'COMPETITIVE' ? 'COMPETITIVE' as const : null;
    const challengeState = marker.status === 'OPEN' ? 'OPEN' as const :
        marker.status === 'PENDING' ? 'PENDING' as const : marker.status === 'CONFIRMED' ? 'CONFIRMED' as const : null;
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
        case 'STADIUM': return 'Stadium';
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


function MapFocusController({ target, onSettled }: { target: MapFocusTarget | null; onSettled: () => void }) {
    const { current: map } = useMap();

    useEffect(() => {
        if (!target || !map) return;
        // Selecting a result can open a dock and change the map's available width.
        map.resize();
        const canvas = map.getContainer();
        const sheet = window.innerWidth < 1100 ? canvas.closest('.map-atlas')?.querySelector<HTMLElement>('.atlas-detail-dock')?.clientHeight ?? 0 : 0;
        const padding = mapCameraPadding(canvas.clientWidth, canvas.clientHeight, sheet);
        const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500;
        if (target.bounds) {
            // Keep the pins and start label clear of the toolbar and actual sheet.
            // Scale the margins down only when the visible map is very short.
            const visibleHeight = canvas.clientHeight - sheet;
            map.fitBounds(target.bounds, { padding: { ...padding,
                top: Math.min(88, visibleHeight * .55), bottom: sheet + Math.min(48, visibleHeight * .3) },
                maxZoom: target.zoom, duration });
        } else {
            map.flyTo({ center: [target.center[1], target.center[0]], zoom: target.zoom,
                offset: [0, (padding.top - padding.bottom) / 2], duration });
        }
        onSettled();
    }, [map, onSettled, target]);

    return null;
}

function MapSizeGuard({ layoutSignature }: { layoutSignature: string }) {
    const { current: map } = useMap();

    useLayoutEffect(() => {
        if (!map) return;
        let frame = 0;
        let lastSize = '';
        const invalidate = () => {
            cancelAnimationFrame(frame);
            frame = window.requestAnimationFrame(() => {
                const container = map.getContainer();
                const size = `${container.clientWidth}:${container.clientHeight}`;
                if (size === lastSize || !container.clientWidth || !container.clientHeight) return;
                lastSize = size;
                // Resizing the drawing buffer clears it. Paint in the same frame,
                // as MapLibre's own resize observer does, so a CSS transition
                // cannot repeatedly clear the map before its scheduled repaint.
                map.resize();
                map.getMap().redraw();
            });
        };

        invalidate();
        const container = map.getContainer();
        const resizeObserver = new ResizeObserver(() => invalidate());
        resizeObserver.observe(container);

        window.addEventListener('resize', invalidate);
        return () => {
            cancelAnimationFrame(frame);
            resizeObserver.disconnect();
            window.removeEventListener('resize', invalidate);
        };
    }, [layoutSignature, map]);

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
            const layers = ['selected-point-pin', LAYER_POINTS, LAYER_CLUSTERS].filter(id => map.getLayer(id));
            if (!layers.length) return;
            const features = map.queryRenderedFeatures(event.point, { layers });
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
    <div className="theme-overlay-strong dark:bg-[color:var(--color-overlay)]/60 fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="map-modal-shell w-full max-w-2xl overflow-hidden">
            <div className="map-panel-header">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div>
                            <p className="map-eyebrow">Match response</p>
                            <h2 className="mt-2 text-xl font-bold text-[color:var(--color-text)] dark:text-[color:var(--color-text)]">Respond to match need</h2>
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
                    <p className="mt-3 text-lg font-bold text-[color:var(--color-text)] dark:text-[color:var(--color-text)]">{record.title}</p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">
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
                    <div className="flex items-center justify-between text-xs text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">
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
            className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-[color:var(--color-elevated)]/70 dark:hover:bg-[var(--color-surface)]/50 transition-colors"
        >
            <span className="text-sm font-semibold text-[color:var(--color-text)] dark:text-[color:var(--color-text)]">{title}</span>
            <ChevronLeft className={`h-4 w-4 text-muted transition-transform duration-200 ${expanded ? '-rotate-90' : 'rotate-90'}`} />
        </button>
        {expanded && <div className="px-5 pb-4 space-y-3 border-t border-[var(--map-panel-border)] pt-3 mx-5">{children}</div>}
    </div>
);

// ── Main detail panel ────────────────────────────────────────────────

export const DiscoveryDetailPanel = ({
    record,
    clubProfile,
    canRespond,
    onRespond,
    onOpenClub,
    onWalk,
    onClose
}: {
    record: DiscoveryRecord;
    clubProfile: ClubProfileSummary | null;
    canRespond: boolean;
    onRespond: () => void;
    onOpenClub: () => void;
    onWalk: () => void;
    onClose: () => void;
}) => {
    const [detailsOpen, setDetailsOpen] = useState(false);
    const directionsUrl = buildGoogleMapsDirectionsUrl(record.latitude, record.longitude);
    const bannerUrl = resolveMediaUrl(record.entityType === 'STADIUM' ? record.rawMapMarker?.logoUrl : clubProfile?.bannerUrl);
    const logoUrl = resolveMediaUrl(record.entityType === 'STADIUM' ? record.rawMapMarker?.logoUrl : clubProfile?.logoUrl);

    const contactUrl = buildWhatsAppUrl(clubProfile?.whatsappNumber)
        || clubProfile?.facebookMessengerUrl
        || clubProfile?.opportunities?.find(o => o.externalLink)?.externalLink
        || undefined;

    const contactLabel = clubProfile?.whatsappNumber ? 'WhatsApp'
        : clubProfile?.facebookMessengerUrl ? 'Messenger'
        : contactUrl ? 'Website'
        : undefined;

    const handleShare = () => {
        const sharedUrl = new URL(window.location.href); sharedUrl.searchParams.delete("player");
        navigator.share?.({ title: record.title, url: sharedUrl.toString() })
            .catch(() => { /* user cancelled */ });
    };

    const addressLine = record.locationName
        || clubProfile?.addressText
        || [clubProfile?.cityName, clubProfile?.countryName].filter(Boolean).join(', ')
        || undefined;

    const typeSubtitle = record.entityType === 'CLUB'
        ? (clubProfile?.presentation ? profileKindLabel[clubProfile.presentation.profileKind] : clubProfile?.type || 'Club')
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
    <div className="map-details-panel flex h-full min-h-0 flex-col" style={{ backgroundColor: 'var(--map-panel-bg)' }}>
        <div className="atlas-detail-topbar atlas-panel-topline"><span className="atlas-eyebrow"><Building2 size={14} /> {record.entityType === 'STADIUM' ? 'VENUE DETAILS' : record.entityType === 'CLUB' ? 'CLUB DETAILS' : 'DETAILS'}</span><button type="button" onClick={onClose} aria-label="Close details"><X size={18} /></button></div>
        <div className="atlas-detail-scroll min-h-0 flex-1 overflow-y-auto">
        <header className="atlas-detail-header">
            {bannerUrl && <MediaImage src={bannerUrl} alt="" className="atlas-detail-banner" />}
            <div className="atlas-detail-identity">
                <span className="atlas-detail-logo">{logoUrl ? <MediaImage src={logoUrl} alt="" /> : <Building2 size={28} />}</span>
                <span className="atlas-eyebrow">{typeSubtitle.replaceAll('_', ' ')}</span>
            </div>
            <h2>{record.title}<span>.</span></h2>
            {record.rawMapMarker?.fee && <p className="atlas-training-price">{record.rawMapMarker.fee}</p>}
            {record.clubName && record.entityType !== 'CLUB' && <p>{record.clubName}</p>}
            <div className="atlas-detail-badges">
                {(clubProfile?.isOfficial ?? record.official) && <span className="map-pill map-pill--accent"><ShieldCheck size={12} />Verified</span>}
                {joinPolicyLabel && <span className="map-pill">{joinPolicyLabel}</span>}
                {tryoutPosition && <span className="map-pill">{tryoutPosition}</span>}
                {record.entityType === 'TRYOUT' && record.ageGroups.map(age => <span key={age} className="map-pill">{age}</span>)}
            </div>
        </header>

        {/* ── Info rows ───────────────────────────── */}
        <div>
            {/* Quick stats strip */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-[13px] text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">
                {(clubProfile?.memberCount != null || clubProfile?.followerCount != null) && (
                    <>
                        <Users className="h-3.5 w-3.5 text-muted" />
                        <span className="font-semibold text-[color:var(--color-text)] dark:text-[color:var(--color-text)]">{clubProfile?.memberCount ?? record.memberCount}</span>
                        <span>members</span>
                        <span className="text-muted">·</span>
                        <span className="font-semibold text-[color:var(--color-text)] dark:text-[color:var(--color-text)]">{clubProfile?.followerCount ?? record.followerCount}</span>
                        <span>followers</span>
                    </>
                )}
                {(clubProfile?.isOfficial ?? record.official) && (
                    <>
                        <span className="text-muted">·</span>
                        <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--color-accent)] dark:text-[color:var(--color-accent)]" />
                        <span>Official</span>
                    </>
                )}
            </div>

            {addressLine && (
                <div className="flex items-start gap-3 px-5 py-2.5 border-t border-[var(--map-panel-border)]">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                    <p className="text-[14px] leading-5 text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">{addressLine}</p>
                </div>
            )}

            {record.startsAt && (
                <div className={`flex items-center gap-3 px-5 py-2 ${!addressLine ? 'border-t border-[var(--map-panel-border)]' : ''}`}>
                    <Clock className="h-4 w-4 shrink-0 text-muted" />
                    <p className="text-[14px] text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">
                        {formatDateTime(record.startsAt)}
                        {record.endsAt && <span className="text-muted"> — {formatDateTime(record.endsAt)}</span>}
                    </p>
                </div>
            )}

            {record.distanceKm != null && (
                <div className={`flex items-center gap-3 px-5 py-2 ${!addressLine && !record.startsAt ? 'border-t border-[var(--map-panel-border)]' : ''}`}>
                    <Navigation className="h-4 w-4 shrink-0 text-muted" />
                    <p className="text-[14px] text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">
                        {record.distanceKm < 1
                            ? `${Math.round(record.distanceKm * 1000)} m away`
                            : `${record.distanceKm.toFixed(1)} km away`}
                    </p>
                </div>
            )}

            {/* ── Description — always visible ──────── */}
            {description && (
                <div className="px-5 pt-3 mt-1 border-t border-[var(--map-panel-border)]">
                    <p className="text-[14px] leading-6 text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)] line-clamp-3">
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

        <div className="atlas-detail-secondary">
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
                                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--map-panel-border)] px-4 py-1.5 text-[13px] font-medium text-[color:var(--color-muted)] transition-colors hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] dark:text-[color:var(--color-muted)] dark:hover:border-[color:var(--color-accent)] dark:hover:text-[color:var(--color-accent)]"
                            >
                                {action.icon}
                                {action.label}
                            </a>
                        ) : (
                            <button
                                key={action.label}
                                type="button"
                                onClick={action.onClick}
                                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--map-panel-border)] px-4 py-1.5 text-[13px] font-medium text-[color:var(--color-muted)] transition-colors hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] dark:text-[color:var(--color-muted)] dark:hover:border-[color:var(--color-accent)] dark:hover:text-[color:var(--color-accent)]"
                            >
                                {action.icon}
                                {action.label}
                            </button>
                        )
                    )}
                </div>
            )}
        </div>
        </div>
        {/* Primary actions stay reachable even when the banner and details need scrolling. */}
        <div className="atlas-detail-footer shrink-0 border-t border-[var(--map-panel-border)] px-4 py-3.5">
            <div className="atlas-detail-primary-actions">
            {/* Primary button */}
            <button
                type="button"
                onClick={onOpenClub}
                className="atlas-detail-open"
            >
                <Building2 className="h-4 w-4" />
                {record.entityType === 'STADIUM' ? 'View availability' : 'Open club'}
            </button>
            {record.latitude != null && record.longitude != null && <button type="button" onClick={onWalk} className="atlas-detail-walk"><Footprints size={17} />Walk here</button>}
            </div>

            {record.entityType === 'MATCH' && canRespond && (
                <button
                    type="button"
                    onClick={onRespond}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--color-accent)] py-2.5 text-[14px] font-bold text-[color:var(--color-on-accent)] transition-opacity hover:opacity-90"
                >
                    Respond
                </button>
            )}

            {record.entityType === 'TRYOUT' && record.rawMapMarker?.entityId && <TryoutEntry key={record.rawMapMarker.entityId} tryoutId={record.rawMapMarker.entityId} />}

        </div>
    </div>
    );
};

export const MapExperience = ({
    darkMode,
    context = 'authenticated',
    embedded = false,
    compactControls = false,
    filterLayout = 'side',
    allowedEntityTypes,
    mapTheme = 'light',
    showAdvancedFilters,
    showModeControl,
    showBackControl
}: MapExperienceProps) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { status, user, sessionId } = useAuth();
    const admissionCopy = useJourneyCopy();
    const [admissionPlayer, setAdmissionPlayer] = useState<{id:number;year:number}|null>(null);
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [targetOpportunity, setTargetOpportunity] = useState<Opportunity|null>(null);
    const { t } = useTranslation();
    const experienceOptions = resolveMapExperienceOptions({
        darkMode,
        context,
        mapTheme,
        showAdvancedFilters,
        showModeControl,
        showBackControl
    });
    const {
        mapDarkMode,
        showAdvancedFilters: canUseAdvancedFilters,
        showModeControl: canUseModeControl,
        showBackControl: canUseBackControl
    } = experienceOptions;
    // Draft vs committed split (MAP_SEARCH_AND_CLUB_JOBS_PLAN.md item 4): every
    // control writes to the draft only; a single Apply commits the draft and
    // triggers exactly one fetch. Typing in the toolbar is equally draft-only.
    const [committedFilters, setCommittedFilters] = useAndroidMapState<MapFilters>('filters', initialMapFilters);
    const [draftFilters, setDraftFilters] = useAndroidMapState<MapFilters>('draftFilters', initialMapFilters);
    const [draftSearch, setDraftSearch] = useAndroidMapState('draftSearch', '');
    const [committedSearch, setCommittedSearch] = useAndroidMapState('search', '');
    const [placeSearch, setPlaceSearch] = useState('');
    const [filterMode, setFilterMode] = useState<'simple' | 'advanced'>('simple');
    const venueTargetId = context === 'authenticated' && !embedded ? linkedVenueId(location.search) : null;
    const planningOpen = context === 'authenticated' && !embedded && new URLSearchParams(location.search).has('plans');
    const [planPlaces, setPlanPlaces] = useState<PlanPlace[]>([]);
    const [planStops,setPlanStops]=useState<PlanPlace[]>([]);
    const [journeyMap,setJourneyMap]=useState<JourneyMapState|null>(null);
    const [hoveredPlace,setHoveredPlace]=useState<{key:string;name:string;detail:string;latitude:number;longitude:number}|null>(null);
    const hoverKey=useRef<string|null>(null);
    const [planWidths,setPlanWidths]=useState<PanelWidths>({left:390,right:280});
    const [planPickMode,setPlanPickMode]=useState<PickTarget|null>(null),[planPreview,setPlanPreview]=useState<PlanPlace|null>(null);
    const planMapClick=useRef<((place:PlanPlace)=>void)|null>(null);
    const registerPlanMapClick=useCallback((handler:((place:PlanPlace)=>void)|null)=>{planMapClick.current=handler;},[]);
    const planLayout=useCallback((widths:PanelWidths)=>setPlanWidths(widths),[]);
    useEffect(()=>{setMapPlanning(planningOpen);return()=>setMapPlanning(false);},[planningOpen]);
    const [planCandidate, setPlanCandidate] = useState<PlanPlace | null>(null);
    const consumePlanCandidate = useCallback(() => setPlanCandidate(null), []);
    const lightRendering = prefersLightMapRendering();
    const planGeometry = useMemo(() => ({type:'FeatureCollection' as const, features:planPlaces.map((p,i)=>({type:'Feature' as const,properties:{key:p.key,name:p.name,role:roleForPlace(p.key)||'place',number:roleForPlace(p.key)?locationRoles[roleForPlace(p.key)!].marker:String(i+1)},geometry:{type:'Point' as const,coordinates:[p.longitude,p.latitude]}}))}),[planPlaces]);
    const openPlanning = () => { const p=new URLSearchParams(location.search),saved=recoverPlan();p.set('plans','staff');if(saved){p.set('club',String(saved.clubId));p.set('squad',String(saved.squadId));if(saved.planId)p.set('plan',String(saved.planId));else p.set('draft',saved.requestId);}navigate({pathname:location.pathname,search:p.toString()});setIsFilterOpen(false);setIsClubRailOpen(false);setShowDetails(false);setSelectedKey(null); };
    const focusPlanPlace = useCallback((place:PlanPlace) => { mapRef.current?.flyTo({center:[place.longitude,place.latitude],zoom:13,padding:{left:30,right:30,top:70,bottom:90},duration:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?0:700}); },[]);
    const isExternalFilterLayout = filterLayout === 'external';
    const [isFilterOpen, setIsFilterOpen] = useState(() => !isExternalFilterLayout && (filterLayout === 'top' || window.innerWidth >= 1100));
    const [isClubRailOpen, setIsClubRailOpen] = useAndroidMapState('resultsOpen', false);
    const [showDetails, setShowDetails] = useAndroidMapState('detailsOpen', false);

    useEffect(() => {
        if (filterLayout === 'top' || filterLayout === 'external') {
            return;
        }
        let wasWide = window.innerWidth >= 1100;
        const handleResize = () => {
            const isWide = window.innerWidth >= 1100;
            if (isWide === wasWide) return;
            wasWide = isWide;
            setIsFilterOpen(isWide);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [filterLayout]);
    // Search coverage is separate from the start used for distances and walks.
    const [areaBounds, setAreaBounds] = useAndroidMapState<MapBounds | null>('area', { west: 44.6, south: 41.55, east: 45.05, north: 41.87 });
    const [draftCoverage, setDraftCoverage] = useAndroidMapState<SearchCoverage>('draftCoverage', 'area');
    const [committedCoverage, setCommittedCoverage] = useAndroidMapState<SearchCoverage>('coverage', 'area');
    const [savedCamera, setSavedCamera] = useAndroidMapState('camera', { latitude: DEFAULT_CENTER[0], longitude: DEFAULT_CENTER[1], zoom: 11 });
    const [locating, setLocating] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);
    const locationRequest = useRef(0);
    const commitRequest = useRef(0);
    const [resolvingPlace, setResolvingPlace] = useState(false);
    useEffect(() => () => { locationRequest.current++; commitRequest.current++; }, []);
    const [areaMoved, setAreaMoved] = useState(false);
    const [searchSequence, setSearchSequence] = useState(0);
    const [searchOrigin, setSearchOrigin] = useAndroidMapState<Coordinate>('origin', [DEFAULT_CENTER[1], DEFAULT_CENTER[0]]);
    const [walkingTarget, setWalkingTarget] = useState<DiscoveryRecord | null>(null);
    const [walkingOrigin, setWalkingOrigin] = useState<Coordinate | null>(null);
    const [walkingRoute, setWalkingRoute] = useState<WalkingRoute | null>(null);
    const [walkingLoading, setWalkingLoading] = useState(false);
    const [walkingError, setWalkingError] = useState<string | null>(null);
    const [pickingOrigin, setPickingOrigin] = useState(false);
    const walkingRequest = useRef<AbortController | null>(null);
    useEffect(() => () => walkingRequest.current?.abort(), []);
    const [queryCenter, setQueryCenter] = useAndroidMapState<[number, number]>('center', DEFAULT_CENTER);
    useEffect(() => {
        let active = true;
        const request = locationRequest.current;
        if (!venueTargetId && !isAndroidApp && navigator.permissions && navigator.geolocation) void navigator.permissions.query({ name: 'geolocation' }).then(permission => {
            if (!active || permission.state !== 'granted' || request !== locationRequest.current) return;
            navigator.geolocation.getCurrentPosition(position => {
                if (!active || request !== locationRequest.current) return;
                setWalkingOrigin([position.coords.longitude, position.coords.latitude]);
                setSearchOrigin([position.coords.longitude, position.coords.latitude]);
                setQueryCenter([position.coords.latitude, position.coords.longitude]);
                setAreaBounds(null); setDraftCoverage('radius'); setCommittedCoverage('radius');
                setFocusTarget({ center: [position.coords.latitude, position.coords.longitude], zoom: 12 });
            }, () => { /* The explicit location button offers retry and a map fallback. */ }, { maximumAge: 60000, timeout: 10000 });
        }).catch(() => undefined);
        return () => { active = false; };
    }, [venueTargetId, setAreaBounds, setCommittedCoverage, setDraftCoverage, setQueryCenter, setSearchOrigin]);
    const [focusTarget, setFocusTarget] = useState<MapFocusTarget | null>(null);
    const [loading, setLoading] = useState(true);
    const [initialLoad, setInitialLoad] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mapUnavailable, setMapUnavailable] = useState(false);
    const [mapAttempt, setMapAttempt] = useState(0);
    const [reload, setReload] = useState(0);
    const [nextClubPage, setNextClubPage] = useState<number | undefined>();
    const [nextAdmissionPage, setNextAdmissionPage] = useState<number | undefined>();
    const [loadingMore, setLoadingMore] = useState(false);
    const clubSearchParams = useRef<NearbyMapParams | null>(null);
    const moreRequest = useRef<AbortController | null>(null);
    useEffect(() => () => moreRequest.current?.abort(), []);
    const [resultsLimited, setResultsLimited] = useState(false);
    const [mapMarkers, setMapMarkers] = useState<MapMarkerDto[]>([]);
    const [membership, setMembership] = useState<{ clubId?: number | null; clubName?: string | null; myRole?: string | null } | null>(null);
    const [mapMode, setMapMode] = usePersistedState<MapMode>('map.mapMode', 'flat');
    const effectiveMapMode: MapMode = context === 'guest' ? 'flat' : mapMode;
    // FLAT/GLOBE render the recolored positron OBJECT; while it loads (or if the
    // fetch/transform fails) this stays null and we pass the plain URL instead.
    const [heritageStyle, setHeritageStyle] = useState<StyleSpecification | null>(null);
    useEffect(() => {
        let active = true;
        getHeritageStyle(mapDarkMode ? 'dark' : 'light')
            .then((style) => {
                if (active) setHeritageStyle(style);
            })
            .catch((styleError: unknown) => {
                console.warn('Map style unavailable — falling back to plain positron URL', styleError);
            });
        return () => {
            active = false;
        };
    }, [effectiveMapMode, mapDarkMode]);

    const [modeWarningDismissed, setModeWarningDismissed] = usePersistedState<boolean>('map.modeWarningDismissed', false);
    const [pendingMode, setPendingMode] = useState<MapMode | null>(null);
    // Map instance for viewport queries and route fitting.
    const mapRef = useRef<MapRef | null>(null);

    // Membership affects actions and optional shortcuts, never public discovery.
    const hasStaffMapAccess = context === 'authenticated' && isLeadershipRole(membership?.myRole);
    const mapViewerMode: 'guest' | 'player' | 'staff' = context === 'guest'
        ? 'guest' : hasStaffMapAccess ? 'staff' : 'player';
    // Guest maps never need to wait for or react to session bootstrap. Keeping
    // this scope stable prevents a second public fetch when AuthProvider moves
    // from bootstrapping to anonymous.
    const mapAuthScope = context === 'guest' ? 'guest' : status;
    const viewerAllowedTypes = useMemo(() => resolveMapExperienceEntityTypes({ allowedEntityTypes }), [allowedEntityTypes]);

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
    const [selectedKey, setSelectedKey] = useAndroidMapState<string | null>('selected', null);
    useEffect(() => { setAdmissionPlayer(null);const clearYear=(f:MapFilters)=>f.clubs.birthYear==null?f:{...f,clubs:{...f.clubs,birthYear:undefined}};setDraftFilters(clearYear);setCommittedFilters(clearYear); }, [user?.id, sessionId]);
    const opportunityTargetId = Number(new URLSearchParams(location.search).get('opportunity')) || 0;
    const linkedPlayer = Number(new URLSearchParams(location.search).get('player'));
    const requestedAdmissionPlayerId = Number.isSafeInteger(linkedPlayer) && linkedPlayer > 0 ? linkedPlayer : undefined;
    const selectAdmissionPlayer = (id:number|undefined, year:number|undefined, gender?:'MALE'|'FEMALE'|null, minor?:boolean) => {
        setAdmissionPlayer(id&&year?{id,year}:null);
        const genders: MapFilters['clubs']['genders'] = gender==='MALE'?[minor?'Boys':'Men']:gender==='FEMALE'?[minor?'Girls':'Women']:[];
        changeDraftFilters({...draftFilters,clubs:{...draftFilters.clubs,birthYear:year,ageGroups:[],genders}});
        // A linked actual venue already represents the selected opportunity; keep its card context on arrival.
        if(opportunityTargetId)setCommittedFilters(f=>({...f,clubs:{...f.clubs,birthYear:year,ageGroups:[],genders}}));
        const query=new URLSearchParams(location.search);
        if(id)query.set('player',String(id));else query.delete('player');
        if(query.toString()!==new URLSearchParams(location.search).toString())navigate({pathname:location.pathname,search:query.toString()},{replace:true});
    };
    useEffect(() => {
        if (!opportunityTargetId) { setTargetOpportunity(null); return; }
        const controller = new AbortController();
        void fetchOpportunity(opportunityTargetId, controller.signal).then(o => {
            if(controller.signal.aborted) return;
            setTargetOpportunity(o);setSelectedKey(`opportunity:${o.id}`);setShowDetails(true);
            if(o.location.latitude!=null&&o.location.longitude!=null) {
                setQueryCenter([o.location.latitude,o.location.longitude]);
                setFocusTarget({center:[o.location.latitude,o.location.longitude],zoom:14});
            }
        }).catch(e=>{if(!controller.signal.aborted) toast.error(extractApiErrorMessage(e,admissionCopy('This group could not be loaded.','ჯგუფი ვერ ჩაიტვირთა.')));});
        return ()=>controller.abort();
    }, [opportunityTargetId]);
    const openLinkedVenue = useCallback((marker: MapMarkerDto) => {
        locationRequest.current++;
        setQueryCenter([marker.latitude, marker.longitude]);
        setAreaBounds(null);
        setDraftCoverage('radius'); setCommittedCoverage('radius');
        setCommittedSearch(''); setDraftSearch('');
        setSelectedKey(`stadium:${marker.entityId}`); setShowDetails(true); setIsClubRailOpen(false);
        setFocusTarget({ center: [marker.latitude, marker.longitude], zoom: 14 });
        if (window.innerWidth < 1100) setIsFilterOpen(false);
    }, [setQueryCenter, setAreaBounds, setDraftCoverage, setCommittedCoverage, setCommittedSearch, setDraftSearch, setSelectedKey, setShowDetails, setIsClubRailOpen]);
    const venueTarget = useVenueMapTarget(venueTargetId, openLinkedVenue);
    const [clubProfiles, setClubProfiles] = useState<Record<number, ClubProfileSummary>>({});
    const [responseModalRecord, setResponseModalRecord] = useState<DiscoveryRecord | null>(null);
    const [responseNote, setResponseNote] = useState('');
    const [responseError, setResponseError] = useState<string | null>(null);
    const [responseSubmitting, setResponseSubmitting] = useState(false);

    useEffect(() => {
        let active = true;
        const controller = new AbortController();

        const load = async () => {
            setLoading(true);
            moreRequest.current?.abort(); setLoadingMore(false); setNextClubPage(undefined); setNextAdmissionPage(undefined);
            setError(null);

            try {
                const membershipPromise =
                    context === 'authenticated' && mapAuthScope === 'authenticated'
                        ? fetchMyClubMembershipContext().catch(() => null)
                        : Promise.resolve(null);

                // Keep each type's filters separate: club criteria must not narrow fixtures.
                const mapPromise = Promise.all(committedFilters.entityType.map(type => {
                    const section = type === 'MATCH' ? committedFilters.matches
                        : type === 'TRYOUT' ? committedFilters.tryouts : committedFilters.clubs;
                    const dateWindow = 'dateWindow' in section ? section.dateWindow : 'ANY';
                    const now = new Date();
                    const days = dateWindow === 'NEXT_7_DAYS' ? 7 : dateWindow === 'NEXT_30_DAYS' ? 30 : 90;
                    const gender = (type === 'TOURNAMENT' || type === 'STADIUM') ? [] : section.genders.map(value => {
                        switch (value) {
                            case 'Boys': case 'Men': return 'MALE';
                            case 'Girls': case 'Women': return 'FEMALE';
                            case 'Mixed': return 'MIXED';
                        }
                    });
                    const params: NearbyMapParams = {
                        lat: queryCenter[0], lng: queryCenter[1], radius: committedFilters.distanceKm,
                        bounds: coverageBounds(committedCoverage, areaBounds),
                        type: [type], query: committedSearch || undefined,
                        cities: section.city ? [section.city] : undefined,
                        countries: section.country ? [section.country] : undefined,
                        gender: gender.length ? gender : undefined,
                        ageGroups: type !== 'TOURNAMENT' && type !== 'STADIUM' && section.ageGroups.length ? section.ageGroups : undefined,
                        level: type !== 'TOURNAMENT' && type !== 'STADIUM' && 'levels' in section && section.levels.length ? section.levels : undefined,
                        trainingMinPrice: type === 'CLUB' && committedFilters.clubs.trainingMinPrice ? Number(committedFilters.clubs.trainingMinPrice) : undefined,
                        trainingMaxPrice: type === 'CLUB' && committedFilters.clubs.trainingMaxPrice ? Number(committedFilters.clubs.trainingMaxPrice) : undefined,
                        trainingCurrency: type === 'CLUB' ? committedFilters.clubs.trainingCurrency || 'GEL' : undefined,
                        trainingPeriod: type === 'CLUB' ? committedFilters.clubs.trainingPeriod || 'MONTH' : undefined,
                        category: type === 'CLUB' ? committedFilters.clubs.categories : undefined,
                        positions: type === 'CLUB' || type === 'TRYOUT' ? committedFilters.positions : undefined,
                        dateFrom: dateWindow !== 'ANY' ? toIsoWindow(now) : undefined,
                        dateTo: dateWindow !== 'ANY' ? toIsoWindow(new Date(now.getTime() + days * 86400000)) : undefined
                    };
                    if (type === 'CLUB') clubSearchParams.current = params;
                    return fetchMapDiscovery(params, controller.signal);
                })).then(pages => ({
                    content: pages.flatMap(page => page.content),
                    resultsLimited: pages.some(page => page.resultsLimited),
                    nextPage: pages.find(page => page.nextPage != null)?.nextPage
                }));

                const [membershipContext, mapData, admissionPage] = await Promise.all([
                    membershipPromise,
                    mapPromise,
                    committedFilters.entityType.includes('CLUB') ? searchOpportunities(admissionMapQuery(committedFilters,queryCenter,areaBounds,committedCoverage,committedSearch),controller.signal) : Promise.resolve({items:[],hasMore:false})
                ]);

                if (!active) return;

                setMapMarkers(mapData.content);
                setOpportunities(admissionPage.items);
                setNextAdmissionPage(admissionPage.hasMore ? 1 : undefined);
                setNextClubPage(mapData.nextPage);
                setResultsLimited((mapData.resultsLimited ?? false) || admissionPage.hasMore);
                setMembership(membershipContext);
                setInitialLoad(false);
            } catch (requestError) {
                if (!active) return;
                console.error('Failed to load map discovery data', requestError);
                setError('Unable to load map discovery data.');
            } finally {
                if (active) { setLoading(false); setInitialLoad(false); }
            }
        };

        void load();
        return () => {
            active = false;
            controller.abort();
        };
    }, [context, mapAuthScope, committedFilters, committedSearch, queryCenter, areaBounds, committedCoverage, reload]);

    const loadMoreClubs = async () => {
        if ((nextClubPage == null && nextAdmissionPage == null) || loadingMore) return;
        moreRequest.current?.abort(); const controller = new AbortController(); moreRequest.current = controller;
        setLoadingMore(true);
        try {
            const [page,groups] = await Promise.all([
                nextClubPage!=null&&clubSearchParams.current ? fetchNearbyMap({ ...clubSearchParams.current, page: nextClubPage, size: 100 }, controller.signal) : Promise.resolve(null),
                nextAdmissionPage!=null ? searchOpportunities(admissionMapQuery(committedFilters,queryCenter,areaBounds,committedCoverage,committedSearch,nextAdmissionPage),controller.signal) : Promise.resolve(null)
            ]);
            if (controller.signal.aborted) return;
            const hasNext=Boolean(page&&nextClubPage!=null&&(nextClubPage+1)*100<page.totalElements);
            if(page)setMapMarkers(current => [...new Map([...current, ...page.content].map(marker => [marker.entityType + ':' + marker.entityId, marker])).values()]);
            if(groups)setOpportunities(current=>[...new Map([...current,...groups.items].map(o=>[o.id,o])).values()]);
            setNextClubPage(hasNext&&nextClubPage!=null ? nextClubPage+1 : undefined);
            setNextAdmissionPage(groups?.hasMore&&nextAdmissionPage!=null ? nextAdmissionPage+1 : undefined);
            setResultsLimited(hasNext||Boolean(groups?.hasMore));
        } catch (error) { if (!controller.signal.aborted) toast.error(extractApiErrorMessage(error, 'Could not load more clubs. Try again.')); }
        finally { if (!controller.signal.aborted) setLoadingMore(false); }
    };

    const allRecords = useMemo(
        // Treat the allowlist as a client-side defence in depth as well as a
        // request constraint. Public map mode must not paint a protected marker
        // if a stale/cache response ever contains an unexpected entity type.
        () => {
            const records = [...new Map([...mapMarkers, ...(venueTarget.marker ? [venueTarget.marker] : [])]
            .map(marker => [`${marker.entityType}:${marker.entityId}`, marker] as const)).values()]
            .map(buildMapMarkerRecord)
            .map(record => record.key === `stadium:${venueTargetId}` ? { ...record, distanceKm: null } : record)
            .filter((record) => viewerAllowedTypes.includes(record.entityType));
            if (!viewerAllowedTypes.includes('CLUB')) return records;
            const groupRecords: DiscoveryRecord[] = [...new Map([...opportunities,...(targetOpportunity?[targetOpportunity]:[])].map(o=>[o.id,o])).values()].map(o=>{
                const club=records.find(r=>r.entityType==='CLUB'&&r.clubId===o.clubId);
                return {key:`opportunity:${o.id}`,entityType:'CLUB' as const,source:'CLUB' as const,title:`${o.organizationName} · ${o.name}`,subtitle:o.name,description:o.schedule,clubId:o.clubId,clubName:o.organizationName,startsAt:null,endsAt:null,locationName:`${o.location.name} · ${o.location.address}`,latitude:o.location.latitude,longitude:o.location.longitude,official:committedFilters.clubs.officialOnly||club?.official||false,followerCount:0,memberCount:0,distanceKm:o.location.latitude!=null&&o.location.longitude!=null?geographicDistanceKm([queryCenter[1],queryCenter[0]],[o.location.longitude,o.location.latitude]):null,typeLabel:club?.typeLabel||null,statusLabel:o.availability,matchSubtype:null,challengeState:null,locationState:o.location.latitude!=null?'PINNED' as const:'OPEN_VENUE' as const,ageGroups:[],genders:[],level:null,travelPreference:null,city:null,country:null,searchText:`${o.organizationName} ${o.name} ${o.location.name} ${o.location.address}`.toLowerCase(),joinPolicy:null,opportunity:o,applicantPlayerId:admissionPlayer?.year===committedFilters.clubs.birthYear?admissionPlayer?.id:undefined};
            });
            return [...records.map(r=>r.entityType==='CLUB'?{...r,matchingOpportunities:opportunities.filter(o=>o.clubId===r.clubId&&matchesOpportunity(o,committedFilters))}:r),...groupRecords];
        },
        [mapMarkers, viewerAllowedTypes, venueTarget.marker, venueTargetId, opportunities, targetOpportunity, queryCenter, admissionPlayer, committedFilters]
    );

    const suggestions = useMemo(() => {
        const query = normalizeText(draftSearch);
        if (!query) {
            return [] as SearchSuggestion[];
        }

        const deduped = new Map<string, SearchSuggestion>();
        for (const record of [...allRecords].sort((a, b) => searchRank(b.title, query) - searchRank(a.title, query))) {
            if (!searchRank(record.searchText, query)) {
                continue;
            }

            const label = record.title;
            const suggestion: SearchSuggestion = {
                id: record.key,
                label,
                meta: record.entityType === 'STADIUM' ? 'Stadium rental' : record.entityType === 'CLUB' ? 'Club location' : `${record.clubName ?? 'Club'} · ${record.entityType === 'TRYOUT' ? 'Tryout' : record.matchSubtype === 'FRIENDLY' ? 'Friendly' : 'Match'}`,
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
        return allRecords.filter((record) => {
            if (committedCoverage === 'area' && areaBounds && record.latitude != null && record.longitude != null && !containsPoint(areaBounds, record.latitude, record.longitude)) return false;
            // Type filtering handled server-side; client only filters what server can't

            if (record.entityType === 'CLUB') {
                if (record.opportunity) {
                    if(record.opportunity.id===opportunityTargetId)return true;
                    if(!matchesOpportunity(record.opportunity,committedFilters))return false;
                    if(committedCoverage==='radius'&&record.distanceKm!=null&&record.distanceKm>committedFilters.distanceKm)return false;
                    // Category and verified predicates are enforced by the public opportunity API at the actual venue.
                    return true;
                }
                if (committedFilters.clubs.officialOnly && !record.official) return false;
                if (committedFilters.clubs.openTryoutsOnly) return false;
                return true;
            }

            if (record.entityType === 'TOURNAMENT' || record.entityType === 'STADIUM') return true;

            // Time-of-day filter (server doesn't handle this)
            const timeWindows = record.entityType === 'TRYOUT' ? committedFilters.tryouts.timeWindows : committedFilters.matches.timeWindows;
            if (timeWindows.length > 0) {
                const window = getTimeWindow(record.startsAt);
                if (!window || !timeWindows.includes(window)) return false;
            }

            if (record.entityType === 'MATCH') {
                if (record.matchSubtype && committedFilters.matches.subtypes.length > 0 && !committedFilters.matches.subtypes.includes(record.matchSubtype)) return false;
            }

            // Server already filtered by gender/age/level/date for MATCH and TRYOUT
            return true;
        });
    }, [allRecords, committedFilters, areaBounds, committedCoverage, opportunityTargetId]);

    const sortedRecords = useMemo(() => {
        // Moving the start updates displayed distances immediately, before the
        // next filter commit fetches the new radius from the server.
        const records = filteredRecords.map(record => walkingOrigin && record.longitude != null && record.latitude != null
            ? { ...record, distanceKm: geographicDistanceKm(walkingOrigin, [record.longitude, record.latitude]) } : record);
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

            const matchRank = searchRank(right.title, committedSearch) - searchRank(left.title, committedSearch);
            if (matchRank) return matchRank;
            const leftScore = Number(left.official) + Number(left.challengeState === 'OPEN');
            const rightScore = Number(right.official) + Number(right.challengeState === 'OPEN');
            return rightScore - leftScore || timestampFor(left) - timestampFor(right) || distanceFor(left) - distanceFor(right);
        };

        return records.sort((left, right) => compareBySort(left, right) || left.title.localeCompare(right.title) || left.key.localeCompare(right.key));
    }, [filteredRecords, committedFilters.sortBy, committedSearch, walkingOrigin]);

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
        if (committedCoverage !== 'radius') return null;
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
    }, [committedFilters.distanceKm, queryCenter, committedCoverage]);

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
    const layoutSignature = `${selectedRecord?.entityType ?? 'none'}:${isFilterOpen}:${filterMode}:${isClubRailOpen}:${Boolean(walkingTarget)}:${planningOpen}`;

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
        walkingRequest.current?.abort(); setWalkingTarget(null); setWalkingRoute(null); setPickingOrigin(false); setWalkingLoading(false);
        setSelectedKey(record.key);
        setShowDetails(true);
        setIsClubRailOpen(false);
        if (window.innerWidth < 1100) setIsFilterOpen(false);
        if (record.latitude != null && record.longitude != null) {
            setFocusTarget(mapSelectionTarget([record.longitude, record.latitude], walkingOrigin, mapRef.current?.getZoom() ?? 0));
        }
    }, [walkingOrigin, setIsClubRailOpen, setSelectedKey, setShowDetails]);

    const focusResult = (record: DiscoveryRecord) => {
        walkingRequest.current?.abort(); setWalkingTarget(null); setWalkingRoute(null); setPickingOrigin(false); setWalkingLoading(false);
        setSelectedKey(record.key); setShowDetails(false);
        setIsClubRailOpen(window.innerWidth >= 1100);
        if (window.innerWidth < 1100) setIsFilterOpen(false);
        if (record.latitude != null && record.longitude != null) {
            setFocusTarget(mapSelectionTarget([record.longitude, record.latitude], walkingOrigin, mapRef.current?.getZoom() ?? 0));
        }
    };

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
            if (record?.entityType === 'STADIUM') {
                navigate(`/stadiums/${record.rawMapMarker?.entityId}`);
            } else if (record?.clubId) {
                navigate(playerPath(`/clubs/${record.clubId}`,admissionPlayer?.id));
            }
        },
        [navigate, admissionPlayer?.id]
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
        setDraftSearch('');
        const record = allRecords.find(entry => entry.key === suggestion.recordKey);
        if (record) selectRecord(record);
    };

    const captureArea = useCallback((): MapBounds | null => {
        const bounds = mapRef.current?.getBounds();
        if (!bounds) return null;
        const wrap = (n: number) => ((n + 180) % 360 + 360) % 360 - 180;
        return { west: bounds.getEast() - bounds.getWest() >= 360 ? -180 : wrap(bounds.getWest()),
            east: bounds.getEast() - bounds.getWest() >= 360 ? 180 : wrap(bounds.getEast()),
            south: Math.max(-90, bounds.getSouth()), north: Math.min(90, bounds.getNorth()) };
    }, []);
    const browseArea = async () => {
        const bounds = captureArea();
        if (!bounds) return;
        const committed = await commitAndFetch({ coverage: 'area', bounds });
        if (!committed) return;
        setSelectedKey(null); setIsClubRailOpen(true);
        if (window.innerWidth < 1100) setIsFilterOpen(false);
        // Opening a dock shrinks the canvas. Keep the searched geography visible.
        if (!isClubRailOpen && window.innerWidth >= 1100) requestAnimationFrame(() => requestAnimationFrame(() => {
            mapRef.current?.resize();
            mapRef.current?.fitBounds([[bounds.west, bounds.south], [bounds.east < bounds.west ? bounds.east + 360 : bounds.east, bounds.north]],
                { padding: 24, duration: 0 });
        }));
    };
    const openResults = () => {
        walkingRequest.current?.abort(); setWalkingTarget(null); setWalkingRoute(null); setPickingOrigin(false); setWalkingLoading(false);
        setSelectedKey(null); setIsClubRailOpen(!isClubRailOpen);
        if (window.innerWidth < 1100) setIsFilterOpen(false);
    };

    const calculateWalk = async (origin: Coordinate, target = walkingTarget) => {
        if (!target || target.latitude == null || target.longitude == null) return;
        walkingRequest.current?.abort();
        const request = new AbortController(); walkingRequest.current = request;
        setWalkingOrigin(origin); setWalkingLoading(true); setWalkingError(null); setWalkingRoute(null); setPickingOrigin(false);
        setSearchOrigin(origin); setSearchSequence(n => n + 1);
        try {
            const route = await loadWalkingRoute(origin, [target.longitude, target.latitude], request.signal);
            if (request.signal.aborted) return;
            setWalkingRoute(route); setSearchSequence(n => n + 1);
            const fullPath = [origin, ...route.coordinates, [target.longitude, target.latitude]];
            const lngs = fullPath.map(c => c[0]); const lats = fullPath.map(c => c[1]);
            const canvas = mapRef.current?.getContainer();
            const height = canvas?.clientHeight ?? window.innerHeight;
            const width = canvas?.clientWidth ?? window.innerWidth;
            mapRef.current?.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
                { padding: mapCameraPadding(width, height, window.innerWidth < 1100 ? height * .55 : 0),
                    duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500, maxZoom: 16 });
        } catch (error) {
            if (!request.signal.aborted) setWalkingError(error instanceof Error ? error.message : 'Walking route unavailable.');
        } finally { if (!request.signal.aborted) setWalkingLoading(false); }
    };
    const startWalking = (record: DiscoveryRecord) => {
        walkingRequest.current?.abort(); setWalkingLoading(false); setWalkingTarget(record); setWalkingRoute(null);
        setWalkingError(null); setSelectedKey(null); setIsClubRailOpen(false);
        if (window.innerWidth < 1100) setIsFilterOpen(false);
        setPickingOrigin(!walkingOrigin);
        if (walkingOrigin) void calculateWalk(walkingOrigin, record);
    };
    const chooseOrigin = (origin: Coordinate) => {
        commitRequest.current++; setResolvingPlace(false);
        locationRequest.current++; setLocating(false); setLocationError(null);
        setWalkingOrigin(origin); setSearchOrigin(origin); setPickingOrigin(false);
        setQueryCenter([origin[1], origin[0]]);
        if (walkingTarget) void calculateWalk(origin);
    };
    const locateOrigin = () => {
        if (!navigator.geolocation) { setLocationError('Location is unavailable. Choose a point on the map.'); return; }
        const request = ++locationRequest.current;
        setLocating(true); setLocationError(null);
        navigator.geolocation.getCurrentPosition(position => {
            if (request !== locationRequest.current) return;
            const origin: Coordinate = [position.coords.longitude, position.coords.latitude];
            chooseOrigin(origin);
            // Looking at another country should not be undone by a location update.
            if (!draftFilters.clubs.country && !draftFilters.clubs.city && !walkingTarget) setFocusTarget({ center: [origin[1], origin[0]], zoom: 12 });
        }, error => {
            if (request !== locationRequest.current) return;
            setLocating(false);
            setLocationError(error.code === 1 ? 'Location access is off. Allow it in your browser or choose on the map.' : 'Could not get your location. Try again or choose on the map.');
        }, { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true });
    };
    const beginPickingOrigin = () => {
        locationRequest.current++; setLocating(false); setLocationError(null);
        walkingRequest.current?.abort(); setWalkingLoading(false); setWalkingError(null);
        setPickingOrigin(true);
        if (isExternalFilterLayout || window.innerWidth < 1100) setIsFilterOpen(false);
    };
    const changeDraftFilters = (filters: MapFilters) => {
        commitRequest.current++; setResolvingPlace(false);
        const regionChanged = filters.clubs.country !== draftFilters.clubs.country || filters.clubs.city !== draftFilters.clubs.city;
        if (regionChanged) {
            locationRequest.current++; setLocating(false);
            setDraftCoverage(filters.clubs.country || filters.clubs.city ? 'region' : 'area');
        }
        else if (filters.distanceKm !== draftFilters.distanceKm) setDraftCoverage('radius');
        setDraftFilters(filters);
    };

    // W7b — zero-results empty state: widen the committed radius to the slider
    // max and refetch in place (the fetch effect refires on committedFilters).
    const widenRadius = useCallback(() => {
        if (!walkingOrigin) {
            setDraftCoverage('radius'); setDraftFilters(current => ({ ...current, distanceKm: 400 }));
            setLocationError('Choose your location to expand the search around it.'); setIsFilterOpen(true);
            return;
        }
        setAreaBounds(null); setDraftCoverage('radius'); setCommittedCoverage('radius');
        setDraftFilters((current) => ({ ...current, distanceKm: 400 }));
        setCommittedFilters((current) => ({ ...current, distanceKm: 400 }));
    }, [walkingOrigin]);

    // Every search action commits the same coverage/filters/anchor tuple.
    // Applying other filters preserves the searched area until explicitly changed.
    const commitAndFetch = useCallback(
        async (opts: { center?: [number, number]; zoom?: number; fly?: boolean; coverage?: SearchCoverage; bounds?: MapBounds } = {}): Promise<boolean> => {
            const request = ++commitRequest.current;
            const coverage = opts.coverage ?? draftCoverage;
            const country = draftFilters.clubs.country.trim();
            const city = draftFilters.clubs.city.trim();
            const place = city || country || placeSearch.trim();
            const regionChanged = country !== committedFilters.clubs.country || city !== committedFilters.clubs.city;
            const min = draftFilters.clubs.trainingMinPrice, max = draftFilters.clubs.trainingMaxPrice;
            if (draftFilters.entityType.includes('CLUB') && ((min && (!Number.isFinite(Number(min)) || Number(min) < 0)) || (max && (!Number.isFinite(Number(max)) || Number(max) < 0)) || (min && max && Number(min) > Number(max)))) {
                toast.error('Enter a valid training price range.'); return false;
            }
            let center: [number, number] = walkingOrigin ? [walkingOrigin[1], walkingOrigin[0]] : opts.center ?? queryCenter;
            let regionCenter: [number, number] | undefined;
            let zoom = opts.zoom;
            let bounds = coverage === 'area' ? opts.bounds ?? areaBounds ?? captureArea() : null;
            if (coverage === 'region' && !place) return false;
            if (coverage === 'radius' && !walkingOrigin) {
                setLocationError('Use my location or choose a point to search within a radius.');
                setIsFilterOpen(true); return false;
            }
            if (coverage === 'area' && !bounds) return false;
            if (place && (regionChanged || coverage === 'region' || (!walkingOrigin && coverage === 'radius'))) {
                setResolvingPlace(true);
                try {
                    const results = await geocodePlace(place, { countryCode: findIsoCountry(country)?.code, type: city ? 'CITY' : country ? 'COUNTRY' : undefined });
                    if (request !== commitRequest.current) return false;
                    const top = results[0];
                    if (!top) { toast.error(`No place found for "${place}"`); return false; }
                    regionCenter = [top.latitude, top.longitude];
                    if (!walkingOrigin) center = regionCenter;
                    zoom = top.type === 'CITY' ? 11.5 : 5.5;
                } catch (error) {
                    if (request === commitRequest.current) toast.error(extractApiErrorMessage(error, 'Could not resolve that place.'));
                    return false;
                } finally { if (request === commitRequest.current) setResolvingPlace(false); }
            }
            if (request !== commitRequest.current) return false;
            if (coverage !== 'area') bounds = null;
            setAreaBounds(bounds); setAreaMoved(false); setDraftCoverage(coverage); setCommittedCoverage(coverage);
            walkingRequest.current?.abort(); setWalkingTarget(null); setWalkingRoute(null); setPickingOrigin(false); setWalkingLoading(false);
            setSearchOrigin(walkingOrigin ?? [center[1], center[0]]);
            setSearchSequence(n => n + 1); setReload(n => n + 1);
            setCommittedFilters(draftFilters); setCommittedSearch(draftSearch.trim()); setQueryCenter(center);
            if (coverage !== 'area' && (opts.fly || regionChanged)) setFocusTarget({ center: regionCenter ?? center, zoom });
            return true;
        },
        [draftCoverage, draftFilters, draftSearch, placeSearch, queryCenter, walkingOrigin, committedFilters, areaBounds, captureArea]
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

    const panelContent = selectedRecord?.opportunity ? (
        <div className="admission-applicant" style={{padding:16}}><button className="admission-button" onClick={()=>setSelectedKey(null)}>{admissionCopy('Close details','დეტალების დახურვა')}</button><OpportunityCard opportunity={selectedRecord.opportunity} playerId={selectedRecord.applicantPlayerId}/><button className="admission-button" onClick={()=>startWalking(selectedRecord)}>{admissionCopy('Walk to training venue','სავარჯიშო ადგილამდე მისვლა')}</button></div>
    ) : selectedRecord ? (
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
            onWalk={() => startWalking(selectedRecord)}
            onClose={() => setSelectedKey(null)}
        />
    ) : null;

    const hasSelectedResult = Boolean(selectedRecord && showDetails);
    const resultCount = sortedRecords.length;
    const coverageSummary = coverageLabel(committedCoverage, committedFilters.distanceKm, committedFilters.clubs.city || committedFilters.clubs.country);
    const toolbarCount = loading ? 'Searching...' : `${resultCount} results · ${coverageSummary}`;
    const toolbarLeftClass = isFilterOpen && filterLayout === 'side' ? 'atlas-mode-offset' : '';
    const appliedChips = [committedFilters.clubs.country, committedFilters.clubs.city,
        ...committedFilters.clubs.categories.map(c => c.replaceAll('_', ' ').toLowerCase()),
        ...committedFilters.clubs.ageGroups, ...committedFilters.clubs.genders, ...committedFilters.clubs.levels,
        committedFilters.clubs.officialOnly ? 'Verified' : '', committedSearch].filter(Boolean);
    const hasActiveExternalFilters = Boolean(draftSearch) || JSON.stringify(draftFilters) !== JSON.stringify(initialMapFilters);
    const filterSurface = filterMode === 'simple' || !canUseAdvancedFilters ? (
        <SimpleMapFilters
            admissionControls={<MapAdmissionControls key={`${user?.id}:${sessionId}`} playerId={admissionPlayer?.id} requestedPlayerId={requestedAdmissionPlayerId} onPlayer={selectAdmissionPlayer} includeWaitlist={draftFilters.clubs.includeWaitlist??false} onWaitlist={value=>changeDraftFilters({...draftFilters,clubs:{...draftFilters.clubs,includeWaitlist:value}})}/>}
            isVisible={isFilterOpen && !planningOpen}
            embedded={embedded}
            layout={filterLayout}
            draftFilters={draftFilters}
            appliedFilters={committedFilters}
            onDraftChange={changeDraftFilters}
            onApply={async () => {
                const committed = await commitAndFetch({ fly: true });
                if (committed && context === 'guest' && (filterLayout === 'top' || filterLayout === 'external')) {
                    setIsFilterOpen(false);
                }
            }}
            onReset={() => {
                setDraftFilters({ ...defaultMapFilters, entityType: [...viewerAllowedTypes] });
                setDraftSearch('');
                setPlaceSearch('');
                setDraftCoverage('area');
            }}
            applying={loading || resolvingPlace}
            resultCount={resultCount}
            searchValue={draftSearch}
            onSearchChange={setDraftSearch}
            onPlaceSearchChange={setPlaceSearch}
            allowedEntityTypes={viewerAllowedTypes}
            viewerMode={mapViewerMode}
            originLabel={walkingOrigin ? `${walkingOrigin[1].toFixed(5)}, ${walkingOrigin[0].toFixed(5)}` : undefined}
            onPickOrigin={beginPickingOrigin}
            onLocate={locateOrigin} locating={locating} locationError={locationError}
            coverage={draftCoverage} appliedCoverage={committedCoverage} coverageSummary={coverageSummary}
            onCoverageChange={coverage => { locationRequest.current++; setLocating(false); commitRequest.current++; setResolvingPlace(false); setDraftCoverage(coverage); }}
            showAdvancedFilters={canUseAdvancedFilters}
            showPlayerFitFilters={context !== 'guest' || filterLayout === 'side'}
            showSearchField={!(context === 'guest' && (filterLayout === 'top' || filterLayout === 'external'))}
            showVerificationFilter={!(context === 'guest' && (filterLayout === 'top' || filterLayout === 'external'))}
            showDescription={!(context === 'guest' && (filterLayout === 'top' || filterLayout === 'external'))}
            onOpenAdvanced={() => {
                if (canUseAdvancedFilters) setFilterMode('advanced');
            }}
            onOpenPlanning={context === 'authenticated' && !embedded ? openPlanning : undefined}
            onClose={() => setIsFilterOpen(false)}
        />
    ) : (
        <MapFilterSidebar
            isVisible={isFilterOpen && !planningOpen}
            draftFilters={draftFilters}
            appliedFilters={committedFilters}
            onDraftChange={changeDraftFilters}
            onApply={() => void commitAndFetch({ fly: true })}
            onResetAll={() => {
                setDraftFilters({ ...defaultMapFilters, entityType: [...viewerAllowedTypes] });
                setDraftSearch('');
                setPlaceSearch('');
                setDraftCoverage('area');
            }}
            applying={loading || resolvingPlace}
            resultCount={resultCount}
            placeSearch={placeSearch}
            onPlaceSearchChange={setPlaceSearch}
            allowedEntityTypes={viewerAllowedTypes}
            viewerMode={mapViewerMode}
            onClose={() => setIsFilterOpen(false)}
            onBackToSimple={() => setFilterMode('simple')}
        />
    );

    return (
        <div style={{"--mp-left":`${planWidths.left}px`,"--mp-right":`${planWidths.right}px`} as React.CSSProperties} className={`map-page-shell club-page-shell map-workspace h-full min-h-0 w-full overflow-hidden map-atlas relative ${planWidths.animated ? 'mp-panels-animate' : ''} ${planningOpen ? 'planning-open' : ''} ${compactControls ? 'map-controls-compact' : ''} ${isExternalFilterLayout ? 'flex flex-col' : ''} ${isFilterOpen && filterLayout === 'side' ? 'atlas-left-open' : ''} ${pickingOrigin ? 'atlas-picking-origin' : ''} ${embedded ? 'map-experience-embedded' : ''} ${mapDarkMode ? 'map-force-dark' : 'map-force-light'} ${(isClubRailOpen && !hasSelectedResult) || hasSelectedResult || walkingTarget ? 'map-right-rail-visible' : ''}`}>
            {isExternalFilterLayout && (
                <div className="relative z-[1400] shrink-0">
                    <ExternalMapFilterToolbar
                        compact={compactControls}
                        draftSearch={draftSearch}
                        suggestions={suggestions}
                        toolbarCount={toolbarCount}
                        isFilterOpen={isFilterOpen}
                        hasActiveFilters={hasActiveExternalFilters}
                        onSearchChange={setDraftSearch}
                        onSuggestionPick={handleSuggestionPick}
                        onToggleFilters={() => setIsFilterOpen((current) => !current)}
                    />
                    {isFilterOpen && <EmbeddedMapFilterDialog darkMode={mapDarkMode} onClose={() => setIsFilterOpen(false)}>{filterSurface}</EmbeddedMapFilterDialog>}
                </div>
            )}
            <div className={isExternalFilterLayout ? 'relative min-h-0 flex-none h-[560px] sm:h-[620px] lg:h-[700px]' : 'contents'}>
            {/* Basemap tiles load independently of account/discovery requests.
                The saved camera remains the initial view while results arrive. */}
            {!mapUnavailable && (
                <div className="map-canvas-frame absolute inset-0 z-0 overflow-hidden border-0 rounded-none">
                    <MapGL
                        key={mapAttempt}
                        onError={event => {
                            // A transient tile/glyph failure must not destroy an otherwise usable map.
                            if (!event.target.getStyle()?.layers?.length) {
                                setMapUnavailable(true); setIsClubRailOpen(true); setIsFilterOpen(false);
                            }
                        }}
                        ref={mapRef}
                        initialViewState={{
                            latitude: savedCamera.latitude,
                            longitude: savedCamera.longitude,
                            zoom: savedCamera.zoom,
                            pitch: effectiveMapMode === 'tilted' ? 45 : 0,
                            bearing: effectiveMapMode === 'tilted' ? -17 : 0
                        }}
                        style={{ width: '100%', height: '100%' }}
                        pixelRatio={lightRendering ? Math.min(window.devicePixelRatio || 1, 1.5) : undefined}
                        attributionControl={{ compact: true }}
                        // Embedded discovery must let visitors scroll into the landing story.
                        scrollZoom={!embedded}
                        mapStyle={heritageStyle ?? MAP_STYLE_DEFAULT}
                        cursor={pickingOrigin || (planningOpen&&planPickMode) ? 'crosshair' : hoveredPlace ? 'pointer' : 'grab'}
                        onMouseMove={event=>{
                            if(journeyMap){const map=mapRef.current,layers=['journey-stop-pin','journey-connection-line'].filter(id=>map?.getLayer(id));if(map)map.getCanvas().style.cursor=layers.length&&map.queryRenderedFeatures(event.point,{layers}).length?'pointer':'grab';return;}
                            if(!window.matchMedia('(hover:hover) and (pointer:fine)').matches)return;
                            const map=mapRef.current,layers=[LAYER_POINTS,'selected-point-pin','plan-place-role-number','plan-place-number','plan-place-role-halo','plan-place-halo'].filter(id=>map?.getLayer(id));
                            const feature=layers.length?map?.queryRenderedFeatures(event.point,{layers})[0]:null;
                            const key=feature?.properties?.key as string|undefined;
                            if((key||null)===hoverKey.current)return;hoverKey.current=key||null;
                            if(!key||feature?.geometry.type!=='Point'){setHoveredPlace(null);return;}
                            const planned=planPlaces.find(p=>p.key===key),record=mapRecords.find(r=>r.key===key);
                            const [longitude,latitude]=feature.geometry.coordinates;
                            setHoveredPlace({key,name:planned?.name||record?.title||String(feature.properties?.title||''),detail:planned?roleForPlace(key)?locationRoles[roleForPlace(key)!].label:'Saved place':record?.locationName||record?.subtitle||'Click to explore',longitude,latitude});
                        }}
                        onMouseOut={()=>{hoverKey.current=null;setHoveredPlace(null);}}
                        onClick={(event) => {
                            if (planningOpen && journeyMap) {
                                const features=mapRef.current?.queryRenderedFeatures(event.point,{layers:['journey-stop-pin','journey-stop-number','journey-stop-name','journey-connection-line','journey-connection-label'].filter(id=>mapRef.current?.getLayer(id))})||[];
                                const step=features.find(f=>f.properties?.stepId)?.properties?.stepId;
                                if(step)journeyMap.onSelect(String(step));
                            } else if (planningOpen) {
                                const features=mapRef.current?.queryRenderedFeatures(event.point)||[];
                                const planned=features.find(f=>f.layer.id.startsWith('plan-place-'));
                                const stored=planned?planPlaces.find(p=>p.key===planned.properties?.key):null;
                                const football=features.find(f=>f.properties?.key&&mapRecords.some(r=>r.key===f.properties!.key));
                                const record=football?mapRecords.find(r=>r.key===football.properties?.key):null;
                                const named=features.find(f=>f.properties?.['name:en']||f.properties?.name);
                                planMapClick.current?.(stored||{key:crypto.randomUUID(),name:String(record?.title||named?.properties?.['name:en']||named?.properties?.name||'').slice(0,160),address:record?.locationName||'',latitude:event.lngLat.lat,longitude:event.lngLat.lng,type:record?.rawMapMarker?.entityType as PlanPlace['type']||'MANUAL',entityId:record?.rawMapMarker?.entityId,notes:''});
                            } else if (pickingOrigin) chooseOrigin([event.lngLat.lng, event.lngLat.lat]);
                        }}
                        onLoad={(evt) => {
                            if (isAndroidApp || embedded) {
                                // Keep attribution available through its standard toggle without
                                // covering the phone's mode and search controls on first load.
                                const attribution = evt.target.getContainer().querySelector<HTMLDetailsElement>('.maplibregl-ctrl-attrib');
                                if (attribution?.open) attribution.querySelector<HTMLElement>('summary')?.click();
                            }
                            if (committedCoverage === 'area') { const bounds = captureArea(); if (bounds) setAreaBounds(bounds); }
                            // MapLibre v5: drive the projection imperatively (react-map-gl 8
                            // does not forward a projection prop).
                            try {
                                evt.target.setProjection({ type: effectiveMapMode === 'globe' ? 'globe' : 'mercator' });
                            } catch {
                                /* projection unsupported — stay mercator */
                            }
                            // initialViewState already sets pitch and bearing. Starting
                            // another animation here can interrupt an early location
                            // focus or a gesture made while discovery is still loading.
                        }}
                        onMoveEnd={(evt) => {
                            if (isAndroidApp) setSavedCamera({ latitude: evt.viewState.latitude, longitude: evt.viewState.longitude, zoom: evt.viewState.zoom });
                            if (evt.originalEvent) setAreaMoved(true);
                        }}
                    >
                        {!planningOpen && <MapSearchLayer sequence={searchSequence} origin={walkingOrigin ?? searchOrigin}
                            targets={mapRecords.map(record => [record.longitude!, record.latitude!] as Coordinate)}
                            destination={walkingTarget?.longitude != null && walkingTarget.latitude != null ? [walkingTarget.longitude, walkingTarget.latitude] : undefined}
                            route={walkingRoute} showOrigin={Boolean(walkingOrigin)} onOriginChange={chooseOrigin} />}
                        {planningOpen&&!journeyMap&&planStops.length>1&&<Source id="plan-stop-connections" type="geojson" data={{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:planStops.map(p=>[p.longitude,p.latitude])}}}><Layer id="plan-stop-order-line" type="line" layout={{'line-cap':'round','line-join':'round'}} paint={{'line-color':visualColors.mapExperiencePaint85,'line-width':2,'line-dasharray':[3,4],'line-opacity':.55}}/></Source>}
                        {planningOpen && !journeyMap && planPlaces.length>0 && <Source id="plan-places" type="geojson" data={planGeometry}>
                            <Layer id="plan-place-halo" type="circle" filter={['==',['get','role'],'place']} paint={{'circle-radius':18,'circle-color':visualColors.mapPaper,'circle-stroke-color':visualColors.mapForest,'circle-stroke-width':2}}/>
                            <Layer id="plan-place-number" type="symbol" filter={['==',['get','role'],'place']} layout={{'text-field':['get','number'],'text-font':['Noto Sans Regular'],'text-size':13,'text-allow-overlap':true}} paint={{'text-color':visualColors.mapForest}}/>
                            <Layer id="plan-place-role-halo" type="circle" filter={['!=',['get','role'],'place']} paint={{'circle-radius':18,'circle-color':['match',['get','role'],'meeting',visualColors.mapMeetingSurface,'destination',visualColors.mapDestinationSurface,visualColors.mapCollectionSurface],'circle-stroke-color':['match',['get','role'],'meeting',visualColors.mapMeeting,'destination',visualColors.mapDestination,visualColors.mapCollection],'circle-stroke-width':2}}/>
                            <Layer id="plan-place-role-number" type="symbol" filter={['!=',['get','role'],'place']} layout={{'text-field':['get','number'],'text-font':['Noto Sans Regular'],'text-size':13,'text-allow-overlap':true}} paint={{'text-color':visualColors.mapForest}}/>
                            <Layer id="plan-place-label" type="symbol" layout={{'text-field':['get','name'],'text-font':['Noto Sans Regular'],'text-size':11,'text-offset':[0,2.5],'text-anchor':'top','text-max-width':15}} paint={{'text-color':visualColors.mapForest,'text-halo-color':visualColors.mapPaper,'text-halo-width':2}}/>
                        </Source>}
                        {planningOpen&&!journeyMap&&planPreview&&<Source id="plan-picked-preview" type="geojson" data={{type:'Feature',properties:{},geometry:{type:'Point',coordinates:[planPreview.longitude,planPreview.latitude]}}}><Layer id="plan-picked-preview-dot" type="circle" paint={{'circle-radius':11,'circle-color':visualColors.mapExperiencePaint94,'circle-stroke-color':visualColors.landingRoleScenePaint50,'circle-stroke-width':4}}/></Source>}
                        <MapFocusController target={focusTarget} onSettled={handleFocusSettled} />
                        <MapSizeGuard layoutSignature={layoutSignature} />
                        <MapClickController
                            onPointClick={pickingOrigin || planningOpen ? () => undefined : handleMapPointClick}
                            onClusterClick={pickingOrigin || planningOpen ? () => undefined : handleMapClusterClick}
                        />
                        {radiusVignette && (
                            <Source id="radius-vignette" type="geojson" data={radiusVignette}>
                                <Layer
                                    id="radius-vignette-fill"
                                    type="fill"
                                    paint={{
                                        'fill-color': visualColors.mapExperiencePaint95,
                                        'fill-opacity': 0.06,
                                        'fill-opacity-transition': { duration: 400 },
                                        'fill-antialias': true,
                                    }}
                                />
                            </Source>
                        )}
                        <NavigationControl position="bottom-right" visualizePitch />
                        <MapViewControls />
                        {hoveredPlace&&!journeyMap&&<Popup className="atlas-hover-popup" longitude={hoveredPlace.longitude} latitude={hoveredPlace.latitude} anchor="bottom" offset={30} closeButton={false} closeOnClick={false} maxWidth="260px"><div className="atlas-hover-card"><strong>{hoveredPlace.name}</strong><small>{hoveredPlace.detail}</small><small>{planningOpen?'Click to use this place in your plan':'Click to explore'}</small></div></Popup>}
                        <MapFootballMarkers />
                        {(!journeyMap||journeyMap.nearby)&&<MapLegend types={committedFilters.entityType} />}
                        <Source
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
                                layout={{visibility:journeyMap&&!journeyMap.nearby?'none':'visible', 'icon-image': FOOTBALL_IMAGE, 'icon-size': ['step', ['get', 'point_count'], .68, 10, .8, 50, .94],
                                    'icon-allow-overlap': true, 'icon-ignore-placement': true }}
                            />
                            <Layer
                                id={LAYER_CLUSTER_COUNT}
                                type="symbol"
                                filter={['has', 'point_count']}
                                layout={{visibility:journeyMap&&!journeyMap.nearby?'none':'visible', 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12,
                                    'text-allow-overlap': true, 'text-ignore-placement': true,
                                    // OpenFreeMap serves Noto Sans, not MapLibre's implicit Open Sans stack.
                                    'text-font': ['Noto Sans Regular'] }}
                                paint={{
                                    'text-color': visualColors.paper, 'text-halo-color': visualColors.mapExperiencePaint96, 'text-halo-width': 2
                                }}
                            />
                            <Layer
                                id={LAYER_POINT_HALO}
                                layout={{visibility:journeyMap&&!journeyMap.nearby?'none':'visible'}}
                                type="circle"
                                filter={['!', ['has', 'point_count']]}
                                paint={{
                                    'circle-color': mapDarkMode ? visualColors.mapExperiencePaint97 : visualColors.mapExperiencePaint98,
                                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 7, 12, 10],
                                    'circle-opacity': mapDarkMode ? 0.42 : 0.22,
                                    'circle-blur': 0.55
                                }}
                            />
                            <Layer
                                id={LAYER_POINTS}
                                type="symbol"
                                filter={['!', ['has', 'point_count']]}
                                layout={{visibility:journeyMap&&!journeyMap.nearby?'none':'visible', 'icon-image': FOOTBALL_IMAGE, 'icon-size': ['interpolate', ['linear'], ['zoom'], 4, .4, 14, .55],
                                    'icon-allow-overlap': true, 'icon-ignore-placement': true }}
                            />
                        </Source>
                        <Source id="selected-point" type="geojson" data={journeyMap?{type:'FeatureCollection',features:[]}:selectedFeatureCollection}>
                            <Layer id="selected-point-halo" type="circle"
                                paint={{ 'circle-radius': 23, 'circle-color': visualColors.mapExperiencePaint99, 'circle-stroke-color': visualColors.mapExperiencePaint100, 'circle-stroke-width': 2 }} />
                            <Layer id="selected-point-pin" type="symbol"
                                layout={{ 'icon-image': FOOTBALL_IMAGE, 'icon-size': .68, 'icon-allow-overlap': true, 'icon-ignore-placement': true }} />
                        </Source>
                        {planningOpen&&journeyMap&&<JourneyMapLayer state={journeyMap}/>}
                    </MapGL>
                    {searchSequence > 0 && <div key={searchSequence} className="atlas-search-veil" aria-hidden="true" />}
                </div>
            )}
            {/* Mode switcher: rendered OUTSIDE <MapGL> (it needs no map context) so it
                stays visible through loading/error states and can shift right of the
                open filter drawer at xl — mirroring the command bar offset. */}
            {canUseModeControl && !planningOpen && (
                <div
                    className={`pointer-events-none absolute bottom-4 left-4 z-[600] transition-all duration-200 ${
                        toolbarLeftClass
                    }`}
                >
                    <div className="pointer-events-auto">
                        <MapModeControl
                            mode={effectiveMapMode}
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
            )}
            {mapUnavailable && !error && (
                <div role="status" className="absolute bottom-4 left-4 z-[600] max-w-[min(90vw,320px)] rounded-xl bg-[var(--map-panel-bg)] p-4 text-sm text-[var(--text-primary)] shadow-lg">
                    The map could not load. You can still browse the results list.
                    <button type="button" className="block mt-2 app-text-action" onClick={() => { setMapUnavailable(false); setMapAttempt(value => value + 1); }}>Retry map</button>
                </div>
            )}
            {(venueTarget.loading || venueTarget.error) && <div className="absolute top-20 right-4 z-[700] max-w-sm rounded-2xl border border-[var(--map-panel-border)] bg-[var(--map-card-bg)] p-4 text-sm text-[var(--map-text-primary)]" role={venueTarget.error ? 'alert' : 'status'}>
                {venueTarget.error || 'Opening venue on the map…'}
                {venueTarget.error && <button type="button" className="block mt-2 app-text-action" onClick={venueTarget.retry}>Retry venue</button>}
            </div>}
            {loading && (
                <div className="map-loading-with-rail absolute top-4 right-4 z-[700] pointer-events-none transition-[right]">
                    <div role="status" className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-elevated)] px-3 py-1.5 shadow-lg dark:border-[color:var(--color-border)]/10 dark:bg-[var(--color-page)]/95">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[color:var(--color-accent)] dark:text-[color:var(--color-accent)]" />
                        <span className="text-xs text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">{initialLoad ? 'Loading nearby results…' : 'Updating...'}</span>
                    </div>
                </div>
            )}
            {error && (
                <div className="pointer-events-none absolute left-1/2 top-24 z-[700] w-[min(88vw,430px)] -translate-x-1/2">
                    <div className="pointer-events-auto rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-elevated)] px-4 py-3 text-center text-sm leading-6 text-[color:var(--color-muted)] shadow-lg dark:border-[color:var(--color-border)]/10 dark:bg-[var(--color-page)]/95 dark:text-[color:var(--color-muted)]" role="alert">{error}<button type="button" className="block mx-auto mt-2 app-text-action" onClick={() => setReload(value => value + 1)}>Retry search</button></div>
                </div>
            )}
            {!initialLoad && !loading && !error && mapRecords.length === 0 && (
                <div className="pointer-events-none absolute left-1/2 top-24 z-[700] w-[min(88vw,430px)] -translate-x-1/2">
                    <div className="flex items-center gap-3 border-l-2 border-[color:var(--color-accent)] bg-transparent px-3 py-1.5 text-left [filter:drop-shadow(0_1px_2px_var(--color-shadow-soft))] dark:border-[color:var(--color-accent)] dark:[filter:drop-shadow(0_1px_2px_var(--color-shadow-soft))]">
                        <MapPin className="h-5 w-5 shrink-0 text-[color:var(--color-accent)] dark:text-[color:var(--color-accent)]" />
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-black text-[color:var(--color-text)] dark:text-[color:var(--color-text)]">{t('map.empty.title')}</p>
                            <p className="mt-0.5 text-xs leading-4 text-[color:var(--color-text)] dark:text-[color:var(--color-text)]">{t('map.empty.subtitle')}</p>
                        </div>
                        <button
                            type="button"
                            onClick={widenRadius}
                            className="pointer-events-auto inline-flex shrink-0 items-center gap-1.5 border-b-2 border-[color:var(--color-accent)] px-1 py-1 text-xs font-black text-[color:var(--color-accent)] transition-colors hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] dark:border-[color:var(--color-accent)] dark:text-[color:var(--color-accent)] dark:hover:border-[color:var(--color-accent)] dark:hover:text-[color:var(--color-text)]"
                        >
                            <LocateFixed className="h-3.5 w-3.5" />
                            {t('map.empty.widenCta')}
                        </button>
                    </div>
                </div>
            )}
            <div className="pointer-events-none flex h-full min-h-0">
                {!isExternalFilterLayout && filterSurface}

                <MapResultsList
                    darkMode={mapDarkMode}
                    isVisible={!planningOpen && isClubRailOpen && !hasSelectedResult && !error}
                    embedded={embedded}
                    records={sortedRecords}
                    selectedPlayerId={admissionPlayer?.id}
                    selectedKey={selectedKey}
                    resultsLimited={resultsLimited}
                    loading={loading}
                    coverageSummary={coverageSummary}
                    areaSearch={committedCoverage === 'area'}
                    hasOrigin={Boolean(walkingOrigin)}
                    onLoadMore={nextClubPage == null && nextAdmissionPage == null ? undefined : () => void loadMoreClubs()}
                    loadingMore={loadingMore}
                    onWalk={key => { const record = allRecords.find(r => r.key === key); if (record) startWalking(record); }}
                    onSavePlace={context === 'authenticated' && !embedded ? key => { const record=allRecordsRef.current.find(r=>r.key===key);if(record?.latitude!=null&&record.longitude!=null){setPlanCandidate({key:record.key,name:record.title,address:record.locationName||record.rawMapMarker?.cityName||'',latitude:record.latitude,longitude:record.longitude,type:(record.rawMapMarker?.entityType||'MANUAL') as PlanPlace['type'],entityId:record.rawMapMarker?.entityId,notes:''});openPlanning();} } : undefined}
                    onSelect={(key) => {
                        const record = allRecordsRef.current.find((entry) => entry.key === key);
                        if (record) focusResult(record);
                    }}
                    onClose={() => setIsClubRailOpen(false)}
                />

                <div className="map-main-column flex min-w-0 flex-1 flex-col">
                    <div className="flex min-h-0 flex-1">
                        <section className="pointer-events-none relative min-h-0 min-w-0 flex-1">
                            <MapCommandBar search={draftSearch} onSearch={setDraftSearch}
                                onSubmit={() => void commitAndFetch()} onClear={() => setDraftSearch('')}
                                suggestions={suggestions} onSuggestion={handleSuggestionPick}
                                filtersOpen={isFilterOpen} onFilters={() => { setIsFilterOpen(!isFilterOpen); if (window.innerWidth < 1100) setIsClubRailOpen(false); }}
                                resultsOpen={isClubRailOpen} onResults={openResults}
                                count={resultCount} loading={loading} onBack={canUseBackControl ? () => navigate(-1) : undefined}
                                external={isExternalFilterLayout} filterOffset={isFilterOpen && filterLayout === 'side'} chips={appliedChips} />
                            {(!compactControls || areaMoved || loading) && <div className={'atlas-area-action ' + (isFilterOpen && filterLayout === 'side' ? 'atlas-area-action--offset' : '')}>
                                {!compactControls && <span><span className="atlas-live-dot" />{coverageSummary}</span>}
                                <button disabled={loading || resolvingPlace} onClick={() => void browseArea()}><Crosshair size={17} />{loading ? 'Searching…' : areaMoved ? 'Search this area' : 'Search visible map'}<span aria-hidden="true">↗</span></button>
                                {!compactControls && <small>{committedCoverage === 'area' ? `${resultCount} results in the searched area` : 'Switch to clubs in the visible map'}</small>}
                            </div>}

                        </section>
                    </div>
                </div>
            </div>

            {!planningOpen && selectedRecord && hasSelectedResult && (
                <aside className="atlas-detail-dock pointer-events-auto" aria-label={selectedRecord.entityType === 'STADIUM' ? 'Selected venue details' : 'Selected club details'}>
                    {panelContent}
                    {context === 'authenticated' && !embedded && selectedRecord.latitude!=null && selectedRecord.longitude!=null && <button className="map-plan-save-place" onClick={()=>{setPlanCandidate({key:selectedRecord.key,name:selectedRecord.title,address:selectedRecord.locationName||selectedRecord.rawMapMarker?.cityName||'',latitude:selectedRecord.latitude!,longitude:selectedRecord.longitude!,type:(selectedRecord.rawMapMarker?.entityType||'MANUAL') as PlanPlace['type'],entityId:selectedRecord.rawMapMarker?.entityId,notes:''});openPlanning();}}><BookmarkPlus size={16}/>Save to a journey plan</button>}
                </aside>
            )}

            {walkingTarget && <MapWalkingPanel title={walkingTarget.title} route={walkingRoute} loading={walkingLoading}
                picking={pickingOrigin} error={walkingError}
                directionsUrl={'https://www.google.com/maps/dir/?api=1&destination=' + walkingTarget.latitude + ',' + walkingTarget.longitude + '&travelmode=walking' + (walkingOrigin ? '&origin=' + walkingOrigin[1] + ',' + walkingOrigin[0] : '')}
                onPick={beginPickingOrigin}
                onLocate={() => {
                    if (!navigator.geolocation) { setWalkingError('Location is unavailable. Choose a start on the map.'); return; }
                    walkingRequest.current?.abort();
                    const request = new AbortController(); walkingRequest.current = request;
                    setWalkingLoading(true); setWalkingError(null);
                    navigator.geolocation.getCurrentPosition(position => {
                        if (!request.signal.aborted) void calculateWalk([position.coords.longitude, position.coords.latitude]);
                    }, () => {
                        if (!request.signal.aborted) { setWalkingLoading(false); setWalkingError('Your location is unavailable. Choose a start on the map.'); }
                    }, { timeout: 10000, enableHighAccuracy: true });
                }}
                onClose={() => { walkingRequest.current?.abort(); setWalkingTarget(null); setWalkingRoute(null); setPickingOrigin(false); setWalkingLoading(false); }} />}
            {pickingOrigin && <div role="status" className="atlas-pick-hint"><Crosshair size={18} />Choose your starting point on the map<button onClick={() => setPickingOrigin(false)} aria-label="Cancel picking start"><X size={16} /></button></div>}
            {context === 'authenticated' && !embedded && !planningOpen && <button className="map-plan-entry" onClick={openPlanning}><ClipboardList size={17}/>Plan a journey</button>}
            {planningOpen && <Suspense fallback={<div className="map-planning-loading" role="status">Opening planning workspace…</div>}><MapPlanWorkspace onJourney={setJourneyMap} onRoute={setPlanStops} onMapClick={registerPlanMapClick} onPickMode={setPlanPickMode} onPreview={setPlanPreview} onLayout={planLayout} initialClubId={membership?.clubId} candidate={planCandidate} onCandidateUsed={consumePlanCandidate} onPlaces={setPlanPlaces} onFocus={focusPlanPlace} onExplore={()=>{setIsClubRailOpen(true);}} onClose={()=>{setIsFilterOpen(window.innerWidth>=1100);}}/></Suspense>}
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
        </div>
    );
};
