import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../../../i18n';
import { TournamentParticipants } from '../TournamentParticipants';
import { addGuestEntry } from '../../api';
import type { TournamentDetail } from '../../domain';

vi.mock('../../api', () => ({ addGuestEntry: vi.fn(), removeEntry: vi.fn(), updateEntryStatus: vi.fn() }));
vi.mock('../TournamentInvitationsPanel', () => ({ TournamentInvitationsPanel: () => null }));
vi.mock('../CreateTeamModal', () => ({ CreateTeamModal: () => null }));
const tournament = { id: 8, name: 'Community competition', status: 'PLANNING', participantScope: 'CLUB', entries: [], fixtures: [] } as unknown as TournamentDetail;

it.each(['PENDING', 'WAITLISTED'])('reports a %s guest entry without claiming it is ready to play', async status => {
    vi.mocked(addGuestEntry).mockResolvedValue({ ...tournament, entries: [{ id: 11, status, displayName: 'Synthetic visitors' }] } as TournamentDetail);
    render(<MemoryRouter><TournamentParticipants tournament={tournament} canManage onUpdate={vi.fn()} onRefresh={vi.fn()} onBracket={vi.fn()}/></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Add participants' }));
    fireEvent.change(screen.getByLabelText('Club or team name'), { target: { value: 'Synthetic visitors' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add guest club' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Review eligibility before confirming the entry.');
    expect(screen.getByRole('status')).not.toHaveTextContent('ready for the draw');
});

it('keeps the existing immediate receipt when the saved entry is active', async () => {
    vi.mocked(addGuestEntry).mockResolvedValue({ ...tournament, entries: [{ id: 11, status: 'ACTIVE', displayName: 'Synthetic visitors' }] } as TournamentDetail);
    render(<MemoryRouter><TournamentParticipants tournament={tournament} canManage onUpdate={vi.fn()} onRefresh={vi.fn()} onBracket={vi.fn()}/></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Add participants' }));
    fireEvent.change(screen.getByLabelText('Club or team name'), { target: { value: 'Synthetic visitors' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add guest club' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Synthetic visitors is ready for the draw.');
});
