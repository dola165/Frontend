import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import { toast } from 'sonner';
import type { GeocodeResult, MapMarkerDto } from '../../../../api/map';
import { coverageLabel, type MapBounds } from '../../../../components/map/areaSearch';
import { isLeadershipRole } from '../../../clubs/domain';
import { fetchOpportunity } from '../../../admissions/api';
import type { Opportunity } from '../../../admissions/types';
import { useVenueMapTarget } from '../../../venues/useVenueMapTarget';
import { extractApiErrorMessage } from '../../../../utils/apiError';
import { useWorldArea } from '../../useWorldArea';
import { useWorldSession } from '../../worldSession';
import { reducedMotion } from '../canvas/useMapTheme';
import { viewportBounds } from '../canvas/viewport';
import type { SheetSnap } from '../sheet/usePhoneLayout';
import { toMapFilters, useExploreQuery, type LayerId } from './exploreQuery';
import type { PlaceRecord } from './records';
import { useApplicant } from './useApplicant';
import { useDiscovery } from './useDiscovery';
import { useWalking } from './useWalking';

export type ExploreSurface = 'results' | 'filters' | 'place' | 'walk';

/** Room the panel or sheet takes over the map, so focused places land in the visible part. */
export function cameraPadding(phone: boolean, panelOpen: boolean) {
    if (phone) return { top: 120, bottom: Math.round(window.innerHeight * 0.45), left: 32, right: 32 };
    return { top: 80, bottom: 60, left: panelOpen ? 440 : 60, right: 80 };
}

