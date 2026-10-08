import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/axiosConfig';
import { actOnClubApproach, fetchClubApproach, fetchClubApproaches, postClubApproachMessage } from './clubApproachesApi';

vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), patch: vi.fn(), post: vi.fn() } }));

describe('club approaches API', () => {
    beforeEach(() => vi.clearAllMocks());

    it('uses the bounded list query and supports a direct focused-record fetch', async () => {
        const page = { items: [], total: 0, page: 0, size: 20 };
        vi.mocked(apiClient.get).mockResolvedValueOnce({ data: page }).mockResolvedValueOnce({ data: { id: 31 } });
        await expect(fetchClubApproaches({ clubId: 9, view: 'OPEN', page: 0, size: 20 })).resolves.toEqual(page);
        await expect(fetchClubApproach(31)).resolves.toEqual({ id: 31 });
        expect(apiClient.get).toHaveBeenNthCalledWith(1, '/club-approaches', { params: { clubId: 9, view: 'OPEN', page: 0, size: 20 } });
        expect(apiClient.get).toHaveBeenNthCalledWith(2, '/club-approaches/31', undefined);
    });

    it('sends the optimistic version, an optional decision note, and discussion body', async () => {
        vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: { id: 31, version: 4 } });
        vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { id: 1, body: 'Available next week' } });
        await actOnClubApproach(31, { action: 'DECLINE', version: 3, note: 'Not a fit' });
        await postClubApproachMessage(31, 'Available next week');
        expect(apiClient.patch).toHaveBeenCalledWith('/club-approaches/31', { action: 'DECLINE', version: 3, note: 'Not a fit' }, undefined);
        expect(apiClient.post).toHaveBeenCalledWith('/club-approaches/31/messages', { body: 'Available next week' }, undefined);
    });
});
