import { useRef } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { MapRef } from 'react-map-gl/maplibre';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GkRoot } from '../../design/primitives';
import { permissionDecision, planGet, planPost, type FamilyItinerary, type FamilyPlan } from './api';
import { FamilyReply } from './journey/FamilyReply';
import { PlannerPanel } from './planner/PlannerPanel';
import { usePlanner } from './planner/usePlanner';
import { setStoredAccessToken, setStoredUserId } from '../../utils/authStorage';

vi.mock('./api', async original => ({ ...await original<typeof import('./api')>(), planGet: vi.fn(), planPost: vi.fn(), permissionDecision: vi.fn() }));
const itinerary: FamilyItinerary = { title: 'Training journey', startsAt: '2026-10-10T05:00Z', endsAt: '2026-10-10T09:00Z', timezone: 'Asia/Tbilisi', destination: 'Training ground', meetingPoint: 'Academy gate', collectionPoint: 'Academy gate', supervisionContact: 'Coach Luka', message: 'Bring water', activities: [] };
const journey = { id: 'player-1', plan_id: 1, club_id: 1, child_id: 3, child_name: 'Player', club_name: 'Dinamo', title: 'Training journey', version: 1, viewer: 'PLAYER', canRespond: true, response: { status: 'AWAITING_REPLY' }, itinerary, travel: { status: 'DRAFT' }, published_at: '2026-10-01T00:00Z' } as unknown as FamilyPlan;
const guardianRow = { ...journey, id: 20, plan_id: 7, viewer: 'GUARDIAN', child_name: 'Ana', title: 'Published journey', itinerary: { ...itinerary, title: 'Published journey' }, permission_id: 99, permission: { id: 99, status: 'PENDING', revision: 0, data: { wording: 'Read the plan' }, transitions: ['GRANTED', 'DECLINED'] } } as unknown as FamilyPlan;

/** Family planning as the World map mounts it: someone with no squad to plan for. */
function Journeys() {
    const mapRef = useRef<MapRef>(null);
    return <GkRoot><PlannerPanel planner={usePlanner({ enabled: true, mapRef, phone: false })} /></GkRoot>;
}
function Address() { return <output aria-label="Current address">{useLocation().search}</output>; }
const show = (route = '/world/map?plans=family') => render(<MemoryRouter initialEntries={[route]}><Journeys /><Address /></MemoryRouter>);
const family = (items: FamilyPlan[]) => vi.mocked(planGet).mockImplementation(async path => (path === '/family' ? items : path === '/context' ? [] : []) as never);

beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); setStoredAccessToken('test'); setStoredUserId(1); });
afterEach(cleanup);

it('shows a journey without a match and saves an adult self response', async () => {
    family([journey]);
    vi.mocked(planPost).mockImplementation(async () => { family([{ ...journey, response: { status: 'GOING', acknowledged: true } }]); return {} as never; });
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Open Training journey' }));
    fireEvent.click(await screen.findByRole('button', { name: 'I’m going' }));
    await waitFor(() => expect(planPost).toHaveBeenCalledWith('/1/my-response', { version: 1, response: 'GOING' }));
    await screen.findByText('Going');
    expect(screen.queryByRole('button', { name: 'Give travel permission' })).toBeNull();
});

it('keeps guardian journeys discoverable and separates permission from an adult reply', async () => {
    family([guardianRow]);
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Open Published journey' }));
    expect(await screen.findByRole('button', { name: 'Give travel permission' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'I’m going' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Going' })).toBeVisible();
});

it('acknowledgement and guardian permission are separate requests', async () => {
    const act = vi.fn(async (run: () => Promise<unknown>) => { await run(); });
    vi.mocked(planPost).mockResolvedValue({ acknowledged: true } as never);
    render(<GkRoot><FamilyReply journey={{ ...guardianRow, plan_id: 8, club_id: 4, child_id: 6, version: 2, permission_id: 11, permission: { ...guardianRow.permission, id: 11 } } as FamilyPlan} busy={false} act={act} /></GkRoot>);
    fireEvent.click(screen.getByRole('button', { name: 'I have read this itinerary' }));
    await waitFor(() => expect(planPost).toHaveBeenCalledWith('/8/acknowledge', { version: 2, childId: 6 }));
    expect(permissionDecision).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Give travel permission' }));
    await waitFor(() => expect(permissionDecision).toHaveBeenCalledWith(4, 11, 0, 'GRANTED'));
});

it('shows failed journey fetches instead of claiming there are no journeys', async () => {
    vi.mocked(planGet).mockRejectedValue(new Error('Offline'));
    show();
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.queryByText(/No journeys shared with you yet/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
});

it('keeps the selected child in the address when siblings share one journey', async () => {
    family([guardianRow, { ...guardianRow, id: 21, child_id: 4, child_name: 'Nino' }]);
    show('/world/map?plans=family&journey=7&journeyChild=4');
    expect(await screen.findByText(/for Nino/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Your journeys' }));
    const rows = await screen.findAllByRole('button', { name: 'Open Published journey' });
    expect(rows).toHaveLength(2);
    fireEvent.click(rows.find(row => row.textContent?.includes('Ana'))!);
    expect(await screen.findByText(/for Ana/)).toBeVisible();
    expect(screen.getByLabelText('Current address')).toHaveTextContent('journeyChild=3');
});

it('does not substitute another trip for an unavailable journey link', async () => {
    family([guardianRow]);
    show('/world/map?plans=family&journey=999');
    expect(await screen.findByText(/That journey is not available/)).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Published journey' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open Published journey' }));
    expect(await screen.findByRole('heading', { name: 'Published journey' })).toBeVisible();
});

it('uses plan identity rather than a colliding family recipient identity in map links', async () => {
    const other = { ...guardianRow, id: 7, plan_id: 11, title: 'Different journey', itinerary: { ...itinerary, title: 'Different journey' }, published_at: '2026-10-12T05:00Z' } as FamilyPlan;
    family([other, guardianRow]);
    show('/world/map?plans=family&journey=7');
    expect(await screen.findByRole('heading', { name: 'Published journey' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Different journey' })).toBeNull();
});
