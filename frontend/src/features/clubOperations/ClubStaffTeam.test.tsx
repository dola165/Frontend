import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/axiosConfig';
import { StaffAppointmentForm } from './StaffAppointmentForm';
import { ClubStaffTeam } from './ClubStaffTeam';
import type { Appointment, Bootstrap } from './api';
vi.mock('../../api/axiosConfig',()=>({apiClient:{get:vi.fn(),post:vi.fn(),put:vi.fn()}}));
const boot:Bootstrap={clubId:1,clubName:'Dinamo',actorId:1,leadership:true,definitions:[],specialisations:['REFEREE','TEAM_MANAGER'],permissions:['FACILITIES:READ'],settings:{setting:'ACADEMY',playing_level:'AMATEUR',enabled_modules:['STAFF','FACILITIES'],revision:0},modules:[],squads:[{id:9,name:'U12 Mixed'}],people:[],staff:[],venues:[],guardians:[],events:[],sessions:[],links:[]};
const appointment:Appointment={id:11,club_id:1,user_id:2,name:'Irakli',title:'Club referee',specialisations:['REFEREE'],engagement:'VOLUNTEER',squad_id:null,permissions:['FACILITIES:READ'],starts_on:'2026-09-25T00:00:00.000Z',ends_on:'2027-06-30T00:00:00.000Z',status:'ACTIVE',revision:3,published:true};
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('edits the existing person with usable calendar dates and sends only after review',async()=>{
  vi.mocked(apiClient.put).mockResolvedValue({data:{}});const saved=vi.fn();render(<StaffAppointmentForm boot={boot} appointment={appointment} onSaved={saved} onCancel={vi.fn()}/>);
  expect(screen.queryByLabelText('Find an account')).not.toBeInTheDocument();expect(screen.getByLabelText('Starts')).toHaveValue('2026-09-25');expect(screen.getByLabelText('Ends (optional)')).toHaveValue('2027-06-30');
  expect(screen.queryByRole('button',{name:'Send revised invitation'})).not.toBeInTheDocument();fireEvent.submit(screen.getByRole('form'));expect(apiClient.put).not.toHaveBeenCalled();expect(screen.getByRole('heading',{name:'Workspace access'})).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Continue'}));fireEvent.click(screen.getByRole('button',{name:'Send revised invitation'}));await waitFor(()=>expect(saved).toHaveBeenCalledOnce());expect(apiClient.put).toHaveBeenCalledWith('/clubs/1/operations/appointments/11',expect.objectContaining({userId:2,startsOn:'2026-09-25',endsOn:'2027-06-30',revision:3}));
});
it('unifies management and specialist appointments by person without granting membership',async()=>{
  vi.mocked(apiClient.get).mockResolvedValue({data:[appointment,{...appointment,id:12,squad_id:9,title:'U12 referee'}]});render(<ClubStaffTeam boot={boot} members={[{userId:1,username:'coach',fullName:'Coach Luka',role:'OWNER',roleEditable:false}]}/>);
  const roster=await screen.findByRole('list',{name:'Club staff'});expect(within(roster).getAllByRole('listitem')).toHaveLength(2);fireEvent.change(screen.getByLabelText('Find staff'),{target:{value:'referee'}});expect(within(roster).getAllByRole('listitem')).toHaveLength(1);fireEvent.click(within(roster).getByRole('listitem'));expect(screen.getByRole('heading',{name:'Irakli'})).toBeVisible();expect(screen.getByRole('heading',{name:'U12 referee'})).toBeVisible();expect(apiClient.post).not.toHaveBeenCalled();
});
it('requires confirmation before ending an appointment',async()=>{
  vi.mocked(apiClient.get).mockResolvedValue({data:[appointment]});vi.mocked(apiClient.post).mockResolvedValue({data:{}});render(<ClubStaffTeam boot={boot}/>);fireEvent.click(await screen.findByRole('listitem'));fireEvent.click(screen.getByRole('button',{name:'End appointment'}));expect(apiClient.post).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Keep appointment'}));expect(screen.queryByRole('button',{name:'Confirm closure'})).not.toBeInTheDocument();
});
it('a referee template proposes only limited club access, never a coaching membership',()=>{
  render(<StaffAppointmentForm boot={boot} initialPerson={{id:2,name:'Irakli'}} roles={[{key:'REFEREE',title:'Club referee',description:'Officiate by invitation.',permissions:['FACILITIES:READ']}]} onSaved={vi.fn()} onCancel={vi.fn()}/>);fireEvent.change(screen.getByLabelText('Role template'),{target:{value:'REFEREE'}});fireEvent.click(screen.getByRole('button',{name:'Continue'}));expect(screen.getByRole('combobox',{name:'Venues & facilities'})).toHaveValue('READ');expect(screen.queryByRole('combobox',{name:'Match arrangements'})).not.toBeInTheDocument();expect(apiClient.post).not.toHaveBeenCalled();
});
