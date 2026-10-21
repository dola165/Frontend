import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, MapPin } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { fetchTryout, type TryoutPosting } from './api';
import { TryoutApplicationPanel } from './TryoutApplicationPanel';
import { postingLabel, tryoutDate, useTryoutCopy } from './tryoutCopy';
import './tryout-discovery.css';

export default function TryoutDetailPage() {
  const { tryoutId } = useParams();
  const { user, sessionId, status } = useAuth();
  const copy = useTryoutCopy();
  const id = Number(tryoutId);
  if (!/^[1-9]\d*$/.test(tryoutId || '') || !Number.isSafeInteger(id)) return <main className="tryout-page"><h1>{copy('Tryout not available', 'სინჯი მიუწვდომელია')}</h1><Link to="/tryouts">{copy('Browse tryouts', 'სინჯების მოძებნა')}</Link></main>;
  return <TryoutDetail key={`${id}:${user?.id}:${sessionId}:${status}`} id={id} />;
}
function TryoutDetail({ id }: { id: number }) {
  const { status, user, sessionId } = useAuth();
  const copy = useTryoutCopy();
  const [data, setData] = useState<TryoutPosting | null>(null), [error, setError] = useState(false), [missing, setMissing] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    const request = new AbortController();
    void fetchTryout(id, request.signal).then(result => { if (!request.signal.aborted) { setData(result); setError(false); setMissing(false); } })
      .catch(e => { if (!request.signal.aborted) { setData(null); setError(true); setMissing(e?.response?.status === 404); } });
    const refresh = () => setRetry(n => n + 1); window.addEventListener('focus', refresh);
    return () => { request.abort(); window.removeEventListener('focus', refresh); };
  }, [id, retry]);
  return <main className="tryout-page">
    <Link className="tryout-back" to="/tryouts"><ArrowLeft size={16} />{copy('All tryouts', 'ყველა სინჯი')}</Link>
    {!data && !error && <p role="status">{copy('Loading tryout…', 'სინჯი იტვირთება…')}</p>}
    {error && <section className="tryout-panel"><h1>{missing ? copy('Tryout not available', 'სინჯი მიუწვდომელია') : copy('Tryout could not load', 'სინჯი ვერ ჩაიტვირთა')}</h1><p>{copy('The posting may no longer be public. Your own application receipt remains separate.', 'განცხადება შესაძლოა აღარ იყოს საჯარო. თქვენი განაცხადის ჩანაწერი ცალკე ინახება.')}</p><button type="button" onClick={() => setRetry(n => n + 1)}>{copy('Retry', 'ხელახლა ცდა')}</button></section>}
    {data && <>
      <header className="tryout-heading"><div><p className="tryout-eyebrow">{copy('Player opportunities', 'შესაძლებლობები მოთამაშეებისთვის')}</p><h1>{data.title}</h1><Link to={`/clubs/${data.clubId}`}>{data.clubName}</Link></div><span className="tryout-state" data-status={data.status}>{postingLabel(data.status, copy)}</span></header>
      <section className="tryout-panel"><div className="tryout-facts"><p><CalendarDays size={18} />{data.tryoutDate ? tryoutDate(data.tryoutDate) : copy('Date to be confirmed', 'თარიღი დასაზუსტებელია')}</p>{data.location && <p><MapPin size={18} />{data.location}</p>}</div>
        {data.tryoutDate && <p className="tryout-help">{copy('Date and time as published by the club.', 'კლუბის მიერ გამოქვეყნებული თარიღი და დრო.')}</p>}
        <dl className="tryout-meta"><div><dt>{copy('Position', 'პოზიცია')}</dt><dd>{data.position || copy('All positions', 'ყველა პოზიცია')}</dd></div><div><dt>{copy('Age group', 'ასაკობრივი ჯგუფი')}</dt><dd>{data.ageGroup || copy('Not specified', 'მითითებული არ არის')}</dd></div><div><dt>{copy('Application deadline', 'განაცხადის ბოლო ვადა')}</dt><dd>{data.deadline ? tryoutDate(data.deadline) : copy('No separate deadline published', 'ცალკე ვადა გამოქვეყნებული არ არის')}</dd></div></dl>
        {data.description && <p className="tryout-description">{data.description}</p>}
        {data.status !== 'OPEN' && <p className="tryout-help">{copy('New applications are unavailable. Existing applicants can still review their own outcome below.', 'ახალი განაცხადების მიღება შეწყვეტილია. კანდიდატებს ქვემოთ საკუთარი შედეგის ნახვა შეუძლიათ.')}</p>}
      </section>
    </>}
    {status === 'authenticated' && <TryoutApplicationPanel key={`${id}:${user?.id}:${sessionId}`} id={id} onChanged={() => setRetry(n => n + 1)} />}
    {status === 'anonymous' && data && <section className="tryout-panel"><h2>{copy('Interested in this tryout?', 'დაინტერესებული ხართ ამ სინჯით?')}</h2><Link className="tryout-primary" to={`/login?next=${encodeURIComponent(`/tryouts/${id}`)}`}>{copy('Sign in to view your application', 'შედით თქვენი განაცხადის სანახავად')}</Link></section>}
  </main>;
}
