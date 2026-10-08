import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ClubJoiningActions } from './ClubJoiningActions';
const api=vi.hoisted(()=>({fetchClubJoiningOptions:vi.fn()}));
vi.mock('../../features/joining-contract/api',()=>api);
const context={name:'Beginner programme',path:'/clubs/1?tab=teams&programme=22',squadIds:[]};
beforeEach(()=>vi.clearAllMocks());
it('keeps standalone programme groups actionable and preserves the explicitly selected child',async()=>{
  api.fetchClubJoiningOptions.mockResolvedValue({options:[{squadId:null,squadName:'Beginner mornings',programmeIds:[22],availability:'AVAILABLE',opportunity:{id:91,remainingPlaces:2},destination:'/admissions/opportunities/91'},{squadId:null,squadName:'Beginner evenings',programmeIds:[22],availability:'WAITLIST',opportunity:{id:92},destination:'/admissions/opportunities/92'},{squadId:7,squadName:'Other programme',programmeIds:[23],availability:'AVAILABLE',opportunity:{id:93},destination:'/admissions/opportunities/93'}]});
  const onContact=vi.fn();render(<MemoryRouter initialEntries={['/clubs/1?player=24']}><ClubJoiningActions clubId={1} context={context} onContact={onContact}/></MemoryRouter>);
  expect(await screen.findByRole('link',{name:'Review joining & request a place'})).toHaveAttribute('href','/admissions/opportunities/91?player=24');
  expect(screen.getByRole('link',{name:'Review waiting-list request'})).toHaveAttribute('href','/admissions/opportunities/92?player=24');
  expect(screen.queryByText('Other programme')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Ask about Beginner programme'}));expect(onContact).toHaveBeenCalledWith(context);
});
it('explains closed intake and offers an enquiry without an application action',async()=>{
  api.fetchClubJoiningOptions.mockResolvedValue({options:[{squadId:null,squadName:'Closed beginner group',programmeIds:[22],availability:'CLOSED',opportunity:{id:91},destination:'/admissions/opportunities/91'}]});
  render(<MemoryRouter><ClubJoiningActions clubId={1} context={context} onContact={vi.fn()}/></MemoryRouter>);
  expect(await screen.findByText('Intake is currently closed.')).toBeInTheDocument();expect(screen.queryByRole('link')).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Ask about Beginner programme'})).toBeEnabled();
});
