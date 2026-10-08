import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, CalendarDays, History, MapPin, Search, SlidersHorizontal, RefreshCw, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { extractApiErrorMessage } from '../utils/apiError';
import { getMatchHistory, type HistoryMatch, type MatchHistoryPage, type MatchPeriod } from '../features/matchHistory/api';
import { useResultCopy } from '../features/matchHistory/copy';
import { ResultSummary } from '../features/matchHistory/ResultSummary';
import { HistoricalMatchImport } from '../features/matchHistory/HistoricalMatchImport';
import '../features/matchExchange/match-exchange.css';
import '../features/matchHistory/match-history.css';

const periods: MatchPeriod[] = ['UPCOMING', 'NEEDS_RESULT', 'HISTORY'];
const filterKeys = ['source', 'resultStatus', 'from', 'to', 'clubId', 'squadId', 'tournamentId', 'mine', 'q'];

export function MatchHistoryPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { sessionId } = useAuth();
  return <HistoryWorkspace key={sessionId ?? 'anonymous'} embedded={embedded} />;
}

function HistoryWorkspace({ embedded }: { embedded: boolean }) {
  const { sessionId } = useAuth();
  const { copy } = useResultCopy();
  const [params, setParams] = useSearchParams();
  const period = periods.includes(params.get('period') as MatchPeriod) ? params.get('period') as MatchPeriod : 'HISTORY';
  const pageValue = Number(params.get('page'));
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 0;
  const search = params.get('q') ?? '';
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  const query = new URLSearchParams({ period, page: String(page), size: '24' });
  for (const key of filterKeys) if (key !== 'q' && params.get(key)) query.set(key, params.get(key)!);
  if (debouncedSearch) query.set('q', debouncedSearch);
  const queryText = query.toString();
  const [response, setResponse] = useState<{ query: string; data: MatchHistoryPage }>();
  const [failure, setFailure] = useState<{ query: string; message: string }>();
  const [refresh, setRefresh] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const requestId = useRef(0);
  const data = response?.query === queryText ? response.data : undefined;
  const error = failure?.query === queryText ? failure.message : '';
  const invalidRange = Boolean(params.get('from') && params.get('to') && params.get('from')! > params.get('to')!);
  const loadError = copy('Could not load match history. Please try again.', 'მატჩების ისტორია ვერ ჩაიტვირთა. სცადეთ ხელახლა.');

  useEffect(() => {
    if (invalidRange) return;
    const abort = new AbortController();
    const current = ++requestId.current;
    let busy = false;
    const load = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const result = await getMatchHistory(queryText, abort.signal, sessionId);
        if (!abort.signal.aborted && current === requestId.current) { setResponse({ query: queryText, data: result }); setFailure(undefined); }
      } catch (cause) {
        if (!abort.signal.aborted && current === requestId.current) { setResponse(undefined); setFailure({ query: queryText, message: extractApiErrorMessage(cause, loadError) }); }
      } finally { busy = false; }
    };
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    window.addEventListener('focus', load);
    return () => { abort.abort(); window.clearInterval(timer); window.removeEventListener('focus', load); };
  }, [queryText, sessionId, refresh, loadError, invalidRange]);

  const setFilter = useCallback((key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  }, [params, setParams]);
  const periodName = (value: MatchPeriod) => value === 'UPCOMING' ? copy('Upcoming', 'მომავალი') : value === 'NEEDS_RESULT' ? copy('Needs result', 'შედეგის მოლოდინში') : copy('History', 'ისტორია');
  const hasFilters = filterKeys.some(key => params.has(key));
  const filteredCount = filterKeys.filter(key => params.has(key) && key !== 'q').length;
  const scoped = ['clubId', 'squadId', 'tournamentId'].filter(key => params.has(key));
  const scopeName = (key: string) => {
    const id = Number(params.get(key));
    const row = data?.items.find(item => key === 'clubId' ? item.homeClubId === id || item.awayClubId === id : key === 'squadId' ? item.homeSquadId === id || item.awaySquadId === id : item.tournamentId === id);
    if (key === 'clubId') return (row?.homeClubId === id ? row.homeClubName : row?.awayClubName) || copy('Selected club', 'არჩეული კლუბი');
    if (key === 'squadId') return (row?.homeSquadId === id ? row.homeSquadName : row?.awaySquadName) || copy('Selected squad', 'არჩეული გუნდი');
    return row?.tournamentName || copy('Selected tournament', 'არჩეული ტურნირი');
  };

  const Container = embedded ? 'section' : 'main';
  return <Container className="mx-page mh-page">
    {!embedded && <Link className="mx-back" to="/match-exchange"><ArrowLeft size={16} aria-hidden="true" /> {copy('Match Exchange', 'მატჩების სივრცე')}</Link>}
    <header className="mh-hero">
      <div><span className="mx-eyebrow">{copy('THE MATCH RECORD', 'მატჩების ჩანაწერები')}</span>{embedded ? <h2>{copy('Fixtures & results', 'მატჩები და შედეგები')}</h2> : <h1>{copy('Results & history', 'შედეგები და ისტორია')}</h1>}<p>{copy('Every fixture has a story. Follow upcoming matches, complete missing results and revisit the score.', 'თითოეულ მატჩს თავისი ისტორია აქვს. ნახეთ მომავალი მატჩები, შეავსეთ გამოტოვებული შედეგები და გადახედეთ ანგარიშებს.')}</p></div>
      <div className="mx-actions"><Link className="mx-button" to="/calendar"><CalendarDays size={16} aria-hidden="true" /> {copy('Open schedule', 'კალენდრის გახსნა')}</Link><button type="button" className="mh-refresh" aria-label={copy('Refresh match history', 'მატჩების ისტორიის განახლება')} onClick={() => setRefresh(n => n + 1)}><RefreshCw size={18} aria-hidden="true" /></button></div>
    </header>
    <HistoricalMatchImport clubId={Number(params.get('clubId')) || undefined} onSaved={() => setRefresh(n => n + 1)} />
    <nav className="mh-periods" aria-label={copy('Match period', 'მატჩების პერიოდი')}>{periods.map(value => <button key={value} type="button" aria-pressed={period === value} onClick={() => setFilter('period', value)}>{periodName(value)}</button>)}</nav>
    <div className="mh-period-intro"><h2>{periodName(period)}</h2><p>{period === 'HISTORY' ? copy('Newest first. An empty score means no result has been recorded.', 'უახლესი მატჩები პირველია. ცარიელი ანგარიში ნიშნავს, რომ შედეგი არ დაფიქსირებულა.') : period === 'NEEDS_RESULT' ? copy('Past fixtures with missing, unconfirmed or disputed results. Open a match to see the available actions.', 'წარსული მატჩები გამოტოვებული, დაუდასტურებელი ან სადავო შედეგებით. ხელმისაწვდომი მოქმედებებისთვის გახსენით მატჩი.') : copy('Scheduled fixtures, with the nearest match first.', 'დაგეგმილი მატჩები უახლოესი თარიღით.')}</p></div>
    <div className="mx-search-toolbar"><label className="mx-search-field"><Search size={18} aria-hidden="true" /><input type="search" aria-label={copy('Search match history', 'მატჩების ისტორიის ძიება')} placeholder={copy('Search matches, clubs or teams', 'მატჩის, კლუბის ან გუნდის ძიება')} value={params.get('q') ?? ''} onChange={e => setFilter('q', e.target.value)} /></label><button type="button" aria-expanded={filtersOpen} aria-controls="mh-filters" onClick={() => setFiltersOpen(open => !open)}><SlidersHorizontal size={16} aria-hidden="true" /> {copy('Filters', 'ფილტრები')}{filteredCount > 0 ? ` (${filteredCount})` : ''}</button></div>
    {scoped.length > 0 && <div className="mh-scope">{scoped.map(key => <button key={key} type="button" onClick={() => setFilter(key, '')}>{scopeName(key)} <X size={13} aria-hidden="true" /><span className="sr-only">{copy('Remove filter', 'ფილტრის წაშლა')}</span></button>)}</div>}
    {filtersOpen && <form id="mh-filters" className="mx-filters mh-filters" onSubmit={e => e.preventDefault()}>
      <label>{copy('Match source', 'მატჩის წყარო')}<select value={params.get('source') ?? ''} onChange={e => setFilter('source', e.target.value)}><option value="">{copy('All matches', 'ყველა მატჩი')}</option><option value="MATCH_EXCHANGE">{copy('Match Exchange', 'მატჩების სივრცე')}</option><option value="SCHEDULE">{copy('Club schedule', 'კლუბის კალენდარი')}</option><option value="TOURNAMENT">{copy('Tournaments', 'ტურნირები')}</option></select></label>
      <label>{copy('Result status', 'შედეგის სტატუსი')}<select value={params.get('resultStatus') ?? ''} onChange={e => setFilter('resultStatus', e.target.value)}><option value="">{copy('All results', 'ყველა შედეგი')}</option><option value="NONE">{copy('Result not recorded', 'შედეგი არ დაფიქსირებულა')}</option><option value="PROPOSED">{copy('Awaiting confirmation', 'დადასტურების მოლოდინში')}</option><option value="DISPUTED">{copy('Disputed', 'სადავო')}</option><option value="CONFIRMED">{copy('Confirmed', 'დადასტურებული')}</option><option value="RECORDED">{copy('Recorded by organizer', 'ორგანიზატორის მიერ დაფიქსირებული')}</option><option value="BYE">{copy("Bye · no match played", "გამოტოვება · მატჩი არ ჩატარებულა")}</option><option value="LEGACY">{copy('Previously recorded', 'ადრე დაფიქსირებული')}</option></select></label>
      <label>{copy('From date', 'საწყისი თარიღი')}<input type="date" value={params.get('from') ?? ''} onChange={e => setFilter('from', e.target.value)} /></label>
      <label>{copy('Until date', 'ბოლო თარიღი')}<input type="date" min={params.get('from') ?? undefined} value={params.get('to') ?? ''} onChange={e => setFilter('to', e.target.value)} /></label>
      <label className="mx-check"><input type="checkbox" checked={params.get('mine') === 'true'} onChange={e => setFilter('mine', e.target.checked ? 'true' : '')} />{copy('My teams & appointments', 'ჩემი გუნდები და დანიშვნები')}</label>
    </form>}
    {hasFilters && <button type="button" className="mh-clear" onClick={() => setParams(embedded ? { section: 'fixtures', period } : { period })}>{copy('Clear filters', 'ფილტრების გასუფთავება')}</button>}
    {invalidRange ? <p role="alert" className="mx-error">{copy('The end date must be on or after the start date.', 'ბოლო თარიღი არ უნდა იყოს საწყის თარიღამდე.')}</p>
      : error ? <section className="mx-panel mh-empty"><p role="alert">{error}</p><button type="button" onClick={() => setRefresh(n => n + 1)}>{copy('Try again', 'სცადეთ ხელახლა')}</button></section>
      : !data ? <p role="status" className="mh-empty">{copy('Loading matches…', 'მატჩები იტვირთება…')}</p>
      : <><p className="mh-count" role="status">{data.total} {copy('matches', 'მატჩი')}</p>{data.items.length === 0 ? <section className="mx-panel mh-empty"><History size={32} aria-hidden="true" /><h3>{period === 'NEEDS_RESULT' ? copy('No results need attention', 'შედეგები ყურადღებას არ საჭიროებს') : period === 'UPCOMING' ? copy('No upcoming matches here', 'მომავალი მატჩები არ არის') : copy('No match history here yet', 'მატჩების ისტორია ჯერ არ არის')}</h3><p>{hasFilters ? copy('Try a wider date range or clear your filters.', 'სცადეთ უფრო ფართო პერიოდი ან გაასუფთავეთ ფილტრები.') : copy('Matches appear here when they are scheduled or recorded by a team or tournament organizer.', 'მატჩები გამოჩნდება, როცა გუნდი ან ტურნირის ორგანიზატორი მათ დაგეგმავს ან დააფიქსირებს.')}</p><Link to="/match-exchange">{copy('Find a match', 'მატჩის ძიება')} →</Link></section> : <div className="mh-list">{data.items.map(match => <HistoryCard key={match.id} match={match} upcoming={period === 'UPCOMING'} />)}</div>}
        {data.total > 0 && <nav className="mx-pagination" aria-label={copy('Match history pages', 'მატჩების ისტორიის გვერდები')}><button disabled={page === 0} onClick={() => setFilter('page', String(page - 1))}>{copy('Previous', 'წინა')}</button><span>{copy('Page', 'გვერდი')} {page + 1} / {Math.max(1, Math.ceil(data.total / data.pageSize))}</span><button disabled={(page + 1) * data.pageSize >= data.total} onClick={() => setFilter('page', String(page + 1))}>{copy('Next', 'შემდეგი')}</button></nav>}
      </>}
  </Container>;
}

