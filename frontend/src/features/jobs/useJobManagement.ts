import { useEffect, useRef, useState } from 'react';
import { getAuthSessionId, isCurrentAuthSession } from '../../utils/authStorage';
import { extractApiErrorMessage } from '../../utils/apiError';
import { applyMethodOf, closeJob, editJob, posterOf, reopenJob, type Job, type JobEditCommand, type JobEditInput, type JobVersionCommand } from './api';
import { jt } from './managementCopy';

type Pending = { kind: 'EDIT'; input: JobEditCommand } | { kind: 'CLOSE' | 'REOPEN'; input: JobVersionCommand };
interface Saved { draft?: JobEditInput; version?: number; pending?: Pending; error?: string; conflict?: boolean }

/** The exact uncertain command and typed edits survive reload in this login and listing only. */
export function useJobManagement(job: Job, userId: number | undefined, onSaved: () => void) {
    const session = getAuthSessionId();
    const key = `gk-job-management:${userId}:${session}:${job.id}`;
    const [saved, setSaved] = useState<Saved>(() => {
        try { return JSON.parse(sessionStorage.getItem(key) ?? '{}') as Saved; } catch { return {}; }
    });
    const [busy, setBusy] = useState(false);
    const sending = useRef(false);
    const mounted = useRef(false);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const active = () => mounted.current && isCurrentAuthSession(session);
    const storageError = () => jt('Could not update recovery details. Restore browser storage and check the previous change.');
    const persist = (next: Saved) => {
        try { sessionStorage.setItem(key, JSON.stringify(next)); return true; } catch { return false; }
    };
    const forget = () => {
        try { sessionStorage.removeItem(key); return true; } catch { return false; }
    };
    const write = (next: Saved) => {
        setSaved(persist(next) ? next : { ...next, error: jt('Your draft is only kept on this page while browser storage is unavailable.') });
    };
    const ownsPending = (pending: Pending) => {
        if (!active()) return false;
        try {
            return JSON.stringify(JSON.parse(sessionStorage.getItem(key) ?? '{}').pending) === JSON.stringify(pending);
        } catch {
            setSaved(current => ({ ...current, error: storageError() }));
            return false;
        }
    };
    const start = () => write({ version: job.version, draft: {
        title: job.title, description: job.description ?? '', category: job.category ?? 'OTHER',
        engagementType: job.engagementType === 'UNSPECIFIED' || !job.engagementType ? 'FLEXIBLE' : job.engagementType,
        hours: job.hours ?? null, pay: job.pay ?? '', city: posterOf(job).city ?? '', licence: job.licence ?? '',
        applyMethod: applyMethodOf(job), applyTarget: job.applyTarget ?? '',
    } });
    const change = (patch: Partial<JobEditInput>) => write({ ...saved, draft: { ...saved.draft!, ...patch } });
    const stale = saved.conflict || !!saved.draft && saved.version !== job.version;
    const send = async (kind: Pending['kind']) => {
        if (sending.current || job.version == null || !job.canManage || !userId || !active()) return;
        const pending: Pending = saved.pending ?? (kind === 'EDIT'
            ? { kind, input: { ...saved.draft!, expectedVersion: saved.version!, requestId: crypto.randomUUID() } }
            : { kind, input: { expectedVersion: job.version, requestId: crypto.randomUUID() } });
        const next = { ...saved, pending, error: '' };
        // Recovery identity is required before dispatch; memory-only drafts may
        // be edited, but an uncertain mutation must survive leaving this visit.
        if (!persist(next)) {
            setSaved({ ...saved, error: jt('Could not save recovery details. This attempt was not sent. Restore browser storage and try again.') });
            return;
        }
        sending.current = true; setBusy(true); setSaved(next);
        try {
            if (pending.kind === 'EDIT') await editJob(job.id, pending.input);
            else if (pending.kind === 'REOPEN') await reopenJob(job.id, pending.input);
            else await closeJob(job.id, pending.input.expectedVersion, pending.input.requestId);
            if (!ownsPending(pending)) return;
            if (!forget()) { setSaved(current => ({ ...current, error: storageError() })); return; }
            setSaved({});
            onSaved();
        } catch (error) {
            if (!ownsPending(pending)) return;
            const code = (error as { response?: { status?: number } }).response?.status;
            // Auth/permission/unavailable responses cannot establish whether an
            // earlier request committed. Keep its exact receipt for recovery.
            const definite = code != null && [400, 409, 422].includes(code);
            const failed = { ...saved, pending: definite ? undefined : pending, conflict: code === 409,
                error: extractApiErrorMessage(error, jt(pending.kind === 'EDIT' ? 'Could not save this listing. Your answers are still here.' : 'Could not change this listing. Try again.')) };
            if (!persist(failed)) { setSaved(current => ({ ...current, error: storageError() })); return; }
            setSaved(failed);
            if (code === 409) onSaved();
        } finally { sending.current = false; if (active()) setBusy(false); }
    };
    return { ...saved, busy, stale, start, change, send, cancel: () => {
        if (forget()) setSaved({}); else setSaved(current => ({ ...current, error: storageError() }));
    },
        acceptLatest: () => write({ ...saved, version: job.version, conflict: false, error: '' }) };
}
