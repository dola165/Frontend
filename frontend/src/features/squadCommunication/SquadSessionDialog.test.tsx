import '../../i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { SquadSessionDetails, SquadSessionEditor } from './SquadSessionDialog';
import { sessionEvent } from './useSquadSchedule';
import * as api from './api';
import { getAuthSessionId, setStoredAccessToken, setStoredUserId } from '../../utils/authStorage';

vi.mock('./api', () => ({ overview: vi.fn(), attendance: vi.fn(), createSession: vi.fn(), previewSession: vi.fn(), editSession: vi.fn(), previewCancellation: vi.fn(), cancelSession: vi.fn(), previewSeriesCancellation: vi.fn(), cancelSeries: vi.fn() }));
vi.mock('./SquadVenueReservationPanel', () => ({ SquadVenueReservationPanel: () => <section aria-label="Session reservation"/> }));
const squad = { id: 10, name: 'U12' };
const session: api.SquadSession = { id: 9, title: 'Training', starts_at: '2099-09-18T13:00:23.123Z', ends_at: '2099-09-18T14:00:23.123Z', location: 'Pitch A', status: 'SCHEDULED', cancellation_reason: null, revision: 4,
    attendance: [{ id: 61, name: 'Nika', response: 'RECONFIRMATION_REQUIRED', response_status: 'RECONFIRMATION_REQUIRED', previous_response: 'GOING', response_valid: false, active: true }] };
const consequence: api.SessionConsequence = { revision: 4, material: true, responsePolicy: 'RECONFIRM', affectedParticipants: 2, affectedResponses: 1, addedParticipants: 0, removedParticipants: 0, notificationRecipients: 2 };
beforeEach(() => {
    vi.resetAllMocks(); localStorage.clear(); setStoredAccessToken(`e30.${btoa(JSON.stringify({sub:'20'}))}.test`); setStoredUserId(20);
    vi.mocked(api.overview).mockResolvedValue({ players: [{ id: 61, name: 'Nika' }, { id: 62, name: 'Saba' }] } as api.SquadOverview);
    vi.mocked(api.previewSession).mockResolvedValue(consequence);
    vi.mocked(api.previewCancellation).mockResolvedValue({ ...consequence, responsePolicy: 'INVALIDATE' });
});

it('shows reconfirmation and submits the revision the participant saw', async () => {
    const saved = vi.fn();
    render(<MemoryRouter><SquadSessionDetails event={sessionEvent(squad, session)} onClose={vi.fn()} onSaved={saved}/></MemoryRouter>);
    expect(screen.getByText(/Session changed. Please confirm again/)).toHaveTextContent('previous reply: going');
    expect(screen.getByLabelText('Reply for Nika')).toHaveValue('RECONFIRMATION_REQUIRED');
    fireEvent.change(screen.getByLabelText('Reply for Nika'), { target: { value: 'GOING' } });
    await waitFor(() => expect(api.attendance).toHaveBeenCalledWith(10, 9, 61, 'GOING', 4, expect.any(String), getAuthSessionId()));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
});

