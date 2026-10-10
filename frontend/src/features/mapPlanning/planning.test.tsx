import { useRef } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { MapRef } from 'react-map-gl/maplibre';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GkRoot } from '../../design/primitives';
import { emptyDraft, localInput, zonedIso, planGet, planPost, savePlan, type Plan, type PlanContext } from './api';
import { putPlanningPlace } from './mapPlanning';
import { draftFingerprint, recoverPlan, recoveryKey, rememberPlan } from './draftRecovery';
import { PlannerPanel } from './planner/PlannerPanel';
import { ActivityEditor } from './planner/StopEditor';
import type { PlanMap } from './planner/usePlanMap';
import { usePlanner } from './planner/usePlanner';
import { clearStoredAuth, getAuthSessionId, setStoredAccessToken, setStoredUserId } from '../../utils/authStorage';

vi.mock('./api', async original => ({ ...await original<typeof import('./api')>(), planGet: vi.fn(), planPost: vi.fn(), savePlan: vi.fn(), permissionDecision: vi.fn() }));
const context: PlanContext = { id: 4, name: 'FC Dinamo Tbilisi Academy', settings: { timezone: 'Asia/Tbilisi', currency: 'GEL' }, squads: [{ id: 5, name: 'U16', canEdit: true }], participants: [{ id: 6, name: 'Player One', squad_id: 5 }], events: [], sessions: [] };
const record = (): Plan => ({ id: 8, club_id: 4, squad_id: 5, title: 'Away match', revision: 3, created_by: 2, published_version: 0, published_revision: null, updated_at: '2026-09-30T06:00Z', starts_at: '2026-10-07T08:00Z', draft: { ...emptyDraft(context), title: 'Away match' }, suppliers: {}, totalMinor: 0, budgetApproved: false, approvedBy: null, rights: { edit: true, travel: true, finance: false, publish: true, leadership: false }, issues: [], history: [], familyResponses: [], trip_id: null, trip: null, passengers: [], linkedSchedule: [] });

/** Planning as the World map mounts it, without the map canvas. */
function Planner() {
    const mapRef = useRef<MapRef>(null);
    const planner = usePlanner({ enabled: true, mapRef, phone: false, clubId: 4 });
    return <GkRoot><PlannerPanel planner={planner} /></GkRoot>;
}
const show = (route = '/world/map?plans=staff') => render(<MemoryRouter initialEntries={[route]}><Planner /></MemoryRouter>);
const startBlank = async () => { show(); fireEvent.click(await screen.findByRole('button', { name: 'Start a plan' })); return screen.findByLabelText('Plan name'); };

beforeEach(() => {
    localStorage.clear(); localStorage.setItem('userId', '2'); localStorage.setItem('gk-session-id', 'test-session'); vi.clearAllMocks();
    vi.mocked(planGet).mockImplementation(async path => (path === '/context' ? [context] : path === '/8' ? record() : path.startsWith('?clubId') ? [record()] : []) as never);
});
afterEach(cleanup);

