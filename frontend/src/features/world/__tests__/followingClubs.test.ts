import { apiClient } from '../../../api/axiosConfig';
import { clubsSource } from '../directories/clubSources';
import type { LoadContext } from '../directory/types';

vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() } }));
it('uses the followed collection across areas and supports search and paging', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [{ id: 1, name: 'Synthetic academy', cityName: 'Tbilisi' }, { id: 2, name: 'Another club', cityName: 'Batumi' }] });
    const source = clubsSource({ following: true });
    const result = await source.load({ q: 'academy', sort: 'NAME', values: {} }, 0, { signal: new AbortController().signal, area: { city: 'Batumi' } } as LoadContext);
    expect(apiClient.get).toHaveBeenCalledWith('/clubs/followed', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(result.items.map(club => club.id)).toEqual([1]);
    expect(result.items[0].isFollowedByMe).toBe(true);
    expect(result.total).toBe(1);
    expect(source.area).toBe(false);
    expect(source.signInReason).toBeTruthy();
    expect(source.filters).toEqual([]);
});
