import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { isAndroidApp, nativeCall, nativeSession } from '../android/bridge';
import { normalizeNavigationCapabilities, type NavigationCapabilities } from './navigationCapabilities';
import {
    apiClient,
    ensureCsrfToken,
    refreshAccessToken,
    setAccountRestrictionHandler,
    setAuthFailureHandler,
    setDisplayedAuthSession,
    type AuthSessionRequestConfig,
} from '../api/axiosConfig';
import {
    clearStoredAuth,
    assertCurrentAuthSession,
    getAuthSessionId,
    getStoredAccessToken,
    isCurrentAuthSession,
    setStoredAccessToken,
    setStoredUser,
    setStoredUserId,
    subscribeAuthSession,
    type AuthSessionId,
} from '../utils/authStorage';

export type AuthStatus = 'bootstrapping' | 'authenticated' | 'anonymous';

export interface AuthUser {
    id: number;
    username?: string;
    email?: string;
    role?: string;
    fullName?: string;
    name?: string;
    avatarUrl?: string;
    dob?: string | null;
    profileComplete: boolean;
    onboardingRequired: boolean;
    mustChangePassword: boolean;
    emailVerified: boolean;
    navigationCapabilities?: NavigationCapabilities;
}

interface AuthContextValue {
    sessionId: AuthSessionId;
    status: AuthStatus;
    user: AuthUser | null;
    isAuthenticated: boolean;
    isBootstrapping: boolean;
    bootstrapSession: () => Promise<AuthUser | null>;
    refreshNavigationCapabilities: () => Promise<void>;
    loginWithAccessToken: (accessToken: string) => Promise<AuthUser>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const normalizeAuthUser = (payload: Record<string, unknown>) => ({
    id: Number(payload.id),
    username: typeof payload.username === 'string' ? payload.username : undefined,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    role: typeof payload.role === 'string' ? payload.role : undefined,
    fullName: typeof payload.fullName === 'string' ? payload.fullName : undefined,
    name: typeof payload.name === 'string' ? payload.name : undefined,
    avatarUrl: typeof payload.avatarUrl === 'string' ? payload.avatarUrl : undefined,
    dob: typeof payload.dob === 'string' ? payload.dob : null,
    profileComplete: Boolean(payload.profileComplete),
    onboardingRequired: payload.onboardingRequired === true || payload.profileComplete === false,
    mustChangePassword: payload.mustChangePassword === true,
    emailVerified: payload.emailVerified === true,
    navigationCapabilities: normalizeNavigationCapabilities(payload.navigationCapabilities, Number(payload.id)),
} satisfies AuthUser);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const sessionId = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    const [resolvedSessionId, setResolvedSessionId] = useState(getAuthSessionId);
    const [status, setStatus] = useState<AuthStatus>('bootstrapping');
    const [user, setUser] = useState<AuthUser | null>(null);
    const [nativeBootstrapError, setNativeBootstrapError] = useState(false);
    const bootstrapPromiseRef = useRef<{ sessionId: AuthSessionId; promise: Promise<AuthUser | null> } | null>(null);
    const currentUserRequestRef = useRef(0);

    const applyAuthenticatedState = useCallback((nextUser: AuthUser, sessionId: AuthSessionId) => {
        setResolvedSessionId(sessionId);
        setUser(nextUser);
        setStatus('authenticated');
        setStoredUserId(nextUser.id);
        // Workspace hints are ephemeral and must never be restored from browser storage.
        setStoredUser({ ...nextUser, navigationCapabilities: undefined });
    }, []);

    const clearSession = useCallback(() => {
        clearStoredAuth();
        setResolvedSessionId(getAuthSessionId());
        setUser(null);
        setStatus('anonymous');
    }, []);

    const fetchCurrentUser = useCallback(async (sessionId: AuthSessionId) => {
        assertCurrentAuthSession(sessionId);
        const request = ++currentUserRequestRef.current;
        // Bootstrap targets the incoming session while the old UI is blocked.
        const config: AuthSessionRequestConfig = { _authSessionId: sessionId };
        const response = await apiClient.get<Record<string, unknown>>('/users/me', config);
        assertCurrentAuthSession(sessionId);
        const normalizedUser = normalizeAuthUser(response.data);
        if (request === currentUserRequestRef.current) applyAuthenticatedState(normalizedUser, sessionId);
        return normalizedUser;
    }, [applyAuthenticatedState]);

    const refreshNavigationCapabilities = useCallback(async () => {
        if (status !== 'authenticated' || resolvedSessionId !== getAuthSessionId() || bootstrapPromiseRef.current) return;
        const session = resolvedSessionId;
        const request = ++currentUserRequestRef.current;
        try {
            const config: AuthSessionRequestConfig = { _authSessionId: session };
            const response = await apiClient.get<Record<string, unknown>>('/users/me', config);
            if (!isCurrentAuthSession(session) || request !== currentUserRequestRef.current) return;
            const next = normalizeAuthUser(response.data);
            setUser(current => current?.id === next.id ? next
                : current ? { ...current, navigationCapabilities: { version: 1, workspaces: [] } } : current);
        } catch {
            if (!isCurrentAuthSession(session) || request !== currentUserRequestRef.current) return;
            // Retire stale shortcuts on failure without discarding the authenticated account.
            setUser(current => current ? { ...current, navigationCapabilities: { version: 1, workspaces: [] } } : current);
        }
    }, [status, resolvedSessionId]);

