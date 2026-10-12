import { defaultPolicy, defaultRules, structures, type CompetitionRules, type EligibilityPolicy, type Family } from '../../competitions/api';
import type { TournamentParticipantScope, TournamentVisibility } from '../domain';

export type RegistrationPolicy = 'OPEN' | 'APPROVAL_ONLY' | 'INVITE_ONLY';

/**
 * A tournament being set up in the Draw room, kept in the browser tab as it is written: every field the backend's
 * create takes (identity, rules, eligibility policy, venue), with the team count and how entries are taken. Times are
 * the organiser's wall clock (`2026-11-07T10:00`), read in the rules' time zone.
 */
export interface DrawDraft {
    savedAt: number;
    organizerId: number | null; hostClubId: number | null; venueId: number | null;
    name: string; description: string; bannerImageUrl: string; writtenRules: string; incentives: string;
    visibility: TournamentVisibility; scope: TournamentParticipantScope;
    startDate: string; endDate: string; opensAt: string; closesAt: string;
    entryCap: number; registrationPolicy: RegistrationPolicy;
    rules: CompetitionRules; policy: EligibilityPolicy;
}

/** What a Draw room address can pre-choose: `draw-new`, `draw-o901` (the organiser), `draw-o901.fCUP` (and the family). */
export interface DrawSeed { organizerId?: number; family?: Family }
export const drawPeek = ({ organizerId, family }: DrawSeed = {}) => `draw-${[organizerId ? `o${organizerId}` : null, family ? `f${family}` : null].filter(Boolean).join('.') || 'new'}`;
export function parseDrawSeed(id: string): DrawSeed {
    const seed: DrawSeed = {};
    for (const part of id.split('.')) {
        if (/^o[1-9]\d*$/.test(part)) seed.organizerId = Number(part.slice(1));
        else if (/^f(LEAGUE|CUP|LADDER|FESTIVAL)$/.test(part)) seed.family = part.slice(1) as Family;
    }
    return seed;
}

/** The usual wording for the two texts the backend requires, never naming a federation. */
export const usualRuleset = 'Laws of the Game, with the organiser’s adaptations for this age and format, published before the first match.';
export const usualSeasonPolicy = (family: Family) => family === 'LEAGUE'
    ? 'One season: 3 points for a win, 1 for a draw. A team that withdraws has its results removed.'
    : 'A single event: results stand once the organiser confirms them.';

