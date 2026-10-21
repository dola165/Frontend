import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConversationIntakeContext } from './ConversationIntakeContext';
const api=vi.hoisted(()=>({fetchConversationEnquiries:vi.fn()}));
vi.mock('../../features/joining-contract/api',()=>api);
vi.mock('../../context/AuthContext',()=>({useAuth:()=>({sessionId:null,user:{id:7,navigationCapabilities:{version:1,workspaces:[{id:'club.operations',context:{type:'club',id:1,label:'Dinamo'}}]}}})}));
beforeEach(()=>{localStorage.clear();vi.clearAllMocks();});
it('opens only the persisted enquiry for this conversation at its authorized staff destination',async()=>{
  api.fetchConversationEnquiries.mockResolvedValue([{id:81,conversationId:80,playerName:'Named child',organizationName:'Dinamo',caseId:91,status:'ROUTED',actions:[],continuation:{applicant:false,staff:true,destination:'/clubs/1/workspace?tab=admissions&caseId=91'},staffDestination:'/clubs/1/workspace?tab=admissions&caseId=91',applicantDestination:'/admissions/cases/91'},{id:82,conversationId:99,playerName:'Other child',staffDestination:'/clubs/1/workspace?tab=admissions&inquiryId=82'}]);
  render(<MemoryRouter><ConversationIntakeContext conversationId={80}/></MemoryRouter>);
  expect(await screen.findByRole('link',{name:'Open player arrangement'})).toHaveAttribute('href','/clubs/1/workspace?tab=admissions&caseId=91');
  expect(screen.queryByText('Other child')).not.toBeInTheDocument();
  expect(api.fetchConversationEnquiries).toHaveBeenCalledWith(80,null,expect.any(AbortSignal));
});
it('keeps a general sender at their enquiry even when they also have club navigation',async()=>{
  api.fetchConversationEnquiries.mockResolvedValue([{id:81,conversationId:80,playerName:null,organizationName:'Dinamo',caseId:null,status:'OPEN',actions:['MESSAGE','WITHDRAW','ASSOCIATE_PLAYER'],staffDestination:'/clubs/1/workspace?tab=admissions&inquiryId=81',applicantDestination:'/admissions/inquiries/81'}]);
  render(<MemoryRouter><ConversationIntakeContext conversationId={80}/></MemoryRouter>);
  expect(await screen.findByRole('link',{name:'View enquiry & next step'})).toHaveAttribute('href','/admissions/inquiries/81');
});
it('offers recovery when persisted context is temporarily unavailable',async()=>{
  api.fetchConversationEnquiries.mockRejectedValueOnce(new Error('Interrupted')).mockResolvedValue([]);
  render(<MemoryRouter><ConversationIntakeContext conversationId={80}/></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button',{name:'Retry enquiry context'}));
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
