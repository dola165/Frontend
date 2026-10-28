import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WorkspacePlayerPanel } from './WorkspacePlayerPanel';
import { apiClient } from '../../api/axiosConfig';
import type { Bootstrap } from './api';
import type { RolesWorkspace } from './useWorkspaceRoles';
import '../../i18n';

vi.mock('../../api/axiosConfig',()=>({apiClient:{get:vi.fn().mockResolvedValue({data:[]}),post:vi.fn().mockResolvedValue({data:{}})}}));
vi.mock('../clubs/api',()=>({fetchClubPlayers:vi.fn().mockResolvedValue({content:[],pageNumber:0,pageSize:50,totalElements:0})}));
const account={id:9};
vi.mock('../../context/AuthContext',()=>({useAuth:()=>({user:{id:account.id,navigationCapabilities:{version:1,workspaces:[]}}})}));
const data:RolesWorkspace={leadership:true,actorId:9,current:{id:'all',label:'All',modules:['DEVELOPMENT'],squadIds:[11,12],clubWide:true,appointmentId:null,revision:null},views:[{id:'coaching',label:'Squad coach',modules:['DEVELOPMENT'],squadIds:[11],clubWide:false,appointmentId:null,revision:null}],catalog:[],requestSquads:[],squads:[{id:11,name:'U12',player_count:1},{id:12,name:'U16',player_count:1}],people:[{id:21,name:'Alex',squad_id:11,squad_name:'U12'},{id:22,name:'Sam',squad_id:12,squad_name:'U16'}],sessions:[],requests:[],invitations:[]};
const boot:Bootstrap={clubId:1,clubName:'Academy',actorId:9,leadership:false,definitions:[],specialisations:[],permissions:[],settings:{setting:'COMMUNITY',playing_level:'AMATEUR',enabled_modules:['DEVELOPMENT','AVAILABILITY'],revision:0},modules:[{id:'DEVELOPMENT',writable:true,globalWrite:false,writeSquads:[11],readSquads:[11]},{id:'AVAILABILITY',writable:false,globalWrite:false,writeSquads:[],readSquads:[11]}],squads:data.squads,people:data.people,staff:[],guardians:[],events:[],sessions:[],venues:[],links:[]};
afterEach(()=>{cleanup();vi.clearAllMocks();localStorage.clear();account.id=9;});

it('saves a draft observation with the exact squad and player, and only loads permitted coach information',async()=>{
  render(<MemoryRouter><WorkspacePlayerPanel player={{id:21,name:'Alex'}} squad={11} squadName="U12" boot={boot} onClose={vi.fn()}/></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Add observation'}));
  fireEvent.change(screen.getByLabelText('Observation'),{target:{value:'Good first touch under pressure.'}});
  fireEvent.change(screen.getByLabelText(/Next steps/),{target:{value:'Practise receiving on the half turn.'}});
  fireEvent.click(screen.getByRole('button',{name:'Save observation'}));
  await screen.findByText(/Observation saved as a draft/);
  expect(apiClient.post).toHaveBeenCalledWith('/clubs/1/operations/records',expect.objectContaining({kind:'OBSERVATION',squadId:11,subjectUserId:21,data:{observation:'Good first touch under pressure.',nextSteps:'Practise receiving on the half turn.'}}));
  expect(vi.mocked(apiClient.get).mock.calls.every(([url])=>!String(url).includes('MEDICAL')&&!String(url).includes('WELFARE'))).toBe(true);
});

it('does not offer observations or request player records for another squad’s permission',async()=>{
  render(<MemoryRouter><WorkspacePlayerPanel player={{id:22,name:'Sam'}} squad={12} squadName="U16" boot={boot} onClose={vi.fn()}/></MemoryRouter>);
  await waitFor(()=>expect(screen.queryByText('Loading player information…')).not.toBeInTheDocument());
  expect(screen.queryByRole('button',{name:'Add observation'})).not.toBeInTheDocument();
  expect(apiClient.get).not.toHaveBeenCalled();
  expect(apiClient.post).not.toHaveBeenCalled();
});
