import { act, renderHook, waitFor } from '@testing-library/react';
import { fetchVenue, type Venue } from './api';
import { useVenueMapTarget, venueMapMarker } from './useVenueMapTarget';
vi.mock('./api', () => ({ fetchVenue: vi.fn() }));
const venue = { id: 123, displayName: 'Isani', published: true, latitude: 41.72, longitude: 44.8,
    city: 'Tbilisi', addressText: 'Isani', verificationStatus: 'UNVERIFIED', pitches: [], currency: 'GEL' } as unknown as Venue;
beforeEach(() => vi.resetAllMocks());
it('loads and selects the authoritative venue even when general discovery has no result for it', async () => {
    vi.mocked(fetchVenue).mockResolvedValue(venue); const selected = vi.fn();
    const { result } = renderHook(() => useVenueMapTarget(123, selected));
    await waitFor(() => expect(result.current.marker?.title).toBe('Isani'));
    expect(selected).toHaveBeenCalledOnce(); expect(selected.mock.calls[0][0].verified).toBe(false);
    expect(fetchVenue).toHaveBeenCalledWith(123, expect.any(AbortSignal));
});
it('ignores an old venue response after the link changes', async () => {
    let resolve!: (value: Venue) => void;
    vi.mocked(fetchVenue).mockImplementation(id => id === 123 ? new Promise(done => { resolve = done; }) : Promise.resolve({ ...venue, id, displayName: 'Second venue' }));
    const selected = vi.fn(); const { result, rerender } = renderHook(({ id }) => useVenueMapTarget(id, selected), { initialProps: { id: 123 } });
    rerender({ id: 124 }); await waitFor(() => expect(result.current.marker?.title).toBe('Second venue'));
    await act(async () => resolve(venue)); expect(selected).toHaveBeenCalledOnce(); expect(result.current.marker?.entityId).toBe(124);
});
it('keeps retry available after an unavailable response', async () => {
    vi.mocked(fetchVenue).mockRejectedValueOnce(new Error('Not found')).mockResolvedValue(venue);
    const selected = vi.fn(); const { result } = renderHook(() => useVenueMapTarget(123, selected));
    await waitFor(() => expect(result.current.error).toContain('could not be opened'));
    act(() => result.current.retry()); await waitFor(() => expect(result.current.marker?.entityId).toBe(123));
    expect(result.current.error).toBe('');
});
it.each([{ published: false }, { promotionBlocked: true }, { latitude: null }, { longitude: Infinity }, { latitude: 91 }])('does not paint a private, restricted or invalid location %j', override => expect(() => venueMapMarker({ ...venue, ...override })).toThrow());
