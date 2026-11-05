import { completeTutorial, readPreferences, updatePreferences, type Preferences } from '../preferences/preferencesStore';

/**
 * First-time tips: the first time someone opens a part of GrassKickZ (World, My Club, a new tournament, a post…) a card
 * pops out beside Agent Dola's button saying what it is for and offering Dola's help. Each tip shows once per account:
 * it is saved as `tip-<id>` among the finished tutorials in the person's preferences, so a phone and a laptop agree.
 */

/** Words in both app languages. */
export interface Words { en: string; ka: string }

/**
 * Where a tip shows on the first visit. `path` segments must match, `:name` matches any one segment and a trailing
 * `/*` any rest. `query` names values the address must carry: exactly, by beginning when it ends in `*`
 * (`peek: 'arrange-*'`), or any value at all (`true`).
 */
export interface TipPlace { path: string; query?: Record<string, string | true> }

export interface FirstTip {
    /** Lower-case letters, digits and dashes (the server keeps `tip-<id>`, at most 40 characters). */
    id: string;
    title: Words;
    /** What it is for and what the person can do there: two or three plain sentences. */
    body: Words;
    /**
     * What "Help me" asks Agent Dola: a request Dola is known to act on (each one was tried on the test site), shown on
     * the button as it will be sent. Left out where Dola cannot help yet, rather than offering a dead end.
     */
    ask?: Words;
    /**
     * Who "Help me" is for when `ask` is something only some roles do on the web: `staff` = a club's owner, admins or
     * coaches (the web's `club.workspace`), who arrange matches, message their players and start fundraisers. Anyone
     * else sees the tip with "Got it" only: never an offer their own Dola would have to turn down.
     */
    askFor?: 'staff';
    /** A form or window opened from a page: shown before that page's own tip. */
    action?: boolean;
    /**
     * The pages it explains. A tip shows only when something asks for it (`data-first-tip`) when it has no places, or
     * when its window marks the address only for a moment (one-shot flags such as `newEvent=1`).
     */
    places?: TipPlace[];
}

export const TIP_PREFIX = 'tip-';
/** Saved when the person turns the tips off; "Show page tips again" in the account menu removes it. */
export const TIPS_OFF = 'tips-off';
/** Asks for a tip by id from code, the same as clicking an element with `data-first-tip="<id>"`. */
export const FIRST_TIP_EVENT = 'first-tip:request';
export const requestFirstTip = (id: string) => window.dispatchEvent(new CustomEvent<string>(FIRST_TIP_EVENT, { detail: id }));

const segments = (path: string) => path.split('/').filter(Boolean);

/** How exactly a place fits an address: null when it does not; higher for fixed segments and named query values. */
export function placeScore(place: TipPlace, pathname: string, params: URLSearchParams): number | null {
    const want = segments(place.path), have = segments(pathname);
    const rest = want[want.length - 1] === '*';
    if (rest) want.pop();
    if (rest ? have.length < want.length : have.length !== want.length) return null;
    let score = 0;
    for (let index = 0; index < want.length; index++) {
        if (want[index].startsWith(':')) { score += 1; continue; }
        if (want[index] !== have[index]) return null;
        score += 3;
    }
    // A named query value says more than the path: `?tab=trials` picks one part of a page.
    for (const [key, value] of Object.entries(place.query ?? {})) {
        const got = params.get(key);
        if (got === null) return null;
        if (value === true) score += 10;
        else if (value.endsWith('*')) { if (!got.startsWith(value.slice(0, -1))) return null; score += 11; }
        else { if (got !== value) return null; score += 12; }
    }
    // An exact path beats the same path followed by anything.
    return score * 2 + (rest ? 0 : 1);
}

/** How exactly a tip fits an address (its best place), or null. A window's tip comes before its page's. */
export function tipScore(tip: FirstTip, pathname: string, params: URLSearchParams): number | null {
    let best: number | null = null;
    for (const place of tip.places ?? []) {
        const score = placeScore(place, pathname, params);
        if (score !== null && (best === null || score > best)) best = score;
    }
    return best === null ? null : best + (tip.action ? 1000 : 0);
}

/** The tip for this page: the most exact one not seen yet (so a page's own tip comes before its section's). */
export function tipForPage(tips: readonly FirstTip[], pathname: string, search: string, seen: ReadonlySet<string>): FirstTip | null {
    const params = new URLSearchParams(search);
    let found: FirstTip | null = null, foundScore = -1;
    for (const tip of tips) {
        if (seen.has(tip.id)) continue;
        const score = tipScore(tip, pathname, params);
        if (score !== null && score > foundScore) { found = tip; foundScore = score; }
    }
    return found;
}

/** The ids of the tips this person has seen. */
export function seenTips(preferences: Preferences): Set<string> {
    const seen = new Set<string>();
    for (const name of preferences.tutorials?.completed ?? []) if (name.startsWith(TIP_PREFIX)) seen.add(name.slice(TIP_PREFIX.length));
    return seen;
}
export const tipsOff = (preferences: Preferences) => (preferences.tutorials?.completed ?? []).includes(TIPS_OFF);

export const markTipSeen = (userId: number, id: string) => completeTutorial(userId, TIP_PREFIX + id);
export const turnTipsOff = (userId: number) => completeTutorial(userId, TIPS_OFF);

/** Every tip shows again on its next first visit, and tips are on. Other tutorials stay finished. */
export function resetTips(userId: number) {
    const completed = readPreferences(userId).tutorials?.completed ?? [];
    const kept = completed.filter(name => !name.startsWith(TIP_PREFIX) && name !== TIPS_OFF);
    if (kept.length === completed.length) return Promise.resolve();
    return updatePreferences(userId, { tutorials: { completed: kept } }).then(() => undefined);
}
