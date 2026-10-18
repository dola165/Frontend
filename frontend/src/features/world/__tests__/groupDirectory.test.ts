import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../../api/axiosConfig';
import { groupsSource } from '../directories/opportunitySources';
import type { Opportunity, OpportunityPage, Participant } from '../../admissions/types';
import opportunitiesJson from '../../admissions/applicant/__fixtures__/opportunities.json?raw';

vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() } }));
beforeEach(() => { vi.mocked(apiClient.get).mockReset(); });
const context = () => ({ signal: new AbortController().signal, sessionId: 'world', authenticated: true });
const fixture = (JSON.parse(opportunitiesJson) as OpportunityPage).items[0];
const group: Opportunity = { ...fixture, id: 71, name: 'Saved training group', organizationName: 'Club', availability: 'CLOSED', location: { ...fixture.location, name: 'Training venue', latitude: 41.7, longitude: 44.8 } };

it('opens the exact saved group and venue even when closed or beyond the first discovery page', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: group });
    const source = groupsSource([]);
    const result = await source.load({ q: '', sort: '', values: { group: ['71'] } }, 0, context());
    expect(apiClient.get).toHaveBeenCalledWith('/admissions/opportunities/71', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(result).toEqual({ items: [{ group, player: undefined }], total: 1, hasMore: false });
    const point = source.place?.(result.items[0], {} as never);
    expect(point).toMatchObject({ lat: 41.7, lng: 44.8, label: group.name });
});

it('carries only a currently authorized child to the group and its map destination', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: group });
    const child = { id: 88, name: 'Synthetic child', minor: true } as Participant;
    const source = groupsSource([child]);
    const load = (player: string) => source.load({ q: '', sort: '', values: { group: ['71'], player: [player] } }, 0, context());
    const own = await load('88');
    expect(own.items[0].player).toBe(88);
    expect(source.place?.(own.items[0], {} as never)).toMatchObject({ to: '/admissions/opportunities/71?player=88' });
    expect((await load('999')).items[0].player).toBeUndefined();
});

it('preserves a public group failure instead of substituting a different club location', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Not available'));
    await expect(groupsSource([]).load({ q: '', sort: '', values: { group: ['71'] } }, 0, context())).rejects.toThrow('Not available');
});
