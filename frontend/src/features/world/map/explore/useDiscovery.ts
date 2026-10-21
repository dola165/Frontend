import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { fetchMapDiscovery, fetchNearbyMap, geocodePlace, type MapMarkerDto, type NearbyMapParams } from '../../../../api/map';
import { REGION_BOUNDS, type MapBounds } from '../../../../components/map/areaSearch';
import { distanceKm, type Coordinate } from '../../../../components/map/walkingGraph';
import { searchOpportunities } from '../../../admissions/api';
import { admissionMapQuery } from '../../../admissions/applicant/discoveryQuery';
import { matchesOpportunity } from '../../../admissions/applicant/mapMatching';
import type { Opportunity } from '../../../admissions/types';
import { extractApiErrorMessage } from '../../../../utils/apiError';
import { useWorldData } from '../../useWorldData';
import type { MapFilters } from './discoveryFilters';
import type { Coverage } from './exploreQuery';
import { groupRecord, keepRecord, markerRecord, sortRecords } from './records';
import { wt } from '../../copy';

const toIsoWindow = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};
const GENDER: Record<string, string> = { Boys: 'MALE', Men: 'MALE', Girls: 'FEMALE', Women: 'FEMALE', Mixed: 'MIXED' };

/** One request per kind of place, so club criteria never narrow fixtures. */
function typeParams(type: MapMarkerDto['entityType'], filters: MapFilters, base: NearbyMapParams): NearbyMapParams {
    const section = type === 'MATCH' ? filters.matches : type === 'TRYOUT' ? filters.tryouts : filters.clubs;
    const window = 'dateWindow' in section ? section.dateWindow : 'ANY';
    const days = window === 'NEXT_7_DAYS' ? 7 : window === 'NEXT_30_DAYS' ? 30 : 90;
    const now = new Date();
    const people = type !== 'TOURNAMENT' && type !== 'STADIUM';
    const gender = people ? section.genders.map(value => GENDER[value]) : [];
    return {
        ...base, type: [type],
        gender: gender.length ? gender : undefined,
        ageGroups: people && section.ageGroups.length ? section.ageGroups : undefined,
        level: people && 'levels' in section && section.levels.length ? section.levels : undefined,
        trainingMinPrice: type === 'CLUB' && filters.clubs.trainingMinPrice ? Number(filters.clubs.trainingMinPrice) : undefined,
        trainingMaxPrice: type === 'CLUB' && filters.clubs.trainingMaxPrice ? Number(filters.clubs.trainingMaxPrice) : undefined,
        trainingCurrency: type === 'CLUB' ? filters.clubs.trainingCurrency || 'GEL' : undefined,
        trainingPeriod: type === 'CLUB' ? filters.clubs.trainingPeriod || 'MONTH' : undefined,
        category: type === 'CLUB' && filters.clubs.categories.length ? filters.clubs.categories : undefined,
        positions: (type === 'CLUB' || type === 'TRYOUT') && filters.positions.length ? filters.positions : undefined,
        dateFrom: window !== 'ANY' ? toIsoWindow(now) : undefined,
        dateTo: window !== 'ANY' ? toIsoWindow(new Date(now.getTime() + days * 86400000)) : undefined,
    };
}

interface Loaded { key: string; markers: MapMarkerDto[]; groups: Opportunity[]; nextClubPage?: number; nextGroupPage?: number; limited: boolean; otherLimited: boolean; error: string }

/**
 * Loads the places for the current search: markers per layer, plus the training groups of
 * clubs at their actual venues. Results of an older search are never shown as current.
 */
