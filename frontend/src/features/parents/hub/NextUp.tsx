import { useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock3, MapPin } from 'lucide-react';
import { Crest } from '../../../design/visuals';
import { Skeleton } from '../../../design/primitives';
import { formatDate, formatTime } from '../../../utils/formatting';
import { activityColors, activityIcons } from '../../schedule/activityIcons';
import { availability } from '../../squadCommunication/attendance';
import { SessionAvailability } from '../../squadCommunication/SessionAvailability';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { useSessionReply } from '../../squadCommunication/useSessionReply';
import { useSquadSchedule, type SquadCalendarEvent } from '../../squadCommunication/useSquadSchedule';
import { useNow } from '../../clubWorkspace/useNow';
import type * as api from '../../squadCommunication/api';
import './next-up.css';

const DAY = 86400000;
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

/**
 * The child's next session, with "coming / can't come" for that child. Something the coach asked them to confirm
 * comes first; otherwise the soonest. One card, one action: the day and time big, the ground under it.
 */
export function NextUp({ squads, playerId, childName, crest }: { squads: api.SquadOverview[]; playerId: number; childName: string; crest?: string | null }) {
    const copy = useJourneyCopy();
    const [revision, setRevision] = useState(0);
    const range = useMemo(() => { const from = startOfToday(); return { from: from.toISOString(), to: new Date(from.getTime() + 15 * DAY).toISOString() }; }, []);
    const { events, loading, error } = useSquadSchedule(squads, range.from, range.to, revision, playerId, false);
    const now = useNow();
    const upcoming = events.filter(event => event.session && event.status !== 'CANCELLED' && Date.parse(event.endsAt) > now).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    const asks = (event: SquadCalendarEvent) => availability(event.session!).toConfirm.some(person => person.id === playerId);
    const next = upcoming.find(asks) ?? upcoming[0];
    if (loading) return <section className="ph-next" aria-busy="true"><Skeleton height={112} /></section>;
    if (!next) return <section className="ph-next ph-next--empty"><p>{error || copy(`Nothing planned for ${childName} in the next two weeks.`, `${childName}-ს მომდევნო ორ კვირაში არაფერი აქვს დაგეგმილი.`)}</p></section>;
    return <NextCard key={next.id} event={next} playerId={playerId} crest={crest} now={now} later={upcoming.length - 1} onSaved={() => setRevision(n => n + 1)} />;
}

function NextCard({ event, playerId, crest, now, later, onSaved }: { event: SquadCalendarEvent; playerId: number; crest?: string | null; now: number; later: number; onSaved: () => void }) {
    const copy = useJourneyCopy();
    const session = event.session!;
    const reply = useSessionReply(event.squadId, session, onSaved);
    const Icon = activityIcons[event.eventType] ?? activityIcons.TRAINING;
    const color = activityColors[event.eventType] ?? activityColors.TRAINING;
    const today = new Date(now).toDateString() === new Date(event.startsAt).toDateString();
    const tomorrow = new Date(now + DAY).toDateString() === new Date(event.startsAt).toDateString();
    const day = today ? copy('Today', 'დღეს') : tomorrow ? copy('Tomorrow', 'ხვალ') : formatDate(event.startsAt, { weekday: 'long', day: 'numeric', month: 'short' });
    const open = `/squads/${event.squadId}?tab=schedule&session=${session.id}&at=${encodeURIComponent(new Date(event.startsAt).toISOString())}&player=${playerId}`;
    return <section className="ph-next" style={{ '--ph-tone': color } as CSSProperties} aria-label={copy('Next up', 'შემდეგი')}>
        <Link className="ph-next__head" to={open}>
            <span className="ph-next__icon" aria-hidden="true"><Icon /></span>
            <span className="ph-next__when"><small>{day}</small><strong>{formatTime(event.startsAt)}<span>–{formatTime(event.endsAt)}</span></strong></span>
            <span className="ph-next__what"><strong>{event.title}</strong>
                <span className="ph-next__meta"><Crest src={crest} name={event.hostSquadName ?? ''} size={14} />{event.hostSquadName}</span>
                {event.locationText && <span className="ph-next__meta"><MapPin aria-hidden="true" />{event.locationText}</span>}
            </span>
            <ArrowRight className="ph-next__go" aria-hidden="true" />
        </Link>
        <SessionAvailability session={session} canManage={false} playerId={playerId} busy={reply.busy} ended={Date.parse(event.endsAt) <= now} pending={new Set(reply.pending.keys())} onReply={reply.reply} />
        {[...reply.pending.keys()].filter(id => id === playerId).map(id => <p key={id} className="ph-next__note" role="status">{copy('An earlier answer may not have been saved.', 'წინა პასუხი შესაძლოა არ შენახულა.')} <button type="button" className="ph-link" disabled={reply.busy} onClick={() => reply.retry(id)}>{copy('Send it again', 'ხელახლა გაგზავნა')}</button></p>)}
        {reply.error && <p className="ph-next__note ph-next__note--error" role="alert">{reply.error}</p>}
        {reply.saved && !reply.error && <p className="ph-next__note" role="status"><Clock3 aria-hidden="true" />{copy('Saved. The coach sees your answer.', 'შენახულია. მწვრთნელი ხედავს თქვენს პასუხს.')}</p>}
        {later > 0 && <Link className="ph-next__more" to={open.replace(/&session=\d+/, '')}>{copy(`${later} more in the next two weeks`, `კიდევ ${later} მომდევნო ორ კვირაში`)}</Link>}
    </section>;
}
