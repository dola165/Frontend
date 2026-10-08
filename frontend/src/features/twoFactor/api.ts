import { apiClient } from '../../api/axiosConfig';
import { credentialUpdate } from '../../api/credentialUpdates';
import { assertCurrentAuthSession, getAuthSessionId, getStoredAccessToken, setRefreshedAccessToken } from '../../utils/authStorage';

export type TwoFactorStatus = { available: boolean; enabled: boolean; recoveryCodesRemaining: number };
export type TwoFactorSetup = { secret: string; authenticatorUri: string; expiresIn: number };
const base = '/users/me/two-factor';
const subject = (token: string | null) => {
    try {
        const value: unknown = JSON.parse(atob((token?.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/'))).sub;
        return typeof value === 'string' ? value : undefined;
    } catch { return undefined; }
};
const adoptReplacement = (token: string, session: ReturnType<typeof getAuthSessionId>) => {
    const previousSubject = subject(getStoredAccessToken(session));
    if (previousSubject && previousSubject !== subject(token)) throw new Error('The replacement session did not match this account.');
    setRefreshedAccessToken(token, session);
};

export async function fetchTwoFactorStatus(signal: AbortSignal): Promise<TwoFactorStatus> {
    const { data } = await apiClient.get<TwoFactorStatus>(base, { signal });
    if (typeof data?.available !== 'boolean' || typeof data.enabled !== 'boolean' || !Number.isInteger(data.recoveryCodesRemaining)) {
        throw new Error('Authenticator status could not be confirmed.');
    }
    return data;
}
export async function setupTwoFactor(currentPassword: string, signal: AbortSignal): Promise<TwoFactorSetup> {
    const { data } = await apiClient.post<TwoFactorSetup>(`${base}/setup`, { currentPassword }, { signal });
    if (!data?.secret || !data.authenticatorUri?.startsWith('otpauth://totp/') || !(data.expiresIn > 0)) {
        throw new Error('Authenticator setup could not be confirmed.');
    }
    return data;
}
export async function saveTwoFactor(action: 'enable' | 'recovery-codes', currentPassword: string, code: string, signal: AbortSignal) {
    const session = getAuthSessionId();
    const request = (config: { signal: AbortSignal }) => apiClient.post<{ recoveryCodes: string[]; enabled?: boolean; accessToken?: string }>(`${base}/${action}`, { currentPassword, code: code.trim() }, config);
    const adopt = ({ data }: Awaited<ReturnType<typeof request>>) => {
        assertCurrentAuthSession(session);
        if (signal.aborted) throw new DOMException('Request cancelled', 'AbortError');
        if (!Array.isArray(data?.recoveryCodes) || data.recoveryCodes.length !== 10 || data.recoveryCodes.some(value => typeof value !== 'string' || !value.trim()) || new Set(data.recoveryCodes).size !== 10) {
            throw new Error('Recovery codes were not received. Refresh your security settings before trying again.');
        }
        if (action === 'enable') {
            if (data.enabled !== true || !data.accessToken?.trim()) throw new Error('Authenticator enrollment could not be confirmed.');
            adoptReplacement(data.accessToken, session);
        }
        return data.recoveryCodes;
    };
    return action === 'enable' ? credentialUpdate(request, adopt, signal) : adopt(await request({ signal }));
}
export async function disableTwoFactor(currentPassword: string, code: string, signal: AbortSignal) {
    const session = getAuthSessionId();
    return credentialUpdate(config => apiClient.post<{ enabled: boolean; accessToken: string }>(`${base}/disable`, { currentPassword, code: code.trim() }, config), ({ data }) => {
        assertCurrentAuthSession(session);
        if (signal.aborted) throw new DOMException('Request cancelled', 'AbortError');
        if (data?.enabled !== false || !data.accessToken?.trim()) throw new Error('Disabling the authenticator could not be confirmed.');
        adoptReplacement(data.accessToken, session);
    }, signal);
}
