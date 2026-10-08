import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { completeClubEventWithResult, correctClubEventResult } from '../schedule/api';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useResultCopy } from './copy';
import { ResultSummary } from './ResultSummary';
import { useClock } from '../matchExchange/hooks';
import type { ResultStatus } from './api';
import './match-history.css';

type ResultEvent = { eventId: number; eventType: string; status: string; endsAt: string; homeScore?: number | null; awayScore?: number | null; resultStatus?: ResultStatus; matchExchangeId?: number | null; canRecordResult?: boolean; resultClubId?: number | null; opponentClubId?: number | null };

export function ScheduleResult({ event, clubId, clubName, onSaved }: { event: ResultEvent; clubId?: number | null; clubName?: string | null; onSaved?: () => void }) {
  const now = useClock();
  const { copy } = useResultCopy();
  const [open, setOpen] = useState(false), [home, setHome] = useState(event.homeScore?.toString() ?? ''), [away, setAway] = useState(event.awayScore?.toString() ?? ''), [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const saving = useRef(false);
  const ended = new Date(event.endsAt).getTime() <= now;
  const status = event.status.toUpperCase();
  if (!['MATCH', 'FRIENDLY'].includes(event.eventType)) return null;
  const correction = status === 'COMPLETED';
  const mutationClubId = event.resultClubId ?? clubId;
  const canEdit = event.canRecordResult === true && mutationClubId != null && !event.matchExchangeId && ended && status !== 'CANCELLED';
  const valid = home !== '' && away !== '' && [Number(home), Number(away)].every(n => Number.isInteger(n) && n >= 0 && n <= 100) && (!correction || Boolean(reason.trim()));
  async function save() {
    if (!canEdit || !valid || saving.current || !mutationClubId) return;
    saving.current = true; setBusy(true); setError(''); setNotice('');
    const homeScore = Number(home), awayScore = Number(away);
    const payload = { homeScore, awayScore, winnerClubId: homeScore > awayScore ? clubId ?? null : awayScore > homeScore ? event.opponentClubId ?? null : null };
    try {
      if (correction) await correctClubEventResult(mutationClubId, event.eventId, { ...payload, reason: reason.trim() });
      else await completeClubEventWithResult(mutationClubId, event.eventId, payload);
      setOpen(false); setNotice(copy('Result recorded by the club.', 'შედეგი დაფიქსირებულია კლუბის მიერ.')); onSaved?.();
    } catch (cause) { setError(extractApiErrorMessage(cause, copy('Could not record the result.', 'შედეგი ვერ დაფიქსირდა.'))); }
    finally { saving.current = false; setBusy(false); }
  }
  return <div className="schedule-result-record"><ResultSummary homeScore={event.homeScore} awayScore={event.awayScore} status={event.resultStatus} fixtureStatus={status} ended={ended} />
    {event.matchExchangeId && <Link to={`/match-exchange/${event.matchExchangeId}#result`}>{copy('Open match result & confirmations', 'მატჩის შედეგი და დადასტურებები')} →</Link>}
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {canEdit && <><button type="button" disabled={busy} aria-expanded={open} onClick={() => setOpen(value => !value)}>{correction ? copy('Add or correct result', 'შედეგის დამატება ან შესწორება') : copy('Record match result', 'მატჩის შედეგის დაფიქსირება')}</button>{open && <form className="mx-form" onSubmit={e => { e.preventDefault(); void save(); }}>
      <label>{clubName || copy('Home team', 'მასპინძელი გუნდი')} {copy('score', 'ანგარიში')}<input type="number" required min={0} max={100} step={1} value={home} disabled={busy} onChange={e => setHome(e.target.value)} /></label><label>{copy('Away team score', 'სტუმარი გუნდის ანგარიში')}<input type="number" required min={0} max={100} step={1} value={away} disabled={busy} onChange={e => setAway(e.target.value)} /></label>
      {correction && <label className="mx-wide">{copy('Reason for result update', 'შედეგის განახლების მიზეზი')}<textarea required maxLength={1000} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} /></label>}
      <p className="mx-muted mx-wide">{copy('This result is recorded by the club. The winner is determined from the score.', 'შედეგს აფიქსირებს კლუბი. გამარჯვებული განისაზღვრება ანგარიშით.')}</p><footer><button className="mx-primary" disabled={busy || !valid}>{copy('Save result', 'შედეგის შენახვა')}</button></footer>
    </form>}</>}
  </div>;
}

export function ScheduleScore({ event }: { event: ResultEvent }) {
  const now = useClock();
  const { copy } = useResultCopy();
  if (!['MATCH', 'FRIENDLY'].includes(event.eventType) || new Date(event.endsAt).getTime() > now) return null;
  const hasScore = event.homeScore != null && event.awayScore != null;
  const label = event.status.toUpperCase() === 'CANCELLED' ? copy('Cancelled', 'გაუქმებული') : event.resultStatus === 'DISPUTED' ? copy('Disputed', 'სადავო') : event.resultStatus === 'PROPOSED' ? copy('Awaiting confirmation', 'დადასტურების მოლოდინში') : event.resultStatus === 'LEGACY' ? copy('Previously recorded', 'ადრე დაფიქსირებული') : event.resultStatus === 'CONFIRMED' ? copy('Confirmed', 'დადასტურებული') : hasScore ? copy('Recorded', 'დაფიქსირებული') : copy('Result not recorded', 'შედეგი არ დაფიქსირებულა');
  return <span className="schedule-score"><strong>{hasScore ? `${event.homeScore} – ${event.awayScore}` : '—'}</strong> · {label}</span>;
}
