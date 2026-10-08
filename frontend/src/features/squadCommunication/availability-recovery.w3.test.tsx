import '../../i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { SquadSessionDetails } from './SquadSessionDialog';
import { sessionEvent } from './useSquadSchedule';
import * as api from './api';
import { getAuthSessionId, setStoredAccessToken, setStoredUserId } from '../../utils/authStorage';

vi.mock('./api', () => ({ attendance:vi.fn(),overview:vi.fn() }));
vi.mock('./SquadVenueReservationPanel', () => ({ SquadVenueReservationPanel:()=>null }));
const session:api.SquadSession={id:9,title:'Training',starts_at:'2099-10-03T14:00:00Z',ends_at:'2099-10-03T15:00:00Z',location:'Pitch A',status:'SCHEDULED',cancellation_reason:null,revision:4,attendance:[{id:61,name:'Nika',active:true,response:'UNANSWERED'}]};
beforeEach(()=>{vi.resetAllMocks();localStorage.clear(); setStoredAccessToken(`e30.${btoa(JSON.stringify({sub:'20'}))}.test`); setStoredUserId(20);});
function show(){const saved=vi.fn();render(<MemoryRouter><SquadSessionDetails event={sessionEvent({id:10,name:'FC Dinamo Tbilisi Academy U12'},session)} onClose={vi.fn()} onSaved={saved}/></MemoryRouter>);return saved;}

it('retains a request identity after a lost availability acknowledgement',async()=>{
    vi.mocked(api.attendance).mockRejectedValueOnce(new Error('Acknowledgement lost')).mockResolvedValue(undefined as never);
    const saved=show();
    fireEvent.change(screen.getByLabelText('Reply for Nika'),{target:{value:'GOING'}});
    await screen.findByRole('alert');
    expect(saved).not.toHaveBeenCalled();
    const first=vi.mocked(api.attendance).mock.calls[0];
    expect(first).toEqual([10,9,61,'GOING',4,expect.stringMatching(/^[0-9a-f-]{36}$/i),getAuthSessionId()]);
    fireEvent.click(screen.getByRole('button',{name:'Retry earlier reply'}));
    await waitFor(()=>expect(saved).toHaveBeenCalledOnce());
    expect(vi.mocked(api.attendance).mock.calls[1]).toEqual(first);
});
it('uses a new request identity for a different reply after an uncertain result',async()=>{
    vi.mocked(api.attendance).mockRejectedValueOnce(new Error('Acknowledgement lost')).mockResolvedValue(undefined as never);
    const saved=show();fireEvent.change(screen.getByLabelText('Reply for Nika'),{target:{value:'GOING'}});await screen.findByRole('alert');
    const first=vi.mocked(api.attendance).mock.calls[0];
    fireEvent.click(screen.getByRole('button',{name:'Review a new reply'}));
    fireEvent.change(screen.getByLabelText('Reply for Nika'),{target:{value:'UNSURE'}});await waitFor(()=>expect(saved).toHaveBeenCalledTimes(2));
    const second=vi.mocked(api.attendance).mock.calls[1];expect(second.slice(0,5)).toEqual([10,9,61,'UNSURE',4]);expect(second[5]).not.toEqual(first[5]);
});
it('starts a new command after acknowledgement instead of treating a later choice as a retry',async()=>{
    vi.mocked(api.attendance).mockResolvedValue(undefined as never);
    const saved=show();fireEvent.change(screen.getByLabelText('Reply for Nika'),{target:{value:'GOING'}});await waitFor(()=>expect(saved).toHaveBeenCalledOnce());
    const first=vi.mocked(api.attendance).mock.calls[0];
    fireEvent.change(screen.getByLabelText('Reply for Nika'),{target:{value:'GOING'}});await waitFor(()=>expect(saved).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.attendance).mock.calls[1][5]).not.toEqual(first[5]);
});
