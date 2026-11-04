import { useEffect, useRef, useState } from 'react';
import { getAuthSessionId, isCurrentAuthSession } from '../../utils/authStorage';
import { extractApiErrorMessage } from '../../utils/apiError';
import { sendResponse, type ResponseAction, type ResponseCommand } from './responsesApi';

interface Saved { note: string; pending?: ResponseCommand; resolution?: ResponseCommand; notice?: string }

/** Recovery belongs to one login, listing and response; saved text never establishes permission. */
export function useResponseCommand(jobId: number, responseId: number | null, userId: number, version: number, onSaved: (listingChanged?: boolean) => void, listingVersion?: number, contactAllowed = true) {
    const session = getAuthSessionId();
    const key = `gk-job-response:${userId}:${session}:${jobId}:${responseId ?? 'new'}`;
    const [saved, setSaved] = useState<Saved>(() => {
        try { return JSON.parse(sessionStorage.getItem(key) ?? '{"note":""}') as Saved; } catch { return { note: '' }; }
    });
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const mounted = useRef(true), sending = useRef(false);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const active = () => mounted.current && isCurrentAuthSession(session);
    const persist = (value: Saved) => { sessionStorage.setItem(key, JSON.stringify(value)); setSaved(value); };
    const change = (note: string) => {
        setSaved(current => ({ ...current, note }));
        try { sessionStorage.setItem(key, JSON.stringify({ ...saved, note })); } catch { setError('Your note is kept on this page while browser storage is unavailable.'); }
    };
    const canResolveWithoutNote = !contactAllowed && !!saved.pending && !saved.resolution && (saved.pending.action === 'REPLY' || saved.pending.action === 'OFFER' || !!saved.pending.note.trim());
    const send = async (action?: ResponseAction, withoutNote = false) => {
        if (sending.current || !active()) return;
        if (withoutNote && (!canResolveWithoutNote || (action !== 'WITHDRAW' && action !== 'DECLINE'))) return;
        const resolving = withoutNote || !!saved.resolution;
        const command = saved.resolution ?? (!withoutNote ? saved.pending : undefined) ?? { requestId: crypto.randomUUID(), expectedVersion: version, note: contactAllowed ? saved.note : '', ...(action ? { action } : {}), ...((action === 'OFFER' || action === 'ACCEPT') ? { expectedListingVersion: listingVersion } : {}) };
        try { persist({ ...saved, notice: undefined, ...(resolving ? { resolution: command } : { pending: command }) }); }
        catch { setError('Could not save recovery details. This attempt was not sent.'); return; }
        sending.current = true; setBusy(true); setError('');
        try {
            await sendResponse(jobId, responseId, command);
            if (!active()) return;
            if (resolving) persist({ ...saved, resolution: undefined, notice: 'Response resolved without a note. Your previous attempt is still saved separately.' });
            else {
                sessionStorage.removeItem(key);
                setSaved({ note: '' });
            }
            onSaved();
        } catch (failure) {
            if (!active()) return;
            const status = (failure as { response?: { status?: number } }).response?.status;
            // Keep the exact uncertain request, but revoke the loaded private view immediately.
            if (status === 403 || status === 404) onSaved(true);
            if (status != null && [400, 409, 422].includes(status)) {
                try { persist({ note: saved.note, ...(resolving ? { pending: saved.pending } : {}), notice: status === 409 ? 'This changed. Review the current listing and response before sending again.' : undefined }); } catch { /* Keep the exact command visible for recovery. */ }
                onSaved(status === 409);
            }
            setError(extractApiErrorMessage(failure, 'Could not confirm this change. Check the previous attempt before sending another.'));
        } finally { sending.current = false; if (active()) setBusy(false); }
    };
    return { ...saved, canResolveWithoutNote, busy, error: error || saved.notice || '', change, send };
}
