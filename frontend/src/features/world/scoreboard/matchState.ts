import type { HistoryMatch } from '../../matchHistory/api';
import type { CopyVars } from '../copy';
import { fixtureTime } from '../format';
import { counted } from './form';
import { zoned } from './standings';

/** What a match is, worked out honestly from its statuses and the clock. Never "live": there is no live score. */
export type MatchStateCode = 'cancelled' | 'postponed' | 'abandoned' | 'bye' | 'ft' | 'tbc' | 'before' | 'on' | 'started' | 'unplayed' | 'disputed' | 'proposed' | 'none';
/** Words in English, the key of their translation; they are translated where they are shown. */
export interface Said { word: string; vars?: CopyVars }
export type WhenTone = 'danger' | 'accent' | 'muted';
export type TagTone = 'danger' | 'warning' | 'neutral';

export interface MatchState {
    code: MatchStateCode;
    /** The time column: a kick-off time, or a word in its place (FT, Canc., On now). */
    when: { time: string } | (Said & { tone?: WhenTone; /** Read out instead of the word. */ spoken?: string });
    /** The score, only when it counts (recorded or agreed): a proposed or disputed score is never shown. */
    score: { home: number; away: number } | null;
    /** One quiet thing still owed or coming (Confirm score, in 2 h). */
    tag?: Said & { tone: TagTone };
    /** Results carried over from before GrassKickZ. */
    faint?: boolean;
}

/** Tournament and club fixtures carry the ground's wall clock without a zone; read them as Georgian time. */
export const zonedMatch = (match: HistoryMatch): HistoryMatch => {
    const startsAt = zoned(match.startsAt), endsAt = zoned(match.endsAt);
    return startsAt === match.startsAt && endsAt === match.endsAt ? match : { ...match, startsAt, endsAt };
};

/** How long after kick-off a fixture with no end time is still "Started" rather than owing a result. */
const STARTED_FOR = 3 * 3_600_000;
const FIXTURE_WORD: Record<string, { code: MatchStateCode; word: string; tone: WhenTone }> = {
    CANCELLED: { code: 'cancelled', word: 'Canc.', tone: 'danger' },
    POSTPONED: { code: 'postponed', word: 'Postp.', tone: 'muted' },
    ABANDONED: { code: 'abandoned', word: 'Aband.', tone: 'muted' },
};

/**
 * The state of one match, in this order: called off, a bye, a result that counts (FT), no date yet, before kick-off
 * (own matches say how soon), on now by the schedule, just started (no end time), then what a played match still
 * owes. `own` is whether the viewer plays in it; "Add result" follows what the person may record. Whose turn a proposed
 * score is, a row does not say: it is "to confirm" for everyone (amber for those who may record results).
 */
export function matchState(source: HistoryMatch, now: number, own = false): MatchState {
    const match = zonedMatch(source);
    const off = FIXTURE_WORD[match.fixtureStatus?.toUpperCase()];
    if (off) return { code: off.code, when: { word: off.word, tone: off.tone }, score: null };
    if (match.resultStatus === 'BYE') return { code: 'bye', when: { word: 'Bye', tone: 'muted' }, score: null };
    if (counted(match)) return { code: 'ft', when: { word: 'FT', tone: 'muted' }, score: { home: match.homeScore!, away: match.awayScore! },
        faint: match.legacy || match.resultStatus === 'LEGACY' };
    if (!match.startsAt) return { code: 'tbc', when: { word: 'TBC', tone: 'muted' }, score: null };
    const start = Date.parse(match.startsAt), end = match.endsAt ? Date.parse(match.endsAt) : null;
    const time = fixtureTime(match.startsAt, match.timezone);
    // An open listing that never found an opponent is never on and never owes a result.
    if (match.source === 'MATCH_EXCHANGE' && match.awayClubId == null && !match.awayClubName) return now < start
        ? { code: 'before', when: { time }, score: null, tag: { word: 'Opponent wanted', tone: 'neutral' } }
        : { code: 'unplayed', when: { word: 'Not played', tone: 'muted' }, score: null };
    if (now < start) {
        const minutes = Math.round((start - now) / 60_000);
        const soon: Said | null = !own || minutes > 6 * 60 ? null
            : minutes < 60 ? { word: 'in {minutes} min', vars: { minutes: Math.max(1, minutes) } } : { word: 'in {hours} h', vars: { hours: Math.round(minutes / 60) } };
        return { code: 'before', when: { time }, score: null, tag: soon ? { ...soon, tone: 'neutral' } : undefined };
    }
    if (end != null && now < end) return { code: 'on', when: { word: 'On now', tone: 'accent', spoken: 'On now, by the schedule (no live score)' }, score: null };
    if (end == null && now - start < STARTED_FOR) return { code: 'started', when: { word: 'Started', tone: 'muted' }, score: null };
    if (match.resultStatus === 'DISPUTED') return { code: 'disputed', when: { time }, score: null, tag: { word: 'Disputed', tone: 'danger' } };
    if (match.resultStatus === 'PROPOSED') return { code: 'proposed', when: { time }, score: null,
        tag: { word: 'Score to confirm', tone: match.canRecordResult ? 'warning' : 'neutral' } };
    return { code: 'none', when: { time }, score: null, tag: match.canRecordResult ? { word: 'Add result', tone: 'warning' } : { word: 'No result yet', tone: 'neutral' } };
}
