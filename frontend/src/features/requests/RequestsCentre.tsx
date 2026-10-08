import { EmptyState } from '../../components/ui/EmptyState';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Inbox, ArrowUpRight, RefreshCw, Building2, Flag, Trophy, HeartHandshake, CalendarDays, Handshake, FileCheck2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { requestDestination, requests, type RequestPage, type RequestItem } from './api';
import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import { extractApiErrorMessage } from '../../utils/apiError';
import './requests.css';

export function RequestsCentre() {
  const { sessionId, user } = useAuth();
  return <Centre key={`${user?.id}:${sessionId}`} />;
}
function Centre() {
  const { sessionId, refreshNavigationCapabilities } = useAuth();
  const [params, setParams] = useSearchParams();
  const view = ['INCOMING', 'OUTGOING', 'HISTORY'].includes(params.get('view') ?? '') ? params.get('view')! : 'INCOMING';
  const page = Math.min(10000, Math.max(0, Math.floor(Number(params.get('page')) || 0)));
  const [data, setData] = useState<RequestPage | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0);
  const [review, setReview] = useState<RequestItem | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [actionError,setActionError]=useState('');
  const [terms,setTerms]=useState<{requiresSquad:boolean;squads:{id:number;name:string}[]}|null>(null);
  const [squad,setSquad]=useState(''),[termsLoading,setTermsLoading]=useState(false);
  useEffect(()=>{
    setTerms(null);setSquad('');setActionError('');
    if(review?.family!=='TOURNAMENT_INVITATION'){setTermsLoading(false);return;}
    const c=new AbortController();setTermsLoading(true);
    void apiClient.get(`${review.destination}/invitations/${review.id}/review`,{signal:c.signal,_authSessionId:sessionId} as AuthSessionRequestConfig)
      .then(r=>{if(!c.signal.aborted)setTerms(r.data);})
      .catch(e=>{if(!c.signal.aborted)setActionError(extractApiErrorMessage(e,'Could not load invitation details. Close and reopen the invitation to try again.'));})
      .finally(()=>{if(!c.signal.aborted)setTermsLoading(false);});
    return()=>c.abort();
  },[review,sessionId]);
  const alive = useRef(true), submitting = useRef(false);
  const reviewPanel = useRef<HTMLElement>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (review) { reviewPanel.current?.focus(); reviewPanel.current?.scrollIntoView?.({ block: 'center' }); } }, [review]);
  async function respond(accept: boolean) {
    if (!review || submitting.current) return;
    const tournament = /^\/tournaments\/([1-9]\d*)$/.exec(review.destination)?.[1];
    const root = review.family === 'CLUB_INVITATION' ? `/club-memberships/invites/${review.id}` : review.family === 'TOURNAMENT_INVITATION' && tournament ? `/tournaments/${tournament}/invitations/${review.id}` : null;
    if (!root) return;
    if(accept && review.family==='TOURNAMENT_INVITATION' && (!terms || terms.requiresSquad&&!squad))return;
    submitting.current = true; setBusy(true); setActionError('');
    try {
      await apiClient.post(`${root}/${accept ? 'accept' : 'decline'}`, accept&&terms?.requiresSquad?{squadId:Number(squad)}:{}, { _authSessionId: sessionId } as AuthSessionRequestConfig);
      if (alive.current) { setReview(null); setMessage(accept ? 'Invitation accepted. Its recorded outcome is in History.' : 'Invitation declined. Its recorded outcome is in History.'); await refreshNavigationCapabilities(); }
    } catch (e) { if (alive.current) setActionError(extractApiErrorMessage(e, 'The invitation could not be updated. Refresh to check its current state before retrying.')); }
    finally { submitting.current = false; if (alive.current) { setBusy(false); setRevision(r => r + 1); } }
  }
  useEffect(() => {
    const c = new AbortController(); setData(null); setError(''); setLoading(true);
    void requests(view, page, sessionId, c.signal).then(result => { if (!c.signal.aborted) { setData(result); window.dispatchEvent(new Event('requests-updated')); } })
      .catch(() => { if (!c.signal.aborted) setError('Requests could not load. Your existing requests have not changed.'); })
      .finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [view, page, sessionId, revision]);
  useEffect(() => {
    const refresh = () => { if (!document.hidden) { setRevision(r => r + 1); void refreshNavigationCapabilities().catch(() => {}); } };
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [refreshNavigationCapabilities]);
  const navigate = (next: string, n = 0) => setParams({ view: next, ...(n ? { page: String(n) } : {}) });
  return <main className="request-centre">
    <header><div><span className="request-eyebrow">Your football work</span><h1>Requests</h1><p>Invitations, applications and decisions across your current responsibilities.</p></div><button type="button" onClick={() => { setRevision(r => r + 1); void refreshNavigationCapabilities().catch(() => {}); }} disabled={loading}><RefreshCw size={16} />Refresh</button></header>
    <nav className="request-tabs" aria-label="Request views">{(['INCOMING', 'OUTGOING', 'HISTORY'] as const).map(key => <button type="button" key={key} aria-current={view === key ? 'page' : undefined} onClick={() => navigate(key)}>{key === 'INCOMING' ? 'Incoming' : key === 'OUTGOING' ? 'Outgoing' : 'History'}{data && <span>{data.counts[key.toLowerCase() as 'incoming' | 'outgoing' | 'history']}</span>}</button>)}</nav>
    <p className="request-help">{view === 'INCOMING' ? 'Review requests addressed to you or to a club or venue you can currently manage.' : view === 'OUTGOING' ? 'Requests you sent, plus invitations sent by the clubs you currently lead.' : 'Recorded outcomes remain receipts. Current membership and permissions may have changed since a decision.'}</p>
    {loading && <p role="status">Loading requests…</p>}
    {message && <p role="status">{message}</p>}
    {review && <section ref={reviewPanel} tabIndex={-1} className="request-review" aria-label="Review invitation"><h2>{review.title}</h2><p>{review.context} · Invitation #{review.id}</p><p>{review.family === 'TOURNAMENT_INVITATION' ? 'Accept for the named club, team or yourself. An accepted invitation moves to History; the organiser may still need to approve your entry or place it on a waitlist.' : 'Accept the named responsibility at this club. Your existing responsibilities at other clubs remain separate.'}</p>{termsLoading&&<p role="status">Loading invitation details…</p>}{terms?.requiresSquad&&<label>Team entering the tournament<select aria-label="Team entering the tournament" value={squad} onChange={e=>setSquad(e.target.value)}><option value="">Choose your team</option>{terms.squads.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>{!terms.squads.length&&<span>This club needs a team before it can enter. Create a team in the club workspace, then reopen this invitation.</span>}</label>}{actionError&&<p role="alert">{actionError}</p>}<div><button disabled={busy||termsLoading||review.family==='TOURNAMENT_INVITATION'&&(!terms||terms.requiresSquad&&!squad)} onClick={() => void respond(true)}>Accept invitation</button><button disabled={busy} onClick={() => void respond(false)}>Decline invitation</button><button disabled={busy} onClick={() => setReview(null)}>Close</button></div></section>}
    {error && <p role="alert">{error} <button type="button" onClick={() => setRevision(r => r + 1)}>Retry</button></p>}
    {data?.unavailableSources.length ? <p role="alert">Some request types are unavailable. <button onClick={() => setRevision(r => r + 1)}>Retry missing requests</button></p> : null}
    {data && !data.items.length && <EmptyState icon={Inbox} title={data.unavailableSources.length ? 'No requests from available sources' : page ? 'No more requests' : view === 'INCOMING' ? 'You’re up to date' : view === 'OUTGOING' ? 'No requests waiting for a reply' : 'No recorded outcomes yet'} description={data.unavailableSources.length ? 'Some request types could not load. Retry missing requests above to check the complete picture.' : page ? 'Return to an earlier page to see your requests.' : view === 'INCOMING' ? 'Invitations and decisions that need your attention will appear here. You can continue with your clubs and personal workspaces.' : view === 'OUTGOING' ? 'Follow the progress of invitations and applications you send. Completed decisions move to History.' : 'Accepted, declined and completed requests will stay here as a record of what happened.'} action={page ? {label:'Previous page',onClick:()=>navigate(view,page-1)} : {label:view==='HISTORY'?'View incoming requests':'Open my workspaces',to:view==='HISTORY'?'/requests':'/workspaces'}}/>}
    <div className="request-list">{data?.items.map(item => { const destination = requestDestination(item.destination); const Icon = requestIcon(item.family); return <article className="request-card" key={item.key}>
      <span className="request-card-icon" aria-hidden="true"><Icon size={22} strokeWidth={1.7}/></span>
      <div className="request-card-body"><p className="request-context">{item.context}</p><h2>{item.title}</h2><p className="request-reference">{item.family.toLowerCase().replaceAll('_', ' ')} · #{item.id}{item.updatedAt && ` · ${new Date(item.updatedAt).toLocaleDateString()}`}</p></div>
      <div className="request-outcome"><span className="request-status" data-pending={item.actionable} data-status={item.status.toLowerCase()}>{item.status.toLowerCase().replaceAll('_', ' ')}</span>{item.actionable && ['CLUB_INVITATION', 'TOURNAMENT_INVITATION'].includes(item.family) ? <button onClick={() => { setReview(item); setMessage(''); }}>Review invitation</button> : destination && <Link to={destination}>{item.actionable ? item.actionLabel : view === 'HISTORY' ? 'View outcome' : 'Open request'}<ArrowUpRight size={16} /></Link>}</div>
    </article>; })}</div>
    {data && (page > 0 || data.hasMore) && <nav className="request-pagination" aria-label="Request pages"><button disabled={!page} onClick={() => navigate(view, page - 1)}>Previous</button><span>Page {page + 1} · {data.total} requests</span><button disabled={!data.hasMore} onClick={() => navigate(view, page + 1)}>Next</button></nav>}
  </main>;
}

function requestIcon(family:string) {
  if(family.includes('TOURNAMENT')) return Trophy;
  if(family.includes('REFEREE') || family.includes('OFFICIAL')) return Flag;
  if(family.includes('FAMILY') || family.includes('GUARDIAN') || family.includes('CONSENT')) return HeartHandshake;
  if(family.includes('BOOKING') || family.includes('VENUE')) return CalendarDays;
  if(family.includes('REPRESENTATION') || family.includes('APPROACH')) return Handshake;
  if(family.includes('CLUB') || family.includes('STAFF')) return Building2;
  return FileCheck2;
}

export function RequestsLink({ light = false }: { light?: boolean }) {
  const { sessionId, user } = useAuth();
  return user ? <RequestCount key={`${user.id}:${sessionId}`} light={light} /> : null;
}
function RequestCount({ light }: { light: boolean }) {
  const { sessionId } = useAuth(); const location = useLocation();
  const [result, setResult] = useState<{ key: string; count: number } | null>(null), [revision, setRevision] = useState(0);
  const key = `${sessionId}:${revision}:${location.pathname}`, count = result?.key === key ? result.count : null;
  useEffect(() => { const refresh = () => setRevision(r => r + 1); window.addEventListener('focus', refresh); window.addEventListener('requests-updated', refresh); const timer = window.setInterval(() => { if (!document.hidden) refresh(); }, 60000); return () => { clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('requests-updated', refresh); }; }, []);
  useEffect(() => { const c = new AbortController(); void requests('INCOMING', 0, sessionId, c.signal, 1).then(r => { if (!c.signal.aborted) setResult(r.unavailableSources.length ? null : { key, count: r.counts.actionable }); }).catch(() => { if (!c.signal.aborted) setResult(null); }); return () => c.abort(); }, [sessionId, key]);
  return <Link to="/requests" className={`requests-nav ${light ? 'requests-nav-light' : ''}`} title="Requests" aria-label={count == null ? 'Requests' : `Requests, ${count} awaiting your action`}><Inbox size={19} /><span className="requests-nav-label">Requests</span>{count != null && count > 0 && <span className="requests-count">{count > 99 ? '99+' : count}</span>}</Link>;
}
