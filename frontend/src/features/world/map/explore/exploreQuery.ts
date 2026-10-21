import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { MapEntityType } from '../../../../api/map';
import type { MapBounds } from '../../../../components/map/areaSearch';
import type { FilterControls } from '../../directory/DirectoryFilters';
import type { DirectoryQuery, FilterDef } from '../../directory/types';
import { JOIN_POLICY_FILTER } from '../../directories/clubFilters';
import {
    AGE_GROUPS, CLUB_CATEGORIES, CURRENCIES, DATE_WINDOWS, FEE_PERIODS, GENDERS, LEVELS, POSITIONS, TIME_WINDOWS,
    defaultMapFilters, type MapDateWindow, type MapFilters, type MapSortMode,
} from './discoveryFilters';

export type LayerId = 'clubs' | 'venues' | 'matches' | 'trials' | 'competitions';
export type PlaceTone = 'club' | 'venue' | 'match' | 'trial' | 'competition';
export interface MapLayer { id: LayerId; label: string; entity: MapEntityType; tone: PlaceTone; noun: [string, string] }

/** The kinds of place on the World map. Each is a layer with its own colour and filters. */
export const LAYERS: MapLayer[] = [
    { id: 'clubs', label: 'Clubs', entity: 'CLUB', tone: 'club', noun: ['club', 'clubs'] },
    { id: 'venues', label: 'Venues', entity: 'STADIUM', tone: 'venue', noun: ['venue', 'venues'] },
    { id: 'matches', label: 'Matches', entity: 'MATCH', tone: 'match', noun: ['match', 'matches'] },
    { id: 'trials', label: 'Trials', entity: 'TRYOUT', tone: 'trial', noun: ['trial', 'trials'] },
    { id: 'competitions', label: 'Competitions', entity: 'TOURNAMENT', tone: 'competition', noun: ['competition', 'competitions'] },
];
export const layerOf = (entity: MapEntityType) => LAYERS.find(layer => layer.entity === entity);
const DEFAULT_LAYERS: LayerId[] = ['clubs', 'venues'];

export type MapFilterDef = FilterDef & { layers: LayerId[] };
const has = (values: Record<string, string[]>, key: string) => Boolean(values[key]?.[0]);

/** Map filters. Shared keys mean the same everywhere: an age group narrows clubs, trials and matches alike. */
export const MAP_FILTERS: MapFilterDef[] = [
    { kind: 'choice', key: 'age', label: 'Age group', multi: true, layers: ['clubs', 'trials', 'matches'], options: AGE_GROUPS.map(value => ({ value, label: value })) },
    { kind: 'choice', key: 'gender', label: 'Who plays', multi: true, layers: ['clubs', 'trials', 'matches'], options: GENDERS.map(value => ({ value, label: value })) },
    { kind: 'choice', key: 'level', label: 'Level', multi: true, layers: ['clubs', 'matches'], options: LEVELS.map(value => ({ value, label: value })) },
    { kind: 'choice', key: 'when', label: 'When', layers: ['matches', 'trials', 'competitions'], allLabel: 'Any time', options: DATE_WINDOWS },
    { kind: 'choice', key: 'time', label: 'Time of day', multi: true, layers: ['matches', 'trials'], options: TIME_WINDOWS.map(value => ({ value, label: value })) },
    { kind: 'choice', key: 'matchType', label: 'Match type', multi: true, layers: ['matches'], options: [{ value: 'FRIENDLY', label: 'Friendlies' }, { value: 'COMPETITIVE', label: 'Competitive' }] },
    { ...JOIN_POLICY_FILTER, layers: ['clubs'] },
    { kind: 'choice', key: 'category', label: 'Kind of club', multi: true, layers: ['clubs'], options: CLUB_CATEGORIES },
    { kind: 'choice', key: 'position', label: 'Position', multi: true, layers: ['clubs', 'trials'], options: POSITIONS },
    { kind: 'toggle', key: 'accepting', label: 'Groups taking new players', layers: ['clubs'] },
    { kind: 'toggle', key: 'waitlist', label: 'Include waiting lists', layers: ['clubs'], when: query => first(query.values, 'accepting') === 'true' },
    { kind: 'toggle', key: 'verified', label: 'Verified clubs only', layers: ['clubs'] },
    { kind: 'text', key: 'feeMin', label: 'Lowest training fee', placeholder: 'From', layers: ['clubs'] },
    { kind: 'text', key: 'feeMax', label: 'Highest training fee', placeholder: 'Any fee', layers: ['clubs'] },
    { kind: 'choice', key: 'feeCurrency', label: 'Fee currency', fallback: 'GEL', layers: ['clubs'], options: CURRENCIES.map(value => ({ value, label: value })), when: query => has(query.values, 'feeMin') || has(query.values, 'feeMax') },
    { kind: 'choice', key: 'feePeriod', label: 'Fee billed', fallback: 'MONTH', layers: ['clubs'], options: FEE_PERIODS.map(([value, label]) => ({ value, label })), when: query => has(query.values, 'feeMin') || has(query.values, 'feeMax') },
];