export function HistoryCard({ match, upcoming }: { match: HistoryMatch; upcoming: boolean }) {
  const { copy, language } = useResultCopy();
  const source = match.source === 'TOURNAMENT' ? match.tournamentName || copy('Tournament', 'ტურნირი') : match.source === 'SCHEDULE' ? copy('Club schedule', 'კლუბის კალენდარი') : copy('Match Exchange', 'მატჩების სივრცე');
  // Tournament/calendar timestamps without offsets retain their existing local-time semantics.
  const zone = /(?:Z|[+-]\d{2}:\d{2})$/.test(match.startsAt ?? '') && match.timezone ? match.timezone : undefined;
  const date = new Date(match.startsAt ?? '');
  const dateText = Number.isNaN(date.getTime()) ? copy('Date to be confirmed', 'თარიღი დასაზუსტებელია') : date.toLocaleString(language === 'ka' ? 'ka-GE' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', ...(zone ? { timeZone: zone } : {}) });
  const localizedDate = language === 'ka' ? dateText.replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\b/g, month => ({ Jan: 'იან', Feb: 'თებ', Mar: 'მარ', Apr: 'აპრ', May: 'მაი', Jun: 'ივნ', Jul: 'ივლ', Aug: 'აგვ', Sep: 'სექ', Sept: 'სექ', Oct: 'ოქტ', Nov: 'ნოე', Dec: 'დეკ' })[month] ?? month) : dateText;
  return <article className="mh-card">
    <div className="mh-card-meta"><span>{source}</span><time dateTime={match.startsAt ?? undefined}>{localizedDate}{match.startsAt && match.timezone ? ` · ${match.timezone}` : ''}</time></div>
    <h3 className="mh-match-title"><Link to={match.detailPath}>{match.title}</Link></h3>
    <div className="mh-scoreline"><Team name={match.homeClubName || copy('Home team', 'მასპინძელი გუნდი')} squad={match.homeSquadName} clubId={match.homeClubId} /><ResultSummary homeScore={match.homeScore} awayScore={match.awayScore} status={match.resultStatus} legacy={match.legacy} fixtureStatus={match.fixtureStatus} ended={!upcoming} compact /><Team name={match.awayClubName || copy('Opponent to be confirmed', 'მეტოქე დასაზუსტებელია')} squad={match.awaySquadName} clubId={match.awayClubId} /></div>
    <footer><span>{match.locationName && <><MapPin size={14} aria-hidden="true" />{match.locationName}</>}</span><Link className={match.canRecordResult && !upcoming ? 'mh-result-action' : ''} to={match.detailPath}>{match.canRecordResult && !upcoming ? copy('Review result', 'შედეგის ნახვა') : copy('Open match', 'მატჩის გახსნა')} <ArrowUpRight size={16} aria-hidden="true" /></Link></footer>
  </article>;
}

function Team({ name, squad, clubId }: { name: string; squad?: string | null; clubId: number | null }) {
  return <div className="mh-team"><span className="mh-team-mark" aria-hidden="true">{name.split(/\s+/).slice(0, 2).map(part => part[0]).join('')}</span><div>{clubId ? <Link to={`/clubs/${clubId}`}>{name}</Link> : <strong>{name}</strong>}{squad && <small>{squad}</small>}</div></div>;
}
