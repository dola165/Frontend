import '../../i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { SquadSessionDetails } from './SquadSessionDialog';
import { sessionEvent } from './useSquadSchedule';
import * as api from './api';
import { clearStoredAuth, getAuthSessionId, setStoredAccessToken, setStoredUserId } from '../../utils/authStorage';
import { beginReply, readUncertainReply, replyScope, requireReplyScope, REPLY_RECOVERY_PREFIX } from './availabilityRecovery';
vi.mock('./api', () => ({attendance:vi.fn(),overview:vi.fn()}));
vi.mock('./SquadVenueReservationPanel',()=>({SquadVenueReservationPanel:()=>null}));
const session:api.SquadSession={id:9,title:'Training',starts_at:'2099-10-03T14:00:00Z',ends_at:'2099-10-03T15:00:00Z',location:'Pitch A',status:'SCHEDULED',cancellation_reason:null,revision:4,attendance:[{id:61,name:'Nika',active:true,response:'UNANSWERED'}]};
const login=(id:number)=>{setStoredAccessToken(`e30.${btoa(JSON.stringify({sub:String(id)}))}.test`);setStoredUserId(id);};
beforeEach(()=>{vi.resetAllMocks();localStorage.clear();login(20);});
function show(value=session){const saved=vi.fn();const view=render(<MemoryRouter><SquadSessionDetails event={sessionEvent({id:10,name:'FC Dinamo Tbilisi Academy U18'},value)} onClose={vi.fn()} onSaved={saved}/></MemoryRouter>);return{...view,saved};}
async function loseReply(){vi.mocked(api.attendance).mockRejectedValueOnce(new Error('Acknowledgement lost'));const v=show();fireEvent.change(screen.getByLabelText('Reply for Nika'),{target:{value:'GOING'}});await screen.findByRole('alert');return v;}
it('recovers the exact earlier command after remount while showing a newer player reply',async()=>{
 const first=await loseReply();const command=vi.mocked(api.attendance).mock.calls[0];first.unmount();
 const latest={...session,attendance:[{...session.attendance[0],response:'NOT_GOING',recorded_by:'PLAYER' as const}]};const second=show(latest);
 expect(screen.getByLabelText('Reply for Nika')).toBeDisabled();vi.mocked(api.attendance).mockResolvedValue(undefined as never);
 fireEvent.click(screen.getByRole('button',{name:'Retry earlier reply'}));await waitFor(()=>expect(second.saved).toHaveBeenCalledOnce());
 expect(vi.mocked(api.attendance).mock.calls[1]).toEqual(command);expect(screen.getByLabelText('Reply for Nika')).toHaveValue('NOT_GOING');
 expect(Object.keys(localStorage).filter(k=>k.startsWith(REPLY_RECOVERY_PREFIX))).toHaveLength(0);
});
it('keeps the original revision on a stale retry and requires explicit review for a new intent',async()=>{
 const first=await loseReply();const original=vi.mocked(api.attendance).mock.calls[0];first.unmount();const second=show({...session,revision:5});
 vi.mocked(api.attendance).mockRejectedValueOnce(new Error('Review the changed session'));
 fireEvent.click(screen.getByRole('button',{name:'Retry earlier reply'}));await screen.findByRole('alert');expect(vi.mocked(api.attendance).mock.calls[1]).toEqual(original);
 fireEvent.click(screen.getByRole('button',{name:'Review a new reply'}));vi.mocked(api.attendance).mockResolvedValue(undefined as never);
 fireEvent.change(screen.getByLabelText('Reply for Nika'),{target:{value:'GOING'}});await waitFor(()=>expect(second.saved).toHaveBeenCalledTimes(2));
 const changed=vi.mocked(api.attendance).mock.calls[2];expect(changed[4]).toBe(5);expect(changed[5]).not.toBe(original[5]);expect(changed[6]).toBe(getAuthSessionId());
});
it('does not treat an authorization rejection as acknowledgement',async()=>{
 await loseReply();vi.mocked(api.attendance).mockRejectedValueOnce({response:{status:403,data:{message:'Your access was revoked'}}});
 fireEvent.click(screen.getByRole('button',{name:'Retry earlier reply'}));await screen.findByText(/Your access was revoked/);
 expect(Object.keys(localStorage).filter(k=>k.startsWith(REPLY_RECOVERY_PREFIX))).toHaveLength(1);expect(screen.getByLabelText('Reply for Nika')).toBeDisabled();
});
it('clears private pending replies on logout and never carries their key into another account',async()=>{
 const first=await loseReply();const old=vi.mocked(api.attendance).mock.calls[0];first.unmount();clearStoredAuth();login(21);const next=show();
 expect(screen.queryByRole('button',{name:'Retry earlier reply'})).not.toBeInTheDocument();vi.mocked(api.attendance).mockResolvedValue(undefined as never);
 fireEvent.change(screen.getByLabelText('Reply for Nika'),{target:{value:'GOING'}});await waitFor(()=>expect(next.saved).toHaveBeenCalledOnce());expect(vi.mocked(api.attendance).mock.calls[1][5]).not.toBe(old[5]);
});
it('rejects a retired scope even after the same actor signs in again',()=>{
 const old=replyScope()!;const pending=beginReply(old,10,9,61,'GOING',4);login(20);
 expect(()=>requireReplyScope(pending)).toThrow(/account changed/);expect(readUncertainReply(replyScope()!,10,9,61)).toBeNull();
});
it('never dispatches a new reply when durable storage fails',async()=>{
 const original=Storage.prototype.setItem;vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(this:Storage,k,v){if(k.startsWith(REPLY_RECOVERY_PREFIX))throw new Error('quota');original.call(this,k,v);});
 const view=show();fireEvent.change(screen.getByLabelText('Reply for Nika'),{target:{value:'GOING'}});await screen.findByText(/Enable browser storage/);expect(api.attendance).not.toHaveBeenCalled();expect(view.saved).not.toHaveBeenCalled();vi.restoreAllMocks();
});
