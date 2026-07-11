import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import MapGL, { Layer, Marker, Popup, Source, GeolocateControl, NavigationControl, useMap } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useNavigate } from 'react-router-dom';
import {
    Building2,
    CheckCheck,
    ChevronLeft,
    Clock,
    Eye,
    ExternalLink,
    ListFilter,
    Loader2,
    LocateFixed,
    Map as MapIcon,
    MapPin,
    Menu,
    Navigation,
    RefreshCw,
    Search,
    ShieldCheck,
    Sparkles,
    Trophy,
    Users,
    X
} from 'lucide-react';
import { apiClient, API_ORIGIN } from '../api/axiosConfig';
import { fetchNearbyMap, type MapMarkerDto } from '../api/map';
import { MapHelpHint } from '../components/map/MapHelpHint';
import { MapFilterSidebar, defaultMapFilters, type MapEntityType, type MapFilters } from '../components/map/MapFilterSidebar';
import { useAuth } from '../context/AuthContext';
import { fetchMyClubMembershipContext } from '../features/clubs/api';
import { isLeadershipRole } from '../features/clubs/domain';
import { createScheduleChallenge, fetchPublicScheduleEvents, type ScheduleEventOccurrence } from '../features/schedule/api';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

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
    cityName?: string | null;
    countryName?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    logoUrl?: string | null;
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

interface MarkerCluster {
    key: string;
    latitude: number;
    longitude: number;
    records: DiscoveryRecord[];
}

const DEFAULT_CENTER: [number, number] = [42.3154, 43.3569]; // Caucasus — most seed clubs are here
const MAP_HORIZON_DAYS = 90;
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
    const city = club.cityName ?? extractCityCountry(club.addressText).city;
    const country = club.countryName ?? extractCityCountry(club.addressText).country;
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
        rawMapMarker: marker
    };
};

const getRecordTypeLabel = (record: DiscoveryRecord) => {
    switch (record.entityType) {
        case 'CLUB': return 'Club';
        case 'TRYOUT': return 'Tryout';
        case 'MATCH': return record.matchSubtype === 'FRIENDLY' ? 'Friendly' : 'Match';
        case 'TOURNAMENT': return 'Tournament';
        default: return 'Match';
    }
};

