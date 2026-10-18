import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../../api/axiosConfig';
import { jobs } from '../directories/opportunitySources';

vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() } }));
beforeEach(() => { vi.mocked(apiClient.get).mockReset(); });

it('sends job filters and paging to the server and uses its count', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { content: [{ id: 87 }], totalElements: 43, totalPages: 3 } });
    const signal = new AbortController().signal;
    const result = await jobs.load({ q: 'keeper', sort: 'OLDEST', values: { engagement: ['PAID'], clubId: ['69'], posted: ['7D'] } }, 1,
        { signal, sessionId: 'world', authenticated: true });
    expect(result).toEqual({ items: [{ id: 87 }], total: 43, hasMore: true });
    const [url, config] = vi.mocked(apiClient.get).mock.calls[0];
    const parsed = new URL(String(url), 'http://localhost');
    expect(parsed.pathname).toBe('/jobs/listings');
    expect(Object.fromEntries(parsed.searchParams)).toEqual({ page: '1', size: '20', q: 'keeper', engagement: 'PAID', clubId: '69', posted: '7D', sort: 'OLDEST' });
    expect(config?.signal).toBe(signal);
});

it('does not cache stale jobs across searches or turn a failure into an empty directory', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Offline'));
    const request = () => jobs.load({ q: '', sort: '', values: {} }, 0, { signal: new AbortController().signal, sessionId: 'world', authenticated: true });
    await expect(request()).rejects.toThrow('Offline');
    await expect(request()).rejects.toThrow('Offline');
    expect(apiClient.get).toHaveBeenCalledTimes(2);
});
