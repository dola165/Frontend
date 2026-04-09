import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Circle, MapContainer, Marker, TileLayer, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import {
    ArrowRight,
    Building2,
    CheckCheck,
    ChevronLeft,
    ChevronRight,
    Filter,
    ListFilter,
    Loader2,
    LocateFixed,
    Map as MapIcon,
    MapPin,
    Navigation,
    Search,
    ShieldCheck,
    Trophy,
    Users,
    X
} from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { MapFilterSidebar, defaultMapFilters, type MapEntityType, type MapFilters } from '../components/map/MapFilterSidebar';
import { useAuth } from '../context/AuthContext';
import { fetchMyClubMembershipContext } from '../features/clubs/api';
import { isLeadershipRole } from '../features/clubs/domain';
import { createScheduleChallenge, fetchPublicScheduleEvents, type ScheduleEventOccurrence } from '../features/schedule/api';
import 'leaflet/dist/leaflet.css';

type ViewMode = 'MAP' | 'LIST';
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
    latitude?: number | null;
    longitude?: number | null;
    logoUrl?: string | null;
}

interface ClubProfileSummary extends ClubDirectoryRecord {
    bannerUrl?: string | null;
    trustedByClubs?: Array<{ clubId: number; clubName: string }>;
    honours?: Array<{ id: number; title: string; yearWon: number; description?: string | null }>;
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
    rawEvent?: ScheduleEventOccurrence;
}

interface SearchSuggestion {
    id: string;
    label: string;
    meta: string;
    center: [number, number] | null;
    recordKey?: string;
}

interface MarkerCluster {
    key: string;
    latitude: number;
    longitude: number;
    records: DiscoveryRecord[];
}

const DEFAULT_CENTER: [number, number] = [41.7151, 44.8271];
const MAP_HORIZON_DAYS = 90;
const MARKER_ICON_CACHE = new Map<string, L.DivIcon>();
const AGE_GROUP_REGEX = /\b(U8|U9|U10|U11|U12|U13|U14|U15|U16|U17|U18|U19|U21|Senior)\b/gi;
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

