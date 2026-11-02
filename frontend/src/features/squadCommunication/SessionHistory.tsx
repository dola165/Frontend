import { useState } from 'react';
import { formatDateTime } from '../../utils/formatting';
import { useSessionOccurrence } from './sessionOccurrence';
import './session-history.css';

export function SessionHistory({ squadId, sessionId, playerId }: { squadId: number; sessionId: number; playerId?: number }) {
    const [open, setOpen] = useState(false);
    const data = useSessionOccurrence(squadId, sessionId, playerId, open);
    return <details className="session-history" onToggle={event => setOpen(event.currentTarget.open)}>
        <summary>Changes to this date</summary>
        {data.loading && <p role="status">Loading saved changes…</p>}
        {data.error && <p role="alert">{data.error} <button type="button" onClick={data.reload}>Retry history</button></p>}
        {data.value && <>
            <p>Current: {formatDateTime(data.value.session.starts_at)} · {data.value.session.status === 'CANCELLED' ? 'Cancelled' : 'Scheduled'}</p>
            {data.value.history.length ? <ol>{data.value.history.map(change => <li key={change.revision}>
                <strong>{change.status === 'CANCELLED' ? 'Cancelled' : 'Updated'} · {formatDateTime(change.changedAt)}</strong>
                {(change.beforeStartsAt !== change.startsAt || change.beforeEndsAt !== change.endsAt) && <p>{formatDateTime(change.beforeStartsAt)} – {formatDateTime(change.beforeEndsAt)} → {formatDateTime(change.startsAt)} – {formatDateTime(change.endsAt)}</p>}
                {change.beforeLocation !== change.location && <p>{change.beforeLocation || 'No meeting point'} → {change.location || 'No meeting point'}</p>}
                {change.beforeTitle !== change.title && <p>{change.beforeTitle} → {change.title}</p>}
                {change.cancellationReason && <p>{change.cancellationReason}</p>}
            </li>)}</ol> : <p>No saved changes to this occurrence.</p>}
            {data.value.history.length === 100 && <p>Showing the latest 100 changes.</p>}
        </>}
    </details>;
}
