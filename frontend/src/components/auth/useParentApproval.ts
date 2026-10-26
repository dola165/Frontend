import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { fetchParentApproval, sendParentApproval, type ParentApprovalStatus } from '../../api/parentApproval';
import { extractApiErrorCode } from '../../utils/apiError';
import { isEmail } from '../../utils/registration';

/**
 * Asking a parent to approve a 13 to 15-year-old's account: the request as the server has it (re-read whenever the
 * page comes back into view), sending or re-sending the link, and changing the parent's email. The waiting page and
 * the banner for older accounts use the same flow.
 */
export function useParentApproval(ownEmail?: string | null) {
    const { t } = useTranslation();
    const [request, setRequest] = useState<ParentApprovalStatus | null>(null);
    // The status could not be read: the screen says so with Try again, never the form (sending would replace a link).
    const [loadFailed, setLoadFailed] = useState(false);
    const [editing, setEditing] = useState(false);
    const [email, setEmail] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [fieldError, setFieldError] = useState('');

    const load = useCallback((signal?: AbortSignal) => fetchParentApproval(signal)
        .then(found => { setRequest(found); setLoadFailed(false); })
        .catch(() => { if (!signal?.aborted) setLoadFailed(true); }), []);
    useEffect(() => {
        const controller = new AbortController();
        void load(controller.signal);
        const again = () => { if (document.visibilityState === 'visible') void load(); };
        document.addEventListener('visibilitychange', again);
        return () => { controller.abort(); document.removeEventListener('visibilitychange', again); };
    }, [load]);

    const send = async (parentEmail: string) => {
        if (busy) return;
        setBusy(true); setError('');
        try { setRequest(await sendParentApproval(parentEmail)); setEditing(false); } catch (failure) {
            const code = extractApiErrorCode(failure);
            const wait = Number(isAxiosError(failure) ? failure.response?.headers?.['retry-after'] : NaN);
            if (code === 'PARENT_EMAIL_INVALID') setFieldError(t('auth.parentWait.errEmail'));
            else if (code === 'PARENT_APPROVAL_NOT_NEEDED') void load();
            else setError(isAxiosError(failure) && failure.response?.status === 429
                ? t('auth.parentWait.wait', { seconds: Number.isFinite(wait) && wait > 0 ? Math.ceil(wait) : 60 })
                : t('auth.parentWait.failed'));
        } finally { setBusy(false); }
    };
    const submit = (event: FormEvent) => {
        event.preventDefault();
        const typed = email.trim().toLowerCase();
        if (!isEmail(typed) || typed === ownEmail?.toLowerCase()) { setFieldError(t('auth.parentWait.errEmail')); return; }
        void send(typed);
    };
    const retry = () => { setLoadFailed(false); void load(); };
    const change = () => { setEditing(true); setEmail(''); setError(''); };
    const keep = () => { setEditing(false); setFieldError(''); setError(''); };
    const type = (value: string) => { setEmail(value); setFieldError(''); };
    const sent = (request?.status === 'WAITING' || (request?.status === 'GRACE' && Boolean(request.linkSent))) && Boolean(request.parentEmail) && !editing;
    return { request, loadFailed, editing, email, busy, error, fieldError, sent, send, submit, retry, change, keep, type };
}
export type ParentApprovalFlow = ReturnType<typeof useParentApproval>;