const pad = (value: number) => String(value).padStart(2, '0');
const wall = (date: Date, hour: number) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hour)}:00`;
/**
 * How an age group usually plays: players per side, match length and rest, and how many pitches a day needs
 * (small-sided games share a ground). The likely answer, changed freely.
 */
export function playedAt(ageGroup: string): Pick<CompetitionRules, 'sideSize' | 'matchMinutes' | 'restMinutes' | 'pitches'> {
    const age = /^U\d+$/.test(ageGroup) ? Number(ageGroup.slice(1)) : 99;
    return age <= 10 ? { sideSize: 5, matchMinutes: 20, restMinutes: 10, pitches: 2 } : age <= 12 ? { sideSize: 7, matchMinutes: 40, restMinutes: 10, pitches: 2 }
        : age <= 14 ? { sideSize: 9, matchMinutes: 60, restMinutes: 15, pitches: 1 } : age <= 18 ? { sideSize: 11, matchMinutes: 80, restMinutes: 20, pitches: 1 }
        : { sideSize: 11, matchMinutes: 90, restMinutes: 30, pitches: 1 };
}

/** A youth age group's cut-off: players born on or after 1 January of the year the age counts from. */
export const ageCutoffFor = (ageGroup: string, year: number) => /^U\d+$/.test(ageGroup) ? `${year - Number(ageGroup.slice(1))}-01-01` : null;

/**
 * A new tournament with the likely answers chosen: a cup on a Saturday three weeks out, 10:00 to 17:00 (a league runs
 * eight weeks), entries closing a week before, how the age plays (players per side, match length), eight teams, the organiser approving entries, private until published, and the
 * usual wording for the rules.
 */
export function freshDraft({ organizerId, family = 'CUP' }: DrawSeed = {}, ageGroup = 'SENIOR', now = new Date()): DrawDraft {
    const saturday = new Date(now);
    // Three weeks out, so teams have time to enter; entries close a week before.
    saturday.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7 || 7) + 14);
    const end = new Date(saturday);
    if (family === 'LEAGUE') end.setDate(end.getDate() + 56);
    const closes = new Date(saturday);
    closes.setDate(closes.getDate() - 7);
    const base = defaultRules(family);
    const rules: CompetitionRules = { ...base, ...playedAt(ageGroup), ageGroup, ageCutoff: ageCutoffFor(ageGroup, saturday.getFullYear()), ruleset: usualRuleset, seasonPolicy: usualSeasonPolicy(family),
        playingLevel: ageGroup === 'SENIOR' ? base.playingLevel : 'DEVELOPMENT', eligibilityCategory: 'Open' };
    return {
        savedAt: now.getTime(), organizerId: organizerId ?? null, hostClubId: null, venueId: null,
        name: '', description: '', bannerImageUrl: '', writtenRules: '', incentives: '', visibility: 'PRIVATE', scope: 'CLUB',
        startDate: wall(saturday, 10), endDate: wall(end, 17), opensAt: '', closesAt: wall(closes, 0),
        entryCap: 8, registrationPolicy: 'APPROVAL_ONLY', rules, policy: defaultPolicy(),
    };
}

/** Where a person's draft is kept in this browser tab. */
export const drawDraftKey = (userId: number | null | undefined, sessionId: string | null) => `draw-draft:${userId ?? 'guest'}:${sessionId ?? ''}`;

const STRINGS: (keyof DrawDraft)[] = ['name', 'description', 'bannerImageUrl', 'writtenRules', 'incentives', 'startDate', 'endDate', 'opensAt', 'closesAt'];
const ID = (value: unknown) => value === null || (Number.isSafeInteger(value) && Number(value) > 0);
/** A stored draft, if it is one this version can continue; anything else is ignored rather than trusted. */
export function readDrawDraft(raw: unknown): DrawDraft | null {
    if (!raw || typeof raw !== 'object') return null;
    const draft = raw as Record<string, unknown>;
    const rules = draft.rules as Record<string, unknown> | undefined;
    if (!Number.isFinite(draft.savedAt) || !ID(draft.organizerId) || !ID(draft.hostClubId) || !ID(draft.venueId)
        || !STRINGS.every(key => typeof draft[key] === 'string')
        || !['PRIVATE', 'PUBLIC', 'UNLISTED'].includes(String(draft.visibility)) || !['CLUB', 'SQUAD', 'PLAYER'].includes(String(draft.scope))
        || !['OPEN', 'APPROVAL_ONLY', 'INVITE_ONLY'].includes(String(draft.registrationPolicy)) || !Number.isSafeInteger(draft.entryCap)
        || !rules || typeof rules !== 'object' || !Object.hasOwn(structures, String(rules.family))
        || !structures[rules.family as Family].includes(rules.structure as CompetitionRules['structure'])
        || !Object.keys(defaultRules()).every(key => key in rules)
        || !draft.policy || typeof draft.policy !== 'object' || !Object.keys(defaultPolicy()).every(key => key in (draft.policy as object))) return null;
    return draft as unknown as DrawDraft;
}

export function loadDrawDraft(key: string): DrawDraft | null {
    try { return readDrawDraft(JSON.parse(sessionStorage.getItem(key) || 'null')); } catch { return null; }
}
export function saveDrawDraft(key: string, draft: DrawDraft) {
    try { sessionStorage.setItem(key, JSON.stringify(draft)); } catch { /* The draft stays in the open drawer when storage is unavailable. */ }
}
export function clearDrawDraft(key: string) {
    try { sessionStorage.removeItem(key); } catch { /* Nothing kept. */ }
}
/** Whether a draft holds anything the person wrote (a fresh one is not offered as "Continue"). */
export const drawStarted = (draft: DrawDraft) => Boolean(draft.name.trim() || draft.description.trim() || draft.incentives.trim());
