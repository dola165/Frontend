import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecruitmentApplication, type RecruitmentReceipt } from './RecruitmentApplication';
const api=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),refresh:vi.fn()}));
vi.mock('../../api/axiosConfig',()=>({apiClient:api}));
vi.mock('../../context/AuthContext',()=>({useAuth:()=>({refreshNavigationCapabilities:api.refresh})}));
const receipt:RecruitmentReceipt={id:5,clubId:1,clubName:'Dinamo',applicantName:'Alex',role:'COACH',status:'OFFERED',jobId:1,jobTitle:'Goalkeeper coach',message:null,decisionMessage:null,canRespond:true,canWithdraw:true,canOffer:false,canCancelOffer:false,unavailableReason:null,offer:{title:'U14 goalkeepers',specialism:'GOALKEEPER_COACH',squad_name:'U14',engagement:'VOLUNTEER',starts_on:'2026-10-01',ends_on:null,expires_at:'2026-10-10',permissions:['DEVELOPMENT:WRITE'],message:'Meet the team',appointment_id:null}};
function show(r:RecruitmentReceipt=receipt){render(<MemoryRouter><RecruitmentApplication applicationId={r.id} initial={r}/></MemoryRouter>);}
afterEach(cleanup);beforeEach(()=>{vi.resetAllMocks();api.refresh.mockResolvedValue(undefined);api.get.mockResolvedValue({data:{...receipt,status:'ACCEPTED',canRespond:false,canWithdraw:false}});api.post.mockResolvedValue({});});
describe('Recruitment offer consent',()=>{
 it('sends selected academy teams without granting the whole club',async()=>{
  api.get.mockResolvedValueOnce({data:{specialisms:[{key:'SET_PIECE_COACH',title:'Set-piece coach',description:'Preparation',permissions:['MATCHES:READ']}],squads:[{id:11,name:'Academy U12'},{id:12,name:'Academy U16'},{id:13,name:'First team'}]}});
  show({...receipt,status:'PENDING',offer:null,canOffer:true,canRespond:false});fireEvent.click(screen.getByRole('button',{name:'Prepare offer'}));
  fireEvent.change(await screen.findByLabelText('Coaching specialism'),{target:{value:'SET_PIECE_COACH'}});
  fireEvent.click(screen.getByLabelText('Academy U12'));fireEvent.click(screen.getByLabelText('Academy U16'));fireEvent.change(screen.getByLabelText('Engagement'),{target:{value:'VOLUNTEER'}});
  expect(screen.getByLabelText('First team')).not.toBeChecked();fireEvent.click(screen.getByRole('button',{name:'Send offer'}));
  await waitFor(()=>expect(api.post).toHaveBeenCalledWith('/recruitment/applications/5/offer',expect.objectContaining({specialism:'SET_PIECE_COACH',squadIds:[11,12],clubWide:false})));
 });
 it('shows actual scope and access before asking for acceptance',()=>{show();expect(screen.getByText('U14')).toBeTruthy();expect(screen.getByText('development: write')).toBeTruthy();expect(screen.getByText(/Employment terms and qualifications/)).toBeTruthy();expect(api.post).not.toHaveBeenCalled();});
 it('requires confirmation, records acceptance once and refreshes authority',async()=>{show();fireEvent.click(screen.getByRole('button',{name:'Review acceptance'}));expect(api.post).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Accept offer'}));await waitFor(()=>expect(api.refresh).toHaveBeenCalledTimes(1));expect(api.post).toHaveBeenCalledExactlyOnceWith('/recruitment/applications/5/respond',{accept:true});expect(screen.queryByRole('button',{name:'Review acceptance'})).toBeNull();});
 it('lets the applicant leave a confirmation without a write',()=>{show();fireEvent.click(screen.getByRole('button',{name:'Decline offer'}));fireEvent.click(screen.getByRole('button',{name:'Keep reviewing'}));expect(api.post).not.toHaveBeenCalled();});
 it('shows stale-offer reason and withdrawal without acceptance',()=>{show({...receipt,status:'EXPIRED',canRespond:false,unavailableReason:'The job changed or closed after this offer was sent.'});expect(screen.getByText(/The job changed/)).toBeTruthy();expect(screen.queryByRole('button',{name:'Review acceptance'})).toBeNull();expect(screen.getByRole('button',{name:'Withdraw application'})).toBeTruthy();});
 it('does not claim success on a failed response and offers receipt reload',async()=>{api.post.mockRejectedValue(new Error('connection interrupted'));show();fireEvent.click(screen.getByRole('button',{name:'Review acceptance'}));fireEvent.click(screen.getByRole('button',{name:'Accept offer'}));await screen.findByRole('button',{name:'Reload receipt'});expect(api.refresh).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Accept offer'})).toBeTruthy();});
 it('preserves an ended appointment as accepted history',()=>{show({...receipt,status:'ACCEPTED',canRespond:false,canWithdraw:false,appointment:{status:'ENDED'}});expect(screen.getByText(/Recorded appointment: ended/)).toBeTruthy();expect(screen.queryByRole('button',{name:'Review acceptance'})).toBeNull();});
});
