import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { MapPin, Search, SlidersHorizontal, X } from 'lucide-react';
import { geocodePlace, type GeocodeResult } from '../../../../api/map';
import { searchRank } from '../../../../components/map/areaSearch';
import { Button, Chip } from '../../../../design/primitives';
import { LAYERS, type ExploreQuery, type LayerId } from './exploreQuery';
import { typeLabel, type PlaceRecord } from './records';

type Suggestion = { id: string; label: string; meta: string; kind: 'search' | 'place' | 'area'; record?: PlaceRecord; area?: GeocodeResult };

/** Places (cities, countries) the search box can take you to. */
function useAreaSuggestions(text: string) {
    const [state, setState] = useState<{ text: string; items: GeocodeResult[] }>({ text: '', items: [] });
    useEffect(() => {
        const q = text.trim();
        if (q.length < 3) return;
        let active = true;
        const timer = window.setTimeout(() => { void geocodePlace(q).then(items => { if (active) setState({ text: q, items: items.slice(0, 3) }); }).catch(() => undefined); }, 300);
        return () => { active = false; window.clearTimeout(timer); };
    }, [text]);
    return state.text === text.trim() ? state.items : [];
}

/**
 * The map's one search box: type to search football in the area, jump straight to a
 * matching place, or go to a city. Below it, the layers double as the map key.
 */
export function SearchBar({ query, records, allowed, filtersOpen, onFilters, onPick, onArea, compact = false }: {
    query: ExploreQuery; records: PlaceRecord[]; allowed: LayerId[]; filtersOpen: boolean; onFilters: () => void;
    onPick: (record: PlaceRecord) => void; onArea: (area: GeocodeResult) => void; compact?: boolean;
}) {
    const [draft, setDraft] = useState(query.q);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const listId = useId();
    const box = useRef<HTMLDivElement>(null);
    // A search changed elsewhere (cleared filters, Back) replaces what is typed here.
    const [shown, setShown] = useState(query.q);
    if (shown !== query.q) { setShown(query.q); setDraft(query.q); }
    const areas = useAreaSuggestions(open ? draft : '');
    const suggestions = useMemo<Suggestion[]>(() => {
        const text = draft.trim();
        if (!text) return [];
        const matches = records.filter(record => searchRank(record.searchText, text) > 0)
            .sort((a, b) => searchRank(b.title, text) - searchRank(a.title, text)).slice(0, 5);
        return [
            { id: 'search', label: `Search for “${text}”`, meta: 'In the places on this map', kind: 'search' as const },
            ...matches.map(record => ({ id: record.key, label: record.title, meta: [typeLabel(record), record.city].filter(Boolean).join(' · '), kind: 'place' as const, record })),
            ...areas.map(area => ({ id: `area:${area.name}`, label: area.name, meta: area.type === 'CITY' ? 'Go to this city' : 'Go to this country', kind: 'area' as const, area })),
        ];
    }, [draft, records, areas]);
    const choose = (item: Suggestion | undefined) => {
        setOpen(false);
        if (!item || item.kind === 'search') { query.setQ(draft); return; }
        if (item.kind === 'place' && item.record) { setDraft(query.q); onPick(item.record); }
        if (item.kind === 'area' && item.area) { setDraft(query.q); onArea(item.area); }
    };
    const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown' && suggestions.length) { event.preventDefault(); setOpen(true); setActive(value => (value + 1) % suggestions.length); }
        else if (event.key === 'ArrowUp' && suggestions.length) { event.preventDefault(); setActive(value => (value - 1 + suggestions.length) % suggestions.length); }
        else if (event.key === 'Enter') { event.preventDefault(); choose(open ? suggestions[active] : undefined); }
        else if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false); }
    };
    const filterCount = query.activeFilters.length;
    const showList = open && suggestions.length > 0;
    return (
        <div className="gk-map-search" ref={box} onBlur={event => { if (!box.current?.contains(event.relatedTarget as Node)) setOpen(false); }}>
            <div className="gk-map-search__row">
                <span className="gk-search gk-map-search__field">
                    <Search aria-hidden="true" />
                    <input className="gk-input" type="search" role="combobox" aria-label="Search the map" placeholder="Search the map"
                        aria-expanded={showList} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={showList ? `${listId}-${active}` : undefined}
                        value={draft} maxLength={120} onFocus={() => setOpen(true)}
                        onChange={event => { setDraft(event.target.value); setOpen(true); setActive(0); if (!event.target.value && query.q) query.setQ(''); }} onKeyDown={onKey} />
                    {draft && <button type="button" className="gk-map-search__clear" aria-label="Clear search" onClick={() => { setDraft(''); query.setQ(''); }}><X aria-hidden="true" /></button>}
                </span>
                <Button variant={filtersOpen || filterCount ? 'secondary' : 'ghost'} iconOnly={compact} aria-expanded={filtersOpen} aria-label={compact ? `Filters${filterCount ? `, ${filterCount} on` : ''}` : undefined} onClick={onFilters} className="gk-map-search__filters">
                    <SlidersHorizontal aria-hidden="true" />{!compact && 'Filters'}{filterCount > 0 && <span className="gk-count">{filterCount}</span>}
                </Button>
            </div>
            {showList && (
                <ul className="gk-map-suggest" role="listbox" id={listId} aria-label="Suggestions">
                    {suggestions.map((item, index) => (
                        <li key={item.id} id={`${listId}-${index}`} role="option" aria-selected={index === active}
                            onMouseDown={event => event.preventDefault()} onClick={() => choose(item)} onMouseEnter={() => setActive(index)}>
                            <span className="gk-map-suggest__icon" data-tone={item.record?.tone} aria-hidden="true">{item.kind === 'search' ? <Search /> : item.kind === 'area' ? <MapPin /> : null}</span>
                            <span className="gk-map-suggest__text"><strong>{item.label}</strong><small>{item.meta}</small></span>
                        </li>
                    ))}
                </ul>
            )}
            {allowed.length > 1 && (
                <div className="gk-chips gk-map-layers" role="group" aria-label="Show on the map">
                    {LAYERS.filter(layer => allowed.includes(layer.id)).map(layer => (
                        <Chip key={layer.id} pressed={query.layers.includes(layer.id)} onClick={() => query.toggleLayer(layer.id)}>
                            <span className="gk-map-dot" data-tone={layer.tone} aria-hidden="true" />{layer.label}
                        </Chip>
                    ))}
                </div>
            )}
        </div>
    );
}