const getRecordTypeMeta = (record: DiscoveryRecord) => {
    if (record.entityType === 'CLUB') {
        return record.official ? 'Verified club' : 'Club profile';
    }
    if (record.entityType === 'TRYOUT') {
        return 'Public tryout';
    }
    if (record.entityType === 'TOURNAMENT') {
        return record.statusLabel === 'ACTIVE' ? 'Active tournament' : 'Upcoming tournament';
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

const getMarkerTone = (record: DiscoveryRecord) => {
    switch (record.entityType) {
        case 'CLUB': return 'club';
        case 'TRYOUT': return 'tryout';
        case 'MATCH': return 'match';
        case 'TOURNAMENT': return 'tournament';
        default: return 'match';
    }
};

function MapFocusController({ target, onSettled }: { target: [number, number] | null; onSettled: () => void }) {
    const { current: map } = useMap();

    useEffect(() => {
        if (!target || !map) return;
        map.flyTo({ center: [target[1], target[0]], duration: 350 });
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
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div>
                            <p className="map-eyebrow">Match response</p>
                            <h2 className="mt-2 text-xl font-bold text-primary">Respond to match need</h2>
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
                    <div className="flex items-center justify-between text-xs text-secondary">
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
            className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-surface/50 transition-colors"
        >
            <span className="text-sm font-semibold text-primary">{title}</span>
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
                <div className="relative h-40 w-full overflow-hidden bg-surface-inset">
                    <img src={bannerUrl} alt="" className="h-full w-full object-cover opacity-70" />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-base/60" />
                </div>
            ) : (
                <div className="h-12 w-full bg-base" />
            )}

            {/* Logo — upper half sits inside the banner zone, lower half below */}
            {logoUrl && (
                <div className="absolute left-5 bottom-0 translate-y-1/2">
                    <div className="h-[84px] w-[84px] overflow-hidden rounded-2xl bg-surface">
                        <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                </div>
            )}
        </div>

        {/* ── Header: name + type (left-padded to make room for overlapping logo) ── */}
        <div className={`shrink-0 px-5 pt-4 pb-3 ${logoUrl ? 'pl-[120px]' : ''}`}>
            <h2 className="text-[18px] font-bold text-primary leading-tight line-clamp-2">
                {record.title}
            </h2>
            <p className="mt-0.5 text-[13px] text-secondary">{typeSubtitle}</p>
            {record.clubName && record.entityType !== 'CLUB' && (
                <p className="mt-0.5 text-[13px] font-medium text-secondary truncate">{record.clubName}</p>
            )}
            <button type="button" onClick={onClose} className="absolute top-3 right-3 map-icon-button">
                <X className="h-5 w-5" />
            </button>
        </div>

        {/* ── Info rows ───────────────────────────── */}
        <div className="min-h-0 flex-1 overflow-y-auto">
            {/* Quick stats strip */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-[13px] text-secondary">
                {(clubProfile?.memberCount != null || clubProfile?.followerCount != null) && (
                    <>
                        <Users className="h-3.5 w-3.5 text-muted" />
                        <span className="font-semibold text-primary">{clubProfile?.memberCount ?? record.memberCount}</span>
                        <span>members</span>
                        <span className="text-muted">·</span>
                        <span className="font-semibold text-primary">{clubProfile?.followerCount ?? record.followerCount}</span>
                        <span>followers</span>
                    </>
                )}
                {(clubProfile?.isOfficial ?? record.official) && (
                    <>
                        <span className="text-muted">·</span>
                        <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--accent-primary)]" />
                        <span>Official</span>
                    </>
                )}
            </div>

            {addressLine && (
                <div className="flex items-start gap-3 px-5 py-2.5 border-t border-[var(--map-panel-border)]">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                    <p className="text-[14px] leading-5 text-secondary">{addressLine}</p>
                </div>
            )}

            {record.startsAt && (
                <div className={`flex items-center gap-3 px-5 py-2 ${!addressLine ? 'border-t border-[var(--map-panel-border)]' : ''}`}>
                    <Clock className="h-4 w-4 shrink-0 text-muted" />
                    <p className="text-[14px] text-secondary">
                        {formatDateTime(record.startsAt)}
                        {record.endsAt && <span className="text-muted"> — {formatDateTime(record.endsAt)}</span>}
                    </p>
                </div>
            )}

            {record.distanceKm != null && (
                <div className={`flex items-center gap-3 px-5 py-2 ${!addressLine && !record.startsAt ? 'border-t border-[var(--map-panel-border)]' : ''}`}>
                    <Navigation className="h-4 w-4 shrink-0 text-muted" />
                    <p className="text-[14px] text-secondary">
                        {record.distanceKm < 1
                            ? `${Math.round(record.distanceKm * 1000)} m away`
                            : `${record.distanceKm.toFixed(1)} km away`}
                    </p>
                </div>
            )}

            {/* ── Description — always visible ──────── */}
            {description && (
                <div className="px-5 pt-3 mt-1 border-t border-[var(--map-panel-border)]">
                    <p className="text-[14px] leading-6 text-secondary line-clamp-3">
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
                                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--map-panel-border)] px-4 py-1.5 text-[13px] font-medium text-secondary hover:border-[color:var(--accent-primary)] hover:text-[color:var(--accent-primary)] transition-colors"
                            >
                                {action.icon}
                                {action.label}
                            </a>
                        ) : (
                            <button
                                key={action.label}
                                type="button"
                                onClick={action.onClick}
                                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--map-panel-border)] px-4 py-1.5 text-[13px] font-medium text-secondary hover:border-[color:var(--accent-primary)] hover:text-[color:var(--accent-primary)] transition-colors"
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
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--map-panel-border)] px-4 py-2.5 text-[14px] font-semibold text-primary hover:bg-surface transition-colors"
            >
                <Building2 className="h-4 w-4" />
                View full profile
            </button>

            {record.entityType === 'MATCH' && canRespond && (
                <button
                    type="button"
                    onClick={onRespond}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--accent-primary)] py-2.5 text-[14px] font-bold text-white hover:opacity-90 transition-opacity"
                >
                    Respond
                </button>
            )}
        </div>
    </div>
    );
};

