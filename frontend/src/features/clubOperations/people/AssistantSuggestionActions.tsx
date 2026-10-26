import { useEffect, useState } from 'react';
import type { NotificationItem } from '../../../types/notifications';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { refreshAccess } from '../../../hooks/useCan';
import { Button } from '../../../design/primitives';
import { answerSuggestion, fetchPeople, type PersonJob } from './api';
import { useJobWords } from './jobWords';
import './people.css';

/**
 * The admins' notice for a suggestion (fnd-access-b): CLUB_PEOPLE on a club_staff_appointment, linking to People. The
 * same type also tells the head coach the outcome, so the buttons show only while the job is SUGGESTED and this admin
 * may confirm it. The row has no club id; it is read from the link path.
 */
const clubIn = (path?: string | null) => Number(path?.match(/^\/clubs\/(\d+)\//)?.[1]) || null;

/**
 * "Giorgi suggests Levan as assistant coach for U14": any admin confirms or declines it in the notification itself.
 * The first answer counts; a later one gets the server's plain "Nino already confirmed this suggestion."
 */
export function AssistantSuggestionActions({ notification }: { notification: NotificationItem }) {
    const { copy } = useJobWords();
    const club = notification.clubId ?? clubIn(notification.linkPath), appointment = notification.entityId ?? null;
    const relevant = notification.type === 'CLUB_PEOPLE' && notification.entityType === 'club_staff_appointment' && club != null && appointment != null;
    const [job, setJob] = useState<PersonJob | null>(null);
    const [busy, setBusy] = useState(false), [done, setDone] = useState(''), [error, setError] = useState('');
    useEffect(() => {
        if (!relevant || club == null) return;
        const controller = new AbortController();
        fetchPeople(club, controller.signal).then(view => {
            const found = view.people.flatMap(person => person.jobs).find(item => item.kind === 'APPOINTMENT' && item.id === appointment);
            if (!controller.signal.aborted && found?.status === 'SUGGESTED' && found.canConfirm !== false) setJob(found);
        }).catch(() => { /* Opening the notice still leads to People. */ });
        return () => controller.abort();
    }, [relevant, club, appointment]);
    if (!relevant || club == null || (!job && !done)) return null;
    const decide = async (confirm: boolean) => {
        if (busy || !job) return;
        setBusy(true); setError('');
        try {
            const answer = await answerSuggestion(club, job, confirm);
            refreshAccess();
            setDone(answer.outcome === 'CONFIRMED' ? copy('Confirmed. The head coach is told and sends the link.', 'დადასტურდა. მთავარ მწვრთნელს ეცნობა და ბმულს გაუგზავნის.')
                : copy('Declined. The head coach is told.', 'უარყოფილია. მთავარ მწვრთნელს ეცნობა.'));
        } catch (failure) { setError(extractApiErrorMessage(failure, copy('Your answer wasn’t saved. Try again.', 'პასუხი ვერ შეინახა. სცადეთ ხელახლა.'))); }
        finally { setBusy(false); }
    };
    return <div className="gk pp-notice-actions" onClick={event => event.stopPropagation()}>
        {done ? <p className="gk-faint" role="status">{done}</p> : <div className="gk-row">
            <Button size="sm" variant="primary" disabled={busy} onClick={() => void decide(true)}>{copy('Confirm', 'დადასტურება')}</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void decide(false)}>{copy('Decline', 'უარყოფა')}</Button>
        </div>}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </div>;
}
