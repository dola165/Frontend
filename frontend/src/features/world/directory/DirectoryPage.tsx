import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs } from '../../../design/Tabs';
import { useAuth } from '../../../context/AuthContext';
import { useWorldCopy } from '../copy';
import { StageHead } from '../stage/WorldStage';
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
export function DirectoryPage({ title, subtitle, sources: allSources, extraTabs = [], tabAlias, actions }: {
    title: string; subtitle: ReactNode; sources: AnySource[]; extraTabs?: DirectoryExtraTab[];
    /** An older name of the `tab` parameter that links may still use. */ tabAlias?: string;
    actions?: ReactNode;
}) {
    const t = useWorldCopy();
    const { status } = useAuth();
    const signedIn = status === 'authenticated';
    const sources = allSources.filter(item => signedIn || !item.personal);
    const extras = extraTabs.filter(item => signedIn || !item.personal);
    const state = useDirectoryState(sources, { tabAlias, signedIn });
    const [params] = useSearchParams();
    const extra = extras.find(item => item.id === params.get('tab'));
    const tabs = [...sources.map(item => ({ id: item.id, label: t(item.tabLabel ?? item.label) })), ...extras.map(item => ({ id: item.id, label: t(item.label) }))];
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
                    <div className="gk-world-head__titles"><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
                    {tabs.length > 1 && <Tabs className="gk-world-head__tabs" label={title} value={extra?.id ?? state.source.id} items={tabs}
                        onChange={id => { state.setTab(id); setFresh(true); setResetKey(value => value + 1); }} />}
                    {searchable && <DirectorySearch state={state} />}
                    {searchable && <DirectoryFilters state={state} signedIn={signedIn} onClear={clearable ? clear : undefined} />}
                    {actions && <div className="gk-world-head__actions">{actions}</div>}
                </header>
            </StageHead>
            {extra ? extra.element : <DirectoryBody key={`${state.source.id}:${resetKey}`} state={state} signedIn={signedIn} applyDefaults={fresh} clearable={clearable} onClear={clear} />}
        </div>
    );
}
