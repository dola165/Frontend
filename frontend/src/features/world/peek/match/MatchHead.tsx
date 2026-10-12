import { Link } from 'react-router-dom';
import { Handshake, MapPin, Star, Trophy } from 'lucide-react';
import type { HistoryMatch } from '../../../matchHistory/api';
import { useWorldCopy } from '../../copy';
import { Crest } from '../../Crest';
import { fixtureDay, fixtureTime, shortDate } from '../../format';
import { endOf } from '../../scoreboard/form';
import type { MatchState } from '../../scoreboard/matchState';
import { useClubCrests } from '../../scoreboard/useClubCrests';
import { peekClick, peekOf, useRelatedOpen } from '../usePeek';

/**
 * The top of a match drawer, as score sites draw a fixture: both clubs with their crests (each opens on the left),
 * between them the score once it counts, else the kick-off or the state; then what kind of match it is and where.
 */
export function MatchHead({ match: m, state, mine }: { match: HistoryMatch; state: MatchState; mine: { home: boolean; away: boolean } }) {
    const t = useWorldCopy();
    const relate = useRelatedOpen();
    const crestOf = useClubCrests();
    const side = (end: 'home' | 'away') => {
        const team = endOf(m, end);
        const name = team.club ?? t('To be decided');
        return (
            <div className="gk-mpeek__side" data-end={end}>
                <Crest src={crestOf(team.clubId)} name={name} size={56} />
                {team.clubId != null
                    ? <Link className="gk-mpeek__club" to={`/clubs/${team.clubId}`} onClick={peekClick(peekOf('club', team.clubId), relate)}>{name}</Link>
                    : <span className="gk-mpeek__club">{name}</span>}
                {(team.squad || mine[end]) && <small>{mine[end] && <Star className="gk-mpeek__mine" role="img" aria-label={t('Your team')} />}{team.squad}</small>}
            </div>
        );
    };
    const word = 'word' in state.when ? state.when : null;
    const centre = state.score
        ? <><b className="gk-mpeek__score">{state.score.home} – {state.score.away}</b><small>{t('FT')}{m.startsAt ? ` · ${shortDate(m.startsAt)}` : ''}</small></>
        : word ? <><b className="gk-mpeek__word" data-tone={word.tone} aria-label={word.spoken ? t(word.spoken) : undefined}>{t(word.word)}</b>{m.startsAt && <small>{fixtureDay(m.startsAt, m.timezone)} {fixtureTime(m.startsAt, m.timezone)}</small>}</>
            : <><b className="gk-mpeek__time">{fixtureTime(m.startsAt, m.timezone)}</b><small>{fixtureDay(m.startsAt, m.timezone)}{state.tag ? ` · ${t(state.tag.word, state.tag.vars)}` : ''}</small></>;
    const Kind = m.source === 'TOURNAMENT' ? Trophy : m.source === 'MATCH_EXCHANGE' ? Handshake : Trophy;
    return (
        <header className="gk-mpeek__head">
            <div className="gk-mpeek__band">
                {side('home')}
                <div className="gk-mpeek__centre">{centre}</div>
                {side('away')}
            </div>
            <ul className="gk-mpeek__facts">
                <li>
                    <Kind aria-hidden="true" />
                    {m.tournamentId != null
                        ? <Link to={`/tournaments/${m.tournamentId}`} onClick={peekClick(peekOf('tournament', m.tournamentId), relate)}>{m.tournamentName ?? m.title}</Link>
                        : <span>{m.source === 'MATCH_EXCHANGE' ? t('Friendly') : m.tournamentName ?? t('Club fixture')}</span>}
                </li>
                {m.locationName && <li><MapPin aria-hidden="true" /><span>{m.locationName}</span></li>}
            </ul>
        </header>
    );
}
