import { useCallback, useState } from 'react';
import { turnstileEnabled } from './turnstileConfig';

/**
 * The bot check's state for one form: the token for the next try, whether the check failed to load or run, and a
 * round that remounts it (a token is good for one try; Retry starts again). Off without a site key: always ready.
 */
export function useBotCheck() {
    const [token, setToken] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);
    const [round, setRound] = useState(0);
    const renew = useCallback(() => { setToken(null); setFailed(false); setRound(value => value + 1); }, []);
    const onToken = useCallback((value: string | null) => { setToken(value); if (value) setFailed(false); }, []);
    const onError = useCallback(() => { setToken(null); setFailed(true); }, []);
    return { enabled: turnstileEnabled, token, ready: !turnstileEnabled || Boolean(token), failed, round, renew, onToken, onError };
}
export type BotCheck = ReturnType<typeof useBotCheck>;
