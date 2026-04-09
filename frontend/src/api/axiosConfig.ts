import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { clearStoredAuth, getStoredAccessToken, setStoredAccessToken } from '../utils/authStorage';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
export const API_ORIGIN = API_BASE_URL.replace(/\/api$/, '');

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

export const setAuthFailureHandler = (handler: (() => void) | null) => {
    authFailureHandler = handler;
};

export const ensureCsrfToken = async () => {
    await authUtilityClient.get('/auth/csrf');
};

export const refreshAccessToken = async () => {
    await ensureCsrfToken().catch(() => undefined);
    const refreshResponse = await authUtilityClient.post<{ accessToken?: string }>('/auth/refresh', {});
    const newAccessToken = refreshResponse.data?.accessToken;

    if (!newAccessToken) {
        throw new Error('Refresh response did not include an access token.');
    }

    setStoredAccessToken(newAccessToken);
    return newAccessToken;
};

export const buildWebSocketUrl = (path: string) => {
    const url = new URL(path, `${API_ORIGIN}/`);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return url.toString();
};

apiClient.interceptors.request.use((config) => {
    const token = getStoredAccessToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => Promise.reject(error));

let isRefreshing = false;
type RefreshQueueEntry = {
    resolve: (token: string | null) => void;
    reject: (error: unknown) => void;
};

let failedQueue: RefreshQueueEntry[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

const shouldSkipAuthRetry = (url?: string) => {
    if (!url) {
        return false;
    }

    return url.includes('/auth/login')
        || url.includes('/auth/google')
        || url.includes('/auth/refresh')
        || url.includes('/auth/logout')
        || url.includes('/auth/csrf');
};

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

        if (!originalRequest || shouldSkipAuthRetry(originalRequest.url)) {
            return Promise.reject(error);
        }

        if (error.response?.status === 401 && !originalRequest._retry) {

            if (isRefreshing) {
                return new Promise(function(resolve, reject) {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers = originalRequest.headers ?? {};
                    originalRequest.headers.Authorization = 'Bearer ' + token;
                    return apiClient(originalRequest);
                }).catch(err => {
                    return Promise.reject(err);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const newAccessToken = await refreshAccessToken();
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

                processQueue(null, newAccessToken);

                return apiClient(originalRequest);

            } catch (refreshError) {
                processQueue(refreshError, null);
                clearStoredAuth();
                authFailureHandler?.();
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);
