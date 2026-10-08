import { useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { ExternalLink } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useResultCopy } from '../matchHistory/copy';
import { getResultSuggestions, suggestMatchResult, reviewResultSuggestion, type Match, type ResultSide, type ResultSuggestion, type ResultSuggestions } from './api';

export function ResultSuggestionsPanel({ match, onChanged }: { match: Match; onChanged: () => void }) {
  const { sessionId } = useAuth();
  return <SuggestionWorkspace key={`${sessionId}:${match.event_id}`} match={match} onChanged={onChanged} />;
}

function SuggestionWorkspace({ match, onChanged }: { match: Match; onChanged: () => void }) {
  const { sessionId } = useAuth();
  const { copy, language } = useResultCopy();
  const [data, setData] = useState<ResultSuggestions>();
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(false);
  const [home, setHome] = useState(''), [away, setAway] = useState('');
  const [note, setNote] = useState(''), [evidence, setEvidence] = useState('');
  const [reviewId, setReviewId] = useState<number | null>(null), [reason, setReason] = useState(''), [side, setSide] = useState<ResultSide | ''>('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false), mounted = useRef(true);
  const draftRevision = useRef<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  const writeController = useRef<AbortController | null>(null);
  const loadFailure = copy('Could not load result suggestions.', 'შედეგის შეთავაზებები ვერ ჩაიტვირთა.');
  const stale = copy('The result changed. Review the latest version before trying again.', 'შედეგი შეიცვალა. ხელახლა ცდამდე გადახედეთ უახლეს ვერსიას.');

  const load = useCallback(async () => {
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    try {
      const next = await getResultSuggestions(match.event_id, page, abort.signal, sessionId);
      if (abort.signal.aborted || !mounted.current) return;
      setData(next); setError('');
      if (draftRevision.current != null && next.resultRevision !== draftRevision.current) {
        setOpen(false); setReviewId(null); setHome(''); setAway(''); setNote(''); setEvidence(''); setReason('');
        draftRevision.current = null; setNotice(stale);
      }
    } catch (cause) {
      if (abort.signal.aborted || !mounted.current) return;
      setData(undefined); setError(extractApiErrorMessage(cause, loadFailure));
    }
  }, [match.event_id, page, sessionId, loadFailure, stale]);
  useEffect(() => {
    mounted.current = true; void load();
    const refresh = () => { if (!document.hidden && !inFlight.current) void load(); };
    const timer = window.setInterval(refresh, 30000); window.addEventListener('focus', refresh);
    return () => { mounted.current = false; controller.current?.abort(); writeController.current?.abort(); window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [load]);

  async function write(row?: ResultSuggestion, action?: 'ADOPT' | 'DISMISS') {
    if (!data || inFlight.current) return;
    if (draftRevision.current != null && draftRevision.current !== data.resultRevision) { setNotice(stale); void load(); return; }
    const numericHome = Number(home), numericAway = Number(away);
    const selectedSide = (action === 'ADOPT' ? data.adoptableRoles : data.reviewableRoles).includes(side as ResultSide) ? side as ResultSide : (action === 'ADOPT' ? data.adoptableRoles : data.reviewableRoles)[0];
    if (row ? !action || !selectedSide || !reason.trim() : !data.canSuggest || home === '' || away === '' || !Number.isInteger(numericHome) || !Number.isInteger(numericAway) || numericHome < 0 || numericAway < 0 || numericHome > 100 || numericAway > 100) return;
    inFlight.current = true; setBusy(true); setError(''); setNotice(''); controller.current?.abort();
    const abort = new AbortController(); writeController.current = abort;
    try {
      const next = row && action
        ? await reviewResultSuggestion(match.event_id, row.id, { action, side: selectedSide, revision: data.resultRevision, suggestionRevision: row.revision, requestId: crypto.randomUUID(), reason: reason.trim() }, abort.signal, sessionId)
        : await suggestMatchResult(match.event_id, { homeScore: numericHome, awayScore: numericAway, note: note.trim() || undefined, evidenceUrl: evidence.trim() || undefined, revision: data.resultRevision, requestId: crypto.randomUUID() }, abort.signal, sessionId);
      if (abort.signal.aborted || !mounted.current) return;
      setData(next); setPage(next.page); setOpen(false); setReviewId(null); setHome(''); setAway(''); setNote(''); setEvidence(''); setReason(''); draftRevision.current = null;
      setNotice(action === 'ADOPT' ? copy('Suggestion adopted as a proposed score. Required confirmations still apply.', 'შეთავაზება მიღებულია ანგარიშის წინადადებად. აუცილებელი დადასტურებები კვლავ საჭიროა.') : action === 'DISMISS' ? copy('Suggestion dismissed. The match result is unchanged.', 'შეთავაზება უარყოფილია. მატჩის შედეგი არ შეცვლილა.') : copy('Suggestion sent for review. It does not change the official result.', 'შეთავაზება გაიგზავნა განსახილველად. ოფიციალური შედეგი არ შეცვლილა.'));
      onChanged();
    } catch (cause) {
      if (abort.signal.aborted || !mounted.current) return;
      if (isAxiosError(cause) && cause.response?.status === 409) { setReviewId(null); setOpen(false); draftRevision.current = null; setNotice(stale); void load(); }
      else {
        if (isAxiosError(cause) && [403, 404].includes(cause.response?.status ?? 0)) setData(undefined);
        setError(extractApiErrorMessage(cause, copy('Could not save this suggestion. Please try again.', 'შეთავაზება ვერ შეინახა. სცადეთ ხელახლა.')));
      }
    } finally { if (mounted.current) { inFlight.current = false; setBusy(false); } }
  }

  if (!data) return <section className="mx-panel result-suggestions"><h2>{copy('Result suggestions', 'შედეგის შეთავაზებები')}</h2>{error ? <><p role="alert">{error}</p><button type="button" onClick={() => void load()}>{copy('Try again', 'სცადეთ ხელახლა')}</button></> : <p role="status">{copy('Loading suggestions…', 'შეთავაზებები იტვირთება…')}</p>}</section>;
  if (!data.canSuggest && !data.canReview && !data.ownSuggestions.length) return null;
  const sideName = (value: ResultSide) => value === 'HOME' ? copy('Home team', 'მასპინძელი გუნდი') : value === 'AWAY' ? copy('Away team', 'სტუმარი გუნდი') : copy('Lead referee', 'მთავარი მსაჯი');
  const rowView = (row: ResultSuggestion, review: boolean) => <li className="result-suggestion" key={row.id}>
    <div className="result-suggestion-header"><strong>{row.homeScore} – {row.awayScore}</strong><span className="result-suggestion-state">{row.status === 'PENDING' ? copy('Awaiting review', 'განხილვის მოლოდინში') : row.status === 'ADOPTED' ? copy('Adopted for confirmation', 'მიღებულია დასადასტურებლად') : copy('Dismissed', 'უარყოფილი')}</span></div>
    <time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString(language === 'ka' ? 'ka-GE' : 'en-GB')}</time>
    {row.note && <p>{row.note}</p>}{review && row.reviewReason && <p>{copy("Review reason", "განხილვის მიზეზი")}: {row.reviewReason}</p>}{safeEvidence(row.evidenceUrl) && <a className="result-suggestion-evidence" href={row.evidenceUrl!} target="_blank" rel="noopener noreferrer nofollow">{copy('Open supporting evidence', 'მტკიცებულების გახსნა')} <ExternalLink size={14} aria-hidden="true" /><span className="sr-only">{copy('(opens in a new tab)', '(იხსნება ახალ ჩანართში)')}</span></a>}
    {review && row.status === 'PENDING' && <div className="result-suggestion-review"><button type="button" disabled={busy} aria-expanded={reviewId === row.id} onClick={() => { setReviewId(reviewId === row.id ? null : row.id); setReason(''); setSide(''); draftRevision.current = data.resultRevision; }}>{copy('Review suggestion', 'შეთავაზების განხილვა')}</button>
      {reviewId === row.id && <form className="mx-form" onSubmit={e => e.preventDefault()}>
        {data.reviewableRoles.length > 1 && <label className="mx-wide">{copy('Acting as', 'მოქმედებთ როგორც')}<select value={side || data.reviewableRoles[0]} disabled={busy} onChange={e => setSide(e.target.value as ResultSide)}>{data.reviewableRoles.map(value => <option key={value} value={value}>{sideName(value)}</option>)}</select></label>}
        <label className="mx-wide">{copy('Reason for review decision', 'გადაწყვეტილების მიზეზი')}<textarea required maxLength={1000} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} /></label>
        <p className="mx-muted mx-wide">{copy('Adopting proposes this score through the existing result process. It never confirms a score on behalf of another team or referee.', 'მიღება ამ ანგარიშს შედეგის დადასტურების არსებულ პროცესში წარადგენს. ის სხვა გუნდის ან მსაჯის ნაცვლად შედეგს არ ადასტურებს.')}</p>
        <footer>{data.adoptableRoles.length > 0 && <button type="button" className="mx-primary" disabled={busy || !reason.trim() || Boolean(side && !data.adoptableRoles.includes(side))} onClick={() => void write(row, 'ADOPT')}>{copy('Adopt as proposed score', 'ანგარიშის წინადადებად მიღება')}</button>}<button type="button" disabled={busy || !reason.trim() || !data.reviewableRoles.length} onClick={() => void write(row, 'DISMISS')}>{copy('Dismiss suggestion', 'შეთავაზების უარყოფა')}</button></footer>
        {!data.adoptableRoles.length && <p className="mx-muted mx-wide">{copy('This result cannot accept another proposal now. Review the current result above first.', 'ამ შედეგზე ახალი წინადადება ამჟამად ვერ მიიღება. ჯერ ზემოთ მოცემულ შედეგს გადახედეთ.')}</p>}
      </form>}
    </div>}
  </li>;

  return <section className="mx-panel result-suggestions" aria-label={copy('Result suggestions', 'შედეგის შეთავაზებები')}><h2>{copy('Result suggestions', 'შედეგის შეთავაზებები')}</h2><p className="result-suggestions-intro">{copy('Know the score? Share it with the match staff. Suggestions stay separate from the official result until reviewed and confirmed through the match process.', 'იცით ანგარიში? გაუზიარეთ მატჩის პასუხისმგებელ პირებს. განხილვასა და დადასტურებამდე შეთავაზება ოფიციალურ შედეგს არ ცვლის.')}</p>
    {error && <p className="mx-error" role="alert">{error}</p>}{notice && <p role="status" className="mx-notice">{notice}</p>}
    {!!data.ownSuggestions.length && <><h3>{copy('Your suggestions', 'თქვენი შეთავაზებები')}</h3><ul className="result-suggestion-list">{data.ownSuggestions.map(row => rowView(row, false))}</ul></>}
    {data.canSuggest && <><button type="button" disabled={busy} aria-expanded={open} onClick={() => { setOpen(value => !value); draftRevision.current = data.resultRevision; }}>{copy('Suggest result', 'შედეგის შეთავაზება')}</button>{open && <form className="mx-form" onSubmit={e => { e.preventDefault(); void write(); }}>
      <label>{match.club_name} {copy('score', 'ანგარიში')}<input required type="number" min={0} max={100} step={1} value={home} disabled={busy} onChange={e => setHome(e.target.value)} /></label><label>{match.opponent_name || copy('Away team', 'სტუმარი გუნდი')} {copy('score', 'ანგარიში')}<input required type="number" min={0} max={100} step={1} value={away} disabled={busy} onChange={e => setAway(e.target.value)} /></label>
      <label className="mx-wide">{copy('Supporting link (optional)', 'მტკიცებულების ბმული (არასავალდებულო)')}<input type="url" maxLength={2000} placeholder="https://" value={evidence} disabled={busy} onChange={e => setEvidence(e.target.value)} /></label>
      <label className="mx-wide">{copy('Note (optional)', 'შენიშვნა (არასავალდებულო)')}<textarea maxLength={1000} value={note} disabled={busy} onChange={e => setNote(e.target.value)} /></label><p className="mx-muted mx-wide">{copy('Share only match information. A public match report or scorecard link can help the staff review your suggestion.', 'გააზიარეთ მხოლოდ მატჩთან დაკავშირებული ინფორმაცია. მატჩის საჯარო ანგარიში ან ოქმის ბმული პასუხისმგებელ პირებს განხილვაში დაეხმარება.')}</p><footer><button className="mx-primary" disabled={busy || home === '' || away === ''}>{copy('Send suggestion', 'შეთავაზების გაგზავნა')}</button></footer>
    </form>}</>}
    {data.canReview && Boolean(data.reviewedSuggestions?.length) && <details><summary>{copy("Suggestion review history", "შეთავაზებების განხილვის ისტორია")}</summary><ul className="result-suggestion-list">{data.reviewedSuggestions?.map(row => rowView(row, true))}</ul></details>}
    {data.canReview && <><h3>{copy('Suggestions to review', 'განსახილველი შეთავაზებები')} ({data.pendingCount})</h3>{data.suggestions.length ? <ul className="result-suggestion-list">{data.suggestions.map(row => rowView(row, true))}</ul> : <p className="mx-muted">{copy('No pending suggestions on this page.', 'ამ გვერდზე განსახილველი შეთავაზებები არ არის.')}</p>}{(page > 0 || data.hasMore || data.hasMoreReviewed) && <div className="mx-actions"><button disabled={busy || page === 0} onClick={() => { setData(undefined); setPage(n => n - 1); }}>{copy('Previous', 'წინა')}</button><span>{copy('Page', 'გვერდი')} {page + 1}</span><button disabled={busy || (!data.hasMore && !data.hasMoreReviewed)} onClick={() => { setData(undefined); setPage(n => n + 1); }}>{copy('Next', 'შემდეგი')}</button></div>}</>}
  </section>;
}

function safeEvidence(value: string | null) {
  if (!value) return false;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
