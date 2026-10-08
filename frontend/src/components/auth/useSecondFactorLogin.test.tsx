import { act, renderHook, waitFor } from '@testing-library/react';
import { apiClient } from '../../api/axiosConfig';
import { clearStoredAuth, getStoredAccessToken } from '../../utils/authStorage';
import { useSecondFactorLogin, type PrimaryLoginProof } from './useSecondFactorLogin';

vi.mock('../../api/axiosConfig', () => ({ apiClient: { post: vi.fn() } }));
const proof: PrimaryLoginProof = { kind: 'password', email: 'person@example.test', password: 'SyntheticPassword1' };
const pending = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
};
beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); clearStoredAuth(); });

it.each([proof, { kind: 'google', token: 'synthetic-google-proof' } satisfies PrimaryLoginProof])('keeps primary $kind proof in memory until a second factor succeeds', async credential => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { twoFactorRequired: true } })
        .mockResolvedValueOnce({ data: { accessToken: 'verified-token', mustChangePassword: true } });
    const { result } = renderHook(useSecondFactorLogin);
    let completion!: ReturnType<typeof result.current.authenticate>;
    act(() => { completion = result.current.authenticate(credential); });
    await waitFor(() => expect(result.current.challenge).toBe(true));
    expect(getStoredAccessToken()).toBeNull();
    expect(JSON.stringify(localStorage)).not.toContain('SyntheticPassword');
    expect(JSON.stringify(localStorage)).not.toContain('synthetic-google-proof');
    await act(async () => { await result.current.submit(' 123456 '); });
    await expect(completion).resolves.toEqual({ accessToken: 'verified-token', mustChangePassword: true });
    expect(apiClient.post).toHaveBeenLastCalledWith(credential.kind === 'password' ? '/auth/login' : '/auth/google', {
        ...(credential.kind === 'password' ? { email: credential.email, password: credential.password } : { token: credential.token }), oneTimeCode: '123456',
    }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(result.current.challenge).toBe(false);
});

it('retains the challenge after an invalid code and accepts an unused recovery code', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { twoFactorRequired: true } })
        .mockRejectedValueOnce({ response: { status: 400, data: { code: 'second_factor_invalid' } } })
        .mockResolvedValueOnce({ data: { accessToken: 'verified' } });
    const { result } = renderHook(useSecondFactorLogin);
    let completion!: ReturnType<typeof result.current.authenticate>;
    act(() => { completion = result.current.authenticate(proof); });
    await waitFor(() => expect(result.current.challenge).toBe(true));
    await act(async () => { await result.current.submit('000000'); });
    expect(result.current.error).toContain('unused recovery code');
    expect(result.current.challenge).toBe(true);
    await act(async () => { await result.current.submit('abcdef-123456-abcdef-123456'); });
    await expect(completion).resolves.toEqual({ accessToken: 'verified' });
});

it.each([['second_factor_locked', 'five minutes'], ['second_factor_unavailable', 'temporarily unavailable']])('explains %s while keeping cancellation available', async (code, message) => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { twoFactorRequired: true } })
        .mockRejectedValueOnce({ response: { status: code.endsWith('locked') ? 429 : 503, data: { code } } });
    const { result } = renderHook(useSecondFactorLogin);
    let completion!: ReturnType<typeof result.current.authenticate>;
    act(() => { completion = result.current.authenticate(proof); });
    await waitFor(() => expect(result.current.challenge).toBe(true));
    await act(async () => { await result.current.submit('123456'); });
    expect(result.current.error).toContain(message);
    act(() => result.current.cancel());
    await expect(completion).resolves.toBeNull();
});

it.each(['cancel', 'unmount', 'session'] as const)('retires a pending code response on %s', async action => {
    const late = pending<{ data: { accessToken: string } }>();
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { twoFactorRequired: true } }).mockReturnValueOnce(late.promise);
    const { result, unmount } = renderHook(useSecondFactorLogin);
    let completion!: ReturnType<typeof result.current.authenticate>;
    act(() => { completion = result.current.authenticate(proof); });
    await waitFor(() => expect(result.current.challenge).toBe(true));
    let retry!: Promise<void>;
    act(() => { retry = result.current.submit('123456'); });
    const signal = vi.mocked(apiClient.post).mock.calls[1][2]?.signal;
    act(() => { if (action === 'cancel') result.current.cancel(); else if (action === 'unmount') unmount(); else clearStoredAuth(); });
    expect(signal?.aborted).toBe(true);
    await act(async () => { late.resolve({ data: { accessToken: 'late-token' } }); await retry; });
    await expect(completion).resolves.toBeNull();
    expect(getStoredAccessToken()).toBeNull();
});

it('ignores duplicate primary submits and duplicate code requests while one is pending', async () => {
    const late = pending<{ data: { twoFactorRequired: boolean } }>();
    vi.mocked(apiClient.post).mockReturnValue(late.promise);
    const { result } = renderHook(useSecondFactorLogin);
    let completion!: ReturnType<typeof result.current.authenticate>;
    act(() => { completion = result.current.authenticate(proof); });
    await act(async () => { expect(await result.current.authenticate(proof)).toBeNull(); await result.current.submit('123456'); });
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    act(() => result.current.cancel());
    await expect(completion).resolves.toBeNull();
});

it('rejects a malformed final response rather than returning an undefined token', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    const { result } = renderHook(useSecondFactorLogin);
    await act(async () => { await expect(result.current.authenticate(proof)).rejects.toThrow('did not complete sign-in'); });
});

it('cannot begin a delayed registration auto-login after its page unmounts', async () => {
    const { result, unmount } = renderHook(useSecondFactorLogin);
    const authenticate = result.current.authenticate;
    unmount();
    await expect(authenticate(proof)).resolves.toBeNull();
    expect(apiClient.post).not.toHaveBeenCalled();
});