    useEffect(() => {
        if (status !== 'authenticated') return;
        const refresh = () => { if (document.visibilityState === 'visible') void refreshNavigationCapabilities(); };
        window.addEventListener('focus', refresh);
        document.addEventListener('visibilitychange', refresh);
        const timer = window.setInterval(refresh, 60_000);
        return () => {
            window.removeEventListener('focus', refresh);
            document.removeEventListener('visibilitychange', refresh);
            window.clearInterval(timer);
        };
    }, [status, refreshNavigationCapabilities]);

    const bootstrapSession = useCallback(async () => {
        setNativeBootstrapError(false);
        const sessionId = getAuthSessionId();
        if (bootstrapPromiseRef.current?.sessionId === sessionId) {
            return bootstrapPromiseRef.current.promise;
        }

        setStatus((current) => current === 'authenticated' ? current : 'bootstrapping');

        const storedAccessToken = getStoredAccessToken();
        const bootstrapTask = (async () => {
            try {
                await ensureCsrfToken().catch(() => undefined);
                assertCurrentAuthSession(sessionId);

                if (!storedAccessToken) {
                    if (isAndroidApp && !(await nativeSession()).active) { clearSession(); return null; }
                    await refreshAccessToken();
                }

                return await fetchCurrentUser(sessionId);
            } catch (initialError) {
                if (!isCurrentAuthSession(sessionId)) return null;
                if (isAndroidApp) {
                    const session = await nativeSession().catch(() => null);
                    if (session === null || session.active) { setNativeBootstrapError(true); return null; }
                    clearSession(); return null;
                }
                if (storedAccessToken) {
                    try {
                        await refreshAccessToken();
                        return await fetchCurrentUser(sessionId);
                    } catch (refreshError) {
                        if (!isCurrentAuthSession(sessionId)) return null;
                        console.error('Failed to restore authenticated session.', refreshError);
                    }
                } else {
                    console.error('Silent session bootstrap failed.', initialError);
                }

                clearSession();
                return null;
            } finally {
                if (bootstrapPromiseRef.current?.sessionId === sessionId) bootstrapPromiseRef.current = null;
            }
        })();

        bootstrapPromiseRef.current = { sessionId, promise: bootstrapTask };
        return bootstrapTask;
    }, [clearSession, fetchCurrentUser]);

    const loginWithAccessToken = useCallback(async (accessToken: string) => {
        if (typeof accessToken !== 'string' || !accessToken.trim()) {
            throw new Error('Sign-in has not completed. Verify your account before continuing.');
        }
        if (isAndroidApp) {
            await nativeCall({ kind: 'signedIn' });
            accessToken = 'native-session';
        }
        clearStoredAuth();
        setStoredAccessToken(accessToken);
        const nextUser = await bootstrapSession();
        if (!nextUser) throw new Error('Unable to establish the signed-in account.');
        return nextUser;
    }, [bootstrapSession]);

    const logout = useCallback(async () => {
        assertCurrentAuthSession(resolvedSessionId);
        if (isAndroidApp) { clearSession(); await nativeCall({ kind: 'logout' }); return; }
        // Retire local work immediately; a delayed logout must not clear a later login.
        clearSession();
        const sessionId = getAuthSessionId();
        try {
            const csrf = await ensureCsrfToken();
            assertCurrentAuthSession(sessionId);
            const config: AuthSessionRequestConfig = { ...csrf, _authSessionId: sessionId };
            await apiClient.post('/auth/logout', {}, config);
        } catch (error) {
            if (isCurrentAuthSession(sessionId)) console.error('Logout failed.', error);
        }
    }, [clearSession, resolvedSessionId]);

    useEffect(() => {
        setAuthFailureHandler(() => {
            clearSession();
        });
        setAccountRestrictionHandler((code) => {
            setUser(current => current ? {
                ...current,
                mustChangePassword: code === 'PASSWORD_CHANGE_REQUIRED',
                ...(code !== 'PASSWORD_CHANGE_REQUIRED' ? { onboardingRequired: true, profileComplete: false } : {}),
            } : current);
        });

        return () => {
            setAuthFailureHandler(null);
            setAccountRestrictionHandler(null);
        };
    }, [clearSession]);

    useEffect(() => {
        // Adopt another tab's logout without rotating the shared marker or
        // refreshing its cookie, which could resurrect the retired login.
        if (sessionId !== null && !getStoredAccessToken(sessionId)) {
            setResolvedSessionId(sessionId);
            setUser(null);
            setStatus('anonymous');
        } else {
            void bootstrapSession();
        }
    }, [sessionId, bootstrapSession]);

    useLayoutEffect(() => {
        setDisplayedAuthSession(resolvedSessionId);
        return () => setDisplayedAuthSession(undefined);
    }, [resolvedSessionId]);

    const visibleStatus = resolvedSessionId === sessionId ? status : 'bootstrapping';
    const visibleUser = resolvedSessionId === sessionId ? user : null;

    if (isAndroidApp && nativeBootstrapError && !visibleUser) return <main role="alert" className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">Your account could not be loaded</h1>
        <p>Check your connection and try again. Your Android sign-in has been kept.</p>
        <button className="rounded-xl bg-[color:var(--color-accent)] px-5 py-3 text-[color:var(--color-on-accent)]" onClick={() => void bootstrapSession()}>Try again</button>
    </main>;

    return (
        <AuthContext.Provider value={{
            sessionId,
            status: visibleStatus,
            user: visibleUser,
            isAuthenticated: visibleStatus === 'authenticated',
            isBootstrapping: visibleStatus === 'bootstrapping',
            bootstrapSession,
            refreshNavigationCapabilities,
            loginWithAccessToken,
            logout
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider.');
    }

    return context;
};
