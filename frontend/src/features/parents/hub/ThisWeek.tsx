import { useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, MapPin } from 'lucide-react';
import { ButtonAnchor, Section, Skeleton } from '../../../design/primitives';
import { formatTime } from '../../../utils/formatting';
import { activityColors, activityIcons } from '../../schedule/activityIcons';
import { SessionAvailability } from '../../squadCommunication/SessionAvailability';
import { SquadSessionDetails } from '../../squadCommunication/SquadSessionDialog';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { useSessionReply } from '../../squadCommunication/useSessionReply';
import { useSquadSchedule, type SquadCalendarEvent } from '../../squadCommunication/useSquadSchedule';
import { useNow } from '../../clubWorkspace/useNow';
import type * as api from '../../squadCommunication/api';
import { useFamilyDateLabels } from '../useFamilyDateLabels';
import type { JoiningChild } from '../api';
import { firstName } from './childFacts';
import { childPath, sessionParam } from './childParams';
import { directionsUrl, squadTag, visitEvents } from './familyEvents';
import { FixtureReply } from './FixtureReply';
import { matchPath } from '../../matches/matchContext';
import './parent-hub.css';
import './next-up.css';

const DAY = 86400000;
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const dayKey = (value: Date | string) => { const d = new Date(value); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };

/**
 * This week for one child: the seven days from today with every session and match of every squad they play in, each
 * marked with its squad, and the next one large with its place, Directions and "Can't come". "Calendar ›" opens the one
 * calendar. A session opened from a notice (`session=squad:id`) opens here.
 */
export function ThisWeek({ squads, child }: { squads: api.SquadOverview[]; child: JoiningChild }) {
    const copy = useJourneyCopy();
    const labels = useFamilyDateLabels();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const [revision, setRevision] = useState(0);
    const range = useMemo(() => { const from = startOfToday(); return { from, to: new Date(from.getTime() + 7 * DAY) }; }, []);
    const { events, loading, error } = useSquadSchedule(squads, range.from.toISOString(), range.to.toISOString(), revision, child.playerId, false);
    const now = useNow();
    const first = firstName(child);
    const visits = useMemo(() => visitEvents(child, copy), [child, copy]);
    const week = [...events, ...visits].filter(e => Date.parse(e.endsAt) > range.from.getTime() && Date.parse(e.startsAt) < range.to.getTime())
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    const next = week.find(e => e.status !== 'CANCELLED' && Date.parse(e.endsAt) > now);
    const asked = sessionParam(params.get('session'));
    const opened = asked && events.find(e => e.squadId === asked.squadId && e.session?.id === asked.sessionId);
    const open = (event: SquadCalendarEvent) => {
        if (event.session && event.squadId) { const nextParams = new URLSearchParams(params); nextParams.set('session', `${event.squadId}:${event.session.id}`); setParams(nextParams); }
        else if (event.id.startsWith('visit:')) { const c = child.cases.find(item => item.sessions.some(p => `visit:${p.id}` === event.id)); if (c) navigate(`/admissions/cases/${c.id}?player=${child.playerId}`); }
        else if (event.origin === 'MATCH_EXCHANGE') navigate(matchPath(event.eventId, { kind: 'parent', playerId: child.playerId }));
    };
    const close = () => { const nextParams = new URLSearchParams(params); nextParams.delete('session'); nextParams.delete('at'); setParams(nextParams, { replace: true }); };
    const days = Array.from({ length: 7 }, (_, i) => new Date(range.from.getTime() + i * DAY));
    return <Section boxed icon={CalendarDays} tone="info" title={copy('This week', 'ეს კვირა')} className="ph-section ph-this-week"
        action={<Link className="gk-section__action" to={childPath(child.playerId, { view: 'calendar' })} data-guide="calendar-link">{copy('Calendar ›', 'კალენდარი ›')}</Link>}>
        {loading && !events.length ? <Skeleton height={150} /> : <>
            <ol className="ph-days" aria-label={copy(`${first}’s next seven days`, `${first}-ს მომდევნო შვიდი დღე`)}>
                {days.map(day => {
                    const items = week.filter(e => dayKey(e.startsAt) === dayKey(day));
                    return <li key={dayKey(day)} className="ph-day" data-today={dayKey(day) === dayKey(new Date()) || undefined}>
                        <span className="ph-day__name">{labels.weekday(day)} <span className="gk-num">{day.getDate()}</span></span>
                        {items.map(item => <button key={item.id} type="button" className="ph-day__item" data-cancelled={item.status === 'CANCELLED' || undefined}
                            style={{ '--ph-tone': activityColors[item.eventType] ?? activityColors.TRAINING } as CSSProperties} onClick={() => open(item)}
                            aria-label={`${item.title}, ${formatTime(item.startsAt)}${item.hostSquadName ? `, ${item.hostSquadName}` : ''}`}>
                            <span className="gk-num">{formatTime(item.startsAt)}</span> {item.id.startsWith('visit:') ? copy('Visit', 'ვიზიტი') : squadTag(item.hostSquadName)}
                        </button>)}
                    </li>;
                })}
            </ol>
            {error && <p className="ph-quiet" role="alert">{error}</p>}
            {next ? <NextSession key={next.id} event={next} child={child} now={now} onSaved={() => setRevision(n => n + 1)} onOpen={() => open(next)} />
                : <p className="ph-quiet">{copy(`Nothing planned for ${first} in the next seven days.`, `${first}-ს მომდევნო შვიდ დღეში არაფერი აქვს დაგეგმილი.`)}</p>}
        </>}
        {opened && <SquadSessionDetails key={opened.id} event={opened} playerId={child.playerId} optOut onClose={close} onSaved={() => setRevision(n => n + 1)} />}
    </Section>;
}

