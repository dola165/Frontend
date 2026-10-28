import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StaffAppointments } from './PersonalClubWork';
import type { Appointment } from './api';
import type { NavigationCapabilities } from '../../context/navigationCapabilities';
const api=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),put:vi.fn(),refresh:vi.fn()}));
const auth=vi.hoisted(()=>({user:{id:2,navigationCapabilities:undefined as NavigationCapabilities|undefined},sessionId:'test'}));
vi.mock('../../api/axiosConfig',()=>({apiClient:api}));
vi.mock('../../context/AuthContext',()=>({useAuth:()=>({...auth,refreshNavigationCapabilities:api.refresh})}));
vi.mock('./FamilyClubWork',()=>({FamilyClubWork:()=>null}));
const appointment:Appointment={id:7,club_id:1,club_name:'FC Dinamo Tbilisi Academy',user_id:2,title:'Academy technical coach',specialisations:['TECHNICAL_COACH'],engagement:'VOLUNTEER',squad_id:11,squad_ids:[11,12],squad_names:['Academy U12','Academy U16'],permissions:['DEVELOPMENT:WRITE'],starts_on:'2026-09-26',ends_on:null,status:'INVITED',effective_status:'INVITED',revision:2,published:false};
beforeEach(()=>{vi.clearAllMocks();auth.user={id:2,navigationCapabilities:undefined};auth.sessionId='test';api.get.mockResolvedValue({data:{appointments:[appointment],permissions:[],clubs:[]}});api.post.mockResolvedValue({});api.refresh.mockResolvedValue(undefined);});
afterEach(cleanup);
it('shows all selected teams and requires a second action before accepting',async()=>{
 const changed=vi.fn();render(<MemoryRouter><StaffAppointments onChanged={changed}/></MemoryRouter>);await screen.findByText('Academy U12, Academy U16');
 fireEvent.click(screen.getByRole('button',{name:'Accept appointment'}));expect(api.post).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Confirm acceptance'}));await waitFor(()=>expect(api.post).toHaveBeenCalledExactlyOnceWith('/clubs/1/operations/appointments/7/transition',{revision:2,status:'ACTIVE',note:null}));await waitFor(()=>expect(changed).toHaveBeenCalledOnce());
});
it('retains unavailable invitation terms without offering acceptance',async()=>{
 api.get.mockResolvedValue({data:{appointments:[{...appointment,effective_status:'UNAVAILABLE',unavailable_reason:'Issuer authority ended.'}],permissions:[],clubs:[]}});
 render(<MemoryRouter><StaffAppointments/></MemoryRouter>);await screen.findByText('Issuer authority ended.');expect(screen.getByRole('button',{name:'Accept appointment'})).toBeDisabled();expect(screen.getByRole('button',{name:'Decline'})).toBeEnabled();
});
it('lets staff end one appointment only after reviewing the consequence',async()=>{
 api.get.mockResolvedValue({data:{appointments:[{...appointment,status:'ACTIVE',effective_status:'ACTIVE'}],permissions:[],clubs:[{id:1,name:'Dinamo'}]}});
 render(<MemoryRouter><StaffAppointments/></MemoryRouter>);fireEvent.click(await screen.findByRole('button',{name:'End this appointment'}));expect(api.post).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Confirm end'}));await waitFor(()=>expect(api.post).toHaveBeenCalledExactlyOnceWith('/clubs/1/operations/appointments/7/transition',{revision:2,status:'ENDED',note:null}));
});

it.each(['empty','failed'])('hides pending and %s appointment discovery from unrelated people',async result=>{
 let resolve!:(value:unknown)=>void, reject!:(error:Error)=>void;
 api.get.mockImplementationOnce(()=>new Promise((done,fail)=>{resolve=done;reject=fail;}));
 const view=render(<MemoryRouter><StaffAppointments/></MemoryRouter>);
 expect(view.container).toBeEmptyDOMElement();
 await act(async()=>{if(result==='empty')resolve({data:{appointments:[],permissions:[],clubs:[]}});else reject(new Error('offline'));});
 expect(view.container).toBeEmptyDOMElement();
});

it('keeps an empty staff section and failures visible for club.work without a self-link',async()=>{
 auth.user.navigationCapabilities={version:1,workspaces:[{id:'club.work',context:{type:'user',id:2,label:'Synthetic staff'}}]};
 api.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({data:{appointments:[],permissions:[],clubs:[]}});
 render(<MemoryRouter><StaffAppointments/></MemoryRouter>);
 expect(screen.getByRole('status')).toHaveTextContent('Loading your club work');
 fireEvent.click(await screen.findByRole('button',{name:'Refresh requests'}));
 await screen.findByText('No appointments');
 expect(screen.queryByRole('link',{name:'View requests'})).not.toBeInTheDocument();
});

it('drops old appointments immediately on an account switch and ignores a late prior-account reply',async()=>{
 let resolve!:(value:unknown)=>void;
 const view=render(<MemoryRouter><StaffAppointments/></MemoryRouter>);
 await screen.findByText('Academy technical coach');
 api.get.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
 auth.sessionId='two';auth.user.id=3;view.rerender(<MemoryRouter><StaffAppointments/></MemoryRouter>);
 expect(view.container).toBeEmptyDOMElement();
 api.get.mockResolvedValueOnce({data:{appointments:[],permissions:[],clubs:[]}});
 auth.sessionId='three';auth.user.id=4;view.rerender(<MemoryRouter><StaffAppointments/></MemoryRouter>);
 await act(async()=>resolve({data:{appointments:[appointment],permissions:[],clubs:[]}}));
 expect(view.container).toBeEmptyDOMElement();
});
