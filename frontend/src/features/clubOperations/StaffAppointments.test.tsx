import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import MyClubOperationsPage from '../../pages/MyClubOperationsPage';
import type { Appointment } from './api';
const api=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),put:vi.fn(),refresh:vi.fn()}));
vi.mock('../../api/axiosConfig',()=>({apiClient:api}));
vi.mock('../../context/AuthContext',()=>({useAuth:()=>({user:{id:2},sessionId:'test',refreshNavigationCapabilities:api.refresh})}));
vi.mock('./FamilyClubWork',()=>({FamilyClubWork:()=>null}));
const appointment:Appointment={id:7,club_id:1,club_name:'FC Dinamo Tbilisi Academy',user_id:2,title:'Academy technical coach',specialisations:['TECHNICAL_COACH'],engagement:'VOLUNTEER',squad_id:11,squad_ids:[11,12],squad_names:['Academy U12','Academy U16'],permissions:['DEVELOPMENT:WRITE'],starts_on:'2026-09-26',ends_on:null,status:'INVITED',effective_status:'INVITED',revision:2,published:false};
beforeEach(()=>{vi.clearAllMocks();api.get.mockResolvedValue({data:{appointments:[appointment],permissions:[],clubs:[]}});api.post.mockResolvedValue({});api.refresh.mockResolvedValue(undefined);});
afterEach(cleanup);
it('shows all selected teams and requires a second action before accepting',async()=>{
 render(<MemoryRouter><MyClubOperationsPage/></MemoryRouter>);await screen.findByText('Academy U12, Academy U16');
 fireEvent.click(screen.getByRole('button',{name:'Accept appointment'}));expect(api.post).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Confirm acceptance'}));await waitFor(()=>expect(api.post).toHaveBeenCalledExactlyOnceWith('/clubs/1/operations/appointments/7/transition',{revision:2,status:'ACTIVE',note:null}));
});
it('retains unavailable invitation terms without offering acceptance',async()=>{
 api.get.mockResolvedValue({data:{appointments:[{...appointment,effective_status:'UNAVAILABLE',unavailable_reason:'Issuer authority ended.'}],permissions:[],clubs:[]}});
 render(<MemoryRouter><MyClubOperationsPage/></MemoryRouter>);await screen.findByText('Issuer authority ended.');expect(screen.getByRole('button',{name:'Accept appointment'})).toBeDisabled();expect(screen.getByRole('button',{name:'Decline'})).toBeEnabled();
});
it('lets staff end one appointment only after reviewing the consequence',async()=>{
 api.get.mockResolvedValue({data:{appointments:[{...appointment,status:'ACTIVE',effective_status:'ACTIVE'}],permissions:[],clubs:[{id:1,name:'Dinamo'}]}});
 render(<MemoryRouter><MyClubOperationsPage/></MemoryRouter>);fireEvent.click(await screen.findByRole('button',{name:'End this appointment'}));expect(api.post).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Confirm end'}));await waitFor(()=>expect(api.post).toHaveBeenCalledExactlyOnceWith('/clubs/1/operations/appointments/7/transition',{revision:2,status:'ENDED',note:null}));
});
