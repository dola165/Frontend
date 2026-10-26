import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useResultCopy } from '../matchHistory/copy';
import { ResultSummary } from '../matchHistory/ResultSummary';
import { getScoreSummary, type ScoreSummary, type ScoreTarget } from './api';
import { MatchScore, type ScoreTeams } from './MatchScore';
import './scores.css';

/**
 * A finished match's score wherever it shows outside the match page (a calendar event, a reminder, a dialog): those on
 * the record get the score card with their one step; everyone else the score and its status (none for a private
 * under-11 match).
 */
export function ScoreBlock({ target, home, away, onChanged, title }: ScoreTeams & { target: ScoreTarget; onChanged?: () => void; title?: boolean }) {
  const { sessionId } = useAuth();
  const { copy } = useResultCopy();
  const [summary, setSummary] = useState<{ key: string; value?: ScoreSummary; error?: string }>();
  const [attempt, setAttempt] = useState(0);
  const key = `${sessionId}:${target.kind}:${target.eventId}`;
  const failed = copy('The score could not load.', 'ანგარიში ვერ ჩაიტვირთა.');
  useEffect(() => {
    const controller = new AbortController();
    void getScoreSummary({ kind: target.kind, eventId: target.eventId }, controller.signal, sessionId)
      .then(value => { if (!controller.signal.aborted) setSummary({ key, value }); })
      .catch(cause => { if (!controller.signal.aborted) setSummary({ key, error: extractApiErrorMessage(cause, failed) }); });
    return () => controller.abort();
  }, [key, target.kind, target.eventId, sessionId, attempt, failed]);
  const changed = useCallback(() => { setAttempt(n => n + 1); onChanged?.(); }, [onChanged]);
  const current = summary?.key === key ? summary : undefined;
  if (!current?.value) return <div className="gk gk-score">{current?.error
    ? <p className="gk-score__error" role="alert">{current.error} <button type="button" className="gk-btn gk-btn--sm gk-btn--ghost" onClick={() => setAttempt(n => n + 1)}>{copy('Try again', 'ხელახლა')}</button></p>
    : <p className="gk-score__quiet" role="status">{copy('Loading the score…', 'ანგარიში იტვირთება…')}</p>}</div>;
  const s = current.value;
  if (s.canReadAudit) return <MatchScore kind={target.kind} eventId={target.eventId} revision={s.revision} home={home} away={away} title={title} onChanged={changed} />;
  return <ResultSummary homeScore={s.homeScore} awayScore={s.awayScore} status={s.status} legacy={s.legacy} fixtureStatus={s.fixtureStatus}
    reported={s.reported} disputed={s.disputed} scorePrivate={s.scorePrivate} />;
}
