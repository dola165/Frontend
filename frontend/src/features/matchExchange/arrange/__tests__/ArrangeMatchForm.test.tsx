import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArrangeMatchForm } from '../ArrangeMatchForm';
import { createArrangement } from '../api';
import i18n from '../../../../i18n';

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
    const opponent = await screen.findByLabelText('Opponent');
    // Complete the search's debounce before asserting results; wall-clock rendering varies on shared workstations.
    vi.useFakeTimers();
    try {
        fireEvent.change(opponent, { target: { value: 'riv' } });
        await act(async () => { await vi.runOnlyPendingTimersAsync(); });
    } finally { vi.useRealTimers(); }
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

    it('shows Georgian validation and focuses the original date and fee controls without sending', async () => {
        await i18n.changeLanguage('ka');
        try {
            open({ mode: 'open', squadId: 103 });
            await screen.findByLabelText(/Dinamo Academy Training Centre/);
            fireEvent.click(screen.getByRole('button', { name: 'ღია მატჩის გამოქვეყნება' }));
            expect(await screen.findByText('აირჩიეთ მატჩის დღე.')).toBeInTheDocument();
            expect(document.activeElement).toBe(screen.getByLabelText('მატჩის დღე'));
            fireEvent.change(screen.getByLabelText('მატჩის დღე'), { target: { value: '2099-10-17' } });
            fireEvent.change(screen.getByLabelText('დაწყების დრო'), { target: { value: '11:00' } });
            fireEvent.change(screen.getByLabelText('მსაჯი'), { target: { value: 'OPEN' } });
            fireEvent.click(screen.getByRole('radio', { name: 'ანაზღაურებით' }));
            fireEvent.change(screen.getByLabelText('შეთავაზებული ანაზღაურება'), { target: { value: '-1' } });
            fireEvent.click(screen.getByRole('button', { name: 'ღია მატჩის გამოქვეყნება' }));
            expect(screen.getByText('მიუთითეთ ანაზღაურება 0-დან 1 000 000-მდე.')).toBeInTheDocument();
            expect(document.activeElement).toBe(screen.getByLabelText('შეთავაზებული ანაზღაურება'));
            expect(screen.getByRole('radiogroup', { name: 'უახლოესი შაბათ-კვირა' })).not.toHaveTextContent(/Sat|Sun|Oct/);
            expect(createArrangement).not.toHaveBeenCalled();
        } finally { await act(async () => { await i18n.changeLanguage('en'); }); }
    });

    it('keeps Georgian invitation details after failure and retries the same request and squad', async () => {
        await i18n.changeLanguage('ka');
        try {
            vi.mocked(createArrangement).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ event_id: 79 } as never);
            open({ opponentId: 3, squadId: 103 });
            await waitFor(() => expect(screen.getByRole('radio', { name: 'U14 Mixed' })).toHaveAttribute('aria-checked', 'true'));
            fireEvent.change(screen.getByLabelText('მატჩის დღე'), { target: { value: '2099-10-17' } });
            fireEvent.change(screen.getByLabelText('დაწყების დრო'), { target: { value: '11:00' } });
            fireEvent.click(screen.getByRole('button', { name: 'მოწვევის გაგზავნა' }));
            expect(await screen.findByText('მოწვევა ვერ გაიგზავნა. მონაცემები შენარჩუნებულია; სცადეთ ხელახლა.')).toBeInTheDocument();
            expect(screen.getByLabelText('დაწყების დრო')).toHaveValue('11:00');
            expect(sent).not.toHaveBeenCalled();
            fireEvent.click(screen.getByRole('button', { name: 'მოწვევის გაგზავნა' }));
            await waitFor(() => expect(sent).toHaveBeenCalledWith({ event_id: 79 }));
            expect(vi.mocked(createArrangement).mock.calls[1][0]).toEqual(vi.mocked(createArrangement).mock.calls[0][0]);
            expect(createArrangement).toHaveBeenLastCalledWith(expect.objectContaining({ targetClubId: 3, targetSquadId: 112, officialMode: 'LATER',
                match: expect.objectContaining({ squadId: 103, format: '9_A_SIDE', startsAt: '2099-10-17T11:00', revision: 0 }) }));
        } finally { await act(async () => { await i18n.changeLanguage('en'); }); }
    });
});
