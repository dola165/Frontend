import axios, { type AxiosRequestConfig } from 'axios';
import { isAndroidApp } from '../android/bridge';
import { assertCurrentAuthSession, getAuthSessionId, getStoredAccessToken, isCurrentAuthSession, subscribeAuthSession } from '../utils/authStorage';
import { renewRejectedSession } from './axiosConfig';
import { withSessionCredentialLock } from './sessionCredentialLock';

export type CredentialUpdateConfig = AxiosRequestConfig & { _skipAuthRefresh: boolean; signal: AbortSignal };

/** Validate and adopt the response before releasing refresh, while retrying a 401 outside the lock. */
export async function credentialUpdate<T, R>(request: (config: CredentialUpdateConfig) => Promise<T>, adopt: (response: T) => R, signal?: AbortSignal): Promise<R> {
    const session = getAuthSessionId();
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) controller.abort();
    const unsubscribe = subscribeAuthSession(() => { if (!isCurrentAuthSession(session)) controller.abort(); });
    const current = () => {
        assertCurrentAuthSession(session);
        if (controller.signal.aborted) throw new axios.CanceledError();
    };
    let rejectedToken: string | null = null;
    const execute = async () => {
        current();
        rejectedToken = getStoredAccessToken(session);
        const response = await request({ signal: controller.signal, _skipAuthRefresh: !isAndroidApp });
        current();
        return adopt(response);
    };
    try {
        for (let attempt = 0; ; attempt++) {
            try { return await (isAndroidApp ? execute() : withSessionCredentialLock(controller.signal, execute)); }
            catch (error) {
                current();
                if (isAndroidApp || attempt > 0 || !axios.isAxiosError(error) || error.response?.status !== 401) throw error;
                await renewRejectedSession(session, rejectedToken);
                current();
            }
        }
    } finally {
        signal?.removeEventListener('abort', abort);
        unsubscribe();
    }
}
