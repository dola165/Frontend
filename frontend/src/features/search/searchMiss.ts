import { reportOpened, type ResultRef } from './api';

/**
 * "Not what I was looking for", waiting to learn what the person opens next. Kept in this tab for a quarter of an
 * hour and only for the person who said it, so another sign-in never reports into someone else's record.
 */
interface Pending { id: number; user: number | null; at: number; from: string }

const KEY = 'tw-search-miss';
const FOR = 15 * 60 * 1000;

export function rememberMiss(id: number, user: number | null, from: string) {
    try { window.sessionStorage.setItem(KEY, JSON.stringify({ id, user, at: Date.now(), from } satisfies Pending)); } catch { /* no storage: the record keeps its words only */ }
}

export function pendingMiss(user: number | null): Pending | null {
    try {
        const stored = window.sessionStorage.getItem(KEY);
        if (!stored) return null;
        const pending = JSON.parse(stored) as Pending;
        if (pending.user === user && Date.now() - pending.at < FOR && Number.isInteger(pending.id)) return pending;
        window.sessionStorage.removeItem(KEY);
    } catch { /* unreadable: nothing waits */ }
    return null;
}

/** Reports the first thing opened after the miss, once. */
export function openedAfterMiss(user: number | null, opened: ResultRef, where?: string) {
    const pending = pendingMiss(user);
    if (!pending || (where !== undefined && where === pending.from)) return;
    try { window.sessionStorage.removeItem(KEY); } catch { /* already gone */ }
    void reportOpened(pending.id, opened).catch(() => { /* the miss itself is kept; what was opened is a bonus */ });
}
