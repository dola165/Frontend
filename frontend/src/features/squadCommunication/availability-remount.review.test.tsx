import '../../i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { SquadSessionDetails } from './SquadSessionDialog';
import { sessionEvent } from './useSquadSchedule';
import * as api from './api';
import { getAuthSessionId, setStoredAccessToken, setStoredUserId } from '../../utils/authStorage';

vi.mock('./api', () => ({ attendance:vi.fn(),overview:vi.fn() }));
vi.mock('./SquadVenueReservationPanel', () => ({ SquadVenueReservationPanel:()=>null }));
const session:api.SquadSession={id:9,title:'Training',starts_at:'2099-10-03T14:00:00Z',ends_at:'2099-10-03T15:00:00Z',location:'Pitch A',status:'SCHEDULED',cancellation_reason:null,revision:4,attendance:[{id:61,name:'Nika',active:true,response:'UNANSWERED'}]};
function show(){return render(<MemoryRouter><SquadSessionDetails event={sessionEvent({id:10,name:'FC Dinamo Tbilisi Academy U12'},session)} onClose={vi.fn()} onSaved={vi.fn()}/></MemoryRouter>);}
it('retains an uncertain availability command identity across remount',async()=>{
    localStorage.clear(); setStoredAccessToken(`e30.${btoa(JSON.stringify({sub:'20'}))}.test`); setStoredUserId(20);
    vi.mocked(api.attendance).mockRejectedValueOnce(new Error('Acknowledgement lost')).mockResolvedValue(undefined as never);
    const firstMount=show();
    fireEvent.change(screen.getByLabelText('Reply for Nika'),{target:{value:'GOING'}});
    await screen.findByRole('alert');
    const first=vi.mocked(api.attendance).mock.calls[0];
    expect(first[6]).toEqual(getAuthSessionId());
    firstMount.unmount();show();
    fireEvent.click(screen.getByRole('button',{name:'Retry earlier reply'}));
    await waitFor(()=>expect(vi.mocked(api.attendance)).toHaveBeenCalledTimes(2));
    const second=vi.mocked(api.attendance).mock.calls[1];
    expect(second.slice(0,5)).toEqual(first.slice(0,5));
    expect(second).toEqual(first);
});
