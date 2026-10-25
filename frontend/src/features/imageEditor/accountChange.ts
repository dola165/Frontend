import { getAuthSessionId } from '../../utils/authStorage';

const accountOf = () => {
    let user: string | null = null;
    try { user = localStorage.getItem('userId'); } catch { user = null; }
    return `${getAuthSessionId() ?? ''}\n${user ?? ''}`;
};

/**
 * Calls `forget` whenever the signed-in account changes (sign-out, sign-in, switching account), not on a mere token
 * refresh: what one account was told or left waiting must never show for another.
 */
export function onAccountChange(forget: () => void) {
    if (typeof window === 'undefined') return () => undefined;
    let account = accountOf();
    const changed = () => {
        const next = accountOf();
        if (next === account) return;
        account = next;
        forget();
    };
    window.addEventListener('gk-auth-changed', changed);
    window.addEventListener('storage', changed);
    return () => { window.removeEventListener('gk-auth-changed', changed); window.removeEventListener('storage', changed); };
}
