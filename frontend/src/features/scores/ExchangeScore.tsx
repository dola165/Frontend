import { useEffect, useState } from 'react';
import { useResultCopy } from '../matchHistory/copy';
import { get, type Match } from '../matchExchange/api';
import { extractApiErrorMessage } from '../../utils/apiError';
import { ScoreBlock } from './ScoreBlock';
import './scores.css';

/**
 * The score of a Match Exchange match known only by its id (a calendar entry, a reminder): reads the match once for
 * its two teams, home first, then shows the same score as everywhere.
 */
export function ExchangeScore({ eventId, onChanged, title }: { eventId: number; onChanged?: () => void; title?: boolean }) {
  const { copy } = useResultCopy();
  const [match, setMatch] = useState<{ id: number; value?: Match; error?: string }>();
  const [attempt, setAttempt] = useState(0);
  const failed = copy('The match could not load.', 'მატჩი ვერ ჩაიტვირთა.');
  useEffect(() => {
    const controller = new AbortController();
    void get<Match>(`/match-exchange/${eventId}`, undefined, controller.signal)
      .then(value => { if (!controller.signal.aborted) setMatch({ id: eventId, value }); })
      .catch(cause => { if (!controller.signal.aborted) setMatch({ id: eventId, error: extractApiErrorMessage(cause, failed) }); });
    return () => controller.abort();
  }, [eventId, attempt, failed]);
  const current = match?.id === eventId ? match : undefined;
  if (!current?.value) return <div className="gk gk-score">{current?.error
    ? <p className="gk-score__error" role="alert">{current.error} <button type="button" className="gk-btn gk-btn--sm gk-btn--ghost" onClick={() => setAttempt(n => n + 1)}>{copy('Try again', 'ხელახლა')}</button></p>
    : <p className="gk-score__quiet" role="status">{copy('Loading the score…', 'ანგარიში იტვირთება…')}</p>}</div>;
  const m = current.value;
  return <ScoreBlock target={{ kind: 'EXCHANGE', eventId }} title={title} onChanged={onChanged}
    home={{ name: m.club_name, logo: m.club_logo_url }} away={{ name: m.opponent_name || copy('Opponent', 'მეტოქე') }} />;
}
