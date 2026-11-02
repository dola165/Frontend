import { Link } from 'react-router-dom';
import { Crest } from '../../design/visuals';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { RecordPost } from './postTopics';
import { formatDate } from '../../utils/formatting';
import './record-match-lines.css';

/** The API has already omitted private lines. Missing scores and crests never become invented facts. */
export function RecordMatchLines({ record }: { record: RecordPost }) {
    const copy = useJourneyCopy();
    const results = record.kind === 'RESULTS';
    const squad = (label: string | null) => label === 'Seniors' ? copy('Seniors', 'უფროსები') : label === 'Squad' ? copy('Squad', 'გუნდი') : label;
    return <section className="record-matches" aria-label={copy(results ? 'From the results' : 'This weekend', results ? 'შედეგებიდან' : 'ამ შაბათ-კვირას')}>
        <strong>{copy(results ? 'From the results' : 'This weekend', results ? 'შედეგებიდან' : 'ამ შაბათ-კვირას')}</strong>
        <ul>{(record.matches ?? []).map(match => <li key={match.eventId}>
            <Link to={`/matches/${match.eventId}?from=home${results ? '#result' : ''}`}>
                <span className="record-matches__side"><Crest src={match.homeCrest} name={match.homeClub ?? ''} size={28} /><span>{match.homeClub}<small>{squad(match.homeSquad)}</small></span></span>
                <span className="record-matches__score">{results && match.homeScore != null && match.awayScore != null ? `${match.homeScore} : ${match.awayScore}` : '–'}</span>
                <span className="record-matches__side"><Crest src={match.awayCrest} name={match.awayClub ?? ''} size={28} /><span>{match.awayClub}<small>{squad(match.awaySquad)}</small></span></span>
                {!results && <small className="record-matches__when">{match.state === 'CANCELLED' ? copy('Cancelled', 'გაუქმებულია') : `${match.state === 'RESCHEDULED' ? copy('Moved · ', 'გადატანილია · ') : ''}${formatDate(new Date(match.startsAt), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tbilisi' })}`}</small>}
            </Link>
        </li>)}</ul>
        {!record.matches?.length && <small>{copy('No matches to show now.', 'ამჟამად საჩვენებელი მატჩი არ არის.')}</small>}
    </section>;
}
