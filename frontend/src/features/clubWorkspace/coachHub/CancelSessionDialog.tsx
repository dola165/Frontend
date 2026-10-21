import { useEffect, useRef, useState } from 'react';
import { Button, Field } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import * as api from '../../squadCommunication/api';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { coachHubEn } from '../../../locales/workspaceDesign';
import { useCopy } from '../../../locales/useCopy';
import { dayLabel, timeLabel } from '../fixtures';
import { kindNames, sessionKind } from './useCoachData';
import './coach-hub.css';

/**
 * Cancelling a session is one dialog: the message to parents is already written (what, when, where), the coach
 * may edit it, and one press cancels the session and sends the message as a pinned announcement. The most
 * common thing a coach tells parents, with nothing to type.
 *
 * Two requests, told apart honestly: the cancellation itself (which already notifies the session's families)
 * and the extra message. Once the session is cancelled the dialog says so and offers no "Keep it"; only the
 * message is sent again, under its same request id so it is never posted twice.
 */
export function CancelSessionDialog({ squad, squadName, session, now, onClose, onDone }: {
    squad: number; squadName: string; session: api.SquadSession; now: number; onClose: () => void; onDone: () => void;
}) {
    const copy = useCopy('coachHub', coachHubEn);
    const kind = kindNames[sessionKind(session)];
    const when = `${dayLabel(session.starts_at, now)} ${timeLabel(session.starts_at)}`;
    const [message, setMessage] = useState(() => copy('cancelMessage', { kind, title: session.title, when, where: session.location ? copy('cancelWhere', { place: session.location }) : '', squad: squadName }));
    const [told, setTold] = useState<number | null>(null);
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    // Set once the cancellation request succeeded, whatever happens to the message afterwards.
    const [cancelled, setCancelled] = useState(false), [messageFailed, setMessageFailed] = useState(false);
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
        setBusy(true); setError(''); setMessageFailed(false);
        if (!cancelled) {
            try {
                await api.cancelSession(squad, session.id, session.revision, 'Cancelled by the coach', request.current.cancel);
            } catch (cause) {
                // A lost answer may still have cancelled it; the same request id makes trying again safe.
                setError(extractApiErrorMessage(cause, copy('cancelUnconfirmed')));
                setBusy(false);
                return;
            }
            setCancelled(true);
        }
        const text = message.trim();
        try {
            if (text) await api.postMessage(squad, { requestId: request.current.post, threadUserId: null, kind: 'ANNOUNCEMENT', title: copy('cancelAnnouncement', { kind, title: session.title }), body: text, important: true, expiresAt: session.ends_at || session.starts_at });
            onDone();
        } catch {
            setMessageFailed(true); setBusy(false);
        }
    };

    const footer = cancelled
        ? <><Button variant="ghost" disabled={busy} onClick={onDone}>{copy('close')}</Button><Button variant="primary" disabled={busy} onClick={() => void confirm()}>{busy ? copy('sending') : copy('sendAgain')}</Button></>
        : <><Button variant="ghost" disabled={busy} onClick={onClose}>{copy('keepIt')}</Button><Button variant="danger" disabled={busy} onClick={() => void confirm()}>{busy ? copy('cancelling') : told ? copy('cancelAndTellCount', { count: told }) : copy('cancelAndTell')}</Button></>;

    return <Dialog open size="md" title={cancelled ? copy('cancelledTitle', { title: session.title }) : copy('cancelTitle', { title: session.title })} description={`${squadName} · ${when}${session.location ? ` · ${session.location}` : ''}`}
        onClose={cancelled ? onDone : onClose} footer={footer}>
        <div className="gk-stack">
            {cancelled && messageFailed && <p className="gk-notice gk-notice--warning" role="alert">{copy('cancelledNotSent')}</p>}
            <Field label={copy('messageToParents')} htmlFor="ch-cancel-message">
                <textarea id="ch-cancel-message" className="gk-input" rows={4} maxLength={1000} value={message} disabled={busy} onChange={event => setMessage(event.target.value)} />
            </Field>
            <p className="gk-field__hint">{copy('cancelHint', { squad: squadName })}</p>
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        </div>
    </Dialog>;
}
