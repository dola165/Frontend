import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../axiosConfig', () => ({
    apiClient: { get }
}));

import { fetchNearbyMap } from '../map';

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
});
