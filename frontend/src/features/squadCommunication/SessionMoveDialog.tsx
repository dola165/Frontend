import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { extractApiErrorMessage } from '../../utils/apiError';
import { formatDate, formatTime } from '../../utils/formatting';
import * as api from './api';
import { SessionDialog } from './SquadSessionDialog';
import { SeriesScope } from './SquadEventEditComposer';
import { useJourneyCopy } from './journeyCopy';

const when = (value: string) => `${formatDate(value, { weekday: 'short', day: 'numeric', month: 'short' })} · ${formatTime(value)}`;

/**
 * Moving a session by dragging it on the calendar. Nothing changes until the coach confirms: the dialog shows the
 * old and new time, asks whether a weekly series moves only here or from here on, and previews who will be told
 * and whether families must reply again.
 */
export function SessionMoveDialog({ squadId, squadName, session, startsAt, endsAt, onClose, onSaved }: {
    squadId: number; squadName: string; session: api.SquadSession; startsAt: string; endsAt: string; onClose: () => void; onSaved: () => void;
}) {
    const copy = useJourneyCopy();
    const [scope, setScope] = useState<api.SeriesScope>('THIS');
    const [preview, setPreview] = useState<{ scope: api.SeriesScope; text: string; expected?: api.ExpectedSession[] } | null>(null);
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const request = useRef(crypto.randomUUID());
    const series = Boolean(session.series_id);
    const change: api.SessionChange = { requestId: request.current, revision: session.revision, title: session.title, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(),
        location: session.location ?? '', playerIds: null, eventType: session.event_type, description: session.description ?? '', requestResponses: session.response_requested };
    const signature = JSON.stringify(change);

    useEffect(() => {
        let alive = true;
        const value = JSON.parse(signature) as api.SessionChange;
        setPreview(null); setError('');
        const load = scope === 'THIS'
            ? api.previewSession(squadId, session.id, value).then(result => ({ scope, text: result.notificationRecipients
                ? `${result.notificationRecipients} ${result.notificationRecipients === 1 ? 'family is' : 'families are'} told about the new time.${result.responsePolicy === 'RECONFIRM' ? ' Replies will need confirming again.' : ' Replies stay as they are.'}`
                : 'Nobody needs to be told.' }))
            : api.previewSeriesChange(squadId, session.id, { change: value, scope }).then(result => ({ scope, expected: result.expected,
                text: `${result.eventCount} ${result.eventCount === 1 ? 'session moves' : 'sessions move'}; ${result.notificationDeliveries} ${result.notificationDeliveries === 1 ? 'notification goes' : 'notifications go'} to families.` }));
        load.then(value => { if (alive) setPreview(value); }).catch(cause => { if (alive) setError(extractApiErrorMessage(cause, 'What this move changes could not be checked.')); });
        return () => { alive = false; };
    }, [scope, signature, squadId, session.id]);

    const save = async () => {
        if (busy || preview?.scope !== scope) return;
        setBusy(true); setError('');
        try {
            if (scope === 'THIS') await api.editSession(squadId, session.id, change);
            else await api.changeSeries(squadId, session.id, { change, scope, expected: preview.expected });
            onSaved();
        } catch (cause) { setError(extractApiErrorMessage(cause, copy('The change could not be saved.', 'ცვლილების შენახვა ვერ მოხერხდა.'))); }
        finally { setBusy(false); }
    };

    return <SessionDialog title={`${copy('Move', 'გადატანა')} · ${session.title}`} onClose={onClose} busy={busy}>
        <div className="session-move">
            <p className="session-move__times"><span>{when(session.starts_at)}</span><ArrowRight size={16} aria-hidden="true" /><strong>{when(startsAt)}</strong></p>
            <p className="session-move__squad">{squadName} · {formatTime(startsAt)}–{formatTime(endsAt)}</p>
            {series && <SeriesScope disabled={busy} value={scope} onChange={setScope} />}
            <p role="status" className="session-move__preview">{preview?.scope === scope ? preview.text : error ? '' : 'Checking who is affected…'}</p>
            {error && <p role="alert" className="session-move__error">{error}</p>}
            <div className="session-move__actions">
                <button type="button" className="session-move__cancel" disabled={busy} onClick={onClose}>{copy('Keep the old time', 'ძველი დროის დატოვება')}</button>
                <button type="button" className="session-move__confirm" disabled={busy || preview?.scope !== scope} onClick={() => void save()}>{busy ? copy('Moving…', 'გადაიტანება…') : copy('Move session', 'სესიის გადატანა')}</button>
            </div>
        </div>
    </SessionDialog>;
}
