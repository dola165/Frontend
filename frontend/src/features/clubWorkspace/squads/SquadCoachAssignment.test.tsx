import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as squadApi from '../../squadCommunication/api';
import { getAuthSessionId, setStoredAccessToken } from '../../../utils/authStorage';
import { SquadCoachAssignment } from './SquadCoachAssignment';
import '../../../i18n';

vi.mock('../../squadCommunication/api', () => ({ overview: vi.fn(), assignCoach: vi.fn() }));
const props = { clubId: 400, squadId: 401, squadName: 'Review U12', actorId: 9500 };
const first = { user_id: 9500, full_name: 'Confirmed club coach' }, second = { user_id: 9501, full_name: 'Another club coach' };
const overview = (changes: Partial<squadApi.SquadOverview> = {}): squadApi.SquadOverview => ({
    id: 401, club_id: 400, viewer_id: 9500, academy_name: 'Fixture academy', name: 'Review U12', category: 'U12',
    can_manage: true, unread_count: 0, member_count: 0, notify_chat: true, head_coach_id: null,
    can_assign_coach: true, available_coaches: [first, second], coaches: [], players: [], threads: [], ...changes,
});
const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
};
const mount = () => render(<MemoryRouter><SquadCoachAssignment {...props} /></MemoryRouter>);
const choose = async (id = '9500') => fireEvent.change(await screen.findByRole('combobox', { name: 'Head coach' }), { target: { value: id } });
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save coach' }));
beforeEach(() => {
    vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear(); setStoredAccessToken('assignment-unit-fixture');
    vi.mocked(squadApi.overview).mockResolvedValue(overview());
    vi.mocked(squadApi.assignCoach).mockResolvedValue({ data: {} } as Awaited<ReturnType<typeof squadApi.assignCoach>>);
});
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); });

