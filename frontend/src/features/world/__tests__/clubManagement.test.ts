import { expect, it, vi } from 'vitest';
import { loadClubExtras } from '../peek/club/clubPane';
const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: api, DEPLOYMENT_URLS: { mediaBaseUrl: '' } }));
it('keeps travel coordinators among the club management after recoding team managers', async () => {
    const travel = { userId: 9, fullName: 'Travel colleague', role: 'CLUB_STAFF', responsibilities: [{ title: 'Travel coordinator', specialisations: ['TRAVEL_COORDINATOR'], squadIds: [], squadNames: [], clubWide: true }] };
    api.get.mockImplementation(async (path: string) => ({ data: path.endsWith('/staff-directory') ? [travel] : path.startsWith('/tryouts') ? { items: [], total: 0 } : [] }));
    const extras = await loadClubExtras(912, 'visitor', false);
    expect(extras.management).toEqual([travel]);
    expect(extras.coaches).toEqual([]);
});
