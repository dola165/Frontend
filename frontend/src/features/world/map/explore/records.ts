import type { MapMarkerDto } from '../../../../api/map';
import { containsPoint, searchRank, type MapBounds } from '../../../../components/map/areaSearch';
import { distanceKm, type Coordinate } from '../../../../components/map/walkingGraph';
import type { Opportunity } from '../../../admissions/types';
import { matchesOpportunity } from '../../../admissions/applicant/mapMatching';
import type { MapFilters, MapTimeWindow } from './discoveryFilters';
import { layerOf, type PlaceTone } from './exploreQuery';

/** One place on the map: a club, venue, fixture, trial, competition or a training group at its venue. */
export interface PlaceRecord {
    key: string;
    entityType: MapMarkerDto['entityType'];
    tone: PlaceTone;
    title: string;
    subtitle: string | null;
    clubId: number | null;
    clubName: string | null;
    startsAt: string | null;
    address: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    verified: boolean;
    members: number;
    followers: number;
    distanceKm: number | null;
    fee: string | null;
    logoUrl: string | null;
    joinPolicy: string | null;
    matchSubtype: 'FRIENDLY' | 'COMPETITIVE' | null;
    openChallenge: boolean;
    ageGroups: string[];
    searchText: string;
    marker?: MapMarkerDto;
    /** A training group shown at its actual venue. */
    opportunity?: Opportunity;
    /** Groups of this club that fit the current filters. */
    groups?: Opportunity[];
}

export function markerRecord(marker: MapMarkerDto): PlaceRecord {
    const subtype = marker.eventSubtype === 'FRIENDLY' ? 'FRIENDLY' : marker.eventSubtype === 'MATCH' || marker.eventSubtype === 'COMPETITIVE' ? 'COMPETITIVE' : null;
    return {
        key: `${marker.entityType.toLowerCase()}:${marker.entityId}`,
        entityType: marker.entityType, tone: layerOf(marker.entityType)?.tone ?? 'club',
        title: marker.title, subtitle: marker.subtitle || null, clubId: marker.clubId ?? null, clubName: marker.clubName || null,
        startsAt: marker.date || null, address: marker.addressText || null, city: marker.cityName || null,
        latitude: marker.latitude, longitude: marker.longitude, verified: marker.verified,
        members: marker.members ?? 0, followers: marker.followers ?? 0, distanceKm: marker.distanceKm ?? null,
        fee: marker.fee || null, logoUrl: marker.logoUrl ?? null, joinPolicy: marker.joinPolicy ?? null,
        matchSubtype: subtype, openChallenge: marker.entityType === 'MATCH' && marker.status === 'OPEN',
        ageGroups: marker.ageGroup ? marker.ageGroup.split(',').map(age => age.trim()).filter(Boolean) : [],
        searchText: [marker.title, marker.subtitle, marker.clubName, marker.addressText, marker.ageGroup].filter(Boolean).join(' ').toLowerCase(),
        marker,
    };
}

export function groupRecord(o: Opportunity, origin: Coordinate, club: PlaceRecord | undefined, verifiedOnly: boolean): PlaceRecord {
    const located = o.location.latitude != null && o.location.longitude != null;
    return {
        key: `opportunity:${o.id}`, entityType: 'CLUB', tone: 'club', title: o.name, subtitle: o.organizationName,
        clubId: o.clubId, clubName: o.organizationName, startsAt: null, address: [o.location.name, o.location.address].filter(Boolean).join(' · '), city: o.city ?? null,
        latitude: o.location.latitude, longitude: o.location.longitude, verified: verifiedOnly || Boolean(club?.verified),
        members: 0, followers: 0, distanceKm: located ? distanceKm(origin, [o.location.longitude!, o.location.latitude!]) : null,
        fee: null, logoUrl: club?.logoUrl ?? null, joinPolicy: null, matchSubtype: null, openChallenge: false, ageGroups: [],
        searchText: `${o.organizationName} ${o.name} ${o.location.name} ${o.location.address}`.toLowerCase(), opportunity: o,
    };
}

const timeWindow = (value: string | null): MapTimeWindow | null => {
    const parsed = value ? new Date(value) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) return null;
    const hour = parsed.getHours();
    return hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
};

/** What the server cannot filter: time of day, match type, join policy, verification and the searched area. */
export function keepRecord(record: PlaceRecord, filters: MapFilters, options: { area: MapBounds | null; radiusKm: number | null; joinPolicies: string[]; pinned: string | null }) {
    if (record.key === options.pinned) return true;
    if (options.area && record.latitude != null && record.longitude != null && !containsPoint(options.area, record.latitude, record.longitude)) return false;
    if (record.entityType === 'CLUB') {
        // Category and verification of a group are enforced by the admissions search at its venue.
        if (record.opportunity) return matchesOpportunity(record.opportunity, filters) && !(options.radiusKm != null && record.distanceKm != null && record.distanceKm > options.radiusKm);
        if (filters.clubs.officialOnly && !record.verified) return false;
        if (filters.clubs.openTryoutsOnly) return false;
        if (options.joinPolicies.length && !options.joinPolicies.includes(record.joinPolicy ?? '')) return false;
        return true;
    }
    if (record.entityType === 'TOURNAMENT' || record.entityType === 'STADIUM') return true;
    const windows = record.entityType === 'TRYOUT' ? filters.tryouts.timeWindows : filters.matches.timeWindows;
    if (windows.length) { const window = timeWindow(record.startsAt); if (!window || !windows.includes(window)) return false; }
    if (record.entityType === 'MATCH' && record.matchSubtype && !filters.matches.subtypes.includes(record.matchSubtype)) return false;
    return true;
}

const when = (record: PlaceRecord) => { const t = record.startsAt ? Date.parse(record.startsAt) : NaN; return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t; };
const far = (record: PlaceRecord) => record.distanceKm ?? Number.POSITIVE_INFINITY;

export function sortRecords(records: PlaceRecord[], mode: MapFilters['sortBy'], q: string) {
    const compare = (a: PlaceRecord, b: PlaceRecord) => {
        if (mode === 'DISTANCE') return far(a) - far(b);
        if (mode === 'SOONEST') return when(a) - when(b);
        if (mode === 'NAME') return 0;
        return searchRank(b.title, q) - searchRank(a.title, q)
            || (Number(b.verified) + Number(b.openChallenge)) - (Number(a.verified) + Number(a.openChallenge))
            || when(a) - when(b) || far(a) - far(b);
    };
    return [...records].sort((a, b) => compare(a, b) || a.title.localeCompare(b.title) || a.key.localeCompare(b.key));
}

export const distanceLabel = (km: number | null) => km == null ? null : km < 1 ? `${Math.round(km * 1000)} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;

export const typeLabel = (record: PlaceRecord) => {
    if (record.opportunity) return 'Training group';
    switch (record.entityType) {
        case 'CLUB': return record.subtitle || 'Club';
        case 'STADIUM': return 'Venue';
        case 'TRYOUT': return 'Trial';
        case 'MATCH': return record.matchSubtype === 'FRIENDLY' ? 'Friendly' : 'Match';
        case 'TOURNAMENT': return 'Competition';
        default: return 'Place';
    }
};
