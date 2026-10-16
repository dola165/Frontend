import { useEffect, useRef, useState } from 'react';
import { Button, Field } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import * as api from '../../squadCommunication/api';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { dayLabel, timeLabel } from '../fixtures';
import { kindNames, sessionKind } from './useCoachData';
import './coach-hub.css';

/**
 * Cancelling a session is one dialog: the message to parents is already written (what, when, where), the coach
 * may edit it, and one press cancels the session and sends the message as a pinned announcement. The most
 * common thing a coach tells parents, with nothing to type.
 */
export function CancelSessionDialog({ squad, squadName, session, now, onClose, onDone }: {
    squad: number; squadName: string; session: api.SquadSession; now: number; onClose: () => void; onDone: () => void;
}) {
    const kind = kindNames[sessionKind(session)];
    const when = `${dayLabel(session.starts_at, now)} ${timeLabel(session.starts_at)}`;
    const [message, setMessage] = useState(`${kind} cancelled: ${session.title}, ${when}${session.location ? ` at ${session.location}` : ''}. ${squadName} does not meet. Sorry for the short notice.`);
    const [told, setTold] = useState<number | null>(null);
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const request = useRef({ cancel: crypto.randomUUID(), post: crypto.randomUUID() });

    // How many parents the message reaches, from the server's own preview.
    useEffect(() => {
        let alive = true;
        api.previewCancellation(squad, session.id, session.revision, 'Cancelled by the coach', request.current.cancel)
            .then(preview => { if (alive) setTold(preview.notificationRecipients ?? preview.affectedParticipants); }).catch(() => { if (alive) setTold(null); });
        return () => { alive = false; };
    }, [squad, session.id, session.revision]);

    const confirm = async () => {
        if (busy) return;
        setBusy(true); setError('');
        try {
            await api.cancelSession(squad, session.id, session.revision, 'Cancelled by the coach', request.current.cancel);
            const text = message.trim();
            if (text) await api.postMessage(squad, { requestId: request.current.post, threadUserId: null, kind: 'ANNOUNCEMENT', title: `${kind} cancelled`, body: text, important: true, expiresAt: session.ends_at || session.starts_at });
            onDone();
        } catch (cause) { setError(extractApiErrorMessage(cause, 'The session could not be cancelled. Nothing was sent.')); setBusy(false); }
    };

    return <Dialog open size="md" title={`Cancel ${session.title}?`} description={`${squadName} · ${when}${session.location ? ` · ${session.location}` : ''}`} onClose={onClose}
        footer={<><Button variant="ghost" disabled={busy} onClick={onClose}>Keep it</Button><Button variant="danger" disabled={busy} onClick={() => void confirm()}>{busy ? 'Cancelling…' : told ? `Cancel and tell ${told} parents` : 'Cancel and tell parents'}</Button></>}>
        <div className="gk-stack">
            <Field label="Message to parents" htmlFor="ch-cancel-message">
                <textarea id="ch-cancel-message" className="gk-input" rows={4} maxLength={1000} value={message} disabled={busy} onChange={event => setMessage(event.target.value)} />
            </Field>
            <p className="gk-field__hint">Sent as a pinned announcement to every parent and guardian of {squadName}, asking them to confirm they have read it.</p>
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        </div>
    </Dialog>;
}
