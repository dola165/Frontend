import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { changeImpactFrom, hasBlockingAttention, post, type ChangeImpact, type Match } from './api';
import { useAction, useLoad } from './hooks';
import { MatchChangeImpact } from './MatchChangeImpact';
import { localStamp, reservationIssue } from './reservationEligibility';
import type { ArrangementBooking } from './ArrangementEditor';
import { extractApiErrorMessage } from '../../utils/apiError';

export function GroundArrangement({ match: m, reload }: { match: Match; reload: () => void }) {
  const { data: bookings, error: loadError, reload: refresh } = useLoad<ArrangementBooking[]>(`/match-arrangements/bookings?squadId=${m.can_manage ? m.squad_id : m.target_squad_id}`);
  const [selected, setSelected] = useState(''), [impact, setImpact] = useState<ChangeImpact>();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const inFlight = useRef(false);
  const external = useAction(reload);
  const booking = bookings?.find(b => b.id === Number(selected));
  const issue = (b: ArrangementBooking) => b.id === m.booking_id ? 'Already linked to this match' : reservationIssue(b, { startsAt: localStamp(m.starts_at_iso, m.timezone), endsAt: localStamp(m.ends_at_iso, m.timezone), timezone: m.timezone, format: m.format }) || (!m.can_manage && b.venueId !== m.venue_id ? 'The host must choose a different ground' : '');
  const changeGround = booking && booking.venueId !== m.venue_id;
  const reviewed = impact?.revision === m.revision && !hasBlockingAttention(impact);
  const activeBooking = m.booking && ['CONFIRMED','PENDING'].includes(m.booking.status);
  async function save() {
    if (!booking || issue(booking) || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      if (changeGround) {
        const request = { bookingId: booking.id, revision: m.revision, requestId };
        if (!reviewed) { setImpact(await post(`/match-arrangements/${m.event_id}/ground-preview`, request)); return; }
        await post(`/match-arrangements/${m.event_id}/ground`, request, impact?.confirmationToken);
      } else await post(`/match-exchange/${m.event_id}/venue`, { bookingId: booking.id, externalConfirmed: false, revision: m.revision });
      setSelected(''); setImpact(undefined); setRequestId(crypto.randomUUID()); reload(); refresh();
    } catch (e) {
      const next = changeImpactFrom(e); setImpact(next);
      if (!next) setError(extractApiErrorMessage(e, 'The ground could not be updated. Please try again.'));
      if (isAxiosError(e) && e.response?.status === 409) { reload(); refresh(); }
    } finally { inFlight.current = false; setBusy(false); }
  }
  return <section className="mx-panel mx-stack">
    <h2>Ground and reservation</h2>
    {m.booking_id && <p>Reservation #{m.booking_id}: {m.booking?.status?.toLowerCase().replaceAll('_',' ') || 'linked'}. {m.booking?.status === 'PENDING' && 'Waiting for the venue owner to confirm.'}</p>}
    {activeBooking ? <p className="mx-muted">This match already has a live reservation. Resolve it in your stadium bookings before replacing the ground or reservation.</p> : <>
      <p>Use a confirmed reservation covering the whole match. {m.can_manage && 'Choosing a different stadium updates the ground and asks participants to agree again.'}</p>
      {loadError && <p role="alert">{loadError}</p>}
      {!bookings && !loadError && <p role="status">Loading reservations…</p>}
      {bookings?.length === 0 && <p>No upcoming reservations. Book a pitch, then return after the owner confirms.</p>}
      <label>Match reservation<select aria-label="Match reservation" value={selected} disabled={busy} onChange={e => { setSelected(e.target.value); setImpact(undefined); setError(''); setRequestId(crypto.randomUUID()); }}>
        <option value="">Choose a reservation</option>
        {bookings?.map(b => <option key={b.id} value={b.id} disabled={!!issue(b)}>{b.venueName} · {b.pitchName} · {localStamp(b.startsAt,b.timezone).replace('T',' ')} ({b.timezone}) · {b.totalPrice} {b.currency}{issue(b) ? ` · ${issue(b)}` : ''}</option>)}
      </select></label>
      <button onClick={refresh} disabled={busy}>Refresh reservations</button>
      {error && <p role="alert" className="mx-error">{error}</p>}
      {impact && <MatchChangeImpact impact={impact} />}
      <button disabled={busy || !booking || !!issue(booking)} onClick={() => void save()}>{busy ? 'Saving…' : changeGround ? reviewed ? 'Confirm ground and notify participants' : 'Review ground change' : 'Link reservation'}</button>
    </>}
    <div className="mx-actions"><Link to={m.venue_id ? `/stadiums/${m.venue_id}?book=1` : '/stadiums'}>Find and book a pitch →</Link><Link to="/stadiums?tab=bookings">My stadium bookings →</Link></div>
    {!m.venue_id && <>
      <p className="mx-muted">For an external ground, confirm only after its owner has agreed to the time.</p>
      {external.feedback}
      <button disabled={external.busy || busy} onClick={() => void external.run(() => post(`/match-exchange/${m.event_id}/venue`, { bookingId: null, externalConfirmed: !m.external_venue_confirmed, revision: m.revision }), 'Venue arrangement updated')}>{m.external_venue_confirmed ? 'Confirm external arrangement resolved' : 'Confirm external ground'}</button>
    </>}
  </section>;
}
