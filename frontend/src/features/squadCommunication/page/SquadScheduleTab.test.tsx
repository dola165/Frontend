import '../../../i18n';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import type * as api from '../api';
import { fetchSessionOccurrence } from '../sessionOccurrence';
import { SquadScheduleTab } from './SquadScheduleTab';

vi.mock('../sessionOccurrence', () => ({ fetchSessionOccurrence: vi.fn() }));

// Fix round 1: a link sent before step 6 names a squad session that became a match; it opens the match.
const moved = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../matchExchange/api', async original => ({ ...(await original<typeof import('../../matchExchange/api')>()), get: moved.get }));
vi.mock('../../parents/FamilySchedule', () => ({ FamilySchedule: ({ initialSessionId, initialDate }: { initialSessionId?: number; initialDate?: Date }) => <p>{`Calendar at session ${initialSessionId} ${initialDate?.toISOString() ?? ''}`}</p> }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });
function Where() { const location = useLocation(); return <output data-testid="where">{location.pathname + location.search}</output>; }
const space = (manage: boolean) => ({ id: 103, name: 'U14 Boys', can_manage: manage } as unknown as api.SquadOverview);
const show = (manage: boolean) => render(<MemoryRouter initialEntries={['/squads/103?tab=sessions&sessionId=19']}>
    <Routes><Route path="*" element={<><SquadScheduleTab space={space(manage)} /><Where /></>} /></Routes></MemoryRouter>);

it('opens the match a session became, in the squad’s place for its staff', async () => {
    moved.get.mockResolvedValue({ eventId: 88 });
    show(true);
    await vi.waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/matches/88?from=squad%3A103'));
    expect(moved.get).toHaveBeenCalledWith('/match-arrangements/squads/103/sessions/19', undefined, expect.any(AbortSignal));
    cleanup();
    show(false);
    await vi.waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/matches\/88$/));
});

it('opens a session that is still a session in the calendar', async () => {
    moved.get.mockRejectedValue({ isAxiosError: true, response: { status: 404 } });
    vi.mocked(fetchSessionOccurrence).mockResolvedValue({ session: { id: 19, starts_at: '2030-12-15T12:00:00Z' }, history: [] } as unknown as Awaited<ReturnType<typeof fetchSessionOccurrence>>);
    show(true);
    expect(await screen.findByText('Calendar at session 19 2030-12-15T12:00:00.000Z')).toBeInTheDocument();
    await vi.waitFor(() => expect(moved.get).toHaveBeenCalled());
    expect(screen.getByTestId('where')).toHaveTextContent('/squads/103?tab=sessions&sessionId=19');
});

it('retries a failed old-link lookup without pretending the event is absent', async () => {
    moved.get.mockRejectedValueOnce({ response: { status: 503 } }).mockRejectedValueOnce({ response: { status: 404 } });
    vi.mocked(fetchSessionOccurrence).mockResolvedValue({ session: { id: 19, starts_at: '2030-12-15T12:00:00Z' }, history: [] } as unknown as Awaited<ReturnType<typeof fetchSessionOccurrence>>);
    show(true);
    expect(await screen.findByRole('alert')).toHaveTextContent('This event could not load.');
    expect(fetchSessionOccurrence).not.toHaveBeenCalled();
    expect(screen.queryByText(/Calendar at session/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry event' }));
    expect(await screen.findByText('Calendar at session 19 2030-12-15T12:00:00.000Z')).toBeInTheDocument();
});
