import { beforeEach, expect, it, vi } from 'vitest';
import { fetchClubLocationOptions } from './api';
import { apiClient } from '../../api/axiosConfig';

vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() } }));
beforeEach(() => { vi.mocked(apiClient.get).mockReset(); });

it('loads every location page without requesting oversized full club profiles', async () => {
    vi.mocked(apiClient.get)
        .mockResolvedValueOnce({ data: { content: [{ clubId: 1, clubName: 'First', cityName: 'Tbilisi' }], totalPages: 2 } })
        .mockResolvedValueOnce({ data: { content: [{ clubId: 101, clubName: 'Later', cityName: null }], totalPages: 2 } });
    const options = await fetchClubLocationOptions();
    expect(options.map(club => club.clubId)).toEqual([1, 101]);
    expect(options[1].cityName).toBeNull();
    expect(apiClient.get).toHaveBeenNthCalledWith(1, '/clubs/locations', { params: { page: 0, size: 100 } });
    expect(apiClient.get).toHaveBeenNthCalledWith(2, '/clubs/locations', { params: { page: 1, size: 100 } });
});

it('reports a failed later page instead of returning incomplete filter choices', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { content: [], totalPages: 2 } }).mockRejectedValueOnce(new Error('Offline'));
    await expect(fetchClubLocationOptions()).rejects.toThrow('Offline');
});
