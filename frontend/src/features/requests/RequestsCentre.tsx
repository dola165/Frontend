import { EmptyState } from '../../components/ui/EmptyState';
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Inbox, ArrowUpRight, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { requestDestination, requests, type RequestPage, type RequestItem } from './api';
import { requestIcon } from './requestIcon';
import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import './requests.css';
import { UpdatesInbox } from './UpdatesInbox';
import { StaffAppointments } from '../clubOperations/PersonalClubWork';

type Copy = ReturnType<typeof useJourneyCopy>;

/** A request's state in words a club person uses; an unknown state is shown as it comes. */
function statusWord(status: string, copy: Copy) {
  const words: Record<string, [string, string]> = {
    PENDING: ['Waiting', 'ელოდება'], SHORTLISTED: ['Shortlisted', 'შერჩეული'], ACCEPTED: ['Accepted', 'მიღებული'], APPROVED: ['Approved', 'დამტკიცებული'],
    DECLINED: ['Declined', 'უარყოფილი'], REJECTED: ['Declined', 'უარყოფილი'], WITHDRAWN: ['Withdrawn', 'გაწვეული'], CANCELLED: ['Cancelled', 'გაუქმებული'],
    EXPIRED: ['Expired', 'ვადაგასული'], ENDED: ['Ended', 'დასრულებული'], COMPLETED: ['Done', 'დასრულებული'], CONFIRMED: ['Confirmed', 'დადასტურებული'],
  };
  const word = words[status];
  return word ? copy(word[0], word[1]) : status.toLowerCase().replaceAll('_', ' ');
}

/** "Today", "Yesterday", "3 days ago": when the request last moved, in the person's language. */
function when(updatedAt: string, copy: Copy) {
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(updatedAt).setHours(0, 0, 0, 0)) / 86400000);
  if (!Number.isFinite(days)) return '';
  if (days <= 0) return copy('Today', 'დღეს');
  if (days === 1) return copy('Yesterday', 'გუშინ');
  return days < 30 ? copy(`${days} days ago`, `${days} დღის წინ`) : new Date(updatedAt).toLocaleDateString();
}

