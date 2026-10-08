import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Megaphone, LockKeyhole } from 'lucide-react';
import { useOverviewSource } from '../../features/clubs/useOverviewSource';
import type { ParentHub } from '../../features/parents/api';
import type { SquadMessage, SquadSession, SquadSpace } from '../../features/squadCommunication/api';
import { formatDate } from '../../utils/formatting';

/** Mounted only for a current family connection; every source still enforces server permissions. */
export function ClubFamilyBriefing({clubId, showUpdates = true}:{clubId:number;showUpdates?:boolean}) {
    const family = useOverviewSource<ParentHub>('/parents/hub');
    const spaces = useOverviewSource<SquadSpace[]>('/squad-communication');
    const children = family.data?.children.filter(child => child.clubId === clubId) ?? [];
    const squads = spaces.data?.filter(s => s.club_id === clubId && children.some(c => c.squadNames.includes(s.name))) ?? [];
    const sources = [family, spaces];
    return <section className="co-family" aria-label="Your family at this club">
        <header className="co-heading"><div><p className="co-eyebrow"><LockKeyhole size={12}/> Your family at the club</p><h2>The week ahead.</h2><p className="co-muted">{children.map(c => c.fullName).filter(Boolean).join(' · ') || 'Sessions and updates for your linked children'}</p></div><Link className="co-link" to="/parent">Parent Hub<ArrowRight size={16}/></Link></header>
        {sources.some(s => s.failed) ? <p className="co-status" role="alert">Your family updates couldn’t load. <button onClick={() => sources.filter(s => s.failed).forEach(s => s.retry())}>Try again</button></p>
            : sources.some(s => s.loading) ? <p className="co-status" role="status">Loading your family’s week…</p>
            : squads.length ? <div className="co-family-squads">{squads.map(squad => <FamilySquad key={squad.id} squad={squad} showUpdates={showUpdates} childIds={children.map(c => c.userId)}/>)}</div>
            : <p className="co-muted">Your linked squad’s sessions and coach updates will appear here when available. <Link className="co-link" to="/parent">View family connections<ArrowRight size={15}/></Link></p>}
    </section>;
}

function FamilySquad({squad, childIds, showUpdates}:{squad:SquadSpace;childIds:number[];showUpdates:boolean}) {
    const [window] = useState(() => { const start = new Date(), end = new Date(start); end.setDate(end.getDate()+14); return `from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`; });
    const sessions = useOverviewSource<SquadSession[]>(`/squad-communication/${squad.id}/sessions?${window}`);

    const [now] = useState(() => Date.now());
    const upcoming = [...(sessions.data ?? [])].filter(s => Date.parse(s.ends_at) >= now).sort((a,b) => Date.parse(a.starts_at)-Date.parse(b.starts_at)).slice(0,3);

    return <article className="co-family-squad"><header><span className="co-eyebrow">{squad.category || 'Your squad'}</span><h3>{squad.name}</h3></header><div className={`co-family-columns${showUpdates ? "" : " co-family-columns--schedule"}`}>
        <div><h4><CalendarDays size={17}/> Next 14 days</h4>{sessions.failed ? <button className="co-source-retry" onClick={sessions.retry}>Schedule unavailable · Try again</button> : sessions.loading ? <p role="status">Loading sessions…</p> : upcoming.length ? upcoming.map(s => <Link className="co-family-event" key={s.id} to={`/squads/${squad.id}?tab=sessions&sessionId=${s.id}&at=${encodeURIComponent(s.starts_at)}`}>
            <time dateTime={s.starts_at}>{formatDate(s.starts_at,{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</time><strong>{s.title}</strong><span>{s.status === 'CANCELLED' ? `Cancelled${s.cancellation_reason ? ` · ${s.cancellation_reason}` : ''}` : s.location || 'Location to be confirmed'}</span>
            {s.status !== 'CANCELLED' && s.attendance.some(p => childIds.includes(p.id) && p.response_status === 'RECONFIRMATION_REQUIRED') && <em>Please confirm your plans again</em>}
        </Link>) : <p>No sessions scheduled in the next 14 days.</p>}<Link className="co-link" to={`/squads/${squad.id}?tab=sessions`}>Full schedule<ArrowRight size={15}/></Link></div>
        {showUpdates && <FamilyAnnouncements squad={squad}/>}
    </div></article>;
}

function FamilyAnnouncements({squad}:{squad:SquadSpace}) {
    const messages = useOverviewSource<SquadMessage[]>(`/squad-communication/${squad.id}/messages?kind=ANNOUNCEMENT`);
    const updates = [...(messages.data ?? [])].sort((a,b) => Date.parse(b.created_at)-Date.parse(a.created_at)).slice(0,2);
    return (<div><h4><Megaphone size={17}/> Coach updates</h4>{messages.failed ? <button className="co-source-retry" onClick={messages.retry}>Updates unavailable · Try again</button> : messages.loading ? <p role="status">Loading updates…</p> : updates.length ? updates.map(m => <Link className="co-family-update" key={m.id} to={`/squads/${squad.id}?tab=announcements`}>
            <span>{m.important ? 'Important · ' : ''}{formatDate(m.created_at,{day:'numeric',month:'short'})}</span><strong>{m.title || m.author_name}</strong><p>{m.body}</p>{m.acknowledgement_requested && !m.acknowledged_at && <em>Read & acknowledge</em>}
        </Link>) : <p>No coach announcements yet.</p>}<Link className="co-link" to={`/squads/${squad.id}?tab=announcements`}>All coach updates<ArrowRight size={15}/></Link></div>);
}
