import { useState } from 'react';
import { BadgeCheck, Loader2, UserCheck } from 'lucide-react';
import { dayOf } from '../../../components/auth/useParentApproval';
import { Button } from '../../../design/primitives';
import { extractApiErrorCode, extractApiErrorMessage } from '../../../utils/apiError';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { approveChildAccount, type JoiningChild } from '../api';

/**
 * "Approve Luka's account" on the child's card while a 13 to 15-year-old's account waits for a parent (WAITING) or an
 * older one still works until its day (GRACE): one tap, the same approval as the emailed link. Nothing otherwise.
 */
export function ApproveAccount({ child, onChanged }: { child: JoiningChild; onChanged: () => void }) {
    const copy = useJourneyCopy();
    const first = child.identity.fullName.split(' ')[0];
    const waiting = child.parentApproval;
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState('');
    if (done) return <p className="ph-own ph-own--done" role="status"><BadgeCheck aria-hidden="true" />{copy(`${first}’s account is approved.`, `${first}: ანგარიში დადასტურებულია.`)}</p>;
    if (!waiting) return null;

    const approve = async () => {
        if (busy) return;
        setBusy(true); setError('');
        try { await approveChildAccount(child.playerId); setDone(true); onChanged(); }
        catch (failure) {
            if (extractApiErrorCode(failure) === 'PARENT_APPROVAL_NOT_NEEDED') onChanged();
            else setError(extractApiErrorMessage(failure, copy('That did not work. Try again.', 'ვერ მოხერხდა. სცადეთ ხელახლა.')));
        } finally { setBusy(false); }
    };
    const date = waiting.dueAt ? dayOf(waiting.dueAt) : null;
    const line = waiting.status === 'GRACE'
        ? copy(`Works until ${date ?? 'soon'}, then waits for your approval.`, `ბოლო ვადაა ${date ?? 'მალე'}, შემდეგ თქვენს დადასტურებას დაელოდება.`)
        : date ? copy(`Removed on ${date} without your approval.`, `თქვენი დადასტურების გარეშე წაიშლება: ${date}.`)
        : copy(`${first} is waiting for you.`, `${first} თქვენს დადასტურებას ელოდება.`);
    return <div className="ph-own">
        <span className="ph-row__icon" aria-hidden="true"><UserCheck /></span>
        <span className="ph-own__text"><strong>{copy(`Approve ${first}’s account`, `${first}: ანგარიშის დადასტურება`)}</strong>
            <small><span className={`ph-own__dot ph-own__dot--${waiting.status === 'GRACE' ? 'decide' : 'urgent'}`} aria-hidden="true" />{line}</small></span>
        <span className="ph-own__actions">
            <Button size="sm" variant="primary" disabled={busy} onClick={() => void approve()}>{busy && <Loader2 className="ph-own__spin" aria-hidden="true" />}{copy('Approve', 'დადასტურება')}</Button>
        </span>
        {error && <p className="ph-own__error" role="alert">{error}</p>}
    </div>;
}
