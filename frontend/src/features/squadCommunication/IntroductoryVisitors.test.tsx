import '../../i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { IntroductoryVisitors } from './IntroductoryVisitors';
import { SquadSessionDetails } from './SquadSessionDialog';
import { sessionEvent } from './useSquadSchedule';
import * as api from './api';
import { getAuthSessionId, setStoredAccessToken, setStoredUserId } from '../../utils/authStorage';

vi.mock('./api',()=>({recordVisitorAttendance:vi.fn()}));
vi.mock('./SquadVenueReservationPanel',()=>({SquadVenueReservationPanel:()=>null}));
const visitor:api.IntroductoryVisitor={participationId:5,caseId:8,playerId:50,caseVersion:3,participationVersion:2,name:'Synthetic visitor',status:'CONFIRMED',permissionStatus:'CURRENT',emergencyContact:'Synthetic emergency contact',canRecord:true};
const session:api.SquadSession={id:9,title:'Training',starts_at:'2020-01-01T13:00:00Z',ends_at:'2020-01-01T14:00:00Z',location:'Pitch',status:'SCHEDULED',cancellation_reason:null,revision:4,attendance:[],introductory_visitors:[visitor]};
beforeEach(()=>{vi.resetAllMocks();localStorage.clear();setStoredAccessToken(`e30.${btoa(JSON.stringify({sub:'20'}))}.test`);setStoredUserId(20);});
it('real staff session shows actual visitor attendance separately from regular replies',async()=>{
    const saved=vi.fn();vi.mocked(api.recordVisitorAttendance).mockResolvedValue({...visitor,status:'ATTENDED',permissionStatus:'HISTORICAL',canRecord:false,emergencyContact:null});
    render(<MemoryRouter><SquadSessionDetails event={sessionEvent({id:10,name:'Dinamo'},session)} canManage onClose={vi.fn()} onSaved={saved}/></MemoryRouter>);
    expect(screen.getByRole('region',{name:'Introductory visitors'})).toBeInTheDocument();expect(screen.getByText(/Synthetic emergency contact/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox',{name:'Actual attendance for Synthetic visitor'}),{target:{value:'ATTENDED'}});fireEvent.click(screen.getByRole('button',{name:'Save attendance for Synthetic visitor'}));
    await waitFor(()=>expect(api.recordVisitorAttendance).toHaveBeenCalledWith(10,9,5,expect.objectContaining({caseId:8,caseVersion:3,participationVersion:2,sessionRevision:4,attendance:'ATTENDED'}),getAuthSessionId()));
    expect(await screen.findByText('Attended')).toBeInTheDocument();expect(screen.queryByText(/Synthetic emergency contact/)).not.toBeInTheDocument();expect(saved).toHaveBeenCalledOnce();
});
it('family cannot see visitor list even if an obsolete payload contains it',()=>{
    render(<MemoryRouter><SquadSessionDetails event={sessionEvent({id:10,name:'Dinamo'},session)} onClose={vi.fn()} onSaved={vi.fn()}/></MemoryRouter>);
    expect(screen.queryByText('Synthetic visitor')).not.toBeInTheDocument();expect(screen.queryByText(/Synthetic emergency contact/)).not.toBeInTheDocument();
});
it('permission review and historical rows cannot create new attendance',()=>{
    render(<IntroductoryVisitors squadId={10} sessionId={9} revision={4} visitors={[{...visitor,permissionStatus:'GUARDIAN_REVIEW',canRecord:false,emergencyContact:null},{...visitor,participationId:6,name:'Past visitor',status:'NO_SHOW',permissionStatus:'HISTORICAL',canRecord:false,emergencyContact:null}]} onSaved={vi.fn()}/>);
    expect(screen.getByText(/Guardian authority needs review/)).toBeInTheDocument();expect(screen.getByText('Did not attend')).toBeInTheDocument();expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
});
it('lost response retries the identical command instead of guessing a new fact',async()=>{
    const saved=vi.fn();vi.mocked(api.recordVisitorAttendance).mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce({...visitor,status:'NO_SHOW',permissionStatus:'HISTORICAL',canRecord:false,emergencyContact:null});
    render(<IntroductoryVisitors squadId={10} sessionId={9} revision={4} visitors={[visitor]} onSaved={saved}/>);
    fireEvent.change(screen.getByRole('combobox'),{target:{value:'NO_SHOW'}});fireEvent.click(screen.getByRole('button',{name:'Save attendance for Synthetic visitor'}));
    const retry=await screen.findByRole('button',{name:'Retry attendance for Synthetic visitor'});await waitFor(()=>expect(retry).toBeEnabled());fireEvent.click(retry);
    await waitFor(()=>expect(saved).toHaveBeenCalledOnce());expect(api.recordVisitorAttendance).toHaveBeenCalledTimes(2);
    expect(vi.mocked(api.recordVisitorAttendance).mock.calls[1]).toEqual(vi.mocked(api.recordVisitorAttendance).mock.calls[0]);
});
