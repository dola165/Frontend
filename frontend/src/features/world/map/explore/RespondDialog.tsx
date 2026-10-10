import { useId, useState } from 'react';
import { toast } from 'sonner';
import { Dialog } from '../../../../design/Dialog';
import { Button, Field } from '../../../../design/primitives';
import { createScheduleChallenge } from '../../../schedule/api';
import { extractApiErrorMessage } from '../../../../utils/apiError';
import type { PlaceRecord } from './records';
import { useWorldCopy } from '../../copy';

/** Reply to a club's published match need. The reply never edits their original request. */
export function RespondDialog({ record, club, onClose }: { record: PlaceRecord; club: { id: number; name?: string | null }; onClose: () => void }) {
    const t = useWorldCopy();
    const noteId = useId();
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const submit = async () => {
        if (!record.marker?.scheduleEventId || !record.clubId || busy) return;
        setBusy(true); setError('');
        try {
            await createScheduleChallenge(record.marker.scheduleEventId, { challengerClubId: club.id, targetClubId: record.clubId, note: note.trim() || undefined });
            toast.success(t('Response sent to {club}.', { club: record.clubName ?? t('the club') }));
            onClose();
        } catch (cause) {
            setError(extractApiErrorMessage(cause, t('Your response could not be sent. Try again.')));
        } finally {
            setBusy(false);
        }
    };
    return (
        <Dialog open title={t('Respond to this match')} description={`${record.title} · ${record.address ?? t('Venue still open')}`} onClose={onClose}
            footer={<><Button variant="ghost" onClick={onClose}>{t('Cancel')}</Button><Button variant="primary" onClick={() => void submit()} disabled={busy}>{busy ? t('Sending…') : t('Send response')}</Button></>}>
            <p className="gk-muted">{t('You are replying as {club}.', { club: club.name ?? t('your club') })} {t('{club} sees your response and decides.', { club: record.clubName ?? t('The club') })}</p>
            <Field label={t('Note for the other club')} htmlFor={noteId} hint={`${note.length}/500 · ${t('only what their request does not already cover')}`}>
                <textarea id={noteId} className="gk-input" rows={4} maxLength={500} value={note} onChange={event => setNote(event.target.value)} />
            </Field>
            {error && <div className="gk-notice gk-notice--danger" role="alert">{error}</div>}
        </Dialog>
    );
}
