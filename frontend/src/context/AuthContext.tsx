import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
    apiClient,
    ensureCsrfToken,
    refreshAccessToken,
    setAuthFailureHandler
} from '../api/axiosConfig';
import {
    clearStoredAuth,
    getStoredAccessToken,
    setStoredAccessToken,
    setStoredUser,
    setStoredUserId
} from '../utils/authStorage';

export type AuthStatus = 'bootstrapping' | 'authenticated' | 'anonymous';

export interface AuthUser {
    id: number;
    username?: string;
    role?: string;
    fullName?: string;
    name?: string;
    profileComplete: boolean;
}

interface AuthContextValue {
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
    role: typeof payload.role === 'string' ? payload.role : undefined,
    fullName: typeof payload.fullName === 'string' ? payload.fullName : undefined,
    name: typeof payload.name === 'string' ? payload.name : undefined,
    profileComplete: Boolean(payload.profileComplete)
} satisfies AuthUser);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [status, setStatus] = useState<AuthStatus>('bootstrapping');
    const [user, setUser] = useState<AuthUser | null>(null);
    const bootstrapPromiseRef = useRef<Promise<AuthUser | null> | null>(null);

    const applyAuthenticatedState = (nextUser: AuthUser) => {
        setUser(nextUser);
        setStatus('authenticated');
        setStoredUserId(nextUser.id);
        setStoredUser(nextUser);
    };

    const clearSession = () => {
        clearStoredAuth();
        setUser(null);
        setStatus('anonymous');
    };

    const fetchCurrentUser = async () => {
        const response = await apiClient.get<Record<string, unknown>>('/users/me');
        const normalizedUser = normalizeAuthUser(response.data);
        applyAuthenticatedState(normalizedUser);
        return normalizedUser;
    };

    const bootstrapSession = async () => {
        if (bootstrapPromiseRef.current) {
            return bootstrapPromiseRef.current;
        }

        setStatus((current) => current === 'authenticated' ? current : 'bootstrapping');

        const storedAccessToken = getStoredAccessToken();
        const bootstrapTask = (async () => {
            try {
                await ensureCsrfToken().catch(() => undefined);

                if (!storedAccessToken) {
                    await refreshAccessToken();
                }

                return await fetchCurrentUser();
            } catch (initialError) {
                if (storedAccessToken) {
                    try {
                        await refreshAccessToken();
                        return await fetchCurrentUser();
                    } catch (refreshError) {
                        console.error('Failed to restore authenticated session.', refreshError);
                    }
                } else {
                    console.error('Silent session bootstrap failed.', initialError);
                }

                clearSession();
                return null;
            } finally {
                bootstrapPromiseRef.current = null;
            }
        })();

        bootstrapPromiseRef.current = bootstrapTask;
        return bootstrapTask;
    };

    const loginWithAccessToken = async (accessToken: string) => {
        setStoredAccessToken(accessToken);
        setStatus('bootstrapping');

        try {
            await ensureCsrfToken().catch(() => undefined);
            return await fetchCurrentUser();
        } catch (error) {
            clearSession();
            throw error;
        }
    };

    const logout = async () => {
        try {
            await ensureCsrfToken().catch(() => undefined);
            await apiClient.post('/auth/logout');
        } catch (error) {
            console.error('Logout failed.', error);
        } finally {
            clearSession();
        }
    };

    useEffect(() => {
        setAuthFailureHandler(() => {
            clearSession();
        });

        void bootstrapSession();

        return () => {
            setAuthFailureHandler(null);
        };
    }, []);

    return (
        <AuthContext.Provider value={{
            status,
            user,
            isAuthenticated: status === 'authenticated',
            isBootstrapping: status === 'bootstrapping',
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
