import { EmptyState } from '../../../components/ui/EmptyState';
import { Flag, Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useLoad, useAction, useClock } from '../../matchExchange/hooks';
import { post, remove, type Referee } from '../../matchExchange/api';
import { appointmentTime, fixtureRefereesPath, type TournamentRefereeAppointment } from '../refereeApi';

export function TournamentFixtureReferees({ tournamentId, fixtureId, canManage, scheduledAt, open }: {
  tournamentId: number; fixtureId: number; canManage: boolean; scheduledAt?: string | null; open: boolean;
}) {
  const path = fixtureRefereesPath(tournamentId, fixtureId);
  const now = useClock();
  const { data, error, reload } = useLoad<TournamentRefereeAppointment[]>(path);
  const { run, busy, feedback } = useAction(reload);
  return <section style={{ borderTop: '1px solid var(--tw-line)', paddingTop: 20, marginTop: 20 }} aria-label="Fixture referees">
    <h3>Referees</h3>
    {error && <p role="alert">{error} <button type="button" onClick={reload}>Retry</button></p>}
    {!data && !error && <p>Loading appointments…</p>}
    {feedback}
    {data?.length === 0 && <EmptyState compact icon={Flag} title="No referee appointments yet." description={canManage ? (scheduledAt ? "Invite a referee below. They must accept before their appointment is confirmed." : "Set this fixture’s kickoff time first, then invite a referee for the match.") : "Confirmed officials and their appointment details will appear here when the organizer assigns them."}/>}
    {data?.map(a => <article key={a.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--tw-line)' }}>
      <p><Link to={`/profile/${a.referee_id}`}>{a.full_name}</Link> · {a.duty.replaceAll('_', ' ')} · {a.status.toLowerCase()}</p>
      <small>{appointmentTime(a.starts_at, a.timezone)} – {appointmentTime(a.ends_at, a.timezone)} · {a.timezone}</small>
      <p>{a.volunteer ? 'Volunteer appointment' : a.fee != null ? `${a.fee} ${a.currency}, agreed directly` : 'Paid appointment'}</p>
      {a.report && <details><summary>Referee report</summary><p style={{ whiteSpace: 'pre-wrap' }}>{a.report}</p></details>}
      {canManage && ['INVITED', 'ACCEPTED'].includes(a.status) && new Date(a.starts_at).getTime() > now &&
        <button type="button" className="tw-button" disabled={busy} onClick={() => void run(() => remove(`${path}/${a.id}`), 'Appointment cancelled; the referee has been notified.')}>
          Cancel appointment
        </button>}
    </article>)}
    {canManage && open && (scheduledAt ? <InviteReferee path={path} reload={reload} existing={data ?? []} /> : <p>Set the kickoff to invite a referee.</p>)}
    {canManage && open && <small>Changing the fixture time or location cancels its invitations and notifies referees. Invite them again to confirm the new arrangement.</small>}
  </section>;
}

function InviteReferee({ path, reload, existing }: { path: string; reload: () => void; existing: TournamentRefereeAppointment[] }) {
  const [q, setQ] = useState(''), [search, setSearch] = useState('');
  const { data, error } = useLoad<{ items: Referee[] }>(`/referees?q=${encodeURIComponent(search)}`);
  const { run, busy, feedback } = useAction(reload);
  const [referee, setReferee] = useState(''), [duty, setDuty] = useState('REFEREE'), [volunteer, setVolunteer] = useState(false);
  const [fee, setFee] = useState('0'), [currency, setCurrency] = useState('GEL');
  const active = existing.find(a => ['INVITED', 'ACCEPTED'].includes(a.status));
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tbilisi');
  const [duration, setDuration] = useState(90);
  const fixedDuration = active ? Math.round((new Date(active.ends_at).getTime() - new Date(active.starts_at).getTime()) / 60000) : null;
  function submit(e: FormEvent) {
    e.preventDefault();
    void run(() => post(path, { refereeId: Number(referee), duty, volunteer, fee: volunteer ? 0 : Number(fee), currency,
      timezone: active?.timezone ?? timezone, durationMinutes: fixedDuration ?? duration }), 'Invitation sent. The referee must accept before the appointment is confirmed.');
  }
  return <details style={{ margin: '16px 0' }}><summary>Invite a referee</summary>
    <form className="tw-actions" onSubmit={e => { e.preventDefault(); setSearch(q); }} style={{ marginTop: 12 }}>
      <label>Find a referee<input value={q} onChange={e => setQ(e.target.value)} maxLength={200} placeholder="Name, area or language" /></label>
      <button className="tw-button">Search</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {feedback}
    <form onSubmit={submit} style={{ display: 'grid', gap: 12, marginTop: 12 }}>
      <label>Referee<select required value={referee} onChange={e => {
        setReferee(e.target.value); const r = data?.items.find(item => item.user_id === Number(e.target.value));
        if (r) { setFee(String(r.fee)); setCurrency(r.currency); setVolunteer(!r.accepts_paid && r.accepts_volunteer); }
      }}><option value="">Choose a referee</option>{data?.items.map(r => <option key={r.user_id} value={r.user_id}>{r.full_name} · {r.service_area}</option>)}</select></label>
      {data && data.items.length === 0 && <EmptyState compact icon={Search} title="No published referees match this search." description="Try another name, area or language. Only published referee profiles appear in the directory."/>}
      <label>Duty<select value={duty} onChange={e => setDuty(e.target.value)}><option value="REFEREE">Referee</option><option value="ASSISTANT_1">Assistant 1</option><option value="ASSISTANT_2">Assistant 2</option></select></label>
      <label>Kickoff time zone<input required maxLength={80} value={active?.timezone ?? timezone} disabled={!!active} onChange={e => setTimezone(e.target.value)} placeholder="Europe/London" /></label>
      <label>Appointment duration (minutes)<input required type="number" min={5} max={480} value={fixedDuration ?? duration} disabled={!!active} onChange={e => setDuration(Number(e.target.value))} /></label>
      <small>Include extra time and post-match duties as needed. The availability check covers this entire period from kickoff.</small>
      <label><input type="checkbox" checked={volunteer} onChange={e => setVolunteer(e.target.checked)} /> Volunteer appointment</label>
      {!volunteer && <><label>Agreed fee<input type="number" min={0} max={1000000} step="0.01" required value={fee} onChange={e => setFee(e.target.value)} /></label>
        <label>Currency<select value={currency} onChange={e => setCurrency(e.target.value)}>{['GEL', 'EUR', 'GBP', 'USD'].map(c => <option key={c}>{c}</option>)}</select></label></>}
      <button className="tw-primary" disabled={busy || !referee}>Send invitation</button>
    </form>
  </details>;
}
