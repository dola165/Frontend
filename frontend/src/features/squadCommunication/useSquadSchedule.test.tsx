import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useSquadSchedule } from './useSquadSchedule';
import { sessions, type SquadSession } from './api';
import { fetchClubSchedule, type ScheduleEventOccurrence } from '../schedule/api';
import { apiClient } from '../../api/axiosConfig';

vi.mock('./api', () => ({ sessions: vi.fn() }));
vi.mock('../schedule/api', () => ({ fetchClubSchedule: vi.fn() }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() } }));
const squads = [{ id: 11, club_id: 1, name: 'U12' }];
const session = { id: 1, title: 'Squad training', starts_at: '2026-09-18T13:00:00Z', ends_at: '2026-09-18T14:00:00Z', status: 'SCHEDULED', attendance: [] } as unknown as SquadSession;
const event = (id: number, host: number | null, guest: number | null = null) => ({ eventId: id, occurrenceId: `event:${id}`, title: `Event ${id}`, challengerSquadId: host, targetSquadId: guest, clubId: 1,
    eventType: 'MATCH', status: 'SCHEDULED', startsAt: '2026-09-18T16:00:00', endsAt: '2026-09-18T18:00:00', visibility: 'PRIVATE', conflictingEventIds: [],
    clubName: 'Academy', userId: null, description: null, locationName: null, locationLat: null, locationLng: null, publishAt: null, publicNow: false,
    recurring: false, recurrence: null, opponentClubId: null, opponentClubName: null, challengeStatus: null, conflict: false }) as ScheduleEventOccurrence;
beforeEach(() => { vi.resetAllMocks(); vi.mocked(sessions).mockResolvedValue([session]); vi.mocked(fetchClubSchedule).mockResolvedValue([]); vi.mocked(apiClient.get).mockResolvedValue({ data: [] }); });

it('delivers private arranged matches from the authorized squad feed once even when legacy feeds overlap', async () => {
    const fixture = { ...event(82, 11), occurrenceId: 'match:82', origin: 'MATCH_EXCHANGE', originId: 82 };
    vi.mocked(apiClient.get).mockResolvedValue({ data: [fixture] });
    vi.mocked(fetchClubSchedule).mockResolvedValue([event(82, 11)]);
    const { result } = renderHook(() => useSquadSchedule(squads, '2026-09-14', '2026-09-21'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events.filter(e => e.eventId === 82)).toEqual([expect.objectContaining({ id: 'match:82', origin: 'MATCH_EXCHANGE', originId: 82 })]);
});

it('keeps training visible with a warning when the connected fixture source is unavailable', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Temporarily unavailable'));
    const { result } = renderHook(() => useSquadSchedule(squads, '2026-09-14', '2026-09-21'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events.map(e => e.id)).toEqual(['squad:11:1']);
    expect(result.current.error).toMatch(/could not load/);
});

it('shows authorized training without a retry warning when separate match membership is absent', async () => {
    vi.mocked(apiClient.get).mockRejectedValue({ response: { status: 404 } });
    const { result } = renderHook(() => useSquadSchedule(squads, '2026-09-14', '2026-09-21'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events.map(e => e.id)).toEqual(['squad:11:1']);
    expect(result.current.error).toBe('');
});

it('keeps an accessible match feed when the separate club feed denies access', async () => {
    vi.mocked(fetchClubSchedule).mockRejectedValue({ response: { status: 403 } });
    vi.mocked(apiClient.get).mockResolvedValue({ data: [event(82, 11)] });
    const { result } = renderHook(() => useSquadSchedule(squads, '2026-09-14', '2026-09-21'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events.map(e => e.id)).toEqual(['squad:11:1', 'event:82']);
    expect(result.current.error).toBe('');
});

it('retains the retry warning for an actual optional feed server failure', async () => {
    vi.mocked(apiClient.get).mockRejectedValue({ response: { status: 500 } });
    const { result } = renderHook(() => useSquadSchedule(squads, '2026-09-14', '2026-09-21'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events.map(e => e.id)).toEqual(['squad:11:1']);
    expect(result.current.error).toMatch(/could not load/);
});

it('includes hosted and invited squad events, excluding other squads and unassigned academy events', async () => {
    vi.mocked(fetchClubSchedule).mockResolvedValue([event(1, 11), event(2, 88, 11), event(3, 12), event(4, null)]);
    const { result } = renderHook(() => useSquadSchedule(squads, '2026-09-14', '2026-09-21'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events.map(e => e.id)).toEqual(['squad:11:1', 'event:1', 'event:2']);
});

it('keeps authorized sessions available when the separate club event feed fails, with a visible warning', async () => {
    vi.mocked(fetchClubSchedule).mockRejectedValue(new Error('Offline'));
    const { result } = renderHook(() => useSquadSchedule(squads, '2026-09-14', '2026-09-21'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events.map(e => e.id)).toEqual(['squad:11:1']);
    expect(result.current.error).toMatch(/could not load/);
});

it('immediately clears the previous squad while a new squad is loading or access is rejected', async () => {
    const { result, rerender } = renderHook(({ id }) => useSquadSchedule([{ ...squads[0], id }], '2026-09-14', '2026-09-21'), { initialProps: { id: 11 } });
    await waitFor(() => expect(result.current.events).toHaveLength(1));
    vi.mocked(sessions).mockRejectedValue(new Error('Access revoked'));
    rerender({ id: 12 });
    expect(result.current.events).toEqual([]);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events).toEqual([]);
    expect(result.current.error).not.toBe('');
});

it('carries Exchange origin and canonical event identity into the squad calendar', async () => {
    vi.mocked(fetchClubSchedule).mockResolvedValue([{ ...event(82, 11), origin: 'MATCH_EXCHANGE', originId: 82 }]);
    const { result } = renderHook(() => useSquadSchedule(squads, '2026-09-14', '2026-09-21'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events.find(e => e.eventId === 82)).toMatchObject({ origin: 'MATCH_EXCHANGE', originId: 82, eventId: 82 });
});

it('requests the selected child and explicit instants, clearing siblings immediately', async () => {
    vi.mocked(sessions).mockResolvedValue([{ ...session, attendance: [{ id: 61, name: 'Nika', response: 'GOING', active: true }] }]);
    const { result, rerender } = renderHook(({ child }) => useSquadSchedule(squads, '2026-09-14T00:00:00+04:00', '2026-09-21T00:00:00+04:00', 0, child), { initialProps: { child: 61 } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(sessions).toHaveBeenCalledWith(11, expect.any(AbortSignal), { from: '2026-09-13T20:00:00.000Z', to: '2026-09-20T20:00:00.000Z', playerId: 61 });
    expect(result.current.events).toHaveLength(1);
    rerender({ child: 62 });
    expect(result.current.events).toEqual([]);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events).toEqual([]);
});
