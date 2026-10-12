import { draftStarted, type Draft } from '../../matchExchange/arrange/matchPlan';
import { peekOf } from '../peek/usePeek';

/** How an Arrange a match frame starts: inviting a club (`direct`, perhaps a named one) or posting an open match, from one of our squads. */
export interface ArrangeSeed { mode: 'direct' | 'open'; opponentId?: number; squadId?: number }

const positive = (value?: string) => { const id = Number(value); return Number.isSafeInteger(id) && id > 0 ? id : undefined; };

/**
 * The frame's id in the address (`peek=arrange-direct.c7.s103`): the mode, the club it started from, our squad. The
 * club stays in an open match's id too (the open form does not use it), so switching back to inviting keeps it.
 */
export function arrangeSeed({ mode, opponentId, squadId }: ArrangeSeed) {
    return [mode, opponentId ? `c${opponentId}` : '', squadId ? `s${squadId}` : ''].filter(Boolean).join('.');
}
export function parseArrangeSeed(id: string): ArrangeSeed {
    const [mode, ...parts] = id.split('.');
    const pick = (prefix: string) => positive(parts.find(part => part.startsWith(prefix))?.slice(1));
    return { mode: mode === 'open' ? 'open' : 'direct', opponentId: pick('c'), squadId: pick('s') };
}
/** The drawer (or pane) value that opens Arrange a match. */
export const arrangePeek = (seed: ArrangeSeed) => peekOf('arrange', arrangeSeed(seed));

/** Where a frame's draft is kept in this browser session (one per seed, never in the address). */
export const arrangeDraftKey = (userId: number | string, sessionId: string | null, seed: string) => `gk:arrange:${userId}:${sessionId}:${seed}`;

export interface ArrangeDraft { seed: string; draft: Partial<Draft>; savedAt: number }
/** Unsent Arrange drafts with something in them, newest first: what "Continue" offers in the + menu. */
export function arrangeDrafts(userId: number | string | undefined, sessionId: string | null): ArrangeDraft[] {
    if (userId == null) return [];
    const prefix = arrangeDraftKey(userId, sessionId, '');
    const found: ArrangeDraft[] = [];
    try {
        for (let index = 0; index < sessionStorage.length; index++) {
            const key = sessionStorage.key(index);
            if (!key?.startsWith(prefix)) continue;
            const draft = JSON.parse(sessionStorage.getItem(key) ?? 'null') as Partial<Draft> | null;
            if (draft && draftStarted(draft)) found.push({ seed: key.slice(prefix.length), draft, savedAt: draft.savedAt ?? 0 });
        }
    } catch { /* Storage is unavailable: no drafts to offer. */ }
    return found.sort((a, b) => b.savedAt - a.savedAt);
}

/** Arrange a match as a link from anywhere: World's Matches with the frame open (Back closes it). */
export const arrangePath = (seed: ArrangeSeed) => `/world/matches?tab=mine&peek=${arrangePeek(seed)}`;
