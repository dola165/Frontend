import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ClubProfilePage } from '../ClubProfilePage';
import { apiClient } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';
vi.mock('../../api/axiosConfig',()=>({apiClient:{get:vi.fn()}}));
vi.mock('../../context/AuthContext',()=>({useAuth:vi.fn()}));
vi.mock('../../features/joining-contract/api',()=>({fetchJoiningChildren:vi.fn().mockResolvedValue({children:[]}),fetchClubJoiningOptions:vi.fn().mockResolvedValue({options:[]}),submitClubEnquiry:vi.fn()}));
vi.mock('../../features/admissions/api',()=>({fetchAdmissionHome:vi.fn().mockResolvedValue({participants:[]})}));
vi.mock('../../features/clubs/api',()=>({fetchMyClubMembershipContext:vi.fn().mockResolvedValue(null),fetchClubManagementOverview:vi.fn(),dissolveClub:vi.fn()}));
vi.mock('../../components/club/ClubHero',()=>({ClubHero:({onOpenMessage}:{onOpenMessage:()=>void})=><button onClick={onOpenMessage}>Message club</button>}));
vi.mock('../../components/club/ClubProfileStickyHeader',()=>({ClubProfileStickyHeader:()=>null}));
vi.mock('../../components/club/ClubProfileInfoPanel',()=>({ClubProfileInfoPanel:()=>null}));
vi.mock('../../components/club/ClubOverview',()=>({ClubOverview:()=>null}));
const Destination=()=>{const location=useLocation();return <p data-testid="destination">{location.pathname}{location.search}</p>;};
beforeEach(()=>{localStorage.clear();vi.clearAllMocks();vi.mocked(useAuth).mockReturnValue({sessionId:null,status:'authenticated',user:{id:7}} as ReturnType<typeof useAuth>);vi.mocked(apiClient.get).mockResolvedValue({data:{id:1,name:'Dinamo Academy',isStaffMember:false,opportunities:[],honours:[],trustedByClubs:[]}});});
async function open(){render(<MemoryRouter initialEntries={['/clubs/1']}><Routes><Route path="/clubs/:id" element={<ClubProfilePage/>}/><Route path="*" element={<Destination/>}/></Routes></MemoryRouter>);fireEvent.click(await screen.findByRole('button',{name:'Message club'}));}
it('opens a connected general club enquiry instead of an unrelated direct-recipient chooser',async()=>{await open();expect(await screen.findByRole('dialog',{name:'Ask the club'})).toBeInTheDocument();expect(screen.getByLabelText('Enquiry player')).toHaveValue('');expect(screen.queryByLabelText('Send to')).not.toBeInTheDocument();});
it('returns an anonymous general enquiry to the same club after sign-in',async()=>{vi.mocked(useAuth).mockReturnValue({sessionId:null,status:'anonymous',user:null} as ReturnType<typeof useAuth>);await open();fireEvent.click(await screen.findByRole('button',{name:'Sign in to enquire'}));expect(decodeURIComponent((await screen.findByTestId('destination')).textContent??'')).toContain('/clubs/1?tab=teams&enquire=1');});
