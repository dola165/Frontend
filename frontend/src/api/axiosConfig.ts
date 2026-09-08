import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { clearStoredAuth, getStoredAccessToken, setStoredAccessToken } from '../utils/authStorage';
import { buildWebSocketUrlFromBase, resolveDeploymentUrls } from './deploymentUrls';

const browserOrigin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
export const DEPLOYMENT_URLS = resolveDeploymentUrls(import.meta.env.VITE_API_BASE_URL, browserOrigin);
export const API_BASE_URL = DEPLOYMENT_URLS.apiBaseUrl;

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
});

const authUtilityClient = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
});

let authFailureHandler: (() => void) | null = null;
export type AccountRestriction = 'PASSWORD_CHANGE_REQUIRED' | 'DOB_REQUIRED' | 'ONBOARDING_REQUIRED';
let accountRestrictionHandler: ((code: AccountRestriction) => void) | null = null;
export const setAccountRestrictionHandler = (handler: typeof accountRestrictionHandler) => {
    accountRestrictionHandler = handler;
};

export const setAuthFailureHandler = (handler: (() => void) | null) => {
    authFailureHandler = handler;
};

export const ensureCsrfToken = async () => {
    await authUtilityClient.get('/auth/csrf');
};

const requestFreshAccessToken = async () => {
    await ensureCsrfToken().catch(() => undefined);
    for (let attempt = 0; ; attempt++) {
        try {
            const response = await authUtilityClient.post<{ accessToken?: string }>('/auth/refresh', {});
            const token = response.data?.accessToken;
            if (!token) {
                throw new Error('Refresh response did not include an access token.');
            }
            setStoredAccessToken(token);
            return token;
        } catch (error) {
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

let refreshPromise: Promise<string> | null = null;

export const refreshAccessToken = (): Promise<string> => {
    if (refreshPromise) return refreshPromise;

    const previousToken = getStoredAccessToken();
    const refresh = async () => {
        const currentToken = getStoredAccessToken();
        // Another tab completed refresh while we waited for the origin-wide lock.
        if (currentToken && currentToken !== previousToken) return currentToken;
        return requestFreshAccessToken();
    };
    const task = (async () => {
        if (typeof navigator !== 'undefined' && navigator.locks) {
            return await navigator.locks.request('grasskickz-session-refresh', refresh);
        }
        return refresh();
    })();
    refreshPromise = task.finally(() => { refreshPromise = null; });
    return refreshPromise;
};

export const buildWebSocketUrl = (path: string) => {
    return buildWebSocketUrlFromBase(DEPLOYMENT_URLS.serviceBaseUrl, path);
};

apiClient.interceptors.request.use((config) => {
    const token = getStoredAccessToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => Promise.reject(error));

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
    (response) => response,
    async (error) => {
        const code = error.response?.data?.code;
        if (error.response?.status === 403 && (code === 'PASSWORD_CHANGE_REQUIRED'
            || code === 'DOB_REQUIRED' || code === 'ONBOARDING_REQUIRED')) {
            accountRestrictionHandler?.(code);
            return Promise.reject(error);
        }
        const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

        if (!originalRequest || shouldSkipAuthRetry(originalRequest.url)) {
            return Promise.reject(error);
        }

        if (error.response?.status === 401 && !originalRequest._retry) {

            originalRequest._retry = true;

            try {
                const newAccessToken = await refreshAccessToken();
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

                return apiClient(originalRequest);

            } catch (refreshError) {
                if (axios.isAxiosError(refreshError) && refreshError.response?.status === 401) {
                    clearStoredAuth();
                    authFailureHandler?.();
                }
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);
