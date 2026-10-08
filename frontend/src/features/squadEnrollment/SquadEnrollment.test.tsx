import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { FamilyEnrollmentPage, SquadEnrollmentManager, SquadJoinPage } from './SquadEnrollment';
import * as api from './api';
import { buildLoginRedirectPath, getAuthFlow, clearAuthFlow } from '../../utils/authRedirect';
vi.mock('../../context/AuthContext',()=>({useAuth:()=>({sessionId:'family'})}));
vi.mock('./api',()=>({resolveInvitation:vi.fn(),requestEnrollment:vi.fn(),enrollmentMine:vi.fn(),withdrawEnrollment:vi.fn(),manageEnrollment:vi.fn(),createInvitation:vi.fn(),revokeInvitation:vi.fn(),decideEnrollment:vi.fn()}));
beforeEach(()=>{vi.clearAllMocks();clearAuthFlow();vi.mocked(api.resolveInvitation).mockResolvedValue({squadId:5,squadName:'U12',clubName:'Academy',expiresAt:'2026-12-30',children:[]});vi.mocked(api.manageEnrollment).mockResolvedValue({invitations:[],requests:[],unlinkedCards:[]});});
const join=()=>render(<MemoryRouter initialEntries={['/join-squad#secret-invite']}><SquadJoinPage/></MemoryRouter>);
it('keeps invitation secrets out of login URL while preserving signup continuation',()=>{expect(buildLoginRedirectPath('/join-squad','','#secret')).toBe('/login');expect(getAuthFlow().nextPath).toBe('/join-squad#secret');});
it('requires explicit guardian consent and submits a stable retry identity',async()=>{
    vi.mocked(api.requestEnrollment).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({id:1,status:'PENDING',squadId:5});join();
    await screen.findByText('U12');fireEvent.change(screen.getByLabelText("Child's full name"),{target:{value:'Nika Child'}});fireEvent.change(screen.getByLabelText('Date of birth'),{target:{value:'2015-03-04'}});
    expect(screen.getByRole('button',{name:'Send to coach'})).toBeDisabled();fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Send to coach'}));
    await screen.findByRole('alert');fireEvent.click(screen.getByRole('button',{name:'Send to coach'}));await screen.findByText('Sent to the coach');
    expect(api.requestEnrollment).toHaveBeenCalledTimes(2);expect(vi.mocked(api.requestEnrollment).mock.calls[0][0]).toEqual(vi.mocked(api.requestEnrollment).mock.calls[1][0]);expect(vi.mocked(api.requestEnrollment).mock.calls[0][0]).toMatchObject({token:'secret-invite',consent:true,existingCardId:null,childName:'Nika Child'});
});
it('uses the recorded identity for an already linked child',async()=>{
    vi.mocked(api.resolveInvitation).mockResolvedValue({squadId:5,squadName:'U12',clubName:'Academy',expiresAt:'2026-12-30',children:[{id:9,full_name:'Existing Child',date_of_birth:'2014-01-01'}]});join();await screen.findByText('U12');
    fireEvent.change(screen.getByLabelText('Child'),{target:{value:'9'}});expect(screen.getByLabelText("Child's full name")).toHaveValue('Existing Child');expect(screen.getByLabelText('Date of birth')).toBeDisabled();
});
it('shows unavailable invitation errors without an enrollment form',async()=>{vi.mocked(api.resolveInvitation).mockRejectedValue(new Error('Expired'));join();await screen.findByRole('alert');expect(screen.queryByRole('button',{name:'Send to coach'})).not.toBeInTheDocument();});
it('withdraws a pending request and links approved requests to the squad',async()=>{
    vi.mocked(api.enrollmentMine).mockResolvedValue([{id:1,squad_id:5,child_name:'Nika',status:'PENDING',decision_note:null},{id:2,squad_id:6,child_name:'Ana',status:'APPROVED',decision_note:null}]);vi.mocked(api.withdrawEnrollment).mockResolvedValue({} as never);
    render(<MemoryRouter><FamilyEnrollmentPage/></MemoryRouter>);await screen.findByText('Nika');fireEvent.click(screen.getByRole('button',{name:'Withdraw request'}));await waitFor(()=>expect(api.withdrawEnrollment).toHaveBeenCalledWith(1));expect(screen.getByRole('link',{name:'Open squad'})).toHaveAttribute('href','/squads/6');
});
it('coach can create a revocable link and approve a matching existing card',async()=>{
    vi.mocked(api.manageEnrollment).mockResolvedValue({invitations:[{id:2,expires_at:'2099-01-01',revoked_at:null,max_uses:50,used_count:1}],requests:[{id:1,squad_id:5,child_name:'Nika Child',date_of_birth:'2015-03-04',guardian_name:'Parent',guardian_email:'parent@example.test',existing_card_id:null,status:'PENDING',decision_note:null}],unlinkedCards:[{id:10,full_name:'Nika Child',birth_year:2015,parent_email:'parent@example.test'},{id:11,full_name:'Someone Else',birth_year:2015,parent_email:'parent@example.test'}]});
    vi.mocked(api.createInvitation).mockResolvedValue({id:2,token:'new-secret',expires_at:'2099-01-01',revoked_at:null,max_uses:50,used_count:0});
    render(<MemoryRouter><SquadEnrollmentManager squad={5}/></MemoryRouter>);await screen.findByText('Nika Child · 2015-03-04');fireEvent.click(screen.getByText(/Invite families & review enrollment/));
    fireEvent.click(screen.getByRole('button',{name:'Create invitation'}));await screen.findByDisplayValue(/join-squad#new-secret/);
    expect(api.createInvitation).toHaveBeenCalledWith(5,7,50);expect(screen.queryByRole('option',{name:/Someone Else/})).not.toBeInTheDocument();fireEvent.change(screen.getByLabelText('Player card'),{target:{value:'10'}});
    fireEvent.click(screen.getByRole('button',{name:'Approve & add to squad'}));await waitFor(()=>expect(api.decideEnrollment).toHaveBeenCalledWith(5,1,true,10,''));
});