it('explains a missing plan name and focuses it before sending a creation request', async () => {
    await startBlank();
    fireEvent.click(screen.getByRole('button', { name: 'Create plan' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Give this plan a name');
    await waitFor(() => expect(screen.getByLabelText('Plan name')).toHaveFocus());
    expect(planPost).not.toHaveBeenCalled();
});

it('shows creation progress immediately and confirms the persisted private draft', async () => {
    let resolve!: (p: Plan) => void;
    vi.mocked(planPost).mockImplementationOnce(() => new Promise<Plan>(r => { resolve = r; }));
    fireEvent.change(await startBlank(), { target: { value: 'Dinamo camp' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create plan' }));
    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
    expect(screen.getByText('Creating your plan…')).toBeVisible();
    resolve({ ...record(), draft: { ...emptyDraft(context), title: 'Dinamo camp' } });
    expect(await screen.findByText(/It stays private to the planning staff until you publish it/)).toBeVisible();
});

it('recovers an unsaved plan after unmount and keeps its creation request identity', async () => {
    fireEvent.change(await startBlank(), { target: { value: 'Recovered camp' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Kit and notes' }));
    fireEvent.change(screen.getByLabelText('Private planning notes'), { target: { value: 'Keep these details' } });
    const backup = recoverPlan()!;
    expect(backup.draft.privateNotes).toBe('Keep these details');
    cleanup(); show();
    const notice = await screen.findByText(/Unsaved draft:/);
    fireEvent.click(within(notice.closest('.gk-notice') as HTMLElement).getByRole('button', { name: 'Continue' }));
    await screen.findByDisplayValue('Recovered camp');
    vi.mocked(planPost).mockResolvedValueOnce({ ...record(), draft: backup.draft });
    fireEvent.click(screen.getByRole('button', { name: 'Create plan' }));
    await screen.findByText(/It stays private/);
    expect(planPost).toHaveBeenCalledWith('', expect.objectContaining({ requestId: backup.requestId }));
    expect(recoverPlan()).toBeNull();
});

it('keeps newer input when retrying a committed creation with a lost response', async () => {
    fireEvent.change(await startBlank(), { target: { value: 'Newer local name' } });
    vi.mocked(planPost).mockResolvedValueOnce({ ...record(), draft: { ...emptyDraft(context), title: 'Earlier committed name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create plan' }));
    await screen.findByText(/Your newer changes are kept/);
    expect(screen.getByLabelText('Plan name')).toHaveValue('Newer local name');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    expect(recoverPlan('plan:8')?.draft.title).toBe('Newer local name');
});

it('uses the recovered base revision so another editor cannot be silently overwritten', async () => {
    const base = record(), local = { ...base.draft, title: 'Recovered conflicting edit' };
    rememberPlan({ key: 'plan:8', planId: 8, clubId: 4, squadId: 5, requestId: 'stable', baseRevision: 1, baseDraft: base.draft, draft: local, savedAt: Date.now() }, getAuthSessionId());
    show('/world/map?plans=staff&plan=8&club=4&squad=5');
    await screen.findByDisplayValue(local.title);
    expect(screen.getByRole('alert')).toHaveTextContent(/changed elsewhere/);
    vi.mocked(savePlan).mockRejectedValueOnce(new Error('Conflict'));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(savePlan).toHaveBeenCalledWith(8, 1, local));
    expect(screen.getByLabelText('Plan name')).toHaveValue(local.title);
});

it('offers this device’s unsaved changes to a saved plan from the journeys list', async () => {
    const base = record();
    rememberPlan({ key: 'plan:8', planId: 8, clubId: 4, squadId: 5, requestId: '8', baseRevision: 3, baseDraft: base.draft, draft: { ...base.draft, title: 'Edited offline' }, savedAt: Date.now() }, getAuthSessionId());
    show();
    const notice = await screen.findByText(/Unsaved changes:/);
    fireEvent.click(within(notice.closest('.gk-notice') as HTMLElement).getByRole('button', { name: 'Continue' }));
    expect(await screen.findByDisplayValue('Edited offline')).toBeVisible();
    expect(screen.getByText('Your unsaved changes were recovered.')).toBeVisible();
});

it('isolates recovery by account and login and clears private drafts on logout', () => {
    const d = { ...emptyDraft(context), title: 'Private draft' }, backup = { key: recoveryKey(0, 'stable'), planId: 0, clubId: 4, squadId: 5, requestId: 'stable', baseRevision: null, baseDraft: emptyDraft(context), draft: d, savedAt: Date.now() };
    expect(rememberPlan(backup, getAuthSessionId())).toBe(true);
    setStoredUserId(99); expect(recoverPlan()).toBeNull();
    setStoredUserId(2); expect(recoverPlan()?.draft.title).toBe('Private draft');
    const old = getAuthSessionId(); setStoredAccessToken('new-login'); expect(recoverPlan()).toBeNull(); expect(rememberPlan(backup, old)).toBe(false);
    setStoredUserId(2); rememberPlan(backup, getAuthSessionId()); clearStoredAuth();
    expect(Object.keys(localStorage).some(k => k.startsWith('gk-map-drafts:'))).toBe(false);
    expect(draftFingerprint({ ...d, places: [] })).toBe(draftFingerprint({ ...d }));
});

it('stores named map locations and replaces a meeting point without accumulating duplicates', () => {
    const d = emptyDraft(context), place = { key: 'clicked', name: 'Academy gate', address: 'Main entrance', latitude: 41.73, longitude: 44.78, type: 'MANUAL' as const, notes: 'Private' };
    const first = { ...d, ...putPlanningPlace(d, place, 'meeting') };
    expect(first.meetingPoint).toBe('Academy gate · Main entrance'); expect(first.places[0].key).toBe('plan:meeting');
    const next = { ...first, ...putPlanningPlace(first, { ...place, latitude: 41.74 }, 'meeting') };
    expect(next.places).toHaveLength(1); expect(next.places[0].latitude).toBe(41.74);
});

it('explains an empty calendar source and allows choosing a real training entry', () => {
    const d = emptyDraft(context), change = vi.fn(), session = { id: 12, title: 'Squad training', starts_at: d.startsAt, ends_at: new Date(Date.parse(d.startsAt) + 3600000).toISOString(), squad_id: 5 };
    const planMap = { begin: vi.fn(), focus: vi.fn() } as unknown as PlanMap;
    render(<MemoryRouter><GkRoot><ActivityEditor draft={d} initial={{ key: 'new', title: '', kind: 'ACTIVITY', startsAt: d.startsAt, endsAt: d.endsAt, placeKey: null, eventId: null, sessionId: null, notes: '' }} isNew context={{ ...context, sessions: [session] }} squad={5} plan={null} busy={false} planMap={planMap} change={change} onDone={vi.fn()} onCalendar={vi.fn()} /></GkRoot></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Match' }));
    expect(screen.getByText(/No matches on this squad’s calendar/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Training' }));
    fireEvent.change(screen.getByLabelText('From the calendar: a training session'), { target: { value: '12' } });
    expect(screen.getByLabelText('Stop name')).toHaveValue('Squad training');
    fireEvent.click(screen.getByRole('button', { name: 'Add stop' }));
    expect(change).toHaveBeenCalledWith({ activities: [expect.objectContaining({ sessionId: 12, kind: 'TRAINING', title: 'Squad training' })] });
});

it('opens picking beside the plan without discarding a dirty draft', async () => {
    fireEvent.change(await startBlank(), { target: { value: 'Unsaved journey' } });
    fireEvent.click(within(screen.getByRole('group', { name: 'Destination on the map' })).getByRole('button', { name: 'Choose on the map' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText(/Click the map to choose destination/)).toBeVisible();
    expect(screen.getByLabelText('Plan name')).toHaveValue('Unsaved journey');
    expect(screen.queryByLabelText('Latitude')).not.toBeInTheDocument();
});

describe('plan time zones', () => {
    it('round trips Georgian and summer/winter Tallinn wall times independently of browser timezone', () => {
        expect(zonedIso('2027-06-14T09:00', 'Europe/Tallinn')).toBe('2027-06-14T06:00:00.000Z');
        expect(zonedIso('2027-01-14T09:00', 'Europe/Tallinn')).toBe('2027-01-14T07:00:00.000Z');
        expect(localInput(zonedIso('2027-06-14T09:00', 'Asia/Tbilisi'), 'Asia/Tbilisi')).toBe('2027-06-14T09:00');
    });
    it('rejects a DST gap and an incomplete date instead of moving an activity silently', () => {
        expect(() => zonedIso('2027-03-28T03:30', 'Europe/Tallinn')).toThrow('does not exist');
        expect(() => zonedIso('2027-03-', 'UTC')).toThrow();
    });
});

it('creates a club and squad scoped draft and retains edits after failed save', async () => {
    fireEvent.change(await startBlank(), { target: { value: 'Camp in Batumi' } });
    vi.mocked(planPost).mockRejectedValueOnce(new Error('Offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Create plan' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Plan name')).toHaveValue('Camp in Batumi');
    expect(planPost).toHaveBeenCalledWith('', expect.objectContaining({ clubId: 4, squadId: 5, draft: expect.objectContaining({ title: 'Camp in Batumi' }) }));
    const request = vi.mocked(planPost).mock.calls[0][1] as { requestId: string };
    vi.mocked(planPost).mockResolvedValueOnce({ ...record(), draft: { ...record().draft, title: 'Camp in Batumi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create plan' }));
    await screen.findByText(/It stays private/);
    expect((vi.mocked(planPost).mock.calls[1][1] as { requestId: string }).requestId).toBe(request.requestId);
});

it('does not publish unsaved changes and protects them when leaving the plan', async () => {
    show('/world/map?plans=staff&plan=8&club=4&squad=5');
    fireEvent.change(await screen.findByLabelText('Plan name'), { target: { value: 'Unsaved trip' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Share' }));
    expect(screen.getByRole('button', { name: 'Publish to families' })).toBeDisabled();
    expect(screen.getByText('Save your changes before publishing.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Journeys' }));
    await screen.findByRole('alertdialog');
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByRole('heading', { name: 'Unsaved trip' })).toBeVisible();
    expect(planPost).not.toHaveBeenCalled();
});

it('passes the loaded revision on save and preserves a rejected conflicting edit', async () => {
    show('/world/map?plans=staff&plan=8&club=4&squad=5');
    fireEvent.change(await screen.findByLabelText('Destination'), { target: { value: 'Kutaisi' } });
    vi.mocked(savePlan).mockRejectedValueOnce(new Error('Conflict'));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByRole('alert');
    expect(savePlan).toHaveBeenCalledWith(8, 3, expect.objectContaining({ destination: 'Kutaisi' }));
    expect(screen.getByLabelText('Destination')).toHaveValue('Kutaisi');
});