const haversineKm = (from: [number, number], latitude?: number | null, longitude?: number | null) => {
    if (latitude == null || longitude == null) {
        return Number.POSITIVE_INFINITY;
    }
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const latDelta = toRadians(latitude - from[0]);
    const lngDelta = toRadians(longitude - from[1]);
    const a =
        Math.sin(latDelta / 2) ** 2 +
        Math.cos(toRadians(from[0])) * Math.cos(toRadians(latitude)) * Math.sin(lngDelta / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const extractAgeGroups = (value: string) => {
    const matches = value.match(AGE_GROUP_REGEX) ?? [];
    return Array.from(new Set(matches.map((entry) => entry.toUpperCase().startsWith('U') ? entry.toUpperCase() : 'Senior')));
};

const extractGenders = (value: string): DerivedGender[] => {
    const normalized = normalizeText(value);
    const genders: DerivedGender[] = [];
    if (normalized.includes('girls') || normalized.includes('female')) genders.push('Girls');
    if (normalized.includes('women') || normalized.includes('ladies')) genders.push('Women');
    if (normalized.includes('boys')) genders.push('Boys');
    if (normalized.includes('men') || normalized.includes('male')) genders.push('Men');
    if (normalized.includes('mixed') || normalized.includes('co-ed') || normalized.includes('coed')) genders.push('Mixed');
    return Array.from(new Set(genders));
};

const extractLevel = (value: string): DerivedLevel | null => {
    const normalized = normalizeText(value);
    if (normalized.includes('academy')) return 'Academy';
    if (normalized.includes('grassroots')) return 'Grassroots';
    if (normalized.includes('amateur')) return 'Amateur';
    if (normalized.includes('youth')) return 'Youth';
    return null;
};

const extractTravelPreference = (value: string): DerivedTravelPreference | null => {
    const normalized = normalizeText(value);
    if (normalized.includes('home only') || normalized.includes('host only')) return 'HOME_ONLY';
    if (normalized.includes('willing to travel') || normalized.includes('can travel') || normalized.includes('away ok')) return 'WILL_TRAVEL';
    if (normalized.includes('neutral')) return 'NEUTRAL';
    if (normalized.includes('flexible')) return 'FLEXIBLE';
    return null;
};

const extractCityCountry = (value?: string | null) => {
    if (!value) {
        return { city: null, country: null };
    }
    const parts = value.split(',').map((part) => part.trim()).filter(Boolean);
    return {
        city: parts[0] ?? null,
        country: parts.length > 1 ? parts[parts.length - 1] : null
    };
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

const matchDateWindow = (value: string | null, window: 'NEXT_7_DAYS' | 'NEXT_30_DAYS' | 'NEXT_90_DAYS') => {
    if (!value) {
        return false;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return false;
    }
    const now = new Date();
    const diff = parsed.getTime() - now.getTime();
    const limitDays = window === 'NEXT_7_DAYS' ? 7 : window === 'NEXT_30_DAYS' ? 30 : 90;
    return diff >= 0 && diff <= limitDays * 24 * 60 * 60 * 1000;
};

const joinSearchText = (...parts: Array<string | null | undefined>) => normalizeText(parts.filter(Boolean).join(' '));

const getMatchState = (event: ScheduleEventOccurrence): DerivedMatchState => {
    if (event.challengeStatus === 'OPEN') return 'OPEN';
    if (event.challengeStatus === 'PENDING') return 'PENDING';
    return 'CONFIRMED';
};

const buildClubRecord = (club: ClubDirectoryRecord): DiscoveryRecord => {
    const { city, country } = extractCityCountry(club.addressText);
    return {
        key: `club:${club.id}`,
        entityType: 'CLUB',
        source: 'CLUB',
        title: club.name,
        subtitle: club.type || null,
        description: club.description || null,
        clubId: club.id,
        clubName: club.name,
        startsAt: null,
        endsAt: null,
        locationName: club.addressText ?? null,
        latitude: club.latitude ?? null,
        longitude: club.longitude ?? null,
        official: Boolean(club.isOfficial),
        followerCount: club.followerCount ?? 0,
        memberCount: club.memberCount ?? 0,
        typeLabel: club.type || null,
        statusLabel: club.statusLabel ?? null,
        matchSubtype: null,
        challengeState: null,
        locationState: club.latitude != null && club.longitude != null ? 'PINNED' : 'OPEN_VENUE',
        ageGroups: [],
        genders: [],
        level: null,
        travelPreference: null,
        city,
        country,
        searchText: joinSearchText(club.name, club.description, club.addressText, club.type)
    };
};

const buildScheduleRecord = (event: ScheduleEventOccurrence, clubsById: Map<number, ClubDirectoryRecord>): DiscoveryRecord | null => {
    if (event.eventType !== 'TRYOUT' && event.eventType !== 'MATCH' && event.eventType !== 'FRIENDLY') {
        return null;
    }

    const club = event.clubId != null ? clubsById.get(event.clubId) : undefined;
    const sourceText = [event.title, event.description, event.locationName, event.clubName, event.opponentClubName].filter(Boolean).join(' ');
    const { city, country } = extractCityCountry(event.locationName ?? club?.addressText);

    return {
        key: `event:${event.occurrenceId}`,
        entityType: event.eventType === 'TRYOUT' ? 'TRYOUT' : 'MATCH',
        source: 'SCHEDULE',
        title: event.title,
        subtitle: event.eventType === 'TRYOUT'
            ? (event.clubName ?? club?.name ?? 'Club schedule')
            : [event.eventType === 'FRIENDLY' ? 'Friendly' : 'Match', event.challengeStatus === 'OPEN' ? 'Open Need' : event.opponentClubName].filter(Boolean).join(' / '),
        description: event.description,
        clubId: event.clubId,
        clubName: event.clubName ?? club?.name ?? null,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        locationName: event.locationName ?? club?.addressText ?? null,
        latitude: event.locationLat ?? null,
        longitude: event.locationLng ?? null,
        official: Boolean(club?.isOfficial),
        followerCount: club?.followerCount ?? 0,
        memberCount: club?.memberCount ?? 0,
        typeLabel: club?.type ?? null,
        statusLabel: event.challengeStatus ?? event.status ?? null,
        matchSubtype: event.eventType === 'TRYOUT' ? null : event.eventType === 'FRIENDLY' ? 'FRIENDLY' : 'COMPETITIVE',
        challengeState: event.eventType === 'TRYOUT' ? null : getMatchState(event),
        locationState: event.locationLat != null && event.locationLng != null ? 'PINNED' : 'OPEN_VENUE',
        ageGroups: extractAgeGroups(sourceText),
        genders: extractGenders(sourceText),
        level: extractLevel(sourceText),
        travelPreference: extractTravelPreference(sourceText),
        city,
        country,
        searchText: joinSearchText(event.title, event.description, event.locationName, event.clubName, event.opponentClubName, club?.type),
        rawEvent: event
    };
};

const getRecordTypeLabel = (record: DiscoveryRecord) =>
    record.entityType === 'CLUB' ? 'Club' : record.entityType === 'TRYOUT' ? 'Tryout' : record.matchSubtype === 'FRIENDLY' ? 'Friendly' : 'Match';

const getRecordTypeMeta = (record: DiscoveryRecord) => {
    if (record.entityType === 'CLUB') {
        return record.official ? 'Verified club' : 'Club profile';
    }
    if (record.entityType === 'TRYOUT') {
        return 'Public tryout';
    }
    if (record.challengeState === 'OPEN') {
        return 'Open challenge';
    }
    return record.matchSubtype === 'FRIENDLY' ? 'Friendly fixture' : 'Scheduled match';
};

const getTravelPreferenceLabel = (value: DerivedTravelPreference | null) => {
    if (!value) return null;
    return value
        .split('_')
        .map((part) => `${part.slice(0, 1)}${part.slice(1).toLowerCase()}`)
        .join(' ');
};

const createMarkerIcon = (record: DiscoveryRecord, selected: boolean, count: number) => {
    const toneKey = record.entityType === 'CLUB'
        ? 'club'
        : record.entityType === 'TRYOUT'
            ? 'tryout'
            : record.matchSubtype === 'FRIENDLY'
                ? 'friendly'
                : 'match';
    const cacheKey = `${toneKey}:${selected}:${count > 1}`;
    const cached = MARKER_ICON_CACHE.get(cacheKey);
    if (cached) {
        return cached;
    }

    const icon = L.divIcon({
        className: 'talanti-map-marker-shell',
        html: `<span class="talanti-map-marker talanti-map-marker--${toneKey} ${selected ? 'is-selected' : ''}">
            <img src="/markers/ball.png" alt="" class="talanti-map-marker__ball" />
            ${count > 1 ? `<span class="talanti-map-marker__badge">${count}</span>` : ''}
        </span>`,
        iconSize: [50, 50],
        iconAnchor: [25, 38]
    });

    MARKER_ICON_CACHE.set(cacheKey, icon);
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
        map.flyTo(target, map.getZoom(), { animate: true, duration: 0.35 });
        onSettled();
    }, [map, onSettled, target]);

    return null;
}

function MapSizeGuard({ layoutSignature }: { layoutSignature: string }) {
    const map = useMap();

    useLayoutEffect(() => {
        const container = map.getContainer();
        let frame = 0;
        const invalidate = () => {
            cancelAnimationFrame(frame);
            frame = window.requestAnimationFrame(() => map.invalidateSize({ pan: false, debounceMoveend: true }));
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

        window.addEventListener('resize', invalidate);
        return () => {
            cancelAnimationFrame(frame);
            resizeObserver.disconnect();
            window.removeEventListener('resize', invalidate);
        };
    }, [layoutSignature, map]);

    return null;
}

const DiscoveryQueue = ({
    title,
    records,
    selectedKey,
    onSelect
}: {
    title: string;
    records: DiscoveryRecord[];
    selectedKey: string | null;
    onSelect: (record: DiscoveryRecord) => void;
}) => (
    <div className="map-results-panel flex h-full flex-col">
        <div className="map-panel-header">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="map-eyebrow">{title}</p>
                    <h2 className="mt-2 text-xl font-bold text-primary">Results</h2>
                    <p className="mt-2 text-sm leading-6 text-secondary">
                        Pick a result to review the published brief, location, club context, and next action.
                    </p>
                </div>
                <span className="map-count-chip">{records.length}</span>
            </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
            {records.length === 0 ? (
                <div className="map-empty-panel px-5 py-10">
                    <p className="text-sm font-semibold text-primary">No results match the current filters.</p>
                    <p className="mt-2 text-sm leading-6 text-secondary">Try widening the radius, clearing a few filter groups, or switching to another discovery entity.</p>
                </div>
            ) : (
                <div className="space-y-3 px-4 py-4">
                    {records.map((record) => (
                        <button
                            key={record.key}
                            type="button"
                            onClick={() => onSelect(record)}
                            className={`map-result-row ${selectedKey === record.key ? 'map-result-row--active' : ''}`}
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="map-pill map-pill--accent">{getRecordTypeLabel(record)}</span>
                                    <span className="map-pill">{getRecordTypeMeta(record)}</span>
                                    {record.locationState === 'OPEN_VENUE' && <span className="map-pill">Venue open</span>}
                                </div>

                                <div className="mt-3">
                                    <p className="text-base font-bold text-primary">{record.title}</p>
                                    {record.subtitle && <p className="mt-1 text-sm text-secondary">{record.subtitle}</p>}
                                </div>

                                <div className="mt-4 grid gap-2 text-sm text-secondary sm:grid-cols-2">
                                    {record.clubName && record.entityType !== 'CLUB' && (
                                        <div className="truncate font-medium text-primary">{record.clubName}</div>
                                    )}
                                    {record.locationName && <div className="truncate">{record.locationName}</div>}
                                    {record.startsAt && <div>{formatDateTime(record.startsAt)}</div>}
                                    {!record.startsAt && record.entityType === 'CLUB' && <div>Profile discovery</div>}
                                </div>

                                {(record.ageGroups.length > 0 || record.genders.length > 0 || record.level) && (
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {record.ageGroups.slice(0, 2).map((ageGroup) => (
                                            <span key={ageGroup} className="map-pill">
                                                {ageGroup}
                                            </span>
                                        ))}
                                        {record.genders.slice(0, 2).map((gender) => (
                                            <span key={gender} className="map-pill">
                                                {gender}
                                            </span>
                                        ))}
                                        {record.level && <span className="map-pill">{record.level}</span>}
                                    </div>
                                )}
                            </div>

                            <div className="flex shrink-0 flex-col items-end justify-between gap-4">
                                <ChevronRight className="h-4 w-4 text-secondary" />
                                <span className="text-xs font-semibold text-secondary">
                                    {record.challengeState === 'OPEN' ? 'Review and respond' : 'Open details'}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    </div>
);

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
    <div className="theme-overlay-strong fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="map-modal-shell w-full max-w-2xl overflow-hidden">
            <div className="map-panel-header">
                <div>
                    <p className="map-eyebrow">Match response</p>
                    <h2 className="mt-2 text-xl font-bold text-primary">Respond to published match need</h2>
                    <p className="mt-2 text-sm leading-6 text-secondary">
                        The published Schedule event stays the source. You are only confirming your club response and adding optional context, not rebuilding the request.
                    </p>
                </div>
                <button type="button" onClick={onClose} className="map-icon-button">
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="space-y-5 px-5 py-5">
                <section className="map-section-card">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="map-pill map-pill--accent">Published need</span>
                        {record.matchSubtype && <span className="map-pill">{record.matchSubtype === 'FRIENDLY' ? 'Friendly' : 'Competitive'}</span>}
                        {record.challengeState && <span className="map-pill">{record.challengeState === 'OPEN' ? 'Open challenge' : record.challengeState}</span>}
                    </div>
                    <p className="mt-3 text-lg font-bold text-primary">{record.title}</p>
                    <p className="mt-2 text-sm leading-6 text-secondary">
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
                    <label className="map-field-label">Supplement note</label>
                    <textarea
                        rows={5}
                        value={note}
                        onChange={(event) => onChangeNote(event.target.value)}
                        maxLength={500}
                        className="map-textarea"
                        placeholder="Add only what the published request does not already cover: travel nuance, squad context, or a short confirmation note."
                    />
                    <div className="flex items-center justify-between text-xs text-secondary">
                        <span>Published requirements will be reused automatically.</span>
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
}) => (
    <div className="map-details-panel flex h-full flex-col">
        <div className="map-panel-header">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="map-eyebrow">
                        {record.source === 'SCHEDULE' ? 'Selected public event' : 'Selected club'}
                    </p>
                    <h2 className="mt-2 text-2xl font-bold text-primary">{record.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-secondary">
                        {record.entityType === 'MATCH'
                            ? 'Review the published match need first, assess the fit, then respond without rewriting the original request.'
                            : record.entityType === 'TRYOUT'
                                ? 'Read the recruitment brief and club context before moving into broader club interaction.'
                                : 'Club discovery still routes into the established Headquarters access flow.'}
                    </p>
                </div>
                <button type="button" onClick={onClose} className="map-icon-button">
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
            <section className="grid gap-3 sm:grid-cols-2">
                <div className="map-section-card">
                    <p className="map-field-label">Club</p>
                    <p className="mt-2 text-base font-bold text-primary">{record.clubName ?? record.title}</p>
                    {record.typeLabel && <p className="mt-1 text-sm text-secondary">{record.typeLabel}</p>}
                </div>
                <div className="map-section-card">
                    <p className="map-field-label">Schedule window</p>
                    <p className="mt-2 text-base font-bold text-primary">{formatDateTime(record.startsAt) ?? 'Always available'}</p>
                    {record.endsAt && <p className="mt-1 text-sm text-secondary">Until {formatDateTime(record.endsAt)}</p>}
                </div>
            </section>

            <section className="map-section-card">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="map-pill map-pill--accent">{getRecordTypeLabel(record)}</span>
                    {record.challengeState && <span className="map-pill">{record.challengeState === 'OPEN' ? 'Challengeable' : record.challengeState}</span>}
                    <span className="map-pill">{record.locationState === 'PINNED' ? 'Location set' : 'Venue open'}</span>
                </div>
                <p className="mt-4 text-sm font-semibold text-primary">What to review</p>
                <div className="mt-3 flex flex-wrap gap-2">
                    {record.matchSubtype && <span className="map-pill">{record.matchSubtype === 'FRIENDLY' ? 'Friendly' : 'Competitive'}</span>}
                    {record.ageGroups.map((ageGroup) => <span key={ageGroup} className="map-pill">{ageGroup}</span>)}
                    {record.genders.map((gender) => <span key={gender} className="map-pill">{gender}</span>)}
                    {record.level && <span className="map-pill">{record.level}</span>}
                    {record.travelPreference && <span className="map-pill">{getTravelPreferenceLabel(record.travelPreference)}</span>}
                </div>
                {record.locationName && (
                    <div className="mt-4 flex items-start gap-2 text-sm leading-6 text-secondary">
                        <MapPin className="mt-1 h-4 w-4 accent-primary" />
                        <span>{record.locationName}</span>
                    </div>
                )}
            </section>

            <section className="map-section-card">
                <p className="map-field-label">Overview</p>
                <p className="mt-3 text-sm leading-7 text-secondary">
                    {record.description || 'The event is public and challengeable, but the club has not published a fuller note yet. The review surface still keeps the club, time window, and location context together before any response is sent.'}
                </p>
            </section>

            <section className="map-section-card">
                <p className="map-field-label">Club background</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="map-stat-card">
                        <div className="flex items-center gap-2 text-xs font-semibold text-secondary"><Users className="h-3.5 w-3.5 accent-primary" /> Members</div>
                        <p className="mt-2 text-lg font-bold text-primary">{clubProfile?.memberCount ?? record.memberCount}</p>
                    </div>
                    <div className="map-stat-card">
                        <div className="flex items-center gap-2 text-xs font-semibold text-secondary"><Building2 className="h-3.5 w-3.5 accent-primary" /> Followers</div>
                        <p className="mt-2 text-lg font-bold text-primary">{clubProfile?.followerCount ?? record.followerCount}</p>
                    </div>
                    <div className="map-stat-card">
                        <div className="flex items-center gap-2 text-xs font-semibold text-secondary"><ShieldCheck className="h-3.5 w-3.5 accent-primary" /> Verification</div>
                        <p className="mt-2 text-lg font-bold text-primary">{(clubProfile?.isOfficial ?? record.official) ? 'Official' : 'Open record'}</p>
                    </div>
                </div>
                <p className="mt-4 text-sm leading-7 text-secondary">{clubProfile?.description || record.description || 'Club background is currently light on the public surface. Open Headquarters for the fuller profile, honours, and internal modules.'}</p>
                {clubProfile?.honours && clubProfile.honours.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                        {clubProfile.honours.slice(0, 3).map((honour) => (
                            <span key={honour.id} className="map-pill">
                                <Trophy className="h-3.5 w-3.5 accent-primary" />
                                {honour.title} {honour.yearWon}
                            </span>
                        ))}
                    </div>
                )}
            </section>
        </div>

        <div className="map-panel-footer">
            <button type="button" onClick={onOpenClub} className="map-secondary-button">
                Access Headquarters
            </button>
            {record.entityType === 'MATCH' && canRespond ? (
                <button type="button" onClick={onRespond} className="map-primary-button">
                    <CheckCheck className="h-3.5 w-3.5" />
                    Respond to match need
                </button>
            ) : (
                <div className="text-xs text-secondary">
                    {record.entityType === 'MATCH' ? 'Review first, then respond if your club is eligible.' : 'Read-first discovery surface'}
                </div>
            )}
        </div>
    </div>
);

export const MapPage = () => {
    const navigate = useNavigate();
    const { status } = useAuth();
    const [filters, setFilters] = useState<MapFilters>(defaultMapFilters);
    const [viewMode, setViewMode] = useState<ViewMode>('MAP');
    const [isFilterOpen, setIsFilterOpen] = useState(() => window.innerWidth >= 1280);
    const [searchInput, setSearchInput] = useState('');
    const deferredSearch = useDeferredValue(searchInput.trim());
    const [viewportCenter, setViewportCenter] = useState<[number, number]>(DEFAULT_CENTER);
    const [focusTarget, setFocusTarget] = useState<[number, number] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [clubs, setClubs] = useState<ClubDirectoryRecord[]>([]);
    const [events, setEvents] = useState<ScheduleEventOccurrence[]>([]);
    const [membership, setMembership] = useState<{ clubId?: number | null; clubName?: string | null; myRole?: string | null } | null>(null);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [activeClusterKey, setActiveClusterKey] = useState<string | null>(null);
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
                const from = new Date();
                const to = new Date();
                to.setDate(to.getDate() + MAP_HORIZON_DAYS);

                const membershipPromise =
                    status === 'authenticated'
                        ? fetchMyClubMembershipContext().catch(() => null)
                        : Promise.resolve(null);

                const [clubResponse, publicEvents, membershipContext] = await Promise.all([
                    apiClient.get<ClubDirectoryRecord[]>('/clubs'),
                    fetchPublicScheduleEvents({ from: toIsoWindow(from), to: toIsoWindow(to) }),
                    membershipPromise
                ]);

                if (!active) {
                    return;
                }

                setClubs(clubResponse.data ?? []);
                setEvents(publicEvents);
                setMembership(membershipContext);
            } catch (requestError) {
                if (!active) {
                    return;
                }
                console.error('Failed to load map discovery data', requestError);
                setError('Unable to load the public discovery surface right now.');
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        void load();
        return () => {
            active = false;
        };
    }, [status]);

    const clubsById = useMemo(() => new Map(clubs.map((club) => [club.id, club])), [clubs]);
    const clubRecords = useMemo(() => clubs.map(buildClubRecord), [clubs]);
    const scheduleRecords = useMemo(
        () => events.map((event) => buildScheduleRecord(event, clubsById)).filter((record): record is DiscoveryRecord => Boolean(record)),
        [clubsById, events]
    );
    const allRecords = useMemo(() => [...clubRecords, ...scheduleRecords], [clubRecords, scheduleRecords]);

    const suggestions = useMemo(() => {
        const query = normalizeText(searchInput);
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
    }, [allRecords, searchInput]);

    const filteredRecords = useMemo(() => {
        const query = normalizeText(deferredSearch);

        return allRecords.filter((record) => {
            if (record.entityType !== filters.entityType) {
                return false;
            }
            if (query && !record.searchText.includes(query)) {
                return false;
            }

            if (record.entityType === 'CLUB') {
                if (filters.clubs.officialOnly && !record.official) return false;
                if (filters.clubs.city && !normalizeText(record.city).includes(normalizeText(filters.clubs.city))) return false;
                if (filters.clubs.country && !normalizeText(record.country).includes(normalizeText(filters.clubs.country))) return false;
                return true;
            }

            const cityFilter = record.entityType === 'TRYOUT' ? filters.tryouts.city : filters.matches.city;
            const countryFilter = record.entityType === 'TRYOUT' ? filters.tryouts.country : filters.matches.country;
            if (cityFilter && !normalizeText(record.city).includes(normalizeText(cityFilter))) return false;
            if (countryFilter && !normalizeText(record.country).includes(normalizeText(countryFilter))) return false;
            if (!matchDateWindow(record.startsAt, record.entityType === 'TRYOUT' ? filters.tryouts.dateWindow : filters.matches.dateWindow)) return false;

            const timeWindows = record.entityType === 'TRYOUT' ? filters.tryouts.timeWindows : filters.matches.timeWindows;
            if (timeWindows.length > 0) {
                const window = getTimeWindow(record.startsAt);
                if (!window || !timeWindows.includes(window)) return false;
            }

            const selectedGenders = record.entityType === 'TRYOUT' ? filters.tryouts.genders : filters.matches.genders;
            if (selectedGenders.length > 0 && !record.genders.some((gender) => selectedGenders.includes(gender))) return false;

            const selectedLevels = record.entityType === 'TRYOUT' ? filters.tryouts.levels : filters.matches.levels;
            if (selectedLevels.length > 0 && (!record.level || !selectedLevels.includes(record.level))) return false;

            const selectedAges = record.entityType === 'TRYOUT' ? filters.tryouts.ageGroups : filters.matches.ageGroups;
            if (selectedAges.length > 0 && !record.ageGroups.some((ageGroup) => selectedAges.includes(ageGroup))) return false;

            if (record.entityType === 'MATCH') {
                if (!record.matchSubtype || !filters.matches.subtypes.includes(record.matchSubtype)) return false;
                if (!record.challengeState || !filters.matches.challengeStates.includes(record.challengeState)) return false;
                if (!filters.matches.locationStates.includes(record.locationState)) return false;
                if (filters.matches.travelPreferences.length > 0 && (!record.travelPreference || !filters.matches.travelPreferences.includes(record.travelPreference))) return false;
            }

            return true;
        });
    }, [allRecords, deferredSearch, filters]);

    const sortedRecords = useMemo(() => {
        const records = [...filteredRecords];
        const distanceFor = (record: DiscoveryRecord) => haversineKm(viewportCenter, record.latitude, record.longitude);
        const timestampFor = (record: DiscoveryRecord) => {
            if (!record.startsAt) return Number.MAX_SAFE_INTEGER;
            const parsed = new Date(record.startsAt).getTime();
            return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
        };

        const compareBySort = (left: DiscoveryRecord, right: DiscoveryRecord) => {
            if (filters.sortBy === 'DISTANCE') {
                return distanceFor(left) - distanceFor(right) || left.title.localeCompare(right.title);
            }
            if (filters.sortBy === 'SOONEST') {
                return timestampFor(left) - timestampFor(right) || left.title.localeCompare(right.title);
            }
            if (filters.sortBy === 'NAME') {
                return left.title.localeCompare(right.title);
            }

            const leftScore = Number(left.official) + Number(left.challengeState === 'OPEN');
            const rightScore = Number(right.official) + Number(right.challengeState === 'OPEN');
            return rightScore - leftScore || timestampFor(left) - timestampFor(right) || distanceFor(left) - distanceFor(right);
        };

        return records.sort(compareBySort);
    }, [filteredRecords, filters.sortBy, viewportCenter]);

    const mapRecords = useMemo(
        () =>
            sortedRecords.filter((record) => {
                if (record.latitude == null || record.longitude == null) {
                    return false;
                }
                return haversineKm(viewportCenter, record.latitude, record.longitude) <= filters.distanceKm;
            }),
        [filters.distanceKm, sortedRecords, viewportCenter]
    );

    const listRecords = useMemo(() => sortedRecords, [sortedRecords]);
    const mapClusters = useMemo(() => {
        const grouped = new Map<string, MarkerCluster>();
        for (const record of mapRecords) {
            const latitude = record.latitude as number;
            const longitude = record.longitude as number;
            const key = `${latitude.toFixed(4)}:${longitude.toFixed(4)}`;
            const existing = grouped.get(key);
            if (existing) {
                existing.records.push(record);
            } else {
                grouped.set(key, { key, latitude, longitude, records: [record] });
            }
        }
        return Array.from(grouped.values());
    }, [mapRecords]);

    const selectedRecord = useMemo(() => listRecords.find((record) => record.key === selectedKey) ?? null, [listRecords, selectedKey]);
    const activeCluster = useMemo(() => mapClusters.find((cluster) => cluster.key === activeClusterKey) ?? null, [activeClusterKey, mapClusters]);
    const noLocationMatchesCount = useMemo(() => listRecords.filter((record) => record.locationState === 'OPEN_VENUE').length, [listRecords]);
    const layoutSignature = `${viewMode}:${Boolean(selectedRecord)}:${Boolean(activeCluster)}:${isFilterOpen}`;

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
        if (selectedKey && !listRecords.some((record) => record.key === selectedKey)) {
            setSelectedKey(null);
        }
        if (activeClusterKey && !mapClusters.some((cluster) => cluster.key === activeClusterKey)) {
            setActiveClusterKey(null);
        }
    }, [activeClusterKey, listRecords, mapClusters, selectedKey]);

    const handleFocusSettled = useCallback(() => setFocusTarget(null), []);

    const selectRecord = useCallback((record: DiscoveryRecord) => {
        setSelectedKey(record.key);
        setActiveClusterKey(null);
        if (record.latitude != null && record.longitude != null) {
            setFocusTarget([record.latitude, record.longitude]);
        }
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
        selectedRecord.rawEvent?.eventId &&
        selectedRecord.clubId &&
        membership?.clubId &&
        membership.clubId !== selectedRecord.clubId &&
        isLeadershipRole(membership?.myRole) &&
        selectedRecord.challengeState === 'OPEN'
    );

    const handleSuggestionPick = (suggestion: SearchSuggestion) => {
        setSearchInput(suggestion.label);
        if (suggestion.center) {
            setViewportCenter(suggestion.center);
            setFocusTarget(suggestion.center);
        }
        if (suggestion.recordKey) {
            const record = allRecords.find((entry) => entry.key === suggestion.recordKey);
            if (record) {
                selectRecord(record);
            }
        }
    };

    const handleClusterClick = (cluster: MarkerCluster) => {
        if (cluster.records.length === 1) {
            selectRecord(cluster.records[0]);
            return;
        }
        setActiveClusterKey(cluster.key);
        setSelectedKey(null);
        setFocusTarget([cluster.latitude, cluster.longitude]);
    };

    const submitResponse = async () => {
        if (!responseModalRecord?.rawEvent?.eventId || !responseModalRecord.clubId || !membership?.clubId) {
            return;
        }

        setResponseSubmitting(true);
        setResponseError(null);

        try {
            const updated = await createScheduleChallenge(responseModalRecord.rawEvent.eventId, {
                challengerClubId: membership.clubId,
                targetClubId: responseModalRecord.clubId,
                note: responseNote.trim() || undefined
            });

            setEvents((current) => current.map((event) => (event.occurrenceId === updated.occurrenceId ? updated : event)));
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
    ) : activeCluster ? (
        <DiscoveryQueue title="Shared pin" records={activeCluster.records} selectedKey={selectedKey} onSelect={selectRecord} />
    ) : (
        <DiscoveryQueue title={viewMode === 'MAP' ? 'Results in view' : 'Browse results'} records={viewMode === 'MAP' ? mapRecords : listRecords} selectedKey={selectedKey} onSelect={selectRecord} />
    );

    return (
        <div className="map-workspace h-full min-h-0 w-full overflow-hidden">
            <div className="flex h-full min-h-0">
                <MapFilterSidebar
                    isVisible={isFilterOpen}
                    filters={filters}
                    onFiltersChange={setFilters}
                    onClose={() => setIsFilterOpen(false)}
                />

                <div className="map-main-column flex min-w-0 flex-1 flex-col">
                    <header className="px-4 pt-4 sm:px-5 sm:pt-5">
                        <div className="map-toolbar-surface">
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                    <div className="flex items-start gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsFilterOpen((current) => !current)}
                                            className="map-icon-button mt-1 xl:hidden"
                                        >
                                            {isFilterOpen ? <ChevronLeft className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
                                        </button>

                                        <div className="min-w-0">
                                            <p className="map-eyebrow">Map discovery</p>
                                            <h1 className="mt-1 text-2xl font-bold text-primary">Find clubs, tryouts, and match opportunities</h1>
                                            <p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">
                                                Search a city, country, club, or published need, then scan the map or browse the result list and review the selected item on the right.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="map-count-chip">{viewMode === 'MAP' ? `${mapRecords.length} visible` : `${listRecords.length} results`}</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setViewportCenter(DEFAULT_CENTER);
                                                setFocusTarget(DEFAULT_CENTER);
                                                setSelectedKey(null);
                                                setActiveClusterKey(null);
                                            }}
                                            className="map-secondary-button"
                                        >
                                            <Navigation className="h-3.5 w-3.5" />
                                            Reset view
                                        </button>
                                    </div>
                                </div>

                                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                                    <div className="relative min-w-0">
                                        <div className="map-search-surface">
                                            <Search className="h-5 w-5 text-secondary" />
                                            <input
                                                type="text"
                                                value={searchInput}
                                                onChange={(event) => setSearchInput(event.target.value)}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' && suggestions[0]) {
                                                        handleSuggestionPick(suggestions[0]);
                                                    }
                                                }}
                                                placeholder="Search clubs, cities, countries, or published schedule needs"
                                                className="map-search-input"
                                            />
                                            {searchInput && (
                                                <button type="button" onClick={() => setSearchInput('')} className="map-icon-button">
                                                    <X className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>

                                        {suggestions.length > 0 && (
                                            <div className="map-suggestion-list">
                                                {suggestions.map((suggestion) => (
                                                    <button
                                                        key={suggestion.id}
                                                        type="button"
                                                        onClick={() => handleSuggestionPick(suggestion)}
                                                        className="map-suggestion-row"
                                                    >
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-bold text-primary">{suggestion.label}</p>
                                                            <p className="mt-1 truncate text-xs text-secondary">{suggestion.meta}</p>
                                                        </div>
                                                        <LocateFixed className="h-4 w-4 accent-primary" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="map-mode-toggle">
                                            <button
                                                type="button"
                                                onClick={() => setViewMode('MAP')}
                                                className={`map-mode-button ${viewMode === 'MAP' ? 'map-mode-button--active' : ''}`}
                                            >
                                                <MapIcon className="h-3.5 w-3.5" />
                                                Map
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setViewMode('LIST')}
                                                className={`map-mode-button ${viewMode === 'LIST' ? 'map-mode-button--active' : ''}`}
                                            >
                                                <ListFilter className="h-3.5 w-3.5" />
                                                Browse
                                            </button>
                                        </div>
                                        <span className="map-helper-note">Filters update live</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </header>

                    <div className="flex min-h-0 flex-1 gap-4 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
                        <section className="relative min-h-0 min-w-0 flex-1">
                            {loading ? (
                                <div className="map-canvas-frame flex h-full items-center justify-center">
                                    <div className="flex flex-col items-center gap-3 text-center">
                                        <Loader2 className="h-8 w-8 animate-spin accent-primary" />
                                        <p className="text-sm font-semibold text-secondary">Loading the public discovery surface.</p>
                                    </div>
                                </div>
                            ) : error ? (
                                <div className="map-canvas-frame flex h-full items-center justify-center px-6">
                                    <div className="map-empty-panel max-w-md px-6 py-6 text-center text-sm leading-6 text-secondary">{error}</div>
                                </div>
                            ) : viewMode === 'MAP' ? (
                                <div className="map-canvas-frame relative h-full overflow-hidden">
                                    <MapContainer center={DEFAULT_CENTER} zoom={11} zoomControl={false} className="h-full w-full">
                                        <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                                        <ZoomControl position="bottomright" />
                                        <MapViewportSync onViewportChange={setViewportCenter} />
                                        <MapFocusController target={focusTarget} onSettled={handleFocusSettled} />
                                        <MapSizeGuard layoutSignature={layoutSignature} />
                                        <Circle
                                            center={viewportCenter}
                                            radius={filters.distanceKm * 1000}
                                            pathOptions={{
                                                color: 'var(--accent-primary)',
                                                fillColor: 'var(--accent-primary)',
                                                fillOpacity: 0.08,
                                                weight: 1.5
                                            }}
                                        />

                                        {mapClusters.map((cluster) => {
                                            const primaryRecord = cluster.records[0];
                                            return (
                                                <Marker
                                                    key={cluster.key}
                                                    position={[cluster.latitude, cluster.longitude]}
                                                    icon={createMarkerIcon(primaryRecord, cluster.records.some((record) => record.key === selectedKey), cluster.records.length)}
                                                    eventHandlers={{ click: () => handleClusterClick(cluster) }}
                                                />
                                            );
                                        })}
                                    </MapContainer>

                                    <div className="pointer-events-none absolute left-4 right-4 top-4 flex flex-col gap-3 sm:right-auto sm:max-w-xs">
                                        <div className="pointer-events-auto map-floating-card">
                                            <p className="map-field-label">In current radius</p>
                                            <p className="mt-2 text-lg font-bold text-primary">{mapRecords.length} mapped results</p>
                                            <p className="mt-2 text-sm leading-6 text-secondary">Pan or zoom the map, or search for a place to jump the viewport instantly.</p>
                                        </div>
                                    </div>

                                    <div className="pointer-events-none absolute inset-x-4 bottom-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                        <div className="pointer-events-auto map-floating-card">
                                            <p className="map-field-label">Viewport center</p>
                                            <p className="mt-2 text-sm font-bold text-primary">
                                                {viewportCenter[0].toFixed(3)}, {viewportCenter[1].toFixed(3)}
                                            </p>
                                        </div>
                                        {noLocationMatchesCount > 0 && filters.entityType === 'MATCH' && (
                                            <div className="pointer-events-auto map-floating-card max-w-sm border-accent-muted bg-accent-muted-soft">
                                                <p className="map-field-label accent-muted">Browse-only opportunities</p>
                                                <p className="mt-2 text-sm leading-6 text-secondary">
                                                    {noLocationMatchesCount} published match need{noLocationMatchesCount === 1 ? '' : 's'} do not have a pinned venue yet, so they stay visible in browse mode instead of on the map.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="map-canvas-frame h-full overflow-y-auto">
                                    {listRecords.length === 0 ? (
                                        <div className="flex h-full items-center justify-center p-6">
                                            <div className="map-empty-panel max-w-md px-6 py-6 text-center">
                                                <p className="text-base font-bold text-primary">No results in browse mode yet.</p>
                                                <p className="mt-2 text-sm leading-6 text-secondary">Widen the radius, clear a few filters, or switch the entity type to explore another public discovery lane.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="map-list-grid p-4 sm:p-5">
                                            {listRecords.map((record) => (
                                                <button
                                                    key={record.key}
                                                    type="button"
                                                    onClick={() => selectRecord(record)}
                                                    className={`map-list-card ${selectedKey === record.key ? 'map-list-card--selected' : ''}`}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="map-pill map-pill--accent">{getRecordTypeLabel(record)}</span>
                                                                <span className="map-pill">{getRecordTypeMeta(record)}</span>
                                                            </div>
                                                            <p className="mt-3 text-lg font-bold text-primary">{record.title}</p>
                                                            {record.subtitle && <p className="mt-1 text-sm text-secondary">{record.subtitle}</p>}
                                                        </div>
                                                        <ArrowRight className="h-4 w-4 text-secondary" />
                                                    </div>

                                                    <div className="mt-4 grid gap-2 text-sm text-secondary sm:grid-cols-2">
                                                        {record.clubName && record.entityType !== 'CLUB' && <div className="font-medium text-primary">{record.clubName}</div>}
                                                        {record.locationName && <div>{record.locationName}</div>}
                                                        {record.startsAt && <div>{formatDateTime(record.startsAt)}</div>}
                                                        {!record.startsAt && record.entityType === 'CLUB' && <div>Profile discovery</div>}
                                                    </div>

                                                    <div className="mt-4 flex flex-wrap gap-2">
                                                        {record.matchSubtype && <span className="map-pill">{record.matchSubtype === 'FRIENDLY' ? 'Friendly' : 'Competitive'}</span>}
                                                        {record.challengeState && <span className="map-pill">{record.challengeState === 'OPEN' ? 'Open challenge' : record.challengeState}</span>}
                                                        <span className="map-pill">{record.locationState === 'PINNED' ? 'Mapped' : 'Venue open'}</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>

                        <aside className="map-side-panel-shell hidden min-h-0 w-[410px] shrink-0 overflow-hidden xl:block">
                            {panelContent}
                        </aside>
                    </div>
                </div>
            </div>

            {(selectedRecord || activeCluster) && (
                <div className="map-mobile-panel fixed inset-x-4 bottom-4 top-auto z-[1200] max-h-[72vh] overflow-hidden xl:hidden">
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
