import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../api/axiosConfig';
import i18n from '../../../i18n';
import { getAuthSessionId, setStoredAccessToken, setStoredUserId } from '../../../utils/authStorage';
import { MatchAction } from '../../world/peek/match/MatchAction';
import type { MatchPeekData } from '../../world/peek/match/matchPeekData';
import { clearNotice } from '../../world/peek/stepNotice';
import { ProposeForm } from '../detail/OpponentPanels';
import type { Match, Proposal, Squad } from '../api';

const state = vi.hoisted(() => ({ squads: [] as Squad[] }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ status: 'authenticated', user: { id: 1 }, sessionId: getAuthSessionId() }) }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { post: vi.fn() }, DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost' } }));
vi.mock('../../world/useWorldData', () => ({ useWorldData: () => ({ data: { busy: new Map() } }) }));
vi.mock('../../world/compose/useArrangeableSquads', () => ({ useArrangeableSquadsState: () => ({ squads: state.squads, error: '', retry: vi.fn() }) }));

const squads: Squad[] = [
    { id: 103, club_id: 1, name: 'Our U14', category: 'U14', club_name: 'Our club' },
    { id: 104, club_id: 1, name: 'Our other U14', category: 'U14', club_name: 'Our club' },
];
const match = (patch: Partial<Match> = {}) => ({
    event_id: 58, revision: 4, club_id: 5, club_name: 'Riverside', squad_name: 'Host U14', age_group: 'U14',
    listing_status: 'OPEN', event_status: 'SCHEDULED', starts_at_iso: '2099-10-17T11:00:00Z', ends_at_iso: '2099-10-17T12:30:00Z',
    requested_club_id: null, opponent_club_id: null, can_manage: false, ...patch,
} as Match);
const note = '  Keep this exact draft.\nWe can travel.  ';
const proposal = (status = 'PENDING', patch: Partial<Proposal> = {}): Proposal => ({
    id: 601, squad_id: 103, club_id: 1, squad_name: 'Our U14', club_name: 'Our club', note, status, ...patch,
});
const reload = vi.fn();
const drawerNote = () => screen.getByRole('textbox', { name: 'A word for their coach' });
const pageNote = () => screen.getByRole('textbox', { name: 'Message to the coach' });
const pageSquad = () => screen.getByRole('combobox', { name: 'Your squad' });
const change = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } });
const send = () => fireEvent.click(screen.getByRole('button', { name: 'Offer to play' }));
function Drawer({ listing }: { listing: Match }) {
    return <MemoryRouter><MatchAction data={{ listing, match: { fixtureStatus: 'SCHEDULED' } as MatchPeekData['match'] }} reload={reload} /></MemoryRouter>;
}
function Page({ listing }: { listing: Match }) {
    return <MemoryRouter><ProposeForm match={listing} squads={state.squads} reload={reload} /></MemoryRouter>;
}
async function acknowledge() {
    change(drawerNote(), note); send(); await waitFor(() => expect(reload).toHaveBeenCalledOnce());
}

beforeEach(async () => {
    await i18n.changeLanguage('en'); vi.clearAllMocks();
    // jsdom identity fixtures only; these never establish a browser/server session.
    setStoredUserId(1); setStoredAccessToken('synthetic-offer-lifecycle'); clearNotice();
    state.squads = squads; vi.mocked(apiClient.post).mockReset().mockResolvedValue({ data: {} });
});

