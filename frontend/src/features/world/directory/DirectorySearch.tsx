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
    // What this box last sent to the URL; the router may apply it a render later.
    const [sent, setSent] = useState<string | null>(null);
    if (committed !== last) {
        setLast(committed);
        if (committed === sent) setSent(null);
        else setDraft(committed);
    }
    const commitNow = () => {
        const value = draft.trim();
        if (value === committed) return;
        setSent(value);
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
