import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TravelWorkspace } from './TravelWorkspace';
import { FamilyTravel } from './FamilyTravel';
import type { FamilyTravel as FamilyTrip, TravelPlan } from './api';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: api }));
const source = { id: 50, title: 'Away match', starts_at: '2026-11-05T12:00:00Z', ends_at: '2026-11-05T14:00:00Z', location_name: 'Away ground', status: 'SCHEDULED', timezone: 'Asia/Tbilisi' };
const draft = { title: 'Away match · team journey', timezone: 'Asia/Tbilisi', currency: 'GEL', budgetMinor: 0,
    startsAt: '2026-11-05T10:00:00Z', endsAt: '2026-11-05T16:00:00Z', destination: 'Away ground', meetingPoint: 'Academy gate', collectionPoint: 'Academy gate', supervisionContact: 'Club contact', familyMessage: '', privateNotes: 'PRIVATE', participants: [8], places: [], activities: [], arrangements: [{ key: 'travel', kind: 'TRANSPORT', title: 'Club minibus', amountMinor: 0, notes: 'Outside confirmation' }] };
const plan = { id: 7, club_id: 1, squad_id: 4, revision: 3, title: 'Away match · team journey', source, sourceCancelled: false, canPublish: true,
    draft, suppliers: { travel: { status: 'CONFIRMED' } }, issues: [], history: [], physicalHistory: [], rights: { travel: true }, eventPlayers: [{ id: 8, name: 'Ana' }],
    trip: { id: 9, status: 'READY', transitions: ['DEPARTED', 'CANCELLED'] },
    travelChecks: [{ id: 10, name: 'Ana', status: 'PLANNED', revision: 0, permissionState: 'REVIEW_REQUIRED' }],
} as unknown as TravelPlan;
const family: FamilyTrip = { plan_id: 7, club_id: 1, title: 'Away match', child_id: 8, child_name: 'Ana', club_name: 'Academy', version: 2, permission_id: 11,
    source, sourceChanged: false, itinerary: { ...draft, arrangements: [], message: 'Bring water' }, attendance: 'EXPECTED', canRespond: true,
    permission: { id: 11, revision: 2, status: 'PENDING', transitions: ['GRANTED', 'DECLINED'], data: { wording: 'Exact permission terms', expiresOn: '2099-11-05' } }, travel: { status: 'DRAFT', passenger: { status: 'PLANNED', updated_at: '2026-11-01T10:00Z' } } };
beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('userId', '2'); localStorage.setItem('gk-session-id', 'travel-session');
    api.get.mockImplementation((path: string) => Promise.resolve({ data: path.includes('/family/') ? [family] : path.includes('/plans/') ? plan : { plans: [], events: [{ ...source, squad_id: 4, squad_name: 'U14' }] } }));
    api.post.mockResolvedValue({ data: plan }); api.put.mockResolvedValue({ data: { ...plan, revision: 4 } });
});
afterEach(cleanup);
const staff = () => render(<MemoryRouter initialEntries={['/?travelPlan=7']}><TravelWorkspace clubId={1} /></MemoryRouter>);

