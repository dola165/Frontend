import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../axiosConfig', () => ({
    apiClient: { get }
}));

import { fetchNearbyMap, fetchMapDiscovery } from '../map';

describe('fetchNearbyMap', () => {
    beforeEach(() => {
        get.mockReset();
        get.mockResolvedValue({ data: { content: [], page: 0, size: 20, totalElements: 0 } });
    });

    it('serializes each requested player position as a repeated query parameter', async () => {
        await fetchNearbyMap({
            lat: 41.7151,
            lng: 44.8271,
            positions: ['GOALKEEPER', 'CENTER_BACK']
        });

        const url = get.mock.calls[0][0] as string;
        const params = new URL(`http://local${url}`).searchParams;
        expect(params.getAll('positions')).toEqual(['GOALKEEPER', 'CENTER_BACK']);
    });

    it('loads every bounded page, preserves type identity and removes repeated markers', async () => {
        get.mockResolvedValueOnce({ data: { content: [{ entityId: 1, entityType: 'CLUB' }], totalElements: 201, resultsLimited: true } })
            .mockResolvedValueOnce({ data: { content: [{ entityId: 1, entityType: 'MATCH' }], totalElements: 201 } })
            .mockResolvedValueOnce({ data: { content: [{ entityId: 1, entityType: 'MATCH' }, { entityId: 2, entityType: 'CLUB' }], totalElements: 201 } });
        const controller = new AbortController();
        const result = await fetchMapDiscovery({ lat: 41, lng: 44 }, controller.signal);
        expect(result.content).toHaveLength(3);
        expect(result.resultsLimited).toBe(true);
        expect(get.mock.calls.map(([url]) => new URL(`http://local${url}`).searchParams.get('page'))).toEqual(['0', '1', '2']);
        expect(get.mock.calls.every(([, config]) => config.signal === controller.signal)).toBe(true);
    });

    it('rejects a failed later page instead of presenting a partial search as complete', async () => {
        get.mockResolvedValueOnce({ data: { content: [], totalElements: 101 } }).mockRejectedValueOnce(new Error('offline'));
        await expect(fetchMapDiscovery({ lat: 41, lng: 44 })).rejects.toThrow('offline');
    });

    it('stops at the four-type bound even if a server returns an unexpected directory count', async () => {
        get.mockResolvedValue({ data: { content: [], totalElements: 100000 } });
        await fetchMapDiscovery({ lat: 41, lng: 44 });
        expect(get).toHaveBeenCalledTimes(4);
    });
});
