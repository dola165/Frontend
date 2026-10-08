import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, LockKeyhole, Megaphone, MessageCircle } from 'lucide-react';
import { apiClient } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { useOverviewSource } from '../../features/clubs/useOverviewSource';
import type { SquadMessage, SquadSpace } from '../../features/squadCommunication/api';
import type { FeedPostDto } from '../feed/FeedPost';
import { formatDate } from '../../utils/formatting';
import './club-updates.css';

type Update = { key: string; to: string; kind: 'post' | 'coach'; date: string; author: string; context: string; title?: string; body: string; important?: boolean; acknowledge?: boolean };

/** Only the server's current authorized spaces select private sources. Football identity grants nothing. */
function useCoachUpdates(clubId: number) {
    const { sessionId, status } = useAuth();
    const [attempt, setAttempt] = useState(0);
    const key = `${sessionId}:${status}:${clubId}:${attempt}`;
    const [result, setResult] = useState<{ key: string; updates: Update[]; failed: boolean }>();
    useEffect(() => {
        if (status !== 'authenticated') return;
        const controller = new AbortController();
        async function read() {
            const { data } = await apiClient.get<SquadSpace[]>('/squad-communication', { signal: controller.signal });
            const squads = data.filter(s => s.club_id === clubId);
            const updates: Update[] = [];
            let failed = false;
            // Bound concurrency while retaining announcements from every authorized squad at this club.
            for (let i = 0; i < squads.length && !controller.signal.aborted; i += 4) {
                const batch = await Promise.allSettled(squads.slice(i, i + 4).map(async squad => {
                    const response = await apiClient.get<SquadMessage[]>(`/squad-communication/${squad.id}/messages?kind=ANNOUNCEMENT`, { signal: controller.signal });
                    return response.data.filter(m => m.kind === 'ANNOUNCEMENT' && m.thread_user_id == null).slice(0, 4).map(m => ({
                        key: `coach:${squad.id}:${m.id}`, to: `/squads/${squad.id}?tab=announcements`, kind: 'coach' as const,
                        date: m.created_at, author: m.author_name, context: squad.name, title: m.title || undefined,
                        body: m.body, important: m.important, acknowledge: m.acknowledgement_requested && !m.acknowledged_at,
                    }));
                }));
                for (const response of batch) { if (response.status === 'fulfilled') updates.push(...response.value); else failed = true; }
            }
            if (!controller.signal.aborted) setResult({ key, updates, failed });
        }
        void read().catch(() => { if (!controller.signal.aborted) setResult({ key, updates: [], failed: true }); });
        return () => controller.abort();
    }, [clubId, key, status]);
    const current = status === 'authenticated' && result?.key === key ? result : undefined;
    return { updates: current?.updates ?? [], failed: current?.failed ?? false, loading: status === 'authenticated' && !current, retry: () => setAttempt(n => n + 1) };
}

