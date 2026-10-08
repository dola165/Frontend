import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { overview, type SquadOverview } from '../../features/squadCommunication/api';
import { SquadMessages } from '../../features/squadCommunication/SquadMessages';
import { notificationId } from '../../utils/notificationDestinations';

/** A notification-local conversation surface also works in Android's web container. */
export function SquadConversationNotificationTarget({ squadId, channel, thread, onClose }: {
    squadId: string; channel: string; thread: string | null; onClose: () => void;
}) {
    const [revision, setRevision] = useState(0);
    const key = `${squadId}:${channel}:${thread}:${revision}`;
    const [result, setResult] = useState<{ key: string; space?: SquadOverview; error?: string } | null>(null);
    const valid = notificationId(squadId) != null && (channel === 'chat' && thread == null || channel === 'coach' && notificationId(thread) != null);
    useEffect(() => {
        if (!valid) return;
        const abort = new AbortController();
        void overview(Number(squadId), abort.signal).then(space => {
            if (abort.signal.aborted) return;
            const allowed = space.id === Number(squadId) && (channel === 'chat' || (space.can_manage
                ? space.threads.some(person => person.user_id === Number(thread)) : space.viewer_id === Number(thread)));
            setResult(allowed ? { key, space } : { key, error: 'This squad conversation is unavailable or you no longer have access.' });
        }).catch(() => {
            if (!abort.signal.aborted) setResult({ key, error: 'This squad conversation is unavailable or you no longer have access.' });
        });
        return () => abort.abort();
    }, [channel, key, squadId, thread, valid]);
    const current = !valid ? { key, error: 'This notification destination is unavailable.' } : result?.key === key ? result : null;
    return <section aria-label="Squad conversation notification destination" className="shrink-0 border-b theme-border p-4">
        <div className="flex items-start justify-between gap-4"><h2 className="font-bold">{current?.space?.name ?? 'Squad conversation'}</h2><button type="button" onClick={onClose} className="app-text-action">Close details</button></div>
        {!current && <p role="status">Opening your squad conversation…</p>}
        {current?.error && <div role="alert"><p>{current.error}</p>{valid && <button onClick={() => setRevision(value => value + 1)}>Try again</button>}</div>}
        {current?.space && <>
            <Link className="app-text-action" to={`/squads/${squadId}`}>Squad updates</Link>
            <SquadMessages key={key} space={current.space} kind="CHAT" thread={channel === 'coach' ? Number(thread) : null} onSent={() => setRevision(value => value + 1)} />
        </>}
    </section>;
}
