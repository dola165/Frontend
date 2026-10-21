import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '../../../i18n';
import { TournamentPeople } from './TournamentPeople';
import { assignTournamentStaff, searchPlayersForInvite } from '../api';
import type { TournamentDetail } from '../domain';
vi.mock('../api',()=>({assignTournamentStaff:vi.fn(),removeTournamentStaff:vi.fn(),searchPlayersForInvite:vi.fn()}));
vi.mock('../../../context/AuthContext',()=>({useAuth:()=>({user:{id:1}})}));
const tournament={id:3,status:'PLANNING',staffAssignments:[{id:1,userId:1,fullName:'Current admin',role:'ADMIN',status:'ACTIVE'}]} as TournamentDetail;
const renderPeople=(canEdit=true,value=tournament)=>render(<MemoryRouter><TournamentPeople tournament={value} canEdit={canEdit} onUpdate={vi.fn()}/></MemoryRouter>);
it('assigns the explicitly selected person and responsibility through the real contract',async()=>{
    vi.mocked(searchPlayersForInvite).mockResolvedValue([{id:8,username:'operator',fullName:'Organizer member'}]);vi.mocked(assignTournamentStaff).mockResolvedValue(tournament);
    const user=userEvent.setup();renderPeople();await user.type(screen.getByLabelText('Find an existing member'),'Organizer');await user.click(screen.getByRole('button',{name:'Search'}));await screen.findByRole('option',{name:'Organizer member'});await user.selectOptions(screen.getByLabelText('Person'),'8');await user.selectOptions(screen.getByLabelText('Responsibility'),'STAFF');await user.click(screen.getByRole('button',{name:'Assign responsibility'}));expect(assignTournamentStaff).toHaveBeenCalledWith(3,8,'STAFF');expect(await screen.findByRole('status')).toHaveTextContent('updated');
});
it('keeps management controls off non-admin and started tournament views',()=>{
    const view=renderPeople(false);expect(screen.queryByLabelText('Person')).not.toBeInTheDocument();view.unmount();renderPeople(true,{...tournament,status:'ACTIVE'});expect(screen.queryByLabelText('Person')).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:/Remove assignment/})).not.toBeInTheDocument();
});
it('cannot remove your own assignment from the people list',()=>{renderPeople();expect(screen.queryByRole('button',{name:/Remove assignment for Current admin/})).not.toBeInTheDocument();});
