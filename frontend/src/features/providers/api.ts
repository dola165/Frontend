import { apiClient } from '../../api/axiosConfig';
import { credentialUpdate } from '../../api/credentialUpdates';
import { decodeBody, isAndroidApp, nativeCall, nativeSession } from '../../android/bridge';
import { assertCurrentAuthSession, getAuthSessionId, setRefreshedAccessToken } from '../../utils/authStorage';
import { extractApiErrorCode, extractApiErrorMessage } from '../../utils/apiError';

export type LinkedProvider = { provider: string; linkedAt?: string | null };
export type ProviderSettings = {
    googleAvailable: boolean;
    passwordLoginEnabled: boolean;
    twoFactorEnabled: boolean;
    linkedAccounts: LinkedProvider[];
    googleUnlinkAllowed: boolean;
    googleUnlinkBlockedReason: 'last_login_method' | null;
};
export type ProviderProof = { currentPassword?: string; oneTimeCode?: string };
type ProviderResult = { provider: 'google'; linked: boolean; accessToken: string; linkedAccounts: LinkedProvider[] };
const base = '/users/me/providers';
const validLinks = (value: unknown): value is LinkedProvider[] => Array.isArray(value) && value.every(link =>
    link && typeof link.provider === 'string' && link.provider.trim() && (link.linkedAt == null || typeof link.linkedAt === 'string'));
const current = (session: ReturnType<typeof getAuthSessionId>, signal: AbortSignal) => {
    assertCurrentAuthSession(session);
    if (signal.aborted) throw new DOMException('Request cancelled', 'AbortError');
};
export const googleLinked = (links: LinkedProvider[]) => links.some(link => link.provider === 'google');

export async function fetchProviderSettings(signal: AbortSignal): Promise<ProviderSettings> {
    const session = getAuthSessionId();
    const { data } = await apiClient.get<ProviderSettings>(base, { signal });
    current(session, signal);
    if (typeof data?.googleAvailable !== 'boolean' || typeof data.passwordLoginEnabled !== 'boolean'
        || typeof data.twoFactorEnabled !== 'boolean' || typeof data.googleUnlinkAllowed !== 'boolean'
        || !validLinks(data.linkedAccounts) || ![null, 'last_login_method'].includes(data.googleUnlinkBlockedReason)
        || (data.googleUnlinkAllowed && (!data.passwordLoginEnabled || !googleLinked(data.linkedAccounts)))) {
        throw new Error('Provider settings could not be confirmed.');
    }
    return data;
}

function adoptProviderResult(data: ProviderResult, linked: boolean, accountId: number, session: ReturnType<typeof getAuthSessionId>, signal: AbortSignal) {
    current(session, signal);
    if (data?.provider !== 'google' || data.linked !== linked || typeof data.accessToken !== 'string' || !data.accessToken.trim()
        || !validLinks(data.linkedAccounts) || googleLinked(data.linkedAccounts) !== linked) {
        throw new Error('The provider change could not be confirmed. Refresh provider settings before trying again.');
    }
    if (isAndroidApp) {
        if (data.accessToken !== 'native-session') throw new Error('The app did not confirm the replacement session.');
    } else {
        let subject: unknown;
        try { subject = JSON.parse(atob(data.accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub; }
        catch { throw new Error('The replacement session could not be verified.'); }
        if (subject !== String(accountId)) throw new Error('The replacement session did not match this account.');
    }
    setRefreshedAccessToken(data.accessToken, session);
    return data.linkedAccounts;
}

export async function linkGoogleProvider(accountId: number, proof: ProviderProof, googleIdToken: string | undefined, signal: AbortSignal) {
    const session = getAuthSessionId();
    let data: ProviderResult;
    if (isAndroidApp) {
        const native = await nativeSession();
        current(session, signal);
        if (!native.active) throw new Error('Sign in again before linking Google.');
        const reply = await nativeCall({ kind: 'googleProviderLink', session: native.session, ...proof }, signal);
        current(session, signal);
        const body = JSON.parse(new TextDecoder().decode(decodeBody(reply.body ?? '')));
        if ((reply.status ?? 500) < 200 || (reply.status ?? 500) >= 300) {
            throw Object.assign(new Error('Google linking was not completed.'), { response: { status: reply.status, data: body } });
        }
        data = body;
    } else {
        if (!googleIdToken?.trim()) throw new Error('Choose your Google account to continue.');
        return credentialUpdate(config => apiClient.post<ProviderResult>(`${base}/google/link`, { ...proof, googleIdToken }, config),
            response => adoptProviderResult(response.data, true, accountId, session, signal), signal);
    }
    return adoptProviderResult(data, true, accountId, session, signal);
}

export async function unlinkGoogleProvider(accountId: number, proof: ProviderProof, signal: AbortSignal) {
    const session = getAuthSessionId();
    return credentialUpdate(config => apiClient.post<ProviderResult>(`${base}/google/unlink`, proof, config),
        response => adoptProviderResult(response.data, false, accountId, session, signal), signal);
}

export function providerError(error: unknown, fallback: string) {
    switch (extractApiErrorCode(error)) {
        case 'last_login_method': return 'Set a password before unlinking Google so you can still sign in.';
        case 'provider_already_linked': return 'A Google account is already linked. Refresh provider settings before making another change.';
        case 'provider_identity_in_use': return 'This Google account is linked to another GrassKickZ account. Choose a different Google account.';
        case 'google_provider_unavailable':
        case 'GOOGLE_PROVIDER_UNAVAILABLE': return 'Google linking is unavailable right now. Check your connection and Google services, then try again.';
        case 'google_proof_invalid':
        case 'google_proof_expired': return 'Google confirmation was invalid or expired. Choose your Google account again.';
        case 'google_proof_required': return 'Choose your Google account to verify it before linking.';
        case 'current_password_required': return 'Enter your current account password to continue.';
        case 'current_password_invalid': return 'Your current password was not accepted. Check it and try again.';
        case 'second_factor_required': return 'Enter an authenticator code or an unused recovery code. Refresh provider settings if the code field is missing.';
        case 'second_factor_invalid': return 'Use a new authenticator code or an unused recovery code.';
        case 'second_factor_locked': return 'Too many incorrect attempts. Wait five minutes before trying again.';
        case 'second_factor_unavailable': return 'Authenticator verification is unavailable. Use an unused recovery code or try again later.';
        case 'GOOGLE_PROVIDER_CANCELLED': return 'Google linking was cancelled. Your linked accounts were not changed.';
        case 'GOOGLE_PROVIDER_BUSY': return 'A Google account selection is already open. Complete or cancel it before trying again.';
        case 'GOOGLE_PROVIDER_INVALID_CONTEXT': return 'This account screen is no longer current. Reopen Account settings before trying again.';
        default: return extractApiErrorMessage(error, fallback);
    }
}
