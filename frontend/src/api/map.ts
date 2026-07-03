import { apiClient } from './axiosConfig';

export type MapEntityType = 'CLUB' | 'TRYOUT' | 'MATCH' | 'TOURNAMENT';

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
}

export interface MapPageResult {
    content: MapMarkerDto[];
    page: number;
    size: number;
    totalElements: number;
}

export interface NearbyMapParams {
    lat: number;
    lng: number;
    radius?: number;
    type?: MapEntityType[];
    gender?: string[];
    ageGroups?: string[];
    level?: string[];
    cities?: string[];
    countries?: string[];
    query?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    size?: number;
}

export const fetchNearbyMap = async (params: NearbyMapParams): Promise<MapPageResult> => {
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

    const response = await apiClient.get<MapPageResult>(`/map/nearby?${searchParams.toString()}`);
    return response.data;
};
