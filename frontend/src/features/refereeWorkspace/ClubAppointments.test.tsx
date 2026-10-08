import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ClubAppointments } from './ClubAppointments';
import { post } from '../matchExchange/api';
import type { Appointment } from '../clubOperations/api';
const state=vi.hoisted(()=>({rows:[] as Appointment[]}));
vi.mock('../matchExchange/useRefereeHistory',()=>({useRefereeHistory:()=>({data:{appointments:state.rows},error:'',reload:vi.fn()})}));
vi.mock('../matchExchange/api',async original=>({...await original<typeof import('../matchExchange/api')>(),post:vi.fn()}));
beforeEach(()=>{state.rows=[{id:1,club_id:1,club_name:'Dinamo',user_id:7,title:'U12 referee',squad_id:9,squad_name:'U12 Mixed',permissions:['FACILITIES:READ'],specialisations:['REFEREE'],engagement:'VOLUNTEER',status:'INVITED',starts_on:'2026-09-25',ends_on:null,published:false,revision:3}];});
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('keeps acceptance feedback visible after the invitation disclosure collapses',async()=>{
 vi.mocked(post).mockImplementation(async()=>{state.rows=state.rows.map(a=>({...a,status:'ACTIVE'}));return {};});render(<ClubAppointments/>);fireEvent.click(screen.getByRole('button',{name:'Accept club appointment'}));expect(await screen.findByRole('status')).toBeVisible();expect(screen.getByRole('status')).toHaveTextContent('Club appointment accepted');expect(post).toHaveBeenCalledWith('/clubs/1/operations/appointments/1/transition',{status:'ACTIVE',revision:3});
});
it('keeps decline feedback visible when the last club invitation disappears',async()=>{
 vi.mocked(post).mockImplementation(async()=>{state.rows=[];return {};});render(<ClubAppointments/>);fireEvent.click(screen.getByRole('button',{name:'Decline club appointment'}));expect(await screen.findByRole('status')).toHaveTextContent('Club appointment declined');expect(screen.getByRole('status')).toBeVisible();
});
