import { Handshake, Star, Trophy } from 'lucide-react';
import type { HistoryMatch } from '../../../matchHistory/api';
import type { ResultGroup } from '../../directory/groups';
import { wt } from '../../copy';
import type { PinSummary } from '../../directory/panelGroups';
import { fixtureTime, isoDayOf } from '../../format';
import { endOf } from '../../scoreboard/form';
import { matchCode } from '../../scoreboard/matchCode';
import { matchState, zonedMatch } from '../../scoreboard/matchState';
import { sideIsMine, type MyTeams } from '../../scoreboard/myTeams';
import { peekOf } from '../../peek/usePeek';

/**
 * A fixture or result as Matches lists it: the match (its times read as the ground's clock), its code (list key,
 * choice and drawer), its Georgian day, which sides are mine, and whether the list spans days (so a row says its day).
 */
export interface Fixture { m: HistoryMatch; code: string; day: string | null; mine: { home: boolean; away: boolean }; showDay: boolean }

/** Rows as fixtures. A placeholder knockout fixture (neither side known yet) is not a match to list. */
export function toFixtures(items: HistoryMatch[], mine: MyTeams, showDay: boolean): Fixture[] {
    return items.filter(m => m.homeClubId != null || m.homeClubName || m.awayClubId != null || m.awayClubName).map(source => {
        const m = zonedMatch(source);
        return { m, code: matchCode(m), day: m.startsAt ? isoDayOf(m.startsAt) : null, showDay,
            mine: { home: sideIsMine(endOf(m, 'home'), mine), away: sideIsMine(endOf(m, 'away'), mine) } };
    });
}

const MINE: ResultGroup = { key: 'mine', label: 'Your teams', rank: 0, icon: Star, tint: 'warning' };
const FRIENDLIES: ResultGroup = { key: 'friendlies', label: 'Friendlies', rank: 3, icon: Handshake, tint: 'accent' };
const CLUB: ResultGroup = { key: 'club', label: 'Club fixtures', rank: 4, icon: Trophy, tint: 'accent' };
const UNDATED: ResultGroup = { key: 'undated', label: 'Date to confirm', rank: 5 };

/**
 * Which card a fixture sits in: my teams' first (and only there), then each tournament in the order of its first
 * kick-off, then friendlies, then club fixtures (real rows carry no league name), and matches still without a date last.
 */
export function fixtureGroup(f: Fixture): ResultGroup {
    const { m } = f;
    if (f.mine.home || f.mine.away) return MINE;
    if (!m.startsAt) return UNDATED;
    if (m.source === 'TOURNAMENT' && m.tournamentId != null) return {
        key: `t${m.tournamentId}`, label: m.tournamentName || m.title, icon: Trophy, tint: 'accent', rank: 1 + Date.parse(m.startsAt) / 1e13,
        action: { label: 'Table', to: `/tournaments/${m.tournamentId}`, peek: peekOf('tournament', m.tournamentId) },
    };
    return m.source === 'MATCH_EXCHANGE' ? FRIENDLIES : CLUB;
}

/** The ground every fixture in a card shares, when they all share one ("Mtskheta Riverside Field"). */
export function sharedGround(rows: Fixture[]) {
    const grounds = new Set(rows.map(f => f.m.locationName?.split(',')[0].trim() ?? ''));
    return grounds.size === 1 && !grounds.has('') ? [...grounds][0] : undefined;
}

/**
 * What the matches at one pin have in common, for the Browse area and the pin: the ground's name, the kick-off range
 * ("10:30–15:00"), and the pin's chip: one match says its state ("FT 4–3", "On now", "Canc.", "11:00"), several the
 * next kick-off there.
 */
export function fixtureWhere(rows: Fixture[], now = Date.now()): PinSummary {
    // A called-off match says so on its own line, but sets neither the ground's kick-off range nor its next kick-off.
    const playing = rows.filter(f => f.m.startsAt && f.m.fixtureStatus?.toUpperCase() !== 'CANCELLED');
    const sorted = (playing.length ? playing : rows.filter(f => f.m.startsAt)).sort((a, b) => Date.parse(a.m.startsAt!) - Date.parse(b.m.startsAt!));
    const times = sorted.map(f => fixtureTime(f.m.startsAt, f.m.timezone));
    const detail = times.length ? (times[0] === times[times.length - 1] ? times[0] : `${times[0]}–${times[times.length - 1]}`) : undefined;
    let chip: string | undefined;
    if (rows.length === 1) {
        const state = matchState(rows[0].m, now);
        chip = state.score ? `${wt('FT')} ${state.score.home}–${state.score.away}` : 'time' in state.when ? state.when.time : wt(state.when.word);
    } else {
        const next = sorted.find(f => Date.parse(f.m.startsAt!) > now);
        chip = next ? fixtureTime(next.m.startsAt, next.m.timezone) : sorted.some(f => matchState(f.m, now).code === 'on') ? wt('On now') : undefined;
    }
    return { label: sharedGround(rows), detail, chip };
}
