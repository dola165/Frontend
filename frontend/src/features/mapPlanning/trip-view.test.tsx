import { useRef, useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { MapRef } from 'react-map-gl/maplibre';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GkRoot } from '../../design/primitives';
import { groupLabel, routeGroups, routeLegs } from '../world/map/canvas/routeGeometry';
import { pointsBounds } from '../world/map/canvas/viewport';
import { emptyDraft, planGet, planPost, type FamilyItinerary, type Plan, type PlanContext } from './api';
import { JourneyView } from './journey/JourneyView';
import { draftItinerary } from './journeyModel';
import { stopClock, stopsOf } from './planner/itinerary';
import { PlannerPanel } from './planner/PlannerPanel';
import { routeOf, usePlanner } from './planner/usePlanner';

vi.mock('./api', async original => ({ ...await original<typeof import('./api')>(), planGet: vi.fn(), planPost: vi.fn() }));
const place = { name: 'Academy', address: 'Main gate', latitude: 41.7, longitude: 44.8 };
const ground = { ...place, name: 'Training ground', latitude: 41.72 };
const itinerary: FamilyItinerary = { title: 'Published journey', timezone: 'Asia/Tbilisi', startsAt: '2026-10-11T05:00Z', endsAt: '2026-10-11T09:00Z', destination: ground.name, meetingPoint: place.name, collectionPoint: place.name, supervisionContact: 'Coach Luka', message: 'Bring water', locations: { meeting: place, destination: ground, collection: place }, activities: [
    { title: 'Training', kind: 'TRAINING', startsAt: '2026-10-11T06:00Z', endsAt: '2026-10-11T07:00Z', place: ground },
    { title: 'Meet the team', kind: 'TRAVEL', startsAt: '2026-10-11T05:00Z', endsAt: '2026-10-11T05:15Z', place },
    { title: 'Lunch', kind: 'MEAL', startsAt: '2026-10-11T07:00Z', endsAt: '2026-10-11T08:00Z', place: ground },
    { title: 'Return', kind: 'TRAVEL', startsAt: '2026-10-11T08:30Z', endsAt: '2026-10-11T09:00Z', place }] };
beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('orders real activities and numbers repeat visits on one marker without duplicating the destination', () => {
    const stops = routeOf(stopsOf(itinerary));
    expect(stops.map(stop => stop.title)).toEqual(['Meet the team', 'Meet the team', 'Training', 'Lunch', 'Return', 'Return and collection']);
    const groups = routeGroups(stops);
    expect(groups.map(groupLabel)).toEqual(['1·2·5·6', '3·4']);
    const legs = routeLegs(stops, 'activity:0');
    expect(legs.features).toHaveLength(2);
    expect(legs.features.map(leg => leg.properties.active)).toEqual([true, false]);
});

it('keeps unlocated activities visible and does not draw an invented connection through them', () => {
    const stops = routeOf(stopsOf({ ...itinerary, activities: itinerary.activities.map(a => a.title === 'Training' ? { ...a, place: null } : a) }));
    expect(stops.find(stop => stop.title === 'Training')?.latitude).toBeNull();
    expect(routeLegs(stops, null).features).toHaveLength(1);
});

it('draws travel without its own place as the leg between the places either side', () => {
    const stops = routeOf(stopsOf({ ...itinerary, activities: itinerary.activities.map(a => a.title === 'Meet the team' ? { ...a, place: null } : a) }));
    const legs = routeLegs(stops, 'activity:1');
    expect(legs.features).toHaveLength(2);
    expect(legs.features[0].properties.active).toBe(true);
});

