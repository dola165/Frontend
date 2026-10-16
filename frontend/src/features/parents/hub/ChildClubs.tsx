import { Link } from 'react-router-dom';
import { ArrowRight, MessageCircle, Receipt, Users } from 'lucide-react';
import { Crest, FaceStack } from '../../../design/visuals';
import { formatDate } from '../../../utils/formatting';

const money = (amount: number, currency: string | null) => `${Number.isInteger(amount) ? amount : amount.toFixed(2)} ${currency ?? 'GEL'}`;
import { squadMessageUrl } from '../../squadCommunication/routes';
import { useClubCrest } from '../../squadCommunication/useClubCrest';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import type * as api from '../../squadCommunication/api';
import type { ChildClub, ChildFees } from '../api';

const headCoach = (squad: api.SquadOverview) => (squad.coaches.find(coach => coach.user_id === squad.head_coach_id) ?? squad.coaches[0])?.full_name;

/** Each club the child plays for: its squads as rows into the squad page, and the Fees line beside them (F38). */
export function ChildClubs({ clubs, squads, playerId }: { clubs: ChildClub[]; squads: api.SquadOverview[]; playerId: number }) {
    return <>{clubs.map(club => <ClubBlock key={club.clubId} club={club} squads={squads.filter(squad => squad.club_id === club.clubId)} playerId={playerId} />)}</>;
}

function ClubBlock({ club, squads, playerId }: { club: ChildClub; squads: api.SquadOverview[]; playerId: number }) {
    const copy = useJourneyCopy();
    const crest = useClubCrest(club.clubId);
    return <div className="ph-club">
        <Link className="ph-club__name" to={`/clubs/${club.clubId}?player=${playerId}`}><Crest src={crest} name={club.clubName} size={20} />{club.clubName}</Link>
        <ul className="ph-squads">
            {squads.map(squad => <li key={squad.id} className="ph-squad">
                <Link className="ph-squad__open" to={`/squads/${squad.id}?player=${playerId}`}>
                    <span className="ph-squad__icon" aria-hidden="true"><Users /></span>
                    <span className="ph-squad__text"><strong>{squad.name}</strong><small>{headCoach(squad) ?? copy('Coach to be named', 'მწვრთნელი ჯერ არ არის')}</small></span>
                    <FaceStack people={squad.coaches.map(coach => ({ id: coach.user_id, name: coach.full_name }))} max={2} size={24} />
                    <ArrowRight className="ph-squad__go" aria-hidden="true" />
                </Link>
                <Link className="ph-icon-link" to={squadMessageUrl(squad.id)} aria-label={copy(`${squad.name} squad chat`, `${squad.name} — გუნდის ჩატი`)} title={copy('Squad chat', 'გუნდის ჩატი')}><MessageCircle /></Link>
            </li>)}
            {!squads.length && club.squadNames.map(name => <li key={name} className="ph-squad ph-squad--quiet"><span className="ph-squad__icon" aria-hidden="true"><Users /></span><span className="ph-squad__text"><strong>{name}</strong></span></li>)}
        </ul>
        <FeesLine fees={club.fees ?? null} ask={squads[0] ? squadMessageUrl(squads[0].id, true) : `/clubs/${club.clubId}`} />
    </div>;
}

/** What the club has recorded as due. With no recorded statement it says so, never zero. */
function FeesLine({ fees, ask }: { fees: ChildFees | null; ask: string }) {
    const copy = useJourneyCopy();
    const due = fees && fees.status !== 'PAID' && fees.amount != null;
    const summary = !fees ? copy('Not recorded', 'არ არის ჩაწერილი')
        : due ? `${money(fees.amount!, fees.currency)}${fees.dueDate ? ` · ${copy('due', 'ვადა')} ${formatDate(fees.dueDate, { day: 'numeric', month: 'short' })}` : ''}`
        : copy('Paid up', 'გადახდილია');
    return <details className="ph-fees">
        <summary><span className="ph-fees__icon" aria-hidden="true"><Receipt /></span><span className="ph-fees__label">{copy('Fees', 'გადასახადი')}</span>
            <span className={`ph-fees__value${due ? ' is-due' : ''}${fees?.status === 'OVERDUE' ? ' is-overdue' : ''}`}>{summary}</span>
            <span className="ph-link">{fees?.lines?.length ? copy('Statement', 'ამონაწერი') : copy('Ask', 'კითხვა')}</span></summary>
        <div className="ph-fees__body">
            {fees?.lines?.length ? <ul className="ph-fees__lines">{fees.lines.map((line, index) => <li key={index}>
                <span>{line.label}<small>{line.dueDate ? formatDate(line.dueDate, { day: 'numeric', month: 'short' }) : ''}</small></span>
                <span className={line.status === 'PAID' ? 'ph-quiet' : 'ph-fees__owed'}>{money(line.amount, line.currency)} · {line.status === 'PAID' ? copy('paid', 'გადახდილია') : copy('due', 'გადასახდელია')}</span>
            </li>)}</ul> : <p className="ph-quiet">{copy('The club has not recorded a statement for this child yet.', 'კლუბს ამ ბავშვისთვის ამონაწერი ჯერ არ ჩაუწერია.')}</p>}
            <Link className="ph-link" to={ask}>{copy('Ask the coaches about fees', 'ჰკითხეთ მწვრთნელებს გადასახადზე')}</Link>
        </div>
    </details>;
}
