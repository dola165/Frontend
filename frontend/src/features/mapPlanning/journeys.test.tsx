import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { MyJourneys } from './MyJourneys';
import MapPlanWorkspace from './MapPlanWorkspace';
import { emptyDraft,planGet,planPost,type FamilyPlan,type Plan,type PlanContext } from './api';
import { rememberSelection,recoverSelection } from './draftRecovery';
import { clearStoredAuth,getAuthSessionId,setStoredAccessToken,setStoredUserId } from '../../utils/authStorage';
vi.mock('./api',async original=>({...await original<typeof import('./api')>(),planGet:vi.fn(),planPost:vi.fn()}));
const context:PlanContext={id:1,name:'Dinamo',settings:{timezone:'Asia/Tbilisi'},squads:[{id:2,name:'U16 Boys',canEdit:true}],participants:[],events:[],sessions:[]};
const itinerary={title:'Training journey',startsAt:'2026-10-10T05:00Z',endsAt:'2026-10-10T09:00Z',timezone:'Asia/Tbilisi',destination:'Training ground',meetingPoint:'Academy gate',collectionPoint:'Academy gate',supervisionContact:'Coach Luka',message:'Bring water',activities:[]};
const journey={id:'player-1',plan_id:1,club_id:1,child_id:3,child_name:'Player',club_name:'Dinamo',title:'Training journey',version:1,viewer:'PLAYER',canRespond:true,response:{status:'AWAITING_REPLY'},itinerary,travel:{status:'DRAFT'},published_at:'2026-10-01T00:00Z'} as unknown as FamilyPlan;
const plan=():Plan=>({id:7,club_id:1,squad_id:2,title:'Saved training day',revision:0,published_revision:0,published_version:1,created_by:1,updated_at:'2026-10-01T00:00Z',starts_at:itinerary.startsAt,draft:{...emptyDraft(context),title:'Saved training day'},suppliers:{},totalMinor:0,budgetApproved:false,approvedBy:null,rights:{edit:true,travel:true,finance:false,publish:true,leadership:false},issues:[],history:[],familyResponses:[],trip_id:null,trip:null,passengers:[],linkedSchedule:[]});
beforeEach(()=>{vi.resetAllMocks();localStorage.clear();setStoredAccessToken('test');setStoredUserId(1);});
afterEach(cleanup);
it('shows a journey without a match and saves an adult self response',async()=>{
 vi.mocked(planGet).mockResolvedValue([journey]);vi.mocked(planPost).mockImplementation(async()=>{vi.mocked(planGet).mockResolvedValue([{...journey,response:{status:'GOING',acknowledged:true}}]);return plan();});
 render(<MemoryRouter><MyJourneys/></MemoryRouter>);fireEvent.click(await screen.findByRole('button',{name:/Training journey/}));await screen.findByRole('dialog',{name:'Journey details window'});
 fireEvent.click(screen.getByRole('button',{name:"I'm going"}));await waitFor(()=>expect(planPost).toHaveBeenCalledWith('/1/my-response',{version:1,response:'GOING'}));await screen.findAllByText("You're going");expect(screen.queryByRole('button',{name:'Give travel permission'})).toBeNull();
});
it('keeps guardian journeys discoverable and separates permission from an adult reply',async()=>{
 vi.mocked(planGet).mockResolvedValue([{...journey,id:1,viewer:'GUARDIAN',child_name:'Ana',permission_id:99,permission:{status:'PENDING',revision:0,data:{wording:'Read the plan'},transitions:['GRANTED','DECLINED']} as unknown as FamilyPlan['permission']}]);
 render(<MemoryRouter><MyJourneys childId={3}/></MemoryRouter>);fireEvent.click(await screen.findByRole('button',{name:/Training journey/}));expect(await screen.findByRole('button',{name:'Give travel permission'})).toBeVisible();expect(screen.queryByRole('button',{name:"I'm going"})).toBeNull();
});
it('shows failed journey fetches instead of claiming there are no journeys',async()=>{
 vi.mocked(planGet).mockRejectedValue(new Error('Offline'));render(<MemoryRouter><MyJourneys/></MemoryRouter>);await screen.findByRole('alert');expect(screen.queryByText(/published journeys will appear/)).toBeNull();expect(screen.getByRole('button',{name:'Refresh your journeys'})).toBeEnabled();
});
it('resumes the selected saved journey within the account session and expands published Travel only',async()=>{
 rememberSelection(7,1,2,getAuthSessionId());vi.mocked(planGet).mockImplementation(async path=>path==='/context'?[context]:path==='/7'?plan():[]);
 render(<MemoryRouter initialEntries={['/map?plans=staff']}><MapPlanWorkspace candidate={null} onCandidateUsed={()=>{}} onPlaces={()=>{}} onFocus={()=>{}} onExplore={()=>{}} onClose={()=>{}} onMapClick={()=>{}} onPickMode={()=>{}} onPreview={()=>{}} onLayout={()=>{}}/></MemoryRouter>);
 await screen.findByDisplayValue('Saved training day');const rail=screen.getByRole('complementary',{name:'Plan workspace'});fireEvent.click(screen.getByRole('button',{name:'Travel'}));expect(rail.closest('.mp-workspace')).toHaveClass('mp-travel-focus');fireEvent.click(screen.getByRole('button',{name:'People'}));expect(rail.closest('.mp-workspace')).not.toHaveClass('mp-travel-focus');clearStoredAuth();expect(recoverSelection()).toBeNull();
});

