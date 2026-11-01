import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { withSessionCredentialLock } from '../../../api/sessionCredentialLock';
import { getAuthSessionId, isCurrentAuthSession, subscribeAuthSession } from '../../../utils/authStorage';
import { extractApiErrorCode, extractApiErrorMessage } from '../../../utils/apiError';
import { closeAccount, previewAccountClosure, type ClosurePreview } from './accountClosureApi';

export function useAccountClosure() {
    const { user, sessionId, logout } = useAuth();
    const navigate = useNavigate();
    const request = useRef<AbortController | null>(null);
    const [preview, setPreview] = useState<ClosurePreview | null>(null);
    const [password, setPassword] = useState('');
    const [acknowledged, setAcknowledged] = useState(false);
    const [loading, setLoading] = useState(false);
    const [closing, setClosing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [requestId, setRequestId] = useState(() => crypto.randomUUID());

    const load = useCallback(async () => {
        if (request.current || !isCurrentAuthSession(sessionId)) return;
        const controller = new AbortController(); request.current = controller;
        const current = () => !controller.signal.aborted && isCurrentAuthSession(sessionId);
        setLoading(true); setPreview(null); setError(null); setAcknowledged(false);
        try {
            const result = await previewAccountClosure(sessionId, controller.signal);
            if (!current()) return;
            if (result.accountId !== user?.id || !/^[0-9a-f]{64}$/.test(result.version)
                || !Array.isArray(result.blockers) || !Array.isArray(result.consequences)) throw new Error('Account closure could not be reviewed.');
            setPreview(result); setRequestId(crypto.randomUUID());
        } catch (failure) {
            if (current()) setError(extractApiErrorMessage(failure, 'Could not review account closure. Retry to check the current responsibilities.'));
        } finally {
            if (request.current === controller) request.current = null;
            if (current()) setLoading(false);
        }
    }, [sessionId, user?.id]);

    useEffect(() => {
        setPassword(''); setAcknowledged(false); setClosing(false);
        void load();
        const unsubscribe = subscribeAuthSession(() => {
            if (!isCurrentAuthSession(sessionId)) {
                request.current?.abort(); setPreview(null); setPassword(''); setAcknowledged(false);
            }
        });
        return () => { request.current?.abort(); request.current = null; unsubscribe(); };
    }, [load, sessionId]);

    const close = async () => {
        if (request.current || !preview || preview.blockers.length || !preview.passwordRequired || !acknowledged || !password || !isCurrentAuthSession(sessionId)) return;
        const controller = new AbortController(); request.current = controller;
        const current = () => !controller.signal.aborted && isCurrentAuthSession(sessionId);
        setClosing(true); setError(null);
        try {
            const receipt = await withSessionCredentialLock(controller.signal, () => closeAccount({ requestId, version: preview.version, currentPassword: password, acknowledged }, sessionId, controller.signal));
            if (!current()) return;
            if (receipt.accountId !== user?.id || receipt.requestId !== requestId || receipt.outcome !== 'CLOSED' || !Number.isFinite(Date.parse(receipt.closedAt))) throw new Error('No valid closure receipt was received.');
            setPassword(''); setPreview(null);
            // Let the authenticated shell retire before installing the public receipt. Its
            // sign-out redirect would otherwise replace this navigation and lose the receipt.
            const signingOut = logout();
            const signedOutSession = getAuthSessionId();
            await signingOut;
            if (isCurrentAuthSession(signedOutSession)) navigate('/login', { replace: true, state: { accountClosureReceipt: receipt } });
        } catch (failure) {
            if (!current()) return;
            const code = extractApiErrorCode(failure);
            if (code === 'CLOSURE_CHANGED' || code === 'CLOSURE_BLOCKED' || code === 'CREDENTIAL_CHANGED') { setPreview(null); setAcknowledged(false); }
            setError(extractApiErrorMessage(failure, 'No closure receipt was received. The outcome is unknown. Check sign-in before trying again; do not assume the account closed.'));
        } finally {
            if (request.current === controller) request.current = null;
            if (current()) setClosing(false);
        }
    };
    return { preview, password, setPassword, acknowledged, setAcknowledged, loading, closing, error, load, close };
}
