import { useEffect, useState } from 'react';
import type { NotificationItem } from '../../../types/notifications';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { refreshAccess } from '../../../hooks/useCan';
import { Button } from '../../../design/primitives';
import { answerSuggestion, fetchPeople, isOwnAccount, type InviteLink, type PersonJob } from './api';
import { InviteLinkBox } from './InviteLinkBox';
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
    const [found, setFound] = useState<{ job: PersonJob; name: string; clubName: string } | null>(null);
    const [busy, setBusy] = useState(false), [done, setDone] = useState(''), [error, setError] = useState('');
    const [link, setLink] = useState<InviteLink | null>(null);
    useEffect(() => {
        if (!relevant || club == null) return;
        const controller = new AbortController();
        fetchPeople(club, controller.signal).then(view => {
            const person = view.people.find(p => p.jobs.some(item => item.kind === 'APPOINTMENT' && item.id === appointment));
            const job = person?.jobs.find(item => item.kind === 'APPOINTMENT' && item.id === appointment);
            if (!controller.signal.aborted && person && job?.status === 'SUGGESTED' && job.canConfirm !== false)
                setFound({ job, name: person.name, clubName: notification.clubName ?? '' });
        }).catch(() => { /* Opening the notice still leads to People. */ });
        return () => controller.abort();
    }, [relevant, club, appointment, notification.clubName]);
    if (!relevant || club == null || (!found && !done)) return null;
    const decide = async (confirm: boolean) => {
        if (busy || !found) return;
        setBusy(true); setError('');
        try {
            const answer = await answerSuggestion(club, found.job, confirm);
            refreshAccess();
            // Confirming a person without a password returns their one-time link: it is this admin's to send, here.
            setLink(answer.link);
            setDone(answer.outcome !== 'CONFIRMED' ? copy('Declined. The head coach is told.', 'უარყოფილია. მთავარ მწვრთნელს ეცნობა.')
                : answer.link ? copy(`Confirmed. Send ${found.name} this link to choose a password.`, `დადასტურდა. გაუგზავნეთ ${found.name}-ს ეს ბმული პაროლის ასარჩევად.`)
                    : copy(`Confirmed. ${found.name} finds the invitation in the app; the head coach is told.`, `დადასტურდა. ${found.name} მოწვევას აპში ნახავს; მთავარ მწვრთნელს ეცნობა.`));
        } catch (failure) {
            if (isOwnAccount(failure)) setDone(copy(`${found.name} has their own account, so there’s no link to send: the invitation waits for them in the app.`, `${found.name}-ს საკუთარი ანგარიში აქვს, ამიტომ ბმული არ არის საჭირო: მოწვევა აპში ელოდება.`));
            else setError(extractApiErrorMessage(failure, copy('Your answer wasn’t saved. Try again.', 'პასუხი ვერ შეინახა. სცადეთ ხელახლა.')));
        }
        finally { setBusy(false); }
    };
    return <div className="gk pp-notice-actions" onClick={event => event.stopPropagation()}>
        {done ? <>
            <p className="gk-faint" role="status">{done}</p>
            {link && found && <InviteLinkBox name={found.name} link={link}
                message={copy(`You’re invited${found.clubName ? ` to ${found.clubName}` : ''}. Choose your password here:`, `მოწვეული ხართ${found.clubName ? ` ${found.clubName}-ში` : ''}. აირჩიეთ პაროლი აქ:`)} />}
        </> : <div className="gk-row">
            <Button size="sm" variant="primary" disabled={busy} onClick={() => void decide(true)}>{copy('Confirm', 'დადასტურება')}</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void decide(false)}>{copy('Decline', 'უარყოფა')}</Button>
        </div>}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </div>;
}
