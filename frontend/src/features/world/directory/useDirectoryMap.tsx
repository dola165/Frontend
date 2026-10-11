import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Maximize2, RotateCw, Search } from 'lucide-react';
import type { MapBounds } from '../../../components/map/areaSearch';
import { plural, useWorldCopy } from '../copy';
import type { WorldMapPoint } from '../map/WorldMap';
import { useStageMap } from '../stage/stageContext';
import { useWorldArea } from '../useWorldArea';
import type { AnySource, DirectoryQuery } from './types';
import type { DirectoryData } from './useDirectoryData';
import { useCityInView } from './useCityInView';
import { usePlacedPoints } from './usePlacedPoints';

const NONE: WorldMapPoint[] = [];

export interface MapSelection {
    selectedPin?: string; select: (pin?: string) => void;
    /** The result under the pointer (its pin lights), or the pin under it. */ hoverKey?: string; hoverPin?: string; setHoverPin: (pin?: string) => void;
}

/**
 * What a directory shows on World's map: the results on screen as pins (one to one with the list), how many are on
 * it and how many have no place, the full map, and, once the person moves the map over another city, an offer to
 * search there. A list with nothing to place (referees, or one behind sign-in) keeps the map and says why it is empty.
 */
export function useDirectoryMap({ source, query, data, gated, open, panel, summary, selection, onShowInList }: {
    source: AnySource; query: DirectoryQuery; data: DirectoryData; gated: boolean;
    /** The map is open (not folded to its strip). */ open: boolean; /** The Browse area panel floats over the map. */ panel: boolean;
    /** What the folded strip says. */ summary: string; selection: MapSelection; onShowInList: (pin: string) => void;
}) {
    const t = useWorldCopy();
    const { area, setCity } = useWorldArea();
    const mappable = Boolean(source.place) && (source.mapped?.(query) ?? true) && !gated;
    const placed = usePlacedPoints(source, data.items, mappable && open);
    // A move is kept with the pins it was made over: new results reframe the map and the offer goes with them.
    const pinsKey = placed.points.map(point => point.id).join('|');
    const [moved, setMoved] = useState<{ pins: string; bounds: MapBounds } | null>(null);
    const view = moved && moved.pins === pinsKey ? moved.bounds : null;
    const cityInView = useCityInView(source.area && open ? view : null, area);

    const things = t(source.noun[1]);
    const onMap = placed.points.reduce((sum, point) => sum + (point.count ?? 1), 0);
    const missing = placed.unplaced ? (placed.incomplete ? t('{count} could not be placed', { count: placed.unplaced }) : t('{count} without a place', { count: placed.unplaced })) : '';
    const loading = placed.loading || data.loading;
    const count = gated ? t('Sign in to see {things}', { things })
        : !mappable ? t('{things} are not shown on the map', { things: t(source.label) })
            : loading ? t('Placing results on the map…') : [t('{count} on the map', { count: plural(onMap, source.noun[0], source.noun[1]) }), missing].filter(Boolean).join(' · ');
    useStageMap({
        label: t('{things} on the map', { things: t(source.label) }),
        points: mappable ? placed.points : NONE, panel, summary,
        selectedId: selection.selectedPin, onSelect: selection.select, onHover: selection.setHoverPin,
        highlightId: selection.hoverKey ? placed.pinOf.get(selection.hoverKey) : selection.hoverPin,
        onMoveEnd: bounds => setMoved({ pins: pinsKey, bounds }),
        cardActions: point => <button type="button" className="gk-world-map__inlist" onClick={() => onShowInList(point.id)}>{t('Show in list')}</button>,
        top: cityInView && <button type="button" className="gk-world-glass gk-world-map__search" onClick={() => { setCity(cityInView); setMoved(null); }}>
            <Search aria-hidden="true" />{t('Search {city}', { city: cityInView })}
        </button>,
        pills: <>
            {/* Plain text: the count with the results is the page's one live region. */}
            <span className="gk-world-glass"><span className="gk-world-glass__live" aria-hidden="true" />{count}</span>
            {placed.incomplete && !loading && <button type="button" className="gk-world-glass" onClick={placed.retry}><RotateCw aria-hidden="true" />{t('Try again')}</button>}
            <Link className="gk-world-glass" to={source.mapLink ? source.mapLink(query) : '/world/map'}><Maximize2 aria-hidden="true" />{t('Open full map')}</Link>
        </>,
    });
    return { placed, mappable };
}