export const SORTS: { value: string; label: string; mode: MapSortMode }[] = [
    { value: 'best', label: 'Best match', mode: 'RELEVANCE' }, { value: 'near', label: 'Nearest', mode: 'DISTANCE' },
    { value: 'soon', label: 'Soonest', mode: 'SOONEST' }, { value: 'name', label: 'Name A–Z', mode: 'NAME' },
];
export const RADII = [2, 5, 10, 25, 50, 100];

/** Where the search looks: the visible map (`bbox`), around your start (`within` km) or a named place (`region`). */
export type Coverage = { kind: 'area'; bounds: MapBounds | null } | { kind: 'radius'; km: number } | { kind: 'region'; name: string };

const first = (values: Record<string, string[]>, key: string) => values[key]?.[0] ?? '';
const parseBounds = (raw: string | null): MapBounds | null => {
    const parts = raw?.split(',').map(Number);
    if (!parts || parts.length !== 4 || parts.some(n => !Number.isFinite(n))) return null;
    const [west, south, east, north] = parts;
    return south < north && Math.abs(south) <= 90 && Math.abs(north) <= 90 ? { west, south, east, north } : null;
};
const round = (n: number) => Math.round(n * 1e4) / 1e4;
const parseAt = (raw: string | null): [number, number] | null => {
    const [lat, lng] = raw?.split(',').map(Number) ?? [];
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lat, lng] : null;
};
const positive = (raw: string | null) => raw && /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) && Number(raw) > 0 ? Number(raw) : null;

/** Map search state lives in the URL, so a search can be shared and Back works as expected. */
export function useExploreQuery(allowed: LayerId[] = LAYERS.map(layer => layer.id), local = false) {
    // An embedded map (the landing page) keeps its search to itself instead of the page URL.
    const [urlParams, setUrlParams] = useSearchParams();
    const [localParams, setLocalParams] = useState(() => new URLSearchParams());
    const params = local ? localParams : urlParams;
    const setParams = (next: (current: URLSearchParams) => URLSearchParams, options: { replace: boolean; preventScrollReset: boolean }) =>
        local ? setLocalParams(current => next(current)) : setUrlParams(next, options);
    const requested = params.get('layers')?.split(',').filter((id): id is LayerId => allowed.includes(id as LayerId));
    const layers = requested?.length ? requested : DEFAULT_LAYERS.filter(id => allowed.includes(id)).length ? DEFAULT_LAYERS.filter(id => allowed.includes(id)) : allowed.slice(0, 1);
    const values: Record<string, string[]> = Object.fromEntries(MAP_FILTERS.map(filter => {
        const list = params.getAll(filter.key).filter(Boolean);
        return [filter.key, list.length ? list : filter.kind === 'choice' && filter.fallback ? [filter.fallback] : []];
    }));
    const q = params.get('q') ?? '';
    const sort = SORTS.find(item => item.value === params.get('sort'))?.value ?? 'best';
    const within = Number(params.get('within'));
    const region = params.get('region')?.trim();
    const coverage: Coverage = region ? { kind: 'region', name: region } : RADII.includes(within) ? { kind: 'radius', km: within } : { kind: 'area', bounds: parseBounds(params.get('bbox')) };
    const directoryQuery: DirectoryQuery = { q, sort, values };
    const applies = (filter: MapFilterDef) => filter.layers.some(id => layers.includes(id)) && (!filter.when || filter.when(directoryQuery));
    const visibleFilters = MAP_FILTERS.filter(applies);
    const activeFilters = visibleFilters.filter(filter => params.getAll(filter.key).some(Boolean) && !(filter.kind === 'choice' && filter.fallback && params.get(filter.key) === filter.fallback));

    const update = (mutate: (next: URLSearchParams) => void, replace = true) => setParams(current => {
        const next = new URLSearchParams(current);
        mutate(next);
        return next;
    }, { replace, preventScrollReset: true });
    const setValues = (key: string, list: string[]) => update(next => {
        next.delete(key);
        const filter = MAP_FILTERS.find(item => item.key === key);
        const fallback = filter?.kind === 'choice' ? filter.fallback : undefined;
        list.filter(value => value && value !== fallback).forEach(value => next.append(key, value));
        const after: DirectoryQuery = { ...directoryQuery, values: { ...values, [key]: list } };
        MAP_FILTERS.filter(item => item.when && item.key !== key && !item.when(after)).forEach(item => next.delete(item.key));
    });
    const controls: FilterControls = {
        query: directoryQuery,
        setValues,
        toggleValue: (key, value, multi) => {
            const current = values[key] ?? [];
            setValues(key, multi ? (current.includes(value) ? current.filter(item => item !== value) : [...current, value]) : current[0] === value ? [] : [value]);
        },
    };

    return {
        layers, values, q, sort, coverage, controls, visibleFilters, activeFilters,
        place: params.get('place'),
        at: parseAt(params.get('at')),
        venueId: positive(params.get('venue')),
        opportunityId: positive(params.get('opportunity')),
        toggleLayer: (id: LayerId) => update(next => {
            const set = layers.includes(id) ? layers.filter(item => item !== id) : [...layers, id];
            const ordered = LAYERS.map(layer => layer.id).filter(item => set.includes(item));
            if (!ordered.length) return;
            if (ordered.join() === DEFAULT_LAYERS.join()) next.delete('layers'); else next.set('layers', ordered.join(','));
        }),
        setQ: (value: string) => update(next => { if (value.trim()) next.set('q', value.trim()); else next.delete('q'); }),
        setSort: (value: string) => update(next => { if (value === 'best') next.delete('sort'); else next.set('sort', value); }),
        setArea: (bounds: MapBounds) => update(next => {
            next.delete('within'); next.delete('region');
            next.set('bbox', [bounds.west, bounds.south, bounds.east, bounds.north].map(round).join(','));
        }),
        setRadius: (km: number) => update(next => { next.delete('region'); next.delete('bbox'); next.set('within', String(km)); }),
        setRegion: (name: string) => update(next => { next.delete('within'); next.delete('bbox'); if (name.trim()) next.set('region', name.trim()); else next.delete('region'); }),
        /** Opening a place adds a history entry, so Back closes it; moving between places replaces it. */
        /** `at` keeps the place's position in a shared link, so it opens in view on any screen. */
        select: (key: string | null, at?: { latitude: number | null; longitude: number | null }) => update(next => {
            // A linked venue or group becomes the selected place; closing it ends the link too.
            next.delete('venue'); next.delete('opportunity');
            if (key) next.set('place', key); else next.delete('place');
            if (key && at?.latitude != null && at.longitude != null) next.set('at', `${at.latitude.toFixed(5)},${at.longitude.toFixed(5)}`); else next.delete('at');
        }, !(key && !params.get('place'))),
        clearFilters: () => update(next => { MAP_FILTERS.forEach(filter => next.delete(filter.key)); next.delete('q'); }),
    };
}
export type ExploreQuery = ReturnType<typeof useExploreQuery>;

