import '../../../i18n';
import {getAuthSessionId,setStoredAccessToken,setStoredUserId} from '../../../utils/authStorage';
import { fetchClubSchedule } from '../../schedule/api';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChildSquadSchedule, FamilySchedule } from '../FamilySchedule';
import type { ParentChild } from '../api';
import * as api from '../../squadCommunication/api';

vi.mock('../../schedule/api', () => ({ fetchClubSchedule: vi.fn().mockResolvedValue([]) }));
vi.mock('../../squadCommunication/api', () => ({ spaces: vi.fn(), overview: vi.fn(), sessions: vi.fn(), attendance: vi.fn() }));
vi.mock('../../../components/schedule/ScheduleWeekBoard', () => ({
    ScheduleWeekBoard: ({ events, onSelect }: { events: { id: string; title: string }[]; onSelect: (e: unknown) => void }) =>
        <div>{events.map(e => <button key={e.id} onClick={() => onSelect(e)}>{e.title}</button>)}</div>,
}));
const child = { userId: 61, clubId: 1, publicEvents: [] } as unknown as ParentChild;
const room = (id: number, player: number) => ({ id, club_id: 1, name: 'U12', players: [{ id: player, name: 'Player' }] }) as api.SquadOverview;
const training = (status: 'SCHEDULED' | 'CANCELLED' = 'SCHEDULED'): api.SquadSession => ({
    id: 9, title: 'Passing practice', starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 3600000).toISOString(),
    location: 'Pitch 2', status, cancellation_reason: status === 'CANCELLED' ? 'Pitch flooded' : null, revision: 0,
    attendance: [{ id: 61, name: 'Nika', response: 'UNANSWERED' }, { id: 62, name: 'Saba', response: 'GOING' }],
});

describe('Family schedule', () => {
    beforeEach(() => { vi.resetAllMocks();localStorage.clear();setStoredAccessToken(`synthetic.${btoa(JSON.stringify({sub:'7'}))}.test`);setStoredUserId(7);vi.mocked(fetchClubSchedule).mockResolvedValue([]); });
    it('matches the actual child roster instead of a shared squad name or academy membership', async () => {
        vi.mocked(api.spaces).mockResolvedValue([room(10, 61), room(11, 62)]);
        vi.mocked(api.overview).mockImplementation(async id => room(id, id === 10 ? 61 : 62));
        vi.mocked(api.sessions).mockResolvedValue([training()]);
        render(<MemoryRouter><ChildSquadSchedule child={child} /></MemoryRouter>);
        const link = await screen.findByRole('link', { name: /U12/ });
        expect(link).toHaveAttribute('href', '/squads/10');
        await screen.findByText('Passing practice');
        expect(api.sessions).toHaveBeenCalledTimes(1);
        expect(api.sessions).toHaveBeenCalledWith(10, expect.any(AbortSignal), expect.objectContaining({ from: expect.stringMatching(/Z$/), to: expect.stringMatching(/Z$/), playerId: 61 }));
        fireEvent.click(screen.getByText('Passing practice'));
        expect(screen.getByLabelText('Reply for Nika')).toBeInTheDocument();
        expect(screen.queryByLabelText('Reply for Saba')).not.toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Reply for Nika'), { target: { value: 'GOING' } });
        await waitFor(() => expect(api.attendance).toHaveBeenCalledWith(10, 9, 61, 'GOING', 0, expect.any(String), getAuthSessionId()));
    });
    it('shows the cancellation reason without allowing an attendance response', async () => {
        vi.mocked(api.sessions).mockResolvedValue([training('CANCELLED')]);
        render(<MemoryRouter><FamilySchedule squads={[{ id: 10, name: 'U12' }]} playerId={61} /></MemoryRouter>);
        fireEvent.click(await screen.findByText('Passing practice'));
        expect(screen.getByText('Cancelled · Pitch flooded')).toBeInTheDocument();
        expect(screen.queryByLabelText('Reply for Nika')).not.toBeInTheDocument();
    });
    it('uses the shared full schedule and switches squads without leaking the previous selection', async () => {
        vi.mocked(api.sessions).mockImplementation(async id => [{ ...training(), title: id === 10 ? 'Passing practice' : 'U16 match preparation' }]);
        render(<MemoryRouter><FamilySchedule squads={[{ id: 10, name: 'U12' }, { id: 11, name: 'U16' }]} /></MemoryRouter>);
        await screen.findByText('Passing practice');
        expect(screen.getByRole('heading', { name: 'Squad schedule.' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Week board' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Calendar' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Agenda' })).toBeInTheDocument();
        fireEvent.click(screen.getByText('Passing practice'));
        fireEvent.click(screen.getByRole('button', { name: 'Close session details' }));
        fireEvent.change(screen.getByLabelText('Choose squad'), { target: { value: '11' } });
        await screen.findByText('U16 match preparation');
        expect(screen.queryByText('Passing practice')).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'New session' })).not.toBeInTheDocument();
    });
});
