import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLoad, useAction, useClock } from '../../matchExchange/hooks';
import { post, put } from '../../matchExchange/api';
import { appointmentTime, tournamentRefereeInboxPath, type TournamentRefereeAppointment } from '../refereeApi';

export function TournamentRefereeInbox() {
  const { data, error, reload } = useLoad<TournamentRefereeAppointment[]>(tournamentRefereeInboxPath);
  return <section aria-label="Tournament appointments"><h2>Tournament appointments</h2>
    {error && <p role="alert">{error} <button onClick={reload}>Retry</button></p>}
    {!data && !error && <p>Loading tournament appointments…</p>}
    {data?.length === 0 && <p className="mx-muted">Tournament invitations will appear here.</p>}
    {data?.map(a => <TournamentAppointment key={a.id} a={a} reload={reload} />)}
  </section>;
}

function TournamentAppointment({ a, reload }: { a: TournamentRefereeAppointment; reload: () => void }) {
  const { run, busy, feedback } = useAction(reload), now = useClock();
  const [report, setReport] = useState(a.report ?? ''), [withdraw, setWithdraw] = useState(false);
  const upcoming = a.fixture_status === 'SCHEDULED' && ['PLANNING', 'ACTIVE'].includes(a.tournament_status) && new Date(a.starts_at).getTime() > now;
  return <article className="mx-panel" style={{ marginTop: 12 }}>
    <h3>{a.tournament_name} · Match {a.fixture_order}</h3>
    <p>{a.duty.replaceAll('_', ' ')} · {a.status.toLowerCase()}</p>
    <p>{appointmentTime(a.starts_at, a.timezone)} – {appointmentTime(a.ends_at, a.timezone)} · {a.timezone}</p>
    <p>{a.location_name || 'Location not set'}{a.booking_status === 'PENDING' ? ' · Reservation awaiting confirmation' : a.booking_status === 'CONFIRMED' ? ' · Reservation confirmed' : ''}</p>
    <p>{a.volunteer ? 'Volunteer appointment' : `${a.fee} ${a.currency}, agreed directly`}</p>
    {feedback}
    {upcoming && a.status === 'INVITED' && <><p className="mx-muted">Add availability covering the full appointment before accepting. Accepted appointments appear in My schedule and prevent overlapping assignments.</p>
      <div className="mx-actions">{['ACCEPT', 'DECLINE'].map(action => <button key={action} disabled={busy} onClick={() => void run(() => post(`${tournamentRefereeInboxPath}/${a.id}/decision`, { action }), action === 'ACCEPT' ? 'Tournament appointment accepted.' : 'Invitation declined.')}>
        {action === 'ACCEPT' ? 'Accept' : 'Decline'}</button>)}</div></>}
    {upcoming && a.status === 'ACCEPTED' && <><Link to="/calendar">My schedule</Link> <button onClick={() => setWithdraw(!withdraw)}>Withdraw</button>
      {withdraw && <p>The organizer will be notified. <button disabled={busy} onClick={() => void run(() => post(`${tournamentRefereeInboxPath}/${a.id}/decision`, { action: 'WITHDRAW' }), 'Appointment withdrawn.')}>Confirm withdrawal</button></p>}</>}
    {a.status === 'ACCEPTED' && a.fixture_status !== 'CANCELLED' && a.tournament_status !== 'CANCELLED' && new Date(a.ends_at).getTime() <= now &&
      <details style={{ marginTop: 12 }}><summary>{a.report ? 'Edit match report' : 'Submit match report'}</summary>
        <form onSubmit={e => { e.preventDefault(); void run(() => put(`${tournamentRefereeInboxPath}/${a.id}/report`, { body: report }), 'Report saved.'); }}>
          <label>Report<textarea required maxLength={4000} value={report} onChange={e => setReport(e.target.value)} /></label>
          <small>Visible to you and tournament operators.</small><button disabled={busy}>Save report</button>
        </form>
      </details>}
  </article>;
}
