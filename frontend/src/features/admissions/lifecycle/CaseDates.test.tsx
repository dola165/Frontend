import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {CaseDates} from './CaseDates';
import type {AdmissionCase,LifecycleDates} from '../types';
import raw from '../applicant/__fixtures__/place_offered.json?raw';
const api=vi.hoisted(()=>({fetch:vi.fn(),command:vi.fn(),detail:vi.fn()}));
vi.mock('../api',()=>({fetchLifecycleDates:api.fetch,commandLifecycleDates:api.command,fetchAdmissionCase:api.detail,newAdmissionRequestId:()=>crypto.randomUUID()}));
vi.mock('../../squadCommunication/journeyCopy',()=>({useJourneyCopy:()=>((en:string)=>en)}));
vi.mock('react-i18next',()=>({useTranslation:()=>({i18n:{resolvedLanguage:'en'}})}));
const c=JSON.parse(raw) as AdmissionCase;
const base:LifecycleDates={caseId:c.id,caseVersion:c.version,reviewDueAt:'2026-10-14T20:00:00Z',reviewTimezone:'Asia/Tbilisi',reviewSource:'EXPLICIT',reviewOverdue:false,reviewOwner:'Dinamo coach',departure:null,seasonCaseId:null,seasonGroupName:null,seasonDestination:null,actions:['SET_REVIEW_DATE']};
beforeEach(()=>{sessionStorage.clear();vi.resetAllMocks();api.fetch.mockResolvedValue(base);api.detail.mockResolvedValue({...c,version:c.version+1});});
afterEach(cleanup);
const view=(record=c)=>render(<MemoryRouter><CaseDates record={record} sessionId="date-session" onChanged={vi.fn()}/></MemoryRouter>);
it('shows owner and club timezone and retries the exact review date after a lost response and remount',async()=>{
 api.command.mockRejectedValueOnce(new Error('Response lost')).mockResolvedValueOnce({...base,caseVersion:c.version+1});const first=view();await screen.findByRole('button',{name:'Set review date'});
 expect(screen.getByText(/Dinamo coach/)).toHaveTextContent('Asia/Tbilisi');fireEvent.change(screen.getByLabelText('Club-local date'),{target:{value:'2026-10-22'}});fireEvent.change(screen.getByLabelText('Arrangement and outstanding work'),{target:{value:'Review after two arranged sessions'}});fireEvent.click(screen.getByRole('button',{name:'Set review date'}));await screen.findByRole('alert');const original=api.command.mock.calls[0][1];expect(original).toMatchObject({action:'SET_REVIEW_DATE',date:'2026-10-22',expectedVersion:c.version});first.unmount();view({...c,version:c.version+4});fireEvent.click(await screen.findByRole('button',{name:'Retry'}));await waitFor(()=>expect(api.command).toHaveBeenCalledTimes(2));expect(api.command.mock.calls[1][1]).toEqual(original);
});
it('shows the actual proposed departure and only the recipient agreement action',async()=>{
 const departure={status:'PROPOSED' as const,localDate:'2026-10-20',timezone:'Asia/Tbilisi',effectiveAt:'2026-10-19T20:00:00Z',proposedBy:9,proposedSide:'CLUB' as const,agreedBy:null,reason:'Agreed final training plan; invoice still needs review'};
 api.fetch.mockResolvedValue({...base,departure,actions:['AGREE_DEPARTURE','DECLINE_DEPARTURE']});api.command.mockResolvedValue({...base,departure:{...departure,status:'AGREED',agreedBy:8},actions:[]});view();await screen.findByRole('button',{name:'Agree this departure'});expect(screen.queryByRole('button',{name:'Set review date'})).not.toBeInTheDocument();expect(screen.getByText(/Financial, administrative/)).toBeVisible();fireEvent.change(screen.getByLabelText('Arrangement and outstanding work'),{target:{value:'I agree the actual date and retained obligations'}});fireEvent.click(screen.getByRole('button',{name:'Agree this departure'}));await waitFor(()=>expect(api.command).toHaveBeenCalledWith(c.id,expect.objectContaining({action:'AGREE_DEPARTURE',reason:'I agree the actual date and retained obligations',expectedVersion:c.version}),'date-session'));
});
it('shows the linked next intake and no acceptance claim or enrollment mutation',async()=>{
 api.fetch.mockResolvedValue({...base,seasonCaseId:200,seasonGroupName:'U14 next season',seasonDestination:'/admissions/cases/200',actions:[]});view();expect(await screen.findByRole('link',{name:'Review proposed next intake: U14 next season'})).toHaveAttribute('href','/admissions/cases/200');expect(api.command).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:/accept/i})).not.toBeInTheDocument();
});
