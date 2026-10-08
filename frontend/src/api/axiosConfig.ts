import axios from 'axios';
import { isAndroidApp, nativeAdapter, nativeSession } from '../android/bridge';
import type { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import {
    assertCurrentAuthSession, clearStoredAuth, getAuthSessionId, getStoredAccessToken,
    isCurrentAuthSession, setRefreshedAccessToken, type AuthSessionId,
} from '../utils/authStorage';
import { buildWebSocketUrlFromBase, resolveDeploymentUrls } from './deploymentUrls';
import { withSessionCredentialLock } from './sessionCredentialLock';

const browserOrigin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
export const DEPLOYMENT_URLS = resolveDeploymentUrls(isAndroidApp ? '/api' : import.meta.env.VITE_API_BASE_URL, browserOrigin);
export const API_BASE_URL = DEPLOYMENT_URLS.apiBaseUrl;

export const apiClient = axios.create({
    ...(isAndroidApp ? { adapter: nativeAdapter } : {}),
    baseURL: API_BASE_URL,
    withCredentials: true,
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
});

const authUtilityClient = axios.create({
    ...(isAndroidApp ? { adapter: nativeAdapter } : {}),
    baseURL: API_BASE_URL,
    withCredentials: true,
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
});

let authFailureHandler: (() => void) | null = null;
// Default requests belong to the account this tab has resolved for its UI.
// Storage can change before its event is delivered or React commits a new screen.
let displayedSessionId: AuthSessionId | undefined;
export const setDisplayedAuthSession = (sessionId: AuthSessionId | undefined) => {
    displayedSessionId = sessionId;
};
export interface AuthSessionRequestConfig extends AxiosRequestConfig {
    _authSessionId: AuthSessionId;
}
export type AccountRestriction = 'PASSWORD_CHANGE_REQUIRED' | 'DOB_REQUIRED' | 'ONBOARDING_REQUIRED';
let accountRestrictionHandler: ((code: AccountRestriction) => void) | null = null;
export const setAccountRestrictionHandler = (handler: typeof accountRestrictionHandler) => {
    accountRestrictionHandler = handler;
};

export const setAuthFailureHandler = (handler: (() => void) | null) => {
    authFailureHandler = handler;
};

export const ensureCsrfToken = async (signal?: AbortSignal) => {
    const { data } = await authUtilityClient.get<{ headerName: string; token: string }>('/auth/csrf', { signal });
    // Spring returns the masked request token. The readable cookie contains a
    // different value and Axios must not overwrite this header with that cookie.
    return { headers: { [data.headerName]: data.token }, withXSRFToken: false };
};

// This comparison binds renewal to an account; server-side signature validation
// remains authoritative. In particular, an old Set-Cookie must not renew B as A.
const tokenSubject = (token: string | null): string | undefined => {
    try {
        const payload = token?.split('.')[1];
        if (!payload) return undefined;
        const subject: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).sub;
        return typeof subject === 'string' ? subject : undefined;
    } catch { return undefined; }
};

class RefreshAccountMismatchError extends Error {}
const assertRefreshAccount = (token: string, expectedSubject: string | undefined) => {
    if (expectedSubject && tokenSubject(token) !== expectedSubject) {
        throw new RefreshAccountMismatchError('The renewed session belongs to a different account. Sign in again.');
    }
};