const dateWindow = (value: string): MapDateWindow => DATE_WINDOWS.some(item => item.value === value) ? value as MapDateWindow : 'ANY';

/** The discovery API's filter model for the current URL state. */
export function toMapFilters(query: Pick<ExploreQuery, 'layers' | 'values' | 'sort' | 'coverage'>, player?: { birthYear: number; gender: 'MALE' | 'FEMALE' | null; minor: boolean }): MapFilters {
    const v = query.values;
    // A chosen player stands in for age group and, unless one is picked, who plays.
    const playerGender = player?.gender === 'MALE' ? (player.minor ? 'Boys' : 'Men') : player?.gender === 'FEMALE' ? (player.minor ? 'Girls' : 'Women') : null;
    const ageGroups = v.age ?? [];
    const genders = (v.gender?.length ? v.gender : playerGender ? [playerGender] : []) as MapFilters['clubs']['genders'];
    const levels = (v.level ?? []) as MapFilters['clubs']['levels'];
    const when = dateWindow(first(v, 'when')), timeWindows = (v.time ?? []) as MapFilters['matches']['timeWindows'];
    const fees = first(v, 'feeMin') || first(v, 'feeMax');
    return {
        entityType: LAYERS.filter(layer => query.layers.includes(layer.id)).map(layer => layer.entity),
        sortBy: SORTS.find(item => item.value === query.sort)?.mode ?? 'RELEVANCE',
        distanceKm: query.coverage.kind === 'radius' ? query.coverage.km : defaultMapFilters.distanceKm,
        positions: (v.position ?? []) as MapFilters['positions'],
        clubs: {
            ...defaultMapFilters.clubs, ageGroups: player ? [] : ageGroups, genders, levels,
            categories: (v.category ?? []) as MapFilters['clubs']['categories'],
            officialOnly: first(v, 'verified') === 'true', openTryoutsOnly: first(v, 'accepting') === 'true',
            includeWaitlist: first(v, 'waitlist') === 'true', birthYear: player?.birthYear,
            trainingMinPrice: first(v, 'feeMin') || undefined, trainingMaxPrice: first(v, 'feeMax') || undefined,
            trainingCurrency: fees ? first(v, 'feeCurrency') || 'GEL' : undefined, trainingPeriod: fees ? first(v, 'feePeriod') || 'MONTH' : undefined,
        },
        tryouts: { ...defaultMapFilters.tryouts, dateWindow: when, timeWindows, genders, ageGroups },
        matches: { ...defaultMapFilters.matches, dateWindow: when, timeWindows, genders, levels, ageGroups, subtypes: v.matchType?.length ? v.matchType as MapFilters['matches']['subtypes'] : defaultMapFilters.matches.subtypes },
    };
}
