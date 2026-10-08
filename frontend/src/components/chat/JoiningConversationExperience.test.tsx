import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ConversationIntakeContext } from './ConversationIntakeContext';
import type { ConnectedInquiry } from '../../features/joining-contract/types';
const api=vi.hoisted(()=>({fetchConversationEnquiries:vi.fn()}));
vi.mock('../../features/joining-contract/api',()=>api);
vi.mock('../../context/AuthContext',()=>({useAuth:()=>({sessionId:null,user:{id:7,navigationCapabilities:{workspaces:[{id:'club.operations',context:{type:'club',id:1}}]}}})}));
vi.mock('react-i18next',()=>({useTranslation:()=>({i18n:{resolvedLanguage:'en'}})}));
const record=(patch:Partial<ConnectedInquiry>={}):ConnectedInquiry=>({id:81,version:3,conversationId:80,playerId:61,playerName:'Synthetic child',organizationId:1,organizationName:'FC Dinamo Tbilisi Academy',caseId:91,groupId:21,programmeId:14,squadId:11,status:'ROUTED',actions:[],message:'Visit enquiry',history:[],createdAt:'2026-10-04T00:00:00Z',updatedAt:'2026-10-04T00:00:00Z',staffDestination:'/clubs/1/workspace?tab=admissions&caseId=91',applicantDestination:'/admissions/cases/91',conversationDestination:'/messages?conversationId=80',continuation:{applicant:true,staff:false,destination:'/admissions/cases/91'},nextAction:{owner:'APPLICANT',code:'RESPOND_SESSION',label:'Respond to session',dueAt:null},setup:{canConfigure:false,canRequest:false,destination:null,requested:false},...patch});
beforeEach(()=>{localStorage.clear();vi.clearAllMocks();});
it.each(['ROUTED','RESOLVED','DECLINED','WITHDRAWN'] as const)('uses applicant authority for a mixed-role %s record',async status=>{
 api.fetchConversationEnquiries.mockResolvedValue([record({status})]);render(<MemoryRouter><ConversationIntakeContext conversationId={80}/></MemoryRouter>);
 expect(await screen.findByRole('link')).toHaveAttribute('href','/admissions/cases/91');
});
it('uses explicit staff authority for a closed record without inferring from available actions',async()=>{
 api.fetchConversationEnquiries.mockResolvedValue([record({status:'DECLINED',continuation:{applicant:false,staff:true,destination:'/clubs/1/workspace?tab=admissions&caseId=91'}})]);render(<MemoryRouter><ConversationIntakeContext conversationId={80}/></MemoryRouter>);
 expect(await screen.findByRole('link',{name:'Open player arrangement'})).toHaveAttribute('href','/clubs/1/workspace?tab=admissions&caseId=91');
});
it('keeps a person with both permissions at the server-selected applicant continuation',async()=>{
 api.fetchConversationEnquiries.mockResolvedValue([record({continuation:{applicant:true,staff:true,destination:'/admissions/cases/91'}})]);render(<MemoryRouter><ConversationIntakeContext conversationId={80}/></MemoryRouter>);
 expect(await screen.findByRole('link',{name:'View enquiry & next step'})).toHaveAttribute('href','/admissions/cases/91');
});
it('refreshes reply ownership when the connected chat receives a new message',async()=>{
 api.fetchConversationEnquiries.mockResolvedValueOnce([record({status:'OPEN',nextAction:{owner:'CLUB',code:'REPLY',label:'Reply',dueAt:null}})]).mockResolvedValueOnce([record({status:'OPEN',nextAction:{owner:'APPLICANT',code:'REPLY',label:'Reply',dueAt:null}})]);
 const view=render(<MemoryRouter><ConversationIntakeContext conversationId={80} messageRevision={1}/></MemoryRouter>);
 expect(await screen.findByText('The club needs to reply.')).toBeInTheDocument();
 view.rerender(<MemoryRouter><ConversationIntakeContext conversationId={80} messageRevision={2}/></MemoryRouter>);
 expect(await screen.findByText('The player or guardian needs to reply.')).toBeInTheDocument();expect(api.fetchConversationEnquiries).toHaveBeenCalledTimes(2);
});
it('removes stale continuation after authority is revoked and keeps recovery keyboard accessible',async()=>{
 api.fetchConversationEnquiries.mockResolvedValueOnce([record()]).mockRejectedValueOnce({response:{status:403}});
 const view=render(<MemoryRouter><ConversationIntakeContext conversationId={80} messageRevision={1}/></MemoryRouter>);await screen.findByRole('link');
 view.rerender(<MemoryRouter><ConversationIntakeContext conversationId={80} messageRevision={2}/></MemoryRouter>);await screen.findByRole('button',{name:'Retry enquiry context'});
 await waitFor(()=>expect(screen.queryByRole('link')).not.toBeInTheDocument());await userEvent.tab();expect(screen.getByRole('button',{name:'Retry enquiry context'})).toHaveFocus();
});
