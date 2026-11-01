import '../../i18n';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/axiosConfig';
import * as api from './api';
import { SessionMoveDialog } from './SessionMoveDialog';
import { SessionHistory } from './SessionHistory';
import { useSessionOccurrence } from './sessionOccurrence';
import { SquadGroundsTab } from './page/SquadGroundsTab';
import { sessionEvent, useSquadSchedule } from './useSquadSchedule';
import { directionsUrl } from '../schedule/board/directionsUrl';
import { setStoredUserId, setStoredAccessToken } from '../../utils/authStorage';

vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() } }));
vi.mock('./api', () => ({ previewSession: vi.fn(), editSession: vi.fn(), previewSeriesChange: vi.fn(), changeSeries: vi.fn() }));
vi.mock('./useSquadSchedule', async original => ({ ...(await original<typeof import('./useSquadSchedule')>()), useSquadSchedule: vi.fn() }));
const squad = { id: 11, name: 'U14', club_id: 1, can_manage: true } as api.SquadOverview;
const session: api.SquadSession = { id: 81, title: 'Training', starts_at: '2030-11-01T12:00:00Z', ends_at: '2030-11-01T13:00:00Z', location: 'East field, Gate 2, Rustavi', status: 'SCHEDULED', revision: 4, cancellation_reason: null, response_requested: false, attendance: [] };
const conflict: api.CalendarConflict = { sessionId: 81, source: 'EVENT', sourceId: 90, title: 'League fixture', startsAt: '2030-11-02T12:00:00Z', endsAt: '2030-11-02T14:00:00Z' };
const preview: api.SessionConsequence = { revision: 4, material: true, responsePolicy: 'RECONFIRM', affectedParticipants: 2, affectedResponses: 0, addedParticipants: 0, removedParticipants: 0, notificationRecipients: 2, canCommit: true, conflicts: [] };

beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); setStoredUserId(20); setStoredAccessToken('synthetic-a'); });
afterEach(cleanup);

it('blocks a move that clashes with the canonical match and never sends a mutation', async () => {
    vi.mocked(api.previewSession).mockResolvedValue({ ...preview, canCommit: false, conflicts: [conflict] });
    render(<MemoryRouter><SessionMoveDialog squadId={11} squadName="U14" session={session} startsAt={conflict.startsAt} endsAt={conflict.endsAt} onClose={vi.fn()} onSaved={vi.fn()}/></MemoryRouter>);
    expect(await screen.findByText('League fixture')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move session' })).toBeDisabled();
    expect(api.editSession).not.toHaveBeenCalled();
});

it('invalidates a reviewed one-date move when scope changes and confirms exact series revisions', async () => {
    vi.mocked(api.previewSession).mockResolvedValue(preview);
    let resolve!: (value: api.SeriesPreview) => void;
    vi.mocked(api.previewSeriesChange).mockImplementation(() => new Promise(done => { resolve = done; }));
    const saved = vi.fn();
    render(<MemoryRouter><SessionMoveDialog squadId={11} squadName="U14" session={{ ...session, series_id: 'weekly' }} startsAt={conflict.startsAt} endsAt={conflict.endsAt} onClose={vi.fn()} onSaved={saved}/></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Move session' })).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Apply to'), { target: { value: 'FOLLOWING' } });
    expect(screen.getByRole('button', { name: 'Move session' })).toBeDisabled();
    await act(async () => resolve({ expected: [{ id: 81, revision: 4 }, { id: 82, revision: 9 }], eventCount: 2, notificationDeliveries: 4, affectedResponses: 0, dates: [session.starts_at], canCommit: true, conflicts: [] }));
    fireEvent.click(screen.getByRole('button', { name: 'Move session' }));
    await waitFor(() => expect(api.changeSeries).toHaveBeenCalledWith(11, 81, expect.objectContaining({ scope: 'FOLLOWING', expected: [{ id: 81, revision: 4 }, { id: 82, revision: 9 }], change: expect.objectContaining({ revision: 4, startsAt: '2030-11-02T12:00:00.000Z' }) })));
    expect(saved).toHaveBeenCalledOnce();
});

it('never presents unread history as empty and supports a permission-checked retry', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ data: { session, history: [] } });
    render(<SessionHistory squadId={11} sessionId={81} playerId={61}/>);
    const details = screen.getByText('Changes to this date').closest('details')!;
    details.open = true; fireEvent(details, new Event('toggle'));
    expect(await screen.findByRole('alert')).toHaveTextContent('The current session could not load.');
    expect(screen.queryByText('No saved changes to this occurrence.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry history' }));
    expect(await screen.findByText('No saved changes to this occurrence.')).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenLastCalledWith('/squad-communication/11/events/81', expect.objectContaining({ params: { playerId: 61 } }));
});

it('rejects a late occurrence response after an account switch', async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(apiClient.get).mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValueOnce({ data: { session: { ...session, title: 'Current account' }, history: [] } });
    const hook = renderHook(() => useSessionOccurrence(11, 81, 61));
    act(() => { setStoredUserId(21); setStoredAccessToken('synthetic-b'); });
    await waitFor(() => expect(hook.result.current.value?.session.title).toBe('Current account'));
    await act(async () => resolve({ data: { session, history: [] } }));
    expect(hook.result.current.value?.session.title).toBe('Current account');
    expect(vi.mocked(apiClient.get).mock.calls[0][1]?.signal?.aborted).toBe(true);
});

it('shows a retry instead of falsely empty grounds after an unread schedule', () => {
    vi.mocked(useSquadSchedule).mockReturnValue({ key: 'test', events: [], loading: false, error: 'Schedule unavailable' });
    render(<MemoryRouter><SquadGroundsTab space={squad}/></MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent('Schedule unavailable');
    expect(screen.queryByText('No grounds planned in the next four weeks.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry grounds' }));
    expect(vi.mocked(useSquadSchedule).mock.lastCall?.[3]).toBe(1);
});

it('keeps full recorded places and links each ground back to the same occurrence', () => {
    vi.mocked(useSquadSchedule).mockReturnValue({ key: 'test', events: [sessionEvent(squad, session)], loading: false, error: '' });
    render(<MemoryRouter><SquadGroundsTab space={squad}/></MemoryRouter>);
    expect(screen.getByRole('heading', { name: session.location! })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Directions' })).toHaveAttribute('href', directionsUrl(session.location));
    expect(screen.getByRole('link', { name: /Training/ })).toHaveAttribute('href', expect.stringContaining('sessionId=81'));
});

it('does not turn a pending or unavailable reservation into directions to a confirmed ground', () => {
    const pending: api.SquadSession = { ...session, venue_reservation: { status: 'PENDING', venueId: 5, venueName: 'Arena', pitchName: 'A', startsAt: session.starts_at, endsAt: session.ends_at, timezone: 'Asia/Tbilisi' } };
    vi.mocked(useSquadSchedule).mockReturnValue({ key: 'test', events: [sessionEvent(squad, pending)], loading: false, error: '' });
    render(<MemoryRouter><SquadGroundsTab space={squad}/></MemoryRouter>);
    expect(screen.getByText('Pitch request awaiting approval')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Directions' })).not.toBeInTheDocument();
});

it('uses actual coordinates when available and never invents a country for a named place', () => {
    expect(directionsUrl('Academy', 0, 0)).toContain('destination=0%2C0');
    expect(directionsUrl('East field, Rustavi')).toContain('destination=East%20field%2C%20Rustavi');
    expect(directionsUrl(null, 999, null)).toBeNull();
});

