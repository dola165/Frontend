import { Status } from '../../design/DataTable';
import { ExchangeScore } from '../scores/ExchangeScore';
import { ScoreBlock } from '../scores/ScoreBlock';
import { isOfficial, scoreState } from '../scores/status';
import { useResultCopy } from './copy';
import { ResultSummary } from './ResultSummary';
import { useClock } from '../matchExchange/hooks';
import type { ResultStatus } from './api';
import './match-history.css';

type ResultEvent = { eventId: number; eventType: string; status: string; endsAt: string; title?: string; homeScore?: number | null; awayScore?: number | null; resultStatus?: ResultStatus; matchExchangeId?: number | null; canRecordResult?: boolean; opponentClubId?: number | null; opponentClubName?: string | null };

/**
 * A finished match on a calendar (an event's details, a reminder): its score card, the same as on the match page.
 * A Match Exchange match uses its exchange record; a club-calendar match its own (the event's club is home).
 */
export function ScheduleResult({ event, clubId, clubName, onSaved }: { event: ResultEvent; clubId?: number | null; clubName?: string | null; onSaved?: () => void }) {
  const now = useClock();
  const { copy } = useResultCopy();
  const ended = new Date(event.endsAt).getTime() <= now;
  if (!['MATCH', 'FRIENDLY'].includes(event.eventType)) return null;
  if (!ended || event.status.toUpperCase() === 'CANCELLED') return <div className="schedule-result-record">
    <ResultSummary homeScore={event.homeScore} awayScore={event.awayScore} status={event.resultStatus} fixtureStatus={event.status.toUpperCase()} ended={ended} />
  </div>;
  return <div className="schedule-result-record">{event.matchExchangeId
    ? <ExchangeScore eventId={event.matchExchangeId} onChanged={onSaved} />
    : <ScoreBlock target={{ kind: 'CALENDAR', eventId: event.eventId }} onChanged={onSaved}
      home={{ name: clubName || copy('Home team', 'მასპინძელი გუნდი'), clubId }} away={{ name: event.opponentClubName || copy('Opponent', 'მეტოქე'), clubId: event.opponentClubId }} />}</div>;
}

/** A calendar card's score line: the score where there is one, and its status as a dot and a word. */
export function ScheduleScore({ event }: { event: ResultEvent }) {
  const now = useClock();
  const { copy } = useResultCopy();
  if (!['MATCH', 'FRIENDLY'].includes(event.eventType) || new Date(event.endsAt).getTime() > now) return null;
  const cancelled = event.status.toUpperCase() === 'CANCELLED';
  const hasScore = event.homeScore != null && event.awayScore != null;
  // A historical score with no record is RECORDED, and counts like any official one.
  const status = event.resultStatus ?? (hasScore ? 'RECORDED' : 'NONE');
  const state = scoreState(status, { cancelled });
  return <span className="gk schedule-score">{hasScore && isOfficial(status) && <strong className="gk-num">{event.homeScore}–{event.awayScore}</strong>}
    <Status tone={state.tone}>{copy(...state.words)}</Status></span>;
}