export const MapPage = () => {
    const navigate = useNavigate();
    const { status } = useAuth();
    const [filters, setFilters] = useState<MapFilters>(defaultMapFilters);
    const [fetchVersion, setFetchVersion] = useState(0);
    const triggerFetch = useCallback(() => setFetchVersion((v) => v + 1), []);
    const [viewMode, setViewMode] = useState<ViewMode>('MAP');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const deferredSearch = useDeferredValue(searchInput.trim());
    const [viewportCenter, setViewportCenter] = useState<[number, number]>(DEFAULT_CENTER);
    const [currentZoom, setCurrentZoom] = useState(11);
    const [focusTarget, setFocusTarget] = useState<[number, number] | null>(null);
    const [loading, setLoading] = useState(true);
    const [initialLoad, setInitialLoad] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mapMarkers, setMapMarkers] = useState<MapMarkerDto[]>([]);
    const [clubRecords, setClubRecords] = useState<DiscoveryRecord[]>([]);
    const [totalMapElements, setTotalMapElements] = useState(0);
    const [currentPage, setCurrentPage] = useState(0);
    const [hasMorePages, setHasMorePages] = useState(false);
    const [membership, setMembership] = useState<{ clubId?: number | null; clubName?: string | null; myRole?: string | null } | null>(null);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [activeClusterKey, setActiveClusterKey] = useState<string | null>(null);
    const [clubProfiles, setClubProfiles] = useState<Record<number, ClubProfileSummary>>({});
    const [responseModalRecord, setResponseModalRecord] = useState<DiscoveryRecord | null>(null);
    const [responseNote, setResponseNote] = useState('');
    const [responseError, setResponseError] = useState<string | null>(null);
    const [responseSubmitting, setResponseSubmitting] = useState(false);
    const [designMode, setDesignMode] = useState<'futuristic' | 'classic'>('futuristic');
    const mapStyleUrl = designMode === 'futuristic'
        ? 'mapbox://styles/mapbox/navigation-night-v1'
        : 'mapbox://styles/mapbox/streets-v12';

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

                const wantsClubs = filters.entityType.includes('CLUB');
                const nonClubTypes = filters.entityType.filter((t) => t !== 'CLUB');

                // --- Fetch clubs globally from /api/clubs (no spatial filter) ---
                const clubPromise: Promise<ClubDirectoryRecord[]> = wantsClubs
                    ? (async () => {
                        const params = new URLSearchParams();
                        params.set('size', '100');
                        params.set('sort', 'NAME');
                        if (filters.clubs.city) params.set('city', filters.clubs.city);
                        if (filters.clubs.country) params.set('country', filters.clubs.country);
                        if (deferredSearch) params.set('search', deferredSearch);
                        if (filters.clubs.officialOnly) {
                            // No server-side officialOnly — filter client-side
                        }
                        const res = await apiClient.get<ClubDirectoryRecord[] | { content: ClubDirectoryRecord[] }>(
                            `/clubs?${params.toString()}`
                        );
                        const data = res.data;
                        return Array.isArray(data) ? data : data?.content ? data.content : [];
                    })()
                    : Promise.resolve([] as ClubDirectoryRecord[]);

                // --- Fetch non-club entities from spatial endpoint ---
                const isTryoutSelected = nonClubTypes.includes('TRYOUT');
                const isMatchSelected = nonClubTypes.includes('MATCH');
                const activeDateWindow = isTryoutSelected ? filters.tryouts.dateWindow :
                    isMatchSelected ? filters.matches.dateWindow : null;
                let dateFrom: string | undefined;
                let dateTo: string | undefined;
                if (activeDateWindow && activeDateWindow !== 'ANY' && nonClubTypes.length > 0) {
                    const now = new Date();
                    dateFrom = toIsoWindow(now);
                    const days = activeDateWindow === 'NEXT_7_DAYS' ? 7 : activeDateWindow === 'NEXT_30_DAYS' ? 30 : 90;
                    dateTo = toIsoWindow(new Date(now.getTime() + days * 24 * 60 * 60 * 1000));
                }

                const serverAgeGroups = (isTryoutSelected && filters.tryouts.ageGroups.length > 0) ? filters.tryouts.ageGroups
                    : (isMatchSelected && filters.matches.ageGroups.length > 0) ? filters.matches.ageGroups : undefined;
                const serverGender = (isTryoutSelected && filters.tryouts.genders.length > 0) ? filters.tryouts.genders
                    : (isMatchSelected && filters.matches.genders.length > 0) ? filters.matches.genders : undefined;
                const serverLevel = isMatchSelected && filters.matches.levels.length > 0 ? filters.matches.levels : undefined;

                const spatialCity = filters.tryouts.city || filters.matches.city || undefined;
                const spatialCountry = filters.tryouts.country || filters.matches.country || undefined;

                const spatialPromise: Promise<{ content: MapMarkerDto[]; totalElements: number }> =
                    nonClubTypes.length > 0
                        ? fetchNearbyMap({
                            lat: viewportCenter[0],
                            lng: viewportCenter[1],
                            radius: 250, // max radius — client-side distanceKm slider still filters visually
                            type: nonClubTypes as MapEntityType[],
                            cities: spatialCity ? [spatialCity] : undefined,
                            countries: spatialCountry ? [spatialCountry] : undefined,
                            query: deferredSearch || undefined,
                            dateFrom,
                            dateTo,
                            ageGroups: serverAgeGroups,
                            gender: serverGender,
                            level: serverLevel,
                            page: currentPage,
                            size: 50
                        })
                        : Promise.resolve({ content: [], totalElements: 0 });

                const [membershipContext, clubs, mapData] = await Promise.all([
                    membershipPromise,
                    clubPromise,
                    spatialPromise
                ]);

                if (!active) return;

                const clubRecs = clubs.map(buildClubRecord);
                setClubRecords(clubRecs);
                setMapMarkers(mapData.content);
                setTotalMapElements(clubRecs.length + mapData.totalElements);
                setHasMorePages((currentPage + 1) * 50 < mapData.totalElements);
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
    }, [status, fetchVersion]);

    // Re-fetch when filters change (skip initial mount)
    const initialFiltersRef = useRef(filters);
    useEffect(() => {
        if (filters !== initialFiltersRef.current) triggerFetch();
    }, [filters]);

    const allRecords = useMemo(
        () => [...clubRecords, ...mapMarkers.map(buildMapMarkerRecord)],
        [mapMarkers, clubRecords]
    );

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
            // Type filtering handled server-side; client only filters what server can't
            if (query && !record.searchText.includes(query)) return false;

            if (record.entityType === 'CLUB') {
                if (filters.clubs.officialOnly && !record.official) return false;
                return true;
            }

            // Time-of-day filter (server doesn't handle this)
            const timeWindows = record.entityType === 'TRYOUT' ? filters.tryouts.timeWindows : filters.matches.timeWindows;
            if (timeWindows.length > 0) {
                const window = getTimeWindow(record.startsAt);
                if (!window || !timeWindows.includes(window)) return false;
            }

            // Age/level/gender from extracted text (server doesn't extract these)
            const selectedGenders = record.entityType === 'TRYOUT' ? filters.tryouts.genders : filters.matches.genders;
            if (selectedGenders.length > 0 && !record.genders.some((gender) => selectedGenders.includes(gender))) return false;

            // Level filter only applies to matches (tryouts don't have a level dimension)
            if (record.entityType === 'MATCH' && filters.matches.levels.length > 0
                && (!record.level || !filters.matches.levels.includes(record.level))) return false;

            const selectedAges = record.entityType === 'TRYOUT' ? filters.tryouts.ageGroups : filters.matches.ageGroups;
            if (selectedAges.length > 0 && !record.ageGroups.some((ageGroup) => selectedAges.includes(ageGroup))) return false;

            if (record.entityType === 'MATCH') {
                if (record.matchSubtype && filters.matches.subtypes.length > 0 && !filters.matches.subtypes.includes(record.matchSubtype)) return false;
            }

            // Server already filtered by gender/age/level/date for MATCH and TRYOUT
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

    const radiusVignette = useMemo(() => {
        const maxRadius = 150;
        if (filters.distanceKm >= maxRadius) return null;

        const center = viewportCenter;
        const distanceKm = filters.distanceKm;
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
    }, [filters.distanceKm, viewportCenter]);

    const selectedRecord = useMemo(() => listRecords.find((record) => record.key === selectedKey) ?? null, [listRecords, selectedKey]);
    const activeCluster = useMemo(() => mapClusters.find((cluster) => cluster.key === activeClusterKey) ?? null, [activeClusterKey, mapClusters]);
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

    const handleGoBack = useCallback(() => {
        if (window.history.length > 1) {
            navigate(-1);
            return;
        }
        navigate('/feed');
    }, [navigate]);

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
        selectedRecord.rawMapMarker?.scheduleEventId &&
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
        setActiveClusterKey(null);
        selectRecord(cluster.records[0]);
    };

    const submitResponse = async () => {
        const scheduleEventId = responseModalRecord?.rawMapMarker?.scheduleEventId;
        if (!scheduleEventId || !responseModalRecord.clubId || !membership?.clubId) {
            return;
        }

        setResponseSubmitting(true);
        setResponseError(null);

        try {
            const updated = await createScheduleChallenge(scheduleEventId, {
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

    const hasSelectedResult = Boolean(selectedRecord);
    const toolbarCount = viewMode === 'MAP' ? `${mapRecords.length} visible` : `${listRecords.length} shown`;

    return (
        <div className={`map-page-shell club-page-shell map-workspace h-full min-h-0 w-full overflow-hidden map-design-${designMode} relative`}>
            {!initialLoad && !error && (
                <div className="map-canvas-frame absolute inset-0 z-0 overflow-hidden border-0 rounded-none">
                    <MapGL
                        mapboxAccessToken={MAPBOX_TOKEN}
                        initialViewState={{
                            latitude: DEFAULT_CENTER[0],
                            longitude: DEFAULT_CENTER[1],
                            zoom: 8,
                            pitch: 45,
                            bearing: -17
                        }}
                        style={{ width: '100%', height: '100%' }}
                        mapStyle={mapStyleUrl}
                        projection="globe"
                        renderWorldCopies={false}
                        onMoveEnd={(evt) => {
                            const center = evt.target.getCenter();
                            setViewportCenter([Number(center.lat.toFixed(6)), Number(center.lng.toFixed(6))]);
                            setCurrentZoom(evt.target.getZoom());
                        }}
                    >
                        <MapFocusController target={focusTarget} onSettled={handleFocusSettled} />
                        <MapSizeGuard layoutSignature={layoutSignature} />
                        <Source id="buildings" type="vector" url="mapbox://mapbox.mapbox-streets-v8">
                            <Layer
                                id="buildings-3d"
                                type="fill-extrusion"
                                source-layer="building"
                                minzoom={13.5}
                                paint={{
                                    'fill-extrusion-color': '#1a1a2e',
                                    'fill-extrusion-height': ['get', 'height'],
                                    'fill-extrusion-base': ['get', 'min_height'],
                                    'fill-extrusion-opacity': 0.5
                                }}
                            />
                        </Source>
                        {viewMode === 'MAP' && radiusVignette && (
                            <Source id="radius-vignette" type="geojson" data={radiusVignette}>
                                <Layer
                                    id="radius-vignette-fill"
                                    type="fill"
                                    paint={{
                                        'fill-color': '#080c14',
                                        'fill-opacity': 0.22,
                                        'fill-opacity-transition': { duration: 400 },
                                        'fill-antialias': true,
                                    }}
                                />
                            </Source>
                        )}
                        <NavigationControl position="bottom-right" />
                        <GeolocateControl
                            position="bottom-right"
                            positionOptions={{ enableHighAccuracy: true }}
                            trackUserLocation={true}
                            showUserHeading={true}
                        />
                        {mapClusters.map((cluster) => {
                            const primaryRecord = cluster.records[0];
                            const isSelected = cluster.records.some((r) => r.key === selectedKey);
                            const toneKey = getMarkerTone(primaryRecord);
                            const beamHeight = currentZoom <= 9 ? 200 : currentZoom <= 11 ? 160 : currentZoom <= 13 ? 120 : currentZoom <= 15 ? 70 : 45;
                            const baseScale = currentZoom <= 9 ? 0.5 : currentZoom <= 11 ? 0.75 : currentZoom <= 13 ? 1 : currentZoom <= 15 ? 1.6 : 2.4;
                            return (
                                <Marker
                                    key={cluster.key}
                                    longitude={cluster.longitude}
                                    latitude={cluster.latitude}
                                    anchor="bottom"
                                    onClick={() => handleClusterClick(cluster)}
                                >
                                    <div
                                        className={`talanti-map-marker talanti-map-marker--${toneKey} ${isSelected ? 'is-selected' : ''}`}
                                        style={{ '--beam-height': `${beamHeight}px`, '--base-scale': String(baseScale) } as React.CSSProperties}
                                    >
                                        <div className="talanti-map-marker__blip" />
                                        {cluster.records.length > 1 && (
                                            <span className="talanti-map-marker__badge">{cluster.records.length}</span>
                                        )}
                                    </div>
                                </Marker>
                            );
                        })}
                        {viewMode === 'LIST' && selectedRecord && selectedRecord.latitude != null && selectedRecord.longitude != null && (
                            <Popup
                                longitude={selectedRecord.longitude}
                                latitude={selectedRecord.latitude}
                                anchor="bottom"
                                offset={40}
                                onClose={() => setSelectedKey(null)}
                                closeButton={false}
                            >
                                <div className="rounded-xl border border-subtle bg-[rgba(12,18,27,0.96)] px-4 py-3 shadow-[0_12px_28px_rgba(2,6,12,0.5)] backdrop-blur-xl max-w-[260px]">
                                    <div className="flex items-center gap-2">
                                        <span className="map-pill map-pill--accent text-[10px]">{getRecordTypeLabel(selectedRecord)}</span>
                                        {selectedRecord.challengeState === 'OPEN' && <span className="map-pill text-[10px]">Open</span>}
                                    </div>
                                    <p className="mt-2 text-sm font-bold text-primary">{selectedRecord.title}</p>
                                    {selectedRecord.subtitle && <p className="mt-0.5 text-xs text-secondary">{selectedRecord.subtitle}</p>}
                                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-secondary">
                                        {selectedRecord.locationName && <span>{selectedRecord.locationName}</span>}
                                        {selectedRecord.startsAt && <span>{formatDateTime(selectedRecord.startsAt)}</span>}
                                    </div>
                                    {selectedRecord.clubId && (
                                        <button
                                            type="button"
                                            onClick={() => openClubProfile(selectedRecord)}
                                            className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[color:var(--accent-primary)] hover:underline"
                                        >
                                            <Building2 className="h-3 w-3" />
                                            Open profile
                                        </button>
                                    )}
                                </div>
                            </Popup>
                        )}
                    </MapGL>
                </div>
            )}
            {initialLoad && (
                <div className="absolute inset-0 z-[5] flex items-center justify-center bg-[var(--map-workspace-bg)]">
                    <div className="flex flex-col items-center gap-3 text-center">
                        <Loader2 className="h-8 w-8 animate-spin accent-primary" />
                        <p className="text-sm font-semibold text-secondary">Loading map...</p>
                    </div>
                </div>
            )}
            {loading && !initialLoad && (
                <div className="absolute top-4 right-4 z-[700] pointer-events-none">
                    <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-subtle bg-surface px-3 py-1.5 shadow-sm">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-secondary" />
                        <span className="text-xs text-secondary">Updating...</span>
                    </div>
                </div>
            )}
            {error && (
                <div className="absolute inset-0 z-[5] flex items-center justify-center bg-[var(--map-workspace-bg)] px-6">
                    <div className="map-empty-panel max-w-md px-6 py-6 text-center text-sm leading-6 text-secondary">{error}</div>
                </div>
            )}
            <div className="pointer-events-none flex h-full min-h-0">
                <MapFilterSidebar
                    isVisible={isFilterOpen}
                    filters={filters}
                    onFiltersChange={setFilters}
                    onClose={() => setIsFilterOpen(false)}
                />

                <div className="map-main-column flex min-w-0 flex-1 flex-col">
                    <div className="flex min-h-0 flex-1">
                        <section className="pointer-events-none relative min-h-0 min-w-0 flex-1">
                            <div
                                className={`pointer-events-none absolute top-4 z-[650] transition-[left] duration-200 ${
                                    isFilterOpen ? 'xl:left-[344px]' : 'xl:left-4'
                                } left-4`}
                            >
                                <div className="pointer-events-auto map-toolbar-surface map-toolbar-surface--floating flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsFilterOpen((current) => !current)}
                                        className="map-icon-button shrink-0"
                                        aria-label="Toggle filters"
                                    >
                                        <Menu className="h-4 w-4" />
                                    </button>

                                    <div className="relative w-[180px] sm:w-[240px]">
                                        <div className="map-search-surface map-search-surface--toolbar">
                                            <Search className="h-3.5 w-3.5 text-secondary shrink-0" />
                                            <input
                                                type="text"
                                                value={searchInput}
                                                onChange={(event) => setSearchInput(event.target.value)}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' && suggestions[0]) {
                                                        handleSuggestionPick(suggestions[0]);
                                                    }
                                                }}
                                                placeholder="Search..."
                                                className="map-search-input text-xs"
                                            />
                                            {searchInput && (
                                                <button type="button" onClick={() => setSearchInput('')} className="map-icon-button shrink-0">
                                                    <X className="h-3.5 w-3.5" />
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

                                    <span className="map-count-chip">{toolbarCount}</span>

                                    {filters.entityType.some(t => t !== 'CLUB') && (
                                        <button
                                            type="button"
                                            onClick={triggerFetch}
                                            className="map-icon-button shrink-0"
                                            title="Search this area"
                                        >
                                            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => setDesignMode(m => m === 'futuristic' ? 'classic' : 'futuristic')}
                                        className="map-icon-button shrink-0"
                                        title={designMode === 'futuristic' ? 'Switch to classic look' : 'Switch to futuristic look'}
                                    >
                                        {designMode === 'futuristic'
                                            ? <Sparkles className="h-4 w-4 text-[color:var(--accent-primary)]" />
                                            : <Eye className="h-4 w-4" />
                                        }
                                    </button>

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
                                        <span className="hidden sm:inline">Reset</span>
                                    </button>
                                </div>
                            </div>

                            {viewMode === 'LIST' && (
                                <aside className="pointer-events-auto map-side-panel-shell absolute bottom-4 right-4 top-4 z-[620] hidden w-[360px] overflow-hidden xl:block">
                                    <div className="map-details-panel flex h-full flex-col">
                                        <div className="map-panel-header">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <p className="map-eyebrow">Browse</p>
                                                    <h2 className="mt-2 text-xl font-bold text-primary">{listRecords.length} result{listRecords.length !== 1 ? 's' : ''}</h2>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                                            {listRecords.length === 0 ? (
                                                <div className="flex h-full items-center justify-center p-6">
                                                    <div className="text-center">
                                                        <p className="text-base font-bold text-primary">No results yet.</p>
                                                        <p className="mt-2 text-sm leading-6 text-secondary">Try a wider area or fewer filters.</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {listRecords.map((record) => (
                                                        <button
                                                            key={record.key}
                                                            type="button"
                                                            onClick={() => selectRecord(record)}
                                                            className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                                                                selectedKey === record.key
                                                                    ? 'border-[color:var(--accent-primary)] bg-[color:var(--accent-primary-soft)]'
                                                                    : 'border-subtle hover:border-white/[0.08] hover:bg-surface'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <span className="map-pill map-pill--accent text-[10px]">{getRecordTypeLabel(record)}</span>
                                                                <span className="map-pill text-[10px]">{getRecordTypeMeta(record)}</span>
                                                            </div>
                                                            <p className="mt-2 text-sm font-bold text-primary truncate">{record.title}</p>
                                                            {record.subtitle && <p className="mt-0.5 text-xs text-secondary truncate">{record.subtitle}</p>}
                                                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-secondary">
                                                                {record.locationName && <span className="truncate">{record.locationName}</span>}
                                                                {record.startsAt && <span>{formatDateTime(record.startsAt)}</span>}
                                                                {!record.startsAt && record.entityType === 'CLUB' && <span>Profile discovery</span>}
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </aside>
                            )}

                            {viewMode === 'MAP' && hasSelectedResult && (
                                <aside className="pointer-events-auto map-side-panel-shell absolute bottom-4 right-4 top-4 z-[620] hidden w-[360px] overflow-hidden xl:block">
                                    {panelContent}
                                </aside>
                            )}
                        </section>
                    </div>
                </div>
            </div>

            {viewMode === 'MAP' && selectedRecord && (
                <div className="pointer-events-auto map-mobile-panel fixed inset-x-4 bottom-4 top-auto z-[1200] max-h-[72vh] overflow-hidden xl:hidden">
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