export function useDiscovery({ filters, q, coverage, center, origin, joinPolicies, pinned, extraMarkers, extraGroups, enabled = true }: {
    filters: MapFilters; q: string; coverage: Coverage; center: [number, number]; origin: Coordinate | null;
    joinPolicies: string[]; pinned: string | null; extraMarkers: MapMarkerDto[]; extraGroups: Opportunity[]; enabled?: boolean;
}) {
    const region = useWorldData(coverage.kind === 'region' ? `map-region:${coverage.name.toLowerCase()}` : null, async () => {
        const [top] = await geocodePlace(coverage.kind === 'region' ? coverage.name : '');
        if (!top) throw new Error(wt('No place found for “{name}”.', { name: coverage.kind === 'region' ? coverage.name : '' }));
        return top;
    }, wt('That place could not be found.'));
    const area: MapBounds | null = coverage.kind === 'area' ? coverage.bounds ?? { west: center[1] - 0.22, south: center[0] - 0.15, east: center[1] + 0.22, north: center[0] + 0.15 } : null;
    const searchCentre: [number, number] = coverage.kind === 'region' && region.data ? [region.data.latitude, region.data.longitude] : origin ? [origin[1], origin[0]] : center;
    const base: NearbyMapParams | null = coverage.kind === 'region' && !region.data ? null : {
        lat: searchCentre[0], lng: searchCentre[1], query: q || undefined,
        radius: coverage.kind === 'radius' ? coverage.km : undefined,
        bounds: coverage.kind === 'region' ? REGION_BOUNDS : area ?? undefined,
        cities: region.data?.type === 'CITY' && region.data.cityName ? [region.data.cityName] : undefined,
        countries: region.data?.type === 'COUNTRY' && region.data.countryName ? [region.data.countryName] : coverage.kind === 'region' && region.data?.type === 'CITY' && region.data.countryName ? [region.data.countryName] : undefined,
    };
    const key = base && enabled ? JSON.stringify({ base, filters: { ...filters, sortBy: null } }) : null;
    const [attempt, setAttempt] = useState(0);
    const [loaded, setLoaded] = useState<Loaded & { attempt: number }>();
    const [more, setMore] = useState<{ key: string; busy: boolean }>();
    const clubParams = useRef<NearbyMapParams | null>(null);
    const moreRequest = useRef<AbortController | null>(null);
    useEffect(() => () => moreRequest.current?.abort(), []);
    const coverageKind = coverage.kind;

    useEffect(() => {
        if (!key || !base) return;
        const controller = new AbortController();
        moreRequest.current?.abort();
        const markers = Promise.all(filters.entityType.map(type => {
            const params = typeParams(type, filters, base);
            if (type === 'CLUB') clubParams.current = params;
            return fetchMapDiscovery(params, controller.signal);
        }));
        const groups = filters.entityType.includes('CLUB')
            ? searchOpportunities(admissionMapQuery(filters, searchCentre, area, coverageKind, q), controller.signal)
            : Promise.resolve({ items: [] as Opportunity[], hasMore: false });
        void Promise.all([markers, groups]).then(([pages, page]) => {
            if (controller.signal.aborted) return;
            setLoaded({ key, attempt, markers: pages.flatMap(item => item.content), groups: page.items,
                nextClubPage: pages.find(item => item.nextPage != null)?.nextPage, nextGroupPage: page.hasMore ? 1 : undefined,
                otherLimited: pages.some((item, index) => filters.entityType[index] !== 'CLUB' && item.resultsLimited),
                limited: pages.some(item => item.resultsLimited) || page.hasMore, error: '' });
        }).catch(cause => {
            if (!controller.signal.aborted) setLoaded({ key, attempt, markers: [], groups: [], limited: false, otherLimited: false, error: extractApiErrorMessage(cause, wt('Places could not load.')) });
        });
        return () => controller.abort();
        // `base`, `area` and `filters` are captured by `key`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, attempt]);

    const current = loaded && loaded.key === key && loaded.attempt === attempt ? loaded : undefined;
    const loadMore = async () => {
        if (!current || !key || (current.nextClubPage == null && current.nextGroupPage == null) || more?.busy) return;
        moreRequest.current?.abort();
        const controller = new AbortController(); moreRequest.current = controller;
        setMore({ key, busy: true });
        try {
            const [page, groups] = await Promise.all([
                current.nextClubPage != null && clubParams.current ? fetchNearbyMap({ ...clubParams.current, page: current.nextClubPage, size: 100 }, controller.signal) : null,
                current.nextGroupPage != null ? searchOpportunities(admissionMapQuery(filters, searchCentre, area, coverageKind, q, current.nextGroupPage), controller.signal) : null,
            ]);
            if (controller.signal.aborted) return;
            const clubsLeft = Boolean(page && current.nextClubPage != null && (current.nextClubPage + 1) * 100 < page.totalElements);
            setLoaded(previous => previous && previous.key === key ? {
                ...previous,
                markers: [...new Map([...previous.markers, ...(page?.content ?? [])].map(m => [`${m.entityType}:${m.entityId}`, m])).values()],
                groups: [...new Map([...previous.groups, ...(groups?.items ?? [])].map(o => [o.id, o])).values()],
                nextClubPage: clubsLeft ? current.nextClubPage! + 1 : undefined,
                nextGroupPage: groups?.hasMore ? current.nextGroupPage! + 1 : undefined,
                limited: previous.otherLimited || clubsLeft || Boolean(groups?.hasMore),
            } : previous);
        } catch (cause) {
            if (!controller.signal.aborted) toast.error(extractApiErrorMessage(cause, wt('More places could not load. Try again.')));
        } finally {
            if (!controller.signal.aborted) setMore({ key, busy: false });
        }
    };

    const recordsKey = JSON.stringify([filters, area, joinPolicies, coverage.kind === 'radius' ? coverage.km : null]);
    const records = useMemo(() => {
        if (!current) return [];
        const allowed = new Set(filters.entityType);
        // A linked place outside the results has no distance of its own until a start is set.
        const linked = extraMarkers.map(marker => ({ ...markerRecord(marker), distanceKm: null }));
        const places = [...new Map([...linked, ...current.markers.map(markerRecord)].map(record => [record.key, record])).values()]
            .filter(record => allowed.has(record.entityType) || record.key === pinned);
        const from: Coordinate = origin ?? [searchCentre[1], searchCentre[0]];
        const groups = allowed.has('CLUB')
            ? [...new Map([...current.groups, ...extraGroups].map(o => [o.id, o])).values()].map(o => groupRecord(o, from, places.find(r => r.entityType === 'CLUB' && r.clubId === o.clubId), filters.clubs.officialOnly))
            : [];
        const withGroups = places.map(record => record.entityType === 'CLUB' ? { ...record, groups: current.groups.filter(o => o.clubId === record.clubId && matchesOpportunity(o, filters)) } : record);
        const measured = [...withGroups, ...groups].map(record => origin && record.latitude != null && record.longitude != null ? { ...record, distanceKm: distanceKm(origin, [record.longitude, record.latitude]) } : record);
        const kept = measured.filter(record => keepRecord(record, filters, { area, radiusKm: coverage.kind === 'radius' ? coverage.km : null, joinPolicies, pinned }));
        return sortRecords(kept, filters.sortBy, q);
        // The filters, area and policies are captured by their serialised form.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [current, extraMarkers, extraGroups, origin, pinned, q, recordsKey]);

    return {
        records,
        loading: key === null ? region.loading || !enabled : !current,
        error: region.error || current?.error || '',
        retry: () => { if (region.error) region.retry(); setAttempt(value => value + 1); },
        limited: current?.limited ?? false,
        canLoadMore: Boolean(current && (current.nextClubPage != null || current.nextGroupPage != null)),
        loadMore: () => void loadMore(),
        loadingMore: more?.key === key && Boolean(more?.busy),
        region: region.data,
    };
}
export type Discovery = ReturnType<typeof useDiscovery>;
