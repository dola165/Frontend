import { useState } from 'react';
import type { NotificationItem } from '../../../types/notifications';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { refreshAccess } from '../../../hooks/useCan';
import { Button } from '../../../design/primitives';
import { decideSuggestion } from './api';
import { useJobWords } from './jobWords';
import './people.css';

/**
 * "Dato suggests Tamar as assistant coach for U12": any admin confirms or declines it in the notification itself.
 * The first answer counts; a later one gets the server's plain "Nino already confirmed this."
 */
export function AssistantSuggestionActions({ notification }: { notification: NotificationItem }) {
    const { copy } = useJobWords();
    const [busy, setBusy] = useState(false), [done, setDone] = useState(''), [error, setError] = useState('');
    if (notification.type !== 'ASSISTANT_SUGGESTION' || notification.entityId == null || notification.clubId == null) return null;
    const club = notification.clubId, suggestion = notification.entityId;
    const decide = async (decision: 'confirm' | 'decline') => {
        if (busy) return;
        setBusy(true); setError('');
        try {
            await decideSuggestion(club, suggestion, decision);
            refreshAccess();
            setDone(decision === 'confirm' ? copy('Confirmed. The head coach is told and sends the link.', 'დადასტურდა. მთავარ მწვრთნელს ეცნობა და ბმულს გაუგზავნის.')
                : copy('Declined. The head coach is told.', 'უარყოფილია. მთავარ მწვრთნელს ეცნობა.'));
        } catch (failure) { setError(extractApiErrorMessage(failure, copy('Your answer wasn’t saved. Try again.', 'პასუხი ვერ შეინახა. სცადეთ ხელახლა.'))); }
        finally { setBusy(false); }
    };
    return <div className="gk pp-notice-actions" onClick={event => event.stopPropagation()}>
        {done ? <p className="gk-faint" role="status">{done}</p> : <div className="gk-row">
            <Button size="sm" variant="primary" disabled={busy} onClick={() => void decide('confirm')}>{copy('Confirm', 'დადასტურება')}</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void decide('decline')}>{copy('Decline', 'უარყოფა')}</Button>
        </div>}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </div>;
}
