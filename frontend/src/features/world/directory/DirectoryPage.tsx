import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PanelLeft, PanelTop } from 'lucide-react';
import { Tabs } from '../../../design/Tabs';
import { Chip } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { useWorldCopy } from '../copy';
import { BelowMapHead } from '../stage/BelowMap';
import { StageHead } from '../stage/WorldStage';
import { useWorldArea } from '../useWorldArea';
import { useWorldData } from '../useWorldData';
import { useWorldLayout } from '../useWorldLayout';
import { directoryArea } from './useDirectoryData';
import { DirectoryBody } from './DirectoryBody';
import { DirectoryFilters } from './DirectoryFilters';
import { DirectorySearch } from './DirectorySearch';
import { FilterLines } from './FilterLines';
import { ListSplit } from './ListSplit';
import { isClearable, useDirectoryState } from './useDirectoryState';
import type { AnySource } from './types';
import './directory.css';
import './side.css';

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
    const { sessionId, user } = useAuth();
    const { area: worldArea } = useWorldArea();
    const counting = sources.filter(source => source.count && (signedIn || !source.signInReason));
    const where = counting.map(source => directoryArea(source, worldArea));
    const ready = worldArea.ready && counting.length > 0;
    const key = ready ? `tab-counts|${sessionId}|${counting.map((source, i) => `${source.id}:${source.version ?? ''}:${where[i]?.city ?? (where[i] ? 'anywhere' : '')}`).join(',')}` : null;
    const counts = useWorldData(key, signal => Promise.all(counting.map((source, i) =>
        source.count!({ signal, sessionId, authenticated: signedIn, area: where[i], userId: user?.id ?? null }).catch(() => null))), undefined, { follow: true });
    return (id: string): { count: number | string; tone?: 'warning'; label?: string } | undefined => {
        const index = counting.findIndex(source => source.id === id);
        if (index < 0) return undefined;
        if (counts.loading || !counts.data) return { count: '–' };
        const counted = counts.data[index];
        return counted == null ? undefined : typeof counted === 'number' ? { count: counted } : counted;
    };
}

/** The way to the other placement of the filters: beside the map (a column) or above it (a header row). */
function FiltersPlacement({ side, toggle }: { side: boolean; toggle: () => void }) {
    const t = useWorldCopy();
    const label = side ? t('Filters above the map') : t('Filters beside the map');
    return (
        <button type="button" className="gk-world-placement" onClick={toggle} aria-label={label} title={label}>
            {side ? <PanelTop aria-hidden="true" /> : <PanelLeft aria-hidden="true" />}
        </button>
    );
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
    // Beside the map (the default): no header row; the map fills the screen and a column on its left holds the search,
    // the lists as kinds (one at a time, each with its pin's colour) and the filters as long lines. Above the map: a
    // header row, the filters on one line, the results below.
    const { side, toggle } = useWorldLayout();
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
    const choose = (id: string) => { state.setTab(id); setFresh(true); setResetKey(value => value + 1); };
    if (side && !extra) {
        const head = (
            <div className="gk-world-side__head">
                <h1 className="gk-visually-hidden">{title}</h1>
                <div className="gk-world-side__search">
                    {searchable && <DirectorySearch state={state} />}
                    <FiltersPlacement side toggle={toggle} />
                </div>
                {actions && <div className="gk-world-side__actions">{actions}</div>}
                {tabs.length > 1 && (
                    <div className="gk-chips gk-world-side__kinds" role="group" aria-label={title}>
                        {sources.map(item => {
                            const count = countOf(item.id);
                            return (
                                <Chip key={item.id} pressed={item.id === state.source.id} onClick={() => item.id !== state.source.id && choose(item.id)}>
                                    {item.tone && <span className="gk-world-pin gk-world-pin--key" data-tone={item.tone} aria-hidden="true" />}{t(item.tabLabel ?? item.label)}
                                    {count && count.count !== '–' && <span className="gk-world-side__count" data-tone={count.tone} aria-label={count.label && `${count.count} ${t(count.label)}`}>{count.count}</span>}
                                </Chip>
                            );
                        })}
                        {extras.map(item => <Chip key={item.id} pressed={false} onClick={() => choose(item.id)}>{t(item.label)}</Chip>)}
                    </div>
                )}
            </div>
        );
        return (
            <div className="gk-world-directory">
                <DirectoryBody key={`${state.source.id}:${resetKey}`} state={state} signedIn={signedIn} applyDefaults={fresh} clearable={clearable} onClear={clear}
                    side head={head} filters={searchable && <FilterLines state={state} signedIn={signedIn} onClear={clearable ? clear : undefined} />} />
            </div>
        );
    }
    return (
        <div className="gk-world-directory">
            <StageHead>
                <header className="gk-world-head">
                    <div className="gk-world-head__titles"><h1>{title}</h1>{(state.source.subtitle || subtitle) && <p>{state.source.subtitle ? t(state.source.subtitle) : subtitle}</p>}</div>
                    {tabs.length > 1 && <Tabs className="gk-world-head__tabs" label={title} value={extra?.id ?? state.source.id} items={tabs} onChange={choose} />}
                    {searchable && <DirectorySearch state={state} />}
                    <div className="gk-world-head__actions">{actions}<FiltersPlacement side={false} toggle={toggle} /></div>
                    {/* The filters: one line above the map and the list alike, the same height on every tab. */}
                    <div className="gk-world-head__filters">{searchable && <DirectoryFilters state={state} signedIn={signedIn} onClear={clearable ? clear : undefined} />}</div>
                </header>
            </StageHead>
            {extra ? <ListSplit><BelowMapHead title={t(extra.label)} />{extra.element}</ListSplit> : <DirectoryBody key={`${state.source.id}:${resetKey}`} state={state} signedIn={signedIn} applyDefaults={fresh} clearable={clearable} onClear={clear} />}
        </div>
    );
}
