import { useEffect, useSyncExternalStore } from 'react';
import { onAccountChange } from './accountChange';
import { editsOf, type MediaEdit, type SavedCopy } from './api';

/**
 * What each picture on screen was edited from, asked for together: every note mounted in the same moment joins one
 * request (up to the server's 100). Answers are kept while the same account is signed in, a copy saved here is known
 * at once, and a failed question is asked again the next time a note mounts. Signing out or switching account forgets
 * them all (an answer still on its way for the old account is dropped), and notes on screen ask again.
 */
const known = new Map<string, MediaEdit | null>();
const waiting = new Set<string>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
let generation = 0;
const BATCH = 100;

const notify = () => { for (const listener of listeners) listener(); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

onAccountChange(() => {
    generation++;
    known.clear();
    waiting.clear();
    if (timer) { clearTimeout(timer); timer = undefined; }
    notify();
});

function flush() {
    timer = undefined;
    const urls = [...waiting].slice(0, BATCH);
    for (const url of urls) waiting.delete(url);
    if (waiting.size) timer = setTimeout(flush, 0);
    if (!urls.length) return;
    const asked = generation;
    void editsOf(urls).then(edits => {
        if (asked !== generation) return;
        for (const url of urls) known.set(url, edits.find(edit => edit.url === url) ?? null);
        notify();
    }).catch(() => undefined);
}

function ask(url: string) {
    if (known.has(url) || waiting.has(url)) return;
    waiting.add(url);
    timer ??= setTimeout(flush, 30);
}

/** A copy just saved here: its note shows without asking. */
export function rememberCopy(saved: SavedCopy) {
    known.set(saved.url, { url: saved.url, originalUrl: saved.originalUrl, originalAvailable: true, place: saved.place, editedBy: saved.editedBy, editedAt: saved.editedAt });
    notify();
}

/** The edit this picture is a copy from, `null` when it is not an edited copy, `undefined` while unknown. */
export function useEditedFrom(url: string | null | undefined) {
    const round = useSyncExternalStore(subscribe, () => generation, () => 0);
    useEffect(() => { if (url) ask(url); }, [url, round]);
    return useSyncExternalStore(subscribe, () => (url ? known.get(url) : null), () => undefined);
}
