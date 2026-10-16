import { useMemo, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, MessagesSquare } from 'lucide-react';
import { Skeleton } from '../../../design/primitives';
import { FaceStack } from '../../../design/visuals';
import { formatDate, formatTime } from '../../../utils/formatting';
import { activityColors, activityIcons } from '../../schedule/activityIcons';
import { NextUp } from '../../parents/hub/NextUp';
import type { JoiningChild } from '../../parents/api';
import { availability, availabilityLabel } from '../attendance';
import { SquadMessages } from '../SquadMessages';
import { useJourneyCopy } from '../journeyCopy';
import { squadMessageUrl } from '../routes';
import { useSquadSchedule } from '../useSquadSchedule';
import type * as api from '../api';

/**
 * The squad page's first tab: the coaches' updates as the main thing; beside them the next session (the child's
 * reply for a parent, who is coming for a coach) and, for the coaches, the parents to talk to one by one.
 */
export function SquadUpdatesTab({ space, child, crest, onChanged }: { space: api.SquadOverview; child?: JoiningChild; crest: string | null; onChanged: () => void }) {
    const copy = useJourneyCopy();
    return <div className="sp-updates">
        <aside className="sp-updates__side">
            {child && <NextUp squads={[{ ...space, can_manage: false }]} playerId={child.playerId} childName={child.identity.fullName.split(' ')[0]} crest={crest} />}
            {space.can_manage && <CoachNext space={space} />}
            {space.can_manage && space.threads.length > 0 && <section className="sp-box">
                <h2 className="sp-box__title"><MessagesSquare aria-hidden="true" />{copy('Parents & guardians', 'მშობლები და მეურვეები')}</h2>
                <ul className="sp-threads">{space.threads.slice(0, 8).map(thread => <li key={thread.user_id}><Link to={squadMessageUrl(space.id, true, thread.user_id)}>
                    <FaceStack people={[{ id: thread.user_id, name: thread.full_name }]} size={26} /><span>{thread.full_name}</span>{thread.unread_count > 0 && <span className="sp-unread" aria-label={copy(`${thread.unread_count} unread`, `${thread.unread_count} წაუკითხავი`)}>{thread.unread_count}</span>}
                </Link></li>)}</ul>
                {space.threads.length > 8 && <Link className="sp-link" to={squadMessageUrl(space.id, true)}>{copy(`All ${space.threads.length}`, `ყველა ${space.threads.length}`)}</Link>}
            </section>}
        </aside>
        <div className="sp-updates__feed"><SquadMessages space={space} kind="ANNOUNCEMENT" thread={null} onSent={onChanged} /></div>
    </div>;
}

/** The coach's next session: when, where and the squad's faces ringed by their answer. */
function CoachNext({ space }: { space: api.SquadOverview }) {
    const copy = useJourneyCopy();
    const range = useMemo(() => { const from = new Date(); from.setHours(0, 0, 0, 0); return { from: from.toISOString(), to: new Date(from.getTime() + 15 * 86400000).toISOString() }; }, []);
    const { events, loading } = useSquadSchedule([space], range.from, range.to, 0, undefined, false);
    const next = events.filter(event => event.session && event.status !== 'CANCELLED' && Date.parse(event.endsAt) > Date.now()).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0];
    if (loading) return <Skeleton height={120} />;
    if (!next?.session) return <section className="sp-box"><p className="sp-quiet">{copy('Nothing planned in the next two weeks.', 'მომდევნო ორ კვირაში არაფერია დაგეგმილი.')}</p></section>;
    const value = availability(next.session);
    const out = new Set(value.cantCome.map(p => p.id)), ask = new Set(value.toConfirm.map(p => p.id));
    const Icon = activityIcons[next.eventType] ?? activityIcons.TRAINING;
    return <Link className="sp-box sp-next" style={{ '--sp-tone': activityColors[next.eventType] ?? activityColors.TRAINING } as CSSProperties} to={`?tab=schedule&session=${next.session.id}&at=${encodeURIComponent(new Date(next.startsAt).toISOString())}`}>
        <span className="sp-next__icon" aria-hidden="true"><Icon /></span>
        <span className="sp-next__text"><small>{formatDate(next.startsAt, { weekday: 'long', day: 'numeric', month: 'short' })} · {formatTime(next.startsAt)}</small><strong>{next.title}</strong>
            {next.locationText && <span className="sp-next__meta"><MapPin aria-hidden="true" />{next.locationText}</span>}</span>
        <ArrowRight className="sp-next__go" aria-hidden="true" />
        <span className="sp-next__who"><FaceStack people={value.invited.map(p => ({ id: p.id, name: p.name, tone: out.has(p.id) ? 'danger' : ask.has(p.id) ? 'warning' : undefined }))} max={9} size={24} label={availabilityLabel(next.session)} />
            <span className="sp-quiet">{availabilityLabel(next.session)}</span></span>
    </Link>;
}
