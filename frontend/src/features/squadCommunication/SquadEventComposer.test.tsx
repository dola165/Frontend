import '../../i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { SquadEventComposer } from './SquadEventComposer';
import { SquadEventEditComposer } from './SquadEventEditComposer';
import * as api from './api';
import { apiClient } from '../../api/axiosConfig';
import { createClubEvent } from '../schedule/api';

vi.mock('../../api/axiosConfig',()=>({apiClient:{get:vi.fn()}}));
vi.mock('./api',()=>({overview:vi.fn(),previewSquadEvent:vi.fn(),createSquadEvent:vi.fn(),previewSession:vi.fn(),editSession:vi.fn(),previewSeriesChange:vi.fn(),changeSeries:vi.fn()}));
vi.mock('../schedule/api',()=>({createClubEvent:vi.fn()}));
vi.mock('../../components/MiniMap',()=>({MiniMap:()=>null}));
const squad={id:11,name:'U21',club_id:1,can_manage:true};
const roster=[{id:41,name:'Alex'},{id:42,name:'Nika'}];
beforeEach(()=>{
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockResolvedValue({data:[]});
    vi.mocked(api.overview).mockResolvedValue({...squad,players:roster} as api.SquadOverview);
    vi.mocked(api.previewSquadEvent).mockImplementation(async(_id,plan)=>({occurrences:[{startsAt:plan.startsAt,endsAt:plan.endsAt}],participantCount:plan.playerIds.length,notificationRecipients:plan.playerIds.length,conflictingOccurrences:0,requestResponses:plan.requestResponses}));
    vi.mocked(api.createSquadEvent).mockResolvedValue({planId:'series',sessionIds:[81,82]});
});
const next=()=>fireEvent.click(screen.getByRole('button',{name:'Continue'}));
const mount=()=>render(<MemoryRouter><SquadEventComposer squad={squad} date={new Date('2099-09-21T12:00:00')} onClose={vi.fn()} onSaved={vi.fn()}/></MemoryRouter>);

