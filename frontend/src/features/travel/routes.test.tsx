import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { OfficeTool } from '../clubOffice/OfficeTool';
import { ChildPage } from '../parents/hub/ChildPage';
import type { Bootstrap } from '../clubOperations/api';
import type { JoiningChild } from '../joining-contract/types';

const api=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),put:vi.fn()}));
vi.mock('../../api/axiosConfig',()=>({apiClient:api}));
vi.mock('../../context/AuthContext',()=>({useAuth:()=>({user:{id:1}})}));
vi.mock('../squadCommunication/journeyCopy',()=>({useJourneyCopy:()=>((en:string)=>en)}));
vi.mock('../clubWorkspace/useClubMembership',()=>({useClubMembership:()=>({})}));
vi.mock('../parents/hub/useChildSquads',()=>({useChildSquads:()=>({squads:[],loading:false,error:'',failedSquads:[],retry:vi.fn()})}));
vi.mock('../parents/hub/ThisWeek',()=>({ThisWeek:()=>null}));
vi.mock('../parents/hub/CoachUpdates',()=>({CoachUpdates:()=>null}));
vi.mock('../parents/hub/ChildChats',()=>({ChildChats:()=>null}));
vi.mock('../parents/hub/ChildMoney',()=>({ChildMoney:()=>null}));
vi.mock('../announcements/ClubPinned',()=>({ClubPinned:()=>null}));

const boot={clubId:1,clubName:'Academy',actorId:2,modules:[{id:'TRAVEL',writable:true,globalWrite:false,writeSquads:[4]}],settings:{enabled_modules:['TRAVEL']},definitions:[],squads:[],people:[],staff:[],guardians:[],links:[]} as unknown as Bootstrap;
const source={id:3,title:'Canonical event',starts_at:'2099-11-05T12:00:00Z',ends_at:'2099-11-05T14:00:00Z',timezone:'Asia/Tbilisi',status:'SCHEDULED',location_name:'Away ground'};
const draft={title:'Shared journey',timezone:'Asia/Tbilisi',startsAt:'2099-11-05T10:00:00Z',endsAt:'2099-11-05T16:00:00Z',meetingPoint:'Academy gate',collectionPoint:'Academy gate',supervisionContact:'Responsible staff',arrangements:[],familyMessage:''};
const plan={id:7,club_id:1,squad_id:4,revision:1,title:'Shared journey',source,draft,issues:[],history:[],physicalHistory:[],eventPlayers:[],travelChecks:[],canPublish:true};
const own={plan_id:7,club_id:1,version:1,child_id:8,child_name:'Ana',title:'Shared journey',source,itinerary:draft,attendance:'EXPECTED',eventExpected:true,canRespond:true,permission:{id:9,revision:0,status:'PENDING',data:{wording:'Exact terms'},transitions:['GRANTED','DECLINED']},travel:{status:'DRAFT'}};
const child={playerId:8,identity:{fullName:'Ana',dateOfBirth:'2014-01-01'},clubs:[{clubId:1,clubName:'Academy',affiliationStatus:'ACTIVE',squads:[]}],cases:[],inquiries:[],travelAvailable:true} as unknown as JoiningChild;
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();sessionStorage.clear();localStorage.setItem('userId','2');localStorage.setItem('gk-session-id','route-session');
 api.get.mockImplementation((path:string)=>Promise.resolve({data:path.includes('/family/')?[own]:path.includes('/plans/')?plan:{plans:[],events:[{...source,squad_id:4,squad_name:'U14'}]}}));api.post.mockResolvedValue({data:plan});});
afterEach(cleanup);
function Where(){return <output aria-label="address">{useLocation().search}</output>}
const office=(entry='/?tab=tools&tool=travel&squad=4')=>render(<MemoryRouter initialEntries={[entry]}><Where/><OfficeTool clubId={1} tool="travel" state="open" sessionId="route-session" overview={{currentUserRole:'COACH'} as never} reloadOverview={async()=>{}} boot={boot} bootLoading={false} bootError={null} refreshBoot={async()=>{}} roles={null} refreshRoles={()=>{}} admissions={{} as never} leader={false} admin={null}/></MemoryRouter>);

it('uses the real OfficeTool destination, preserves squad context and returns to the same list',async()=>{
 office();fireEvent.click(await screen.findByRole('button',{name:'Open travel'}));
 await screen.findByRole('heading',{name:'Shared journey'});
 expect(screen.getByLabelText('address')).toHaveTextContent('squad=4');expect(screen.getByLabelText('address')).toHaveTextContent('travelPlan=7');
 expect(api.get).toHaveBeenCalledWith('/travel/context?clubId=1&squadId=4',expect.anything());
 fireEvent.click(screen.getByRole('button',{name:'Back to travel'}));
 await screen.findByRole('button',{name:'Open travel'});expect(screen.getByLabelText('address')).not.toHaveTextContent('travelPlan');
});

it('mounts own-child travel only from a positive server indication and keeps a basic child page quiet',async()=>{
 const ui=render(<MemoryRouter><ChildPage child={{...child,travelAvailable:false}} sessionId="route-session" revision={0} onChanged={()=>{}}/></MemoryRouter>);
 expect(screen.queryByText('Travel · Ana')).not.toBeInTheDocument();expect(api.get.mock.calls.filter(([url])=>!String(url).endsWith('/asks'))).toEqual([]);
 ui.rerender(<MemoryRouter><ChildPage child={child} sessionId="route-session" revision={0} onChanged={()=>{}}/></MemoryRouter>);
 expect(await screen.findByText('Travel · Ana')).toBeVisible();expect(screen.getByRole('button',{name:'Give travel permission'})).toBeVisible();
});

it('keeps the existing office route quiet for a basic club with no journey, event or Travel appointment',async()=>{
 api.get.mockResolvedValue({data:{events:[],plans:[],relevant:false}});office();
 await waitFor(()=>expect(api.get).toHaveBeenCalled());
 expect(screen.queryByRole('heading',{name:'Travel'})).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Open travel'})).not.toBeInTheDocument();
});

it('drops the selected child’s travel on account change and never displays a late prior family response',async()=>{
 let resolve!:(v:unknown)=>void;api.get.mockImplementationOnce(()=>new Promise(r=>{resolve=r})).mockResolvedValue({data:[]});
 render(<MemoryRouter><ChildPage child={child} sessionId="route-session" revision={0} onChanged={()=>{}}/></MemoryRouter>);
 await act(async()=>{localStorage.setItem('gk-session-id','new-session');window.dispatchEvent(new Event('gk-auth-changed'));resolve({data:[own]});});
 await waitFor(()=>expect(screen.queryByText('Travel · Ana')).not.toBeInTheDocument());
});
