const ACCESS_TOKEN_KEY = 'accessToken';
const USER_ID_KEY = 'userId';
const USER_KEY = 'user';
const SESSION_ID_KEY = 'gk-session-id';
const clearRecoveryKeys = (getStorage: () => Storage, prefixes: string[]) => {
    // A blocked store must not prevent cleanup in the other store or auth changes.
    try {
        const storage = getStorage();
        for (const key of Object.keys(storage)) {
            if (!prefixes.some(prefix => key.startsWith(prefix))) continue;
            try { storage.removeItem(key); } catch { /* Continue with other receipts. */ }
        }
    } catch { /* Browser storage can be unavailable. */ }
};
const clearMapDraftRecovery = () => {
    // Private drafts and uncertain replies belong to one login, even when unmounted.
    clearRecoveryKeys(() => localStorage, ['gk-map-drafts:', 'gk-availability-uncertain:']);
    clearRecoveryKeys(() => sessionStorage, ['gk-admission-staff:', 'gk-joining-setup-draft:', 'admission-retry:v1:', 'admission-form:', 'new-child:']);
};

// Shared across tabs. Keep the marker on logout so A -> logout -> A cannot
// make work from the first login current again, even if the token is identical.
export const getAuthSessionId = () => localStorage.getItem(SESSION_ID_KEY);
export type AuthSessionId = ReturnType<typeof getAuthSessionId>;
export const isCurrentAuthSession = (sessionId: AuthSessionId) => getAuthSessionId() === sessionId;

export const subscribeAuthSession = (listener: () => void) => {
    window.addEventListener('gk-auth-changed', listener);
    window.addEventListener('storage', listener);
    window.addEventListener('pageshow', listener);
    document.addEventListener('visibilitychange', listener);
    return () => {
        window.removeEventListener('gk-auth-changed', listener);
        window.removeEventListener('storage', listener);
        window.removeEventListener('pageshow', listener);
        document.removeEventListener('visibilitychange', listener);
    };
};

export class AuthSessionChangedError extends Error {
    readonly code = 'AUTH_SESSION_CHANGED';
    constructor() {
        super('The session changed while this request was in progress.');
        this.name = 'AuthSessionChangedError';
    }
}

export const assertCurrentAuthSession = (sessionId: AuthSessionId) => {
    if (!isCurrentAuthSession(sessionId)) throw new AuthSessionChangedError();
};

const sessionTokenKey = (sessionId: AuthSessionId) => `gk-session-token:${sessionId ?? 'legacy'}`;

// A retired tab can only write its own token slot. Checking then writing a
// shared accessToken key is not atomic across tabs, even without an await.
export const getStoredAccessToken = (sessionId: AuthSessionId = getAuthSessionId()) =>
    localStorage.getItem(sessionTokenKey(sessionId))
        ?? (sessionId === null ? localStorage.getItem(ACCESS_TOKEN_KEY) : null);

export const hasStoredAccessToken = () => Boolean(getStoredAccessToken());

export const setStoredAccessToken = (token: string) => {
    // This setter installs a login, including a new login to the same account.
    clearMapDraftRecovery();
    const previousSessionId = getAuthSessionId();
    const sessionId = crypto.randomUUID();
    localStorage.setItem(sessionTokenKey(sessionId), token);
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
    localStorage.setItem(SESSION_ID_KEY, sessionId);
    localStorage.removeItem(sessionTokenKey(previousSessionId));
    window.dispatchEvent(new Event('gk-auth-changed'));
};

export const setRefreshedAccessToken = (token: string, sessionId: AuthSessionId) => {
    assertCurrentAuthSession(sessionId);
    localStorage.setItem(sessionTokenKey(sessionId), token);
    if (!isCurrentAuthSession(sessionId)) {
        localStorage.removeItem(sessionTokenKey(sessionId));
        throw new AuthSessionChangedError();
    }
    window.dispatchEvent(new Event('gk-auth-changed'));
};

export const getStoredUserId = () => localStorage.getItem(USER_ID_KEY);

export const setStoredUserId = (userId: number | string) => {
    localStorage.setItem(USER_ID_KEY, String(userId));
};

export const setStoredUser = (user: unknown) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearStoredAuth = () => {
    clearMapDraftRecovery();
    const previousSessionId = getAuthSessionId();
    localStorage.setItem(SESSION_ID_KEY, crypto.randomUUID());
    localStorage.removeItem(sessionTokenKey(previousSessionId));
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(USER_ID_KEY);
    localStorage.removeItem(USER_KEY);
    window.dispatchEvent(new Event('gk-auth-changed'));
};
