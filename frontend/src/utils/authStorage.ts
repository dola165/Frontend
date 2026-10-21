const USER_ID_KEY = 'userId';
const USER_KEY = 'user';
const SESSION_ID_KEY = 'gk-session-id';
// Which session id is signed in. Not a credential: the access token lives only in this tab's
// memory and a reload gets a fresh one with the HttpOnly refresh cookie.
const SIGNED_IN_KEY = 'gk-signed-in-session';
// Kept access tokens in browser storage before 20 October 2026.
const LEGACY_TOKEN_KEY = 'accessToken';
const LEGACY_TOKEN_PREFIX = 'gk-session-token:';

const accessTokens = new Map<string, string>();

// First load after the switch: a stored token means this session was signed in. Remember that,
// then delete every stored token so no script can read one from storage again.
const forgetStoredTokens = () => {
    try {
        const sessionId = localStorage.getItem(SESSION_ID_KEY);
        const signedIn = sessionId !== null && localStorage.getItem(LEGACY_TOKEN_PREFIX + sessionId) !== null;
        if (signedIn && localStorage.getItem(SIGNED_IN_KEY) === null) localStorage.setItem(SIGNED_IN_KEY, sessionId);
        for (const key of Object.keys(localStorage)) {
            if (key === LEGACY_TOKEN_KEY || key.startsWith(LEGACY_TOKEN_PREFIX)) localStorage.removeItem(key);
        }
    } catch { /* Browser storage can be unavailable. */ }
};
forgetStoredTokens();
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
    // Page visits behind pin suggestions name what was opened (a child, a player, a tab), so they end with the login too.
    clearRecoveryKeys(() => localStorage, ['gk-map-drafts:', 'gk-availability-uncertain:', 'gk-visits:']);
    clearRecoveryKeys(() => sessionStorage, ['gk-chat-recovery:', 'gk-campaign-command:', 'gk-job-management:', 'gk-store-change:', 'gk-organization-post:', 'org-invite:', 'gk-admission-staff:', 'gk-joining-setup-draft:', 'admission-retry:v1:', 'admission-form:', 'new-child:']);
};
// What a person leaves on this browser goes with their sign-out, so the next account here never sees it: their
// preferences copy, pins and workspace choices from before preferences were saved, their cart, and the drafts and
// retries kept per account. Shared choices (theme, map and list layouts) and a guest's cart stay.
const PERSONAL_KEYS = ['gk-prefs:', 'gk-pins:', 'gk-ws-layout:', 'gk-ws-focus:', 'gk-club-shortcuts-v1:', 'gk-workspace-role:', 'gk:workspace:', 'tutorial.calendar.completed'];
const PERSONAL_DRAFTS = ['family-player:', 'gk.first-use.v1:', 'organization-departure:', 'draw-draft:', 'squad-training:', 'gk-record-create:', 'gk-store-create:', 'gk-training-create:', 'gk:arrange:'];
const clearPersonalData = () => {
    clearRecoveryKeys(() => localStorage, PERSONAL_KEYS);
    clearRecoveryKeys(() => sessionStorage, PERSONAL_DRAFTS);
    try {
        for (const key of Object.keys(localStorage)) if (key.startsWith('gk.store.cart.v1:') && key !== 'gk.store.cart.v1:guest') localStorage.removeItem(key);
    } catch { /* Browser storage can be unavailable. */ }
    try {
        // Drafts kept by `ownedDraft`, such as a job post being written.
        for (const key of Object.keys(sessionStorage)) if (/^gk\.[\w-]+\.draft:/.test(key)) sessionStorage.removeItem(key);
    } catch { /* Browser storage can be unavailable. */ }
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

const sessionTokenKey = (sessionId: AuthSessionId) => sessionId ?? 'legacy';

// Tokens are held per session id, in memory, so a retired session can never hand its token
// to the next one. Another tab's sign-in is only visible here as a new session id.
export const getStoredAccessToken = (sessionId: AuthSessionId = getAuthSessionId()) =>
    accessTokens.get(sessionTokenKey(sessionId)) ?? null;

export const hasStoredAccessToken = () => Boolean(getStoredAccessToken());

/** True when this session id belongs to a sign-in (in any tab), so a reload should restore it. */
export const isSignedInSession = (sessionId: AuthSessionId) => {
    if (sessionId === null) return false;
    try { return localStorage.getItem(SIGNED_IN_KEY) === sessionId; } catch { return false; }
};

export const setStoredAccessToken = (token: string) => {
    // This setter installs a login, including a new login to the same account.
    clearMapDraftRecovery();
    const previousSessionId = getAuthSessionId();
    const sessionId = crypto.randomUUID();
    accessTokens.set(sessionTokenKey(sessionId), token);
    // Marker before id: another tab reacts to the id change and must already see the marker.
    localStorage.setItem(SIGNED_IN_KEY, sessionId);
    localStorage.setItem(SESSION_ID_KEY, sessionId);
    accessTokens.delete(sessionTokenKey(previousSessionId));
    window.dispatchEvent(new Event('gk-auth-changed'));
};

export const setRefreshedAccessToken = (token: string, sessionId: AuthSessionId) => {
    assertCurrentAuthSession(sessionId);
    accessTokens.set(sessionTokenKey(sessionId), token);
    if (!isCurrentAuthSession(sessionId)) {
        accessTokens.delete(sessionTokenKey(sessionId));
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
    clearPersonalData();
    localStorage.setItem(SESSION_ID_KEY, crypto.randomUUID());
    localStorage.removeItem(SIGNED_IN_KEY);
    accessTokens.clear();
    localStorage.removeItem(USER_ID_KEY);
    localStorage.removeItem(USER_KEY);
    window.dispatchEvent(new Event('gk-auth-changed'));
};
