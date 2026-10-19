import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Users } from 'lucide-react';
import { WorkspacePlayerPanel } from './WorkspacePlayerPanel';
import { ClubOverview } from '../clubWorkspace/overview/ClubOverview';
import { AllTools } from '../clubWorkspace/AllTools';
import { useWorkspacePins } from '../clubWorkspace/useWorkspacePins';
import { readPins } from '../../components/layout/header/pins/pinStore';
import { apiClient } from '../../api/axiosConfig';
import type { Bootstrap } from './api';
import type { RolesWorkspace } from './useWorkspaceRoles';
import type { TabItem } from '../../components/workspace/types';
import '../../i18n';

vi.mock('../../api/axiosConfig',()=>({apiClient:{get:vi.fn().mockResolvedValue({data:[]}),post:vi.fn().mockResolvedValue({data:{}})}}));
vi.mock('../clubs/api',()=>({fetchClubPlayers:vi.fn().mockResolvedValue({content:[],pageNumber:0,pageSize:50,totalElements:0})}));
const account={id:9};
vi.mock('../../context/AuthContext',()=>({useAuth:()=>({user:{id:account.id,navigationCapabilities:{version:1,workspaces:[]}}})}));
const data:RolesWorkspace={leadership:true,actorId:9,current:{id:'all',label:'All',modules:['DEVELOPMENT'],squadIds:[11,12],clubWide:true,appointmentId:null,revision:null},views:[{id:'coaching',label:'Squad coach',modules:['DEVELOPMENT'],squadIds:[11],clubWide:false,appointmentId:null,revision:null}],catalog:[],requestSquads:[],squads:[{id:11,name:'U12',player_count:1},{id:12,name:'U16',player_count:1}],people:[{id:21,name:'Alex',squad_id:11,squad_name:'U12'},{id:22,name:'Sam',squad_id:12,squad_name:'U16'}],sessions:[],requests:[],invitations:[]};
const boot:Bootstrap={clubId:1,clubName:'Academy',actorId:9,leadership:false,definitions:[],specialisations:[],permissions:[],settings:{setting:'COMMUNITY',playing_level:'AMATEUR',enabled_modules:['DEVELOPMENT','AVAILABILITY'],revision:0},modules:[{id:'DEVELOPMENT',writable:true,globalWrite:false,writeSquads:[11],readSquads:[11]},{id:'AVAILABILITY',writable:false,globalWrite:false,writeSquads:[],readSquads:[11]}],squads:data.squads,people:data.people,staff:[],guardians:[],events:[],sessions:[],venues:[],links:[]};
const tabs:TabItem[]=[{id:'squads',label:'Squads',icon:Users},{id:'travel',label:'Travel',icon:Users},{id:'finance',label:'Finance',icon:Users}];
const onOpen=vi.fn();
function Tools() {
  const pins=useWorkspacePins(1,tabs,true);
  return <AllTools tabs={tabs} pins={pins} focus="all" onOpen={onOpen} showHidden={false} onShowHidden={vi.fn()} hasHidden={false}/>;
}
const schedule={events:[],loading:false,error:null,retry:vi.fn(),open:vi.fn(),openEvent:vi.fn()};
afterEach(()=>{cleanup();vi.clearAllMocks();localStorage.clear();account.id=9;});

it('pins tools as top-bar pins, keeps the chosen order and isolates accounts',()=>{
  const first=render(<MemoryRouter><Tools/></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Pin Squads'}));
  fireEvent.click(screen.getByRole('button',{name:'Pin Travel'}));
  fireEvent.click(screen.getByRole('button',{name:'Move Travel up'}));
  expect(readPins(9).map(pin=>pin.path)).toEqual(['/clubs/1/workspace?tab=travel','/clubs/1/workspace?tab=squads']);
  first.unmount();
  account.id=10;
  render(<MemoryRouter><Tools/></MemoryRouter>);
  expect(screen.getByText('Nothing pinned yet')).toBeVisible();
});

it('carries shortcuts chosen before pins existed over once',()=>{
  account.id=11;
  localStorage.setItem('gk-club-shortcuts-v1:1:11',JSON.stringify(['travel','unknown']));
  render(<MemoryRouter><Tools/></MemoryRouter>);
  expect(readPins(11).map(pin=>pin.path)).toEqual(['/clubs/1/workspace?tab=travel']);
  expect(localStorage.getItem('gk-club-shortcuts-v1:1:11')).toBeNull();
});

// My club shows every squad; a squad focus belongs to My squads now (the overview's focus chips went on 10 October).
it('opens one squad from the overview without changing access or submitting role requests',()=>{
  render(<MemoryRouter><ClubOverview clubId={1} clubName="Academy" overview={null} roles={data} boot={boot} schedule={schedule} unreadInbox={0} inboxAllowed={false} tryoutPending={0}
    canManageOperations={false} canManageLeadership tabs={tabs} pinned={[]} onOpen={onOpen}/></MemoryRouter>);
  expect(screen.getByRole('button',{name:/^U16/})).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:/^U12\s*1 player/}));
  expect(onOpen).toHaveBeenCalledExactlyOnceWith('squads',{squad:'11'});
  expect(screen.getByRole('button',{name:/^U16/})).toBeVisible();
  expect(apiClient.post).not.toHaveBeenCalled();
});

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
