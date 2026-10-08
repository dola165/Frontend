import { apiClient } from '../../api/axiosConfig';
import { nativeCall, nativeSession } from '../../android/bridge';
import { clearStoredAuth, getAuthSessionId, getStoredAccessToken, setStoredAccessToken } from '../../utils/authStorage';
import { fetchProviderSettings, linkGoogleProvider, providerError, unlinkGoogleProvider } from './api';

const mode = vi.hoisted(() => ({ native: false }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../android/bridge', () => ({ get isAndroidApp() { return mode.native; }, nativeCall: vi.fn(), nativeSession: vi.fn(), decodeBody: (value: string) => Uint8Array.from(atob(value), character => character.charCodeAt(0)) }));
const jwt = (subject = '7') => `header.${btoa(JSON.stringify({ sub: subject }))}.signature`;
const linkedAccounts = [{ provider: 'google', linkedAt: '2026-09-13T00:00:00Z' }];
const status = { googleAvailable: true, passwordLoginEnabled: true, twoFactorEnabled: false, linkedAccounts: [], googleUnlinkAllowed: false, googleUnlinkBlockedReason: null };
const signal = () => new AbortController().signal;
beforeEach(() => { vi.resetAllMocks(); mode.native = false; clearStoredAuth(); setStoredAccessToken(jwt()); });
afterEach(() => clearStoredAuth());

it('accepts real provider status and rejects incomplete or contradictory capability data', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: status });
    expect(await fetchProviderSettings(signal())).toEqual(status);
    for (const data of [{ ...status, twoFactorEnabled: undefined }, { ...status, googleUnlinkAllowed: true }, { ...status, linkedAccounts: [{ provider: 7 }] }]) {
        vi.mocked(apiClient.get).mockResolvedValueOnce({ data });
        await expect(fetchProviderSettings(signal())).rejects.toThrow('could not be confirmed');
    }
});
it('submits explicit web Google proof and adopts only the same account in the same session', async () => {
    const session = getAuthSessionId();
    vi.mocked(apiClient.post).mockResolvedValue({ data: { provider: 'google', linked: true, accessToken: jwt(), linkedAccounts } });
    await expect(linkGoogleProvider(7, { currentPassword: 'password', oneTimeCode: '123456' }, 'google-proof', signal())).resolves.toEqual(linkedAccounts);
    expect(apiClient.post).toHaveBeenCalledWith('/users/me/providers/google/link', { googleIdToken: 'google-proof', currentPassword: 'password', oneTimeCode: '123456' }, expect.anything());
    expect(getAuthSessionId()).toBe(session); expect(getStoredAccessToken()).toBe(jwt());
    vi.mocked(apiClient.post).mockResolvedValue({ data: { provider: 'google', linked: false, accessToken: jwt('8'), linkedAccounts: [] } });
    await expect(unlinkGoogleProvider(7, { currentPassword: 'password' }, signal())).rejects.toThrow('did not match');
    expect(getStoredAccessToken()).toBe(jwt());
});
it('rejects malformed success and an aborted response without changing credentials', async () => {
    setStoredAccessToken('original-token');
    vi.mocked(apiClient.post).mockResolvedValue({ data: { provider: 'google', linked: true, accessToken: jwt(), linkedAccounts: [] } });
    await expect(linkGoogleProvider(7, {}, 'google-proof', signal())).rejects.toThrow('could not be confirmed');
    const controller = new AbortController();
    vi.mocked(apiClient.post).mockImplementation(async () => {
        controller.abort();
        return { data: { provider: 'google', linked: true, accessToken: jwt(), linkedAccounts } };
    });
    await expect(linkGoogleProvider(7, {}, 'google-proof', controller.signal)).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    expect(getStoredAccessToken()).toBe('original-token');
});
it('rejects a response belonging to a retired login', async () => {
    vi.mocked(apiClient.post).mockImplementation(async () => {
        setStoredAccessToken('replacement-account');
        return { data: { provider: 'google', linked: false, accessToken: jwt(), linkedAccounts: [] } };
    });
    await expect(unlinkGoogleProvider(7, { currentPassword: 'password' }, signal())).rejects.toMatchObject({ code: 'AUTH_SESSION_CHANGED' });
    expect(getStoredAccessToken()).toBe('replacement-account');
});
it('asks native to choose and link Google without receiving a Google or native bearer token in JavaScript', async () => {
    mode.native = true; setStoredAccessToken('native-session');
    const session = getAuthSessionId(); const controller = new AbortController();
    vi.mocked(nativeSession).mockResolvedValue({ active: true, session: 'native-generation-7' });
    vi.mocked(nativeCall).mockResolvedValue({ id: 'reply', status: 200, body: btoa(JSON.stringify({ provider: 'google', linked: true, accessToken: 'native-session', linkedAccounts })) });
    expect(await linkGoogleProvider(7, { currentPassword: 'password', oneTimeCode: 'backup-code' }, undefined, controller.signal)).toEqual(linkedAccounts);
    expect(nativeCall).toHaveBeenCalledWith({ kind: 'googleProviderLink', session: 'native-generation-7', currentPassword: 'password', oneTimeCode: 'backup-code' }, controller.signal);
    expect(apiClient.post).not.toHaveBeenCalled(); expect(getAuthSessionId()).toBe(session);
    expect(getStoredAccessToken()).toBe('native-session');
});
it('does not launch the native picker after account replacement or cancellation during session lookup', async () => {
    mode.native = true;
    vi.mocked(nativeSession).mockImplementation(async () => { setStoredAccessToken('replacement'); return { active: true, session: 'new-native-session' }; });
    await expect(linkGoogleProvider(7, {}, undefined, signal())).rejects.toMatchObject({ code: 'AUTH_SESSION_CHANGED' });
    expect(nativeCall).not.toHaveBeenCalled();
    const controller = new AbortController();
    vi.mocked(nativeSession).mockImplementation(async () => { controller.abort(); return { active: true, session: 'new-native-session' }; });
    await expect(linkGoogleProvider(7, {}, undefined, controller.signal)).rejects.toThrow('cancelled');
    expect(nativeCall).not.toHaveBeenCalled();
});
it('preserves native cancellation and unavailable errors without installing credentials', async () => {
    mode.native = true; setStoredAccessToken('native-session');
    vi.mocked(nativeSession).mockResolvedValue({ active: true, session: '7' });
    for (const [code, statusCode] of [['GOOGLE_PROVIDER_CANCELLED', 499], ['GOOGLE_PROVIDER_UNAVAILABLE', 503]] as const) {
        vi.mocked(nativeCall).mockResolvedValue({ id: 'reply', status: statusCode, body: btoa(JSON.stringify({ code })) });
        const error = await linkGoogleProvider(7, {}, undefined, signal()).catch(error => error);
        expect(error.response).toMatchObject({ status: statusCode, data: { code } });
        expect(providerError(error, 'Fallback')).not.toBe('Fallback');
    }
    expect(getStoredAccessToken()).toBe('native-session');
});
