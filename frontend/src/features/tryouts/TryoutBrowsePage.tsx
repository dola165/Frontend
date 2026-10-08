import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Search } from 'lucide-react';
import { searchTryouts, type PostingPage } from './api';
import { postingLabel, tryoutDate, useTryoutCopy } from './tryoutCopy';
import './tryout-discovery.css';

export default function TryoutBrowsePage() {
  const [params] = useSearchParams();
  return <TryoutBrowse key={params.toString()} />;
}
function TryoutBrowse() {
  const [params, setParams] = useSearchParams();
  const copy = useTryoutCopy();
  const [draft, setDraft] = useState(() => Object.fromEntries(['q', 'location', 'status', 'from', 'to'].map(k => [k, params.get(k) || (k === 'status' ? 'OPEN' : '')])));
  const [data, setData] = useState<PostingPage | null>(null), [error, setError] = useState(false), [retry, setRetry] = useState(0);
  const page = Math.min(10000, Math.max(0, Math.floor(Number(params.get('page')) || 0)));
  useEffect(() => {
    const request = new AbortController();
    void searchTryouts({ q: params.get('q') || '', location: params.get('location') || '', status: params.get('status') || 'OPEN',
      clubId: params.get('clubId') || undefined, from: params.get('from') || undefined, to: params.get('to') || undefined, page, size: 20 }, request.signal)
      .then(result => { if (!request.signal.aborted) { setData(result); setError(false); } }).catch(() => { if (!request.signal.aborted) setError(true); });
    return () => request.abort();
  }, [params, page, retry]);
  const change = (key: string, value: string) => setDraft(prev => ({ ...prev, [key]: value }));
  const turn = (nextPage: number) => { const next = new URLSearchParams(params); next.set('page', String(nextPage)); setParams(next); };
  return <main className="tryout-page">
    <header className="tryout-heading"><div><p className="tryout-eyebrow">{copy('Player opportunities', 'შესაძლებლობები მოთამაშეებისთვის')}</p><h1>{copy('Find a tryout', 'მოძებნეთ სინჯი')}</h1><p>{copy('Explore published club tryouts and review your applications in one place.', 'მოძებნეთ კლუბების საჯარო სინჯები და ნახეთ თქვენი განაცხადები ერთ სივრცეში.')}</p></div><Link to="/events">{copy('Football events', 'საფეხბურთო ღონისძიებები')}</Link></header>
    <form className="tryout-panel tryout-filters" onSubmit={e => { e.preventDefault(); setParams(Object.fromEntries(Object.entries({ ...draft, clubId: params.get('clubId') || '' }).filter(([, value]) => value))); }}>
      <label>{copy('Search', 'ძიება')}<input type="search" maxLength={200} value={draft.q} onChange={e => change('q', e.target.value)} placeholder={copy('Tryout, club or position', 'სინჯი, კლუბი ან პოზიცია')} /></label>
      <label>{copy('Location', 'მდებარეობა')}<input maxLength={100} value={draft.location} onChange={e => change('location', e.target.value)} /></label>
      <label>{copy('Status', 'სტატუსი')}<select value={draft.status} onChange={e => change('status', e.target.value)}>{['OPEN', 'CLOSED', 'FILLED', 'EXPIRED', 'CANCELLED', 'ALL'].map(state => <option key={state} value={state}>{state === 'ALL' ? copy('All published postings', 'ყველა გამოქვეყნებული განცხადება') : postingLabel(state, copy)}</option>)}</select></label>
      <label>{copy('From', 'დან')}<input type="date" value={draft.from} onChange={e => change('from', e.target.value)} /></label><label>{copy('Through', 'ჩათვლით')}<input type="date" value={draft.to} min={draft.from || undefined} onChange={e => change('to', e.target.value)} /></label>
      <div className="tryout-actions"><button className="tryout-primary" type="submit"><Search size={16} />{copy('Search tryouts', 'სინჯების ძიება')}</button><button type="button" onClick={() => setParams({})}>{copy('Clear filters', 'ფილტრების გასუფთავება')}</button></div>
    </form>
    {!data && !error && <p role="status">{copy('Searching tryouts…', 'სინჯების ძიება…')}</p>}
    {error && <p role="alert">{copy('Could not search. Check your filters and use a date range of up to one year.', 'ძიება ვერ მოხერხდა. შეამოწმეთ ფილტრები და აირჩიეთ მაქსიმუმ ერთი წლის შუალედი.')} <button type="button" onClick={() => setRetry(n => n + 1)}>{copy('Retry', 'ხელახლა ცდა')}</button></p>}
    {data && <p role="status">{data.total} {copy('tryouts found', 'სინჯი მოიძებნა')}</p>}
    {data?.items.length === 0 && <section className="tryout-panel"><h2>{copy('No matching tryouts', 'სინჯები ვერ მოიძებნა')}</h2><p>{copy('Try another club, location or date. Closed postings remain available through their own links and your application history.', 'სცადეთ სხვა კლუბი, მდებარეობა ან თარიღი. დახურული განცხადებები ხელმისაწვდომია მათი ბმულებითა და განაცხადების ისტორიით.')}</p></section>}
    <div className="tryout-results">{data?.items.map(item => <article className="tryout-panel" key={item.id}>
      <p className="tryout-eyebrow">{item.clubName}</p><h2><Link to={`/tryouts/${item.id}`}>{item.title}</Link></h2><p className="tryout-state" data-status={item.status}>{postingLabel(item.status, copy)}</p>
      <p>{item.tryoutDate ? tryoutDate(item.tryoutDate) : copy('Date to be confirmed', 'თარიღი დასაზუსტებელია')}</p>{item.location && <p>{item.location}</p>}
      <p>{[item.position, item.ageGroup].filter(Boolean).join(' · ')}</p><Link className="tryout-detail-link" to={`/tryouts/${item.id}`}>{copy('View tryout', 'სინჯის ნახვა')}<ArrowUpRight size={16} /></Link>
    </article>)}</div>
    {data && (page > 0 || data.hasMore) && <nav className="tryout-actions tryout-pagination" aria-label={copy('Tryout pages', 'სინჯების გვერდები')}><button type="button" disabled={page === 0} onClick={() => turn(page - 1)}>{copy('Previous', 'წინა')}</button><span>{copy('Page', 'გვერდი')} {page + 1}</span><button type="button" disabled={!data.hasMore} onClick={() => turn(page + 1)}>{copy('Next', 'შემდეგი')}</button></nav>}
  </main>;
}
