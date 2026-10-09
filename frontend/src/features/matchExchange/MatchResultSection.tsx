import { Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MediaImage } from '../../components/ui/MediaImage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { extractApiErrorMessage } from '../../utils/apiError';
import { ResultSummary } from '../matchHistory/ResultSummary';
import { useResultCopy } from '../matchHistory/copy';
import { getPublicMatchResult, type Match, type PublicMatchResult } from './api';
import { MatchResult } from './MatchResult';
import { useClock } from './hooks';
import { ResultSuggestionsPanel } from './ResultSuggestionsPanel';
import '../matchHistory/match-history.css';

export function MatchResultSection({ match, reload }: { match: Match; reload: () => void }) {
  const { sessionId } = useAuth();
  return <ResultSection key={`${sessionId}:${match.event_id}`} match={match} reload={reload} />;
}

function ResultSection({ match, reload }: { match: Match; reload: () => void }) {
  const now = useClock();
  const { sessionId } = useAuth();
  const { copy } = useResultCopy();
  const [summary, setSummary] = useState<PublicMatchResult>();
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [loadedLogo, setLoadedLogo] = useState<string>();
  const anchored = useRef(false);
  const fallback = copy('Could not load the match result.', 'მატჩის შედეგი ვერ ჩაიტვირთა.');
  useEffect(() => {
    const abort = new AbortController();
    const load = () => { void getPublicMatchResult(match.event_id, abort.signal, sessionId).then(next => {
      if (!abort.signal.aborted) { setSummary(next); setError(''); }
    }).catch(cause => { if (!abort.signal.aborted) { setSummary(undefined); setError(extractApiErrorMessage(cause, fallback)); } }); };
    load();
    const timer = window.setInterval(() => { if (!document.hidden) load(); }, 30000);
    window.addEventListener('focus', load);
    return () => { abort.abort(); clearInterval(timer); window.removeEventListener('focus', load); };
  }, [match.event_id, match.result_status, match.home_score, match.away_score, sessionId, refresh, fallback]);
  useEffect(() => {
    if (!summary || anchored.current || window.location.hash !== '#result') return;
    document.getElementById('result')?.scrollIntoView?.({ block: 'start' });
    anchored.current = true;
  }, [summary]);
  const changed = useCallback(() => { setRefresh(n => n + 1); reload(); }, [reload]);
  if (!summary) return <section id="result" className="mx-panel result-section"><h2>{copy('Match result', 'მატჩის შედეგი')}</h2>{error ? <><p role="alert">{error}</p><button type="button" onClick={() => setRefresh(n => n + 1)}>{copy('Retry result', 'ხელახლა ცდა')}</button></> : <p role="status">{copy('Loading result…', 'შედეგი იტვირთება…')}</p>}</section>;
  return <>
    <section id={summary.canReadAudit ? "scoreboard" : "result"} className="mx-panel result-section"><h2>{summary.canReadAudit ? copy('Scoreboard', 'ტაბლო') : copy('Match result', 'მატჩის შედეგი')}</h2><div className="match-scoreboard"><Link className="match-scoreboard-team" to={`/clubs/${match.club_id}`}><span className="match-team-mark">{(!match.club_logo_url || loadedLogo !== match.club_logo_url) && <Shield size={32}/>} {match.club_logo_url && <MediaImage src={match.club_logo_url} alt="" style={{ opacity: loadedLogo === match.club_logo_url ? 1 : 0 }} onLoad={() => setLoadedLogo(match.club_logo_url ?? undefined)} onError={() => setLoadedLogo(undefined)}/>}</span><strong>{match.club_name}</strong><small>{match.squad_name}</small></Link><div className="match-scoreboard-result"><ResultSummary homeScore={summary.homeScore} awayScore={summary.awayScore} status={summary.status} legacy={summary.legacy} fixtureStatus={summary.fixtureStatus} ended={new Date(match.ends_at_iso).getTime() <= now} /></div><div className="match-scoreboard-team"><span className="match-team-mark match-team-mark-away"><Shield size={32}/></span>{match.opponent_name && match.opponent_club_id ? <Link to={`/clubs/${match.opponent_club_id}`}><strong>{match.opponent_name}</strong></Link> : <strong>{copy('Opponent to be confirmed', 'მეტოქე დასაზუსტებელია')}</strong>}<small>{match.opponent_squad_name || (match.listing_status === 'OPEN' ? copy('Match proposal open', 'მატჩის შეთავაზება ღიაა') : '')}</small></div></div></section>
    {summary.canReadAudit && <details className="mx-panel mx-result-management" open={window.location.hash === '#result' || new Date(match.ends_at_iso).getTime() <= now || summary.status === 'PROPOSED' || summary.status === 'DISPUTED'}><summary>{copy('Result reporting & history', 'შედეგის შეტანა და ისტორია')}</summary><MatchResult key={`result:${summary.revision}`} match={match} reload={changed}/></details>}
    <ResultSuggestionsPanel key={`suggestions:${summary.revision}`} match={match} onChanged={changed} />
  </>;
}
