import { cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import opportunitiesJson from './__fixtures__/opportunities.json?raw';
import caseJson from './__fixtures__/place_offered.json?raw';
import type { AdmissionCase, AdmissionHome, OpportunityPage } from '../types';
import { fetchAdmissionCase, fetchAdmissionHome, fetchOpportunity } from '../api';
import { AdmissionCasePage } from './AdmissionCasePage';
import { OpportunityDetailPage } from './OpportunityDetailPage';
import { useApplicant } from '../../world/map/explore/useApplicant';
vi.mock('../../players/PlayerIdentityEditor',()=>({PlayerIdentityEditor:()=>null}));
const auth=vi.hoisted(()=>({user:{id:77},sessionId:'review-session',isAuthenticated:true}));
vi.mock('../../../context/AuthContext',()=>({useAuth:()=>auth}));
vi.mock('../../../utils/authStorage',()=>({getAuthSessionId:()=>auth.sessionId,isCurrentAuthSession:(id:string)=>id===auth.sessionId}));
vi.mock('../../squadCommunication/journeyCopy',()=>({useJourneyCopy:()=>((en:string)=>en)}));
vi.mock('../../parents/AddChild',()=>({AddChild:()=>null}));
vi.mock('../api',()=>({fetchAdmissionCase:vi.fn(),fetchAdmissionHome:vi.fn(),fetchOpportunity:vi.fn(),submitAdmission:vi.fn(),updateAdmissionPlayerCard:vi.fn(),reportAdmissionGuardianReview:vi.fn(),fetchLifecycleDates:vi.fn().mockImplementation((caseId:number)=>Promise.resolve({caseId,caseVersion:1,reviewDueAt:null,reviewTimezone:'Asia/Tbilisi',reviewSource:'NONE',reviewOverdue:false,reviewOwner:'Admissions queue',departure:null,seasonCaseId:null,seasonGroupName:null,seasonDestination:null,actions:[]}))}));
const child=(id:number,name:string)=>({id,name,dateOfBirth:'2014-05-01',gender:'MALE' as const,minor:true,guardian:true,provenance:null,restriction:null});
const home=()=>({participants:[child(88,'Synthetic first child'),child(89,'Synthetic sibling')],cases:[],selfCardNeedsDetails:false}) as AdmissionHome;
const opportunity=()=>{const o=(JSON.parse(opportunitiesJson) as OpportunityPage).items[0];o.birthYearFrom=2010;o.birthYearTo=2016;o.gender='ANY';return o;};
function QueryNavigation(){const navigate=useNavigate();return <><button onClick={()=>navigate('?tab=join&player=89')}>Open sibling link</button><button onClick={()=>navigate(-1)}>Back to first child</button></>;}
beforeEach(()=>{vi.clearAllMocks();sessionStorage.clear();auth.isAuthenticated=true;vi.mocked(fetchAdmissionHome).mockResolvedValue(home());vi.mocked(fetchOpportunity).mockResolvedValue(opportunity());});
afterEach(cleanup);
describe('Review: selected player and recoverable eligibility',()=>{
  it('explains the actual staff eligibility review task after corrected player details',async()=>{
    const c=JSON.parse(caseJson) as AdmissionCase;c.actions=[];c.nextAction={code:'ELIGIBILITY_REVIEW',owner:'CLUB',label:'ELIGIBILITY_REVIEW',dueAt:null};vi.mocked(fetchAdmissionCase).mockResolvedValue(c);
    render(<MemoryRouter initialEntries={[`/admissions/cases/${c.id}`]}><Routes><Route path="/admissions/cases/:caseId" element={<AdmissionCasePage/>}/></Routes></MemoryRouter>);
    expect(await screen.findByText('The player details were corrected. Club staff must review eligibility before this agreement can be completed.')).toBeVisible();
    expect(screen.queryByText('ELIGIBILITY_REVIEW')).not.toBeInTheDocument();
  });
  it('uses the selected child from a changed URL and browser history on the same opportunity',async()=>{
    const o=opportunity();
    render(<MemoryRouter initialEntries={[`/admissions/opportunities/${o.id}?tab=join&player=88`]}><QueryNavigation/><Routes><Route path="/admissions/opportunities/:opportunityId" element={<OpportunityDetailPage/>}/></Routes></MemoryRouter>);
    await waitFor(()=>expect(screen.getByRole('radio',{name:/^Synthetic first child/})).toBeChecked());
    fireEvent.click(screen.getByRole('button',{name:'Open sibling link'}));
    await waitFor(()=>expect(screen.getByRole('radio',{name:/^Synthetic sibling/})).toBeChecked());
    fireEvent.click(screen.getByRole('button',{name:'Back to first child'}));
    await waitFor(()=>expect(screen.getByRole('radio',{name:/^Synthetic first child/})).toBeChecked());
  });
  it('carries only the authorized selected child to the actual venue map',async()=>{
    const o=opportunity();o.location.latitude=41.7;o.location.longitude=44.8;vi.mocked(fetchOpportunity).mockResolvedValue(o);
    render(<MemoryRouter initialEntries={[`/admissions/opportunities/${o.id}?tab=join&player=88`]}><Routes><Route path="/admissions/opportunities/:opportunityId" element={<OpportunityDetailPage/>}/></Routes></MemoryRouter>);
    await waitFor(()=>expect(screen.getByRole('radio',{name:/^Synthetic first child/})).toBeChecked());
    expect(screen.getByRole('link',{name:'View actual training venue on map'})).toHaveAttribute('href',`/world?opportunity=${o.id}&player=88`);
  });
  it('resolves an incoming map child against the current authorized cards',async()=>{
    const wrapper=({children}:{children:ReactNode})=><MemoryRouter initialEntries={['/world/map?player=88']}>{children}</MemoryRouter>;
    const {result}=renderHook(()=>useApplicant(),{wrapper});
    await waitFor(()=>expect(result.current.player).toEqual({id:88,name:'Synthetic first child',birthYear:2014,gender:'MALE',minor:true}));
  });
  it('does not restore an incoming map child outside current family authority',async()=>{
    const wrapper=({children}:{children:ReactNode})=><MemoryRouter initialEntries={['/world/map?player=999']}>{children}</MemoryRouter>;
    const {result}=renderHook(()=>useApplicant(),{wrapper});
    await waitFor(()=>expect(result.current.participants.map(p=>p.id)).toEqual([88,89]));
    expect(result.current.player).toBeUndefined();
  });
  it('explains a known category mismatch and leaves the inquiry route available',async()=>{
    const o=opportunity();o.gender='FEMALE';vi.mocked(fetchOpportunity).mockResolvedValue(o);
    render(<MemoryRouter initialEntries={[`/admissions/opportunities/${o.id}?tab=join&player=88`]}><Routes><Route path="/admissions/opportunities/:opportunityId" element={<OpportunityDetailPage/>}/></Routes></MemoryRouter>);
    expect(await screen.findByText(/The selected player does not match this group.s published gender category/)).toBeVisible();
    expect(screen.getByRole('button',{name:'Request an introduction'})).toBeDisabled();
    expect(screen.getByRole('link',{name:'Ask this organization to recommend a group'})).toBeVisible();
  });
});
