import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../../i18n';
import { TournamentInbox } from './TournamentInbox';
import { fetchMyTournamentInvitations } from '../api';
vi.mock('../api',()=>({fetchMyTournamentInvitations:vi.fn()}));
it('keeps invitations in the existing request decision flow',async()=>{
    vi.mocked(fetchMyTournamentInvitations).mockResolvedValue({content:[{invitationId:7,tournamentId:3,tournamentName:'Youth cup',tournamentStatus:'PLANNING',visibility:'PRIVATE',participantScope:'SQUAD',clubName:'Dinamo',squadName:'U16 Boys',status:'PENDING'}],pageNumber:0,pageSize:12,totalPages:1,totalElements:1});
    render(<MemoryRouter><TournamentInbox/></MemoryRouter>);expect(await screen.findByText('U16 Boys')).toBeInTheDocument();expect(screen.getByRole('link',{name:'Review in Requests'})).toHaveAttribute('href','/requests');expect(screen.queryByRole('button',{name:/Accept/})).not.toBeInTheDocument();expect(fetchMyTournamentInvitations).toHaveBeenCalledWith(0,12);
});
