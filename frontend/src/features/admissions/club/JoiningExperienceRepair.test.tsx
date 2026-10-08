import { act, fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { JoiningProgrammeSetup } from './JoiningProgrammeSetup';
import { joiningSetupInitial } from './joiningSetupDraft';
import { InquiryQueue } from './InquiryQueue';
import { ClubAdmissionWorkspace } from './ClubAdmissionWorkspace';
import type { AdmissionInquiry, AdmissionWorkspace, AdmissionCase, Opportunity } from '../types';
import type { JoiningSetup } from '../../joining-contract/types';
import type { useClubAdmissions } from './useClubAdmissions';
import { clearStoredAuth, getAuthSessionId, setStoredAccessToken, type AuthSessionId } from '../../../utils/authStorage';
const api=vi.hoisted(()=>({setup:vi.fn(),save:vi.fn(),command:vi.fn()}));
const lang=vi.hoisted(()=>({value:'en'}));
vi.mock('react-i18next',()=>({useTranslation:()=>({i18n:{resolvedLanguage:lang.value}})}));
vi.mock('../../joining-contract/api',()=>({fetchJoiningSetup:api.setup,configureJoiningForInquiry:api.save}));
vi.mock('../api',()=>({commandAdmissionInquiry:api.command,newAdmissionRequestId:()=>crypto.randomUUID(),createAdmissionGroup:vi.fn(),updateAdmissionGroup:vi.fn()}));
vi.mock('../legacy/LegacyAdmissions',()=>({LegacyAdmissions:()=>null}));
vi.mock('./CaseDetail',()=>({CaseDetail:()=>null}));
vi.mock('../../parents/FamilyClubEnrollment',()=>({FamilyClubEnrollment:()=>null}));
vi.mock('./OfflineInquiry',()=>({OfflineInquiry:()=>null}));
const enquiry=(patch:Partial<AdmissionInquiry>={}):AdmissionInquiry=>({id:81,version:3,playerId:61,playerName:'Synthetic child',organizationId:1,organizationName:'FC Dinamo Tbilisi Academy',conversationId:80,programmeId:14,squadId:11,groupId:null,caseId:null,status:'OPEN',message:'Can we arrange a first visit?',actions:['MESSAGE','REQUEST_SETUP'],history:[],createdAt:'2026-10-04T00:00:00Z',updatedAt:'2026-10-04T00:00:00Z',continuation:{applicant:false,staff:true,destination:'/clubs/1/workspace?tab=admissions&inquiryId=81'},nextAction:{owner:'CLUB',code:'REPLY',label:'Club reply',dueAt:null},setup:{canConfigure:false,canRequest:true,requested:false,destination:null},...patch});
const workspace=():AdmissionWorkspace=>({organizationId:1,organizationName:'FC Dinamo Tbilisi Academy',clubId:1,canConfigure:false,groups:[],cases:[],squads:[],staff:[],inquiries:[enquiry()]});
const setup=():JoiningSetup=>({inquiryId:81,inquiryVersion:3,organizationId:1,clubId:1,programmeId:14,squadId:11,programmeName:'Dinamo U12 programme',squadName:'Dinamo U12',known:{name:'Dinamo U12',category:null,gender:'MALE',headCoachId:7,ageMin:10,ageMax:12,sessionsPerWeek:3,priceType:null,amount:120,currency:'GEL',billingPeriod:null,trialAmount:null,joiningFee:null,equipmentFee:null,details:'Current club programme'},reviewRequired:['capacity','staff','terms'],existingGroups:[],staff:[{id:7,name:'Approved coach'}],canConfigure:true,canRequest:false,requested:false,returnDestination:'/clubs/1/workspace?tab=admissions&inquiryId=81'});
const openSetup=(onChanged=vi.fn(),onReturn=vi.fn(),data=workspace(),sessionId:AuthSessionId=null,inquiryId=81)=>render(<MemoryRouter><JoiningProgrammeSetup inquiryId={inquiryId} workspace={data} sessionId={sessionId} onChanged={onChanged} onReturn={onReturn}/></MemoryRouter>);
const openQueue=(record:AdmissionInquiry)=>render(<MemoryRouter><InquiryQueue records={[record]} groups={[]} sessionId={null} selectedInquiryId={record.id} onChanged={vi.fn()} onOpenCase={vi.fn()} onRefresh={vi.fn()} onSetup={vi.fn()}/></MemoryRouter>);
beforeEach(()=>{localStorage.clear();sessionStorage.clear();vi.clearAllMocks();lang.value='en';api.setup.mockResolvedValue(setup());api.save.mockResolvedValue(enquiry({groupId:21,version:4}));});
afterEach(cleanup);
it('keeps the admission queue and controls visible with common cosmetic ad filters enabled',()=>{
 const filter=document.createElement('style');
 // Real EasyList/AdGuard generic selectors; admissions content must not look like advertising.
 filter.textContent='.ad-button,.ad-field,.ad-grid,.ad-heading,.ad-notice,.ad-panel,.ad-stack,.ad-summary { display:none !important; }';
 document.head.append(filter);
 try {
  const data=workspace();data.inquiries=[enquiry({conversationDestination:'/messages?conversationId=80'})];
  const state={data,loading:false,error:'',reload:vi.fn(),setData:vi.fn()} as unknown as ReturnType<typeof useClubAdmissions>;
  render(<MemoryRouter><ClubAdmissionWorkspace state={state} sessionId={null} onOpen={vi.fn()} onRosterChanged={vi.fn()}/></MemoryRouter>);
  expect(screen.getByRole('heading',{name:'Player admission'})).toBeVisible();
  expect(screen.getByLabelText('Find a player or group')).toBeVisible();
  expect(screen.getByRole('heading',{name:'Incoming enquiries'})).toBeVisible();
  expect(screen.getByText('Synthetic child')).toBeVisible();
  expect(screen.getByRole('link',{name:/Open conversation/})).toBeVisible();
  expect(screen.getByRole('heading',{name:'Next steps'})).toBeVisible();
 } finally {filter.remove();}
});
function fillSetup() {
 for(const [name,value] of [['Intake','2026 autumn'],['Regular group capacity','14'],['First eligible birth year','2014'],['Last eligible birth year','2016'],['Season / age reference date','2026-10-04'],['Training venue','Academy pitch'],['Address','Synthetic academy address'],['Normal schedule','Tuesday and Thursday 17:00'],['Start date','2026-10-12']] as const)fireEvent.change(screen.getByLabelText(name),{target:{value}});
 for(const label of [/I reviewed the existing programme/,/I checked the available capacity/,/I reviewed the actual schedule/])fireEvent.click(screen.getByRole('checkbox',{name:label}));
}
it('prefills existing identity and eligible coach without treating public price or age as joining consent',async()=>{
 expect(joiningSetupInitial(setup())).toMatchObject({name:'Dinamo U12 programme',squadId:11,responsibleUserId:7,published:false});
 openSetup();expect(await screen.findByLabelText('Group / program name')).toHaveValue('Dinamo U12 programme');
 expect(screen.getByLabelText('Group / program name')).toHaveAttribute('readonly');expect(screen.getByLabelText('Existing squad')).toBeDisabled();
 expect(screen.getByLabelText('Responsible person')).toHaveValue('7');
 expect(screen.getByRole('checkbox',{name:'All mandatory charges are known'})).not.toBeChecked();
 expect(screen.getByLabelText('First eligible birth year')).toHaveDisplayValue('');
 expect(screen.getByRole('button',{name:'Save joining and return to enquiry'})).toBeDisabled();expect(api.save).not.toHaveBeenCalled();
});
it('submits setup against the same enquiry/squad then returns to that enquiry',async()=>{
 const changed=vi.fn(),returned=vi.fn();openSetup(changed,returned);await screen.findByLabelText('Intake');fillSetup();
 fireEvent.click(screen.getByRole('button',{name:'Save joining and return to enquiry'}));
 await waitFor(()=>expect(returned).toHaveBeenCalledOnce());expect(api.save).toHaveBeenCalledWith(81,expect.objectContaining({expectedVersion:3,requestId:expect.any(String),group:expect.objectContaining({name:'Dinamo U12 programme',squadId:11,capacity:14,responsibleUserId:7,terms:expect.objectContaining({feesKnown:false})})}),null);
 expect(changed).toHaveBeenCalledWith(expect.objectContaining({id:81,groupId:21}));
});
it('restores contextual draft on back/reload while requiring a fresh review',async()=>{
 const view=openSetup();await screen.findByLabelText('Intake');fireEvent.change(screen.getByLabelText('Intake'),{target:{value:'Retained enquiry intake'}});view.unmount();openSetup();
 expect(await screen.findByLabelText('Intake')).toHaveValue('Retained enquiry intake');expect(screen.getByRole('button',{name:'Save joining and return to enquiry'})).toBeDisabled();
});
it('recovers the identical setup command after reload and a changed enquiry version',async()=>{
 api.save.mockRejectedValueOnce(new Error('Lost response')).mockResolvedValueOnce(enquiry({groupId:21,version:4}));
 const returned=vi.fn();const view=openSetup(vi.fn(),returned);await screen.findByLabelText('Intake');fillSetup();fireEvent.click(screen.getByRole('button',{name:'Save joining and return to enquiry'}));
 await screen.findByRole('button',{name:'Try again'});view.unmount();api.setup.mockResolvedValue({...setup(),inquiryVersion:4});openSetup(vi.fn(),returned);
 const retry=await screen.findByRole('button',{name:'Try again'});expect(returned).not.toHaveBeenCalled();fireEvent.click(retry);
 await waitFor(()=>expect(returned).toHaveBeenCalledOnce());expect(api.save.mock.calls[1]).toEqual(api.save.mock.calls[0]);
});
it('keeps scoped coaches at an actionable leadership request without showing a configuration form',async()=>{
 api.setup.mockResolvedValue({...setup(),canConfigure:false,canRequest:true});openSetup();
 expect(await screen.findByRole('heading',{name:'Club leadership approval is needed'})).toBeInTheDocument();expect(screen.queryByLabelText('Intake')).not.toBeInTheDocument();cleanup();
 openQueue(enquiry());fireEvent.change(screen.getByRole('combobox',{name:'Inquiry next step'}),{target:{value:'REQUEST_SETUP'}});fireEvent.change(screen.getByRole('textbox',{name:'Shared explanation'}),{target:{value:'Please prepare joining for Dinamo U12 and return this visit enquiry.'}});
 api.command.mockResolvedValue(enquiry({version:4,setup:{canConfigure:false,canRequest:false,requested:true,destination:null}}));fireEvent.click(screen.getByRole('button',{name:'Ask club leadership to configure joining'}));
 await waitFor(()=>expect(api.command).toHaveBeenCalledWith(81,expect.objectContaining({action:'REQUEST_SETUP',expectedVersion:3}),null));expect(api.save).not.toHaveBeenCalled();
});
it('shows a staff answer as waiting for the family and permits resolving a general question',async()=>{
 api.command.mockResolvedValue(enquiry({playerId:null,status:'RESOLVED',version:4}));openQueue(enquiry({playerId:null,playerName:null,actions:['MESSAGE','RESOLVE'],nextAction:{owner:'APPLICANT',code:'APPLICANT_REPLY',label:'Applicant reply',dueAt:null}}));
 expect(screen.getByText('The player or guardian can reply or confirm that the question is resolved.')).toBeInTheDocument();fireEvent.change(screen.getByRole('combobox',{name:'Inquiry next step'}),{target:{value:'RESOLVE'}});fireEvent.click(screen.getByRole('button',{name:'Mark question resolved'}));
 await waitFor(()=>expect(api.command).toHaveBeenCalledWith(81,expect.objectContaining({action:'RESOLVE',message:''}),null));
});
it('places answered and resolved enquiries in their truthful family/history queues',()=>{
 const data=workspace();data.inquiries=[enquiry({id:81,playerName:'Needs club'}),enquiry({id:82,playerName:'Needs family',nextAction:{owner:'APPLICANT',code:'REPLY',label:'Reply',dueAt:null}}),enquiry({id:83,playerName:'Resolved question',playerId:null,status:'RESOLVED',actions:['REOPEN'],nextAction:{owner:'NONE',code:'RESOLVED',label:'Resolved',dueAt:null}})];
 const state={data,loading:false,error:'',reload:vi.fn(),setData:vi.fn()} as unknown as ReturnType<typeof useClubAdmissions>;
 render(<MemoryRouter><ClubAdmissionWorkspace state={state} sessionId={null} onOpen={vi.fn()} onRosterChanged={vi.fn()}/></MemoryRouter>);
 expect(screen.getByText('Needs club')).toBeInTheDocument();expect(screen.queryByText('Needs family')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Waiting for family'}));
 expect(screen.getByText('Needs family')).toBeInTheDocument();expect(screen.queryByText('Needs club')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Players & history'}));expect(screen.getByText('Resolved question')).toBeInTheDocument();
});
it('renders new enquiry actions in Georgian using the existing language selection',()=>{
 lang.value='ka';openQueue(enquiry({playerId:null,playerName:null,actions:['RESOLVE']}));expect(screen.getByRole('button',{name:'კითხვის გადაწყვეტილად მონიშვნა'})).toBeInTheDocument();expect(screen.getByText('კლუბმა უნდა უპასუხოს.')).toBeInTheDocument();
});

it('counts a routed enquiry once through its linked player arrangement',()=>{
 const data=workspace();data.inquiries=[enquiry({playerName:'Duplicated routed enquiry',status:'ROUTED',caseId:91})];
 const record:AdmissionCase={id:91,version:1,playerId:61,playerName:'Linked player arrangement',dateOfBirth:'2015-01-01',organizationId:1,organizationName:'FC Dinamo Tbilisi Academy',clubId:1,groupId:21,groupName:'Dinamo U12',intake:'2026',method:'INTRODUCTION',stage:'REQUEST_RECEIVED',responsible:null,nextAction:{owner:'CLUB',code:'CLUB_REVIEW',label:'Review next step',dueAt:null},requirements:[],sessions:[],offer:null,enrollment:null,history:[],actions:[],primaryAffiliation:null,previousCaseId:null,submittedAt:'2026-10-04T00:00:00Z',updatedAt:'2026-10-04T00:00:00Z'};data.cases=[record];
 const state={data,loading:false,error:'',reload:vi.fn(),setData:vi.fn()} as unknown as ReturnType<typeof useClubAdmissions>;
 const view=render(<MemoryRouter><ClubAdmissionWorkspace state={state} sessionId={null} onOpen={vi.fn()} onRosterChanged={vi.fn()}/></MemoryRouter>);
 expect(view.container.querySelector('.admission-metric b')).toHaveTextContent('1');expect(screen.queryByText('Duplicated routed enquiry')).not.toBeInTheDocument();expect(screen.getByRole('button',{name:/Open case · Linked player arrangement/})).toBeInTheDocument();
});
it('keeps a pending leadership setup request separate from the current reply owner',()=>{
 openQueue(enquiry({setup:{canConfigure:false,canRequest:false,requested:true,destination:null},nextAction:{owner:'APPLICANT',code:'APPLICANT_REPLY',label:'Applicant reply',dueAt:null}}));
 expect(screen.getByText('The player or guardian needs to reply.')).toBeInTheDocument();
 expect(screen.getByRole('status')).toHaveTextContent('Joining setup has been requested from club leadership.');
});

it('replays the exact reviewed versions, payload and distinct IDs after new setup acquires a group identity',async()=>{
 api.save.mockRejectedValueOnce(new Error('Reply lost after commit'));
 const first=openSetup();await screen.findByLabelText('Intake');fillSetup();
 fireEvent.click(screen.getByRole('button',{name:'Save joining and return to enquiry'}));await screen.findByRole('button',{name:'Try again'});
 const original=structuredClone(api.save.mock.calls[0]);
 expect(original[1].requestId).not.toBe(original[1].group.requestId);
 const group={...original[1].group,id:21,version:6,organizationId:1,organizationName:'FC Dinamo Tbilisi Academy',clubId:1,availability:'INTRODUCTION_AVAILABLE',remainingPlaces:14,destination:'/admissions/opportunities/21',canManage:true} as Opportunity;
 first.unmount();api.setup.mockResolvedValue({...setup(),inquiryVersion:9,canConfigure:false,existingGroups:[group]});
 const data=workspace();data.inquiries=[enquiry({version:9,groupId:21})];data.groups=[group];const changed=vi.fn(),returned=vi.fn();openSetup(changed,returned,data);
 const retry=await screen.findByRole('button',{name:'Try again'});
 expect(screen.queryByRole('heading',{name:'Club leadership approval is needed'})).not.toBeInTheDocument();
 expect(screen.queryByLabelText('Intake')).not.toBeInTheDocument();expect(api.save).toHaveBeenCalledOnce();
 retry.focus();expect(retry).toHaveFocus();await userEvent.setup().keyboard('{Enter}');await waitFor(()=>expect(returned).toHaveBeenCalledOnce());
 expect(api.save.mock.calls[1]).toEqual(original);expect(original[1]).toMatchObject({expectedVersion:3,group:{expectedVersion:0}});
 expect(changed).toHaveBeenCalledOnce();expect(sessionStorage.length).toBe(0);
});

it.each([403,409])('shows a definitive %s replay rejection without claiming completion or sending a replacement',async status=>{
 api.save.mockRejectedValueOnce(new Error('Lost reply')).mockRejectedValueOnce({response:{status,data:{code:status===403?'FORBIDDEN':'ACTION_UNAVAILABLE',message:'Joining setup is no longer available.'}}});
 const changed=vi.fn(),returned=vi.fn();const first=openSetup(changed,returned);await screen.findByLabelText('Intake');fillSetup();
 fireEvent.click(screen.getByRole('button',{name:'Save joining and return to enquiry'}));await screen.findByRole('button',{name:'Try again'});first.unmount();
 api.setup.mockResolvedValue({...setup(),inquiryVersion:4,canConfigure:false});openSetup(changed,returned);
 fireEvent.click(await screen.findByRole('button',{name:'Try again'}));
 await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent(status===403?'current responsibilities':'Joining setup is no longer available.'));
 expect(screen.queryByRole('button',{name:'Try again'})).not.toBeInTheDocument();expect(screen.queryByLabelText('Intake')).not.toBeInTheDocument();
 expect(changed).not.toHaveBeenCalled();expect(returned).not.toHaveBeenCalled();expect(api.save).toHaveBeenCalledTimes(2);
 expect(api.save.mock.calls[1]).toEqual(api.save.mock.calls[0]);
});

it('explains an already configured enquiry without claiming missing leadership approval',async()=>{
 api.setup.mockResolvedValue({...setup(),inquiryVersion:4,canConfigure:false});const data=workspace();data.inquiries=[enquiry({groupId:21,version:4})];openSetup(vi.fn(),vi.fn(),data);
 expect(await screen.findByRole('heading',{name:'Joining is already configured'})).toBeInTheDocument();
 expect(screen.queryByRole('heading',{name:'Club leadership approval is needed'})).not.toBeInTheDocument();expect(api.save).not.toHaveBeenCalled();
});

it('does not offer leadership setup for a closed or context-free enquiry',async()=>{
 api.setup.mockResolvedValue({...setup(),canConfigure:false,canRequest:false,requested:false,programmeId:null,squadId:null});openSetup();
 expect(await screen.findByRole('heading',{name:'Joining setup is unavailable'})).toBeInTheDocument();expect(screen.queryByLabelText('Intake')).not.toBeInTheDocument();expect(api.save).not.toHaveBeenCalled();
});

it('keeps interrupted setup and private drafts apart from a sibling enquiry and a new login',async()=>{
 setStoredAccessToken('synthetic-A');const session=getAuthSessionId();api.save.mockRejectedValueOnce(new Error('Lost reply'));
 const first=openSetup(vi.fn(),vi.fn(),workspace(),session);await screen.findByLabelText('Intake');fillSetup();fireEvent.click(screen.getByRole('button',{name:'Save joining and return to enquiry'}));await screen.findByRole('button',{name:'Try again'});first.unmount();
 api.setup.mockResolvedValue({...setup(),inquiryId:82});const sibling=workspace();sibling.inquiries=[enquiry({id:82,playerId:62,playerName:'Synthetic sibling'})];
 const second=openSetup(vi.fn(),vi.fn(),sibling,session,82);expect(await screen.findByLabelText('Intake')).toHaveValue('');expect(screen.queryByRole('button',{name:'Try again'})).not.toBeInTheDocument();second.unmount();
 setStoredAccessToken('synthetic-B');expect(sessionStorage.length).toBe(0);api.setup.mockResolvedValue(setup());openSetup(vi.fn(),vi.fn(),workspace(),getAuthSessionId());
 expect(await screen.findByLabelText('Intake')).toHaveValue('');expect(screen.queryByRole('button',{name:'Try again'})).not.toBeInTheDocument();expect(api.save).toHaveBeenCalledOnce();
});

it('ignores a delayed setup receipt after the login changes',async()=>{
 setStoredAccessToken('synthetic-A');let reply!:(value:AdmissionInquiry)=>void;api.save.mockImplementation(()=>new Promise<AdmissionInquiry>(resolve=>{reply=resolve;}));
 const changed=vi.fn(),returned=vi.fn();openSetup(changed,returned,workspace(),getAuthSessionId());await screen.findByLabelText('Intake');fillSetup();fireEvent.click(screen.getByRole('button',{name:'Save joining and return to enquiry'}));await waitFor(()=>expect(api.save).toHaveBeenCalledOnce());
 await act(async()=>{clearStoredAuth();reply(enquiry({groupId:21,version:4}));});await screen.findByRole('alert');
 expect(screen.queryByLabelText('Intake')).not.toBeInTheDocument();expect(changed).not.toHaveBeenCalled();expect(returned).not.toHaveBeenCalled();expect(sessionStorage.length).toBe(0);
});

it('rejects a mismatched enquiry receipt without displaying another child’s outcome',async()=>{
 api.save.mockResolvedValue(enquiry({id:82,playerId:62,playerName:'Synthetic sibling',groupId:22}));const changed=vi.fn(),returned=vi.fn();openSetup(changed,returned);await screen.findByLabelText('Intake');fillSetup();fireEvent.click(screen.getByRole('button',{name:'Save joining and return to enquiry'}));
 await screen.findByRole('button',{name:'Try again'});expect(changed).not.toHaveBeenCalled();expect(returned).not.toHaveBeenCalled();expect(screen.queryByText('Synthetic sibling')).not.toBeInTheDocument();
});

it('keeps a delayed setup reply in its original enquiry when navigation selects a sibling',async()=>{
 let reply!:(value:AdmissionInquiry)=>void;api.save.mockImplementation(()=>new Promise<AdmissionInquiry>(resolve=>{reply=resolve;}));
 const changed=vi.fn(),returned=vi.fn();const first=openSetup(changed,returned);await screen.findByLabelText('Intake');fillSetup();fireEvent.click(screen.getByRole('button',{name:'Save joining and return to enquiry'}));await waitFor(()=>expect(api.save).toHaveBeenCalledOnce());
 api.setup.mockResolvedValue({...setup(),inquiryId:82});const sibling=workspace();sibling.inquiries=[enquiry({id:82,playerId:62,playerName:'Synthetic sibling'})];
 first.rerender(<MemoryRouter><JoiningProgrammeSetup inquiryId={82} workspace={sibling} sessionId={null} onChanged={changed} onReturn={returned}/></MemoryRouter>);
 expect(await screen.findByLabelText('Intake')).toHaveValue('');await act(async()=>{reply(enquiry({groupId:21,version:4}));});
 await waitFor(()=>expect(sessionStorage.getItem('gk-admission-staff:joining-setup:null:1:81')).not.toBeNull());
 expect(changed).not.toHaveBeenCalled();expect(returned).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'Try again'})).not.toBeInTheDocument();
});

