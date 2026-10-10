import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../../design/primitives';
import { Tabs } from '../../../design/Tabs';
import { useAuth } from '../../../context/AuthContext';
import { useWorldCopy } from '../copy';
import { DirectoryBody } from './DirectoryBody';
import { useDirectoryState } from './useDirectoryState';
import type { AnySource } from './types';
import './directory.css';

/** A tab of a directory page that is not a searchable list, such as "My reservations". */
export interface DirectoryExtraTab { id: string; label: string; personal?: boolean; element: ReactNode }

/**
 * The World directory engine: one page shape for clubs, people, venues, matches, competitions
 * and opportunities. Each source supplies its loader, filters and item renderer.
 */
export function DirectoryPage({ title, subtitle, sources: allSources, extraTabs = [], tabAlias, actions, above }: {
    title: string; subtitle: ReactNode; sources: AnySource[]; extraTabs?: DirectoryExtraTab[];
    /** An older name of the `tab` parameter that links may still use. */ tabAlias?: string;
    actions?: ReactNode; /** Context shown above the tabs, such as who a parent is searching for. */ above?: ReactNode;
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
    return (
        <div className="gk-world-directory">
            <PageHeader title={title} subtitle={subtitle} actions={actions} />
            {above}
            {tabs.length > 1 && <Tabs label={title} value={extra?.id ?? state.source.id} onChange={id => { state.setTab(id); setResetKey(value => value + 1); }} items={tabs} />}
            {extra ? extra.element : <DirectoryBody key={`${state.source.id}:${resetKey}`} state={state} signedIn={signedIn} onReset={() => setResetKey(value => value + 1)} />}
        </div>
    );
}
