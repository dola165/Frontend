import { useEffect, useState } from 'react';
import type { NotificationItem } from '../../../types/notifications';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { refreshAccess } from '../../../hooks/useCan';
import { Button } from '../../../design/primitives';
import { childrenYes, endJob, fetchPeople, firstName, type Person, type PersonJob } from './api';
import { useJobWords } from './jobWords';
import './people.css';

const clubIn = (path?: string | null) => Number(path?.match(/^\/clubs\/(\d+)\//)?.[1]) || null;

/**
 * Someone took a job through a staff link: every Owner and Admin answers here, "Let Ana see the children's details" or
 * "End job". The buttons show only while the job still waits; the first answer counts, and a later one gets the
 * server's plain "Nino already said yes."
 */
export function StaffChildrenYesActions({ notification }: { notification: NotificationItem }) {
    const { copy } = useJobWords();
    const club = notification.clubId ?? clubIn(notification.linkPath), appointment = notification.entityId ?? null;
    const relevant = notification.type === 'CLUB_STAFF_CHILDREN_YES' && club != null && appointment != null;
    const [found, setFound] = useState<{ job: PersonJob; person: Person } | null>(null);
    const [busy, setBusy] = useState(false), [done, setDone] = useState(''), [error, setError] = useState('');
    useEffect(() => {
        if (!relevant || club == null) return;
        const controller = new AbortController();
        fetchPeople(club, controller.signal).then(view => {
            const person = view.people.find(p => p.jobs.some(item => item.kind === 'APPOINTMENT' && item.id === appointment));
            const job = person?.jobs.find(item => item.kind === 'APPOINTMENT' && item.id === appointment);
            if (!controller.signal.aborted && person && job?.waitingYes?.canAnswer) setFound({ job, person });
        }).catch(() => { /* Opening the notice still leads to Staff. */ });
        return () => controller.abort();
    }, [relevant, club, appointment]);
    if (!relevant || club == null || (!found && !done)) return null;
    const first = found ? firstName(found.person.name) : '';
    const act = async (work: () => Promise<unknown>, message: string) => {
        if (busy) return;
        setBusy(true); setError('');
        try { await work(); refreshAccess(); setDone(message); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('Your answer wasn’t saved. Try again.', 'პასუხი ვერ შეინახა. სცადეთ ხელახლა.'))); }
        finally { setBusy(false); }
    };
    return <div className="gk pp-notice-actions" onClick={event => event.stopPropagation()}>
        {done ? <p className="gk-faint" role="status">{done}</p> : found && <div className="gk-row">
            <Button size="sm" variant="primary" disabled={busy} onClick={() => void act(() => childrenYes(club, found.job.id), copy(`${first} can see the children’s details now.`, `${first}-ს ახლა შეუძლია ბავშვების მონაცემების ნახვა.`))}>
                {copy(`Let ${first} see the children’s details`, `${first}-ს მიეცით ბავშვების მონაცემების ნახვა`)}</Button>
            <Button size="sm" variant="ghost" className="pp-danger" disabled={busy} onClick={() => void act(() => endJob(club, found.person.userId, found.job), copy('The job has ended.', 'სამუშაო დასრულდა.'))}>{copy('End job', 'დასრულება')}</Button>
        </div>}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </div>;
}
