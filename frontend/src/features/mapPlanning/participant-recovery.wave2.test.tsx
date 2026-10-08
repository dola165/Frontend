import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import MapPlanWorkspace from './MapPlanWorkspace';
import { emptyDraft,planGet,savePlan,type Plan,type PlanContext } from './api';
import { recoverPlan,rememberPlan } from './draftRecovery';
import { getAuthSessionId } from '../../utils/authStorage';

vi.mock('./api',async original=>({...await original<typeof import('./api')>(),planGet:vi.fn(),planPost:vi.fn(),savePlan:vi.fn()}));
const context:PlanContext={id:4,name:'FC Dinamo Tbilisi Academy',settings:{timezone:'Asia/Tbilisi',currency:'GEL'},squads:[{id:5,name:'U16',canEdit:true}],participants:[{id:6,name:'Current player',squad_id:5},{id:7,name:'Another squad player',squad_id:9}],events:[],sessions:[]};
const record=():Plan=>({id:8,club_id:4,squad_id:5,title:'Away match',revision:3,created_by:2,published_version:0,published_revision:null,updated_at:'2026-09-30T06:00Z',starts_at:'2026-10-07T08:00Z',draft:{...emptyDraft(context),title:'Away match',participants:[6,7,99],privateNotes:'Keep the route notes',familyMessage:'Bring water'},suppliers:{},totalMinor:0,budgetApproved:false,approvedBy:null,rights:{edit:true,travel:true,finance:false,publish:true,leadership:false},issues:[],history:[],familyResponses:[],trip_id:null,trip:null,passengers:[],linkedSchedule:[]});
beforeEach(()=>{localStorage.clear();localStorage.setItem('userId','2');localStorage.setItem('gk-session-id','test-session');vi.clearAllMocks();vi.mocked(planGet).mockImplementation(async path=>(path==='/context'?[context]:path==='/8'?record():[]) as never);});
afterEach(cleanup);

it.each(['saved','recovered'] as const)('repairs unavailable participants in a %s Dinamo plan while retaining other work',async source=>{
  const stored=record();
  if(source==='recovered')rememberPlan({key:'plan:8',planId:8,clubId:4,squadId:5,requestId:'stable',baseRevision:3,baseDraft:stored.draft,draft:{...stored.draft,privateNotes:'Recovered route notes'},savedAt:Date.now()},getAuthSessionId());
  render(<MemoryRouter initialEntries={['/map?plans=staff&plan=8']}><MapPlanWorkspace onMapClick={vi.fn()} onPickMode={vi.fn()} onPreview={vi.fn()} onLayout={vi.fn()} initialClubId={4} candidate={null} onCandidateUsed={vi.fn()} onPlaces={vi.fn()} onFocus={vi.fn()} onExplore={vi.fn()} onClose={vi.fn()}/></MemoryRouter>);
  await screen.findByDisplayValue('Away match');
  fireEvent.click(screen.getByRole('navigation',{name:'Planning sections'}).querySelector('button:nth-child(5)')!);
  expect(screen.queryByText('Another squad player')).toBeNull();
  const remove=await screen.findByRole('button',{name:'Remove unavailable players'});
  expect(screen.getByText(/2 selected players are no longer available/)).toBeVisible();
  fireEvent.click(remove);
  expect(screen.queryByRole('button',{name:'Remove unavailable players'})).toBeNull();
  expect(screen.getByRole('checkbox',{name:/Current player/})).toBeChecked();
  const recovered=recoverPlan('plan:8')!;
  expect(recovered.draft.participants).toEqual([6]);
  expect(recovered.draft.privateNotes).toBe(source==='recovered'?'Recovered route notes':'Keep the route notes');
  expect(recovered.draft.familyMessage).toBe('Bring water');
  vi.mocked(savePlan).mockResolvedValue({...stored,revision:4,draft:recovered.draft});
  fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
  await waitFor(()=>expect(savePlan).toHaveBeenCalledWith(8,3,recovered.draft));
  await screen.findByText('All changes saved');
});
