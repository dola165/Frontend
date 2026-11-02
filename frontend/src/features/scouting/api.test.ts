import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/axiosConfig';
import { scoutingApi } from './api';
vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
beforeEach(() => { vi.clearAllMocks(); localStorage.setItem('gk-session-id', 'scout'); });
afterEach(() => localStorage.clear());
it('binds reads and commands to the initiating auth session', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { items: [] } });
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 11 } });
    const api = scoutingApi(1, 'scout');
    await api.adults(2, 'Player', 0);
    await api.watch(2, 9, null, 'same-key');
    expect(apiClient.get).toHaveBeenCalledWith('/clubs/1/scouting/adults?squad=2&q=Player&page=0', expect.objectContaining({ _authSessionId: 'scout' }));
    expect(apiClient.post).toHaveBeenCalledWith('/clubs/1/scouting', { squadId: 2, personId: 9, applicationId: null, requestId: 'same-key' }, expect.objectContaining({ _authSessionId: 'scout' }));
});
it('refuses a command after account switch and rejects a late prior-account read', async () => {
    const api = scoutingApi(1, 'scout');
    let finish!: (value: unknown) => void;
    vi.mocked(apiClient.get).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const pending = api.get(11);
    localStorage.setItem('gk-session-id', 'other');
    finish({ data: { id: 11 } });
    await expect(pending).rejects.toThrow();
    await expect(api.watch(2, 9, null, 'key')).rejects.toThrow();
    expect(apiClient.post).not.toHaveBeenCalled();
});
