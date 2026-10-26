import { Status } from '../../design/DataTable';
import type { Goals } from '../scores/api';
import { goals, scoreState, type AnyScoreStatus } from '../scores/status';
import { useResultCopy } from './copy';
import './match-history.css';

export type ResultSummaryProps = {
  homeScore?: number | null; awayScore?: number | null; status?: AnyScoreStatus | null;
  legacy?: boolean; fixtureStatus?: string; ended?: boolean; compact?: boolean;
  /** The reported and disputing versions, where the viewer may see them: a dispute shows both. */
  reported?: Goals | null; disputed?: Goals | null;
  /** An under-11 match the viewer is not part of: no score and no placeholder for one, only the status. */
  scorePrivate?: boolean;
};

/**
 * A match's score and its status as a dot and a word (Reported, Confirmed, Disputed, Settled, Final), the same in every
 * list and band. A missing score never becomes a draw; a reported score reads as reported until it is official.
 */
export function ResultSummary({ homeScore, awayScore, status, legacy, fixtureStatus, ended = true, compact = false, reported, disputed, scorePrivate }: ResultSummaryProps) {
  const { copy } = useResultCopy();
  const cancelled = fixtureStatus === 'CANCELLED';
  const official = goals(homeScore, awayScore);
  const state = fixtureStatus === 'POSTPONED' ? { words: ['Postponed', 'გადადებული'] as const, tone: 'neutral' as const }
    : fixtureStatus === 'ABANDONED' ? { words: ['Abandoned', 'შეწყვეტილი'] as const, tone: 'neutral' as const }
      : scoreState(status, { legacy, ended, cancelled });
  const versions = status === 'DISPUTED' && reported && disputed ? `${goals(reported.home, reported.away)} / ${goals(disputed.home, disputed.away)}` : null;
  const shown = scorePrivate ? null : versions ?? official ?? (status === 'REPORTED' && reported ? goals(reported.home, reported.away) : null);
  return <div className={`gk result-summary${compact ? ' result-summary--compact' : ''}`}>
    {!scorePrivate && <strong className="result-summary-score gk-num" aria-label={shown ? copy(`Score ${shown}`, `ანგარიში ${shown}`) : copy('No score yet', 'ანგარიში ჯერ არ არის')}>{shown ?? '—'}</strong>}
    <Status tone={state.tone}>{copy(...state.words)}</Status>
    {!compact && (legacy || status === 'LEGACY') && <small>{copy('An older record, from before scores were confirmed.', 'ძველი ჩანაწერი, ანგარიშის დადასტურებამდე.')}</small>}
    {!compact && status === 'RECORDED' && <small>{copy('Entered by the organiser.', 'შეიტანა ორგანიზატორმა.')}</small>}
  </div>;
}
