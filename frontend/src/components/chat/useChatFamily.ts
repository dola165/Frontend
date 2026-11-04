import { useCallback, useEffect, useState } from 'react';
import { chatApi, type ChatFamily } from '../../api/chat';
import { useAuth } from '../../context/AuthContext';
import { isCurrentAuthSession } from '../../utils/authStorage';

/** Who of the family is in this chat, for this reader. A parent can arrive or leave while it is open. */
export function useChatFamily(conversationId: number | null, revision: string | number) {
    const { sessionId } = useAuth();
    const scope = `${sessionId}:${conversationId}`;
    const [result, setResult] = useState<{ scope: string; family: ChatFamily } | null>(null);
    const [retry, setRetry] = useState(0);
    useEffect(() => {
        if (!conversationId) return;
        const abort = new AbortController();
        void Promise.resolve().then(() => chatApi.getFamily(conversationId, abort.signal)).then(response => {
            if (!abort.signal.aborted && isCurrentAuthSession(sessionId)) setResult({ scope, family: response.data });
        }).catch(() => undefined);
        return () => abort.abort();
    }, [conversationId, sessionId, scope, revision, retry]);
    useEffect(() => {
        const timer = window.setInterval(() => { if (document.visibilityState === 'visible') setRetry(value => value + 1); }, 15000);
        return () => window.clearInterval(timer);
    }, []);
    const refresh = useCallback(() => setRetry(value => value + 1), []);
    return { family: result?.scope === scope ? result.family : null, refresh };
}