/**
 * The next one, large: when, what, which squad, where with Directions, and "Can't come", on a squad session and on a
 * connected fixture the child was called up for alike. An earlier answer that may not have been saved is offered again.
 */
function NextSession({ event, child, now, onSaved, onOpen }: { event: SquadCalendarEvent; child: JoiningChild; now: number; onSaved: () => void; onOpen: () => void }) {
    const copy = useJourneyCopy();
    const labels = useFamilyDateLabels();
    const reply = useSessionReply(event.squadId, event.session, onSaved);
    const Icon = activityIcons[event.eventType] ?? activityIcons.TRAINING;
    const today = new Date(now).toDateString() === new Date(event.startsAt).toDateString();
    const tomorrow = new Date(now + DAY).toDateString() === new Date(event.startsAt).toDateString();
    const day = today ? copy('Today', 'დღეს') : tomorrow ? copy('Tomorrow', 'ხვალ') : labels.nextDate(new Date(event.startsAt));
    const directions = directionsUrl(event.locationText, event.locationLat, event.locationLng);
    return <article className="ph-next" style={{ '--ph-tone': activityColors[event.eventType] ?? activityColors.TRAINING } as CSSProperties} aria-label={copy('Next up', 'შემდეგი')} data-guide="next-session">
        <button type="button" className="ph-next__head" onClick={onOpen}>
            <span className="ph-next__icon" aria-hidden="true"><Icon /></span>
            <span className="ph-next__when"><small>{day}</small><strong className="gk-num">{formatTime(event.startsAt)}<span>–{formatTime(event.endsAt)}</span></strong></span>
            <span className="ph-next__what"><strong>{event.title}</strong>
                {event.hostSquadName && <span className="ph-tag">{event.id.startsWith('visit:') ? event.subtitle : squadTag(event.hostSquadName)}</span>}
                {event.locationText && <span className="ph-next__meta"><MapPin aria-hidden="true" />{event.locationText}</span>}
            </span>
        </button>
        {event.session && <SessionAvailability session={event.session} canManage={false} playerId={child.playerId} optOut busy={reply.busy} ended={Date.parse(event.endsAt) <= now}
            pending={new Set(reply.pending.keys())} onReply={reply.reply} />}
        {!event.session && event.origin === 'MATCH_EXCHANGE' && <FixtureReply event={event} playerId={child.playerId} ended={Date.parse(event.endsAt) <= now} onSaved={onSaved} />}
        {reply.pending.has(child.playerId) && <p className="ph-next__note" role="status">{copy('An earlier answer may not have been saved.', 'წინა პასუხი შესაძლოა არ შენახულა.')} <button type="button" className="ph-link" disabled={reply.busy} onClick={() => reply.retry(child.playerId)}>{copy('Send it again', 'ხელახლა გაგზავნა')}</button></p>}
        {reply.error && <p className="ph-next__note ph-next__note--error" role="alert">{reply.error}</p>}
        {reply.saved && !reply.error && <p className="ph-next__note" role="status">{copy('Saved. The coach sees it.', 'შენახულია. მწვრთნელი ხედავს.')}</p>}
        {directions && <div className="ph-next__actions"><ButtonAnchor size="sm" variant="ghost" href={directions} target="_blank" rel="noreferrer" data-guide="directions">{copy('Directions', 'მარშრუტი')}<ArrowUpRight aria-hidden="true" /></ButtonAnchor></div>}
    </article>;
}
