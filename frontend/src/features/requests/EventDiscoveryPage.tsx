import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, Search, MapPin, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { eventDestination, eventSearch, type EventPage } from './api';
import './requests.css';

export function EventDiscoveryPage() {
  const { sessionId, user } = useAuth();
  const [params] = useSearchParams();
  return <Discovery key={`${user?.id}:${sessionId}:${params}`} />;
}
function Discovery() {
  const { sessionId } = useAuth(); const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState(() => Object.fromEntries(['q', 'location', 'activity', 'from', 'to'].map(k => [k, params.get(k) || (k === 'activity' ? 'ALL' : '')])));
  const [data, setData] = useState<EventPage | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0);
  const page = Math.min(10000, Math.max(0, Math.floor(Number(params.get('page')) || 0)));
  useEffect(() => {
    const c = new AbortController();
    void eventSearch({ q: params.get('q') || '', location: params.get('location') || '', activity: params.get('activity') || 'ALL', from: params.get('from') || undefined, to: params.get('to') || undefined, page, size: 20 }, sessionId, c.signal)
      .then(r => { if (!c.signal.aborted) { setData(r); setError(''); } }).catch(e => { if (!c.signal.aborted) setError(e?.response?.status === 400 ? 'Check your filters. Choose a date window of up to one year.' : 'Events could not load. Please try again.'); })
      .finally(() => { if (!c.signal.aborted) setLoading(false); }); return () => c.abort();
  }, [params, page, sessionId, retry]);
  const change = (k: string, v: string) => setDraft(d => ({ ...d, [k]: v }));
  const turn = (n: number) => { const next = new URLSearchParams(params); next.set('page', String(n)); setParams(next); };
  return <main className="request-centre event-discovery"><header><div><span className="request-eyebrow">Around the game</span><h1>Find events</h1><p>Search published tournaments, matches, training and tryouts by name, place and date.</p></div><CalendarDays size={30} /></header>
    <form className="event-filters" onSubmit={e => { e.preventDefault(); setParams(Object.fromEntries(Object.entries(draft).filter(([, v]) => v))); }}>
      <label>Search<input type="search" maxLength={200} value={draft.q} onChange={e => change('q', e.target.value)} placeholder="Name or club" /></label>
      <label>Location<input maxLength={100} value={draft.location} onChange={e => change('location', e.target.value)} placeholder="City, venue or address" /></label>
      <label>Activity<select value={draft.activity} onChange={e => change('activity', e.target.value)}>{['ALL', 'TOURNAMENT', 'MATCH', 'TRAINING', 'TRYOUT', 'OTHER'].map(a => <option key={a} value={a}>{a === 'ALL' ? 'All activities' : a[0] + a.slice(1).toLowerCase()}</option>)}</select></label>
      <label>From<input type="date" value={draft.from} onChange={e => change('from', e.target.value)} /></label><label>Through<input type="date" value={draft.to} onChange={e => change('to', e.target.value)} /></label>
      <button type="submit"><Search size={16} />Search events</button><button type="button" onClick={() => setParams({})}>Clear filters</button>
    </form>
    <p className="request-help">Leave dates empty to include past and future events. Private schedules and cancelled events do not appear here.</p>
    {loading && <p role="status">Searching events…</p>}{error && <p role="alert">{error} <button onClick={() => setRetry(v => v + 1)}>Retry</button></p>}
    {data && <p role="status">{data.total} {data.total === 1 ? 'event' : 'events'} found</p>}
    {data && !data.items.length && <section className="request-empty"><CalendarDays size={30} /><h2>No matching events</h2><p>Try another name, location or date range.</p></section>}
    <div className="request-list">{data?.items.map(item => { const destination = eventDestination(item); return <article key={`${item.kind}:${item.id}`}><div><p className="request-context">{item.context}</p><h2>{item.name}</h2><p>{item.activity.toLowerCase()} · {item.startsAt ? new Date(item.startsAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date to be confirmed'}{item.recurring ? ' · Recurring series' : ''}</p>{item.location && <p className="event-location"><MapPin size={14} />{item.location}</p>}</div>{destination && <Link to={destination}>{item.kind === 'SESSION' ? 'View public timetable' : 'View event'}<ArrowUpRight size={16} /></Link>}</article>; })}</div>
    {data && (page > 0 || data.hasMore) && <nav className="request-pagination" aria-label="Event pages"><button disabled={!page} onClick={() => turn(page - 1)}>Previous</button><span>Page {page + 1}</span><button disabled={!data.hasMore} onClick={() => turn(page + 1)}>Next</button></nav>}
  </main>;
}
