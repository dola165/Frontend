import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { JoiningProgrammeSetup } from './JoiningProgrammeSetup';
import type { AdmissionInquiry, AdmissionWorkspace } from '../types';
import type { JoiningSetup } from '../../joining-contract/types';
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
const openSetup=(onChanged=vi.fn(),onReturn=vi.fn())=>render(<MemoryRouter><JoiningProgrammeSetup inquiryId={81} workspace={workspace()} sessionId={null} onChanged={onChanged} onReturn={onReturn}/></MemoryRouter>);
beforeEach(()=>{localStorage.clear();sessionStorage.clear();vi.clearAllMocks();lang.value='en';api.setup.mockResolvedValue(setup());api.save.mockResolvedValue(enquiry({groupId:21,version:4}));});
afterEach(cleanup);
function fillSetup() {
 for(const [name,value] of [['Intake','2026 autumn'],['Regular group capacity','14'],['First eligible birth year','2014'],['Last eligible birth year','2016'],['Season / age reference date','2026-10-04'],['Training venue','Academy pitch'],['Address','Synthetic academy address'],['Normal schedule','Tuesday and Thursday 17:00'],['Start date','2026-10-12']] as const)fireEvent.change(screen.getByLabelText(name),{target:{value}});
 for(const label of [/I reviewed the existing programme/,/I checked the available capacity/,/I reviewed the actual schedule/])fireEvent.click(screen.getByRole('checkbox',{name:label}));
}

it('keeps outer setup and nested group receipt IDs distinct',async()=>{
 openSetup();await screen.findByLabelText('Intake');fillSetup();
 fireEvent.click(screen.getByRole('button',{name:'Save joining and return to enquiry'}));
 await waitFor(()=>expect(api.save).toHaveBeenCalledOnce());
 const body=api.save.mock.calls[0][1];
 expect(body.requestId).not.toBe(body.group.requestId);
});
it('keeps receipt recovery available when the committed setup is no longer configurable',async()=>{
 api.save.mockRejectedValueOnce(new Error('Response lost after commit'));
 const returned=vi.fn();const view=openSetup(vi.fn(),returned);
 await screen.findByLabelText('Intake');fillSetup();
 fireEvent.click(screen.getByRole('button',{name:'Save joining and return to enquiry'}));
 await screen.findByRole('button',{name:'Try again'});view.unmount();
 api.setup.mockResolvedValue({...setup(),inquiryVersion:4,canConfigure:false,canRequest:false});
 api.save.mockResolvedValueOnce(enquiry({groupId:21,version:4}));
 openSetup(vi.fn(),returned);
 fireEvent.click(await screen.findByRole('button',{name:'Try again'}));
 await waitFor(()=>expect(returned).toHaveBeenCalledOnce());
 expect(api.save.mock.calls[1]).toEqual(api.save.mock.calls[0]);
});
