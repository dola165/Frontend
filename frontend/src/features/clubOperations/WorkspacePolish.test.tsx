import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Users } from 'lucide-react';
import { WorkspaceOverview } from './WorkspaceOverview';
import { WorkspacePlayerPanel } from './SquadWorkbench';
import { useWorkspaceShortcuts } from './workspaceStructure';
import { apiClient } from '../../api/axiosConfig';
import type { Bootstrap } from './api';
import type { RolesWorkspace } from './useWorkspaceRoles';
import type { TabItem } from '../../components/workspace/types';
import '../../i18n';

vi.mock('../../api/axiosConfig',()=>({apiClient:{get:vi.fn().mockResolvedValue({data:[]}),post:vi.fn().mockResolvedValue({data:{}})}}));
vi.mock('../clubs/api',()=>({fetchClubPlayers:vi.fn().mockResolvedValue({content:[],pageNumber:0,pageSize:50,totalElements:0})}));
// Personal-work links require account context; these cases exercise club focus and shortcuts.
vi.mock('../../components/layout/ConnectedWork',()=>({ConnectedWork:()=>null}));
const data:RolesWorkspace={leadership:true,actorId:9,current:{id:'all',label:'All',modules:['DEVELOPMENT'],squadIds:[11,12],clubWide:true,appointmentId:null,revision:null},views:[{id:'coaching',label:'Squad coach',modules:['DEVELOPMENT'],squadIds:[11],clubWide:false,appointmentId:null,revision:null}],catalog:[],requestSquads:[],squads:[{id:11,name:'U12',player_count:1},{id:12,name:'U16',player_count:1}],people:[{id:21,name:'Alex',squad_id:11,squad_name:'U12'},{id:22,name:'Sam',squad_id:12,squad_name:'U16'}],sessions:[],requests:[],invitations:[]};
const boot:Bootstrap={clubId:1,clubName:'Academy',actorId:9,leadership:false,definitions:[],specialisations:[],permissions:[],settings:{setting:'COMMUNITY',playing_level:'AMATEUR',enabled_modules:['DEVELOPMENT','AVAILABILITY'],revision:0},modules:[{id:'DEVELOPMENT',writable:true,globalWrite:false,writeSquads:[11],readSquads:[11]},{id:'AVAILABILITY',writable:false,globalWrite:false,writeSquads:[],readSquads:[11]}],squads:data.squads,people:data.people,staff:[],guardians:[],events:[],sessions:[],venues:[],links:[]};
const tabs:TabItem[]=[{id:'squads',label:'Squads',icon:Users},{id:'travel',label:'Travel',icon:Users},{id:'finance',label:'Finance',icon:Users}];
const onOpen=vi.fn();
function Home({user=9}:{user?:number}) {
  const shortcuts=useWorkspaceShortcuts(1,user,tabs);
  return <WorkspaceOverview data={{...data,actorId:user}} boot={boot} tabs={tabs} shortcuts={shortcuts} onOpen={onOpen} overviewProps={{overview:null,clubId:1,onTabChange:vi.fn(),canManageLeadership:true,canManageOperations:false,upcomingEvents:[],scheduleLoading:false,scheduleError:null,tryoutPendingCount:0,unreadInboxCount:0,onOpenSchedule:vi.fn(),onRetrySchedule:vi.fn()}}/>;
}
afterEach(()=>{cleanup();vi.clearAllMocks();localStorage.clear();});

it('starts with no assigned shortcuts, saves the chosen order and isolates accounts',async()=>{
  const first=render(<MemoryRouter><Home/></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Choose shortcuts'}));
  const dialog=screen.getByRole('dialog',{name:'Your shortcuts'});
  fireEvent.click(within(dialog).getByRole('button',{name:/Squads Your players/}));
  fireEvent.click(within(dialog).getByRole('button',{name:/Travel Organise trips/}));
  fireEvent.click(within(dialog).getByRole('button',{name:'Move Travel up'}));
  expect(JSON.parse(localStorage.getItem('gk-club-shortcuts-v1:1:9')!)).toEqual(['travel','squads']);
  fireEvent.click(within(dialog).getByRole('button',{name:'Done'}));
  expect(within(screen.getByRole('region',{name:'Personal shortcuts'})).getAllByRole('button').slice(1).map(b=>b.textContent)).toEqual(['Travel','Squads']);
  await waitFor(()=>expect(apiClient.get).toHaveBeenCalled());first.unmount();
  render(<MemoryRouter><Home user={10}/></MemoryRouter>);
  expect(screen.getByRole('button',{name:'Choose shortcuts'})).toBeVisible();
  await waitFor(()=>expect(apiClient.get).toHaveBeenCalled());
});

it('personal coaching focus narrows the overview without changing access or submitting role requests',async()=>{
  render(<MemoryRouter><Home/></MemoryRouter>);
  fireEvent.change(screen.getByRole('combobox',{name:'Overview focus'}),{target:{value:'view:coaching'}});
  expect(screen.getByRole('button',{name:/U12 1 players/})).toBeVisible();
  expect(screen.queryByRole('button',{name:/U16 1 players/})).not.toBeInTheDocument();
  expect(localStorage.getItem('gk-club-overview:1:9')).toBe('view:coaching');
  fireEvent.click(screen.getByRole('button',{name:'Choose shortcuts'}));
  expect(within(screen.getByRole('dialog')).getByRole('button',{name:/Finance/})).toBeVisible();
  expect(apiClient.post).not.toHaveBeenCalled();
  await waitFor(()=>expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('module=HOME&squad=11'),expect.anything()));
});

it('saves a draft observation with the exact squad and player, and only loads permitted coach information',async()=>{
  render(<MemoryRouter><WorkspacePlayerPanel player={{id:21,name:'Alex'}} squad={11} squadName="U12" boot={boot} onClose={vi.fn()} onOpen={onOpen}/></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Add observation'}));
  fireEvent.change(screen.getByLabelText('Observation'),{target:{value:'Good first touch under pressure.'}});
  fireEvent.change(screen.getByLabelText(/Next steps/),{target:{value:'Practise receiving on the half turn.'}});
  fireEvent.click(screen.getByRole('button',{name:'Save observation'}));
  await screen.findByText(/Observation saved as a draft/);
  expect(apiClient.post).toHaveBeenCalledWith('/clubs/1/operations/records',expect.objectContaining({kind:'OBSERVATION',squadId:11,subjectUserId:21,data:{observation:'Good first touch under pressure.',nextSteps:'Practise receiving on the half turn.'}}));
  expect(vi.mocked(apiClient.get).mock.calls.every(([url])=>!String(url).includes('MEDICAL')&&!String(url).includes('WELFARE'))).toBe(true);
});

it('does not offer observations or request player records for another squad’s permission',async()=>{
  render(<MemoryRouter><WorkspacePlayerPanel player={{id:22,name:'Sam'}} squad={12} squadName="U16" boot={boot} onClose={vi.fn()} onOpen={onOpen}/></MemoryRouter>);
  await waitFor(()=>expect(screen.queryByText('Loading player information…')).not.toBeInTheDocument());
  expect(screen.queryByRole('button',{name:'Add observation'})).not.toBeInTheDocument();
  expect(apiClient.get).not.toHaveBeenCalled();
  expect(apiClient.post).not.toHaveBeenCalled();
});
