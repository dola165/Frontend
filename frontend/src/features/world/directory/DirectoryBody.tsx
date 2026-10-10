import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Columns2, List as ListIcon, Map as MapIcon } from 'lucide-react';
import { Button, ButtonLink, EmptyNote, Panel } from '../../../design/primitives';
import { Segmented } from '../../../design/Tabs';
import { buildLoginRedirectPath } from '../../../utils/authRedirect';
import { plural, useWorldCopy } from '../copy';
import { WorldMap } from '../map/WorldMap';
import { DirectoryFilters } from './DirectoryFilters';
import { DirectorySearch } from './DirectorySearch';
import { DirectoryResults } from './DirectoryResults';
import { DirectorySelectionContext } from './selection';
import { useDirectoryData } from './useDirectoryData';
import { CARRIED, type DirectoryState } from './useDirectoryState';
import type { DirectoryView } from './types';
import { useRestoredScroll } from './useRestoredScroll';

const VIEW_ITEMS: { id: DirectoryView; label: string; icon: ReactNode }[] = [
    { id: 'list', label: 'List', icon: <ListIcon aria-hidden="true" /> },
    { id: 'split', label: 'List + map', icon: <Columns2 aria-hidden="true" /> },
    { id: 'map', label: 'Map', icon: <MapIcon aria-hidden="true" /> },
];

/** One source's search, filters, count and results, with the map beside or above them. */
export function DirectoryBody({ state, signedIn, onReset }: { state: DirectoryState; signedIn: boolean; onReset: () => void }) {
    const t = useWorldCopy();
    const { source, query, view } = state;
    const location = useLocation();
    const sortId = useId();
    const gated = Boolean(source.signInReason) && !signedIn;
    const data = useDirectoryData(source, query, view, gated, { pages: state.shown, onPages: state.setShown });
    // Scroll returns once the results (with every page that was shown) are back, or cannot come back.
    useRestoredScroll(gated || (!data.loading && (data.items.length > 0 || Boolean(data.error || data.notice))));
    const [selectedId, setSelectedId] = useState<string>();
    const [hoverId, setHoverId] = useState<string>();
    const listRef = useRef<HTMLDivElement>(null);
    // A pin chosen on the map brings its result into view in the list beside it.
    useEffect(() => { if (selectedId) listRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [selectedId]);

    // The child a parent searches for narrows results but is kept by Clear filters, like the area.
    const clearable = Boolean(query.q) || state.activeFilters.some(filter => !CARRIED.includes(filter.key));
    const filtered = clearable || state.activeFilters.length > 0;
    const clear = () => { state.clearFilters(); onReset(); };
    const hasMap = Boolean(source.point);
    const nouns = [source.noun[0], source.noun[1]] as const;
    // An unknown total is never guessed: the count says what is shown, with "+" while more remain.
    const count = data.loading ? t('Searching {things}…', { things: t(nouns[1]) }) : data.error || data.notice ? ''
        : data.total != null ? plural(data.total, ...nouns) : data.hasMore ? t('{count}+ found', { count: data.items.length }) : data.items.length ? plural(data.items.length, ...nouns) : '';
    const sortable = source.sorts && source.sorts.length > 1 && (!source.sortable || source.sortable(query));
    const Tools = source.Tools;

    if (gated) return (
        <Panel>
            <EmptyNote title={t('Sign in to see {things}', { things: t(source.label).toLowerCase() })}
                action={<ButtonLink variant="primary" size="sm" to={buildLoginRedirectPath(location.pathname, location.search, location.hash)}>{t('Sign in')}</ButtonLink>}>
                {t(source.signInReason!)}
            </EmptyNote>
        </Panel>
    );

    const results = <DirectoryResults source={source} data={data} filtered={filtered} onClear={clearable ? clear : undefined} />;
    const map = (variant: 'side' | 'wide') => (
        <WorldMap className={`gk-world-directory__map gk-world-directory__map--${variant}`} label={t('{things} on the map', { things: t(source.label) })} points={data.points}
            selectedId={selectedId} onSelect={setSelectedId} highlightId={hoverId}
            footer={<>
                <span>{data.pointsLoading ? t('Placing results on the map…') : t('{count} on the map', { count: plural(data.points.length, ...nouns) })}
                    {data.items.length > data.points.length && !data.pointsLoading ? ` · ${t('{count} without a location', { count: data.items.length - data.points.length })}` : ''}</span>
                <ButtonLink size="sm" variant="ghost" to={source.mapLink ? source.mapLink(query) : '/world/map'}>{t('Open full map')}</ButtonLink>
            </>} />
    );
    const selection = { selectedId, hover: setHoverId };

    return (
        <>
            <div className="gk-world-toolbar">
                <DirectorySearch state={state} />
                <div className="gk-world-toolbar__tools">
                    {sortable && (
                        <label className="gk-world-toolbar__sort" htmlFor={sortId}>
                            <span className="gk-faint">{t('Sort')}</span>
                            <select id={sortId} className="gk-input" value={query.sort} onChange={event => state.setSort(event.target.value)}>
                                {source.sorts!.map(option => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
                            </select>
                        </label>
                    )}
                    {hasMap && <Segmented label={t('Results view')} value={view} onChange={state.setView} items={VIEW_ITEMS.map(item => ({ ...item, label: t(item.label) }))} className="gk-world-toolbar__view" />}
                </div>
            </div>
            <DirectoryFilters state={state} signedIn={signedIn} />
            <div className="gk-world-summary">
                <p role="status" className="gk-world-summary__count">{count}{query.q && count && !data.loading ? ` · “${query.q}”` : ''}</p>
                {clearable && <Button size="sm" variant="ghost" onClick={clear}>{t('Clear filters')}</Button>}
            </div>
            {Tools && <Tools query={query} refresh={data.retry} />}
            <DirectorySelectionContext.Provider value={view !== 'list' && hasMap ? selection : null}>
                {view === 'split' && hasMap
                    ? <div className="gk-world-split"><div className="gk-world-split__list" ref={listRef}>{results}</div>{map('side')}</div>
                    : view === 'map' && hasMap
                        ? <div className="gk-stack" ref={listRef}>{map('wide')}{results}</div>
                        : results}
            </DirectorySelectionContext.Provider>
        </>
    );
}