/** Everything the explore view knows: the URL search, results, the selected place and walking. */
export function useExplore({ mapRef, active, allowed, signedIn, phone, viewSize, zoom, embedded = false }: {
    mapRef: RefObject<MapRef | null>; active: boolean; allowed: LayerId[]; signedIn: boolean; phone: boolean; embedded?: boolean;
    /** The canvas size and starting zoom: until a search names an area, the area is what the map first shows. */
    viewSize: { width: number; height: number } | null; zoom: number;
}) {
    const query = useExploreQuery(allowed, embedded);
    const applicant = useApplicant();
    const { membership } = useWorldSession();
    const { area } = useWorldArea();
    const linked = Boolean(query.place || query.venueId || query.opportunityId);
    const walking = useWalking(mapRef, active && !linked);
    // A shared place opens centred on it; otherwise the map starts on your area.
    const at = query.at;
    const known = Boolean(at) || (area.ready && Boolean(area.centre));
    const liveCenter: [number, number] = useMemo(() => at ?? (area.centre ? [area.centre.lat, area.centre.lng] : [41.7151, 44.8271]), [at, area.centre]);
    // The map starts once, where it was first known to start; later selections never move the search.
    const [center, setCenter] = useState<[number, number] | null>(null);
    if (!center && known) setCenter(liveCenter);
    const start = center ?? liveCenter;
    const firstView = useMemo(() => viewSize && center ? viewportBounds(center, zoom, viewSize.width, viewSize.height) : null, [center, zoom, viewSize]);
    const [surface, setSurface] = useState<ExploreSurface>('results');
    const [collapsed, setCollapsed] = useState(false);
    const [snap, setSnap] = useState<SheetSnap>('peek');
    const [hovered, setHovered] = useState<string | null>(null);
    const [moved, setMoved] = useState(false);
    const [responding, setResponding] = useState<PlaceRecord | null>(null);
    const [closedKey, setClosedKey] = useState<string | null>(null);

    const focus = useCallback((latitude: number, longitude: number, zoom = 14) => {
        const map = mapRef.current;
        map?.flyTo({ center: [longitude, latitude], zoom: Math.max(map.getZoom(), zoom), padding: cameraPadding(phone, !collapsed), duration: reducedMotion() ? 0 : 600 });
    }, [mapRef, phone, collapsed]);

    // Links to a venue or a training group open that place, even when it lies outside the searched area.
    const [pinnedMarkers, setPinnedMarkers] = useState<MapMarkerDto[]>([]);
    const [pinnedGroups, setPinnedGroups] = useState<Opportunity[]>([]);
    const venue = useVenueMapTarget(query.venueId, useCallback((marker: MapMarkerDto) => {
        setPinnedMarkers(list => [...list.filter(item => item.entityId !== marker.entityId), marker]);
        setSurface('place'); setSnap('half');
        focus(marker.latitude, marker.longitude);
    }, [focus]));
    const { opportunityId } = query;
    useEffect(() => {
        if (!opportunityId) return;
        const controller = new AbortController();
        void fetchOpportunity(opportunityId, controller.signal).then(o => {
            if (controller.signal.aborted) return;
            setPinnedGroups(list => [...list.filter(item => item.id !== o.id), o]);
            if (o.location.latitude != null && o.location.longitude != null) focus(o.location.latitude, o.location.longitude);
        }).catch(cause => { if (!controller.signal.aborted) toast.error(extractApiErrorMessage(cause, 'This group could not be loaded.')); });
        return () => controller.abort();
    }, [opportunityId, focus]);
    const placeKey = query.place ?? (query.venueId ? `stadium:${query.venueId}` : query.opportunityId ? `opportunity:${query.opportunityId}` : null);

    const filters = toMapFilters(query, applicant.player);
    const discovery = useDiscovery({
        filters, q: query.q, coverage: query.coverage.kind === 'area' && !query.coverage.bounds ? { kind: 'area', bounds: firstView } : query.coverage,
        center: start, origin: walking.origin, joinPolicies: query.values.joinPolicy ?? [],
        pinned: placeKey, extraMarkers: pinnedMarkers, extraGroups: pinnedGroups,
        enabled: active && Boolean(center) && (query.coverage.kind !== 'area' || Boolean(query.coverage.bounds || firstView)),
    });
    const selected = placeKey ? discovery.records.find(record => record.key === placeKey) ?? null : null;
    // A place opened by a link is brought into view once the map and the place are both ready.
    const [mapReady, setMapReady] = useState(false);
    const framed = useRef<string | null>(null);
    useEffect(() => {
        if (!mapReady || !selected || framed.current === selected.key || selected.latitude == null || selected.longitude == null) return;
        framed.current = selected.key;
        focus(selected.latitude, selected.longitude);
    }, [mapReady, selected, focus]);
    const shownSurface: ExploreSurface = walking.target ? 'walk' : surface === 'place' && !placeKey ? 'results' : placeKey && surface !== 'filters' ? 'place' : surface;

    const canRespond = Boolean(selected?.entityType === 'MATCH' && selected.openChallenge && selected.marker?.scheduleEventId && selected.clubId
        && membership?.clubId && Number(membership.clubId) !== selected.clubId && isLeadershipRole(membership.myRole));

    const regionName = query.coverage.kind === 'region' ? discovery.region?.name ?? query.coverage.name : '';
    return {
        query, applicant, walking, discovery, filters, selected, placeKey, venue, hovered, setHovered, responding, setResponding, canRespond, membership,
        surface: shownSurface, setSurface, collapsed, setCollapsed, snap, setSnap, moved, setMoved, center: start, centerReady: Boolean(center), signedIn,
        setMapReady,
        coverage: coverageLabel(query.coverage.kind, query.coverage.kind === 'radius' ? query.coverage.km : 0, regionName),
        open: (record: PlaceRecord, fromMap = false) => {
            framed.current = record.key;
            walking.stop(); query.select(record.key, record); setSurface('place'); setCollapsed(false);
            setSnap(phone ? 'half' : snap);
            if (!fromMap && record.latitude != null && record.longitude != null) focus(record.latitude, record.longitude);
        },
        closedKey,
        close: () => { walking.stop(); setClosedKey(placeKey); query.select(null); setSurface('results'); },
        searchArea: (bounds?: MapBounds) => {
            const map = mapRef.current;
            const view = bounds ?? (map ? (() => { const b = map.getBounds(); return { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() }; })() : null);
            if (!view) return;
            query.setArea(view); setMoved(false); setSurface('results');
            if (phone) setSnap('half');
        },
        goTo: (place: GeocodeResult) => {
            mapRef.current?.flyTo({ center: [place.longitude, place.latitude], zoom: place.type === 'CITY' ? 11.5 : 6.5, duration: reducedMotion() ? 0 : 800 });
            mapRef.current?.once('moveend', () => {
                const b = mapRef.current?.getBounds();
                if (b) query.setArea({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() });
                setMoved(false);
            });
        },
        /** Zoom out and search the larger area. */
        widen: () => {
            const map = mapRef.current;
            if (!map) { query.setRegion(''); return; }
            map.once('moveend', () => { const b = map.getBounds(); query.setArea({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() }); setMoved(false); });
            map.zoomOut({ duration: reducedMotion() ? 0 : 400 });
        },
        locate: () => walking.locate(point => mapRef.current?.flyTo({ center: point, zoom: Math.max(mapRef.current.getZoom(), 13), duration: reducedMotion() ? 0 : 600 })),
        focus,
    };
}
export type Explore = ReturnType<typeof useExplore>;
