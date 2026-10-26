import { useRef, useState } from 'react';
import { CheckCheck, Loader2 } from 'lucide-react';
import { Button } from '../../../design/primitives';
import { extractApiErrorMessage } from '../../../utils/apiError';
import * as api from '../api';
import { useJourneyCopy } from '../journeyCopy';

/** The joining groups every waiting request can go into; Approve all needs at least one. */
const sharedGroups = (requests: api.SquadJoinRequest[]) =>
    (requests[0]?.groups ?? []).filter(group => requests.every(request => request.groups.some(item => item.id === group.id && item.version === group.version)));

/**
 * "Approve all": offers every request the coach can see a place, in one tap, through the same decision as one at a
 * time (the families still accept the terms). It sends exactly these requests and versions, so a child who arrives
 * meanwhile is never approved unseen; the request id is kept for retries of the same list.
 */
export function SquadApproveAll({ squadId, requests, onDone, size = 'md' }: { squadId: number; requests: api.SquadJoinRequest[]; onDone: (result: api.SquadApproveAllResult) => void; size?: 'sm' | 'md' }) {
    const copy = useJourneyCopy();
    const groups = sharedGroups(requests);
    const [group, setGroup] = useState(groups[0]?.id ?? 0);
    const chosen = groups.find(item => item.id === group) ?? groups[0];
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const pending = useRef<{ key: string; id: string } | null>(null);
    if (!chosen || requests.length === 0) return null;
    const approve = async () => {
        if (busy) return;
        const seen = requests.map(request => ({ inquiryId: request.id, expectedVersion: request.version }));
        const key = JSON.stringify([seen, chosen.id, chosen.version]);
        if (pending.current?.key !== key) pending.current = { key, id: crypto.randomUUID() };
        setBusy(true); setError('');
        try { onDone(await api.approveAllJoinRequests(squadId, { requestId: pending.current.id, requests: seen, groupId: chosen.id, groupVersion: chosen.version })); }
        catch (e) { setError(extractApiErrorMessage(e, copy('Could not approve. Try again.', 'ვერ დადასტურდა. სცადეთ ხელახლა.'))); }
        finally { setBusy(false); }
    };
    return <div className="sp-approve-all">
        {groups.length > 1 && <select className="gk-input sp-approve-all__group" aria-label={copy('Approve into', 'ჯგუფი')} value={chosen.id} onChange={e => setGroup(Number(e.target.value))}>{groups.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
        <Button size={size} variant="primary" disabled={busy} onClick={() => void approve()}>{busy ? <Loader2 className="gk-spin" aria-hidden="true" /> : <CheckCheck aria-hidden="true" />}{requests.length === 1 ? copy('Approve', 'დადასტურება') : copy(`Approve all ${requests.length}`, `ყველას დადასტურება (${requests.length})`)}</Button>
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </div>;
}