describe('acknowledged proposal lifecycle and remaining-squad recovery', () => {
    it('allows another exact offer after the real Withdraw action and a current WITHDRAWN projection, in both entry points', async () => {
        const view = render(<Drawer listing={match()} />); await acknowledge();
        view.rerender(<Drawer listing={match({ revision: 5, proposals: [proposal()] })} />);
        expect(screen.queryByRole('textbox', { name: 'A word for their coach' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }));
        await waitFor(() => expect(reload).toHaveBeenCalledTimes(2));
        expect(apiClient.post).toHaveBeenLastCalledWith('/match-exchange/58/proposals/601/decision', { action: 'WITHDRAW', revision: 5 }, expect.any(Object));
        const resolved = match({ revision: 6, proposals: [proposal('WITHDRAWN')] });
        view.rerender(<Drawer listing={resolved} />);
        expect(drawerNote()).toHaveValue(''); expect(drawerNote()).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Our other U14' })).toBeEnabled();
        view.unmount(); render(<Page listing={resolved} />);
        expect(pageNote()).toBeEnabled(); expect(pageSquad()).toBeEnabled();
        change(pageSquad(), '104'); change(pageNote(), note + '\nA new offer.'); fireEvent.submit(pageNote().closest('form')!);
        await waitFor(() => expect(reload).toHaveBeenCalledTimes(3));
        expect(apiClient.post).toHaveBeenLastCalledWith('/match-exchange/58/proposals', { squadId: 104, note: note + '\nA new offer.', revision: 6 }, expect.objectContaining({ _authSessionId: getAuthSessionId() }));
    });

    it('allows another offer after a newer DECLINED read even if the pending projection was missed while unmounted', async () => {
        const view = render(<Drawer listing={match()} />); await acknowledge(); view.unmount();
        render(<Page listing={match({ revision: 6, proposals: [proposal('DECLINED')] })} />);
        expect(pageNote()).toBeEnabled(); expect(pageSquad()).toBeEnabled();
        change(pageSquad(), '103'); change(pageNote(), 'A revised offer'); fireEvent.submit(pageNote().closest('form')!);
        await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(2));
        expect(vi.mocked(apiClient.post).mock.calls[1][1]).toEqual({ squadId: 103, note: 'A revised offer', revision: 6 });
    });

    it('keeps the acknowledgment lock through empty or stale reads and unrelated proposal identities', async () => {
        const previous = proposal('WITHDRAWN');
        const view = render(<Drawer listing={match({ proposals: [previous] })} />); await acknowledge(); view.unmount();
        const page = render(<Page listing={match({ revision: 4, proposals: [] })} />);
        expect(pageNote()).toBeDisabled(); fireEvent.submit(pageNote().closest('form')!);
        for (const listing of [
            match({ revision: 4, proposals: [previous] }),
            match({ revision: 8, proposals: [] }),
            match({ revision: 8, proposals: [proposal('DECLINED', { squad_id: 104 })] }),
            match({ revision: 8, proposals: [proposal('WITHDRAWN', { id: 999 })] }),
        ]) {
            page.rerender(<Page listing={listing} />);
            expect(pageNote()).toBeDisabled(); expect(pageSquad()).toBeDisabled();
            fireEvent.submit(pageNote().closest('form')!); expect(apiClient.post).toHaveBeenCalledOnce();
        }
        page.rerender(<Page listing={match({ revision: 9, proposals: [previous] })} />);
        expect(pageNote()).toBeEnabled(); expect(apiClient.post).toHaveBeenCalledOnce();
    });

    it('remembers a pending proposal while OfferStep is unmounted, rejecting older reads and a different proposal id', async () => {
        const view = render(<Drawer listing={match()} />); await acknowledge();
        view.rerender(<Drawer listing={match({ revision: 9, proposals: [proposal()] })} />);
        expect(screen.getByRole('button', { name: 'Withdraw' })).toBeInTheDocument();
        view.rerender(<Drawer listing={match({ revision: 6, proposals: [proposal('WITHDRAWN')] })} />);
        expect(drawerNote()).toBeDisabled(); send(); expect(apiClient.post).toHaveBeenCalledOnce();
        view.rerender(<Drawer listing={match({ revision: 10, proposals: [proposal('WITHDRAWN', { id: 999 })] })} />);
        expect(drawerNote()).toBeDisabled(); send(); expect(apiClient.post).toHaveBeenCalledOnce();
        view.rerender(<Drawer listing={match({ revision: 11, proposals: [proposal('WITHDRAWN')] })} />);
        expect(drawerNote()).toBeEnabled(); expect(apiClient.post).toHaveBeenCalledOnce();
    });

    it('does not unlock a current PENDING proposal, including a newer unrelated listing revision', async () => {
        const view = render(<Drawer listing={match()} />); await acknowledge(); view.unmount();
        const page = render(<Page listing={match({ revision: 5, proposals: [proposal()] })} />);
        expect(pageNote()).toBeDisabled();
        page.rerender(<Page listing={match({ revision: 9, proposals: [proposal()] })} />);
        expect(pageNote()).toBeDisabled(); fireEvent.submit(pageNote().closest('form')!); expect(apiClient.post).toHaveBeenCalledOnce();
    });

    it('keeps a live request locked even if a resolved projection arrives before the HTTP acknowledgment', async () => {
        let finish!: (response: { data: object }) => void;
        vi.mocked(apiClient.post).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
        const view = render(<Drawer listing={match({ proposals: [proposal('WITHDRAWN')] })} />);
        change(drawerNote(), note); send();
        view.rerender(<Drawer listing={match({ revision: 6, proposals: [proposal('WITHDRAWN')] })} />);
        expect(drawerNote()).toBeDisabled(); expect(drawerNote()).toHaveValue(note);
        fireEvent.click(screen.getByRole('button', { name: 'Sending…' })); expect(apiClient.post).toHaveBeenCalledOnce();
        await act(async () => finish({ data: {} }));
        expect(drawerNote()).toBeEnabled(); expect(drawerNote()).toHaveValue(''); expect(apiClient.post).toHaveBeenCalledOnce();
    });

    it('waits for current listing eligibility as well as proposal resolution before reopening the form', async () => {
        const view = render(<Drawer listing={match()} />); await acknowledge(); view.unmount();
        const resolved = proposal('DECLINED');
        const page = render(<Page listing={match({ revision: 6, proposals: [resolved], listing_status: 'CLOSED' })} />);
        expect(pageNote()).toBeDisabled();
        page.rerender(<Page listing={match({ revision: 7, proposals: [resolved], can_manage: true })} />); expect(pageNote()).toBeDisabled();
        page.rerender(<Page listing={match({ revision: 8, proposals: [resolved] })} />); expect(pageNote()).toBeEnabled();
        expect(apiClient.post).toHaveBeenCalledOnce();
    });

    it('keeps the exact note and exposes the only remaining eligible squad for explicit selection', async () => {
        const view = render(<Drawer listing={match()} />); change(drawerNote(), note);
        expect(screen.getByRole('button', { name: 'Our U14' })).toHaveAttribute('aria-pressed', 'true');
        state.squads = [squads[1]]; view.rerender(<Drawer listing={match()} />);
        expect(drawerNote()).toHaveValue(note); expect(screen.getByRole('button', { name: 'Offer to play' })).toBeDisabled();
        expect(screen.getByText('Choose the squad that would play.')).toBeInTheDocument();
        const only = screen.getByRole('button', { name: 'Our other U14' }); expect(only).toHaveAttribute('aria-pressed', 'false');
        only.focus(); fireEvent.click(only);
        expect(only).toHaveFocus(); expect(only).toHaveAttribute('aria-pressed', 'true');
        expect(drawerNote()).toHaveValue(note); send();
        await waitFor(() => expect(reload).toHaveBeenCalledOnce());
        expect(apiClient.post).toHaveBeenCalledWith('/match-exchange/58/proposals', { squadId: 104, note, revision: 4 }, expect.objectContaining({ _authSessionId: getAuthSessionId() }));
    });

    it('still uses the existing sole-squad default for a genuinely new draft', () => {
        state.squads = [squads[1]]; render(<Drawer listing={match()} />);
        expect(screen.getByText('Offers Our other U14 to Riverside. They choose one offer; nothing is agreed until they accept.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Offer to play' })).toBeEnabled();
        expect(apiClient.post).not.toHaveBeenCalled();
    });
});
