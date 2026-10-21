import { apiClient } from '../../api/axiosConfig';
import { fetchVenue, fetchVenues, normalizeVenueCapabilities, savePitch, saveVenue, type Pitch, type Venue, type VenueDraft } from './api';
vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), put: vi.fn() } }));
const legacy = (canManage: boolean) => ({ id: 133, revision: 8, canManage, displayName: 'Stadium' }) as Venue;
beforeEach(() => vi.clearAllMocks());
it('preserves legacy manager editing without exposing newer organization workflows', () => {
  const original = legacy(true), result = normalizeVenueCapabilities(original);
  expect(result.capabilities).toEqual({ enabledActivities: ['PROFILE', 'VENUE'], revision: 0, venueAvailable: true, canEditProfile: true, canConfigureVenue: true, canManageVenueBookings: true, canConfigureActivities: false, canCreateTournament: false, canInviteVenueOperator: false });
  expect(original).not.toHaveProperty('capabilities');
  expect(result.revision).toBe(8);
});
it('keeps legacy public booking available but never grants management to a visitor', () => {
  expect(normalizeVenueCapabilities(legacy(false)).capabilities).toMatchObject({ enabledActivities: ['PROFILE', 'VENUE'], venueAvailable: true, canEditProfile: false, canConfigureVenue: false, canManageVenueBookings: false });
});
it('preserves explicit modern denials and paused activities exactly', () => {
  const venue = { ...legacy(true), capabilities: { ...normalizeVenueCapabilities(legacy(false)).capabilities!, enabledActivities: ['PROFILE'] as const } } as unknown as Venue;
  expect(normalizeVenueCapabilities(venue)).toBe(venue);
  expect(normalizeVenueCapabilities({ ...legacy(true), capabilities: undefined })).toHaveProperty('capabilities', undefined);
});
it('normalizes detail, paged listing, listing-save and pitch-save responses', async () => {
  vi.mocked(apiClient.get).mockResolvedValueOnce({ data: legacy(true) }).mockResolvedValueOnce({ data: { content: [legacy(true), legacy(false)], totalElements: 2, totalPages: 1 } });
  vi.mocked(apiClient.put).mockResolvedValue({ data: legacy(true) });
  expect((await fetchVenue(133)).capabilities?.canConfigureVenue).toBe(true);
  const page = await fetchVenues({ page: 0 });
  expect(page.totalElements).toBe(2);
  expect(page.content.map(v => v.capabilities?.canConfigureVenue)).toEqual([true, false]);
  expect((await saveVenue(133, {} as VenueDraft)).capabilities?.canConfigureVenue).toBe(true);
  expect((await savePitch(133, {} as Pitch)).capabilities?.canConfigureVenue).toBe(true);
});