const requestFreshAccessToken = async (sessionId: AuthSessionId, signal: AbortSignal, expectedSubject: string | undefined, previousToken: string | null) => {
    const csrf = await ensureCsrfToken(signal);
    for (let attempt = 0; ; attempt++) {
        assertCurrentAuthSession(sessionId);
        try {
            const response = await authUtilityClient.post<{ accessToken?: string }>('/auth/refresh', {}, { ...csrf, signal });
            assertCurrentAuthSession(sessionId);
            const publishedToken = getStoredAccessToken(sessionId);
            if (publishedToken && publishedToken !== previousToken) {
                assertRefreshAccount(publishedToken, expectedSubject);
                return publishedToken;
            }
            const token = response.data?.accessToken;
            if (!token) {
                throw new Error('Refresh response did not include an access token.');
            }
            assertRefreshAccount(token, expectedSubject);
            setRefreshedAccessToken(token, sessionId);
            return token;
        } catch (error) {
            assertCurrentAuthSession(sessionId);
            const publishedToken = getStoredAccessToken(sessionId);
            if (publishedToken && publishedToken !== previousToken) {
                assertRefreshAccount(publishedToken, expectedSubject);
                return publishedToken;
            }
            // A simultaneous request won rotation. Give its Set-Cookie time to arrive,
            // then retry using the shared HttpOnly cookie; never reuse a token body.
            if (!axios.isAxiosError(error) || error.response?.status !== 409
                || error.response.data?.code !== 'REFRESH_ALREADY_ROTATED' || attempt >= 2) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
};

let refreshFlight: { sessionId: AuthSessionId; promise: Promise<string>; controller: AbortController } | null = null;

export const refreshAccessToken = (rejectedAccessToken?: string | null, expectedSessionId?: AuthSessionId): Promise<string> => {
    if (isAndroidApp) return nativeSession().then(session => {
        if (!session.active) throw new Error('Your session ended. Sign in again.');
        return 'native-session';
    });
    const sessionId = expectedSessionId === undefined ? getAuthSessionId() : expectedSessionId;
    try { assertCurrentAuthSession(sessionId); } catch (error) { return Promise.reject(error); }
    if (refreshFlight?.sessionId === sessionId) return refreshFlight.promise;
    refreshFlight?.controller.abort();

    const previousToken = rejectedAccessToken === undefined ? getStoredAccessToken(sessionId) : rejectedAccessToken;
    const expectedSubject = tokenSubject(previousToken);
    const controller = new AbortController();
    const abortRetiredSession = () => {
        if (!isCurrentAuthSession(sessionId)) controller.abort();
    };
    window.addEventListener('gk-auth-changed', abortRetiredSession);
    window.addEventListener('storage', abortRetiredSession);
    const refresh = async () => {
        assertCurrentAuthSession(sessionId);
        const currentToken = getStoredAccessToken(sessionId);
        // Another tab completed refresh while we waited for the origin-wide lock.
        if (currentToken && currentToken !== previousToken) {
            assertRefreshAccount(currentToken, expectedSubject);
            return currentToken;
        }
        return requestFreshAccessToken(sessionId, controller.signal, expectedSubject, currentToken);
    };
    const task = withSessionCredentialLock(controller.signal, refresh).catch(error => {
        assertCurrentAuthSession(sessionId);
        throw error;
    });
    const promise = task.finally(() => {
        window.removeEventListener('gk-auth-changed', abortRetiredSession);
        window.removeEventListener('storage', abortRetiredSession);
        if (refreshFlight?.promise === promise) refreshFlight = null;
    });
    refreshFlight = { sessionId, promise, controller };
    return promise;
};

export async function renewRejectedSession(sessionId: AuthSessionId, rejectedAccessToken: string | null) {
    try {
        const token = await refreshAccessToken(rejectedAccessToken, sessionId);
        assertCurrentAuthSession(sessionId);
        return token;
    } catch (error) {
        assertCurrentAuthSession(sessionId);
        if ((axios.isAxiosError(error) && error.response?.status === 401) || error instanceof RefreshAccountMismatchError) {
            clearStoredAuth(); authFailureHandler?.();
        }
        throw error;
    }
}

export const buildWebSocketUrl = (path: string) => {
    return buildWebSocketUrlFromBase(DEPLOYMENT_URLS.serviceBaseUrl, path);
};

type SessionRequestConfig = InternalAxiosRequestConfig & { _authSessionId?: AuthSessionId; _retry?: boolean; _skipAuthRefresh?: boolean; _sentAccessToken?: string | null };

apiClient.interceptors.request.use((config: SessionRequestConfig) => {
    if (config._authSessionId === undefined) {
        config._authSessionId = displayedSessionId === undefined ? getAuthSessionId() : displayedSessionId;
    }
    assertCurrentAuthSession(config._authSessionId);
    const token = getStoredAccessToken(config._authSessionId);
    config._sentAccessToken = token;
    assertCurrentAuthSession(config._authSessionId);
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    } else {
        config.headers.delete('Authorization');
    }
    return config;
}, (error) => { throw error; }, { synchronous: true });

const shouldSkipAuthRetry = (url?: string) => {
    if (!url) {
        return false;
    }

    return url.includes('/auth/login')
        || url.includes('/auth/google')
        || url.includes('/auth/refresh')
        || url.includes('/auth/logout')
        || url.includes('/auth/csrf')
        || url.includes('/auth/qr/initiate')
        || url.includes('/auth/qr/status/');
};

apiClient.interceptors.response.use(
    (response) => {
        const request = response.config as SessionRequestConfig;
        if (request._authSessionId !== undefined) assertCurrentAuthSession(request._authSessionId);
        return response;
    },
    async (error) => {
        const originalRequest = error.config as SessionRequestConfig | undefined;
        if (originalRequest?._authSessionId !== undefined) assertCurrentAuthSession(originalRequest._authSessionId);
        const code = error.response?.data?.code;
        if (error.response?.status === 403 && (code === 'PASSWORD_CHANGE_REQUIRED'
            || code === 'DOB_REQUIRED' || code === 'ONBOARDING_REQUIRED')) {
            accountRestrictionHandler?.(code);
            return Promise.reject(error);
        }
        if (!originalRequest || shouldSkipAuthRetry(originalRequest.url)) {
            return Promise.reject(error);
        }

        if (isAndroidApp && error.response?.status === 401) {
            clearStoredAuth(); authFailureHandler?.();
            return Promise.reject(error);
        }
        if (error.response?.status === 401 && !originalRequest._retry && !originalRequest._skipAuthRefresh) {
            const sessionId = originalRequest._authSessionId ?? getAuthSessionId();
            originalRequest._retry = true;

            const newAccessToken = await renewRejectedSession(sessionId, originalRequest._sentAccessToken ?? null);
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return apiClient(originalRequest);
        }

        return Promise.reject(error);
    }
);
