import { Flag } from 'lucide-react';
import { Button, Section } from '../../design/primitives';
import { useAuth } from '../../context/AuthContext';
import { hasNavigationCapability } from '../../context/navigationCapabilities';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { post, type Match } from '../matchExchange/api';
import { useAction, useClock, useLoad } from '../matchExchange/hooks';

type OfficialRequest = { status?: string; volunteer?: boolean; fee?: number | null; currency?: string | null; revision?: number; applications: { referee_id: number; status: string }[] };

/**
 * "Offer to referee" on the match page (step 6), for a referee looking at a match that asks referees nearby: one tap on
 * the request's own terms; the club chooses among the offers and nobody is appointed until it does.
 */
export function OfferToReferee({ match: m }: { match: Match }) {
    const { user } = useAuth();
    const now = useClock();
    const referee = hasNavigationCapability(user?.navigationCapabilities, 'referee.workspace');
    // A competition match's referees are the competition's own appointments (fix round 1).
    const wanted = referee && m.origin !== 'COMPETITION' && !m.own_appointments?.length && m.referee_required && ['NEEDED', 'REPLACEMENT_NEEDED'].includes(m.referee_status)
        && m.event_status === 'SCHEDULED' && Date.parse(m.starts_at_iso) > now;
    return wanted ? <Offer match={m} userId={user?.id} /> : null;
}

function Offer({ match: m, userId }: { match: Match; userId?: number }) {
    const copy = useJourneyCopy();
    const { data, reload } = useLoad<OfficialRequest>(`/match-arrangements/${m.event_id}/official-request`);
    const { run, busy, feedback } = useAction(reload);
    if (!data || data.status !== 'OPEN') return null;
    const offered = data.applications.some(a => a.referee_id === userId && a.status === 'PENDING');
    const terms = data.volunteer ? copy('Volunteer', 'მოხალისე') : `${data.fee ?? 0} ${data.currency ?? 'GEL'}`;
    return <Section boxed icon={Flag} title={copy('Referee wanted', 'მსაჯი სჭირდება')} hint={terms}>
        {offered ? <div className="gk-match-actions">
            <span className="gk-muted">{copy('Your offer is with the club. It chooses one referee.', 'თქვენი შეთავაზება კლუბთანაა. ის ერთ მსაჯს აირჩევს.')}</span>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => post(`/match-arrangements/${m.event_id}/official-request/withdraw`, {}), copy('Offer withdrawn', 'შეთავაზება გაწვეულია'))}>{copy('Withdraw', 'გაწვევა')}</Button>
        </div> : <Button variant="primary" disabled={busy} onClick={() => void run(() => post(`/match-arrangements/${m.event_id}/official-request/apply`, { revision: data.revision }), copy('Offer sent to the club', 'შეთავაზება კლუბს გაეგზავნა'))}>
            {copy('Offer to referee', 'მსაჯობის შეთავაზება')}</Button>}
        <div className="gk-mx gk-match-feedback">{feedback}</div>
    </Section>;
}
