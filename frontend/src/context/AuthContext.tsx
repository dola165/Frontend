import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
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
}

interface AuthContextValue {
    sessionId: AuthSessionId;
    status: AuthStatus;
    user: AuthUser | null;
    isAuthenticated: boolean;
    isBootstrapping: boolean;
    bootstrapSession: () => Promise<AuthUser | null>;
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
} satisfies AuthUser);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const sessionId = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    const [resolvedSessionId, setResolvedSessionId] = useState(getAuthSessionId);
    const [status, setStatus] = useState<AuthStatus>('bootstrapping');
    const [user, setUser] = useState<AuthUser | null>(null);
    const bootstrapPromiseRef = useRef<{ sessionId: AuthSessionId; promise: Promise<AuthUser | null> } | null>(null);

    const applyAuthenticatedState = useCallback((nextUser: AuthUser, sessionId: AuthSessionId) => {
        setResolvedSessionId(sessionId);
        setUser(nextUser);
        setStatus('authenticated');
        setStoredUserId(nextUser.id);
        setStoredUser(nextUser);
    }, []);

    const clearSession = useCallback(() => {
        clearStoredAuth();
        setResolvedSessionId(getAuthSessionId());
        setUser(null);
        setStatus('anonymous');
    }, []);

    const fetchCurrentUser = useCallback(async (sessionId: AuthSessionId) => {
        assertCurrentAuthSession(sessionId);
        // Bootstrap targets the incoming session while the old UI is blocked.
        const config: AuthSessionRequestConfig = { _authSessionId: sessionId };
        const response = await apiClient.get<Record<string, unknown>>('/users/me', config);
        assertCurrentAuthSession(sessionId);
        const normalizedUser = normalizeAuthUser(response.data);
        applyAuthenticatedState(normalizedUser, sessionId);
        return normalizedUser;
    }, [applyAuthenticatedState]);

    const bootstrapSession = useCallback(async () => {
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
                    await refreshAccessToken();
                }

                return await fetchCurrentUser(sessionId);
            } catch (initialError) {
                if (!isCurrentAuthSession(sessionId)) return null;
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
        clearStoredAuth();
        setStoredAccessToken(accessToken);
        const nextUser = await bootstrapSession();
        if (!nextUser) throw new Error('Unable to establish the signed-in account.');
        return nextUser;
    }, [bootstrapSession]);

    const logout = useCallback(async () => {
        assertCurrentAuthSession(resolvedSessionId);
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

    return (
        <AuthContext.Provider value={{
            sessionId,
            status: visibleStatus,
            user: visibleUser,
            isAuthenticated: visibleStatus === 'authenticated',
            isBootstrapping: visibleStatus === 'bootstrapping',
            bootstrapSession,
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
