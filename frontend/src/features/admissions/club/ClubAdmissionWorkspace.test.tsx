import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ClubAdmissionWorkspace } from './ClubAdmissionWorkspace';
import type { AdmissionCase, AdmissionWorkspace } from '../types';
import type { useClubAdmissions } from './useClubAdmissions';
vi.mock('../legacy/LegacyAdmissions',()=>({LegacyAdmissions:({view}:{view:string})=><p>Previous participation {view}</p>}));
vi.mock('./CaseDetail',()=>({CaseDetail:({record}:{record:AdmissionCase})=><h2>Opened arrangement {record.id}</h2>}));
vi.mock('../../parents/FamilyClubEnrollment',()=>({FamilyClubEnrollment:()=><h2>Guardian code intake</h2>}));
vi.mock('./OfflineInquiry',()=>({OfflineInquiry:()=><h2>Group invitation</h2>}));
vi.mock('react-i18next',()=>({useTranslation:()=>({i18n:{resolvedLanguage:'en'}})}));
const record=(id:number,name:string,owner:'CLUB'|'APPLICANT'|'NONE',stage:AdmissionCase['stage']='REQUEST_RECEIVED'):AdmissionCase=>({id,version:1,playerId:1000+id,playerName:name,dateOfBirth:'2015-01-01',organizationId:1,organizationName:'Dinamo Academy',clubId:1,method:'INTRODUCTION',groupName:'Dinamo U12',groupId:2,intake:'2026',stage,responsible:null,nextAction:{owner,code:'CLUB_REVIEW',label:'Review next step',dueAt:null},requirements:[],sessions:[],offer:null,enrollment:null,history:[],actions:['MESSAGE'],primaryAffiliation:null,previousCaseId:null,submittedAt:'2026-10-04T00:00:00Z',updatedAt:'2026-10-04T00:00:00Z'});
const data={organizationId:1,organizationName:'Dinamo Academy',clubId:1,canConfigure:false,groups:[],staff:[],squads:[],inquiries:[],cases:[record(91,'Player needing coach','CLUB'),record(92,'Player awaiting family','APPLICANT'),record(93,'Current player','NONE','ENROLLED')]} as AdmissionWorkspace;
function open(path='/clubs/1/workspace?tab=admissions') {
  const state={data,loading:false,error:'',reload:vi.fn(),setData:vi.fn()} as unknown as ReturnType<typeof useClubAdmissions>;
  render(<MemoryRouter initialEntries={[path]}><ClubAdmissionWorkspace state={state} sessionId={null} onOpen={vi.fn()} onRosterChanged={vi.fn()}/></MemoryRouter>);
}
it('starts with the coach’s next actions and exposes family waiting and player history separately',()=>{
  open();expect(screen.getByRole('button',{name:/Open case · Player needing coach/})).toBeInTheDocument();expect(screen.queryByRole('button',{name:/Player awaiting family/})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:/Current player/})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Waiting for family'}));expect(screen.getByRole('button',{name:/Open case · Player awaiting family/})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Players & history'}));expect(screen.getByRole('button',{name:/Open case · Current player/})).toBeInTheDocument();expect(screen.getByText('Previous participation history')).toBeInTheDocument();
});
it('resolves the contract caseId link to the exact arrangement',()=>{open('/clubs/1/workspace?tab=admissions&caseId=92');expect(screen.getByRole('heading',{name:'Opened arrangement 92'})).toBeInTheDocument();});
it('opens code intake beside invitations and closes a URL-opened intake panel',()=>{
  open('/clubs/1/workspace?tab=admissions&intake=1');expect(screen.getByRole('heading',{name:'Guardian code intake'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Add / invite player'}));expect(screen.queryByRole('heading',{name:'Guardian code intake'})).not.toBeInTheDocument();
});
