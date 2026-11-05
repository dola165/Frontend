import type { Match } from '../matchExchange/api';

/**
 * Where a match page was opened from (step 6): the page is one place for one match, opened in the context it came
 * from. `from` in the address names it; the top bar lights that place and the back link returns to it.
 * - `squad:12`: My squads › that squad's Matches ("← U14 Boys · Matches")
 * - `world`: World › Matches ("← Matches near you")
 * - `referee`: the referee's My matches ("← My matches")
 * - `competition:7`: an organiser's competition ("← Spring Cup")
 * - `parent`: Parent Hub; `home`: Home
 */
export type MatchFrom =
    | { kind: 'squad'; id: number }
    | { kind: 'world' }
    | { kind: 'referee' }
    | { kind: 'competition'; id: number }
    | { kind: 'parent'; playerId?: number }
    | { kind: 'home' };

export function parseFrom(value: string | null, player: string | null = null): MatchFrom | null {
    if (!value) return null;
    const squad = /^squad:(\d+)$/.exec(value);
    if (squad) return { kind: 'squad', id: Number(squad[1]) };
    const competition = /^competition:(\d+)$/.exec(value);
    if (competition) return { kind: 'competition', id: Number(competition[1]) };
    if (value === 'parent' && player && /^[1-9]\d*$/.test(player) && Number.isSafeInteger(Number(player))) return { kind: 'parent', playerId: Number(player) };
    return value === 'world' || value === 'referee' || value === 'parent' || value === 'home' ? { kind: value } : null;
}

export const fromParam = (from: MatchFrom) => from.kind === 'squad' || from.kind === 'competition' ? `${from.kind}:${from.id}` : from.kind;

/** The page's address for a match, opened in a context. */
export const matchPath = (eventId: number, from?: MatchFrom | null, hash = '') =>
    `/matches/${eventId}${from ? `?from=${encodeURIComponent(fromParam(from))}${from.kind === 'parent' && from.playerId ? `&player=${from.playerId}` : ''}` : ''}${hash}`;

/**
 * The context a match opens in when its link names none (an old link, a notification): the viewer's own squad on it,
 * else the referee's place when they officiate it, else World.
 */
export function defaultFrom(match: Pick<Match, 'viewer_squad_id' | 'own_appointments'>, parent: boolean): MatchFrom {
    if (match.viewer_squad_id) return parent ? { kind: 'parent' } : { kind: 'squad', id: match.viewer_squad_id };
    if (match.own_appointments?.length) return { kind: 'referee' };
    return { kind: 'world' };
}

/** The back link: where it goes and its words. */
export function backLink(from: MatchFrom, names: { squad?: string | null; competition?: string | null }, copy: (en: string, ka: string) => string) {
    switch (from.kind) {
        case 'squad': return { to: `/my-squads?tab=matches&squad=${from.id}`, label: names.squad ? copy(`${names.squad} · Matches`, `${names.squad} · მატჩები`) : copy('My squads · Matches', 'ჩემი გუნდები · მატჩები') };
        case 'referee': return { to: '/my-matches', label: copy('My matches', 'ჩემი მატჩები') };
        case 'competition': return { to: `/my-competitions?competition=${from.id}`, label: names.competition ?? copy('My competitions', 'ჩემი შეჯიბრებები') };
        case 'parent': return { to: from.playerId ? `/parent?player=${from.playerId}` : '/parent', label: copy('Parent Hub', 'მშობლის სივრცე') };
        case 'home': return { to: '/home', label: copy('Home', 'მთავარი') };
        default: return { to: '/world/matches', label: copy('Matches near you', 'მატჩები თქვენთან ახლოს') };
    }
}