it('does not offer replies or editing for a cancelled session', () => {
    render(<MemoryRouter><SquadSessionDetails event={sessionEvent(squad, { ...session, status: 'CANCELLED', cancellation_reason: 'Rain' })} canManage onClose={vi.fn()} onSaved={vi.fn()}/></MemoryRouter>);
    expect(screen.getByText('Cancelled · Rain')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit or reschedule' })).not.toBeInTheDocument();
});

it('does not show reply controls or promise availability for an informational series', () => {
    render(<MemoryRouter><SquadSessionDetails event={sessionEvent(squad,{...session,series_id:'series',response_requested:false})} onClose={vi.fn()} onSaved={vi.fn()}/></MemoryRouter>);
    expect(screen.getByText('No availability reply is requested for this event.')).toBeInTheDocument();
    expect(screen.getByText('Part of a repeating series.')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
});

it('can cancel future occurrences from an ongoing series event without cancelling that event', async () => {
    const current={...session,starts_at:new Date(Date.now()-3600000).toISOString(),ends_at:new Date(Date.now()+3600000).toISOString(),series_id:'series'};
    const expected=[{id:10,revision:3},{id:11,revision:2}];
    vi.mocked(api.previewSeriesCancellation).mockResolvedValue({expected,eventCount:2,notificationDeliveries:4,affectedResponses:2,dates:['2099-09-22T13:00:00Z']});
    render(<MemoryRouter><SquadSessionDetails event={sessionEvent(squad,current)} canManage onClose={vi.fn()} onSaved={vi.fn()}/></MemoryRouter>);
    fireEvent.click(screen.getByRole('button',{name:'Cancel session'}));
    fireEvent.change(screen.getByLabelText('Apply to'),{target:{value:'ALL_FUTURE'}});
    fireEvent.change(screen.getByLabelText('Cancellation reason'),{target:{value:'New season plan'}});
    fireEvent.click(screen.getByRole('button',{name:'Preview cancellation'}));
    await waitFor(()=>expect(screen.getByRole('button',{name:'Confirm cancellation & notify participants'})).toBeEnabled());
    fireEvent.click(screen.getByRole('button',{name:'Confirm cancellation & notify participants'}));
    await waitFor(()=>expect(api.cancelSeries).toHaveBeenCalledWith(10,9,expect.objectContaining({scope:'ALL_FUTURE',expected})));
    expect(api.previewSeriesCancellation).toHaveBeenCalledOnce();expect(api.cancelSession).not.toHaveBeenCalled();
});

it('previews cancellation before applying it and reuses the request identity on retry', async () => {
    vi.mocked(api.cancelSession).mockRejectedValueOnce(new Error('Connection lost'));
    render(<MemoryRouter><SquadSessionDetails event={sessionEvent(squad, session)} canManage onClose={vi.fn()} onSaved={vi.fn()}/></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel session' }));
    fireEvent.change(screen.getByLabelText('Cancellation reason'), { target: { value: 'Rain' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview cancellation' }));
    await screen.findByText(/2 participants and 1 replies affected/);
    expect(api.cancelSession).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation & notify participants' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation & notify participants' }));
    await waitFor(() => expect(api.cancelSession).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.cancelSession).mock.calls[0]).toEqual(vi.mocked(api.cancelSession).mock.calls[1]);
});

it('preserves timestamp precision and invitations for title-only edits, requiring preview before save', async () => {
    render(<SquadSessionEditor squad={squad} date={new Date(session.starts_at)} session={session} onClose={vi.fn()} onSaved={vi.fn()}/>);
    await screen.findByLabelText('Nika');
    fireEvent.change(screen.getByLabelText('Session title'), { target: { value: 'Bring water' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview changes' }));
    await screen.findByRole('button', { name: 'Confirm changes' });
    const command = vi.mocked(api.previewSession).mock.calls[0][2];
    expect(command).toMatchObject({ revision: 4, title: 'Bring water', startsAt: session.starts_at, endsAt: session.ends_at, playerIds: null });
    expect(api.editSession).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm changes' }));
    await waitFor(() => expect(api.editSession).toHaveBeenCalledWith(10, 9, command));
});

it('invalidates the reviewed preview when location or audience changes', async () => {
    render(<SquadSessionEditor squad={squad} date={new Date(session.starts_at)} session={session} onClose={vi.fn()} onSaved={vi.fn()}/>);
    await screen.findByLabelText('Saba');
    fireEvent.click(screen.getByRole('button', { name: 'Preview changes' }));
    await screen.findByRole('button', { name: 'Confirm changes' });
    fireEvent.change(screen.getByLabelText('Meeting point'), { target: { value: 'Pitch B' } });
    fireEvent.click(screen.getByLabelText('Saba'));
    expect(screen.queryByRole('button', { name: 'Confirm changes' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Preview changes' }));
    await waitFor(() => expect(api.previewSession).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.previewSession).mock.calls[1][2]).toMatchObject({ playerIds: [61, 62], location: 'Pitch B' });
    expect(api.editSession).not.toHaveBeenCalled();
});

it('keeps the edit visible on a revision conflict and offers an explicit reload', async () => {
    vi.mocked(api.editSession).mockRejectedValue(new Error('This session has changed. Refresh the session.'));
    const saved = vi.fn();
    render(<SquadSessionEditor squad={squad} date={new Date(session.starts_at)} session={session} onClose={vi.fn()} onSaved={saved}/>);
    await screen.findByLabelText('Nika');
    fireEvent.change(screen.getByLabelText('Meeting point'), { target: { value: 'Pitch B' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview changes' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm changes' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Meeting point')).toHaveValue('Pitch B');
    expect(saved).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reload latest session' }));
    expect(saved).toHaveBeenCalledOnce();
});

it('labels coach-recorded intent and offers the session reservation controls to its coach', () => {
    render(<MemoryRouter><SquadSessionDetails event={sessionEvent(squad, { ...session, attendance: [{ ...session.attendance[0], recorded_by: 'COACH' }] })} canManage onClose={vi.fn()} onSaved={vi.fn()}/></MemoryRouter>);
    expect(screen.getByText('Recorded by the coach')).toBeInTheDocument();
    expect(screen.getByText(/They do not record actual attendance/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Stadium reservation/ })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Session reservation' })).toBeInTheDocument();
});

it('creates a single family session with explicit roster and recurrence limitations', async () => {
    render(<SquadSessionEditor squad={squad} date={new Date(session.starts_at)} onClose={vi.fn()} onSaved={vi.fn()}/>);
    await screen.findByText('Nika · Saba');
    expect(screen.getByText(/Later roster additions are not automatically invited/)).toBeInTheDocument();
    expect(screen.getByText(/Weekly club entries do not collect family replies/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create session & notify families' }));
    await waitFor(() => expect(api.createSession).toHaveBeenCalledWith(10, expect.objectContaining({ title: 'Training', startsAt: expect.stringMatching(/Z$/) })));
    expect(api.editSession).not.toHaveBeenCalled();
});

it('preserves the supported Exchange destination without a generic stadium editor', () => {
    render(<MemoryRouter><SquadSessionDetails event={{ ...sessionEvent(squad, session), session: undefined, origin: 'MATCH_EXCHANGE', eventId: 82, originId: 82 }} canManage onClose={vi.fn()} onSaved={vi.fn()}/></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Open match details/ })).toHaveAttribute('href', '/match-exchange/82');
    expect(screen.queryByRole('button', { name: 'Edit or reschedule' })).not.toBeInTheDocument();
});

it('keeps the create draft when roster loading fails and can retry without closing', async () => {
    vi.mocked(api.overview).mockRejectedValueOnce(new Error('Roster unavailable'));
    render(<SquadSessionEditor squad={squad} date={new Date(session.starts_at)} onClose={vi.fn()} onSaved={vi.fn()}/>);
    fireEvent.change(screen.getByLabelText('Session title'), { target: { value: 'Keep this title' } });
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Create session & notify families' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry roster' }));
    await screen.findByText('Nika · Saba');
    expect(screen.getByLabelText('Session title')).toHaveValue('Keep this title');
    expect(screen.getByRole('button', { name: 'Create session & notify families' })).toBeEnabled();
});
