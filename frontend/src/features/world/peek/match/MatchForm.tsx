import { useAuth } from '../../../../context/AuthContext';
import type { HistoryMatch } from '../../../matchHistory/api';
import { useWorldCopy } from '../../copy';
import { Crest } from '../../Crest';
import { historyOf } from '../../front/coach/coachMatches';
import { endOf, formOf, lastMeeting, type TeamRef } from '../../scoreboard/form';
import { matchCode } from '../../scoreboard/matchCode';
import { FormGuide } from '../../scoreboard/FormGuide';
import { HistoryLine } from '../../scoreboard/HistoryLine';
import { useClubCrests } from '../../scoreboard/useClubCrests';
import { useNow } from '../../scoreboard/useNow';
import { useWorldData } from '../../useWorldData';

/** A side's recent results: its squad's when the match names one, else its club's. */
const recentOf = (sessionId: Parameters<typeof historyOf>[0], side: TeamRef) => side.squadId ? historyOf(sessionId, { squadId: side.squadId }, 'HISTORY', 20)
    : side.clubId ? historyOf(sessionId, { clubId: side.clubId }, 'HISTORY', 20) : Promise.resolve([]);

/**
 * Both sides' form (their last five results that count, W/D/L) and the last time they met, with its score when it
 * counts. Hidden when neither side has a result on record.
 */
export function MatchForm({ match: m }: { match: HistoryMatch }) {
    const t = useWorldCopy();
    const { sessionId } = useAuth();
    const crestOf = useClubCrests();
    const now = useNow();
    const home: TeamRef = { clubId: m.homeClubId, squadId: m.homeSquadId }, away: TeamRef = { clubId: m.awayClubId, squadId: m.awaySquadId };
    const recent = useWorldData(m.homeClubId != null || m.awayClubId != null ? `match-form:${sessionId}:${m.id}` : null,
        () => Promise.all([recentOf(sessionId, home), recentOf(sessionId, away)]), undefined, { keep: true });
    if (!recent.data) return null;
    const [homeRows, awayRows] = recent.data;
    const all = [...new Map([...homeRows, ...awayRows].map(row => [row.id, row])).values()];
    const met = lastMeeting(all.filter(row => matchCode(row) !== matchCode(m)), home, away, now);
    const sides = ([['home', homeRows, home], ['away', awayRows, away]] as const).map(([end, rows, ref]) => ({ end, team: endOf(m, end), form: formOf(rows, ref) }));
    if (!met && sides.every(side => !side.form.length)) return null;
    return (
        <section className="gk-peek-section gk-mpeek__form" aria-label={t('Form')}>
            <h3 className="gk-peek-section__title">{t('Form')}</h3>
            <ul className="gk-mpeek__forms">
                {sides.map(({ end, team, form }) => (
                    <li key={end}>
                        <Crest src={crestOf(team.clubId)} name={team.club ?? ''} size={22} />
                        <span className="gk-mpeek__form-name">{[team.club, team.squad].filter(Boolean).join(' ')}</span>
                        <FormGuide results={form} />
                    </li>
                ))}
            </ul>
            {met && <>
                <h3 className="gk-peek-section__title">{t('Last meeting')}</h3>
                <ul className="gk-sb__rows gk-mpeek__met"><HistoryLine match={met.match} crestOf={crestOf} /></ul>
            </>}
        </section>
    );
}
