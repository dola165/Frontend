import { useResultCopy } from './copy';
import type { ResultStatus } from './api';

export type ResultSummaryProps = {
  homeScore?: number | null; awayScore?: number | null; status?: ResultStatus | null;
  legacy?: boolean; fixtureStatus?: string; ended?: boolean; compact?: boolean;
};

/** A missing score must never become a draw; provenance remains visible beside every score. */
export function ResultSummary({ homeScore, awayScore, status, legacy, fixtureStatus, ended = true, compact = false }: ResultSummaryProps) {
  const { copy } = useResultCopy();
  const hasScore = homeScore != null && awayScore != null;
  const cancelled = fixtureStatus === 'CANCELLED';
  const historical = legacy || status === 'LEGACY';
  const label = cancelled ? copy('Cancelled', 'გაუქმებული')
    : status === 'BYE' ? copy('Bye · advances without a match', 'გამოტოვება · შემდეგ ეტაპზე მატჩის გარეშე')
    : fixtureStatus === 'POSTPONED' ? copy('Postponed', 'გადადებული')
    : fixtureStatus === 'ABANDONED' ? copy('Abandoned', 'შეწყვეტილი')
    : status === 'DISPUTED' ? copy('Disputed · under review', 'სადავო · განხილვის პროცესში')
    : status === 'PROPOSED' ? copy('Awaiting confirmation', 'დადასტურების მოლოდინში')
    : historical ? copy('Previously recorded', 'ადრე დაფიქსირებული')
    : status === 'CONFIRMED' && hasScore ? copy('Confirmed result', 'დადასტურებული შედეგი')
    : status === 'RECORDED' && hasScore ? copy('Recorded result', 'დაფიქსირებული შედეგი')
    : ended ? copy('Result not recorded', 'შედეგი არ არის დაფიქსირებული')
    : copy('Upcoming', 'მომავალი');
  const tone = cancelled || status === 'BYE' ? 'muted' : status === 'DISPUTED' ? 'disputed' : status === 'PROPOSED' || !hasScore && ended ? 'pending' : historical ? 'muted' : status === 'CONFIRMED' || status === 'RECORDED' ? 'recorded' : 'muted';
  return <div className={`result-summary result-summary--${tone}${compact ? ' result-summary--compact' : ''}`}>
    <strong className="result-summary-score" aria-label={hasScore ? copy(`Score ${homeScore} to ${awayScore}`, `ანგარიში ${homeScore} : ${awayScore}`) : copy('No score recorded', 'ანგარიში არ არის დაფიქსირებული')}>{hasScore ? `${homeScore} – ${awayScore}` : '—'}</strong>
    <span className="result-summary-label">{label}</span>
    {!compact && historical && <small>{copy('Confirmation evidence is unavailable for this older record.', 'ამ ძველი ჩანაწერის დადასტურების მტკიცებულება მიუწვდომელია.')}</small>}
    {!compact && status === 'RECORDED' && <small>{copy('Recorded by the match organizer.', 'დაფიქსირებულია მატჩის ორგანიზატორის მიერ.')}</small>}
  </div>;
}
