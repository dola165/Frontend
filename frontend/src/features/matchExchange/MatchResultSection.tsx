import { Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MediaImage } from '../../components/ui/MediaImage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { extractApiErrorMessage } from '../../utils/apiError';
import { ResultSummary } from '../matchHistory/ResultSummary';
import { useResultCopy } from '../matchHistory/copy';
import { getScoreSummary, type ScoreSummary } from '../scores/api';
import { MatchScore, type ScoreTeams } from '../scores/MatchScore';
import type { Match } from './api';
import { useClock } from './hooks';
import { ResultSuggestionsPanel } from './ResultSuggestionsPanel';
import '../matchHistory/match-history.css';

type ResultSectionProps = {
  match: Match; reload: () => void;
  /** False when the page shows the score itself (the match page's fixture band); only the record and suggestions remain. */
  scoreboard?: boolean;
  /** Receives the public score whenever it loads, for a page that shows the score elsewhere. */
  onSummary?: (summary: ScoreSummary | undefined) => void;
};

/** The two teams of a listing, as the score card names them. */
const matchTeams = (match: Match, opponent = 'Opponent'): ScoreTeams => ({
  home: { name: match.club_name, logo: match.club_logo_url }, away: { name: match.opponent_name || opponent },
});

export function MatchResultSection(props: ResultSectionProps) {
  const { sessionId } = useAuth();
  return <ResultSection key={`${sessionId}:${props.match.event_id}`} {...props} />;
}

function ResultSection({ match, reload, scoreboard = true, onSummary }: ResultSectionProps) {
  const now = useClock();
  const { sessionId } = useAuth();
  const { copy } = useResultCopy();
  const [summary, setSummary] = useState<ScoreSummary>();
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [loadedLogo, setLoadedLogo] = useState<string>();
  const anchored = useRef(false);
  const fallback = copy('The score could not load.', 'ანგარიში ვერ ჩაიტვირთა.');
  useEffect(() => {
    const abort = new AbortController();
    const load = () => { void getScoreSummary({ kind: 'EXCHANGE', eventId: match.event_id }, abort.signal, sessionId).then(next => {
      if (!abort.signal.aborted) { setSummary(next); setError(''); }
    }).catch(cause => { if (!abort.signal.aborted) { setSummary(undefined); setError(extractApiErrorMessage(cause, fallback)); } }); };
    load();
    const timer = window.setInterval(() => { if (!document.hidden) load(); }, 30000);
    window.addEventListener('focus', load);
    return () => { abort.abort(); clearInterval(timer); window.removeEventListener('focus', load); };
  }, [match.event_id, match.result_status, match.home_score, match.away_score, sessionId, refresh, fallback]);
  // The 24-hour reminder links to `#result`: bring the score into view once it has loaded.
  useEffect(() => {
    if (!summary || anchored.current || window.location.hash !== '#result') return;
    document.getElementById('result')?.scrollIntoView?.({ block: 'start' });
    anchored.current = true;
  }, [summary]);
  const changed = useCallback(() => { setRefresh(n => n + 1); reload(); }, [reload]);
  useEffect(() => { onSummary?.(summary); }, [summary, onSummary]);
  const retry = <button type="button" className="gk-btn gk-btn--sm gk-btn--secondary" onClick={() => setRefresh(n => n + 1)}>{copy('Try again', 'ხელახლა')}</button>;
  if (!summary && !scoreboard) return error ? <p className="gk-notice gk-notice--danger" role="alert">{error} {retry}</p> : null;
  if (!summary) return <section id="result" className="mx-panel result-section"><h2>{copy('Score', 'ანგარიში')}</h2>{error ? <p role="alert">{error} {retry}</p> : <p role="status">{copy('Loading the score…', 'ანგარიში იტვირთება…')}</p>}</section>;
  const teams = matchTeams(match, copy('Opponent', 'მეტოქე'));
  return <>
    {scoreboard && !summary.canReadAudit && <section id="result" className="mx-panel result-section"><h2>{copy('Score', 'ანგარიში')}</h2><div className="match-scoreboard"><Link className="match-scoreboard-team" to={`/clubs/${match.club_id}`}><span className="match-team-mark">{(!match.club_logo_url || loadedLogo !== match.club_logo_url) && <Shield size={32}/>} {match.club_logo_url && <MediaImage src={match.club_logo_url} alt="" style={{ opacity: loadedLogo === match.club_logo_url ? 1 : 0 }} onLoad={() => setLoadedLogo(match.club_logo_url ?? undefined)} onError={() => setLoadedLogo(undefined)}/>}</span><strong>{match.club_name}</strong><small>{match.squad_name}</small></Link><div className="match-scoreboard-result"><ResultSummary homeScore={summary.homeScore} awayScore={summary.awayScore} status={summary.status} legacy={summary.legacy} fixtureStatus={summary.fixtureStatus} reported={summary.reported} disputed={summary.disputed} scorePrivate={summary.scorePrivate} ended={new Date(match.ends_at_iso).getTime() <= now} /></div><div className="match-scoreboard-team"><span className="match-team-mark match-team-mark-away"><Shield size={32}/></span>{match.opponent_name && match.opponent_club_id ? <Link to={`/clubs/${match.opponent_club_id}`}><strong>{match.opponent_name}</strong></Link> : <strong>{copy('Opponent to be confirmed', 'მეტოქე დასაზუსტებელია')}</strong>}<small>{match.opponent_squad_name}</small></div></div></section>}
    {/* Those on the record (both clubs' staff, the referee, the organiser) get the card: the score, their one step, its history. */}
    {summary.canReadAudit && <div className="gk-match-score"><MatchScore revision={summary.revision} eventId={match.event_id} {...teams} line={scoreboard} onChanged={changed} /></div>}
    <ResultSuggestionsPanel key={`suggestions:${summary.revision}`} match={match} onChanged={changed} />
  </>;
}