export function RequestsCentre() {
  const { sessionId, user } = useAuth();
  const [params, setParams] = useSearchParams();
  if (params.has('permissionId')) return <Navigate replace to={`/parent?tab=connections&permissionId=${encodeURIComponent(params.get('permissionId') ?? '')}`} />;
  const updates = params.get('view') === 'updates';
  const choose = (view: string) => { const next = new URLSearchParams(); next.set('view', view); setParams(next); };
  return <div className="request-centre">
    <h1>Inbox</h1>
    <nav className="request-tabs" aria-label="Inbox views">
      <button type="button" aria-current={!updates ? 'page' : undefined} onClick={() => choose('needs-you')}>Needs you</button>
      <button type="button" aria-current={updates ? 'page' : undefined} onClick={() => choose('updates')}>Updates</button>
    </nav>
    {updates ? <UpdatesInbox /> : <Centre key={`${user?.id}:${sessionId}`} />}
  </div>;
}
function Centre() {
  const { sessionId, refreshNavigationCapabilities } = useAuth();
  const copy = useJourneyCopy();
  const [params, setParams] = useSearchParams();
  const selectedView = params.get('requestView') ?? params.get('view');
  const view = ['INCOMING', 'OUTGOING', 'HISTORY'].includes(selectedView ?? '') ? selectedView! : 'INCOMING';
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
      .catch(e=>{if(!c.signal.aborted)setActionError(extractApiErrorMessage(e,copy('Could not load invitation details. Close and reopen the invitation to try again.','მოწვევის დეტალები ვერ ჩაიტვირთა. დახურეთ და ხელახლა გახსენით.')));})
      .finally(()=>{if(!c.signal.aborted)setTermsLoading(false);});
    return()=>c.abort();
  },[review,sessionId,copy]);
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
      if (alive.current) { setReview(null); setMessage(accept ? copy('Invitation accepted. Its recorded outcome is in History.', 'მოწვევა მიღებულია. შედეგი ისტორიაშია.') : copy('Invitation declined. Its recorded outcome is in History.', 'მოწვევა უარყოფილია. შედეგი ისტორიაშია.')); await refreshNavigationCapabilities(); }
    } catch (e) { if (alive.current) setActionError(extractApiErrorMessage(e, copy('The invitation could not be updated. Refresh to check its current state before retrying.', 'მოწვევა ვერ განახლდა. განაახლეთ და შეამოწმეთ მისი მდგომარეობა.'))); }
    finally { submitting.current = false; if (alive.current) { setBusy(false); setRevision(r => r + 1); } }
  }
  useEffect(() => {
    const c = new AbortController(); setData(null); setError(''); setLoading(true);
    void requests(view, page, sessionId, c.signal).then(result => { if (!c.signal.aborted) { setData(result); window.dispatchEvent(new Event('requests-updated')); } })
      .catch(() => { if (!c.signal.aborted) setError(copy('Requests could not load. Your existing requests have not changed.', 'მოთხოვნები ვერ ჩაიტვირთა. არსებული მოთხოვნები არ შეცვლილა.')); })
      .finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [view, page, sessionId, revision, copy]);
  useEffect(() => {
    const refresh = () => { if (!document.hidden) { setRevision(r => r + 1); void refreshNavigationCapabilities().catch(() => {}); } };
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [refreshNavigationCapabilities]);
  const navigate = (next: string, n = 0) => setParams({ view: 'needs-you', requestView: next, ...(n ? { page: String(n) } : {}) });
  const tabLabel = (key: string) => key === 'INCOMING' ? copy('Incoming', 'შემოსული') : key === 'OUTGOING' ? copy('Sent', 'გაგზავნილი') : copy('History', 'ისტორია');
  return <section>
    <header><div><h2>{copy('Needs you', 'თქვენ გელოდებათ')}</h2><p>{copy('Invitations, applications and decisions that wait for you or your club.', 'მოწვევები, განაცხადები და გადაწყვეტილებები, რომლებიც თქვენ ან თქვენს კლუბს ელოდება.')}</p></div><button type="button" onClick={() => { setRevision(r => r + 1); void refreshNavigationCapabilities().catch(() => {}); }} disabled={loading}><RefreshCw size={16} />{copy('Refresh', 'განახლება')}</button></header>
    <StaffAppointments />
    <nav className="request-tabs" aria-label={copy('Request views', 'მოთხოვნების ხედები')}>{(['INCOMING', 'OUTGOING', 'HISTORY'] as const).map(key => <button type="button" key={key} aria-current={view === key ? 'page' : undefined} onClick={() => navigate(key)}>{tabLabel(key)}{data && <span>{data.counts[key.toLowerCase() as 'incoming' | 'outgoing' | 'history']}</span>}</button>)}</nav>
    <p className="request-help">{view === 'INCOMING' ? copy('Requests to you, or to a club you can manage.', 'მოთხოვნები თქვენთვის ან კლუბისთვის, რომელსაც მართავთ.') : view === 'OUTGOING' ? copy('Requests you sent, and invitations from the clubs you lead.', 'თქვენი გაგზავნილი მოთხოვნები და თქვენი კლუბის მოწვევები.') : copy('What was decided. Membership and permissions may have changed since.', 'რა გადაწყდა. წევრობა და უფლებები შეიძლება მას შემდეგ შეიცვალა.')}</p>
    {loading && <p role="status">{copy('Loading requests…', 'მოთხოვნები იტვირთება…')}</p>}
    {message && <p role="status">{message}</p>}
    {review && <section ref={reviewPanel} tabIndex={-1} className="request-review" aria-label={copy('Review invitation', 'მოწვევის განხილვა')}><h2>{review.title}</h2><p>{review.context}</p><p>{review.family === 'TOURNAMENT_INVITATION' ? copy('Accept for the named club, team or yourself. An accepted invitation moves to History; the organiser may still need to approve your entry or place it on a waitlist.', 'მიიღეთ დასახელებული კლუბის, გუნდის ან თქვენი სახელით. მიღებული მოწვევა ისტორიაში გადადის; ორგანიზატორმა შეიძლება კიდევ უნდა დაამტკიცოს მონაწილეობა ან მოლოდინის სიაში ჩაწეროს.') : copy('Accept the named responsibility at this club.', 'მიიღეთ ამ კლუბში დასახელებული პასუხისმგებლობა.')}</p>{termsLoading&&<p role="status">{copy('Loading invitation details…', 'მოწვევის დეტალები იტვირთება…')}</p>}{terms?.requiresSquad&&<label>{copy('Team entering the tournament', 'ტურნირში მონაწილე გუნდი')}<select aria-label={copy('Team entering the tournament', 'ტურნირში მონაწილე გუნდი')} value={squad} onChange={e=>setSquad(e.target.value)}><option value="">{copy('Choose your team', 'აირჩიეთ გუნდი')}</option>{terms.squads.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>{!terms.squads.length&&<span>{copy('This club needs a team before it can enter. Create a team in the club workspace, then reopen this invitation.', 'მონაწილეობისთვის კლუბს გუნდი სჭირდება. შექმენით გუნდი კლუბის სამუშაო სივრცეში და ხელახლა გახსენით მოწვევა.')}</span>}</label>}{actionError&&<p role="alert">{actionError}</p>}<div><button disabled={busy||termsLoading||review.family==='TOURNAMENT_INVITATION'&&(!terms||terms.requiresSquad&&!squad)} onClick={() => void respond(true)}>{copy('Accept invitation', 'მოწვევის მიღება')}</button><button disabled={busy} onClick={() => void respond(false)}>{copy('Decline invitation', 'მოწვევაზე უარი')}</button><button disabled={busy} onClick={() => setReview(null)}>{copy('Close', 'დახურვა')}</button></div></section>}
    {error && <p role="alert">{error} <button type="button" onClick={() => setRevision(r => r + 1)}>{copy('Retry', 'ხელახლა ცდა')}</button></p>}
    {data?.unavailableSources.length ? <p role="alert">{copy('Some request types are unavailable.', 'ზოგი ტიპის მოთხოვნა მიუწვდომელია.')} <button onClick={() => setRevision(r => r + 1)}>{copy('Retry missing requests', 'ხელახლა ცდა')}</button></p> : null}
    {data && !data.items.length && <EmptyState icon={Inbox} title={data.unavailableSources.length ? copy('No requests from available sources', 'ხელმისაწვდომი წყაროებიდან მოთხოვნა არ არის') : page ? copy('No more requests', 'მეტი მოთხოვნა არ არის') : view === 'INCOMING' ? copy('You’re up to date', 'ყველაფერი განხილულია') : view === 'OUTGOING' ? copy('No requests waiting for a reply', 'პასუხის მომლოდინე მოთხოვნა არ არის') : copy('No recorded outcomes yet', 'შედეგები ჯერ არ არის')} description={data.unavailableSources.length ? copy('Some request types could not load. Retry missing requests above to check the complete picture.', 'ზოგი ტიპის მოთხოვნა ვერ ჩაიტვირთა. სცადეთ ხელახლა ზემოთ.') : page ? copy('Return to an earlier page to see your requests.', 'მოთხოვნების სანახავად დაბრუნდით წინა გვერდზე.') : view === 'INCOMING' ? copy('Invitations and decisions that need your attention will appear here.', 'აქ გამოჩნდება მოწვევები და გადაწყვეტილებები, რომლებიც თქვენ გელოდებათ.') : view === 'OUTGOING' ? copy('Follow the progress of invitations and applications you send. Completed decisions move to History.', 'აქ ჩანს თქვენი გაგზავნილი მოწვევები და განაცხადები. დასრულებული ისტორიაში გადადის.') : copy('Accepted, declined and completed requests will stay here as a record of what happened.', 'მიღებული, უარყოფილი და დასრულებული მოთხოვნები აქ დარჩება.')} action={page ? {label:copy('Previous page', 'წინა გვერდი'),onClick:()=>navigate(view,page-1)} : {label:view==='HISTORY'?copy('View incoming requests', 'შემოსული მოთხოვნები'):copy('Go to Home', 'მთავარზე გადასვლა'),to:view==='HISTORY'?'/requests':'/home'}}/>}
    <div className="request-list">{data?.items.map(item => { const destination = requestDestination(item.destination); const Icon = requestIcon(item.family); return <article className="request-card" key={item.key}>
      <span className="request-card-icon" aria-hidden="true"><Icon size={22} strokeWidth={1.7}/></span>
      <div className="request-card-body"><p className="request-context">{item.context.replace(/\s*·\s*$/, '')}</p><h2>{item.title}</h2>{item.updatedAt && <p className="request-reference">{when(item.updatedAt, copy)}</p>}</div>
      <div className="request-outcome"><span className="request-status" data-pending={item.actionable} data-status={item.status.toLowerCase()}>{statusWord(item.status, copy)}</span>{item.actionable && ['CLUB_INVITATION', 'TOURNAMENT_INVITATION'].includes(item.family) ? <button onClick={() => { setReview(item); setMessage(''); }}>{copy('Review invitation', 'მოწვევის განხილვა')}</button> : destination && <Link to={destination}>{item.actionable ? item.actionLabel : view === 'HISTORY' ? copy('View outcome', 'შედეგის ნახვა') : copy('Open request', 'მოთხოვნის გახსნა')}<ArrowUpRight size={16} /></Link>}</div>
    </article>; })}</div>
    {data && (page > 0 || data.hasMore) && <nav className="request-pagination" aria-label={copy('Request pages', 'მოთხოვნების გვერდები')}><button disabled={!page} onClick={() => navigate(view, page - 1)}>{copy('Previous', 'წინა')}</button><span>{copy(`Page ${page + 1} · ${data.total} requests`, `გვერდი ${page + 1} · ${data.total} მოთხოვნა`)}</span><button disabled={!data.hasMore} onClick={() => navigate(view, page + 1)}>{copy('Next', 'შემდეგი')}</button></nav>}
  </section>;
}
