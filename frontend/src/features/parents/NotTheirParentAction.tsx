import { useState } from 'react';
import type { NotificationItem } from '../../types/notifications';
import { Button } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { notTheirParent } from './familyLinks';

/**
 * "Nika has a new parent here": the existing parents and the club's people answer in place. The first answer counts,
 * and a later one gets the server's plain words. The notice's entity is the guardian link.
 */
export function NotTheirParentAction({ notification }: { notification: NotificationItem }) {
    const copy = useJourneyCopy();
    const [busy, setBusy] = useState(false), [done, setDone] = useState(false), [error, setError] = useState('');
    if (notification.type !== 'FAMILY_NEW_PARENT' || notification.entityId == null) return null;
    const answer = async () => {
        if (busy) return;
        setBusy(true); setError('');
        try { await notTheirParent(notification.entityId!); setDone(true); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('Your answer wasn’t saved. Try again.', 'პასუხი ვერ შეინახა. სცადეთ ხელახლა.'))); }
        finally { setBusy(false); }
    };
    return <div className="gk pp-notice-actions" onClick={event => event.stopPropagation()}>
        {done ? <p className="gk-faint" role="status">{copy('Done. They’re no longer the parent here, and the family is told.', 'მზადაა. ისინი აქ აღარ არიან მშობლები, ოჯახს ეცნობა.')}</p>
            : <Button size="sm" variant="ghost" className="pp-danger" disabled={busy} onClick={() => void answer()}>{copy('Not their parent', 'არ არის მშობელი')}</Button>}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </div>;
}
