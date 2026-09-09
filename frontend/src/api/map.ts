import { apiClient } from './axiosConfig';

// CLUB_NEED remains in the wire type for older clients; the current map API
// accepts it for compatibility but intentionally returns no markers.
export type MapEntityType = 'CLUB' | 'TRYOUT' | 'MATCH' | 'TOURNAMENT' | 'CLUB_NEED';

export interface MapMarkerDto {
    entityId: number;
    entityType: MapEntityType;
    title: string;
    subtitle: string;
    clubName: string;
    clubId?: number | null;
    latitude: number;
    longitude: number;
    distanceKm: number;
    members: number;
    followers: number;
    verified: boolean;
    date: string;
    fee: string;
    addressText: string;
    ageGroup: string;
    status: string;
    cityName: string;
    countryName: string;
    eventSubtype?: string | null;
    scheduleEventId?: number | null;
    logoUrl?: string | null;
    joinPolicy?: string | null;
    category?: string | null;
}

export interface MapPageResult {
    content: MapMarkerDto[];
    page: number;
    size: number;
    totalElements: number;
    resultsLimited?: boolean;
    perTypeLimit?: number;
}

export interface NearbyMapParams {
    lat: number;
    lng: number;
    radius?: number;
    type?: MapEntityType[];
    gender?: string[];
    ageGroups?: string[];
    level?: string[];
    category?: string[];
    positions?: string[];
    cities?: string[];
    countries?: string[];
    query?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    size?: number;
}

export const fetchNearbyMap = async (params: NearbyMapParams, signal?: AbortSignal): Promise<MapPageResult> => {
    const searchParams = new URLSearchParams();

    searchParams.set('lat', String(params.lat));
    searchParams.set('lng', String(params.lng));
    if (params.radius != null) searchParams.set('radius', String(params.radius));

    if (params.type && params.type.length > 0) {
        params.type.forEach((t) => searchParams.append('type', t));
    }
    if (params.gender && params.gender.length > 0) {
        params.gender.forEach((g) => searchParams.append('gender', g));
    }
    if (params.ageGroups && params.ageGroups.length > 0) {
        params.ageGroups.forEach((a) => searchParams.append('ageGroups', a));
    }
    if (params.level && params.level.length > 0) {
        params.level.forEach((l) => searchParams.append('level', l));
    }
    if (params.category && params.category.length > 0) {
        params.category.forEach((c) => searchParams.append('category', c));
    }
    if (params.positions && params.positions.length > 0) {
        params.positions.forEach((position) => searchParams.append('positions', position));
    }
    if (params.cities && params.cities.length > 0) {
        params.cities.forEach((c) => searchParams.append('cities', c));
    }
    if (params.countries && params.countries.length > 0) {
        params.countries.forEach((c) => searchParams.append('countries', c));
    }
    if (params.query) searchParams.set('query', params.query);
    if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom);
    if (params.dateTo) searchParams.set('dateTo', params.dateTo);
    if (params.page != null) searchParams.set('page', String(params.page));
    if (params.size != null) searchParams.set('size', String(params.size));

    const response = await apiClient.get<MapPageResult>(`/map/nearby?${searchParams.toString()}`, { signal });
    return response.data;
};

export type GeocodeResultType = 'CITY' | 'COUNTRY';

export interface GeocodeResult {
    name: string;
    cityName: string | null;
    countryName: string | null;
    countryCode: string | null;
    latitude: number;
    longitude: number;
    type: GeocodeResultType;
}

/** Resolves a city or country name against the backend locations table (global, zero external deps). */
export interface GeocodeOptions {
    countryCode?: string;
    type?: GeocodeResultType;
}

export const geocodePlace = async (q: string, options: GeocodeOptions = {}): Promise<GeocodeResult[]> => {
    const searchParams = new URLSearchParams({ q: q.trim() });
    if (options.countryCode) searchParams.set('countryCode', options.countryCode);
    if (options.type) searchParams.set('type', options.type);
    const response = await apiClient.get<GeocodeResult[]>(`/map/geocode?${searchParams.toString()}`);
    return response.data;
};

/** Load the whole bounded pool, so local sorting/filtering never sees only page one. */
export const fetchMapDiscovery = async (params: NearbyMapParams, signal?: AbortSignal): Promise<MapPageResult> => {
    const first = await fetchNearbyMap({ ...params, page: 0, size: 100 }, signal);
    const markers = new Map(first.content.map(marker => [`${marker.entityType}:${marker.entityId}`, marker]));
    let limited = first.resultsLimited ?? false;
    for (let page = 1; page < Math.min(4, Math.ceil(first.totalElements / 100)); page++) {
        const next = await fetchNearbyMap({ ...params, page, size: 100 }, signal);
        next.content.forEach(marker => markers.set(`${marker.entityType}:${marker.entityId}`, marker));
        limited ||= next.resultsLimited ?? false;
    }
    return { ...first, content: [...markers.values()], resultsLimited: limited };
};
