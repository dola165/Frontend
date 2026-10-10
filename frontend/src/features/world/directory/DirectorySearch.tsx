import { useEffect, useEffectEvent, useState } from 'react';
import { SearchInput } from '../../../design/primitives';
import { useWorldCopy } from '../copy';
import type { DirectoryState } from './useDirectoryState';

/**
 * The search box. Typing commits to the URL after a short pause; when the URL's search changes
 * from outside (a link, Back or Forward), the box follows it instead of writing old text back.
 */
export function DirectorySearch({ state, delay = 300 }: { state: Pick<DirectoryState, 'query' | 'setSearch' | 'source'>; delay?: number }) {
    const t = useWorldCopy();
    const committed = state.query.q;
    const [draft, setDraft] = useState(committed);
    const [last, setLast] = useState(committed);
    if (committed !== last) {
        setLast(committed);
        setDraft(committed);
    }
    const commitNow = () => {
        const value = draft.trim();
        if (value === committed) return;
        // Remember what this box committed, so only outside changes reset the text.
        setLast(value);
        state.setSearch(value);
    };
    const commit = useEffectEvent(commitNow);
    const pending = draft.trim() !== committed;
    // Commit after a pause while the box differs from the URL; every keystroke restarts the pause.
    useEffect(() => {
        if (!pending) return;
        const timer = window.setTimeout(commit, delay);
        return () => window.clearTimeout(timer);
    }, [draft, pending, delay]);
    return (
        <SearchInput className="gk-world-toolbar__search" value={draft} maxLength={120} placeholder={t(state.source.searchPlaceholder)}
            aria-label={t(state.source.searchLabel)} onChange={event => setDraft(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') commitNow(); }} />
    );
}