it('hides a saved setup and its retry when refreshed staff access is revoked',async()=>{
 api.save.mockRejectedValueOnce(new Error('Lost reply'));const first=openSetup();await screen.findByLabelText('Intake');fillSetup();fireEvent.click(screen.getByRole('button',{name:'Save joining and return to enquiry'}));await screen.findByRole('button',{name:'Try again'});first.unmount();
 api.setup.mockRejectedValue({response:{status:403,data:{message:'Current club access is required.'}}});openSetup();await screen.findByRole('alert');expect(screen.queryByRole('button',{name:'Try again'})).not.toBeInTheDocument();expect(screen.queryByLabelText('Intake')).not.toBeInTheDocument();expect(api.save).toHaveBeenCalledOnce();
});

it('shows the club reply separately from a pending leadership setup task',()=>{
 openQueue(enquiry({setup:{canConfigure:true,canRequest:false,requested:true,destination:null},nextAction:{owner:'CLUB',code:'REPLY',label:'Club reply',dueAt:null}}));
 expect(screen.getByText('The club needs to reply.')).toBeInTheDocument();expect(screen.getByText('Leadership setup pending')).toBeInTheDocument();
});

it('keeps the pending leadership task and actual family reply readable in Georgian',()=>{
 lang.value='ka';openQueue(enquiry({setup:{canConfigure:true,canRequest:false,requested:true,destination:null},nextAction:{owner:'APPLICANT',code:'REPLY',label:'Reply',dueAt:null}}));
 expect(screen.getByText('ხელმძღვანელობის პირობების მოლოდინში')).toBeInTheDocument();expect(screen.getByText('მოთამაშემ ან მეურვემ უნდა უპასუხოს.')).toBeInTheDocument();
});

