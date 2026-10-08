import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceRolesPanel } from './WorkspaceRoleViews';
import { focusedBootstrap, type RolesWorkspace } from './useWorkspaceRoles';
import { post, type Bootstrap } from './api';
vi.mock('./api',async()=>{const actual=await vi.importActual<typeof import('./api')>('./api');return {...actual,post:vi.fn().mockResolvedValue({}),get:vi.fn().mockResolvedValue([])};});
const data:RolesWorkspace={leadership:false,actorId:2,catalog:[{key:'STRENGTH_CONDITIONING',title:'Gym & conditioning coach',description:'Training and development',permissions:['DEVELOPMENT:WRITE']}],views:[],current:{id:'appointment-5',label:'Equipment',modules:['EQUIPMENT'],squadIds:[11],clubWide:false,appointmentId:5,revision:3},requestSquads:[{id:11,name:'U12'},{id:12,name:'U16'}],squads:[],people:[],sessions:[],requests:[],invitations:[]};data.views=[data.current];
afterEach(()=>{cleanup();vi.clearAllMocks();});
describe('Staff role workflow',()=>{
 it('requests a change with the reviewed original revision, without assigning itself',async()=>{
  render(<MemoryRouter><WorkspaceRolesPanel club={4} data={data} onChanged={()=>{}}/></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Request a role change'}));
  fireEvent.change(screen.getByRole('combobox',{name:'Change an existing role'}),{target:{value:'5'}});
  fireEvent.click(screen.getByRole('checkbox',{name:'U12'}));
  fireEvent.click(screen.getByRole('checkbox',{name:'U16'}));
  fireEvent.click(screen.getByRole('button',{name:'Send for approval'}));
  await waitFor(()=>expect(post).toHaveBeenCalledWith('/clubs/4/workspace-roles/requests',expect.objectContaining({roleKey:'STRENGTH_CONDITIONING',squadIds:[11,12],clubWide:false,replaceAppointmentId:5,replaceRevision:3})));
  expect(post).toHaveBeenCalledTimes(1);
 });
 it('requires an explicit second decision before granting a requested role',async()=>{
  const requests=[{id:8,user_id:3,name:'Coach',role_key:'STRENGTH_CONDITIONING',squad_name:'U12',replace_appointment_id:5,permissions:['DEVELOPMENT:WRITE'],note:'Gym help',review_note:null,status:'PENDING',revision:2}];
  render(<MemoryRouter><WorkspaceRolesPanel club={4} data={{...data,leadership:true,requests}} admin onChanged={()=>{}}/></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Review & approve'}));expect(post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Confirm approval'}));
  await waitFor(()=>expect(post).toHaveBeenCalledWith('/clubs/4/workspace-roles/requests/8',expect.objectContaining({status:'APPROVED',revision:2})));
 });
 it('does not show approval controls for the admin’s own request',()=>{
  render(<MemoryRouter><WorkspaceRolesPanel club={4} data={{...data,leadership:true,requests:[{id:8,user_id:2,name:'Self',role_key:'STRENGTH_CONDITIONING',squad_name:null,replace_appointment_id:null,permissions:[],note:null,review_note:null,status:'PENDING',revision:0}]}} admin onChanged={()=>{}}/></MemoryRouter>);
  expect(screen.queryByRole('button',{name:'Review & approve'})).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Withdraw request'})).toBeInTheDocument();
 });
 it('narrows editor choices without inventing write access',()=>{
  const boot={squads:data.requestSquads,people:[],guardians:[],modules:[{id:'EQUIPMENT',globalWrite:true,writable:true,writeSquads:[11,12]},{id:'MEDICAL',globalWrite:false,writable:false,writeSquads:[]}],links:[],sessions:[]} as unknown as Bootstrap;
  const scoped=focusedBootstrap(boot,data);
  expect(scoped.modules).toEqual([{id:'EQUIPMENT',globalWrite:false,writable:true,writeSquads:[11]}]);expect(scoped.squads.map(s=>s.id)).toEqual([11]);expect(scoped.defaultSquadId).toBe(11);
 });
});
