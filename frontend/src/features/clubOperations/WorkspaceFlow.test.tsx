import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { Users } from 'lucide-react';
import { WorkspaceHome, WorkspaceTools } from './WorkspaceHome';
import { WorkspaceSquads } from './WorkspaceSquads';
import { WorkspaceOperations } from './WorkspaceOperations';
import { useWorkspaceShortcuts } from './workspaceStructure';
import type { RolesWorkspace } from './useWorkspaceRoles';
import { apiClient } from '../../api/axiosConfig';
import type { Bootstrap } from './api';
import type { TabItem } from '../../components/workspace/types';
vi.mock('../../api/axiosConfig',()=>({apiClient:{get:vi.fn().mockResolvedValue({data:[]}),post:vi.fn(),put:vi.fn()}}));
const data:RolesWorkspace={leadership:false,actorId:9,current:{id:'all',label:'Your club workspace',modules:['ATTENDANCE','TRAVEL'],squadIds:[11,12],clubWide:false,appointmentId:null,revision:null},views:[],catalog:[],requestSquads:[],squads:[{id:11,name:'U12',player_count:1},{id:12,name:'U16',player_count:1}],people:[{id:21,name:'Alex',squad_id:11,squad_name:'U12'},{id:22,name:'Sam',squad_id:12,squad_name:'U16'}],sessions:[{id:31,title:'Monday training',starts_at:'2026-10-05T13:00:00Z',squad_id:11,squad_name:'U12'}],requests:[],invitations:[]};
const boot:Bootstrap={clubId:1,clubName:'Academy',actorId:9,leadership:false,definitions:[{module:'ATTENDANCE',kind:'ATTENDANCE',label:'Attendance',states:[],fields:[]}],specialisations:[],permissions:[],settings:{setting:'COMMUNITY',playing_level:'AMATEUR',enabled_modules:['ATTENDANCE','TRAVEL'],revision:0},modules:[{id:'ATTENDANCE',writable:true,globalWrite:false,writeSquads:[11],readSquads:[11]},{id:'TRAVEL',writable:false,globalWrite:false,writeSquads:[],readSquads:[12]}],squads:data.squads,people:data.people,staff:[],guardians:[],events:[],sessions:data.sessions,venues:[],links:[]};
afterEach(()=>{cleanup();vi.clearAllMocks();localStorage.clear();});
it('opens actual session attendance with squad and session context',async()=>{
 const open=vi.fn();render(<MemoryRouter><WorkspaceHome data={data} boot={boot} tabs={[]} shortcuts={[]} onOpen={open} squad="" onSquad={()=>{}}/></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:'Attendance'}));expect(open).toHaveBeenCalledWith('attendance',{squad:'11',session:'31'});
 await waitFor(()=>expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('/workspace-roles/work?module=HOME'),expect.anything()));
});
it('keeps the selected squad and only offers that squad’s permitted workflows',()=>{
 const open=vi.fn();render(<MemoryRouter><WorkspaceSquads data={data} boot={boot} squad="11" onSquad={()=>{}} onOpen={open} canManage={false}/></MemoryRouter>);
 expect(screen.getByRole('heading',{name:'U12'})).toBeVisible();expect(screen.queryByText('Sam')).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Travel'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByText('More tools'));fireEvent.click(within(screen.getByRole('navigation',{name:'Squad tools'})).getByRole('button',{name:'Attendance & collection'}));expect(open).toHaveBeenCalledWith('attendance',{squad:'11'});
});
it('queries all matching records on the server and carries session context into a new attendance record',async()=>{
 render(<MemoryRouter initialEntries={['/?tab=attendance&squad=11&session=31&person=21&q=Alex']}><WorkspaceOperations boot={boot} module="ATTENDANCE" onRefresh={vi.fn()}/></MemoryRouter>);
 await waitFor(()=>expect(apiClient.get).toHaveBeenCalledWith(expect.stringMatching(/work\?.*q=Alex.*squad=11.*session=31.*person=21/),expect.anything()));
 fireEvent.click(screen.getByRole('button',{name:'Add attendance'}));expect(screen.getByLabelText('Person')).toHaveValue('21');
 fireEvent.change(screen.getByRole('textbox',{name:'Title'}),{target:{value:'Alex training'}});fireEvent.click(screen.getByRole('button',{name:/Continue/}));
 expect(screen.getByLabelText('Squad')).toHaveValue('11');expect(screen.getByLabelText('Training session')).toHaveValue('31');
});
it('lets people pin available tools without changing roles and isolates preferences by account',()=>{
 const tabs:TabItem[]=[{id:'travel',label:'Travel',icon:Users},{id:'attendance',label:'Attendance',icon:Users}];
 function Directory({user}:{user:number}){const pins=useWorkspaceShortcuts(1,user,tabs);return <WorkspaceTools tabs={tabs} shortcuts={pins.ids} onToggle={pins.toggle} onOpen={()=>{}} showHidden={false} onShowHidden={()=>{}} hasHidden={false}/>;}
 const first=render(<Directory user={9}/>);fireEvent.click(screen.getByRole('button',{name:'Pin Travel'}));expect(screen.getByRole('button',{name:'Unpin Travel'})).toHaveAttribute('aria-pressed','true');first.unmount();
 render(<Directory user={10}/>);expect(screen.getByRole('button',{name:'Pin Travel'})).toHaveAttribute('aria-pressed','false');
});