it('keeps leadership setup visible in Needs our action when the family owes the reply',()=>{
 const data=workspace();data.canConfigure=true;data.inquiries=[enquiry({setup:{canConfigure:true,canRequest:false,requested:true,destination:'/clubs/1/workspace?tab=admissions&inquiryId=81&joiningSetup=1'},nextAction:{owner:'APPLICANT',code:'APPLICANT_REPLY',label:'Applicant reply',dueAt:null}})];
 const state={data,loading:false,error:'',reload:vi.fn(),setData:vi.fn()} as unknown as ReturnType<typeof useClubAdmissions>;
 const rendered=render(<MemoryRouter><ClubAdmissionWorkspace state={state} sessionId={null} onOpen={vi.fn()} onRosterChanged={vi.fn()}/></MemoryRouter>);
 expect(screen.getByText('Synthetic child')).toBeInTheDocument();expect(screen.getByText('Leadership setup pending')).toBeInTheDocument();expect(screen.getByText('The player or guardian needs to reply.')).toBeInTheDocument();
 expect(rendered.container.querySelectorAll('.admission-metric b')[0]).toHaveTextContent('1');expect(rendered.container.querySelectorAll('.admission-metric b')[2]).toHaveTextContent('1');
 fireEvent.click(screen.getByRole('button',{name:'Waiting for family'}));expect(screen.getByText('Synthetic child')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'All ongoing requests'}));expect(screen.getAllByText('Synthetic child')).toHaveLength(1);
});

it('opens the canonical setup link and returns to its exact enquiry context',async()=>{
 const data=workspace();const state={data,loading:false,error:'',reload:vi.fn(),setData:vi.fn()} as unknown as ReturnType<typeof useClubAdmissions>;
 render(<MemoryRouter initialEntries={['/clubs/1/workspace?tab=admissions&inquiryId=81&joiningSetup=1']}><ClubAdmissionWorkspace state={state} sessionId={null} onOpen={vi.fn()} onRosterChanged={vi.fn()}/></MemoryRouter>);
 await screen.findByLabelText('Intake');expect(api.setup).toHaveBeenCalledWith(81,null,expect.any(AbortSignal));fireEvent.click(screen.getByRole('button',{name:'Return to enquiry'}));
 expect(screen.queryByLabelText('Intake')).not.toBeInTheDocument();expect(screen.getByText('Synthetic child')).toBeVisible();expect(screen.getByText('Synthetic child').closest('article')).toHaveAttribute('data-selected','true');
});