describe('explicit current-club head coach assignment', () => {
    it('requires an eligible choice and one explicit save, capturing the login and preventing repeated pending saves', async () => {
        const write = deferred<Awaited<ReturnType<typeof squadApi.assignCoach>>>();
        vi.mocked(squadApi.assignCoach).mockReturnValue(write.promise);
        vi.mocked(squadApi.overview).mockResolvedValueOnce(overview()).mockResolvedValue(overview({ head_coach_id: 9500, coaches: [first] }));
        const sessionId = getAuthSessionId(); mount();
        expect(await screen.findByRole('combobox', { name: 'Head coach' })).toHaveValue('');
        expect(screen.getByRole('button', { name: 'Save coach' })).toBeDisabled();
        expect(squadApi.assignCoach).not.toHaveBeenCalled(); await choose();
        expect(squadApi.assignCoach).not.toHaveBeenCalled();
        const form = screen.getByRole('button', { name: 'Save coach' }).closest('form')!;
        fireEvent.submit(form); fireEvent.submit(form);
        expect(vi.mocked(squadApi.assignCoach).mock.calls).toStrictEqual([[401, 9500, sessionId]]);
        await act(async () => { write.resolve({ data: {} } as Awaited<ReturnType<typeof squadApi.assignCoach>>); });
        await screen.findByText('Coach saved: Confirmed club coach.');
        expect(await screen.findByRole('combobox', { name: 'Head coach' })).toHaveValue('9500');
        expect(screen.getByRole('button', { name: 'Save coach' })).toBeDisabled();
        expect(screen.getByRole('link', { name: 'My squads' })).toHaveAttribute('href', '/my-squads?clubId=400');
        expect(squadApi.assignCoach).toHaveBeenCalledOnce();
    });

    it('preserves an existing head who is no longer eligible and never clears it implicitly', async () => {
        vi.mocked(squadApi.overview).mockResolvedValue(overview({ head_coach_id: 9502, coaches: [{ user_id: 9502, full_name: 'Existing head' }] }));
        mount(); expect(await screen.findByRole('combobox', { name: 'Head coach' })).toHaveValue('9502');
        expect(screen.getByRole('option', { name: 'Existing head' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Save coach' })).toBeDisabled();
        await choose(''); expect(screen.getByRole('button', { name: 'Save coach' })).toBeDisabled();
        expect(squadApi.assignCoach).not.toHaveBeenCalled();
    });

    it('changes another coach explicitly without suggesting that the leader gained personal coaching', async () => {
        vi.mocked(squadApi.overview).mockResolvedValueOnce(overview({ head_coach_id: 9500, coaches: [first] }))
            .mockResolvedValue(overview({ head_coach_id: 9501, coaches: [second] }));
        mount(); await choose('9501'); save(); await screen.findByText('Coach saved: Another club coach.');
        expect(vi.mocked(squadApi.assignCoach).mock.calls).toStrictEqual([[401, 9501, getAuthSessionId()]]);
        expect(screen.queryByRole('link', { name: 'My squads' })).not.toBeInTheDocument();
    });

    it('keeps server view-only permission even when the viewer is a coach', async () => {
        vi.mocked(squadApi.overview).mockResolvedValue(overview({ can_assign_coach: false, available_coaches: [], head_coach_id: 9500, coaches: [first] }));
        mount(); await screen.findByText(/View only. Current head coach:.*Confirmed club coach/);
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Save coach' })).not.toBeInTheDocument();
        expect(squadApi.assignCoach).not.toHaveBeenCalled();
    });

    it('reports no eligible club coaches without manufacturing an owner choice', async () => {
        vi.mocked(squadApi.overview).mockResolvedValue(overview({ available_coaches: [] }));
        mount(); await screen.findByText('No eligible club coaches are available yet.');
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument(); expect(squadApi.assignCoach).not.toHaveBeenCalled();
    });

    it('still displays the current head when no replacement coach is eligible', async () => {
        vi.mocked(squadApi.overview).mockResolvedValue(overview({ available_coaches: [], head_coach_id: 9502, coaches: [{ user_id: 9502, full_name: 'Existing head' }] }));
        mount(); await screen.findByText(/Current head coach:.*Existing head/);
        expect(screen.getByText('No eligible club coaches are available yet.')).toBeInTheDocument();
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument(); expect(squadApi.assignCoach).not.toHaveBeenCalled();
    });

    it.each([{ club_id: 500 }, { id: 501 }, { viewer_id: 9600 }])('refuses a canonical response for the wrong club, squad or actor: %j', async wrong => {
        vi.mocked(squadApi.overview).mockResolvedValue(overview(wrong)); mount();
        await screen.findByRole('alert'); expect(screen.getByRole('alert')).toHaveTextContent('Coach details could not be confirmed for this squad.');
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument(); expect(squadApi.assignCoach).not.toHaveBeenCalled();
    });

    it('shows a refused read honestly and retries only the canonical read', async () => {
        vi.mocked(squadApi.overview).mockRejectedValueOnce({ response: { status: 403, data: { message: 'Club access refused.' } } }).mockResolvedValue(overview());
        mount(); expect(await screen.findByRole('alert')).toHaveTextContent('Club access refused.');
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Refresh coach details' }));
        await screen.findByRole('combobox', { name: 'Head coach' }); expect(squadApi.overview).toHaveBeenCalledTimes(2);
        expect(squadApi.assignCoach).not.toHaveBeenCalled();
    });

    it('keeps a known save when the following read fails and retries refresh without another write', async () => {
        vi.mocked(squadApi.overview).mockResolvedValueOnce(overview()).mockRejectedValueOnce(new Error('read unavailable'))
            .mockResolvedValue(overview({ head_coach_id: 9500, coaches: [first] }));
        mount(); await choose(); save(); await screen.findByText('Coach saved: Confirmed club coach.'); await screen.findByRole('alert');
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument(); expect(squadApi.assignCoach).toHaveBeenCalledOnce();
        fireEvent.click(screen.getByRole('button', { name: 'Refresh coach details' }));
        await screen.findByRole('combobox', { name: 'Head coach' }); expect(squadApi.assignCoach).toHaveBeenCalledOnce();
        expect(screen.getByRole('button', { name: 'Save coach' })).toBeDisabled();
    });

    it('reconciles an unknown write outcome before offering any retry', async () => {
        vi.mocked(squadApi.assignCoach).mockRejectedValue(new Error('connection lost'));
        vi.mocked(squadApi.overview).mockResolvedValueOnce(overview()).mockResolvedValue(overview({ head_coach_id: 9500, coaches: [first] }));
        mount(); await choose(); save(); await screen.findByRole('alert');
        expect(screen.queryByText('Coach saved: Confirmed club coach.')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save coach' })).toBeDisabled();
        fireEvent.submit(screen.getByRole('button', { name: 'Save coach' }).closest('form')!);
        expect(squadApi.assignCoach).toHaveBeenCalledOnce();
        fireEvent.click(screen.getByRole('button', { name: 'Refresh coach details' }));
        await waitFor(() => expect(screen.getByRole('combobox', { name: 'Head coach' })).toHaveValue('9500'));
        expect(screen.getByRole('button', { name: 'Save coach' })).toBeDisabled(); expect(squadApi.assignCoach).toHaveBeenCalledOnce();
    });

    it('removes mutation controls after a server refusal followed by canonical permission loss', async () => {
        vi.mocked(squadApi.assignCoach).mockRejectedValue({ response: { status: 403, data: { message: 'Assignment refused.' } } });
        vi.mocked(squadApi.overview).mockResolvedValueOnce(overview()).mockResolvedValue(overview({ can_assign_coach: false, available_coaches: [] }));
        mount(); await choose(); save(); expect(await screen.findByRole('alert')).toHaveTextContent('Assignment refused.');
        expect(screen.getByRole('button', { name: 'Save coach' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Refresh coach details' })); await screen.findByText(/View only/);
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument(); expect(squadApi.assignCoach).toHaveBeenCalledOnce();
    });

    it('refuses a retired login before submitting, even before its browser event is delivered', async () => {
        mount(); await choose(); localStorage.setItem('gk-session-id', 'retired-without-event'); save();
        await screen.findByText(/Your sign-in changed/); expect(squadApi.assignCoach).not.toHaveBeenCalled();
    });

    it('discards a delayed read after login retirement', async () => {
        const read = deferred<squadApi.SquadOverview>(); vi.mocked(squadApi.overview).mockReturnValue(read.promise); mount();
        act(() => setStoredAccessToken('other-fixture-login'));
        await act(async () => { read.resolve(overview()); });
        await screen.findByText(/Your sign-in changed/); expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        expect(squadApi.assignCoach).not.toHaveBeenCalled();
    });

    it('discards a delayed acknowledged write after login retirement without refreshing or showing success', async () => {
        const write = deferred<Awaited<ReturnType<typeof squadApi.assignCoach>>>(); vi.mocked(squadApi.assignCoach).mockReturnValue(write.promise);
        mount(); await choose(); save(); const captured = getAuthSessionId(); act(() => setStoredAccessToken('other-fixture-login'));
        await act(async () => { write.resolve({ data: {} } as Awaited<ReturnType<typeof squadApi.assignCoach>>); });
        await screen.findByText(/Your sign-in changed/); expect(screen.queryByText(/Coach saved:/)).not.toBeInTheDocument();
        expect(vi.mocked(squadApi.assignCoach).mock.calls).toStrictEqual([[401, 9500, captured]]); expect(squadApi.overview).toHaveBeenCalledOnce();
    });

    it('discards a delayed old-squad read when selection changes', async () => {
        const old = deferred<squadApi.SquadOverview>(); vi.mocked(squadApi.overview).mockReturnValueOnce(old.promise)
            .mockResolvedValue(overview({ id: 402, name: 'Review U14', head_coach_id: 9501, coaches: [second] }));
        const view = mount(); view.rerender(<MemoryRouter><SquadCoachAssignment {...props} squadId={402} squadName="Review U14" /></MemoryRouter>);
        await waitFor(() => expect(screen.getByRole('combobox', { name: 'Head coach' })).toHaveValue('9501'));
        await act(async () => { old.resolve(overview()); });
        expect(screen.getByRole('combobox', { name: 'Head coach' })).toHaveValue('9501');
        expect(screen.getByText('Review U14')).toBeInTheDocument(); expect(squadApi.assignCoach).not.toHaveBeenCalled();
    });

    it('never carries a delayed save receipt or refresh into a different selected squad', async () => {
        const write = deferred<Awaited<ReturnType<typeof squadApi.assignCoach>>>(); vi.mocked(squadApi.assignCoach).mockReturnValue(write.promise);
        vi.mocked(squadApi.overview).mockResolvedValueOnce(overview()).mockResolvedValue(overview({ id: 402, name: 'Review U14' }));
        const view = mount(); await choose(); save();
        view.rerender(<MemoryRouter><SquadCoachAssignment {...props} squadId={402} squadName="Review U14" /></MemoryRouter>);
        await screen.findByRole('combobox', { name: 'Head coach' });
        await act(async () => { write.resolve({ data: {} } as Awaited<ReturnType<typeof squadApi.assignCoach>>); });
        expect(screen.queryByText(/Coach saved:/)).not.toBeInTheDocument(); expect(squadApi.overview).toHaveBeenCalledTimes(2);
        expect(squadApi.assignCoach).toHaveBeenCalledOnce(); expect(screen.getByText('Review U14')).toBeInTheDocument();
    });
});
