import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs } from '../../../design/Tabs';
import { useAuth } from '../../../context/AuthContext';
import { useWorldCopy } from '../copy';
import { BelowMapHead } from '../stage/BelowMap';
import { StageHead } from '../stage/WorldStage';
import { useWorldArea } from '../useWorldArea';
import { useWorldData } from '../useWorldData';
import { directoryArea } from './useDirectoryData';
import { DirectoryBody } from './DirectoryBody';
import { DirectoryFilters } from './DirectoryFilters';
import { DirectorySearch } from './DirectorySearch';
import { isClearable, useDirectoryState } from './useDirectoryState';
import type { AnySource } from './types';
import './directory.css';

/** A tab of a directory page that is not a searchable list, such as "My reservations". */
export interface DirectoryExtraTab { id: string; label: string; personal?: boolean; element: ReactNode }

/**
 * The World directory engine: one page shape for clubs, people, venues, matches, competitions and opportunities.
 * The header row holds the title, the lists (when there are several), the search, the filters and the page's
 * actions; World's map and its Browse area panel show the results, and the results follow below.
 */
/**
 * How many results each list has before any filter, for its tab: one request per list that can count, following the
 * World area for lists narrowed by it. Unknown counts are left out; while they load the tab says "–".
 */
function useTabCounts(sources: AnySource[], signedIn: boolean) {
    const { sessionId } = useAuth();
    const { area: worldArea } = useWorldArea();
    const counting = sources.filter(source => source.count && (signedIn || !source.signInReason));
    const where = counting.map(source => directoryArea(source, worldArea));
    const ready = worldArea.ready && counting.length > 0;
    const key = ready ? `tab-counts|${sessionId}|${counting.map((source, i) => `${source.id}:${source.version ?? ''}:${where[i]?.city ?? (where[i] ? 'anywhere' : '')}`).join(',')}` : null;
    const counts = useWorldData(key, signal => Promise.all(counting.map((source, i) =>
        source.count!({ signal, sessionId, authenticated: signedIn, area: where[i] }).catch(() => null))), undefined, { follow: true });
    return (id: string): { count: number | string; tone?: 'warning'; label?: string } | undefined => {
        const index = counting.findIndex(source => source.id === id);
        if (index < 0) return undefined;
        if (counts.loading || !counts.data) return { count: '–' };
        const counted = counts.data[index];
        return counted == null ? undefined : typeof counted === 'number' ? { count: counted } : counted;
    };
}

export function DirectoryPage({ title, subtitle, sources: allSources, extraTabs = [], tabAlias, tabValues, opening, actions }: {
    title: string; subtitle: ReactNode; sources: AnySource[]; extraTabs?: DirectoryExtraTab[];
    /** An older name of the `tab` parameter that links may still use, and its older values by tab. */ tabAlias?: string; tabValues?: Record<string, string>;
    /** The tab chosen for who is looking, when the address names none. */ opening?: string;
    actions?: ReactNode;
}) {
    const t = useWorldCopy();
    const { status } = useAuth();
    const signedIn = status === 'authenticated';
    const sources = allSources.filter(item => signedIn || !item.personal);
    const extras = extraTabs.filter(item => signedIn || !item.personal);
    const state = useDirectoryState(sources, { tabAlias, tabValues, signedIn, opening });
    const [params] = useSearchParams();
    const extra = extras.find(item => item.id === params.get('tab'));
    const countOf = useTabCounts(sources, signedIn);
    const tabs = [...sources.map(item => ({ id: item.id, label: t(item.tabLabel ?? item.label), count: countOf(item.id)?.count, countTone: countOf(item.id)?.tone, countLabel: countOf(item.id)?.label && t(countOf(item.id)!.label!), icon: item.icon && <item.icon aria-hidden="true" /> })),
        ...extras.map(item => ({ id: item.id, label: t(item.label) }))];
    const [resetKey, setResetKey] = useState(0);
    // A tab's defaults for who is looking are written when it is opened, not again after Clear filters.
    const [fresh, setFresh] = useState(true);
    const clearable = isClearable(state);
    const clear = () => { state.clearFilters(); setFresh(false); setResetKey(value => value + 1); };
    // A list behind sign-in shows guests why and how to sign in, with nothing to search or filter yet.
    const searchable = !extra && !(state.source.signInReason && !signedIn);
    return (
        <div className="gk-world-directory">
            <StageHead>
                <header className="gk-world-head">
                    <div className="gk-world-head__titles"><h1>{title}</h1>{(state.source.subtitle || subtitle) && <p>{state.source.subtitle ? t(state.source.subtitle) : subtitle}</p>}</div>
                    {tabs.length > 1 && <Tabs className="gk-world-head__tabs" label={title} value={extra?.id ?? state.source.id} items={tabs}
                        onChange={id => { state.setTab(id); setFresh(true); setResetKey(value => value + 1); }} />}
                    {searchable && <DirectorySearch state={state} />}
                    {searchable && <DirectoryFilters state={state} signedIn={signedIn} onClear={clearable ? clear : undefined} />}
                    {actions && <div className="gk-world-head__actions">{actions}</div>}
                </header>
            </StageHead>
            {extra ? <><BelowMapHead title={t(extra.label)} />{extra.element}</> : <DirectoryBody key={`${state.source.id}:${resetKey}`} state={state} signedIn={signedIn} applyDefaults={fresh} clearable={clearable} onClear={clear} />}
        </div>
    );
}
