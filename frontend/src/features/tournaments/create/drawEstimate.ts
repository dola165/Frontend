import type { CompetitionRules } from '../../competitions/api';

/**
 * A labelled estimate of what a tournament will be, before its draw: how many matches, and how long on its pitches
 * for a one-day event, or how many matchdays for a league. Groups and finals are counted with two groups of the teams
 * and two going through from each (the draw sets the real numbers). A ladder has no fixed number: its matches are
 * the challenges made.
 */
export interface DrawEstimate { matches: number | null; minutes: number | null; matchdays: number | null; setAtDraw: boolean }

const pairs = (teams: number) => (teams * (teams - 1)) / 2;
const roundsOf = (teams: number) => (teams % 2 ? teams : teams - 1);

export function drawEstimate(rules: Pick<CompetitionRules, 'structure' | 'matchMinutes' | 'restMinutes' | 'pitches' | 'rounds'>, teams: number): DrawEstimate {
    const n = Math.max(2, Math.floor(teams));
    const day = (matches: number) => Math.ceil(matches / Math.max(1, rules.pitches)) * (rules.matchMinutes + rules.restMinutes) - rules.restMinutes;
    switch (rules.structure) {
        case 'KNOCKOUT': return { matches: n - 1, minutes: day(n - 1), matchdays: null, setAtDraw: false };
        case 'GROUPS_KNOCKOUT': {
            const first = Math.ceil(n / 2), second = n - first, matches = pairs(first) + pairs(second) + 3;
            return { matches, minutes: day(matches), matchdays: null, setAtDraw: true };
        }
        case 'ROUND_ROBIN': return { matches: pairs(n), minutes: null, matchdays: roundsOf(n), setAtDraw: false };
        case 'HOME_AWAY': return { matches: 2 * pairs(n), minutes: null, matchdays: 2 * roundsOf(n), setAtDraw: false };
        case 'SPLIT_LEAGUE': return { matches: pairs(n), minutes: null, matchdays: roundsOf(n), setAtDraw: true };
        case 'SWISS': return { matches: rules.rounds * Math.floor(n / 2), minutes: null, matchdays: rules.rounds, setAtDraw: false };
        case 'ROTATION': case 'KING_OF_PITCH': { const matches = rules.rounds * Math.floor(n / 2); return { matches, minutes: day(matches), matchdays: null, setAtDraw: false }; }
        default: return { matches: null, minutes: null, matchdays: null, setAtDraw: false };
    }
}

/** An estimate's minutes as hours and minutes, said in words by the screen ("5 h 20"). */
export const durationParts = (total: number) => ({ hours: Math.floor(total / 60), minutes: total % 60 });
