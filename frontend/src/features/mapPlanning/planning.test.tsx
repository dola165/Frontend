import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import MapPlanWorkspace from './MapPlanWorkspace';
import { FamilyPlans } from './FamilyPlans';
import { emptyDraft,localInput,zonedIso,planGet,planPost,savePlan,permissionDecision,type Plan,type PlanContext,type FamilyPlan } from './api';
import { ScheduleEditor } from './PlanEditors';
import { putPlanningPlace } from './mapPlanning';
import { draftFingerprint,recoverPlan,recoveryKey,rememberPlan } from './draftRecovery';
import { clearStoredAuth,getAuthSessionId,setStoredAccessToken,setStoredUserId } from '../../utils/authStorage';
vi.mock('./api',async original=>({...await original<typeof import('./api')>(),planGet:vi.fn(),planPost:vi.fn(),savePlan:vi.fn(),permissionDecision:vi.fn()}));
const context:PlanContext={id:4,name:'FC Dinamo Tbilisi Academy',settings:{timezone:'Asia/Tbilisi',currency:'GEL'},squads:[{id:5,name:'U16',canEdit:true}],participants:[{id:6,name:'Player One',squad_id:5}],events:[],sessions:[]};
const record=():Plan=>({id:8,club_id:4,squad_id:5,title:'Away match',revision:3,created_by:2,published_version:0,published_revision:null,updated_at:'2026-09-30T06:00Z',starts_at:'2026-10-07T08:00Z',draft:{...emptyDraft(context),title:'Away match'},suppliers:{},totalMinor:0,budgetApproved:false,approvedBy:null,rights:{edit:true,travel:true,finance:false,publish:true,leadership:false},issues:[],history:[],familyResponses:[],trip_id:null,trip:null,passengers:[],linkedSchedule:[]});
const show=(route='/map?plans=staff')=>{const close=vi.fn();render(<MemoryRouter initialEntries={[route]}><MapPlanWorkspace onMapClick={vi.fn()} onPickMode={vi.fn()} onPreview={vi.fn()} onLayout={vi.fn()} initialClubId={4} candidate={null} onCandidateUsed={vi.fn()} onPlaces={vi.fn()} onFocus={vi.fn()} onExplore={vi.fn()} onClose={close}/></MemoryRouter>);return close;};
beforeEach(()=>{localStorage.clear();localStorage.setItem('userId','2');localStorage.setItem('gk-session-id','test-session');vi.clearAllMocks();vi.mocked(planGet).mockImplementation(async path=>(path==='/context'?[context]:path==='/8'?record():[]) as never);});
afterEach(cleanup);
it('explains a missing plan name and focuses it before sending a creation request',async()=>{
  show();await screen.findByLabelText('Plan name');fireEvent.click(screen.getByRole('button',{name:'Create plan'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Give this plan a name');expect(screen.getByLabelText('Plan name')).toHaveFocus();expect(planPost).not.toHaveBeenCalled();
});
it('shows creation progress immediately and confirms the persisted private draft',async()=>{
  let resolve!:(p:Plan)=>void;vi.mocked(planPost).mockImplementationOnce(()=>new Promise<Plan>(r=>{resolve=r;}));
  show();await screen.findByLabelText('Plan name');fireEvent.change(screen.getByLabelText('Plan name'),{target:{value:'Dinamo camp'}});fireEvent.click(screen.getByRole('button',{name:'Create plan'}));
  expect(screen.getByRole('button',{name:'Creating…'})).toBeDisabled();expect(screen.getByText('Creating your plan…')).toBeVisible();resolve({...record(),draft:{...emptyDraft(context),title:'Dinamo camp'}});
  expect(await screen.findByText('Plan created')).toBeVisible();expect(screen.getByText(/It stays private until/)).toBeVisible();
});
it('recovers an unsaved plan after unmount and keeps its creation request identity',async()=>{
  show();await screen.findByLabelText('Plan name');fireEvent.change(screen.getByLabelText('Plan name'),{target:{value:'Recovered camp'}});fireEvent.change(screen.getByLabelText(/Private planning notes/),{target:{value:'Keep these details'}});
  const backup=recoverPlan()!;expect(backup.draft.privateNotes).toBe('Keep these details');cleanup();show();await screen.findByDisplayValue('Recovered camp');
  vi.mocked(planPost).mockResolvedValueOnce({...record(),draft:backup.draft});fireEvent.click(screen.getByRole('button',{name:'Create plan'}));await screen.findByText('Plan created');
  expect(planPost).toHaveBeenCalledWith('',expect.objectContaining({requestId:backup.requestId}));expect(recoverPlan()).toBeNull();
});
it('keeps newer input when retrying a committed creation with a lost response',async()=>{
  show();await screen.findByLabelText('Plan name');fireEvent.change(screen.getByLabelText('Plan name'),{target:{value:'Newer local name'}});
  vi.mocked(planPost).mockResolvedValueOnce({...record(),draft:{...emptyDraft(context),title:'Earlier committed name'}});fireEvent.click(screen.getByRole('button',{name:'Create plan'}));await screen.findByText('Plan created');
  expect(screen.getByLabelText('Plan name')).toHaveValue('Newer local name');expect(screen.getByRole('button',{name:'Save changes'})).toBeEnabled();expect(recoverPlan('plan:8')?.draft.title).toBe('Newer local name');
});
it('uses the recovered base revision so another editor cannot be silently overwritten',async()=>{
  const base=record(),local={...base.draft,title:'Recovered conflicting edit'};rememberPlan({key:'plan:8',planId:8,clubId:4,squadId:5,requestId:'stable',baseRevision:1,baseDraft:base.draft,draft:local,savedAt:Date.now()},getAuthSessionId());
  show('/map?plans=staff&plan=8');await screen.findByDisplayValue(local.title);vi.mocked(savePlan).mockRejectedValueOnce(new Error('Conflict'));fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
  await waitFor(()=>expect(savePlan).toHaveBeenCalledWith(8,1,local));expect(screen.getByLabelText('Plan name')).toHaveValue(local.title);
});
it('isolates recovery by account and login and clears private drafts on logout',()=>{
  const d={...emptyDraft(context),title:'Private draft'},backup={key:recoveryKey(0,'stable'),planId:0,clubId:4,squadId:5,requestId:'stable',baseRevision:null,baseDraft:emptyDraft(context),draft:d,savedAt:Date.now()};
  expect(rememberPlan(backup,getAuthSessionId())).toBe(true);setStoredUserId(99);expect(recoverPlan()).toBeNull();setStoredUserId(2);expect(recoverPlan()?.draft.title).toBe('Private draft');
  const old=getAuthSessionId();setStoredAccessToken('new-login');expect(recoverPlan()).toBeNull();expect(rememberPlan(backup,old)).toBe(false);setStoredUserId(2);rememberPlan(backup,getAuthSessionId());clearStoredAuth();expect(Object.keys(localStorage).some(k=>k.startsWith('gk-map-drafts:'))).toBe(false);
  expect(draftFingerprint({...d,places:[]})).toBe(draftFingerprint({...d}));
});
it('stores named map locations and replaces a meeting point without accumulating duplicates',()=>{
  const d=emptyDraft(context),place={key:'clicked',name:'Academy gate',address:'Main entrance',latitude:41.73,longitude:44.78,type:'MANUAL' as const,notes:'Private'};
  const first={...d,...putPlanningPlace(d,place,'meeting')};
  expect(first.meetingPoint).toBe('Academy gate · Main entrance');expect(first.places[0].key).toBe('plan:meeting');
  const next={...first,...putPlanningPlace(first,{...place,latitude:41.74},'meeting')};
  expect(next.places).toHaveLength(1);expect(next.places[0].latitude).toBe(41.74);
});
it('explains an empty calendar source and allows choosing a real training entry',()=>{
  const d=emptyDraft(context),change=vi.fn(),session={id:12,title:'Squad training',starts_at:d.startsAt,ends_at:new Date(Date.parse(d.startsAt)+3600000).toISOString(),squad_id:5};
  render(<MemoryRouter><ScheduleEditor draft={d} change={change} context={{...context,sessions:[session]}} squad={5} plan={null} onFocus={vi.fn()} busy={false} onCalendar={vi.fn()} seedPlace={null} onSeedUsed={vi.fn()} onPickPlace={vi.fn()}/></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Add an activity'}));fireEvent.click(screen.getByLabelText('Existing match'));expect(screen.getByText(/No matches are available/)).toBeVisible();
  fireEvent.click(screen.getByLabelText('Existing training'));fireEvent.click(screen.getByLabelText('Choose a training session'));fireEvent.click(screen.getByRole('option',{name:/Squad training/}));
  expect(screen.getByLabelText('Activity name')).toHaveValue('Squad training');fireEvent.click(screen.getByRole('button',{name:'Add to schedule'}));
  expect(change).toHaveBeenCalledWith({activities:[expect.objectContaining({sessionId:12,kind:'TRAINING',title:'Squad training'})]});
});
it('opens picking inside the current workspace without discarding a dirty draft',async()=>{
  show();await screen.findByLabelText('Plan name');fireEvent.change(screen.getByLabelText('Plan name'),{target:{value:'Unsaved journey'}});
  fireEvent.click(screen.getByRole('navigation',{name:'Planning sections'}).querySelector('button:nth-child(2)')!);
  fireEvent.click(screen.getByRole('button',{name:'Find on map'}));expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.getByText(/Click anywhere on the map/)).toBeVisible();expect(screen.queryByLabelText('Latitude')).not.toBeInTheDocument();
});
describe('plan time zones',()=>{
  it('round trips Georgian and summer/winter Tallinn wall times independently of browser timezone',()=>{
    expect(zonedIso('2027-06-14T09:00','Europe/Tallinn')).toBe('2027-06-14T06:00:00.000Z');
    expect(zonedIso('2027-01-14T09:00','Europe/Tallinn')).toBe('2027-01-14T07:00:00.000Z');
    expect(localInput(zonedIso('2027-06-14T09:00','Asia/Tbilisi'),'Asia/Tbilisi')).toBe('2027-06-14T09:00');
  });
  it('rejects a DST gap and an incomplete date instead of moving an activity silently',()=>{
    expect(()=>zonedIso('2027-03-28T03:30','Europe/Tallinn')).toThrow('does not exist');expect(()=>zonedIso('2027-03-','UTC')).toThrow();
  });
});
it('creates a club and squad scoped draft and retains edits after failed save',async()=>{
  show();await screen.findByLabelText('Plan name');fireEvent.change(screen.getByLabelText('Plan name'),{target:{value:'Camp in Batumi'}});
  vi.mocked(planPost).mockRejectedValueOnce(new Error('Offline'));fireEvent.click(screen.getByRole('button',{name:'Create plan'}));
  await screen.findByRole('alert');expect(screen.getByLabelText('Plan name')).toHaveValue('Camp in Batumi');
  expect(planPost).toHaveBeenCalledWith('',expect.objectContaining({clubId:4,squadId:5,draft:expect.objectContaining({title:'Camp in Batumi'})}));
  const request=vi.mocked(planPost).mock.calls[0][1] as {requestId:string};
  vi.mocked(planPost).mockResolvedValueOnce({...record(),draft:{...record().draft,title:'Camp in Batumi'}});fireEvent.click(screen.getByRole('button',{name:'Create plan'}));
  await screen.findByText('All changes saved');expect((vi.mocked(planPost).mock.calls[1][1] as {requestId:string}).requestId).toBe(request.requestId);
});
it('does not publish unsaved changes and protects them when leaving the workspace',async()=>{
  const close=show('/map?plans=staff&plan=8');await screen.findByDisplayValue('Away match');fireEvent.change(screen.getByLabelText('Plan name'),{target:{value:'Unsaved trip'}});
  expect(screen.getByRole('button',{name:/Review & publish/})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Explore'}));
  await screen.findByRole('alertdialog');expect(close).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Keep editing'}));expect(screen.getByLabelText('Plan name')).toHaveValue('Unsaved trip');
  expect(planPost).not.toHaveBeenCalled();
});
it('passes the loaded revision on save and preserves a rejected conflicting edit',async()=>{
  show('/map?plans=staff&plan=8');await screen.findByDisplayValue('Away match');fireEvent.change(screen.getByLabelText('Destination'),{target:{value:'Kutaisi'}});
  vi.mocked(savePlan).mockRejectedValueOnce(new Error('Conflict'));fireEvent.click(screen.getByRole('button',{name:'Save changes'}));await screen.findByRole('alert');
  expect(savePlan).toHaveBeenCalledWith(8,3,expect.objectContaining({destination:'Kutaisi'}));expect(screen.getByLabelText('Destination')).toHaveValue('Kutaisi');
});
it('acknowledgement and guardian permission are separate requests',async()=>{
  const p={id:1,plan_id:8,club_id:4,title:'Camp',version:2,child_id:6,child_name:'Child',club_name:'Academy',acknowledged_at:null,published_at:'2026-09-30T06:00Z',permission_id:11,permission:{id:11,revision:0,status:'PENDING',data:{wording:'Travel for this camp'},transitions:['GRANTED','DECLINED']},itinerary:{title:'Camp',timezone:'Asia/Tbilisi',startsAt:'2027-06-14T06:00Z',endsAt:'2027-06-14T16:00Z',destination:'Ground',meetingPoint:'Gate',collectionPoint:'Gate',supervisionContact:'Coach',message:'Bring water',activities:[]},travel:{status:'PLANNING'}} as unknown as FamilyPlan;
  vi.mocked(planGet).mockResolvedValue([p]);vi.mocked(planPost).mockResolvedValue({acknowledged:true} as never);render(<FamilyPlans/>);
  fireEvent.click(await screen.findByRole('button',{name:'I have read this itinerary'}));await waitFor(()=>expect(planPost).toHaveBeenCalledWith('/8/acknowledge',{version:2,childId:6}));expect(permissionDecision).not.toHaveBeenCalled();
  await waitFor(()=>expect(screen.getByRole('button',{name:'Give travel permission'})).not.toBeDisabled());fireEvent.click(screen.getByRole('button',{name:'Give travel permission'}));await waitFor(()=>expect(permissionDecision).toHaveBeenCalledWith(4,11,0,'GRANTED'));
});