it('opens the same canonical event after an uncertain create and never reports an invented trip', async () => {
    api.post.mockRejectedValueOnce(new Error('Connection lost'));
    render(<MemoryRouter><TravelWorkspace clubId={1} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Open travel' }));
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: 'Record boarding' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open travel' }));
    await screen.findByRole('heading', { name: 'Away match · team journey' });
    expect(api.post.mock.calls.map(c => c[1])).toEqual([{ clubId: 1, squadId: 4, eventId: 50 }, { clubId: 1, squadId: 4, eventId: 50 }]);
});

it('keeps a logistics draft after conflict and never silently retries against a new version', async () => {
    api.put.mockRejectedValue({ response: { status: 409, data: { message: 'Changed elsewhere' } } });
    staff();
    fireEvent.change(await screen.findByRole('textbox', { name: 'Pickup point' }), { target: { value: 'Long revised pickup gate' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save logistics' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('textbox', { name: 'Pickup point' })).toHaveValue('Long revised pickup gate');
    api.get.mockResolvedValue({ data: { ...plan, revision: 5 } });
    fireEvent.click(screen.getByRole('button', { name: 'Reload current details' }));
    await screen.findByText(/The saved plan changed/);
    expect(screen.getByRole('button', { name: 'Save logistics' })).toBeDisabled();
    expect(api.put).toHaveBeenCalledTimes(1);
});

it('disables new boarding for expired or missing permission without blocking physical returns', async () => {
    staff(); expect(await screen.findByRole('button', { name: 'Record boarding' })).toBeDisabled();
    cleanup(); api.get.mockResolvedValue({ data: { ...plan, sourceCancelled: true, travelChecks: [{ ...plan.travelChecks[0], status: 'BOARDED' }] } });
    staff(); expect(await screen.findByRole('button', { name: 'Record arrival' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Record departure' })).toBeDisabled();
});

it('clears old supplier confirmation when transport changes and can retain an unconfirmed draft', async () => {
    staff();
    const transport = await screen.findByRole('textbox', { name: 'Outside transport arrangement' });
    expect(screen.getByRole('checkbox')).toBeChecked();
    fireEvent.change(transport, { target: { value: 'Minibus awaiting outside confirmation' } });
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Save logistics' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/travel/plans/7/logistics', expect.objectContaining({ transportConfirmed: false }), expect.anything()));
});

it('offers no ordinary Coming action and records only the selected child’s cannot-come', async () => {
    render(<MemoryRouter><FamilyTravel childId={8} /></MemoryRouter>);
    expect(await screen.findByText(/no attendance reply needed/)).toBeVisible();
    expect(screen.queryByRole('button', { name: /going|coming/i })).not.toBeInTheDocument();
    expect(screen.queryByText('PRIVATE')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Can’t come' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/travel/plans/7/cannot-come', { version: 2, childId: 8 }, expect.objectContaining({ _authSessionId: 'travel-session' })));
    expect(api.post.mock.calls[0][1]).not.toHaveProperty('status', 'GRANTED');
});

it('keeps basic parents quiet when no travel is relevant and shows failures truthfully', async () => {
    api.get.mockResolvedValue({ data: [] }); const ui = render(<MemoryRouter><FamilyTravel childId={8} /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByText(/Travel ·/)).not.toBeInTheDocument());
    expect(ui.container.querySelector('button')).toBeNull(); cleanup();
    api.get.mockRejectedValue(new Error('Offline')); render(<MemoryRouter><FamilyTravel childId={8} /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Travel could not load');
});

it('marks old published logistics for review and offers no consent to a changed source', async () => {
    api.get.mockResolvedValue({ data: [{ ...family, sourceChanged: true }] });
    render(<MemoryRouter><FamilyTravel childId={8} /></MemoryRouter>);
    expect(await screen.findByText(/previous published arrangements/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Give travel permission' })).not.toBeInTheDocument();
});

it('offers Take back only for a current own-child Cannot come and leaves consent and physical state alone', async () => {
    api.get.mockResolvedValue({ data: [{ ...family, attendance: 'NOT_GOING' }] });
    render(<MemoryRouter><FamilyTravel childId={8} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Take back Can’t come' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/travel/plans/7/take-back-cannot-come', { version: 2, childId: 8 }, expect.anything()));
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /coming|going/i })).not.toBeInTheDocument();
    cleanup(); api.get.mockResolvedValue({ data: [{ ...family, attendance: 'NOT_GOING', canRespond: false }] });
    render(<MemoryRouter><FamilyTravel childId={8} /></MemoryRouter>);
    expect(await screen.findByText('Can’t come is recorded.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Take back Can’t come' })).not.toBeInTheDocument();
});

it('offers the existing canonical record link on a creation conflict and does not open a duplicate', async () => {
    api.post.mockRejectedValue({ response: { data: { message: 'Travel exists', links: [{ label: 'Established trip', href: '/clubs/1/office?tab=tools&tool=travel&record=44' }] } } });
    render(<MemoryRouter><TravelWorkspace clubId={1} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Open travel' }));
    expect(await screen.findByRole('link', { name: 'Established trip' })).toHaveAttribute('href', '/clubs/1/office?tab=tools&tool=travel&record=44');
    expect(screen.queryByRole('button', { name: 'Record boarding' })).not.toBeInTheDocument();
});

it('does not carry a late own-child result across an account/session change', async () => {
    let resolve!: (value: unknown) => void;
    api.get.mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockResolvedValue({ data: [] });
    render(<MemoryRouter><FamilyTravel childId={8} /></MemoryRouter>);
    await act(async () => { localStorage.setItem('userId', '99'); localStorage.setItem('gk-session-id', 'other-session'); window.dispatchEvent(new Event('gk-auth-changed')); });
    await act(async () => resolve({ data: [family] }));
    expect(screen.queryByText('Travel · Ana')).not.toBeInTheDocument();
});
