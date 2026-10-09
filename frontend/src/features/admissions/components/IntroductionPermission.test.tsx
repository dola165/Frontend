import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { AdmissionCase, Participation } from '../types';
import caseJson from '../applicant/__fixtures__/introduction_assessment.json?raw';
import { SessionResponse } from '../applicant/CaseActions';
import { IntroductionPermission } from './IntroductionPermission';
vi.mock('../../squadCommunication/journeyCopy',()=>({useJourneyCopy:()=>((en:string)=>en)}));
vi.mock('../../../utils/authStorage',()=>({getAuthSessionId:()=> 'permission-session',isCurrentAuthSession:()=>true}));
vi.mock('../../../context/AuthContext',()=>({useAuth:()=>({sessionId:'permission-session',user:{id:77},isAuthenticated:true})}));
vi.mock('../api',()=>({commandAdmission:vi.fn(),newAdmissionRequestId:()=> 'permission-request'}));
afterEach(cleanup);
const example=()=>JSON.parse(caseJson) as AdmissionCase;
const session:Participation={id:80,version:1,title:'Synthetic introductory training',startsAt:'2026-10-07T13:00:00Z',endsAt:'2026-10-07T14:00:00Z',timezone:'Asia/Tbilisi',location:{name:'Synthetic academy ground',address:'Tbilisi synthetic pitch',latitude:null,longitude:null},contact:'Host coach',preparation:'Water',cost:'Free',capacity:2,responseDeadline:'2026-10-06T13:00:00Z',squadSessionId:null,noRegularPlaceGuaranteed:true,status:'INVITED',emergencyContact:null};
const required=(p:Participation=session):Participation=>({...p,status:'INVITED',introductionPermission:{required:true,reason:'Current club requires assessment permission.',status:'PENDING',owner:'CLUB',evidence:null,currentClub:null,recordedAt:null,canRecord:true,canRevoke:false,allowsParticipation:false}});
describe('Introduction permission task',()=>{
 it('family sees the host task and cannot confirm before evidence is recorded',()=>{
  const c=example();c.actions=['CONFIRM_SESSION'];const s=required(c.sessions[0]);render(<MemoryRouter><SessionResponse admissionCase={c} session={s} onChanged={vi.fn()} refresh={vi.fn()}/></MemoryRouter>);
  expect(screen.queryByRole('button',{name:'Confirm this session'})).not.toBeInTheDocument();expect(screen.getByText(/Authorized host staff must record it/)).toBeVisible();expect(screen.queryByRole('button',{name:'Record session permission'})).not.toBeInTheDocument();
 });
 it('staff must provide an actual source and reference; authorized task records both',async()=>{
  const s=required(example().sessions[0]);const record=vi.fn().mockResolvedValue(true);render(<IntroductionPermission session={s} playerName="Synthetic child" onRecord={record}/>);
  const save=screen.getByRole('button',{name:'Record session permission'});expect(save).toBeDisabled();fireEvent.change(screen.getByRole('textbox',{name:'Current club / source contact'}),{target:{value:'Synthetic club secretary'}});fireEvent.change(screen.getByRole('textbox',{name:'Actual permission reference'}),{target:{value:'Session-specific reference TEST-001'}});fireEvent.click(save);await waitFor(()=>expect(record).toHaveBeenCalledWith('Synthetic club secretary','Session-specific reference TEST-001'));
 });
 it('ordinary introduction stays simple and current evidence restores personal confirmation',()=>{
  const c=example();c.actions=['CONFIRM_SESSION'];const s=required(c.sessions[0]);s.introductionPermission={...s.introductionPermission!,status:'COMPLETE',allowsParticipation:true,canRecord:false,evidence:'TEST-001',currentClub:'Synthetic current club'};
  render(<MemoryRouter><SessionResponse admissionCase={c} session={s} onChanged={vi.fn()} refresh={vi.fn()}/></MemoryRouter>);expect(screen.getByRole('button',{name:'Confirm this session'})).toBeVisible();expect(screen.getByText('Permission evidence recorded')).toBeVisible();cleanup();render(<IntroductionPermission session={{...s,introductionPermission:{...s.introductionPermission!,required:false}}} playerName="Synthetic child"/>);expect(screen.queryByText('Current-club permission before this session')).not.toBeInTheDocument();
 });
});
