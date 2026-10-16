import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import type { Squad } from '../../matchExchange/api';
import { acceptInvitation, reviewInvitation } from '../../tournaments/api';
import type { TournamentDetail, TournamentInvitationInboxItem } from '../../tournaments/domain';
import { usePlayerEntryEligibility } from '../../competitions/usePlayerEntryEligibility';
import { loadTournamentPane, type TournamentPaneData } from '../peek/tournament/tournamentPane';
import { TournamentEntry } from '../peek/tournament/TournamentEntry';

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ status: 'authenticated', sessionId: 'entry', user: { id: 1 } }) }));
vi.mock('../../tournaments/api', () => ({ reviewInvitation: vi.fn(), acceptInvitation: vi.fn(), declineInvitation: vi.fn(), requestEntry: vi.fn(), registerPlayer: vi.fn(), withdrawEntry: vi.fn() }));
vi.mock('../../competitions/usePlayerEntryEligibility', () => ({ usePlayerEntryEligibility: vi.fn() }));
vi.mock('../peek/tournament/tournamentPane', async importOriginal => ({ ...await importOriginal<typeof import('../peek/tournament/tournamentPane')>(), loadTournamentPane: vi.fn() }));
const squads: Squad[] = [{ id: 103, club_id: 1, name: 'U14 Boys', category: 'U14', club_name: 'Dinamo' }];
vi.mock('../compose/useArrangeableSquads', () => ({ useArrangeableSquadsState: () => ({ squads, error: '', retry: () => {} }) }));

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
    vi.mocked(usePlayerEntryEligibility).mockReturnValue({ eligible: false, status: 'inactive', retry: vi.fn() });
    vi.mocked(reviewInvitation).mockResolvedValue({ requiresSquad: true, squads: [{ id: 103, name: 'U14 Boys' }] });
});

it('continues the invitation on the full page: Accept or Decline, the deadline, never a fresh request', async () => {
    vi.mocked(loadTournamentPane).mockResolvedValue(pane());
    vi.mocked(acceptInvitation).mockResolvedValue({} as never);
    show(303);
    expect(await screen.findByText('Kutaisi Youth Festival invites Dinamo')).toBeInTheDocument();
    expect(screen.getByText('Last day to enter 27 Oct')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
    expect(screen.queryByText(/Request entry/)).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Accept invitation' }));
    await waitFor(() => expect(acceptInvitation).toHaveBeenCalledWith(303, 9, 103));
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
