import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import type { Squad } from '../../matchExchange/api';
import { acceptInvitation, reviewInvitation } from '../../tournaments/api';
import type { TournamentDetail, TournamentEntryDto, TournamentInvitationInboxItem } from '../../tournaments/domain';
import { shared } from '../cache';
import { clearNotice } from '../peek/stepNotice';
import { usePlayerEntryEligibility } from '../../competitions/usePlayerEntryEligibility';
import { loadTournamentPane, type TournamentPaneData } from '../peek/tournament/tournamentPane';
import { TournamentEntry } from '../peek/tournament/TournamentEntry';

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ status: 'authenticated', sessionId: 'entry', user: { id: 1 } }) }));
vi.mock('../../tournaments/api', () => ({ reviewInvitation: vi.fn(), acceptInvitation: vi.fn(), declineInvitation: vi.fn(), requestEntry: vi.fn(), registerPlayer: vi.fn(), withdrawEntry: vi.fn() }));
vi.mock('../../competitions/usePlayerEntryEligibility', () => ({ usePlayerEntryEligibility: vi.fn() }));
vi.mock('../peek/tournament/tournamentPane', async importOriginal => ({ ...await importOriginal<typeof import('../peek/tournament/tournamentPane')>(), loadTournamentPane: vi.fn() }));
const squads: Squad[] = [{ id: 103, club_id: 1, name: 'U14 Boys', category: 'U14', club_name: 'Dinamo' }];
let squadsUnknown = false;
let squadsError = '';
const retrySquads = vi.fn();
vi.mock('../compose/useArrangeableSquads', () => ({ useArrangeableSquadsState: () => ({ squads: squadsUnknown ? undefined : squads, error: squadsError, retry: retrySquads }) }));

const detail = {
    id: 303, name: 'Kutaisi Youth Festival', status: 'PLANNING', participantScope: 'SQUAD', visibility: 'PUBLIC', registrationPolicy: 'OPEN',
    registrationOpensAt: '2020-01-01T00:00:00', registrationClosesAt: '2099-10-28T00:00:00', entryCap: 12, entries: [], staffAssignments: [], stages: [], fixtures: [],
} as unknown as TournamentDetail;
const invitation: TournamentInvitationInboxItem = {
    invitationId: 9, tournamentId: 303, tournamentName: detail.name, tournamentStatus: 'PLANNING', visibility: 'PUBLIC', participantScope: 'SQUAD',
    clubName: 'Dinamo', squadName: null, clubId: 1, squadId: null, status: 'PENDING',
} as TournamentInvitationInboxItem;
const pane = (value: Partial<TournamentPaneData> = {}): TournamentPaneData => ({ detail, rules: null, draw: null, shape: null, host: null, mine: new Set(), canManage: false, invitation, ...value });
const show = (id: number) => render(<MemoryRouter><TournamentEntry tournamentId={id} onChanged={() => {}} otherwise={<p>Nothing to do</p>} /></MemoryRouter>);

beforeEach(() => {
    vi.clearAllMocks();
    clearNotice();
    squadsUnknown = false;
    squadsError = '';
    vi.mocked(usePlayerEntryEligibility).mockReturnValue({ eligible: false, status: 'inactive', retry: vi.fn() });
    vi.mocked(reviewInvitation).mockResolvedValue({ requiresSquad: true, squads: [{ id: 103, name: 'U14 Boys' }] });
});

it.each([true, false])('offers a retry when squad permissions fail (invitation: %s)', async invited => {
    squadsUnknown = true;
    squadsError = 'Permission lookup unavailable';
    vi.mocked(loadTournamentPane).mockResolvedValue(pane({ invitation: invited ? invitation : null }));
    show(invited ? 305 : 306);
    expect(await screen.findByRole('alert')).toHaveTextContent('Whether you can enter could not be checked.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retrySquads).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Accept invitation' })).not.toBeInTheDocument();
    expect(acceptInvitation).not.toHaveBeenCalled();
});

it('continues the invitation on the full page: Accept or Decline, the deadline, never a fresh request', async () => {
    vi.mocked(loadTournamentPane).mockResolvedValue(pane());
    vi.mocked(acceptInvitation).mockResolvedValue({} as never);
    show(303);
    expect(await screen.findByText('Kutaisi Youth Festival invites Dinamo')).toBeInTheDocument();
    expect(screen.getByText('Last day to enter 27 Oct')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
    expect(screen.queryByText(/Request entry/)).not.toBeInTheDocument();
    const accept = await screen.findByRole('button', { name: 'Accept invitation' });
    await waitFor(() => expect(accept).toBeEnabled());
    await act(async () => { fireEvent.click(accept); });
    await waitFor(() => expect(acceptInvitation).toHaveBeenCalledWith(303, 9, 103));
});

it('invalidates tournament and invitation caches after accepting, then shows the saved entry', async () => {
    await shared('tournament:303', async () => 'old detail');
    await shared('tournament-invitations:entry', async () => 'old invitation');
    const entry = { id: 55, clubId: 1, squadId: 103, squadName: 'U14 Boys', status: 'ACTIVE' } as TournamentEntryDto;
    vi.mocked(loadTournamentPane).mockResolvedValueOnce(pane())
        .mockResolvedValue(pane({ invitation: null, detail: { ...detail, entries: [entry] } }));
    vi.mocked(acceptInvitation).mockResolvedValue({} as never);
    show(303);
    const accept = await screen.findByRole('button', { name: 'Accept invitation' });
    await waitFor(() => expect(accept).toBeEnabled());
    await act(async () => { fireEvent.click(accept); });
    expect(loadTournamentPane).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('U14 Boys in')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept invitation' })).not.toBeInTheDocument();
    expect(await shared('tournament:303', async () => 'fresh detail')).toBe('fresh detail');
    expect(await shared('tournament-invitations:entry', async () => 'fresh invitation')).toBe('fresh invitation');
});

it('says the page’s own words when there is nothing to do, and offers a retry when eligibility could not be read', async () => {
    vi.mocked(loadTournamentPane).mockResolvedValue(pane({ invitation: null, detail: { ...detail, participantScope: 'PLAYER' } }));
    const retry = vi.fn();
    vi.mocked(usePlayerEntryEligibility).mockReturnValue({ eligible: false, status: 'ready', retry });
    const { unmount } = show(304);
    expect(await screen.findByText('Nothing to do')).toBeInTheDocument();
    unmount();
    vi.mocked(usePlayerEntryEligibility).mockReturnValue({ eligible: false, status: 'error', retry });
    show(304);
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalled();
    expect(screen.queryByText('Nothing to do')).not.toBeInTheDocument();
});
