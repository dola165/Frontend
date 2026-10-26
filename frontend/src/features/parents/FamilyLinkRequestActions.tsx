import { useRef, useState } from 'react';
import { apiClient } from '../../api/axiosConfig';
import type { NotificationItem } from '../../types/notifications';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';

/**
 * "Nino asks to be Luka's parent too": the child's parent answers in the notification. Yes sends Nino the usual
 * additional-guardian invitation, which Nino accepts in Parent Hub; nobody is linked by this tap alone.
 */
export function FamilyLinkRequestActions({ notification }: { notification: NotificationItem }) {
    const copy = useJourneyCopy();
    const [busy, setBusy] = useState(false), [status, setStatus] = useState(''), [error, setError] = useState('');
    const request = useRef(crypto.randomUUID());
    if (notification.type !== 'FAMILY_LINK_REQUEST' || notification.entityId == null) return null;
    const answer = async (accept: boolean) => {
        if (busy) return;
        setBusy(true); setError('');
        try {
            await apiClient.post(`/family/link-requests/${notification.entityId}`, { accept, requestId: request.current });
            setStatus(accept ? copy('Invitation sent. They accept it in Parent Hub.', 'მოწვევა გაიგზავნა. მიიღებენ მშობლის სივრცეში.') : copy('Not confirmed. They are told, without your details.', 'არ დადასტურდა. ეცნობებათ, თქვენი მონაცემების გარეშე.'));
        } catch (e) { setError(extractApiErrorMessage(e, copy('Your answer was not saved. Try again.', 'პასუხი ვერ შეინახა. სცადეთ ხელახლა.'))); }
        finally { setBusy(false); }
    };
    return <div className="px-4 pb-4 sm:px-5" onClick={event => event.stopPropagation()}>
        {status ? <p role="status">{status}</p> : <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-lg border px-3 py-2 text-sm" disabled={busy} onClick={() => void answer(true)}>{copy('Yes, add as parent', 'დიახ, დაემატოს მშობლად')}</button>
            <button type="button" className="rounded-lg border px-3 py-2 text-sm" disabled={busy} onClick={() => void answer(false)}>{copy('Not their parent', 'მშობელი არ არის')}</button>
        </div>}
        {error && <p role="alert">{error}</p>}
    </div>;
}
