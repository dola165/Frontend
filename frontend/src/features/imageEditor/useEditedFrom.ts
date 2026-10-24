import { useEffect, useSyncExternalStore } from 'react';
import { editsOf, type MediaEdit, type SavedCopy } from './api';

/**
 * What each picture on screen was edited from, asked for together: every note mounted in the same moment joins one
 * request (up to the server's 100). Answers are kept for the page's life, a copy saved here is known at once, and a
 * failed question is asked again the next time a note mounts.
 */
const known = new Map<string, MediaEdit | null>();
const waiting = new Set<string>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
const BATCH = 100;

const notify = () => { for (const listener of listeners) listener(); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

function flush() {
    timer = undefined;
    const urls = [...waiting].slice(0, BATCH);
    for (const url of urls) waiting.delete(url);
    if (waiting.size) timer = setTimeout(flush, 0);
    if (!urls.length) return;
    void editsOf(urls).then(edits => {
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
    useEffect(() => { if (url) ask(url); }, [url]);
    return useSyncExternalStore(subscribe, () => (url ? known.get(url) : null), () => undefined);
}