function Explorer() {
    const [selected, setSelected] = useState<string | null>(null);
    return <GkRoot><JourneyView itinerary={itinerary} selected={selected} onSelect={stop => setSelected(stop?.id ?? null)} heading={<h2>Published journey</h2>} /></GkRoot>;
}
it('selects stops from the timeline, steps through them and tours at a bounded pace', () => {
    render(<Explorer />);
    fireEvent.click(screen.getByRole('button', { name: 'Training, 10:00' }));
    expect(screen.getByText('Stop 3 of 6: Training')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Next stop' }));
    expect(screen.getByText('Stop 4 of 6: Lunch')).toBeVisible();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Play the journey' }));
    act(() => { vi.advanceTimersByTime(3600); });
    expect(screen.getByText('Stop 5 of 6: Return')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    act(() => { vi.advanceTimersByTime(10000); });
    expect(screen.getByText('Stop 5 of 6: Return')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'I’m going' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Give travel permission' })).toBeNull();
});

it('draft previews contain public place photos and exclude staff, participant and finance fields', () => {
    const draft = { ...emptyDraft(), title: 'Trip', privateNotes: 'secret', staff: [4], vehicles: [{ key: 'v', label: 'Minibus', driver: 'secret driver', seats: 8 }], bring: ['Water bottle'], places: [{ ...place, key: 'ground', type: 'MANUAL' as const, notes: 'private place', photoUrl: '/uploads/photo.jpg' }], activities: [{ key: 'training', title: 'Training', kind: 'TRAINING' as const, startsAt: itinerary.startsAt, endsAt: itinerary.endsAt, placeKey: 'ground', notes: 'secret activity' }] };
    const view = draftItinerary(draft);
    expect(view.activities[0].place?.photoUrl).toBe('/uploads/photo.jpg');
    expect(view.bring).toEqual(['Water bottle']);
    expect(JSON.stringify(view)).not.toContain('secret');
    expect(JSON.stringify(view)).not.toContain('private place');
    for (const field of ['participants', 'budgetMinor', 'staff', 'vehicles']) expect(view).not.toHaveProperty(field);
});

function Planner() {
    const mapRef = useRef<MapRef>(null);
    return <GkRoot><PlannerPanel planner={usePlanner({ enabled: true, mapRef, phone: false })} /></GkRoot>;
}
it('previews the shared version for staff and returns to the unchanged draft', async () => {
    const context: PlanContext = { id: 1, name: 'Dinamo', settings: { timezone: 'Asia/Tbilisi' }, squads: [{ id: 2, name: 'U16 Boys', canEdit: true }], participants: [], events: [], sessions: [] };
    const plan = { id: 7, club_id: 1, squad_id: 2, title: 'Saved plan', revision: 2, published_revision: 1, published_version: 1, draft: { ...emptyDraft(context), title: 'Private draft title' }, published: itinerary, rights: { edit: true, travel: true, finance: false, publish: true, leadership: false }, suppliers: {}, totalMinor: 0, budgetApproved: false, issues: [], history: [], familyResponses: [], trip: null, passengers: [], linkedSchedule: [] } as unknown as Plan;
    vi.mocked(planGet).mockImplementation(async path => (path === '/context' ? [context] : path === '/7' ? plan : []) as never);
    render(<MemoryRouter initialEntries={['/world/map?plans=staff&plan=7&club=1&squad=2&view=journey']}><Planner /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Published journey', level: 2 })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Shared · version 1' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Current draft' }));
    expect(await screen.findByRole('heading', { name: 'Private draft title', level: 2 })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Back to planning' }));
    expect(await screen.findByDisplayValue('Private draft title')).toBeVisible();
    expect(planPost).not.toHaveBeenCalled();
});

it('keeps international connections and overview short across the date line', () => {
    const bounds = pointsBounds([{ longitude: 179, latitude: 12 }, { longitude: -179, latitude: 13 }]);
    expect(bounds[1][0] - bounds[0][0]).toBe(2);
    const stops = [{ id: 'a', label: '1', title: 'Fiji', latitude: 12, longitude: 179, kind: 'stop' as const }, { id: 'b', label: '2', title: 'Samoa', latitude: 13, longitude: -179, kind: 'stop' as const }];
    const line = routeLegs(stops, null).features[0].geometry.coordinates;
    expect(Math.abs(line[1][0] - line[0][0])).toBe(2);
});

it('can preview an unfinished draft without losing the plan to invalid dates', () => {
    const draft = { ...emptyDraft(), startsAt: '', endsAt: '', places: [{ ...place, key: 'plan:meeting', type: 'MANUAL' as const, notes: '' }] };
    const first = stopsOf(draftItinerary(draft))[0];
    expect(first.place?.name).toBe('Academy');
    expect(stopClock(first.startsAt, 'Asia/Tbilisi').day).toBe('Time to confirm');
});
