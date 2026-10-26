import { useEffect, useState } from 'react';
import type { NotificationItem } from '../../types/notifications';
import * as api from './api';
import { useJourneyCopy } from './journeyCopy';
import { SquadApproveAll } from './page/SquadApproveAll';
import './page/squad-page.css';

/**
 * The coach's one squad notice ("7 want to join U12"): the waiting children by name and Approve all, right in the
 * notification. Opening the notice still leads to each request, to approve or decline one by one.
 */
export function SquadJoinNoticeActions({ notification }: { notification: NotificationItem }) {
    const copy = useJourneyCopy();
    const squad = notification.type === 'SQUAD_JOIN_REQUESTS' && notification.entityType === 'squad' ? notification.entityId ?? null : null;
    const [items, setItems] = useState<api.SquadJoinRequest[] | null>(null), [done, setDone] = useState('');
    useEffect(() => {
        if (squad == null) return;
        const abort = new AbortController();
        void api.joinRequests(squad, abort.signal).then(found => { if (!abort.signal.aborted) setItems(found); }).catch(() => { /* Opening the notice still works. */ });
        return () => abort.abort();
    }, [squad]);
    if (squad == null || (!done && !items?.length)) return null;
    const names = (items ?? []).map(item => item.childName.split(' ')[0]);
    const shown = names.slice(0, 3).join(', ') + (names.length > 3 ? copy(` and ${names.length - 3} more`, ` და კიდევ ${names.length - 3}`) : '');
    return <div className="gk sp-notice-actions" onClick={event => event.stopPropagation()}>
        {done ? <p className="sp-done" role="status">{done}</p> : <>
            <small className="sp-quiet">{shown}</small>
            <SquadApproveAll squadId={squad} requests={items ?? []} size="sm" onDone={result => setDone(copy(`${result.approved} offered a place in ${result.groupName}. Families accept the terms next.`, `${result.approved} მიიღო ადგილის შეთავაზება (${result.groupName}). შემდეგ ოჯახები პირობებს ეთანხმებიან.`))} />
        </>}
    </div>;
}
