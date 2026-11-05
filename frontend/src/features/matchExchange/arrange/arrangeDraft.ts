import { draftStarted, type Draft } from './matchPlan';

/** The two ways to arrange a match: invite a club (or name one not in GrassKickZ), or post an open challenge. */
export type ArrangeWay = 'invite' | 'open';
export const arrangeWayOf = (value: string | null | undefined): ArrangeWay | undefined => value === 'invite' || value === 'open' ? value : undefined;

/** Where an unsent arrangement is kept in this browser session: one per way, squad and opponent (never in the address). */
export const arrangeDraftKey = (userId: number | string, sessionId: string | null, way: ArrangeWay, squadId?: number, opponentId?: number) =>
    `${draftPrefix(userId, sessionId)}${[way, opponentId ? `c${opponentId}` : '', squadId ? `s${squadId}` : ''].filter(Boolean).join('.')}`;
const draftPrefix = (userId: number | string, sessionId: string | null) => `gk:arrange:${userId}:${sessionId}:`;

/** An unsent draft: its way, club and squad (as its key names them), the key it is kept under, and what it holds. */
export interface ArrangeDraft { way: ArrangeWay; opponentId?: number; squadId?: number; storageKey: string; draft: Partial<Draft>; savedAt: number }

const positive = (value?: string) => { const id = Number(value); return Number.isSafeInteger(id) && id > 0 ? id : undefined; };

/**
 * A draft's way, club and squad from its key: today's `invite.c7.s103` and `open.s103`, and release 16's
 * `direct.c7.s103`, `open.c7.s103` and My squads' own `coach-103` (fix round 1: those resume too).
 */
export function parseArrangeSeed(seed: string): Omit<ArrangeDraft, 'storageKey' | 'draft' | 'savedAt'> | undefined {
    const coach = /^coach-(\d+)$/.exec(seed);
    if (coach) return { way: 'invite', squadId: positive(coach[1]) };
    const [mode, ...parts] = seed.split('.');
    const way = mode === 'invite' || mode === 'direct' ? 'invite' : mode === 'open' ? 'open' : undefined;
    if (!way || parts.some(part => !/^[cs]\d+$/.test(part))) return undefined;
    const pick = (prefix: string) => positive(parts.find(part => part.startsWith(prefix))?.slice(1));
    return { way, opponentId: way === 'invite' ? pick('c') : undefined, squadId: pick('s') };
}

/**
 * Release 16's drafts move to today's keys once, whole: their request ids too, so a send that was lost on the way
 * is never made twice. A newer draft already under today's key stays; the older one then waits under its own key,
 * offered to continue (fix round 1).
 */
export function adoptOldDrafts(userId: number | string, sessionId: string | null) {
    const prefix = draftPrefix(userId, sessionId);
    try {
        const keys: string[] = [];
        for (let index = 0; index < sessionStorage.length; index++) {
            const key = sessionStorage.key(index);
            if (key?.startsWith(prefix)) keys.push(key);
        }
        for (const key of keys) {
            const seed = key.slice(prefix.length);
            if (!/^(direct|coach-)/.test(seed) && !/^open\..*c\d/.test(seed)) continue;
            const parsed = parseArrangeSeed(seed);
            if (!parsed) continue;
            const target = arrangeDraftKey(userId, sessionId, parsed.way, parsed.squadId, parsed.opponentId);
            const value = sessionStorage.getItem(key);
            if (value == null || sessionStorage.getItem(target) != null) continue;
            sessionStorage.setItem(target, value);
            sessionStorage.removeItem(key);
        }
    } catch { /* Storage is unavailable: nothing to move. */ }
}

/** Unsent drafts with something in them, newest first: what the arrange sheet offers to continue. */
export function arrangeDrafts(userId: number | string | undefined, sessionId: string | null): ArrangeDraft[] {
    if (userId == null) return [];
    const prefix = draftPrefix(userId, sessionId);
    const found: ArrangeDraft[] = [];
    try {
        for (let index = 0; index < sessionStorage.length; index++) {
            const key = sessionStorage.key(index);
            if (!key?.startsWith(prefix)) continue;
            const seed = parseArrangeSeed(key.slice(prefix.length));
            const draft = JSON.parse(sessionStorage.getItem(key) ?? 'null') as Partial<Draft> | null;
            if (seed && draft && draftStarted(draft)) found.push({ ...seed, storageKey: key, draft, savedAt: draft.savedAt ?? 0 });
        }
    } catch { /* Storage is unavailable: no drafts to offer. */ }
    return found.sort((a, b) => b.savedAt - a.savedAt);
}

/** Every list a new match shows in asks again once it is sent. */
export const NEW_MATCH_LISTS = ['listing:', 'history:', 'matchday:', 'my-seats:', 'my-fit:'];