export function ClubUpdates({ clubId, clubName, publishing = false }: { clubId: number; clubName: string; publishing?: boolean }) {
    const posts = useOverviewSource<{ posts: FeedPostDto[] }>(`/posts/club/${clubId}?limit=8`);
    const coaches = useCoachUpdates(clubId);
    const publicUpdates: Update[] = (posts.data?.posts ?? []).map(post => ({ key: `post:${post.id}`, to: `/posts/${post.id}`, kind: 'post', date: post.createdAt, author: post.authorName || clubName, context: post.clubName || clubName, body: post.content || 'Open this club post to see the photos and story.' }));
    const updates = [...publicUpdates, ...coaches.updates].sort((a, b) => Number(Boolean(b.acknowledge)) - Number(Boolean(a.acknowledge)) || Date.parse(b.date) - Date.parse(a.date)).slice(0, 16);
    const rail = useRef<HTMLDivElement>(null);
    const id = useId();
    const [edges, setEdges] = useState({ start: true, end: false });
    const measure = () => { const el = rail.current; if (el) setEdges({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 }); };
    useEffect(() => {
        measure();
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
        if (rail.current) observer?.observe(rail.current);
        return () => observer?.disconnect();
    }, [updates.map(u => u.key).join('|')]);
    const scroll = (direction: number) => {
        const el = rail.current;
        if (el) el.scrollBy({ left: direction * ((el.firstElementChild?.getBoundingClientRect().width ?? 340) + 16), behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    };
    return <section className="co-updates" aria-label="Latest from the club">
        <header className="co-heading"><div><p className="co-eyebrow">Around the club</p><h2>Latest from the club.</h2><p className="co-updates-intro">{coaches.updates.length ? 'Your squad updates and the club’s latest stories, together.' : 'News, conversations and moments from the club.'}</p></div><Link className="co-link" to={`/clubs/${clubId}?tab=posts`}>{publishing ? 'Club posts' : 'All posts'}<ArrowRight size={16}/></Link></header>
        {(posts.failed || coaches.failed) && <p className="co-status" role="alert">{posts.failed ? 'Club posts couldn’t be loaded.' : 'Some coach updates couldn’t be loaded.'} <button onClick={() => { if (posts.failed) posts.retry(); if (coaches.failed) coaches.retry(); }}>Try again</button></p>}
        {updates.length > 0 && !posts.loading && !coaches.loading && <>
            <div className="co-updates-carousel">
            <div className="co-updates-track" id={id} ref={rail} role="region" aria-label="Club updates, scroll for more" tabIndex={0} onScroll={measure} onKeyDown={event => { if (event.target === event.currentTarget && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); scroll(event.key === 'ArrowRight' ? 1 : -1); } }}>
                {updates.map(update => <Link className={`co-update co-update--${update.kind}`} key={update.key} to={update.to}>
                    <div className="co-update-top"><span>{update.kind === 'coach' ? <Megaphone size={15}/> : <MessageCircle size={15}/>} {update.kind === 'coach' ? 'Coach update' : 'Club post'}</span>{update.kind === 'coach' && <LockKeyhole size={13} aria-label="Squad members only"/>}</div>
                    <div className="co-update-context">{update.context}</div>
                    {update.important && <span className="co-update-important">Important</span>}
                    <div className="co-update-copy">{update.title && <h3>{update.title}</h3>}<p>{update.body}</p></div>
                    <footer><div><strong>{update.author}</strong><time dateTime={update.date}>{formatDate(update.date, { day: 'numeric', month: 'short' })}</time></div><ArrowUpRight size={18}/></footer>
                    {update.acknowledge && <span className="co-update-reply">Read & acknowledge<ArrowRight size={14}/></span>}
                </Link>)}
            </div>
            <button className="co-updates-arrow co-updates-arrow--previous" aria-label="Previous updates" aria-controls={id} disabled={edges.start} onClick={() => scroll(-1)}><ArrowLeft size={18}/></button>
            <button className="co-updates-arrow co-updates-arrow--next" aria-label="Next updates" aria-controls={id} disabled={edges.end} onClick={() => scroll(1)}><ArrowRight size={18}/></button>
            </div>
            <p className="co-updates-caption">{updates.length} recent {updates.length === 1 ? 'update' : 'updates'}{coaches.updates.length > 0 && ' · Squad updates are only visible to people with access'}</p>
        </>}
        {(posts.loading || coaches.loading) && <p className="co-status" role="status">Loading updates…</p>}
        {!updates.length && !posts.loading && !coaches.loading && !posts.failed && !coaches.failed && <div className="co-empty"><MessageCircle size={25}/><h3>The next chapter starts here.</h3><p>News and moments from the club will appear as they’re shared.</p><Link className="co-link" to={`/clubs/${clubId}?tab=posts`}>Open posts<ArrowRight size={16}/></Link></div>}
    </section>;
}
