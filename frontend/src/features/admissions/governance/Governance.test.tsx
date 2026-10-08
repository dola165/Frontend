import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { AdmissionGovernancePanel } from './AdmissionGovernancePanel';
import { AdmissionPrivacyRequests,GuardianReviewStatus } from './FamilyGovernance';
const state=vi.hoisted(()=>({session:'governance-session',user:{id:17,role:'SYSTEM_ADMIN'}}));
const client=vi.hoisted(()=>({get:vi.fn(),post:vi.fn()}));
vi.mock('../../../context/AuthContext',()=>({useAuth:()=>({sessionId:state.session,user:state.user})}));
vi.mock('../../../api/axiosConfig',()=>({apiClient:client}));
vi.mock('../../../utils/authStorage',()=>({isCurrentAuthSession:(session:string)=>session===state.session}));
vi.mock('../../squadCommunication/journeyCopy',()=>({useJourneyCopy:()=>((en:string)=>en)}));
beforeEach(()=>{vi.resetAllMocks();state.session='governance-session';});
afterEach(cleanup);

describe('Admission governance authority and receipts',()=>{
    it('does not expose review queues to an unappointed administrator',async()=>{
        client.get.mockResolvedValue({data:[]});render(<AdmissionGovernancePanel/>);
        expect(await screen.findByText(/No reviewers have been appointed/)).toBeVisible();
        expect(screen.queryByRole('button',{name:'Guardian reviews'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button',{name:'Privacy requests'})).not.toBeInTheDocument();
        expect(client.get).toHaveBeenCalledWith('/admin/admissions/reviewers',expect.objectContaining({_authSessionId:'governance-session'}));
    });
    it('loads privacy records only when opened and retries an uncertain submission with the same UUID',async()=>{
        client.get.mockResolvedValue({data:[]});client.post.mockRejectedValueOnce(new Error('Connection interrupted')).mockResolvedValueOnce({data:[]});
        render(<AdmissionPrivacyRequests caseId={42}/>);expect(client.get).not.toHaveBeenCalled();
        const details=screen.getByText('My admission data and privacy requests').closest('details')!;
        details.open=true;fireEvent(details,new Event('toggle'));
        fireEvent.change(await screen.findByLabelText('Applicable country'),{target:{value:'GE'}});
        fireEvent.change(screen.getByLabelText('What would you like us to review?'),{target:{value:'Please provide my admission information.'}});
        fireEvent.click(screen.getByRole('button',{name:'Submit privacy request'}));
        await screen.findByRole('alert');fireEvent.click(screen.getByRole('button',{name:'Retry same request'}));
        await waitFor(()=>expect(client.post).toHaveBeenCalledTimes(2));
        expect(client.post.mock.calls[0][1]).toEqual(client.post.mock.calls[1][1]);
        expect(client.post.mock.calls[0][1].requestId).toMatch(/^[a-f0-9-]{36}$/);
        expect(client.post.mock.calls[1][2]._authSessionId).toBe('governance-session');
    });
    it('does not render a private response after the authenticated session changes',async()=>{
        let resolve!:(value:unknown)=>void;client.get.mockImplementation(()=>new Promise(done=>{resolve=done;}));
        render(<GuardianReviewStatus playerId={8}/>);
        state.session='different-account';resolve({data:{playerId:8,status:'REVIEW',version:1,updatedAt:null,outcome:null}});
        await waitFor(()=>expect(client.get).toHaveBeenCalledTimes(1));
        expect(screen.queryByText('New commitments are paused for platform guardian review.')).not.toBeInTheDocument();
    });
    it('shows a hold and keeps minimisation unavailable even to an appointed reviewer',async()=>{
        client.get.mockImplementation((path:string)=>Promise.resolve({data:path.endsWith('/reviewers')?[{userId:17,name:'Reviewer',capability:'PRIVACY_REVIEWER',active:true,version:1,policyReference:'POL-1'}]:path.includes('/retention/42/')?{caseId:42,caseVersion:2,review:{category:'CASE_NOTES',version:1,country:'EE',purpose:'Evidence hold',policyReference:'POL-1',hold:true,nextReview:'2026-10-04',minimizedAt:null},copies:{'case messages':2},blockers:['This category has a documented retention hold.'],previewHash:'abc'}:[{caseId:42,playerId:8,stage:'CLOSED',updatedAt:'2026-10-04T00:00:00Z',nextReview:null}]}));
        render(<AdmissionGovernancePanel/>);fireEvent.click(await screen.findByRole('button',{name:'Retention reviews'}));
        fireEvent.click(await screen.findByRole('button',{name:'Review retention'}));
        expect(await screen.findByText('This category has a documented retention hold.')).toBeVisible();
        expect(screen.queryByRole('button',{name:'Minimise listed copies'})).not.toBeInTheDocument();
    });
});
