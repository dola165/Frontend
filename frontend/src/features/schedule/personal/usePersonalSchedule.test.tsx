import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fetchMyClubMembershipContext } from '../../clubs/api';
import { spaces } from '../../squadCommunication/api';
import { fetchMySchedule } from '../api';
import { setStoredAccessToken, setStoredUserId } from '../../../utils/authStorage';
import { usePersonalSchedule } from './usePersonalSchedule';

vi.mock('../../clubs/api', () => ({ fetchMyClubMembershipContext: vi.fn() }));
vi.mock('../../squadCommunication/api', () => ({ spaces: vi.fn() }));
vi.mock('../api', () => ({ fetchMySchedule: vi.fn(), fetchClubSchedule: vi.fn().mockResolvedValue([]) }));
vi.mock('../../squadCommunication/useSquadSchedule', () => ({ useSquadSchedule: () => ({ events: [], loading: false, error: '' }) }));
vi.mock('../../mapPlanning/journeyScheduleData', () => ({ useJourneyEntries: () => ({ entries: [], error: '' }), mergeJourneyEntries: (events: unknown[]) => events }));

type Context = Awaited<ReturnType<typeof fetchMyClubMembershipContext>>;
const membership = (name: string) => ({ clubId: null, clubName: name } as unknown as Context);
const from = new Date('2030-11-01T00:00:00Z'), to = new Date('2030-12-01T00:00:00Z');
beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear(); setStoredUserId(20); setStoredAccessToken('synthetic-a');
    vi.mocked(spaces).mockResolvedValue([]); vi.mocked(fetchMySchedule).mockResolvedValue([]);
});
afterEach(cleanup);

it('surfaces unread membership and retries all calendar sources', async () => {
    vi.mocked(fetchMyClubMembershipContext).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(membership('Current'));
    const { result } = renderHook(() => usePersonalSchedule(from, to));
    await waitFor(() => expect(result.current.error).toBe('Your club membership could not load.'));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.context?.clubName).toBe('Current'));
    await waitFor(() => expect(result.current.error).toBe(''));
    expect(fetchMyClubMembershipContext).toHaveBeenCalledTimes(2);
    expect(spaces).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetchMySchedule).mock.calls.length).toBeGreaterThan(1);
});

it('hides the previous account and ignores its late membership read', async () => {
    let resolve!: (value: Context) => void;
    vi.mocked(fetchMyClubMembershipContext).mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValueOnce(membership('New account'));
    const { result } = renderHook(() => usePersonalSchedule(from, to));
    act(() => { setStoredUserId(21); setStoredAccessToken('synthetic-b'); });
    expect(result.current.context).toBeNull();
    await waitFor(() => expect(result.current.context?.clubName).toBe('New account'));
    await act(async () => resolve(membership('Previous account')));
    expect(result.current.context?.clubName).toBe('New account');
});
