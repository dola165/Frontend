import { useEffect, useState } from 'react';
import { Crown } from 'lucide-react';
import type { NotificationItem } from '../../../types/notifications';
import { Button } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { refreshAccess } from '../../../hooks/useCan';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { answerHandover, fetchOwnership, type Ownership } from './api';
import { useOtherClub } from './useOtherClub';
import '../people/people.css';
import './leaving.css';

const clubIn = (path?: string | null) => Number(path?.match(/^\/clubs\/(\d+)/)?.[1]) || null;

/**
 * "Luka wants to hand you FC Dinamo" (CLUB_OWNERSHIP): Take over or Decline right in the notification, for staff who
 * can't open People. Shown only while that handover still waits on this person; a staff job at another club asks
 * "Leave {club} first", then takes over.
 */
export function HandoverNoticeActions({ notification }: { notification: NotificationItem }) {
    const club = notification.type === 'CLUB_OWNERSHIP' ? notification.clubId ?? clubIn(notification.linkPath) : null;
    return club == null ? null : <HandoverAnswer club={club} />;
}

function HandoverAnswer({ club }: { club: number }) {
    const copy = useJourneyCopy();
    const { user, refreshNavigationCapabilities } = useAuth();
    const other = useOtherClub();
    const [state, setState] = useState<Ownership | null>(null);
    const [busy, setBusy] = useState(false), [done, setDone] = useState(''), [error, setError] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        fetchOwnership(club, controller.signal).then(found => { if (!controller.signal.aborted) setState(found); })
            .catch(() => { /* Opening the notice still leads to the club. */ });
        return () => controller.abort();
    }, [club]);
    const handover = state?.handover && state.handover.toUserId === user?.id && ['PENDING', 'WAITING', 'OPEN', 'INVITED'].includes(state.handover.status) ? state.handover : null;
    if (!handover && !done) return null;
    const answer = async (accept: boolean) => {
        if (busy || !handover) return;
        setBusy(true); setError('');
        try {
            const result = await answerHandover(club, handover.id, accept);
            refreshAccess();
            await refreshNavigationCapabilities().catch(() => undefined);
            setDone(result.outcome === 'TRANSFERRED' ? copy('You own the club now.', 'კლუბი ახლა თქვენია.') : copy('Declined. The Owner is told.', 'უარყოფილია. მფლობელს ეცნობა.'));
        } catch (failure) {
            if (!other.catchOther(failure, () => void answer(accept))) setError(extractApiErrorMessage(failure, copy('Your answer wasn’t saved. Try again.', 'პასუხი ვერ შეინახა. სცადეთ ხელახლა.')));
        } finally { setBusy(false); }
    };
    return <div className="gk pp-notice-actions" onClick={event => event.stopPropagation()}>
        {done ? <p className="gk-faint" role="status">{done}</p> : <div className="gk-row">
            <Button size="sm" variant="primary" disabled={busy} onClick={() => void answer(true)}><Crown aria-hidden="true" />{copy('Take over', 'ჩაბარება')}</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void answer(false)}>{copy('Decline', 'უარყოფა')}</Button>
        </div>}
        {other.notice}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </div>;
}
