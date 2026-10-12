import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArrangeMatchForm } from '../ArrangeMatchForm';
import { createArrangement } from '../api';

vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 1 }, sessionId: 'arrange-test' }) }));
vi.mock('../api', () => ({
    mySquads: vi.fn(async () => [
        { id: 103, club_id: 1, name: 'U14 Boys', category: 'U14', club_name: 'Dinamo' },
        { id: 105, club_id: 1, name: 'U16 Boys', category: 'U16', club_name: 'Dinamo' },
        { id: 101, club_id: 1, name: 'First Team', category: 'SENIOR', club_name: 'Dinamo' },
    ]),
    coachedSquadIds: vi.fn(async () => [103, 105]),
    clubProfile: vi.fn(async (id: number) => ({ id, name: id === 1 ? 'Dinamo' : 'Riverside Academy', cityName: 'Tbilisi' })),
    clubGrounds: vi.fn(async (id: number) => id === 1
        ? [{ key: 'venue:202', venueId: 202, name: 'Dinamo Academy Training Centre', city: 'Tbilisi', detail: 'Club-owned', latitude: 41.7, longitude: 44.7 }]
        : [{ key: 'venue:205', venueId: 205, name: 'Vake Park Pitches', city: 'Tbilisi', detail: 'Regular ground', latitude: null, longitude: null }]),
    clubSquads: vi.fn(async () => [{ id: 111, name: 'U16 Boys', category: 'U16' }, { id: 112, name: 'U14 Mixed', category: 'U14' }]),
    searchClubs: vi.fn(async () => [{ id: 1, name: 'Dinamo' }, { id: 3, name: 'Riverside Academy', cityName: 'Tbilisi' }]),
    searchVenues: vi.fn(async () => []),
    createArrangement: vi.fn(),
}));

const sent = vi.fn();
/** The form as World's frame shows it: its draft kept under the frame's key, the match it creates handed back. */
function open(props: { opponentId?: number; squadId?: number; mode?: 'direct' | 'open' } = {}) {
    const mode = props.mode ?? 'direct';
    render(<MemoryRouter><ArrangeMatchForm mode={mode} opponentId={props.opponentId} squadId={props.squadId} onSent={sent}
        storageKey={`gk:arrange:1:arrange-test:${[mode, props.opponentId && `c${props.opponentId}`, props.squadId && `s${props.squadId}`].filter(Boolean).join('.')}`} /></MemoryRouter>);
}
async function chooseRiverside() {
    fireEvent.change(await screen.findByLabelText('Opponent'), { target: { value: 'riv' } });
    const option = await screen.findByRole('option', { name: /Riverside Academy/ });
    expect(screen.queryByRole('option', { name: /^Dinamo/ })).not.toBeInTheDocument(); // never our own club
    fireEvent.click(option);
}
const kickoff = () => {
    fireEvent.change(screen.getByLabelText('Match day'), { target: { value: '2099-10-17' } });
    fireEvent.change(screen.getByLabelText('Kick-off time'), { target: { value: '11:00' } });
};

describe('arranging a match with a club you know', () => {
    beforeEach(() => { sessionStorage.clear(); vi.mocked(createArrangement).mockReset(); sent.mockReset(); });
    afterEach(cleanup);

    it('finds the club, prefills both squads when obvious and sends one invitation without a booking', async () => {
        vi.mocked(createArrangement).mockResolvedValue({ event_id: 77 } as never);
        open();
        await chooseRiverside();
        expect(await screen.findByRole('radio', { name: 'U14 Mixed' })).toHaveAttribute('aria-checked', 'false');
        fireEvent.click(screen.getByRole('radio', { name: 'U14 Mixed' }));
        await waitFor(() => expect(screen.getByRole('radio', { name: 'U14 Boys' })).toHaveAttribute('aria-checked', 'true'));
        expect(screen.getAllByText(/9-a-side, 80 minutes/).length).toBeGreaterThan(0);
        kickoff();
        fireEvent.click(await screen.findByLabelText(/Dinamo Academy Training Centre/));
        expect(screen.queryByText(/book a stadium/i)).not.toBeInTheDocument();
        expect(screen.getByText('Invites Riverside Academy · U14 Mixed. Nothing is agreed until they accept.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
        await waitFor(() => expect(sent).toHaveBeenCalledWith({ event_id: 77 }));
        expect(createArrangement).toHaveBeenCalledWith(expect.objectContaining({
            targetClubId: 3, targetSquadId: 112, bookingId: null, hostingChoice: 'HOME',
            match: expect.objectContaining({ squadId: 103, startsAt: '2099-10-17T11:00', endsAt: '2099-10-17T12:20', venueId: 202, format: '9_A_SIDE' }),
        }));
    });

    it('marks what is missing instead of sending', async () => {
        open();
        fireEvent.click(await screen.findByRole('button', { name: 'Send invitation' }));
        expect(await screen.findByText('Search for the club you want to play.')).toBeInTheDocument();
        expect(screen.getByText('Choose the match day.')).toBeInTheDocument();
        expect(screen.getByText(/details need your attention/)).toBeInTheDocument();
        expect(document.activeElement).toBe(screen.getByLabelText('Opponent'));
        expect(createArrangement).not.toHaveBeenCalled();
    });

    it('keeps the draft and says so when sending fails', async () => {
        vi.mocked(createArrangement).mockRejectedValue(new Error('offline'));
        open({ opponentId: 3, squadId: 103 });
        expect((await screen.findAllByText('Riverside Academy', { selector: 'strong' })).length).toBeGreaterThan(0);
        await waitFor(() => expect(screen.getByRole('radio', { name: 'U14 Mixed' })).toHaveAttribute('aria-checked', 'true'));
        kickoff();
        fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
        expect(await screen.findByText(/Your details are kept/)).toBeInTheDocument();
        expect(sent).not.toHaveBeenCalled();
        expect(JSON.parse(sessionStorage.getItem('gk:arrange:1:arrange-test:direct.c3.s103') ?? '{}')).toMatchObject({ date: '2099-10-17', time: '11:00', opponent: { id: 3 } });
    });

    it('posts an open match without asking for an opponent', async () => {
        vi.mocked(createArrangement).mockResolvedValue({ event_id: 78 } as never);
        open({ mode: 'open', squadId: 105 });
        expect(screen.queryByLabelText('Opponent')).not.toBeInTheDocument();
        // Our club and its ground have loaded (the city a match travelling to the opponent starts in comes from them).
        await screen.findByLabelText(/Dinamo Academy Training Centre/);
        fireEvent.click(await screen.findByLabelText(/We travel to the opponent/));
        kickoff();
        fireEvent.click(screen.getByRole('button', { name: 'Post open match' }));
        await waitFor(() => expect(sent).toHaveBeenCalledWith({ event_id: 78 }));
        expect(createArrangement).toHaveBeenCalledWith(expect.objectContaining({ targetClubId: null, hostingChoice: 'AWAY', match: expect.objectContaining({ squadId: 105, venuePreference: 'AWAY', title: 'U16 Boys looking for a Saturday friendly' }) }));
    });
});
