import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, MapPin } from 'lucide-react';
import { useDialogFocus } from '../../components/workspace/useDialogFocus';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { useRefereeHistory as useLoad } from '../matchExchange/useRefereeHistory';
import { AppointmentCard } from '../matchExchange/AppointmentCard';
import { OfficialCoordination } from '../matchExchange/OfficialCoordination';
import { MatchResultSection } from '../matchExchange/MatchResultSection';
import { LoadState } from '../matchExchange/shared';
import { formats, when, type Match } from '../matchExchange/api';

export function MatchPanel({ eventId, onClose, onChanged, refreshVersion }: { eventId: number; onClose: () => void; onChanged: () => void; refreshVersion: number }) {
  const ref = useRef<HTMLElement>(null); useDialogFocus(true, ref, onClose);
  const { data: match, error, reload } = useLoad<Match>(`/match-exchange/${eventId}`);
  const priorVersion = useRef(refreshVersion);
  useEffect(() => { if (priorVersion.current !== refreshVersion) { priorVersion.current = refreshVersion; reload(); } }, [refreshVersion,reload]);
  const [tab, setTab] = useState('appointment'), [visited, setVisited] = useState<string[]>([]);
  const refresh = () => { reload(); onChanged(); };
  const coordination = match?.own_appointments?.some(a => a.status === 'ACCEPTED');
  return <div className="rw-backdrop" onClick={onClose}><aside ref={ref} className="rw-match-panel" role="dialog" aria-modal="true" aria-labelledby="rw-match-title" onClick={e => e.stopPropagation()}>
    <header className="rw-panel-heading"><div><p className="rw-eyebrow">Your match</p><h2 id="rw-match-title">{match?.title || 'Match details'}</h2></div><button aria-label="Close match details" onClick={onClose}><X size={21}/></button></header>
    <nav className="rw-segments" aria-label="Match work">{[['appointment','Appointment'],['details','Match details'],...(coordination ? [['coordination','Coordination']] : []),['result','Result']].map(([id,name]) => <button key={id} aria-pressed={tab === id} onClick={() => { setTab(id); setVisited(values => values.includes(id) ? values : [...values,id]); }}>{name}</button>)}</nav>
    <div className="rw-panel-body"><ErrorBoundary fallback={<p role="alert">This match could not be displayed. Close the panel and try again.</p>}>
      {!match ? <LoadState error={error} reload={reload}/> : <>
        {error && <p role="alert" className="mx-error">{error}</p>}
        <div hidden={tab !== 'appointment'}>{match.own_appointments?.length ? match.own_appointments.map(a => <AppointmentCard key={a.id} appointment={a} reload={refresh} embedded/>) : <section className="mx-panel"><h3>Before you offer</h3><p>{match.club_name} · {match.opponent_name || 'Opponent to be confirmed'}</p><p>{when(match.starts_at_iso)} · {match.timezone}</p><p>{match.location_name}</p><p className="mx-muted">You do not have an appointment for this match. Review the request and its terms before offering.</p></section>}</div>
        <div hidden={tab !== 'details'} className="mx-panel"><h3>{match.club_name} {match.opponent_name ? `vs ${match.opponent_name}` : ''}</h3><p>{match.age_group} · {formats[match.format] || match.format}</p><p>{when(match.starts_at_iso)} – {when(match.ends_at_iso)} · {match.timezone}</p><p><MapPin size={16}/> {match.location_name}</p><p className="rw-prose">{match.description}</p><p className="mx-muted">Venue: {match.venue_status.replaceAll('_', ' ').toLowerCase()}</p></div>
        {visited.includes('coordination') && coordination && <div hidden={tab !== 'coordination'}><OfficialCoordination eventId={eventId}/></div>}
        {visited.includes('result') && <div hidden={tab !== 'result'}><MatchResultSection match={match} reload={refresh}/></div>}
      </>}
    </ErrorBoundary></div>
    <footer className="rw-panel-footer"><span>Your workspace stays in place.</span><Link to={`/match-exchange/${eventId}`}>Open full match page ↗</Link></footer>
  </aside></div>;
}
