import { useEffect, useEffectEvent, useId, useState, type ReactNode } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Columns2, List as ListIcon, Map as MapIcon } from 'lucide-react';
import { Button, ButtonLink, EmptyNote, PageHeader, Panel, SearchInput } from '../../../design/primitives';
import { Segmented, Tabs } from '../../../design/Tabs';
import { useAuth } from '../../../context/AuthContext';
import { buildLoginRedirectPath } from '../../../utils/authRedirect';
import { WorldMap } from '../map/WorldMap';
import { plural } from '../format';
import { DirectoryFilters } from './DirectoryFilters';
import { DirectoryResults } from './DirectoryResults';
import { useDirectoryData } from './useDirectoryData';
import { useDirectoryState, type DirectoryState } from './useDirectoryState';
import type { AnySource, DirectoryView } from './types';
import './directory.css';

/** Search commits after a short pause; the URL keeps the committed text. */
function DirectorySearch({ state }: { state: DirectoryState }) {
    const [draft, setDraft] = useState(state.query.q);
    const committed = state.query.q;
    const commit = useEffectEvent((value: string) => state.setSearch(value));
    useEffect(() => {
        if (draft.trim() === committed) return;
        const timer = window.setTimeout(() => commit(draft.trim()), 300);
        return () => window.clearTimeout(timer);
    }, [draft, committed]);
    return (
        <SearchInput className="gk-world-toolbar__search" value={draft} maxLength={120} placeholder={state.source.searchPlaceholder}
            aria-label={state.source.searchLabel} onChange={event => setDraft(event.target.value)} />
    );
}

const VIEW_ITEMS: { id: DirectoryView; label: string; icon: ReactNode }[] = [
    { id: 'list', label: 'List', icon: <ListIcon aria-hidden="true" /> },
    { id: 'split', label: 'List + map', icon: <Columns2 aria-hidden="true" /> },
    { id: 'map', label: 'Map', icon: <MapIcon aria-hidden="true" /> },
];

/** A tab of a directory page that is not a searchable list, such as "My reservations". */
export interface DirectoryExtraTab { id: string; label: string; personal?: boolean; element: ReactNode }

/**
 * The World directory engine: one page shape for clubs, people, venues, matches, competitions
 * and opportunities. Each source supplies its loader, filters and item renderer.
 */
export function DirectoryPage({ title, subtitle, sources: allSources, extraTabs = [], tabParam = 'tab', actions }: {
    title: string; subtitle: ReactNode; sources: AnySource[]; extraTabs?: DirectoryExtraTab[]; tabParam?: string; actions?: ReactNode;
}) {
    const { status } = useAuth();
    const signedIn = status === 'authenticated';
    const sources = allSources.filter(item => signedIn || !item.personal);
    const extras = extraTabs.filter(item => signedIn || !item.personal);
    const state = useDirectoryState(sources, tabParam);
    const [params] = useSearchParams();
    const extra = extras.find(item => item.id === params.get(tabParam));
    const tabs = [...sources.map(item => ({ id: item.id, label: item.tabLabel ?? item.label })), ...extras.map(item => ({ id: item.id, label: item.label }))];
    const [resetKey, setResetKey] = useState(0);
    return (
        <div className="gk-world-directory">
            <PageHeader title={title} subtitle={subtitle} actions={actions} />
            {tabs.length > 1 && <Tabs label={title} value={extra?.id ?? state.source.id} onChange={id => { state.setTab(id); setResetKey(value => value + 1); }} items={tabs} />}
            {extra ? extra.element : <DirectoryBody key={`${state.source.id}:${resetKey}`} state={state} signedIn={signedIn} onReset={() => setResetKey(value => value + 1)} />}
        </div>
    );
}

function DirectoryBody({ state, signedIn, onReset }: { state: DirectoryState; signedIn: boolean; onReset: () => void }) {
    const { source, query, view } = state;
    const location = useLocation();
    const sortId = useId();
    const gated = Boolean(source.signInReason) && !signedIn;
    const data = useDirectoryData(source, query, view, gated);
    const filtered = Boolean(query.q) || state.activeFilters.length > 0;
    const clear = () => { state.clearFilters(); onReset(); };
    const hasMap = Boolean(source.point);
    const count = data.loading ? `Searching ${source.noun[1]}…` : data.error ? '' : plural(data.total ?? data.items.length, source.noun[0], source.noun[1]);
    const Tools = source.Tools;

    const results = gated
        ? <Panel><EmptyNote title={`Sign in to see ${source.label.toLowerCase()}`} action={<ButtonLink variant="primary" size="sm" to={buildLoginRedirectPath(location.pathname, location.search, location.hash)}>Sign in</ButtonLink>}>{source.signInReason}</EmptyNote></Panel>
        : <DirectoryResults source={source} data={data} filtered={filtered} onClear={clear} />;
    const map = (variant: 'side' | 'wide') => (
        <WorldMap className={`gk-world-directory__map gk-world-directory__map--${variant}`} label={`${source.label} on the map`} points={data.points}
            footer={<><span>{data.pointsLoading ? 'Placing results on the map…' : `${plural(data.points.length, source.noun[0], source.noun[1])} on the map`}{data.items.length > data.points.length && !data.pointsLoading ? `, ${data.items.length - data.points.length} without a location` : ''}</span><ButtonLink size="sm" variant="ghost" to="/world/map">Open full map</ButtonLink></>} />
    );

    return (
        <>
            <div className="gk-world-toolbar">
                <DirectorySearch state={state} />
                <div className="gk-world-toolbar__tools">
                    {source.sorts && source.sorts.length > 1 && !gated && (
                        <label className="gk-world-toolbar__sort" htmlFor={sortId}>
                            <span className="gk-faint">Sort</span>
                            <select id={sortId} className="gk-input" value={query.sort} onChange={event => state.setSort(event.target.value)}>
                                {source.sorts.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                        </label>
                    )}
                    {hasMap && !gated && <Segmented label="Results view" value={view} onChange={state.setView} items={VIEW_ITEMS} className="gk-world-toolbar__view" />}
                </div>
            </div>
            {!gated && <DirectoryFilters state={state} signedIn={signedIn} />}
            {!gated && (
                <div className="gk-world-summary">
                    <p role="status" className="gk-world-summary__count">{count}{query.q && !data.loading ? ` for “${query.q}”` : ''}</p>
                    {filtered && <Button size="sm" variant="ghost" onClick={clear}>Clear filters</Button>}
                </div>
            )}
            {Tools && !gated && <Tools query={query} />}
            {view === 'split' && hasMap && !gated
                ? <div className="gk-world-split"><div className="gk-world-split__list">{results}</div>{map('side')}</div>
                : view === 'map' && hasMap && !gated
                    ? <div className="gk-stack">{map('wide')}{results}</div>
                    : results}
        </>
    );
}
