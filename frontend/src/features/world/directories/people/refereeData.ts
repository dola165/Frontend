import { formats as FORMAT_LABEL, type Match, type Referee } from '../../../matchExchange/api';
import { wt } from '../../copy';
import { fixtureDay, fixtureTime } from '../../format';
import type { Centre } from './peopleData';

/** A referee as People lists them: their profile, the city they state first, and with a match chosen, how they fit it. */
export interface RefereeItem {
    referee: Referee; city: string | null; centre: Centre | null;
    /** With a match chosen: how far their city is from its ground, and where they sit on the bench. */ km?: number; bench?: 'club' | 'reach' | 'far' | 'unknown';
    /** The match being staffed, when one is chosen. */ match?: Match;
}

/** Match formats as their short football names ("9v9"). */
export const SHORT: Record<string, string> = { '5_A_SIDE': '5v5', '7_A_SIDE': '7v7', '9_A_SIDE': '9v9', '11_A_SIDE': '11v11', FUTSAL: 'Futsal' };
export const formatsOf = (referee: Referee) => referee.formats.split(',').map(code => code.trim()).filter(Boolean);
export const shortFormat = (code: string) => wt(SHORT[code] ?? FORMAT_LABEL[code] ?? code);
/** A referee's terms in a few words: "Volunteer or 100 GEL", "60 GEL", "Not taking matches". */
export function terms(referee: Referee) {
    const paid = referee.accepts_paid ? `${referee.fee} ${referee.currency}` : null;
    if (referee.accepts_volunteer && paid) return wt('Volunteer or {fee}', { fee: paid });
    return referee.accepts_volunteer ? wt('Volunteer') : paid ?? wt('Not taking matches');
}
/** The match being staffed, as a match day line ("Sat 17 12:00 · U14 Boys"). */
export const matchName = (match: Match) => `${fixtureDay(match.starts_at_iso, match.timezone)} ${fixtureTime(match.starts_at_iso, match.timezone)} · ${match.squad_name}`;