it('creates a repeating non-training event with a reviewed fixed audience and optional replies',async()=>{
    mount();fireEvent.click(screen.getByRole('button',{name:'Activity'}));
    fireEvent.change(screen.getByLabelText('Event name'),{target:{value:'Squad meeting'}});
    fireEvent.click(screen.getByRole('button',{name:/Repeat weekly/}));next();next();
    fireEvent.click(await screen.findByText('Edit invited players'));
    await screen.findByText('Alex');
    fireEvent.click(screen.getByLabelText('Nika'));
    fireEvent.click(screen.getByLabelText(/Request availability/));
    await waitFor(()=>expect(screen.getByRole('button',{name:'Create & send invitations'})).toBeEnabled());
    fireEvent.click(screen.getByRole('button',{name:'Create & send invitations'}));
    await waitFor(()=>expect(api.createSquadEvent).toHaveBeenCalledWith(11,expect.objectContaining({eventType:'ACTIVITY',playerIds:[41],requestResponses:false,repeat:expect.objectContaining({intervalWeeks:1,endDate:expect.stringMatching(/^2099-/)})})));
    expect(createClubEvent).not.toHaveBeenCalled();
});
it('retains publication through the same editor without creating duplicate invitations',async()=>{
    mount();fireEvent.change(screen.getByLabelText('Event name'),{target:{value:'Club open day'}});
    fireEvent.click(screen.getByRole('button',{name:/^Club calendar/}));next();next();
    fireEvent.click(screen.getByRole('button',{name:'Create calendar event'}));
    await waitFor(()=>expect(createClubEvent).toHaveBeenCalledWith(1,expect.objectContaining({title:'Club open day',hostSquadId:11})));
    expect(api.createSquadEvent).not.toHaveBeenCalled();
});
it('fails closed when the invitation preview fails and preserves the draft for retry',async()=>{
    vi.mocked(api.previewSquadEvent).mockRejectedValueOnce(new Error('Preview unavailable'));
    mount();fireEvent.change(screen.getByLabelText('Event name'),{target:{value:'Keep this plan'}});next();next();
    await screen.findByRole('alert');expect(screen.getByRole('button',{name:'Create & send invitations'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'Try again'}));
    await waitFor(()=>expect(screen.getByRole('button',{name:'Create & send invitations'})).toBeEnabled());
    expect(screen.getAllByText('Keep this plan').length).toBeGreaterThan(0);
});
it('validates dates before a direct jump to invitation review',async()=>{
    mount();fireEvent.change(screen.getByLabelText('Event name'),{target:{value:'Training'}});next();
    fireEvent.change(screen.getByLabelText('Date'),{target:{value:''}});
    fireEvent.click(screen.getByRole('button',{name:/3 Review & share/}));
    expect(screen.getByRole('alert')).toBeInTheDocument();expect(api.previewSquadEvent).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
});
it('does not adopt a newer server revision while an event draft is open',async()=>{
    const session:api.SquadSession={id:81,title:'Training',starts_at:'2099-09-21T18:00:00Z',ends_at:'2099-09-21T19:30:00Z',location:'Pitch 1',status:'SCHEDULED',cancellation_reason:null,revision:2,attendance:roster.map(p=>({...p,response:'GOING'}))};
    vi.mocked(api.previewSession).mockRejectedValue(new Error('This event has changed.'));
    const props={squad,onClose:vi.fn(),onSaved:vi.fn()};
    const view=render(<MemoryRouter><SquadEventEditComposer {...props} session={session}/></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Event name'),{target:{value:'My draft'}});
    view.rerender(<MemoryRouter><SquadEventEditComposer {...props} session={{...session,title:'Someone else changed this',revision:3}}/></MemoryRouter>);
    next();next();await screen.findByRole('alert');
    expect(api.previewSession).toHaveBeenCalledWith(11,81,expect.objectContaining({revision:2,title:'My draft'}));
    expect(screen.getByRole('button',{name:'Confirm changes'})).toBeDisabled();
});
it('changes a reviewed series with exact occurrence revisions and preserves untouched invitation lists',async()=>{
    const session:api.SquadSession={id:81,title:'Training',starts_at:'2099-09-21T18:00:00Z',ends_at:'2099-09-21T19:30:00Z',location:'Pitch 1',status:'SCHEDULED',cancellation_reason:null,revision:2,series_id:'series',attendance:roster.map(p=>({...p,response:'GOING'}))};
    vi.mocked(api.previewSeriesChange).mockResolvedValue({expected:[{id:81,revision:2},{id:82,revision:3}],eventCount:2,notificationDeliveries:4,affectedResponses:2,dates:[session.starts_at]});
    render(<MemoryRouter><SquadEventEditComposer squad={squad} session={session} onClose={vi.fn()} onSaved={vi.fn()}/></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Apply to'),{target:{value:'FOLLOWING'}});next();
    fireEvent.change(screen.getByLabelText('Location'),{target:{value:'Pitch 2'}});next();
    await waitFor(()=>expect(screen.getByRole('button',{name:'Confirm changes'})).toBeEnabled());
    fireEvent.click(screen.getByRole('button',{name:'Confirm changes'}));
    await waitFor(()=>expect(api.changeSeries).toHaveBeenCalledWith(11,81,expect.objectContaining({scope:'FOLLOWING',expected:[{id:81,revision:2},{id:82,revision:3}],change:expect.objectContaining({revision:2,location:'Pitch 2',playerIds:null})})));
});

it('preserves overnight timestamps including seconds and keeps a failed edit available for retry',async()=>{
    const session:api.SquadSession={id:81,title:'Late return',starts_at:new Date('2099-09-21T23:30:45.123').toISOString(),ends_at:new Date('2099-09-22T00:45:45.123').toISOString(),location:'Academy',status:'SCHEDULED',cancellation_reason:null,revision:4,attendance:roster.map(p=>({...p,response:'GOING'}))};
    vi.mocked(api.previewSession).mockResolvedValue({revision:4,material:false,responsePolicy:'PRESERVE',affectedParticipants:2,affectedResponses:0,addedParticipants:0,removedParticipants:0,notificationRecipients:2});
    vi.mocked(api.editSession).mockRejectedValueOnce(new Error('Connection interrupted')).mockResolvedValueOnce({} as Awaited<ReturnType<typeof api.editSession>>);
    const saved=vi.fn();
    render(<MemoryRouter><SquadEventEditComposer squad={squad} session={session} onClose={vi.fn()} onSaved={saved}/></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Event name'),{target:{value:'Return from away match'}});next();
    expect(screen.getByLabelText('End date')).toHaveValue('2099-09-22');next();
    await waitFor(()=>expect(screen.getByRole('button',{name:'Confirm changes'})).toBeEnabled());
    const command=vi.mocked(api.previewSession).mock.calls[0][2];
    expect(command).toMatchObject({startsAt:session.starts_at,endsAt:session.ends_at,playerIds:null,revision:4});
    fireEvent.click(screen.getByRole('button',{name:'Confirm changes'}));await screen.findByRole('alert');
    expect(saved).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Discard draft & review latest'})).toBeVisible();
    fireEvent.click(screen.getByRole('button',{name:'Confirm changes'}));
    await waitFor(()=>expect(saved).toHaveBeenCalledOnce());
    expect(vi.mocked(api.editSession).mock.calls[0]).toEqual(vi.mocked(api.editSession).mock.calls[1]);
});

it('rechecks invitation changes before saving and never applies an out-of-date preview',async()=>{
    const session:api.SquadSession={id:81,title:'Training',starts_at:'2099-09-21T13:00:00Z',ends_at:'2099-09-21T14:00:00Z',location:'Pitch 1',status:'SCHEDULED',cancellation_reason:null,revision:2,attendance:roster.map(p=>({...p,response:'GOING'}))};
    const result={revision:2,material:true,responsePolicy:'RECONFIRM',affectedParticipants:2,affectedResponses:2,addedParticipants:0,removedParticipants:1,notificationRecipients:2} as api.SessionConsequence;
    let resolvePreview:(value:api.SessionConsequence)=>void=()=>{};
    vi.mocked(api.previewSession).mockResolvedValueOnce(result).mockImplementationOnce(()=>new Promise(resolve=>{resolvePreview=resolve;}));
    render(<MemoryRouter><SquadEventEditComposer squad={squad} session={session} onClose={vi.fn()} onSaved={vi.fn()}/></MemoryRouter>);next();next();
    await waitFor(()=>expect(screen.getByRole('button',{name:'Confirm changes'})).toBeEnabled());
    fireEvent.click(screen.getByText('Edit invited players'));fireEvent.click(screen.getByLabelText('Nika'));
    await waitFor(()=>expect(screen.getByRole('button',{name:'Confirm changes'})).toBeDisabled());
    expect(api.editSession).not.toHaveBeenCalled();resolvePreview(result);
    await waitFor(()=>expect(screen.getByRole('button',{name:'Confirm changes'})).toBeEnabled());
    expect(vi.mocked(api.previewSession).mock.calls[1][2]).toMatchObject({playerIds:[41]});
});

it('preserves the new event draft through a roster failure and retry',async()=>{
    vi.mocked(api.overview).mockRejectedValueOnce(new Error('Roster unavailable'));
    mount();fireEvent.change(screen.getByLabelText('Event name'),{target:{value:'Keep this title'}});next();next();
    await screen.findByRole('alert');expect(screen.getByRole('button',{name:'Create & send invitations'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'Retry roster'}));
    await waitFor(()=>expect(screen.getByRole('button',{name:'Create & send invitations'})).toBeEnabled());
    expect(screen.getAllByText('Keep this title').length).toBeGreaterThan(0);
});
