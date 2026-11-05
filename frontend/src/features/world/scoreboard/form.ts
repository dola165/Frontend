import type { HistoryMatch } from '../../matchHistory/api';

export type Outcome = 'W' | 'D' | 'L';
/** One result from one side's point of view. */
export interface FormResult { id: string; outcome: Outcome; scored: number; conceded: number; opponentName: string; opponentClubId: number | null; startsAt: string | null; detailPath: string }
/** A side: a squad when known, otherwise the whole club. */
export interface TeamRef { clubId: number | null; squadId?: number | null }

/** Results that count: recorded and agreed. A proposed, disputed or missing score is never read as a result (and never as a draw). */
const COUNTED = new Set(['CONFIRMED', 'SETTLED', 'FINAL', 'RECORDED', 'LEGACY']);
export const counted = (match: HistoryMatch) => COUNTED.has(match.resultStatus) && match.fixtureStatus !== 'CANCELLED' && match.homeScore != null && match.awayScore != null;

/** One end of a match: its club, squad and score. */
export const endOf = (match: HistoryMatch, end: 'home' | 'away') => end === 'home'
    ? { clubId: match.homeClubId, club: match.homeClubName, squadId: match.homeSquadId ?? null, squad: match.homeSquadName ?? null, score: match.homeScore }
    : { clubId: match.awayClubId, club: match.awayClubName, squadId: match.awaySquadId ?? null, squad: match.awaySquadName ?? null, score: match.awayScore };

/** Which end of the match the side played: by squad when the match names squads, otherwise by club. */
export function sideIn(match: HistoryMatch, side: TeamRef): 'home' | 'away' | null {
    if (side.squadId != null && (match.homeSquadId === side.squadId || match.awaySquadId === side.squadId)) return match.homeSquadId === side.squadId ? 'home' : 'away';
    if (side.squadId != null && (match.homeSquadId != null || match.awaySquadId != null) && side.clubId == null) return null;
    if (side.clubId != null && match.homeClubId === side.clubId) return 'home';
    if (side.clubId != null && match.awayClubId === side.clubId) return 'away';
    return null;
}

const resultFor = (match: HistoryMatch, end: 'home' | 'away'): FormResult => {
    const scored = end === 'home' ? match.homeScore! : match.awayScore!, conceded = end === 'home' ? match.awayScore! : match.homeScore!;
    const opponentName = [end === 'home' ? match.awayClubName : match.homeClubName, end === 'home' ? match.awaySquadName : match.homeSquadName].filter(Boolean).join(' ') || match.title;
    return { id: match.id, outcome: scored > conceded ? 'W' : scored < conceded ? 'L' : 'D', scored, conceded, opponentName,
        opponentClubId: end === 'home' ? match.awayClubId : match.homeClubId, startsAt: match.startsAt, detailPath: match.detailPath };
};
const newestFirst = (a: HistoryMatch, b: HistoryMatch) => Date.parse(b.startsAt ?? '') - Date.parse(a.startsAt ?? '');

/** A side's last results, newest first: the form guide. */
export function formOf(matches: HistoryMatch[], side: TeamRef, max = 5): FormResult[] {
    return matches.filter(counted).sort(newestFirst).flatMap(match => { const end = sideIn(match, side); return end ? [resultFor(match, end)] : []; }).slice(0, max);
}

/** Played, goals for and against, wins, draws and losses over some results. */
export function tally(results: FormResult[]) {
    return results.reduce((all, result) => ({ played: all.played + 1, scored: all.scored + result.scored, conceded: all.conceded + result.conceded,
        w: all.w + Number(result.outcome === 'W'), d: all.d + Number(result.outcome === 'D'), l: all.l + Number(result.outcome === 'L') }),
    { played: 0, scored: 0, conceded: 0, w: 0, d: 0, l: 0 });
}

/**
 * The last time two sides met (kicked off, not cancelled), from the first side's point of view. The result is
 * there only when the score counts; a meeting whose score is proposed, disputed or missing is still the last meeting.
 */
export function lastMeeting(matches: HistoryMatch[], mine: TeamRef, theirs: TeamRef, now = Date.now()): { match: HistoryMatch; result: FormResult | null } | null {
    const met = matches.filter(match => match.fixtureStatus !== 'CANCELLED' && match.startsAt && Date.parse(match.startsAt) <= now).sort(newestFirst)
        .find(match => { const a = sideIn(match, mine), b = sideIn(match, theirs); return a && b && a !== b; });
    return met ? { match: met, result: counted(met) ? resultFor(met, sideIn(met, mine)!) : null } : null;
}
